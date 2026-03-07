import numpy as np

def rule_fall_filter(kpts: np.ndarray) -> bool:
    if kpts is None or len(kpts) < 17:
        return False

    kpts = np.asarray(kpts, dtype=np.float32)

    missing = np.sum((kpts[:, 0] <= 1) & (kpts[:, 1] <= 1))
    if missing >= 6:
        return False

    l_sh, r_sh = kpts[5], kpts[6]
    l_hip, r_hip = kpts[11], kpts[12]

    shoulder_mid = (l_sh + r_sh) / 2.0
    hip_mid = (l_hip + r_hip) / 2.0

    dy = float(shoulder_mid[1] - hip_mid[1])
    dx = float(shoulder_mid[0] - hip_mid[0])

    angle = float(np.degrees(np.arctan2(abs(dx), abs(dy) + 1e-6)))

    min_xy = np.min(kpts, axis=0)
    max_xy = np.max(kpts, axis=0)

    w = float(max_xy[0] - min_xy[0])
    h = float(max_xy[1] - min_xy[1])

    if h < 20 or w < 20:
        return False

    aspect = w / (h + 1e-6)

    # 🔥 เข้มขึ้น
    torso_horizontal = angle >= 50
    bbox_horizontal = aspect >= 1.1

    return torso_horizontal or bbox_horizontal