# GridSight — Data Research Brief

> **Status:** Draft, Saturday April 25, 2026.
> **Companion docs:** `01_MASTER.md` (project source of truth), `02_BUILD_PLAN.md` (execution playbook), `03_REPO_STRUCTURE.md` (repo layout), `05_DOMAIN_KNOWLEDGE.md` (what damage actually looks like), `08_EXTERNAL_DATA_HANDOFF.md` (operational contract with the data prep team).

---

## How to use this document

This document describes **what the data prep workstream produces and how** — the search strategy, quality criteria, curation workflow, and corridor selection logic behind the demo's input data. The data prep team works in `data_prep/` of the repo and uses this doc as substantive guidance; the GridSight team uses it as project documentation to understand what's happening upstream and why.

Per Decision D16 in `01_MASTER.md`, demo input preparation (footage curation, telemetry generation, validation labeling) is a separate workstream within the team. **The operational contract for that workstream — what to deliver, where it goes, the schemas — lives in `08_EXTERNAL_DATA_HANDOFF.md`.** This doc explains the *why* and the *how* of the data work; the handoff doc is the *what to deliver* checklist.

The brief has six sections:

1. **What we need** — the spec, in priority order.
2. **Search strategy** — terms, channels, filters, what to grab.
3. **Quality checklist** — how to evaluate a candidate clip.
4. **Curation workflow** — from raw downloads to canonical cut.
5. **Telemetry corridor selection** — picking the route the simulated drone "flew."
6. **Anti-patterns** — what to actively avoid.

When the data prep team isn't sure if footage is usable, the Quality Checklist (Section 3) is the answer. When they aren't sure what damage looks like, `05_DOMAIN_KNOWLEDGE.md` Section 3 (insulator damage) and Section 4 (vegetation encroachment) is the answer. When they need the schema or delivery format, that's in `08_EXTERNAL_DATA_HANDOFF.md`.

---

## 1. What We Need

### 1.1 The numbers

- **~60 minutes of candidate footage** downloaded across 4–6 source videos
- Curated down to **~25 minutes** for the canonical demo cut
- **1080p preferred**; 720p acceptable only if the content is exceptional
- Within the curated cut, target **at least 6–8 visible insulator damage examples and 4–6 vegetation conflicts** (per damage-rich curation, Decision D15 in `01_MASTER.md`)
- Then a **manual validation set of 20–25 anomalies** labeled in `data/validation/ground_truth.csv`

### 1.2 Asset target

We are building exclusively for **lattice steel suspension towers** carrying **345 kV** (default) high-voltage AC transmission lines, in **clear daylight** conditions. See `05_DOMAIN_KNOWLEDGE.md` Section 1 for the full definition of suspension towers and how to identify them, and Section 2 for the visual cues that confirm the voltage class.

If the curated footage clearly shows higher-voltage infrastructure (multi-bundled conductors, very tall towers, long insulator strings), revise the voltage class assumption upward and document the change in `data/curated/source_log.md`.

### 1.3 Damage-rich curation — and why it's defensible

Real-world transmission inspections show mostly healthy infrastructure. Damage rates per mile are low. A truly representative 25-minute cut would have maybe 2–4 damage examples — too sparse for a compelling demo.

**We deliberately curate for damage diversity.** This is a demo of detection capability, not a claim about field damage rates. The README and the demo video will state this openly:

> "Our 25-minute canonical cut is curated to include diverse damage examples (8 insulator faults, 6 vegetation conflicts) drawn from publicly available drone footage. This is a demonstration of detection capability, not a claim about field damage rates — typical operational footage has substantially lower anomaly density."

Honest cherry-picking with disclosure is the right balance. Hiding the curation choice would invite criticism; pretending damage is more common than it is would be misleading.

### 1.4 What "good footage" looks like

The strongest candidate clips share these properties:

- Drone or helicopter altitude with **clear, slow flyovers** of insulator strings and tower hardware
- **Frame composition** that puts the asset in the center of the frame for at least 5–8 seconds, allowing the model to see the same component from multiple angles
- **Continuous footage** without rapid cuts, music overlays, or talking-head segments
- **Daylight** with good but not blinding exposure (overcast is often best — minimizes harsh shadows on dark steel)
- **Lattice steel suspension tower geometry** clearly visible: cross-arms, vertical insulator strings, conductor below
- **Right-of-way visible** along the conductor span — vegetation context is a major part of the demo
- **Embedded GPS/altitude HUD overlay** is a nice-to-have (sometimes raw drone footage burns this in) but is not required

### 1.5 Forward compatibility — broad-version queries

The Workflow 03 stretch goal includes a "broad version" that adds inventory queries to find every visible asset, not just suspicious ones. This affects what we hunt for too:

