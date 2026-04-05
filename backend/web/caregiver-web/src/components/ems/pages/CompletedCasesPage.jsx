"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

/* ---------- UTILS ---------- */
function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return ts;
  return 0;
}

function formatTime(ts) {
  try {
    if (!ts) return "-";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
}

/* ---------- PAGE ---------- */
export default function CompletedCasesPage() {
  const [items, setItems] = useState([]);
  const [qText, setQText] = useState("");
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

  const completedItems = useMemo(() => {
    return items
      .filter((x) => x.status === "COMPLETED")
      .sort((a, b) => toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt));
  }, [items]);

  const filteredList = useMemo(() => {
    const needle = qText.toLowerCase();
    if (!needle) return completedItems;

    return completedItems.filter((x) => {
      const name = (x.patient?.name || x.patientName || "").toLowerCase();
      const addr = (x.home?.address || x.address || "").toLowerCase();
      const id = String(x.id || "").toLowerCase();
      return id.includes(needle) || name.includes(needle) || addr.includes(needle);
    });
  }, [qText, completedItems]);

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar title="Mission History" subtitle={`Unit: ${EMS_UNIT_ID}`} />

      <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-12 gap-4">
        
        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-2">
          <SideNav />
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-10 space-y-4">

          {/* HEADER */}
          <div className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                Completed Missions
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                Archive
              </h3>
            </div>

            <Link
              href="/ems/my-cases"
              className="border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Back
            </Link>
          </div>

          {/* SEARCH */}
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            placeholder="Search patient / ID / location"
            className="w-full md:max-w-md border border-slate-300 px-3 py-2 text-sm focus:outline-none"
          />

          {/* ERROR */}
          {err && (
            <div className="border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-600">
              {err}
            </div>
          )}

          {/* TABLE */}
          <div className="border border-slate-300 bg-white">

            <div className="grid grid-cols-12 px-4 py-3 bg-slate-100 text-xs font-semibold text-slate-500 uppercase border-b">
              <div className="col-span-2">ID</div>
              <div className="col-span-3">Patient</div>
              <div className="col-span-5">Location</div>
              <div className="col-span-2 text-right">Closed</div>
            </div>

            <div className="divide-y">
              {filteredList.map((it) => (
                <Link
                  key={it.id}
                  href={`/ems/incidents/${it.id}`}
                  className="grid grid-cols-12 px-4 py-4 items-center hover:bg-slate-50"
                >
                  <div className="col-span-2 text-xs font-mono text-slate-400">
                    #{it.id.slice(-6)}
                  </div>

                  <div className="col-span-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {it.patient?.name || it.patientName || "Unknown"}
                    </div>
                  </div>

                  <div className="col-span-5 text-sm text-slate-600 truncate">
                    {it.home?.address || it.address || "-"}
                  </div>

                  <div className="col-span-2 text-right text-sm text-slate-500">
                    {formatTime(it.updatedAt || it.createdAt)}
                  </div>
                </Link>
              ))}

              {filteredList.length === 0 && (
                <div className="py-16 text-center text-sm text-slate-400">
                  No completed missions
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}