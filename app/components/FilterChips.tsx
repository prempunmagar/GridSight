"use client";

import type { Severity } from "@/types/findings";
import { SEVERITY_HEX, SEVERITY_LABEL } from "@/lib/severity";

const TIERS: Severity[] = ["critical", "high", "moderate", "low"];

export type FilterValue = "all" | Severity;

export default function FilterChips({
  active,
  setActive,
  counts,
  total,
}: {
  active: Set<FilterValue>;
  setActive: (next: Set<FilterValue>) => void;
  counts: Record<Severity, number>;
  total: number;
}) {
  function toggle(k: FilterValue) {
    if (k === "all") {
      setActive(new Set<FilterValue>(["all"]));
      return;
    }
    const next = new Set(active);
    next.delete("all");
    if (next.has(k)) next.delete(k);
    else next.add(k);
    if (next.size === 0) next.add("all");
    setActive(next);
  }

  const items: { k: FilterValue; label: string; n: number; dot: string | null }[] = [
    { k: "all", label: "All", n: total, dot: null },
    ...TIERS.map((s) => ({ k: s, label: SEVERITY_LABEL[s], n: counts[s], dot: SEVERITY_HEX[s] })),
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => {
        const isActive = active.has(it.k);
        return (
          <button
            key={it.k}
            type="button"
            onClick={() => toggle(it.k)}
            className={
              "h-7 inline-flex items-center gap-1.5 px-2 rounded-full text-[11px] font-medium transition-colors " +
              (isActive
                ? "bg-slate-900 text-white border border-slate-900"
                : "bg-surface-panel text-ink-primary border border-border hover:bg-surface-subtle")
            }
          >
            {it.dot && (
              <span
                className="block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: it.dot,
                  outline: isActive ? "1px solid rgba(255,255,255,0.3)" : "none",
                }}
              />
            )}
            <span>{it.label}</span>
            <span className={isActive ? "text-white/70 font-mono" : "text-ink-tertiary font-mono"}>{it.n}</span>
          </button>
        );
      })}
    </div>
  );
}
