"""Investigation orchestration (I5; design "Components and Interfaces" data flow).

Flow, in order:
1. Resolve the repository from the registry (existing module). Failure is a category B request error.
2. Validate the path, symbol, and line range before any Git call (Task 2.x). Failure is category B.
3. Resolve the symbol at HEAD (Task 4.x). Ambiguity and parse failure are category B (C-D10). Not-in-state gives the
   historical fallback (Task 4.2).
4. Retrieve commit history for the path (Task 5.x). A Git failure gives category A FAILED.
5. Blame the resolved region at HEAD (Task 6.x), when a region exists. Failure adds a limitation and makes the status PARTIAL.
6. Rank the evidence (Task 8.x).
7. Derive the retrieval status, classification (Task 11.x), and deterministic explanation (Task 13.x).
8. Assemble the result and check its invariants (Task 12.x). A violation raises a category C error. No result is returned.

Not in this flow yet, and recorded as a limitation in every result:
- GitHub PR and issue evidence. No association step exists (G-M not approved), so GitHub records are not requested.
  Task 8's PR criterion therefore never awards.
- Cache. Task 10 is blocked by D06 and D07.
- AI wording. Task 14 is not implemented.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.core.git_runner import GitError
from app.modules.evidence.contract import SourceType
from app.modules.explanation.templates import ExplanationInput, explain, limitation_sentence
from app.modules.git_history.blame import BlameError, blame_range
from app.modules.git_history.history import PARTIAL as HISTORY_PARTIAL
from app.modules.git_history.history import retrieve_history
from app.modules.investigation.classification import Classification, RetrievalStatus, classify, is_verified_support
from app.modules.investigation.ranking import RankingTarget, rank
from app.modules.investigation.result import (
    InvestigationResult,
    Limitation,
    RankedEntry,
    ResultError,
    TargetInfo,
    assemble,
    source_references_for,
)
from app.modules.repository.paths import PathError, normalize_target_path, resolve_contained_path
from app.modules.repository.registry import LoadedRegistry, RepositoryError, resolve_repository
from app.modules.symbol_resolution.resolver import AMBIGUOUS, PARSE_FAILED, RESOLVED, resolve_symbol
from app.modules.symbol_resolution.validation import InvalidInput, validate_line_range, validate_symbol

_ASSOCIATION_LIMITATION = Limitation(
    code="ASSOCIATION_NOT_IMPLEMENTED",
    message=limitation_sentence("ASSOCIATION_NOT_IMPLEMENTED"),
    scope="github",
)
_BLAME_LIMITATION = "BLAME_UNAVAILABLE"
_NO_HISTORY = "NO_HISTORY_RETRIEVED"


class RequestError(Exception):
    """Category B: the request cannot produce an investigation result. The message is the error code."""

    def __init__(self, code: str, candidates: tuple[str, ...] = ()) -> None:
        super().__init__(code)
        self.code = code
        self.candidates = candidates


@dataclass(frozen=True)
class _Retrieval:
    items: tuple
    limitations: list[Limitation]
    history_partial: bool
    region: tuple[int, int] | None


def _retrieve(root: Path, repository_id: str, path: str, symbol: str | None, region_from_symbol, moment: datetime):
    history = retrieve_history(root, repository_id, path, symbol=symbol, retrieved_at=moment)
    limitations = [
        Limitation(code=code, message=limitation_sentence(code), scope="history")
        for code in history.limitations
    ]
    items = list(history.items)
    if region_from_symbol is not None:
        try:
            blame = blame_range(
                root, repository_id, path, region_from_symbol[0], region_from_symbol[1], retrieved_at=moment
            )
            items.extend(blame.items)
            limitations.extend(
                Limitation(code=code, message=limitation_sentence(code), scope="blame") for code in blame.limitations
            )
        except (BlameError, GitError):
            limitations.append(
                Limitation(code=_BLAME_LIMITATION, message=limitation_sentence(_BLAME_LIMITATION), scope="blame")
            )
    return _Retrieval(
        items=tuple(items),
        limitations=limitations,
        history_partial=history.status == HISTORY_PARTIAL,
        region=region_from_symbol,
    )


def investigate(
    registry: LoadedRegistry,
    repository_id: str,
    path: str,
    *,
    symbol: str | None = None,
    line_start: int | None = None,
    line_end: int | None = None,
    retrieved_at: datetime | None = None,
) -> InvestigationResult:
    """Run one investigation. Returns a category A result, or raises RequestError (B) or ResultInvariantViolation (C)."""
    moment = retrieved_at or datetime.now(UTC).replace(microsecond=0)
    investigation_id = str(uuid.uuid4())

    try:
        resolved = resolve_repository(registry, repository_id)
    except RepositoryError as error:
        raise RequestError(str(error)) from None

    try:
        target_path = normalize_target_path(path)
        checked_symbol = validate_symbol(symbol) if symbol is not None else None
        line_range = validate_line_range(line_start, line_end)
    except (PathError, InvalidInput) as error:
        raise RequestError(str(error)) from None
    try:
        # C.3a steps 4 to 7: a symbolic link or junction that leads outside the resolved root is rejected here, for both
        # HTTP and MCP, before any retrieval starts.
        resolve_contained_path(resolved.root, target_path)
    except PathError as error:
        raise RequestError(str(error)) from None

    region: tuple[int, int] | None = None
    resolution_label = "NOT_REQUESTED"
    if checked_symbol is not None:
        try:
            resolution = resolve_symbol(resolved.root, target_path, checked_symbol, *(line_range or (None, None)))
        except GitError:
            return _failed(investigation_id, repository_id, target_path, checked_symbol, line_range, "GIT_FAILED", moment)
        if resolution.status == AMBIGUOUS:
            raise RequestError("TARGET_AMBIGUOUS", tuple(c.qualified_name for c in resolution.candidates))
        if resolution.status == PARSE_FAILED:
            raise RequestError("TARGET_PARSE_FAILED")
        if resolution.status == RESOLVED and resolution.definition is not None:
            region = (resolution.definition.start_line, resolution.definition.end_line)
            resolution_label = "RESOLVED"
        else:
            resolution_label = resolution.status

    try:
        retrieval = _retrieve(resolved.root, repository_id, target_path, checked_symbol, region, moment)
    except GitError as error:
        return _failed(investigation_id, repository_id, target_path, checked_symbol, line_range, str(error), moment)

    evidence_items = tuple(retrieval.items)
    ranked = rank(
        evidence_items,
        RankingTarget(path=target_path, symbol=checked_symbol, region=region),
    )
    evidence = tuple(entry.item for entry in ranked)
    limitations = list(retrieval.limitations) + [_ASSOCIATION_LIMITATION]

    if retrieval.history_partial or any(limit.scope == "blame" and limit.code == _BLAME_LIMITATION for limit in limitations):
        status = RetrievalStatus.PARTIAL
    elif not evidence:
        status = RetrievalStatus.INSUFFICIENT
        limitations.append(Limitation(code=_NO_HISTORY, message=limitation_sentence(_NO_HISTORY), scope="history"))
    else:
        status = RetrievalStatus.COMPLETE

    classification = classify(status, evidence)
    verified_commits = sum(
        1 for item in evidence if is_verified_support(item) and item.source_type is SourceType.GIT_COMMIT
    )
    verified_blame = sum(1 for item in evidence if is_verified_support(item) and item.source_type is SourceType.GIT_BLAME)
    documents = sum(1 for item in evidence if item.source_type is SourceType.DOCUMENTATION)
    text = explain(
        ExplanationInput(
            classification=classification.value if classification else None,
            retrieval_status=status.value,
            target_path=target_path,
            symbol=checked_symbol,
            verified_commit_count=verified_commits,
            verified_blame_ranges=verified_blame,
            co_changed_document_count=documents,
            limitation_messages=tuple(limit.message for limit in limitations),
        )
    )

    return assemble(
        investigation_id=investigation_id,
        repository_id=repository_id,
        target=TargetInfo(path=target_path, symbol=checked_symbol, line_range=line_range, resolution=resolution_label),
        retrieval_status=status,
        epistemic_classification=classification,
        conclusion=text.conclusion if text else None,
        explanation=text.text if text else None,
        evidence=evidence,
        ranking=tuple(RankedEntry(entry.evidence_id, entry.score, entry.awards) for entry in ranked),
        limitations=tuple(limitations),
        source_references=source_references_for(evidence),
        error=None,
    )


def _failed(
    investigation_id: str,
    repository_id: str,
    target_path: str,
    symbol: str | None,
    line_range: tuple[int, int] | None,
    code: str,
    moment: datetime,
) -> InvestigationResult:
    """Category A FAILED result. No classification, no conclusion, no explanation, empty evidence (Requirement 9.2)."""
    return assemble(
        investigation_id=investigation_id,
        repository_id=repository_id,
        target=TargetInfo(path=target_path, symbol=symbol, line_range=line_range, resolution="NOT_RESOLVED"),
        retrieval_status=RetrievalStatus.FAILED,
        epistemic_classification=None,
        conclusion=None,
        explanation=None,
        evidence=(),
        ranking=(),
        limitations=(),
        source_references=(),
        error=ResultError(code=code, message=f"Retrieval failed with {code}.", retryable=code in {"GIT_TIMEOUT", "OUTPUT_LIMIT_EXCEEDED"}),
    )
