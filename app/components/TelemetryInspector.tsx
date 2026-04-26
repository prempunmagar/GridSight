"use client";

import type { Finding } from "@/types/findings";
import { formatLatLon, formatTimestamp, formatHeading } from "@/lib/format";

interface Props {
  finding: Finding | null;
  voltageClass: string;
}

export default function TelemetryInspector({ finding, voltageClass }: Props) {
  if (!finding) {
    return (
      <div className="text-xs text-text-tertiary px-3 py-4">
        Select a finding to inspect drone state at that moment.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2 px-3 py-3 bg-subtle rounded-md font-mono text-[11px] leading-tight">
      <div>
        <div className="text-text-tertiary">timestamp</div>
        <div className="text-text-primary">{formatTimestamp(finding.timestamp_seconds)}</div>
      </div>
      <div>
        <div className="text-text-tertiary">gps</div>
        <div className="text-text-primary">{formatLatLon(finding.gps_lat, finding.gps_lon)}</div>
      </div>
      <div>
        <div className="text-text-tertiary">altitude</div>
        <div className="text-text-primary">{finding.altitude_m_agl.toFixed(1)} m AGL</div>
      </div>
      <div>
        <div className="text-text-tertiary">heading</div>
        <div className="text-text-primary">{formatHeading(finding.heading_deg)}</div>
      </div>
      <div>
        <div className="text-text-tertiary">speed</div>
        <div className="text-text-primary">{finding.ground_speed_mps.toFixed(1)} m/s</div>
      </div>
      <div>
        <div className="text-text-tertiary">voltage</div>
        <div className="text-text-primary">{voltageClass}</div>
      </div>
    </div>
  );
}
