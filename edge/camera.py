import os
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/Volumes/WD_SSD/Dev/Project_II/Fall_Detect/keys/serviceAccountKey.json"

import time
import threading
from collections import deque
import subprocess
import cv2
import numpy as np
import joblib
from ultralytics import YOLO
from dotenv import load_dotenv

from edge.notifier import send_fall_incident
from ai.rule_filter import rule_fall_filter
from ai.cal_features import calculate_features
from edge.clip_uploader import upload_clip
from edge.incident_store import set_incident_clip_url

# ================= PATH SAFE =================
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))

MODEL_YOLO = os.path.join(PROJECT_ROOT, "models", "yolo11n-pose.pt")
MODEL_XGB = os.path.join(PROJECT_ROOT, "ai", "fall_model_xgb.joblib")
CLIP_DIR = os.path.join(PROJECT_ROOT, "clips")

# ---------------- CONFIG ----------------
SEQ_LEN = 30
CONF_YOLO = 0.4

FRAME_W, FRAME_H = 640, 360
FPS = 15

TEMPORAL_WINDOW = 8
TEMPORAL_CONFIRM = 2

# ✅ 1. ปรับความเร็วดิ่งพื้นให้เป็นระดับงานวิจัย (ตกเร็วเกิน 20 px/frame)
MOTION_SPIKE_THRESHOLD = 15

# ✅ 2. เปลี่ยนเป็นรอดูอาการ 3 วินาที (ป้องกันการสะดุดแล้วลุกทันที)
LYING_CONFIRM_FRAMES = FPS * 1.5

PRE_SEC = 12
POST_SEC = 6

RULE_VOTE_THRESHOLD = 4
XGB_THRESHOLD = 0.55

COOLDOWN_SECONDS = 8
MIN_INCIDENT_GAP = 10 

DISPLAY_FALL_SECONDS = 3
LYING_CONFIRM_SECONDS = 2.5

EXPECTED_FEATURES = 56

# ================= COCO SKELETON =================
SKELETON = [
    (5, 6), (5, 7), (7, 9),
    (6, 8), (8, 10),
    (5, 11), (6, 12),
    (11, 12),
    (11, 13), (13, 15),
    (12, 14), (14, 16)
]

def draw_skeleton(frame, kpts):
    for (i, j) in SKELETON:
        xi, yi = int(kpts[i][0]), int(kpts[i][1])
        xj, yj = int(kpts[j][0]), int(kpts[j][1])
        cv2.line(frame, (xi, yi), (xj, yj), (0, 255, 255), 2)
    for x, y in kpts:
        cv2.circle(frame, (int(x), int(y)), 4, (0, 255, 0), -1)

# ================= UTIL =================
def pick_device():
    try:
        import torch
        if torch.backends.mps.is_available(): return "mps"
        if torch.cuda.is_available(): return "cuda"
    except Exception:
        pass
    return "cpu"

def write_clip_mp4(path, frames, fps, w, h):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(path, fourcc, fps, (w, h))
    for f in frames:
        out.write(f)
    out.release()

