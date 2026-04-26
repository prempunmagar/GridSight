#!/usr/bin/env python3
"""
srt_to_csv.py — Convert a DJI drone SRT subtitle file to a GridSight telemetry CSV.

DJI embeds GPS, altitude, and flight metadata in SRT files as rich-text captions.
Two firmware generations produce slightly different tag formats; this parser handles
both and degrades gracefully when optional fields are absent.

Format A — older firmware (Phantom 4, early Mavic):
    <font size="28">SrtCnt : 1, DiffTime : 33ms
    2026-04-15 14:00:00.000
    [iso : 100] [shutter : 1/500] [fnum : 280] [ev : 0] [ct : 5500]
    [color_md : default] [focal_len : 24]
    [latitude: 38.273142] [longitude: -89.792487] [rel_alt: 39.94 abs_alt: 189.94] </font>

Format B — newer firmware (Mini 3, Mavic 3, Air 2S):
    FrameCnt : 1, DiffTime : 33ms
    2026-04-15 14:00:00.123
    [latitude(0)] [longitude(0)] [altitude(0)] [iso(0)] [shutter(0)] [fnum(0)]
    GPS(38.273142, -89.792487, 0) BAROMETER:189.94 ...

Output columns (same 11-column schema as generate_telemetry.py):
    timestamp_seconds, datetime_utc, latitude, longitude,
    altitude_m_agl, altitude_m_msl, heading_deg, pitch_deg, roll_deg,
    gimbal_pitch_deg, ground_speed_mps

Usage:
    python scripts/srt_to_csv.py INPUT.SRT [OUTPUT.csv]
    python scripts/srt_to_csv.py INPUT.SRT --out data/telemetry/demo_video_telemetry.csv
    python scripts/srt_to_csv.py INPUT.SRT --terrain-msl 150 --gimbal-pitch -45

Notes:
    * DJI SRT uses sequence numbers and timestamps embedded in frame captions, not
      standard subtitle timecodes for telemetry.  We use the SRT timecode only to
      derive `timestamp_seconds`; the embedded datetime string provides datetime_utc.
    * rel_alt / altitude fields are treated as AGL; abs_alt / BAROMETER as MSL.
      If only one altitude is available the other is estimated using --terrain-msl.
    * Heading, pitch, roll, and ground_speed are not always present in older SRTs.
      When absent, heading defaults to 0.0 (unknown) and the others to 0.0.
    * Gimbal pitch is rarely embedded; it defaults to --gimbal-pitch (default -45°).
"""

from __future__ import annotations

import argparse
import csv
import math
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA_COLUMNS = [
    "timestamp_seconds",
    "datetime_utc",
    "latitude",
    "longitude",
    "altitude_m_agl",
    "altitude_m_msl",
    "heading_deg",
    "pitch_deg",
    "roll_deg",
    "gimbal_pitch_deg",
    "ground_speed_mps",
]


# ---------------------------------------------------------------------------
# Data class for one parsed frame
# ---------------------------------------------------------------------------

@dataclass
class Frame:
    seq: int = 0
    timestamp_ms: int = 0          # from SRT timecode start
    datetime_utc: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    altitude_agl: Optional[float] = None
    altitude_msl: Optional[float] = None
    heading: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0
    gimbal_pitch: float = -45.0
    ground_speed: float = 0.0


# ---------------------------------------------------------------------------
# SRT block tokeniser
# ---------------------------------------------------------------------------

def _srt_timecode_ms(tc: str) -> int:
    """Convert 'HH:MM:SS,mmm' to milliseconds."""
    tc = tc.strip().replace(".", ",")
    h, m, rest = tc.split(":")
    s, ms = rest.split(",")
    return (int(h) * 3600 + int(m) * 60 + int(s)) * 1000 + int(ms)


def _parse_blocks(text: str) -> list[tuple[int, int, str]]:
    """Return list of (seq, start_ms, caption_text) from raw SRT text."""
    blocks = re.split(r"\n\s*\n", text.strip())
    results = []
    for block in blocks:
        lines = block.strip().splitlines()
        if len(lines) < 3:
            continue
        try:
            seq = int(lines[0].strip())
        except ValueError:
            continue
        arrow_line = lines[1].strip()
        if "-->" not in arrow_line:
            continue
        start_tc = arrow_line.split("-->")[0].strip()
        start_ms = _srt_timecode_ms(start_tc)
        caption = "\n".join(lines[2:])
        results.append((seq, start_ms, caption))
    return results


# ---------------------------------------------------------------------------
# Format A parser — [key: value] style tags
# ---------------------------------------------------------------------------

