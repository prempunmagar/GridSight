from pipeline.severity import score_finding


def _parsed(component_type="insulator_string", condition="damaged",
            defects=None, distance=None, pegasus_conf="high"):
    return {
        "component_type": component_type,
        "condition": condition,
        "specific_defects": defects or [],
        "vegetation_distance_estimate_ft": distance,
        "pegasus_confidence": pegasus_conf,
    }


def test_intact_short_circuits_to_no_action():
    out = score_finding(_parsed(condition="intact", defects=[]), marengo_score=0.9)
    assert out["severity"] == "no_action"
    assert out["needs_human_review"] is False


def test_unclear_is_low_and_needs_review():
    out = score_finding(_parsed(condition="unclear", defects=[]), marengo_score=0.9)
    assert out["severity"] == "low"
    assert out["needs_human_review"] is True


def test_insulator_shattered_is_critical():
    out = score_finding(_parsed(defects=["shattered porcelain disk"]), marengo_score=0.85)
    assert out["class"] == "insulator_damage"
    assert out["severity"] == "critical"
    assert out["nerc_citation"] is None  # Class A has no FAC-003 anchor


def test_insulator_rust_streak_is_high():
    out = score_finding(_parsed(defects=["visible rust streak on lower disks"]), marengo_score=0.8)
    assert out["severity"] == "high"


def test_insulator_unmatched_keywords_falls_through_to_low():
    out = score_finding(_parsed(defects=["something weird"]), marengo_score=0.8)
    assert out["severity"] == "low"


def test_vegetation_within_mvcd_is_critical_with_citation():
    out = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=2.0),
        marengo_score=0.8,
    )
    assert out["class"] == "vegetation_encroachment"
    assert out["severity"] == "critical"
    assert out["nerc_citation"] == "NERC FAC-003-4 §R2"


def test_vegetation_just_outside_mvcd_is_high():
    out = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=6.0),
        marengo_score=0.8,
    )
    assert out["severity"] == "high"
    assert out["nerc_citation"] == "NERC FAC-003-4 §R1"


def test_vegetation_within_row_is_moderate():
    out = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=15.0),
        marengo_score=0.8,
    )
    assert out["severity"] == "moderate"
    assert out["nerc_citation"] is None


def test_vegetation_far_outside_row_is_no_action():
    out = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=40.0),
        marengo_score=0.8,
    )
    assert out["severity"] == "no_action"


def test_vegetation_no_distance_falls_back_to_keyword():
    out = score_finding(
        _parsed(component_type="vegetation", condition="damaged",
                defects=["branches touching the conductor"], distance=None),
        marengo_score=0.8,
    )
    assert out["severity"] == "critical"


def test_combined_confidence_high():
    out = score_finding(_parsed(defects=["shattered"], pegasus_conf="high"), marengo_score=0.20)
    assert out["combined_confidence"] == "high"


def test_combined_confidence_low_when_marengo_weak():
    out = score_finding(_parsed(defects=["shattered"], pegasus_conf="high"), marengo_score=0.05)
    assert out["combined_confidence"] == "low"
    assert out["needs_human_review"] is True  # critical + low conf -> review


def test_combined_confidence_medium_default():
    out = score_finding(_parsed(defects=["shattered"], pegasus_conf="medium"), marengo_score=0.15)
    assert out["combined_confidence"] == "medium"


def test_cracked_porcelain_is_critical():
    out = score_finding(_parsed(defects=["cracked porcelain disk", "burn mark"]), marengo_score=0.20)
    assert out["severity"] == "critical"


def test_class_other_flags_human_review():
    out = score_finding(
        _parsed(component_type="tower", condition="damaged", defects=[]),
        marengo_score=0.8,
    )
    assert out["class"] == "other"
    assert out["needs_human_review"] is True


def test_345kv_uses_different_mvcd():
    out_230 = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=4.2),
        marengo_score=0.8, voltage_class="230kV",
    )
    out_345 = score_finding(
        _parsed(component_type="vegetation", condition="damaged", distance=4.2),
        marengo_score=0.8, voltage_class="345kV",
    )
    assert out_230["severity"] == "high"      # 4.2 > 4.0 MVCD
    assert out_345["severity"] == "critical"  # 4.2 < 4.3 MVCD
