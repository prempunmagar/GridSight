# GridSight — Master Project Document

> **Working project name: GridSight.** Short, demo-friendly, easy to say. Replace before submission if the team wants something else.

> **Status:** Draft, Saturday April 25, 2026.
> **Hackathon:** Geospatial Video Intelligence Hackathon, St. Louis.
> **Track:** 02 — Energy Infrastructure Monitoring.
> **Workflow:** 02 — Transmission Line Inspection.

---

## How to use this document

This is the source of truth for what GridSight is and how it works. When a question comes up about scope, architecture, or what counts as an anomaly, the answer lives here. When a new decision is made during the build, append it to **Section 13 — Decisions Log** so the team doesn't relitigate it later.

The companion documents are:
- `02_BUILD_PLAN.md` — the ordered execution playbook (how we build it, in what order)
- `03_REPO_STRUCTURE.md` — directory layout, pipeline-dashboard contract, schemas
- `04_DATA_BRIEF.md` — what demo input data we need and where it comes from
- `05_DOMAIN_KNOWLEDGE.md` — NERC standards, failure modes, severity grounding
- `08_EXTERNAL_DATA_HANDOFF.md` — coordination doc for the team producing demo input data

This document points at those for detail. Numbers that come from regulation (e.g., NERC MVCD values) live in the Domain Knowledge Document so there is one authoritative source.

---

## 1. Project Identity

**One-line pitch:** GridSight is an AI system that processes drone footage of high-voltage transmission lines and automatically detects damaged insulators and dangerous vegetation encroachment, producing georeferenced inspection reports that route directly into utility work-order systems.

**What we are NOT building:** a perfect classifier, a real-time monitoring system, a mobile app, or a multi-asset platform. We are building a focused, defensible demonstration of how video foundation models can replace frame-by-frame human review for two specific, regulation-grounded anomaly types on one type of infrastructure.

---

## 2. The Problem

The U.S. operates 200,000 miles of high-voltage transmission lines that require continuous inspection to prevent failures. Current inspection protocols depend on manual drone or helicopter flights with human analysts reviewing footage frame-by-frame. The process is expensive, slow, and inconsistent. Operators currently review on the order of 20–30 miles of footage per analyst per day.

Two specific failure modes drive most of the regulatory and reliability pressure on transmission operators:

**Insulator damage.** Insulators are the porcelain or polymer hardware that suspends energized conductors from steel towers. When they crack, shatter, contaminate, or burn, they can cause flashovers and outages. Damage is often visually obvious from drone altitude but can be missed by tired analysts reviewing hours of footage.

**Vegetation encroachment.** Trees and branches growing too close to energized conductors are the leading cause of large-scale grid outages in North America. NERC FAC-003 mandates minimum vegetation clearance distances; violations are reportable and carry significant penalties. Detecting encroachment from aerial footage is conceptually simple but tedious at human scale.

A system that automates the detection of these two anomaly types — even imperfectly — directly addresses regulatory exposure (FAC-003 compliance) and reliability risk (outage prevention). That is what GridSight does.

---

## 3. The Solution

GridSight is a pipeline that processes standard drone inspection inputs — a video file plus its companion telemetry stream — to assess the condition of transmission line assets. In the demo configuration the pipeline focuses on two asset/anomaly classes (damaged insulators, vegetation encroachment); the same architecture extends to full-inventory asset monitoring through additional query sets without code changes.

The two inputs run in parallel through the system:

1. **Ingest** the inputs: a curated ~25-minute video (MP4) and a per-second telemetry file (CSV, with DJI SRT support). For the demo we generate a representative telemetry file along a real US transmission corridor, since YouTube footage does not retain its original drone telemetry. The pipeline reads either source identically — generated for the demo, or recorded by a real drone in production.
2. **Index** the video with TwelveLabs Marengo 3.0 via AWS Bedrock, making it semantically searchable.
3. **Detect** candidate assets by running natural-language queries against the index. The narrow demo configuration uses anomaly-flavored queries; the broad configuration adds inventory queries to discover every visible asset of interest. Each query returns timestamped candidate moments.
4. **Extract** a 10–15 second evidence clip around each candidate timestamp using ffmpeg.
5. **Describe** each clip with TwelveLabs Pegasus 1.2, using a structured JSON-output prompt to capture component type, condition (intact / damaged / contaminated / unclear), and specific defects. Pegasus describes — it does not filter; intact findings flow through to the output the same as anomalies, and the dashboard filters on condition rather than the pipeline filtering before output.
6. **Score and locate** by mapping each finding to a severity tier grounded in NERC FAC-003 and looking up GPS coordinates, altitude, and heading from the telemetry file at each finding's timestamp.
7. **Export** as CSV and GeoJSON, plus a Next.js dashboard with map view, flight-path overlay, telemetry inspector, and evidence clip playback. The dashboard reads pre-computed pipeline output from disk and requires no live API calls — anyone can clone the repo and run it.

