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

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatTrendValue(v, digits = 1) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function buildPath(points, width, height, padding = 10) {
  if (!points.length) return "";
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  return points
    .map((value, index) => {
      const x =
        padding +
        (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
      const y =
        height -
        padding -
        ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function TrendChart({
  title,
  value,
  unit,
  points,
  colorClass = "text-slate-900",
  stroke = "#0f172a",
  subtitle,
}) {
  const width = 320;
  const height = 120;
  const safePoints = points.length ? points : [0, 0, 0, 0];
  const path = buildPath(safePoints, width, height);

  const min = Math.min(...safePoints);
  const max = Math.max(...safePoints);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${colorClass}`}>
            {value}
            {unit ? <span className="ml-1 text-base font-semibold">{unit}</span> : null}
          </p>
        </div>
        {subtitle ? (
          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500">
            {subtitle}
          </span>
        ) : null}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-slate-50">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-28 w-full">
          <path
            d={path}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>min {formatTrendValue(min)}</span>
        <span>max {formatTrendValue(max)}</span>
      </div>
    </section>
  );
}

const LS_DISMISSED_KEY = "dismissedIncidentId";
const PATIENT_ID = "PATIENT_DEMO_01";

const SENIOR_DATA = {
  name: "Grandma Somsri",
  age: 78,
  image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Granny",
  bloodType: "A+",
  condition: "Hypertension, Diabetes",
  heartRate: 72,
  steps: 1240,
  weight: "54 kg",
  walkingLessToday: true,
  walkingSpeedDelta: -18,
  stepsDelta: -12,
  standUpRecoverySec: 14,
};

function getTodayStatus(latest, latestRiskLevel, latestRiskScore) {
  const status = String(latest?.status || "NORMAL").toUpperCase();

  if (status === "FALL_CONFIRMED") {
    return {
      label: "Emergency",
      chip: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    };
  }

  if (status.startsWith("EMS_")) {
    return {
      label: "Help on the way",
      chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
      dot: "bg-indigo-500",
    };
  }

  if (latestRiskLevel === "high" || latestRiskScore >= 60) {
    return {
      label: "High fall risk",
      chip: "bg-rose-50 text-rose-700 border-rose-200",
      dot: "bg-rose-500",
    };
  }

  if (
    latestRiskLevel === "medium" ||
    latestRiskScore >= 30 ||
    SENIOR_DATA.walkingLessToday
  ) {
    return {
      label: "Needs attention",
      chip: "bg-amber-50 text-amber-700 border-amber-200",
      dot: "bg-amber-400",
    };
  }

  return {
    label: "Normal",
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  };
}

function getDailyNote(latestRiskLevel, latestRiskScore, latestSpeed, latestSway) {
  if (latestRiskLevel === "high" || latestRiskScore >= 60) {
    return "Her mobility trend looks riskier than usual. Please check her condition closely and be ready to contact emergency support if needed.";
  }

  if (latestRiskLevel === "medium" || latestRiskScore >= 30) {
    return `She may be moving more slowly or less steadily than usual. Current walking speed is ${formatTrendValue(
      latestSpeed
    )} px/s and sway is ${formatTrendValue(latestSway)} px.`;
  }

  return "No unusual mobility trend has been observed recently.";
}

export default function Page() {
  const [latest, setLatest] = useState(null);
  const [audioReady, setAudioReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [ackMode, setAckMode] = useState(false);
  const [lockedId, setLockedId] = useState(null);

  const [dismissedId, setDismissedId] = useState(null);
  const [stableClipUrl, setStableClipUrl] = useState(null);

  const [emsRequesting, setEmsRequesting] = useState(false);
  const [emsTrackId, setEmsTrackId] = useState(null);

  const [mobilityMetrics, setMobilityMetrics] = useState([]);
  const [dailySummaries, setDailySummaries] = useState([]);

  const audioRef = useRef(null);

  const status = latest?.status || "NORMAL";
  const clipUrl = latest?.clipUrl || null;

  const createdAtMs = useMemo(() => toMs(latest?.createdAt), [latest?.createdAt]);
  const createdAtText = createdAtMs
    ? new Date(createdAtMs).toLocaleString("en-US")
    : "-";

  const latestMetric = mobilityMetrics[0] || null;
  const latestSummary = dailySummaries[0] || null;

  const latestRiskScore = num(
    latestSummary?.latestRiskScore ?? latestMetric?.riskScore,
    0
  );
  const latestRiskLevel = String(
    latestSummary?.latestRiskLevel ?? latestMetric?.riskLevel ?? "low"
  ).toLowerCase();

  const latestSpeed = num(
    latestSummary?.latestAvgSpeedPxPerSec ?? latestMetric?.avgSpeedPxPerSec,
    0
  );
  const latestSway = num(
    latestSummary?.latestAvgSwayPx ?? latestMetric?.avgSwayPx,
    0
  );
  const latestTilt = num(
    latestSummary?.latestAvgTiltDeg ?? latestMetric?.avgTiltDeg,
    0
  );

  const todayStatus = getTodayStatus(latest, latestRiskLevel, latestRiskScore);

  const EMERGENCY_UI =
    ["FALL_CONFIRMED", "EMS_REQUESTED"].includes(status) &&
    status !== "COMPLETED" &&
    status !== "SAFE_CONFIRMED";

  const isDismissed = !!(latest?.id && dismissedId && latest.id === dismissedId);

  const mode = ackMode
    ? "assessment"
    : EMERGENCY_UI && !isDismissed
    ? "emergency"
    : "normal";

  const isOngoingCase =
    latest &&
    (String(status).startsWith("EMS_") || status === "FALL_CONFIRMED") &&
    status !== "COMPLETED" &&
    status !== "SAFE_CONFIRMED";

  useEffect(() => {
    if (ackMode && clipUrl && !stableClipUrl) setStableClipUrl(clipUrl);
    if (!ackMode) setStableClipUrl(null);
  }, [ackMode, clipUrl, stableClipUrl]);

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

  useEffect(() => {
    let unsub;

    if (lockedId) {
      unsub = onSnapshot(doc(db, "incidents", lockedId), (snap) => {
        if (snap.exists()) setLatest({ id: snap.id, ...snap.data() });
      });
    } else {
      const q = query(
        collection(db, "incidents"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      unsub = onSnapshot(q, (snap) => {
        const d = snap.docs[0];
        setLatest(d ? { id: d.id, ...d.data() } : null);
      });
    }

    return () => unsub && unsub();
  }, [lockedId]);

  useEffect(() => {
    const q = query(
      collection(db, "mobility_metrics"),
      orderBy("createdAt", "desc"),
      limit(24)
    );

    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => !row.patientId || row.patientId === PATIENT_ID);

      setMobilityMetrics(rows);
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "mobility_daily_summary"),
      orderBy("updatedAt", "desc"),
      limit(7)
    );

    return onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((row) => !row.patientId || row.patientId === PATIENT_ID);

      setDailySummaries(rows);
    });
  }, []);

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

      try {
        localStorage.removeItem("dismissedIncidentId");
      } catch {}

      setDismissedId(null);
    }
  }, [latest?.id, latest?.status]);

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

        const patientInfo = {
          name: SENIOR_DATA.name,
          age: SENIOR_DATA.age,
          bloodType: SENIOR_DATA.bloodType,
          condition: SENIOR_DATA.condition,
          weight: SENIOR_DATA.weight,
          latestHeartRate: SENIOR_DATA.heartRate,
          walkingSpeedDelta: SENIOR_DATA.walkingSpeedDelta,
          latestRiskScore,
          latestRiskLevel,
          latestAvgSpeedPxPerSec: latestSpeed,
          latestAvgSwayPx: latestSway,
          latestAvgTiltDeg: latestTilt,
          _note: "DEMO DATA (caregiver demo only)",
        };

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

  const recentActivity = [
    {
      time: "Live",
      title: "Mobility risk score",
      detail: `Current risk score is ${formatTrendValue(latestRiskScore)} (${latestRiskLevel}).`,
    },
    {
      time: "Live",
      title: "Walking speed",
      detail: `Recent average speed is ${formatTrendValue(latestSpeed)} px/s.`,
    },
    {
      time: "Live",
      title: "Body sway",
      detail: `Recent sway is ${formatTrendValue(latestSway)} px.`,
    },
  ];

  const speedPoints = [...mobilityMetrics]
    .reverse()
    .map((item) => num(item.avgSpeedPxPerSec, 0));

  const swayPoints = [...mobilityMetrics]
    .reverse()
    .map((item) => num(item.avgSwayPx, 0));

  const riskPoints = [...mobilityMetrics]
    .reverse()
    .map((item) => num(item.riskScore, 0));

  const dailyRiskPoints = [...dailySummaries]
    .reverse()
    .map((item) => num(item.latestRiskScore, 0));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {!audioReady && (
        <button
          onClick={unlockAudio}
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 px-4 pb-8 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Turn on emergency sound
              </p>
              <p className="mt-1 text-sm text-slate-500">
                This helps caregivers hear alerts immediately.
              </p>
            </div>
            <div className="p-5">
              <div className="rounded-2xl bg-rose-600 py-4 text-center text-sm font-semibold text-white">
                Tap to enable
              </div>
            </div>
          </div>
        </button>
      )}

      {mode === "normal" && (
        <div className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
          <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <img
                src={SENIOR_DATA.image}
                alt="profile"
                className="h-16 w-16 rounded-2xl bg-slate-100 object-cover"
              />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-bold text-slate-900">
                  {SENIOR_DATA.name}
                </h1>
                <p className="text-sm text-slate-500">
                  {SENIOR_DATA.age} years old
                </p>

                <div
                  className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${todayStatus.chip}`}
                >
                  <span className={`h-2 w-2 rounded-full ${todayStatus.dot}`} />
                  Today’s status: {todayStatus.label}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Heart rate</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {SENIOR_DATA.heartRate}
              </p>
              <p className="mt-1 text-xs text-slate-400">bpm</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Mobility risk</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatTrendValue(latestRiskScore, 0)}
              </p>
              <p className="mt-1 text-xs capitalize text-slate-400">
                {latestRiskLevel}
              </p>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Daily note</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {getDailyNote(latestRiskLevel, latestRiskScore, latestSpeed, latestSway)}
            </p>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Walking speed</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatTrendValue(latestSpeed)}
              </p>
              <p className="mt-1 text-xs text-slate-400">px/s</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Body sway</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatTrendValue(latestSway)}
              </p>
              <p className="mt-1 text-xs text-slate-400">px</p>
            </div>
          </section>

          <div className="mt-4 space-y-4">
            <TrendChart
              title="Risk trend"
              value={formatTrendValue(latestRiskScore, 0)}
              unit=""
              points={riskPoints}
              stroke="#dc2626"
              colorClass="text-rose-600"
              subtitle="recent windows"
            />

            <TrendChart
              title="Walking speed trend"
              value={formatTrendValue(latestSpeed)}
              unit="px/s"
              points={speedPoints}
              stroke="#2563eb"
              colorClass="text-sky-700"
              subtitle="recent windows"
            />

            <TrendChart
              title="Sway trend"
              value={formatTrendValue(latestSway)}
              unit="px"
              points={swayPoints}
              stroke="#f59e0b"
              colorClass="text-amber-600"
              subtitle="recent windows"
            />

            <TrendChart
              title="7-day risk summary"
              value={formatTrendValue(latestRiskScore, 0)}
              unit=""
              points={dailyRiskPoints}
              stroke="#7c3aed"
              colorClass="text-violet-700"
              subtitle="daily summary"
            />
          </div>

          <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              Medical information
            </p>

            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Blood type</span>
                <span className="font-medium text-slate-900">
                  {SENIOR_DATA.bloodType}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4">
                <span className="text-slate-500">Conditions</span>
                <span className="text-right font-medium text-slate-900">
                  {SENIOR_DATA.condition}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Weight</span>
                <span className="font-medium text-slate-900">
                  {SENIOR_DATA.weight}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Recent activity
              </p>
              <span className="text-xs text-slate-400">{createdAtText}</span>
            </div>

            <div className="mt-3 space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {isOngoingCase && (
            <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto w-full max-w-md">
              <button
                onClick={() => setAckMode(true)}
                className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-left shadow-lg active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Emergency case in progress
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      Status: {status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-white">Open</span>
                </div>
              </button>
            </div>
          )}
        </div>
      )}

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