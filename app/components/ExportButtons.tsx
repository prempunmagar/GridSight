"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";

type Variant = "outline" | "primary";
type Placement = "below" | "above";

interface Props {
  variant?: Variant;
  placement?: Placement;
}

export default function ExportButtons({
  variant = "outline",
  placement = "below",
}: Props = {}) {
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
    if (action === "csv") triggerDownload("/data/findings.csv", "gridsight-findings.csv");
    else if (action === "geojson") triggerDownload("/data/findings.geojson", "gridsight-findings.geojson");
    else window.print();
  }

  const triggerClass =
    variant === "primary"
      ? "h-9 w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-black transition-colors"
      : "h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle";

  const menuPositionClass =
    placement === "above"
      ? "bottom-full mb-1 right-0"
      : "top-9 right-0";

  return (
    <div className={(variant === "primary" ? "relative w-full " : "relative ") + "no-print"} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClass}
      >
        <Download size={13} />
        Export
        <ChevronDown size={13} className={variant === "primary" ? "opacity-80" : "text-ink-tertiary"} />
      </button>
      {open && (
        <div className={`absolute ${menuPositionClass} w-48 bg-surface-panel border border-border rounded-md shadow-card-hover py-1 z-30`}>
          <Item label="CSV" sub="Findings table" onClick={() => handleAction("csv")} />
          <Item label="GeoJSON" sub="Pins + corridor" onClick={() => handleAction("geojson")} />
          <Item label="PDF Report" sub="Print full inspection" onClick={() => handleAction("pdf")} />
        </div>
      )}
    </div>
  );
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
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
