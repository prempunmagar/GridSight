"use client";

import type { Finding } from "@/types/findings";

export default function EvidenceClipPlayer({ finding }: { finding: Finding }) {
  return (
    <div className="px-4 pt-4">
      <video
        key={finding.finding_id}
        src={finding.evidence_clip_path}
        controls
        muted
        autoPlay
        className="w-full aspect-video rounded-md bg-surface-subtle"
      />
    </div>
  );
}