The result is a stack of work-order-ready findings, each with a timestamp, an approximate location, a condition assessment, a severity, and a 15-second evidence clip — exactly the format the judging rubric describes for "operational readiness."

---

## 4. Scope

The hackathon brief is emphatic: pick one workflow and ship it. Scope discipline is the single biggest predictor of whether we finish.

### 4.1 In scope

We are building, end-to-end, a system that:

- Processes ~25 minutes of curated 1080p YouTube drone footage of high-voltage transmission line inspection.
- Targets two anomaly classes: **insulator damage** and **vegetation encroachment** (defined precisely in Section 5).
- Operates on **lattice steel suspension towers** as the primary asset type. Lattice steel is the most common high-voltage tower form in North America and is well-represented in publicly available drone footage.
- Ingests standard drone inspection inputs: a video file plus a companion per-second telemetry stream (CSV, with DJI SRT support via a real parser, not a stub). For the demo we generate a representative telemetry file in standard format along a real US transmission corridor; in production the same pipeline reads telemetry recorded by the drone during the flight, with no code changes. The simulation is disclosed transparently in the submission.
- Uses an **asset-centric data model**: every observed asset is recorded with its condition (intact / damaged / contaminated / unclear), and the dashboard filters on condition rather than the pipeline filtering before output. Intact findings flow through to the output the same as anomalies.
- Produces CSV and GeoJSON exports with timestamps, GPS, altitude, heading, condition, severity, evidence clip references, and confidence scores.
- Provides a Next.js dashboard (with Leaflet map) showing flight-path overlay, severity-tier color coding, click-to-play evidence clips, telemetry inspector panel, and a default filter to "needs action" findings with toggle for all observed assets.
- Reads pre-computed pipeline output from disk so the dashboard runs without AWS credentials. Anyone who clones the repo can run the dashboard immediately and see the canonical demo results. Live pipeline runs are gated behind an explicit env var.
- Includes a manually-labeled validation set of 20–25 anomalies used to compute precision, recall, and F1 per class.

**Forward compatibility note.** The architecture is designed so that asset coverage can be expanded by adding query sets without pipeline changes. Full-inventory monitoring (the "broad version" — find every visible asset, not just suspicious ones) is a stretch goal contingent on the Workflow 03 inclusion decision (Section 13). The narrow demo build does not include broad-version queries, but does not preclude them either.

### 4.2 Out of scope (anti-goals)

We are explicitly *not* doing the following. If a teammate proposes any of these mid-build, the answer is no unless we re-open this document:

- **Pipeline inspection (Workflow 01).** Different domain, different data, different regulations. Adding it doubles scope and halves quality.
- **Multi-source correlation (Workflow 03) as a primary capability.** Possible *only* as a small bonus gesture, with hard time cap, after the core pipeline is fully working. See Section 13 for the decision rule.
- **Tower corrosion as a primary anomaly class.** Visually subtler than insulator damage, harder to ground in a clean severity rubric, and would expand the labeling burden. Notes-only if Pegasus surfaces it.
- **Guy-wire fatigue detection.** Real failure mode, but rarely captured clearly in YouTube footage and requires close-up views we won't have.
- **Conductor damage detection.** Conductor strands are typically too thin and too far from the camera to assess reliably from drone altitude.
- **Multiple tower types.** No tubular steel, no wood pole, no monopole. Lattice steel suspension only. Other types in the footage are noted but not analyzed.
- **4K processing.** Designed for 1080p consumer-grade footage. The brief explicitly warns against 4K fantasy.
- **Sub-meter GPS accuracy.** ±50m is acceptable for the work-order use case. Sub-meter is a regulatory-grade target we cannot achieve with YouTube source footage and would falsely overclaim.
- **Real-time or streaming analysis.** Batch processing only. The pipeline takes the time it takes.
- **Mobile application.** Web dashboard only.
- **Authentication, multi-user, or persistence beyond a single demo session.** This is a demonstration, not a deployed product.

---

## 5. Anomaly Classes

These definitions are the spec. The Data Research Brief uses them to identify usable footage. The Domain Knowledge Document grounds them in regulation. The validation set labels every anomaly against one of these two classes (or marks it as "out of scope, noted").

### 5.1 Class A — Insulator Damage

An insulator string is the chain of porcelain or polymer disks that suspends an energized conductor from the cross-arm of a tower. We flag the following visible conditions:

- **Shattered or chipped porcelain disks.** Missing chunks, fractured edges, or visibly broken segments along the string.
- **Missing insulator units.** Gaps in the string where a disk should be.
- **Cap-and-pin corrosion.** Rust streaks running down from metal hardware along the string.
- **Polymer sheath degradation.** Discoloration, tracking marks, or visible erosion on polymer (composite) insulator surfaces.
- **Heavy contamination.** Bird streamers (large white deposits), salt or industrial pollution buildup, ash coating.
- **Flashover burn marks.** Charred, blackened, or melted regions indicating a previous arcing event.

