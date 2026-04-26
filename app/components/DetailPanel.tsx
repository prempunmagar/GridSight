"use client";

import type { Finding } from "@/types/findings";
import { SEVERITY_COLOR, SEVERITY_LABEL } from "@/lib/severity";
import { findingTitle } from "@/lib/format";
import EvidenceClipPlayer from "./EvidenceClipPlayer";
import TelemetryInspector from "./TelemetryInspector";

interface Props {
  finding: Finding | null;
  voltageClass: string;
  onClose: () => void;
}

const REASONING: Record<string, string> = {
  critical:
    "Critical — Per the severity rubric (docs/05_DOMAIN_KNOWLEDGE.md §5), this finding indicates loss of mechanical or dielectric integrity, or vegetation within MVCD. Immediate inspection recommended.",
  high:
    "High — Active management threshold per FAC-003-4. Schedule remediation within the operator's standard reliability window.",
  moderate:
    "Moderate — Inside the right-of-way at safe distance, or moderate equipment degradation. Track and re-inspect.",
  low:
    "Low — Minor degradation or vegetation outside the corridor. Logged for trend awareness.",
  no_action:
    "No action — Asset assessed as intact. Recorded for full-inventory completeness.",
};

export default function DetailPanel({ finding, voltageClass, onClose }: Props) {
  if (!finding) return null;

  const sevColor = SEVERITY_COLOR[finding.severity];
  const title = findingTitle(finding.specific_defects, finding.component_type, finding.condition);

  return (
    <aside className="w-[420px] shrink-0 border-l border-border-default bg-panel flex flex-col h-full">
      <div className="h-14 px-4 flex items-center justify-between border-b border-border-default sticky top-0 bg-panel">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded text-white"
            style={{ background: sevColor }}
          >
            {SEVERITY_LABEL[finding.severity]}
          </span>
          <span className="text-xs text-text-secondary">{finding.class.replace("_", " ")}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-text-tertiary hover:text-text-primary text-xl leading-none px-2"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <div className="text-base font-semibold text-text-primary leading-tight">{title}</div>
          <div className="text-xs text-text-secondary mt-1">finding · {finding.finding_id}</div>
        </div>

        <EvidenceClipPlayer finding={finding} />
        <TelemetryInspector finding={finding} voltageClass={voltageClass} />

        <section>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary mb-2">
            Severity reasoning
          </div>
          <p className="text-sm text-text-primary leading-relaxed">{REASONING[finding.severity]}</p>
          {finding.nerc_citation && (
            <span className="inline-block mt-2 font-mono text-[10px] px-2 py-0.5 bg-subtle border border-border-default rounded">
              {finding.nerc_citation}
            </span>
          )}
        </section>

        <section>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary mb-2">
            Component details
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 gap-x-3 text-xs">
            <dt className="text-text-secondary">Component type</dt>
            <dd className="text-text-primary">{finding.component_type.replace("_", " ")}</dd>
            <dt className="text-text-secondary">Condition</dt>
            <dd className="text-text-primary capitalize">{finding.condition}</dd>
            {finding.specific_defects.length > 0 && (
              <>
                <dt className="text-text-secondary">Specific defects</dt>
                <dd className="text-text-primary">{finding.specific_defects.join("; ")}</dd>
              </>
            )}
            {finding.vegetation_distance_estimate_ft !== null && (
              <>
                <dt className="text-text-secondary">Vegetation distance</dt>
                <dd className="text-text-primary">{finding.vegetation_distance_estimate_ft} ft (visual estimate)</dd>
              </>
            )}
            <dt className="text-text-secondary">Voltage class</dt>
            <dd className="text-text-primary">{voltageClass}</dd>
          </dl>
        </section>

        <section>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary mb-2">
            Confidence breakdown
          </div>
          <div className="space-y-2 text-xs font-mono">
            <ConfidenceBar label="Marengo similarity" value={finding.marengo_score} text={finding.marengo_score.toFixed(2)} />
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Pegasus confidence</span>
              <span className="text-text-primary">{finding.pegasus_confidence}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border-default pt-2">
              <span className="text-text-secondary">Combined</span>
              <span className="text-text-primary font-semibold">{finding.combined_confidence}</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}

function ConfidenceBar({ label, value, text }: { label: string; value: number; text: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary">{text}</span>
      </div>
      <div className="h-1.5 bg-subtle rounded overflow-hidden">
        <div
          className="h-full bg-brand"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}
