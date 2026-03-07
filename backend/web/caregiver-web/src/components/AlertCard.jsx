"use client";
import { useEffect, useState } from "react";

// --- 1. อนิเมชั่น Radar Scan (ธีมขาวสบายตา) ---
function EmsSearchingOverlay({ incidentId }) {
  return (
    <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl">
      <div className="relative flex h-80 w-80 items-center justify-center">
        {/* Pulse Effect */}
        <div className="absolute inset-0 animate-[ping_3s_ease-in-out_infinite] rounded-full bg-blue-500/10"></div>
        
        {/* Radar Line */}
        <div className="absolute inset-0 rounded-full border border-blue-500/10 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_80%,rgba(59,130,246,0.15))] animate-[spin_2s_linear_infinite]"></div>
        </div>

        {/* Center Unit */}
        <div className="relative flex flex-col items-center">
          <div className="text-8xl animate-[bounce_0.8s_ease-in-out_infinite] drop-shadow-xl">🚑</div>
          <div className="absolute -top-4 flex gap-8">
             <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
             <div className="h-3 w-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
          </div>
        </div>
      </div>

      <div className="mt-10 text-center space-y-3 px-10">
        <h3 className="text-3xl font-black text-slate-800 italic animate-pulse uppercase tracking-tighter">
          Searching for EMS...
        </h3>
        <p className="text-blue-600 font-bold text-sm tracking-widest animate-bounce uppercase">
          Contacting the nearest emergency  services
        </p>
        <div className="px-4 py-2 bg-slate-100 border border-slate-200 rounded-2xl">
          <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Waiting for Unit Acceptance...</span>
        </div>
      </div>
    </div>
  );
}

