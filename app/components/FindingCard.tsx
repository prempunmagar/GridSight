"use client";

import { Check, Flag } from "lucide-react";

import type { Finding } from "@/types/findings";
import { SEVERITY_HEX, SEVERITY_LABEL } from "@/lib/severity";
import { findingTitle, formatLatLon, formatTimestamp } from "@/lib/format";
import ConfidenceDots from "./ConfidenceDots";

interface Props {
  finding: Finding;
  selected: boolean;
  voltageClass: string;
  isReviewed: boolean;
  isFlagged: boolean;
  onSelect: () => void;
}

export default function FindingCard({
  finding,
  selected,
  voltageClass,
  isReviewed,
  isFlagged,
  onSelect,
}: Props) {
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
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-[0.1em] uppercase" style={{ color }}>
            {SEVERITY_LABEL[finding.severity]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {isFlagged && (
              <span
                title="Flagged for re-inspection"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sev-high/15 text-sev-high"
              >
                <Flag size={9} strokeWidth={2.5} />
              </span>
            )}
            {isReviewed && (
              <span
                title="Marked reviewed"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sev-intact/15 text-sev-intact"
              >
                <Check size={10} strokeWidth={2.75} />
              </span>
            )}
            <span className="font-mono text-[10px] text-ink-tertiary">{finding.finding_id}</span>
          </span>
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
