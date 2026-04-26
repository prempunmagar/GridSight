"""
fetch_corridor.py — Pull a transmission-line corridor from OpenStreetMap (Overpass API)
and write it to data_prep/corridor_waypoints.json in the schema documented in
docs/08_EXTERNAL_DATA_HANDOFF.md (Deliverable 2).

Usage:
    # Default: St. Louis-area bbox, picks the longest power=line way found.
    python data_prep/fetch_corridor.py

    # Custom bbox (south,west,north,east) and voltage filter (substring match on OSM `voltage` tag).
    python data_prep/fetch_corridor.py --bbox 38.55,-90.75,38.85,-90.20 --voltage 345000

    # Pick a specific OSM way id (e.g. after browsing openinframap.org).
    python data_prep/fetch_corridor.py --way-id 123456789

    # List candidate ways without writing the file (for picking interactively).
    python data_prep/fetch_corridor.py --list-only

Notes:
    * OSM tags `voltage` in volts as a string, sometimes with multiple values separated by `;`
      (e.g. "345000;138000"). The --voltage filter is a substring match.
    * Output corridor is the ordered node geometry of the chosen OSM way, downsampled if dense
      (Overpass returns every vertex; for 5–10 representative waypoints we keep endpoints + bends).
    * No API key needed. Be polite — Overpass is a free public service.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import requests

# Overpass endpoints. The main instance returns HTTP 406 to clients sending the
# default python-requests User-Agent, so we always pass a descriptive one. The
# kumi.systems mirror is used as a fallback if the main instance is rate-limited
# or otherwise unavailable.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
USER_AGENT = "GridSight-data-prep/0.1 (hackathon; contact: ebeneezerscrooge@pm.me)"
DEFAULT_BBOX = (38.55, -90.75, 38.85, -90.20)  # St. Louis metro
HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "corridor_waypoints.json"


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def polyline_length_m(coords: list[tuple[float, float]]) -> float:
    return sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(coords, coords[1:]))


def query_overpass(bbox: tuple[float, float, float, float], voltage_filter: str | None) -> list[dict]:
    s, w, n, e = bbox
    voltage_clause = f'["voltage"~"{voltage_filter}"]' if voltage_filter else ""
    query = f"""
    [out:json][timeout:60];
    way["power"="line"]{voltage_clause}({s},{w},{n},{e});
    out geom tags;
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }
    last_err: Exception | None = None
    for url in OVERPASS_ENDPOINTS:
        try:
            resp = requests.post(url, data={"data": query}, headers=headers, timeout=90)
            if resp.status_code != 200:
                # Print server's body — Overpass usually explains itself.
                body = (resp.text or "").strip().splitlines()[:5]
                print(f"[{url}] HTTP {resp.status_code}: {' | '.join(body)}", file=sys.stderr)
                resp.raise_for_status()
            return resp.json().get("elements", [])
        except requests.RequestException as exc:
            last_err = exc
            print(f"[{url}] failed: {exc}; trying next endpoint…", file=sys.stderr)
    raise RuntimeError(f"All Overpass endpoints failed. Last error: {last_err}")


def way_to_record(el: dict) -> dict:
    coords = [(pt["lat"], pt["lon"]) for pt in el.get("geometry", [])]
    length_m = polyline_length_m(coords) if len(coords) >= 2 else 0.0
    tags = el.get("tags", {}) or {}
    return {
        "way_id": el["id"],
        "voltage": tags.get("voltage", ""),
        "operator": tags.get("operator", ""),
        "ref": tags.get("ref", ""),
        "length_m": length_m,
        "coords": coords,
    }


def downsample(coords: list[tuple[float, float]], target: int = 8) -> list[tuple[float, float]]:
    """Keep endpoints plus the points whose direction-change angle is largest (bends)."""
    if len(coords) <= target:
        return coords[:]
    # Score interior points by turn angle.
    scored = []
    for i in range(1, len(coords) - 1):
        a, b, c = coords[i - 1], coords[i], coords[i + 1]
        v1 = (b[0] - a[0], b[1] - a[1])
        v2 = (c[0] - b[0], c[1] - b[1])
        m1 = math.hypot(*v1) or 1e-12
        m2 = math.hypot(*v2) or 1e-12
        cos_t = max(-1.0, min(1.0, (v1[0] * v2[0] + v1[1] * v2[1]) / (m1 * m2)))
        scored.append((math.acos(cos_t), i))
    scored.sort(reverse=True)
    keep_idx = sorted({0, len(coords) - 1, *(i for _, i in scored[: target - 2])})
    return [coords[i] for i in keep_idx]


