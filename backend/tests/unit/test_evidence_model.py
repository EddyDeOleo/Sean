"""Unit tests for app.modules.evidence.models (Evidence Retrieval tasks 7.1 and 7.3).

Covers Requirements 4.1 to 4.6, design Property 6, and the I2 owner decisions D1, D4 to D9, D11 (identity rules),
X1 (revision), D5 (timestamps), D6 (integrity), D8 (relationships), and X6 (HTTPS URLs).

The applicability matrix is checked against ARTIFACT_MATRIX, a literal transcription of the I2 investigation
artifact (section 5) with the owner resolutions U-1 to U-4 applied. It is not derived from the implementation.
"""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest
from pydantic import ValidationError

from app.modules.evidence.contract import (
    METADATA_FIELDS,
    ChangeSide,
    RelationshipBasis,
    RelationshipKind,
    SourceType,
    SourceVerification,
)
from app.modules.evidence.identity import (
    blame_source_id,
    code_history_range_source_id,
    code_history_source_id,
    documentation_source_id,
)
from app.modules.evidence.models import (
    ContentDigest,
    EventTimestamps,
    EvidenceItem,
    IntegrityRecord,
    LineRange,
    RelationshipRecord,
)

SHA1 = "9e7cc2b628fe8fd3895986af9b7fc9525034c1b0"
SHA1_OTHER = "0123456789abcdef0123456789abcdef01234567"
SHA256 = "ab" * 32
PATH = "django/db/models/query.py"
DOC_PATH = "docs/guide.rst"
NOW = datetime(2024, 5, 1, 12, 0, tzinfo=UTC)
EXCERPT = "Stable ordering for queries."
PR_URL = "https://github.com/django/django/pull/123"
ISSUE_URL = "https://github.com/django/django/issues/42"
COMMIT_URL = "https://github.com/django/django/commit/" + SHA1

# Approved applicability matrix for I2. Source: the six-source matrix in the I2 investigation artifact, section 5
# (96a96c9d-b10a-4f45-a85b-cf3a4fe60eaf.md), with the four owner resolutions U-1 to U-4 applied. It was written
# before this test suite and was NOT derived from backend/app/modules/evidence/contract.py.
# Symbols: R = REQUIRED (value only), O = OPTIONAL (value or one marker), N = NOT_APPLICABLE (neither).
# CODE_HISTORY change_side depends on line_range (X1) and is tested in dedicated tests instead of this table.
ARTIFACT_MATRIX: dict[SourceType, dict[str, str]] = {
    SourceType.GIT_COMMIT: {
        "source_url": "O", "commit_hash": "R", "revision": "N", "change_side": "N", "file_path": "N",
        "line_range": "N", "author": "O", "timestamp": "O", "event_timestamps": "N", "title": "O",
        "excerpt": "O", "relationship": "O",  # U-3: file_path and line_range NOT_APPLICABLE.
    },
    SourceType.GIT_BLAME: {
        "source_url": "O", "commit_hash": "O", "revision": "R", "change_side": "N", "file_path": "R",
        "line_range": "R", "author": "O", "timestamp": "O", "event_timestamps": "N", "title": "O",
        "excerpt": "O", "relationship": "O",  # change_side and event_timestamps: not in artifact; X1, D5
    },
    SourceType.CODE_HISTORY: {
        "source_url": "O", "commit_hash": "R", "revision": "R", "file_path": "R", "line_range": "O",
        "author": "O", "timestamp": "O", "event_timestamps": "N", "title": "O", "excerpt": "O",
        "relationship": "O",  # U-1: file_path REQUIRED. U-4: revision REQUIRED with or without a line range.
    },
    SourceType.DOCUMENTATION: {
        "source_url": "O", "commit_hash": "R", "revision": "N", "change_side": "N", "file_path": "R",
        "line_range": "N", "author": "O", "timestamp": "O", "event_timestamps": "N", "title": "O",
        "excerpt": "O", "relationship": "O",  # change_side and event_timestamps: not in artifact; X1, D5
    },
    SourceType.PULL_REQUEST: {
        "source_url": "O", "commit_hash": "O", "revision": "N", "change_side": "N", "file_path": "N",
        "line_range": "N", "author": "O", "timestamp": "R", "event_timestamps": "O", "title": "O",
        "excerpt": "O", "relationship": "O",  # U-2: timestamp REQUIRED (D5). event_timestamps: D5 and X3.
    },
    SourceType.ISSUE: {
        "source_url": "O", "commit_hash": "O", "revision": "N", "change_side": "N", "file_path": "N",
        "line_range": "N", "author": "O", "timestamp": "R", "event_timestamps": "N", "title": "O",
        "excerpt": "O", "relationship": "O",  # U-2: timestamp REQUIRED (D5). ISSUE author OPTIONAL (X9).
    },
}

# Accepted states per oracle rule: R accepts only a value; O accepts a value or a marker; N accepts only none.
ACCEPTED_STATES = {"R": {"value"}, "O": {"value", "marker"}, "N": {"none"}}

# CODE_HISTORY line_range and change_side are coupled (X1: a range needs its side), so the isolated matrix cell
# does not apply to them. They are tested explicitly in the X1 tests below.
RWL_FIELDS = {"line_range", "change_side"}


def _integrity(verification: SourceVerification = SourceVerification.VERIFIED_IN_REPOSITORY) -> IntegrityRecord:
    return IntegrityRecord(
        retrieved_at=NOW,
        served_from_cache=False,
        source_verification=verification,
        content_digest=None,
    )


GIT_INTEGRITY = _integrity()
GITHUB_INTEGRITY = _integrity(SourceVerification.VALIDATED_RECORD_IDENTITY)