- **Damage-rich content** for the narrow-version anomaly detection demo (priority)
- **Clean inventory views** — long stretches of healthy line where individual assets are clearly visible (secondary, supports broad version if shipped)

A 25-minute cut with both characteristics serves both versions. Worst case (broad version skipped), we have great damage-rich footage with some healthy asset coverage. Best case (broad version ships), the same footage already supports it. **No need to re-hunt footage if the broad version is decided at Decision Gate 3.**

---

## 2. Search Strategy

### 2.1 Tool

`yt-dlp` is the right tool for downloading. Sample command for 1080p MP4:

```bash
yt-dlp -f "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]" \
       -o "data/raw/%(channel)s_%(title).100s.%(ext)s" \
       "<youtube-url>"
```

Save raw downloads under `data/raw/` (gitignored). Do not commit raw video files.

### 2.2 Primary search terms — clean inventory footage

Start broad and let YouTube's algorithm surface adjacent content:

- `"powerline inspection drone 1080p"`
- `"transmission line UAV inspection"`
- `"high voltage tower drone inspection"`
- `"transmission line aerial survey"`
- `"utility right-of-way drone"`
- `"transmission corridor inspection raw"`
- `"drone powerline survey"`
- `"helicopter transmission line patrol"`

These tend to surface a mix of healthy footage and occasional damage examples. Often industry contractors post unedited inspection clips for marketing — those are gold.

### 2.3 Damage-specific search terms — for filling the curation quota

The narrow-build curation needs damage examples. These targeted searches surface damage-rich content:

**Insulator damage:**
- `"damaged insulator drone"`
- `"broken porcelain insulator transmission"`
- `"insulator inspection drone defect"`
- `"transmission line insulator damage"`
- `"flashover insulator transmission"`
- `"polymer insulator failure inspection"`

**Vegetation encroachment:**
- `"vegetation encroachment transmission line"`
- `"tree near power line drone"`
- `"vegetation violation power line aerial"`
- `"transmission line tree conflict"`
- `"right-of-way overgrowth drone"`

**Composite / educational damage examples:**
- `"transmission line failure inspection"`
- `"power line damage assessment drone"`
- `"insulator failure analysis"`

### 2.4 Industry channels to check

Some YouTube channels consistently post inspection-grade content. Worth searching directly:

- **Utility contractors** (companies that perform drone/helicopter inspection commercially) — often post unedited demo reels
- **Drone service providers** specializing in industrial inspection — frequently 1080p, good camera work
- **Utility companies' own outreach channels** — sometimes post inspection footage for transparency / training
- **Industry conference recordings** (NASTT, APGA, IEEE PES) — can include real-world inspection footage as part of presentations

When evaluating a channel, check their last 5–10 uploads. Channels that post inspection footage as a hobby or marketing tend to upload clean, slow flyovers; channels that produce edited promotional content rarely have what we need.

### 2.5 Quick filters to apply during search

Reject candidates immediately if:

- Resolution is below 720p (check with `yt-dlp -F <url>` before downloading)
- The video is heavily edited with cuts every 1–3 seconds
- There's continuous music overlay (impossible to demo without distraction)
- The voiceover narration is dense throughout (we want clean visuals)
- The footage is a slideshow of stills, not actual drone video
- The "drone" footage is actually ground-level handheld video
- The asset shown is distribution-class wood pole, not transmission lattice tower

---

## 3. Quality Checklist

For each candidate clip you download, run through this list before deciding to include footage from it in the curated cut. Score each item 0/1; a clip needs at least 7/10 to qualify.

| # | Criterion | Pass condition |
|---|---|---|
| 1 | **Resolution** | ≥ 1080p (720p only if content is exceptional) |
| 2 | **Asset type** | Lattice steel suspension towers visible (not tubular pole, not wood, not distribution) |
| 3 | **Voltage class consistency** | Footage is plausibly 230–500 kV (use cues from `05_DOMAIN_KNOWLEDGE.md` §2) |
| 4 | **Clear visibility** | Insulator strings visible for ≥ 5 seconds at center frame at least once |
| 5 | **Slow camera motion** | Drone/helicopter pans slowly enough to read the assets, not rapid sweep |
| 6 | **Daylight** | Clear daytime; no night, dawn, dusk, or extreme weather |
| 7 | **Minimal overlays** | No persistent music, voiceover, or graphics covering the assets |
| 8 | **Continuous footage** | At least one segment of 30+ seconds without a cut |
| 9 | **Anomaly potential** | At least one suspect asset visible (damage candidate or vegetation conflict) — for damage-quota clips |
| 10 | **Right-of-way visible** | Ground/vegetation under conductors is visible, not just sky |

### 3.1 Quick sanity check before adding to curated cut

Once a clip passes the checklist, watch its best 1–2 minutes once more and answer:

