"""Stage 7: write out/findings.csv per docs/02_BUILD_PLAN.md Phase 4 task 2."""

import csv
from pathlib import Path

CSV_COLUMNS = [
    "finding_id", "timestamp_seconds",
    "gps_lat", "gps_lon", "altitude_m_agl", "heading_deg", "ground_speed_mps",
    "class", "component_type", "condition", "specific_defects",
    "vegetation_distance_estimate_ft",
    "severity", "combined_confidence", "marengo_score", "pegasus_confidence",
    "needs_human_review", "nerc_citation",
    "evidence_clip_path", "discovery_source",
]


def write_csv(findings: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(CSV_COLUMNS)
        for fnd in findings:
            row = []
            for col in CSV_COLUMNS:
                v = fnd.get(col)
                if isinstance(v, list):
                    row.append("; ".join(str(x) for x in v))
                elif v is None:
                    row.append("")
                else:
                    row.append(v)
            writer.writerow(row)
