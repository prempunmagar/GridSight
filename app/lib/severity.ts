import type { Severity, Confidence } from "@/types/findings";

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-sev-critical)",
  high: "var(--color-sev-high)",
  moderate: "var(--color-sev-moderate)",
  low: "var(--color-sev-low)",
  no_action: "var(--color-sev-intact)",
};

export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  moderate: "#D97706",
  low: "#475569",
  no_action: "#16A34A",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  low: "Low",
  no_action: "Intact",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "moderate", "low", "no_action"];

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export function confidenceTier(c: Confidence): 1 | 2 | 3 {
  if (c === "high") return 3;
  if (c === "medium") return 2;
  return 1;
}

export function confidencePercent(c: Confidence): number {
  if (c === "high") return 0.88;
  if (c === "medium") return 0.62;
  return 0.34;
}
