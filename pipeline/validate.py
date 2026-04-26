"""
Validation metrics for GridSight pipeline output.

Implements Phase 5 task 2 of docs/02_BUILD_PLAN.md and the Validation Report
required deliverable in the hackathon spec (Track 02).

Matching rule:
    IoU >= 0.5 between [start_seconds, end_seconds] of a prediction and a
    ground-truth row. Greedy pairing by IoU descending; each GT row and each
    prediction matches at most one partner.

Class semantics:
    Pairs whose classes agree → TP for that class.
    Pairs whose classes disagree → FP for the predicted class AND FN for the
    actual class (and the predictions/GTs are still consumed by the pairing).
    This single matching pass produces both per-class metrics and the confusion
    matrix consistently.

Exclusions:
    - Ground-truth rows with class == "other" are dropped before matching
      (per docs/08_EXTERNAL_DATA_HANDOFF.md: "Doesn't affect F1; the pipeline
      excludes `other` from metric calculation").
    - Predictions with severity == "no_action" are dropped — these are intact
      assets, not damage claims; counting them as positive predictions would
      inflate FP without justification.

Run:
    python -m pipeline.validate
    python -m pipeline.validate --findings out/findings.json --gt data/validation/ground_truth.csv
    python -m pipeline.validate --threshold 0.3   # looser temporal match

Output:
    out/validation_metrics.json  (canonical artifact for 06_VALIDATION_REPORT.md)
    Console summary of by-class metrics + confusion matrix.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from pipeline import config

CLASSES = ("insulator_damage", "vegetation_encroachment")
SEVERITY_ORDER = ("low", "moderate", "high", "critical")
DEFAULT_IOU_THRESHOLD = 0.5


# --------------------------- core matcher / metrics ---------------------------


def iou(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Intersection-over-union of two closed time intervals (start, end)."""
    inter = max(0.0, min(a[1], b[1]) - max(a[0], b[0]))
    if inter <= 0.0:
        return 0.0
    union = (a[1] - a[0]) + (b[1] - b[0]) - inter
    return inter / union if union > 0 else 0.0


def greedy_match(predictions: list[dict], ground_truth: list[dict],
                 threshold: float = DEFAULT_IOU_THRESHOLD) -> list[tuple[int, int, float]]:
    """Greedy IoU pairing.

    Returns list of (gt_index, pred_index, iou). Each GT/pred matches at most
    once. Pairing is class-agnostic; class agreement is judged downstream so
    the same pass yields both per-class metrics and the confusion matrix.
    """
    candidates: list[tuple[float, int, int]] = []
    for gi, gt in enumerate(ground_truth):
        for pi, pred in enumerate(predictions):
            i = iou((gt["start_seconds"], gt["end_seconds"]),
                    (pred["start_seconds"], pred["end_seconds"]))
            if i >= threshold:
                candidates.append((i, gi, pi))
    candidates.sort(key=lambda x: -x[0])

    matched_g: set[int] = set()
    matched_p: set[int] = set()
    pairs: list[tuple[int, int, float]] = []
    for i, gi, pi in candidates:
        if gi in matched_g or pi in matched_p:
            continue
        matched_g.add(gi)
        matched_p.add(pi)
        pairs.append((gi, pi, i))
    return pairs


def _safe_div(num: float, den: float) -> float:
    return num / den if den > 0 else 0.0


def _f1(precision: float, recall: float) -> float:
    return _safe_div(2 * precision * recall, precision + recall)


