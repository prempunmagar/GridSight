"use client";

import { Zap, TreePine } from "lucide-react";
import type { FindingClass } from "@/types/findings";

export default function ClassGlyph({
  klass,
  size = 12,
  color = "#fff",
}: {
  klass: FindingClass;
  size?: number;
  color?: string;
}) {
  if (klass === "vegetation_encroachment") {
    return <TreePine size={size} color={color} strokeWidth={2.25} />;
  }
  return <Zap size={size} color={color} strokeWidth={2.25} />;
}
