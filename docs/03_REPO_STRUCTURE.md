# GridSight — Repo Structure

> **Status:** Draft, Saturday April 25, 2026.
> **Companion docs:** `01_MASTER.md` (what GridSight is and why), `02_BUILD_PLAN.md` (how we build it).

---

## How to use this document

This is the canonical reference for where things live in the repo. When you're about to add a new file and you're not sure where it goes, look here first. When something doesn't fit the patterns described here, that's a signal — either the new thing is genuinely different and we should append to this doc, or we're about to put a file in an inconsistent place.

The doc covers six things:

1. **Directory tree** — annotated, with rationale where the choice isn't obvious.
2. **The pipeline → dashboard contract** — how Python writes, how Next.js reads, what enforces consistency.
3. **TypeScript schemas** — the actual interface definitions that anchor the contract.
4. **`.gitignore` policy** — what's tracked, what's not, why.
5. **Environment variables** — what's needed, where they live.
6. **Dev workflow** — the actual commands a teammate runs to do common things.

---

## 1. Directory Tree

The repo has two main units glued together by a static-file contract:

- **The Python pipeline** (`pipeline/`, `scripts/`, `examples/`, `data/`, `out/`) — runs once per inspection, calls AWS Bedrock for Marengo and Pegasus, writes its output to disk.
- **The Next.js dashboard** (`app/`) — reads the pipeline's output from `app/public/`, renders the map, table, and evidence clips. No live AWS calls. Ships with the canonical run's output committed so judges can run it immediately.

Plus shared bits: `docs/`, `submission/`, root configs.

