# GridSight — Technical Documentation

> Condensed technical reference for the Geospatial Video Intelligence Hackathon (April 25–26, 2026), Track 02.
> For the full architectural source-of-truth, see [`01_MASTER.md`](docs/01_MASTER.md). This document is the two-page summary judges read if they don't read the Master Doc.

---

## What GridSight is

GridSight is an automated visual inspection pipeline for high-voltage transmission infrastructure. It ingests the two standard outputs of any drone inspection — a video file and its companion per-second telemetry stream — and produces georeferenced, severity-scored findings ready for utility work-order systems.

**Two anomaly classes:** insulator damage and vegetation encroachment.
**Asset target:** lattice steel suspension towers carrying high-voltage AC transmission lines (345 kV default, voltage-class agnostic; the canonical demo run uses 345 kV / MVCD 4.3 ft).
**Regulatory grounding:** NERC FAC-003-4 for vegetation clearance distances; industry references for insulator failure modes.
**Outputs:** CSV, GeoJSON, PDF report, plus a Next.js dashboard with map view, severity-coded finding pins, and 15-second evidence clip playback.

---

## 1. System Architecture

The pipeline is a seven-stage linear flow with two parallel inputs. Each stage has a defined input/output contract so stages can be developed and tested independently.

```
┌────────────────────────────┐  ┌─────────────────────────────────┐
│   demo_video.mp4           │  │   demo_video_telemetry.csv      │
│   (curated 1080p, 13:32)   │  │   (per-second GPS + altitude    │
│                            │  │    + heading; DJI-SRT-compat)   │
└────────────┬───────────────┘  └─────────────┬───────────────────┘
             │                                │
             └────────────┬───────────────────┘
                          ▼
                Stage 1: Ingest inputs
                pipeline/ingest.py
                          │
                          ▼
            Stage 2: Index video         POST → bedrock.start_async_invoke
            pipeline/marengo_index.py    twelvelabs.marengo-embed-3-0-v1:0
                          │              (S3 input → S3 embedding output)
                          ▼
            Stage 3: Detect anomalies    POST → similarity search
            pipeline/marengo_detect.py   (NL queries → timestamped hits)
                          │
                          ▼
            Stage 4: Extract clips       ffmpeg subprocess
            pipeline/clip_extract.py     (10–15s windows around hits)
                          │
                          ▼
            Stage 5: Describe clips      POST → bedrock.invoke_model
            pipeline/pegasus_describe.py twelvelabs.pegasus-1-2-v1:0
                          │              (sync; structured JSON output)
                          ▼
            Stage 6: Score + locate      Python rules engine
            pipeline/severity.py         + telemetry lookup at timestamp
                          │
                          ▼
            Stage 7: Export              Writes findings.json, CSV, GeoJSON,
            pipeline/export.py           clips/ to disk
                          │
                          ▼
                ┌──────────────────────────────────┐
                │   Next.js dashboard (app/)       │
                │   reads static files from disk   │
                │   No API layer between stages    │
                └──────────────────────────────────┘
```

### Pipeline / dashboard contract

The pipeline is a Python program that runs once and writes its output to disk under `app/public/data/` and `app/public/clips/`. The dashboard is a Next.js app that reads those static files at startup. **There is no runtime API between them.** The repo ships with the canonical run's output committed, so anyone can clone and run `npm run dev` to see the working dashboard immediately — no AWS credentials required.

This decoupling is deliberate: it eliminates live AWS calls during the demo (no spinners, no failure modes on stage), enables judges to inspect the dashboard without a Bedrock account, and keeps frontend iteration fast during the build.

---

## 2. Anomaly Detection Approach

GridSight detects anomalies through a **two-pass system**: Marengo retrieves candidate moments via semantic search across the full video, then Pegasus describes each clip with structured JSON output. Severity is scored by a rules engine grounded in regulatory thresholds.

### Why this beats single-frame CV

Marengo searches across the entire video as a unit, not frame by frame. A glint of sunlight that looks like insulator damage in one frame is correctly ignored once Marengo sees the same insulator clearly two seconds later. Single-frame computer vision approaches generate false positives on transient visual artifacts; semantic video search at a multi-second granularity does not.

### Query strategy

Queries are defined as a configurable list in `pipeline/queries.py`, organized into two groups:

