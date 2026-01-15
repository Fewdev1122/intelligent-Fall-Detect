import numpy as np

def calculate_features(kpts):
  shoulder_mid = (kpts[5] + kpts[6])/2
  hip_mid = (kpts[11] + kpts[12])/2
  ankle_mid = (kpts[15] + kpts[16])/2
  torso_len = np.linalg.norm(shoulder_mid - hip_mid)

  if torso_len == 0:
    torso_len = 1.0
  dy = shoulder_mid[1] - hip_mid[1]
  dx = shoulder_mid[0] - hip_mid[0]
  angle = np.degrees(np.arctan2(abs(dx), abs(dy)))

  min_x, min_y = np.min(kpts, axis=0)
  max_x, max_y = np.max(kpts, axis=0)
  w = max_x - min_x
  h = max_y - min_y

  if h != 0:
    aspect_ratio = w/h
  else:
    aspect_ratio = 0

  hip_ankle_dist = np.linalg.norm(hip_mid - ankle_mid)/torso_len
  return [angle, aspect_ratio, hip_ankle_dist]