"""Stage 1: validate that the demo video and telemetry CSV exist on disk."""

from pathlib import Path

from pipeline import config


def assert_inputs_exist() -> tuple[Path, Path]:
    if not config.CURATED_VIDEO.exists():
        raise FileNotFoundError(f"missing curated video: {config.CURATED_VIDEO}")
    if not config.TELEMETRY_CSV.exists():
        raise FileNotFoundError(f"missing telemetry CSV: {config.TELEMETRY_CSV}")
    return config.CURATED_VIDEO, config.TELEMETRY_CSV
