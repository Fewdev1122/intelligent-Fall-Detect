/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// ✅ อัปเดต Version เพื่อให้รู้ว่าโค้ดใหม่ขึ้นไปแล้ว
const VERSION = "v1001-cron-adaptive-escalate";

// === Auto-escalate policy ===
// ถ้า confidence >= 0.55 และ clipReady === true -> อนุญาต auto
// ต่ำกว่านั้น -> รอ caregiver เท่านั้น
const AUTO_CONF_MIN = 0.55;

// Adaptive range (minutes)
const MIN_AUTO_MINUTES = 1;
const MAX_AUTO_MINUTES = 4;

const serverNow = () => admin.firestore.FieldValue.serverTimestamp();

function makeRequestId() {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 10);
  return `${a}-${b}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

// risk -> minutes
// - high risk => closer to 1 min
// - low risk  => closer to 4 min
function computeEscalateMinutes(inc) {
  const conf = Number(inc.confidence !== undefined ? inc.confidence : 0);
  const rulePass = inc.rule && inc.rule.pass ? true : false;

  let risk = conf;
  if (rulePass) risk += 0.15; // boost ถ้า rule ผ่าน
  risk = clamp(risk, 0, 1);

  // linear mapping: risk=1 -> 1, risk=0 -> 4
  const minutes = MAX_AUTO_MINUTES - ((MAX_AUTO_MINUTES - MIN_AUTO_MINUTES) * risk);

  // round to 0.1 minute
  return Math.round(minutes * 10) / 10;
}

// -------------------------------------------------------------------
// 1. HTTP Endpoint: รับข้อมูลล้มจากกล้อง (ลบ setTimeout ออกแล้ว)
// -------------------------------------------------------------------
exports.createIncident = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ok: false, error: "POST only"});
    }

    const requestId = makeRequestId();
    const body = req.body || {};

    const deviceId = body.deviceId || "edge-local";
    const locationText = body.locationText || "Unknown";

    const confidence = body.confidence !== undefined ? body.confidence : null;
    const lastMotionSeconds = body.lastMotionSeconds !== undefined ? body.lastMotionSeconds : null;
    const snapshotUrl = body.snapshotUrl !== undefined ? body.snapshotUrl : null;

    // extra from edge
    const rule = body.rule !== undefined ? body.rule : null;
    const clip = body.clip !== undefined ? body.clip : null;
    const confirm = body.confirm !== undefined ? body.confirm : null;

    const ref = db.collection("incidents").doc();

    // compute adaptive minutes
    const yMinutes = computeEscalateMinutes({confidence, rule});

    // policy gate: auto allowed only if conf >= 0.55
    const confNum = Number(confidence !== undefined && confidence !== null ? confidence : 0);
    const autoAllowedByConfidence = confNum >= AUTO_CONF_MIN;

    // ✅ คำนวณเวลาที่จะให้ระบบ Auto-Escalate ทำงาน (บันทึกเป็น Timestamp ลง DB)
    const nowMs = Date.now();
    const escalateTimeMs = nowMs + (yMinutes * 60 * 1000);
    const escalateTimestamp = admin.firestore.Timestamp.fromMillis(escalateTimeMs);

    await ref.set({
      deviceId,
      locationText,
      confidence,
      lastMotionSeconds,
      snapshotUrl,
      rule,
      clip,
      confirm,

      status: "FALL_CONFIRMED",
      createdAt: serverNow(),
      updatedAt: serverNow(),
      alertsSent: 1,
      version: VERSION,
      requestId,

      // ข้อมูลสำหรับระบบ Auto-Escalate ด้วย Cron Job
      escalateAfterMinutes: yMinutes,
      escalateAt: escalateTimestamp, 
      autoPolicy: {
        confMin: AUTO_CONF_MIN,
        autoAllowedByConfidence,
        minMinutes: MIN_AUTO_MINUTES,
        maxMinutes: MAX_AUTO_MINUTES,
      },
    });

    console.log(`[INFO] Created Incident ${ref.id}, Scheduled escalate at: ${new Date(escalateTimeMs).toISOString()}`);

    return res.json({
      ok: true,
      version: VERSION,
      requestId,
      incidentId: ref.id,
      yMinutes,
      autoAllowedByConfidence,
      confMin: AUTO_CONF_MIN,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ok: false, error: String(e)});
  }
});

// -------------------------------------------------------------------
// 2. CRON JOB: รันอัตโนมัติทุกๆ 1 นาที เพื่อเช็คเคสที่หมดเวลา (Timeout)
// -------------------------------------------------------------------
exports.checkAutoEscalate = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();

  try {
    // หาเคสที่ยังไม่ได้จัดการ, อนุญาตให้ Auto ได้ และเลยเวลาที่กำหนดแล้ว
    const snapshot = await db.collection("incidents")
      .where("status", "==", "FALL_CONFIRMED")
      .where("autoPolicy.autoAllowedByConfidence", "==", true)
      .where("escalateAt", "<=", now)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const batch = db.batch();
    let escalatedCount = 0;

    snapshot.forEach((doc) => {
      const inc = doc.data();

      // ต้องรอให้คลิปพร้อมก่อน (ตาม Policy เดิมของคุณ)
      if (inc.clipReady !== true) {
        console.log(`[AUTO] blocked: clipReady is not true for ${doc.id}`);
        return; 
      }

      // เช็ค confidence อีกรอบเพื่อความชัวร์
      const c = Number(inc.confidence !== undefined ? inc.confidence : 0);
      if (c < AUTO_CONF_MIN) {
        console.log(`[AUTO] blocked: confidence below min for ${doc.id}`);
        return;
      }

      // อัปเดตสถานะเป็น EMS_REQUESTED
      const ref = db.collection("incidents").doc(doc.id);
      batch.update(ref, {
        status: "EMS_REQUESTED",
        emsRequestedAt: serverNow(),
        escalatedReason: "AUTO_RISK_ADAPTIVE_TIMEOUT",
        updatedAt: serverNow(),
      });

      // บันทึก Log
      const actionRef = db.collection("incident_actions").doc();
      batch.set(actionRef, {
        incidentId: doc.id,
        action: "AUTO_ESCALATE_EMS",
        userId: "system",
        note: `Adaptive timeout ${inc.escalateAfterMinutes} min (clipReady+conf>=${AUTO_CONF_MIN})`,
        createdAt: serverNow(),
        version: VERSION,
      });

      escalatedCount++;
      console.log(`[AUTO] escalated to EMS_REQUESTED: ${doc.id}`);
    });

    if (escalatedCount > 0) {
      await batch.commit();
      console.log(`[CRON] Successfully auto-escalated ${escalatedCount} incidents.`);
    }

    return null;
  } catch (error) {
    console.error("[CRON] auto-escalate error:", error);
    return null;
  }
});

// -------------------------------------------------------------------
// 3. HTTP Endpoint: สำหรับให้ Caregiver กดรับทราบ/ปลอดภัย/เรียก EMS
// -------------------------------------------------------------------
exports.incidentAction = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ok: false, error: "POST only"});
    }

    const body = req.body || {};
    const incidentId = body.incidentId;
    const action = body.action;
    const userId = body.userId || "caregiver-1";
    const note = body.note !== undefined ? body.note : null;

    if (!incidentId || !action) {
      return res.status(400).json({ok: false, error: "missing incidentId/action"});
    }

    const ref = db.collection("incidents").doc(incidentId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ok: false, error: "incident not found"});
    }

    const updates = {updatedAt: serverNow()};

    if (action === "ACK") {
      updates.status = "ACKED";
      updates.ackAt = serverNow();
      updates.ackBy = userId;
    } else if (action === "SAFE") {
      updates.status = "SAFE";
      updates.resolvedAt = serverNow();
      updates.resolvedBy = userId;
    } else if (action === "EMS") {
      updates.status = "EMS_REQUESTED";
      updates.emsRequestedAt = serverNow();
      updates.escalatedReason = "MANUAL_CAREGIVER";
    } else {
      return res.status(400).json({ok: false, error: "invalid action"});
    }

    await ref.update(updates);

    await db.collection("incident_actions").add({
      incidentId,
      action,
      userId,
      note,
      createdAt: serverNow(),
      version: VERSION,
    });

    return res.json({ok: true});
  } catch (e) {
    console.error(e);
    return res.status(500).json({ok: false, error: String(e)});
  }
});

// -------------------------------------------------------------------
// 4. HTTP Endpoint: สำหรับกล้องอัปโหลดคลิปวิดีโอ
// -------------------------------------------------------------------
exports.uploadClip = functions.https.onRequest(async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ok: false, error: "POST only"});
    }

    const body = req.body || {};
    const incidentId = body.incidentId;
    const fileName = body.fileName || "clip.mp4";
    const fileBase64 = body.fileBase64;

    if (!incidentId) {
      return res.status(400).json({ok: false, error: "missing incidentId"});
    }
    if (!fileBase64) {
      return res.status(400).json({ok: false, error: "missing fileBase64"});
    }

    const buffer = Buffer.from(fileBase64, "base64");
    const bucket = admin.storage().bucket();

    const objectPath = `clips/${incidentId}/${fileName}`;
    const file = bucket.file(objectPath);

    await file.save(buffer, {contentType: "video/mp4"});

    // เดโม: signed url
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    await db.collection("incidents").doc(incidentId).update({
      clipUrl: url,
      clipPath: objectPath,
      clipFileName: fileName,
      clipUploadedAt: serverNow(),
      clipReady: true,
      updatedAt: serverNow(),
      version: VERSION,
    });

    console.log("uploadClip OK", {incidentId, objectPath});

    return res.json({ok: true, url, incidentId});
  } catch (e) {
    console.error("uploadClip error:", e);
    return res.status(500).json({ok: false, error: String(e)});
  }
});