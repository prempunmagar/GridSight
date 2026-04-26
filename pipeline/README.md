# `pipeline/` — Detection + Validation

Python modules that turn `data/curated/demo_video.mp4` into `out/findings.{json,csv,geojson}` and the dashboard-side `app/public/data/*.json`. Orchestration lives in `run_all.py`; per-stage modules are `bedrock_client.py`, `marengo_index.py`, `marengo_detect.py`, `extract_clips.py`, `pegasus_describe.py`, `severity.py`, `telemetry.py`, `export_csv.py`, `export_geojson.py`, `export_dashboard.py`. See `docs/02_BUILD_PLAN.md` Phases 3–4 for what each does.

This README documents the **validation module** (`validate.py`) — the post-hoc analysis that produces `out/validation_metrics.json`, the canonical artifact behind the hackathon spec's required Validation Report deliverable and Phase 5 task 2 of the build plan.

## Run it

```bash
# defaults: out/findings.json vs data/validation/ground_truth.csv, IoU>=0.5
# also writes clip_normalized metrics for 15s evidence-clip evaluation
python -m pipeline.validate

# custom paths or threshold
python -m pipeline.validate --findings out/findings.json --gt data/validation/ground_truth.csv
python -m pipeline.validate --threshold 0.3      # looser temporal match for sensitivity analysis

# tests
pytest pipeline/tests/test_validate.py -q
```

Writes `out/validation_metrics.json` and prints a console summary (per-class P/R/F1, confusion matrix, severity calibration, and clip-normalized companion metrics).

## What the spec asks for

From the Track 02 PDF, **Validation Report (REQUIRED)**:

- Labeled test set: 15–25 manually annotated anomalies
- Precision, recall, F1 per anomaly category
- Confusion matrix: what gets misclassified and why
- Severity distribution: are critical findings prioritized correctly
- False positive analysis: what causes spurious detections

`validate.py` produces every input the report needs as machine-readable JSON; the human writeup lives in `docs/06_VALIDATION_REPORT.md`.

## Methodology

### Matching rule

Predictions and ground-truth rows are paired by **temporal IoU** between their `[start_seconds, end_seconds]` intervals:

```
IoU(a, b) = |a ∩ b| / |a ∪ b|
```

A pair is eligible if `IoU >= threshold` (default `0.5`). Pairing is **greedy by IoU descending** — the highest-IoU candidate is consumed first, and each ground-truth row and each prediction can pair at most once. This avoids double-counting when several predictions cluster around one true anomaly.

The build plan (`docs/02_BUILD_PLAN.md` Phase 5 task 2) specifies "≥50% overlap" without naming a denominator. IoU is the standard for event/action detection and the strictest interpretation; using it makes the F1 numbers defensible against any reasonable challenge.

### Clip-normalized companion metric

GridSight returns fixed-duration evidence clips (`config.CLIP_DURATION_SECONDS`, currently 15 seconds). Some ground-truth rows mark only the most visible 1- to 4-second instant inside that clip, which makes raw IoU ≥ 0.5 impossible even for a visually correct clip. `validate.py` therefore also writes `clip_normalized`: any GT window shorter than the evidence clip is expanded around its midpoint to the clip duration, then the same IoU rule is applied. The strict raw-window metrics remain the top-level baseline.

### Class semantics

