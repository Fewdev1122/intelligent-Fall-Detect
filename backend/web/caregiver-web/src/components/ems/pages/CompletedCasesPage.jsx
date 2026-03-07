"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- UNIT CONFIG ---------------- */
const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

// Minimalist Archive Badge
function ArchiveBadge({ children }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-black uppercase tracking-widest">
      {children}
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

export default function CompletedCasesPage() {
  const [qText, setQText] = useState("");
  const [items, setItems] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Fetch unit records
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

  // Filter only COMPLETED missions
  const completedItems = useMemo(() => {
    const filtered = items.filter((x) => x.status === "COMPLETED");
    // Sort by most recently updated/closed
    filtered.sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
    return filtered;
  }, [items]);

  // Search Logic
  const filteredList = useMemo(() => {
    const needle = qText.trim().toLowerCase();
    if (!needle) return completedItems;

    return completedItems.filter((x) => {
      const name = (x.patient?.name || x.patientName || "").toLowerCase();
      const addr = (x.home?.address || x.address || "").toLowerCase();
      const id = String(x.id || "").toLowerCase();
      return id.includes(needle) || name.includes(needle) || addr.includes(needle);
    });
  }, [qText, completedItems]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <TopBar title="Mission History" subtitle={`Archives • Unit: ${EMS_UNIT_ID}`} />

      <div className="mx-auto max-w-[1600px] px-6 py-8 grid grid-cols-12 gap-8">
        
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3 xl:col-span-2">
          <SideNav />
        </div>

        {/* Main Content */}
        <div className="col-span-12 lg:col-span-9 xl:col-span-10 space-y-6">
          
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            
            {/* Control Bar */}
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
              <div className="relative w-full md:max-w-md">
              
              </div>

              <Link
                href="/ems/my-cases"
                className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
              >
                <span>← Back to Active Missions</span>
              </Link>
            </div>

            {/* Error Message */}
            {err && (
              <div className="m-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-xs font-bold text-rose-600">
                ⚠️ Connection Error: {err}
              </div>
            )}

            {/* List Header */}
            <div className="hidden md:grid grid-cols-12 px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-50">
              <div className="col-span-2">Reference ID</div>
              <div className="col-span-3">Patient Name</div>
              <div className="col-span-4">Incident Address</div>
              <div className="col-span-3 text-right">Closed Date</div>
            </div>

            {/* Records List */}
            <div className="divide-y divide-slate-50">
              {filteredList.map((it) => (
                <Link
                  key={it.id}
                  href={`/ems/incidents/${it.id}`}
                  className="group grid grid-cols-1 md:grid-cols-12 items-center px-8 py-6 hover:bg-slate-50 transition-all"
                >
                  {/* ID & Status */}
                  <div className="col-span-2 space-y-2">
                    <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-0.5 rounded uppercase block w-fit">
                      #{it.id?.slice(-8)}
                    </span>
                    <ArchiveBadge>{it.status}</ArchiveBadge>
                  </div>

                  {/* Patient Info */}
                  <div className="col-span-3">
                    <div className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                      {it.patient?.name || it.patientName || "Unknown Patient"}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 italic">
                      Medical Record Attached
                    </div>
                  </div>

                  {/* Address */}
                  <div className="col-span-4 pr-6">
                    <p className="text-xs text-slate-500 font-medium line-clamp-1 italic">
                      {it.home?.address || it.address || "No address data"}
                    </p>
                  </div>

                  {/* Closing Date */}
                  <div className="col-span-3 text-left md:text-right">
                    <div className="text-xs font-bold text-slate-600">
                      {toLocalTimeText(it.updatedAt || it.createdAt)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                      Mission Successfully Closed
                    </div>
                  </div>
                </Link>
              ))}

              {/* Empty State */}
              {filteredList.length === 0 && (
                <div className="py-24 text-center">
                  <div className="text-4xl mb-3 grayscale opacity-20">📁</div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No History Found</h3>
                  <p className="text-sm text-slate-400 font-medium">Completed missions for this unit will be archived here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}