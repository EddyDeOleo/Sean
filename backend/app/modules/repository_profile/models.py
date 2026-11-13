"""Repository profile models (Spec 4 section 5).

A profile is a list of typed observations plus a small summary. Every observation records how it was obtained. The
Advisor cites observation IDs as evidence, so a recommendation can always be traced to something that was read.

Classification follows the project rule: DOCUMENTED is a directly observed fact (a path exists in the committed tree, a
dependency is named in a manifest, a commit subject matches a pattern). INFERRED is a reading of a pattern.
"""

from __future__ import annotations

import hashlib
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ObservationKind = Literal[
    "LANGUAGE",
    "MANIFEST",
    "FRAMEWORK",
    "TOOLING",
    "INTEGRATION",
    "TEST_LAYOUT",
    "CI_CONFIG",
    "DOCUMENTATION",
    "CONVENTION",
    "KIRO_CONFIG",
    "SENSITIVE_PATH",
    "GENERATED_TRACKED",
    "SCRIPT_SET",
    "COMMIT_STATS",
    "FIX_RECURRENCE",
    "AREA",
]
ObservationClassification = Literal["DOCUMENTED", "INFERRED"]
ObservationSource = Literal["GIT_TREE", "GIT_BLOB", "GIT_LOG"]
ObservationRole = Literal["TEST_TOOL", "LINT_TOOL", "BUILD_TOOL", "SCRIPT"]

# Values of Observation.value for kind KIRO_CONFIG.
KIRO_STEERING = "STEERING"
KIRO_SPECS = "SPECS"
KIRO_HOOKS = "HOOKS"
KIRO_AGENTS = "AGENTS"
KIRO_SKILLS = "SKILLS"
KIRO_MCP = "MCP"
KIRO_IGNORE = "KIROIGNORE"
KIRO_AGENTS_MD = "AGENTS_MD"


# Limitation codes after which "nothing was found" cannot be taken as "nothing exists". The scanner defines the same strings.
INCOMPLETE_CODES = frozenset(
    {"TREE_TRUNCATED", "SHALLOW_CLONE", "MANIFEST_NOT_READ", "UNREADABLE_PATHS_SKIPPED", "HISTORY_UNREADABLE", "OBSERVATIONS_CAPPED"}
)


def observation_id(kind: str, path: str | None, value: str | None) -> str:
    """A stable identifier derived from what was observed, so repeated scans of one commit agree."""
    digest = hashlib.sha256(f"{kind}\x00{path or ''}\x00{value or ''}".encode("utf-8", "replace")).hexdigest()
    return f"obs-{digest[:12]}"


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    observation_id: str
    kind: ObservationKind
    path: str | None = None
    value: str | None = None
    count: int | None = None
    role: ObservationRole | None = None
    classification: ObservationClassification
    source: ObservationSource
    explanation: str


class AreaSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    name: str
    source_files: int
    test_files: int


class LanguageSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    language: str
    files: int


class HistorySummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    commits_scanned: int
    fix_commits: int
    feature_commits: int
    revert_commits: int
    conventional_commits: int
    distinct_authors: int


class ProfileLimitation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    code: str
    message: str


class ProfileSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    tree_entries: int
    source_files: int
    test_files: int
    languages: list[LanguageSummary]
    areas: list[AreaSummary]
    history: HistorySummary


class RepositoryProfile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    repository_id: str
    head: str
    basis: Literal["COMMITTED_TREE"] = "COMMITTED_TREE"
    truncated: bool
    history_limited: bool
    shallow: bool
    summary: ProfileSummary
    observations: list[Observation] = Field(default_factory=list)
    limitations: list[ProfileLimitation] = Field(default_factory=list)

    def incomplete_reasons(self) -> list[str]:
        """Messages of every limitation that can hide a signal. A negative finding from an incomplete scan is not reliable."""
        return [item.message for item in self.limitations if item.code in INCOMPLETE_CODES]

    def is_incomplete(self) -> bool:
        return self.truncated or self.shallow or bool(self.incomplete_reasons())

    def find(self, kind: str, *, value: str | None = None) -> list[Observation]:
        return [o for o in self.observations if o.kind == kind and (value is None or o.value == value)]

    def by_id(self) -> dict[str, Observation]:
        return {o.observation_id: o for o in self.observations}


class ProfileError(Exception):
    """A profile could not be built. The message is a fixed code and never carries paths or Git output."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code
