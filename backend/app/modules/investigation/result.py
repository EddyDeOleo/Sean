"""Investigation result assembly and consistency checks (Task 12.1 to 12.3; Requirement 9; design C.4 to C.6).

- The result carries every field that Spec 1 §10.3 requires, in the shape of design C.4.
- Retrieval status and classification are separate fields (Requirement 8.3).
- check_invariants enforces the status and classification rules table (design "Status and classification rules").
- A violated invariant raises ResultInvariantViolation, which is category C (C.5). No partial result is returned. No value
  is changed silently (Requirement 9.5).

Design conflict, recorded and not resolved here: the rules table says a violation "returns INTERNAL_ERROR as a FAILED
result" (design, "Status and classification rules"), and Task 12.2 repeats that. C.5 and C.6 say a category C violation
is never returned as an investigation result and becomes a category B BackendError (HTTP 500). This module follows C.5
and C.6, because C.11 defines the HTTP mapping that depends on them. The owner must decide the representation before the
API maps violations.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.modules.evidence.models import EvidenceItem
from app.modules.investigation.classification import (
    Classification,
    RetrievalStatus,
    is_inferred_support,
    is_verified_support,
)


class ResultInvariantViolation(Exception):
    """Category C: the assembled result breaks an invariant. The message is the rule name only."""


@dataclass(frozen=True)
class TargetInfo:
    path: str
    symbol: str | None
    line_range: tuple[int, int] | None
    resolution: str


@dataclass(frozen=True)
class Limitation:
    code: str
    message: str
    scope: str
    evidence_id: str | None = None


@dataclass(frozen=True)
class SourceReference:
    evidence_id: str
    source_type: str
    source_id: str
    source_url: str | None


@dataclass(frozen=True)
class RankedEntry:
    evidence_id: str
    score: int
    awards: tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class ResultError:
    code: str
    message: str
    retryable: bool


@dataclass(frozen=True)
class InvestigationResult:
    investigation_id: str
    repository_id: str
    target: TargetInfo
    retrieval_status: RetrievalStatus
    epistemic_classification: Classification | None
    conclusion: str | None
    explanation: str | None
    evidence: tuple[EvidenceItem, ...]
    ranking: tuple[RankedEntry, ...]
    limitations: tuple[Limitation, ...]
    source_references: tuple[SourceReference, ...]
    error: ResultError | None = field(default=None)


def _violation(rule: str) -> ResultInvariantViolation:
    return ResultInvariantViolation(rule)


def check_invariants(result: InvestigationResult) -> None:
    """Raise ResultInvariantViolation when a rule of the status and classification table is broken."""
    status = result.retrieval_status
    classification = result.epistemic_classification

    if status is RetrievalStatus.FAILED:
        if classification is not None or result.conclusion is not None:
            raise _violation("failed_result_has_classification_or_conclusion")
        if result.evidence:
            raise _violation("failed_result_has_evidence")
        if result.error is None:
            raise _violation("failed_result_without_error")
        return

    if result.error is not None:
        raise _violation("error_present_without_failure")
    if classification is None:
        raise _violation("non_failed_result_without_classification")

    if classification in (Classification.DOCUMENTED, Classification.INFERRED):
        needed = is_verified_support if classification is Classification.DOCUMENTED else is_inferred_support
        if not any(needed(item) for item in result.evidence):
            raise _violation("classified_without_supporting_evidence")

    if classification is Classification.PARTIAL_EVIDENCE:
        if not result.conclusion or not result.limitations:
            raise _violation("partial_evidence_without_supported_portion_or_limitations")

    if classification is Classification.INSUFFICIENT_EVIDENCE and result.conclusion is not None:
        raise _violation("insufficient_evidence_with_conclusion")

    if status in (RetrievalStatus.PARTIAL, RetrievalStatus.INSUFFICIENT) and not result.limitations:
        raise _violation("partial_or_insufficient_without_limitations")


def assemble(**fields: Any) -> InvestigationResult:
    """Build the result and check every invariant before returning it."""
    result = InvestigationResult(**fields)
    check_invariants(result)
    return result


def source_references_for(evidence: tuple[EvidenceItem, ...]) -> tuple[SourceReference, ...]:
    return tuple(
        SourceReference(
            evidence_id=item.evidence_id,
            source_type=item.source_type.value,
            source_id=item.source_id,
            source_url=item.source_url,
        )
        for item in evidence
    )
