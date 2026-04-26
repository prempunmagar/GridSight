"""Severity scoring per docs/05_DOMAIN_KNOWLEDGE.md Section 5."""

# FAC-003-4 Table 2: MVCD in feet, indexed by voltage class then altitude band.
MVCD_TABLE = {
    "230kV": {
        "sea_level_to_500_ft": 4.0,
        "500_to_1000_ft": 4.1,
        "1000_to_2000_ft": 4.2,
        "2000_to_3000_ft": 4.3,
        "3000_to_4000_ft": 4.3,
        "4000_to_5000_ft": 4.4,
    },
    "345kV": {
        "sea_level_to_500_ft": 4.3,
        "500_to_1000_ft": 4.3,
        "1000_to_2000_ft": 4.4,
        "2000_to_3000_ft": 4.5,
        "3000_to_4000_ft": 4.6,
        "4000_to_5000_ft": 4.7,
    },
    "500kV": {
        "sea_level_to_500_ft": 7.0,
        "500_to_1000_ft": 7.1,
        "1000_to_2000_ft": 7.2,
        "2000_to_3000_ft": 7.4,
        "3000_to_4000_ft": 7.5,
        "4000_to_5000_ft": 7.6,
    },
}

CRITICAL_KEYWORDS = [
    "shattered", "missing disk", "missing insulator",
    "crack", "fracture", "broken disk", "broken insulator",
    "sheath split", "fiberglass exposed",
    "extensive burn", "severe burn", "flashover",
]
HIGH_KEYWORDS = [
    "severe corrosion", "rust streak", "burn mark",
    "polymer erosion", "tracking",
    "heavy contamination", "salt crust", "large bird streamer",
]
MODERATE_KEYWORDS = [
    "moderate corrosion", "partial damage",
    "polymer chalking", "moderate contamination", "localized deposit",
    "rust", "corrosion", "discoloration", "weathering", "stain",
    "bird droppings", "bird streamer",
]

# Marengo cosine similarity ranges low (~0.10-0.25 in practice for top matches),
# so the original 0.5/0.7 cutoffs from Master Doc 10.3 collapse everything to "low".
# Recalibrated against observed scores.
MARENGO_HIGH_THRESHOLD = 0.18
MARENGO_LOW_THRESHOLD = 0.10

VEGETATION_CONTACT_KEYWORDS = ["touching", "in contact", "overhanging", "overhang"]


def _class_a_severity(defects: list[str]) -> str:
    blob = " ".join(d.lower() for d in defects)
    if any(k in blob for k in CRITICAL_KEYWORDS):
        return "critical"
    if any(k in blob for k in HIGH_KEYWORDS):
        return "high"
    if any(k in blob for k in MODERATE_KEYWORDS):
        return "moderate"
    return "low"


def _class_b_severity_from_distance(distance_ft: float, mvcd_ft: float) -> str:
    if distance_ft < 1.0 * mvcd_ft:
        return "critical"
    if distance_ft < 2.5 * mvcd_ft:
        return "high"
    if distance_ft < 6.25 * mvcd_ft:
        return "moderate"
    return "no_action"


def _class_b_severity_from_defects(defects: list[str]) -> str:
    blob = " ".join(d.lower() for d in defects)
    if any(k in blob for k in VEGETATION_CONTACT_KEYWORDS):
        return "critical"
    return "low"


def _classify(component_type: str) -> str:
    if component_type == "insulator_string":
        return "insulator_damage"
    if component_type == "vegetation":
        return "vegetation_encroachment"
    return "other"


def _combined_confidence(marengo_score: float, pegasus_confidence: str) -> str:
    if marengo_score >= MARENGO_HIGH_THRESHOLD and pegasus_confidence == "high":
        return "high"
    if marengo_score < MARENGO_LOW_THRESHOLD or pegasus_confidence == "low":
        return "low"
    return "medium"


def _nerc_citation(klass: str, severity: str) -> str | None:
    if klass != "vegetation_encroachment":
        return None
    if severity == "critical":
        return "NERC FAC-003-4 §R2"
    if severity == "high":
        return "NERC FAC-003-4 §R1"
    return None


def score_finding(parsed: dict, marengo_score: float, voltage_class: str = "230kV") -> dict:
    """Map a parsed Pegasus finding to severity, combined confidence, class, and citation."""
    klass = _classify(parsed["component_type"])
    condition = parsed["condition"]
    defects = parsed.get("specific_defects") or []

    if condition == "intact":
        severity = "no_action"
    elif condition == "unclear":
        severity = "low"
    elif klass == "vegetation_encroachment":
        distance_ft = parsed.get("vegetation_distance_estimate_ft")
        if distance_ft is None:
            severity = _class_b_severity_from_defects(defects)
        else:
            mvcd_ft = MVCD_TABLE[voltage_class]["sea_level_to_500_ft"]
            severity = _class_b_severity_from_distance(distance_ft, mvcd_ft)
    elif klass == "insulator_damage":
        severity = _class_a_severity(defects)
    else:
        severity = _class_a_severity(defects)

    combined_confidence = _combined_confidence(marengo_score, parsed["pegasus_confidence"])

    needs_human_review = (
        condition == "unclear"
        or (severity in ("critical", "high") and combined_confidence == "low")
        or klass == "other"
    )

    return {
        "class": klass,
        "severity": severity,
        "combined_confidence": combined_confidence,
        "needs_human_review": needs_human_review,
        "nerc_citation": _nerc_citation(klass, severity),
    }
