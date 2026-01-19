import numpy as np

def rule_fall_filter(kpts):
    nose_y = kpts[0][1]
    shoulder_y = (kpts[5][1] + kpts[6][1]) / 2
    hip_y = (kpts[11][1] + kpts[12][1]) / 2

    min_x, min_y = np.min(kpts, axis=0)
    max_x, max_y = np.max(kpts, axis=0)
    w = max_x - min_x
    h = max_y - min_y
    
    horizontal = w > h * 0.9

    head_low = nose_y > shoulder_y

    body_collapsed = abs(hip_y - shoulder_y) < h * 0.25

    score = sum([horizontal, head_low, body_collapsed])

    return score >= 2
