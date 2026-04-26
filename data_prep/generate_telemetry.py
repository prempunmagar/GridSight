"""
generate_telemetry.py — Read data_prep/corridor_waypoints.json and write
data/telemetry/demo_video_telemetry.csv with the 11-column schema documented
in docs/08_EXTERNAL_DATA_HANDOFF.md (Deliverable 2).

Usage:
    # Defaults: 1500 s (25 min) @ 1 Hz, 10 m/s nominal speed, 40 m AGL.
    python data_prep/generate_telemetry.py

    # Explicit duration / speed / start time.
    python data_prep/generate_telemetry.py --duration 1500 --speed 10 \
        --start-utc 2026-04-15T14:00:00Z --terrain-msl 150

Approach:
    1. Resample the polyline at fixed arc-length spacing (speed * 1 s) using
       great-circle interpolation between consecutive waypoints.
    2. Compute heading as the bearing from row N to row N+1.
    3. Add small realistic perturbations: ~1 m lat/lon noise, ~0.5 m altitude
       wobble, ±0.5 m/s speed jitter, gentle pitch/roll, gimbal pitch around
       -45° looking down at the conductors.
    4. Write CSV in the exact 11-column order the pipeline expects.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
DEFAULT_WAYPOINTS = HERE / "corridor_waypoints.json"
DEFAULT_OUT = REPO_ROOT / "data" / "telemetry" / "demo_video_telemetry.csv"

EARTH_R = 6_371_000.0

SCHEMA_COLUMNS = [
    "timestamp_seconds",
    "datetime_utc",
    "latitude",
    "longitude",
    "altitude_m_agl",
    "altitude_m_msl",
    "heading_deg",
    "pitch_deg",
    "roll_deg",
    "gimbal_pitch_deg",
    "ground_speed_mps",
]


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_R * math.asin(math.sqrt(a))


def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


def interpolate_great_circle(lat1: float, lon1: float, lat2: float, lon2: float, f: float) -> tuple[float, float]:
    """Spherical interpolation between two lat/lon pairs at fraction f in [0,1]."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    l1, l2 = math.radians(lon1), math.radians(lon2)
    d = haversine_m(lat1, lon1, lat2, lon2) / EARTH_R
    if d < 1e-12:
        return lat1, lon1
    A = math.sin((1 - f) * d) / math.sin(d)
    B = math.sin(f * d) / math.sin(d)
    x = A * math.cos(p1) * math.cos(l1) + B * math.cos(p2) * math.cos(l2)
    y = A * math.cos(p1) * math.sin(l1) + B * math.cos(p2) * math.sin(l2)
    z = A * math.sin(p1) + B * math.sin(p2)
    lat = math.atan2(z, math.sqrt(x * x + y * y))
    lon = math.atan2(y, x)
    return math.degrees(lat), math.degrees(lon)


def offset_meters(lat: float, lon: float, dn_m: float, de_m: float) -> tuple[float, float]:
    """Tiny lat/lon perturbation given north/east offsets in meters."""
    dlat = dn_m / 111_320.0
    dlon = de_m / (111_320.0 * max(math.cos(math.radians(lat)), 1e-6))
    return lat + dlat, lon + dlon


def resample_polyline(waypoints: list[tuple[float, float]], step_m: float, total_m: float) -> list[tuple[float, float]]:
    """Walk along the polyline emitting a point every `step_m` meters until total_m."""
    if len(waypoints) < 2:
        raise ValueError("Need at least 2 waypoints.")
    seg_lens = [haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(waypoints, waypoints[1:])]
    polyline_total = sum(seg_lens)

    out: list[tuple[float, float]] = []
    target = 0.0
    while target <= total_m + 1e-6:
        # If target exceeds the corridor, ping-pong: turn around at the end.
        # (Keeps a 25-min flight on a 5-mile corridor plausible.)
        d_along = target % (2 * polyline_total)
        if d_along > polyline_total:
            d_along = 2 * polyline_total - d_along
        # Find segment containing d_along.
        cum = 0.0
        for (a, b), seg in zip(zip(waypoints, waypoints[1:]), seg_lens):
            if seg <= 0:
                continue
            if cum + seg >= d_along:
                f = (d_along - cum) / seg
                out.append(interpolate_great_circle(a[0], a[1], b[0], b[1], f))
                break
            cum += seg
        else:
            out.append(waypoints[-1])
        target += step_m
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--waypoints", type=Path, default=DEFAULT_WAYPOINTS,
                   help=f"Input corridor JSON (default {DEFAULT_WAYPOINTS})")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT,
                   help=f"Output CSV (default {DEFAULT_OUT})")
    p.add_argument("--duration", type=int, default=1500,
                   help="Total seconds of telemetry (default 1500 = 25 min)")
    p.add_argument("--speed", type=float, default=10.0,
                   help="Nominal ground speed m/s (default 10; inspection drones 5–15)")
    p.add_argument("--altitude-agl", type=float, default=40.0,
                   help="Nominal altitude above ground m (default 40)")
    p.add_argument("--terrain-msl", type=float, default=150.0,
                   help="Constant terrain elevation MSL in m (default 150 — STL ~140–180 m)")
    p.add_argument("--gimbal-pitch", type=float, default=-45.0,
                   help="Nominal gimbal pitch deg, looking down (default -45)")
    p.add_argument("--start-utc", default="2026-04-15T14:00:00Z",
                   help="Start datetime UTC, ISO 8601 (default 2026-04-15T14:00:00Z)")
    p.add_argument("--seed", type=int, default=42, help="RNG seed for perturbations")
    args = p.parse_args()

    random.seed(args.seed)

    corridor = json.loads(args.waypoints.read_text())
    pts = [(w["lat"], w["lon"]) for w in corridor["waypoints"]]
    if len(pts) < 2:
        print("Need >=2 waypoints in corridor JSON.")
        return 1

    samples = resample_polyline(pts, step_m=args.speed, total_m=args.duration * args.speed)
    samples = samples[: args.duration + 1]  # +1 so we can compute the final heading

    start_dt = datetime.fromisoformat(args.start_utc.replace("Z", "+00:00")).astimezone(timezone.utc)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(SCHEMA_COLUMNS)

        for t in range(args.duration):
            lat0, lon0 = samples[t]
            lat1, lon1 = samples[t + 1] if t + 1 < len(samples) else samples[t]

            # Heading from this second to the next.
            heading = bearing_deg(lat0, lon0, lat1, lon1)

            # Perturb position by ~1 m noise.
            lat, lon = offset_meters(lat0, lon0, random.gauss(0, 1.0), random.gauss(0, 1.0))

            agl = args.altitude_agl + random.gauss(0, 0.5)
            msl = args.terrain_msl + agl
            speed = max(0.0, args.speed + random.gauss(0, 0.4))
            pitch = random.gauss(0, 1.5)
            roll = random.gauss(0, 1.5)
            gimbal = args.gimbal_pitch + random.gauss(0, 1.0)
            ts = (start_dt + timedelta(seconds=t)).strftime("%Y-%m-%dT%H:%M:%SZ")

            writer.writerow([
                t,
                ts,
                f"{lat:.6f}",
                f"{lon:.6f}",
                f"{agl:.2f}",
                f"{msl:.2f}",
                f"{heading:.2f}",
                f"{pitch:.2f}",
                f"{roll:.2f}",
                f"{gimbal:.2f}",
                f"{speed:.2f}",
            ])

    print(f"Wrote {args.duration} rows to {args.out}")
    print(f"Corridor: {corridor.get('corridor_name', '?')} ({corridor.get('voltage_class', '?')})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
