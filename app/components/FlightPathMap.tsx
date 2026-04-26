"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Crosshair, Minus, Plus, TreePine, Zap } from "lucide-react";
import "leaflet/dist/leaflet.css";

import type { Finding } from "@/types/findings";
import type { FlightPath } from "@/types/telemetry";
import { SEVERITY_HEX, SEVERITY_LABEL } from "@/lib/severity";

interface Props {
  findings: Finding[];
  flightPath: FlightPath;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showIntact: boolean;
}

function pinIcon(finding: Finding, isSelected: boolean) {
  const color = SEVERITY_HEX[finding.severity];
  const size = finding.severity === "no_action" ? 14 : 28;
  const glyph =
    finding.class === "vegetation_encroachment" ? (
      <TreePine size={13} color="#fff" strokeWidth={2.25} />
    ) : (
      <Zap size={13} color="#fff" strokeWidth={2.25} />
    );

  const halo =
    finding.severity === "critical"
      ? `<div style="position:absolute;left:50%;top:50%;width:60px;height:60px;margin-left:-30px;margin-top:-30px;background:rgba(220,38,38,0.10);border-radius:50%;pointer-events:none;"></div>`
      : "";

  const pulse = isSelected
    ? `<div class="pin-pulse-ring" style="position:absolute;left:50%;top:50%;width:${size}px;height:${size}px;margin-left:-${size / 2}px;margin-top:-${size / 2}px;border-radius:50%;border:2px solid ${color};box-sizing:border-box;"></div>`
    : "";

  const inner =
    finding.severity === "no_action"
      ? `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;background:${color};opacity:0.5;box-shadow:0 2px 4px rgba(15,23,42,0.18);"></div>`
      : `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid #fff;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 4px rgba(15,23,42,0.18);">${renderToStaticMarkup(glyph)}</div>`;

  return divIcon({
    html: `<div style="position:relative;width:${size}px;height:${size}px;">${halo}${pulse}${inner}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    const bounds = new LatLngBounds(coords as [number, number][]);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, coords]);
  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <>
      <div className="absolute top-4 left-4 z-[400] flex flex-col bg-surface-panel border border-border rounded-md shadow-card overflow-hidden">
        <button
          type="button"
          onClick={() => map.zoomIn()}
          className="h-8 w-8 inline-flex items-center justify-center text-ink-secondary hover:bg-surface-subtle border-b border-border"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => map.zoomOut()}
          className="h-8 w-8 inline-flex items-center justify-center text-ink-secondary hover:bg-surface-subtle"
        >
          <Minus size={14} />
        </button>
      </div>
      <FitButton />
    </>
  );
}

function FitButton() {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => {
        const polyline = (map as unknown as { _polylineForFit?: [number, number][] })._polylineForFit;
        if (polyline && polyline.length > 0) {
          map.fitBounds(new LatLngBounds(polyline as [number, number][]), { padding: [40, 40] });
        }
      }}
      className="absolute top-[calc(1rem+72px)] left-4 z-[400] h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[11px] font-medium text-ink-primary hover:bg-surface-subtle shadow-card"
    >
      <Crosshair size={12} /> Fit corridor
    </button>
  );
}

function PolylineRef({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    (map as unknown as { _polylineForFit?: [number, number][] })._polylineForFit = coords;
  }, [map, coords]);
  return null;
}

export default function FlightPathMap({ findings, flightPath, selectedId, onSelect, showIntact }: Props) {
  const center = useMemo<[number, number]>(
    () => [flightPath.start_lat, flightPath.start_lon],
    [flightPath.start_lat, flightPath.start_lon]
  );

  const visible = useMemo(
    () => (showIntact ? findings : findings.filter((f) => f.severity !== "no_action")),
    [findings, showIntact]
  );

  return (
    <section className="no-print flex-1 basis-0 min-w-[320px] bg-surface-panel border border-border rounded-lg relative overflow-hidden h-full">
      <MapContainer center={center} zoom={13} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; CARTO &copy; OSM'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <Polyline
          positions={flightPath.coordinates}
          pathOptions={{ color: "#0369A1", weight: 3, opacity: 0.6 }}
        />
        <PolylineRef coords={flightPath.coordinates} />
        {visible.map((f) => (
          <Marker
            key={`${f.finding_id}-${f.finding_id === selectedId ? "sel" : "idle"}`}
            position={[f.gps_lat, f.gps_lon]}
            icon={pinIcon(f, f.finding_id === selectedId)}
            eventHandlers={{ click: () => onSelect(f.finding_id) }}
          />
        ))}
        <FitBounds coords={flightPath.coordinates} />
        <ZoomControls />
      </MapContainer>

      <div className="absolute bottom-3 right-4 z-[400] bg-surface-panel border border-border rounded-md shadow-card px-3 py-2">
        <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1.5 font-semibold">
          Severity
        </div>
        <div className="flex items-center gap-3">
          {(["critical", "high", "moderate", "low"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
              <span className="block rounded-full" style={{ width: 8, height: 8, background: SEVERITY_HEX[s] }} />
              <span>{SEVERITY_LABEL[s]}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
