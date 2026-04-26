"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type SortKey = "severity" | "timestamp" | "confidence" | "class";

const LABELS: Record<SortKey, string> = {
  severity: "Severity (high → low)",
  timestamp: "Timestamp",
  confidence: "Confidence",
  class: "Class",
};

export default function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (next: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-8 inline-flex items-center justify-between px-2.5 rounded-md border border-border bg-surface-panel text-[12px] text-ink-primary hover:bg-surface-subtle"
      >
        <span className="inline-flex items-center gap-1.5 text-ink-secondary">
          <span className="text-[10px] uppercase tracking-[0.08em]">Sort</span>
          <span className="text-ink-primary">{LABELS[value]}</span>
        </span>
        <ChevronDown size={13} className="text-ink-tertiary" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-9 bg-surface-panel border border-border rounded-md shadow-card-hover py-1 z-20">
          {(Object.entries(LABELS) as [SortKey, string][]).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                onChange(k);
                setOpen(false);
              }}
              className={
                "w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-subtle " +
                (value === k ? "text-brand font-medium" : "text-ink-primary")
              }
            >
              {lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
