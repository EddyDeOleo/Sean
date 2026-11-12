"""Repository registry: read-only loading, validation, and resolution.

Implements Evidence Retrieval Requirements 1.1 to 1.7 (task 1.1 to 1.3) and the design section
"Repository registration and selection". The Git work-tree check is limited to the presence of a
.git entry; full verification waits for the guarded Git runner (task 3). Sean reads the registry
file and never writes it. External callers pass only a repository_id, never a path.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.core.paths import local_data_dir

SCHEMA_VERSION = 1
from app.core.limits import MAX_REGISTRY_BYTES, MAX_ROOT_LENGTH
REGISTRY_FILE_NAME = "repositories.json"

REPOSITORY_ID_PATTERN = r"^[a-z0-9][a-z0-9_-]{0,63}$"
# GitHub owner: 1 to 39 characters, alphanumeric with single hyphens, no leading or trailing hyphen.
GITHUB_OWNER_PATTERN = r"^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$"
GITHUB_NAME_PATTERN = r"^[A-Za-z0-9._-]{1,100}$"

# Caller-facing error codes (Spec 1 section 22; design.md, Repository registration).
REPOSITORY_NOT_FOUND = "REPOSITORY_NOT_FOUND"
REPOSITORY_UNAVAILABLE = "REPOSITORY_UNAVAILABLE"
GITHUB_IDENTITY_UNRESOLVED = "GITHUB_IDENTITY_UNRESOLVED"

# Startup problem codes. They describe the registry file or one entry, and they never contain paths.
PROBLEM_LOCATION_UNAVAILABLE = "REGISTRY_LOCATION_UNAVAILABLE"
PROBLEM_MISSING = "REGISTRY_MISSING"
PROBLEM_UNREADABLE = "REGISTRY_UNREADABLE"
PROBLEM_TOO_LARGE = "REGISTRY_TOO_LARGE"
PROBLEM_INVALID_JSON = "REGISTRY_INVALID_JSON"
PROBLEM_UNSUPPORTED_VERSION = "REGISTRY_UNSUPPORTED_VERSION"
PROBLEM_INVALID_STRUCTURE = "REGISTRY_INVALID_STRUCTURE"
PROBLEM_INVALID_ENTRY = "ENTRY_INVALID"
PROBLEM_DUPLICATE_ID = "ENTRY_DUPLICATE_ID"
PROBLEM_ROOT_INVALID = "ENTRY_ROOT_INVALID"

_TOP_LEVEL_KEYS = frozenset({"schema_version", "repositories"})


class GitHubIdentity(BaseModel):
    """Explicit GitHub owner and repository name from a registry entry (Requirement 1.7)."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    owner: str = Field(pattern=GITHUB_OWNER_PATTERN)
    name: str = Field(pattern=GITHUB_NAME_PATTERN)

    @field_validator("name")
    @classmethod
    def _reject_dot_segments(cls, value: str) -> str:
        if value in {".", ".."}:
            raise ValueError("name must not be a dot segment")
        return value


class RegistryEntry(BaseModel):
    """One registered repository. Unknown keys are rejected (Requirement 1.1)."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)

    repository_id: str = Field(pattern=REPOSITORY_ID_PATTERN)
    root: str = Field(min_length=1, max_length=MAX_ROOT_LENGTH)
    github: GitHubIdentity | None = None


@dataclass(frozen=True)
class RegistryProblem:
    """A reason the registry file or one entry was excluded. Carries no paths or input values."""

    code: str
    detail: str
    entry_index: int | None = None


@dataclass(frozen=True)
class LoadedRegistry:
    """Valid entries keyed by repository_id, plus every problem found while loading."""

    entries: dict[str, RegistryEntry]
    problems: tuple[RegistryProblem, ...]


@dataclass(frozen=True)
class ResolvedRepository:
    """A registered repository whose root was checked at the time of the call."""

    repository_id: str
    root: Path
    github: GitHubIdentity | None


class RepositoryError(Exception):
    """A caller-facing failure. The message is the error code only."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class _RootCheckError(Exception):
    """The root is not a usable local Git checkout. The message names the reason only."""


def default_registry_path() -> Path | None:
    """Return %LOCALAPPDATA%\\Sean\\config\\repositories.json, or None when LOCALAPPDATA is unset.

    The data directory comes from `core`; this module adds only the registry file location.
    """
    data_dir = local_data_dir()
    if data_dir is None:
        return None
    return data_dir / "config" / REGISTRY_FILE_NAME


