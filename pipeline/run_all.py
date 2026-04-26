"""Orchestrator: ingest -> Marengo index -> detect -> dedup -> extract -> Pegasus -> severity -> export."""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from pipeline import (
    bedrock_client,
    config,
    export_csv,
    export_dashboard,
    export_geojson,
    extract_clips,
    ingest,
    marengo_detect,
    marengo_index,
    pegasus_describe,
    queries,
    severity,
    telemetry,
)


def _git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"],
                                       text=True, cwd=config.REPO_ROOT).strip()
    except Exception:
        return "unknown"


def _video_duration_seconds(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    )
    return float(out.strip())


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--include-inventory", action="store_true",
                        help="add inventory queries (broad-version, gated by Decision Gate 3)")
    parser.add_argument("--voltage-class", default=config.DEFAULT_VOLTAGE_CLASS)
    parser.add_argument("--corridor-description",
                        default="Generated demo corridor (southern Illinois, ~6.6 km W-NW)")
    parser.add_argument("--cache-embeddings", default=str(config.OUT_DIR / "marengo_clip_embeddings.json"),
                        help="path to cache the Marengo clip embeddings between runs")
    parser.add_argument("--force-reindex", action="store_true",
                        help="re-run Marengo indexing even if cached embeddings exist")
    parser.add_argument("--refresh-pegasus", action="store_true",
                        help="re-call Pegasus even if cached responses exist (use after prompt changes)")
    parser.add_argument("--max-candidates", type=int, default=30,
                        help="cap the number of dedup'd candidates sent to Pegasus")
    args = parser.parse_args(argv)

    if not config.S3_BUCKET:
        print("ERROR: S3_BUCKET not set in .env", file=sys.stderr)
        return 1

    print("=" * 64)
    print("GridSight pipeline")
    print("=" * 64)
    video_path, telemetry_csv = ingest.assert_inputs_exist()
    print(f"  video:     {video_path}")
    print(f"  telemetry: {telemetry_csv}")
    print(f"  voltage:   {args.voltage_class}")

    duration_s = _video_duration_seconds(video_path)
    print(f"  duration:  {duration_s:.1f}s")

    cache_path = Path(args.cache_embeddings)
    if cache_path.exists() and not args.force_reindex:
        print(f"\n[Stage 2] Loading cached clip embeddings from {cache_path}")
        clip_embeddings = json.loads(cache_path.read_text())
    else:
        print("\n[Stage 2] Indexing video with Marengo (async)")
        clip_embeddings = marengo_index.index_video(
            video_path,
            s3_video_key="pipeline/curated/demo_video.mp4",
            output_prefix="pipeline/marengo-index",
        )
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(clip_embeddings))
        print(f"  cached embeddings -> {cache_path}")

    print(f"\n[Stage 3] Detecting candidates ({len(queries.active_queries(args.include_inventory))} queries)")
    active = queries.active_queries(args.include_inventory)
    text_cache_path = config.OUT_DIR / "marengo_text_embeddings.json"
    candidates = marengo_detect.detect(clip_embeddings, active, cache_path=text_cache_path)
    print(f"  raw candidates: {len(candidates)}")

    deduped = marengo_detect.deduplicate(candidates)
    print(f"  after dedup:    {len(deduped)}")
    if len(deduped) > args.max_candidates:
        deduped = sorted(deduped, key=lambda c: c["marengo_score"], reverse=True)[:args.max_candidates]
        print(f"  capped to top {args.max_candidates} by marengo_score")

    print("\n[Stage 4] Extracting evidence clips")
    config.CLIPS_WORKING_DIR.mkdir(parents=True, exist_ok=True)
    deduped.sort(key=lambda c: c["timestamp_seconds"])
    enriched: list[dict] = []
    for i, c in enumerate(deduped, start=1):
        finding_id = f"f{i:03d}"
        clip_path = extract_clips.extract_clip(
            video_path, c["timestamp_seconds"], finding_id, config.CLIPS_WORKING_DIR
        )
        c["finding_id"] = finding_id
        c["clip_path"] = clip_path
        enriched.append(c)
        print(f"  {finding_id}: t={c['timestamp_seconds']:6.1f}s  score={c['marengo_score']:.3f}")

    print("\n[Stage 5] Describing clips with Pegasus (sync)")
    pegasus_cache_path = config.OUT_DIR / "pegasus_responses.json"
    cache = json.loads(pegasus_cache_path.read_text()) if pegasus_cache_path.exists() else {}
    sess = bedrock_client.session()
    s3 = sess.client("s3")
    account = bedrock_client.account_id(sess)
    for c in enriched:
        cached = cache.get(c["finding_id"])
        if cached and not args.refresh_pegasus:
            parsed = cached["parsed"]
            raw = cached.get("raw", "")
            tag = "(cached)"
        else:
            clip_key = f"pipeline/clips/{c['finding_id']}.mp4"
            clip_uri = pegasus_describe.upload_clip(s3, c["clip_path"], clip_key)
            try:
                parsed, raw = pegasus_describe.describe_clip(clip_uri, account)
            except Exception as e:
                print(f"  {c['finding_id']}: Pegasus failed ({e}); using unclear/other defaults")
                parsed = {
                    "component_type": "other", "condition": "unclear",
                    "specific_defects": [], "vegetation_distance_estimate_ft": None,
                    "pegasus_confidence": "low",
                }
                raw = ""
            cache[c["finding_id"]] = {"parsed": parsed, "raw": raw,
                                       "timestamp_seconds": c["timestamp_seconds"]}
            pegasus_cache_path.write_text(json.dumps(cache, indent=2))
            tag = ""
        c["parsed"] = parsed
        c["pegasus_raw"] = raw
        print(f"  {c['finding_id']} {tag}: {parsed['component_type']:<17} {parsed['condition']:<12}"
              f" defects={parsed['specific_defects']!r}")

    print("\n[Stage 6] Severity scoring + telemetry lookup")
    df = telemetry.load_telemetry(telemetry_csv)

    findings: list[dict] = []
    for c in enriched:
        parsed = c["parsed"]
        scored = severity.score_finding(parsed, c["marengo_score"], voltage_class=args.voltage_class)
        tel = telemetry.lookup_at(df, c["timestamp_seconds"])
        clip_dur = config.CLIP_DURATION_SECONDS

        findings.append({
            "finding_id": c["finding_id"],
            "timestamp_seconds": c["timestamp_seconds"],
            "start_seconds": max(0.0, c["timestamp_seconds"] - clip_dur / 2),
            "end_seconds": c["timestamp_seconds"] + clip_dur / 2,
            "gps_lat": float(tel["latitude"]),
            "gps_lon": float(tel["longitude"]),
            "altitude_m_agl": float(tel["altitude_m_agl"]),
            "altitude_m_msl": float(tel["altitude_m_msl"]),
            "heading_deg": float(tel["heading_deg"]),
            "ground_speed_mps": float(tel["ground_speed_mps"]),
            "datetime_utc": str(tel["datetime_utc"]),
            "marengo_score": c["marengo_score"],
            "matched_queries": c["matched_queries"],
            "discovery_source": c["discovery_source"],
            "component_type": parsed["component_type"],
            "condition": parsed["condition"],
            "specific_defects": parsed["specific_defects"],
            "vegetation_distance_estimate_ft": parsed["vegetation_distance_estimate_ft"],
            "pegasus_confidence": parsed["pegasus_confidence"],
            "class": scored["class"],
            "severity": scored["severity"],
            "combined_confidence": scored["combined_confidence"],
            "needs_human_review": scored["needs_human_review"],
            "nerc_citation": scored["nerc_citation"],
            "evidence_clip_path": f"/clips/{c['finding_id']}.mp4",
        })

    print("\n[Stage 7] Writing exports")
    config.OUT_DIR.mkdir(parents=True, exist_ok=True)
    export_csv.write_csv(findings, config.OUT_DIR / "findings.csv")
    coords = telemetry.flight_path_polyline(df)
    export_geojson.write_geojson(findings, coords, config.OUT_DIR / "findings.geojson")
    (config.OUT_DIR / "findings.json").write_text(json.dumps(findings, indent=2))

    start_dt = str(df.iloc[0]["datetime_utc"])
    end_dt = str(df.iloc[-1]["datetime_utc"])
    export_dashboard.export_all(
        findings, coords, start_dt, end_dt,
        video_filename=video_path.name,
        video_duration_s=duration_s,
        voltage_class=args.voltage_class,
        corridor_description=args.corridor_description,
        pipeline_version=_git_sha(),
    )

    sev_counts = {}
    for f in findings:
        sev_counts[f["severity"]] = sev_counts.get(f["severity"], 0) + 1
    print(f"\nDone. {len(findings)} findings written.")
    print(f"  by severity: {sev_counts}")
    print(f"  outputs: {config.OUT_DIR}, {config.APP_DATA_DIR}, {config.APP_CLIPS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
