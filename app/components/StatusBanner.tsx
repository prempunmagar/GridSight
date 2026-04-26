"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

export interface RunStatus {
  state: "idle" | "running" | "done" | "error";
  stage: string;
  detail?: string;
  error: string;
  run_id: string;
  updated_at: string;
}

export function useRunStatus(pollMs = 2000): RunStatus {
  const [status, setStatus] = useState<RunStatus>({
    state: "idle",
    stage: "",
    detail: "",
    error: "",
    run_id: "",
    updated_at: "",
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch("/data/run_status.json", { cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as RunStatus;
          if (!cancelled) setStatus(next);
        }
      } catch {
        // ignore network errors
      }
      if (!cancelled) timer = setTimeout(poll, pollMs);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pollMs]);

  return status;
}

interface StageDef {
  id: string;
  label: string;
}

const STAGES: StageDef[] = [
  { id: "starting", label: "Start" },
  { id: "ingest", label: "Ingest" },
  { id: "marengo-index", label: "Marengo index" },
  { id: "marengo-detect", label: "Detect" },
  { id: "extract-clips", label: "Extract clips" },
  { id: "pegasus", label: "Pegasus describe" },
  { id: "severity", label: "Severity score" },
  { id: "exports", label: "Export" },
];

const STAGE_FULL: Record<string, string> = {
  starting: "Starting up",
  ingest: "Validating inputs",
  "marengo-index": "Indexing video with Marengo",
  "marengo-detect": "Embedding queries and ranking candidates",
  "extract-clips": "Extracting evidence clips with ffmpeg",
  pegasus: "Describing clips with Pegasus",
  severity: "Scoring severity and looking up telemetry",
  exports: "Writing CSV / GeoJSON / dashboard outputs",
};

export default function StatusBanner({ status }: { status: RunStatus }) {
  if (status.state === "running") {
    const currentIdx = STAGES.findIndex((s) => s.id === status.stage);
    return (
      <div className="bg-brand text-white px-6 py-2.5 no-print">
        <div className="flex items-center gap-3 text-[13px] font-medium">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span className="shrink-0">Pipeline running — {STAGE_FULL[status.stage] ?? status.stage}</span>
          {status.detail && (
            <span className="font-mono text-[11px] opacity-80 shrink-0">{status.detail}</span>
          )}
          <span className="font-mono text-[11px] opacity-60 ml-auto shrink-0">
            outputs refresh on completion
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {STAGES.map((s, i) => {
            const done = currentIdx > i;
            const active = currentIdx === i;
            return (
              <span
                key={s.id}
                className={
                  "inline-flex items-center gap-1 px-2 h-6 rounded-full text-[10px] font-medium border " +
                  (done
                    ? "bg-white/20 border-white/30 text-white"
                    : active
                    ? "bg-white text-brand border-white"
                    : "bg-transparent border-white/30 text-white/70")
                }
              >
                {done ? (
                  <Check size={10} strokeWidth={3} />
                ) : active ? (
                  <Loader2 size={10} className="animate-spin" />
                ) : (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current opacity-50" />
                )}
                {s.label}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (status.state === "error") {
    return (
      <div className="bg-sev-critical text-white px-6 py-2 text-[12px] font-medium flex items-center gap-3 no-print">
        <span className="inline-block w-2 h-2 rounded-full bg-white" />
        <span>Pipeline failed</span>
        <span className="font-mono text-[11px] opacity-90 truncate">{status.error}</span>
        <button
          type="button"
          onClick={() => {
            void fetch("/api/status/clear", { method: "POST" });
          }}
          className="ml-auto h-6 px-2 rounded text-[11px] font-medium bg-white/15 hover:bg-white/25"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
