# GridSight

> **AI-powered transmission line inspection. Drone footage in → georeferenced findings out.**
>
> Geospatial Video Intelligence Hackathon · St. Louis · April 25–26, 2026 · Track 02 · Workflow 02

---

## What this is

GridSight processes drone footage of high-voltage transmission lines and detects two anomaly classes: **damaged insulators** and **vegetation encroachment**. It uses TwelveLabs Marengo 3.0 and Pegasus 1.2 via AWS Bedrock, attaches GPS from a companion drone telemetry file, and produces a Next.js dashboard with map view, evidence clips, and CSV/GeoJSON exports.

Full project context is in [`docs/01_MASTER.md`](docs/01_MASTER.md). Don't start working without reading at least Sections 1–5 of that doc.

---

## Run the dashboard (no AWS needed)

If you just want to see the finished product:

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
