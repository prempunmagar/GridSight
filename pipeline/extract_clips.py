"""Stage 4: extract evidence clips around candidate timestamps via ffmpeg."""

import subprocess
from pathlib import Path

from pipeline import config


def extract_clip(video_path: Path, center_seconds: float, finding_id: str,
                 out_dir: Path, duration: int = config.CLIP_DURATION_SECONDS) -> Path:
    """Extract a clip centered on `center_seconds`, write `{finding_id}.mp4` to out_dir."""
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{finding_id}.mp4"
    start = max(0.0, center_seconds - duration / 2)

    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-ss", f"{start:.2f}",
        "-i", str(video_path),
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "2M", "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for {finding_id} @ {center_seconds:.1f}s: {result.stderr}")
    return out_path