// --- 2. Tracking Stepper (ธีมขาวสบายตา) ---
function CaseTracker({ status, emsInfo }) {
  const steps = ["Received", "On the way", "Arrived"];
  const currentIdx = status === "EMS_ARRIVED" ? 2 : (status === "EMS_DISPATCHED" ? 1 : 0);

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-xl shadow-slate-100">
      <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-4">
        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-blue-200">🏥</div>
        <div>
          <h4 className="text-slate-800 font-black text-lg leading-none mb-1">{emsInfo?.hospitalName || "Case Accepted by Responder"}</h4>
          <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.2em] animate-pulse">
            Status: {status.replace("EMS_", "")}
          </p>
        </div>
      </div>
      <div className="relative flex justify-between px-2 pt-2">
        <div className="absolute top-[18px] left-0 w-full h-0.5 bg-slate-100"></div>
        {steps.map((label, i) => (
          <div key={label} className="relative flex flex-col items-center">
            <div className={`h-4 w-4 rounded-full border-2 transition-all duration-1000 ${
              i <= currentIdx ? "bg-blue-600 border-white scale-125 shadow-lg shadow-blue-200" : "bg-slate-200 border-white"
            }`}></div>
            <span className={`mt-3 text-[10px] font-black uppercase tracking-tighter ${i <= currentIdx ? "text-blue-600" : "text-slate-300"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Main AlertCard Component ---
export default function AlertCard({ mode, latest, busy, createdAtText, clipUrl, onAction, emsRequesting, emsInfo }) {
  const status = latest?.status || "NORMAL";
  const incidentId = latest?.id || null;

  const isSearching = emsRequesting || 
                     status === "EMS_REQUESTED" || 
                     status === "EMS_CONTACTED" || 
                     status === "EMS_TRANSFERRED";

  const isTracking = status === "EMS_DISPATCHED" || status === "EMS_ARRIVED";

  const shouldShowAssessment = mode === "assessment" || isSearching || isTracking;

  // 1. หน้าแจ้งเตือนสีแดง (Emergency Alert - คงสีแดงไว้เพื่อความปลอดภัย)
  if (mode === "emergency" && !isSearching && !isTracking) {
    return (
      <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6 text-white text-center z-[100] fixed inset-0">
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-25"></div>
          <div className="relative bg-white/20 p-10 rounded-full text-8xl shadow-2xl">🚨</div>
        </div>
        <h1 className="text-5xl font-black mb-4 italic tracking-tighter uppercase">Fall Detected!</h1>
        <p className="text-white/70 mb-10 font-medium">Fall detected at: {createdAtText}</p>
        <button 
          onClick={() => onAction("ACK")} 
          disabled={busy}
          className="w-full max-w-sm py-6 bg-white text-red-600 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-95 transition-all uppercase italic"
        >
          {busy ? "Processing..." : "Checking Incident"}
        </button>
      </div>
    );
  }

  // 2. หน้าประเมิน / เรดาร์ / ติดตามเคส (ธีมขาวสบายตา)
  if (shouldShowAssessment) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 relative overflow-hidden fixed inset-0 z-[120]">
        
        {isSearching && <EmsSearchingOverlay incidentId={incidentId} />}

        <div className="max-w-md mx-auto p-6 flex flex-col min-h-screen relative z-10">
          <header className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-black italic tracking-tight uppercase text-blue-600">Alert Center</h2>
            <div className="px-3 py-1 bg-white rounded-full border border-slate-200 font-mono text-[10px] text-slate-400 italic uppercase tracking-widest shadow-sm">ID: {incidentId?.slice(-6)}</div>
          </header>

          {/* Replay Video Section */}
          <div className="rounded-[3rem] bg-white border border-slate-200 p-4 mb-4 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
                <span className="h-2 w-2 bg-red-600 rounded-full animate-ping"></span>
                <span className="bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-lg uppercase italic leading-none">Live Replay</span>
            </div>
            {clipUrl ? (
              <video src={clipUrl} controls autoPlay className="w-full rounded-[2.2rem] bg-slate-900 aspect-video object-cover shadow-inner" />
            ) : (
              <div className="aspect-video flex items-center justify-center bg-slate-100 rounded-[2.2rem] text-slate-300 italic font-mono text-sm tracking-widest border-2 border-dashed border-slate-200">Connecting Feed...</div>
            )}
          </div>

          {/* Status Details */}
          {isTracking ? (
             <CaseTracker status={status} emsInfo={emsInfo} />
          ) : (
            <div className="p-6 bg-blue-50 border border-blue-100 rounded-[2.5rem] text-[13px] text-blue-700 font-bold leading-relaxed shadow-sm">
                <span className="font-black text-blue-600 uppercase mr-2 tracking-widest underline decoration-2 underline-offset-4">Notice:</span> 
                {status === "EMS_TRANSFERRED" ? "กTransferring the call to the local emergency response team..." : "Please review the video above. If the situation is unsafe, press the red button below immediately."}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-auto grid grid-cols-1 gap-4 pt-8">
            {!isTracking && !isSearching && (
              <>
                <button 
                  onClick={() => onAction("EMS")} 
                  disabled={busy} 
                  className="group relative py-7 bg-red-600 text-white rounded-[2.5rem] font-black text-2xl shadow-[0_15px_40px_rgba(220,38,38,0.25)] active:scale-95 transition-all overflow-hidden flex items-center justify-center gap-4 border-b-4 border-red-800"
                >
                   <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]"></div>
                   <span className="relative">Report an emergency</span>
                </button>
                <button 
                  onClick={() => onAction("SAFE")} 
                  disabled={busy} 
                  className="py-5 bg-white text-slate-400 rounded-[2.5rem] font-black border-2 border-slate-100 uppercase tracking-[0.2em] text-[11px] hover:bg-slate-50 hover:text-slate-600 transition-all shadow-sm"
                >
                  safe / Wrong notification
                </button>
              </>
            )}
            
            {(isSearching || isTracking) && (
              <div className="py-7 bg-white text-blue-600 rounded-[2.5rem] font-black text-sm border-2 border-blue-100 text-center uppercase tracking-[0.3em] shadow-lg shadow-blue-50 animate-pulse flex items-center justify-center gap-3">
                <span className="animate-spin text-xl text-blue-400">🌀</span>
                {isSearching ? "Requesting Assistance..." : "Mission in Progress"}
              </div>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes shimmer {
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    );
  }

  return null;
}