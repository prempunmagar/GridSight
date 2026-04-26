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

    # Write to a temp path then atomically replace so a concurrent reader
    # (e.g. dashboard <video> tag holding the previous file open) does not
    # cause ffmpeg to fail silently when overwriting on Windows.
    tmp_path = out_path.with_suffix(f".tmp-{finding_id}.mp4")
    cmd = [
        "ffmpeg", "-y", "-nostdin", "-loglevel", "warning",
        "-ss", f"{start:.2f}",
        "-i", str(video_path),
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "veryfast",
        "-b:v", "2M", "-pix_fmt", "yuv420p",
        "-an",
        "-movflags", "+faststart",
        str(tmp_path),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        tmp_path.unlink(missing_ok=True)
        msg = (
            f"ffmpeg failed for {finding_id} @ {center_seconds:.1f}s "
            f"(returncode={result.returncode}); "
            f"stderr={result.stderr.strip() or '(empty)'}; "
            f"stdout={result.stdout.strip() or '(empty)'}"
        )
        raise RuntimeError(msg)
    if not tmp_path.exists() or tmp_path.stat().st_size == 0:
        raise RuntimeError(
            f"ffmpeg reported success for {finding_id} but output is missing/empty: {tmp_path}"
        )
    tmp_path.replace(out_path)
    return out_path
