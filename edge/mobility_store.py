import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(HERE, ".."))
SERVICE_ACCOUNT = os.path.join(PROJECT_ROOT, "keys", "serviceAccountKey.json")

def _get_db():
    if not firebase_admin._apps:
        cred = credentials.Certificate(SERVICE_ACCOUNT)
        firebase_admin.initialize_app(cred)
    return firestore.client()

def save_mobility_metric(patient_id: str, payload: dict):
    db = _get_db()
    doc = {
        "patientId": patient_id,
        **payload,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    db.collection("mobility_metrics").add(doc)

def save_mobility_daily_summary(patient_id: str, date_key: str, payload: dict):
    db = _get_db()
    doc_ref = db.collection("mobility_daily_summary").document(f"{patient_id}_{date_key}")
    doc_ref.set(
        {
            "patientId": patient_id,
            "dateKey": date_key,
            **payload,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        merge=True,
    )

def iso_now():
    return datetime.utcnow().isoformat() + "Z"