```
gridsight/                              # repo root (rename if working name changes)
├── README.md                           # project intro, setup, usage; links to /docs
├── .gitignore                          # see Section 4
├── .env.example                        # template; real .env is gitignored
├── requirements.txt                    # Python deps (boto3, pandas, numpy, ffmpeg-python, pytest)
├── pyproject.toml                      # optional; cleaner if we want it
│
├── docs/                               # all planning + research documents
│   ├── 01_MASTER.md                    # source of truth for what GridSight is
│   ├── 02_BUILD_PLAN.md                # ordered execution playbook
│   ├── 03_REPO_STRUCTURE.md            # this file
│   ├── 04_DATA_BRIEF.md                # data brief: what we receive from data_prep team
│   ├── 05_DOMAIN_KNOWLEDGE.md          # NERC + failure modes
│   ├── 06_VALIDATION_REPORT.md         # Phase 5 output (precision/recall/F1)
│   ├── 07_OPERATIONAL_IMPACT.md        # Phase 5 output (one-page brief)
│   ├── 08_EXTERNAL_DATA_HANDOFF.md     # coordination doc for the data prep workstream
│   └── TECH.md                         # Phase 6 condensed tech doc for judges
│
├── pipeline/                           # Python: the runnable pipeline
│   ├── __init__.py
│   ├── config.py                       # paths, model IDs, constants
│   ├── ingest.py                       # Stage 1: load video + telemetry
│   ├── marengo_index.py                # Stage 2: index video in Bedrock
│   ├── queries.py                      # Stage 3: anomaly_queries + inventory_queries
│   ├── marengo_detect.py               # Stage 3: run queries against the index
│   ├── extract_clips.py                # Stage 4: ffmpeg clip extraction
│   ├── pegasus_describe.py             # Stage 5: structured JSON descriptions
│   ├── severity.py                     # Stage 6: severity scoring + combined confidence
│   ├── telemetry.py                    # Stage 6: telemetry lookup at timestamps
│   ├── export_csv.py                   # Stage 7: write out/findings.csv
│   ├── export_geojson.py               # Stage 7: write out/findings.geojson
│   ├── export_dashboard.py             # Stage 7: write app/public/data/* + clips
│   ├── run_all.py                      # orchestrator; runs Stages 1–7 end-to-end
│   └── tests/                          # pytest unit tests
│       ├── __init__.py
│       ├── test_severity.py            # severity rules + combined confidence
│       ├── test_telemetry.py           # CSV loading + timestamp lookup
│       └── test_srt_parser.py          # DJI SRT parsing
│
├── scripts/                            # utility scripts that are part of the GridSight product
│   └── srt_to_csv.py                   # real DJI SRT parser (production-compat claim)
│
├── data_prep/                          # demo input preparation (separate workstream — see D16)
│   ├── README.md                       # what's in here, why it's separate from pipeline
│   ├── curate_video.py                 # ffmpeg helper to stitch raw clips → demo_video.mp4
│   ├── generate_telemetry.py           # generate demo telemetry from corridor waypoints
│   ├── label_validation.py             # interactive helper for ground truth labeling
│   └── corridor_waypoints.json         # TRACKED — corridor definition for telemetry generation
│
├── examples/                           # reference, smoke tests, and sample inputs
│   ├── bedrock_smoke_test.py           # Phase 1 hello-world; verifies Bedrock end-to-end
│   ├── sample_dji.srt                  # tiny real DJI SRT for testing srt_to_csv.py
│   └── sample_pegasus_responses.json   # saved Pegasus outputs for prompt iteration
│
├── data/                               # source data (most gitignored — see Section 4)
│   ├── raw/                            # GITIGNORED — downloaded YouTube footage
│   ├── curated/
│   │   ├── demo_video.mp4              # GITIGNORED — large, regenerable from source_log
│   │   └── source_log.md               # TRACKED — documents YouTube URLs + timestamp ranges
│   ├── telemetry/
│   │   └── demo_video_telemetry.csv    # TRACKED — small, produced by data_prep/generate_telemetry.py
│   ├── validation/
│   │   └── ground_truth.csv            # TRACKED — manual anomaly labels (critical for F1 reproducibility)
│   └── synthetic/                      # only populated if Workflow 03 ships
│       └── maintenance_log.csv         # TRACKED if it exists — fabricated maintenance records
│
├── out/                                # canonical pipeline outputs (TRACKED — see rationale below)
│   ├── findings.json                   # full enriched findings list
│   ├── findings.csv                    # CSV export
│   ├── findings.geojson                # GeoJSON export
│   └── validation_metrics.json         # precision/recall/F1 results
│
├── app/                                # Next.js dashboard project
│   ├── package.json                    # dashboard dependencies (separate from Python deps)
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── .gitignore                      # Next.js's own; ignores node_modules, .next, etc.
│   ├── README.md                       # dashboard-specific setup (npm install, npm run dev)
│   │
│   ├── app/                            # App Router pages — see "The app/app/ thing" below
│   │   ├── layout.tsx                  # root layout; loads global CSS, fonts
│   │   ├── page.tsx                    # main dashboard page; the only route
│   │   └── globals.css                 # Tailwind imports + a few custom rules
│   │
│   ├── components/                     # React components (PascalCase filenames)
│   │   ├── Header.tsx                  # project name, run timestamp, totals
│   │   ├── FlightPathMap.tsx           # react-leaflet map; flight path + finding pins
│   │   ├── TelemetryInspector.tsx      # sidebar panel showing drone state at selected finding
│   │   ├── EvidenceClipPlayer.tsx      # HTML5 video + Pegasus description fields
│   │   ├── FindingsTable.tsx           # sortable, filterable table; condition toggle
│   │   ├── ExportButtons.tsx           # CSV + GeoJSON downloads
│   │   └── ConfidenceLegend.tsx        # explains severity colors + combined confidence rule
│   │
│   ├── types/                          # TypeScript schemas — THE CONTRACT
│   │   ├── findings.ts                 # Finding interface (matches findings.json)
│   │   ├── telemetry.ts                # FlightPath interface (matches flight_path.json)
│   │   └── metadata.ts                 # RunMetadata interface (matches run_metadata.json)
│   │
│   ├── lib/                            # client-side helpers
│   │   ├── data.ts                     # async loaders for the static JSON files
│   │   ├── severity.ts                 # severity → color mapping
│   │   └── format.ts                   # date / number formatting helpers
│   │
│   └── public/                         # static assets served at the site root
│       ├── data/                       # PIPELINE WRITES HERE (see Section 2)
│       │   ├── findings.json
│       │   ├── flight_path.json
│       │   └── run_metadata.json
│       └── clips/                      # PIPELINE WRITES HERE; committed for demo
│           ├── f001_insulator_damage_72.mp4
│           ├── f002_vegetation_115.mp4
│           └── ... (~25 clips total)
│
└── submission/                         # final submission artifacts (committed)
    ├── demo.mp4                        # 3–5 minute demo video
    └── one_page_impact.pdf             # operational impact brief, PDF version
```

