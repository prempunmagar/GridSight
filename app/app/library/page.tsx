"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  LayoutGrid,
  PlayCircle,
  RefreshCw,
  Rows3,
  Settings,
  Timer,
  UploadCloud,
} from "lucide-react";

import type { RunMetadata } from "@/types/metadata";
import { SEVERITY_HEX } from "@/lib/severity";
import StatusBanner, { useRunStatus } from "@/components/StatusBanner";
import VideoThumb from "@/components/VideoThumb";

const CATEGORIES: { k: string; label: string }[] = [
  { k: "all", label: "All" },
  { k: "suspension", label: "Suspension" },
  { k: "tension", label: "Tension" },
  { k: "vegetation", label: "Vegetation Sweep" },
  { k: "substation", label: "Substation Approach" },
];

export default function LibraryPage() {
  const router = useRouter();
  const [meta, setMeta] = useState<RunMetadata | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const status = useRunStatus(2000);

  // Track whether the user kicked off this run from the library so we can
  // auto-route to /dashboard on completion (only for runs they triggered;
  // a stale "done" status from a prior session shouldn't bounce them).
  const triggeredRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/data/run_metadata.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMeta)
      .catch(() => setMeta(null));
  }, [status.run_id, status.state]);

  useEffect(() => {
    if (
      triggeredRunIdRef.current &&
      status.state === "done" &&
      status.run_id === triggeredRunIdRef.current
    ) {
      triggeredRunIdRef.current = null;
      router.push("/dashboard");
    }
  }, [status.run_id, status.state, router]);

  const isRunning = status.state === "running";

  const totalFindings = meta?.total_findings ?? 0;
  const critical = meta?.findings_by_severity.critical ?? 0;
  const durationSec = meta?.source_video_duration_seconds ?? 0;
  const durLabel = useMemo(() => {
    const m = Math.floor(durationSec / 60);
    const s = Math.floor(durationSec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [durationSec]);
  const totalH = Math.floor(durationSec / 3600);
  const totalM = Math.floor((durationSec % 3600) / 60);

  async function handleReanalyze() {
    setSubmitting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/reanalyze", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setRequestError(body.error ?? `request failed (${res.status})`);
      } else {
        const body = (await res.json().catch(() => ({}))) as { run_id?: unknown };
        triggeredRunIdRef.current = typeof body.run_id === "string" ? body.run_id : null;
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
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((c) => {
            const active = activeCat === c.k;
            return (
              <button
                key={c.k}
                type="button"
                onClick={() => setActiveCat(c.k)}
                className={
                  "h-8 px-3 rounded-full text-[12px] font-medium transition-colors border " +
                  (active
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-surface-panel text-ink-primary border-border hover:bg-surface-subtle")
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-surface-panel border border-border rounded-md overflow-hidden">
              <button
                type="button"
                className="h-8 inline-flex items-center gap-1.5 px-2.5 bg-slate-900 text-white text-[12px] font-medium"
              >
                <LayoutGrid size={13} /> Videos
              </button>
              <button
                type="button"
                className="h-8 inline-flex items-center gap-1.5 px-2.5 text-ink-secondary text-[12px] font-medium hover:bg-surface-subtle"
              >
                <Rows3 size={13} /> Tabular
              </button>
            </div>
            <span className="ml-2 inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <PlayCircle size={13} /> 1 video
            </span>
            <span className="ml-1 inline-flex items-center gap-1.5 text-[12px] text-ink-secondary">
              <Timer size={13} /> {totalH > 0 && `${totalH} h `}{totalM} min
            </span>
          </div>
          <button
            type="button"
            className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[12px] font-medium text-ink-secondary hover:bg-surface-subtle"
          >
            Sort by <span className="text-ink-primary">Recent upload</span>
            <ChevronDown size={13} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          <UploadCard />

          <VideoTile
            name={meta?.source_video_filename ?? "demo_video.mp4"}
            durLabel={durLabel}
            findings={totalFindings}
            critical={critical}
            isRunning={isRunning}
            onReanalyze={() => setConfirmOpen(true)}
          />
        </div>

        <div className="mt-8 flex items-center justify-between text-[11px] text-slate-400">
          <span>Showing 1 of 1</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="h-7 px-2 rounded-md border border-border bg-surface-panel text-ink-secondary opacity-50"
            >
              Previous
            </button>
            <span className="font-mono text-ink-secondary px-2">Page 1 of 1</span>
            <button
              type="button"
              className="h-7 px-2 rounded-md border border-border bg-surface-panel text-ink-primary hover:bg-surface-subtle"
            >
              Next
            </button>
          </div>
        </div>
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
        alert("Upload is decorative for the demo. Use the existing video tile to view findings.");
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
        <span className="h-9 w-9 rounded-full bg-surface-subtle inline-flex items-center justify-center mb-2.5">
          <UploadCloud size={17} color="#475569" strokeWidth={1.75} />
        </span>
        <div className="text-[13px] font-semibold text-ink-primary">Drop videos or documents</div>
        <div className="mt-2 flex flex-wrap gap-1 justify-center">
          <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">
            Videos: MP4, MOV, AVI
          </span>
          <span className="font-mono text-[10px] text-ink-secondary bg-surface-subtle border border-border rounded-full px-2 py-0.5">
            Telemetry: SRT, CSV
          </span>
        </div>
      </div>
      <ul className="text-[10.5px] text-ink-tertiary space-y-0.5 leading-snug mt-1">
        <li className="flex items-start gap-1.5">
          <span style={{ color: SEVERITY_HEX.no_action }}>●</span>
          <span>
            <span className="text-ink-secondary">Videos:</span> Marengo indexing &amp; analysis
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <span style={{ color: SEVERITY_HEX.high }}>●</span>
          <span>
            <span className="text-ink-secondary">Documents:</span> NERC FAC-003 reference
          </span>
        </li>
        <li className="flex items-start gap-1.5">
          <span style={{ color: SEVERITY_HEX.low }}>●</span>
          <span>
            Max file size <span className="text-ink-secondary">4 GB</span> per video
          </span>
        </li>
      </ul>
      <input type="file" accept="video/*,.csv,.srt" multiple className="sr-only" />
    </label>
  );
}

interface VideoTileProps {
  name: string;
  durLabel: string;
  findings: number;
  critical: number;
  isRunning: boolean;
  onReanalyze: () => void;
}

function VideoTile({ name, durLabel, findings, critical, isRunning, onReanalyze }: VideoTileProps) {
  return (
    <div className="text-left group relative">
      <Link
        href="/dashboard"
        className="block"
        aria-label={`View analysis for ${name}`}
      >
        <div
          className="rounded-lg overflow-hidden border border-border bg-black relative"
          style={{ aspectRatio: "16 / 11" }}
        >
          <VideoThumb durationLabel={durLabel} />
          {critical > 0 && (
            <span
              className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-mono text-[10px] font-semibold text-white"
              style={{ background: SEVERITY_HEX.critical }}
            >
              {critical} CRITICAL
            </span>
          )}
        </div>
      </Link>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onReanalyze();
        }}
        disabled={isRunning}
        title="Re-analyze on the canonical inputs"
        className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md bg-white/90 text-ink-primary border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white disabled:opacity-50"
      >
        <RefreshCw size={13} className={isRunning ? "animate-spin" : ""} />
      </button>

      <div className="mt-2 px-0.5">
        <div className="text-[12.5px] font-medium text-ink-primary leading-snug truncate">{name}</div>
        <div className="font-mono text-[10.5px] text-ink-tertiary mt-0.5">
          {findings} findings · {isRunning ? "analyzing…" : "analyzed"}
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
              Runs the full pipeline against <span className="font-mono">data/curated/demo_video.mp4</span> and{" "}
              <span className="font-mono">data/telemetry/demo_video_telemetry.csv</span>. All disk caches (Marengo
              index, text embeddings, Pegasus responses) are cleared first so every stage hits AWS — burns ~$5 of
              Bedrock credits and takes 5–15 min. Existing findings are overwritten when complete.
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
