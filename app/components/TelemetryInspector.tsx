"use client";

import type { Finding } from "@/types/findings";
import { formatLatLon, formatTimestamp, formatHeading } from "@/lib/format";

export default function TelemetryInspector({
  finding,
  voltageClass,
}: {
  finding: Finding;
  voltageClass: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-x-4 bg-surface-subtle border border-border rounded-md px-3 py-2.5 font-mono text-[12px] text-ink-primary leading-tight">
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans">
          Time
        </div>
        <div>{formatTimestamp(finding.timestamp_seconds)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans">
          Position
        </div>
        <div>{formatLatLon(finding.gps_lat, finding.gps_lon).split(", ")[0]}</div>
        <div>{formatLatLon(finding.gps_lat, finding.gps_lon).split(", ")[1]}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-[0.08em] text-ink-tertiary mb-1 font-sans">
          Drone
        </div>
        <div>AGL {finding.altitude_m_agl.toFixed(0)} m</div>
        <div>Heading {formatHeading(finding.heading_deg)}</div>
      </div>
    </div>
  );
}