A pair counts as a **true positive** only if `prediction.class == ground_truth.class`. Class-mismatched pairs are still consumed by the pairing (so the same pair can't fund a TP elsewhere) but contribute as both **FP for the predicted class** and **FN for the actual class**. This is the standard convention and makes the confusion matrix consistent with the per-class numerators.

### Exclusions

Two filters run before matching:

| Excluded | Reason |
|---|---|
| GT rows where `class == "other"` | Per `docs/08_EXTERNAL_DATA_HANDOFF.md`: "Doesn't affect F1; the pipeline excludes `other` from metric calculation." `other` exists for human-noticed anomalies outside our two target classes (e.g., tower corrosion). |
| Predictions where `severity == "no_action"` | These are `intact` assets per Pegasus. They aren't claims of damage; counting them as positive predictions would inflate FP without justification. They're still recorded in `findings.json` for full-inventory transparency (Decision D9). |

The exclusions are reported in the output JSON's `metadata.exclusions` block so the writeup can disclose them.

### Severity calibration

Among **class-matched pairs only** (where the question is meaningful), the module reports two rates against the `low → moderate → high → critical` ladder:

- **Exact match rate** — fraction of pairs where predicted severity equals GT severity.
- **Within-one-tier rate** — fraction within ±1 ladder step. The spec asks "are critical findings prioritized correctly"; within-one is the looser version that still distinguishes "calibrated" from "wildly off."

The full per-pair list is included so the report can show the failure cases inline.

### False positive / false negative analysis

Each unmatched prediction lands in `false_positives[]` with its full Pegasus output (specific defects, matched Marengo queries, similarity score, confidence). Each unmatched ground-truth row lands in `false_negatives[]` with the labeler's description. The combination is what supports the spec's required "what causes spurious detections" analysis.

## Output schema

```jsonc
{
  "metadata": {
    "computed_at_utc": "...",
    "findings_source": "out/findings.json",
    "ground_truth_source": "data/validation/ground_truth.csv",
    "matching": {
      "rule": "iou>=0.5",
      "definition": "...",
      "pairing": "greedy by IoU descending; each GT and each prediction matches at most once"
    },
    "n_predictions_total": 14,
    "n_predictions_used": 9,
    "n_ground_truth_total": 15,
    "n_ground_truth_used": 15,
    "exclusions": {
      "predictions_dropped_no_action": ["f003", "f004", "f010", "f011", "f012"],
      "ground_truth_dropped_class_other": []
    }
  },
  "by_class": {
    "insulator_damage":         { "tp": 0, "fp": 0, "fn": 0,
                                   "precision": 0.0, "recall": 0.0, "f1": 0.0,
                                   "support_predictions": 0, "support_ground_truth": 0 },
    "vegetation_encroachment":  { ... }
  },
  "overall": { "tp": 0, "fp": 0, "fn": 0,
               "precision": 0.0, "recall": 0.0, "f1": 0.0 },
  "clip_normalized": {
    "by_class": { "...": "same shape as top-level by_class" },
    "overall": { "tp": 0, "fp": 0, "fn": 0,
                 "precision": 0.0, "recall": 0.0, "f1": 0.0 },
    "confusion_matrix": { "...": "same shape as top-level confusion_matrix" },
    "severity_calibration": { "...": "same shape as top-level severity_calibration" },
    "false_positives": [],
    "false_negatives": []
  },
  "confusion_matrix": {
    "rows": ["insulator_damage", "vegetation_encroachment", "none"],
    "cols": ["insulator_damage", "vegetation_encroachment", "none"],
    "matrix": [[..], [..], [..]]
  },
  "severity_calibration": {
    "matched_pairs": [
      { "gt_id": 4, "finding_id": "f011", "iou": 0.83,
        "gt_class": "insulator_damage", "pred_class": "insulator_damage",
        "class_match": true,
        "gt_severity": "moderate", "pred_severity": "high",
        "severity_match": false }
    ],
    "exact_match_rate": 0.0, "within_one_tier_rate": 0.0, "n_pairs": 0
  },
  "false_positives": [
    { "finding_id": "f001", "class": "vegetation_encroachment",
      "timestamp_seconds": 89.4, "start_seconds": 83.4, "end_seconds": 95.4,
      "severity": "moderate", "specific_defects": [...],
      "matched_queries": [...], "marengo_score": 0.16, "pegasus_confidence": "medium" }
  ],
  "false_negatives": [
    { "gt_id": 14, "class": "insulator_damage",
      "start_seconds": 733, "end_seconds": 753, "severity": "low",
      "description": "white marks on cermaic disks...", "notes": "needs_human_review" }
  ]
}
```

## Caveats to disclose in `06_VALIDATION_REPORT.md`

These are real and should be acknowledged honestly — the spec rewards calibrated reporting, not inflated numbers.

- **Small N.** Current `ground_truth.csv` has 15 rows; the spec asks for 15–25. We're at the floor. F1 is a 2-sigfig number at this scale and a single relabel can swing it.
- **Default IoU threshold is conservative.** Predictions are 15-second clips centered on a Marengo hit; ground-truth windows are the *visibility window* of the anomaly (often 1–10 s). Many GT windows are shorter than the prediction window, which caps achievable IoU at `gt_dur / pred_dur` even with perfect centering. Run with `--threshold 0.3` for a sensitivity check; the gap between 0.5 and 0.3 numbers is itself a finding worth reporting.
- **Severity tiers are coarse.** The labeler's `severity` is a four-step ladder anchored to NERC FAC-003 / domain rules, but Pegasus only sees a 15-second clip and has no MVCD measurement. Within-one-tier agreement is the metric to lean on, not exact match.
- **Visual estimates of vegetation distance.** Pegasus's `vegetation_distance_estimate_ft` is a coarse visual estimate (~±5 ft per `docs/05_DOMAIN_KNOWLEDGE.md` §4.6). When this drives severity, expect noise.
- **`other`-class GT is excluded.** Currently zero rows, so it's a no-op, but if labelers add `other` rows later (e.g., tower corrosion outside the two target classes), they won't move the F1 number — only the qualitative writeup picks them up.