def write_corridor_json(
    out_path: Path,
    chosen: dict,
    waypoints: list[tuple[float, float]],
    voltage_class_label: str,
) -> None:
    payload = {
        "corridor_name": (
            f"OSM way {chosen['way_id']}"
            + (f" — {chosen['operator']}" if chosen["operator"] else "")
            + (f" {chosen['ref']}" if chosen["ref"] else "")
            + " (illustrative, OSM-derived)"
        ).strip(),
        "voltage_class": voltage_class_label,
        "total_distance_miles": round(chosen["length_m"] / 1609.344, 2),
        "source": {
            "provider": "OpenStreetMap via Overpass API",
            "way_id": chosen["way_id"],
            "tags": {
                "voltage": chosen["voltage"],
                "operator": chosen["operator"],
                "ref": chosen["ref"],
            },
        },
        "waypoints": [
            {
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "label": (
                    "Start" if i == 0
                    else "End" if i == len(waypoints) - 1
                    else f"Bend {i}"
                ),
            }
            for i, (lat, lon) in enumerate(waypoints)
        ],
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2))


def parse_bbox(s: str) -> tuple[float, float, float, float]:
    parts = [float(x) for x in s.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be 'south,west,north,east'")
    return tuple(parts)  # type: ignore[return-value]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX,
                   help="south,west,north,east (default: St. Louis metro)")
    p.add_argument("--voltage", default=None,
                   help="Substring match on OSM voltage tag, e.g. 345000")
    p.add_argument("--way-id", type=int, default=None,
                   help="Pick a specific OSM way id instead of the longest")
    p.add_argument("--target-waypoints", type=int, default=8,
                   help="Downsample dense polylines to this many points (default 8)")
    p.add_argument("--voltage-class-label", default="345kV",
                   help="Label written into corridor_waypoints.json (default 345kV — matches Domain Doc default)")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT,
                   help=f"Output path (default {DEFAULT_OUT})")
    p.add_argument("--list-only", action="store_true",
                   help="Print top candidates and exit; do not write the file")
    args = p.parse_args()

    print(f"Querying Overpass: bbox={args.bbox} voltage~{args.voltage or '(any)'}", file=sys.stderr)
    elements = query_overpass(args.bbox, args.voltage)
    if not elements:
        print("No power=line ways found in that bbox. Try a wider bbox or drop --voltage.", file=sys.stderr)
        return 1

    records = [way_to_record(el) for el in elements if el.get("geometry")]
    records.sort(key=lambda r: r["length_m"], reverse=True)

    if args.list_only:
        print(f"{'way_id':>12}  {'length_km':>9}  voltage           operator                    ref")
        for r in records[:25]:
            print(f"{r['way_id']:>12}  {r['length_m']/1000:>9.2f}  "
                  f"{(r['voltage'] or '-'):<17} {(r['operator'] or '-'):<27} {r['ref'] or '-'}")
        return 0

    if args.way_id is not None:
        chosen = next((r for r in records if r["way_id"] == args.way_id), None)
        if chosen is None:
            print(f"way_id {args.way_id} not found in result set.", file=sys.stderr)
            return 1
    else:
        chosen = records[0]

    print(f"Chose way_id={chosen['way_id']} length={chosen['length_m']/1000:.2f} km "
          f"voltage={chosen['voltage'] or '-'} operator={chosen['operator'] or '-'}", file=sys.stderr)

    waypoints = downsample(chosen["coords"], target=args.target_waypoints)
    write_corridor_json(args.out, chosen, waypoints, args.voltage_class_label)
    print(f"Wrote {args.out} with {len(waypoints)} waypoints "
          f"(corridor {chosen['length_m']/1609.344:.2f} mi).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
