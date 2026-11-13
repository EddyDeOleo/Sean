"""Roadmap and the Advisor entry point (Spec 4 sections 6.4 and 6.2).

`advise(profile)` runs every rule, validates the result against the profile, and orders it into bands. Ordering inside a
band is by evidence strength, then effort, then catalog order, so equal input gives equal output.
"""

from __future__ import annotations

from app.modules.advisor.catalog import CATALOG, CATALOG_VERIFIED_ON
from app.modules.advisor.contract import (
    AdvisorResult,
    Recommendation,
    Roadmap,
    check_against_profile,
)
from app.modules.advisor.rules import RULES
from app.modules.repository_profile.models import RepositoryProfile

_CLASSIFICATION_RANK = {"DOCUMENTED": 0, "INFERRED": 1, "PARTIAL_EVIDENCE": 2, "INSUFFICIENT_EVIDENCE": 3}
_EFFORT_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
_CATALOG_ORDER = {name: index for index, name in enumerate(CATALOG)}


def _sort_key(item: Recommendation) -> tuple[int, int, int, int]:
    return (
        int(item.priority[1]),
        _CLASSIFICATION_RANK[item.evidence_classification],
        _EFFORT_RANK[item.implementation_effort],
        _CATALOG_ORDER[item.capability],
    )


def _ready_now(item: Recommendation) -> bool:
    """Near term means the user can start from the repository alone, with acceptable evidence and effort."""
    return not item.needs_external_setup and item.confidence != "LOW" and item.implementation_effort != "HIGH"


def build_roadmap(recommendations: list[Recommendation]) -> Roadmap:
    ordered = sorted(recommendations, key=_sort_key)
    immediate = [r.capability for r in ordered if r.recommendation_status == "ADOPT_NOW"]
    considered = [r for r in ordered if r.recommendation_status == "CONSIDER"]
    return Roadmap(
        immediate=immediate,
        near_term=[r.capability for r in considered if _ready_now(r)],
        longer_term=[r.capability for r in considered if not _ready_now(r)],
        not_recommended=[r.capability for r in ordered if r.recommendation_status == "NOT_RECOMMENDED"],
        insufficient_evidence=[r.capability for r in ordered if r.recommendation_status == "INSUFFICIENT_EVIDENCE"],
    )


def advise(profile: RepositoryProfile) -> AdvisorResult:
    recommendations = [rule(profile) for rule in RULES]
    result = AdvisorResult(
        repository_id=profile.repository_id,
        profile_head=profile.head,
        catalog_verified_on=CATALOG_VERIFIED_ON,
        recommendations=sorted(recommendations, key=_sort_key),
        roadmap=build_roadmap(recommendations),
        limitations=[item.message for item in profile.limitations],
    )
    check_against_profile(result, profile)
    return result
