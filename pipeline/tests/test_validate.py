"""Tests for pipeline.validate — matcher, metrics, loaders."""

from __future__ import annotations

import csv
from pathlib import Path

import pytest

from pipeline.validate import (
    CLASSES,
    clip_normalize_ground_truth,
    compute_metrics,
    filter_inputs,
    greedy_match,
    iou,
    load_findings,
    load_ground_truth,
)


# ----------------------------- helpers ---------------------------------------


def _pred(finding_id: str, t_center: float, klass: str = "insulator_damage",
          severity: str = "high", duration: float = 12.0,
          marengo_score: float = 0.20, pegasus_confidence: str = "high") -> dict:
    return {
        "finding_id": finding_id,
        "timestamp_seconds": t_center,
        "start_seconds": t_center - duration / 2,
        "end_seconds": t_center + duration / 2,
        "class": klass,
        "severity": severity,
        "specific_defects": [],
        "matched_queries": [],
        "marengo_score": marengo_score,
        "pegasus_confidence": pegasus_confidence,
    }


def _gt(id_: int, start: float, end: float, klass: str = "insulator_damage",
        severity: str = "high", description: str = "") -> dict:
    return {
        "id": id_,
        "start_seconds": start,
        "end_seconds": end,
        "class": klass,
        "severity": severity,
        "description": description,
        "notes": "",
    }


# ----------------------------- iou -------------------------------------------


def test_iou_exact_overlap_is_one():
    assert iou((10, 20), (10, 20)) == 1.0


def test_iou_no_overlap_is_zero():
    assert iou((10, 20), (30, 40)) == 0.0


def test_iou_touching_is_zero():
    assert iou((10, 20), (20, 30)) == 0.0


def test_iou_partial_overlap():
    # intersection 5 (15..20), union 15 (10..25) -> 1/3
    assert iou((10, 20), (15, 25)) == pytest.approx(1 / 3)


def test_iou_one_inside_other():
    # intersection 5 (12..17), union 10 (10..20) -> 0.5
    assert iou((10, 20), (12, 17)) == pytest.approx(0.5)


# ----------------------------- greedy_match ----------------------------------


def test_greedy_pairs_by_descending_iou():
    gts = [_gt(1, 100, 110)]
    preds = [_pred("loose", 105, duration=20),  # iou (5/25)=0.2
             _pred("tight", 105, duration=10)]  # iou (10/10)=1.0
    pairs = greedy_match(preds, gts, threshold=0.5)
    assert len(pairs) == 1
    assert pairs[0][1] == 1  # tight prediction wins


def test_greedy_below_threshold_doesnt_match():
    gts = [_gt(1, 100, 110)]
    preds = [_pred("p", 100, duration=30)]  # iou = 10/30 = 0.33
    assert greedy_match(preds, gts, threshold=0.5) == []


def test_greedy_each_consumed_at_most_once():
    gts = [_gt(1, 100, 110), _gt(2, 100, 110)]
    preds = [_pred("p1", 105, duration=10)]
    pairs = greedy_match(preds, gts, threshold=0.5)
    assert len(pairs) == 1
    used_g = {gi for gi, _, _ in pairs}
    assert len(used_g) == 1


# ----------------------------- per-class metrics -----------------------------


def test_perfect_match_one_tp():
    gts = [_gt(1, 100, 112, klass="insulator_damage")]
    preds = [_pred("p1", 106, klass="insulator_damage")]
    m = compute_metrics(preds, gts)
    assert m["by_class"]["insulator_damage"] == {
        "tp": 1, "fp": 0, "fn": 0,
        "precision": 1.0, "recall": 1.0, "f1": 1.0,
        "support_predictions": 1, "support_ground_truth": 1,
    }
    assert m["overall"]["f1"] == 1.0


def test_class_mismatch_is_fp_and_fn():
    gts = [_gt(1, 100, 112, klass="insulator_damage")]
    preds = [_pred("p1", 106, klass="vegetation_encroachment")]
    m = compute_metrics(preds, gts)
    assert m["by_class"]["insulator_damage"]["fn"] == 1
    assert m["by_class"]["insulator_damage"]["tp"] == 0
    assert m["by_class"]["vegetation_encroachment"]["fp"] == 1
    assert m["by_class"]["vegetation_encroachment"]["tp"] == 0


