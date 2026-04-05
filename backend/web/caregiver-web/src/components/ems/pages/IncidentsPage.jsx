"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const EMS_UNIT_ID = "EMS_UNIT_DEMO_01";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [alertCase, setAlertCase] = useState(null);
  const [ignoredIds, setIgnoredIds] = useState(new Set());
  const audioRef = useRef(null);

  const formatTime = (timestamp) => {
    if (!timestamp) return "...";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 60) return "Now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    audioRef.current = new Audio("/alert.mp3");
    audioRef.current.loop = true;

    const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIncidents(items);

      const found = items.find(
        (x) => x.status === "EMS_TRANSFERRED" && !ignoredIds.has(x.id)
      );

      if (found) {
        setAlertCase(found);
        audioRef.current.play().catch(() => {});
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setAlertCase(null);
      }
    });

    return () => unsub();
  }, [ignoredIds]);

  async function handleAcknowledge() {
    if (!alertCase) return;
    const id = alertCase.id;

    audioRef.current.pause();
    audioRef.current.currentTime = 0;

    setIgnoredIds((prev) => new Set(prev).add(id));
    setAlertCase(null);

    await updateDoc(doc(db, "incidents", id), {
      status: "EMS_REQUESTED",
      updatedAt: serverTimestamp(),
    });
  }

  const filteredList = useMemo(() => {
    const active = new Set([
      "EMS_REQUESTED",
      "EMS_CONTACTED",
      "EMS_ACCEPTED",
      "EMS_DISPATCHED",
      "EMS_ARRIVED",
      "EMS_TRANSFERRED",
    ]);
    return incidents.filter((x) => active.has(x.status));
  }, [incidents]);

  return (
    <div className="min-h-screen bg-slate-100 relative">
      
      {/* 🔴 ALERT POPUP (เรียบขึ้น) */}
      {alertCase && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
          <div className="bg-white w-full max-w-md border border-slate-300 p-6">
            
            <div className="text-lg font-bold text-red-600 uppercase mb-4">
              New Emergency Case
            </div>

            <div className="border border-slate-300 p-4 mb-6 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800">
                {alertCase.patientName || "Unknown"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {alertCase.address || "No location"}
              </p>
            </div>

            <button
              onClick={handleAcknowledge}
              className="w-full border border-slate-900 bg-slate-900 text-white py-3 font-semibold hover:bg-red-600"
            >
              CONFIRM
            </button>
          </div>
        </div>
      )}

      <TopBar title="Incident Queue" subtitle={`Unit: ${EMS_UNIT_ID}`} />

      <div className="mx-auto max-w-[1600px] px-4 py-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-2">
          <SideNav />
        </div>

        <div className="col-span-12 lg:col-span-10 space-y-4">

          {/* HEADER */}
          <div className="flex items-center justify-between px-4 py-3 border border-slate-300 bg-white">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase">
                Active Cases
              </p>
              <h3 className="text-xl font-bold text-slate-900">
                Incident Queue
              </h3>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                {filteredList.length}
              </p>
              <p className="text-xs text-slate-400 uppercase">
                total
              </p>
            </div>
          </div>

          {/* TABLE */}
          <div className="bg-white border border-slate-300">

            <div className="grid grid-cols-12 px-4 py-3 bg-slate-100 border-b text-xs font-semibold text-slate-500 uppercase">
              <div className="col-span-3">Patient</div>
              <div className="col-span-6 hidden md:block">Location</div>
              <div className="col-span-2 text-center">Status</div>
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
                      {it.patientName || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      #{it.id.slice(-6)}
                    </p>
                  </div>

                  <div className="col-span-6 hidden md:block text-sm text-slate-600 truncate">
                    {it.address || "-"}
                  </div>

                  <div className="col-span-2 text-center">
                    <span
                      className={`text-xs px-2 py-1 border ${
                        it.status === "EMS_TRANSFERRED"
                          ? "bg-red-50 border-red-300 text-red-600"
                          : "bg-slate-100 border-slate-300 text-slate-600"
                      }`}
                    >
                      {it.status?.replace("EMS_", "")}
                    </span>
                  </div>

                  <div className="col-span-1 text-right text-blue-600 font-bold">
                    →
                  </div>
                </Link>
              ))}

              {filteredList.length === 0 && (
                <div className="py-16 text-center text-slate-400 text-sm">
                  No active cases
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}