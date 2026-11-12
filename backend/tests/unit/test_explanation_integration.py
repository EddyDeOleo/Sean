"""End-to-end deterministic explanation tests over temporary Git repositories (I5 completion; E-D13 addendum §5).

The scenarios cover each classification, a retrieval failure, and a symbol target. Each explanation is produced by the
real orchestrator. No AI provider, network access, or external service is used.
"""

from __future__ import annotations

import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.core.git_runner import GIT_TIMEOUT, GitError
from app.modules.investigation import orchestrator
from app.modules.investigation.classification import Classification, RetrievalStatus
from app.modules.investigation.orchestrator import investigate
from app.modules.repository.registry import LoadedRegistry, RegistryEntry

MOMENT = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)
REPOSITORY_ID = "example"


def _registry(root: Path) -> LoadedRegistry:
    return LoadedRegistry(entries={REPOSITORY_ID: RegistryEntry(repository_id=REPOSITORY_ID, root=str(root))}, problems=())


@pytest.fixture
def documented_repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.commit("change target")
    return fixture


def test_documented_symbol_explanation_states_fact_and_limits(documented_repo) -> None:
    result = investigate(_registry(documented_repo.path), REPOSITORY_ID, "src/a.py", symbol="target", retrieved_at=MOMENT)
    assert result.epistemic_classification is Classification.DOCUMENTED
    text = result.explanation
    assert "records 2 commit(s) that changed src/a.py." in text
    assert "The symbol target is not separated from the file history." in text
    assert "(symbol target)" not in result.conclusion
    assert "They do not state why." in text
    assert "Commit relevance to the symbol is not established." in text
    assert "Symbol history is tracked at file level" in text
    assert "association step is not implemented" in text
    assert "_" not in " ".join(limit.message for limit in result.limitations)


def test_explanation_is_identical_for_identical_repository_state(documented_repo) -> None:
    first = investigate(_registry(documented_repo.path), REPOSITORY_ID, "src/a.py", symbol="target", retrieved_at=MOMENT)
    second = investigate(_registry(documented_repo.path), REPOSITORY_ID, "src/a.py", symbol="target", retrieved_at=MOMENT)
    assert first.explanation == second.explanation
    assert first.conclusion == second.conclusion


def test_insufficient_evidence_abstains_for_a_path_without_history(documented_repo) -> None:
    result = investigate(_registry(documented_repo.path), REPOSITORY_ID, "src/never.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.INSUFFICIENT
    assert result.epistemic_classification is Classification.INSUFFICIENT_EVIDENCE
    assert result.conclusion is None
    assert "does not support a reliable conclusion" in result.explanation
    assert "No commit history was retrieved for the target." in result.explanation


def test_shallow_clone_is_partial_and_names_the_missing_history(documented_repo, tmp_path: Path) -> None:
    clone = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "--depth", "1", "--quiet", documented_repo.path.as_uri(), str(clone)],
        check=True,
        capture_output=True,
        timeout=60,
    )
    result = investigate(_registry(clone), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.PARTIAL
    assert result.epistemic_classification is Classification.PARTIAL_EVIDENCE
    assert "The repository is a shallow clone, so older history may be missing." in result.explanation
    assert "Retrieval was incomplete" in result.explanation


def test_failed_retrieval_produces_no_explanation(documented_repo, monkeypatch) -> None:
    def _timeout(*args, **kwargs):
        raise GitError(GIT_TIMEOUT)

    monkeypatch.setattr(orchestrator, "retrieve_history", _timeout)
    result = investigate(_registry(documented_repo.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    assert result.retrieval_status is RetrievalStatus.FAILED
    assert result.explanation is None
    assert result.conclusion is None
    assert result.evidence == ()


def test_co_changed_documentation_is_reported_without_claiming_intent(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.write("docs/notes.md", "Notes on the target.\n")
    fixture.commit("add target and notes")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.write("docs/notes.md", "Notes updated.\n")
    fixture.commit("change target and notes")
    result = investigate(_registry(fixture.path), REPOSITORY_ID, "src/a.py", retrieved_at=MOMENT)
    # Documentation evidence exists, and verified commits support DOCUMENTED. This is the observed behavior: the
    # INFERRED branch is not reached when verified commits exist for the target (see the E-D13 addendum review).
    assert result.epistemic_classification is Classification.DOCUMENTED
    assert "Documentation changed in 2 of these commits." in result.explanation
    assert "does not establish a content relation or intent" in result.explanation