_TAG_A = re.compile(r"\[(\w+)\s*:\s*([^\]]+)\]")
_DATE_A = re.compile(r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
_REL_ALT = re.compile(r"rel_alt\s*:\s*([\-\d.]+)")
_ABS_ALT = re.compile(r"abs_alt\s*:\s*([\-\d.]+)")


def _try_parse_format_a(caption: str, frame: Frame) -> bool:
    """Attempt Format A parsing. Return True if GPS found."""
    tags: dict[str, str] = {}
    for m in _TAG_A.finditer(caption):
        tags[m.group(1).lower()] = m.group(2).strip()

    if "latitude" not in tags or "longitude" not in tags:
        return False

    frame.latitude = float(tags["latitude"])
    frame.longitude = float(tags["longitude"])

    # altitude: look for compound "rel_alt: X abs_alt: Y" inside the brackets too
    if "rel_alt" in caption.lower():
        rm = _REL_ALT.search(caption)
        am = _ABS_ALT.search(caption)
        if rm:
            frame.altitude_agl = float(rm.group(1))
        if am:
            frame.altitude_msl = float(am.group(1))
    elif "altitude" in tags:
        frame.altitude_agl = float(tags["altitude"])

    if "heading" in tags:
        frame.heading = float(tags["heading"])
    if "pitch" in tags:
        frame.pitch = float(tags["pitch"])
    if "roll" in tags:
        frame.roll = float(tags["roll"])
    if "speed" in tags:
        frame.ground_speed = float(tags["speed"])

    dm = _DATE_A.search(caption)
    if dm:
        raw = dm.group(1).replace(" ", "T")
        if "." in raw:
            raw = raw.split(".")[0]
        frame.datetime_utc = raw + "Z"

    return True


# ---------------------------------------------------------------------------
# Format B parser — GPS(lat, lon, 0) / BAROMETER:value style
# ---------------------------------------------------------------------------

_GPS_B = re.compile(r"GPS\(\s*([\-\d.]+)\s*,\s*([\-\d.]+)\s*,\s*[\-\d.]+\s*\)")
_BARO_B = re.compile(r"BAROMETER\s*:\s*([\-\d.]+)")
_DATE_B = re.compile(r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?)")
_HEADING_B = re.compile(r"(?:heading|yaw)\s*[:(]\s*([\-\d.]+)", re.IGNORECASE)
_SPEED_B = re.compile(r"(?:H\.?S|speed)\s*:\s*([\-\d.]+)", re.IGNORECASE)
_PITCH_B = re.compile(r"pitch\s*[:(]\s*([\-\d.]+)", re.IGNORECASE)
_ROLL_B = re.compile(r"roll\s*[:(]\s*([\-\d.]+)", re.IGNORECASE)


def _try_parse_format_b(caption: str, frame: Frame) -> bool:
    """Attempt Format B parsing. Return True if GPS found."""
    gm = _GPS_B.search(caption)
    if not gm:
        return False

    frame.latitude = float(gm.group(1))
    frame.longitude = float(gm.group(2))

    bm = _BARO_B.search(caption)
    if bm:
        frame.altitude_msl = float(bm.group(1))

    dm = _DATE_B.search(caption)
    if dm:
        raw = dm.group(1).replace(" ", "T")
        if "." in raw:
            raw = raw.split(".")[0]
        frame.datetime_utc = raw + "Z"

    hm = _HEADING_B.search(caption)
    if hm:
        frame.heading = float(hm.group(1))

    sm = _SPEED_B.search(caption)
    if sm:
        frame.ground_speed = float(sm.group(1))

    pm = _PITCH_B.search(caption)
    if pm:
        frame.pitch = float(pm.group(1))

    rm = _ROLL_B.search(caption)
    if rm:
        frame.roll = float(rm.group(1))

    return True


# ---------------------------------------------------------------------------
# GPS distance helper (to compute speed when not embedded)
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))


def _bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2 - lon1)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360.0) % 360.0


# ---------------------------------------------------------------------------
# Main parse function
# ---------------------------------------------------------------------------

