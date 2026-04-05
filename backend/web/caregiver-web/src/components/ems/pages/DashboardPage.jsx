"use client";

import TopBar from "../layout/TopBar";
import SideNav from "../layout/SideNav";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MOCK_INCIDENTS, calcDashboardStats } from "../data/mock";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const IncidentHotspotMap = dynamic(() => import("./IncidentHotspotMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center border border-slate-300 bg-slate-50 text-sm text-slate-500">
      Loading map...
    </div>
  ),
});

const PIE_COLORS = ["#dc2626", "#2563eb", "#7c3aed", "#059669", "#d97706", "#475569"];

function MetricCard({ label, value, subValue }) {
  return (
    <div className="border border-slate-300 bg-white p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <div className="mt-3 flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </span>
        {subValue ? (
          <span className="pb-1 text-sm font-medium text-slate-500">{subValue}</span>
        ) : null}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        Completed
      </span>
    );
  }

  if (status === "NEW") {
    return (
      <span className="inline-flex border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-700">
        New
      </span>
    );
  }

  if (status === "ARRIVED") {
    return (
      <span className="inline-flex border border-violet-300 bg-violet-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-700">
        Arrived
      </span>
    );
  }

  if (status === "DISPATCHED") {
    return (
      <span className="inline-flex border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">
        Dispatched
      </span>
    );
  }

  return (
    <span className="inline-flex border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
      {status}
    </span>
  );
}

function FleetBadge({ status }) {
  if (status === "Available") {
    return (
      <span className="inline-flex border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
        Available
      </span>
    );
  }

  if (status === "On Mission") {
    return (
      <span className="inline-flex border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
        On Mission
      </span>
    );
  }

  return (
    <span className="inline-flex border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
        Maintenance
      </span>
    );
}

