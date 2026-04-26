"""Stage 7: write app/public/data/{findings,flight_path,run_metadata}.json + copy clips."""

import json
import math
import shutil
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from pipeline import config


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    R = 6371.0088
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def write_findings_json(findings: list[dict], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(findings, indent=2), encoding="utf-8")


def write_flight_path_json(coords: list[tuple[float, float]],
                           start_dt: str, end_dt: str, out_path: Path) -> None:
    if not coords:
        raise ValueError("empty flight path")
    total_km = sum(_haversine_km(coords[i - 1], coords[i]) for i in range(1, len(coords)))
    payload = {
        "coordinates": [[lat, lon] for (lat, lon) in coords],
        "start_datetime_utc": start_dt,
        "end_datetime_utc": end_dt,
        "total_distance_km": round(total_km, 4),
        "total_duration_seconds": len(coords) - 1,
        "start_lat": coords[0][0],
        "start_lon": coords[0][1],
        "end_lat": coords[-1][0],
        "end_lon": coords[-1][1],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def write_run_metadata(findings: list[dict], video_filename: str, video_duration_s: float,
                       voltage_class: str, corridor_description: str,
                       pipeline_version: str, out_path: Path) -> None:
    sev_counter = Counter(f["severity"] for f in findings)
    cls_counter = Counter(f["class"] for f in findings)
    cond_counter = Counter(f["condition"] for f in findings)

    payload = {
        "run_id": f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        "run_datetime_utc": datetime.now(timezone.utc).isoformat(),
        "pipeline_version": pipeline_version,
        "source_video_filename": video_filename,
        "source_video_duration_seconds": video_duration_s,
        "voltage_class": voltage_class,
        "corridor_description": corridor_description,
        "corridor_disclosed_as_simulated": True,
        "total_findings": len(findings),
        "findings_by_severity": {
            k: sev_counter.get(k, 0) for k in ("critical", "high", "moderate", "low", "no_action")
        },
        "findings_by_class": {
            k: cls_counter.get(k, 0) for k in ("insulator_damage", "vegetation_encroachment", "other")
        },
        "findings_by_condition": {
            k: cond_counter.get(k, 0) for k in ("intact", "damaged", "contaminated", "unclear")
        },
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def copy_clips(findings: list[dict], working_dir: Path, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    for fnd in findings:
        src = working_dir / f"{fnd['finding_id']}.mp4"
        dst = dest_dir / f"{fnd['finding_id']}.mp4"
        if src.exists():
            shutil.copy2(src, dst)


def export_all(findings: list[dict], coords: list[tuple[float, float]],
               start_dt: str, end_dt: str,
               video_filename: str, video_duration_s: float,
               voltage_class: str, corridor_description: str,
               pipeline_version: str) -> None:
    write_findings_json(findings, config.APP_DATA_DIR / "findings.json")
    write_flight_path_json(coords, start_dt, end_dt, config.APP_DATA_DIR / "flight_path.json")
    write_run_metadata(findings, video_filename, video_duration_s, voltage_class,
                       corridor_description, pipeline_version,
                       config.APP_DATA_DIR / "run_metadata.json")
    copy_clips(findings, config.CLIPS_WORKING_DIR, config.APP_CLIPS_DIR)
