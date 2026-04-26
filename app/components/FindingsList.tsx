"use client";

import { useMemo, useState } from "react";

import type { Finding, Severity } from "@/types/findings";
import { SEVERITY_COLOR, SEVERITY_LABEL, SEVERITY_ORDER, severityRank } from "@/lib/severity";
import FindingCard from "./FindingCard";

type SortKey = "severity" | "timestamp" | "confidence" | "class";

const ACTIONABLE: Severity[] = ["critical", "high", "moderate", "low"];

interface Props {
  findings: Finding[];
  selectedId: string | null;
  voltageClass: string;
  onSelect: (id: string) => void;
}

export default function FindingsList({ findings, selectedId, voltageClass, onSelect }: Props) {
  const [activeSeverities, setActiveSeverities] = useState<Set<Severity>>(new Set(ACTIONABLE));
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [showIntact, setShowIntact] = useState(false);

  const counts = useMemo(() => {
    const c = { critical: 0, high: 0, moderate: 0, low: 0, no_action: 0 };
    findings.forEach((f) => { c[f.severity] += 1; });
    return c;
  }, [findings]);

  const visible = useMemo(() => {
    let f = findings.filter((x) =>
      showIntact ? activeSeverities.has(x.severity) || x.severity === "no_action"
                 : activeSeverities.has(x.severity)
    );
    f = [...f].sort((a, b) => {
      switch (sortKey) {
        case "severity":
          return severityRank(a.severity) - severityRank(b.severity);
        case "timestamp":
          return a.timestamp_seconds - b.timestamp_seconds;
        case "confidence": {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.combined_confidence] - order[b.combined_confidence];
        }
        case "class":
          return a.class.localeCompare(b.class);
      }
    });
    return f;
  }, [findings, activeSeverities, sortKey, showIntact]);

  function toggle(s: Severity) {
    const next = new Set(activeSeverities);
    if (next.has(s)) next.delete(s); else next.add(s);
    setActiveSeverities(next);
  }

  return (
    <aside className="w-[380px] shrink-0 border-r border-border-default bg-panel flex flex-col h-full">
      <div className="p-3 border-b border-border-default space-y-2 sticky top-0 bg-panel z-10">
        <div className="flex flex-wrap gap-1.5">
          {ACTIONABLE.map((s) => {
            const active = activeSeverities.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`text-[11px] font-medium px-2 h-6 inline-flex items-center gap-1 rounded-full border transition-colors
                  ${active ? "bg-text-primary text-white border-text-primary" : "bg-panel text-text-secondary border-border-default"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEVERITY_COLOR[s] }} />
                {SEVERITY_LABEL[s]} {counts[s]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <select
            className="text-[11px] border border-border-default rounded h-7 px-1.5 bg-panel text-text-primary"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            <option value="severity">Sort: Severity</option>
            <option value="timestamp">Sort: Timestamp</option>
            <option value="confidence">Sort: Confidence</option>
            <option value="class">Sort: Class</option>
          </select>
          <label className="text-[11px] text-text-secondary inline-flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showIntact} onChange={(e) => setShowIntact(e.target.checked)} />
            Show intact assets ({counts.no_action})
          </label>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {visible.length === 0 ? (
          <div className="text-xs text-text-tertiary text-center py-12">
            {findings.length === 0 ? "No findings to display" : "No findings match these filters"}
          </div>
        ) : (
          visible.map((f) => (
            <FindingCard
              key={f.finding_id}
              finding={f}
              selected={f.finding_id === selectedId}
              voltageClass={voltageClass}
              onSelect={() => onSelect(f.finding_id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
