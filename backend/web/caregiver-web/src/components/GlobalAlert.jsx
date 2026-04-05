"use client";

import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function GlobalAlert() {
  const [alertCase, setAlertCase] = useState(null);
  const audioRef = useRef(null);
  const isPlayingRef = useRef(false);
  const currentIdRef = useRef(null);
  const doneIdsRef = useRef(new Set());

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
    const q = query(
      collection(db, "incidents"),
      where("status", "in", ["EMS_REQUESTED", "EMS_CONTACTED", "EMS_TRANSFERRED"])
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const pending = items.find(
        (x) => !doneIdsRef.current.has(x.id) && !x.emsResponder
      );

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

      if (audioRef.current && !isPlayingRef.current) {
        audioRef.current
          .play()
          .then(() => {
            isPlayingRef.current = true;
          })
          .catch((err) => {
            console.warn("Autoplay blocked:", err);
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

  const patientName =
    alertCase.patientInfo?.name ||
    alertCase.patientName ||
    "Unknown patient";

  const locationText =
    alertCase.locationText ||
    alertCase.address ||
    "Location not available";

  const caseStatus = String(alertCase.status || "UNKNOWN")
    .replace("EMS_", "")
    .replaceAll("_", " ");

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="h-full w-full animate-alert-flash bg-red-700/20" />
      </div>

      <div className="relative w-full max-w-2xl border-2 border-red-700 bg-white shadow-2xl">
        <div className="border-b-2 border-red-700 bg-red-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-100">
                Emergency Alert
              </div>
              <h2 className="mt-1 text-3xl font-black uppercase tracking-tight">
                New Incident
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse bg-white" />
              <div className="text-sm font-bold uppercase tracking-[0.18em]">
                Live
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-slate-300 p-6 md:border-b-0 md:border-r">
            <div className="space-y-5">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Patient
                </div>
                <div className="mt-2 text-3xl font-black leading-tight text-slate-900">
                  {patientName}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Location
                </div>
                <div className="mt-2 text-base font-semibold leading-6 text-slate-800">
                  {locationText}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Status
                </div>
                <div className="mt-2 inline-flex border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold uppercase tracking-[0.14em] text-red-700">
                  {caseStatus}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6">
            <div className="border border-slate-300 bg-white p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Action Required
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-700">
                A new incident is waiting for EMS review. Acknowledge this alert to stop the alarm on this screen.
              </div>
            </div>

            <button
              onClick={handleClose}
              className="mt-4 w-full border border-slate-900 bg-slate-900 px-4 py-4 text-lg font-black uppercase tracking-[0.12em] text-white transition hover:bg-red-700 hover:border-red-700 active:translate-y-[1px]"
            >
              Acknowledge
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes alert-flash {
          0%, 100% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.35;
          }
        }

        .animate-alert-flash {
          animation: alert-flash 1.1s infinite;
        }
      `}</style>
    </div>
  );
}