# A valid, fully populated item for each source type. Every optional field has a value, so no marker is needed.
BASE: dict[SourceType, dict[str, Any]] = {
    SourceType.GIT_COMMIT: {
        "repository_namespace": "django",
        "source_type": SourceType.GIT_COMMIT,
        "source_id": SHA1,
        "retrieval_method": "git log",
        "limitations": (),
        "integrity": GIT_INTEGRITY,
        "source_url": COMMIT_URL,
        "commit_hash": SHA1,
        "revision": None,
        "change_side": None,
        "file_path": None,
        "line_range": None,
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": None,
        "title": "Fix query ordering",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.TOUCHES_TARGET_PATH, basis=RelationshipBasis.VERIFIED),
    },
    SourceType.GIT_BLAME: {
        "repository_namespace": "django",
        "source_type": SourceType.GIT_BLAME,
        "source_id": blame_source_id(SHA1, PATH, 10, 20),
        "retrieval_method": "git blame --porcelain",
        "limitations": (),
        "integrity": GIT_INTEGRITY,
        "source_url": COMMIT_URL,
        "commit_hash": SHA1_OTHER,
        "revision": SHA1,
        "change_side": None,
        "file_path": PATH,
        "line_range": LineRange(start=10, end=20),
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": None,
        "title": "Fix query ordering",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.BLAMES_TARGET_LINES, basis=RelationshipBasis.VERIFIED),
    },
    SourceType.CODE_HISTORY: {
        "repository_namespace": "django",
        "source_type": SourceType.CODE_HISTORY,
        "source_id": code_history_source_id(SHA1, SHA1, PATH),
        "retrieval_method": "git log --follow",
        "limitations": (),
        "integrity": GIT_INTEGRITY,
        # Whole-file records carry no line range, so line_range is an explicit unavailable marker here.
        "unavailable_fields": frozenset({"line_range"}),
        "source_url": COMMIT_URL,
        "commit_hash": SHA1,
        "revision": SHA1,
        "change_side": None,
        "file_path": PATH,
        "line_range": None,
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": None,
        "title": "Fix query ordering",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.TOUCHES_TARGET_PATH, basis=RelationshipBasis.VERIFIED),
    },
    SourceType.DOCUMENTATION: {
        "repository_namespace": "django",
        "source_type": SourceType.DOCUMENTATION,
        "source_id": documentation_source_id(SHA1, DOC_PATH),
        "retrieval_method": "git log -- docs",
        "limitations": (),
        "integrity": GIT_INTEGRITY,
        "source_url": COMMIT_URL,
        "commit_hash": SHA1,
        "revision": None,
        "change_side": None,
        "file_path": DOC_PATH,
        "line_range": None,
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": None,
        "title": "Guide",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.DOCUMENTS_TARGET_PATH, basis=RelationshipBasis.VERIFIED),
    },
    SourceType.PULL_REQUEST: {
        "repository_namespace": "django",
        "source_type": SourceType.PULL_REQUEST,
        "source_id": "123",
        "retrieval_method": "GitHub REST pull request",
        "limitations": (),
        "integrity": GITHUB_INTEGRITY,
        "source_url": PR_URL,
        "commit_hash": SHA1_OTHER,
        "revision": None,
        "change_side": None,
        "file_path": None,
        "line_range": None,
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": EventTimestamps(merged_at=NOW, closed_at=None),
        "title": "Fix query ordering",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.MENTIONS_TARGET, basis=RelationshipBasis.VERIFIED),
    },
    SourceType.ISSUE: {
        "repository_namespace": "django",
        "source_type": SourceType.ISSUE,
        "source_id": "42",
        "retrieval_method": "GitHub REST issue",
        "limitations": (),
        "integrity": GITHUB_INTEGRITY,
        "source_url": ISSUE_URL,
        "commit_hash": SHA1_OTHER,
        "revision": None,
        "change_side": None,
        "file_path": None,
        "line_range": None,
        "author": "Jane Example",
        "timestamp": NOW,
        "event_timestamps": None,
        "title": "Ordering bug",
        "excerpt": EXCERPT,
        "relationship": RelationshipRecord(kind=RelationshipKind.MENTIONS_TARGET, basis=RelationshipBasis.VERIFIED),
    },
}

# Values used when a field that is not applicable to a source type is given a value in a test.
SAMPLE: dict[str, Any] = {
    "revision": SHA1_OTHER,
    "change_side": ChangeSide.POST_CHANGE,
    "file_path": "x.py",
    "line_range": LineRange(start=1, end=2),
    "event_timestamps": EventTimestamps(merged_at=NOW, closed_at=None),
}


def _item(kind: SourceType, **overrides: Any) -> dict[str, Any]:
    """Return a valid keyword set for the source type, with overrides applied. Base markers are kept."""
    data = dict(BASE[kind])
    data.update(overrides)
    data.setdefault("unavailable_fields", frozenset())
    data.setdefault("verified_absent_fields", frozenset())
    return data


def _state_overrides(kind: SourceType, field: str, state: str) -> dict[str, Any]:
    """Build the overrides that put one field into one state: value, marker, or none.

    Markers that the base already carries (for example CODE_HISTORY line_range) are kept, so a state change
    does not silently remove an unrelated marker.
    """
    base_unavailable = BASE[kind].get("unavailable_fields", frozenset())
    if state == "value":
        base_value = BASE[kind].get(field)
        return {} if base_value is not None else {field: SAMPLE[field]}
    if state == "marker":
        return {field: None, "unavailable_fields": base_unavailable | {field}}
    return {field: None}


