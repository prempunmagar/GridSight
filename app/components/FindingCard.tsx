"use client";

import type { Finding } from "@/types/findings";
import { SEVERITY_HEX, SEVERITY_LABEL } from "@/lib/severity";
import { findingTitle, formatLatLon, formatTimestamp } from "@/lib/format";
import ConfidenceDots from "./ConfidenceDots";

interface Props {
  finding: Finding;
  selected: boolean;
  voltageClass: string;
  onSelect: () => void;
}

export default function FindingCard({ finding, selected, voltageClass, onSelect }: Props) {
  const color = SEVERITY_HEX[finding.severity];
  const title = findingTitle(finding.specific_defects, finding.component_type, finding.condition);
  const towerLine = finding.component_type.replace("_", " ");

  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "card-hover w-full text-left bg-surface-panel border rounded-md relative overflow-hidden " +
        (selected ? "border-brand ring-1 ring-brand" : "border-border")
      }
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: color }}
      />
      <div className="pl-3.5 pr-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color }}>
            {SEVERITY_LABEL[finding.severity]}
          </span>
          <span className="font-mono text-[10px] text-ink-tertiary">{finding.finding_id}</span>
        </div>

        <div className="mt-1 text-[14px] font-medium text-ink-primary leading-snug line-clamp-2">
          {title}
        </div>

        <div className="mt-1.5 font-mono text-[11px] text-ink-secondary leading-snug">
          {formatTimestamp(finding.timestamp_seconds)} · {formatLatLon(finding.gps_lat, finding.gps_lon)} · {voltageClass}
          <br />
          {towerLine}
        </div>

        <div className="mt-2 flex items-center justify-between">
          {finding.nerc_citation ? (
            <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded px-1.5 py-0.5">
              {finding.nerc_citation}
            </span>
          ) : (
            <span />
          )}
          <ConfidenceDots
            confidence={finding.combined_confidence}
            color={color}
            detail={`Marengo ${finding.marengo_score.toFixed(2)} · Pegasus ${finding.pegasus_confidence}`}
          />
        </div>
      </div>
    </button>
  );
}
