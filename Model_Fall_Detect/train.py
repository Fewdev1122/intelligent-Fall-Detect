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
X_train, X_temp, y_train, y_temp = train_test_split( X, y, test_size=0.2, stratify=y, random_state=42)

X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, stratify=y_temp, random_state=42)

print("Train:", len(X_train))
print("Val  :", len(X_val))
print("Test :", len(X_test))

print(f"Original Train counts: {np.bincount(y_train)}") 

smote = SMOTE(random_state=42)
X_train_resampled, y_train_resampled = smote.fit_resample( X_train, y_train)
print(f"Resampled Train counts: {np.bincount(y_train_resampled)}") 
rf_model = RandomForestClassifier(n_estimators=100, max_depth=15, random_state=42)
rf_model.fit(X_train_resampled, y_train_resampled)

joblib.dump(rf_model, "fall_model_rf.joblib") 

y_val_pred = rf_model.predict(X_val)
print(classification_report(
    y_val, y_val_pred,
    target_names=['Non-Fall', 'Fall']
))

y_pred = rf_model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred)*100:.2f}%")
print(classification_report(y_test, y_pred, target_names=['Non-Fall', 'Fall']))

print("Exporting to Dart...")
dart_code = m2c.export_to_dart(rf_model)

with open("fall_classifier.dart", "w") as f:
    f.write(dart_code)