What does **not** count as Class A:
- Normal weathering discoloration on porcelain.
- Light surface dust or rain streaking.
- Photographic artifacts (lens flare, motion blur, glare).
- Hardware on the tower that is not part of the insulator string itself (clamps, dampers, etc., unless visibly broken).

Severity tiers (qualitative — exact scoring rules in `05_DOMAIN_KNOWLEDGE.md`):

| Tier | Trigger |
|------|---------|
| Critical | Shattered or missing insulator disk; visible flashover burn |
| High | Severe contamination; significant cap-and-pin corrosion |
| Moderate | Partial damage; moderate contamination; polymer surface erosion |
| Low | Minor surface degradation; cosmetic discoloration |

### 5.2 Class B — Vegetation Encroachment

Vegetation encroachment is any tree, branch, or substantial woody growth that has approached or entered the cleared right-of-way around energized conductors. NERC FAC-003 defines specific clearance distances by voltage class; we use those distances to set severity.

What counts as Class B:
- Trees within the right-of-way corridor whose canopy is at or above conductor height.
- Tree branches visibly close to or overhanging conductors.
- Branches that have grown beneath conductors and are approaching from below.
- Dense growth at the edge of the cleared corridor where individual trees can be expected to fall toward conductors (fall-in risk).

What does **not** count as Class B:
- Low ground cover, grasses, or shrubs well below conductor height.
- Vegetation outside the right-of-way that poses no fall-in risk.
- Vegetation along the towers themselves at ground level (a different concern, not FAC-003).

Severity tiers (qualitative — exact MVCD numbers in `05_DOMAIN_KNOWLEDGE.md`):

| Tier | Trigger |
|------|---------|
| Critical | Vegetation in contact with or within MVCD of conductor |
| High | Vegetation just outside MVCD but within active management threshold |
| Moderate | Vegetation within the right-of-way but at safe distance |
| Low / ignored | Vegetation outside right-of-way, no fall-in risk |

### 5.3 Asset condition model and the "no-action" tier

Each finding the pipeline produces carries two assessments:

- **Condition** (from Pegasus): `intact` | `damaged` | `contaminated` | `unclear`
- **Severity** (derived from condition + specifics + class): `critical` | `high` | `moderate` | `low` | `no_action`

Severity is derived from condition as follows:

| Pegasus condition | Resulting severity |
|---|---|
| `intact` | `no_action` |
| `damaged` or `contaminated` | `critical` / `high` / `moderate` / `low` per the class tables in 5.1 and 5.2 |
| `unclear` | `low` (and tagged `needs_human_review` for visibility in the dashboard) |

**Why we keep intact findings.** When Marengo flags a moment as a candidate but Pegasus assesses the asset as intact, that record stays in the output as an `intact` / `no_action` finding. We do not drop it. Three reasons:

1. **Honesty.** Hiding intact findings hides the system's false-positive surface. Showing them with explicit `no_action` severity is more credible than pretending Marengo's misfires never happened.
2. **Forward compatibility.** The broad-version stretch (full-inventory monitoring, Workflow 03 extension) requires the system to record every observed asset, healthy or not. The narrow build adopts the same data model so the broad version is additive, not a refactor.
3. **Maintenance correlation.** If we ship the Workflow 03 maintenance correlation, having intact assets in the table strengthens the "your system is providing visibility into all observed assets, not just problems" framing.

The dashboard defaults to filtering `severity != no_action` (i.e., the actionable findings) with a toggle to reveal all observed assets. The pipeline does not filter.

---

## 6. System Architecture

The pipeline runs on two parallel inputs (video and telemetry) and produces structured findings through seven stages. Each stage has a defined input and output so the team can develop them independently and integrate at known interfaces.

**Data preparation (one-time, before pipeline run):**

- Curate raw YouTube footage into `data/curated/demo_video.mp4` (~25 min, 1080p)
- Generate a per-second telemetry file along a chosen transmission corridor into `data/telemetry/demo_video_telemetry.csv`
- *In production both files are produced by the drone during the inspection flight; no demo prep is needed.*

**Pipeline stages:**

```
[ demo_video.mp4 ]      [ demo_video_telemetry.csv ]
        │                          │
        └────────────┬─────────────┘
                     ▼
        Stage 1: Ingest inputs
        (parse video file + load telemetry table)
                     │
                     ▼
        [ video ready + telemetry indexed by timestamp ]
                     │
                     ▼
        Stage 2: Index video
        (TwelveLabs Marengo 3.0 via Bedrock)
                     │
                     ▼
        [ Marengo video index ID ]
                     │
                     ▼
        Stage 3: Detect anomalies
        (NL queries against Marengo)
                     │
                     ▼
        [ list of {timestamp, query, score} ]
                     │
                     ▼
        Stage 4: Extract evidence clips
        (ffmpeg, 10–15s windows)
                     │
                     ▼
        [ evidence clips on disk ]
                     │
                     ▼
        Stage 5: Describe clips
        (TwelveLabs Pegasus 1.2 via Bedrock)
                     │
                     ▼
        [ structured JSON per clip ]
                     │
                     ▼
        Stage 6: Score severity + locate
        (rules engine + telemetry lookup at timestamp)
                     │
                     ▼
        [ enriched findings: severity + GPS + altitude + heading ]
                     │
                     ▼
        Stage 7: Export + display
        (write CSV, GeoJSON, findings.json, clips to disk;
         Next.js dashboard reads from disk — no API layer)
```

