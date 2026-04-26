"use client";

import { useMemo } from "react";

import type { Finding } from "@/types/findings";
import { SEVERITY_HEX, SEVERITY_LABEL, severityRank } from "@/lib/severity";

interface Props {
  findings: Finding[];
  totalSeconds: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface Cell {
  severity: keyof typeof SEVERITY_HEX | null;
  findingId: string | null;
}

export default function Timeline({ findings, totalSeconds, selectedId, onSelect }: Props) {
  const total = Math.max(60, Math.floor(totalSeconds));

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = Array.from({ length: total }, () => ({ severity: null, findingId: null }));
    findings.forEach((f) => {
      if (f.severity === "no_action") return;
      const start = Math.max(0, Math.floor(f.timestamp_seconds - 4));
      const end = Math.min(total - 1, Math.floor(f.timestamp_seconds + 4));
      for (let s = start; s <= end; s++) {
        const cur = out[s];
        if (!cur.severity || severityRank(f.severity) < severityRank(cur.severity)) {
          out[s] = { severity: f.severity, findingId: f.finding_id };
        }
      }
    });
    return out;
  }, [findings, total]);

  const minMarks = useMemo(() => {
    const m: number[] = [];
    for (let s = 0; s <= total; s += 60) m.push(s);
    return m;
  }, [total]);

  const selected = findings.find((f) => f.finding_id === selectedId);
  const scrubPct = selected ? (selected.timestamp_seconds / total) * 100 : 0;

  return (
    <footer className="h-14 bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden">
      <div className="px-3 pt-1.5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-secondary font-semibold">
            Timeline
          </span>
          <span className="font-mono text-[10px] text-ink-tertiary">
            {Math.floor(total / 60)} min · 1 col / sec · {findings.filter((f) => f.severity !== "no_action").length} actionable
          </span>
        </div>
        {selected && (
          <span className="font-mono text-[10px] text-ink-secondary">
            <span className="text-ink-tertiary">selected </span>
            {selected.finding_id} · {formatT(selected.timestamp_seconds)}
          </span>
        )}
      </div>

      <div className="relative flex-1 px-3 pb-1.5">
        {selected && (
          <div
            className="absolute top-0 bottom-1.5 w-px bg-ink-primary z-10"
            style={{ left: `calc(0.75rem + ${scrubPct}% - ${scrubPct}% * 24px / 100)` }}
          >
            <div
              className="absolute -top-0.5 -translate-x-1/2 h-2 px-1 rounded-sm font-mono text-[9px] text-white inline-flex items-center"
              style={{ background: SEVERITY_HEX[selected.severity] }}
            >
              {formatT(selected.timestamp_seconds)}
            </div>
          </div>
        )}

        <div className="absolute inset-x-3 bottom-1.5 top-1 flex">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => c.findingId && onSelect(c.findingId)}
              className="tt h-full"
              style={{
                width: `${100 / total}%`,
                background: c.severity ? SEVERITY_HEX[c.severity] : "var(--color-surface-subtle)",
                opacity: c.severity ? (selected && selected.finding_id === c.findingId ? 1 : 0.92) : 1,
              }}
            >
              {c.severity && (
                <span className="tt-pop">
                  {`${formatT(i)} · ${SEVERITY_LABEL[c.severity].toUpperCase()} · ${c.findingId}`}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="absolute inset-x-3 bottom-0 h-2 pointer-events-none">
          {minMarks.map((s) => (
            <span
              key={s}
              className="absolute top-0 text-[9px] font-mono text-ink-tertiary leading-none"
              style={{ left: `${(s / total) * 100}%`, transform: "translateX(-50%)" }}
            >
              {String(Math.floor(s / 60)).padStart(2, "0")}:00
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

function formatT(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
