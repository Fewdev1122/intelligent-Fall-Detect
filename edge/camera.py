import os
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "/Volumes/WD_SSD/Dev/Project_II/Fall_Detect/keys/serviceAccountKey.json"

import time
import threading
from collections import deque
from datetime import datetime
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
from edge.mobility_store import save_mobility_metric, save_mobility_daily_summary

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

MOTION_SPIKE_THRESHOLD = 15
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

# ---------------- MOBILITY TREND CONFIG ----------------
PATIENT_ID = "PATIENT_DEMO_01"

MOBILITY_WINDOW_SEC = 10
MOBILITY_MIN_SAMPLES = FPS * 5
MOBILITY_SAVE_INTERVAL_SEC = 10

# ค่า baseline แบบเริ่มต้นสำหรับ prototype
BASELINE_SPEED = 22.0
BASELINE_SWAY = 18.0
BASELINE_HEIGHT = 110.0

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
        if torch.backends.mps.is_available():
            return "mps"
        if torch.cuda.is_available():
            return "cuda"
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

# ================= MOBILITY TREND UTILS =================
def body_center(kpts):
    arr = np.asarray(kpts)
    xs = arr[:, 0]
    ys = arr[:, 1]
    return float(np.mean(xs)), float(np.mean(ys))

def body_height_px(kpts):
    arr = np.asarray(kpts)
    ys = arr[:, 1]
    return float(np.max(ys) - np.min(ys))

def shoulder_width_px(kpts):
    arr = np.asarray(kpts)
    return float(abs(arr[6][0] - arr[5][0]))

def hip_center(kpts):
    arr = np.asarray(kpts)
    x = (arr[11][0] + arr[12][0]) / 2.0
    y = (arr[11][1] + arr[12][1]) / 2.0
    return float(x), float(y)

def shoulder_center(kpts):
    arr = np.asarray(kpts)
    x = (arr[5][0] + arr[6][0]) / 2.0
    y = (arr[5][1] + arr[6][1]) / 2.0
    return float(x), float(y)

def body_tilt_deg(kpts):
    sx, sy = shoulder_center(kpts)
    hx, hy = hip_center(kpts)
    dx = sx - hx
    dy = hy - sy
    if dy == 0:
        return 90.0
    angle = np.degrees(np.arctan2(abs(dx), abs(dy)))
    return float(angle)

def center_speed_px_per_sec(prev_kpts, curr_kpts, fps):
    if prev_kpts is None or curr_kpts is None:
        return 0.0
    px1, py1 = body_center(prev_kpts)
    px2, py2 = body_center(curr_kpts)
    dist = np.sqrt((px2 - px1) ** 2 + (py2 - py1) ** 2)
    return float(dist * fps)

def sway_score(window_centers_x):
    if len(window_centers_x) < 2:
        return 0.0
    return float(np.std(window_centers_x))

def estimate_risk_score(avg_speed, avg_sway, avg_tilt, avg_height):
    speed_drop_ratio = max(0.0, (BASELINE_SPEED - avg_speed) / max(BASELINE_SPEED, 1e-6))
    sway_rise_ratio = max(0.0, (avg_sway - BASELINE_SWAY) / max(BASELINE_SWAY, 1e-6))
    height_drop_ratio = max(0.0, (BASELINE_HEIGHT - avg_height) / max(BASELINE_HEIGHT, 1e-6))
    tilt_ratio = min(avg_tilt / 45.0, 1.0)

    score = (
        speed_drop_ratio * 35.0 +
        sway_rise_ratio * 30.0 +
        height_drop_ratio * 20.0 +
        tilt_ratio * 15.0
    )

    return float(max(0.0, min(100.0, score)))

def risk_level(score):
    if score >= 60:
        return "high"
    if score >= 30:
        return "medium"
    return "low"

