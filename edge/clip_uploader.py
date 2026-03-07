# edge/clip_uploader.py
import os
import uuid
import urllib.parse

from edge.incident_store import get_bucket

def upload_clip(path, incident_id):
    bucket = get_bucket()

    filename = os.path.basename(path)
    object_name = f"clips/{incident_id}/{filename}"

    blob = bucket.blob(object_name)

    token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": token}

    blob.upload_from_filename(path, content_type="video/mp4")
    blob.patch()

    quoted = urllib.parse.quote(object_name, safe="")
    url = f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/{quoted}?alt=media&token={token}"
    print("[UPLOAD] ok url =", url)
    return url