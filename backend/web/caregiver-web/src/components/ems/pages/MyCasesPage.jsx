"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

/* ---------------- STATUS ---------------- */
function StatusBadge({ status }) {
  const styles = {
    EMS_DISPATCHED: "bg-blue-600 text-white border-blue-600",
    EMS_ARRIVED: "bg-emerald-600 text-white border-emerald-600",
    DEFAULT: "bg-slate-100 text-slate-600 border-slate-300",
  };

  const cls = styles[status] || styles.DEFAULT;
  const label = status?.replace("EMS_", "").replace("_", " ") || "PENDING";

  return (
    <span className={`text-[10px] font-bold px-2 py-1 border uppercase ${cls}`}>
      {label}
    </span>
  );
}

/* ---------------- UTILS ---------------- */
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function toLocalTimeText(createdAt) {
  try {
    if (!createdAt) return "-";
    const date = typeof createdAt?.toDate === "function"
      ? createdAt.toDate()
      : new Date(createdAt);

    return date.toLocaleString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

/* ---------------- PAGE ---------------- */
export default function MyCasesPage() {
  const [qText, setQText] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "incidents"),
      where("ems.assignedUnitId", "==", EMS_UNIT_ID)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setErr(null);
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (e) => setErr(String(e?.message || e))
    );

    return () => unsub();
  }, []);

  const activeItems = useMemo(() => {
    const allowed = new Set(["EMS_DISPATCHED", "EMS_ARRIVED"]);
    return items
      .filter((x) => allowed.has(x.status))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [items]);

  const filteredList = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    if (!needle) return activeItems;

    return activeItems.filter((x) => {
      const name = (x.patient?.name || x.patientName || "").toLowerCase();
      const addr = (x.home?.address || x.address || "").toLowerCase();
      const id = String(x.id || "").toLowerCase();

      return id.includes(needle) || name.includes(needle) || addr.includes(needle);
    });
  }, [qText, activeItems]);

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar title="My Missions" subtitle={`Unit: ${EMS_UNIT_ID}`} />

      <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-12 gap-4">
        
        {/* SIDEBAR */}
        <div className="col-span-12 lg:col-span-2">
          <SideNav />
        </div>

        {/* MAIN */}
        <div className="col-span-12 lg:col-span-10 space-y-4">

          {/* HEADER */}
          <div className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                Active Missions
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                Assigned Cases
              </h3>
            </div>

            <div className="text-right">
              <p className="text-xl font-bold text-blue-600">
                {filteredList.length}
              </p>
              <p className="text-xs text-slate-400 uppercase">
                total
              </p>
            </div>
          </div>

          {/* SEARCH + ACTION */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Search patient / ID / location"
              className="w-full md:max-w-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />

            <Link
              href="/ems/my-cases/completed"
              className="border border-slate-900 bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              History
            </Link>
          </div>

          {/* ERROR */}
          {err && (
            <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              Error: {err}
            </div>
          )}

          {/* TABLE */}
          <div className="bg-white border border-slate-300">

            <div className="grid grid-cols-12 px-4 py-3 bg-slate-100 border-b text-xs font-semibold text-slate-500 uppercase">
              <div className="col-span-3">Patient</div>
              <div className="col-span-5">Location</div>
              <div className="col-span-2 text-center">Time</div>
              <div className="col-span-1 text-center">Status</div>
              <div className="col-span-1 text-right"></div>
            </div>

            <div className="divide-y">
              {filteredList.map((it) => (
                <Link
                  key={it.id}
                  href={`/ems/incidents/${it.id}`}
                  className="grid grid-cols-12 items-center px-4 py-4 hover:bg-slate-50"
                >
                  <div className="col-span-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {it.patient?.name || it.patientName || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      #{it.id.slice(-6)}
                    </p>
                  </div>

                  <div className="col-span-5 text-sm text-slate-600 truncate">
                    {it.home?.address || it.address || "-"}
                  </div>

                  <div className="col-span-2 text-center text-xs text-slate-500">
                    {toLocalTimeText(it.createdAt)}
                  </div>

                  <div className="col-span-1 text-center">
                    <StatusBadge status={it.status} />
                  </div>

                  <div className="col-span-1 text-right text-blue-600 font-bold">
                    →
                  </div>
                </Link>
              ))}

              {filteredList.length === 0 && (
                <div className="py-16 text-center text-sm text-slate-400">
                  No active missions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}