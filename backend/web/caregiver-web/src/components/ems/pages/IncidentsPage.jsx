"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`;
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    audioRef.current = new Audio("/alert.mp3");
    audioRef.current.loop = true;

    const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIncidents(items);

      // --- จุดเช็คให้เด้งเฉพาะตอน TRANSFERRED เท่านั้น ---
      const found = items.find(x => x.status === "EMS_TRANSFERRED" && !ignoredIds.has(x.id));
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
    const targetId = alertCase.id;

    // หยุดเสียงและซ่อน Popup ทันทีที่เครื่องเรา
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIgnoredIds(prev => new Set(prev).add(targetId));
    setAlertCase(null);

    // อัปเดตสถานะใน Firebase เป็น REQUESTED (รับงานแล้ว)
    try {
      await updateDoc(doc(db, "incidents", targetId), {
        status: "EMS_REQUESTED",
        updatedAt: serverTimestamp(),
      });
      console.log("✅ รับงานสำเร็จ ID:", targetId);
    } catch (e) {
      console.error("Update failed:", e);
    }
  }

  // --- จุดสำคัญ: กรองไม่ให้ FALL_CONFIRMED โผล่มาหน้า EMS ---
  const filteredList = useMemo(() => {
    // ตัด "FALL_CONFIRMED" ออกจาก Set เพื่อไม่ให้เคสโผล่มาก่อนที่ผู้ดูแลจะส่ง
    const active = new Set(["EMS_REQUESTED", "EMS_CONTACTED", "EMS_ACCEPTED", "EMS_DISPATCHED", "EMS_ARRIVED", "EMS_TRANSFERRED"]);
    return incidents.filter(x => active.has(x.status));
  }, [incidents]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative">
      
      {/* POP-UP แจ้งเตือน */}
      {alertCase && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-red-600/90 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-[3rem] border-8 border-white shadow-2xl p-10 text-center animate-in zoom-in">
            <div className="text-8xl mb-4 animate-bounce">🚑</div>
            <h2 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none mb-2">NEW CASE!</h2>
            <p className="text-rose-600 font-black animate-pulse text-xs uppercase tracking-[0.3em] mb-6">Emergency Hotline Transfer</p>
            
            <div className="bg-slate-50 rounded-3xl p-6 mb-8 text-left border border-slate-100 shadow-inner">
              <div className="mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</p>
                <p className="text-3xl font-black text-slate-800 leading-tight">{alertCase.patientName || "Unknown Patient"}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                <p className="text-sm font-bold text-slate-600 italic leading-snug">{alertCase.address || "No Location"}</p>
              </div>
            </div>

            <button
              onClick={handleAcknowledge}
              className="w-full py-8 bg-slate-900 text-white rounded-[2rem] font-black text-2xl uppercase italic tracking-widest hover:bg-rose-600 transition-all shadow-xl active:scale-95"
            >
              CONFIRM RECEIPT
            </button>
          </div>
        </div>
      )}

      <TopBar title="Incident Queue" subtitle={`EMS Monitor: ${EMS_UNIT_ID}`} />
      
      <div className="mx-auto max-w-[1600px] px-6 py-8 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-3 xl:col-span-2"><SideNav /></div>
        
        <div className="col-span-12 lg:col-span-9 xl:col-span-10 space-y-4">
          
          <div className="flex items-center justify-between px-8 py-4 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Missions</p>
              <h3 className="text-2xl font-black text-slate-900 italic uppercase">Dashboard </h3>
            </div>
            <div className="text-right">
              <p className="text-4xl font-black text-blue-600 leading-none">{filteredList.length}</p>
              <p className="text-[10px] font-black text-slate-400 uppercase">All Cases</p>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 px-8 py-4 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <div className="col-span-4 md:col-span-3">Patient / Case ID</div>
              <div className="col-span-5 md:col-span-6 hidden md:block">Location</div>
              <div className="col-span-4 md:col-span-2 text-center">Time / Status</div>
              <div className="col-span-4 md:col-span-1 text-right">Action</div>
            </div>

            <div className="divide-y divide-slate-50">
              {filteredList.map((it) => (
                <Link key={it.id} href={`/ems/incidents/${it.id}`} className="grid grid-cols-12 items-center px-8 py-6 hover:bg-slate-50 transition-all group">
                  <div className="col-span-4 md:col-span-3">
                    <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase leading-none mb-1">
                      {it.patientName || "Unidentified"}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono font-bold tracking-tighter">#{it.id?.slice(-8).toUpperCase()}</p>
                  </div>

                  <div className="col-span-5 md:col-span-6 hidden md:block pr-4">
                    <p className="text-xs text-slate-500 italic truncate font-medium">
                      {it.address || "No address info"}
                    </p>
                  </div>

                  <div className="col-span-4 md:col-span-2 flex flex-col items-center gap-1">
                    <p className="text-[10px] font-bold text-slate-400 mb-1">{formatTime(it.createdAt)}</p>
                    <span className={`text-[9px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${
                      it.status === 'EMS_TRANSFERRED' 
                      ? 'bg-rose-50 text-rose-600 border-rose-100 animate-pulse' 
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {it.status?.replace("EMS_", "").replace("_", " ")}
                    </span>
                  </div>

                  <div className="col-span-4 md:col-span-1 text-right">
                    <span className="text-blue-600 font-black group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                </Link>
              ))}

              {filteredList.length === 0 && (
                <div className="py-24 text-center">
                  <p className="text-slate-300 font-black uppercase italic tracking-[0.3em]">No active cases in queue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}