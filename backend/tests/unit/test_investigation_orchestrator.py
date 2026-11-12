"""Investigation orchestration integration tests (I5), over temporary Git repositories and a real registry entry.

These tests exercise the registry, path and symbol validation, symbol resolution, history, blame, ranking, classification,
result assembly, and explanation together.
"""

from __future__ import annotations

import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.core.git_runner import GIT_TIMEOUT, GitError
from app.modules.evidence.contract import SourceType
from app.modules.explanation.templates import ExplanationInput, explain
from app.modules.investigation import orchestrator
from app.modules.investigation.classification import Classification, RetrievalStatus
from app.modules.investigation.orchestrator import RequestError, investigate
from app.modules.repository.registry import LoadedRegistry, RegistryEntry

MOMENT = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)
REPOSITORY_ID = "sample"


def _registry(root: Path) -> LoadedRegistry:
    return LoadedRegistry(
        entries={REPOSITORY_ID: RegistryEntry(repository_id=REPOSITORY_ID, root=str(root))},
        problems=(),
    )


def _limitation_codes(result) -> set[str]:
    return {limitation.code for limitation in result.limitations}


@pytest.fixture
def repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.commit("change target")
    return fixture


def test_documented_investigation_for_a_symbol(repo) -> None:
    result = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", symbol="target", retrieved_at=MOMENT)

    assert result.retrieval_status is RetrievalStatus.COMPLETE
    assert result.epistemic_classification is Classification.DOCUMENTED
    assert result.conclusion and "commit(s) that changed src/a.py" in result.conclusion
    assert result.target.resolution == "RESOLVED"
    kinds = {item.source_type for item in result.evidence}
    assert SourceType.GIT_COMMIT in kinds and SourceType.GIT_BLAME in kinds
    assert "ASSOCIATION_NOT_IMPLEMENTED" in _limitation_codes(result)
    assert result.ranking and all(entry.score >= 0 for entry in result.ranking)
    assert len(result.source_references) == len(result.evidence)
    assert "why" in result.explanation.lower()


def test_evidence_is_ordered_by_the_ranking(repo) -> None:
    result = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", symbol="target", retrieved_at=MOMENT)
    scores = [entry.score for entry in result.ranking]
    assert scores == sorted(scores, reverse=True)


def test_file_without_symbol_is_investigated_at_file_level(repo) -> None:
    result = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.COMPLETE
    assert result.target.resolution == "NOT_REQUESTED"
    assert result.epistemic_classification is Classification.DOCUMENTED


def test_symbol_absent_from_head_falls_back_to_history(repo) -> None:
    """Task 4.2: NOT_IN_CURRENT_STATE does not stop the history search."""
    result = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", symbol="gone", retrieved_at=MOMENT)
    assert result.target.resolution == "NOT_IN_CURRENT_STATE"
    assert result.retrieval_status is RetrievalStatus.COMPLETE
    assert result.epistemic_classification is Classification.DOCUMENTED


def test_unknown_repository_is_a_request_error(repo) -> None:
    with pytest.raises(RequestError) as raised:
        investigate(_registry(repo.path), "missing", "src/a.py", retrieved_at=MOMENT)
    assert raised.value.code == "REPOSITORY_NOT_FOUND"


@pytest.mark.parametrize("path", ["../outside.py", "/abs.py", "a/../b.py"])
def test_invalid_path_is_a_request_error_before_any_git_call(repo, path: str) -> None:
    with pytest.raises(RequestError) as raised:
        investigate(_registry(repo.path), REPOSITORY_ID, path, retrieved_at=MOMENT)
    assert raised.value.code == "INVALID_INPUT"


def test_invalid_symbol_is_a_request_error(repo) -> None:
    with pytest.raises(RequestError) as raised:
        investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", symbol="bad\nname", retrieved_at=MOMENT)
    assert raised.value.code == "INVALID_INPUT"


def test_ambiguous_symbol_returns_request_error_with_candidates(make_repo) -> None:
    """C-D10: ambiguity is a request-level error with candidates, never a non-failed result."""
    fixture = make_repo()
    fixture.write("src/a.py", "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n")
    fixture.commit("two runs")
    with pytest.raises(RequestError) as raised:
        investigate(_registry(fixture.path), REPOSITORY_ID, "src/a.py", symbol="run", retrieved_at=MOMENT)
    assert raised.value.code == "TARGET_AMBIGUOUS"
    assert raised.value.candidates == ("A.run", "B.run")


def test_parse_failure_at_head_is_a_request_error(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/a.py", "def broken(:\n")
    fixture.commit("broken")
    with pytest.raises(RequestError) as raised:
        investigate(_registry(fixture.path), REPOSITORY_ID, "src/a.py", symbol="broken", retrieved_at=MOMENT)
    assert raised.value.code == "TARGET_PARSE_FAILED"


def test_no_history_is_insufficient_not_documented(make_repo) -> None:
    """Absence of retrieved history is not a documented absence. It is insufficient evidence with a limitation."""
    fixture = make_repo()
    fixture.write("other.py", "x = 1\n")
    fixture.commit("unrelated")
    result = investigate(_registry(fixture.path), REPOSITORY_ID, "src/never.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.INSUFFICIENT
    assert result.epistemic_classification is Classification.INSUFFICIENT_EVIDENCE
    assert result.conclusion is None
    assert "NO_HISTORY_RETRIEVED" in _limitation_codes(result)


def test_shallow_clone_caps_the_status_at_partial(repo, tmp_path: Path) -> None:
    """Task 5.2: a shallow clone is PARTIAL with SHALLOW_CLONE, and the evidence is still classified."""
    clone = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1", repo.path.as_uri(), str(clone)], check=True, capture_output=True
    )
    result = investigate(_registry(clone), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.PARTIAL
    assert "SHALLOW_CLONE" in _limitation_codes(result)
    assert result.epistemic_classification is Classification.PARTIAL_EVIDENCE
    assert result.conclusion is not None


def test_git_failure_is_a_category_a_failed_result(repo, monkeypatch) -> None:
    """Requirement 9.2: a retrieval failure is FAILED, with no classification, no conclusion, and no evidence."""

    def fail(*args, **kwargs):
        raise GitError(GIT_TIMEOUT)

    monkeypatch.setattr(orchestrator, "retrieve_history", fail)
    result = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.FAILED
    assert result.epistemic_classification is None
    assert result.conclusion is None and result.explanation is None
    assert result.evidence == ()
    assert result.error is not None and result.error.code == GIT_TIMEOUT
    assert result.error.retryable is True


def test_failed_explanation_is_none() -> None:
    failed = ExplanationInput(
        classification=None,
        retrieval_status="FAILED",
        target_path="src/a.py",
        symbol=None,
        verified_commit_count=0,
        verified_blame_ranges=0,
        co_changed_document_count=0,
        limitation_messages=(),
    )
    assert explain(failed) is None


def test_investigation_ids_are_unique_per_response(repo) -> None:
    first = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    second = investigate(_registry(repo.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert first.investigation_id != second.investigation_id
    assert len(first.investigation_id) == 36
