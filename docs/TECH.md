# GridSight — Technical Documentation

*Geospatial Video Intelligence Hackathon · Track 02 · Workflow 02 — Transmission Line Inspection*
*April 25–26, 2026*

---

## At a glance

GridSight is an automated visual inspection pipeline for high-voltage transmission infrastructure. It ingests the two standard outputs of any drone inspection — a video file and per-second telemetry — and produces georeferenced, severity-scored findings ready for utility work-order systems.

Three things distinguish the approach:

- **Two-pass video understanding.** Marengo retrieves candidate moments via semantic search across the full video; Pegasus produces a structured per-clip description. This is materially different from single-frame computer vision: a glint of sunlight that looks like insulator damage in one frame is correctly ignored once Marengo sees the same insulator clearly two seconds later.
- **Severity grounded in regulatory thresholds.** Vegetation findings are scored against NERC FAC-003-4 Minimum Vegetation Clearance Distance; insulator damage is scored against industry-standard failure modes. Each severity tier maps to a real-world action threshold, not a heuristic anomaly score.
- **Asset-centric output.** The pipeline emits a record for every observed asset, including healthy ones. The dashboard filters by condition rather than the pipeline filtering before output. This is more honest about model false-positive surface and forward-compatible with full-inventory and predictive-maintenance workflows.

Two anomaly classes in scope: insulator damage and vegetation encroachment. Asset target: lattice steel suspension towers carrying high-voltage AC transmission lines. Canonical demo run at 345 kV (MVCD 4.3 ft).

Outputs: CSV, GeoJSON, structured JSON, plus a Next.js dashboard with map view, severity-coded finding pins, and 15-second evidence clip playback.

---

## 1. System Architecture

The pipeline is a seven-stage linear flow with two parallel inputs. Each stage has a defined input/output contract so stages can be developed and tested independently.

```
┌────────────────────────────┐  ┌─────────────────────────────────┐
│   demo_video.mp4           │  │   demo_video_telemetry.csv     │
│   (curated 1080p, 13:32)   │  │   (per-second GPS + altitude   │
│                            │  │    + heading; DJI-SRT-compat)  │
└────────────┬───────────────┘  └─────────────┬───────────────────┘
             │                                │
             └────────────┬───────────────────┘
                          ▼
                Stage 1 — Ingest inputs
                pipeline/ingest.py
                          │
                          ▼
            Stage 2 — Index video         POST → bedrock.start_async_invoke
            pipeline/marengo_index.py     twelvelabs.marengo-embed-3-0-v1:0
                          │               (S3 input → S3 embedding output)
                          ▼
            Stage 3 — Detect anomalies    POST → similarity search
            pipeline/marengo_detect.py    (NL queries → timestamped hits)
                          │
                          ▼
            Stage 4 — Extract clips       ffmpeg subprocess
            pipeline/clip_extract.py      (10–15 s windows around hits)
                          │
                          ▼
            Stage 5 — Describe clips      POST → bedrock.invoke_model
            pipeline/pegasus_describe.py  twelvelabs.pegasus-1-2-v1:0
                          │               (sync; structured JSON output)
                          ▼
            Stage 6 — Score + locate      Python rules engine
            pipeline/severity.py          + telemetry lookup at timestamp
                          │
                          ▼
            Stage 7 — Export              Writes findings.json, CSV,
            pipeline/export.py            GeoJSON, clips/ to disk
                          │
                          ▼
                ┌──────────────────────────────────┐
                │   Next.js dashboard (app/)       │
                │   reads static files from disk   │
                │   No API layer between stages    │
                └──────────────────────────────────┘
```

### Pipeline / dashboard contract

The pipeline is a Python program that runs once and writes its output to disk under `app/public/data/` and `app/public/clips/`. The dashboard is a Next.js app that reads those static files at startup. **There is no runtime API between them.** The repository ships with the canonical run's output committed, so a judge can clone and run `npm run dev` to see the working dashboard immediately — no AWS credentials required.

This decoupling is deliberate: it eliminates live AWS calls during the demo (no spinners, no failure modes on stage), enables judges to inspect the dashboard without a Bedrock account, and keeps frontend iteration fast during the build.

---

## 2. Anomaly Detection Approach

GridSight detects anomalies through a two-pass system: Marengo retrieves candidate moments via semantic search across the full video; Pegasus describes each clip with structured JSON output. Severity is then scored by a rules engine grounded in regulatory thresholds.

### 2.1 Video understanding advantage over single-frame CV

Marengo searches the entire video as a unit, not frame by frame. The model's per-clip multimodal embedding captures motion, scene context, and entity relationships that single-frame classification cannot. Operationally this matters because most false positives in single-frame approaches are transient visual artifacts — sun glints, motion blur, frame-edge crops of healthy components — that disappear once the same scene is observed across multiple seconds. Marengo's similarity search at multi-second granularity does not generate those false positives.

### 2.2 Query strategy

Queries are defined as a configurable list in `pipeline/queries.py`, organized into two groups:

**Anomaly queries** (always active in the narrow build):

