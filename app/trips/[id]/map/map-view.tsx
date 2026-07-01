"use client";

import { useEffect, useRef, useState } from "react";

export type MapPin = {
  id: string;
  title: string;
  subtitle?: string;
  lat: number;
  lng: number;
} & (
  | { kind: "attraction" }
  | { kind: "plan"; dayIndex: number }
);

// Types are declared globally in types/google.d.ts.
type GMap = NonNullable<
  NonNullable<Window["google"]>["maps"]
> extends { Map: new (...args: never[]) => infer M }
  ? M
  : never;
type GMarker = NonNullable<
  NonNullable<Window["google"]>["maps"]
> extends { Marker: new (...args: never[]) => infer M }
  ? M
  : never;
type GLatLngBounds = {
  extend: (p: { lat: number; lng: number }) => void;
};

interface Filters {
  showAttractions: boolean;
  dayFilter: number | "all";
}

export function MapView({
  apiKey,
  center,
  pins,
}: {
  apiKey: string;
  center: { lat: number; lng: number };
  pins: MapPin[];
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<GMap | null>(null);
  const markersRef = useRef<GMarker[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dayIndices = Array.from(
    new Set(
      pins
        .filter((p): p is Extract<MapPin, { kind: "plan" }> => p.kind === "plan")
        .map((p) => p.dayIndex),
    ),
  ).sort((a, b) => a - b);

  const [filters, setFilters] = useState<Filters>({
    showAttractions: true,
    dayFilter: "all",
  });

  // Load Maps JS SDK once.
  useEffect(() => {
    if (window.google?.maps?.Map) {
      setReady(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      "script[data-tripwise-maps]",
    );
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      existing.addEventListener("error", () =>
        setLoadError("Failed to load Maps JS. Enable Maps JavaScript API on your Cloud project."),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-tripwise-maps", "true");
    script.onload = () => setReady(true);
    script.onerror = () =>
      setLoadError("Failed to load Maps JS. Enable Maps JavaScript API on your Cloud project.");
    document.head.appendChild(script);
  }, [apiKey]);

  // Instantiate map + markers whenever ready or filters change.
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;

    if (!mapInstance.current) {
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: false,
        clickableIcons: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: MAP_STYLE,
      });
    }

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const gmaps = window.google.maps;
    const infoWindow = new gmaps.InfoWindow();

    const filtered = pins.filter((p) => {
      if (p.kind === "attraction") return filters.showAttractions;
      if (p.kind === "plan" && filters.dayFilter !== "all")
        return p.dayIndex === filters.dayFilter;
      return true;
    });

    const bounds: GLatLngBounds = new (
      window as unknown as {
        google: { maps: { LatLngBounds: new () => GLatLngBounds } };
      }
    ).google.maps.LatLngBounds();

    for (const pin of filtered) {
      const isPlan = pin.kind === "plan";
      const marker = new gmaps.Marker({
        position: { lat: pin.lat, lng: pin.lng },
        map: mapInstance.current,
        title: pin.title,
        icon: {
          path: gmaps.SymbolPath?.CIRCLE ?? 0,
          scale: isPlan ? 10 : 7,
          fillColor: isPlan ? "#2d5f4e" : "#c9a961",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="font-family:system-ui;font-size:13px;padding:2px 4px;max-width:220px">
            <div style="font-weight:600;margin-bottom:2px">${escapeHtml(pin.title)}</div>
            ${pin.subtitle ? `<div style="color:#6b6157;font-size:11px">${escapeHtml(pin.subtitle)}</div>` : ""}
          </div>`,
        );
        infoWindow.open({ map: mapInstance.current!, anchor: marker });
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }

    if (filtered.length > 1) {
      mapInstance.current.fitBounds(bounds);
    } else {
      mapInstance.current.setCenter(center);
    }
  }, [ready, pins, filters, center]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={() =>
            setFilters((f) => ({ ...f, showAttractions: !f.showAttractions }))
          }
          className="chip"
          data-selected={filters.showAttractions}
        >
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ background: "#c9a961" }}
          />
          Attractions
        </button>
        <button
          onClick={() => setFilters((f) => ({ ...f, dayFilter: "all" }))}
          className="chip"
          data-selected={filters.dayFilter === "all"}
        >
          <span
            className="inline-block w-2 h-2 rounded-full mr-1"
            style={{ background: "#2d5f4e" }}
          />
          All days
        </button>
        {dayIndices.map((d) => (
          <button
            key={d}
            onClick={() => setFilters((f) => ({ ...f, dayFilter: d }))}
            className="chip"
            data-selected={filters.dayFilter === d}
          >
            Day {d + 1}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="card p-4">
          <div className="status-est status-error mb-1">
            <span className="status-dot" /> Map error
          </div>
          <p className="text-sm text-[color:var(--color-fg-2)]">
            {loadError}
          </p>
        </div>
      )}

      <div
        ref={mapRef}
        className="w-full rounded-[var(--radius)] overflow-hidden border border-[color:var(--color-line)]"
        style={{ height: "600px", background: "var(--color-surface-2)" }}
      />

      <p className="text-xs text-[color:var(--color-muted)]">
        Yellow pins: top Places (attractions/restaurants) near the destination.
        Green pins: items on your day plan. Click any pin for details.
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A subtle premium map style that fits the warm-neutral palette.
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f1ea" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#faf7f2" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3a4a5a" }] },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#d3ccbf" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ede4d3" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#c9dee8" }],
  },
  {
    featureType: "landscape.natural",
    elementType: "geometry",
    stylers: [{ color: "#e5e0d3" }],
  },
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];