- **Could a human inspector miss something here?** If the answer is "no, everything is obviously fine," that's a healthy clip — useful for the narrow-version baseline but won't drive demo punch.
- **Is the damage I think I see actually visible at this resolution?** Sometimes "damage" turns out to be a shadow or a nearby unrelated object. Confirm before counting it toward the damage quota.
- **Would this clip embarrass us in the demo if a judge looked at it carefully?** Reject any clip with intrusive watermarks, network branding bugs, or content that suggests proprietary leakage.

---

## 4. Curation Workflow

### 4.1 Step-by-step

1. **Download candidates** (~60 minutes total, 4–6 videos) into `data/raw/`.
2. **Run each through the Quality Checklist.** Reject anything < 7/10.
3. **Identify the best segments** in each surviving candidate. Note timestamps where (a) asset visibility is excellent, (b) damage is visible, (c) vegetation conflicts are visible, (d) clean inventory views are present.
4. **Plan the curated cut** as a sequence of segments totaling ~25 minutes. Mix damage examples with healthy stretches. Don't front-load all damage in the first 5 minutes — distribute it so the demo plays naturally.
5. **Stitch with ffmpeg** into `data/curated/demo_video.mp4` using the helper script `data_prep/curate_video.py`. Re-encode to consistent resolution (1080p), framerate (30 fps), and bitrate (~5 Mbps).
6. **Document the cut** in `data/curated/source_log.md` (format below).
7. **Validate the cut** plays cleanly start-to-finish in QuickTime / VLC before declaring it done.

### 4.2 `source_log.md` format

Every segment included in the curated cut gets a row in this file. This is the reproducibility artifact — a teammate (or judge) can recreate the exact cut from this log.

```markdown
# Source Log — Curated Demo Video

| Segment | Start (curated) | End (curated) | Source Video URL | Source Start | Source End | Notes |
|---|---|---|---|---|---|---|
| 1 | 00:00 | 02:30 | https://youtu.be/abc123 | 03:15 | 05:45 | Clean inventory view of 8 towers |
| 2 | 02:30 | 04:10 | https://youtu.be/def456 | 12:08 | 13:48 | Includes damaged insulator at 03:22 |
| 3 | 04:10 | 06:45 | https://youtu.be/abc123 | 18:30 | 21:05 | Vegetation conflict near tower 5 |
| ... | | | | | | |

## Notes

- Total curated duration: ~25 minutes
- Voltage class assumption: 345 kV (confirmed by twin bundle conductors visible throughout)
- Source environments: mixed prairie / light woodland (matches chosen Missouri corridor — see `05_DOMAIN_KNOWLEDGE.md` corridor selection notes)
- Damage examples: 8 insulator-related, 6 vegetation-related
```

### 4.3 Hand-off to validation labeling

Once the curated cut exists and the source log is committed, validation labeling can begin. The data prep team labeler watches the 25-minute cut and produces `data/validation/ground_truth.csv` with 20–25 anomalies labeled per the schema in `08_EXTERNAL_DATA_HANDOFF.md`.

The labeler should refer to `05_DOMAIN_KNOWLEDGE.md` Sections 3 and 4 for the precise rules on what counts as Class A or Class B and what severity to assign. The handoff doc reproduces the schema with allowed values, includes worked examples for both classes, and specifies the `borderline` flag convention. Borderline cases should be flagged with `notes = "borderline"` rather than guessed at — the validation report's false-positive analysis depends on a clean ground truth.

---

## 5. Telemetry Corridor Selection

After curation, the data prep team also picks the real US transmission corridor that the simulated drone telemetry will trace. This drives the `(lat, lon)` values in `data/telemetry/demo_video_telemetry.csv` and the flight-path overlay on the dashboard map.

### 5.1 Selection criteria

A good corridor:

- Is a **real, identifiable transmission line** visible on a public utility or USGS map. We are mapping the demo to a real corridor, not making one up.
- Has visible **environment that roughly matches the curated footage**. If our footage shows light prairie, don't pick a corridor through dense Appalachian forest. If our footage shows mountainous terrain, don't pick a Kansas corridor.
- Is **5–50 miles long**. Long enough to plausibly contain a 25-minute drone flight at moderate speed (~2 miles/min); short enough that the corridor stays a single coherent stretch.
- Has **a few bends** so the polyline isn't a straight line on the map (looks more authentic).
- Is in a **publicly-known transmission system** so judges can verify the corridor exists if they want.

### 5.2 St. Louis area corridors — a small free win

The hackathon is in St. Louis. The judging panel includes GeoSTL representatives. **Picking a corridor near St. Louis is worth doing if the footage environment plausibly matches.**

Candidate corridors in the region (verify against current public utility maps):

- **Ameren Missouri 345 kV** — bulk transmission backbone across MISO south, including the St. Louis metro. Long spans, mix of suburban and rural environment that matches typical drone inspection footage. Strong default choice and aligned with the project's voltage class default (Decision D17).
- Public references: the EIA's transmission line dataset and Ameren's published service area maps both show real corridor routes.