- *Insulator damage:* "damaged or broken insulator disk on transmission tower"; "missing or shattered porcelain insulator"; "insulator string with visible contamination or burn marks"; "rust streaks on insulator hardware".
- *Vegetation encroachment:* "tree branches close to or touching power line conductors"; "vegetation overgrown into transmission line right-of-way"; "trees taller than power line clearance".

**Inventory queries** (broad, optional):

- "transmission tower with insulator strings visible"; "power line conductor crossing the right-of-way"; "vegetation along the transmission line corridor".

Each Marengo result is tagged with `discovery_source: "anomaly_query" | "inventory_query"` so downstream stages can distinguish targeted detection from full-inventory observation.

### 2.3 Pegasus prompt design

Pegasus receives each extracted clip with a JSON-output prompt asking for: component type, condition (`intact` | `damaged` | `contaminated` | `unclear`), specific defects (list), vegetation distance estimate in feet (when applicable), and qualitative confidence. **Pegasus is a describer, not a filter** — every clip produces a record that flows downstream, including those Pegasus assesses as `intact`. Filtering by condition happens in the dashboard, not in the pipeline. This keeps the architecture compatible with full-inventory monitoring as a future extension.

---

## 3. Asset Modeling — What "Normal" Means

The system assesses each finding against a class-specific model of normal:

**Class A — Insulator damage.** Normal: intact porcelain or polymer insulator strings with no visible damage, contamination, or hardware corrosion. Anomalies are graded by failure mode: shattered or missing porcelain disks (critical), severe cap-and-pin corrosion or polymer sheath splitting (critical/high), heavy contamination or flashover burn marks (high), and lighter degradation patterns (moderate/low). Failure-mode taxonomy and severity rules: see `docs/05_DOMAIN_KNOWLEDGE.md` Sections 3.1 and 3.3.

**Class B — Vegetation encroachment.** Normal: vegetation outside the right-of-way, or inside the right-of-way but well below conductor height. Anomalies are graded by distance to conductor as a multiple of the NERC FAC-003-4 Minimum Vegetation Clearance Distance (MVCD): vegetation in contact with a conductor or within 1.0× MVCD is **critical** (a NERC violation in real time); 1.0–2.5× MVCD is **high** (active management threshold); 2.5–6.25× MVCD is **moderate** (within ROW but safe distance); beyond 6.25× MVCD outside the ROW is **no-action**. MVCD values are voltage-class dependent (4.0 ft for 230 kV, **4.3 ft for 345 kV** — the demo default — 7.0 ft for 500 kV, 11.6 ft for 765 kV at sea level).

**Asset-centric data model.** The pipeline emits a record for every observed asset, including healthy ones (with `severity = no_action`). The dashboard filters by condition rather than the pipeline filtering before output. This is more honest about Marengo's false-positive surface (intact findings make it visible rather than hiding it) and keeps the architecture forward-compatible with full-inventory monitoring.

---

## 4. TwelveLabs Integration Strategy

GridSight uses both TwelveLabs foundation models in distinct roles, accessed via AWS Bedrock Runtime in `us-east-1`.

### 4.1 Marengo 3.0 — semantic video indexing and retrieval

- **Role:** index the curated demo video as a single multimodal asset, then retrieve timestamped candidate moments via natural-language similarity search.
- **Invocation:** asynchronous. `bedrock_runtime.start_async_invoke()` initiates the indexing job; the response includes an `invocationArn` that the pipeline polls via `get_async_invoke()` until status is `Completed`. Indexing output (vector embeddings) is written to S3.
- **Model ID:** `twelvelabs.marengo-embed-3-0-v1:0`.

### 4.2 Pegasus 1.2 — structured per-clip description

- **Role:** generate structured JSON descriptions of each Marengo-flagged candidate moment: component type, condition, defects, confidence.
- **Invocation:** synchronous. `bedrock_runtime.invoke_model()` returns a generated text response in a single call. Each evidence clip is sent as a separate Pegasus invocation; calls are independent and parallelizable.
- **Model ID:** `us.twelvelabs.pegasus-1-2-v1:0` (cross-region inference profile).
- **Prompt approach:** structured-output prompt with an explicit JSON schema example. A fallback parser handles minor format drift (trailing commas, unwrapped strings).

### 4.3 Why both, not either alone

Marengo finds the right *moments*; Pegasus understands the *content* at those moments. Using only Marengo gives you timestamps with similarity scores but no condition assessment. Using only Pegasus would require describing every second of the video — orders of magnitude more compute and no ranking signal for prioritization. The two-pass architecture uses each model where it dominates: retrieval (Marengo) followed by structured generation (Pegasus).

---

## 5. Operating Envelope

GridSight is scoped honestly. The system is designed for and validated on:

- **Video quality:** 1080p consumer drone footage at 30 fps. Marengo's multimodal embedding handles bright-sun overexposure and harsh shadow conditions implicitly (no per-frame thresholds), but performance below 720p or with heavy compression artifacts is not characterized. Snow, fog, and night flights are out of scope for this build.
- **Asset type:** lattice steel suspension towers carrying high-voltage AC transmission lines. Monopole, wood-pole, and substation assets are out of scope.
- **Voltage class:** voltage-class agnostic by design — severity rules look up MVCD from a table indexed by voltage class. Switching from 345 kV to 230 / 500 / 765 kV requires a single configuration change. The canonical demo run is at 345 kV.
- **Localization accuracy:** approximate (±50 m typical at consumer-drone GPS accuracy), suitable for prioritizing inspection work orders. Sub-meter accuracy for regulatory documentation is not claimed.

This scope was set deliberately at the start of the build. The brief calls out asset-diversity overreach as a common pitfall; we addressed it by picking one tower class and one voltage class up front, and being explicit about what we don't handle.

---

## 6. Confidence Handling

Operational readiness requires that each finding carry a transparent confidence signal a reviewer can trust. GridSight emits two independent signals per finding:

- **Marengo similarity score** — continuous, 0.0 to 1.0, from the indexing/retrieval step. Reflects how strongly the candidate moment matches the query embedding.
- **Pegasus qualitative confidence** — `high` / `medium` / `low`, from the structured-description step. Reflects how confidently Pegasus made the condition assessment.

A derived `combined_confidence` field (rule documented in `docs/01_MASTER.md` §10.3) is used for sorting and filtering in the dashboard. Both raw signals remain visible in the per-finding detail panel — a reviewer who trusts Marengo more than Pegasus, or vice versa, can sort accordingly.

Severity tier and confidence are independent dimensions. A `critical` severity finding with `low` Pegasus confidence is *flagged for human review* rather than auto-routed to the work-order queue; the system is explicit that high-stakes findings with weak confidence require expert eyes before action.

---

## 7. Performance Benchmarks

Measured on the canonical pipeline run (`run_20260426_113904`) against `data/curated/demo_video.mp4` (13:32, 1080p) with the seven anomaly queries active.

| Metric | Target | Measured |
|---|---|---|
| End-to-end processing time per minute of source video | < 60 sec | ~28 sec / min source (cold cache) |
| Marengo indexing time (full 13:32 video) | < 10 min | 30 sec |
| Pegasus invocation latency per clip (sync) | < 15 sec | ~9 sec average |
| Total Bedrock cost per minute of footage | n/a | ~$0.30 / min source (estimate) |
| Findings produced per minute of footage | depends on damage density | 1.03 findings / min |

Cold-cache total runtime for a fresh re-analysis (Marengo index + 7 text embeddings + 14 Pegasus calls + exports) is approximately **6 minutes**. Subsequent runs reuse on-disk caches for Marengo clip embeddings, text query embeddings, and Pegasus per-clip JSON, so iteration on severity rules and exports completes in seconds.

---

## 8. Innovation and Operational Extensions

The asset-centric architecture intentionally enables several extensions that go beyond the brief's required scope. None ship in this build, but each is reachable from the current data model with limited additional engineering.

**Agent-workflow ready (Workflow 03 substrate).** Every observed asset emits a record carrying GPS, timestamp, and structured condition. Cross-source correlation with SCADA telemetry or maintenance-history CSVs is a join on asset ID. The data model deliberately preserves intact findings to make this join meaningful — assets that look healthy visually but show pressure anomalies in SCADA are precisely the high-priority discovery target the brief calls out.

**Predictive maintenance.** The same substrate enables trend analysis across inspection dates. Hashing asset GPS to a stable identifier and comparing condition assessments across runs surfaces degradation progression — an insulator string with rust streaks today and shattered porcelain six months later is the canonical predictive-maintenance signal.

**Regulatory compliance mapping.** Vegetation findings already map to NERC FAC-003-4 thresholds by construction. The GeoJSON export schema includes the MVCD multiple as a property, which is the field a NERC compliance reporting workflow would consume directly.

**Field-crew route optimization.** Findings on the dashboard map view are clustered by GPS proximity. A geocoded route-planning step using any standard routing engine would convert finding clusters into ground-crew dispatch routes ordered by severity-weighted urgency.

---

## 9. Repository and Reproduction

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

---

## 10. Document map

| Topic | Document |
|---|---|
| Full project source of truth (architecture, scope, decisions log) | `docs/01_MASTER.md` |
| Six-phase build plan with decision gates | `docs/02_BUILD_PLAN.md` |
| Repository layout and pipeline-dashboard contract | `docs/03_REPO_STRUCTURE.md` |
| NERC FAC-003-4 numbers, insulator failure modes, severity rules | `docs/05_DOMAIN_KNOWLEDGE.md` |
| Validation methodology, precision/recall/F1, false-positive analysis | `docs/06_VALIDATION_REPORT.md` |
| Operational impact, ROI, deployment cost framing | `docs/07_OPERATIONAL_IMPACT.md` |
| Dashboard UI/UX design specification | `docs/09_UI_PROPOSAL.md` |

---

*GridSight · Geospatial Video Intelligence Hackathon, Track 02 · April 25–26, 2026*
