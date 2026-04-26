# GridSight

> **AI-powered transmission line inspection. Drone footage in → georeferenced findings out.**
>
> Geospatial Video Intelligence Hackathon · St. Louis · April 25–26, 2026 · Track 02 · Workflow 02

---

## What this is
## Executive Summary

GridSight processes drone footage of high-voltage transmission lines and detects two anomaly classes: **damaged insulators** and **vegetation encroachment**. It uses TwelveLabs Marengo 3.0 and Pegasus 1.2 via AWS Bedrock, attaches GPS from a companion drone telemetry file, and produces a Next.js dashboard with map view, evidence clips, and CSV/GeoJSON exports.
GridSight is an automated pipeline that processes standard drone inspection inputs (video footage and telemetry data) to detect and locate critical vulnerabilities on high-voltage transmission lines. 

Full project context is in [`docs/01_MASTER.md`](docs/01_MASTER.md). Don't start working without reading at least Sections 1–5 of that doc.
Built on TwelveLabs Marengo 3.0 and Pegasus 1.2 via AWS Bedrock, GridSight targets two specific, regulation-grounded anomaly classes: **damaged insulators** and **vegetation encroachment** (anchored to NERC FAC-003 standards). It produces a Next.js dashboard featuring a map view, telemetry inspector, click-to-play evidence clips, and enterprise-ready CSV/GeoJSON exports.

**This is an operations console, not a video gallery.** It turns hours of tedious frame-by-frame human review into an actionable, georeferenced list of verifiable findings.

---

## Run the dashboard (no AWS needed)
## Architecture at a Glance

If you just want to see the finished product:
GridSight operates via a decoupled batch-processing architecture. The Python pipeline runs once, processes the video/telemetry, and writes static JSON and MP4 evidence clips to disk. The Next.js dashboard reads these static files at startup. 

This deliberate separation means **anyone can clone this repo and run the dashboard immediately without AWS credentials**. 

* **Stage 1: Ingest** — Loads 1080p drone footage and per-second CSV telemetry (parsed directly from a DJI SRT file).
* **Stage 2: Index** — Makes the video semantically searchable via TwelveLabs Marengo.
* **Stage 3: Detect** — Uses natural-language queries to flag candidate moments of damage or encroachment.
* **Stage 4: Extract** — Slices 12-second evidence clips around candidate timestamps via `ffmpeg`.
* **Stage 5: Describe** — Uses TwelveLabs Pegasus to generate structured JSON condition assessments for each clip.
* **Stage 6: Score & Locate** — Applies an automated NERC-grounded severity rules engine and attaches exact GPS coordinates/heading/altitude from the telemetry sync.
* **Stage 7: Export** — Emits CSV, GeoJSON, and the static dashboard assets.

---

## Deliberate Scope & Anti-Goals

To deliver a reliable, judge-ready system in 24 hours, we made explicit trade-offs. We are not shy about what we scoped out:

1. **Asset-Centric, Not Anomaly-Only:** Pegasus acts as a describer, not a filter. If Marengo flags an asset but Pegasus determines it is `intact`, we keep the record as a `no_action` finding. This honestly exposes our false-positive surface and provides a substrate for full-inventory asset monitoring.
2. **No API Layer:** There is no live Python backend or database running behind the dashboard. It is a pure static-file contract. This eliminates runtime crashes on demo day.
3. **Focused Anomaly Classes:** We strictly limited detection to Insulator Damage and Vegetation Encroachment on Lattice Steel Suspension Towers. We intentionally ignored tower corrosion, conductor strand damage, and wood poles to ensure our severity grading remained robust.
4. **No Sub-Meter GPS Illusions:** We target ±50m accuracy relative to the drone's position, which is entirely sufficient for work-order routing.

---

## Judging Guide: Where to look

| Document | What it covers |
|---|---|
| **`docs/TECH.md`** | **Start Here.** A 2-page summary of our TwelveLabs integration strategy, prompt engineering, and performance limitations. |
| **`docs/06_VALIDATION_REPORT.md`** | Precision, recall, F1 metrics, confusion matrix, and an honest analysis of our false positives. |
| `docs/01_MASTER.md` | The complete source of truth on system architecture and project decisions. |
| `docs/05_DOMAIN_KNOWLEDGE.md` | Our NERC FAC-003 regulatory grounding and severity rule definitions. |

---

## Quickstart: Run the Dashboard (No AWS needed)

To see the finished product with the canonical pipeline output:

```bash
cd app
npm install
npm run dev
# Open http://localhost:3000
```

The dashboard reads pre-computed pipeline output from `app/public/data/`. No AWS credentials, no API calls.

## Run the full pipeline (AWS Bedrock required)

