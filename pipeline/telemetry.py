"""Stage 6 telemetry: load CSV, look up drone state at finding timestamps, build flight path."""

from pathlib import Path

import pandas as pd


def load_telemetry(path: Path | str) -> pd.DataFrame:
    df = pd.read_csv(path)
    return df.set_index("timestamp_seconds", drop=False).sort_index()


def lookup_at(df: pd.DataFrame, t_seconds: float) -> dict:
    t = max(df.index.min(), min(df.index.max(), int(round(t_seconds))))
    row = df.loc[t]
    return row.to_dict()


def flight_path_polyline(df: pd.DataFrame) -> list[tuple[float, float]]:
    return list(zip(df["latitude"].tolist(), df["longitude"].tolist()))
