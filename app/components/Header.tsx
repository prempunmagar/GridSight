"use client";

import type { RunMetadata } from "@/types/metadata";
import ExportButtons from "./ExportButtons";

export default function Header({ meta }: { meta: RunMetadata | null }) {
  const totals = meta?.findings_by_severity;
  const total = meta?.total_findings ?? 0;
  const critical = totals?.critical ?? 0;
  const durationMin = meta ? Math.round(meta.source_video_duration_seconds / 60) : 0;

  return (
    <header className="h-16 px-6 flex items-center justify-between bg-panel border-b border-border-default no-print">
      <div className="flex items-center gap-6">
        <span className="text-2xl font-semibold tracking-tight text-text-primary">GridSight</span>
        <span className="font-mono text-xs text-text-secondary leading-tight whitespace-pre-line">
          {meta ? `${meta.corridor_description.split("(")[0].trim()}  ·  ${meta.voltage_class}` : "loading…"}
          {meta ? `\n${durationMin} min · ${total} findings` : ""}
          {critical > 0 ? <span className="text-critical font-semibold">{` · ${critical} critical`}</span> : null}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <ExportButtons />
        <span className="font-mono text-[10px] text-text-tertiary tracking-widest">HACKATHON DEMO</span>
      </div>
    </header>
  );
}
