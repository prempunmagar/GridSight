"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import type { Finding } from "@/types/findings";
import type { FlightPath } from "@/types/telemetry";
import type { RunMetadata } from "@/types/metadata";
import { loadFindings, loadFlightPath, loadMetadata } from "@/lib/data";

import Header from "@/components/Header";
import FindingsList from "@/components/FindingsList";
import DetailPanel from "@/components/DetailPanel";
import Timeline from "@/components/Timeline";
import StatusBanner, { useRunStatus } from "@/components/StatusBanner";
import type { FilterValue } from "@/components/FilterChips";
import type { SortKey } from "@/components/SortDropdown";

const FlightPathMap = dynamic(() => import("@/components/FlightPathMap"), {
  ssr: false,
  loading: () => (
    <div className="no-print flex-1 bg-surface-subtle border border-border rounded-lg flex items-center justify-center text-ink-tertiary text-sm">
      loading map…
    </div>
  ),
});

function PrintHeader({ meta, findingCount }: { meta: RunMetadata; findingCount: number }) {
  const sev = meta.findings_by_severity;
  const date = meta.run_datetime_utc.slice(0, 10);
  return (
    <div className="print-only px-8 pt-6 pb-4 border-b border-border">
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold tracking-tight">GridSight findings report</span>
        <span className="font-mono text-xs text-ink-secondary">
          {meta.voltage_class} · {date} · run {meta.run_id}
        </span>
      </div>
      <div className="mt-2 text-xs text-ink-secondary">
        {meta.corridor_description} · {findingCount} findings ·{" "}
        <span style={{ color: "#DC2626" }}>{sev.critical} critical</span> ·{" "}
        <span style={{ color: "#EA580C" }}>{sev.high} high</span> ·{" "}
        <span style={{ color: "#D97706" }}>{sev.moderate} moderate</span> ·{" "}
        <span style={{ color: "#475569" }}>{sev.low} low</span> ·{" "}
        <span style={{ color: "#16A34A" }}>{sev.no_action} intact</span>
      </div>
    </div>
  );
}

const COLUMN_GAP = 24;
const OUTER_PADDING_X = 24;
const OUTER_PADDING_TOP = 24;

export default function Page() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [flightPath, setFlightPath] = useState<FlightPath | null>(null);
  const [meta, setMeta] = useState<RunMetadata | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Set<FilterValue>>(new Set<FilterValue>(["all"]));
  const [sort, setSort] = useState<SortKey>("severity");
  const [showIntact, setShowIntact] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const status = useRunStatus(2000);

  function toggleInSet(setter: (next: Set<string>) => void, current: Set<string>, id: string) {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  useEffect(() => {
    Promise.all([loadFindings(), loadFlightPath(), loadMetadata()])
      .then(([f, p, m]) => {
        setFindings(f);
        setFlightPath(p);
        setMeta(m);
        setSelectedId((prev) => {
          if (prev && f.some((x) => x.finding_id === prev)) return prev;
          const firstActionable = f.find((x) => x.severity !== "no_action");
          return firstActionable?.finding_id ?? null;
        });
      })
      .catch((e) => setLoadError(String(e)));
  }, [status.run_id, status.state]);

  const selected = useMemo(
    () => findings?.find((f) => f.finding_id === selectedId) ?? null,
    [findings, selectedId]
  );

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-sev-critical">
        Failed to load pipeline output: {loadError}
      </div>
    );
  }

  if (!findings || !flightPath || !meta) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-ink-tertiary">
        loading…
      </div>
    );
  }

  const bannerHeight = status.state === "running" ? 76 : status.state === "error" ? 36 : 0;
  const reservedHeight = 64 /* header */ + bannerHeight + 56 /* timeline */ + 24 /* timeline gap */ + OUTER_PADDING_TOP + 24;

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary">
      <Header meta={meta} />
      <StatusBanner status={status} />

      <PrintHeader meta={meta} findingCount={findings.length} />

      <div
        style={{
          paddingLeft: OUTER_PADDING_X,
          paddingRight: OUTER_PADDING_X,
          paddingTop: OUTER_PADDING_TOP,
          paddingBottom: 24,
        }}
      >
        <div
          className="flex"
          style={{ gap: `${COLUMN_GAP}px`, height: `calc(100vh - ${reservedHeight}px)` }}
        >
          <FindingsList
            findings={findings}
            selectedId={selectedId}
            voltageClass={meta.voltage_class}
            reviewedIds={reviewedIds}
            flaggedIds={flaggedIds}
            onSelect={setSelectedId}
            filters={filters}
            setFilters={setFilters}
            sort={sort}
            setSort={setSort}
            showIntact={showIntact}
            setShowIntact={setShowIntact}
          />

          <FlightPathMap
            findings={findings}
            flightPath={flightPath}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showIntact={showIntact}
          />

          {selected && (
            <DetailPanel
              finding={selected}
              voltageClass={meta.voltage_class}
              isReviewed={reviewedIds.has(selected.finding_id)}
              isFlagged={flaggedIds.has(selected.finding_id)}
              onToggleReviewed={() => toggleInSet(setReviewedIds, reviewedIds, selected.finding_id)}
              onToggleFlagged={() => toggleInSet(setFlaggedIds, flaggedIds, selected.finding_id)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      </div>

      <div style={{ paddingLeft: OUTER_PADDING_X, paddingRight: OUTER_PADDING_X, paddingBottom: 24 }}>
        <Timeline
          findings={findings}
          totalSeconds={meta.source_video_duration_seconds}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>
    </div>
  );
}
