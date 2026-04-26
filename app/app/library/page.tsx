"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Settings, UploadCloud, Play, RefreshCw, AlertTriangle } from "lucide-react";

import type { RunMetadata } from "@/types/metadata";
import { SEVERITY_HEX } from "@/lib/severity";
import StatusBanner, { useRunStatus } from "@/components/StatusBanner";

export default function LibraryPage() {
  const [meta, setMeta] = useState<RunMetadata | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const status = useRunStatus(2000);

  useEffect(() => {
    fetch("/data/run_metadata.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [status.state]);

  const isRunning = status.state === "running";

  const totalFindings = meta?.total_findings ?? 0;
  const critical = meta?.findings_by_severity.critical ?? 0;
  const high = meta?.findings_by_severity.high ?? 0;
  const moderate = meta?.findings_by_severity.moderate ?? 0;
  const durationMin = meta ? Math.round(meta.source_video_duration_seconds / 60) : 0;
  const durationSec = meta ? Math.round(meta.source_video_duration_seconds % 60) : 0;
  const durLabel = useMemo(
    () => `${String(durationMin).padStart(2, "0")}:${String(durationSec).padStart(2, "0")}`,
    [durationMin, durationSec],
  );

  async function handleReanalyze() {
    setSubmitting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/reanalyze", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRequestError(body.error ?? `request failed (${res.status})`);
      } else {
        setConfirmOpen(false);
      }
    } catch (e) {
      setRequestError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary">
      <header className="h-16 bg-surface-panel border-b border-border flex items-center px-6 no-print">
        <div className="flex-1">
          <span className="text-[24px] font-semibold tracking-tight text-ink-primary leading-none">
            GridSight
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center font-mono text-[11px] text-slate-400 uppercase tracking-[0.1em]">
          Inspection Library
        </div>
        <div className="flex-1 flex items-center justify-end gap-3">
          <button
            type="button"
            aria-label="Settings"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface-panel text-ink-secondary hover:bg-surface-subtle"
          >
            <Settings size={15} />
          </button>
          <span className="ml-1 font-mono text-[10px] tracking-[0.12em] text-slate-400 uppercase">
            Hackathon Demo
          </span>
        </div>
      </header>

      <StatusBanner status={status} />

      <div className="max-w-[1280px] mx-auto px-8 pt-8 pb-12">
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-ink-primary">Videos</h1>
          <p className="text-[13px] text-ink-secondary mt-1">
            Drop a drone inspection video and its companion telemetry, or click an analyzed video to view findings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <UploadCard />

          <VideoTile
            name={meta?.source_video_filename ?? "demo_video.mp4"}
            corridor={meta?.corridor_description ?? "Generated demo corridor"}
            voltage={meta?.voltage_class ?? "230kV"}
            duration={durLabel}
            findings={totalFindings}
            critical={critical}
            high={high}
            moderate={moderate}
            isRunning={isRunning}
            onReanalyze={() => setConfirmOpen(true)}
          />
        </div>

        <p className="mt-8 text-[11px] text-slate-400 font-mono">
          Re-analysis takes 5–15 min and uses AWS Bedrock credits. Pre-stage demo prep only — do not click during the live presentation.
        </p>
      </div>

      {confirmOpen && (
        <ConfirmReanalyze
          submitting={submitting}
          error={requestError}
          onCancel={() => {
            if (!submitting) {
              setConfirmOpen(false);
              setRequestError(null);
            }
          }}
          onConfirm={handleReanalyze}
        />
      )}
    </div>
  );
}

function UploadCard() {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        // Decorative for the demo — upload not wired up.
        alert("Upload is decorative for the demo. Use Re-analyze on the existing video.");
      }}
      className={
        "rounded-lg border-2 border-dashed cursor-pointer transition-colors flex flex-col p-5 " +
        (drag
          ? "border-brand bg-brand/5"
          : "border-border bg-surface-panel hover:border-slate-400")
      }
      style={{ aspectRatio: "16 / 11" }}
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <span className="h-10 w-10 rounded-full bg-surface-subtle inline-flex items-center justify-center mb-3">
          <UploadCloud size={18} color="#475569" strokeWidth={1.75} />
        </span>
        <div className="text-[13px] font-semibold text-ink-primary">Drop drone footage + telemetry</div>
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">
            Video: MP4
          </span>
          <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">
            Telemetry: SRT or CSV
          </span>
        </div>
      </div>
      <ul className="text-[10.5px] text-ink-tertiary space-y-0.5 leading-snug mt-1">
        <li className="flex items-start gap-1.5">
          <span style={{ color: SEVERITY_HEX.no_action }}>●</span>
          <span>
            <span className="text-ink-secondary">Video:</span> Marengo indexing &amp; analysis
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <span style={{ color: SEVERITY_HEX.high }}>●</span>
          <span>
            <span className="text-ink-secondary">Telemetry:</span> DJI SRT or per-second CSV
          </span>
        </li>
      </ul>
      <input type="file" accept="video/*,.csv,.srt" multiple className="sr-only" />
    </label>
  );
}