**Anomaly queries (always active in the narrow build):**
- *Insulator damage:* "damaged or broken insulator disk on transmission tower", "missing or shattered porcelain insulator", "insulator string with visible contamination or burn marks", "rust streaks on insulator hardware"
- *Vegetation encroachment:* "tree branches close to or touching power line conductors", "vegetation overgrown into transmission line right-of-way", "trees taller than power line clearance"

**Inventory queries (broad version, optional):**
- "transmission tower with insulator strings visible", "power line conductor crossing the right-of-way", "vegetation along the transmission line corridor"

Each Marengo result is tagged with `discovery_source: "anomaly_query" | "inventory_query"` so downstream stages can distinguish targeted detection from full-inventory observation.

### Pegasus prompt design

Pegasus receives each extracted clip with a JSON-output prompt asking for: component type, condition (`intact` | `damaged` | `contaminated` | `unclear`), specific defects (list), vegetation distance estimate in feet (when applicable), and qualitative confidence. **Pegasus is a describer, not a filter** — every clip produces a record that flows downstream, including those Pegasus assesses as `intact`. Filtering by condition happens in the dashboard, not in the pipeline. This keeps the architecture compatible with full-inventory monitoring as a future extension.

---

## 3. Asset Modeling — What "Normal" Means

The system assesses each finding against a class-specific model of normal:

**Class A — Insulator damage.** Normal: intact porcelain or polymer insulator strings with no visible damage, contamination, or hardware corrosion. Anomalies are graded by failure mode: shattered/missing porcelain disks (critical), severe cap-and-pin corrosion or polymer sheath splitting (critical/high), heavy contamination or flashover burn marks (high), and lighter degradation patterns (moderate/low). Failure mode taxonomy and severity rules: see [`05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Sections 3.1 and 3.3.

**Class B — Vegetation encroachment.** Normal: vegetation outside the right-of-way, or inside the right-of-way but well below conductor height. Anomalies are graded by distance to conductor as a multiple of the NERC FAC-003-4 Minimum Vegetation Clearance Distance (MVCD): vegetation in contact with a conductor or within 1.0× MVCD is critical (a NERC violation in real time), 1.0–2.5× MVCD is high (active management threshold), 2.5–6.25× MVCD is moderate (within ROW but safe distance), and beyond 6.25× MVCD outside the ROW is no-action. MVCD values are voltage-class dependent (4.0 ft for 230 kV, **4.3 ft for 345 kV** — the demo default — 7.0 ft for 500 kV, 11.6 ft for 765 kV at sea level). Full table and rules: see [`05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) Sections 4.3, 4.5, and 4.8.

**Asset-centric data model.** The pipeline emits a record for every observed asset, including healthy ones (with `severity = no_action`). The dashboard filters by condition rather than the pipeline filtering before output. This is more honest about Marengo's false-positive surface (intact findings make it visible rather than hiding it) and keeps the architecture forward-compatible with full-inventory monitoring.

---

## 4. TwelveLabs Integration Strategy

GridSight uses both TwelveLabs foundation models in distinct roles, accessed via AWS Bedrock Runtime.

### Marengo 3.0 — semantic video indexing and retrieval

**Role:** index the curated demo video as a single multimodal asset, then retrieve timestamped candidate moments via natural-language similarity search.

**Invocation pattern:** asynchronous. `bedrock_runtime.start_async_invoke()` initiates the indexing job; the response includes an `invocationArn` that the pipeline polls via `get_async_invoke()` until status is `Completed`. Indexing output (vector embeddings) is written to S3. Querying then proceeds against the indexed asset.

**Model ID:** `twelvelabs.marengo-embed-3-0-v1:0` (base model ID for async invocation, us-east-1).

**Why semantic search over single-frame CV:** see Section 2 above. Marengo's per-clip multimodal embedding captures motion, scene context, and entity relationships that single-frame classification cannot.

### Pegasus 1.2 — structured per-clip description

**Role:** generate structured JSON descriptions of each Marengo-flagged candidate moment, providing component type, condition, defects, and confidence.

**Invocation pattern:** synchronous. `bedrock_runtime.invoke_model()` returns a generated text response in a single call. Each evidence clip is sent as a separate Pegasus invocation; calls are independent and parallelizable.

**Model ID:** `us.twelvelabs.pegasus-1-2-v1:0` (cross-region inference profile, us-east-1).

**Prompt approach:** structured-output prompt with an explicit JSON schema example. Pegasus returns a JSON object with fixed keys; a fallback parser handles minor format drift (trailing commas, unwrapped strings).

### Why both, not either alone

