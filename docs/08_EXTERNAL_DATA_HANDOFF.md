# GridSight — External Data Handoff

> **Status:** Draft, Saturday April 25, 2026.
> **Audience:** Teammates handling demo input preparation (footage curation, telemetry generation, validation labeling).
> **Companion docs:** `01_MASTER.md` (project context), `04_DATA_BRIEF.md` (the why and the search/curation guidance), `05_DOMAIN_KNOWLEDGE.md` (severity rules — critical for validation labeling).

---

## TL;DR

You're delivering three files into the GridSight repo. They go in specific places, in specific schemas. Once they're there, the GridSight pipeline takes over.

| File | Where it goes | Tracked? |
|---|---|---|
| Curated 25-min demo video | `data/curated/demo_video.mp4` | No (gitignored, large) |
| Per-second drone telemetry | `data/telemetry/demo_video_telemetry.csv` | Yes |
| Manual anomaly labels | `data/validation/ground_truth.csv` | Yes |

Your scripts (the code that produces the first two files) live in **`data_prep/`**. That directory is yours. It's deliberately kept separate from the GridSight pipeline because your work is *demo input preparation*, not part of the GridSight product itself.

If anything in this doc is unclear, **ask in chat rather than guessing**. Especially for validation labeling — the rubric needs to match how our pipeline scores severity, or our F1 numbers will be misleading.

---

## Why this is a separate workstream

Quick context. GridSight is a pipeline that ingests standard drone inspection inputs (a video file + a per-second telemetry CSV) and produces georeferenced findings. The product is the pipeline.

For the demo, we need representative inputs. YouTube footage doesn't carry GPS telemetry, and our hackathon footage isn't going to come with manual anomaly labels either. So: someone has to *produce* a representative demo video, *generate* telemetry alongside it, and *label* anomalies for grading. That's you.

This is genuinely different work from building the pipeline — it's content production for a demo, not engineering on the system. Hence the split. Read `04_DATA_BRIEF.md` and `05_DOMAIN_KNOWLEDGE.md` for the full context. This doc is just the coordination layer.

---

## What you're delivering

### Deliverable 1 — Curated demo video

**Output path:** `data/curated/demo_video.mp4`

**Spec:** ~25 minutes, 1080p MP4, stitched from 4–6 YouTube source videos showing drone-altitude inspection of high-voltage transmission lines on lattice steel suspension towers.

**Quota:** At least 6–8 visible insulator damage examples and 4–6 vegetation encroachment examples distributed across the 25 minutes. We're deliberately curating for damage diversity — see `04_DATA_BRIEF.md` Section 1.3 for why this is defensible.

**Source documentation:** As you stitch, log every source segment in `data/curated/source_log.md`. Format is in `04_DATA_BRIEF.md` Section 4.2 — segment number, timestamps in the curated cut, source URL, source timestamps, notes. This is the reproducibility artifact; a judge can use it to verify how the cut was assembled.

**Read this first:** `04_DATA_BRIEF.md` Sections 1, 2, 3, and 4. Search terms, quality checklist (10-item rubric — a clip needs 7/10 to qualify), curation workflow.

### Deliverable 2 — Per-second telemetry CSV

**Output path:** `data/telemetry/demo_video_telemetry.csv`

**Spec:** One row per second of video. Total rows = video duration in seconds (~1500 for a 25-min cut).

**Schema** (column order matters):

| Column | Type | Notes |
|---|---|---|
| `timestamp_seconds` | int | 0, 1, 2, … incrementing per row |
| `datetime_utc` | ISO 8601 string | Plausible recent inspection date/time, incrementing 1 second per row |
| `latitude` | float | WGS84 decimal degrees, ~6 decimal places |
| `longitude` | float | WGS84 decimal degrees, ~6 decimal places |
| `altitude_m_agl` | float | Above ground level, typical 30–50 m for inspection drones |
| `altitude_m_msl` | float | Mean sea level — can approximate as constant terrain elevation + altitude_m_agl |
| `heading_deg` | float | 0–360, computed from successive lat/lon deltas (bearing) |
| `pitch_deg` | float | Drone pitch; small values (~±5°) for typical inspection flight |
| `roll_deg` | float | Drone roll; small values (~±5°) |
| `gimbal_pitch_deg` | float | Camera tilt; typically -30° to -60° (looking down at line) |
| `ground_speed_mps` | float | ~5–15 m/s typical for inspection drones |

**Generation approach:** Pick a real US transmission corridor visible on a public utility or USGS map. Trace 5–10 waypoints along it. Interpolate piecewise between waypoints. Add gentle realistic perturbations (small lat/lon noise ~1–2 m, altitude wobble ~0.5 m, speed variation) so the data doesn't read as artificially smooth.

**Save your corridor definition** to `data_prep/corridor_waypoints.json` so your work is reproducible. Format example:

```json
{
  "corridor_name": "Ameren Missouri 345kV West St. Louis to Wentzville (illustrative)",
  "voltage_class": "345kV",
  "total_distance_miles": 32.4,
  "waypoints": [
    {"lat": 38.6404, "lon": -90.6024, "label": "Start - West St. Louis substation"},
    {"lat": 38.6712, "lon": -90.7156, "label": "Bend NW"},
    {"lat": 38.8203, "lon": -91.0287, "label": "End - Wentzville substation"}
  ]
}
```

**St. Louis area corridors are preferred if the footage environment matches** (the hackathon is in St. Louis, the judging panel includes GeoSTL). But environment coherence beats geographic relevance — if the curated footage shows mountains, don't pick a Missouri corridor. See `04_DATA_BRIEF.md` Section 5 for the full corridor selection criteria.

**Read this first:** `04_DATA_BRIEF.md` Section 5 and `01_MASTER.md` Section 8.1.

### Deliverable 3 — Validation ground truth CSV

**Output path:** `data/validation/ground_truth.csv`

**This is the most important deliverable** because it determines our F1 score. Read carefully.

**Spec:** 20–25 manually-labeled anomalies in the curated demo video.

**Schema** (column order matters):

| Column | Type | Allowed values | Notes |
|---|---|---|---|
| `id` | int | 1, 2, 3, … | Sequential |
| `start_seconds` | int | 0 to video duration | When the anomaly first becomes visible in the curated video. *This is the anomaly visibility range, not a clip window — log when you can actually see the issue, not a buffer around it.* |
| `end_seconds` | int | > start_seconds | When the anomaly leaves the frame or is no longer clearly visible. |
| `class` | string | `insulator_damage`, `vegetation_encroachment`, `other` | Which anomaly class. `other` = anomaly outside our two target classes that you noticed (e.g. tower corrosion). Doesn't affect F1; the pipeline excludes `other` from metric calculation. |
| `severity` | string | `critical`, `high`, `moderate`, `low` | Per Domain Doc rules |
| `description` | string | one sentence | What's visible |
| `notes` | string | optional, free text | Use for `borderline` flags (see below) |

**The severity rules are not optional.** They live in `05_DOMAIN_KNOWLEDGE.md` Sections 3.3 (insulator damage) and 4.8 (vegetation encroachment). Our `pipeline/severity.py` will apply those exact rules to its outputs. If your labels apply different rules, the F1 score becomes meaningless — we'll be measuring "how well did the model match a different rubric than itself."

**Read these before labeling, in this order:**
1. `05_DOMAIN_KNOWLEDGE.md` Sections 3.1 (insulator failure modes — what to look for visually)
2. `05_DOMAIN_KNOWLEDGE.md` Section 3.3 (Class A severity rule table)
3. `05_DOMAIN_KNOWLEDGE.md` Section 4.5 (Class B severity tiers, anchored to MVCD multiples)
4. `05_DOMAIN_KNOWLEDGE.md` Section 4.8 (Class B severity rule table)

**Default voltage class for severity scoring: 345 kV.** This means MVCD = 4.3 ft for vegetation. If the footage clearly shows different voltage infrastructure, ping the project lead before changing the assumption.

#### Worked example — Class A (insulator damage)

The drone passes a suspension tower around 02:14 in the curated video. As it does, you can clearly see one missing disk in the middle of the porcelain insulator string on the outer cross-arm — there's a visible gap. The string is clearly in frame from about 02:12 to 02:18 (a six-second flyby).

```csv
1,132,138,insulator_damage,critical,"Missing disk in porcelain insulator string on outer cross-arm of suspension tower",""
```

Why those timestamps: the anomaly is *visible* from 02:12 (132 s) to 02:18 (138 s). Don't pad the window.

Why critical: Domain Doc Section 3.3 maps "shattered or missing porcelain disk" → Critical.

#### Worked example — Class B (vegetation encroachment)

Around 08:32 the drone flies along a span where a tree branch overhangs the right-of-way, visually about 8 ft from the middle conductor. The branch is clearly in frame from 08:30 to 08:39 — a nine-second view.

```csv
12,510,519,vegetation_encroachment,high,"Tree branch approximately 8 ft from middle conductor, just outside MVCD",""
```

Why those timestamps: the conflict is *visible* from 510 s to 519 s. The labeled range is when you can actually see and assess the issue.

Why high: at 345 kV the MVCD is 4.3 ft. 8 ft is between 1.0× MVCD (4.3 ft) and 2.5× MVCD (10.75 ft) — that's the High tier per Domain Doc Section 4.5.

#### The `borderline` flag

If you're not sure whether something is a true anomaly or what severity it should be, **label it anyway** with `notes = "borderline"`. Don't skip ambiguous cases. The false-positive analysis in our validation report (Phase 5 deliverable) explicitly handles borderline labels. Ambiguity in the ground truth is honest; absence of a label for an ambiguous anomaly looks like we missed it.

