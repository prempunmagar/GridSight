# GridSight — Build Plan

> **Status:** Draft, Saturday April 25, 2026.
> **Companion doc:** `01_MASTER.md` (the source of truth for what we are building and why).

---

## How to use this document

This is the execution playbook. The Master Project Document defines *what* GridSight is. This document defines *how* we get there, in what order, and how we know when each phase is done.

Six phases, each with a goal, an ordered task list, exit criteria, and known risks. After the phases there is a **Decision Gates** section that pulls out the moments where the team has to make a judgment call, and a **Risk Register** that lists the things most likely to bite us.

This is a hackathon plan. Two principles drive the ordering:

1. **De-risk early.** Anything that could block the entire build — Bedrock auth, model access, data availability — gets done first, before anything else depends on it.
2. **Always have something to show.** By the end of each phase, we should have a working artifact, even if rough. A finished Phase 3 with a crude Phase 4 is better than a polished Phase 3 with no Phase 4 at all.

Tasks within a phase can run in parallel. Phases are gated — do not start Phase N+1 until Phase N's exit criteria are met.

References to anomaly classes, severity tiers, system architecture, and judging criteria all live in `01_MASTER.md`. This document does not duplicate them.

---

## Phase 1 — Foundations

### Goal

Eliminate the three things that could kill the project before it starts: model access, repo setup, and domain literacy. Exit Phase 1 with a working hello-world to Bedrock, the GitHub repo set up, the data prep team handed off and working in parallel, and the GridSight team grounded in the severity rubric.

### Tasks

1. **Verify AWS Bedrock access end-to-end.** Confirm credentials. Confirm TwelveLabs Marengo 3.0 and Pegasus 1.2 are both invocable via Bedrock. Run a hello-world that exercises **both Bedrock invocation patterns**: the async pattern for Marengo indexing (start job → poll status → retrieve results) and the sync pattern for Pegasus generation. Verify Pegasus returns sensible domain-aware text when prompted with a transmission-line frame. Capture the working Python snippets in the repo as `examples/bedrock_smoke_test.py`. Also capture the actual Bedrock model IDs (placeholders in `.env.example` need real values) and any non-obvious gotchas in the README under "Bedrock notes." **If this fails, escalate to organizers immediately. Do not work around it.**

2. **Set up the project repo per the Repo Structure doc.** Create the GitHub repository following the canonical directory layout in `03_REPO_STRUCTURE.md`. The repo has two top-level units: a Python pipeline (`pipeline/`, `scripts/`, `examples/`, `data/`, `out/`) and a Next.js dashboard (`app/`). Add a README skeleton at the repo root and one in `app/`. Copy the planning markdown files into `docs/`. Add `.gitignore` for video files (large), credentials, `node_modules/`, and `.next/`. Add Python `requirements.txt` with `boto3`, `pandas`, `numpy`, `ffmpeg-python`, `pytest`. Initialize the Next.js project: `npx create-next-app@latest app --typescript --app --tailwind --no-eslint`, then `cd app && npm install react-leaflet leaflet @types/leaflet`. Verify `npm run dev` serves a placeholder page.

3. **Hand off the data prep workstream.** Share the GitHub repo and `08_EXTERNAL_DATA_HANDOFF.md` with the data prep team. They start their three deliverables (curated demo video, simulated drone telemetry CSV, validation ground truth CSV) in parallel — they have everything they need to work independently. Keep a chat channel open for clarifying questions; reference the handoff doc rather than improvising answers. The data prep workstream is on the critical path for Phase 3 (Marengo indexing needs the curated video) and Phase 5 (validation metrics need the ground truth CSV), so the earlier they start, the better.

4. **Internalize the severity rubric.** Read `05_DOMAIN_KNOWLEDGE.md` Sections 3 and 4 in full. The GridSight team needs to know these rules cold to make sense of pipeline outputs, write `pipeline/severity.py` correctly in Phase 3, and interpret the validation report in Phase 5. The data prep team applies the same rules during validation labeling — so when their `ground_truth.csv` arrives, anyone reviewing it should be able to spot a label that disagrees with the rubric. ~30 minutes of reading per person; don't skip it.

5. **Attend the TwelveLabs workshop.** Skip the others. Capture any non-obvious tips into the repo's README under a "TwelveLabs gotchas" section.

### Exit criteria