If you're iterating on detection or running on new footage:

```bash
# Setup
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with AWS credentials

# Verify Bedrock works
python examples/bedrock_smoke_test.py

# At this point, the demo's input data should already be in the repo:
#   data/curated/demo_video.mp4    (out-of-band, gitignored — get from data prep team)
#   data/telemetry/*.csv           (committed)
#   data/validation/ground_truth.csv (committed)
# See docs/08_EXTERNAL_DATA_HANDOFF.md for what the data prep team produces.

# Run the full pipeline
python pipeline/run_all.py

# OR run this from the repo root
python -m pipeline.run_all

# View results
cd app && npm run dev
```

Detailed dev workflows in [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) Section 6.

---

## Where to start, by role

If you're working on...

| Task | Read these, in order |
|---|---|
| **Anything** (start here) | [`docs/01_MASTER.md`](docs/01_MASTER.md) Sections 1–5, then [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Phase you're working on |
| **AWS Bedrock setup** | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Phase 1 Task 1 |
| **Data prep workstream** (footage, telemetry, labeling) | [`docs/08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) — entire doc; then [`docs/04_DATA_BRIEF.md`](docs/04_DATA_BRIEF.md) for substantive guidance |
| **Footage hunting** (subset of data prep) | [`docs/08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) Deliverable 1, then [`docs/04_DATA_BRIEF.md`](docs/04_DATA_BRIEF.md) Sections 2, 3, 4 |
| **Validation labeling** (subset of data prep) | [`docs/08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) Deliverable 3 (with worked examples), then [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Sections 3, 4 |
| **Telemetry generation** (subset of data prep) | [`docs/08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) Deliverable 2, then [`docs/04_DATA_BRIEF.md`](docs/04_DATA_BRIEF.md) Section 5 |
| **Domain rubric / NERC numbers** | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) — entire doc |
| **Pipeline modules** | [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) Sections 1, 2, 8 |
| **Next.js dashboard** | [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) Sections 2, 3 (TypeScript schemas) |
| **Severity scoring** | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Section 5 (the literal spec) |

---

## Documents

All planning and reference documents are in [`docs/`](docs/):

| File | Purpose |
|---|---|
| [`01_MASTER.md`](docs/01_MASTER.md) | Source of truth for what GridSight is, scope, architecture, decisions log |
| [`02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) | Six-phase execution playbook with exit criteria and decision gates |
| [`03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) | Directory layout, pipeline-dashboard contract, gitignore, dev workflows |
| [`04_DATA_BRIEF.md`](docs/04_DATA_BRIEF.md) | What the data prep workstream produces and why: search strategy, quality criteria, curation workflow, corridor selection logic |
| [`05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) | NERC FAC-003-4 MVCD numbers, insulator failure modes, severity rules |
| [`08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) | Operational contract for the data prep team: deliverables, schemas, worked examples |

The following docs get written **during** the build:

- `06_VALIDATION_REPORT.md` — Phase 5 output (precision/recall/F1, confusion matrix, FP analysis)
- `07_OPERATIONAL_IMPACT.md` — Phase 5 output (one-page ROI brief)
- `TECH.md` — Phase 6 condensed tech doc for judges

---

## Status

**Phase 1 — Foundations.** See [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) for current phase exit criteria.

When the phase changes, update the line above and append progress notes to [`docs/01_MASTER.md`](docs/01_MASTER.md) Section 13 (Decisions Log) if anything was decided that affects the rest of the build.

---

## When something goes wrong

| Symptom | First check |
|---|---|
| Bedrock auth fails | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Phase 1 Task 1 — escalate immediately, don't work around |
| Pegasus returns malformed JSON | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Phase 3 Task 4 — fallback parser, prompt iteration |
| Marengo recall is poor | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Decision Gate 2 |
| "Where does this file go?" | [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) Section 8 |
| "Is this a Class A finding?" | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Section 3 |
| "What's the MVCD threshold?" | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Section 4.3 — Table 2 |
| Scope creep argument | [`docs/01_MASTER.md`](docs/01_MASTER.md) Section 4.2 (anti-goals) and Section 13 (decisions log) |

---

## House rules

- **Decisions logged in [`docs/01_MASTER.md`](docs/01_MASTER.md) Section 13 don't get relitigated.** New information can produce new decisions; opinions don't.
- **Phase exit criteria are not optional.** Don't start Phase N+1 before Phase N's exit criteria are checked off.
- **Decision Gate 3 is a hard rule.** If the core pipeline isn't working Sunday morning, Workflow 03 stretch is abandoned. Not a debate.
- **Anti-goals in [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) ("things we do NOT do") are real.** If a teammate proposes one, the answer is no unless the planning docs are reopened.
