"""Recommendation contract (Spec 4 section 6.2).

The contract is enforced twice: by the model validators below (shape), and by `check_against_profile` (every evidence
reference exists and the stated classification is not stronger than the evidence).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.modules.repository_profile.models import RepositoryProfile

RecommendationStatus = Literal["ADOPT_NOW", "CONSIDER", "NOT_RECOMMENDED", "INSUFFICIENT_EVIDENCE"]
EvidenceClassification = Literal["DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE", "INSUFFICIENT_EVIDENCE"]
Confidence = Literal["HIGH", "MEDIUM", "LOW"]
Priority = Literal["P1", "P2", "P3"]
Effort = Literal["LOW", "MEDIUM", "HIGH"]
ConfigurationStrategy = Literal["GENERATE_FILE", "INSTRUCTIONS_ONLY", "NONE"]
AdoptionScope = Literal["REPOSITORY", "USER", "RUNTIME"]
RoadmapBand = Literal["IMMEDIATE", "NEAR_TERM", "LONGER_TERM", "NOT_RECOMMENDED", "INSUFFICIENT_EVIDENCE"]

MIN_HISTORY_FOR_CONFIDENCE = 10


class Recommendation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    capability: str
    title: str
    summary: str
    repository_signal: str
    evidence_references: list[str] = Field(default_factory=list)
    evidence_classification: EvidenceClassification
    reasoning: str
    expected_benefit: str
    priority: Priority
    recommendation_status: RecommendationStatus
    implementation_effort: Effort
    prerequisites: list[str] = Field(default_factory=list)
    needs_external_setup: bool = False
    risks: list[str] = Field(default_factory=list)
    adoption_scope: AdoptionScope
    configuration_strategy: ConfigurationStrategy
    artifact_kind: str | None = None
    verification_method: str
    confidence: Confidence
    limitations: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _check_shape(self) -> Recommendation:
        actionable = self.recommendation_status in {"ADOPT_NOW", "CONSIDER"}
        if actionable and not self.evidence_references:
            raise ValueError("an actionable recommendation needs at least one evidence reference")
        if self.recommendation_status == "INSUFFICIENT_EVIDENCE" and self.evidence_classification != "INSUFFICIENT_EVIDENCE":
            raise ValueError("insufficient evidence must be stated as such")
        if self.adoption_scope != "REPOSITORY" and self.configuration_strategy == "GENERATE_FILE":
            raise ValueError("only a repository-scope capability can generate a repository file")
        if self.artifact_kind is not None and self.configuration_strategy != "GENERATE_FILE":
            raise ValueError("an artifact kind requires the GENERATE_FILE strategy")
        if not actionable and self.configuration_strategy == "GENERATE_FILE":
            raise ValueError("a capability that is not recommended generates nothing")
        return self


class Roadmap(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    immediate: list[str]
    near_term: list[str]
    longer_term: list[str]
    not_recommended: list[str]
    insufficient_evidence: list[str]


class AdvisorResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    repository_id: str
    profile_head: str
    catalog_verified_on: str
    recommendations: list[Recommendation]
    roadmap: Roadmap
    limitations: list[str]


def priority_for(status: str, confidence: str, effort: str) -> Priority:
    """P1 is for adopt-now items that are not expensive. Everything else ranks lower, deterministically."""
    if status == "ADOPT_NOW":
        return "P1" if effort in {"LOW", "MEDIUM"} else "P2"
    if status == "CONSIDER":
        return "P2" if confidence != "LOW" and effort != "HIGH" else "P3"
    return "P3"


def confidence_for(profile: RepositoryProfile, *, any_inferred: bool, uses_history: bool) -> Confidence:
    """Categorical confidence from evidence quality (Spec 4 section 6.2, rule 5). It is not a model probability."""
    history = profile.summary.history
    if profile.is_incomplete():
        return "LOW"
    if uses_history and history.commits_scanned < MIN_HISTORY_FOR_CONFIDENCE:
        return "LOW"
    if any_inferred or (uses_history and profile.history_limited):
        return "MEDIUM"
    return "HIGH"


def classification_for(profile: RepositoryProfile, *, any_inferred: bool, uses_history: bool, insufficient: bool) -> EvidenceClassification:
    if insufficient:
        return "INSUFFICIENT_EVIDENCE"
    if profile.is_incomplete():
        return "PARTIAL_EVIDENCE"
    if uses_history and profile.summary.history.commits_scanned < MIN_HISTORY_FOR_CONFIDENCE:
        return "PARTIAL_EVIDENCE"
    return "INFERRED" if any_inferred else "DOCUMENTED"


class ContractViolation(Exception):
    """An Advisor result does not satisfy the contract against its profile."""


def check_against_profile(result: AdvisorResult, profile: RepositoryProfile) -> None:
    """Raise ContractViolation if any reference is unknown or any classification claims more than the evidence gives."""
    known = profile.by_id()
    if result.profile_head != profile.head:
        raise ContractViolation("result was not built from this profile")
    for recommendation in result.recommendations:
        refs = [known.get(ref) for ref in recommendation.evidence_references]
        if any(item is None for item in refs):
            raise ContractViolation(f"{recommendation.capability}: unknown evidence reference")
        if recommendation.evidence_classification == "DOCUMENTED" and any(item.classification == "INFERRED" for item in refs if item):
            raise ContractViolation(f"{recommendation.capability}: DOCUMENTED claim rests on an inferred observation")
        if recommendation.evidence_classification == "DOCUMENTED" and profile.is_incomplete():
            raise ContractViolation(f"{recommendation.capability}: DOCUMENTED claim from an incomplete scan")
        if recommendation.confidence == "HIGH" and profile.is_incomplete():
            raise ContractViolation(f"{recommendation.capability}: HIGH confidence from an incomplete scan")
        history_refs = [item for item in refs if item and item.kind in {"COMMIT_STATS", "FIX_RECURRENCE"}]
        if history_refs and profile.summary.history.commits_scanned < MIN_HISTORY_FOR_CONFIDENCE and recommendation.confidence == "HIGH":
            raise ContractViolation(f"{recommendation.capability}: HIGH confidence from fewer than {MIN_HISTORY_FOR_CONFIDENCE} commits")