**Pipeline / dashboard separation.** The pipeline is a Python program that runs once and writes its output to disk. The dashboard is a Next.js app that reads those files at startup. There is no API layer between them and no live AWS calls in the dashboard. The repo ships with the canonical run's output committed under `app/public/data/` and `app/public/clips/`, so anyone can clone and run `npm run dev` to see the working dashboard immediately. Re-running the pipeline (with AWS credentials and Bedrock access) regenerates those files.

**Interface contracts between stages:**

- *Stage 1 → 2:* a video file path and an in-memory telemetry table keyed by timestamp. The telemetry table is available to every downstream stage that needs spatial context.
- *Stage 2 → 3:* a Marengo index ID and a list of query strings. Output is a list of dicts with `timestamp_seconds`, `query_string`, `marengo_score`.
- *Stage 4 → 5:* file paths to MP4 clips of 10–15 seconds each, named by timestamp.
- *Stage 5 → 6:* parsed JSON dict per clip with keys `component_type`, `condition` (`intact` | `damaged` | `contaminated` | `unclear`), `specific_defects` (list), `vegetation_distance_estimate_ft` (number or null), `pegasus_confidence` (qualitative). Records with `condition: intact` flow through unchanged — they are not dropped.
- *Stage 6 → 7:* enriched finding records with all of the above plus `severity`, `gps_lat`, `gps_lon`, `altitude_m_agl`, `heading_deg`, `evidence_clip_path`, `finding_id`.

Anyone implementing one stage only needs to honor the input/output contract.

---

## 7. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Video indexing & search | **TwelveLabs Marengo 3.0** via AWS Bedrock | Required by hackathon. Best fit for semantic search over video. |
| Video-to-text | **TwelveLabs Pegasus 1.2** via AWS Bedrock | Required by hackathon. Used for structured per-clip descriptions. |
| Model serving | **AWS Bedrock** | Hackathon-provided credits. Production-grade hosting for both models. |
| Pipeline orchestration | **Python 3.11+** with `boto3`, `pandas`, `numpy` | Standard for AWS, fastest path to working pipeline. |
| Clip extraction | **ffmpeg** (via subprocess or `ffmpeg-python`) | Reliable, scriptable, handles MP4 cleanly. |
| Telemetry parsing | Custom CSV reader + **DJI SRT parser** (real, not stub) | Production-compat claim is concrete: parser ingests real DJI exports. |
| Dashboard | **Next.js (App Router) + React + TypeScript** | Custom map interactions, telemetry inspector panel, and animated drone marker are first-class in React. Worth the extra plumbing for a richer demo. |
| Map rendering | **Leaflet via `react-leaflet`** | Open-source, no API key drama. Handles polylines (flight path) + markers + popups cleanly. |
| Pipeline → dashboard contract | **Static JSON + clip files in `app/public/`** | No API layer. Pipeline writes; dashboard imports / fetches static assets. Anyone can run the dashboard without AWS credentials. |
| Repo & submission | **GitHub** + **DevPost** | Submission requirement. |

---

## 8. Data Approach (summary)

The demo's input data — curated video, simulated drone telemetry, and the manual validation labels for grading — is produced by a separate workstream within the team, working in `data_prep/` of the repo. The GridSight pipeline ingests their outputs; it does not produce them. Public YouTube is the primary footage source. The companion drone telemetry file is generated in standard format alongside the curated video. Coordination is via `08_EXTERNAL_DATA_HANDOFF.md`; sourcing strategy and quality criteria are in `04_DATA_BRIEF.md`.

Summary numbers:
- ~60 minutes of candidate footage downloaded (data prep team)
- Curated to ~25 minutes for the canonical demo run (data prep team)
- 1080p preferred; 720p acceptable only if content is exceptional
- Minimal cuts, music overlays, or talking-head segments
- One companion telemetry file generated alongside the curated video (data prep team)
- Manual validation set of 20–25 anomalies labeled per the rules in `05_DOMAIN_KNOWLEDGE.md` (data prep team)

Spatial context for each finding (GPS, altitude, heading) comes from the companion telemetry file, ingested by the pipeline at runtime. Full framing in section 8.1 below.

### 8.1 Drone telemetry: real format, simulated values

GridSight is designed to ingest the standard inputs that a real drone inspection produces: a video file and a companion telemetry stream. Most consumer and prosumer drones output telemetry in well-documented formats — DJI's per-frame SRT subtitle file, or a per-second CSV exported from common flight-log tools. Our pipeline ingests this format directly.

Because YouTube footage strips the original telemetry, we **generate a representative telemetry file** alongside the curated demo video. The format is real; the values are simulated. The pipeline does not know or care which is which.

