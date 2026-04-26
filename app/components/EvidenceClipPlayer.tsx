"use client";

import type { Finding } from "@/types/findings";

export default function EvidenceClipPlayer({ finding }: { finding: Finding }) {
  return (
    <div className="px-4 pt-4">
      <div className="relative w-full aspect-video bg-[#0F172A] rounded-md overflow-hidden">
        <video
          key={finding.finding_id}
          src={finding.evidence_clip_path}
          controls
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
