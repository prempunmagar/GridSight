"""Tests for export_geojson.write_geojson."""

import json
from pathlib import Path

import pytest

from pipeline.export_geojson import write_geojson


def _finding(**overrides) -> dict:
    base = {
        "finding_id": "f001",
        "gps_lat": 38.30,
        "gps_lon": -89.80,
        "severity": "high",
        "class": "insulator_damage",
        "component_type": "insulator_string",
        "timestamp_seconds": 42.5,
    }
    base.update(overrides)
    return base


FLIGHT_PATH = [(38.27, -89.79), (38.30, -89.80), (38.34, -89.80)]


class TestWriteGeojson:
    def test_output_is_valid_json(self, tmp_path):
        out = tmp_path / "findings.geojson"
        write_geojson([_finding()], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        assert data["type"] == "FeatureCollection"

    def test_feature_count_is_findings_plus_one_linestring(self, tmp_path):
        out = tmp_path / "findings.geojson"
        findings = [_finding(finding_id=f"f{i:03d}") for i in range(3)]
        write_geojson(findings, FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        # 3 Point features + 1 LineString = 4
        assert len(data["features"]) == 4

    def test_finding_feature_is_point_geometry(self, tmp_path):
        out = tmp_path / "findings.geojson"
        write_geojson([_finding()], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        point_features = [f for f in data["features"] if f["geometry"]["type"] == "Point"]
        assert len(point_features) == 1

    def test_point_coordinates_are_lon_lat_order(self, tmp_path):
        """GeoJSON spec requires [longitude, latitude]."""
        out = tmp_path / "findings.geojson"
        write_geojson([_finding(gps_lat=38.30, gps_lon=-89.80)], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        point = next(f for f in data["features"] if f["geometry"]["type"] == "Point")
        lon, lat = point["geometry"]["coordinates"]
        assert lon == pytest.approx(-89.80)
        assert lat == pytest.approx(38.30)

    def test_gps_lat_lon_not_in_properties(self, tmp_path):
        """gps_lat and gps_lon should be encoded in geometry, not duplicated in properties."""
        out = tmp_path / "findings.geojson"
        write_geojson([_finding()], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        point = next(f for f in data["features"] if f["geometry"]["type"] == "Point")
        assert "gps_lat" not in point["properties"]
        assert "gps_lon" not in point["properties"]

    def test_finding_id_in_properties(self, tmp_path):
        out = tmp_path / "findings.geojson"
        write_geojson([_finding(finding_id="f007")], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        point = next(f for f in data["features"] if f["geometry"]["type"] == "Point")
        assert point["properties"]["finding_id"] == "f007"

    def test_flight_path_is_linestring(self, tmp_path):
        out = tmp_path / "findings.geojson"
        write_geojson([], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        lines = [f for f in data["features"] if f["geometry"]["type"] == "LineString"]
        assert len(lines) == 1
        assert lines[0]["properties"]["name"] == "flight_path"

    def test_linestring_coordinates_are_lon_lat_order(self, tmp_path):
        out = tmp_path / "findings.geojson"
        write_geojson([], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        line = next(f for f in data["features"] if f["geometry"]["type"] == "LineString")
        # First coordinate: lat=38.27, lon=-89.79 → stored as [-89.79, 38.27]
        first = line["geometry"]["coordinates"][0]
        assert first[0] == pytest.approx(-89.79)
        assert first[1] == pytest.approx(38.27)

    def test_creates_parent_dirs(self, tmp_path):
        out = tmp_path / "nested" / "out.geojson"
        write_geojson([_finding()], FLIGHT_PATH, out)
        assert out.exists()

    def test_empty_findings_still_writes_linestring(self, tmp_path):
        out = tmp_path / "empty.geojson"
        write_geojson([], FLIGHT_PATH, out)
        data = json.loads(out.read_text())
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1  # just the LineString
