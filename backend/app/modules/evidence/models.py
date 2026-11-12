"""Evidence item model (Evidence Retrieval tasks 7.1, 7.2, and 7.3).

Rules are defined in contract.py (vocabulary and applicability matrix) and identity.py (canonical identifiers
and evidence_id). Each check below names the owner decision it implements. Identity fields are checked before
applicability. Every rejection raises ValueError, which pydantic reports as a ValidationError.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, computed_field, model_validator

from app.core.git_objects import is_full_object_name
from app.modules.evidence.contract import (
    APPLICABILITY,
    GIT_TYPES,
    GITHUB_TYPES,
    METADATA_FIELDS,
    NUMBERED_TYPES,
    RELATIONSHIP_BASIS,
    Applicability,
    ChangeSide,
    MetadataField,
    RelationshipBasis,
    RelationshipKind,
    SourceType,
    SourceVerification,
)
from app.modules.evidence.identity import (
    blame_source_id,
    canonical_decimal,
    code_history_range_source_id,
    code_history_source_id,
    derive_evidence_id,
    documentation_source_id,
    is_positive_decimal,
)
from app.modules.repository.paths import is_normalized_repository_path


def _require_text(value: str) -> str:
    # A whitespace-only string is a placeholder, not a value (Requirement 4.3, design Property 6).
    if not value.strip():
        raise ValueError("value must not be empty or whitespace only")
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:
        raise ValueError("value must be valid UTF-8 text") from None
    return value


# No maximum length is set here. Length limits for title, excerpt, author, limitations, and the request
# and output bounds are configuration values (DEC-10, E-D14, Task 16.1). Ingestion must enforce them before a
# record reaches this model. This model does not enforce them.
NonEmptyStr = Annotated[str, Field(min_length=1), AfterValidator(_require_text)]


def _require_full_object_name(value: str) -> str:
    # DEC-14 as updated for I2: 40 (SHA-1) or 64 (SHA-256) lowercase hexadecimal characters only.
    if not is_full_object_name(value):
        raise ValueError("must be a full lowercase object name of 40 (SHA-1) or 64 (SHA-256) hexadecimal characters")
    return value


CommitName = Annotated[str, AfterValidator(_require_full_object_name)]


def _require_normalized_path(value: str) -> str:
    if not is_normalized_repository_path(value):
        raise ValueError("file_path must be a normalized repository-relative path")
    return value


NormalizedPath = Annotated[str, Field(min_length=1), AfterValidator(_require_normalized_path)]


def _require_https_url(value: str) -> str:
    # X6: HTTPS only, with no credentials and no whitespace or control characters.
    parts = urlsplit(value)
    if parts.scheme != "https" or not parts.netloc or "@" in parts.netloc:
        raise ValueError("source_url must be an HTTPS URL without credentials")
    if any(character.isspace() or ord(character) < 0x20 for character in value):
        raise ValueError("source_url must not contain whitespace or control characters")
    return value


HttpsUrl = Annotated[str, Field(min_length=1), AfterValidator(_require_https_url)]


def _to_utc_whole_seconds(value: datetime) -> datetime:
    # D5: timezone-aware, normalized to UTC, whole-second precision. Sub-second input is rejected, not truncated.
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must be timezone-aware")
    if value.microsecond:
        raise ValueError("timestamp must have whole-second precision")
    return value.astimezone(UTC)


UtcDatetime = Annotated[datetime, AfterValidator(_to_utc_whole_seconds)]


class LineRange(BaseModel):
    """An inclusive, 1-based line range (D7)."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    start: int = Field(ge=1)
    end: int = Field(ge=1)

    @model_validator(mode="after")
    def _start_not_after_end(self) -> LineRange:
        if self.start > self.end:
            raise ValueError("start must not be after end")
        return self


class EventTimestamps(BaseModel):
    """Pull request event times (D5). Each field is explicit: None means the event was not reported."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    merged_at: UtcDatetime | None
    closed_at: UtcDatetime | None

    @model_validator(mode="after")
    def _at_least_one_event(self) -> EventTimestamps:
        if self.merged_at is None and self.closed_at is None:
            raise ValueError("event_timestamps must record at least one event")
        return self


class ContentDigest(BaseModel):
    """A digest that Sean actually computed over the excerpt (D6). Scope is explicit."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    algorithm: Literal["sha256"]
    scope: Literal["excerpt_utf8"]
    value: str = Field(pattern=r"^[0-9a-f]{64}$")


class IntegrityRecord(BaseModel):
    """Provenance, source verification, and optional content digest (D6).

    Retrieval provenance answers when the record was retrieved and whether it came from cache. Source verification
    says what was checked. Content integrity is the digest, present only when Sean computed one. None of these
    fields establishes authorship, signing, or truth of the content.
    """

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    retrieved_at: UtcDatetime
    served_from_cache: bool
    source_verification: SourceVerification
    content_digest: ContentDigest | None

    @model_validator(mode="after")
    def _cache_claims_no_fresh_verification(self) -> IntegrityRecord:
        if self.served_from_cache and self.source_verification is not SourceVerification.NOT_PERFORMED:
            raise ValueError("a cache-served record cannot claim verification that did not occur at retrieval")
        return self


