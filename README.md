# GridSight

> **AI-powered transmission line inspection. Drone footage in → georeferenced findings out.**
>
> Geospatial Video Intelligence Hackathon · St. Louis · April 25–26, 2026 · Track 02 · Workflow 02

---

## What GridSight is

An automated pipeline that processes the two standard outputs of any drone inspection — **a video file and its companion telemetry stream** — and produces a prioritized, georeferenced findings list. Two anomaly classes: **insulator damage** and **vegetation encroachment**, both anchored to NERC FAC-003-4 clearance distances and standard industry failure-mode taxonomy.

Built on **TwelveLabs Marengo 3.0** (semantic video search) and **Pegasus 1.2** (structured per-clip description) via **AWS Bedrock**. The output is an operations console — map view of the inspection corridor, severity-coded finding pins, click-to-play 15-second evidence clips, telemetry inspector, and CSV / GeoJSON exports ready for utility work-order systems.

> **This is an operations console, not a video gallery.** It turns hours of frame-by-frame human review into a triaged, verifiable list.

---

## Headline results — canonical run

`run_20260426_113904` against `data/curated/demo_video.mp4` (13:32, 1080p, 345 kV corridor):

| | |
|---|---|
| Findings produced | **14** (2 critical, 1 high, 6 moderate, 5 intact / no-action) |
| End-to-end runtime (cold cache) | ~6 minutes for 13:32 of footage (~28 sec/min source) |
| Ground-truth anomalies labeled | 15 (8 insulator, 7 vegetation) |
| Aggregate F1, clip-normalized evidence-clip metric | **0.42** |
| Per-class F1 at IoU ≥ 0.5 | 0.18 (Class A), 0.15 (Class B) |
| Per-class F1, clip-normalized | 0.18 (Class A), 0.62 (Class B) |
| Per-class F1 at IoU ≥ 0.3 | 0.36 (Class A), 0.15 (Class B) |
| Severity calibration on matched pairs | 50% exact, 100% within one tier |
| Bedrock cost | ~$0.30 / minute of source video |

Honest framing: the submission-facing clip-normalized metric evaluates the actual GridSight product surface: 15-second evidence clips. The stricter raw-window IoU score is still reported and remains below pre-run targets because ≤4-second labels cannot reach 0.5 IoU against a 15-second prediction. The [validation report](docs/06_VALIDATION_REPORT.md) walks through both numbers and the caveat. Class confusion is zero.

---

## Quickstart — view the dashboard (no AWS needed)

The repo ships with the canonical run's output committed under `app/public/data/` and `app/public/clips/`. The dashboard reads these static files at startup.

```bash
git clone https://github.com/prempunmagar/GridSight
cd GridSight/app
npm install
npm run dev
# http://localhost:3000  →  redirects to /library  →  click the video tile  →  /dashboard
```

Three commands, no AWS credentials, no Python required.

## Re-run the pipeline (AWS Bedrock required)

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in AWS creds + S3_BUCKET in .env

# Verify Bedrock access (Marengo + Pegasus smoke test)
python examples/bedrock_smoke_test.py

# Re-run the canonical pipeline against committed inputs
python -m pipeline.run_all

