"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import AlertCard from "@/components/AlertCard";

function toMs(t) {
  if (!t) return null;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t === "number") return t;
  return null;
}

const LS_DISMISSED_KEY = "dismissedIncidentId";

// ✅ Demo-only Fake Senior Data (for demo purposes)
const SENIOR_DATA = {
  name: "Grandma Somsri",
  age: 78,
  image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Granny",
  bloodType: "A+",
  condition: "Hypertension, Diabetes",
  heartRate: 72,
  steps: 1240,
  weight: "54 kg",
};

export default function Page() {
  const [latest, setLatest] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [ackMode, setAckMode] = useState(false);
  const [lockedId, setLockedId] = useState(null);

  // ✅ Track dismissed incident to avoid red screen after refresh
  const [dismissedId, setDismissedId] = useState(null);

  // ✅ Lock clip URL during assessment mode (stable playback)
  const [stableClipUrl, setStableClipUrl] = useState(null);

  // ✅ EMS status
  const [emsRequesting, setEmsRequesting] = useState(false);
  const [emsTrackId, setEmsTrackId] = useState(null);

  const audioRef = useRef(null);

  const status = latest?.status || "NORMAL";
  const clipUrl = latest?.clipUrl || null;

  const createdAtMs = useMemo(() => toMs(latest?.createdAt), [latest?.createdAt]);
  const createdAtText = createdAtMs
    ? new Date(createdAtMs).toLocaleString("en-US")
    : "-";

  // Emergency UI conditions
  const EMERGENCY_UI = ["FALL_CONFIRMED", "EMS_REQUESTED"].includes(status)
  && status !== "COMPLETED"
  && status !== "SAFE_CONFIRMED";

  // Check if this incident has been dismissed (acknowledged) on this device
  const isDismissed = !!(latest?.id && dismissedId && latest.id === dismissedId);

  // Decide screen mode
  const mode = ackMode
    ? "assessment"
    : EMERGENCY_UI && !isDismissed
    ? "emergency"
    : "normal";

  // Show tracking widget when EMS is ongoing
  const isOngoingCase =
  latest &&
  (String(status).startsWith("EMS_") || status === "FALL_CONFIRMED") &&
  status !== "COMPLETED" &&
  status !== "SAFE_CONFIRMED";

  // Lock clip during assessment mode
  useEffect(() => {
    if (ackMode && clipUrl && !stableClipUrl) setStableClipUrl(clipUrl);
    if (!ackMode) setStableClipUrl(null);
  }, [ackMode, clipUrl, stableClipUrl]);

  // Load dismissed ID + setup audio
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_DISMISSED_KEY);
      if (v) setDismissedId(v);
    } catch {}

    const a = new Audio("/alert.mp3");
    a.loop = true;
    audioRef.current = a;
    return () => a.pause();
  }, []);

  // Play/stop alert sound
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;

    if (audioReady && mode === "emergency" && !ackMode) {
      a.play().catch(() => setAudioReady(false));
    } else {
      a.pause();
      a.currentTime = 0;
    }
  }, [audioReady, mode, ackMode]);

  // Subscribe to Firebase (latest incident OR locked incident)
  useEffect(() => {
    let unsub;

    if (lockedId) {
      unsub = onSnapshot(doc(db, "incidents", lockedId), (snap) => {
        if (snap.exists()) setLatest({ id: snap.id, ...snap.data() });
      });
    } else {
      const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"), limit(1));
      unsub = onSnapshot(q, (snap) => {
        const d = snap.docs[0];
        setLatest(d ? { id: d.id, ...d.data() } : null);
      });
    }

    return () => unsub && unsub();
  }, [lockedId]);

  // Stop EMS requesting animation when EMS side updates status
  useEffect(() => {
    if (
      latest?.id === emsTrackId &&
      ["EMS_CONTACTED", "EMS_DISPATCHED", "EMS_ARRIVED"].includes(status)
    ) {
      setEmsRequesting(false);
    }
  }, [latest?.id, status, emsTrackId]);

  useEffect(() => {
  if (!latest?.id) return;

  const s = String(latest.status || "").toUpperCase();

  if (s === "COMPLETED" || s === "SAFE_CONFIRMED") {
    setAckMode(false);
    setLockedId(null);
    setEmsRequesting(false);
    setEmsTrackId(null);

    try { localStorage.removeItem("dismissedIncidentId"); } catch {}
    setDismissedId(null);
  }
}, [latest?.id, latest?.status]);

  // Handle actions from AlertCard
  async function onAction(action) {
    if (!latest?.id) return;

    setBusy(true);
    try {
      const docRef = doc(db, "incidents", latest.id);

      if (action === "ACK") {
        setAckMode(true);
        setLockedId(latest.id);
        setDismissedId(latest.id);
        localStorage.setItem(LS_DISMISSED_KEY, latest.id);
      }

      const payload = {
        incidentId: latest.id,
        action,
        source: "caregiver-web",
      };

      if (action === "EMS") {
        setEmsRequesting(true);
        setEmsTrackId(latest.id);
        setLockedId(latest.id);
        setAckMode(true);

        // 1) Prepare demo patient info (fake data for demo)
        const patientInfo = {
          name: SENIOR_DATA.name,
          age: SENIOR_DATA.age,
          bloodType: SENIOR_DATA.bloodType,
          condition: SENIOR_DATA.condition,
          weight: SENIOR_DATA.weight,
          latestHeartRate: SENIOR_DATA.heartRate,
          _note: "DEMO DATA (caregiver demo only)",
        };

        // 2) Save to Firestore immediately for EMS snapshot
        await updateDoc(docRef, {
          patientInfo,
          status: "EMS_REQUESTED",
        });

        payload.patientInfo = patientInfo;
      }

      if (action === "SAFE") {
        await updateDoc(docRef, { status: "SAFE_CONFIRMED" });
        setLockedId(null);
        setAckMode(false);
        setEmsRequesting(false);
        setEmsTrackId(null);
      }

      // Send API as usual
      const r = await fetch("/api/incidentAction", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json();
      if (!data.ok && action === "EMS") setEmsRequesting(false);
    } catch (e) {
      console.error("onAction failed:", e);
      if (action === "EMS") setEmsRequesting(false);
    } finally {
      setBusy(false);
    }
  }

  async function unlockAudio() {
    try {
      await audioRef.current?.play();
      audioRef.current?.pause();
      setAudioReady(true);
    } catch {
      setAudioReady(false);
    }
  }

  const clipUrlForUI = ackMode ? stableClipUrl || clipUrl : clipUrl;

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
      {/* 1) Audio unlock overlay */}
      {!audioReady && (
        <button
          onClick={unlockAudio}
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
        >
          <div className="bg-white p-8 rounded-[2.5rem] text-center shadow-2xl max-w-xs scale-110">
            <div className="text-5xl mb-4">🔔</div>
            <h3 className="text-xl font-black mb-2">Enable Alerts</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tap to allow alert sounds during emergencies.
            </p>
            <div className="py-4 bg-red-600 text-white rounded-2xl font-black text-lg animate-pulse">
              Enable
            </div>
          </div>
        </button>
      )}

      {/* 2) Normal Dashboard */}
      {mode === "normal" && (
        <div className="max-w-md mx-auto min-h-screen pb-32">
          {/* Senior Profile Section (DEMO) */}
          <header className="bg-white p-8 rounded-b-[3.5rem] shadow-xl shadow-slate-200/50 flex flex-col items-center text-center border-b border-slate-100">
            <div className="h-24 w-24 rounded-full border-4 border-blue-500 p-1 mb-4 shadow-lg shadow-blue-200">
              <img src={SENIOR_DATA.image} alt="profile" className="rounded-full bg-blue-50" />
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              {SENIOR_DATA.name}
            </h1>


            <div className="mt-2 px-4 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">
              ● System Normal
            </div>
          </header>

          {/* Health Summary Cards (DEMO) */}
          <div className="p-6 grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 group active:scale-95 transition-all">
              <div className="bg-red-50 h-10 w-10 rounded-2xl flex items-center justify-center text-xl mb-3">
                ❤️
              </div>
              <div className="text-3xl font-black text-slate-800">{SENIOR_DATA.heartRate}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Heart Rate 
              </div>
            </div>

            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100 active:scale-95 transition-all">
              <div className="bg-blue-50 h-10 w-10 rounded-2xl flex items-center justify-center text-xl mb-3">
                👣
              </div>
              <div className="text-3xl font-black text-slate-800">{SENIOR_DATA.steps}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Steps Today
              </div>
            </div>
          </div>

          {/* Medical Info Section (DEMO) */}
          <div className="px-6 space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">
              Medical Profile (Demo)
            </h3>
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-sm font-bold text-slate-400">Blood Type</span>
                <span className="text-sm font-black text-slate-800">{SENIOR_DATA.bloodType}</span>
              </div>

              <div className="flex justify-between items-center border-b border-slate-50 pb-3">
                <span className="text-sm font-bold text-slate-400">Conditions</span>
                <span className="text-sm font-black text-slate-800">{SENIOR_DATA.condition}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-slate-400">Weight</span>
                <span className="text-sm font-black text-slate-800">{SENIOR_DATA.weight}</span>
              </div>
            </div>

            <div className="text-xs font-mono text-slate-400 px-2">
              Latest incident time: {createdAtText}
            </div>
          </div>

          {/* Floating Tracking Widget */}
          {isOngoingCase && (
            <div className="fixed bottom-8 left-6 right-6 z-[100]">
              <button
                onClick={() => setAckMode(true)}
                className="w-full bg-blue-600 p-5 rounded-[2.5rem] shadow-[0_20px_40px_rgba(37,99,235,0.4)] flex items-center justify-between border-2 border-white/20 animate-bounce"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 h-12 w-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                    🚑
                  </div>
                  <div className="text-left">
                    <div className="text-white font-black text-sm uppercase italic tracking-tight">
                      Help is on the way...
                    </div>
                    <div className="text-blue-100 text-[10px] font-bold opacity-80">
                      Status: {status}
                    </div>
                  </div>
                </div>
                <div className="bg-white text-blue-600 h-10 w-10 rounded-full flex items-center justify-center font-black shadow-lg">
                  →
                </div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3) Alert & Emergency Management (Assessment / Red Screen) */}
      <AlertCard
        mode={mode}
        latest={latest}
        busy={busy}
        createdAtText={createdAtText}
        clipUrl={clipUrlForUI}
        onAction={onAction}
        emsRequesting={emsRequesting}
        emsInfo={latest?.ems || null}
      />
    </main>
  );
}