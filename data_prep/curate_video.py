#!/usr/bin/env python3
"""
curate_video.py — Build the canonical demo video for GridSight.

Two phases, run end-to-end by default:

  1. DOWNLOAD: pull source clips from the URL list below via yt-dlp into
     a local scratch directory (raw_clips/ next to this script).
  2. STITCH:   re-encode each clip to 1920x1080 / 30fps H.264+AAC,
     proportionally trim to hit --target-minutes, and concat into
     ../data/curated/demo_video.mp4.

The output video is the demo input the GridSight pipeline ingests at runtime.
See ./README.md and ../docs/04_DATA_BRIEF.md for context.

Requirements
------------
    pip install yt-dlp
    ffmpeg + ffprobe on PATH

Pexels URLs need a cookies.txt (set PEXELS_COOKIES_FILE below). YouTube and
Pixabay download unauthenticated.

Usage
-----
    python curate_video.py
    python curate_video.py --skip-download              # re-stitch only
    python curate_video.py --skip-stitch                # download only
    python curate_video.py --target-minutes 30 --crf 20
"""

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

# ── Source URLs ───────────────────────────────────────────────────────────────
URLS = [
    "https://www.youtube.com/watch?v=kaddpPYnDlU",
]

# Netscape-format cookies for Pexels (export after logging into pexels.com).
# Leave empty to skip Pexels auth.
PEXELS_COOKIES_FILE = "pexels_cookies.txt"

# ── Defaults ──────────────────────────────────────────────────────────────────
SCRIPT_DIR    = Path(__file__).resolve().parent
RAW_DIR       = SCRIPT_DIR.parent / "data" / "raw"
PROCESSED_DIR = SCRIPT_DIR.parent / "data" / "raw" / "processed"
OUTPUT_FILE   = SCRIPT_DIR.parent / "data" / "curated" / "demo_video.mp4"

DOWNLOAD_CAP_MINUTES = 60.0   # ~2x target gives slack for trimming
TARGET_MINUTES       = 25.0

TARGET_W      = 1920
TARGET_H      = 1080
TARGET_FPS    = 30
VIDEO_CODEC   = "libx264"
AUDIO_CODEC   = "aac"
AUDIO_BITRATE = "192k"
CRF           = 18           # 0-51; 18 is visually near-lossless for H.264
PRESET        = "slow"


# ── ffprobe helpers ───────────────────────────────────────────────────────────

def get_duration(path: str) -> float:
    """Return media duration in seconds via ffprobe."""
    result = subprocess.run(
        ["ffprobe", "-v", "error",
         "-show_entries", "format=duration",
         "-of", "json", path],
        capture_output=True, text=True, check=True,
    )
    return float(json.loads(result.stdout)["format"]["duration"])


def total_mp4_seconds(directory: Path) -> float:
    """Sum durations of all .mp4 files in *directory*."""
    total = 0.0
    if not directory.exists():
        return total
    for fpath in sorted(directory.glob("*.mp4")):
        try:
            total += get_duration(str(fpath))
        except Exception:
            pass
    return total


# ── Phase 1: download ─────────────────────────────────────────────────────────

