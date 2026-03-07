"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** ===== DEMO DATA (keep consistent with caregiver SENIOR_DATA) ===== */
const DEMO_PATIENT = {
  name: "Grandma Somsri",
  age: 78,
  sex: "Female",
  bloodType: "A+",
  condition: "Hypertension, Diabetes",
  weight: "54 kg",
  latestHeartRate: 72,
  allergies: "No known drug allergies",
  medications: "Metformin, Amlodipine",
  note: "DEMO DATA — caregiver-reported info",
};

const DEMO_CAREGIVER = {
  name: "Naruto",
  phone: "+66 81 234 5678",
  relation: "Grandson / Caregiver",
};

const DEMO_LOCATION = {
  lat: 13.9130,
  lng: 100.6042,
};

const DEMO_ADDRESS =
  "171/2 Phahonyothin Rd, Khlong Thanon, Sai Mai, Bangkok 10220";

/** ================================================================ */

function fmtStatus(s) {
  return String(s || "UNKNOWN").replaceAll("_", " ");
}

function toLatLng(it) {
  const lat = it?.location?.lat ?? it?.lat ?? null;
  const lng = it?.location?.lng ?? it?.lng ?? null;
  const ok =
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);
  return ok ? { lat, lng } : null;
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

  // ---- DEMO-aware fields (real data first, fallback to DEMO) ----
  const caregiver = it?.caregiver || it?.caregiverInfo || null;
  const caregiverName = caregiver?.name || it?.caregiverName || DEMO_CAREGIVER.name;
  const caregiverPhone = caregiver?.phone || it?.caregiverPhone || DEMO_CAREGIVER.phone;
  const caregiverRelation =
    caregiver?.relation || it?.caregiverRelation || DEMO_CAREGIVER.relation;

  const patientInfo = it?.patientInfo || {};
  const patientName = patientInfo?.name || it?.patientName || DEMO_PATIENT.name;
  const patientAge = patientInfo?.age ?? it?.patientAge ?? DEMO_PATIENT.age;
  const patientSex = patientInfo?.sex || it?.patientSex || DEMO_PATIENT.sex;
  const bloodType = patientInfo?.bloodType || DEMO_PATIENT.bloodType;
  const condition = patientInfo?.condition || DEMO_PATIENT.condition;
  const weight = patientInfo?.weight || DEMO_PATIENT.weight;
  const latestHeartRate = patientInfo?.latestHeartRate ?? DEMO_PATIENT.latestHeartRate;

  // Caregiver-reported health (if you already store it)
  const caregiverReport = it?.caregiverReport || it?.caregiverHealth || null;
  const allergies =
    caregiverReport?.allergies ||
    it?.allergies ||
    DEMO_PATIENT.allergies;
  const medications =
    caregiverReport?.medications ||
    it?.medications ||
    DEMO_PATIENT.medications;
  const note =
    caregiverReport?.note ||
    it?.note ||
    DEMO_PATIENT.note;

  const address = it?.address || it?.locationText || DEMO_ADDRESS;
  const clipUrl = it?.clipUrl || it?.snapshotUrl || null;

  const latlng = useMemo(() => toLatLng(it) || DEMO_LOCATION, [it]);
  const googleMapsUrl = latlng
    ? `https://www.google.com/maps/dir/?api=1&destination=${latlng.lat},${latlng.lng}`
    : null;

  async function patch(fields) {
    setBusy(true);
    try {
      await updateDoc(doc(db, "incidents", id), {
        ...fields,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error(e);
      alert("Update failed. Check console for details.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    await patch({
      status: "EMS_DISPATCHED",
      "ems.status": "on_the_way",
      "ems.acceptedAt": serverTimestamp(),
      "ems.assignedUnitId": "EMS_UNIT_DEMO_01", // ✅ เพิ่มบรรทัดนี้
    });
  }

  async function handleTransfer() {
    if (!confirm("Transfer to another unit? This case will return to 'awaiting response'.")) return;
    await patch({
      status: "EMS_TRANSFERRED",
      transferAt: serverTimestamp(),
      emsResponder: null,
    });
    router.push("/ems/incidents");
  }

  async function handleComplete() {
    if (!confirm("Confirm completion (Completed)?")) return;
    await patch({
      status: "COMPLETED",
      "ems.status": "arrived_and_completed",
      "ems.completedAt": serverTimestamp(),
    });
    router.push("/ems/my-cases");
  }

  if (!it) {
    return (
      <div className="min-h-screen flex items-center justify-center p-10 bg-slate-50">
        <div className="text-center">
          <div className="text-slate-400 font-black uppercase tracking-widest animate-pulse">
            Loading incident...
          </div>
          <button
            onClick={() => router.back()}
            className="mt-6 px-4 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100"
          >
            ← Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="h-11 w-11 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white font-black"
              aria-label="Back"
            >
              ←
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-xl md:text-2xl font-black text-slate-900">
                  Emergency Case
                </div>
               
              </div>
              <div className="text-xs font-mono text-slate-400">
                ID: {String(it.id || "").slice(-16)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={[
                "px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border",
                isCompleted
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isDispatched
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-rose-50 text-rose-700 border-rose-200",
              ].join(" ")}
            >
              {fmtStatus(status)}
            </span>

            <button
              onClick={() => router.push("/ems/incidents")}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-100"
            >
              Cases List
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Media + Location */}
          <div className="lg:col-span-7 space-y-6">
            {/* Media */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="font-black text-slate-900">Evidence / Video</div>
                {clipUrl ? (
                  <a
                    className="text-sm font-bold text-blue-700 hover:underline"
                    href={clipUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in new tab
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-bold">No media</span>
                )}
              </div>

              <div className="aspect-video bg-black flex items-center justify-center">
                {clipUrl ? (
                  <video
                    src={clipUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-white/40 font-black uppercase tracking-widest text-xs">
                    No media available
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-black text-slate-900">Incident Location</div>
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 active:scale-[0.99]"
                  >
                    Open Navigation
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-bold">No GPS</span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Address
                  </div>
                  <div className="text-slate-900 font-bold">{address || "—"}</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Coordinates
                  </div>
                  <div className="text-slate-900 font-mono text-sm font-black">
                    {latlng ? `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}` : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Patient + Caregiver + Health + Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Patient */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-900">Patient</div>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                  {bloodType}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-2xl font-black text-slate-900 leading-tight">
                  {patientName}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-slate-900 text-white font-black">
                    Age: {patientAge ?? "—"}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-black">
                    Sex: {patientSex ?? "—"}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-rose-100 text-rose-700 font-black">
                    HR: {latestHeartRate ?? "—"} bpm
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Reported Conditions
                </div>
                <div className="font-bold text-slate-900">{condition || "—"}</div>
                <div className="text-xs text-slate-500 mt-1">Weight: {weight || "—"}</div>
              </div>
            </div>

            {/* Caregiver */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-black text-slate-900">Caregiver</div>
                {caregiverPhone ? (
                  <a
                    href={`tel:${String(caregiverPhone).replace(/\s+/g, "")}`}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 active:scale-[0.99]"
                  >
                    Call
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 font-bold">No phone</span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Name
                  </div>
                  <div className="font-bold text-slate-900">{caregiverName || "—"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Relation
                    </div>
                    <div className="font-bold text-slate-900">{caregiverRelation || "—"}</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Phone
                    </div>
                    <div className="font-mono font-black text-slate-900 text-sm">
                      {caregiverPhone || "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Health (Caregiver-reported) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-4">
              <div className="font-black text-slate-900">Health Info </div>

              <div className="rounded-xl p-4 border bg-rose-50 border-rose-200">
                <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-rose-600">
                  Allergies / Contraindications
                </div>
                <div className="font-black text-rose-800">{allergies || "—"}</div>
              </div>

              <div className="rounded-xl p-4 border bg-slate-50 border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-400">
                  Current Medications
                </div>
                <div className="font-bold text-slate-900">{medications || "—"}</div>
              </div>

            </div>

            {/* Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 space-y-3">
              <div className="font-black text-slate-900">Actions</div>

              {isPending && (
                <button
                  onClick={handleAccept}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black text-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? "Saving..." : "🚑 Accept & Dispatch"}
                </button>
              )}

              {isDispatched && (
                <button
                  onClick={handleComplete}
                  disabled={busy}
                  className="w-full py-4 rounded-2xl bg-emerald-600 text-white font-black text-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? "Saving..." : "Arrived & Complete"}
                </button>
              )}

              {!isCompleted && (
                <button
                  onClick={handleTransfer}
                  disabled={busy}
                  className="w-full py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:bg-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Transfer to Another Unit
                </button>
              )}

              {isCompleted && (
                <div className="text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  This case is completed.
                </div>
              )}
            </div>

            {/* Minimal timestamps */}
            <div className="text-xs text-slate-400 font-mono">
              createdAt: {String(it?.createdAt?.toDate?.() ?? "—")}
              <br />
              updatedAt: {String(it?.updatedAt?.toDate?.() ?? "—")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}