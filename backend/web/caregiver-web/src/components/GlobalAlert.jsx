"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function GlobalAlert() {
  const [alertCase, setAlertCase] = useState(null);
  const audioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const currentIdRef = useRef(null);

  // ใช้ Set เก็บ ID ที่กดรับทราบไปแล้ว จะได้ไม่เด้งซ้ำ
  const doneIdsRef = useRef(new Set());

  // ✅ 1. ย้ายการสร้าง Audio ไว้ใน State/Effect ที่ปลอดภัย
  useEffect(() => {
    const audio = new Audio("/alert.mp3");
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // ✅ 2. แก้ Query ให้ดึงมาเฉพาะเคสที่ต้องการเรียก EMS เพื่อประหยัดค่า Read Firebase
    const q = query(
      collection(db, "incidents"),
      where("status", "in", ["EMS_REQUESTED", "EMS_CONTACTED", "EMS_TRANSFERRED"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // หาเคสที่ยังไม่ได้กดปิด และยังไม่มีคนรับเรื่อง (emsResponder)
      const pending = items.find((x) => !doneIdsRef.current.has(x.id) && !x.emsResponder);

      if (!pending) {
        currentIdRef.current = null;
        setAlertCase(null);
        if (audioRef.current && isPlayingRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          isPlayingRef.current = false;
        }
        return;
      }

      if (currentIdRef.current === pending.id) return;

      currentIdRef.current = pending.id;
      setAlertCase(pending);

      // เล่นเสียงเมื่อมีเคสใหม่
      if (audioRef.current && !isPlayingRef.current) {
        audioRef.current.play().then(() => {
          isPlayingRef.current = true;
        }).catch((err) => {
          console.warn("Browser blocked autoplay. User must interact with UI first.", err);
        });
      }
    });

    return () => unsub();
  }, []);

  function handleClose() {
    if (!alertCase) return;
    doneIdsRef.current.add(alertCase.id);

    if (audioRef.current && isPlayingRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      isPlayingRef.current = false;
    }
    currentIdRef.current = null;
    setAlertCase(null);
  }

  if (!alertCase) return null;

  // ✅ 3. ดึงตัวแปรให้ตรงกับ Database Backend
  const patientName = alertCase.patientInfo?.name || "Unknown patient (awaiting info)";
  const locationText = alertCase.locationText || "Location not available";
  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-hidden">
      {/* 🔴 Background Flash Effect */}
      <div className="absolute inset-0 bg-red-600 animate-emergency-bg opacity-90 backdrop-blur-md" />

      {/* 📦 Modal Container */}
      <div className="relative bg-white w-full max-w-lg rounded-[3.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] p-8 md:p-12 text-center border-[12px] border-white animate-in zoom-in duration-300">

        {/* 🚑 Icon with Pulse */}
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
          <div className="absolute -inset-4 rounded-full bg-red-500/10 animate-pulse" />
          <div className="relative text-8xl animate-bounce-slow">🚑</div>
        </div>

        <div className="space-y-2 mb-8">
          <h2 className="text-5xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">
            Emergency!
          </h2>
          <p className="text-red-600 font-bold text-sm tracking-[0.3em] uppercase animate-pulse">
            New Incident
          </p>
        </div>

        {/* 📝 Case Data Card */}
        <div className="bg-slate-50 rounded-[2.5rem] p-6 mb-10 text-left border border-slate-100 shadow-inner group transition-all">
          <div className="mb-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</span>
            <p className="text-3xl font-black text-slate-800 leading-tight">
              {patientName}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-1">📍</div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</span>
              <p className="text-sm font-bold text-slate-500 italic leading-snug">
                {locationText}
              </p>
            </div>
          </div>
        </div>

        {/* 🔘 Close Button */}
        <button
          onClick={handleClose}
          className="group relative w-full overflow-hidden py-8 bg-slate-900 text-white rounded-[2rem] font-black text-3xl uppercase italic shadow-2xl transition-all active:scale-95 hover:bg-red-600"
        >
          <span className="relative z-10">Acknowledge</span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
        </button>
      </div>

      {/* 🛠 Custom CSS Animations */}
      <style jsx>{`
        @keyframes emergency-bg {
          0%, 100% { background-color: rgb(153 27 27); } /* red-800 */
          50% { background-color: rgb(0 0 0); } /* black */
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-emergency-bg {
          animation: emergency-bg 1.5s infinite;
        }
        .animate-shimmer {
          animation: shimmer 1.5s infinite;
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}