Marengo finds the right *moments*; Pegasus understands the *content* at those moments. Using only Marengo gives you timestamps with similarity scores but no condition assessment. Using only Pegasus would require describing every second of the video — orders of magnitude more compute and no ranking signal for prioritization. The two-pass architecture uses each model where it dominates: retrieval (Marengo) followed by structured generation (Pegasus).

### Combined confidence indicator

Every finding carries two confidence signals — Marengo's numeric similarity score (0.0–1.0) and Pegasus's qualitative confidence (`high` / `medium` / `low`). The dashboard surfaces both in the detail panel for transparency, and a single derived `combined_confidence` field is used for sorting and filtering. The derivation rule is documented in [`01_MASTER.md`](docs/01_MASTER.md) Section 10.3.

---

## 5. Production Compatibility

GridSight is designed to ingest the standard inputs that a real drone inspection produces: a video file and a companion telemetry stream. Most consumer and prosumer drones output telemetry in well-documented formats — DJI's per-frame SRT subtitle file, or a per-second CSV exported from common flight-log tools. The pipeline reads either format directly.

`scripts/srt_to_csv.py` is a real DJI SRT parser, not a stub. A judge from the drone industry could hand the team a real DJI SRT file, and the pipeline would process it without code changes. The hackathon demo uses a generated telemetry file alongside YouTube-sourced footage (because YouTube strips drone telemetry), but the format is real and the pipeline does not know or care which is which.

The system is **voltage-class agnostic**: severity rules look up MVCD values from a table indexed by voltage class. The demo defaults to **345 kV** (MVCD 4.3 ft); switching to 230 kV, 500 kV, or 765 kV requires changing one configuration value, no code changes.

---

## 6. Performance Benchmarks

Measured on the canonical pipeline run (`run_20260426_113904`) against `data/curated/demo_video.mp4` (13:32, 1080p) with the seven anomaly queries active.

| Metric | Target | Measured |
|---|---|---|
| End-to-end processing time per minute of source video | < 60 sec | ~28 sec / min source (cold cache) |
| Marengo indexing time (full 13:32 video) | < 10 min | 30 sec |
| Pegasus invocation latency per clip (sync) | < 15 sec | ~9 sec average |
| Total Bedrock cost per minute of footage | n/a | ~$0.30 / min source (estimate) |
| Findings produced per minute of footage | depends on damage density | 1.03 findings / min |

Cold-cache total runtime for a fresh re-analysis (Marengo index + 7 text embeddings + 14 Pegasus calls + exports) is ~6 minutes. Subsequent runs reuse on-disk caches for Marengo clip embeddings, text query embeddings, and Pegasus per-clip JSON, so iteration on severity rules / exports completes in seconds.

---

## 7. Repository

GitHub: <https://github.com/prempunmagar/GridSight>

Setup:
```bash
git clone https://github.com/prempunmagar/GridSight
cd GridSight
pip install -r requirements.txt
cd app && npm install
```

Verify Bedrock access (smoke test):
```bash
python examples/bedrock_smoke_test.py
```

Run the full pipeline:
```bash
python pipeline/run_all.py
```

View the dashboard with the canonical pre-computed run:
```bash
cd app && npm run dev
```

The dashboard runs without AWS credentials when reading the committed canonical run output. Re-running the pipeline (which regenerates the output files) requires AWS Bedrock access with both Marengo 3.0 and Pegasus 1.2 enabled in `us-east-1`.

Detailed setup and dev workflows: see [`README.md`](README.md) and [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md).

---

## 8. Where to read more

| Topic | Document |
|---|---|
| Full project source of truth (architecture, scope, decisions log) | [`docs/01_MASTER.md`](docs/01_MASTER.md) |
| Six-phase build plan with decision gates | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) |
| Repository layout and pipeline-dashboard contract | [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) |
| NERC FAC-003-4 numbers, insulator failure modes, severity rules | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) |
| Validation methodology, precision/recall/F1, false-positive analysis | [`docs/06_VALIDATION_REPORT.md`](docs/06_VALIDATION_REPORT.md) |
| Operational impact, ROI, deployment cost framing | [`docs/07_OPERATIONAL_IMPACT.md`](docs/07_OPERATIONAL_IMPACT.md) |
| Dashboard UI/UX design specification | [`docs/09_UI_PROPOSAL.md`](docs/09_UI_PROPOSAL.md) |

---

*GridSight · Geospatial Video Intelligence Hackathon, Track 02 · April 25–26, 2026*