def date_key_local():
    return datetime.now().strftime("%Y-%m-%d")

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

    mobility_speed_buffer = deque(maxlen=FPS * MOBILITY_WINDOW_SEC)
    mobility_center_x_buffer = deque(maxlen=FPS * MOBILITY_WINDOW_SEC)
    mobility_tilt_buffer = deque(maxlen=FPS * MOBILITY_WINDOW_SEC)
    mobility_height_buffer = deque(maxlen=FPS * MOBILITY_WINDOW_SEC)

    last_mobility_save_ts = 0

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

            speed_now = center_speed_px_per_sec(prev_kpts, kpts, FPS)
            center_x_now, _ = body_center(kpts)
            tilt_now = body_tilt_deg(kpts)
            height_now = body_height_px(kpts)

            mobility_speed_buffer.append(speed_now)
            mobility_center_x_buffer.append(center_x_now)
            mobility_tilt_buffer.append(tilt_now)
            mobility_height_buffer.append(height_now)

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
                except Exception:
                    proba = 0.0

            rule_votes = sum(rule_buffer)
            rule_fall = rule_votes >= RULE_VOTE_THRESHOLD
            motion_spike = motion > MOTION_SPIKE_THRESHOLD
            posture_fall = angle_abs > 70 and height_norm < 1.0
            is_ai_fall = proba >= XGB_THRESHOLD

            fall_history.append(
                {
                    "ts": now,
                    "rule_fall": rule_fall,
                    "motion_spike": motion_spike,
                    "posture_fall": posture_fall,
                    "is_ai_fall": is_ai_fall,
                    "proba": proba,
                }
            )

            # Step 1: ตรวจจับจังหวะร่วงแนวดิ่ง
            if motion_spike:
                if impact_detected_time == 0:
                    impact_detected_time = now

            # Step 2: ถ้าร่วงมาแล้ว ให้เช็กว่านอนอยู่ไหม
            if impact_detected_time > 0 and (now - impact_detected_time) < 5.0:
                if is_ai_fall or posture_fall:
                    lying_frames += 1
                else:
                    lying_frames = max(0, lying_frames - 1)

                if lying_start_time is None:
                    lying_start_time = now

                if lying_frames >= LYING_CONFIRM_FRAMES:
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

                            threading.Thread(
                                target=alert_backend,
                                args=(float(proba), current_incident_id),
                                daemon=True
                            ).start()

                            impact_detected_time = 0
                            lying_frames = 0
                            lying_start_time = None

            else:
                lying_start_time = None
                lying_frames = 0
                if (now - impact_detected_time) >= 5.0:
                    impact_detected_time = 0

            # ---------- SAVE MOBILITY TREND ----------
            if (
                len(mobility_speed_buffer) >= MOBILITY_MIN_SAMPLES
                and (now - last_mobility_save_ts) >= MOBILITY_SAVE_INTERVAL_SEC
            ):
                avg_speed = float(np.mean(mobility_speed_buffer))
                avg_sway = sway_score(mobility_center_x_buffer)
                avg_tilt = float(np.mean(mobility_tilt_buffer))
                avg_height = float(np.mean(mobility_height_buffer))

                score = estimate_risk_score(
                    avg_speed=avg_speed,
                    avg_sway=avg_sway,
                    avg_tilt=avg_tilt,
                    avg_height=avg_height,
                )

                level = risk_level(score)

                metric_payload = {
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                    "avgSpeedPxPerSec": avg_speed,
                    "avgSwayPx": avg_sway,
                    "avgTiltDeg": avg_tilt,
                    "avgHeightPx": avg_height,
                    "riskScore": score,
                    "riskLevel": level,
                    "windowSec": MOBILITY_WINDOW_SEC,
                    "source": "edge_camera",
                }

                try:
                    save_mobility_metric(PATIENT_ID, metric_payload)

                    save_mobility_daily_summary(
                        PATIENT_ID,
                        date_key_local(),
                        {
                            "latestAvgSpeedPxPerSec": avg_speed,
                            "latestAvgSwayPx": avg_sway,
                            "latestAvgTiltDeg": avg_tilt,
                            "latestAvgHeightPx": avg_height,
                            "latestRiskScore": score,
                            "latestRiskLevel": level,
                        },
                    )

                    print(
                        f"[MOBILITY] saved | speed={avg_speed:.2f} "
                        f"sway={avg_sway:.2f} tilt={avg_tilt:.2f} "
                        f"height={avg_height:.2f} risk={score:.1f} ({level})"
                    )
                except Exception as e:
                    print("[ERROR] save_mobility_metric failed:", e)

                last_mobility_save_ts = now

        # ---------- RECORD POST & UPLOAD ----------
        if recording_post:
            post_frames.append(frame.copy())

            if len(post_frames) >= POST_SEC * FPS:
                recording_post = False
                clip_frames = (pre_frames or []) + post_frames
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

                threading.Thread(
                    target=save_and_upload,
                    args=(clip_frames, clip_path, current_incident_id),
                    daemon=True
                ).start()

        # ---------- UI ----------
        if now < fall_display_until:
            current_state = "FALL DETECTED"
            state_color = (0, 0, 255)

        fps = 1.0 / max((time.time() - prev_time), 1e-6)
        prev_time = time.time()

        display = frame.copy()
        cv2.putText(display, f"STATE: {current_state}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, state_color, 2)
        cv2.putText(display, f"CONF: {proba:.2f}", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if current_state == "FALL DETECTED":
            cv2.putText(display, f"TYPE: {fall_type}", (20, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        if len(mobility_speed_buffer) > 0:
            live_speed = float(np.mean(mobility_speed_buffer))
            live_sway = sway_score(mobility_center_x_buffer)
            live_tilt = float(np.mean(mobility_tilt_buffer)) if len(mobility_tilt_buffer) > 0 else 0.0
            live_height = float(np.mean(mobility_height_buffer)) if len(mobility_height_buffer) > 0 else 0.0
            live_risk = estimate_risk_score(live_speed, live_sway, live_tilt, live_height)

            cv2.putText(display, f"MOBILITY SPEED: {live_speed:.1f}", (20, 125), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2)
            cv2.putText(display, f"SWAY: {live_sway:.1f}", (20, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 0), 2)
            cv2.putText(display, f"RISK: {live_risk:.1f}", (20, 175), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 2)
            cv2.putText(display, f"LEVEL: {risk_level(live_risk).upper()}", (20, 200), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 2)

        cv2.putText(display, f"FPS: {fps:.1f}", (20, 230), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
        cv2.imshow("Fall Detection", display)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap_thread.stop()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()