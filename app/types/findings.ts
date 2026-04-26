export type Severity = "critical" | "high" | "moderate" | "low" | "no_action";

export type Condition = "intact" | "damaged" | "contaminated" | "unclear";

export type ComponentType =
  | "insulator_string"
  | "conductor"
  | "tower"
  | "vegetation"
  | "guy_wire"
  | "other";

export type FindingClass =
  | "insulator_damage"
  | "vegetation_encroachment"
  | "other";

export type Confidence = "high" | "medium" | "low";

export type DiscoverySource = "anomaly_query" | "inventory_query";

export interface Finding {
  finding_id: string;

  timestamp_seconds: number;
  start_seconds: number;
  end_seconds: number;

  gps_lat: number;
  gps_lon: number;
  altitude_m_agl: number;
  altitude_m_msl: number;
  heading_deg: number;
  ground_speed_mps: number;
  datetime_utc: string;

  marengo_score: number;
  matched_queries: string[];
  discovery_source: DiscoverySource;

  component_type: ComponentType;
  condition: Condition;
  specific_defects: string[];
  vegetation_distance_estimate_ft: number | null;
  pegasus_confidence: Confidence;

  class: FindingClass;
  severity: Severity;
  combined_confidence: Confidence;
  needs_human_review: boolean;
  nerc_citation: string | null;

  evidence_clip_path: string;
}
