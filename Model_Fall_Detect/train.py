import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, accuracy_score
from imblearn.over_sampling import SMOTE
import m2cgen as m2c
import joblib

print("Loading Data")
try:
  X = np.load("X_data.npy")
  y = np.load("Y_data.npy")
except:
  print("ไม่เจอไฟล์")
  exit()

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y) 

print(f"Original Train counts: {np.bincount(y_train)}") 
smote = SMOTE(random_state=42)
X_train_resampled, y_train_resampled = smote.fit_resample(X_train, y_train)

print(f"Resampled Train counts: {np.bincount(y_train_resampled)}") 
rf_model = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42)
rf_model.fit(X_train_resampled, y_train_resampled)

joblib.dump(rf_model, "fall_model_rf.joblib") 
print("บันทึกโมเดลสำเร็จ: fall_model_rf.joblib")

y_pred = rf_model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
print(classification_report(y_test, y_pred, target_names=['Non-Fall', 'Fall']))

print("Exporting to Dart...")
dart_code = m2c.export_to_dart(rf_model)

with open("fall_classifier.dart", "w") as f:
    f.write(dart_code)
print("ได้ไฟล์ fall_classifier.dart สำหรับ Flutter แล้ว")
