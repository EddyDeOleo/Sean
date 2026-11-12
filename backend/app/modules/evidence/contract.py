"""Evidence contract vocabulary and the source-type applicability matrix (I2 owner decisions D1, D4 to D8, X1).

Applicability states, from the owner's direction:
- REQUIRED: a value is mandatory. A marker cannot replace it.
- OPTIONAL: a value, or exactly one explicit unavailable or verified-absent marker.
- NOT_APPLICABLE: neither a value nor a marker. This is a model rule, not a third missing-value marker.
- REQUIRED_WITH_LINE_RANGE: REQUIRED when a line range is present, otherwise NOT_APPLICABLE.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal, get_args


class SourceType(StrEnum):
    """Source types that Requirement 4.2 and Spec 1 section 8 must distinguish."""

    GIT_COMMIT = "GIT_COMMIT"
    GIT_BLAME = "GIT_BLAME"
    CODE_HISTORY = "CODE_HISTORY"
    DOCUMENTATION = "DOCUMENTATION"
    PULL_REQUEST = "PULL_REQUEST"
    ISSUE = "ISSUE"


class ChangeSide(StrEnum):
    """Which side of a change a CODE_HISTORY line range describes (X1)."""

    PRE_CHANGE = "PRE_CHANGE"
    POST_CHANGE = "POST_CHANGE"


class SourceVerification(StrEnum):
    """What Sean verified about the source at retrieval time (D6). Not a content-correctness claim."""

    VERIFIED_IN_REPOSITORY = "VERIFIED_IN_REPOSITORY"
    VALIDATED_RECORD_IDENTITY = "VALIDATED_RECORD_IDENTITY"
    NOT_PERFORMED = "NOT_PERFORMED"


class RelationshipKind(StrEnum):
    """Controlled relationship vocabulary to the investigated target (D8)."""

    TOUCHES_TARGET_PATH = "TOUCHES_TARGET_PATH"
    CHANGES_TARGET_LINES = "CHANGES_TARGET_LINES"
    BLAMES_TARGET_LINES = "BLAMES_TARGET_LINES"
    DOCUMENTS_TARGET_PATH = "DOCUMENTS_TARGET_PATH"
    MENTIONS_TARGET = "MENTIONS_TARGET"
    SEMANTICALLY_RELATES_TO_TARGET = "SEMANTICALLY_RELATES_TO_TARGET"


class RelationshipBasis(StrEnum):
    """Epistemic basis of a relationship (D8)."""

    VERIFIED = "VERIFIED"
    INFERRED = "INFERRED"


class Applicability(StrEnum):
    REQUIRED = "REQUIRED"
    OPTIONAL = "OPTIONAL"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    REQUIRED_WITH_LINE_RANGE = "REQUIRED_WITH_LINE_RANGE"


MetadataField = Literal[
    "source_url",
    "commit_hash",
    "revision",
    "change_side",
    "file_path",
    "line_range",
    "author",
    "timestamp",
    "event_timestamps",
    "title",
    "excerpt",
    "relationship",
]
METADATA_FIELDS: frozenset[str] = frozenset(get_args(MetadataField))

# Pull request and issue identifiers are positive decimal numbers (D9). Other types use composite or commit names.
NUMBERED_TYPES: frozenset[SourceType] = frozenset({SourceType.PULL_REQUEST, SourceType.ISSUE})
GIT_TYPES: frozenset[SourceType] = frozenset(
    {SourceType.GIT_COMMIT, SourceType.GIT_BLAME, SourceType.CODE_HISTORY, SourceType.DOCUMENTATION}
)
GITHUB_TYPES: frozenset[SourceType] = frozenset({SourceType.PULL_REQUEST, SourceType.ISSUE})

# Each relationship kind has exactly one basis (D8). A literal mention is VERIFIED. A semantic relation is never
# VERIFIED, because a relation a source states directly is represented as a mention or a structural kind.
RELATIONSHIP_BASIS: dict[RelationshipKind, RelationshipBasis] = {
    RelationshipKind.TOUCHES_TARGET_PATH: RelationshipBasis.VERIFIED,
    RelationshipKind.CHANGES_TARGET_LINES: RelationshipBasis.VERIFIED,
    RelationshipKind.BLAMES_TARGET_LINES: RelationshipBasis.VERIFIED,
    RelationshipKind.DOCUMENTS_TARGET_PATH: RelationshipBasis.VERIFIED,
    RelationshipKind.MENTIONS_TARGET: RelationshipBasis.VERIFIED,
    RelationshipKind.SEMANTICALLY_RELATES_TO_TARGET: RelationshipBasis.INFERRED,
}

_R = Applicability.REQUIRED
_O = Applicability.OPTIONAL
_N = Applicability.NOT_APPLICABLE
_RWL = Applicability.REQUIRED_WITH_LINE_RANGE


def _row(**states: Applicability) -> dict[str, Applicability]:
    """Build one matrix row and fail if any metadata field is missing or unknown."""
    if set(states) != METADATA_FIELDS:
        raise ValueError(f"matrix row must state every metadata field; differs by {set(states) ^ METADATA_FIELDS}")
    return dict(states)


APPLICABILITY: dict[SourceType, dict[str, Applicability]] = {
    SourceType.GIT_COMMIT: _row(
        source_url=_O,
        commit_hash=_R,
        revision=_N,
        change_side=_N,
        file_path=_N,
        line_range=_N,
        author=_O,
        timestamp=_O,
        event_timestamps=_N,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
    SourceType.GIT_BLAME: _row(
        source_url=_O,
        commit_hash=_O,
        revision=_R,
        change_side=_N,
        file_path=_R,
        line_range=_R,
        author=_O,
        timestamp=_O,
        event_timestamps=_N,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
    SourceType.CODE_HISTORY: _row(
        source_url=_O,
        commit_hash=_R,
        revision=_R,
        change_side=_RWL,
        file_path=_R,
        line_range=_O,
        author=_O,
        timestamp=_O,
        event_timestamps=_N,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
    SourceType.DOCUMENTATION: _row(
        source_url=_O,
        commit_hash=_R,
        revision=_N,
        change_side=_N,
        file_path=_R,
        line_range=_N,
        author=_O,
        timestamp=_O,
        event_timestamps=_N,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
    SourceType.PULL_REQUEST: _row(
        source_url=_O,
        commit_hash=_O,
        revision=_N,
        change_side=_N,
        file_path=_N,
        line_range=_N,
        author=_O,
        timestamp=_R,
        event_timestamps=_O,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
    SourceType.ISSUE: _row(
        source_url=_O,
        commit_hash=_O,
        revision=_N,
        change_side=_N,
        file_path=_N,
        line_range=_N,
        author=_O,
        timestamp=_R,
        event_timestamps=_N,
        title=_O,
        excerpt=_O,
        relationship=_O,
    ),
}