def fix_mp4_for_web(in_path):
    out_path = in_path.replace(".mp4", "_fixed.mp4")
    cmd = [
        "ffmpeg", "-y", "-i", in_path,
        "-c:v", "libx264", "-profile:v", "baseline",
        "-level", "3.0", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", out_path
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path

def upload_async(incident_id, clip_path):
    try:
        url = upload_clip(os.path.abspath(clip_path), incident_id)
        if url:
            set_incident_clip_url(incident_id, url)
            print(f"[INFO] Clip uploaded successfully: {url}")
    except Exception as e:
        print("[ERROR] Upload failed:", e)

# ================= MOTION CHECK =================
def hip_drop_speed(prev_kpts, curr_kpts):
    if prev_kpts is None or len(prev_kpts) == 0: 
        return 0.0
    
    prev = np.asarray(prev_kpts)
    curr = np.asarray(curr_kpts)
    
    prev_hip_y = (prev[11][1] + prev[12][1]) / 2.0
    curr_hip_y = (curr[11][1] + curr[12][1]) / 2.0
    
    dy = curr_hip_y - prev_hip_y
    return float(dy) if dy > 0 else 0.0

def is_still(motion_buffer):
    if len(motion_buffer) < 10: 
        return False
    recent_motion = list(motion_buffer)[-10:] 
    avg_motion = np.mean(recent_motion)
    max_motion = np.max(recent_motion)
    return avg_motion < 1.5 and max_motion < 2.5

# ================= CAMERA THREAD =================
class CaptureThread:
    def __init__(self, cam_index=0):
        self.cap = cv2.VideoCapture(cam_index)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
        self.buf = deque(maxlen=FPS * 60)
        self.lock = threading.Lock()
        self.running = False

    def start(self):
        self.running = True
        threading.Thread(target=self._loop, daemon=True).start()
        return self

    def stop(self):
        self.running = False
        self.cap.release()

    def _loop(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                frame = cv2.resize(frame, (FRAME_W, FRAME_H))
                with self.lock:
                    self.buf.append(frame.copy())

    def latest(self):
        with self.lock:
            return self.buf[-1].copy() if self.buf else None

    def last_n(self, n):
        with self.lock:
            return list(self.buf)[-n:]

# ================= MAIN =================
def main():
    load_dotenv(override=True)
    device = pick_device()
    print("[INFO] Device:", device)

    os.makedirs(CLIP_DIR, exist_ok=True)
    print("[INFO] Loading YOLO...")
    yolo = YOLO(MODEL_YOLO)
    print("[INFO] Loading XGB...")
    xgb_model = joblib.load(MODEL_XGB)

    cap_thread = CaptureThread().start()

    feature_buffer = deque(maxlen=SEQ_LEN)
    rule_buffer = deque(maxlen=SEQ_LEN)
    motion_buffer = deque(maxlen=15)
    fall_history = deque(maxlen=TEMPORAL_WINDOW)
    
    lying_frames = 0
    prev_kpts = None
    last_incident_ts = 0
    fall_cooldown_until = 0
    fall_display_until = 0

    lying_start_time = None
    impact_detected_time = 0  

    recording_post = False
    post_frames = []
    pre_frames = None

    current_incident_id = [None] 
    clip_stamp = None
    fall_type = "UNKNOWN"

    prev_time = time.time()

    while True:
        frame = cap_thread.latest()
        if frame is None:
            continue

        now = time.time()
        current_state = "NORMAL"
        state_color = (0, 255, 0)
        proba = 0.0

        results = yolo(frame, conf=CONF_YOLO, verbose=False, device=device)

        if results[0].keypoints is not None and len(results[0].keypoints.xy) > 0:
            kpts = results[0].keypoints.xy[0].cpu().numpy()
            draw_skeleton(frame, kpts)

            features = calculate_features(kpts, prev_kpts=prev_kpts)
            angle_abs = features[0]
            height_norm = features[3]
            feature_buffer.append(features)

            rule = rule_fall_filter(kpts)
            rule_buffer.append(rule)

            motion = hip_drop_speed(prev_kpts, kpts)
            motion_buffer.append(motion)
            prev_kpts = kpts

            if rule:
                X = np.array(features).reshape(1, -1)
                if X.shape[1] < EXPECTED_FEATURES:
                    pad = EXPECTED_FEATURES - X.shape[1]
                    X = np.pad(X, ((0, 0), (0, pad)), mode="constant")
                elif X.shape[1] > EXPECTED_FEATURES:
                    X = X[:, :EXPECTED_FEATURES]

                try:
                    proba = float(xgb_model.predict_proba(X)[0][1])
                except Exception as e:
                    proba = 0.0

            rule_votes = sum(rule_buffer)
            rule_fall = rule_votes >= RULE_VOTE_THRESHOLD
            
            motion_spike = motion > MOTION_SPIKE_THRESHOLD
            
            # ✅ 3. ปรับเงื่อนไขการนอนให้หลังขนานพื้นจริงๆ
            posture_fall = angle_abs > 70 and height_norm < 1.0
            is_ai_fall = proba >= XGB_THRESHOLD

           
            # Step 1: ตรวจจับจังหวะร่วงแนวดิ่ง 
            if motion_spike:
                if impact_detected_time == 0:
                    impact_detected_time = now

            # Step 2: ถ้าร่วงมาแล้ว (ไม่เกิน 5 วินาที) ให้เช็กว่านอนแหม็บอยู่ไหม
            if impact_detected_time > 0 and (now - impact_detected_time) < 5.0:
                
                # ถ้า AI ฟันธงว่าล้ม หรือท่าทางเหมือนนอนอยู่
                if is_ai_fall or posture_fall:
                    lying_frames += 1
                else:
                    lying_frames = max(0, lying_frames - 1) 

                if lying_start_time is None:
                    lying_start_time = now

                # ถ้านอนกองบนพื้นครบ 3 วินาทีตามกรอบเวลา
                if lying_frames >= LYING_CONFIRM_FRAMES:
                    
                    # เช็กว่านอนแน่นิ่ง ไม่ขยับตัว
                    if is_still(motion_buffer):
                        
                        if now > fall_cooldown_until and now - last_incident_ts > MIN_INCIDENT_GAP:
                            print("[ALERT] 🚨 FALL DETECTED! 🚨")
                            fall_display_until = now + DISPLAY_FALL_SECONDS
                            fall_cooldown_until = now + COOLDOWN_SECONDS
                            last_incident_ts = now
                            fall_type = "AI XGBoost" if is_ai_fall else "RULE/POSTURE"

                            clip_stamp = int(time.time())
                            pre_frames = cap_thread.last_n(PRE_SEC * FPS)
                            recording_post = True
                            post_frames = []
                            current_incident_id[0] = None 

                            def alert_backend(prob_val, id_container):
                                try:
                                    inc_id = send_fall_incident({"confidence": prob_val})
                                    if inc_id:
                                        id_container[0] = inc_id
                                        print(f"[INFO] API Success! Incident ID: {inc_id}")
                                except Exception as e:
                                    print("[ERROR] Failed to send incident API:", e)

                            threading.Thread(target=alert_backend, args=(float(proba), current_incident_id), daemon=True).start()

                            impact_detected_time = 0
                            lying_frames = 0
                            lying_start_time = None

            else:
                lying_start_time = None
                lying_frames = 0
                if (now - impact_detected_time) >= 5.0:
                    impact_detected_time = 0

        # ---------- RECORD POST & UPLOAD ----------
        if recording_post:
            post_frames.append(frame.copy())

            if len(post_frames) >= POST_SEC * FPS:
                recording_post = False
                clip_frames = pre_frames + post_frames # type: ignore
                clip_path = os.path.join(CLIP_DIR, f"fall_{clip_stamp}.mp4")

                def save_and_upload(frames, path, id_container):
                    print("[INFO] Saving Video Clip...")
                    write_clip_mp4(path, frames, FPS, FRAME_W, FRAME_H)
                    fixed_path = fix_mp4_for_web(path)
                    print(f"[INFO] Clip saved locally: {fixed_path}")
                    
                    wait_time = 0
                    while id_container[0] is None and wait_time < 15:
                        time.sleep(1)
                        wait_time += 1

                    inc_id = id_container[0]
                    if inc_id:
                        upload_async(inc_id, fixed_path)
                    else:
                        print("[WARN] API Timeout (15s). No incident ID. Clip NOT uploaded.")

                threading.Thread(target=save_and_upload, args=(clip_frames, clip_path, current_incident_id), daemon=True).start()

        # ---------- UI ----------
        if now < fall_display_until:
            current_state = "FALL DETECTED"
            state_color = (0, 0, 255)

        fps = 1.0 / (time.time() - prev_time)
        prev_time = time.time()

        display = frame.copy()
        cv2.putText(display, f"STATE: {current_state}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, state_color, 2)
        cv2.putText(display, f"CONF: {proba:.2f}", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if current_state == "FALL DETECTED":
            cv2.putText(display, f"TYPE: {fall_type}", (20, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        cv2.putText(display, f"FPS: {fps:.1f}", (20, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
        cv2.imshow("Fall Detection", display)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap_thread.stop()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()