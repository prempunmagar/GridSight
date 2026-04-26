"use client";

import type { Finding } from "@/types/findings";

export default function EvidenceClipPlayer({ finding }: { finding: Finding }) {
  return (
    <video
      key={finding.finding_id}
      src={finding.evidence_clip_path}
      controls
      muted
      autoPlay
      className="w-full bg-black rounded"
    />
  );
}
