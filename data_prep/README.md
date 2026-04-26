# `data_prep/` — Demo Input Preparation

This directory holds scripts and supporting files that **produce the demo's input data** — the curated video, the simulated drone telemetry, and the manual anomaly labels that GridSight's pipeline ingests at runtime.

It is **deliberately separate** from `pipeline/` and `scripts/` because the work in here is not part of the GridSight product. The product is the pipeline that ingests standard drone inspection inputs (a video file + a per-second telemetry CSV). What lives here is one specific instance of those inputs, manufactured for the hackathon demo because YouTube footage doesn't carry GPS telemetry and our hackathon cut doesn't come pre-labeled.

In production, none of this would exist — a real drone produces the video and telemetry during the inspection flight, and a human inspector applies labels in the utility's existing workflow.

## What's in here

| File | Purpose |
|---|---|
| `curate_video.py` | Stitches selected YouTube segments into the canonical 25-min `data/curated/demo_video.mp4` |
| `generate_telemetry.py` | Reads `corridor_waypoints.json` and produces the per-second `data/telemetry/demo_video_telemetry.csv` |
| `corridor_waypoints.json` | The waypoint list defining the simulated transmission corridor the drone "flew" |
| `label_validation.py` | Optional helper for producing `data/validation/ground_truth.csv` |

Outputs from these scripts land in `data/`, not here. The split: code that *produces* demo inputs lives in `data_prep/`; the demo input *files themselves* live in `data/`.

## Where to read more

- **What to deliver and how:** [`docs/08_EXTERNAL_DATA_HANDOFF.md`](../docs/08_EXTERNAL_DATA_HANDOFF.md) — the coordination doc for the team working in this directory.
- **Why this is separate, framed for judges:** [`docs/01_MASTER.md`](../docs/01_MASTER.md) Section 8.1 — the "real format, simulated values" explanation.
- **Search strategy and quality criteria for footage:** [`docs/04_DATA_BRIEF.md`](../docs/04_DATA_BRIEF.md).
- **Severity rules for validation labeling:** [`docs/05_DOMAIN_KNOWLEDGE.md`](../docs/05_DOMAIN_KNOWLEDGE.md) Sections 3 and 4.

## Working in here

Structure scripts however helps you work — there's no required layout beyond keeping `corridor_waypoints.json` so your work is reproducible. Branch off `main`, commit early, push when ready. The curated video file is gitignored (large) and gets handed to the project lead out-of-band; everything else is committed.

If you're picking up this directory cold, start with [`docs/08_EXTERNAL_DATA_HANDOFF.md`](../docs/08_EXTERNAL_DATA_HANDOFF.md). It has the schemas, the deliverables, and the things to ping the project lead about.