#### What NOT to label

- Out-of-scope conditions you happened to notice (tower corrosion, conductor damage) — use `class = other` if you want to record them, but our pipeline won't try to detect them, so they don't affect F1.
- Normal weathering, photographic artifacts, glare on porcelain — these are explicitly NOT Class A per Domain Doc Section 3.2.
- Vegetation outside the right-of-way with no fall-in risk — explicitly NOT Class B per Domain Doc Section 4.7.

---

## Where things live in the repo

```
gridsight/
├── data_prep/                          # YOUR scripts and supporting files
│   ├── README.md                       # what's in here
│   ├── curate_video.py                 # whatever you write to stitch footage
│   ├── generate_telemetry.py           # whatever you write to produce telemetry
│   ├── label_validation.py             # whatever you write to help label (optional)
│   └── corridor_waypoints.json         # corridor definition (tracked)
│
├── data/                               # data files (your outputs land here)
│   ├── curated/
│   │   ├── demo_video.mp4              # YOUR OUTPUT — gitignored (large)
│   │   └── source_log.md               # YOUR OUTPUT — tracked, documents YouTube sources
│   ├── telemetry/
│   │   └── demo_video_telemetry.csv    # YOUR OUTPUT — tracked
│   └── validation/
│       └── ground_truth.csv            # YOUR OUTPUT — tracked
│
└── docs/                               # planning docs (read these)
    ├── 01_MASTER.md                    # project context
    ├── 04_DATA_BRIEF.md                # the spec for what you're producing
    ├── 05_DOMAIN_KNOWLEDGE.md          # severity rules — critical for labeling
    └── 08_EXTERNAL_DATA_HANDOFF.md     # this doc
```

`data_prep/` is yours. You can structure it however helps you work. Just keep at least the `corridor_waypoints.json` and a `data_prep/README.md` so your work is reproducible.

---

## Git workflow

You're working in the GridSight repo. Standard branch-based workflow:

```bash
# Clone
git clone https://github.com/prempunmagar/GridSight.git
cd GridSight

# Branch for your work
git checkout -b data-prep

# Do your work — commit early, commit often
git add data_prep/curate_video.py
git commit -m "Add curation script"

# Push and PR when ready (or merge directly if simpler)
git push origin data-prep
```

**The curated video file (`data/curated/demo_video.mp4`) is gitignored.** It's too large to commit. Hand it to the project lead via Drive / Slack / direct file transfer; the project lead drops it into the local `data/curated/` directory on the machine that runs the pipeline. Your scripts and the source log are in the repo so the cut is reproducible — the file itself isn't.

**The telemetry CSV and ground truth CSV are committed.** They're small (a few hundred KB each) and they're our reproducibility anchors.

---

## Definition of done

For each deliverable, "done" means:

**Curated video:**
- File at `data/curated/demo_video.mp4`, ~25 minutes, plays cleanly start-to-finish in VLC
- `data/curated/source_log.md` documents every segment with source URL and timestamps
- Damage quota met (≥ 6 insulator examples, ≥ 4 vegetation examples)
- Voltage class confirmed (default 345 kV; flag if footage shows different voltage)

**Telemetry:**
- File at `data/telemetry/demo_video_telemetry.csv`, one row per second of the curated video
- All 11 schema columns populated, plausible values throughout
- `data_prep/corridor_waypoints.json` saved
- Loads cleanly via `pandas.read_csv()` (sanity check before declaring done)

**Validation labels:**
- File at `data/validation/ground_truth.csv`, 20–25 anomalies labeled
- All 7 schema columns populated, severity values match the Domain Doc rules
- Borderline cases tagged in `notes`
- Distribution across the timeline (not all clustered at the start or end)

When all three are done, ping the project lead. The pipeline takes over from there.

---

## Things to ping the project lead about

Don't guess on these — ask:

- The footage clearly shows a different voltage class than 345 kV (changes severity numbers)
- A specific anomaly looks like it could be Class A or Class B and you can't tell
- You want to label something that doesn't fit either class cleanly
- Your damage quota is hard to meet with available footage
- You want to pick a corridor outside the St. Louis area
- The curated cut ends up shorter or longer than 25 minutes (anything 20–30 is probably fine, ask)

---

## Reading order before starting

1. **`01_MASTER.md` Sections 1–5** — the project, the scope, the anomaly classes (~15 min)
2. **`04_DATA_BRIEF.md`** in full — the practical spec (~15 min)
3. **`05_DOMAIN_KNOWLEDGE.md` Sections 3 and 4** — what damage and encroachment look like, with severity rules (~20 min)
4. **This doc** — back-pocket reference

Total reading: ~50 minutes. Worth doing before you start producing anything, especially before validation labeling.

---

*End of document. When in doubt, ask.*
