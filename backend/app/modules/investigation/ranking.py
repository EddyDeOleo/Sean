"""Deterministic evidence ranking (Task 8.1 to 8.3; Requirement 6; Spec 1 §9).

Ranking is a relevance mechanism. It does not decide epistemic classification (Requirement 6.5).

Criteria and initial weights are the Spec 1 §9 values. Spec 1 calls them initial design values, not validated results.
Calibration against the Golden Test Suite (D05) has not happened, so no weight is treated as validated. Weights are
configuration: pass a mapping to rank() to change them. The defaults below are used when no mapping is given.

Awards (each criterion either awards its full weight or nothing):
- exact_symbol_or_path: the item is about the exact target path. A GIT_COMMIT item needs a verified TOUCHES_TARGET_PATH
  relation. Other items need file_path equal to the target path.
- code_region: the item has a line range that overlaps the resolved target region. Missing range or region gives no award.
- historical_role: a verified structural relation to the target (TOUCHES, CHANGES, or BLAMES). INFERRED relations do not
  award.
- commit_message: a GIT_COMMIT item whose title contains the target symbol (case-sensitive). No symbol gives no award.
- pull_request_or_issue: the item is a PULL_REQUEST or ISSUE whose evidence_id the caller has validated as associated
  with the target. No association is available in the current code, so no award is made. Association is not implemented
  (G-M not approved; G-O placement). The criterion is kept so the weight stays configurable.
- repository_context: a DOCUMENTATION item.
- temporal: never awarded. Spec 1 §9 gives no approved reference point, and temporal proximity is not evidence of causation.

Ordering: score descending, then evidence_id ascending by UTF-8 bytes (Requirement 6.2; Task 8.2). Missing metadata is
never a positive award (Requirement 6.3).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass

from app.modules.evidence.contract import RelationshipBasis, RelationshipKind, SourceType
from app.modules.evidence.models import EvidenceItem

EXACT_SYMBOL_OR_PATH = "exact_symbol_or_path"
CODE_REGION = "code_region"
HISTORICAL_ROLE = "historical_role"
COMMIT_MESSAGE = "commit_message"
PULL_REQUEST_OR_ISSUE = "pull_request_or_issue"
REPOSITORY_CONTEXT = "repository_context"
TEMPORAL = "temporal"

CRITERIA: tuple[str, ...] = (
    EXACT_SYMBOL_OR_PATH,
    CODE_REGION,
    HISTORICAL_ROLE,
    COMMIT_MESSAGE,
    PULL_REQUEST_OR_ISSUE,
    REPOSITORY_CONTEXT,
    TEMPORAL,
)

# Spec 1 §9 initial design values. Not validated (D05).
DEFAULT_WEIGHTS: dict[str, int] = {
    EXACT_SYMBOL_OR_PATH: 25,
    CODE_REGION: 20,
    HISTORICAL_ROLE: 20,
    COMMIT_MESSAGE: 15,
    PULL_REQUEST_OR_ISSUE: 10,
    REPOSITORY_CONTEXT: 5,
    TEMPORAL: 5,
}

_STRUCTURAL_RELATIONS = frozenset(
    {RelationshipKind.TOUCHES_TARGET_PATH, RelationshipKind.CHANGES_TARGET_LINES, RelationshipKind.BLAMES_TARGET_LINES}
)


@dataclass(frozen=True)
class RankingTarget:
    """What the investigation is about. region is an inclusive (start, end) line pair, or None.

    associated_ids holds the evidence_id values that the association step has validated against the target. It is empty
    until association is implemented.
    """

    path: str
    symbol: str | None = None
    region: tuple[int, int] | None = None
    associated_ids: frozenset[str] = frozenset()


@dataclass(frozen=True)
class RankedItem:
    evidence_id: str
    item: EvidenceItem
    score: int
    awards: tuple[tuple[str, int], ...]


def validate_weights(weights: Mapping[str, int]) -> dict[str, int]:
    """Return a complete, validated weight mapping. Every criterion must be present, and every weight a non-negative int."""
    if set(weights) != set(CRITERIA):
        missing = sorted(set(CRITERIA) - set(weights))
        extra = sorted(set(weights) - set(CRITERIA))
        raise ValueError(f"weights must name exactly the Spec 1 §9 criteria (missing {missing}, unknown {extra})")
    checked: dict[str, int] = {}
    for criterion in CRITERIA:
        value = weights[criterion]
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError(f"weight for {criterion} must be a non-negative integer")
        checked[criterion] = value
    return checked


def _overlaps(item: EvidenceItem, target: RankingTarget) -> bool:
    if item.line_range is None or target.region is None or item.file_path != target.path:
        return False
    return item.line_range.start <= target.region[1] and item.line_range.end >= target.region[0]


def _is_about_exact_path(item: EvidenceItem, target: RankingTarget) -> bool:
    if item.source_type is SourceType.GIT_COMMIT:
        relation = item.relationship
        return (
            relation is not None
            and relation.kind is RelationshipKind.TOUCHES_TARGET_PATH
            and relation.basis is RelationshipBasis.VERIFIED
        )
    return item.file_path == target.path


def awarded_criteria(item: EvidenceItem, target: RankingTarget) -> tuple[str, ...]:
    """Return the criteria this item earns. Missing metadata never adds an award."""
    awarded: list[str] = []
    if _is_about_exact_path(item, target):
        awarded.append(EXACT_SYMBOL_OR_PATH)
    if _overlaps(item, target):
        awarded.append(CODE_REGION)
    relation = item.relationship
    if relation is not None and relation.basis is RelationshipBasis.VERIFIED and relation.kind in _STRUCTURAL_RELATIONS:
        awarded.append(HISTORICAL_ROLE)
    if (
        item.source_type is SourceType.GIT_COMMIT
        and target.symbol is not None
        and item.title is not None
        and target.symbol in item.title
    ):
        awarded.append(COMMIT_MESSAGE)
    if item.source_type in (SourceType.PULL_REQUEST, SourceType.ISSUE) and item.evidence_id in target.associated_ids:
        awarded.append(PULL_REQUEST_OR_ISSUE)
    if item.source_type is SourceType.DOCUMENTATION:
        awarded.append(REPOSITORY_CONTEXT)
    return tuple(awarded)


def rank(
    items: Iterable[EvidenceItem],
    target: RankingTarget,
    weights: Mapping[str, int] | None = None,
) -> tuple[RankedItem, ...]:
    """Rank evidence deterministically. Each result keeps the per-criterion awards that produced its score."""
    active = validate_weights(weights if weights is not None else DEFAULT_WEIGHTS)
    ranked: list[RankedItem] = []
    for item in items:
        criteria = awarded_criteria(item, target)
        awards = tuple((criterion, active[criterion]) for criterion in CRITERIA if criterion in criteria)
        score = sum(points for _, points in awards)
        ranked.append(RankedItem(evidence_id=item.evidence_id, item=item, score=score, awards=awards))
    ranked.sort(key=lambda entry: (-entry.score, entry.evidence_id.encode("utf-8")))
    return tuple(ranked)