def test_unmatched_prediction_is_fp():
    preds = [_pred("p1", 50, klass="insulator_damage")]
    gts = [_gt(1, 200, 210, klass="insulator_damage")]
    m = compute_metrics(preds, gts)
    assert m["by_class"]["insulator_damage"] == {
        "tp": 0, "fp": 1, "fn": 1,
        "precision": 0.0, "recall": 0.0, "f1": 0.0,
        "support_predictions": 1, "support_ground_truth": 1,
    }
    assert len(m["false_positives"]) == 1
    assert m["false_positives"][0]["finding_id"] == "p1"
    assert len(m["false_negatives"]) == 1
    assert m["false_negatives"][0]["gt_id"] == 1


def test_two_predictions_one_gt_only_one_tp():
    """Greedy match prevents double-counting when two preds straddle one GT."""
    gts = [_gt(1, 100, 112, klass="insulator_damage")]
    preds = [
        _pred("near", 106, klass="insulator_damage"),       # iou ~ 1.0
        _pred("offset", 110, klass="insulator_damage"),     # iou < 1.0 but still passes
    ]
    m = compute_metrics(preds, gts)
    assert m["by_class"]["insulator_damage"]["tp"] == 1
    assert m["by_class"]["insulator_damage"]["fp"] == 1
    assert m["by_class"]["insulator_damage"]["fn"] == 0


def test_overall_micro_aggregates_across_classes():
    preds = [
        _pred("p1", 106, klass="insulator_damage"),
        _pred("p2", 206, klass="vegetation_encroachment"),
        _pred("p3", 500, klass="insulator_damage"),  # no GT -> FP
    ]
    gts = [
        _gt(1, 100, 112, klass="insulator_damage"),
        _gt(2, 200, 212, klass="vegetation_encroachment"),
        _gt(3, 700, 712, klass="vegetation_encroachment"),  # no pred -> FN
    ]
    m = compute_metrics(preds, gts)
    o = m["overall"]
    assert o["tp"] == 2
    assert o["fp"] == 1
    assert o["fn"] == 1
    assert o["precision"] == round(2 / 3, 3)
    assert o["recall"] == round(2 / 3, 3)


# ----------------------------- confusion matrix ------------------------------


def test_confusion_matrix_records_class_swaps_and_misses():
    preds = [
        _pred("p1", 106, klass="vegetation_encroachment"),  # over insulator GT -> swap
        _pred("p2", 500, klass="insulator_damage"),         # no GT -> false alarm
    ]
    gts = [
        _gt(1, 100, 112, klass="insulator_damage"),         # gets swapped pred
        _gt(2, 700, 712, klass="vegetation_encroachment"),  # missed
    ]
    cm = compute_metrics(preds, gts)["confusion_matrix"]
    assert cm["rows"] == ["insulator_damage", "vegetation_encroachment", "none"]
    assert cm["cols"] == ["insulator_damage", "vegetation_encroachment", "none"]

    r_ins = cm["rows"].index("insulator_damage")
    r_veg = cm["rows"].index("vegetation_encroachment")
    r_none = cm["rows"].index("none")
    c_ins = cm["cols"].index("insulator_damage")
    c_veg = cm["cols"].index("vegetation_encroachment")
    c_none = cm["cols"].index("none")

    # insulator GT predicted as vegetation
    assert cm["matrix"][r_ins][c_veg] == 1
    # missed vegetation GT
    assert cm["matrix"][r_veg][c_none] == 1
    # false-alarm insulator pred
    assert cm["matrix"][r_none][c_ins] == 1


# ----------------------------- severity calibration --------------------------


def test_severity_calibration_exact_and_within_one():
    preds = [
        _pred("p1", 106, klass="insulator_damage", severity="high"),     # exact
        _pred("p2", 206, klass="insulator_damage", severity="critical"), # off by 1
        _pred("p3", 306, klass="insulator_damage", severity="low"),      # off by 2
    ]
    gts = [
        _gt(1, 100, 112, klass="insulator_damage", severity="high"),
        _gt(2, 200, 212, klass="insulator_damage", severity="high"),
        _gt(3, 300, 312, klass="insulator_damage", severity="high"),
    ]
    sc = compute_metrics(preds, gts)["severity_calibration"]
    assert sc["n_pairs"] == 3
    assert sc["exact_match_rate"] == pytest.approx(1 / 3, abs=0.001)
    assert sc["within_one_tier_rate"] == pytest.approx(2 / 3, abs=0.001)