### The `app/app/` thing

Yes, there are two `app/` directories. The outer `app/` is the Next.js project root (where `package.json` lives). The inner `app/app/` is the Next.js App Router convention — it's where pages and layouts go. This is `create-next-app` standard structure when you pass `--app`. Everyone working on the dashboard will get used to it within an hour.

If this confuses anyone, mental model: think of the outer `app/` as if it were named `dashboard/`. We kept the conventional name to match Next.js docs and tutorials, but functionally it's "the dashboard project."

### Why `out/` is tracked

`out/findings.json`, `out/findings.csv`, `out/findings.geojson`, `out/validation_metrics.json` — these are the canonical run's outputs. They're tracked in Git so:

1. A judge cloning the repo can see exactly what the pipeline produced without re-running it.
2. The CSV and GeoJSON exports are independently inspectable as deliverables.
3. The validation metrics file is the source for any judging-time accuracy claims.

These files are ~few hundred KB total. Easy to track. They get regenerated whenever the pipeline runs and are committed at the end of Phase 5.

Note: `app/public/data/findings.json` is the same data as `out/findings.json`, but written specifically for the dashboard to import. They're written by different export steps because their consumers are different (judges + GIS tools vs. the React dashboard). Keeping them as separate files lets the schemas evolve independently if needed later.

### Why `data/raw/` and `data/curated/demo_video.mp4` are NOT tracked

`data/raw/` contains downloaded YouTube footage — large (many GB). The `source_log.md` documents which URLs and timestamp ranges contributed to the curated cut, so anyone can recreate `data/raw/` by running `data_prep/curate_video.py` (which calls `yt-dlp` + ffmpeg). Reproducibility without bloating the repo.

`data/curated/demo_video.mp4` is ~1 GB after stitching. Also regenerable from source_log + `data_prep/curate_video.py`. Gitignored.

`app/public/clips/*.mp4` are tracked because the dashboard cannot work without them, and they're small (~75 MB total at 2 Mbps × 12 sec × 25 clips). If the total exceeds 200 MB during the build, switch to Git LFS for that directory specifically.

---

## 2. The Pipeline → Dashboard Contract

This is the single most important architectural piece in the repo. Get it right and the two halves of the project develop independently. Get it wrong and everything breaks silently.

### The contract

The Python pipeline's final stage (`pipeline/export_dashboard.py`) writes four kinds of files to `app/public/`:

| File | Schema location | What it is |
|---|---|---|
| `app/public/data/findings.json` | `app/types/findings.ts` | Array of Finding objects (the main data) |
| `app/public/data/flight_path.json` | `app/types/telemetry.ts` | The drone's flight path as a polyline |
| `app/public/data/run_metadata.json` | `app/types/metadata.ts` | Run-level info (timestamp, totals, voltage class) |
| `app/public/clips/{finding_id}.mp4` | (no schema; just MP4) | Evidence clip per finding |

The Next.js dashboard reads these files at startup. There is no API layer between the pipeline and the dashboard, no live AWS calls, and no shared runtime. The two units share only the filesystem.

### How the contract is enforced

The TypeScript interfaces in `app/types/` are the source of truth for the data shape. The pipeline must write JSON that matches them. Mismatches surface in two places:

1. **At dashboard load time** — `app/lib/data.ts` parses the JSON against the TypeScript types. If a field is missing or has the wrong type, TypeScript errors surface in the `npm run dev` console immediately.
2. **In the smoke test** (Phase 4 task 6 in `02_BUILD_PLAN.md`) — runs the pipeline end-to-end, then runs the dashboard against the fresh output. Any drift is caught here before it reaches the demo.

The Python pipeline does not generate the TypeScript types — they're maintained by hand in `app/types/`. When a field is added or changed, both sides update together as a single PR. **Updating only one side is a bug.**

### Why no API layer

A REST or GraphQL layer between the pipeline and the dashboard would add: (a) a Python web server, (b) request/response serialization on both sides, (c) state management around fetch states (loading, error, retry), (d) deployment story for the API. None of that earns the project anything for a demo where the data is computed once and viewed many times.

Static files are simpler, faster (no network round-trip), reliable (no server to crash), and free to deploy (Next.js's static export to any CDN). It's the right call for this scope.

### What the pipeline must guarantee on every run

- All three data files exist and are valid JSON.
- Every `evidence_clip_path` referenced in `findings.json` points to a file that actually exists in `app/public/clips/`.
- Field types match the TypeScript interfaces.
- Timestamps are consistent across files (a finding's `timestamp_seconds` falls within `flight_path.start` and `flight_path.end`).

The smoke test verifies all four guarantees.

---

## 3. TypeScript Schemas

These live in `app/types/` and are the contract anchors. Reproduced here for reference — the canonical source is in code.

### `app/types/findings.ts`

```typescript
export type Severity = "critical" | "high" | "moderate" | "low" | "no_action";

export type Condition = "intact" | "damaged" | "contaminated" | "unclear";

export type ComponentType =
  | "insulator_string"
  | "conductor"
  | "tower"
  | "vegetation"
  | "guy_wire"
  | "other";

export type FindingClass =
  | "insulator_damage"
  | "vegetation_encroachment"
  | "other";

export type Confidence = "high" | "medium" | "low";

export type DiscoverySource = "anomaly_query" | "inventory_query";

export interface Finding {
  // Identity
  finding_id: string;                    // e.g. "f001"

  // Temporal
  timestamp_seconds: number;             // center of the candidate moment
  start_seconds: number;                 // clip start (timestamp_seconds - clip_pre_seconds)
  end_seconds: number;                   // clip end

  // Spatial context (from telemetry lookup)
  gps_lat: number;
  gps_lon: number;
  altitude_m_agl: number;
  altitude_m_msl: number;
  heading_deg: number;
  ground_speed_mps: number;
  datetime_utc: string;                  // ISO 8601

  // Detection (from Marengo)
  marengo_score: number;                 // 0.0–1.0
  matched_queries: string[];             // queries that surfaced this moment
  discovery_source: DiscoverySource;

  // Description (from Pegasus)
  component_type: ComponentType;
  condition: Condition;
  specific_defects: string[];
  vegetation_distance_estimate_ft: number | null;
  pegasus_confidence: Confidence;

  // Derived (severity scoring)
  class: FindingClass;
  severity: Severity;
  combined_confidence: Confidence;
  needs_human_review: boolean;
  nerc_citation: string | null;          // e.g. "FAC-003 §R2.1"; populated by pipeline/severity.py from the rules engine

  // Evidence
  evidence_clip_path: string;            // path relative to app/public/, e.g. "/clips/f001.mp4"
}
```

### `app/types/telemetry.ts`

```typescript
export interface FlightPath {
  // Polyline coordinates as [lat, lon] pairs in chronological order
  coordinates: [number, number][];

  // Bounds for plotting
  start_datetime_utc: string;            // ISO 8601
  end_datetime_utc: string;              // ISO 8601

  // Aggregate stats for the dashboard header
  total_distance_km: number;
  total_duration_seconds: number;
  start_lat: number;
  start_lon: number;
  end_lat: number;
  end_lon: number;
}
```

### `app/types/metadata.ts`

```typescript
import type { Severity, FindingClass, Condition } from "./findings";

export interface RunMetadata {
  run_id: string;                        // e.g. "run_20260425_220000"
  run_datetime_utc: string;              // ISO 8601 of when the pipeline ran
  pipeline_version: string;              // git SHA or semver

  // Source video
  source_video_filename: string;
  source_video_duration_seconds: number;

  // Inspection context
  voltage_class: "230kV" | "345kV" | "500kV" | "other";
  corridor_description: string;          // human-readable, e.g. "Ameren Missouri 345kV West St. Louis"
  corridor_disclosed_as_simulated: boolean;  // always true for the demo

  // Aggregate counts
  total_findings: number;
  findings_by_severity: Record<Severity, number>;
  findings_by_class: Record<FindingClass, number>;
  findings_by_condition: Record<Condition, number>;
}
```

### Why these types and not others

Three principles drove the schema design:

1. **One field, one source.** Every field has exactly one owner — Marengo, Pegasus, telemetry, or the severity rules. No redundant or derived fields that could drift.
2. **Discovery source is explicit.** `discovery_source` distinguishes anomaly-query findings from inventory-query findings. The narrow build only emits `anomaly_query`; the broad version (Workflow 03 stretch) adds `inventory_query`. Future analysis or filtering can use this field.
3. **Confidence is layered.** `marengo_score` and `pegasus_confidence` are the raw signals; `combined_confidence` is the user-facing derived field. All three are kept so the detail panel can show the underlying signals when a user hovers (transparency requirement from the rubric).

---

## 4. `.gitignore` Policy

The root `.gitignore` covers Python, environment files, large data, and pipeline working directories. The `app/.gitignore` (auto-generated by `create-next-app`) covers Node.js and Next.js artifacts.

### Root `.gitignore`

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.venv/
venv/
env/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Environment
.env
.env.local
*.pem

# Large source data (regenerable)
data/raw/
data/curated/demo_video.mp4

# Pipeline working directories (out/ is tracked, see Section 1)
data/clips_working/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# AWS credentials (defense in depth — never commit these)
.aws/
credentials
```

### `app/.gitignore` (Next.js auto-generated, keep as-is plus additions)

```gitignore
# Standard create-next-app output
node_modules/
.next/
out/
build/
.vercel/

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment
.env*.local
```

### What is tracked, definitively

| Path | Tracked? | Notes |
|---|:---:|---|
| All source code (`pipeline/`, `scripts/`, `examples/`, `data_prep/`, `app/components/`, `app/lib/`, `app/types/`) | ✅ | Always |
| All docs (`docs/*.md`, `README.md`) | ✅ | Always |
| Configuration (`requirements.txt`, `package.json`, `tsconfig.json`, etc.) | ✅ | Always |
| `.env.example` | ✅ | Template only — no real secrets |
| `data_prep/README.md` | ✅ | Wayfinding for data_prep workstream |
| `data_prep/corridor_waypoints.json` | ✅ | Tiny; corridor definition (consumed only by `data_prep/generate_telemetry.py`) |
| `data/curated/source_log.md` | ✅ | Tiny; reproducibility |
| `data/telemetry/demo_video_telemetry.csv` | ✅ | Small; produced by data prep team |
| `data/validation/ground_truth.csv` | ✅ | Critical for F1 reproducibility; produced by data prep team |
| `data/synthetic/maintenance_log.csv` | ✅ if exists | Workflow 03 stretch |
| `out/findings.{json,csv,geojson}` | ✅ | Canonical run outputs; small |
| `out/validation_metrics.json` | ✅ | Source for accuracy claims |
| `app/public/data/*.json` | ✅ | Required for dashboard to work |
| `app/public/clips/*.mp4` | ✅ | Required for dashboard to work; ~75 MB |
| `submission/demo.mp4` | ✅ | Final submission |
| `submission/one_page_impact.pdf` | ✅ | Final submission |
| `data/raw/` | ❌ | Large (many GB), regenerable |
| `data/curated/demo_video.mp4` | ❌ | Large, regenerable |
| `data/clips_working/` | ❌ | Working dir during pipeline iteration |
| `node_modules/`, `.next/`, `.venv/`, `__pycache__/` | ❌ | Build / install artifacts |
| `.env` | ❌ | Real secrets |
| `.aws/`, `credentials` | ❌ | Defense in depth |

### Git LFS escape hatch

If `app/public/clips/` exceeds ~200 MB total, switch to Git LFS for that directory:

```bash
git lfs install
git lfs track "app/public/clips/*.mp4"
git add .gitattributes
```

GitHub allows up to 1 GB of LFS storage on free plans. Should be plenty.

---

## 5. Environment Variables

All env vars are loaded by `python-dotenv` from `.env` at the repo root. The Next.js dashboard does not use any environment variables — it reads only static files.

### `.env.example` (committed)

```bash
# AWS Bedrock — required for pipeline runs
AWS_ACCESS_KEY_ID=your_key_here
AWS_SECRET_ACCESS_KEY=your_secret_here
AWS_REGION=us-west-2

# TwelveLabs models on Bedrock
# Exact model IDs come from the workshop / docs; placeholders here
BEDROCK_MARENGO_MODEL_ID=twelvelabs.marengo-embed-3-0
BEDROCK_PEGASUS_MODEL_ID=twelvelabs.pegasus-1-2

# Optional: override default paths
# GRIDSIGHT_DATA_DIR=./data
# GRIDSIGHT_OUT_DIR=./out
```

### `.env` (gitignored)

The real values, filled in by each developer. Never committed.

### Why no env vars for the dashboard

The dashboard reads static files committed to `app/public/`. It has no API keys, no service URLs, no secrets. This is intentional and is what makes "anyone can clone and run" possible.

---

## 6. Dev Workflow

The two most common workflows. Both should work from a fresh clone.

### Workflow A: Run the dashboard only (no AWS needed)

This is what a judge or reviewer does. They want to see the finished product.

```bash
git clone <repo-url> gridsight
cd gridsight/app
npm install
npm run dev
# Open http://localhost:3000
```

That's the entire flow. Three commands. The dashboard loads with the canonical run's findings, flight path, evidence clips, and exports.

### Workflow B: Run the full pipeline (AWS Bedrock required)

This is what a developer does when iterating on detection or running on new footage.

```bash
# One-time setup
git clone <repo-url> gridsight
cd gridsight
python -m venv .venv
source .venv/bin/activate          # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Configure AWS access
cp .env.example .env
# Edit .env with your AWS credentials

# Verify Bedrock access (Phase 1 smoke test)
python examples/bedrock_smoke_test.py

# At this point, the data prep team has already placed
# data/curated/demo_video.mp4 (out-of-band, gitignored),
# data/telemetry/demo_video_telemetry.csv (committed), and
# data/validation/ground_truth.csv (committed) into the repo.
# See docs/08_EXTERNAL_DATA_HANDOFF.md for what they produce.

# Run the full pipeline
python pipeline/run_all.py

# View the results
cd app && npm run dev
```

### Workflow C: Regenerate demo input data (data prep team workflow)

Only run these if the demo's input data needs to be rebuilt — for example, if the curated cut is being changed or a new corridor is being used.

```bash
# Stitch raw YouTube footage into the canonical 25-min cut
# Reads data/curated/source_log.md, downloads via yt-dlp, stitches via ffmpeg
python data_prep/curate_video.py

# Generate the simulated drone telemetry along the chosen corridor
# Reads data_prep/corridor_waypoints.json, writes data/telemetry/demo_video_telemetry.csv
python data_prep/generate_telemetry.py
```

### Workflow D: Run unit tests

```bash
# Python pipeline tests
pytest pipeline/tests/

# Dashboard type-checking
cd app && npm run build       # surfaces any TypeScript errors
```

### Workflow E: Convert a real DJI SRT to our telemetry CSV

Demonstrates production compatibility.

```bash
python scripts/srt_to_csv.py path/to/dji_export.srt path/to/output.csv
```

The output CSV is directly usable as a `demo_video_telemetry.csv` replacement.

---

## 7. File Naming Conventions

**Python:** `snake_case.py`. Module names are lowercase, functions and variables snake_case, classes PascalCase. Pipeline modules grouped by stage (`marengo_detect.py`, `pegasus_describe.py`, `severity.py`).

**TypeScript / React:** Component files `PascalCase.tsx` (`FlightPathMap.tsx`). Helpers and types `camelCase.ts` (`data.ts`, `severity.ts`). Type-only files in `app/types/` are `lowercase.ts` (`findings.ts`, `telemetry.ts`).

**Markdown documents:** numbered prefix + uppercase identifier, e.g. `01_MASTER.md`. Numbers reflect logical order, not strict precedence — they help with sorting in file explorers.

**Data files:** `snake_case` for column names in CSVs and JSON keys. Lat/lon as `latitude` / `longitude` or `gps_lat` / `gps_lon` consistently — never abbreviated as `lat` / `lng` to avoid ambiguity with the `lng` (language) convention.

**Evidence clips:** `f{NNN}_{class}_{timestamp}.mp4` — e.g. `f007_insulator_damage_142.mp4`. The `{NNN}` is zero-padded so files sort numerically. The class name uses underscores.

**Run IDs:** `run_YYYYMMDD_HHMMSS` UTC. Matches the `run_id` field in metadata.

---

## 8. Where things live (decision rules)

When you're about to add a new file and you're not sure where it goes:

- **A new pipeline stage or transformation step** → `pipeline/<descriptive_name>.py`. Add it to the `run_all.py` orchestrator.
- **A utility script that's part of the GridSight product** (e.g., a parser, format converter, or production-compat tool) → `scripts/`.
- **A script that produces demo input data** (footage curation, telemetry generation, validation labeling helpers) → `data_prep/`. These are not part of the GridSight product; they exist to create the hackathon demo's inputs. See `01_MASTER.md` Decision D16.
- **A unit test** → `pipeline/tests/test_<module>.py`. One test file per pipeline module.
- **A reference example, smoke test, or sample input** → `examples/`.
- **A new React component** → `app/components/PascalCase.tsx`. One component per file.
- **A TypeScript helper or hook used by multiple components** → `app/lib/`.
- **A new type or interface** → `app/types/`. If it changes the pipeline → dashboard contract, the pipeline must be updated in the same PR.
- **A new planning or research document** → `docs/<NN>_NAME.md`. Append a number that follows the existing sequence.
- **A new data file consumed by the pipeline** → `data/<category>/`. Track it if small and regenerable; gitignore if large.
- **A new data file consumed only by `data_prep/` scripts** (configuration, corridor definitions, etc.) → `data_prep/`. Co-locate with its consumer.
- **A new pipeline output** → `out/` if it's a deliverable file (CSV, GeoJSON, JSON metrics); `app/public/data/` if the dashboard needs it; both if both consumers exist.

When none of these fit, the new thing is genuinely different. Append a section to this document explaining the new pattern, then add the file.

---

## 9. What's NOT in this repo (deliberate omissions)

- **No Docker / docker-compose.** Not needed for hackathon scope. Adding it costs setup time and earns nothing.
- **No CI / GitHub Actions.** Manual `pytest` and `npm run build` cover the same ground in a 24-hour timeline.
- **No deployment configuration.** The dashboard runs on `npm run dev` for the demo. If we wanted to host it publicly, `npm run build && npm run start` (or static export) would work, but that's not a deliverable.
- **No database.** Static JSON files are the data layer.
- **No authentication.** Single-user demo.
- **No telemetry / analytics on the dashboard.** Privacy and scope.
- **No Sentry / error tracking.** Errors surface in the browser console during the demo; that's enough.

These omissions are deliberate and consistent with the anti-goals in `02_BUILD_PLAN.md`. If a teammate proposes adding any of them, the answer is no unless we re-open the planning docs.

---

*End of document. When the structure here drifts from reality during the build, update this doc rather than letting the drift stand.*