def parse_srt(text: str, terrain_msl: float = 150.0, gimbal_pitch: float = -45.0) -> list[Frame]:
    """Parse SRT text and return a list of Frame objects, one per subtitle block."""
    blocks = _parse_blocks(text)
    frames: list[Frame] = []
    warn_no_gps = 0

    for seq, start_ms, caption in blocks:
        # Strip HTML-like font tags inserted by older DJI firmware
        clean = re.sub(r"<[^>]+>", " ", caption)

        f = Frame(seq=seq, timestamp_ms=start_ms, gimbal_pitch=gimbal_pitch)
        found = _try_parse_format_a(clean, f) or _try_parse_format_b(clean, f)

        if not found:
            warn_no_gps += 1
            continue

        # Fill in missing altitude from terrain assumption
        if f.altitude_agl is None and f.altitude_msl is not None:
            f.altitude_agl = max(0.0, f.altitude_msl - terrain_msl)
        if f.altitude_msl is None and f.altitude_agl is not None:
            f.altitude_msl = terrain_msl + f.altitude_agl
        if f.altitude_agl is None:
            f.altitude_agl = 40.0
        if f.altitude_msl is None:
            f.altitude_msl = terrain_msl + f.altitude_agl

        # If no datetime embedded, synthesise from epoch + timecode
        if not f.datetime_utc:
            epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
            dt = datetime.fromtimestamp(start_ms / 1000.0, tz=timezone.utc)
            f.datetime_utc = dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        frames.append(f)

    if warn_no_gps:
        print(f"  Warning: {warn_no_gps} blocks had no parseable GPS and were skipped.",
              file=sys.stderr)

    # Post-process: derive heading from GPS track when not embedded, fill ground_speed from distance/dt
    for i, f in enumerate(frames):
        if f.heading == 0.0 and i + 1 < len(frames):
            nxt = frames[i + 1]
            if nxt.latitude is not None and f.latitude is not None:
                f.heading = _bearing_deg(f.latitude, f.longitude, nxt.latitude, nxt.longitude)
        if f.ground_speed == 0.0 and i + 1 < len(frames):
            nxt = frames[i + 1]
            dt_s = (nxt.timestamp_ms - f.timestamp_ms) / 1000.0
            if dt_s > 0 and f.latitude is not None and nxt.latitude is not None:
                dist = _haversine_m(f.latitude, f.longitude, nxt.latitude, nxt.longitude)
                f.ground_speed = dist / dt_s

    return frames


# ---------------------------------------------------------------------------
# CSV writer
# ---------------------------------------------------------------------------

def write_csv(frames: list[Frame], out_path: Path, start_ref: Optional[str] = None) -> int:
    """Write frames to CSV; returns number of rows written."""
    if not frames:
        return 0

    # Normalise timestamps to seconds from first frame
    t0_ms = frames[0].timestamp_ms

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(SCHEMA_COLUMNS)
        for f in frames:
            t_s = (f.timestamp_ms - t0_ms) / 1000.0
            writer.writerow([
                f"{t_s:.3f}",
                f.datetime_utc,
                f"{f.latitude:.6f}",
                f"{f.longitude:.6f}",
                f"{f.altitude_agl:.2f}",
                f"{f.altitude_msl:.2f}",
                f"{f.heading:.2f}",
                f"{f.pitch:.2f}",
                f"{f.roll:.2f}",
                f"{f.gimbal_pitch:.2f}",
                f"{f.ground_speed:.2f}",
            ])
    return len(frames)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _default_output(srt_path: Path) -> Path:
    return srt_path.with_suffix(".csv")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("srt_file", type=Path, help="Input DJI .SRT file")
    p.add_argument("--out", "-o", type=Path, default=None,
                   help="Output CSV path (default: same name as input with .csv extension)")
    p.add_argument("--terrain-msl", type=float, default=150.0,
                   help="Terrain elevation in metres MSL used to estimate AGL when rel_alt absent "
                        "(default 150 — St. Louis region ~140–180 m)")
    p.add_argument("--gimbal-pitch", type=float, default=-45.0,
                   help="Fallback gimbal pitch in degrees when not embedded in SRT (default -45)")
    p.add_argument("--verbose", action="store_true",
                   help="Print one line per parsed frame to stderr")
    args = p.parse_args(argv)

    srt_path: Path = args.srt_file
    if not srt_path.exists():
        print(f"Error: file not found: {srt_path}", file=sys.stderr)
        return 1

    out_path: Path = args.out or _default_output(srt_path)

    raw = srt_path.read_text(encoding="utf-8-sig", errors="replace")
    frames = parse_srt(raw, terrain_msl=args.terrain_msl, gimbal_pitch=args.gimbal_pitch)

    if not frames:
        print("Error: no GPS frames could be parsed from the SRT file.", file=sys.stderr)
        print("  Check that the file contains DJI-style [latitude: ...] or GPS(...) tags.",
              file=sys.stderr)
        return 1

    if args.verbose:
        for f in frames:
            print(f"  t={f.timestamp_ms/1000:.1f}s  "
                  f"lat={f.latitude:.6f}  lon={f.longitude:.6f}  "
                  f"agl={f.altitude_agl:.1f}m  hdg={f.heading:.1f}°  "
                  f"spd={f.ground_speed:.1f}m/s", file=sys.stderr)

    n = write_csv(frames, out_path)
    print(f"Wrote {n} rows → {out_path}")
    print(f"Duration: {(frames[-1].timestamp_ms - frames[0].timestamp_ms) / 1000:.1f}s  "
          f"({frames[0].datetime_utc} → {frames[-1].datetime_utc})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
