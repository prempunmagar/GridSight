"use client";

import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import type { RunMetadata } from "@/types/metadata";
import { SEVERITY_HEX } from "@/lib/severity";
import ExportButtons from "./ExportButtons";

export default function Header({ meta }: { meta: RunMetadata | null }) {
  const total = meta?.total_findings ?? 0;
  const critical = meta?.findings_by_severity.critical ?? 0;
  const durationMin = meta ? Math.round(meta.source_video_duration_seconds / 60) : 0;
  const corridor = meta ? meta.corridor_description.split("(")[0].trim() : "loading…";
  const voltage = meta?.voltage_class ?? "";

  return (
    <header className="h-16 bg-surface-panel border-b border-border flex items-center px-6 no-print">
      <div className="flex-1 flex items-center gap-3">
        <span className="text-[24px] font-semibold tracking-tight text-ink-primary leading-none">
          GridSight
        </span>
        <Link
          href="/library"
          className="h-7 inline-flex items-center gap-1 px-2 rounded-md border border-border bg-surface-panel text-[11px] font-medium text-ink-secondary hover:bg-surface-subtle"
        >
          <ArrowLeft size={12} /> Library
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center font-mono leading-tight">
        <div className="text-[12px] text-ink-secondary">
          {corridor} {voltage && `· ${voltage}`}
        </div>
        <div className="text-[11px] text-ink-secondary">
          {durationMin} min · {total} findings
          {critical > 0 && (
            <>
              {" · "}
              <span style={{ color: SEVERITY_HEX.critical }}>{critical} critical</span>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-end gap-3">
        <ExportButtons />
        <button
          type="button"
          aria-label="Settings"
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface-panel text-ink-secondary hover:bg-surface-subtle"
        >
          <Settings size={15} />
        </button>
        <span className="ml-1 font-mono text-[10px] tracking-[0.12em] text-ink-tertiary uppercase">
          Hackathon Demo
        </span>
      </div>
    </header>
  );
}
