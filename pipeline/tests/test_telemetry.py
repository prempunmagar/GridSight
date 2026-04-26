import pandas as pd
import pytest

from pipeline.telemetry import flight_path_polyline, load_telemetry, lookup_at


@pytest.fixture
def sample_csv(tmp_path):
    path = tmp_path / "telemetry.csv"
    pd.DataFrame({
        "timestamp_seconds": [0, 1, 2, 3],
        "datetime_utc": ["2026-04-15T14:00:00Z"] * 4,
        "latitude": [38.27, 38.28, 38.29, 38.30],
        "longitude": [-89.79, -89.80, -89.81, -89.82],
        "altitude_m_agl": [40.0, 40.1, 40.2, 40.3],
        "altitude_m_msl": [190.0, 190.1, 190.2, 190.3],
        "heading_deg": [271.0, 272.0, 273.0, 274.0],
        "pitch_deg": [0.0] * 4,
        "roll_deg": [0.0] * 4,
        "gimbal_pitch_deg": [-44.0] * 4,
        "ground_speed_mps": [10.0] * 4,
    }).to_csv(path, index=False)
    return path


def test_load_telemetry_indexes_by_timestamp(sample_csv):
    df = load_telemetry(sample_csv)
    assert df.index.name == "timestamp_seconds"
    assert list(df.index) == [0, 1, 2, 3]


def test_lookup_at_exact_timestamp(sample_csv):
    df = load_telemetry(sample_csv)
    row = lookup_at(df, 2)
    assert row["latitude"] == 38.29
    assert row["heading_deg"] == 273.0


def test_lookup_at_fractional_rounds_to_nearest(sample_csv):
    df = load_telemetry(sample_csv)
    assert lookup_at(df, 1.4)["latitude"] == 38.28
    assert lookup_at(df, 1.6)["latitude"] == 38.29


def test_lookup_at_clips_out_of_range(sample_csv):
    df = load_telemetry(sample_csv)
    assert lookup_at(df, -100)["latitude"] == 38.27
    assert lookup_at(df, 1_000_000)["latitude"] == 38.30


def test_flight_path_polyline_preserves_order(sample_csv):
    df = load_telemetry(sample_csv)
    path = flight_path_polyline(df)
    assert path[0] == (38.27, -89.79)
    assert path[-1] == (38.30, -89.82)
    assert len(path) == 4
