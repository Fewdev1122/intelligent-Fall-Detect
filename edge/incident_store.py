# edge/incident_store.py
import firebase_admin
from firebase_admin import credentials, firestore, storage

BUCKET = "fall-detection-demo-6be67.firebasestorage.app"

_app = None
_db = None

def _init():
    global _app, _db
    if _db is not None:
        return

    cred = credentials.ApplicationDefault()

    # ✅ init แค่ครั้งเดียว
    if not firebase_admin._apps:
        _app = firebase_admin.initialize_app(cred, {"storageBucket": BUCKET})
    else:
        _app = firebase_admin.get_app()

    _db = firestore.client()

def get_db():
    _init()
    return _db

def get_bucket():
    _init()
    return storage.bucket()  # ใช้ bucket จาก initialize_app

def set_incident_clip_url(incident_id: str, clip_url: str):
    _init()
    _db.collection("incidents").document(incident_id).set(
        {"clipUrl": clip_url, "clipReady": True},
        merge=True
    )