def _expected_rejection(kind: SourceType, field: str, rule: str, state: str) -> str:
    """Return the regular expression for the rejection reason the contract must give for this cell state."""
    if rule == "R":
        if state == "none":
            return f"{kind.value} requires {field}"
        return rf"{kind.value} requires {field} \(a marker cannot replace it\)"
    if rule == "O":
        return rf"{field} has no value and no unavailable or verified-absent marker"
    if state == "value":
        return rf"{field} is not applicable to {kind.value}\b(?! and)"
    return rf"{field} is not applicable to {kind.value} and cannot carry a marker"


def _matrix_params() -> list[Any]:
    params: list[Any] = []
    for kind in SourceType:
        for field in sorted(METADATA_FIELDS):
            if kind is SourceType.CODE_HISTORY and field in RWL_FIELDS:
                continue
            for state in ("value", "marker", "none"):
                params.append(pytest.param(kind, field, state, id=f"{kind.value}-{field}-{state}"))
    return params


@pytest.mark.parametrize(("kind", "field", "state"), _matrix_params())
def test_applicability_matrix_cell(kind: SourceType, field: str, state: str) -> None:
    """Requirements 4.1, 4.3, 4.4 and the I2 applicability matrix: each cell accepts the expected states, and each
    rejection gives the expected reason."""
    rule = ARTIFACT_MATRIX[kind][field]
    data = _item(kind, **_state_overrides(kind, field, state))
    if state in ACCEPTED_STATES[rule]:
        EvidenceItem(**data)
        return
    with pytest.raises(ValidationError, match=_expected_rejection(kind, field, rule, state)):
        EvidenceItem(**data)


def test_every_source_type_has_a_complete_matrix_row() -> None:
    """Requirement 4.1 (I2): every metadata field has a deliberate state for every source type."""
    for kind in SourceType:
        for field in sorted(METADATA_FIELDS):
            if kind is SourceType.CODE_HISTORY and field in RWL_FIELDS:
                continue
            assert field in ARTIFACT_MATRIX[kind], f"{kind.value} has no state for {field}"


def test_code_history_revision_is_required_without_line_range() -> None:
    """U-4: CODE_HISTORY revision is REQUIRED even when no line range is supplied."""
    with pytest.raises(ValidationError, match="CODE_HISTORY requires revision"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, revision=None, change_side=None,
                             unavailable_fields=frozenset({"line_range"})))


@pytest.mark.parametrize("kind", list(SourceType), ids=lambda member: member.value)
def test_each_source_type_builds_a_valid_item(kind: SourceType) -> None:
    """Requirement 4.2 and I2: every source type builds from its valid base."""
    assert EvidenceItem(**_item(kind)).source_type is kind


# Requirement 4.6 and R1: DOCUMENTATION requires both commit and path values, and no marker can replace them.
@pytest.mark.parametrize("field", ["commit_hash", "file_path"])
def test_documentation_requires_commit_and_path_values(field: str) -> None:
    """Requirement 4.6 (R1): a marker cannot replace the commit or the path of documentation evidence."""
    with pytest.raises(ValidationError, match=r"Requirement 4\.6"):
        EvidenceItem(**_item(SourceType.DOCUMENTATION, **{field: None}, unavailable_fields=frozenset({field})))


# D9: GIT_COMMIT identity.
@pytest.mark.parametrize("marker", ["none", "unavailable", "verified-absent"])
def test_git_commit_without_commit_hash_is_rejected(marker: str) -> None:
    """D9: GIT_COMMIT requires commit_hash, and a marker cannot replace it."""
    overrides: dict[str, Any] = {"commit_hash": None}
    if marker == "unavailable":
        overrides["unavailable_fields"] = frozenset({"commit_hash"})
    elif marker == "verified-absent":
        overrides["verified_absent_fields"] = frozenset({"commit_hash"})
    with pytest.raises(ValidationError, match=r"GIT_COMMIT requires commit_hash"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, **overrides))


def test_git_commit_with_matching_source_id_and_commit_hash_is_accepted() -> None:
    """D9: GIT_COMMIT with commit_hash equal to source_id is accepted."""
    item = EvidenceItem(**_item(SourceType.GIT_COMMIT))
    assert item.source_id == item.commit_hash == SHA1


def test_git_commit_with_mismatched_commit_hash_is_rejected() -> None:
    """D9: GIT_COMMIT rejects a commit_hash that differs from source_id."""
    with pytest.raises(ValidationError, match=r"GIT_COMMIT commit_hash must equal source_id"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, commit_hash=SHA1_OTHER))


# D9: positive decimal identifiers for PULL_REQUEST and ISSUE; no upper bound; leading zeros accepted.
@pytest.mark.parametrize("kind", [SourceType.PULL_REQUEST, SourceType.ISSUE], ids=["pr", "issue"])
@pytest.mark.parametrize(
    "number",
    ["1", "9", "123", "01", "0001", "2147483648", "9" * 40],
    ids=["one", "single-digit", "three-digits", "leading-zero", "leading-zeros", "above-32-bit", "forty-digits"],
)
def test_positive_decimal_identifier_is_accepted(kind: SourceType, number: str) -> None:
    """D9: positive decimal identifiers are accepted for PR and ISSUE, including leading zeros, with no upper bound."""
    item = EvidenceItem(**_item(kind, source_id=number))
    assert item.source_id == number