- [ ] Hello-world script successfully uploads to Marengo and queries Pegasus, end-to-end, with output captured.
- [ ] GitHub repo exists, with README skeleton and all five planning docs (01–05) plus the handoff doc (08) committed under `docs/`. Repo follows the structure in `03_REPO_STRUCTURE.md`.
- [ ] Next.js app initialized in `app/`; `npm run dev` serves a placeholder page successfully.
- [ ] Data prep team has access to the repo and has acknowledged `08_EXTERNAL_DATA_HANDOFF.md`. They are working on their deliverables.
- [ ] All GridSight team members have read `05_DOMAIN_KNOWLEDGE.md` Sections 3 and 4 (severity rubric).
- [ ] TwelveLabs workshop attended.

### Risks

- **Bedrock credits not yet provisioned.** Mitigation: do this task first. Escalate, don't work around.
- **TwelveLabs API quirks not in the docs.** Mitigation: workshop attendance.
- **Data prep team blocked or delayed.** Mitigation: the handoff doc is designed to let them work independently. If they hit a block, surface it fast — don't let them sit stuck. Common blockers (footage harder to find, severity rubric ambiguity, corridor selection) are anticipated in `08_EXTERNAL_DATA_HANDOFF.md`. Worst case, the GridSight team can use stub data to make Phase 3 progress while data prep catches up — see Phase 2 risks for the stub fallback.
- **Next.js setup eats more than expected.** Mitigation: use `create-next-app` defaults; resist customization in Phase 1; the dashboard work proper happens in Phase 4.

---

## Phase 2 — Receive Inputs and Index

### Goal

Receive the data prep team's three deliverables, validate them against schema, and get the curated video indexed in Marengo. By end of Phase 2, the GridSight pipeline has a queryable Marengo index, validated telemetry data, and validated ground truth labels — the inputs Phase 3 will consume.

### Tasks

1. **Receive and validate the curated video.** When the data prep team hands off `data/curated/demo_video.mp4` (out-of-band — gitignored, too large for Git), drop it into the local repo's `data/curated/` directory. Verify the file plays cleanly start-to-finish in QuickTime / VLC and that `data/curated/source_log.md` is committed and documents which YouTube URLs and timestamps contributed. If the video doesn't play or the source log is missing, ping the data prep team before proceeding.

2. **Receive and validate the telemetry CSV.** When `data/telemetry/demo_video_telemetry.csv` is committed by the data prep team, validate it: load with `pandas.read_csv()`, confirm all 11 columns from the schema in `08_EXTERNAL_DATA_HANDOFF.md` are present, confirm row count equals video duration in seconds (±5 acceptable), confirm `latitude` / `longitude` values are plausible for the chosen corridor, confirm `timestamp_seconds` increments by 1 with no gaps. A 20-line Python sanity script in `examples/validate_telemetry.py` is enough — don't over-engineer this.

3. **Receive and validate the ground truth CSV.** When `data/validation/ground_truth.csv` is committed, validate it: 20–25 rows, all 7 schema columns present, `class` values from the allowed set (`insulator_damage`, `vegetation_encroachment`, `other`), `severity` values from the allowed set (`critical`, `high`, `moderate`, `low`), `start_seconds` < `end_seconds` for every row, no anomalies extending past the video duration. Spot-check 3–5 random labels against `05_DOMAIN_KNOWLEDGE.md` Sections 3.3 and 4.8 to verify the labeler applied the rubric correctly. Surface any discrepancies to the data prep team for resolution before Phase 5 — a misaligned label discovered Sunday morning is an emergency; one discovered now is a 5-minute fix.

4. **Upload the curated video to Marengo and index.** Use Bedrock's async pattern (per the smoke test from Phase 1) to upload `data/curated/demo_video.mp4` to S3 and start the Marengo indexing job. Poll until status is `Completed`. Capture the Marengo index ID in `pipeline/config.py`. This is an upload-and-wait step; let it run in the background while other Phase 2 tasks proceed and Phase 3 prep happens.

5. **(Parallel, if data prep is delayed) Begin Phase 3 prep work using stub data.** If the data prep team's deliverables are running late and threatening to block Phase 2, the GridSight team can begin Phase 3 work using stub data:
   - **Stub video:** any 60-second drone clip with at least one visible insulator string. Index in Marengo to verify queries return results at all.
   - **Stub telemetry:** a 60-row CSV matching the schema, generated by hand or a 10-line script. Lets `pipeline/telemetry.py` be developed and tested.
   - **Stub ground truth:** 3–5 hand-labeled anomalies in the stub video. Lets the validation metric code be developed end-to-end.

   Real data replaces stubs as soon as it arrives. The stubs are throwaway — they let development continue without blocking on coordination.

### Exit criteria

