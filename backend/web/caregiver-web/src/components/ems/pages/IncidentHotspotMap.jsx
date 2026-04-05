"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function getLatLng(it, index) {
  const candidates = [
    [it?.lat, it?.lng],
    [it?.latitude, it?.longitude],
    [it?.home?.lat, it?.home?.lng],
    [it?.home?.latitude, it?.home?.longitude],
    [it?.location?.lat, it?.location?.lng],
    [it?.location?.latitude, it?.location?.longitude],
  ];

  for (const pair of candidates) {
    const [lat, lng] = pair;
    if (typeof lat === "number" && typeof lng === "number") {
      return { lat, lng, synthetic: false };
    }
  }

  const baseLat = 19.9103;
  const baseLng = 99.8406;

  return {
    lat: baseLat + ((index % 5) - 2) * 0.008,
    lng: baseLng + ((index % 7) - 3) * 0.008,
    synthetic: true,
  };
}

function buildMapPoints(incidents = []) {
  return incidents.slice(0, 100).map((it, index) => {
    const { lat, lng, synthetic } = getLatLng(it, index);

    return {
      id: it.id,
      patient: it.patient?.name || it.patientInfo?.name || "Unknown",
      address: it.home?.address || it.locationText || "Unknown location",
      status: String(it.status || "NEW").toUpperCase(),
      severity: String(it.severity || "MED").toUpperCase(),
      lat,
      lng,
      synthetic,
    };
  });
}

function buildHotspotCircles(points = []) {
  const bucket = new Map();

  for (const p of points) {
    const latKey = p.lat.toFixed(3);
    const lngKey = p.lng.toFixed(3);
    const key = `${latKey}:${lngKey}`;

    const current = bucket.get(key) || {
      lat: 0,
      lng: 0,
      count: 0,
    };

    current.lat += p.lat;
    current.lng += p.lng;
    current.count += 1;

    bucket.set(key, current);
  }

  return [...bucket.values()]
    .filter((x) => x.count >= 2)
    .map((x) => ({
      lat: x.lat / x.count,
      lng: x.lng / x.count,
      count: x.count,
      radius: 150 + x.count * 90,
    }));
}

function getMarkerColor(status) {
  if (status === "NEW") return "#dc2626";
  if (status === "DISPATCHED") return "#2563eb";
  if (status === "ARRIVED") return "#7c3aed";
  if (status === "COMPLETED") return "#059669";
  return "#475569";
}

export default function IncidentHotspotMap({ incidents = [] }) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);

  const points = useMemo(() => buildMapPoints(incidents), [incidents]);
  const hotspots = useMemo(() => buildHotspotCircles(points), [points]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletMapRef.current) return;

    const firstPoint = points[0];
    const defaultCenter = firstPoint
      ? [firstPoint.lat, firstPoint.lng]
      : [19.9103, 99.8406];

    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: true,
    }).setView(defaultCenter, 12);

    leafletMapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [points]);

  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map) return;

    const layers = [];

    hotspots.forEach((h) => {
      const circle = L.circle([h.lat, h.lng], {
        radius: h.radius,
        color: "#dc2626",
        weight: 1,
        fillColor: "#dc2626",
        fillOpacity: 0.12,
      }).addTo(map);

      layers.push(circle);
    });

    points.forEach((p) => {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: getMarkerColor(p.status),
        fillOpacity: 1,
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width:220px;font-family:Arial,sans-serif;">
          <div style="font-size:14px;font-weight:700;color:#0f172a;">${p.patient}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">${p.address}</div>
          <div style="margin-top:8px;font-size:12px;font-weight:600;color:#334155;">Status: ${p.status}</div>
          <div style="margin-top:4px;font-size:12px;font-weight:600;color:#334155;">Severity: ${p.severity}</div>
        </div>
      `);

      layers.push(marker);
    });

    if (points.length > 0) {
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      layers.forEach((layer) => {
        if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    };
  }, [points, hotspots]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden border border-slate-300 bg-white">
        <div ref={mapRef} className="h-[420px] w-full" />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <div className="inline-flex items-center gap-2 border border-rose-300 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700">
          <span className="h-2.5 w-2.5 bg-rose-600" />
          New incident
        </div>

        <div className="inline-flex items-center gap-2 border border-blue-300 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">
          <span className="h-2.5 w-2.5 bg-blue-600" />
          Dispatched
        </div>

        <div className="inline-flex items-center gap-2 border border-violet-300 bg-violet-50 px-3 py-1.5 font-semibold text-violet-700">
          <span className="h-2.5 w-2.5 bg-violet-600" />
          Arrived
        </div>

        <div className="inline-flex items-center gap-2 border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
          <span className="h-2.5 w-2.5 bg-emerald-600" />
          Completed
        </div>

        <div className="inline-flex items-center gap-2 border border-slate-300 bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
          <span className="h-3.5 w-3.5 border border-slate-400 bg-red-200" />
          Hotspot area
        </div>
      </div>
    </div>
  );
}