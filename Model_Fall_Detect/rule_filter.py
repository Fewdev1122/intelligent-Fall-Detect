import numpy as np

def rule_fall_filter(kpts):
    nose_y = kpts[0][1]
    shoulder_y = (kpts[5][1] + kpts[6][1]) / 2
    hip_y = (kpts[11][1] + kpts[12][1]) / 2

    condition_inverted = nose_y > shoulder_y + 0.05 * abs(hip_y - shoulder_y)

    min_x, min_y = np.min(kpts, axis=0)
    max_x, max_y = np.max(kpts, axis=0)
    w = max_x - min_x
    h = max_y - min_y
    
    condition_lying = (w > h * 0.8) 
    return condition_inverted or condition_lying
