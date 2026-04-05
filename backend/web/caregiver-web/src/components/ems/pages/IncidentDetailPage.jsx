"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import dynamic from "next/dynamic";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

const IncidentRouteMap = dynamic(() => import("./IncidentRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="border border-slate-300 bg-white">
      <div className="flex h-[360px] items-center justify-center text-sm text-slate-500">
        Loading map...
      </div>
    </div>
  ),
});

const MOCK_DATA = {
  patient: {
    name: "คุณสมชาย ใจดี",
    age: 78,
    sex: "ชาย",
  },
  caregiver: {
    name: "ลูกชาย",
    phone: "08X-XXX-XXXX",
  },
  medical: {
    bloodType: "A+",
    condition: "Hypertension, Diabetes",
    weight: "54 kg",
    allergy: "No known drug allergy",
  },
  mobility: {
    latestRiskScore: 42,
    latestRiskLevel: "medium",
    latestAvgSpeedPxPerSec: 18.4,
    latestAvgSwayPx: 26.2,
    latestAvgTiltDeg: 9.1,
    preIncidentTrend: "mobility declined",
    movementPattern: "unstable gait",
  },
  triage: {
    priority: "medium",
    incidentType: "fall_detected",
    trendAlertBeforeIncident: "medium",
  },
  address: "บ้านเลขที่ 12 ต.บ้านดู่ อ.เมือง จ.เชียงราย",
  location: {
    lat: 19.91064,
    lng: 99.83994,
  },
  clipUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
};

const HOSPITAL = {
  name: "Chiang Rai Hospital",
  lat: 19.9076,
  lng: 99.8309,
};

function fmtStatus(s) {
  return String(s || "UNKNOWN").replaceAll("_", " ");
}

function toLatLng(it) {
  const lat =
    it?.location?.lat ??
    it?.lat ??
    it?.home?.lat ??
    MOCK_DATA.location.lat;

  const lng =
    it?.location?.lng ??
    it?.lng ??
    it?.home?.lng ??
    MOCK_DATA.location.lng;

  if (typeof lat === "number" && typeof lng === "number") {
    return { lat, lng };
  }

  return null;
}

function toMs(t) {
  if (!t) return null;
  if (typeof t?.toMillis === "function") return t.toMillis();
  if (typeof t === "number") return t;
  return null;
}

function readNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatNumber(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function StatusBadge({ status }) {
  const styles = {
    EMS_REQUESTED: "bg-amber-100 text-amber-800 border-amber-300",
    EMS_CONTACTED: "bg-sky-100 text-sky-800 border-sky-300",
    EMS_DISPATCHED: "bg-blue-600 text-white border-blue-600",
    EMS_ARRIVED: "bg-emerald-600 text-white border-emerald-600",
    COMPLETED: "bg-emerald-600 text-white border-emerald-600",
    SAFE_CONFIRMED: "bg-slate-700 text-white border-slate-700",
    FALL_CONFIRMED: "bg-rose-600 text-white border-rose-600",
  };

  const cls = styles[status] || "bg-slate-100 text-slate-600 border-slate-300";

  return (
    <span className={`text-xs font-bold px-2 py-1 border uppercase ${cls}`}>
      {fmtStatus(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const value = String(priority || "medium").toLowerCase();

  const cls =
    value === "high"
      ? "bg-rose-100 text-rose-700 border-rose-300"
      : value === "low"
      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
      : "bg-amber-100 text-amber-700 border-amber-300";

  return (
    <span className={`inline-flex items-center border px-2 py-1 text-xs font-bold uppercase ${cls}`}>
      {value}
    </span>
  );
}

function MetricCard({ label, value, sub, tone = "default" }) {
  const toneMap = {
    default: "text-slate-900",
    rose: "text-rose-600",
    blue: "text-sky-700",
    amber: "text-amber-600",
    emerald: "text-emerald-600",
  };

  return (
    <div className="border border-slate-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${toneMap[tone] || toneMap.default}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-right text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

export default function IncidentDetailPage({ id }) {
  const router = useRouter();
  const [it, setIt] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;

    return onSnapshot(doc(db, "incidents", id), (snap) => {
      if (snap.exists()) setIt({ id: snap.id, ...snap.data() });
      else setIt(null);
    });
  }, [id]);

  const status = it?.status || "UNKNOWN";

  const isPending = useMemo(
    () =>
      ["EMS_REQUESTED", "EMS_CONTACTED", "FALL_CONFIRMED", "EMS_TRANSFERRED"].includes(
        status
      ),
    [status]
  );

  const isDispatched = status === "EMS_DISPATCHED";
  const isCompleted = status === "COMPLETED";

  const patientName =
    it?.patient?.name ||
    it?.patientName ||
    it?.patientInfo?.name ||
    MOCK_DATA.patient.name;

  const patientAge =
    it?.patient?.age ||
    it?.patientAge ||
    it?.patientInfo?.age ||
    MOCK_DATA.patient.age;

  const patientSex =
    it?.patient?.sex ||
    it?.patientSex ||
    it?.patientInfo?.sex ||
    MOCK_DATA.patient.sex;

  const caregiverName =
    it?.caregiver?.name ||
    it?.caregiverName ||
    it?.caregiverInfo?.name ||
    MOCK_DATA.caregiver.name;

  const caregiverPhone =
    it?.caregiver?.phone ||
    it?.caregiverPhone ||
    it?.caregiverInfo?.phone ||
    MOCK_DATA.caregiver.phone;

  const bloodType =
    it?.patientInfo?.bloodType ||
    it?.medical?.bloodType ||
    MOCK_DATA.medical.bloodType;

  const condition =
    it?.patientInfo?.condition ||
    it?.medical?.condition ||
    MOCK_DATA.medical.condition;

  const weight =
    it?.patientInfo?.weight ||
    it?.medical?.weight ||
    MOCK_DATA.medical.weight;

  const allergy =
    it?.patientInfo?.allergy ||
    it?.medical?.allergy ||
    MOCK_DATA.medical.allergy;

  const latestHeartRate =
    it?.patientInfo?.latestHeartRate ||
    it?.vitals?.heartRate ||
    null;

  const latestRiskScore = readNumber(
    it?.patientInfo?.latestRiskScore ??
      it?.mobility?.latestRiskScore ??
      it?.triage?.latestRiskScore ??
      MOCK_DATA.mobility.latestRiskScore,
    null
  );

  const latestRiskLevel =
    it?.patientInfo?.latestRiskLevel ||
    it?.mobility?.latestRiskLevel ||
    it?.triage?.trendAlertBeforeIncident ||
    MOCK_DATA.mobility.latestRiskLevel;

  const latestSpeed = readNumber(
    it?.patientInfo?.latestAvgSpeedPxPerSec ??
      it?.mobility?.latestAvgSpeedPxPerSec ??
      MOCK_DATA.mobility.latestAvgSpeedPxPerSec,
    null
  );

  const latestSway = readNumber(
    it?.patientInfo?.latestAvgSwayPx ??
      it?.mobility?.latestAvgSwayPx ??
      MOCK_DATA.mobility.latestAvgSwayPx,
    null
  );

  const latestTilt = readNumber(
    it?.patientInfo?.latestAvgTiltDeg ??
      it?.mobility?.latestAvgTiltDeg ??
      MOCK_DATA.mobility.latestAvgTiltDeg,
    null
  );

  const preIncidentTrend =
    it?.patientInfo?.preIncidentTrend ||
    it?.mobility?.preIncidentTrend ||
    MOCK_DATA.mobility.preIncidentTrend;

  const movementPattern =
    it?.patientInfo?.movementPattern ||
    it?.mobility?.movementPattern ||
    MOCK_DATA.mobility.movementPattern;

  const triagePriority =
    it?.triage?.priority ||
    (latestRiskScore >= 60 ? "high" : latestRiskScore >= 30 ? "medium" : "low") ||
    MOCK_DATA.triage.priority;

  const incidentType =
    it?.triage?.incidentType ||
    MOCK_DATA.triage.incidentType;

  const trendAlertBeforeIncident =
    it?.triage?.trendAlertBeforeIncident ||
    latestRiskLevel ||
    MOCK_DATA.triage.trendAlertBeforeIncident;

  const address =
    it?.address ||
    it?.locationText ||
    it?.home?.address ||
    MOCK_DATA.address;

  const clipUrl =
    it?.clipUrl ||
    it?.snapshotUrl ||
    MOCK_DATA.clipUrl;

  const createdAtMs = toMs(it?.createdAt);
  const updatedAtMs = toMs(it?.updatedAt);
  const createdAtText = createdAtMs ? new Date(createdAtMs).toLocaleString("en-US") : "-";
  const updatedAtText = updatedAtMs ? new Date(updatedAtMs).toLocaleString("en-US") : "-";

  const latlng = useMemo(() => toLatLng(it), [it]);

  const googleMapsUrl = latlng
    ? `https://www.google.com/maps/dir/?api=1&origin=${HOSPITAL.lat},${HOSPITAL.lng}&destination=${latlng.lat},${latlng.lng}`
    : null;

  async function patch(fields) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "incidents", id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    await patch({
      status: "EMS_DISPATCHED",
      "ems.assignedUnitId": EMS_UNIT_ID,
      "ems.status": "on_the_way",
      "ems.acceptedAt": serverTimestamp(),
    });
  }

  async function handleComplete() {
    await patch({
      status: "COMPLETED",
      "ems.status": "arrived_and_completed",
      "ems.completedAt": serverTimestamp(),
    });
    router.push("/ems/my-cases");
  }

  async function handleTransfer() {
    await patch({
      status: "EMS_TRANSFERRED",
    });
    router.push("/ems/incidents");
  }

  if (!it) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=marker`}
        strategy="afterInteractive"
      />

      <div className="max-w-[1400px] mx-auto p-4 space-y-4">
        <div className="border border-slate-300 bg-white px-4 py-3 flex justify-between items-center">
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase">
              Emergency Case
            </div>
            <div className="text-lg font-bold text-slate-900">
              #{String(it.id || "").slice(-6)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PriorityBadge priority={triagePriority} />
            <StatusBadge status={status} />

            <button
              onClick={() => router.push("/ems/incidents")}
              className="border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Back
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <MetricCard
                label="Priority"
                value={String(triagePriority || "-").toUpperCase()}
                sub="triage level"
                tone={triagePriority === "high" ? "rose" : triagePriority === "low" ? "emerald" : "amber"}
              />
              <MetricCard
                label="Risk score"
                value={latestRiskScore != null ? formatNumber(latestRiskScore, 0) : "-"}
                sub={latestRiskLevel ? `${latestRiskLevel} risk` : "risk trend"}
                tone={latestRiskScore >= 60 ? "rose" : latestRiskScore >= 30 ? "amber" : "emerald"}
              />
              <MetricCard
                label="Walking speed"
                value={latestSpeed != null ? formatNumber(latestSpeed) : "-"}
                sub="px/s"
                tone="blue"
              />
              <MetricCard
                label="Body sway"
                value={latestSway != null ? formatNumber(latestSway) : "-"}
                sub="px"
                tone="amber"
              />
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Triage Summary</div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Incident Summary
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <InfoRow label="Incident type" value={incidentType} />
                    <InfoRow label="Current status" value={fmtStatus(status)} />
                    <InfoRow label="Detected at" value={createdAtText} />
                    <InfoRow label="Last updated" value={updatedAtText} />
                  </div>
                </div>

                <div className="border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Pre-incident Context
                  </div>

                  <div className="mt-3 space-y-2 text-sm">
                    <InfoRow label="Trend before incident" value={trendAlertBeforeIncident} />
                    <InfoRow label="Mobility note" value={preIncidentTrend} />
                    <InfoRow label="Movement pattern" value={movementPattern} />
                    <InfoRow
                      label="Evidence"
                      value={clipUrl ? "Video available" : "No video"}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-300 bg-white">
              <div className="px-4 py-3 border-b text-sm font-semibold">
                Evidence
              </div>

              <div className="aspect-video bg-black flex items-center justify-center">
                {clipUrl ? (
                  <video
                    src={clipUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-white/40 text-sm">No video</div>
                )}
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">Location</div>
                  <div className="mt-1 text-sm text-slate-600">{address}</div>

                  {latlng && (
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      {latlng.lat.toFixed(5)}, {latlng.lng.toFixed(5)}
                    </div>
                  )}
                </div>

                {googleMapsUrl && (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open Map
                  </a>
                )}
              </div>

              {latlng && (
                <IncidentRouteMap
                  origin={HOSPITAL}
                  destination={latlng}
                />
              )}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="border border-slate-300 bg-white p-4 space-y-2">
              <div className="font-semibold">Patient</div>
              <div className="text-lg font-bold">{patientName}</div>
              <div className="text-sm text-slate-600">
                Age: {patientAge} | Sex: {patientSex}
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <div className="font-semibold">Medical Summary</div>

              <div className="mt-3">
                <InfoRow label="Blood type" value={bloodType} />
                <InfoRow label="Conditions" value={condition} />
                <InfoRow label="Weight" value={weight} />
                <InfoRow label="Allergy" value={allergy} />
                <InfoRow
                  label="Heart rate"
                  value={latestHeartRate != null ? `${latestHeartRate} bpm` : "-"}
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <div className="font-semibold">Mobility Summary</div>

              <div className="mt-3">
                <InfoRow
                  label="Risk score"
                  value={latestRiskScore != null ? formatNumber(latestRiskScore, 0) : "-"}
                />
                <InfoRow label="Risk level" value={latestRiskLevel} />
                <InfoRow
                  label="Walking speed"
                  value={latestSpeed != null ? `${formatNumber(latestSpeed)} px/s` : "-"}
                />
                <InfoRow
                  label="Body sway"
                  value={latestSway != null ? `${formatNumber(latestSway)} px` : "-"}
                />
                <InfoRow
                  label="Tilt"
                  value={latestTilt != null ? `${formatNumber(latestTilt)}°` : "-"}
                />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4">
              <div className="font-semibold">Caregiver</div>

              <div className="mt-3">
                <InfoRow label="Name" value={caregiverName} />
                <InfoRow label="Phone" value={caregiverPhone} />
              </div>
            </div>

            <div className="border border-slate-300 bg-white p-4 space-y-3">
              <div className="font-semibold">Actions</div>

              {isPending && (
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="w-full border border-blue-600 bg-blue-600 text-white py-3 font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  Dispatch
                </button>
              )}

              {isDispatched && (
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  className="w-full border border-emerald-600 bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 disabled:opacity-60"
                >
                  Complete
                </button>
              )}

              {!isCompleted && (
                <button
                  onClick={handleTransfer}
                  disabled={busy}
                  className="w-full border border-slate-300 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
                >
                  Transfer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}