@pytest.mark.parametrize("kind", [SourceType.PULL_REQUEST, SourceType.ISSUE], ids=["pr", "issue"])
@pytest.mark.parametrize(
    "number",
    ["0", "00", "-1", "+1", " 1", "1 ", "1\n", "1.5", "1_000", "12a", "a12", "\u0661\u0662", SHA1],
    ids=[
        "zero", "double-zero", "negative", "plus-sign", "leading-space", "trailing-space", "trailing-newline",
        "decimal-point", "underscore", "letters-after", "letters-before", "non-ascii-digits", "commit-sha",
    ],
)
def test_non_positive_or_non_decimal_identifier_is_rejected(kind: SourceType, number: str) -> None:
    """D9: zero, signs, whitespace, letters, and non-decimal forms are rejected for PR and ISSUE."""
    with pytest.raises(ValidationError, match=r"must be a positive decimal number"):
        EvidenceItem(**_item(kind, source_id=number))


def test_numbered_source_id_is_preserved_and_canonicalized_only_for_identity() -> None:
    """D9 and D11: the stored source_id keeps its leading zeros, and the canonical identity form removes them."""
    item = EvidenceItem(**_item(SourceType.PULL_REQUEST, source_id="0123"))
    assert item.source_id == "0123"
    assert item.canonical_source_id == "123"


# D11 and X1: GIT_BLAME identity and revision semantics.
def test_blame_with_uncommitted_lines_is_accepted_without_inventing_a_commit() -> None:
    """Task 6.3 and D9: uncommitted lines carry commit_hash as verified absent, with no commit invented."""
    data = _item(SourceType.GIT_BLAME, commit_hash=None, verified_absent_fields=frozenset({"commit_hash"}))
    item = EvidenceItem(**data)
    assert item.commit_hash is None
    assert "commit_hash" in item.verified_absent_fields


def test_blame_requires_revision() -> None:
    """X1: a blame line range must name the queried revision it describes."""
    with pytest.raises(ValidationError, match=r"GIT_BLAME requires revision"):
        EvidenceItem(**_item(SourceType.GIT_BLAME, revision=None))


def test_blame_source_id_must_match_its_fields() -> None:
    """D11: a blame source identifier that does not match revision, path, and range is rejected."""
    with pytest.raises(ValidationError, match=r"canonical identifier"):
        EvidenceItem(**_item(SourceType.GIT_BLAME, source_id=blame_source_id(SHA1, PATH, 10, 21)))


def test_blame_accepts_sha256_revision_and_identifier() -> None:
    """DEC-14 as updated (I2): a SHA-256 full object name is valid for revision and in the composite identifier."""
    data = _item(
        SourceType.GIT_BLAME,
        revision=SHA256,
        source_id=blame_source_id(SHA256, PATH, 10, 20),
    )
    assert EvidenceItem(**data).revision == SHA256


# X1 and D11: CODE_HISTORY pre-change and post-change sides, and whole-file records.
def test_code_history_whole_file_record_needs_no_change_side() -> None:
    """X1 and U-4: without a line range, CODE_HISTORY carries its revision but no change side."""
    item = EvidenceItem(**_item(SourceType.CODE_HISTORY))
    assert item.line_range is None
    assert item.change_side is None
    assert item.revision == SHA1


def test_code_history_post_change_range_is_accepted_with_its_identifier() -> None:
    """X1 and D11: a POST_CHANGE range is at the commit itself."""
    data = _item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5), unavailable_fields=frozenset(),
        revision=SHA1,
        change_side=ChangeSide.POST_CHANGE,
        source_id=code_history_range_source_id(SHA1, SHA1, PATH, 1, 5),
    )
    assert EvidenceItem(**data).change_side is ChangeSide.POST_CHANGE


def test_code_history_pre_change_range_is_accepted_at_a_different_revision() -> None:
    """X1 and D11: a PRE_CHANGE range is at a revision other than the commit that changed it."""
    data = _item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5), unavailable_fields=frozenset(),
        revision=SHA1_OTHER,
        change_side=ChangeSide.PRE_CHANGE,
        source_id=code_history_range_source_id(SHA1, SHA1_OTHER, PATH, 1, 5),
    )
    assert EvidenceItem(**data).revision == SHA1_OTHER


def test_post_change_revision_must_equal_commit() -> None:
    """X1: POST_CHANGE lines are read at the commit, so a different revision is rejected."""
    data = _item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5), unavailable_fields=frozenset(),
        revision=SHA1_OTHER,
        change_side=ChangeSide.POST_CHANGE,
        source_id=code_history_range_source_id(SHA1, SHA1_OTHER, PATH, 1, 5),
    )
    with pytest.raises(ValidationError, match=r"POST_CHANGE revision must equal commit_hash"):
        EvidenceItem(**data)


def test_pre_change_revision_must_differ_from_commit() -> None:
    """X1: PRE_CHANGE lines are read before the change, so a revision equal to the commit is rejected."""
    data = _item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5), unavailable_fields=frozenset(),
        revision=SHA1,
        change_side=ChangeSide.PRE_CHANGE,
        source_id=code_history_range_source_id(SHA1, SHA1, PATH, 1, 5),
    )
    with pytest.raises(ValidationError, match=r"PRE_CHANGE revision must differ from commit_hash"):
        EvidenceItem(**data)


@pytest.mark.parametrize(
    "overrides",
    [
        {"revision": SHA1, "change_side": None},
        {"revision": None, "change_side": ChangeSide.POST_CHANGE},
        {"revision": None, "change_side": None},
    ],
    ids=["range-without-change-side", "range-without-revision", "range-without-revision-or-side"],
)
def test_code_history_range_requires_revision_and_side(overrides: dict[str, Any]) -> None:
    """X1: a line range never appears without the revision and side it describes."""
    with pytest.raises(ValidationError, match=r"requires (change_side|revision)"):
        EvidenceItem(
            **_item(
                SourceType.CODE_HISTORY,
                line_range=LineRange(start=1, end=5),
                unavailable_fields=frozenset(),
                **overrides,
            )
        )