def compute_metrics(predictions: list[dict], ground_truth: list[dict],
                    threshold: float = DEFAULT_IOU_THRESHOLD) -> dict:
    """Run matching and produce the metrics dict.

    Caller is responsible for excluding `severity=='no_action'` predictions and
    `class=='other'` ground-truth rows beforehand.
    """
    pairs = greedy_match(predictions, ground_truth, threshold)

    tp = {c: 0 for c in CLASSES}
    fp = {c: 0 for c in CLASSES}
    fn = {c: 0 for c in CLASSES}

    matched_pairs_records: list[dict] = []
    matched_g_idx: set[int] = set()
    matched_p_idx: set[int] = set()

    for gi, pi, i in pairs:
        gt = ground_truth[gi]
        pred = predictions[pi]
        matched_g_idx.add(gi)
        matched_p_idx.add(pi)

        cls_match = gt["class"] == pred["class"]
        if cls_match and gt["class"] in tp:
            tp[gt["class"]] += 1
        else:
            if pred["class"] in fp:
                fp[pred["class"]] += 1
            if gt["class"] in fn:
                fn[gt["class"]] += 1

        matched_pairs_records.append({
            "gt_id": gt["id"],
            "finding_id": pred["finding_id"],
            "iou": round(i, 3),
            "gt_class": gt["class"],
            "pred_class": pred["class"],
            "class_match": cls_match,
            "gt_severity": gt["severity"],
            "pred_severity": pred["severity"],
            "severity_match": gt["severity"] == pred["severity"],
        })

    fn_records: list[dict] = []
    for gi, gt in enumerate(ground_truth):
        if gi in matched_g_idx:
            continue
        if gt["class"] in fn:
            fn[gt["class"]] += 1
        fn_records.append({
            "gt_id": gt["id"],
            "class": gt["class"],
            "start_seconds": gt["start_seconds"],
            "end_seconds": gt["end_seconds"],
            "severity": gt["severity"],
            "description": gt.get("description", ""),
            "notes": gt.get("notes", ""),
        })

    fp_records: list[dict] = []
    for pi, pred in enumerate(predictions):
        if pi in matched_p_idx:
            continue
        if pred["class"] in fp:
            fp[pred["class"]] += 1
        fp_records.append({
            "finding_id": pred["finding_id"],
            "class": pred["class"],
            "timestamp_seconds": pred["timestamp_seconds"],
            "start_seconds": pred["start_seconds"],
            "end_seconds": pred["end_seconds"],
            "severity": pred["severity"],
            "specific_defects": pred.get("specific_defects", []),
            "matched_queries": pred.get("matched_queries", []),
            "marengo_score": pred.get("marengo_score"),
            "pegasus_confidence": pred.get("pegasus_confidence"),
        })

    by_class: dict[str, dict] = {}
    for c in CLASSES:
        prec = _safe_div(tp[c], tp[c] + fp[c])
        rec = _safe_div(tp[c], tp[c] + fn[c])
        by_class[c] = {
            "tp": tp[c], "fp": fp[c], "fn": fn[c],
            "precision": round(prec, 3),
            "recall": round(rec, 3),
            "f1": round(_f1(prec, rec), 3),
            "support_predictions": tp[c] + fp[c],
            "support_ground_truth": tp[c] + fn[c],
        }

    total_tp = sum(tp.values())
    total_fp = sum(fp.values())
    total_fn = sum(fn.values())
    overall_prec = _safe_div(total_tp, total_tp + total_fp)
    overall_rec = _safe_div(total_tp, total_tp + total_fn)
    overall = {
        "tp": total_tp, "fp": total_fp, "fn": total_fn,
        "precision": round(overall_prec, 3),
        "recall": round(overall_rec, 3),
        "f1": round(_f1(overall_prec, overall_rec), 3),
    }

    confusion_matrix = _build_confusion_matrix(predictions, ground_truth, pairs)
    severity_calibration = _build_severity_calibration(matched_pairs_records)

    return {
        "by_class": by_class,
        "overall": overall,
        "confusion_matrix": confusion_matrix,
        "severity_calibration": severity_calibration,
        "false_positives": fp_records,
        "false_negatives": fn_records,
    }


