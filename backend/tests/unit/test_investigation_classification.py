"""Epistemic classification tests (Task 11.1, 11.2; Requirement 7), using items from the Task 5 code."""

from __future__ import annotations

import pytest

from app.modules.evidence.contract import SourceType, SourceVerification
from app.modules.evidence.models import IntegrityRecord
from app.modules.git_history.history import retrieve_history
from app.modules.investigation.classification import (
    Classification,
    RetrievalStatus,
    classify,
    is_inferred_support,
    is_verified_support,
    supporting_items,
)


@pytest.fixture
def commit_items(make_repo):
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("create")
    return retrieve_history(repo.path, "sample", "src/a.py").items


def _served_from_cache(item):
    """The same record, marked as cache-served and NOT_PERFORMED. Classification must not count it."""
    return item.model_copy(
        update={
            "integrity": IntegrityRecord(
                retrieved_at=item.integrity.retrieved_at,
                served_from_cache=True,
                source_verification=SourceVerification.NOT_PERFORMED,
                content_digest=None,
            )
        }
    )


def test_verified_commit_is_verified_support(commit_items) -> None:
    commits = [item for item in commit_items if item.source_type is SourceType.GIT_COMMIT]
    assert commits and all(is_verified_support(item) for item in commits)
    assert not any(is_inferred_support(item) for item in commits)


def test_cache_served_record_is_never_support(commit_items) -> None:
    """Cached records are NOT_PERFORMED and do not establish a classification alone (Task 10 rule, Requirement 17)."""
    cached = [_served_from_cache(item) for item in commit_items]
    assert not any(is_verified_support(item) for item in cached)
    assert supporting_items(cached) == ()


def test_verified_support_on_complete_retrieval_is_documented(commit_items) -> None:
    assert classify(RetrievalStatus.COMPLETE, commit_items) is Classification.DOCUMENTED


def test_verified_support_on_partial_retrieval_is_partial_evidence(commit_items) -> None:
    assert classify(RetrievalStatus.PARTIAL, commit_items) is Classification.PARTIAL_EVIDENCE


def test_verified_support_on_insufficient_retrieval_is_partial_evidence(commit_items) -> None:
    assert classify(RetrievalStatus.INSUFFICIENT, commit_items) is Classification.PARTIAL_EVIDENCE


def test_failed_retrieval_has_no_classification(commit_items) -> None:
    """Requirement 9.2: a failed retrieval is never assigned a classification."""
    assert classify(RetrievalStatus.FAILED, commit_items) is None


def test_no_evidence_is_insufficient_evidence_not_documented() -> None:
    """Absence of evidence is not evidence of absence, and it does not become a documented fact."""
    assert classify(RetrievalStatus.COMPLETE, ()) is Classification.INSUFFICIENT_EVIDENCE
    assert classify(RetrievalStatus.PARTIAL, ()) is Classification.INSUFFICIENT_EVIDENCE


def test_only_cached_evidence_is_insufficient_not_documented(commit_items) -> None:
    cached = [_served_from_cache(item) for item in commit_items]
    assert classify(RetrievalStatus.COMPLETE, cached) is Classification.INSUFFICIENT_EVIDENCE