- [ ] `data/curated/demo_video.mp4` is present locally and plays cleanly (file is gitignored, but it's on disk for the team running the pipeline).
- [ ] `data/curated/source_log.md` is committed.
- [ ] `data/telemetry/demo_video_telemetry.csv` is committed and passes schema validation.
- [ ] `data/validation/ground_truth.csv` is committed and passes schema validation; 3–5 labels spot-checked against the rubric.
- [ ] Marengo has indexed the demo video; index ID captured in `pipeline/config.py`.

### Risks

- **Data prep team's deliverables are late.** Mitigation: stub fallback in task 5. The pipeline architecture doesn't care whether inputs are real or stubbed — the schemas are the contract.
- **Marengo upload/indexing slower than expected.** Mitigation: start it as soon as the curated video arrives; do other work while it runs. The async invocation pattern was verified in Phase 1, so the mechanics shouldn't surprise.
- **Schema validation finds problems with received inputs.** Mitigation: surface to the data prep team immediately — don't paper over by hand-fixing files in our repo. The data prep team's scripts are the source of truth; if their output is wrong, they fix the script and regenerate.
- **Spot-check reveals systematic rubric drift in ground truth labels.** Mitigation: high-priority. Walk through `05_DOMAIN_KNOWLEDGE.md` Sections 3.3 and 4.8 with the labeler, identify the misunderstanding, have them re-label affected rows. Faster to fix during Phase 2 than to discover during Phase 5.

---

## Phase 3 — Detection Pipeline

### Goal

Build the end-to-end automated pipeline from indexed video to structured findings. By end of Phase 3, running one command processes the demo video and outputs a JSON list of findings with timestamps, types, conditions, and confidence indicators.

### Tasks

1. **Iterate Marengo queries — structured as a configurable query set.** Define queries as a configurable list in `pipeline/queries.py` so the broad version can extend without code changes. Two query groups:

   **Anomaly queries (narrow build, always run):**

   *For insulator damage:*
   - "damaged or broken insulator disk on transmission tower"
   - "missing or shattered porcelain insulator"
   - "insulator string with visible contamination or burn marks"
   - "rust streaks on insulator hardware"

   *For vegetation encroachment:*
   - "tree branches close to or touching power line conductors"
   - "vegetation overgrown into transmission line right-of-way"
   - "trees taller than power line clearance"

   **Inventory queries (broad version, only added at Decision Gate 3 if shipping):**
   - "transmission tower with insulator strings visible"
   - "power line conductor crossing the right-of-way"
   - "vegetation along the transmission line corridor"

   For each query in the active set, run against Marengo. Keep the queries with best recall against the validation set. Capture results into `pipeline/marengo_detect.py`. Each result tagged with `discovery_source: "anomaly_query" | "inventory_query"`. Output: list of dicts with `timestamp_seconds`, `query_string`, `marengo_score`, `discovery_source`.

2. **Deduplicate and merge candidate timestamps.** Multiple queries will surface the same anomaly. Cluster timestamps within 10 seconds of each other into a single candidate finding. Keep the highest score and preserve all matching query strings. This becomes the input to clip extraction.

3. **Build clip extraction.** For each candidate timestamp, extract a 12-second evidence clip centered on the timestamp using ffmpeg. Output to `data/clips_working/{finding_id}.mp4` (Stage 7 copies finalized clips to `app/public/clips/`). Naming scheme: `f{NNN}_{class}_{timestamp}.mp4`.

4. **Build the Pegasus structured-description step.** Send each clip to Pegasus with a JSON-output prompt. Pegasus is a describer, **not a filter** — every clip produces a record that flows downstream, including those Pegasus assesses as `intact`. Filtering by condition happens in the dashboard, not here. First-pass prompt template:

   ```
   You are an inspector reviewing a transmission line drone clip. Describe
   what is visible and any equipment condition concerns. Healthy / intact
   assets are valid observations and should be reported as such.

   Return ONLY valid JSON matching this schema, with no other text:
   {
     "component_type": "insulator_string" | "conductor" | "tower" | "vegetation" | "guy_wire" | "other",
     "condition": "intact" | "damaged" | "contaminated" | "unclear",
     "specific_defects": [string, ...],
     "vegetation_distance_estimate_ft": number | null,
     "confidence": "high" | "medium" | "low"
   }

   Example (damaged):
   {"component_type": "insulator_string", "condition": "damaged",
    "specific_defects": ["shattered porcelain disk", "visible burn mark"],
    "vegetation_distance_estimate_ft": null, "confidence": "high"}

   Example (intact):
   {"component_type": "insulator_string", "condition": "intact",
    "specific_defects": [], "vegetation_distance_estimate_ft": null,
    "confidence": "high"}
   ```

   Iterate the prompt until ≥80% of clips return parseable JSON. Add a fallback parser that handles common drift (extra prose around the JSON, missing fields, etc.). Output: parsed dict per clip — including intact ones.

5. **Build the severity scoring layer.** Implement a rules engine that maps each parsed finding to a severity tier per the rules in the domain knowledge document. Implement as `pipeline/severity.py` with `score_finding(parsed_dict, marengo_score) -> severity_dict` returning:

   ```python
   {
     "severity": "critical" | "high" | "moderate" | "low" | "no_action",
     "combined_confidence": "high" | "medium" | "low",
     "needs_human_review": bool
   }
   ```

   Severity rules:
   - `condition == "intact"` → `severity = "no_action"`
   - `condition == "unclear"` → `severity = "low"`, `needs_human_review = True`
   - `condition == "damaged"` or `"contaminated"` → severity per the class-specific tiers in the domain knowledge document

   Combined confidence rule (per Master Doc Section 10.3):
   - `marengo_score >= 0.7` AND `pegasus_confidence == "high"` → `"high"`
   - `marengo_score < 0.5` OR `pegasus_confidence == "low"` → `"low"`
   - everything else → `"medium"`

   Unit-test with 5–10 example dicts covering each severity tier and confidence combination.

### Exit criteria

- [ ] The detection stages of `pipeline/run_all.py` (Marengo querying, deduplication, clip extraction, Pegasus description, severity scoring) execute end-to-end against the demo video index and produce structured findings. Stage 7 (exports) is built in Phase 4.
- [ ] Clip extraction runs cleanly; clips exist on disk for every candidate.
- [ ] Pegasus returns parseable JSON for ≥80% of clips.
- [ ] Severity scoring runs on every parsed finding without exceptions.
- [ ] Output: a single `findings.json` file with the full structured list.

### Risks

- **Marengo recall is low for one or both classes.** Mitigation: query iteration, then if still failing, broaden to more general queries and rely on Pegasus to filter at description time.
- **Pegasus drifts off JSON format.** Mitigation: explicit example in the prompt; fallback regex parser; if all else fails, ask Pegasus a follow-up "extract just the JSON" call.
- **Clips are too short to give Pegasus enough context.** Mitigation: 12 seconds is a starting point; tune up to 15 if descriptions feel context-starved, down to 8 if Pegasus is hallucinating extra details.

---

## Phase 4 — Telemetry Ingest, Outputs, and Next.js Dashboard

### Goal

Make the system's output usable. Ingest the telemetry file, attach full spatial context (GPS, altitude, heading) to every finding, write CSV and GeoJSON exports plus the dashboard data file to disk, and stand up the Next.js dashboard with flight-path overlay, telemetry inspector, and condition-based filtering. By end of Phase 4, anyone can clone the repo and run the dashboard without AWS credentials.

### Tasks

1. **Build the telemetry ingestion module.** Write `pipeline/telemetry.py` that loads `data/telemetry/demo_video_telemetry.csv` into a pandas DataFrame indexed by `timestamp_seconds`. Expose:
   - `load_telemetry(path) -> pd.DataFrame`
   - `lookup_at(df, t_seconds) -> dict` — returns the closest row to `t_seconds`, providing `latitude`, `longitude`, `altitude_m_agl`, `heading_deg`, `ground_speed_mps`, etc.
   - `flight_path_polyline(df) -> list[(lat, lon)]` — returns the full ordered path for map overlay.

   Apply `lookup_at()` to every finding to attach `gps_lat`, `gps_lon`, `altitude_m_agl`, `heading_deg`, and `ground_speed_mps` columns.

   **Build the real DJI SRT parser** at `scripts/srt_to_csv.py`. Parse the standard DJI subtitle format — extracting timestamp, latitude, longitude, and altitude lines — and write the per-second CSV the pipeline ingests. Skip camera settings / gimbal metadata. The parser is intentionally narrow but real and tested on at least one sample DJI SRT file. Document usage in the README so a judge can hand us a DJI export and see it work.

2. **Build CSV export.** Columns in this order: `finding_id, timestamp_seconds, gps_lat, gps_lon, altitude_m_agl, heading_deg, ground_speed_mps, class, component_type, condition, specific_defects, vegetation_distance_estimate_ft, severity, combined_confidence, marengo_score, pegasus_confidence, needs_human_review, evidence_clip_path, discovery_source`. Write `pipeline/export_csv.py`. Output: `out/findings.csv`.

3. **Build GeoJSON export.** FeatureCollection with one Point Feature per finding (GPS location). Include the flight path as a separate LineString Feature so the GeoJSON file is self-contained — opening it in any GIS tool shows both the path and the findings together. Properties include all fields from the CSV. Write `pipeline/export_geojson.py`. Output: `out/findings.geojson`. Validate that the file opens cleanly in [geojson.io](https://geojson.io) before claiming it works.

4. **Write the dashboard data files to `app/public/`.** This is the contract between the Python pipeline and the Next.js dashboard. The pipeline writes:
   - `app/public/data/findings.json` — full enriched findings array, ready to be imported as static data.
   - `app/public/data/flight_path.json` — the polyline coordinates from the telemetry, ready for direct rendering on the map.
   - `app/public/data/run_metadata.json` — run timestamp, total findings count by severity and condition, total flight distance and duration computed from telemetry, voltage class assumed, corridor description.
   - `app/public/clips/{finding_id}.mp4` — copies of the evidence clips, served as static assets by Next.js.

   No API layer. No live AWS calls from the dashboard. The dashboard reads these files at startup and works without any backend.

5. **Build the Next.js dashboard.** App Router layout under `app/`. Single primary page. Components:

   - **`app/page.tsx`** — main page. Layout: header bar, map + sidebar split, findings table below.
   - **`components/Header.tsx`** — project name, run timestamp, total findings count by severity and condition, total flight distance and duration, voltage class label.
   - **`components/FlightPathMap.tsx`** — `react-leaflet` map. Renders the flight path as a blue polyline from `flight_path.json`. Renders one circle marker per finding from `findings.json`, colored by severity (red=critical, orange=high, yellow=moderate, gray=low, white-ring=no_action). Click handler updates the selected finding state.
   - **`components/TelemetryInspector.tsx`** — sidebar panel. When a finding is selected, shows: timestamp (seconds + datetime), lat/lon, altitude AGL, heading (with a small compass icon), ground speed. When nothing is selected, shows aggregate flight stats.
   - **`components/EvidenceClipPlayer.tsx`** — HTML5 `<video>` element with controls. Plays `app/public/clips/{finding_id}.mp4` for the selected finding. Includes the Pegasus description fields (component_type, condition, specific_defects) below the video.
   - **`components/FindingsTable.tsx`** — sortable, filterable table below the map. Default filter: `severity != "no_action"` (i.e., actionable findings only). Toggle button: **"Show all observed assets"** that reveals the intact / no_action rows. Columns: finding_id, timestamp, class, condition, severity, combined_confidence, location.
   - **`components/ExportButtons.tsx`** — two download buttons: "Download CSV" and "Download GeoJSON". Files served from `app/public/data/`.
   - **`components/ConfidenceLegend.tsx`** — a small key explaining the severity colors and the combined confidence rule (link to README for full rule).
   - **Optional polish (only if everything else is working):** an animated drone marker that moves along the flight path in sync with evidence clip playback. Implemented as a small `useEffect` driven by the video's `timeupdate` event.

   Run with `npm run dev` from the `app/` directory. Default port 3000.

6. **Smoke-test the full pipeline end-to-end.** Run `pipeline/run_all.py` from a fresh repo clone (using cached Marengo index, not re-uploading) and confirm: telemetry loads, findings produced with full spatial context, CSV/GeoJSON written, data files written to `app/public/data/`, clips copied to `app/public/clips/`, Next.js dashboard loads with flight path visible, clips play, telemetry inspector populates, condition toggle works. Fix anything that breaks.

### Exit criteria

- [ ] Telemetry CSV loads and is queryable by timestamp.
- [ ] DJI SRT parser exists and successfully converts at least one sample SRT file to the canonical CSV format.
- [ ] Every finding has `gps_lat`, `gps_lon`, `altitude_m_agl`, `heading_deg`, `ground_speed_mps`, `combined_confidence`, `discovery_source` populated.
- [ ] `findings.csv` is generated and opens correctly in Excel / pandas.
- [ ] `findings.geojson` validates, contains both the flight path (LineString) and finding pins (Points), and renders correctly on geojson.io.
- [ ] `app/public/data/findings.json`, `flight_path.json`, `run_metadata.json` written by the pipeline.
- [ ] Evidence clips copied to `app/public/clips/`.
- [ ] Next.js dashboard runs locally with `npm run dev`, shows the flight path on the map, plays evidence clips, populates the telemetry inspector when a finding is selected, exports both formats, condition filter toggle works.
- [ ] **Repo can be cloned and dashboard run without any AWS credentials.** Verified by checking out the repo to a separate directory and running only `cd app && npm install && npm run dev`.
- [ ] End-to-end pipeline runs without manual intervention.

### Risks

- **Next.js + react-leaflet SSR issues.** Leaflet doesn't work with server-side rendering out of the box. Mitigation: use `dynamic(() => import(...), { ssr: false })` for the map component. Documented quirk; standard fix.
- **Evidence clip playback with HTML5 `<video>`.** Mitigation: keep clips as standard MP4 H.264; test in Chrome and Safari; the format is well-supported but encoding settings matter.
- **GeoJSON property field names don't match common GIS expectations.** Mitigation: keep field names lowercase snake_case, document them in the README.
- **Telemetry timestamps drift out of sync with video timestamps.** Mitigation: telemetry generation script writes one row per second starting from t=0, matching the video's natural seconds; smoke test verifies the lookup at known timestamps.
- **Pipeline-to-dashboard contract drift.** If the pipeline changes a field name, the dashboard breaks silently. Mitigation: a small TypeScript interface in `app/types/findings.ts` defines the expected schema; the pipeline writes to that schema; mismatches surface as TypeScript errors during `npm run dev`.
- **Static `app/public/clips/` directory grows large.** ~25 clips at 12 seconds each ≈ 200 MB of MP4. Mitigation: re-encode clips to a lower bitrate during extraction (target 2 Mbps); commit them to the repo with Git LFS if size becomes an issue, otherwise keep them in-repo for the demo.

---

## Phase 5 — Validation and Impact

### Goal

Generate the artifacts that prove the system works. Compute precision, recall, F1. Write the validation report. Write the operational impact brief. Optionally execute the Workflow 03 stretch goal — but only if the decision rule allows.

### Tasks

1. **Run the canonical pipeline.** Single end-to-end run on the demo video. This produces the canonical `findings.json`, CSV, GeoJSON, and dashboard state for the submission.

2. **Compute validation metrics.** Match each automated finding against `ground_truth.csv` using a timestamp overlap rule (an automated finding matches a ground truth anomaly if their timestamp ranges overlap by ≥50%). For each class compute precision, recall, F1. Build the confusion matrix (true positives, false positives, false negatives, by class). Capture results in `out/validation_metrics.json`.

3. **Write the Validation Report (`06_VALIDATION_REPORT.md`).** Structure:
   - Methodology (how matching was done)
   - Precision, recall, F1 per class
   - Confusion matrix
   - Severity distribution (breakdown of findings by severity tier)
   - False positive analysis (what triggered them, common patterns)
   - False negative analysis (what we missed and why)
   - Honest discussion of limitations

4. **Write the Operational Impact Brief (`07_OPERATIONAL_IMPACT.md`).** One page. Cover:
   - Current state baseline (X miles/day/analyst at $50–150/mile inspection cost — use brief's numbers)
   - Proposed state (10–20× throughput improvement; quantify analyst hours saved)
   - Annual cost avoidance on a representative 1000-mile transmission system
   - Deployment cost estimate (Bedrock compute per mile of footage)
   - Payback period
   - Detection consistency improvement framing (qualitative)

5. **Workflow 03 stretch gesture — IF AND ONLY IF the decision rule in `01_MASTER.md` Section 13 is satisfied.**

   This stretch goal has two components, ordered by impact. Ship part A first; only attempt part B if A lands cleanly with time remaining.

   **Part A — Maintenance correlation (the core Workflow 03 gesture):**
   - Fabricate a small CSV of 5–10 maintenance records keyed to asset IDs along the corridor (`data/synthetic/maintenance_log.csv`). Schema: `asset_id, asset_type, last_serviced_date, last_inspection_date, recent_work_orders`.
   - Implement a correlation rule: any asset with both (a) a system-observed condition issue (any non-`intact` finding) AND (b) a recent maintenance flag in the CSV gets a composite risk score = `visual_severity_weight × maintenance_recency_weight`.
   - Severity weights: critical=1.0, high=0.7, moderate=0.4, low=0.1. Recency weights: last serviced >5 yr=1.0, 1–5 yr=0.6, <1 yr=0.2. Multiply, sort.
   - Add a "Composite Risk" column to the dashboard's findings table and a "Maintenance Context" tab to the detail panel.
   - Mention prominently in the demo video and presentation.

   **Part B — Broad-version queries (full-inventory monitoring):**
   - Decision Gate 3 specifically asks whether to ship this. Adds ~30–60 minutes of work. Substantially strengthens the Workflow 03 narrative.
   - Add the inventory queries from `pipeline/queries.py` (already structured in Phase 3 task 1) to the active query set. Re-run the pipeline. Pegasus describes each newly-discovered asset's condition.
   - The maintenance correlation now operates on the full asset inventory, not just suspicious ones — every asset gets a composite risk score (or zero if no maintenance flag and no condition issue).
   - Add a **coverage summary widget** to the dashboard header: "Observed: X insulator strings, Y vegetation areas. Y% flagged for action." This converts the demo from "we found problems" to "we provide visibility into your asset base." Roughly 30 minutes of frontend work.
   - The dashboard's "Show all observed assets" toggle becomes more meaningful — flipping it reveals dozens of inventoried healthy assets along with the actionable findings.

   **If Part B is shipped:** the live demo's minute 5 explicitly toggles the broad view on stage. The recorded demo video adds 15 seconds showing the coverage summary widget. The Operational Impact Brief gains a sentence about full-inventory deployment.

   **If Part B is skipped:** Part A still ships cleanly on the narrow build. No changes to the rest of the deliverables.

### Exit criteria

- [ ] Canonical pipeline run completed; outputs locked.
- [ ] Validation metrics computed and written to JSON.
- [ ] `06_VALIDATION_REPORT.md` written.
- [ ] `07_OPERATIONAL_IMPACT.md` written, fits on one page when printed.
- [ ] Workflow 03 gesture either complete or formally skipped per decision rule.

### Risks

- **Metrics worse than internal targets.** Mitigation: report them honestly. The brief explicitly says perfect classification is not the goal. A 0.45 F1 with a credible explanation beats a hand-waved 0.9.
- **Time pressure tempts skipping the false positive analysis.** Mitigation: the rubric specifically calls this out. Don't skip.
- **Workflow 03 gesture starts feeling tractable and pulls focus.** Mitigation: Section 13 decision rule is hard. Honor it.

---

## Phase 6 — Deliverables

### Goal

Polish, package, present. Every required submission artifact gets reviewed against the deliverables checklist in `01_MASTER.md` Section 11. The demo video is recorded, the GitHub repo is clean, DevPost is submitted with time to spare.

### Tasks

1. **Polish the GitHub README.** A reviewer landing on the repo cold should be able to: understand the project in 30 seconds, see what was built, run the pipeline themselves with three commands, and find every supporting document. Sections: project pitch, architecture diagram (copy from `01_MASTER.md`), setup instructions, usage example, link to live dashboard or screenshots, links to all supporting docs, team, license.

2. **Write the Technical Documentation summary (`TECH.md`).** A condensed version of architecture + anomaly approach + asset modeling + TwelveLabs integration strategy + performance benchmarks. This is what judges read if they don't read the Master Doc. Two pages max.

3. **Record the demo video (3–5 minutes).** Follow the recorded-demo narrative in `01_MASTER.md` Section 12. Record with the system already polished; do not record while debugging. Save the raw recording in case re-cuts are needed. Final file: `submission/demo.mp4`.

4. **Final pass on the dashboard.** Make sure: nothing crashes, all severity colors are correct, all evidence clips play, both export buttons work, the page looks intentional rather than thrown together.

5. **Submit on DevPost.** Title, project description, links to demo video, GitHub, supporting docs. Submit at least 30 minutes before the 1:00 PM Sunday deadline to leave buffer for upload chaos.

### Exit criteria

- [ ] All items in `01_MASTER.md` Section 11 deliverables checklist are checked.
- [ ] GitHub README polished.
- [ ] `TECH.md` written.
- [ ] Demo video recorded and saved.
- [ ] DevPost submission live before deadline.

### Risks

- **DevPost form has unexpected required fields.** Mitigation: open the submission form early in Phase 6 and fill what you can; don't wait until 12:50 PM.
- **Demo video re-recordings eat the buffer.** Mitigation: rehearse once on paper, do one full take, accept it unless it's actually broken. Polish is a trap.

---

## Decision Gates

Three explicit moments where the team must make a judgment call. Do not skip these — they are insurance against drifting into a bad scenario.

### Gate 1 — End of Phase 1

**Question:** Is Bedrock authentication working end-to-end?

- **Yes:** proceed to Phase 2.
- **No:** stop the entire build. Surface to organizers. Do not start Phase 2 with a broken Bedrock connection — the whole pipeline depends on it.

### Gate 2 — End of Phase 3

**Question:** Are Marengo queries returning relevant timestamps for both anomaly classes, and is Pegasus producing parseable JSON?

- **Yes:** proceed to Phase 4.
- **Marengo OK, Pegasus failing:** invest 1 more iteration cycle on the Pegasus prompt. If still failing after one more cycle, fall back to using Marengo confidence scores alone for severity (skip the structured description step). Document the fallback in the technical doc.
- **Marengo failing:** the project is in trouble. Broaden queries dramatically, accept higher false positive rate, and rely on Pegasus to filter at description time.

### Gate 3 — Sunday morning, start of Phase 5

**Question:** Is the core pipeline (Phases 1–4) end-to-end working — Bedrock, Marengo queries, clip extraction, Pegasus descriptions, severity scoring, CSV/GeoJSON exports, dashboard?

- **All four conditions in `01_MASTER.md` Section 13 satisfied:** proceed to Phase 5 including the optional Workflow 03 gesture.
- **Any condition not satisfied:** proceed to Phase 5 *without* the Workflow 03 gesture. Use the time saved to harden the core. This is not a debate.

---

## Risk Register

In rough order of probability, the things most likely to go wrong:

1. **Bedrock auth or credit provisioning delay.** Highest-impact risk. Mitigation: do it first, escalate fast.
2. **Pegasus produces inconsistent JSON.** High likelihood; mitigated by explicit example in prompt (including an `intact` example) and fallback parser.
3. **Marengo queries return many false positives or miss obvious anomalies.** Mitigated by query iteration in pairs and using validation set as the recall target. With Pegasus describing condition (not filtering), false positives surface as `intact` / `no_action` findings rather than disappearing — visible in the dashboard but filtered from the default view.
4. **Data prep team's deliverables late or incomplete (especially ground truth labels).** Without `ground_truth.csv` there is no F1 number. Mitigation: clear handoff via `08_EXTERNAL_DATA_HANDOFF.md` early in Phase 1; spot-check labels for rubric alignment as soon as the file lands in Phase 2 (don't wait until Phase 5); stub fallback in Phase 2 task 5 lets development continue if the real file is delayed.
5. **Next.js + react-leaflet complexity eats more time than budgeted.** Real risk given the 24-hour clock. Mitigation: SSR-disable the map component using `dynamic(() => import(...), { ssr: false })`; keep the component count small (the seven listed in Phase 4 task 5 are the full set, no more); resist visual polish creep until exit criteria are green.
6. **Pipeline-to-dashboard contract drift.** A field renamed in the pipeline silently breaks the dashboard. Mitigation: TypeScript interface `app/types/findings.ts` defines the schema; mismatches surface as type errors; the smoke test in Phase 4 task 6 runs both the pipeline and the dashboard end-to-end.
7. **Demo video rushed and shows a broken pipeline.** Record after polishing, not during. The video is the safety net for the live demo.
8. **Scope creep into Workflow 03 before core is locked.** Decision Gate 3 is the hard rule. Honor it.
9. **Curated footage lacks enough damage examples to demo well.** Mitigation: this is the data prep team's responsibility (per `08_EXTERNAL_DATA_HANDOFF.md` damage quota). If the curated cut delivers fewer than 6 insulator + 4 vegetation examples, ping the data prep team to grab supplemental footage focused on damage. The handoff doc lists this as a "ping the project lead" trigger, so they should surface it themselves before delivery.
10. **Dashboard fails to run from a fresh repo clone.** Embarrassing if a judge tries it. Mitigation: explicit Phase 4 exit criterion verifies `cd app && npm install && npm run dev` works in a separate directory clone, with no AWS env vars set.
11. **Static `app/public/clips/` directory grows large enough to clutter Git history.** Mitigation: re-encode clips to ~2 Mbps during extraction; consider Git LFS only if total exceeds ~300 MB.
12. **DevPost upload fails at the last minute.** Mitigation: submit 30+ minutes early.

---

## Anti-goals — things we explicitly do NOT do during the build

- We do **not** add a third anomaly class mid-build.
- We do **not** swap the dashboard framework. Next.js is locked. No reverting to Streamlit, no migrating to Remix or anything else.
- We do **not** drop intact-condition findings. Pegasus describes; the dashboard filters. Records flow through the pipeline regardless of condition.
- We do **not** add an API layer between the Python pipeline and the Next.js dashboard. Pipeline writes static files; dashboard reads them. Anything else is over-engineering for this scope.
- We do **not** chase 4K footage or premium video sources.
- We do **not** attempt sub-meter GPS accuracy.
- We do **not** add authentication, multi-user, or persistence features.
- We do **not** start the Workflow 03 gesture until Decision Gate 3 is passed.
- We do **not** record the demo video before the system is polished.
- We do **not** run a live pipeline (live AWS calls) on the presentation stage. The live demo uses pre-computed pipeline output. The recorded video can show pipeline execution.
- We do **not** relitigate decisions logged in `01_MASTER.md` Section 13. New information can produce new decisions, appended to the log.

---

*End of document. Phase exit criteria can be checked off in-place as the build progresses.*