def _build_confusion_matrix(predictions: list[dict], ground_truth: list[dict],
                            pairs: list[tuple[int, int, float]]) -> dict:
    """rows = actual class (incl 'none' for false-alarm preds with no GT),
    cols = predicted class (incl 'none' for missed GTs)."""
    rows = list(CLASSES) + ["none"]
    cols = list(CLASSES) + ["none"]
    matrix = [[0] * len(cols) for _ in rows]

    matched_g, matched_p = set(), set()
    for gi, pi, _ in pairs:
        actual = ground_truth[gi]["class"]
        predicted = predictions[pi]["class"]
        r = rows.index(actual) if actual in rows else rows.index("none")
        c = cols.index(predicted) if predicted in cols else cols.index("none")
        matrix[r][c] += 1
        matched_g.add(gi)
        matched_p.add(pi)

    for gi, gt in enumerate(ground_truth):
        if gi in matched_g:
            continue
        actual = gt["class"]
        r = rows.index(actual) if actual in rows else rows.index("none")
        matrix[r][cols.index("none")] += 1

    for pi, pred in enumerate(predictions):
        if pi in matched_p:
            continue
        predicted = pred["class"]
        c = cols.index(predicted) if predicted in cols else cols.index("none")
        matrix[rows.index("none")][c] += 1

    return {"rows": rows, "cols": cols, "matrix": matrix}


def _build_severity_calibration(matched_pairs_records: list[dict]) -> dict:
    """Severity-tier agreement on class-matched pairs only.

    Reports exact match rate and within-one-tier rate against the
    {low, moderate, high, critical} ladder.
    """
    sev_pairs = [r for r in matched_pairs_records if r["class_match"]]
    if not sev_pairs:
        return {"matched_pairs": [], "exact_match_rate": 0.0,
                "within_one_tier_rate": 0.0, "n_pairs": 0}

    exact = 0
    within_one = 0
    for r in sev_pairs:
        gt_s = r["gt_severity"]
        pr_s = r["pred_severity"]
        if gt_s == pr_s:
            exact += 1
        if gt_s in SEVERITY_ORDER and pr_s in SEVERITY_ORDER:
            if abs(SEVERITY_ORDER.index(pr_s) - SEVERITY_ORDER.index(gt_s)) <= 1:
                within_one += 1

    return {
        "matched_pairs": sev_pairs,
        "exact_match_rate": round(exact / len(sev_pairs), 3),
        "within_one_tier_rate": round(within_one / len(sev_pairs), 3),
        "n_pairs": len(sev_pairs),
    }


# ------------------------------ I/O helpers ----------------------------------


