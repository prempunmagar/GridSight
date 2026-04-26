"""Tests for export_csv.write_csv."""

import csv
import io
from pathlib import Path

import pytest

from pipeline.export_csv import write_csv, CSV_COLUMNS


def _finding(**overrides) -> dict:
    base = {
        "finding_id": "f001",
        "timestamp_seconds": 42.5,
        "gps_lat": 38.30,
        "gps_lon": -89.80,
        "altitude_m_agl": 40.0,
        "heading_deg": 357.0,
        "ground_speed_mps": 10.2,
        "class": "insulator_damage",
        "component_type": "insulator_string",
        "condition": "damaged",
        "specific_defects": ["cracked disk", "rust streak"],
        "vegetation_distance_estimate_ft": None,
        "severity": "high",
        "combined_confidence": "medium",
        "marengo_score": 0.18,
        "pegasus_confidence": "high",
        "needs_human_review": False,
        "nerc_citation": None,
        "evidence_clip_path": "/clips/f001.mp4",
        "discovery_source": "anomaly_query",
    }
    base.update(overrides)
    return base


class TestWriteCsv:
    def test_creates_file_with_header(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding()], out)
        assert out.exists()
        rows = list(csv.DictReader(out.open()))
        assert set(CSV_COLUMNS) <= set(rows[0].keys())

    def test_one_finding_produces_one_data_row(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding()], out)
        rows = list(csv.DictReader(out.open()))
        assert len(rows) == 1

    def test_multiple_findings_all_written(self, tmp_path):
        out = tmp_path / "test.csv"
        findings = [_finding(finding_id=f"f{i:03d}") for i in range(5)]
        write_csv(findings, out)
        rows = list(csv.DictReader(out.open()))
        assert len(rows) == 5

    def test_list_field_serialised_as_semicolon_joined(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding(specific_defects=["crack", "rust"])], out)
        row = next(csv.DictReader(out.open()))
        assert row["specific_defects"] == "crack; rust"

    def test_none_serialised_as_empty_string(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding(nerc_citation=None, vegetation_distance_estimate_ft=None)], out)
        row = next(csv.DictReader(out.open()))
        assert row["nerc_citation"] == ""
        assert row["vegetation_distance_estimate_ft"] == ""

    def test_empty_defects_list_serialised_as_empty_string(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding(specific_defects=[])], out)
        row = next(csv.DictReader(out.open()))
        assert row["specific_defects"] == ""

    def test_creates_parent_dirs(self, tmp_path):
        out = tmp_path / "nested" / "dir" / "out.csv"
        write_csv([_finding()], out)
        assert out.exists()

    def test_empty_findings_list_produces_header_only(self, tmp_path):
        out = tmp_path / "empty.csv"
        write_csv([], out)
        lines = out.read_text().splitlines()
        assert len(lines) == 1
        assert lines[0].startswith("finding_id")

    def test_column_order_matches_schema(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding()], out)
        header = out.read_text().splitlines()[0].split(",")
        assert header == CSV_COLUMNS

    def test_severity_value_written_correctly(self, tmp_path):
        out = tmp_path / "test.csv"
        write_csv([_finding(severity="critical")], out)
        row = next(csv.DictReader(out.open()))
        assert row["severity"] == "critical"
