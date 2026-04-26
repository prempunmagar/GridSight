"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown } from "lucide-react";

const ITEMS = [
  { href: "/docs/tech", label: "Technical Documentation", sub: "TwelveLabs integration, architecture" },
  { href: "/docs/validation", label: "Validation Report", sub: "F1, confusion matrix, FP/FN analysis" },
  { href: "/docs/impact", label: "Operational Impact Brief", sub: "ROI, deployment cost, payback" },
];

export default function DocsMenu() {
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
    <div className="relative no-print" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle"
      >
        <BookOpen size={13} />
        Reports
        <ChevronDown size={13} className="text-ink-tertiary" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-64 bg-surface-panel border border-border rounded-md shadow-card-hover py-1 z-30">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-1.5 hover:bg-surface-subtle"
            >
              <div className="text-[12px] font-medium text-ink-primary">{it.label}</div>
              <div className="text-[11px] text-ink-tertiary">{it.sub}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
