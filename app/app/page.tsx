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
import ConfidenceLegend from "@/components/ConfidenceLegend";

const FlightPathMap = dynamic(() => import("@/components/FlightPathMap"), {
  ssr: false,
  loading: () => <div className="flex-1 bg-subtle flex items-center justify-center text-text-tertiary text-sm">loading map…</div>,
});

export default function Page() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [flightPath, setFlightPath] = useState<FlightPath | null>(null);
  const [meta, setMeta] = useState<RunMetadata | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadFindings(), loadFlightPath(), loadMetadata()])
      .then(([f, p, m]) => {
        setFindings(f);
        setFlightPath(p);
        setMeta(m);
      })
      .catch((e) => setLoadError(String(e)));
  }, []);

  const selected = useMemo(
    () => findings?.find((f) => f.finding_id === selectedId) ?? null,
    [findings, selectedId]
  );

  if (loadError) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-critical">
        Failed to load pipeline output: {loadError}
      </div>
    );
  }

  if (!findings || !flightPath || !meta) {
    return (
      <div className="h-screen flex items-center justify-center text-sm text-text-tertiary">
        loading…
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header meta={meta} />
      <div className="flex flex-1 min-h-0">
        <FindingsList
          findings={findings}
          selectedId={selectedId}
          voltageClass={meta.voltage_class}
          onSelect={setSelectedId}
        />
        <main className="flex-1 relative min-w-0">
          <FlightPathMap
            findings={findings}
            flightPath={flightPath}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <ConfidenceLegend />
        </main>
        {selected && (
          <DetailPanel
            finding={selected}
            voltageClass={meta.voltage_class}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
