"use client";

import { useEffect, useRef, useState } from "react";

function isValidLatLng(value) {
  if (!value) return false;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export default function IncidentRouteMap({ origin, destination }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const directionsServiceRef = useRef(null);

  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const pulseOverlayRef = useRef(null);

  const [routeInfo, setRouteInfo] = useState({
    distanceText: "-",
    durationText: "-",
  });

  const [mapsReady, setMapsReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let tries = 0;

    function waitForGoogle() {
      if (!mounted) return;

      if (window.google?.maps) {
        setMapsReady(true);
        return;
      }

      tries += 1;
      if (tries < 100) {
        setTimeout(waitForGoogle, 150);
      } else {
        console.error("Google Maps API not ready after waiting.");
      }
    }

    waitForGoogle();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (!mapsReady) return;

    if (!isValidLatLng(origin) || !isValidLatLng(destination)) {
      console.error("Invalid origin/destination:", { origin, destination });
      return;
    }

    const google = window.google;
    const originPos = {
      lat: Number(origin.lat),
      lng: Number(origin.lng),
    };
    const destinationPos = {
      lat: Number(destination.lat),
      lng: Number(destination.lng),
    };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center: destinationPos,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    if (!directionsRendererRef.current) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        map: mapInstanceRef.current,
        suppressMarkers: true,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#2563eb",
          strokeOpacity: 0.95,
          strokeWeight: 5,
        },
      });
    }

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    if (!originMarkerRef.current) {
      originMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        title: origin.name || "Hospital",
        label: {
          text: "H",
          color: "#ffffff",
          fontWeight: "700",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 10,
        },
        zIndex: 10,
      });
    }

    originMarkerRef.current.setPosition(originPos);
    originMarkerRef.current.setTitle(origin.name || "Hospital");

    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new google.maps.Marker({
        map: mapInstanceRef.current,
        title: "Incident Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#dc2626",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
          scale: 9,
        },
        zIndex: 20,
      });
    }

    destinationMarkerRef.current.setPosition(destinationPos);

    if (!pulseOverlayRef.current) {
      class PulseOverlay extends google.maps.OverlayView {
        constructor(position) {
          super();
          this.position = position;
          this.container = null;
        }

        onAdd() {
          const div = document.createElement("div");
          div.style.position = "absolute";
          div.style.width = "24px";
          div.style.height = "24px";
          div.style.transform = "translate(-50%, -50%)";
          div.style.pointerEvents = "none";
          div.style.zIndex = "30";

          const dot = document.createElement("div");
          dot.style.position = "absolute";
          dot.style.left = "50%";
          dot.style.top = "50%";
          dot.style.width = "14px";
          dot.style.height = "14px";
          dot.style.borderRadius = "9999px";
          dot.style.background = "#dc2626";
          dot.style.border = "3px solid #ffffff";
          dot.style.transform = "translate(-50%, -50%)";
          dot.style.boxShadow = "0 0 18px rgba(220,38,38,0.45)";

          const ring = document.createElement("div");
          ring.style.position = "absolute";
          ring.style.left = "50%";
          ring.style.top = "50%";
          ring.style.width = "20px";
          ring.style.height = "20px";
          ring.style.borderRadius = "9999px";
          ring.style.border = "2px solid rgba(220,38,38,0.7)";
          ring.style.transform = "translate(-50%, -50%)";
          ring.style.animation = "incidentPulse 1.6s ease-out infinite";

          div.appendChild(ring);
          div.appendChild(dot);

          this.container = div;

          const panes = this.getPanes();
          panes.overlayMouseTarget.appendChild(div);
        }

        draw() {
          if (!this.container) return;
          const projection = this.getProjection();
          if (!projection) return;

          const pixel = projection.fromLatLngToDivPixel(this.position);
          if (!pixel) return;

          this.container.style.left = `${pixel.x}px`;
          this.container.style.top = `${pixel.y}px`;
        }

        onRemove() {
          if (this.container?.parentNode) {
            this.container.parentNode.removeChild(this.container);
          }
          this.container = null;
        }

        setPosition(position) {
          this.position = position;
          this.draw();
        }
      }

      pulseOverlayRef.current = new PulseOverlay(
        new google.maps.LatLng(destinationPos.lat, destinationPos.lng)
      );
      pulseOverlayRef.current.setMap(mapInstanceRef.current);
    } else {
      pulseOverlayRef.current.setPosition(
        new google.maps.LatLng(destinationPos.lat, destinationPos.lng)
      );
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(originPos);
    bounds.extend(destinationPos);
    mapInstanceRef.current.fitBounds(bounds, 80);

    directionsServiceRef.current.route(
      {
        origin: originPos,
        destination: destinationPos,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        console.log("Directions status:", status, result);

        if (status === "OK" && result) {
          directionsRendererRef.current.setDirections(result);

          const leg = result.routes?.[0]?.legs?.[0];
          setRouteInfo({
            distanceText: leg?.distance?.text || "-",
            durationText: leg?.duration?.text || "-",
          });
        } else {
          console.error("Directions error:", status, {
            origin: originPos,
            destination: destinationPos,
          });

          setRouteInfo({
            distanceText: "Route unavailable",
            durationText: "-",
          });

          mapInstanceRef.current.setCenter(destinationPos);
          mapInstanceRef.current.setZoom(15);
        }
      }
    );
  }, [mapsReady, origin, destination]);

  useEffect(() => {
    if (document.getElementById("incident-pulse-style")) return;

    const style = document.createElement("style");
    style.id = "incident-pulse-style";
    style.innerHTML = `
      @keyframes incidentPulse {
        0% {
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.8;
        }
        70% {
          transform: translate(-50%, -50%) scale(3.4);
          opacity: 0;
        }
        100% {
          transform: translate(-50%, -50%) scale(3.4);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }, []);

  useEffect(() => {
    return () => {
      if (originMarkerRef.current) originMarkerRef.current.setMap(null);
      if (destinationMarkerRef.current) destinationMarkerRef.current.setMap(null);
      if (pulseOverlayRef.current) pulseOverlayRef.current.setMap(null);
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
    };
  }, []);

  return (
    <div className="border border-slate-300 bg-white">
      <div className="border-b border-slate-300 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">Route Map</div>

        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="border border-slate-300 bg-slate-50 px-2 py-1">
            From: {origin?.name || "Hospital"}
          </span>
          <span className="border border-slate-300 bg-slate-50 px-2 py-1">
            Distance: {routeInfo.distanceText}
          </span>
          <span className="border border-slate-300 bg-slate-50 px-2 py-1">
            ETA: {routeInfo.durationText}
          </span>
          <span className="border border-red-300 bg-red-50 px-2 py-1 text-red-700">
            Incident point
          </span>
          {!mapsReady && (
            <span className="border border-amber-300 bg-amber-50 px-2 py-1 text-amber-700">
              Loading map API...
            </span>
          )}
        </div>
      </div>

      <div ref={mapRef} className="h-[360px] w-full" />
    </div>
  );
}