def test_code_history_range_identifier_must_include_revision_and_lines() -> None:
    """D11: a range's identifier must be the canonical form that includes the revision and the line range."""
    data = _item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5), unavailable_fields=frozenset(),
        revision=SHA1,
        change_side=ChangeSide.POST_CHANGE,
        source_id=code_history_source_id(SHA1, SHA1, PATH),
    )
    with pytest.raises(ValidationError, match=r"canonical identifier"):
        EvidenceItem(**data)


def test_change_side_is_rejected_when_line_range_is_absent() -> None:
    """X1: a change side has no line range to describe, so it is not applicable without one.
    The revision is still REQUIRED (U-4), so this case isolates change_side."""
    with pytest.raises(ValidationError, match=r"change_side is not applicable to CODE_HISTORY"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, revision=SHA1, change_side=ChangeSide.POST_CHANGE))


# D5: timestamps.
def test_naive_timestamp_is_rejected() -> None:
    """D5: a timestamp without a timezone is rejected."""
    with pytest.raises(ValidationError, match=r"timezone-aware"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, timestamp=datetime(2024, 5, 1, 12, 0)))


def test_offset_timestamp_is_normalized_to_utc_and_compares_as_the_same_instant() -> None:
    """D5: an offset timestamp is stored in UTC and represents the same instant."""
    local = datetime(2024, 5, 1, 7, 0, tzinfo=timezone(timedelta(hours=-5)))
    item = EvidenceItem(**_item(SourceType.GIT_COMMIT, timestamp=local))
    assert item.timestamp == NOW
    assert item.timestamp.utcoffset() == timedelta(0)


def test_sub_second_timestamp_is_rejected_not_truncated() -> None:
    """D5: whole-second precision is required; sub-second input is rejected, never silently changed."""
    with pytest.raises(ValidationError, match=r"whole-second"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, timestamp=NOW.replace(microsecond=500000)))


@pytest.mark.parametrize(
    "events",
    [EventTimestamps(merged_at=NOW, closed_at=None), EventTimestamps(merged_at=None, closed_at=NOW)],
    ids=["merged-only", "closed-only"],
)
def test_pull_request_event_timestamps_accept_one_recorded_event(events: EventTimestamps) -> None:
    """D5: merged_at and closed_at are separate events, and at least one must be recorded."""
    assert EvidenceItem(**_item(SourceType.PULL_REQUEST, event_timestamps=events)).event_timestamps == events


def test_event_timestamps_must_record_at_least_one_event() -> None:
    """D5: an event_timestamps object with neither event is rejected."""
    with pytest.raises(ValidationError, match=r"at least one event"):
        EventTimestamps(merged_at=None, closed_at=None)


def test_pull_request_primary_timestamp_is_required() -> None:
    """D5: a pull request's primary timestamp is its creation time, which is required."""
    with pytest.raises(ValidationError, match=r"PULL_REQUEST requires timestamp"):
        EvidenceItem(**_item(SourceType.PULL_REQUEST, timestamp=None, unavailable_fields=frozenset({"timestamp"})))


# D6: integrity provenance, verification, and digest.
def test_cache_served_record_cannot_claim_verification() -> None:
    """D6: a cache-served record with VERIFIED_IN_REPOSITORY is rejected."""
    with pytest.raises(ValidationError, match=r"cache-served"):
        IntegrityRecord(
            retrieved_at=NOW,
            served_from_cache=True,
            source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
            content_digest=None,
        )


def test_cache_served_record_with_no_verification_is_accepted() -> None:
    """D6: a cache-served record that performed no verification now is accepted."""
    record = IntegrityRecord(
        retrieved_at=NOW,
        served_from_cache=True,
        source_verification=SourceVerification.NOT_PERFORMED,
        content_digest=None,
    )
    assert record.served_from_cache is True


def test_retrieved_at_must_be_timezone_aware() -> None:
    """D6: retrieval time is a timezone-aware provenance timestamp."""
    with pytest.raises(ValidationError, match=r"timezone-aware"):
        IntegrityRecord(
            retrieved_at=datetime(2024, 5, 1, 12, 0),
            served_from_cache=False,
            source_verification=SourceVerification.NOT_PERFORMED,
            content_digest=None,
        )


