import numpy as np
from typing import Optional, List


def calculate_features(
    kpts: np.ndarray,
    prev_kpts: Optional[np.ndarray] = None,
    older_kpts: Optional[np.ndarray] = None,
    fps: float = 15.0
) -> List[float]:

    def clamp(x: float, lo: float, hi: float) -> float:
        return float(max(lo, min(hi, x)))

    # ถ้า keypoints ไม่ครบ
    if kpts is None or len(kpts) < 17:
        return [0.0] * 14

    kpts = np.asarray(kpts, dtype=np.float32)

    # -------- KEY JOINTS --------
    l_sh, r_sh = kpts[5], kpts[6]
    l_hip, r_hip = kpts[11], kpts[12]
    l_knee, r_knee = kpts[13], kpts[14]
    l_ank, r_ank = kpts[15], kpts[16]
    nose = kpts[0]

    shoulder_mid = (l_sh + r_sh) / 2.0
    hip_mid = (l_hip + r_hip) / 2.0
    knee_mid = (l_knee + r_knee) / 2.0
    ankle_mid = (l_ank + r_ank) / 2.0

    # -------- NORMALIZATION BASE --------
    torso_len = float(np.linalg.norm(shoulder_mid - hip_mid))
    if torso_len < 1e-6:
        torso_len = 1.0

    # -------- ORIENTATION --------
    dy = float(shoulder_mid[1] - hip_mid[1])
    dx = float(shoulder_mid[0] - hip_mid[0])

    angle_signed = float(np.degrees(np.arctan2(dx, dy + 1e-6)))
    angle_abs = abs(angle_signed)

    # -------- BBOX --------
    min_x, min_y = np.min(kpts, axis=0)
    max_x, max_y = np.max(kpts, axis=0)

    w = float(max_x - min_x)
    h = float(max_y - min_y)

    if h < 1e-3:
        h = 1.0
    if w < 1e-3:
        w = 1.0

    aspect_ratio = w / h
    height_norm = h / torso_len

    # -------- NORMALIZED DISTANCES --------
    hip_ankle_dist = np.linalg.norm(hip_mid - ankle_mid) / torso_len
    shoulder_ankle_dist = np.linalg.norm(shoulder_mid - ankle_mid) / torso_len
    hip_knee_dist = np.linalg.norm(hip_mid - knee_mid) / torso_len
    knee_ankle_dist = np.linalg.norm(knee_mid - ankle_mid) / torso_len

    nose_to_ankle_y = (nose[1] - ankle_mid[1]) / torso_len
    hip_y_norm = (hip_mid[1] - min_y) / h

    # -------- DYNAMICS (ใช้แค่ velocity 1 ตัว) --------
    hip_vy = 0.0
    angle_d = 0.0

    if prev_kpts is not None and len(prev_kpts) >= 17:
        prev_kpts = np.asarray(prev_kpts, dtype=np.float32)

        pl_sh, pr_sh = prev_kpts[5], prev_kpts[6]
        pl_hip, pr_hip = prev_kpts[11], prev_kpts[12]

        p_sh_mid = (pl_sh + pr_sh) / 2.0
        p_hip_mid = (pl_hip + pr_hip) / 2.0

        # velocity
        hip_vy = ((hip_mid[1] - p_hip_mid[1]) / torso_len) * fps

        # angle derivative
        p_dy = float(p_sh_mid[1] - p_hip_mid[1])
        p_dx = float(p_sh_mid[0] - p_hip_mid[0])
        p_angle = float(np.degrees(np.arctan2(p_dx, p_dy + 1e-6)))

        angle_d = (angle_signed - p_angle) * fps

    # -------- CLAMP --------
    hip_vy = clamp(hip_vy, -50, 50)
    angle_d = clamp(angle_d, -200, 200)
    hip_y_norm = clamp(hip_y_norm, -0.5, 1.5)

    # ===== EXACTLY 14 FEATURES =====
    return [
        angle_abs,            # 1
        angle_signed,         # 2
        aspect_ratio,         # 3
        height_norm,          # 4
        hip_ankle_dist,       # 5
        shoulder_ankle_dist,  # 6
        hip_knee_dist,        # 7
        knee_ankle_dist,      # 8
        nose_to_ankle_y,      # 9
        hip_y_norm,           # 10
        hip_vy,               # 11
        angle_d,              # 12
        torso_len,            # 13
        dy / torso_len        # 14
    ] # type: ignore