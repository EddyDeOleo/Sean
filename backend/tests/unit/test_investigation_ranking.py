"""Deterministic ranking tests (Tasks 8.1 to 8.3; Requirement 6), using items produced by the Task 5 and Task 6 code."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.modules.evidence.contract import SourceType, SourceVerification
from app.modules.evidence.models import EvidenceItem, IntegrityRecord
from app.modules.git_history.blame import blame_range
from app.modules.git_history.history import retrieve_history
from app.modules.investigation.ranking import (
    CODE_REGION,
    COMMIT_MESSAGE,
    CRITERIA,
    DEFAULT_WEIGHTS,
    EXACT_SYMBOL_OR_PATH,
    HISTORICAL_ROLE,
    PULL_REQUEST_OR_ISSUE,
    REPOSITORY_CONTEXT,
    TEMPORAL,
    RankingTarget,
    awarded_criteria,
    rank,
    validate_weights,
)

REPOSITORY_ID = "sample"
MOMENT = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)


def _pull_request(number: int) -> EvidenceItem:
    """A validated PULL_REQUEST item with only its required fields and explicit markers."""
    return EvidenceItem(
        repository_namespace=REPOSITORY_ID,
        source_type=SourceType.PULL_REQUEST,
        source_id=str(number),
        retrieval_method="fixture",
        limitations=(),
        integrity=IntegrityRecord(
            retrieved_at=MOMENT,
            served_from_cache=False,
            source_verification=SourceVerification.VALIDATED_RECORD_IDENTITY,
            content_digest=None,
        ),
        source_url=None,
        commit_hash=None,
        revision=None,
        change_side=None,
        file_path=None,
        line_range=None,
        author=None,
        timestamp=MOMENT,
        event_timestamps=None,
        title=None,
        excerpt=None,
        relationship=None,
        unavailable_fields=frozenset(
            {"source_url", "commit_hash", "author", "title", "excerpt", "relationship", "event_timestamps"}
        ),
        verified_absent_fields=frozenset(),
    )


@pytest.fixture
def history_items(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "def target():\n    return 1\n")
    repo.commit("add target")
    repo.write("docs/guide.md", "guide\n")
    repo.write("src/a.py", "def target():\n    return 2\n")
    repo.commit("target returns two and guide")
    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py")
    return repo, result.items


def test_default_weights_are_the_spec_values_and_total_one_hundred() -> None:
    """Spec 1 §9 initial weights (25, 20, 20, 15, 10, 5, 5)."""
    assert DEFAULT_WEIGHTS == {
        EXACT_SYMBOL_OR_PATH: 25,
        CODE_REGION: 20,
        HISTORICAL_ROLE: 20,
        COMMIT_MESSAGE: 15,
        PULL_REQUEST_OR_ISSUE: 10,
        REPOSITORY_CONTEXT: 5,
        TEMPORAL: 5,
    }
    assert sum(DEFAULT_WEIGHTS.values()) == 100


def test_commit_items_earn_exact_path_and_historical_role(history_items) -> None:
    """Verified TOUCHES relations to the exact path award exact-path and historical role. Missing region gives none."""
    _repo, items = history_items
    target = RankingTarget(path="src/a.py")
    for item in items:
        if item.source_type is SourceType.GIT_COMMIT:
            awards = awarded_criteria(item, target)
            assert EXACT_SYMBOL_OR_PATH in awards
            assert HISTORICAL_ROLE in awards
            assert CODE_REGION not in awards


def test_commit_title_containing_the_symbol_earns_commit_message(history_items) -> None:
    _repo, items = history_items
    target = RankingTarget(path="src/a.py", symbol="target")
    titled = [item for item in items if item.source_type is SourceType.GIT_COMMIT and item.title == "add target"]
    assert len(titled) == 1
    assert COMMIT_MESSAGE in awarded_criteria(titled[0], target)


def test_missing_symbol_gives_no_commit_message_award(history_items) -> None:
    """Missing metadata is never positive evidence (Requirement 6.3)."""
    _repo, items = history_items
    target = RankingTarget(path="src/a.py", symbol=None)
    for item in items:
        assert COMMIT_MESSAGE not in awarded_criteria(item, target)


def test_documentation_is_repository_context_and_inferred_relation_is_not_historical(history_items) -> None:
    _repo, items = history_items
    docs = [item for item in items if item.source_type is SourceType.DOCUMENTATION]
    assert docs, "fixture must produce a documentation item"
    target = RankingTarget(path="src/a.py")
    for doc in docs:
        awards = awarded_criteria(doc, target)
        assert REPOSITORY_CONTEXT in awards
        assert HISTORICAL_ROLE not in awards


def test_blame_item_earns_code_region_only_when_the_region_overlaps(make_repo) -> None:
    repo = make_repo()
    repo.write("src/a.py", "one\ntwo\nthree\n")
    commit = repo.commit("only")
    blamed = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 3, revision=commit).items
    assert blamed
    overlapping = RankingTarget(path="src/a.py", region=(2, 2))
    apart = RankingTarget(path="src/a.py", region=(50, 60))
    for item in blamed:
        assert CODE_REGION in awarded_criteria(item, overlapping)
        assert CODE_REGION not in awarded_criteria(item, apart)


def test_pull_request_gets_no_award_until_it_is_validated_as_associated() -> None:
    """No association is implemented, so PR relevance stays at zero unless the caller supplies an associated id."""
    item = _pull_request(42)
    unassociated = RankingTarget(path="src/a.py")
    associated = RankingTarget(path="src/a.py", associated_ids=frozenset({item.evidence_id}))
    assert PULL_REQUEST_OR_ISSUE not in awarded_criteria(item, unassociated)
    assert PULL_REQUEST_OR_ISSUE in awarded_criteria(item, associated)


def test_temporal_is_never_awarded() -> None:
    """Temporal proximity is not causation, and Spec 1 §9 gives no approved reference point."""
    target = RankingTarget(path="src/a.py", symbol="target", region=(1, 9), associated_ids=frozenset())
    assert all(TEMPORAL not in awarded_criteria(item, target) for item in [_pull_request(1)])


def test_scores_are_sums_of_awarded_weights_and_awards_are_retained(history_items) -> None:
    _repo, items = history_items
    target = RankingTarget(path="src/a.py", symbol="target")
    ranked = rank(items, target)
    for entry in ranked:
        assert entry.score == sum(points for _, points in entry.awards)
        assert {criterion for criterion, _ in entry.awards} <= set(CRITERIA)
        assert all(points == DEFAULT_WEIGHTS[criterion] for criterion, points in entry.awards)


def test_ordering_is_score_then_evidence_id_bytes(history_items) -> None:
    _repo, items = history_items
    target = RankingTarget(path="src/a.py", symbol="target")
    ranked = rank(items, target)
    keys = [(-entry.score, entry.evidence_id.encode("utf-8")) for entry in ranked]
    assert keys == sorted(keys)


def test_ranking_is_independent_of_input_order(history_items) -> None:
    """The same inputs give the same ordering regardless of the order they arrive in (Requirement 6.1)."""
    _repo, items = history_items
    target = RankingTarget(path="src/a.py", symbol="target")
    forward = [entry.evidence_id for entry in rank(items, target)]
    backward = [entry.evidence_id for entry in rank(list(reversed(items)), target)]
    assert forward == backward


def test_equal_scores_break_ties_by_utf8_evidence_id() -> None:
    first, second = _pull_request(1), _pull_request(2)
    target = RankingTarget(path="x.py", associated_ids=frozenset({first.evidence_id, second.evidence_id}))
    ranked = rank([second, first], target)
    assert [entry.score for entry in ranked] == [10, 10]
    assert [entry.evidence_id for entry in ranked] == sorted(
        [first.evidence_id, second.evidence_id], key=lambda value: value.encode("utf-8")
    )


def test_weights_must_name_exactly_the_criteria() -> None:
    with pytest.raises(ValueError):
        validate_weights({EXACT_SYMBOL_OR_PATH: 1})
    with pytest.raises(ValueError):
        validate_weights({**DEFAULT_WEIGHTS, "unknown": 1})


@pytest.mark.parametrize("bad", [-1, True, 1.5, "10"])
def test_weight_values_must_be_non_negative_integers(bad) -> None:
    with pytest.raises(ValueError):
        validate_weights({**DEFAULT_WEIGHTS, CODE_REGION: bad})


def test_configured_weights_change_the_score() -> None:
    first = _pull_request(1)
    target = RankingTarget(path="x.py", associated_ids=frozenset({first.evidence_id}))
    doubled = {**DEFAULT_WEIGHTS, PULL_REQUEST_OR_ISSUE: 20}
    assert rank([first], target)[0].score == 10
    assert rank([first], target, doubled)[0].score == 20