def download(raw_dir: Path, max_minutes: float) -> None:
    try:
        import yt_dlp
    except ImportError:
        sys.exit("ERROR: yt-dlp is not installed.  Run:  pip install yt-dlp")

    raw_dir.mkdir(parents=True, exist_ok=True)
    max_seconds = max_minutes * 60.0

    base_opts = {
        "format": (
            "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]"
            "/bestvideo[height<=1080]+bestaudio"
            "/best[height<=1080]"
        ),
        "merge_output_format": "mp4",
        "outtmpl": str(raw_dir / "%(title)s [%(id)s].%(ext)s"),
        "restrictfilenames": False,
        "noplaylist": True,
        "quiet": False,
        "no_warnings": False,
        "ignoreerrors": True,
    }

    for i, url in enumerate(URLS, 1):
        current = total_mp4_seconds(raw_dir)
        print(
            f"\n[{i}/{len(URLS)}]  Accumulated: {current/60:.1f} min / "
            f"{max_minutes:.0f} min cap"
        )
        if current >= max_seconds:
            print("  Reached the cap — stopping early.")
            break

        ydl_opts = dict(base_opts)
        if "pexels.com" in url and PEXELS_COOKIES_FILE:
            ydl_opts["cookiefile"] = PEXELS_COOKIES_FILE
        elif "pexels.com" in url:
            print("  ! Pexels URL with no PEXELS_COOKIES_FILE — may fail or "
                  "return low-res.")

        print(f"  Downloading: {url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

    final = total_mp4_seconds(raw_dir)
    clip_count = len(list(raw_dir.glob("*.mp4")))
    print(
        f"\nDownload phase complete: {clip_count} clip(s), "
        f"{final/60:.1f} min total in {raw_dir}"
    )


# ── Phase 2: stitch ───────────────────────────────────────────────────────────

def reencode_clip(src: Path, dst: Path, trim_duration: float | None,
                  crf: int, preset: str) -> None:
    """
    Re-encode *src* to 1920x1080 / 30fps H.264+AAC at *dst*.

    Scales to fit inside the target frame (preserves aspect), pads with black
    bars, normalises frame rate. If *trim_duration* is given, keeps only the
    first N seconds of input.
    """
    vf = (
        f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=decrease,"
        f"pad={TARGET_W}:{TARGET_H}:(ow-iw)/2:(oh-ih)/2,"
        f"fps={TARGET_FPS}"
    )

    cmd = ["ffmpeg", "-y", "-i", str(src)]
    if trim_duration is not None:
        cmd += ["-t", f"{trim_duration:.3f}"]
    cmd += [
        "-vf", vf,
        "-c:v", VIDEO_CODEC, "-crf", str(crf), "-preset", preset,
        "-c:a", AUDIO_CODEC, "-b:a", AUDIO_BITRATE,
        "-movflags", "+faststart",
        str(dst),
    ]

    label = src.name
    if trim_duration:
        label += f"  ->  trim to {trim_duration:.1f}s"
    print(f"  Encoding: {label}")
    subprocess.run(cmd, check=True, stderr=subprocess.DEVNULL)


def stitch(raw_dir: Path, processed_dir: Path, output_path: Path,
           target_minutes: float, crf: int, preset: str) -> None:
    target_secs = target_minutes * 60.0

    # Sort alphabetically so clips from the same source channel sit together;
    # hard cuts between visually similar footage are far less jarring.
    clip_files = sorted(raw_dir.glob("*.mp4"), key=lambda p: p.name.lower())
    if not clip_files:
        sys.exit(
            f"ERROR: No .mp4 files found in '{raw_dir}'. "
            "Run without --skip-download first."
        )

    print(f"\nFound {len(clip_files)} clip(s) in '{raw_dir}'.")
    print("\nInspecting clips ...")
    durations: dict[Path, float] = {}
    total_raw = 0.0
    for p in clip_files:
        try:
            d = get_duration(str(p))
            durations[p] = d
            total_raw += d
            print(f"  {p.name[:70]:<70}  {d/60:5.1f} min")
        except subprocess.CalledProcessError as exc:
            print(f"  x Skipping (ffprobe error): {p.name}  -- {exc}")

    valid_clips = [p for p in clip_files if p in durations]
    if not valid_clips:
        sys.exit("ERROR: No clips could be read by ffprobe.")

    print(f"\n  Total raw footage : {total_raw/60:.1f} min")
    print(f"  Target            : {target_secs/60:.1f} min")

    if total_raw <= target_secs:
        print(f"\n  Raw footage is at/below target — using all clips in full.")
        trim_map: dict[Path, float | None] = {p: None for p in valid_clips}
    else:
        ratio = target_secs / total_raw
        trim_map = {p: math.floor(durations[p] * ratio) for p in valid_clips}
        print(f"\n  Proportional trim: keeping {ratio*100:.1f}% of each clip.")
        for p, t in trim_map.items():
            if t is not None and t < 1:
                print(f"  ! {p.name} trimmed to <1s — including in full instead.")
                trim_map[p] = None

    processed_dir.mkdir(parents=True, exist_ok=True)
    print(f"\nRe-encoding to {TARGET_W}x{TARGET_H} / {TARGET_FPS}fps ...")

    processed_clips: list[Path] = []
    for i, src in enumerate(valid_clips):
        stem = src.stem[:60]
        dst = processed_dir / f"{i:03d}_{stem}.mp4"
        try:
            reencode_clip(src, dst, trim_map[src], crf, preset)
            processed_clips.append(dst)
        except subprocess.CalledProcessError as exc:
            print(f"  x Encoding failed for {src.name}: {exc}")

    if not processed_clips:
        sys.exit("ERROR: No clips were successfully encoded.")

    concat_list = processed_dir / "concat_list.txt"
    with open(concat_list, "w", encoding="utf-8") as fh:
        for clip in processed_clips:
            # ffmpeg concat demuxer needs forward slashes and escaped quotes
            safe = str(clip.resolve()).replace("\\", "/").replace("'", r"'\''")
            fh.write(f"file '{safe}'\n")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"\nConcatenating {len(processed_clips)} clip(s) -> {output_path} ...")
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
         "-i", str(concat_list), "-c", "copy", str(output_path)],
        check=True,
    )

    final_dur = get_duration(str(output_path))
    size_mb = output_path.stat().st_size / (1024 ** 2)
    print(
        f"\n{'='*60}\n"
        f"Stitch complete.\n"
        f"  Output      : {output_path.resolve()}\n"
        f"  Duration    : {final_dur/60:.2f} min  ({final_dur:.0f} s)\n"
        f"  File size   : {size_mb:.0f} MB\n"
        f"  Resolution  : {TARGET_W}x{TARGET_H} @ {TARGET_FPS}fps\n"
        f"  Clips used  : {len(processed_clips)}\n"
    )


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Download and stitch transmission tower drone clips into "
                    "the canonical GridSight demo video."
    )
    parser.add_argument("--raw-dir",        default=str(RAW_DIR),
                        help=f"Scratch dir for downloaded clips (default: {RAW_DIR})")
    parser.add_argument("--processed-dir",  default=str(PROCESSED_DIR),
                        help=f"Scratch dir for re-encoded clips (default: {PROCESSED_DIR})")
    parser.add_argument("--output",         default=str(OUTPUT_FILE),
                        help=f"Final stitched video (default: {OUTPUT_FILE})")
    parser.add_argument("--download-cap-minutes", type=float,
                        default=DOWNLOAD_CAP_MINUTES,
                        help=f"Stop downloading after this many minutes on disk "
                             f"(default: {DOWNLOAD_CAP_MINUTES:.0f})")
    parser.add_argument("--target-minutes", type=float, default=TARGET_MINUTES,
                        help=f"Final stitched duration in minutes "
                             f"(default: {TARGET_MINUTES:.0f})")
    parser.add_argument("--crf",            type=int, default=CRF,
                        help=f"H.264 CRF — lower = higher quality (default: {CRF})")
    parser.add_argument("--preset",         default=PRESET,
                        help=f"ffmpeg encoding preset (default: {PRESET})")
    parser.add_argument("--skip-download",  action="store_true",
                        help="Skip phase 1; stitch existing files in --raw-dir")
    parser.add_argument("--skip-stitch",    action="store_true",
                        help="Skip phase 2; download only")
    args = parser.parse_args()

    raw_dir       = Path(args.raw_dir)
    processed_dir = Path(args.processed_dir)
    output_path   = Path(args.output)

    if not args.skip_download:
        download(raw_dir, args.download_cap_minutes)

    if not args.skip_stitch:
        stitch(raw_dir, processed_dir, output_path,
               args.target_minutes, args.crf, args.preset)


if __name__ == "__main__":
    main()
