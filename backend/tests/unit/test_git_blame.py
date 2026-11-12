"""Blame tests (Tasks 6.1 to 6.3) against temporary repositories and one synthetic porcelain output."""

from __future__ import annotations

import pytest

from app.modules.evidence.contract import RelationshipKind, SourceType
from app.modules.evidence.identity import blame_source_id
from app.modules.git_history import blame as blame_module
from app.modules.git_history.blame import (
    LIMIT_UNCOMMITTED_LINES,
    PATH_NOT_FOUND,
    REVISION_NOT_FOUND,
    BlameError,
    blame_range,
    parse_porcelain,
    resolve_revision,
)
from app.modules.symbol_resolution.validation import InvalidInput

REPOSITORY_ID = "sample"


def _head(repo) -> str:
    return repo.git("rev-parse", "HEAD").strip()


def test_blame_at_full_commit_name_attributes_each_line_range(make_repo) -> None:
    """Task 6.1: blame at a full object name returns GIT_BLAME items with that revision and their line ranges."""
    repo = make_repo()
    repo.write("src/a.py", "one\ntwo\nthree\n")
    first = repo.commit("first")
    repo.write("src/a.py", "one\nTWO\nthree\n")
    second = repo.commit("second")

    result = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 3, revision=second)

    assert result.revision == second
    by_range = {(item.line_range.start, item.line_range.end): item for item in result.items}
    assert by_range[(1, 1)].commit_hash == first
    assert by_range[(2, 2)].commit_hash == second
    assert by_range[(3, 3)].commit_hash == first
    for item in result.items:
        assert item.source_type is SourceType.GIT_BLAME
        assert item.revision == second
        assert item.relationship.kind is RelationshipKind.BLAMES_TARGET_LINES
        assert item.author == "Ada Example"
        assert item.source_id == blame_source_id(second, "src/a.py", item.line_range.start, item.line_range.end)


def test_omitted_revision_defaults_to_head_and_is_recorded_as_full_name(make_repo) -> None:
    """Task 6.1: when the revision is omitted, HEAD is resolved to its full object name."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    head = repo.commit("only")

    result = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 1)

    assert result.revision == head
    assert all(item.revision == head for item in result.items)


@pytest.mark.parametrize(
    "revision",
    ["HEAD", "main", "abc1234", "HEAD~1", "a..b", "@{u}", ":/text", "-x", "v1.0", "A" * 40, "g" * 40, ""],
    ids=[
        "head", "branch", "short", "parent", "range", "upstream", "search", "option", "tag", "uppercase", "non-hex",
        "empty",
    ],
)
def test_non_full_revisions_are_rejected_before_git(make_repo, revision: str) -> None:
    """Task 6.2: only full lowercase SHA-1 or SHA-256 names are accepted."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("only")
    with pytest.raises(BlameError) as raised:
        resolve_revision(repo.path, revision)
    assert str(raised.value) == "INVALID_INPUT"


def test_full_name_that_is_not_in_the_repository_is_reported(make_repo) -> None:
    """Task 6.2: a well-formed full name that Git does not know gives REVISION_NOT_FOUND."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("only")
    with pytest.raises(BlameError) as raised:
        resolve_revision(repo.path, "0123456789abcdef0123456789abcdef01234567")
    assert str(raised.value) == REVISION_NOT_FOUND


def test_tree_name_is_not_a_commit(make_repo) -> None:
    """Task 6.2: a tree object name is rejected as not a commit."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("only")
    tree = repo.git("rev-parse", "HEAD^{tree}").strip()
    with pytest.raises(BlameError) as raised:
        resolve_revision(repo.path, tree)
    assert str(raised.value) == REVISION_NOT_FOUND


