import requests
import time
import uuid

CREATE_INCIDENT_URL = "https://createincident-wvbrb2gh3a-uc.a.run.app"

def send_fall_incident(extra=None):
    
    payload = {
        "source": "edge-py",
        "event": "FALL_DETECTED",
        "ts": int(time.time() * 1000),
        "requestId": str(uuid.uuid4()),
    }
    if extra:
        payload.update(extra)

    try:
        r = requests.post(CREATE_INCIDENT_URL, json=payload, timeout=10)
        print("[INFO] createIncident:", r.status_code, r.text[:200])

        if r.status_code != 200:
            return None

        data = r.json()
        return data.get("incidentId")  # ✅ สำคัญ: คืน incidentId
    except Exception as e:
        print("[ERROR] createIncident failed:", e)
        return None