def load_findings(path: Path) -> list[dict]:
    """Load pipeline findings.json and project to the dict shape compute_metrics expects."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = []
    for f in raw:
        out.append({
            "finding_id": f["finding_id"],
            "timestamp_seconds": float(f["timestamp_seconds"]),
            "start_seconds": float(f["start_seconds"]),
            "end_seconds": float(f["end_seconds"]),
            "class": f["class"],
            "severity": f["severity"],
            "specific_defects": f.get("specific_defects", []),
            "matched_queries": f.get("matched_queries", []),
            "marengo_score": f.get("marengo_score"),
            "pegasus_confidence": f.get("pegasus_confidence"),
        })
    return out


def load_ground_truth(path: Path) -> list[dict]:
    """Load ground_truth.csv. Handles trailing whitespace in severity/class."""
    out = []
    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            out.append({
                "id": int(row["id"]),
                "start_seconds": float(row["start_seconds"]),
                "end_seconds": float(row["end_seconds"]),
                "class": (row.get("class") or "").strip(),
                "severity": (row.get("severity") or "").strip(),
                "description": (row.get("description") or "").strip(),
                "notes": (row.get("notes") or "").strip(),
            })
    return out


def filter_inputs(predictions: list[dict], ground_truth: list[dict]) -> tuple[list[dict], list[dict], dict]:
    """Apply the documented exclusions and report what was dropped."""
    kept_preds = [p for p in predictions if p["severity"] != "no_action"]
    dropped_preds = [p["finding_id"] for p in predictions if p["severity"] == "no_action"]

    kept_gts = [g for g in ground_truth if g["class"] != "other"]
    dropped_gts = [g["id"] for g in ground_truth if g["class"] == "other"]

    return kept_preds, kept_gts, {
        "predictions_dropped_no_action": dropped_preds,
        "ground_truth_dropped_class_other": dropped_gts,
    }


# ------------------------------- CLI / report --------------------------------


def _print_summary(metrics: dict, dropped: dict, n_preds: int, n_gts: int,
                   out_path: Path, threshold: float) -> None:
    print("=" * 64)
    print(f"GridSight validation  (IoU>={threshold})")
    print("=" * 64)
    print(f"  predictions used:   {n_preds} (dropped {len(dropped['predictions_dropped_no_action'])} no_action)")
    print(f"  ground truth used:  {n_gts} (dropped {len(dropped['ground_truth_dropped_class_other'])} class=other)")
    print()
    print(f"{'class':<28}{'TP':>4}{'FP':>4}{'FN':>4}{'P':>8}{'R':>8}{'F1':>8}")
    print("-" * 64)
    for c, m in metrics["by_class"].items():
        print(f"{c:<28}{m['tp']:>4}{m['fp']:>4}{m['fn']:>4}"
              f"{m['precision']:>8.3f}{m['recall']:>8.3f}{m['f1']:>8.3f}")
    o = metrics["overall"]
    print("-" * 64)
    print(f"{'overall (micro)':<28}{o['tp']:>4}{o['fp']:>4}{o['fn']:>4}"
          f"{o['precision']:>8.3f}{o['recall']:>8.3f}{o['f1']:>8.3f}")
    print()

    cm = metrics["confusion_matrix"]
    print("Confusion matrix (rows = actual, cols = predicted):")
    header = f"{'':<28}" + "".join(f"{c:>16}" for c in cm["cols"])
    print(header)
    for r, row in zip(cm["rows"], cm["matrix"]):
        print(f"{r:<28}" + "".join(f"{v:>16d}" for v in row))
    print()

    sc = metrics["severity_calibration"]
    print(f"Severity calibration ({sc['n_pairs']} class-matched pairs):")
    print(f"  exact match:        {sc['exact_match_rate']:.3f}")
    print(f"  within one tier:    {sc['within_one_tier_rate']:.3f}")
    print()
    print(f"Wrote {out_path}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--findings", type=Path,
                   default=config.OUT_DIR / "findings.json",
                   help="path to pipeline findings.json (default: out/findings.json)")
    p.add_argument("--gt", type=Path,
                   default=config.GROUND_TRUTH_CSV,
                   help="path to ground_truth.csv")
    p.add_argument("--out", type=Path,
                   default=config.OUT_DIR / "validation_metrics.json",
                   help="output JSON path")
    p.add_argument("--threshold", type=float, default=DEFAULT_IOU_THRESHOLD,
                   help=f"IoU threshold for matching (default {DEFAULT_IOU_THRESHOLD})")
    args = p.parse_args(argv)

    if not args.findings.exists():
        print(f"ERROR: findings file not found: {args.findings}", file=sys.stderr)
        return 1
    if not args.gt.exists():
        print(f"ERROR: ground-truth CSV not found: {args.gt}", file=sys.stderr)
        return 1

    predictions = load_findings(args.findings)
    ground_truth = load_ground_truth(args.gt)
    kept_preds, kept_gts, dropped = filter_inputs(predictions, ground_truth)

    metrics = compute_metrics(kept_preds, kept_gts, threshold=args.threshold)

    payload = {
        "metadata": {
            "computed_at_utc": datetime.now(timezone.utc).isoformat(),
            "findings_source": str(args.findings),
            "ground_truth_source": str(args.gt),
            "matching": {
                "rule": f"iou>={args.threshold}",
                "definition": "intersection / union of [start_seconds, end_seconds]; "
                              "class agreement is required for a TP, mismatched-class pairs "
                              "count as FP+FN",
                "pairing": "greedy by IoU descending; each GT and each prediction matches at most once",
            },
            "n_predictions_total": len(predictions),
            "n_predictions_used": len(kept_preds),
            "n_ground_truth_total": len(ground_truth),
            "n_ground_truth_used": len(kept_gts),
            "exclusions": dropped,
        },
        **metrics,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    _print_summary(metrics, dropped, len(kept_preds), len(kept_gts), args.out, args.threshold)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
