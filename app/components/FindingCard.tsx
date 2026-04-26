"use client";

import type { Finding } from "@/types/findings";
import { SEVERITY_COLOR, SEVERITY_LABEL, confidenceDots } from "@/lib/severity";
import { findingTitle, formatLatLon, formatTimestamp } from "@/lib/format";

interface Props {
  finding: Finding;
  selected: boolean;
  voltageClass: string;
  onSelect: () => void;
}

export default function FindingCard({ finding, selected, voltageClass, onSelect }: Props) {
  const color = SEVERITY_COLOR[finding.severity];
  const title = findingTitle(finding.specific_defects, finding.component_type, finding.condition);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left bg-panel border rounded relative overflow-hidden transition-all
        ${selected ? "border-brand ring-1 ring-brand" : "border-border-default hover:shadow-sm"}`}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: color }}
      />
      <div className="pl-4 pr-3 py-3">
        <div className="text-[10px] font-semibold tracking-wider uppercase" style={{ color }}>
          {SEVERITY_LABEL[finding.severity]}
        </div>
        <div className="text-sm font-medium text-text-primary leading-snug mt-0.5 line-clamp-2">
          {title}
        </div>
        <div className="text-xs text-text-secondary mt-0.5">
          {finding.component_type.replace("_", " ")}
        </div>
        <div className="font-mono text-[11px] text-text-secondary mt-2 leading-tight">
          {formatTimestamp(finding.timestamp_seconds)} · {formatLatLon(finding.gps_lat, finding.gps_lon)} · {voltageClass}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="font-mono text-[10px] text-text-tertiary">
            {finding.nerc_citation ?? ""}
          </span>
          <span
            className="font-mono text-xs"
            style={{
              color:
                finding.combined_confidence === "high"
                  ? "var(--color-text-primary)"
                  : finding.combined_confidence === "medium"
                  ? "var(--color-text-secondary)"
                  : "var(--color-text-tertiary)",
            }}
            title={`Marengo ${finding.marengo_score.toFixed(2)} · Pegasus ${finding.pegasus_confidence}`}
          >
            {confidenceDots(finding.combined_confidence)} {finding.combined_confidence}
          </span>
        </div>
      </div>
    </button>
  );
}
