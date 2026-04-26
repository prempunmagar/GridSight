"""Stage 7: write out/findings.geojson — Points for findings + LineString for the flight path."""

import json
from pathlib import Path


def write_geojson(findings: list[dict], flight_path_coords: list[tuple[float, float]],
                  out_path: Path) -> None:
    features = []
    for fnd in findings:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [fnd["gps_lon"], fnd["gps_lat"]],
            },
            "properties": {k: v for k, v in fnd.items() if k not in ("gps_lon", "gps_lat")},
        })
    features.append({
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [[lon, lat] for (lat, lon) in flight_path_coords],
        },
        "properties": {"name": "flight_path"},
    })

    payload = {"type": "FeatureCollection", "features": features}
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
