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
    <div className="flex-1 bg-surface-subtle border border-border rounded-lg flex items-center justify-center text-ink-tertiary text-sm">
      loading map…
    </div>
  ),
});

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

  const status = useRunStatus(2000);

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

  const bannerHeight = status.state === "running" ? 36 : 0;
  const reservedHeight = 64 /* header */ + bannerHeight + 56 /* timeline */ + 24 /* timeline gap */ + OUTER_PADDING_TOP + 24;

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-primary">
      <Header meta={meta} />
      <StatusBanner status={status} />

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
