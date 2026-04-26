"use client";

import { useMemo } from "react";

import type { Finding, Severity } from "@/types/findings";
import { severityRank } from "@/lib/severity";
import FilterChips, { type FilterValue } from "./FilterChips";
import FindingCard from "./FindingCard";
import SortDropdown, { type SortKey } from "./SortDropdown";

interface Props {
  findings: Finding[];
  selectedId: string | null;
  voltageClass: string;
  onSelect: (id: string) => void;
  filters: Set<FilterValue>;
  setFilters: (next: Set<FilterValue>) => void;
  sort: SortKey;
  setSort: (next: SortKey) => void;
  showIntact: boolean;
  setShowIntact: (next: boolean) => void;
  width: number;
}

export default function FindingsList({
  findings,
  selectedId,
  voltageClass,
  onSelect,
  filters,
  setFilters,
  sort,
  setSort,
  showIntact,
  setShowIntact,
  width,
}: Props) {
  const actionable = useMemo(() => findings.filter((f) => f.severity !== "no_action"), [findings]);
  const intact = useMemo(() => findings.filter((f) => f.severity === "no_action"), [findings]);

  const counts = useMemo(() => {
    const o: Record<Severity, number> = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      no_action: 0,
    };
    findings.forEach((f) => {
      o[f.severity] += 1;
    });
    return o;
  }, [findings]);

  const visible = useMemo(() => {
    let arr = [...actionable];
    if (!filters.has("all")) {
      arr = arr.filter((f) => filters.has(f.severity as FilterValue));
    }
    arr.sort((a, b) => {
      switch (sort) {
        case "severity":
          return (
            severityRank(a.severity) - severityRank(b.severity) ||
            a.timestamp_seconds - b.timestamp_seconds
          );
        case "timestamp":
          return a.timestamp_seconds - b.timestamp_seconds;
        case "confidence": {
          const order = { high: 0, medium: 1, low: 2 };
          return order[a.combined_confidence] - order[b.combined_confidence];
        }
        case "class":
          return a.class.localeCompare(b.class) || severityRank(a.severity) - severityRank(b.severity);
      }
    });
    return arr;
  }, [actionable, filters, sort]);

  return (
    <aside
      style={{ width }}
      className="shrink-0 bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden h-full"
    >
      <div className="px-4 pt-4 pb-3 border-b border-border bg-surface-panel">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[12px] font-semibold tracking-[0.08em] uppercase text-ink-secondary">
            Findings
          </h2>
          <span className="font-mono text-[11px] text-ink-tertiary">
            {visible.length} / {actionable.length}
          </span>
        </div>

        <FilterChips active={filters} setActive={setFilters} counts={counts} total={actionable.length} />

        <div className="mt-2.5 flex items-center justify-between gap-2">
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        <div className="mt-2 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <span className="relative inline-block w-7 h-4">
              <input
                type="checkbox"
                checked={showIntact}
                onChange={(e) => setShowIntact(e.target.checked)}
                className="sr-only peer"
              />
              <span className="absolute inset-0 rounded-full bg-border peer-checked:bg-sev-intact transition-colors" />
              <span className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform peer-checked:translate-x-3" />
            </span>
            <span className="text-[11px] text-ink-secondary">Show intact assets</span>
          </label>
          {showIntact && (
            <span className="font-mono text-[10px] text-sev-intact">+{intact.length}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll p-3 space-y-2">
        {visible.length === 0 && !showIntact && (
          <div className="text-xs text-ink-tertiary text-center py-12">
            {actionable.length === 0
              ? "No actionable findings"
              : "No findings match these filters"}
          </div>
        )}

        {visible.map((f) => (
          <FindingCard
            key={f.finding_id}
            finding={f}
            selected={f.finding_id === selectedId}
            voltageClass={voltageClass}
            onSelect={() => onSelect(f.finding_id)}
          />
        ))}

        {showIntact &&
          intact.map((f) => (
            <button
              key={f.finding_id}
              type="button"
              onClick={() => onSelect(f.finding_id)}
              className="card-hover w-full text-left border border-border rounded-md bg-surface-subtle px-3 py-2 flex items-center justify-between"
            >
              <div>
                <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-sev-intact">
                  Intact
                </div>
                <div className="text-[12px] text-ink-primary">
                  {f.component_type.replace("_", " ")}
                </div>
                <div className="font-mono text-[10px] text-ink-tertiary">
                  {Math.floor(f.timestamp_seconds / 60).toString().padStart(2, "0")}:
                  {Math.floor(f.timestamp_seconds % 60).toString().padStart(2, "0")} ·{" "}
                  {f.gps_lat.toFixed(4)}°N, {Math.abs(f.gps_lon).toFixed(4)}°W
                </div>
              </div>
            </button>
          ))}
      </div>
    </aside>
  );
}