class RelationshipRecord(BaseModel):
    """Relationship to the investigated target with its epistemic basis (D8)."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    kind: RelationshipKind
    basis: RelationshipBasis

    @model_validator(mode="after")
    def _basis_matches_kind(self) -> RelationshipRecord:
        expected = RELATIONSHIP_BASIS[self.kind]
        if self.basis is not expected:
            raise ValueError(f"{self.kind.value} requires basis {expected.value}")
        return self


_REQUIREMENT_REFERENCE = {
    (SourceType.DOCUMENTATION, "commit_hash"): " (Requirement 4.6)",
    (SourceType.DOCUMENTATION, "file_path"): " (Requirement 4.6)",
    (SourceType.GIT_COMMIT, "commit_hash"): " (D9)",
}


def _effective_applicability(item: EvidenceItem, field: str) -> Applicability:
    state = APPLICABILITY[item.source_type][field]
    if state is Applicability.REQUIRED_WITH_LINE_RANGE:
        return Applicability.REQUIRED if item.line_range is not None else Applicability.NOT_APPLICABLE
    return state


def _check_applicability(item: EvidenceItem) -> None:
    kind = item.source_type.value
    for field in sorted(METADATA_FIELDS):
        rule = _effective_applicability(item, field)
        present = getattr(item, field) is not None
        unavailable = field in item.unavailable_fields
        absent = field in item.verified_absent_fields
        if unavailable and absent:
            raise ValueError(f"{field} is marked both unavailable and verified absent")
        marked = unavailable or absent
        if rule is Applicability.REQUIRED:
            if present and marked:
                raise ValueError(f"{field} has a value and is also marked as missing")
            if not present:
                reference = _REQUIREMENT_REFERENCE.get((item.source_type, field), "")
                suffix = " (a marker cannot replace it)" if marked else ""
                raise ValueError(f"{kind} requires {field}{suffix}{reference}")
        elif rule is Applicability.OPTIONAL:
            if present and marked:
                raise ValueError(f"{field} has a value and is also marked as missing")
            if not present and not marked:
                raise ValueError(f"{field} has no value and no unavailable or verified-absent marker")
        else:
            if present:
                raise ValueError(f"{field} is not applicable to {kind}")
            if marked:
                raise ValueError(f"{field} is not applicable to {kind} and cannot carry a marker")


def _check_change_side(item: EvidenceItem) -> None:
    if item.change_side is ChangeSide.POST_CHANGE and item.revision != item.commit_hash:
        raise ValueError("POST_CHANGE revision must equal commit_hash (D11)")
    if item.change_side is ChangeSide.PRE_CHANGE and item.revision == item.commit_hash:
        raise ValueError("PRE_CHANGE revision must differ from commit_hash (D11)")


def _expected_composite_id(item: EvidenceItem) -> str:
    line = item.line_range
    if item.source_type is SourceType.GIT_BLAME:
        return blame_source_id(item.revision, item.file_path, line.start, line.end)
    if item.source_type is SourceType.CODE_HISTORY:
        if line is None:
            return code_history_source_id(item.commit_hash, item.revision, item.file_path)
        _check_change_side(item)
        return code_history_range_source_id(item.commit_hash, item.revision, item.file_path, line.start, line.end)
    return documentation_source_id(item.commit_hash, item.file_path)


def _check_source_identity(item: EvidenceItem) -> None:
    kind = item.source_type
    if kind is SourceType.GIT_COMMIT:
        if item.commit_hash != item.source_id:
            raise ValueError("GIT_COMMIT commit_hash must equal source_id (D9)")
        return
    if kind in NUMBERED_TYPES:
        if not is_positive_decimal(item.source_id):
            raise ValueError(f"{kind.value} source_id must be a positive decimal number (D9)")
        return
    expected = _expected_composite_id(item)
    if item.source_id != expected:
        raise ValueError(f"{kind.value} source_id must be the canonical identifier {expected!r} (D11)")


def _check_verification(item: EvidenceItem) -> None:
    verification = item.integrity.source_verification
    if verification is SourceVerification.VERIFIED_IN_REPOSITORY and item.source_type not in GIT_TYPES:
        raise ValueError("VERIFIED_IN_REPOSITORY applies only to Git-derived source types")
    if verification is SourceVerification.VALIDATED_RECORD_IDENTITY and item.source_type not in GITHUB_TYPES:
        raise ValueError("VALIDATED_RECORD_IDENTITY applies only to pull request and issue records")
    digest = item.integrity.content_digest
    if digest is not None:
        if item.excerpt is None:
            raise ValueError("content_digest requires an excerpt (scope excerpt_utf8)")
        if hashlib.sha256(item.excerpt.encode("utf-8")).hexdigest() != digest.value:
            raise ValueError("content_digest does not match the excerpt")


class EvidenceItem(BaseModel):
    """One evidence record with provenance, identity, applicability, and explicit missing-value markers."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    repository_namespace: NonEmptyStr
    source_type: SourceType
    source_id: NonEmptyStr
    retrieval_method: NonEmptyStr
    limitations: tuple[NonEmptyStr, ...]
    integrity: IntegrityRecord

    source_url: HttpsUrl | None
    commit_hash: CommitName | None
    revision: CommitName | None
    change_side: ChangeSide | None
    file_path: NormalizedPath | None
    line_range: LineRange | None
    author: NonEmptyStr | None
    timestamp: UtcDatetime | None
    event_timestamps: EventTimestamps | None
    title: NonEmptyStr | None
    excerpt: NonEmptyStr | None
    relationship: RelationshipRecord | None

    unavailable_fields: frozenset[MetadataField]
    verified_absent_fields: frozenset[MetadataField]

    @property
    def canonical_source_id(self) -> str:
        """Identity form of source_id. source_id itself is never changed (D9, D11)."""
        if self.source_type in NUMBERED_TYPES:
            return canonical_decimal(self.source_id)
        return self.source_id

    @computed_field
    @property
    def evidence_id(self) -> str:
        """Derived identifier (task 7.2, O12). It is never accepted as input."""
        return derive_evidence_id(self.repository_namespace, self.source_type.value, self.canonical_source_id)

    @model_validator(mode="after")
    def _check_contract(self) -> EvidenceItem:
        _check_applicability(self)
        _check_source_identity(self)
        _check_verification(self)
        return self