def test_path_missing_at_the_resolved_commit_is_reported(make_repo) -> None:
    """Task 6.2: a path that is not a file at the commit gives PATH_NOT_FOUND."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    commit = repo.commit("only")
    with pytest.raises(BlameError) as raised:
        blame_range(repo.path, REPOSITORY_ID, "src/missing.py", 1, 1, revision=commit)
    assert str(raised.value) == PATH_NOT_FOUND


@pytest.mark.parametrize(("start", "end"), [(None, 3), (3, None), (3, 1), (0, 1), (True, 2)])
def test_invalid_line_ranges_are_rejected(make_repo, start, end) -> None:
    """Task 2.3: line inputs are validated before any blame call."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("only")
    with pytest.raises(InvalidInput):
        blame_range(repo.path, REPOSITORY_ID, "src/a.py", start, end)


def test_parse_porcelain_reads_author_name_and_ignores_mail() -> None:
    """Porcelain headers: the author name is read, the mail address is not stored."""
    commit = "a" * 40
    output = (
        f"{commit} 1 1 1\n"
        "author Ada Example\n"
        "author-mail <ada@example.invalid>\n"
        "author-time 1700000060\n"
        "summary first\n"
        "\tx = 1\n"
        f"{commit} 2 2\n"
        "\tx = 2\n"
    ).encode()

    lines = parse_porcelain(output)

    assert [line.commit for line in lines] == [commit, commit]
    assert lines[0].author == "Ada Example"
    assert lines[1].author == "Ada Example"
    assert lines[1].author_time == 1700000060


def test_uncommitted_lines_are_a_limitation_and_get_no_commit(make_repo, monkeypatch) -> None:
    """Task 6.3: a line attributed to the all-zero name is reported as a limitation, with no evidence item."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\ny = 2\n")
    commit = repo.commit("only")
    zero = "0" * 40
    synthetic = (
        f"{commit} 1 1 1\nauthor Ada Example\nauthor-time 1700000060\n\tx = 1\n"
        f"{zero} 2 2 1\nauthor Not Committed Yet\nauthor-time 1700000061\n\ty = 2\n"
    ).encode()
    real_run_git = blame_module.run_git

    def fake_run_git(root, subcommand, **keyword_arguments):
        if subcommand == "blame":
            return synthetic
        return real_run_git(root, subcommand, **keyword_arguments)

    monkeypatch.setattr(blame_module, "run_git", fake_run_git)

    result = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 2, revision=commit)

    assert LIMIT_UNCOMMITTED_LINES in result.limitations
    assert [(item.line_range.start, item.line_range.end) for item in result.items] == [(1, 1)]
    assert all(item.commit_hash != zero for item in result.items)


def test_items_do_not_claim_a_relation_beyond_blame(make_repo) -> None:
    """Blame items carry BLAMES_TARGET_LINES only, and never a commit-level change claim."""
    repo = make_repo()
    repo.write("src/a.py", "x = 1\n")
    repo.commit("only")
    result = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 1)
    assert result.items
    assert {item.relationship.kind for item in result.items} == {RelationshipKind.BLAMES_TARGET_LINES}
    assert _head(repo) == result.revision


@pytest.mark.parametrize(("end", "rejected"), [(1999, False), (2000, False), (2001, True)], ids=["1999", "2000", "2001"])
def test_core_blame_span_boundary(make_repo, end: int, rejected: bool) -> None:
    """The core bound is 2000 lines and is enforced in the core itself, not only by the MCP layer.

    A rejected span raises InvalidInput before any Git call. An accepted span may still fail inside Git, because the
    fixture file is short. Only the InvalidInput outcome is asserted for accepted spans.
    """
    from app.core.git_runner import GitError
    from app.modules.git_history.blame import BlameError, blame_range
    from app.modules.symbol_resolution.validation import InvalidInput

    fixture = make_repo()
    fixture.write("src/a.py", "x = 1\n")
    fixture.commit("one line")
    if rejected:
        with pytest.raises(InvalidInput):
            blame_range(fixture.path, "sample", "src/a.py", 1, end)
        return
    try:
        blame_range(fixture.path, "sample", "src/a.py", 1, end)
    except (InvalidInput, BlameError, GitError) as error:
        assert not isinstance(error, InvalidInput), "a span at or under the core bound must not be rejected"