interface VideoTileProps {
  name: string;
  corridor: string;
  voltage: string;
  duration: string;
  findings: number;
  critical: number;
  high: number;
  moderate: number;
  isRunning: boolean;
  onReanalyze: () => void;
}

function VideoTile({
  name,
  corridor,
  voltage,
  duration,
  findings,
  critical,
  high,
  moderate,
  isRunning,
  onReanalyze,
}: VideoTileProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-border bg-surface-panel flex flex-col">
      <div
        className="relative bg-slate-900"
        style={{ aspectRatio: "16 / 11" }}
      >
        <Link
          href="/dashboard"
          className="absolute inset-0 group flex items-center justify-center"
          aria-label={`View analysis for ${name}`}
        >
          <span className="h-12 w-12 rounded-full bg-white/95 inline-flex items-center justify-center transition-transform group-hover:scale-110">
            <Play size={20} color="#0F172A" fill="#0F172A" />
          </span>
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/75 rounded font-mono text-[10px] text-white">
            {duration}
          </span>
          {critical > 0 && (
            <span
              className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-[10px] font-semibold text-white"
              style={{ background: SEVERITY_HEX.critical }}
            >
              {critical} CRITICAL
            </span>
          )}
        </Link>
      </div>

      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-ink-primary leading-snug truncate">{name}</div>
            <div className="font-mono text-[10.5px] text-ink-tertiary mt-0.5">
              {corridor} · {voltage}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-ink-secondary">
          <span className="font-mono">{findings} findings</span>
          <span className="inline-flex items-center gap-1 font-mono" style={{ color: SEVERITY_HEX.critical }}>
            ● {critical}
          </span>
          <span className="inline-flex items-center gap-1 font-mono" style={{ color: SEVERITY_HEX.high }}>
            ● {high}
          </span>
          <span className="inline-flex items-center gap-1 font-mono" style={{ color: SEVERITY_HEX.moderate }}>
            ● {moderate}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-1">
          <Link
            href="/dashboard"
            className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-black"
          >
            View analysis
          </Link>
          <button
            type="button"
            disabled={isRunning}
            onClick={onReanalyze}
            className="h-8 inline-flex items-center gap-1.5 px-3 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            title="Re-run the pipeline on the canonical inputs"
          >
            <RefreshCw size={13} className={isRunning ? "animate-spin" : ""} />
            {isRunning ? "Running…" : "Re-analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmReanalyze({
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] bg-slate-900/40 flex items-center justify-center px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md bg-surface-panel border border-border rounded-lg shadow-card-hover p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className="h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0"
            style={{ background: "rgba(220,38,38,0.10)" }}
          >
            <AlertTriangle size={18} color={SEVERITY_HEX.critical} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-ink-primary">Re-analyze the canonical demo run?</div>
            <p className="text-[12.5px] text-ink-secondary mt-1 leading-relaxed">
              Spawns the pipeline against <span className="font-mono">data/curated/demo_video.mp4</span> and{" "}
              <span className="font-mono">data/telemetry/demo_video_telemetry.csv</span>. Burns AWS Bedrock credits
              (~$5) and takes 5–15 min. Existing findings will be overwritten when complete.
            </p>
            <p className="text-[11.5px] text-ink-tertiary mt-2">
              Anti-goal §4.2: do not run during the live stage demo. Pre-stage demo prep only.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-sev-critical bg-surface-subtle border border-border rounded p-2 font-mono">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-9 px-3 rounded-md border border-border bg-surface-panel text-[12px] font-medium text-ink-primary hover:bg-surface-subtle disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="h-9 px-3 rounded-md bg-slate-900 text-white text-[12px] font-medium hover:bg-black disabled:opacity-50"
          >
            {submitting ? "Starting…" : "Re-analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
