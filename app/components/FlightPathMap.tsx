"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import type { Finding } from "@/types/findings";
import type { FlightPath } from "@/types/telemetry";
import { SEVERITY_COLOR } from "@/lib/severity";

interface Props {
  findings: Finding[];
  flightPath: FlightPath;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    map.fitBounds(coords as [number, number][], { padding: [40, 40] });
  }, [map, coords]);
  return null;
}

export default function FlightPathMap({ findings, flightPath, selectedId, onSelect }: Props) {
  const center = useMemo<[number, number]>(
    () => [flightPath.start_lat, flightPath.start_lon],
    [flightPath.start_lat, flightPath.start_lon]
  );

  return (
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Polyline
        positions={flightPath.coordinates}
        pathOptions={{ color: "#0369A1", weight: 3, opacity: 0.6 }}
      />
      {findings.map((f) => {
        const isSelected = f.finding_id === selectedId;
        const color = SEVERITY_COLOR[f.severity];
        return (
          <CircleMarker
            key={f.finding_id}
            center={[f.gps_lat, f.gps_lon]}
            radius={isSelected ? 12 : 8}
            pathOptions={{
              color: "#FFFFFF",
              weight: 2,
              fillColor: color,
              fillOpacity: f.severity === "no_action" ? 0.4 : 0.95,
            }}
            eventHandlers={{ click: () => onSelect(f.finding_id) }}
          />
        );
      })}
      <FitBounds coords={flightPath.coordinates} />
    </MapContainer>
  );
}
