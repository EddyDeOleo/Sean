"""The contract for a Groq answer (Spec 4 section 8). Strict: unknown fields, wrong types, and unsupported references are rejected.

A valid answer is an answer whose claims are tied to retrieved evidence. An answer that says the evidence is insufficient is
valid. Only the reason code is returned when an answer is rejected, never the model's text.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

ANSWER_TYPES = ("explanation", "analysis", "recommendation", "investigation", "clarification")
CONFIDENCE = ("LOW", "MEDIUM", "HIGH")
BASIS = ("DOCUMENTED", "INFERRED", "UNKNOWN")


class Claim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=400)
    basis: Literal["DOCUMENTED", "INFERRED", "UNKNOWN"]
    evidence_ids: list[str] = Field(default_factory=list, max_length=6)

    @model_validator(mode="after")
    def _supported(self) -> Claim:
        if self.basis in ("DOCUMENTED", "INFERRED") and not self.evidence_ids:
            raise ValueError("a documented or inferred claim must cite evidence")
        if self.basis == "UNKNOWN" and self.evidence_ids:
            raise ValueError("an unknown claim cites no evidence")
        return self


class AnswerContent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str = Field(min_length=1, max_length=2000)
    summary: str = Field(min_length=1, max_length=300)
    claims: list[Claim] = Field(min_length=1, max_length=8)
    limitations: list[str] = Field(default_factory=list, max_length=6)
    recommendations: list[str] = Field(default_factory=list, max_length=5)
    confidence: Literal["LOW", "MEDIUM", "HIGH"]
    answer_type: Literal["explanation", "analysis", "recommendation", "investigation", "clarification"]

    @model_validator(mode="after")
    def _limits_are_text(self) -> AnswerContent:
        for item in [*self.limitations, *self.recommendations]:
            if not item.strip() or len(item) > 300:
                raise ValueError("limitations and recommendations must be short, non-empty text")
        return self


def validate_content(raw: dict, known_evidence_ids: set[str]) -> tuple[AnswerContent | None, str]:
    """Return (content, "ACCEPTED") or (None, reason). The reason names a field or a rule, never a value."""
    try:
        content = AnswerContent.model_validate(raw)
    except ValidationError as error:
        # The location, the error type, and Pydantic's fixed rule text. Pydantic's messages name the rule, not the input.
        first = error.errors()[0]
        location = ".".join(str(part) for part in first.get("loc", ()) if isinstance(part, (str, int)))[:80] or "root"
        rule = str(first.get("msg", ""))[:120]
        return None, f"SCHEMA_INVALID:{location}:{first.get('type', 'unknown')}:{rule}"
    cited = {evidence_id for claim in content.claims for evidence_id in claim.evidence_ids}
    unknown = cited - known_evidence_ids
    if unknown:
        return None, "UNKNOWN_EVIDENCE_ID"
    if not known_evidence_ids and any(claim.basis != "UNKNOWN" for claim in content.claims):
        return None, "CLAIMS_WITHOUT_EVIDENCE"
    return content, "ACCEPTED"
