"""Sanity-check the demo telemetry CSV against the schema in 08_EXTERNAL_DATA_HANDOFF.md."""

import sys
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "telemetry" / "demo_video_telemetry.csv"
EXPECTED_COLUMNS = [
    "timestamp_seconds", "datetime_utc", "latitude", "longitude",
    "altitude_m_agl", "altitude_m_msl", "heading_deg",
    "pitch_deg", "roll_deg", "gimbal_pitch_deg", "ground_speed_mps",
]

df = pd.read_csv(CSV_PATH)
errors = []

missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
if missing:
    errors.append(f"missing columns: {missing}")

ts = df["timestamp_seconds"].to_numpy()
if (ts != range(len(ts))).any():
    errors.append("timestamp_seconds is not contiguous 0..N-1")

if not df["latitude"].between(24, 50).all() or not df["longitude"].between(-125, -66).all():
    errors.append("lat/lon outside continental US")

if not df["altitude_m_agl"].between(0, 200).all():
    errors.append("altitude_m_agl outside plausible drone range (0-200m)")

print(f"rows: {len(df)}  duration: {len(df)}s ({len(df)/60:.1f} min)")
print(f"corridor start: ({df.iloc[0]['latitude']:.4f}, {df.iloc[0]['longitude']:.4f})")
print(f"corridor end:   ({df.iloc[-1]['latitude']:.4f}, {df.iloc[-1]['longitude']:.4f})")
print(f"altitude range: {df['altitude_m_agl'].min():.1f}-{df['altitude_m_agl'].max():.1f} m AGL")

if errors:
    print("\nFAIL:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("\nPASS")
