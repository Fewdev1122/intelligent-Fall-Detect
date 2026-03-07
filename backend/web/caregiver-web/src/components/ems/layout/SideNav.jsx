"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavItem({ href, label }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`block rounded-xl px-3 py-2 text-sm border ${
        active ? "bg-blue-50 border-blue-200 text-blue-900" : "border-transparent hover:bg-gray-50 text-gray-700"
      }`}
    >
      {label}
    </Link>
  );
}

export default function SideNav() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <div className="text-xs font-semibold text-gray-500 px-2 mb-2">EMS</div>
      <div className="space-y-1">
        <NavItem href="/ems" label="Dashboard" />
        <NavItem href="/ems/incidents" label="Incidents" />
        <NavItem href="/ems/my-cases" label="Incidents Recipe" />
      </div>
    </div>
  );
}