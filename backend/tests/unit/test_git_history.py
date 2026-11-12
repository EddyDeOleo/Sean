"""Historical retrieval tests (Tasks 5.1 to 5.4) against temporary repositories."""

from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from app.modules.evidence.contract import RelationshipBasis, RelationshipKind, SourceType, SourceVerification
from app.modules.git_history.history import (
    COMPLETE,
    LIMIT_CO_CHANGED_ONLY,
    LIMIT_COMMIT_SCAN,
    LIMIT_HEURISTIC_RENAME,
    LIMIT_SHALLOW_CLONE,
    LIMIT_SYMBOL_FILE_LEVEL,
    PARTIAL,
    retrieve_history,
    shallow_clone,
)
from app.modules.repository.paths import PathError

REPOSITORY_ID = "sample"


def _commit_shas(result) -> set[str]:
    return {item.commit_hash for item in result.items if item.source_type is SourceType.GIT_COMMIT}


def test_commits_touching_a_file_are_verified_git_evidence(make_repo) -> None:
    """Task 5.1: each commit that changed the file becomes GIT_COMMIT evidence, verified from Git."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    first = repo.commit("first")
    repo.write("src/a.py", "x = 2\n")
    second = repo.commit("second")

    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py")

    assert result.status == COMPLETE
    assert _commit_shas(result) == {first, second}
    for item in result.items:
        assert item.integrity.source_verification is SourceVerification.VERIFIED_IN_REPOSITORY
        assert item.relationship.kind is RelationshipKind.TOUCHES_TARGET_PATH
        assert item.relationship.basis is RelationshipBasis.VERIFIED
        assert LIMIT_HEURISTIC_RENAME in item.limitations


def test_history_follows_a_rename_and_marks_it_heuristic(make_repo) -> None:
    """Task 5.1 (renames) and 5.3 (heuristic label): commits from before the rename are included."""
    repo = make_repo()
    repo.write("old.py", "print(1)\n")
    before = repo.commit("create")
    (repo.path / "old.py").rename(repo.path / "new.py")
    repo.git("add", "-A")
    renamed = repo.commit("rename", paths=None)

    result = retrieve_history(repo.path, REPOSITORY_ID, "new.py")

    assert {before, renamed} <= _commit_shas(result)
    assert LIMIT_HEURISTIC_RENAME in result.limitations


def test_deletion_is_part_of_history(make_repo) -> None:
    """Task 5.1 (deletions where history permits): the deleting commit is retrieved."""
    repo = make_repo()
    repo.write("gone.py", "x = 1\n")
    repo.commit("create")
    (repo.path / "gone.py").unlink()
    deleting = repo.commit("delete")

    result = retrieve_history(repo.path, REPOSITORY_ID, "gone.py")

    assert deleting in _commit_shas(result)


def test_co_changed_documentation_is_inferred_not_verified_content(make_repo) -> None:
    """Task 5.4: a document changed in the same commit becomes DOCUMENTATION evidence with an INFERRED relation."""
    repo = make_repo()
    repo.write("README.md", "readme\n")
    repo.commit("readme alone")
    repo.write("src/a.py", "x = 1\n")
    repo.write("docs/guide.md", "guide\n")
    repo.commit("code and guide")
    repo.write("src/a.py", "x = 2\n")
    repo.write("docs/guide.md", "guide v2\n")
    co_changed = repo.commit("change code and guide")
    repo.write("README.md", "readme v2\n")
    repo.commit("readme only")

    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py")
    docs = [item for item in result.items if item.source_type is SourceType.DOCUMENTATION]

    assert {item.file_path for item in docs} == {"docs/guide.md"}
    doc = next(item for item in docs if item.commit_hash == co_changed)
    assert doc.relationship.kind is RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET
    assert doc.relationship.basis is RelationshipBasis.INFERRED
    assert LIMIT_CO_CHANGED_ONLY in doc.limitations


def test_no_documentation_is_claimed_when_none_changed(make_repo) -> None:
    """Task 5.4: no documentation evidence is produced when no document changed with the target."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("code only")

    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py")

    assert not [item for item in result.items if item.source_type is SourceType.DOCUMENTATION]


def test_symbol_target_is_recorded_as_file_level_history(make_repo) -> None:
    """Symbol targets use file history. The limitation says so."""
    repo = make_repo()
    repo.write("src/a.py", "def f():\n    return 1\n")
    repo.commit("create")

    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py", symbol="f")

    assert LIMIT_SYMBOL_FILE_LEVEL in result.limitations


def test_commit_scan_limit_makes_the_result_partial(make_repo) -> None:
    """Requirement 15 and 20.2: reading stops at the scan limit, and the result is PARTIAL."""
    repo = make_repo()
    for number in range(3):
        repo.write("src/a.py", f"x = {number}\n")
        repo.commit(f"change {number}")

    result = retrieve_history(repo.path, REPOSITORY_ID, "src/a.py", scan_limit=2)

    assert result.status == PARTIAL
    assert LIMIT_COMMIT_SCAN in result.limitations
    assert len(_commit_shas(result)) == 2


def test_shallow_clone_is_detected_and_capped_at_partial(make_repo, tmp_path: Path) -> None:
    """Task 5.2: a shallow clone adds SHALLOW_CLONE and caps the status at PARTIAL."""
    source = make_repo()
    source.write("src/a.py", "x = 1\n")
    source.commit("one")
    source.write("src/a.py", "x = 2\n")
    source.commit("two")
    clone_path = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "-q", "--depth", "1", source.path.as_uri(), str(clone_path)],
        check=True,
        capture_output=True,
    )

    assert shallow_clone(clone_path) is True
    result = retrieve_history(clone_path, REPOSITORY_ID, "src/a.py")
    assert result.status == PARTIAL
    assert LIMIT_SHALLOW_CLONE in result.limitations


def test_full_repository_is_not_reported_as_shallow(make_repo) -> None:
    """Task 5.2 (negative): an ordinary repository is not shallow."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("one")

    assert shallow_clone(repo.path) is False


@pytest.mark.parametrize("path", ["../outside.py", "/abs.py", "C:/x.py", "a/../b.py"])
def test_invalid_paths_fail_before_any_history_call(make_repo, path: str) -> None:
    """Task 2.1 input rules apply before Git is called."""
    repo = make_repo()
    with pytest.raises(PathError):
        retrieve_history(repo.path, REPOSITORY_ID, path)
