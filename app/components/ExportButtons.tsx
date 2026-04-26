"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

export default function ExportButtons() {
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

  function handleAction(action: "csv" | "geojson" | "pdf") {
    setOpen(false);
    if (action === "csv") triggerDownload("/data/findings.csv");
    else if (action === "geojson") triggerDownload("/data/findings.geojson");
    else window.print();
  }

  return (
    <div className="relative no-print" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle"
      >
        <Download size={13} />
        Export
        <ChevronDown size={13} className="text-ink-tertiary" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 w-48 bg-surface-panel border border-border rounded-md shadow-card-hover py-1 z-30">
          <Item label="CSV" sub="Findings table" onClick={() => handleAction("csv")} />
          <Item label="GeoJSON" sub="Pins + corridor" onClick={() => handleAction("geojson")} />
          <Item label="PDF Report" sub="Print full inspection" onClick={() => handleAction("pdf")} />
        </div>
      )}
    </div>
  );
}

function triggerDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Item({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 hover:bg-surface-subtle"
    >
      <div className="text-[12px] font-medium text-ink-primary">{label}</div>
      <div className="text-[11px] text-ink-tertiary">{sub}</div>
    </button>
  );
}
