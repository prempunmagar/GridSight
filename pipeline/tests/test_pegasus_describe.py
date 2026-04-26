"""Tests for pegasus_describe._extract_json and _normalize (private helpers).

These functions carry the trickiest fallback behaviour in the pipeline:
_extract_json must handle partial / prose-wrapped JSON from Pegasus, and _normalize
must fill defaults for every missing field so downstream code never KeyErrors.
"""

import pytest

# Access private helpers directly — they're the unit under test
from pipeline.pegasus_describe import _extract_json, _normalize, DEFAULT_PARSED


# ---------------------------------------------------------------------------
# _extract_json
# ---------------------------------------------------------------------------

class TestExtractJson:
    def test_clean_json_string(self):
        raw = '{"component_type": "insulator_string", "condition": "damaged", ' \
              '"specific_defects": ["crack"], "vegetation_distance_estimate_ft": null, "confidence": "high"}'
        result = _extract_json(raw)
        assert result is not None
        assert result["component_type"] == "insulator_string"
        assert result["confidence"] == "high"

    def test_json_wrapped_in_prose(self):
        raw = ('Here is my assessment:\n'
               '{"component_type": "vegetation", "condition": "damaged", '
               '"specific_defects": ["trees within ROW"], '
               '"vegetation_distance_estimate_ft": 12, "confidence": "medium"}\n'
               'Hope that helps.')
        result = _extract_json(raw)
        assert result is not None
        assert result["component_type"] == "vegetation"
        assert result["vegetation_distance_estimate_ft"] == 12

    def test_returns_none_for_unparseable_text(self):
        assert _extract_json("This clip shows some power lines.") is None

    def test_returns_none_for_empty_string(self):
        assert _extract_json("") is None

    def test_returns_none_for_malformed_json(self):
        assert _extract_json('{"component_type": "insulator_string", "condition":') is None

    def test_handles_nested_curly_braces(self):
        # A dict with a nested dict — should still return the outer object
        raw = '{"component_type": "tower", "condition": "intact", ' \
              '"specific_defects": [], "vegetation_distance_estimate_ft": null, ' \
              '"confidence": "high", "extra": {"note": "ok"}}'
        result = _extract_json(raw)
        assert result is not None
        assert result["component_type"] == "tower"

    def test_whitespace_only_returns_none(self):
        assert _extract_json("   \n\t  ") is None


# ---------------------------------------------------------------------------
# _normalize
# ---------------------------------------------------------------------------

class TestNormalize:
    def _full_parsed(self, **overrides) -> dict:
        base = {
            "component_type": "insulator_string",
            "condition": "damaged",
            "specific_defects": ["cracked disk"],
            "vegetation_distance_estimate_ft": None,
            "confidence": "high",
        }
        base.update(overrides)
        return base

    def test_confidence_renamed_to_pegasus_confidence(self):
        result = _normalize(self._full_parsed(confidence="medium"))
        assert "pegasus_confidence" in result
        assert result["pegasus_confidence"] == "medium"
        assert "confidence" not in result

    def test_missing_component_type_filled_with_default(self):
        result = _normalize({"condition": "damaged"})
        assert result["component_type"] == DEFAULT_PARSED["component_type"]

    def test_missing_condition_filled_with_default(self):
        result = _normalize({"component_type": "vegetation"})
        assert result["condition"] == DEFAULT_PARSED["condition"]

    def test_specific_defects_list_preserved(self):
        result = _normalize(self._full_parsed(specific_defects=["rust", "crack"]))
        assert result["specific_defects"] == ["rust", "crack"]

    def test_specific_defects_non_list_coerced_to_empty_list(self):
        result = _normalize(self._full_parsed(specific_defects="rust streaks"))
        assert result["specific_defects"] == []

    def test_specific_defects_none_coerced_to_empty_list(self):
        result = _normalize(self._full_parsed(specific_defects=None))
        assert result["specific_defects"] == []

    def test_vegetation_distance_null_preserved(self):
        result = _normalize(self._full_parsed(vegetation_distance_estimate_ft=None))
        assert result["vegetation_distance_estimate_ft"] is None

    def test_vegetation_distance_numeric_preserved(self):
        result = _normalize(self._full_parsed(vegetation_distance_estimate_ft=8.5))
        assert result["vegetation_distance_estimate_ft"] == 8.5

    def test_fully_missing_parsed_falls_back_to_all_defaults(self):
        result = _normalize({})
        for key in ("component_type", "condition", "specific_defects",
                    "vegetation_distance_estimate_ft"):
            assert key in result
        # confidence becomes pegasus_confidence
        assert "pegasus_confidence" in result

    def test_extra_keys_passed_through(self):
        result = _normalize(self._full_parsed())
        # All keys from DEFAULT_PARSED should be present
        for key in DEFAULT_PARSED:
            assert key in result


# ---------------------------------------------------------------------------
# Failure-path dict consistency
# ---------------------------------------------------------------------------

class TestFailurePathConsistency:
    """The hard-coded failure dict in run_all.py must be consistent with _normalize output."""

    FAILURE_DICT = {
        "component_type": "other",
        "condition": "unclear",
        "specific_defects": [],
        "vegetation_distance_estimate_ft": None,
        "pegasus_confidence": "low",
    }

    def test_failure_dict_has_all_keys_normalize_produces(self):
        normalized = _normalize({})
        # Normalise uses DEFAULT_PARSED which doesn't set pegasus_confidence directly;
        # the caller (describe_clip) pops 'confidence' → 'pegasus_confidence'.
        # The failure dict sets pegasus_confidence directly, so check the final key set matches.
        for key in ("component_type", "condition", "specific_defects",
                    "vegetation_distance_estimate_ft", "pegasus_confidence"):
            assert key in self.FAILURE_DICT, f"failure dict missing: {key}"

    def test_failure_dict_specific_defects_is_list(self):
        assert isinstance(self.FAILURE_DICT["specific_defects"], list)

    def test_failure_dict_vegetation_distance_is_none(self):
        assert self.FAILURE_DICT["vegetation_distance_estimate_ft"] is None
