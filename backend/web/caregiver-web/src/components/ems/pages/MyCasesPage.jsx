"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- UNIT CONFIG ---------------- */
const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

// Enhanced Status Badge
function StatusBadge({ status }) {
  const styles = {
    EMS_DISPATCHED: "bg-blue-600 text-white border-transparent",
    EMS_ARRIVED: "bg-emerald-600 text-white border-transparent",
    DEFAULT: "bg-slate-100 text-slate-500 border-slate-200",
  };

  const currentStyle = styles[status] || styles.DEFAULT;
  const label = status?.replace("EMS_", "").replace("_", " ") || "PENDING";

  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-widest shadow-sm ${currentStyle}`}>
      {label}
    </span>
  );
}

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function toLocalTimeText(createdAt) {
  try {
    if (!createdAt) return "N/A";
    const date = typeof createdAt?.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
    return date.toLocaleString('en-GB', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  } catch {
    return "N/A";
  }
}

export default function MyCasesPage() {
  const [qText, setQText] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Optimized query for specific unit's assigned cases
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

  // Filter Active Missions only (Dispatched or Arrived)
  const activeItems = useMemo(() => {
    const allowed = new Set(["EMS_DISPATCHED", "EMS_ARRIVED"]);
    const filtered = items.filter((x) => allowed.has(x.status));
    return filtered.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  }, [items]);

  // Search Logic
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
    <div className="min-h-screen bg-[#F8FAFC]">
      <TopBar title="My Active Missions" subtitle={`Authorized: ${EMS_UNIT_ID}`} />

      <div className="mx-auto max-w-[1600px] px-6 py-8 grid grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3 xl:col-span-2">
          <SideNav />
        </div>

        {/* Main Content Area */}
        <div className="col-span-12 lg:col-span-9 xl:col-span-10 space-y-6">
          
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Header / Search Area */}
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="relative w-full md:max-w-lg">
              
              </div>

              <Link
                href="/ems/my-cases/completed"
                className="group flex items-center gap-3 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black text-white hover:bg-slate-800 transition-all shadow-lg"
              >
                <span>Mission History</span>
              
              </Link>
            </div>

            {/* Error Message */}
            {err && (
              <div className="mx-8 mt-4 p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600">
                ⚠️ System Error: {err}
              </div>
            )}

            {/* Incident List */}
            <div className="divide-y divide-slate-50">
              {filteredList.map((it) => (
                <Link
                  key={it.id}
                  href={`/ems/incidents/${it.id}`}
                  className="group block p-8 hover:bg-slate-50/80 transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                          #{it.id?.slice(-8)}
                        </span>
                        <StatusBadge status={it.status} />
                      </div>
                      
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                        {it.patient?.name || it.patientName || "Unidentified Patient"}
                      </h3>

                      <div className="flex flex-col md:flex-row md:items-center gap-y-2 gap-x-6">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 italic">
                          <span>🕒 Reported:</span>
                          <span className="text-slate-600 not-italic">{toLocalTimeText(it.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 italic">
                          <span>📍 Location:</span>
                          <span className="text-slate-600 not-italic line-clamp-1">{it.home?.address || it.address || "-"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                        <span className="text-xl font-black">→</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}

              {/* Empty State */}
              {filteredList.length === 0 && (
                <div className="py-24 text-center">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-3xl mb-4">🚑</div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Active Missions</h3>
                  <p className="text-sm text-slate-400 mt-1 font-medium">Any assigned emergency cases will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}