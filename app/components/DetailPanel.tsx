"use client";

import { Check, FileText, Flag, X } from "lucide-react";

import type { Finding } from "@/types/findings";
import { SEVERITY_HEX, SEVERITY_LABEL, confidencePercent } from "@/lib/severity";
import { findingTitle } from "@/lib/format";
import EvidenceClipPlayer from "./EvidenceClipPlayer";
import ExportButtons from "./ExportButtons";
import TelemetryInspector from "./TelemetryInspector";
import Section from "./Section";
import ConfRow from "./ConfRow";

interface Props {
  finding: Finding | null;
  voltageClass: string;
  isReviewed: boolean;
  isFlagged: boolean;
  onToggleReviewed: () => void;
  onToggleFlagged: () => void;
  onClose: () => void;
}

const REASONING: Record<string, { word: string; bodyByClass: (klass: string) => string }> = {
  critical: {
    word: "Critical",
    bodyByClass: (klass) =>
      klass === "vegetation_encroachment"
        ? "Per NERC FAC-003-4, vegetation inside the Minimum Vegetation Clearance Distance constitutes an active reliability risk. Crew dispatch required."
        : "Visible fracture or missing disk indicates loss of mechanical and dielectric integrity. Immediate inspection recommended.",
  },
  high: {
    word: "High",
    bodyByClass: (klass) =>
      klass === "vegetation_encroachment"
        ? "Encroachment is outside MVCD but inside the management buffer; risk of progression before next inspection cycle."
        : "Defect compromises insulator performance under stress conditions. Schedule corrective maintenance within the cycle.",
  },
  moderate: {
    word: "Moderate",
    bodyByClass: () => "Condition is degraded but not service-affecting. Track and address during routine maintenance.",
  },
  low: {
    word: "Low",
    bodyByClass: () => "Marginal indication. Re-confirm during the next scheduled inspection.",
  },
  no_action: {
    word: "No action",
    bodyByClass: () => "Asset assessed as intact. Recorded for full-inventory completeness.",
  },
};

export default function DetailPanel({
  finding,
  voltageClass,
  isReviewed,
  isFlagged,
  onToggleReviewed,
  onToggleFlagged,
  onClose,
}: Props) {
  if (!finding) return null;

  const sevColor = SEVERITY_HEX[finding.severity];
  const title = findingTitle(finding.specific_defects, finding.component_type, finding.condition);
  const reasoning = REASONING[finding.severity];
  const classLabel =
    finding.class === "insulator_damage"
      ? "Insulator damage"
      : finding.class === "vegetation_encroachment"
      ? "Vegetation encroachment"
      : "Other";

  const componentRows: [string, string][] = [
    ["Component type", finding.component_type.replace("_", " ")],
    ["Condition", finding.condition.charAt(0).toUpperCase() + finding.condition.slice(1)],
    ...(finding.specific_defects.length > 0
      ? ([["Specific defects", finding.specific_defects.join("; ")]] as [string, string][])
      : []),
    ...(finding.vegetation_distance_estimate_ft !== null
      ? ([["Clearance", `${finding.vegetation_distance_estimate_ft} ft (visual estimate)`]] as [string, string][])
      : []),
    ["Voltage class", voltageClass],
  ];

  return (
    <aside
      key={finding.finding_id}
      className="no-print panel-enter flex-1 basis-0 min-w-[340px] bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden shadow-panel h-full"
    >
      <div className="h-14 px-4 flex items-center gap-2 border-b border-border bg-surface-panel">
        <span
          className="h-6 inline-flex items-center px-2 rounded-full text-[10px] font-semibold tracking-[0.1em] uppercase text-white"
          style={{ background: sevColor }}
        >
          {SEVERITY_LABEL[finding.severity]}
        </span>
        <span className="h-6 inline-flex items-center px-2 rounded-full text-[11px] text-ink-secondary bg-surface-subtle border border-border">
          {classLabel}
        </span>
        {isReviewed && (
          <span className="h-6 inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-semibold tracking-[0.05em] uppercase bg-sev-intact/10 text-sev-intact border border-sev-intact/30">
            <Check size={11} /> Reviewed
          </span>
        )}
        {isFlagged && (
          <span className="h-6 inline-flex items-center gap-1 px-2 rounded-full text-[10px] font-semibold tracking-[0.05em] uppercase bg-sev-high/10 text-sev-high border border-sev-high/30">
            <Flag size={11} /> Flagged
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-ink-secondary hover:bg-surface-subtle"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll">
        <EvidenceClipPlayer finding={finding} />

        <div className="px-4 mt-6">
          <TelemetryInspector finding={finding} voltageClass={voltageClass} />
        </div>

        <Section title="What we saw">
          <p className="text-[13px] text-ink-primary leading-relaxed">
            {title}
            {finding.specific_defects.length > 0 && (
              <>
                {" — "}
                {finding.specific_defects.join(", ")}.
              </>
            )}
            {" "}
            Pegasus reports {finding.condition} condition at {voltageClass} ({finding.component_type.replace("_", " ")}).
          </p>
        </Section>

        <Section title="Severity reasoning">
          <div className="border border-border rounded-md p-3 bg-surface-panel">
            <p className="text-[13px] text-ink-primary leading-relaxed">
              <span className="font-semibold" style={{ color: sevColor }}>
                {reasoning.word}
              </span>
              <span className="text-ink-secondary"> — </span>
              {reasoning.bodyByClass(finding.class)}
            </p>
            {finding.nerc_citation && (
              <div className="mt-2.5">
                <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded px-1.5 py-0.5 inline-flex items-center gap-1">
                  <FileText size={10} /> {finding.nerc_citation}
                </span>
              </div>
            )}
          </div>
        </Section>

        <Section title="Component details">
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-3 text-[12px]">
            {componentRows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-tertiary uppercase tracking-[0.06em] text-[10px] pt-0.5">{k}</dt>
                <dd className="text-ink-primary">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Confidence breakdown">
          <div className="space-y-2.5">
            <ConfRow
              label="Marengo similarity"
              value={Math.min(1, finding.marengo_score / 0.25)}
              display={finding.marengo_score.toFixed(2)}
              color={sevColor}
            />
            <ConfRow
              label="Pegasus confidence"
              value={confidencePercent(finding.pegasus_confidence)}
              display={finding.pegasus_confidence}
              color={sevColor}
            />
            <ConfRow
              label="Combined"
              value={confidencePercent(finding.combined_confidence)}
              display={finding.combined_confidence}
              color={sevColor}
            />
          </div>
        </Section>

        <div className="h-2" />
      </div>

      <div className="border-t border-border bg-surface-panel p-3 flex flex-col gap-2 no-print">
        <ExportButtons variant="primary" placement="above" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleReviewed}
            aria-pressed={isReviewed}
            className={
              "flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors " +
              (isReviewed
                ? "border-sev-intact bg-sev-intact/10 text-sev-intact"
                : "border-border bg-surface-panel text-ink-primary hover:bg-surface-subtle")
            }
          >
            <Check size={13} /> {isReviewed ? "Reviewed" : "Mark reviewed"}
          </button>
          <button
            type="button"
            onClick={onToggleFlagged}
            aria-pressed={isFlagged}
            className={
              "flex-1 h-9 inline-flex items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors " +
              (isFlagged
                ? "border-sev-high bg-sev-high/10 text-sev-high"
                : "border-border bg-surface-panel text-ink-primary hover:bg-surface-subtle")
            }
          >
            <Flag size={13} /> {isFlagged ? "Flagged" : "Flag for re-inspection"}
          </button>
        </div>
      </div>
    </aside>
  );
}