def load_registry(path: Path | None) -> LoadedRegistry:
    """Read and validate the registry once at startup. Never writes the file.

    A file-level failure leaves zero repositories registered and reports the cause.
    An invalid entry, a duplicate repository_id, or an unusable root excludes only that entry.
    """
    if path is None:
        return _failed(PROBLEM_LOCATION_UNAVAILABLE, "LOCALAPPDATA is not set")
    if not path.exists():
        return _failed(PROBLEM_MISSING, "registry file was not found")
    try:
        # Read at most one byte past the limit, so a file that grows after stat() is still bounded.
        with path.open("rb") as handle:
            raw = handle.read(MAX_REGISTRY_BYTES + 1)
    except OSError:
        return _failed(PROBLEM_UNREADABLE, "registry file cannot be accessed")
    if len(raw) > MAX_REGISTRY_BYTES:
        return _failed(PROBLEM_TOO_LARGE, "registry file exceeds the size limit")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        return _failed(PROBLEM_UNREADABLE, "registry file cannot be read as UTF-8")
    try:
        document = json.loads(text, object_pairs_hook=_object_without_duplicate_keys)
    except (ValueError, RecursionError):
        # ValueError covers JSONDecodeError and the duplicate-key error. RecursionError comes from
        # deeply nested input that fits within the size limit.
        return _failed(PROBLEM_INVALID_JSON, "registry is not valid JSON or repeats a key")
    return _load_document(document)


def resolve_repository(registry: LoadedRegistry, repository_id: str) -> ResolvedRepository:
    """Resolve a repository_id, re-checking its root on every call (Requirements 1.3, 1.6)."""
    entry = registry.entries.get(repository_id) if isinstance(repository_id, str) else None
    if entry is None:
        raise RepositoryError(REPOSITORY_NOT_FOUND)
    try:
        root = _check_root(entry.root)
    except (_RootCheckError, ValueError):
        # ValueError: a root that cannot be resolved, such as one with an embedded NUL character.
        raise RepositoryError(REPOSITORY_UNAVAILABLE) from None
    return ResolvedRepository(repository_id=entry.repository_id, root=root, github=entry.github)


def resolve_github_identity(registry: LoadedRegistry, repository_id: str) -> GitHubIdentity:
    """Return the explicit GitHub identity. Never derive it from a Git remote (Requirement 1.7)."""
    resolved = resolve_repository(registry, repository_id)
    if resolved.github is None:
        raise RepositoryError(GITHUB_IDENTITY_UNRESOLVED)
    return resolved.github


def _failed(code: str, detail: str) -> LoadedRegistry:
    return LoadedRegistry(entries={}, problems=(RegistryProblem(code, detail),))


def _object_without_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate key")
        result[key] = value
    return result


def _load_document(document: Any) -> LoadedRegistry:
    if not isinstance(document, dict):
        return _failed(PROBLEM_INVALID_STRUCTURE, "top level must be a JSON object")
    if "schema_version" not in document:
        return _failed(PROBLEM_INVALID_STRUCTURE, "schema_version is required")
    version = document["schema_version"]
    # type() check: bool is a subclass of int, so True must not pass as version 1.
    if type(version) is not int or version != SCHEMA_VERSION:
        return _failed(PROBLEM_UNSUPPORTED_VERSION, "schema_version is not supported")
    if set(document) - _TOP_LEVEL_KEYS:
        return _failed(PROBLEM_INVALID_STRUCTURE, "unknown top-level key")
    raw_entries = document.get("repositories")
    if not isinstance(raw_entries, list):
        return _failed(PROBLEM_INVALID_STRUCTURE, "repositories must be an array")

    problems: list[RegistryProblem] = []
    valid: list[tuple[int, RegistryEntry]] = []
    for index, raw_entry in enumerate(raw_entries):
        try:
            entry = RegistryEntry.model_validate(raw_entry)
        except ValidationError as error:
            problems.append(
                RegistryProblem(PROBLEM_INVALID_ENTRY, _describe_validation(error), index)
            )
            continue
        valid.append((index, entry))

    counts = Counter(entry.repository_id for _, entry in valid)
    entries: dict[str, RegistryEntry] = {}
    for index, entry in valid:
        if counts[entry.repository_id] > 1:
            problems.append(
                RegistryProblem(PROBLEM_DUPLICATE_ID, "repository_id is not unique", index)
            )
            continue
        try:
            _check_root(entry.root)
        except _RootCheckError as error:
            problems.append(RegistryProblem(PROBLEM_ROOT_INVALID, str(error), index))
            continue
        entries[entry.repository_id] = entry
    return LoadedRegistry(entries=entries, problems=tuple(problems))


def _describe_validation(error: ValidationError) -> str:
    # Report only field names from the schema and error types. Input values and caller-supplied
    # key names are never echoed, so an unknown key is reported without its name.
    parts = []
    for item in error.errors():
        if item["type"] == "extra_forbidden":
            parts.append("unknown field")
            continue
        location = ".".join(str(part) for part in item["loc"]) or "entry"
        parts.append(f"{location}: {item['type']}")
    return "; ".join(parts)


def _check_root(root_text: str) -> Path:
    """Check that a root is an absolute, existing directory with a .git entry.

    Full Git work-tree verification needs the guarded Git runner (task 3) and is not done here.
    """
    candidate = Path(root_text)
    if not candidate.is_absolute():
        raise _RootCheckError("root is not an absolute path")
    try:
        resolved = candidate.resolve(strict=True)
    except OSError:
        raise _RootCheckError("root does not exist or cannot be accessed") from None
    if not resolved.is_dir():
        raise _RootCheckError("root is not a directory")
    if not (resolved / ".git").exists():
        raise _RootCheckError("root has no .git entry")
    return resolved
