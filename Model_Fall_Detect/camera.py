import cv2
import numpy as np
from ultralytics import YOLO
from rule_filter import rule_fall_filter
from cal_features import calculate_features
import joblib
from collections import deque
SEQ_LEN = 30
MODEL_YOLO = "models/yolo11n-pose.pt"
MODEL_RF = "fall_model_rf.joblib"
model = YOLO(MODEL_YOLO)

try:
   rf_model = joblib.load(MODEL_RF)
except:
   exit()

cap = cv2.VideoCapture(0)


if not cap.isOpened():
  print("เปืิดกล้องไม่ได้่")
  exit()

feature_buffer = deque(maxlen=SEQ_LEN)
while True:
  ret,frame = cap.read()
  
  if not ret:
    break
  frame = cv2.resize(frame, (640, 360))
  results = model(frame,conf=0.4,verbose=False, device='mps')

  if results[0].keypoints is None or len(results[0].keypoints.xy) == 0:
    cv2.imshow("Fall Detect",frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break
    continue
  
  kpts = results[0].keypoints.xy[0].cpu().numpy()
  annotated_frame = results[0].plot()

  curr_feature = calculate_features(kpts)
  feature_buffer.append(curr_feature)

    
  annotated_frame = results[0].plot()
  if len(feature_buffer) < SEQ_LEN:
    cv2.putText(frame, f"Gathering Data: {len(feature_buffer)}/{SEQ_LEN}", (100,100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0,255,255), 2)
  
  else:
    window_data = np.array(feature_buffer)
    if not rule_fall_filter(kpts):
      cv2.putText(frame, "Normal", (50,50),cv2.FONT_HERSHEY_SIMPLEX,1,(0,255,0),2)

    else:

      f_mean = np.mean(window_data, axis=0)   
      f_std = np.std(window_data, axis=0)
      f_max = np.max(window_data, axis=0)
      f_vel = np.mean(np.diff(window_data, axis=0), axis=0)

      final_vector = np.concatenate([f_mean, f_std, f_max, f_vel])

      prediction = rf_model.predict([final_vector])[0]
      if prediction == 1:
        cv2.putText(annotated_frame, "!!! FALL DETECTED !!!", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 255), 4)

      else:
        cv2.putText(annotated_frame, "Safe", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2)

  cv2.imshow("Fall Detect", annotated_frame)
  if cv2.waitKey(25) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()


     