@pytest.mark.parametrize(
    ("kind", "verification"),
    [
        (SourceType.PULL_REQUEST, SourceVerification.VERIFIED_IN_REPOSITORY),
        (SourceType.ISSUE, SourceVerification.VERIFIED_IN_REPOSITORY),
        (SourceType.GIT_COMMIT, SourceVerification.VALIDATED_RECORD_IDENTITY),
        (SourceType.DOCUMENTATION, SourceVerification.VALIDATED_RECORD_IDENTITY),
    ],
    ids=["pr-git-verification", "issue-git-verification", "commit-github-validation", "doc-github-validation"],
)
def test_verification_kind_must_match_the_source_family(kind: SourceType, verification: SourceVerification) -> None:
    """D6: a Git object check never describes a GitHub record, and an identity check never describes Git content."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(kind, integrity=_integrity(verification)))


def test_not_performed_verification_is_accepted_for_every_source_type() -> None:
    """D6: NOT_PERFORMED is a valid state for every source type."""
    for kind in SourceType:
        assert EvidenceItem(**_item(kind, integrity=_integrity(SourceVerification.NOT_PERFORMED)))


def test_content_digest_matches_the_excerpt_and_declares_its_scope() -> None:
    """D6: a computed digest is validated against the excerpt it claims to describe."""
    digest = hashlib.sha256(EXCERPT.encode("utf-8")).hexdigest()
    integrity = IntegrityRecord(
        retrieved_at=NOW,
        served_from_cache=False,
        source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
        content_digest=ContentDigest(algorithm="sha256", scope="excerpt_utf8", value=digest),
    )
    assert EvidenceItem(**_item(SourceType.GIT_COMMIT, integrity=integrity)).integrity.content_digest is not None


def test_content_digest_that_does_not_match_is_rejected() -> None:
    """D6: a digest that does not match the excerpt is rejected, never silently corrected."""
    integrity = IntegrityRecord(
        retrieved_at=NOW,
        served_from_cache=False,
        source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
        content_digest=ContentDigest(algorithm="sha256", scope="excerpt_utf8", value="0" * 64),
    )
    with pytest.raises(ValidationError, match=r"does not match the excerpt"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, integrity=integrity))


def test_content_digest_without_excerpt_is_rejected() -> None:
    """D6: a digest has nothing to describe without its declared excerpt scope."""
    integrity = IntegrityRecord(
        retrieved_at=NOW,
        served_from_cache=False,
        source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
        content_digest=ContentDigest(algorithm="sha256", scope="excerpt_utf8", value="0" * 64),
    )
    with pytest.raises(ValidationError, match=r"requires an excerpt"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, integrity=integrity, excerpt=None, unavailable_fields=frozenset({"excerpt"})))


def test_integrity_has_no_cache_age_field() -> None:
    """D6: cache age is derived from retrieved_at and is not stored."""
    assert "cache_age_seconds" not in IntegrityRecord.model_fields


# D8: relationship kinds and bases.
@pytest.mark.parametrize(
    ("kind", "basis"),
    [
        (RelationshipKind.TOUCHES_TARGET_PATH, RelationshipBasis.VERIFIED),
        (RelationshipKind.CHANGES_TARGET_LINES, RelationshipBasis.VERIFIED),
        (RelationshipKind.BLAMES_TARGET_LINES, RelationshipBasis.VERIFIED),
        (RelationshipKind.DOCUMENTS_TARGET_PATH, RelationshipBasis.VERIFIED),
        (RelationshipKind.MENTIONS_TARGET, RelationshipBasis.VERIFIED),
        (RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET, RelationshipBasis.INFERRED),
    ],
)
def test_relationship_accepts_the_basis_defined_for_its_kind(kind: RelationshipKind, basis: RelationshipBasis) -> None:
    """D8: each kind is accepted with its defined basis."""
    assert RelationshipRecord(kind=kind, basis=basis).basis is basis


@pytest.mark.parametrize(
    ("kind", "basis"),
    [
        (RelationshipKind.MENTIONS_TARGET, RelationshipBasis.INFERRED),
        (RelationshipKind.TOUCHES_TARGET_PATH, RelationshipBasis.INFERRED),
        (RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET, RelationshipBasis.VERIFIED),
    ],
    ids=["mention-inferred", "touch-inferred", "semantic-verified"],
)
def test_relationship_rejects_a_basis_other_than_its_kind(kind: RelationshipKind, basis: RelationshipBasis) -> None:
    """D8: a semantic relation is never VERIFIED, and a literal mention is never only INFERRED."""
    with pytest.raises(ValidationError):
        RelationshipRecord(kind=kind, basis=basis)


def test_relationship_kind_outside_the_vocabulary_is_rejected() -> None:
    """D8: the vocabulary is closed."""
    with pytest.raises(ValidationError):
        RelationshipRecord(kind="RELATED", basis=RelationshipBasis.INFERRED)


# X6: HTTPS source URLs.
@pytest.mark.parametrize(
    "url",
    [
        "http://github.com/django/django/pull/1",
        "https://user:secret@github.com/django/django/pull/1",
        "https:///path-only",
        "javascript:alert(1)",
        "https://github.com/a b",
        "https://github.com/a\nb",
    ],
    ids=["http", "credentials", "no-host", "javascript", "space", "newline"],
)
def test_source_url_must_be_an_https_url_without_credentials(url: str) -> None:
    """X6: only HTTPS URLs without credentials, whitespace, or control characters are accepted."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.PULL_REQUEST, source_url=url))


def test_https_source_url_is_accepted() -> None:
    """X6: an HTTPS URL is accepted unchanged."""
    assert EvidenceItem(**_item(SourceType.PULL_REQUEST)).source_url == PR_URL


# D7 and Requirement 4.1: file paths are normalized repository-relative paths.
@pytest.mark.parametrize(
    "path",
    ["../escape.py", "/abs.py", "a\\b.py", "C:/x.py", "a//b.py", "./a.py", "a/../b.py", "a/", "a\x00b", "a\nb", "a:b.py"],
    ids=[
        "traversal", "absolute", "backslash", "drive", "empty-segment", "dot", "dotdot", "trailing-slash", "nul",
        "newline", "colon",
    ],
)
def test_file_path_must_be_normalized(path: str) -> None:
    """Requirement 4.1 and X8: evidence rejects paths that do not satisfy the normalized form."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.DOCUMENTATION, file_path=path, source_id=documentation_source_id(SHA1, "docs/guide.rst")))


# Requirement 4.3 and 4.4: markers and value states.
@pytest.mark.parametrize("field", sorted(METADATA_FIELDS))
def test_marked_field_that_still_has_a_value_is_rejected(field: str) -> None:
    """Requirement 4.3 and 4.4: a field that holds a value cannot also be marked missing."""
    kind = SourceType.GIT_BLAME
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(kind, unavailable_fields=frozenset({field})))
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(kind, verified_absent_fields=frozenset({field})))


@pytest.mark.parametrize("field", sorted(METADATA_FIELDS))
def test_field_marked_both_unavailable_and_absent_is_rejected(field: str) -> None:
    """Requirement 4.4: the two markers are mutually exclusive."""
    with pytest.raises(ValidationError, match=r"both unavailable and verified absent"):
        EvidenceItem(
            **_item(
                SourceType.ISSUE,
                **{field: None},
                unavailable_fields=frozenset({field}),
                verified_absent_fields=frozenset({field}),
            )
        )


def test_unknown_metadata_marker_name_is_rejected() -> None:
    """Requirement 4.3: marker sets accept only metadata field names."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, unavailable_fields=frozenset({"not_a_field"})))