If the curated footage doesn't match the St. Louis area's terrain (e.g., footage is clearly desert, mountains, or coastal), pick a corridor that does match — environment coherence beats geographic relevance.

### 5.3 Capturing the corridor as waypoints

Once the corridor is chosen:

1. Open the corridor on a public map (Google Maps, USGS, utility map).
2. Trace it with **5–10 waypoints** capturing the start, end, and major bends. More waypoints for curvy corridors; fewer for straight ones.
3. Save as `data_prep/corridor_waypoints.json`:

```json
{
  "corridor_name": "Ameren Missouri 345kV West St. Louis to Wentzville (illustrative)",
  "voltage_class": "345kV",
  "total_distance_miles": 32.4,
  "waypoints": [
    {"lat": 38.6404, "lon": -90.6024, "label": "Start - West St. Louis substation"},
    {"lat": 38.6712, "lon": -90.7156, "label": "Bend NW"},
    {"lat": 38.7345, "lon": -90.8543, "label": "Mid-corridor"},
    {"lat": 38.8123, "lon": -90.9210, "label": "Bend W"},
    {"lat": 38.8203, "lon": -91.0287, "label": "End - Wentzville substation"}
  ]
}
```

The `data_prep/generate_telemetry.py` script reads this file and produces the per-second telemetry CSV by piecewise interpolation between waypoints. See `08_EXTERNAL_DATA_HANDOFF.md` for the telemetry CSV's full schema and delivery details.

### 5.4 Honest disclosure

The README and the demo will state clearly that the corridor is real but the visual footage is independent — they were not captured at the same flight, since YouTube footage doesn't carry GPS telemetry. This is fine; what we're demonstrating is the **format and structure** of a deployed pipeline's output, not a literal claim about where the footage was shot.

If the corridor and footage are visibly mismatched (snow vs. summer, mountain vs. plain), flag this in the source log and either pick a different corridor or accept the disclosure.

---

## 6. Anti-Patterns — Things to Actively Avoid

These are mistakes that have cost teams real time on similar projects. None are subtle but all are common.

- **Don't accept "drone footage" that's actually animation or simulation.** Some YouTube content is rendered 3D or composite imagery that *looks* like drone footage. Marengo will index it but Pegasus will produce confused descriptions. Quick check: does the video have natural lighting variation, real bird/insect crossings, motion blur consistent with a real camera?
- **Don't curate a 25-minute cut where 20 minutes are healthy and 5 minutes are damage all clustered together.** Distribute the damage examples through the cut so the demo plays naturally. Pegasus calls cost compute; the validation set is more useful if it samples across the timeline.
- **Don't pick a corridor that makes no environmental sense for the footage.** A St. Louis corridor with footage that's clearly Iceland is dishonest in a way the disclosure can't paper over. Match terrain types.
- **Don't skip the Quality Checklist for a clip you really like.** The single most common failure mode in hackathon data work is "this footage looks great so I'll use it" followed by discovery on Sunday morning that Pegasus produces garbage on it.
- **Don't commit raw downloaded videos to the repo.** They're large (many GB) and regenerable from `source_log.md`. The `.gitignore` should already prevent this; double-check after staging.
- **Don't label validation set anomalies you don't understand.** If the visual evidence is ambiguous, mark it `borderline` in the notes. The false-positive analysis is more useful with honest borderline labels than with confident wrong labels.
- **Don't treat YouTube view counts as a quality signal.** A 50-view utility-contractor clip is often higher-quality data than a 500K-view edited promotional video.

---

## 7. Glossary

Most domain terms (insulator string, cross-arm, MVCD, ROW, etc.) are defined in `05_DOMAIN_KNOWLEDGE.md`. This brief uses a few additional data-specific terms:

- **Curated cut** — the single 25-minute MP4 produced from selected segments of raw downloads. The canonical input to the pipeline.
- **Source log** — the markdown file documenting which YouTube URLs and timestamp ranges contributed to the curated cut. Reproducibility artifact.
- **Corridor** — the real US transmission line route the simulated drone telemetry traces. Defined as a waypoint list in `data_prep/corridor_waypoints.json`.
- **Damage quota** — the target number of damage examples in the curated cut: 6–8 insulator faults, 4–6 vegetation conflicts.
- **Validation set / ground truth** — the manually-labeled list of anomalies in the curated cut, used to compute precision/recall/F1.
- **Borderline label** — a validation entry where the visual evidence is ambiguous; tagged with `notes = "borderline"` so the false-positive analysis can treat it specially.

---

*End of document. When sourcing footage, the order of operations is: search → quality check → download → re-check → curate → log → hand off. Skipping the re-check after download is the most common mistake.*
