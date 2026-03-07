# ai/pose.py
import os
import cv2
import random
import numpy as np
from collections import deque
from ultralytics import YOLO

from ai.cal_features import calculate_features  # ต้องเป็น 14-features version

# ---------- CONFIG ----------
SEQ_LEN = 30
STEP = 5  # เก็บ sample ทุกๆ STEP เฟรม (ลดจำนวน window / เร็วขึ้น)

CONF = 0.55
IOU = 0.5
MAX_DET = 5  # ให้มากกว่า 1 แล้วเลือกคนใหญ่สุดเอง

FRAME_SIZE = (480, 270)  # (w, h)
VIDEO_EXT = (".mp4", ".avi", ".mov", ".mkv")

# จำกัดจำนวนคลิปต่อคลาส
MAX_FALL_CLIPS = 2000
MAX_NONFALL_CLIPS = 2000

# seed เพื่อสุ่มแบบซ้ำได้
SEED = 42

# บาลานซ์จำนวน sample windows หลังสร้าง dataset
BALANCE_SAMPLES = True

# อุปกรณ์รัน YOLO
DEVICE = "mps"  # mac
# DEVICE = "cpu"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, ".."))

MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "yolo11n-pose.pt")

# dataset folders
FALL_DIR = os.path.join(PROJECT_ROOT, "dataset", "fall")
NONFALL_DIR = os.path.join(PROJECT_ROOT, "dataset", "non_fall")

# output npy (เก็บในโฟลเดอร์ ai)
OUT_X = os.path.join(BASE_DIR, "X_data.npy")
OUT_Y = os.path.join(BASE_DIR, "Y_data.npy")
OUT_G = os.path.join(BASE_DIR, "clip_id.npy")

# optional fall-only outputs (เหมือนของเดิม)
OUT_X_FALL = os.path.join(BASE_DIR, "X_data_fall.npy")
OUT_Y_FALL = os.path.join(BASE_DIR, "Y_data_fall.npy")
OUT_G_FALL = os.path.join(BASE_DIR, "clip_id_fall.npy")
# --------------------------------


def pick_largest_person(results0) -> int:
    """Pick index of the largest bbox (area) among detections."""
    if results0.boxes is None:
        return 0
    xyxy = results0.boxes.xyxy
    if xyxy is None or len(xyxy) == 0:
        return 0
    xyxy = xyxy.cpu().numpy()
    areas = (xyxy[:, 2] - xyxy[:, 0]) * (xyxy[:, 3] - xyxy[:, 1])
    return int(np.argmax(areas))


def build_rf_vector(window_data: np.ndarray) -> np.ndarray:
    """
    window_data: (SEQ_LEN, D)
    return: (D*4,)  concat [mean, std, max, vel]
    """
    f_mean = np.mean(window_data, axis=0)
    f_std = np.std(window_data, axis=0)
    f_max = np.max(window_data, axis=0)
    f_vel = np.mean(np.diff(window_data, axis=0), axis=0)
    return np.concatenate([f_mean, f_std, f_max, f_vel], axis=0)


def list_videos(folder: str, label: int, max_clips: int | None):
    files = [f for f in os.listdir(folder) if f.lower().endswith(VIDEO_EXT)]
    files = sorted(files)

    rng = random.Random(SEED + (100 if label == 1 else 200))
    rng.shuffle(files)

    if max_clips is not None:
        files = files[:max_clips]

    return [os.path.join(folder, f) for f in files]


def process_video(video_path: str, label: int, clip_id: int, model: YOLO, X, Y, G) -> int:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("❌ เปิดไม่ได้:", video_path)
        return 0

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 1e-3:
        fps = 15.0

    feature_buffer = deque(maxlen=SEQ_LEN)
    frame_count = 0
    sample_count = 0
    prev_kpts = None

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_count += 1
        frame = cv2.resize(frame, FRAME_SIZE)

        results = model(
            frame,
            conf=CONF,
            iou=IOU,
            max_det=MAX_DET,
            verbose=False,
            device=DEVICE
        )

        kps = results[0].keypoints
        if kps is None or len(kps.xy) == 0:
            prev_kpts = None
            feature_buffer.clear()
            continue

        idx = pick_largest_person(results[0])
        kpts = kps.xy[idx].cpu().numpy()

        feat = calculate_features(kpts, prev_kpts=prev_kpts, fps=float(fps))
        prev_kpts = kpts

        if len(feat) != 14:
            cap.release()
            raise ValueError(f"Expected 14 features, got {len(feat)} in {video_path}")

        feature_buffer.append(feat)

        if len(feature_buffer) == SEQ_LEN and (frame_count % STEP == 0):
            window = np.array(feature_buffer, dtype=np.float32)  # (30,14)
            final_vector = build_rf_vector(window)               # (56,)
            X.append(final_vector)
            Y.append(label)
            G.append(clip_id)
            sample_count += 1

    cap.release()
    return sample_count