def test_required_identity_fields_cannot_be_marked() -> None:
    """Requirement 4.3: identity and provenance fields cannot be listed as missing metadata."""
    for name in ("source_id", "repository_namespace", "retrieval_method", "source_type"):
        with pytest.raises(ValidationError):
            EvidenceItem(**_item(SourceType.GIT_COMMIT, unavailable_fields=frozenset({name})))


@pytest.mark.parametrize("field", ["author", "title", "excerpt", "source_url"])
@pytest.mark.parametrize("value", ["", "   ", "\t", "\n  \t"], ids=["empty", "spaces", "tab", "mixed"])
def test_empty_or_whitespace_text_is_a_placeholder_and_is_rejected(field: str, value: str) -> None:
    """Requirement 4.3 and design Property 6: empty or whitespace-only text is never a value."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, **{field: value}))


def test_limitations_is_required_and_may_be_empty() -> None:
    """Requirement 4.1: limitations are stated explicitly, and an empty tuple is an explicit statement."""
    data = _item(SourceType.GIT_COMMIT)
    del data["limitations"]
    with pytest.raises(ValidationError):
        EvidenceItem(**data)
    assert EvidenceItem(**_item(SourceType.GIT_COMMIT, limitations=())).limitations == ()
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, limitations=("   ",)))


def test_model_is_frozen_and_rejects_unknown_fields() -> None:
    """Requirement 4.4: a validated item cannot change in place, and unknown fields are rejected."""
    item = EvidenceItem(**_item(SourceType.GIT_COMMIT))
    with pytest.raises(ValidationError):
        item.title = "changed"
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, ranking=1))


def test_evidence_id_is_not_accepted_as_input() -> None:
    """Task 7.2: the identifier is derived, so a supplied evidence_id is rejected."""
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, evidence_id="ev1_manual"))


def test_relationship_is_optional_with_marker_rules() -> None:
    """D8: relationship is optional and follows the generic marker rules."""
    EvidenceItem(**_item(SourceType.GIT_COMMIT, relationship=None, unavailable_fields=frozenset({"relationship"})))
    with pytest.raises(ValidationError):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, relationship=None))


def test_author_has_no_email_field() -> None:
    """X4: the model stores the author name only."""
    assert "author_email" not in EvidenceItem.model_fields


# Review finding: LineRange bounds and ordering (Requirement 4.5, D7).
@pytest.mark.parametrize(("start", "end", "reason"), [(0, 5, "greater than or equal to 1"), (-3, 5, "greater than or equal to 1"), (6, 5, "start must not be after end")])
def test_line_range_rejects_invalid_bounds(start: int, end: int, reason: str) -> None:
    """D7: line ranges are 1-based, inclusive, and start is not after end."""
    with pytest.raises(ValidationError, match=reason):
        LineRange(start=start, end=end)


def test_line_range_accepts_single_line() -> None:
    """D7: a single line (start equals end) is valid."""
    assert LineRange(start=1, end=1).start == 1


# Review finding: commit_hash must be a full lowercase object name at the model level (DEC-14, D10).
@pytest.mark.parametrize("value", [SHA1[:7], SHA1[:39], SHA1.upper(), SHA1 + "0", SHA1[:40] + "\n"], ids=["abbrev7", "abbrev39", "uppercase", "too-long", "trailing-newline"])
def test_git_commit_rejects_non_full_or_uppercase_commit_hash(value: str) -> None:
    """DEC-14: abbreviated, uppercase, over-long, and newline-terminated commit names are rejected."""
    with pytest.raises(ValidationError, match="full lowercase object name"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, commit_hash=value, source_id=value))


def test_blame_commit_hash_rejects_abbreviated_name() -> None:
    """DEC-14: the optional blamed commit uses the same full-name rule."""
    with pytest.raises(ValidationError, match="full lowercase object name"):
        EvidenceItem(**_item(SourceType.GIT_BLAME, commit_hash=SHA1[:7]))


# Owner decisions U-1 to U-4 (I2 final, 2026-11-11). Each decision has a positive case and negative cases that
# assert the specific rejection reason.

# U-1: CODE_HISTORY file_path is REQUIRED. A marker cannot replace it.
def test_u1_code_history_file_path_accepts_a_value() -> None:
    assert EvidenceItem(**_item(SourceType.CODE_HISTORY)).file_path == PATH


def test_u1_code_history_file_path_without_value_is_rejected() -> None:
    with pytest.raises(ValidationError, match=r"CODE_HISTORY requires file_path"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, file_path=None))


def test_u1_code_history_file_path_marker_is_rejected() -> None:
    with pytest.raises(ValidationError, match=r"CODE_HISTORY requires file_path \(a marker cannot replace it\)"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, file_path=None, unavailable_fields=frozenset({"file_path"})))


# U-2: PULL_REQUEST and ISSUE timestamp is REQUIRED (primary creation time, D5).
# Owner decision C-1, option A (2026-11-11): REQUIRED accepts a value only, and no marker may replace it.
# A source record without a creation timestamp is not a compliant evidence record. Ingestion reports the limitation.
@pytest.mark.parametrize("kind", [SourceType.PULL_REQUEST, SourceType.ISSUE], ids=lambda k: k.value)
def test_u2_timestamp_accepts_a_value(kind: SourceType) -> None:
    assert EvidenceItem(**_item(kind)).timestamp == NOW


@pytest.mark.parametrize("kind", [SourceType.PULL_REQUEST, SourceType.ISSUE], ids=lambda k: k.value)
def test_u2_timestamp_without_value_is_rejected(kind: SourceType) -> None:
    with pytest.raises(ValidationError, match=rf"{kind.value} requires timestamp"):
        EvidenceItem(**_item(kind, timestamp=None))


@pytest.mark.parametrize("kind", [SourceType.PULL_REQUEST, SourceType.ISSUE], ids=lambda k: k.value)
def test_u2_timestamp_marker_is_rejected(kind: SourceType) -> None:
    with pytest.raises(ValidationError, match=rf"{kind.value} requires timestamp \(a marker cannot replace it\)"):
        EvidenceItem(**_item(kind, timestamp=None, unavailable_fields=frozenset({"timestamp"})))


# U-3: GIT_COMMIT file_path and line_range are NOT_APPLICABLE. They are not OPTIONAL.
def test_u3_git_commit_without_path_or_line_is_accepted() -> None:
    item = EvidenceItem(**_item(SourceType.GIT_COMMIT))
    assert item.file_path is None
    assert item.line_range is None


@pytest.mark.parametrize(
    ("field", "value"),
    [("file_path", PATH), ("line_range", LineRange(start=1, end=5))],
    ids=["file_path", "line_range"],
)
def test_u3_git_commit_path_or_line_value_is_rejected(field: str, value: object) -> None:
    with pytest.raises(ValidationError, match=rf"{field} is not applicable to GIT_COMMIT"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, **{field: value}))


@pytest.mark.parametrize("field", ["file_path", "line_range"])
def test_u3_git_commit_path_or_line_marker_is_rejected(field: str) -> None:
    with pytest.raises(ValidationError, match=rf"{field} is not applicable to GIT_COMMIT and cannot carry a marker"):
        EvidenceItem(**_item(SourceType.GIT_COMMIT, unavailable_fields=frozenset({field})))


# U-4: CODE_HISTORY revision is REQUIRED with or without a line range.
def test_u4_code_history_revision_accepted_without_line_range() -> None:
    item = EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, unavailable_fields=frozenset({"line_range"})))
    assert item.revision == SHA1
    assert item.line_range is None


def test_u4_code_history_revision_without_value_is_rejected_without_line_range() -> None:
    with pytest.raises(ValidationError, match=r"CODE_HISTORY requires revision"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, revision=None, change_side=None,
                             unavailable_fields=frozenset({"line_range"})))


def test_u4_code_history_revision_marker_is_rejected_without_line_range() -> None:
    with pytest.raises(ValidationError, match=r"CODE_HISTORY requires revision \(a marker cannot replace it\)"):
        EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, revision=None, change_side=None,
                             unavailable_fields=frozenset({"line_range", "revision"})))


# Owner decision (I2 final closure): CODE_HISTORY canonical identifiers carry the observation revision (X1).
# Records that differ only in revision must get distinct canonical source IDs and distinct evidence IDs. The
# revision is not forced to equal commit_hash.
SHA1_THIRD = "1111111111111111111111111111111111111111"


def test_whole_file_records_differing_only_in_revision_get_distinct_ids() -> None:
    base = EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, unavailable_fields=frozenset({"line_range"})))
    other = EvidenceItem(**_item(
        SourceType.CODE_HISTORY,
        line_range=None,
        unavailable_fields=frozenset({"line_range"}),
        revision=SHA1_OTHER,
        source_id=code_history_source_id(SHA1, SHA1_OTHER, PATH),
    ))
    assert base.commit_hash == other.commit_hash == SHA1
    assert base.file_path == other.file_path == PATH
    assert base.canonical_source_id != other.canonical_source_id
    assert base.evidence_id != other.evidence_id


def test_line_range_records_differing_only_in_revision_get_distinct_ids() -> None:
    def pre_change(revision: str) -> EvidenceItem:
        return EvidenceItem(**_item(
            SourceType.CODE_HISTORY,
            line_range=LineRange(start=1, end=5),
            unavailable_fields=frozenset(),
            revision=revision,
            change_side=ChangeSide.PRE_CHANGE,
            source_id=code_history_range_source_id(SHA1, revision, PATH, 1, 5),
        ))

    first, second = pre_change(SHA1_OTHER), pre_change(SHA1_THIRD)
    assert first.canonical_source_id != second.canonical_source_id
    assert first.evidence_id != second.evidence_id


def test_whole_file_and_post_change_range_at_the_same_revision_get_distinct_ids() -> None:
    whole = EvidenceItem(**_item(SourceType.CODE_HISTORY, line_range=None, unavailable_fields=frozenset({"line_range"})))
    post = EvidenceItem(**_item(
        SourceType.CODE_HISTORY,
        line_range=LineRange(start=1, end=5),
        unavailable_fields=frozenset(),
        revision=SHA1,
        change_side=ChangeSide.POST_CHANGE,
        source_id=code_history_range_source_id(SHA1, SHA1, PATH, 1, 5),
    ))
    assert whole.canonical_source_id != post.canonical_source_id
    assert whole.evidence_id != post.evidence_id
