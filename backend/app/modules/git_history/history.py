"""Historical retrieval for a path or symbol (Tasks 5.1 to 5.4).

Scope and limits:
- Commits are read with git log --follow for the target path. Rename and copy detection is heuristic, and every commit
  item carries that limitation (5.3).
- Symbol targets use file-level history. Commit relevance to the symbol is not established. The result says so.
  Symbol-scoped history (git log -L) is not implemented in this increment.
- A shallow clone adds SHALLOW_CLONE and caps the status at PARTIAL (5.2).
- The number of commits read is bounded by COMMIT_SCAN_LIMIT. Reaching it adds COMMIT_SCAN_LIMIT_REACHED and PARTIAL.
- Documentation evidence (5.4) is documentation files changed in the same commits as the target path. This establishes
  co-change only. It does not establish that the document describes the target, so the relationship is INFERRED.
- Every item has verified integrity only when it came from Git (VERIFIED_IN_REPOSITORY). Missing fields are marked
  unavailable, never presented as absent.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.git_runner import run_git
from app.modules.evidence.contract import (
    RelationshipBasis,
    RelationshipKind,
    SourceType,
    SourceVerification,
)
from app.modules.evidence.identity import documentation_source_id
from app.modules.evidence.models import EvidenceItem, IntegrityRecord, RelationshipRecord
from app.modules.repository.paths import PathError, normalize_target_path
from app.core.limits import COMMIT_SCAN_LIMIT
from app.modules.symbol_resolution.validation import validate_symbol


COMPLETE = "COMPLETE"
PARTIAL = "PARTIAL"

LIMIT_HEURISTIC_RENAME = "HEURISTIC_RENAME_AND_COPY_DETECTION"
LIMIT_SHALLOW_CLONE = "SHALLOW_CLONE"
LIMIT_COMMIT_SCAN = "COMMIT_SCAN_LIMIT_REACHED"
LIMIT_SYMBOL_FILE_LEVEL = "SYMBOL_HISTORY_FILE_LEVEL"
LIMIT_CO_CHANGED_ONLY = "CO_CHANGED_IN_COMMIT_NO_CONTENT_RELATION_VERIFIED"
LIMIT_DOCUMENT_PATH_SKIPPED = "DOCUMENT_PATH_NOT_REPRESENTABLE"

_RETRIEVAL_METHOD = "git log --follow"
_SENTINEL = "@@SEAN-COMMIT@@"
_DOCUMENT_SUFFIXES = (".md", ".rst", ".txt")


@dataclass(frozen=True)
class CommitRecord:
    sha: str
    author: str
    author_time: int
    subject: str


@dataclass(frozen=True)
class HistoryResult:
    status: str
    items: tuple[EvidenceItem, ...]
    limitations: tuple[str, ...]


def shallow_clone(repo_root: Path) -> bool:
    """Return True when the repository is a shallow clone (Task 5.2)."""
    output = run_git(repo_root, "rev-parse", options=["--is-shallow-repository"])
    return output.strip() == b"true"


def _parse_log(output: bytes) -> list[CommitRecord]:
    """Parse one record per line. Fields are separated by NUL, which Git does not allow in names or subjects."""
    records: list[CommitRecord] = []
    for line in output.decode("utf-8", errors="replace").split("\n"):
        if not line.startswith(_SENTINEL):
            continue
        sha, author, author_time, subject = line[len(_SENTINEL) :].split("\x00", 3)
        records.append(CommitRecord(sha=sha, author=author, author_time=int(author_time), subject=subject))
    return records


def _text_or_none(value: str) -> str | None:
    return value if value.strip() else None


def _commit_item(repository_id: str, record: CommitRecord, retrieved_at: datetime) -> EvidenceItem:
    author = _text_or_none(record.author)
    title = _text_or_none(record.subject)
    unavailable = {"source_url", "excerpt"}
    if author is None:
        unavailable.add("author")
    if title is None:
        unavailable.add("title")
    return EvidenceItem(
        repository_namespace=repository_id,
        source_type=SourceType.GIT_COMMIT,
        source_id=record.sha,
        retrieval_method=_RETRIEVAL_METHOD,
        limitations=(LIMIT_HEURISTIC_RENAME,),
        integrity=IntegrityRecord(
            retrieved_at=retrieved_at,
            served_from_cache=False,
            source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
            content_digest=None,
        ),
        source_url=None,
        commit_hash=record.sha,
        revision=None,
        change_side=None,
        file_path=None,
        line_range=None,
        author=author,
        timestamp=datetime.fromtimestamp(record.author_time, UTC),
        event_timestamps=None,
        title=title,
        excerpt=None,
        relationship=RelationshipRecord(kind=RelationshipKind.TOUCHES_TARGET_PATH, basis=RelationshipBasis.VERIFIED),
        unavailable_fields=frozenset(unavailable),
        verified_absent_fields=frozenset(),
    )


def _is_documentation(path: str, target: str) -> bool:
    if path == target:
        return False
    return path.lower().endswith(_DOCUMENT_SUFFIXES) or path.startswith("docs/")


def _documentation_item(repository_id: str, record: CommitRecord, path: str, retrieved_at: datetime) -> EvidenceItem:
    author = _text_or_none(record.author)
    title = _text_or_none(record.subject)
    unavailable = {"source_url", "excerpt"}
    if author is None:
        unavailable.add("author")
    if title is None:
        unavailable.add("title")
    return EvidenceItem(
        repository_namespace=repository_id,
        source_type=SourceType.DOCUMENTATION,
        source_id=documentation_source_id(record.sha, path),
        retrieval_method=_RETRIEVAL_METHOD,
        limitations=(LIMIT_CO_CHANGED_ONLY,),
        integrity=IntegrityRecord(
            retrieved_at=retrieved_at,
            served_from_cache=False,
            source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
            content_digest=None,
        ),
        source_url=None,
        commit_hash=record.sha,
        revision=None,
        change_side=None,
        file_path=path,
        line_range=None,
        author=author,
        timestamp=datetime.fromtimestamp(record.author_time, UTC),
        event_timestamps=None,
        title=title,
        excerpt=None,
        relationship=RelationshipRecord(
            kind=RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET, basis=RelationshipBasis.INFERRED
        ),
        unavailable_fields=frozenset(unavailable),
        verified_absent_fields=frozenset(),
    )


def retrieve_history(
    repo_root: Path,
    repository_id: str,
    path: str,
    *,
    symbol: str | None = None,
    scan_limit: int = COMMIT_SCAN_LIMIT,
    retrieved_at: datetime | None = None,
) -> HistoryResult:
    """Return commit and co-changed documentation evidence for a repository-relative path.

    The path is validated with the C.3a rules before any Git call. The symbol, when given, is recorded as a limitation
    because history is file-level.
    """
    target = normalize_target_path(path)
    moment = retrieved_at or datetime.now(UTC).replace(microsecond=0)
    limitations = [LIMIT_HEURISTIC_RENAME]
    if symbol is not None:
        validate_symbol(symbol)
        limitations.append(LIMIT_SYMBOL_FILE_LEVEL)

    output = run_git(
        repo_root,
        "log",
        options=["--follow", f"--format={_SENTINEL}%H%x00%an%x00%at%x00%s", "-n", str(scan_limit + 1)],
        paths=[target],
    )
    records = _parse_log(output)
    complete = True
    if len(records) > scan_limit:
        records = records[:scan_limit]
        limitations.append(LIMIT_COMMIT_SCAN)
        complete = False

    items: list[EvidenceItem] = []
    for record in records:
        items.append(_commit_item(repository_id, record, moment))
    for record in records:
        for file_path in _changed_files(repo_root, record.sha):
            if not _is_documentation(file_path, target):
                continue
            normalized = _normalized_or_none(file_path)
            if normalized is None:
                limitations.append(LIMIT_DOCUMENT_PATH_SKIPPED)
                continue
            items.append(_documentation_item(repository_id, record, normalized, moment))

    if shallow_clone(repo_root):
        limitations.append(LIMIT_SHALLOW_CLONE)
        complete = False

    return HistoryResult(status=COMPLETE if complete else PARTIAL, items=tuple(items), limitations=tuple(limitations))


def _changed_files(repo_root: Path, commit: str) -> tuple[str, ...]:
    """Every file a commit changed, not only the target path.

    git log with a pathspec lists only the matching paths in --name-only output. A per-commit diff-tree call returns the
    full list. -z keeps names unquoted.
    """
    output = run_git(
        repo_root,
        "diff-tree",
        options=["--root", "--no-commit-id", "--name-only", "-r", "-z"],
        revisions=[commit],
    )
    # surrogateescape keeps undecodable bytes visible, so C.3a rejects those names instead of altering them.
    return tuple(name for name in output.decode("utf-8", errors="surrogateescape").split("\0") if name)


def _normalized_or_none(path: str) -> str | None:
    """Return the normalized form of a path reported by Git, or None when it cannot be represented faithfully.

    A backslash in a Git name is a literal character, so it is not translated to a separator here. Such names are skipped.
    """
    if "\\" in path:
        return None
    try:
        return normalize_target_path(path)
    except PathError:
        return None
