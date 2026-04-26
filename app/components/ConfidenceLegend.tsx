"use client";

import { SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_ORDER } from "@/lib/severity";

export default function ConfidenceLegend() {
  return (
    <div className="absolute right-3 bottom-3 z-[400] bg-panel/95 backdrop-blur-sm border border-border-default rounded p-2 text-[11px] shadow-sm">
      <div className="text-text-tertiary uppercase tracking-wider text-[9px] mb-1">Severity</div>
      <div className="space-y-0.5">
        {SEVERITY_ORDER.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
            <span className="text-text-primary">{SEVERITY_LABEL[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
