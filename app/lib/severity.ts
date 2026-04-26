import type { Severity, Confidence } from "@/types/findings";

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "var(--color-critical)",
  high: "var(--color-high)",
  moderate: "var(--color-moderate)",
  low: "var(--color-low)",
  no_action: "var(--color-intact)",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  low: "Low",
  no_action: "No action",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "moderate", "low", "no_action"];

export function severityRank(s: Severity): number {
  return SEVERITY_ORDER.indexOf(s);
}

export function confidenceDots(c: Confidence): string {
  if (c === "high") return "●●●";
  if (c === "medium") return "●●○";
  return "●○○";
}
