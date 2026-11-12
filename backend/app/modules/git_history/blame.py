"""Blame for a path and line range at a revision (Tasks 6.1 to 6.3).

- Task 6.1: the revision is a full SHA-1 (40) or SHA-256 (64) lowercase object name. When it is omitted, HEAD is resolved
  to its full name first. The name is recorded in each item, so the result is reproducible.
- Task 6.2: any other revision value is rejected before any Git call (INVALID_INPUT). A full name that is not a commit in
  the repository gives REVISION_NOT_FOUND. A path that is not a file at the resolved commit gives PATH_NOT_FOUND.
- Task 6.3: lines that have no commit (the all-zero name Git uses for uncommitted content) are reported as a limitation.
  No commit is invented for them. Blame runs at a commit, so this path is reached only if Git reports such lines.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.git_objects import is_full_object_name
from app.core.git_runner import GitError, run_git
from app.modules.evidence.contract import RelationshipBasis, RelationshipKind, SourceType, SourceVerification
from app.modules.evidence.identity import blame_source_id
from app.modules.evidence.models import EvidenceItem, IntegrityRecord, LineRange, RelationshipRecord
from app.modules.git_history.objects import blob_at_revision
from app.modules.repository.paths import normalize_target_path, resolve_contained_path
from app.modules.symbol_resolution.validation import InvalidInput, validate_line_range

INVALID_INPUT = "INVALID_INPUT"
REVISION_NOT_FOUND = "REVISION_NOT_FOUND"
PATH_NOT_FOUND = "PATH_NOT_FOUND"

LIMIT_UNCOMMITTED_LINES = "UNCOMMITTED_LINES_NOT_REPORTED"

_BLAME_METHOD = "git blame --porcelain"


class BlameError(Exception):
    """A caller-facing blame rejection. The message is the error code only."""


@dataclass(frozen=True)
class BlameLine:
    commit: str
    final_line: int
    author: str
    author_time: int


@dataclass(frozen=True)
class BlameResult:
    revision: str
    items: tuple[EvidenceItem, ...]
    limitations: tuple[str, ...]


def resolve_revision(repo_root: Path, revision: str | None) -> str:
    """Return the full object name of the revision, or of HEAD when the revision is omitted (Task 6.1, 6.2)."""
    if revision is None:
        try:
            output = run_git(repo_root, "rev-parse", options=["--verify"], revisions=["HEAD^{commit}"])
        except GitError:
            raise BlameError(REVISION_NOT_FOUND) from None
        return output.decode("ascii").strip()
    if not isinstance(revision, str) or not is_full_object_name(revision):
        raise BlameError(INVALID_INPUT)
    try:
        kind = run_git(repo_root, "cat-file", options=["-t"], revisions=[revision])
    except GitError:
        raise BlameError(REVISION_NOT_FOUND) from None
    if kind.strip() != b"commit":
        raise BlameError(REVISION_NOT_FOUND)
    return revision


def parse_porcelain(output: bytes) -> list[BlameLine]:
    """Parse git blame --porcelain. Author names are read. Mail addresses are ignored."""
    lines = output.decode("utf-8", errors="replace").split("\n")
    authors: dict[str, tuple[str, int]] = {}
    parsed: list[BlameLine] = []
    index = 0
    while index < len(lines):
        header = lines[index].split(" ")
        if len(header) < 3 or not header[0]:
            index += 1
            continue
        commit, final_line = header[0], int(header[2])
        index += 1
        name, when = authors.get(commit, ("", 0))
        while index < len(lines) and not lines[index].startswith("\t"):
            key, _, value = lines[index].partition(" ")
            if key == "author":
                name = value
            elif key == "author-time":
                when = int(value)
            index += 1
        authors[commit] = (name, when)
        parsed.append(BlameLine(commit=commit, final_line=final_line, author=name, author_time=when))
        index += 1
    return parsed


def _runs(lines: list[BlameLine]) -> list[tuple[BlameLine, int, int]]:
    """Group consecutive lines that share a commit and have consecutive line numbers."""
    runs: list[tuple[BlameLine, int, int]] = []
    for line in lines:
        if runs:
            head, start, end = runs[-1]
            if head.commit == line.commit and end + 1 == line.final_line:
                runs[-1] = (head, start, line.final_line)
                continue
        runs.append((line, line.final_line, line.final_line))
    return runs


def _is_uncommitted(commit: str) -> bool:
    return set(commit) == {"0"}


def _blame_item(
    repository_id: str, revision: str, path: str, run: tuple[BlameLine, int, int], retrieved_at: datetime
) -> EvidenceItem:
    line, start, end = run
    author = line.author if line.author.strip() else None
    unavailable = {"source_url", "title", "excerpt"}
    if author is None:
        unavailable.add("author")
    return EvidenceItem(
        repository_namespace=repository_id,
        source_type=SourceType.GIT_BLAME,
        source_id=blame_source_id(revision, path, start, end),
        retrieval_method=_BLAME_METHOD,
        limitations=(),
        integrity=IntegrityRecord(
            retrieved_at=retrieved_at,
            served_from_cache=False,
            source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
            content_digest=None,
        ),
        source_url=None,
        commit_hash=line.commit,
        revision=revision,
        change_side=None,
        file_path=path,
        line_range=LineRange(start=start, end=end),
        author=author,
        timestamp=datetime.fromtimestamp(line.author_time, UTC) if line.author_time else None,
        event_timestamps=None,
        title=None,
        excerpt=None,
        relationship=RelationshipRecord(kind=RelationshipKind.BLAMES_TARGET_LINES, basis=RelationshipBasis.VERIFIED),
        unavailable_fields=frozenset(unavailable | ({"timestamp"} if not line.author_time else set())),
        verified_absent_fields=frozenset(),
    )


def blame_range(
    repo_root: Path,
    repository_id: str,
    path: str,
    line_start: int,
    line_end: int,
    *,
    revision: str | None = None,
    retrieved_at: datetime | None = None,
) -> BlameResult:
    """Blame a path and line range at a revision. Inputs are validated before any blame call."""
    target = normalize_target_path(path)
    # C.3a steps 4 to 7, the same containment check that investigate() applies before any retrieval.
    resolve_contained_path(repo_root, target)
    line_range = validate_line_range(line_start, line_end)
    if line_range is None:
        raise InvalidInput(INVALID_INPUT)
    commit = resolve_revision(repo_root, revision)
    if blob_at_revision(repo_root, commit, target) is None:
        raise BlameError(PATH_NOT_FOUND)
    moment = retrieved_at or datetime.now(UTC).replace(microsecond=0)

    output = run_git(
        repo_root,
        "blame",
        options=["--porcelain", "-L", f"{line_range[0]},{line_range[1]}"],
        revisions=[commit],
        paths=[target],
    )
    parsed = parse_porcelain(output)
    limitations: list[str] = []
    attributed = [line for line in parsed if not _is_uncommitted(line.commit)]
    if len(attributed) != len(parsed):
        limitations.append(LIMIT_UNCOMMITTED_LINES)
    items = tuple(
        _blame_item(repository_id, commit, target, run, moment) for run in _runs(attributed)
    )
    return BlameResult(revision=commit, items=items, limitations=tuple(limitations))
