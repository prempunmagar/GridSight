"""Paths, model IDs, and run-level constants for the GridSight pipeline."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = REPO_ROOT / "data"
CURATED_VIDEO = DATA_DIR / "curated" / "demo_video.mp4"
TELEMETRY_CSV = DATA_DIR / "telemetry" / "demo_video_telemetry.csv"
GROUND_TRUTH_CSV = DATA_DIR / "validation" / "ground_truth.csv"
CLIPS_WORKING_DIR = DATA_DIR / "clips_working"

OUT_DIR = REPO_ROOT / "out"
APP_PUBLIC_DIR = REPO_ROOT / "app" / "public"
APP_DATA_DIR = APP_PUBLIC_DIR / "data"
APP_CLIPS_DIR = APP_PUBLIC_DIR / "clips"

AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET = os.getenv("S3_BUCKET")
BEDROCK_MARENGO_MODEL_ID = os.getenv("BEDROCK_MARENGO_MODEL_ID")
BEDROCK_PEGASUS_MODEL_ID = os.getenv("BEDROCK_PEGASUS_MODEL_ID")

CLIP_DURATION_SECONDS = 15
DEDUP_WINDOW_SECONDS = 10
DEFAULT_VOLTAGE_CLASS = "345kV"
