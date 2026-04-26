import type { Severity, FindingClass, Condition } from "./findings";

export interface RunMetadata {
  run_id: string;
  run_datetime_utc: string;
  pipeline_version: string;

  source_video_filename: string;
  source_video_duration_seconds: number;

  voltage_class: "230kV" | "345kV" | "500kV" | "other";
  corridor_description: string;
  corridor_disclosed_as_simulated: boolean;

  total_findings: number;
  findings_by_severity: Record<Severity, number>;
  findings_by_class: Record<FindingClass, number>;
  findings_by_condition: Record<Condition, number>;
}
