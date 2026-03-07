"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import { MOCK_INCIDENTS, calcDashboardStats } from "../data/mock";

// --- Metric Card Component ---
function MetricCard({ label, value, subValue, trend, trendType }) {
  return (
    <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-sm">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        {subValue && <span className="text-sm text-slate-400 font-medium">{subValue}</span>}
      </div>
      {trend && (
        <div className={`mt-2 text-xs font-bold ${trendType === 'positive' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {trend} <span className="text-slate-400 font-normal ml-1">vs yesterday</span>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const stats = calcDashboardStats(MOCK_INCIDENTS);

  // Mock Ambulance Fleet Data
  const fleetStatus = [
    { id: "AMB-01", type: "ALS", status: "Available", crew: "Dr. Smith / Nurse Jane" },
    { id: "AMB-02", type: "BLS", status: "On Mission", crew: "EMT Mike / Para Sarah" },
    { id: "AMB-03", type: "ALS", status: "Maintenance", crew: "-" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <TopBar title="EMS COMMAND CENTER" subtitle="Operational Control Systems" />

      <div className="mx-auto max-w-[1600px] px-6 py-8 grid grid-cols-12 gap-6">
        
        {/* Sidebar Navigation */}
        <div className="col-span-12 lg:col-span-2">
          <SideNav />
        </div>

        {/* Main Dashboard Content */}
        <div className="col-span-12 lg:col-span-10 space-y-6">
          
          {/* 1. Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard 
                label="New Incidents" 
                value={stats.NEW || 0} 
                trend="+2 cases" 
                trendType="negative" 
            />
            <MetricCard 
                label="Active Missions" 
                value={(stats.DISPATCHED || 0) + (stats.ARRIVED || 0)} 
            />
            <MetricCard 
                label="Completed Today" 
                value={stats.COMPLETED || 0} 
                trend="+12%" 
                trendType="positive" 
            />
            <MetricCard 
                label="Avg. Response" 
                value="4.8" 
                subValue="mins" 
                trend="-0.5m" 
                trendType="positive" 
            />
          </div>

          <div className="grid grid-cols-12 gap-6">
            
            {/* 2. Recent Incidents Table */}
            <div className="col-span-12 xl:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 uppercase tracking-tight">Recent Emergency Logs</h3>
                <Link href="/ems/incidents" className="text-xs font-bold text-blue-600 hover:underline tracking-widest uppercase">View All Logs</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 font-bold uppercase tracking-tighter text-[11px]">Timestamp</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-tighter text-[11px]">Patient Name</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-tighter text-[11px]">Location</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-tighter text-[11px]">Status</th>
                      <th className="px-6 py-3 font-bold uppercase tracking-tighter text-[11px] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MOCK_INCIDENTS.slice(0, 5).map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-500">{it.agoText}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{it.patient.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">ID: {it.id.slice(-6)}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-[220px]">{it.home.address}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                            it.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 
                            it.status === 'NEW' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {it.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link href={`/ems/incidents/${it.id}`} className="inline-block px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded font-bold text-[10px] uppercase transition-all">
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Fleet & Statistics */}
            <div className="col-span-12 xl:col-span-4 space-y-6">
              
              {/* Fleet Management */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                <h3 className="font-bold text-slate-800 mb-4 uppercase text-xs tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                  Fleet Status
                </h3>
                <div className="space-y-3">
                  {fleetStatus.map((unit) => (
                    <div key={unit.id} className="p-4 border border-slate-50 bg-slate-50/30 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{unit.type} UNIT</span>
                          <h4 className="font-bold text-slate-800">{unit.id}</h4>
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded shadow-sm ${
                          unit.status === 'Available' ? 'bg-white text-emerald-600' : 
                          unit.status === 'On Mission' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {unit.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Crew: {unit.crew}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data Summary Card */}
              <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl shadow-slate-200">
                <h3 className="text-[10px] font-black opacity-40 mb-5 uppercase tracking-[0.2em]">Operational Insights</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1.5 uppercase tracking-wide">
                      <span className="opacity-70">Fall Detection Responses</span>
                      <span className="text-blue-400">72%</span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full">
                      <div className="bg-blue-500 h-full w-[72%] rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold mb-1.5 uppercase tracking-wide">
                      <span className="opacity-70">Critical Medical Alerts</span>
                      <span className="text-emerald-400">28%</span>
                    </div>
                    <div className="w-full bg-white/5 h-1 rounded-full">
                      <div className="bg-emerald-500 h-full w-[28%] rounded-full"></div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/5">
                  <p className="text-[10px] text-white/30 italic leading-relaxed uppercase tracking-tighter">
                    System active since 08:00 AM. 
                    No hardware failure reported.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}