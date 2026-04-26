"use client";

import { useEffect, useState } from "react";

export interface RunStatus {
  state: "idle" | "running" | "done" | "error";
  stage: string;
  error: string;
  run_id: string;
  updated_at: string;
}

export function useRunStatus(pollMs = 2000): RunStatus {
  const [status, setStatus] = useState<RunStatus>({
    state: "idle",
    stage: "",
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

const STAGE_LABEL: Record<string, string> = {
  starting: "Starting",
  ingest: "Validating inputs",
  "marengo-index": "Marengo indexing",
  "marengo-detect": "Detecting candidates",
  "extract-clips": "Extracting evidence clips",
  pegasus: "Pegasus describing clips",
  severity: "Scoring severity",
  exports: "Writing outputs",
};

export default function StatusBanner({ status }: { status: RunStatus }) {
  if (status.state === "running") {
    const label = STAGE_LABEL[status.stage] ?? status.stage;
    return (
      <div className="bg-brand text-white px-6 py-2 text-[12px] font-medium flex items-center gap-3 no-print">
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-pulse" />
        <span>Pipeline running — {label}…</span>
        <span className="font-mono text-[11px] opacity-75">re-analysis in progress; outputs will refresh when complete</span>
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