# Or trigger from the dashboard's library screen (POST /api/reanalyze)
```

The pipeline writes `out/findings.{json,csv,geojson}`, `out/validation_metrics.json`, and the dashboard data files in `app/public/data/`. Full dev workflows in [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) §6.

---

## Architecture

A seven-stage Python pipeline writes static files to disk; a Next.js dashboard reads those files. **No API layer, no live AWS at view time.** This is Decision D11.

```
data/curated/demo_video.mp4 + data/telemetry/*.csv
          │
          ▼
1. Ingest      pipeline/ingest.py
2. Index       pipeline/marengo_index.py     (Marengo 3.0, async invoke)
3. Detect      pipeline/marengo_detect.py    (text-query similarity, 10s dedup)
4. Extract     pipeline/extract_clips.py     (ffmpeg, 15-second windows, atomic write)
5. Describe    pipeline/pegasus_describe.py  (Pegasus 1.2, sync invoke)
6. Score       pipeline/severity.py          (NERC rules + telemetry lookup)
7. Export      pipeline/export_*.py          (CSV, GeoJSON, dashboard JSON, clips)
          │
          ▼
app/public/data/{findings,flight_path,run_metadata}.json
app/public/clips/{finding_id}.mp4
          │
          ▼
Next.js dashboard (/library → /dashboard)
- 3-zone layout: findings list / map / detail panel
- timeline strip showing severity heatmap of the run
- POST /api/reanalyze re-runs the pipeline (D19)
```

Detailed stage contracts in [`docs/01_MASTER.md`](docs/01_MASTER.md) §6 and [`docs/TECH.md`](docs/TECH.md) §1.

---

## Deliberate scope

We made explicit trade-offs to ship a reliable, judge-ready system in 24 hours:

1. **Two anomaly classes only.** Insulator damage and vegetation encroachment. Tower corrosion, conductor damage, and other failure modes are explicitly out of scope.
2. **Lattice steel suspension towers** as the asset target. No tubular poles, no wood poles, no dead-end towers.
3. **Asset-centric data model.** Pegasus describes condition; the dashboard filters. `intact` findings flow through to the output as `no_action` records — exposes the false-positive surface honestly and provides substrate for full-inventory monitoring (Decision D9, D10).
4. **No API layer for data flow.** Pipeline writes static files; dashboard reads static files. The single exception is `POST /api/reanalyze` for control only (Decision D19).
5. **No sub-meter GPS claims.** ±50 m relative to the simulated corridor is sufficient for work-order routing.
6. **Real-format simulated telemetry.** YouTube footage strips drone telemetry, so the demo's per-second CSV is generated along a real southern Illinois 345 kV corridor — the format is real (DJI-SRT-compatible), values are simulated, and disclosed as such (Decision D6).

Anti-goals are listed in [`docs/01_MASTER.md`](docs/01_MASTER.md) §4.2 and [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md).

---

## Judging guide — where to look

| Document | What it covers |
|---|---|
| **[`docs/TECH.md`](docs/TECH.md)** | **Start here.** Two-page summary: TwelveLabs integration strategy, anomaly approach, asset modeling, performance benchmarks. |
| **[`docs/06_VALIDATION_REPORT.md`](docs/06_VALIDATION_REPORT.md)** | Full validation methodology, precision / recall / F1 per class, confusion matrix, FP and FN attribution tables, severity calibration, IoU sensitivity analysis. |
| **[`docs/07_OPERATIONAL_IMPACT.md`](docs/07_OPERATIONAL_IMPACT.md)** | One-page operational value brief: throughput multiplier, deployment cost, payback, regional-utility ROI model. |
| [`docs/01_MASTER.md`](docs/01_MASTER.md) | Project source-of-truth: scope, architecture, success criteria, decisions log (D1–D19). |
| [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) | NERC FAC-003-4 numbers, insulator failure modes, the literal severity rules. |
| [`docs/09_UI_PROPOSAL.md`](docs/09_UI_PROPOSAL.md) | Dashboard design: layout, components, interaction model, design tokens. |

The full set:

| File | Purpose |
|---|---|
| [`01_MASTER.md`](docs/01_MASTER.md) | Source of truth; scope, architecture, decisions log |
| [`02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) | Six-phase execution playbook |
| [`03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) | Directory layout, pipeline ↔ dashboard contract, dev workflows |
| [`04_DATA_BRIEF.md`](docs/04_DATA_BRIEF.md) | Data prep workstream brief |
| [`05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) | NERC FAC-003-4, failure modes, severity rules |
| [`06_VALIDATION_REPORT.md`](docs/06_VALIDATION_REPORT.md) | Validation results — required submission artifact |
| [`07_OPERATIONAL_IMPACT.md`](docs/07_OPERATIONAL_IMPACT.md) | Operational impact brief — required submission artifact |
| [`08_EXTERNAL_DATA_HANDOFF.md`](docs/08_EXTERNAL_DATA_HANDOFF.md) | Data prep team coordination doc |
| [`09_UI_PROPOSAL.md`](docs/09_UI_PROPOSAL.md) | Dashboard design specification |
| [`TECH.md`](docs/TECH.md) | Condensed technical reference for judges |

Per-subdirectory READMEs:
- [`pipeline/README.md`](pipeline/README.md) — validation module specifics
- [`data_prep/README.md`](data_prep/README.md) — demo input preparation workstream

---

## Production compatibility

GridSight ingests the standard outputs of a real drone inspection. [`scripts/srt_to_csv.py`](scripts/srt_to_csv.py) is a working DJI SRT parser — a judge from the drone industry could hand the team a real DJI export and the pipeline would process it without code changes (Decision D12). The system is voltage-class agnostic; switching from the demo's 345 kV (MVCD = 4.3 ft) to 230 kV / 500 kV / 765 kV is a single configuration change.

For the hackathon demo, telemetry is generated along a real US transmission corridor in southern Illinois because YouTube footage strips the original GPS metadata. The format is real; the values are simulated; this is disclosed in the demo, the dashboard, and [`docs/01_MASTER.md`](docs/01_MASTER.md) §8.1.

---

## Status

**Phase 6 — Submission.** All required deliverables per [`docs/01_MASTER.md`](docs/01_MASTER.md) §11 are in place: working pipeline, dashboard, CSV / GeoJSON exports, validation report, operational impact brief, technical documentation, GitHub repo. Demo video and DevPost submission are the remaining time-bounded items.

The decisions log in [`docs/01_MASTER.md`](docs/01_MASTER.md) §13 records nineteen recorded design decisions (D1–D19). The cleanest read of "what GridSight chose to be" is reading those nineteen rows.

---

## When something goes wrong

| Symptom | First check |
|---|---|
| Bedrock auth fails | [`docs/02_BUILD_PLAN.md`](docs/02_BUILD_PLAN.md) Phase 1 Task 1 |
| Pegasus returns malformed JSON | [`pipeline/pegasus_describe.py`](pipeline/pegasus_describe.py) `_extract_json` (regex fallback) |
| Pipeline run errors mid-stage | `out/run_log.txt` + `app/public/data/run_status.json` |
| Dashboard renders blank | Check that `app/public/data/findings.json` exists; the `/library` screen shows a clear "loading…" state |
| "Where does this file go?" | [`docs/03_REPO_STRUCTURE.md`](docs/03_REPO_STRUCTURE.md) §8 |
| Severity rule confusion | [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) §5 (the literal spec) |

---

## License & attribution

Built for the Geospatial Video Intelligence Hackathon (St. Louis, April 25–26, 2026). Demo footage curated from publicly available drone inspection videos on YouTube; per-segment provenance lives in `data/curated/source_log.md` (gitignored alongside the curated cut). NERC FAC-003-4 numbers are reproduced verbatim from the public NERC reliability standard. Severity rule rationale is grounded in the EPRI Insulator Reference Book and the IEEE inspection literature; full citations in [`docs/05_DOMAIN_KNOWLEDGE.md`](docs/05_DOMAIN_KNOWLEDGE.md) §6.
