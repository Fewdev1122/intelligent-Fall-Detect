"use client";

export default function TopBar({ title, subtitle }) {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
        <div>
          <div className="text-lg font-extrabold text-gray-900">{title}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>

        <div className="ml-auto flex items-center gap-2">
         
        </div>
      </div>
    </div>
  );
}