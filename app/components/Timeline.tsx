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

/** Width of each rendered cell in seconds. Keeps DOM to ~160 elements for a
 *  13-minute flight while still giving 5-second granularity for click targets. */
const BUCKET_SECONDS = 5;

interface Cell {
  severity: keyof typeof SEVERITY_HEX | null;
  findingId: string | null;
  /** Start second of this bucket (for tooltip). */
  bucketStart: number;
}

export default function Timeline({ findings, totalSeconds, selectedId, onSelect }: Props) {
  const total = Math.max(60, Math.floor(totalSeconds));
  const numBuckets = Math.ceil(total / BUCKET_SECONDS);

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = Array.from({ length: numBuckets }, (_, i) => ({
      severity: null,
      findingId: null,
      bucketStart: i * BUCKET_SECONDS,
    }));

    findings.forEach((f) => {
      if (f.severity === "no_action") return;
      // Spread the finding across its ±4 s neighbourhood, mapped to buckets.
      const startBucket = Math.max(0, Math.floor((f.timestamp_seconds - 4) / BUCKET_SECONDS));
      const endBucket = Math.min(numBuckets - 1, Math.floor((f.timestamp_seconds + 4) / BUCKET_SECONDS));
      for (let b = startBucket; b <= endBucket; b++) {
        const cur = out[b];
        if (!cur.severity || severityRank(f.severity) < severityRank(cur.severity)) {
          out[b] = { severity: f.severity, findingId: f.finding_id, bucketStart: b * BUCKET_SECONDS };
        }
      }
    });
    return out;
  }, [findings, numBuckets]);

  const minMarks = useMemo(() => {
    const m: number[] = [];
    for (let s = 0; s <= total; s += 60) m.push(s);
    return m;
  }, [total]);

  const selected = findings.find((f) => f.finding_id === selectedId);
  const scrubPct = selected ? (selected.timestamp_seconds / total) * 100 : 0;

  return (
    <footer className="no-print bg-surface-panel border border-border rounded-lg flex flex-col overflow-hidden">
      <div className="px-3 pt-1.5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.1em] text-slate-600 font-semibold">
            Timeline
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            {Math.floor(total / 60)} min · 1 col / {BUCKET_SECONDS} sec · {findings.filter((f) => f.severity !== "no_action").length} actionable
          </span>
        </div>
        {selected && (
          <span className="font-mono text-[10px] text-slate-600">
            <span className="text-slate-400">selected </span>
            {selected.finding_id} · {formatT(selected.timestamp_seconds)}
          </span>
        )}
      </div>

      <div className="relative px-3 pt-1 pb-1 h-6">
        {selected && (
          <div
            className="absolute top-0 bottom-0 w-px bg-slate-900 z-10"
            style={{ left: `calc(0.75rem + (100% - 1.5rem) * ${scrubPct} / 100)` }}
          >
            <div
              className="absolute -top-0.5 -translate-x-1/2 h-3 px-1 rounded-sm font-mono text-[9px] text-white inline-flex items-center"
              style={{ background: SEVERITY_HEX[selected.severity] }}
            >
              {formatT(selected.timestamp_seconds)}
            </div>
          </div>
        )}

        <div className="absolute inset-x-3 inset-y-1 flex">
          {cells.map((c, i) => (
            <button
              key={i}
              type="button"
              onClick={() => c.findingId && onSelect(c.findingId)}
              className="tt h-full"
              style={{
                width: `${100 / numBuckets}%`,
                background: c.severity ? SEVERITY_HEX[c.severity] : "#F1F5F9",
                opacity: c.severity
                  ? selected && selected.finding_id === c.findingId ? 1 : 0.92
                  : 1,
              }}
            >
              {c.severity && (
                <span className="tt-pop">
                  {`${formatT(c.bucketStart)}–${formatT(c.bucketStart + BUCKET_SECONDS)} · ${SEVERITY_LABEL[c.severity].toUpperCase()} · ${c.findingId}`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-4 px-3 pb-1 pointer-events-none">
        {minMarks.map((s) => (
          <span
            key={s}
            className="absolute top-0 text-[9px] font-mono text-slate-400 leading-none"
            style={{ left: `calc(${(s / total) * 100}% * (100% - 1.5rem) / 100% + 0.75rem)`, transform: "translateX(-50%)" }}
          >
            {String(Math.floor(s / 60)).padStart(2, "0")}:00
          </span>
        ))}
      </div>
    </footer>
  );
}

function formatT(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
