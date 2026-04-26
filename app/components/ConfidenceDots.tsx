"use client";

import type { Confidence } from "@/types/findings";
import { confidenceTier } from "@/lib/severity";

export default function ConfidenceDots({
  confidence,
  color = "var(--color-ink-primary)",
  detail,
}: {
  confidence: Confidence;
  color?: string;
  detail?: string;
}) {
  const tier = confidenceTier(confidence);
  const label = detail ?? `${confidence} confidence`;
  return (
    <span className="tt inline-flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block rounded-full"
          style={{
            width: 6,
            height: 6,
            background: i < tier ? color : "var(--color-border)",
          }}
        />
      ))}
      <span className="tt-pop">{label}</span>
    </span>
  );
}
