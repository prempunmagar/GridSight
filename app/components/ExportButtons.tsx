"use client";

export default function ExportButtons() {
  return (
    <div className="flex items-center gap-2">
      <a
        href="/data/findings.csv"
        download
        className="px-3 h-8 inline-flex items-center text-xs font-medium text-text-primary border border-border-default rounded hover:bg-subtle"
      >
        CSV
      </a>
      <a
        href="/data/findings.geojson"
        download
        className="px-3 h-8 inline-flex items-center text-xs font-medium text-text-primary border border-border-default rounded hover:bg-subtle"
      >
        GeoJSON
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="px-3 h-8 inline-flex items-center text-xs font-medium text-text-primary border border-border-default rounded hover:bg-subtle"
      >
        Print PDF
      </button>
    </div>
  );
}
