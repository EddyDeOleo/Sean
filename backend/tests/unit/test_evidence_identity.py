"""Unit tests for app.modules.evidence.identity (Evidence Retrieval task 7.2, owner decisions D11 and O12).

The evidence_id derivation is deterministic, versioned, and uses only the repository namespace, the source type,
and the canonical source identifier. Titles, excerpts, timestamps, retrieval time, ranking, and relationships
never enter it. The collision vectors below are explicit, because the composite identifiers must stay injective.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest

from app.modules.evidence.contract import RelationshipBasis, RelationshipKind, SourceType, SourceVerification
from app.modules.evidence.identity import (
    EVIDENCE_ID_VERSION,
    blame_source_id,
    canonical_decimal,
    derive_evidence_id,
    encode_path,
    code_history_range_source_id,
    code_history_source_id,
    documentation_source_id,
    is_positive_decimal,
)
from app.modules.evidence.models import EventTimestamps, EvidenceItem, IntegrityRecord, RelationshipRecord

SHA1 = "9e7cc2b628fe8fd3895986af9b7fc9525034c1b0"
SHA1_OTHER = "0123456789abcdef0123456789abcdef01234567"
SHA256 = "ab" * 32
NOW = datetime(2024, 5, 1, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    ("path", "encoded"),
    [
        ("src/a.py", "src/a.py"),
        ("a b.py", "a%20b.py"),
        ("x:y.py", "x%3Ay.py"),
        ("100%.md", "100%25.md"),
        ("café.md", "caf%C3%A9.md"),
        ("docs/Guide-1_2~3.rst", "docs/Guide-1_2~3.rst"),
        ("A/B", "A/B"),
        ("\u20ac.txt", "%E2%82%AC.txt"),
    ],
    ids=["plain", "space", "colon", "percent", "accent", "unreserved", "case-kept", "euro"],
)
def test_path_encoding_vectors(path: str, encoded: str) -> None:
    """D11: percent-encoding is over UTF-8 bytes, with uppercase escapes and case preserved."""
    assert encode_path(path) == encoded


def test_path_encoding_preserves_case_and_does_not_normalize_unicode() -> None:
    """D11: no case folding and no Unicode normalization. Two spellings stay two distinct paths."""
    composed = "caf\u00e9.md"
    decomposed = "cafe\u0301.md"
    assert encode_path(composed) != encode_path(decomposed)
    assert encode_path("README.md") != encode_path("readme.md")


@pytest.mark.parametrize(("value", "expected"), [("1", "1"), ("01", "1"), ("0001", "1"), ("123", "123")])
def test_canonical_decimal_removes_leading_zeros(value: str, expected: str) -> None:
    """D11: leading zeros are removed for identity only, after validation."""
    assert is_positive_decimal(value)
    assert canonical_decimal(value) == expected


@pytest.mark.parametrize("value", ["0", "00", "", "-1", "1a", " 1"])
def test_is_positive_decimal_rejects_non_positive_and_non_decimal(value: str) -> None:
    """D9: zero, signs, letters, and whitespace are not positive decimal identifiers."""
    assert not is_positive_decimal(value)


def test_evidence_id_has_version_prefix_and_sha256_digest_length() -> None:
    """O12: the identifier is the version prefix plus a 64-character SHA-256 hexadecimal digest."""
    identifier = derive_evidence_id("django", "GIT_COMMIT", SHA1)
    assert identifier.startswith(f"{EVIDENCE_ID_VERSION}_")
    assert len(identifier) == len(EVIDENCE_ID_VERSION) + 1 + 64
    assert all(ch in "0123456789abcdef" for ch in identifier.split("_", 1)[1])


def test_evidence_id_is_deterministic() -> None:
    """O12: identical inputs always produce identical identifiers."""
    assert derive_evidence_id("django", "GIT_COMMIT", SHA1) == derive_evidence_id("django", "GIT_COMMIT", SHA1)


def test_different_namespaces_produce_different_identifiers() -> None:
    """Requirement 1.2 and Property 5: the same source in two repositories is two evidence items."""
    assert derive_evidence_id("django", "GIT_COMMIT", SHA1) != derive_evidence_id("flask", "GIT_COMMIT", SHA1)


def test_different_source_types_produce_different_identifiers() -> None:
    """O12: the source type is part of the identity."""
    assert derive_evidence_id("django", "CODE_HISTORY", "x") != derive_evidence_id("django", "DOCUMENTATION", "x")


def test_different_canonical_source_ids_produce_different_identifiers() -> None:
    """O12: distinct canonical source identifiers produce distinct evidence identifiers."""
    assert derive_evidence_id("django", "ISSUE", "42") != derive_evidence_id("django", "ISSUE", "43")


def test_length_prefix_prevents_field_boundary_collisions() -> None:
    """O12: the length-prefixed serialization cannot be fooled by moving characters between fields."""
    assert derive_evidence_id("ab", "GIT_COMMIT", "c") != derive_evidence_id("a", "GIT_COMMIT", "bc")


def _pr(source_id: str, **overrides: Any) -> EvidenceItem:
    data: dict[str, Any] = {
        "repository_namespace": "django",
        "source_type": SourceType.PULL_REQUEST,
        "source_id": source_id,
        "retrieval_method": "GitHub REST pull request",
        "limitations": (),
        "integrity": IntegrityRecord(
            retrieved_at=NOW,
            served_from_cache=False,
            source_verification=SourceVerification.VALIDATED_RECORD_IDENTITY,
            content_digest=None,
        ),
        "source_url": "https://github.com/django/django/pull/1",
        "commit_hash": SHA1_OTHER,
        "revision": None,
        "change_side": None,
        "file_path": None,
        "line_range": None,
        "author": "Jane",
        "timestamp": NOW,
        "event_timestamps": EventTimestamps(merged_at=NOW, closed_at=None),
        "title": "Title",
        "excerpt": "Excerpt",
        "relationship": RelationshipRecord(kind=RelationshipKind.MENTIONS_TARGET, basis=RelationshipBasis.VERIFIED),
        "unavailable_fields": frozenset(),
        "verified_absent_fields": frozenset(),
    }
    data.update(overrides)
    return EvidenceItem(**data)


def test_leading_zero_pr_identifier_has_the_same_evidence_id_as_its_canonical_form() -> None:
    """D9 and D11: '0123' and '123' are one record. The stored source_id still shows what was given."""
    padded = _pr("0123")
    canonical = _pr("123")
    assert padded.source_id == "0123"
    assert padded.evidence_id == canonical.evidence_id


def test_evidence_id_ignores_mutable_metadata() -> None:
    """Requirement 4.5 and Property 5: titles, excerpts, timestamps, retrieval time, and relationships do not change it."""
    base = _pr("123")
    changed = _pr(
        "123",
        title="A completely different title",
        excerpt="A different excerpt",
        author="Someone Else",
        timestamp=datetime(2025, 1, 1, 0, 0, tzinfo=UTC),
        relationship=RelationshipRecord(kind=RelationshipKind.MENTIONS_TARGET, basis=RelationshipBasis.VERIFIED),
        integrity=IntegrityRecord(
            retrieved_at=datetime(2026, 1, 1, 0, 0, tzinfo=UTC),
            served_from_cache=False,
            source_verification=SourceVerification.VALIDATED_RECORD_IDENTITY,
            content_digest=None,
        ),
    )
    assert base.evidence_id == changed.evidence_id


def test_evidence_id_is_not_accepted_as_input_and_is_computed_from_the_record() -> None:
    """Task 7.2: the identifier is derived from namespace, source type, and canonical source_id."""
    item = _pr("123")
    assert item.evidence_id == derive_evidence_id("django", "PULL_REQUEST", "123")


def test_composite_blame_identifiers_are_distinct_for_distinct_records() -> None:
    """D11: ranges, revisions, and paths that differ give distinct canonical identifiers."""
    ids = {
        blame_source_id(SHA1, "a.py", 1, 2),
        blame_source_id(SHA1, "a.py", 1, 3),
        blame_source_id(SHA1, "a.py", 2, 3),
        blame_source_id(SHA1_OTHER, "a.py", 1, 2),
        blame_source_id(SHA1, "b.py", 1, 2),
    }
    assert len(ids) == 5


@pytest.mark.parametrize(
    ("first", "second"),
    [
        (("a:b.py", 1, 2), ("a", 1, 2)),
        (("a%3Ab.py", 1, 2), ("a:b.py", 1, 2)),
        (("a b.py", 1, 2), ("a%20b.py", 1, 2)),
        (("100%.md", 1, 2), ("100%25.md", 1, 2)),
    ],
    ids=["colon-vs-split", "escaped-vs-literal-colon", "space-vs-escaped-space", "percent-vs-escaped-percent"],
)
def test_path_delimiter_and_escape_characters_cannot_collide(
    first: tuple[str, int, int], second: tuple[str, int, int]
) -> None:
    """D11: a colon, a percent sign, or a space inside a path never collides with another record."""
    assert blame_source_id(SHA1, *first) != blame_source_id(SHA1, *second)


def test_unicode_paths_are_distinct_by_their_bytes() -> None:
    """D11: UTF-8 byte-based encoding keeps accented and unaccented spellings distinct."""
    assert documentation_source_id(SHA1, "caf\u00e9.md") != documentation_source_id(SHA1, "cafe.md")


def test_pre_and_post_change_ranges_have_distinct_identifiers() -> None:
    """X1 and D11: the two sides of one change are distinct records, because their revisions differ."""
    pre = code_history_range_source_id(SHA1, SHA1_OTHER, "a.py", 1, 5)
    post = code_history_range_source_id(SHA1, SHA1, "a.py", 1, 5)
    assert pre != post


def test_composite_form_of_a_range_differs_from_the_whole_file_form() -> None:
    """D11: a range record and a whole-file record for the same commit, revision, and path are distinct."""
    assert code_history_range_source_id(SHA1, SHA1, "a.py", 1, 5) != code_history_source_id(SHA1, SHA1, "a.py")


def test_identifier_set_is_injective_over_a_tricky_path_table() -> None:
    """D11: across a table of awkward paths and ranges, no two distinct records share a canonical identifier."""
    paths = ["a", "a:b", "a%3Ab", "a b", "a%20b", "a/b", "a%2Fb", "%", "%%", "x:1-2", "é", "e\u0301", "a.py", "A.py"]
    ranges = [(1, 1), (1, 2), (2, 1), (10, 20)]
    seen: dict[str, tuple[str, int, int]] = {}
    for path in paths:
        for start, end in ranges:
            identifier = blame_source_id(SHA1, path, start, end)
            assert identifier not in seen, f"{identifier!r} from {(path, start, end)} collides with {seen[identifier]}"
            seen[identifier] = (path, start, end)


def test_identifiers_are_stable_across_repeated_derivation() -> None:
    """D11: repeated derivation from the same fields gives the same identifier."""
    first = blame_source_id(SHA256, "docs/x.rst", 3, 9)
    second = blame_source_id(SHA256, "docs/x.rst", 3, 9)
    assert first == second


def test_composite_identifier_requires_no_title_or_description() -> None:
    """Requirement 4.5: identity components are commit names, paths, and ranges, never titles or descriptions."""
    assert "title" not in blame_source_id.__code__.co_varnames
    assert "excerpt" not in code_history_range_source_id.__code__.co_varnames


def test_sha256_composite_identifiers_are_accepted_by_the_model() -> None:
    """DEC-14 as updated: a SHA-256 commit in a composite identifier is valid across the model."""
    item = EvidenceItem(
        repository_namespace="django",
        source_type=SourceType.CODE_HISTORY,
        source_id=code_history_source_id(SHA256, SHA256, "a.py"),
        retrieval_method="git log",
        limitations=(),
        integrity=IntegrityRecord(
            retrieved_at=NOW,
            served_from_cache=False,
            source_verification=SourceVerification.VERIFIED_IN_REPOSITORY,
            content_digest=None,
        ),
        source_url=None,
        commit_hash=SHA256,
        revision=SHA256,
        change_side=None,
        file_path="a.py",
        line_range=None,
        author=None,
        timestamp=None,
        event_timestamps=None,
        title=None,
        excerpt=None,
        relationship=None,
        unavailable_fields=frozenset({"source_url", "author", "timestamp", "title", "excerpt", "relationship", "line_range"}),
        verified_absent_fields=frozenset(),
    )
    assert item.evidence_id.startswith("ev1_")
    assert item.canonical_source_id == code_history_source_id(SHA256, SHA256, "a.py")


# CODE_HISTORY identity (owner decision, I2 final closure): <commit>:<revision>:<path_enc>, and the same with
# :<start>-<end> for a line range. Both Git names are validated with the shared contract.
SHA1_THIRD = "1111111111111111111111111111111111111111"


def test_whole_file_identifier_has_commit_revision_and_encoded_path_in_order() -> None:
    assert code_history_source_id(SHA1, SHA1_OTHER, "a b.py") == f"{SHA1}:{SHA1_OTHER}:a%20b.py"


def test_line_range_identifier_appends_the_inclusive_range() -> None:
    assert code_history_range_source_id(SHA1, SHA1_OTHER, "a.py", 3, 9) == f"{SHA1}:{SHA1_OTHER}:a.py:3-9"


def test_whole_file_records_differing_only_in_revision_have_distinct_canonical_ids() -> None:
    """Collision case from the closure report: same commit and path, different observation revisions."""
    first = code_history_source_id(SHA1, SHA1, "a.py")
    second = code_history_source_id(SHA1, SHA1_OTHER, "a.py")
    assert first != second


def test_line_range_records_differing_only_in_revision_have_distinct_canonical_ids() -> None:
    first = code_history_range_source_id(SHA1, SHA1_OTHER, "a.py", 1, 5)
    second = code_history_range_source_id(SHA1, SHA1_THIRD, "a.py", 1, 5)
    assert first != second


def test_whole_file_and_line_range_records_never_share_an_identifier() -> None:
    whole = code_history_source_id(SHA1, SHA1_OTHER, "a.py")
    ranged = code_history_range_source_id(SHA1, SHA1_OTHER, "a.py", 1, 5)
    assert whole != ranged
    assert ranged.startswith(whole + ":")


def test_code_history_identifiers_are_injective_over_paths_revisions_and_ranges() -> None:
    """Colons and percent signs in paths are encoded, so no path can imitate a revision or a range."""
    paths = ["a.py", "a:1-2", "a%3A1-2", "a:b", "a/b", "é.md"]
    revisions = [SHA1, SHA1_OTHER, SHA1_THIRD]
    seen: dict[str, tuple[str, str, str]] = {}
    for path in paths:
        for revision in revisions:
            candidates = [("whole", "", code_history_source_id(SHA1, revision, path))]
            for start, end in [(1, 2), (1, 3), (2, 2)]:
                candidates.append(("range", f"{start}-{end}", code_history_range_source_id(SHA1, revision, path, start, end)))
            for kind, detail, identifier in candidates:
                key = (path, revision, f"{kind}:{detail}")
                assert identifier not in seen, f"{identifier!r} from {key} collides with {seen[identifier]}"
                seen[identifier] = key


def test_code_history_builders_reject_abbreviated_and_uppercase_names() -> None:
    """DEC-14 and D10: commit and revision must be full lowercase object names in every CODE_HISTORY identifier."""
    for bad in (SHA1[:7], SHA1.upper(), SHA1 + "0"):
        with pytest.raises(ValueError, match="full 40 or 64 character lowercase Git object names"):
            code_history_source_id(SHA1, bad, "a.py")
        with pytest.raises(ValueError, match="full 40 or 64 character lowercase Git object names"):
            code_history_range_source_id(bad, SHA1, "a.py", 1, 2)


def test_documentation_identifier_is_unchanged_by_the_code_history_decision() -> None:
    """DOCUMENTATION keeps <commit>:<path_enc>. The CODE_HISTORY revision dimension does not apply to it."""
    assert documentation_source_id(SHA1, "docs/a.rst") == f"{SHA1}:docs/a.rst"
