import numpy as np
import joblib
import xgboost as xgb

from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_recall_curve,
)

# =============================
# LOAD DATA
# =============================
# ต้องมี X.npy และ y.npy
X = np.load("ai/X_data.npy")
y = np.load("ai/Y_data.npy")
print("X shape:", X.shape)
print("Feature dim:", X.shape[1])

# =============================
# TRAIN / TEST SPLIT
# =============================
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y,
)

# =============================
# CLASS WEIGHT (สำคัญ)
# =============================
non_fall = np.sum(y_train == 0)
fall = np.sum(y_train == 1)

scale_pos_weight = non_fall / fall
print("scale_pos_weight:", scale_pos_weight)

# =============================
# MODEL
# =============================
model = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=scale_pos_weight,
    eval_metric="logloss",
    random_state=42,
)

print("\nTraining XGBoost...")
model.fit(X_train, y_train)

# =============================
# DEFAULT EVALUATION (0.5)
# =============================
y_pred = model.predict(X_test)

print("\n=== DEFAULT THRESHOLD (0.5) ===")
print("Confusion:\n", confusion_matrix(y_test, y_pred))
print("Accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred))

# =============================
# THRESHOLD TUNING
# =============================
probs = model.predict_proba(X_test)[:, 1]

precisions, recalls, thresholds = precision_recall_curve(y_test, probs)

target_recall = 0.95
idx = np.where(recalls >= target_recall)[0]

if len(idx) == 0:
    print("\n⚠️ No threshold achieves recall >= 0.95")
    best_threshold = 0.5
else:
    best_idx = idx[-1]   # เลือก threshold สูงสุดที่ recall ยัง >= target
    best_threshold = thresholds[best_idx]

print("\n=== TUNED THRESHOLD ===")
print(f"Selected threshold: {best_threshold:.4f}")
print(f"Recall at threshold: {recalls[best_idx]:.4f}")
print(f"Precision at threshold: {precisions[best_idx]:.4f}")

# =============================
# EVALUATE WITH NEW THRESHOLD
# =============================
y_pred_new = (probs >= best_threshold).astype(int)

print("\n=== AFTER THRESHOLD TUNING ===")
print("Confusion:\n", confusion_matrix(y_test, y_pred_new))
print("Accuracy:", accuracy_score(y_test, y_pred_new))
print(classification_report(y_test, y_pred_new))

# =============================
# SAVE MODEL + THRESHOLD
# =============================
joblib.dump(
    {
        "model": model,
        "threshold": best_threshold,
    },
    "fall_model_xgb.joblib",
)

print("\n[SAVED] fall_model_xgb.joblib")