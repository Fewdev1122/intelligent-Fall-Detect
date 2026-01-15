import cv2,os
import numpy as np
from ultralytics import YOLO
from cal_features import calculate_features

seq_len = 30
step = 5
X = []
Y = []
model = YOLO("models/yolo11n-pose.pt")

def person_detection(video_path, label):
  cap = cv2.VideoCapture(video_path)
  if not cap.isOpened():
    exit()
  feature_buffer = []
  frame_count = 0

  while True:
    ret,frame = cap.read()
    if not ret:
      break

    frame_count += 1
    
    results = model(frame,conf=0.4,verbose=False, device='mps')
    if results[0].keypoints is None or len(results[0].keypoints.xy) == 0:
      continue
   
    kpts = results[0].keypoints.xy[0].cpu().numpy()
    curr_feature = calculate_features(kpts)
    feature_buffer.append(curr_feature)
    if len(feature_buffer) > seq_len:
        feature_buffer.pop(0)
    if len(feature_buffer) == seq_len and (frame_count % step == 0):
      window_data = np.array(feature_buffer[-seq_len:])

      feature_mean = np.mean(window_data,axis=0)
      feature_std = np.std(window_data,axis=0)
      feature_max = np.max(window_data,axis=0)
      feature_viclocity = np.mean(np.diff(window_data,axis=0),axis=0)
      final_vector = np.concatenate([feature_mean, feature_std, feature_max, feature_viclocity])

      X.append(final_vector)
      Y.append(label)
    

  cap.release()
  
VIDEO_EXT = ('.mp4', '.avi', '.mov', '.mkv')
print("Fall...")
for file in os.listdir('./dataset/fall'):
    if not file.lower().endswith(VIDEO_EXT):
        continue
    person_detection(f"./dataset/fall/{file}", 1)   

print("non_fall")
for file in os.listdir('./dataset/non_fall'):
    if not file.lower().endswith(VIDEO_EXT):
        continue
    person_detection(f"./dataset/non_fall/{file}", 0)

x = np.array(X)
y = np.array(Y)  
np.save("X_data.npy", x)
np.save("Y_data.npy", y)


print("X shape:", x.shape)
print("y shape:", y.shape)
print("fall:", np.sum(y == 1))
print("non-fall:", np.sum(y == 0))


