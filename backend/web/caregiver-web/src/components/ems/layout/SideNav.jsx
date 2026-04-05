"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Siren,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/ems",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/ems/incidents",
    label: "Incidents",
    icon: Siren,
  },
  {
    href: "/ems/my-cases",
    label: "My Cases",
    icon: ClipboardList,
  },
];

function isActivePath(path, href, exact = false) {
  if (exact) return path === href;
  return path === href || path.startsWith(href + "/");
}

function NavItem({ href, label, icon: Icon, collapsed, active }) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
      title={collapsed ? label : undefined}
    >
      <span
        className={`absolute left-0 top-0 h-full w-1 ${
          active ? "bg-blue-600" : "bg-transparent"
        }`}
      />

      <Icon size={18} className="shrink-0" />

      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

export default function SideNav() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`border border-slate-300 bg-white transition-all ${
        collapsed ? "w-[72px]" : "w-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-300 px-3 py-3">
        {!collapsed ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
              EMS
            </div>
            <div className="mt-1 text-xs text-slate-400">Navigation</div>
          </div>
        ) : (
          <div className="w-full text-center text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            EMS
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="ml-2 flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="space-y-2 p-3">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={collapsed}
            active={isActivePath(path, item.href, item.exact)}
          />
        ))}
      </div>
    </aside>
  );
}