def build_dataset(folder: str, label: int, start_clip_id: int, model: YOLO, X, Y, G, max_clips: int | None):
    videos = list_videos(folder, label=label, max_clips=max_clips)

    total = len(videos)
    clip_id = start_clip_id
    success_videos = 0

    for i, path in enumerate(videos):
        file = os.path.basename(path)
        print(f"\n🎬 [{i+1}/{total}] {file}")

        samples = process_video(path, label, clip_id, model, X, Y, G)

        if samples > 0:
            success_videos += 1

        print(f"   ➜ samples from clip: {samples}")
        print(f"   ➜ total samples so far: {len(X)}")

        clip_id += 1

    print(f"\n✅ finished folder: {folder}")
    print(f"   processed clips: {success_videos}/{total}")
    print(f"   total samples: {len(X)}\n")

    return clip_id


def balance_by_samples(X: np.ndarray, Y: np.ndarray, G: np.ndarray):
    idx_fall = np.where(Y == 1)[0]
    idx_non = np.where(Y == 0)[0]
    m = min(len(idx_fall), len(idx_non))
    rng = np.random.default_rng(SEED)

    idx_fall = rng.choice(idx_fall, size=m, replace=False)
    idx_non = rng.choice(idx_non, size=m, replace=False)

    idx = np.concatenate([idx_fall, idx_non])
    rng.shuffle(idx)

    return X[idx], Y[idx], G[idx]


def main():
    print("[INFO] MODEL_PATH =", MODEL_PATH)
    print("[INFO] FALL_DIR   =", FALL_DIR)
    print("[INFO] NONFALL_DIR=", NONFALL_DIR)

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"YOLO model not found: {MODEL_PATH}")

    model = YOLO(MODEL_PATH)

    X, Y, G = [], [], []

    print("\n================ FALL =================")
    next_id = build_dataset(
        FALL_DIR, label=1, start_clip_id=0,
        model=model, X=X, Y=Y, G=G,
        max_clips=MAX_FALL_CLIPS
    )

    # save fall-only snapshots (optional)
    np.save(OUT_X_FALL, np.array(X, dtype=np.float32))
    np.save(OUT_Y_FALL, np.array(Y, dtype=np.int64))
    np.save(OUT_G_FALL, np.array(G, dtype=np.int64))
    print("[SAVED] fall-only npy written:", OUT_X_FALL, OUT_Y_FALL, OUT_G_FALL)

    print("\n============== NON-FALL ===============")
    build_dataset(
        NONFALL_DIR, label=0, start_clip_id=next_id,
        model=model, X=X, Y=Y, G=G,
        max_clips=MAX_NONFALL_CLIPS
    )

    X = np.array(X, dtype=np.float32)
    Y = np.array(Y, dtype=np.int64)
    G = np.array(G, dtype=np.int64)

    print("\n=========== BEFORE BALANCE ===========")
    print("X shape:", X.shape)
    print("fall samples:", int(np.sum(Y == 1)))
    print("non-fall samples:", int(np.sum(Y == 0)))
    print("unique clips:", len(np.unique(G)))
    print("feature dim:", X.shape[1], "(expect 56)")

    if X.shape[1] != 56:
        raise ValueError(f"X dim mismatch: got {X.shape[1]}, expected 56. Check calculate_features=14 & build_rf_vector.")

    if BALANCE_SAMPLES:
        X, Y, G = balance_by_samples(X, Y, G)

        print("\n=========== AFTER BALANCE ===========")
        print("X shape:", X.shape)
        print("fall samples:", int(np.sum(Y == 1)))
        print("non-fall samples:", int(np.sum(Y == 0)))
        print("unique clips:", len(np.unique(G)))

    np.save(OUT_X, X)
    np.save(OUT_Y, Y)
    np.save(OUT_G, G)

    print("\n[SAVED] dataset:")
    print(" -", OUT_X)
    print(" -", OUT_Y)
    print(" -", OUT_G)
    print("=====================================")


if __name__ == "__main__":
    main()