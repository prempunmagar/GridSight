"""Sanity-check ground_truth.csv schema + value sets per 08_EXTERNAL_DATA_HANDOFF.md."""

import sys
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "validation" / "ground_truth.csv"
VIDEO_DURATION_SECONDS = 813  # ffprobe on data/curated/demo_video.mp4

EXPECTED_COLUMNS = ["id", "start_seconds", "end_seconds", "class", "severity", "description", "notes"]
ALLOWED_CLASSES = {"insulator_damage", "vegetation_encroachment", "other"}
ALLOWED_SEVERITIES = {"critical", "high", "moderate", "low"}

df = pd.read_csv(CSV_PATH)
df["severity"] = df["severity"].str.strip()
df["class"] = df["class"].str.strip()
errors = []

missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
if missing:
    errors.append(f"missing columns: {missing}")

bad_class = set(df["class"]) - ALLOWED_CLASSES
if bad_class:
    errors.append(f"unknown class values: {bad_class}")

bad_sev = set(df["severity"]) - ALLOWED_SEVERITIES
if bad_sev:
    errors.append(f"unknown severity values: {bad_sev}")

if (df["start_seconds"] >= df["end_seconds"]).any():
    errors.append("rows with start_seconds >= end_seconds")

if (df["end_seconds"] > VIDEO_DURATION_SECONDS).any():
    errors.append(f"rows with end_seconds > video duration ({VIDEO_DURATION_SECONDS}s)")

print(f"rows: {len(df)}")
print(f"class distribution:    {df['class'].value_counts().to_dict()}")
print(f"severity distribution: {df['severity'].value_counts().to_dict()}")

if errors:
    print("\nFAIL:")
    for e in errors:
        print(f"  - {e}")
    sys.exit(1)

print("\nPASS")