def test_severity_calibration_skips_class_mismatched_pairs():
    preds = [_pred("p1", 106, klass="vegetation_encroachment", severity="high")]
    gts = [_gt(1, 100, 112, klass="insulator_damage", severity="high")]
    sc = compute_metrics(preds, gts)["severity_calibration"]
    assert sc["n_pairs"] == 0
    assert sc["exact_match_rate"] == 0.0


# ----------------------------- filter_inputs ---------------------------------


def test_filter_drops_no_action_predictions_and_other_class_gt():
    preds = [
        _pred("active", 100, severity="high"),
        _pred("intact", 200, severity="no_action"),
    ]
    gts = [
        _gt(1, 100, 110, klass="insulator_damage"),
        _gt(2, 300, 310, klass="other"),
    ]
    kept_p, kept_g, dropped = filter_inputs(preds, gts)
    assert [p["finding_id"] for p in kept_p] == ["active"]
    assert [g["id"] for g in kept_g] == [1]
    assert dropped["predictions_dropped_no_action"] == ["intact"]
    assert dropped["ground_truth_dropped_class_other"] == [2]


# ----------------------------- clip-normalized metric -------------------------


def test_clip_normalize_expands_short_gt_window_around_midpoint():
    gts = [_gt(1, 102, 103, klass="vegetation_encroachment")]
    normalized = clip_normalize_ground_truth(gts, clip_duration_seconds=15)

    assert normalized[0]["start_seconds"] == pytest.approx(95.0)
    assert normalized[0]["end_seconds"] == pytest.approx(110.0)
    assert normalized[0]["clip_normalized_from"] == {
        "start_seconds": 102,
        "end_seconds": 103,
    }
    assert gts[0]["start_seconds"] == 102


def test_clip_normalize_keeps_long_gt_window_unchanged():
    gts = [_gt(1, 591, 633, klass="insulator_damage")]
    normalized = clip_normalize_ground_truth(gts, clip_duration_seconds=15)

    assert normalized[0]["start_seconds"] == 591
    assert normalized[0]["end_seconds"] == 633
    assert "clip_normalized_from" not in normalized[0]


def test_clip_normalized_windows_can_match_fixed_evidence_clip():
    preds = [_pred("p1", 100.625, klass="vegetation_encroachment", duration=15)]
    gts = [_gt(1, 102, 103, klass="vegetation_encroachment")]

    strict = compute_metrics(preds, gts, threshold=0.5)
    normalized = compute_metrics(
        preds,
        clip_normalize_ground_truth(gts, clip_duration_seconds=15),
        threshold=0.5,
    )

    assert strict["overall"]["tp"] == 0
    assert normalized["overall"]["tp"] == 1


# ----------------------------- loaders ---------------------------------------


def test_load_ground_truth_strips_whitespace(tmp_path: Path):
    csv_path = tmp_path / "gt.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "start_seconds", "end_seconds", "class", "severity", "description", "notes"])
        # severity has a trailing space (mirrors the real ground_truth.csv quirk)
        w.writerow([3, 170, 194, "insulator_damage", "low ", "corrosion visible", "borderline"])
    gt = load_ground_truth(csv_path)
    assert gt[0]["severity"] == "low"
    assert gt[0]["class"] == "insulator_damage"
    assert gt[0]["start_seconds"] == 170.0


def test_load_findings_projects_required_keys(tmp_path: Path):
    p = tmp_path / "findings.json"
    p.write_text(
        '[{"finding_id":"f001","timestamp_seconds":100,"start_seconds":94,'
        '"end_seconds":106,"class":"insulator_damage","severity":"high",'
        '"specific_defects":["rust"],"matched_queries":["q1"],'
        '"marengo_score":0.18,"pegasus_confidence":"high"}]',
        encoding="utf-8",
    )
    f = load_findings(p)
    assert f[0]["finding_id"] == "f001"
    assert f[0]["start_seconds"] == 94.0
    assert f[0]["specific_defects"] == ["rust"]
