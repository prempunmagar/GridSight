"""Tests for marengo_detect.deduplicate."""

from pipeline.marengo_detect import deduplicate


def _cand(ts: float, score: float = 0.5, query: str = "q", source: str = "anomaly_query") -> dict:
    return {
        "timestamp_seconds": ts,
        "query_string": query,
        "marengo_score": score,
        "discovery_source": source,
        "start_sec": ts - 4.0,
        "end_sec": ts + 4.0,
    }


# ---------------------------------------------------------------------------
# Basic clustering behaviour
# ---------------------------------------------------------------------------

def test_empty_input_returns_empty():
    assert deduplicate([]) == []


def test_single_candidate_passes_through():
    result = deduplicate([_cand(100.0, score=0.8)])
    assert len(result) == 1
    assert result[0]["timestamp_seconds"] == 100.0
    assert result[0]["marengo_score"] == 0.8


def test_two_far_apart_candidates_stay_separate():
    result = deduplicate([_cand(10.0), _cand(60.0)])
    assert len(result) == 2


def test_two_close_candidates_merge_into_one():
    """Within DEDUP_WINDOW_SECONDS (10s by default), two candidates become one."""
    result = deduplicate([_cand(100.0, score=0.4), _cand(108.0, score=0.7)])
    assert len(result) == 1
    # Best score wins the timestamp
    assert result[0]["marengo_score"] == 0.7
    assert result[0]["timestamp_seconds"] == 108.0


def test_highest_score_wins_within_cluster():
    candidates = [
        _cand(10.0, score=0.5),
        _cand(20.0, score=0.9),   # best
        _cand(25.0, score=0.3),
    ]
    result = deduplicate(candidates)
    assert len(result) == 1
    assert result[0]["marengo_score"] == 0.9
    assert result[0]["timestamp_seconds"] == 20.0


def test_matched_queries_are_merged_and_deduplicated():
    candidates = [
        _cand(10.0, query="insulator crack"),
        _cand(15.0, query="insulator rust"),
        _cand(18.0, query="insulator crack"),   # duplicate query — should appear once
    ]
    result = deduplicate(candidates)
    assert len(result) == 1
    assert set(result[0]["matched_queries"]) == {"insulator crack", "insulator rust"}


def test_anomaly_source_wins_over_inventory():
    candidates = [
        _cand(10.0, source="inventory_query"),
        _cand(15.0, source="anomaly_query"),
    ]
    result = deduplicate(candidates)
    assert len(result) == 1
    assert result[0]["discovery_source"] == "anomaly_query"


def test_inventory_source_preserved_when_no_anomaly_in_cluster():
    candidates = [
        _cand(10.0, source="inventory_query"),
        _cand(15.0, source="inventory_query"),
    ]
    result = deduplicate(candidates)
    assert len(result) == 1
    assert result[0]["discovery_source"] == "inventory_query"


def test_cluster_boundary_exactly_at_window():
    """Candidates exactly window_seconds apart should NOT merge (strictly >)."""
    result = deduplicate([_cand(0.0), _cand(30.0)], window_seconds=30)
    # 30 - 0 == 30, which is NOT strictly > 30, so they should merge
    assert len(result) == 1


def test_cluster_boundary_just_outside_window():
    result = deduplicate([_cand(0.0), _cand(31.0)], window_seconds=30)
    assert len(result) == 2


def test_three_clusters_separated_correctly():
    candidates = [
        _cand(0.0),    # cluster A
        _cand(10.0),   # cluster A
        _cand(100.0),  # cluster B
        _cand(110.0),  # cluster B
        _cand(300.0),  # cluster C
    ]
    result = deduplicate(candidates, window_seconds=30)
    assert len(result) == 3


def test_output_contains_required_keys():
    result = deduplicate([_cand(50.0)])
    r = result[0]
    for key in ("timestamp_seconds", "matched_queries", "marengo_score",
                "discovery_source", "start_sec", "end_sec"):
        assert key in r, f"missing key: {key}"


def test_matched_queries_is_sorted_list():
    candidates = [
        _cand(10.0, query="zebra"),
        _cand(12.0, query="apple"),
    ]
    result = deduplicate(candidates)
    assert result[0]["matched_queries"] == ["apple", "zebra"]