function SectionCard({ title, subtitle, right, children, className = "" }) {
  return (
    <section className={`border border-slate-300 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-slate-300 px-4 py-3">
        <div>
          <h3 className="text-base font-bold uppercase tracking-[0.08em] text-slate-900">
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function buildDailyTrend(incidents) {
  const today = new Date();
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ key, label, falls: 0, ems: 0 });
  }

  incidents.forEach((it) => {
    const raw =
      it.createdAt?.toDate?.() ||
      (typeof it.createdAt?.seconds === "number"
        ? new Date(it.createdAt.seconds * 1000)
        : typeof it.createdAt === "number"
          ? new Date(it.createdAt)
          : null);

    if (!raw || Number.isNaN(raw.getTime())) return;

    const key = raw.toISOString().slice(0, 10);
    const hit = days.find((d) => d.key === key);
    if (!hit) return;

    hit.falls += 1;

    const status = String(it.status || "").toUpperCase();
    if (["DISPATCHED", "ARRIVED", "COMPLETED"].includes(status)) {
      hit.ems += 1;
    }
  });

  return days.map(({ label, falls, ems }) => ({ label, falls, ems }));
}

function buildStatusData(incidents) {
  const map = new Map();

  incidents.forEach((it) => {
    const key = String(it.status || "UNKNOWN").toUpperCase();
    map.set(key, (map.get(key) || 0) + 1);
  });

  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

function buildHourlyTrend(incidents) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    incidents: 0,
  }));

  incidents.forEach((it) => {
    const raw =
      it.createdAt?.toDate?.() ||
      (typeof it.createdAt?.seconds === "number"
        ? new Date(it.createdAt.seconds * 1000)
        : typeof it.createdAt === "number"
          ? new Date(it.createdAt)
          : null);

    if (!raw || Number.isNaN(raw.getTime())) return;
    buckets[raw.getHours()].incidents += 1;
  });

  return buckets;
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="border border-slate-300 bg-white px-3 py-2 shadow-sm">
      {label ? <p className="text-xs font-bold uppercase text-slate-500">{label}</p> : null}
      <div className="mt-1 space-y-1">
        {payload.map((entry, idx) => (
          <p key={idx} className="text-sm font-medium text-slate-800">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const stats = calcDashboardStats(MOCK_INCIDENTS);
  const activeMissions = (stats.DISPATCHED || 0) + (stats.ARRIVED || 0);

  const fleetStatus = [
    { id: "AMB-01", type: "ALS", status: "Available", crew: "Dr. Smith / Nurse Jane" },
    { id: "AMB-02", type: "BLS", status: "On Mission", crew: "EMT Mike / Para Sarah" },
    { id: "AMB-03", type: "ALS", status: "Maintenance", crew: "-" },
  ];

  const dailyTrend = buildDailyTrend(MOCK_INCIDENTS);
  const statusData = buildStatusData(MOCK_INCIDENTS);
  const hourlyTrend = buildHourlyTrend(MOCK_INCIDENTS);

  return (
    <div className="min-h-screen bg-slate-100">
      <TopBar
        title="EMS Command Center"
        subtitle="Emergency response and operational overview"
      />

      <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-4 px-4 py-4 lg:px-5">
        <aside className="col-span-12 lg:col-span-2">
          <SideNav />
        </aside>

        <main className="col-span-12 space-y-4 lg:col-span-10">
          <section className="border border-slate-300 bg-white">
            <div className="grid gap-0 lg:grid-cols-[1.45fr_0.85fr]">
              <div className="border-b border-slate-300 p-5 lg:border-b-0 lg:border-r">
                <div className="inline-flex items-center gap-2 border border-rose-300 bg-rose-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700">
                  <span className="h-2 w-2 bg-rose-600" />
                  Live operations
                </div>

                <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
                  Emergency Response Overview
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  View incoming incidents, active dispatch load, hotspot locations, and recent case
                  movement from a single command screen. Designed for faster triage and easier
                  operational review.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
                  <div className="border border-slate-300 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      New incidents
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{stats.NEW || 0}</p>
                  </div>

                  <div className="border border-slate-300 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Active missions
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{activeMissions}</p>
                  </div>

                  <div className="border border-slate-300 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Completed today
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {stats.COMPLETED || 0}
                    </p>
                  </div>

                  <div className="border border-slate-300 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                      Total cases
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {MOCK_INCIDENTS.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-5 text-white">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Shift summary
                </p>

                <div className="mt-5 space-y-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-300">Fall detection responses</span>
                      <span className="font-bold text-blue-300">72%</span>
                    </div>
                    <div className="h-2 border border-slate-700 bg-slate-800">
                      <div className="h-full w-[72%] bg-blue-500" />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-slate-300">Critical medical alerts</span>
                      <span className="font-bold text-emerald-300">28%</span>
                    </div>
                    <div className="h-2 border border-slate-700 bg-slate-800">
                      <div className="h-full w-[28%] bg-emerald-500" />
                    </div>
                  </div>
                </div>

                <div className="mt-6 border border-slate-700 bg-slate-800 p-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-white">
                    System status
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Communication and monitoring pipelines are online. Incoming incidents, status
                    updates, and fleet tracking are available for review.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard label="New incidents" value={stats.NEW || 0} />
            <MetricCard label="Active missions" value={activeMissions} />
            <MetricCard label="Completed today" value={stats.COMPLETED || 0} />
          </section>

          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-12 space-y-4 xl:col-span-8">
              <SectionCard
                title="Daily incident trend"
                subtitle="Case volume and EMS progression over the last 7 days"
              >
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrend}>
                      <defs>
                        <linearGradient id="fallsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.26} />
                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0.04} />
                        </linearGradient>
                        <linearGradient id="emsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />

                      <Area
                        type="monotone"
                        dataKey="falls"
                        name="Incidents"
                        stroke="#dc2626"
                        strokeWidth={2.5}
                        fill="url(#fallsFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ems"
                        name="EMS cases"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        fill="url(#emsFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard
                title="Incident map"
                subtitle="Live case positions from incident latitude and longitude"
              >
                <IncidentHotspotMap incidents={MOCK_INCIDENTS} />
              </SectionCard>
            </div>

            <div className="col-span-12 space-y-4 xl:col-span-4">
              <SectionCard
                title="Status distribution"
                subtitle="Current case breakdown by workflow status"
              >
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={105}
                        paddingAngle={3}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 grid gap-2">
                  {statusData.map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between border border-slate-300 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3"
                          style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                        />
                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Hourly pattern"
                subtitle="Hours when incidents are reported most often"
              >
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} minTickGap={20} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="incidents"
                        name="Incidents"
                        stroke="#0f172a"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </section>

          <section className="grid grid-cols-12 gap-4">
            <div className="col-span-12 overflow-hidden border border-slate-300 bg-white xl:col-span-8">
              <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3">
                <div>
                  <h3 className="text-base font-bold uppercase tracking-[0.08em] text-slate-900">
                    Recent emergency logs
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Latest cases received by the emergency response unit
                  </p>
                </div>

                <Link
                  href="/ems/incidents"
                  className="border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View all
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead className="bg-slate-100">
                    <tr className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-4 py-4 font-bold">Time</th>
                      <th className="px-4 py-4 font-bold">Patient</th>
                      <th className="px-4 py-4 font-bold">Location</th>
                      <th className="px-4 py-4 font-bold">Severity</th>
                      <th className="px-4 py-4 font-bold">Status</th>
                      <th className="px-4 py-4 text-right font-bold">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {MOCK_INCIDENTS.slice(0, 6).map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4 text-sm text-slate-600">{it.agoText}</td>

                        <td className="px-4 py-4">
                          <div className="font-semibold text-slate-900">{it.patient?.name}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            ID: {String(it.id).slice(-6)}
                          </div>
                        </td>

                        <td className="max-w-[260px] px-4 py-4 text-sm text-slate-600">
                          <div className="truncate">{it.home?.address}</div>
                        </td>

                        <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                          {it.severity || "-"}
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge status={it.status} />
                        </td>

                        <td className="px-4 py-4 text-right">
                          <Link
                            href={`/ems/incidents/${it.id}`}
                            className="inline-flex border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-12 space-y-4 xl:col-span-4">
              <SectionCard
                title="Fleet status"
                subtitle="Current ambulance and crew availability"
              >
                <div className="space-y-3">
                  {fleetStatus.map((unit) => (
                    <div key={unit.id} className="border border-slate-300 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                            {unit.type} unit
                          </p>
                          <h4 className="mt-1 text-base font-bold text-slate-900">{unit.id}</h4>
                        </div>

                        <FleetBadge status={unit.status} />
                      </div>

                      <div className="mt-3 text-sm text-slate-600">
                        Crew: <span className="font-semibold text-slate-800">{unit.crew}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Quick summary"
                subtitle="Current operational resources for this shift"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border border-slate-300 bg-slate-50 p-4">
                    <span className="text-sm text-slate-600">Available units</span>
                    <span className="text-lg font-bold text-slate-900">1</span>
                  </div>

                  <div className="flex items-center justify-between border border-slate-300 bg-slate-50 p-4">
                    <span className="text-sm text-slate-600">Units on mission</span>
                    <span className="text-lg font-bold text-slate-900">1</span>
                  </div>

                  <div className="flex items-center justify-between border border-slate-300 bg-slate-50 p-4">
                    <span className="text-sm text-slate-600">Units in maintenance</span>
                    <span className="text-lg font-bold text-slate-900">1</span>
                  </div>

                  <div className="border border-blue-300 bg-blue-50 p-4">
                    <p className="text-sm font-semibold text-blue-800">
                      Response systems are stable and ready for incoming incidents.
                    </p>
                  </div>
                </div>
              </SectionCard>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}