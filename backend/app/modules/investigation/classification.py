"""Epistemic classification (Task 11.1, 11.2; Requirement 7; Spec 1 §10.1).

Classification describes what the evidence supports. It does not describe whether retrieval ran. Retrieval status and
classification are separate values (Requirement 8.3).

Rules. The approved text defines the four classifications (Spec 1 §10.1) but does not give a mapping from evidence to a
classification. The mapping below is an implementation decision. It is conservative:

- Verified support: a Git-derived item with VERIFIED_IN_REPOSITORY integrity that was not served from cache, and a VERIFIED
  structural relation (TOUCHES_TARGET_PATH, CHANGES_TARGET_LINES, or BLAMES_TARGET_LINES).
- Inferred support: a DOCUMENTATION item with an INFERRED relation (co-change only, no verified content relation).
- A GitHub record never supports a classification alone. No association exists yet (G-M not approved), so GitHub evidence
  is never counted here. Cached records are never counted (they are NOT_PERFORMED).

Mapping:
- FAILED retrieval: no classification (Requirement 9.2).
- COMPLETE with verified support: DOCUMENTED.
- PARTIAL or INSUFFICIENT retrieval with verified support: PARTIAL_EVIDENCE. The supported portion is named by the caller.
- COMPLETE with inferred support only: INFERRED.
- Anything else: INSUFFICIENT_EVIDENCE.

No rule uses commit dates, author identity, or message text except the verified relation itself. Temporal proximity never
supports a classification (Requirement 7.4).
"""

from __future__ import annotations

from collections.abc import Iterable
from enum import StrEnum

from app.modules.evidence.contract import RelationshipBasis, RelationshipKind, SourceType, SourceVerification
from app.modules.evidence.models import EvidenceItem


class RetrievalStatus(StrEnum):
    COMPLETE = "COMPLETE"
    PARTIAL = "PARTIAL"
    INSUFFICIENT = "INSUFFICIENT"
    FAILED = "FAILED"


class Classification(StrEnum):
    DOCUMENTED = "DOCUMENTED"
    INFERRED = "INFERRED"
    PARTIAL_EVIDENCE = "PARTIAL_EVIDENCE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"


_VERIFIED_STRUCTURAL = frozenset(
    {RelationshipKind.TOUCHES_TARGET_PATH, RelationshipKind.CHANGES_TARGET_LINES, RelationshipKind.BLAMES_TARGET_LINES}
)


def is_verified_support(item: EvidenceItem) -> bool:
    """True only for a non-cached Git record with a verified structural relation to the target."""
    relation = item.relationship
    return (
        item.source_type in (SourceType.GIT_COMMIT, SourceType.GIT_BLAME, SourceType.CODE_HISTORY)
        and item.integrity.source_verification is SourceVerification.VERIFIED_IN_REPOSITORY
        and not item.integrity.served_from_cache
        and relation is not None
        and relation.basis is RelationshipBasis.VERIFIED
        and relation.kind in _VERIFIED_STRUCTURAL
    )


def is_inferred_support(item: EvidenceItem) -> bool:
    """True only for a co-changed documentation record. It is inference, not a verified content relation."""
    relation = item.relationship
    return (
        item.source_type is SourceType.DOCUMENTATION
        and item.integrity.source_verification is SourceVerification.VERIFIED_IN_REPOSITORY
        and not item.integrity.served_from_cache
        and relation is not None
        and relation.basis is RelationshipBasis.INFERRED
        and relation.kind is RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET
    )


def supporting_items(evidence: Iterable[EvidenceItem]) -> tuple[EvidenceItem, ...]:
    """Items that count toward a classification."""
    return tuple(item for item in evidence if is_verified_support(item) or is_inferred_support(item))


def classify(status: RetrievalStatus, evidence: Iterable[EvidenceItem]) -> Classification | None:
    """Return the classification for a retrieval outcome and its evidence. None when retrieval FAILED."""
    if status is RetrievalStatus.FAILED:
        return None
    items = tuple(evidence)
    verified = [item for item in items if is_verified_support(item)]
    inferred = [item for item in items if is_inferred_support(item)]
    if verified:
        return Classification.DOCUMENTED if status is RetrievalStatus.COMPLETE else Classification.PARTIAL_EVIDENCE
    if inferred and status is RetrievalStatus.COMPLETE:
        return Classification.INFERRED
    return Classification.INSUFFICIENT_EVIDENCE