**The architectural commitment:** GridSight ingests standard drone telemetry. The fact that ours is generated for the hackathon demo does not change what the pipeline can read. In production, a user uploads their video and their drone's telemetry export. The pipeline code is unchanged.

**Telemetry file format.** We use a per-second CSV with these columns:

```
timestamp_seconds, datetime_utc, latitude, longitude,
altitude_m_agl, altitude_m_msl, heading_deg,
pitch_deg, roll_deg, gimbal_pitch_deg, ground_speed_mps
```

This is a superset of what most flight-log exports provide and is trivially producible from a DJI SRT file. We document the schema in the README so users with their own drone data can format it the same way.

**DJI SRT support.** We ship a real DJI SRT parser (`scripts/srt_to_csv.py`), not a stub. It parses the standard DJI subtitle-file format — extracting timestamp, latitude, longitude, and altitude lines — and writes the per-second CSV the pipeline ingests. A judge from the drone industry could literally hand us a DJI SRT file and our pipeline would process it. The parser is intentionally narrow (we don't parse camera settings or gimbal metadata), but it's real, tested, and correct for the fields the pipeline actually uses.

**How the file is generated for the demo.** A small one-time prep script:

1. Picks a real US transmission corridor (a published utility route).
2. Traces 5–10 waypoints along the corridor on a map to capture its bends.
3. Interpolates piecewise between waypoints to produce a continuous lat/lon path.
4. Adds altitude data consistent with typical drone inspection flights (~30–50m above ground level).
5. Computes heading from successive lat/lon deltas.
6. Adds gentle realistic perturbations so the data does not read as artificially smooth.
7. Stamps a plausible recent inspection date and time.

The output is a CSV that an inspection engineer would accept as plausible flight telemetry.

**What this means for the demo concretely:**

- Every finding receives a full set of telemetry fields: GPS coordinates, altitude AGL/MSL, heading, and ground speed at that timestamp.
- The dashboard can show a flight-path overlay on the map, drawn from the telemetry, alongside the finding pins.
- Selecting a finding can display the drone's full state at that moment (where it was, what direction it was facing, how high above ground).
- Coordinates are *representative* of where the system would place findings given a real flight along the chosen corridor — not *measurements* of where the YouTube footage was originally captured.
- Visual content and telemetry are independent in this demo; in production they are produced by the same flight. We pick the corridor after curating the footage so the environments roughly match, and we acknowledge the decoupling openly if it becomes visible.

This distinction is disclosed in the README, the technical doc, and verbally during the live demo. Judges familiar with drone telemetry will recognize that YouTube cannot carry GPS data, so any other framing would read as overclaim. Showing a real-format telemetry file that the pipeline ingests is significantly stronger than a hand-waved "we made up coordinates."

---

## 9. Domain Grounding (summary)

Severity scoring, terminology, and the validation rubric are grounded in:
- **NERC FAC-003** for vegetation clearance distances by voltage class
- **Industry references on insulator failure modes** (porcelain shattering, polymer degradation, contamination flashover, cap-and-pin corrosion)
- **Lattice steel tower component terminology** (cross-arm, suspension hardware, conductor, shield wire, insulator string)

Detail and exact numbers in `05_DOMAIN_KNOWLEDGE.md`. The Master Doc deliberately does not duplicate the numbers — there is one authoritative source.

---

## 10. Success Criteria

### 10.1 Mapped to the judging rubric

| Rubric weight | Category | What we deliver |
|---:|---|---|
| 35% | Detection Accuracy | Validation set of 20–25 manually-labeled anomalies. Precision, recall, F1 reported per class. Confusion matrix. False positive analysis. Severity calibration check. |
| 25% | Domain Understanding | Severity tiers grounded in NERC FAC-003 numbers. Failure mode taxonomy in our reports. Asset-specific terminology used correctly. Voltage-class-aware severity. |
| 20% | Technical Implementation | Marengo used for semantic search across full video — explicit talking point that this beats single-frame CV. Pegasus used for structured descriptions. Reproducible pipeline from GitHub. |
| 15% | Operational Readiness | CSV + GeoJSON exports compatible with real work-order systems. Evidence clips accessible from the dashboard. Confidence scores transparent. Format documented. |
| 5% | Innovation | Optional Workflow 03 gesture: maintenance log + visual finding correlation, capped at minimal time. |

### 10.2 Internal targets

These are the numbers we hold ourselves to. Beating them is great. Falling short is OK if we have an honest story about where the gaps are.

| Metric | Target | Rationale |
|---|---|---|
| Precision per class | ≥ 0.6 | Better than random; defensible at hackathon scale. |
| Recall per class | ≥ 0.5 | Brief explicitly says we don't need perfect classification. |
| F1 per class | ≥ 0.55 | Geometric mean of the above. |
| Severity calibration | Critical findings should be visibly serious in the demo | Manual sanity check, not a numeric metric. |
| Localization (timestamp) | ±5 seconds of true anomaly midpoint | Within evidence clip window. |
| Localization (GPS) | ±50 m along the simulated corridor path | Distance is measured against the simulated telemetry path, not against the unknown original capture location. Acceptable for work-order routing. |
| End-to-end processing time | < 60 seconds per minute of source video | Allows the demo to run in near-real-time on stage if we want. |

### 10.3 Combined confidence indicator

Each finding has two confidence signals: Marengo's numeric similarity score (0.0–1.0) and Pegasus's qualitative confidence (`high` / `medium` / `low`). Both are surfaced in the dashboard's detail panel, and a single derived field is used for sorting and filtering:

| Marengo score | Pegasus confidence | Combined indicator |
|---|---|---|
| ≥ 0.7 | `high` | **high** |
| ≥ 0.7 | `medium` | medium |
| ≥ 0.7 | `low` | low |
| 0.5–0.7 | `high` | medium |
| 0.5–0.7 | `medium` | medium |
| 0.5–0.7 | `low` | low |
| < 0.5 | any | low |

The combined indicator is what users see by default. The two underlying signals are visible on hover or in the detail panel for transparency. This rule is documented in the README under "How confidence is computed."

---

## 11. Deliverables Checklist

Required submissions per the hackathon brief:

- [ ] **Working demonstration system** — runnable pipeline from video to findings.
- [ ] **Dashboard / map interface** — findings with severity indicators, evidence clip playback.
- [ ] **CSV / GeoJSON export** — both formats, working buttons in the dashboard.
- [ ] **Demo video (3–5 min)** — raw footage → analysis → prioritized findings with evidence.
- [ ] **Technical documentation** — architecture, anomaly approach, asset modeling, TwelveLabs integration strategy, performance benchmarks. This Master Doc partially serves; a `TECH.md` will summarize.
- [ ] **GitHub repo** — setup instructions, environment variables, sample run command.
- [ ] **Validation report** — labeled test set, precision/recall/F1 per class, confusion matrix, severity distribution, false positive analysis. Separate doc.
- [ ] **Operational impact brief (one page)** — quantified value, deployment cost vs. manual review, ROI calculation.
- [ ] **DevPost submission** — by 1:00 PM Sunday.

---

## 12. Demo Narrative

There are two demo formats to plan for: the recorded video (3–5 min) and the live presentation (7 min + 3 min Q&A).

### Recorded demo video

- **0:00–0:30 — Problem framing.** Scale of the inspection burden. 200,000 miles of transmission. The cost of a single failure. The throughput ceiling on human analysts.
- **0:30–1:00 — The two inputs.** Show the video file and its companion telemetry CSV side by side. "These are the two things every drone inspection produces. Our system ingests both."
- **1:00–1:45 — Raw footage.** Show ~30 seconds of the source drone footage at normal speed. "This is what an analyst stares at for 8 hours a day."
- **1:45–3:00 — Pipeline walkthrough.** Show the system processing the inputs. Marengo querying. Clips emerging. Pegasus describing them. Findings populating with severity tiers.
- **3:00–4:15 — Dashboard tour.** Map view with the flight path drawn from the telemetry, finding pins along it colored by severity. Click a critical insulator finding — evidence clip plays, telemetry panel shows altitude and heading at that moment, severity reasoning is anchored in NERC. Click a vegetation finding. Show the export buttons producing CSV and GeoJSON.
- **4:15–4:30 — One-line FP acknowledgment.** "Our system flagged 25 candidates against 22 ground-truth anomalies — 19 true positives, 6 false positives, 3 missed. False positive analysis is in the validation report." Brief, factual, doesn't dwell.
- **4:30–5:00 — ROI close.** "Reduces transmission inspection analysis from X miles per analyst per day to Y. $Z annual savings on a 100-mile corridor. Pays back in M months."

### Live stage demo (7 + 3 min)

- **Minute 1 — Problem framing.** Same as video but tighter. Mention the two standard drone inputs: video + telemetry.
- **Minutes 2–3 — Pipeline walkthrough.** Walk the audience through the architecture using the dashboard's pre-computed output (no live AWS calls — too risky on stage). Show both inputs being ingested. Show how Pegasus describes condition (intact / damaged / contaminated / unclear).
- **Minutes 4–5 — Dashboard interaction.** Walk through findings. Show the flight path drawn from telemetry, the severity-coded pins, evidence clip playback, and the telemetry inspector showing drone state at each finding. Toggle the "show all observed assets" view briefly to show the asset-centric model.
- **Minute 6 — Validation results.** Show the confusion matrix on screen for ~20 seconds. State the precision/recall/F1 numbers per class. Acknowledge FPs and FNs without dwelling: "FPs are addressed in the validation report."
- **Minute 7 — ROI close + ask.** What this becomes if deployed. Emphasize: the same pipeline runs on a real drone's telemetry, no code changes — and the architecture extends to full-inventory monitoring, not just anomaly detection.

**Layered honesty principle.** The dashboard shows every finding the pipeline produced (with confidence indicators visible). The recorded video acknowledges FPs in one sentence. The live demo shows the confusion matrix briefly. The validation report does the deep analysis. Each surface gets the level of detail appropriate for it.

The recorded video is the safety net. If anything live breaks at the podium, the video saves us.

---

## 13. Decisions Log

Every major project decision lives here, with rationale. Append new decisions as they happen.

| ID | Date | Decision | Rationale |
|----|------|----------|-----------|
| D1 | 2026-04-25 | Track 02 (Energy Infrastructure Monitoring) | Team selection at hackathon registration. |
| D2 | 2026-04-25 | Workflow 02 (Transmission Lines) over Workflow 01 (Pipelines) | Better data availability on YouTube; visually distinct anomalies; clean regulatory anchoring (NERC FAC-003); brief itself recommends powerline+insulator as the achievable starting point. |
| D3 | 2026-04-25 | Two anomaly classes only: insulator damage + vegetation encroachment | Brief warns 2–3 well-defined classes beats 10 half-working ones. These two are visually distinctive and regulation-grounded. |
| D4 | 2026-04-25 | Lattice steel suspension towers only | Most common form in US high-voltage transmission; well-represented in YouTube footage. |
| D5 | 2026-04-25 | 1080p YouTube footage, ~25 minutes curated from ~60 minutes downloaded | Brief recommends 20–40 min; 25 is comfortable middle. |
| D6 | 2026-04-25 | Pipeline ingests standard drone telemetry (per-second CSV format, DJI SRT compatible). For the demo, telemetry is generated alongside the curated video along a real US transmission corridor. | YouTube footage strips drone telemetry. Generating a real-format telemetry file is a stronger architectural commitment than internal corridor interpolation: the pipeline can ingest a real drone export with no code changes, and the demo can show a flight-path overlay on the dashboard. ±50m precision relative to the simulated path is acceptable for work-order routing. Disclosed transparently. |
| D7 | 2026-04-25 | Next.js + React + TypeScript dashboard with `react-leaflet` for the map. | Custom map interactions (flight path overlay, animated drone marker, telemetry inspector panel) are first-class in React. Worth the extra plumbing for a richer demo. Streamlit considered but rejected for the Next.js path's polish ceiling. |
| D8 | 2026-04-25 | Workflow 03 = stretch goal only, hard-capped, only if core pipeline is end-to-end working with validation numbers | Brief warns against scope creep. Workflow 03 is a 5% innovation play, not a primary capability. |
| D9 | 2026-04-25 | Asset-centric data model. The pipeline emits a record for every observed asset including healthy ones; the dashboard filters by condition rather than the pipeline filtering before output. | Keeps the architecture compatible with broad-version full-inventory monitoring as a Workflow 03 extension. Also more honest — surfaces Marengo's false positives as `intact` / `no_action` findings rather than hiding them. |
| D10 | 2026-04-25 | Pegasus describes condition; it does not filter. Records with `condition: intact` flow through to the output unchanged. | See D9. Pegasus is a structured-output engine, not a gate. The dashboard is the gate. |
| D11 | 2026-04-25 | Pipeline writes to disk; dashboard reads static files. No API layer between Python and Next.js. The repo ships with the canonical run's `findings.json` and clip files committed to `app/public/`. | Decouples expensive computation from the presentation layer. Anyone can clone the repo and run the dashboard without AWS credentials. Live pipeline runs are gated behind an env var. Faster dev iteration too. |
| D12 | 2026-04-25 | Real DJI SRT parser (`scripts/srt_to_csv.py`), not a stub. | Concrete production-compatibility claim. A judge from the drone industry could hand us a DJI SRT file and our pipeline would process it. Costs ~1 hour vs. nothing for the stub; payoff in credibility is much larger. |
| D13 | 2026-04-25 | Combined confidence indicator derived from Marengo score and Pegasus confidence per the rule in Section 10.3. | Single user-facing field for sorting and filtering; both underlying signals visible in detail panel for transparency. Documented in README. |
| D14 | 2026-04-25 | Layered honesty on false positives. Dashboard shows all findings with confidence indicators. Demo video gives one-sentence FP acknowledgment. Live demo shows confusion matrix briefly. Validation report carries the deep analysis. | Acknowledging weaknesses without dwelling reads as confident. Hiding FPs reads as defensive; explaining each one reads as nervous. Layered exposure matches the surface's appropriate depth. |
| D15 | 2026-04-25 | Damage-rich curation with explicit disclosure. The 25-min cut is curated to include diverse damage examples; the README and demo state this is a demonstration of detection capability, not a claim about field damage rates. | A representative cut would have ~3 damage examples in 25 minutes — too sparse for a compelling demo. Honest cherry-picking with disclosure is the right balance. |
| D16 | 2026-04-25 | Demo input data preparation (footage curation, telemetry generation, validation labeling) is owned by a separate workstream within the team, working in `data_prep/` of the repo. The GridSight pipeline ingests their outputs but does not produce them. Coordination doc: `08_EXTERNAL_DATA_HANDOFF.md`. | Architectural clarity: the GridSight product is the pipeline that ingests standard drone inspection inputs. Demo input prep is content production for the hackathon, not engineering on the system. Keeping it in a separate directory (`data_prep/`) signals this both to teammates and to judges who clone the repo. The data prep team uses our planning docs for context but works in their own scripts. |
| D17 | 2026-04-26 | `nerc_citation: string \| null` field added to the Finding interface (`app/types/findings.ts` and `03_REPO_STRUCTURE.md` §3). Populated by `pipeline/severity.py` from the rules engine, not by Pegasus. Dashboard renders it as a citation chip per `09_UI_PROPOSAL.md` §3.2 / §3.4. | Keeps regulatory citations deterministic and auditable. The severity rules engine already maps conditions to NERC anchors; surfacing the anchor as a structured field is cleaner than letting Pegasus free-text it. |
| D18 | 2026-04-26 | PDF Report (per-finding work order) uses client-side `window.print()` with a print stylesheet, not a server-side renderer (`weasyprint` etc.). Resolves the open question in `09_UI_PROPOSAL.md` §7. | No backend dependency aligns with D11 (no API layer). Removes install / runtime risk on demo day. Print stylesheet is a known, stable browser feature. |

### Decision rule for Workflow 03 stretch goal

The team will attempt the Workflow 03 gesture (correlating visual findings with a fabricated maintenance log) **only if all of the following are true** at the start of Sunday's deliverables phase:

1. End-to-end pipeline runs cleanly on the canonical 25-min video.
2. Validation metrics (precision, recall, F1) are computed for both classes.
3. CSV and GeoJSON exports work.
4. Dashboard is functional with map, table, and clip playback.

If any of those four conditions are not met, the team **abandons** the Workflow 03 gesture and uses the time to harden the core deliverables. This is a hard rule. No relitigating.

---

## 14. Open Questions / TBDs

These are the things we have not yet decided. Each will be resolved at a defined point in the build.

| Question | Resolved by |
|---|---|
| Final project name (keep "GridSight" or change?) | Before recording the demo video. |
| Specific transmission corridor used for generating the demo telemetry file | During data prep (per `08_EXTERNAL_DATA_HANDOFF.md`). Pick a real corridor visible on a public utility map; choose one whose visible environment roughly matches the curated footage so the simulation reads as coherent. The data prep team leads this; project lead approves; St. Louis-area corridors are a nice-to-have if the footage matches. |
| Voltage class to assume for MVCD severity scoring | Default 230 kV unless curated footage clearly shows EHV (500+ kV, very tall towers, multiple bundled conductors); then bump to 345 kV. Final pick after curation. |
| Whether to ship the broad-version queries (full-inventory asset monitoring) | Sunday morning at Decision Gate 3, alongside the Workflow 03 maintenance correlation decision. Adds ~30–60 min of work; substantially strengthens the maintenance correlation story if both ship together. |
| Whether to attempt the Workflow 03 stretch gesture | Sunday morning per the decision rule in Section 13. |

---

## 15. Glossary

**Conductor** — The energized wire carrying electricity. The thing the insulator suspends and the vegetation must stay away from.

**Cross-arm** — Horizontal member of a transmission tower from which insulator strings hang.

**FAC-003** — NERC reliability standard governing vegetation management on transmission lines. Source of MVCD numbers.

**Flashover** — An electrical arc that jumps across an insulator's surface, often due to contamination or damage. Leaves visible burn marks.

**Insulator string** — Chain of porcelain or polymer disks (or a single polymer unit) that electrically isolates a conductor from the grounded tower while mechanically supporting it.

**Lattice steel tower** — The classic open-truss steel transmission tower. Looks like a miniature Eiffel Tower. Distinct from tubular steel poles or wood poles.

**Marengo (3.0)** — TwelveLabs video foundation model for multimodal indexing and semantic search. Used in Stage 2 and 3 of our pipeline.

**MVCD** — Minimum Vegetation Clearance Distance. NERC-defined minimum distance between vegetation and an energized conductor. Varies by voltage class. Exact numbers in `05_DOMAIN_KNOWLEDGE.md`.

**NERC** — North American Electric Reliability Corporation. Sets and enforces reliability standards including vegetation management.

**Pegasus (1.2)** — TwelveLabs video-to-text generation model. Used in Stage 5 of our pipeline to produce structured per-clip descriptions.

**PHMSA** — Pipeline and Hazardous Materials Safety Administration. Relevant to Workflow 01 (pipelines), not us. Listed for completeness.

**Right-of-way (ROW)** — The cleared corridor of land beneath and beside transmission lines, kept clear of tall vegetation.

**Suspension tower** — Tower where insulator strings hang vertically, supporting the conductor in a straight stretch of line. Distinct from dead-end towers (where lines change direction or terminate) and tension towers.

**TwelveLabs** — The company behind Marengo and Pegasus. Hackathon partner; their models are accessed via AWS Bedrock.

---

*End of document. Updates to this file should bump the status date at the top and append entries to Section 13.*
