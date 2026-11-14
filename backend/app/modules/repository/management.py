r"""Repository management: validated, atomic edits of the registry file (Spec 4 section 16).

This is the only code in Sean that writes a file, and it writes only %LOCALAPPDATA%\Sean\config\repositories.json (plus one
`.bak` copy and a short-lived temp file in the same directory). The registry path comes from `default_registry_path()` or an
injected provider, never from request data. Repositories themselves are never written: adding, editing, or removing an entry
changes the registry file and nothing else.

A change reads the current file, applies one edit to the raw entry list, and writes the whole file atomically. Entries Sean
does not edit are kept exactly as they are, including entries that currently fail validation (for example a repository whose
folder was moved). A file that is missing is created. A file that is unreadable or invalid is never overwritten.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import unicodedata
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

from app.core.git_runner import GitError, run_git
from app.core.limits import MAX_REGISTRY_BYTES, MAX_ROOT_LENGTH
from app.modules.repository.registry import (
    PROBLEM_ROOT_INVALID,
    REGISTRY_FILE_NAME,
    REPOSITORY_ID_PATTERN,
    SCHEMA_VERSION,
    LoadedRegistry,
    RegistryEntry,
    default_registry_path,
    load_registry,
)

logger = logging.getLogger("sean.repositories")

INVALID_INPUT = "INVALID_INPUT"
INVALID_REPOSITORY_ID = "INVALID_REPOSITORY_ID"
INVALID_DISPLAY_NAME = "INVALID_DISPLAY_NAME"
PATH_NOT_FOUND = "PATH_NOT_FOUND"
NOT_A_GIT_REPOSITORY = "NOT_A_GIT_REPOSITORY"
DUPLICATE_ID = "DUPLICATE_ID"
DUPLICATE_PATH = "DUPLICATE_PATH"
REPOSITORY_NOT_FOUND = "REPOSITORY_NOT_FOUND"
REGISTRY_UNAVAILABLE = "REGISTRY_UNAVAILABLE"
REGISTRY_WRITE_FAILED = "REGISTRY_WRITE_FAILED"

MAX_DISPLAY_NAME_LENGTH = 80
BACKUP_SUFFIX = ".bak"
TEMP_PREFIX = REGISTRY_FILE_NAME + ".tmp-"

# One lock for every mutation in this process, whatever store object is used.
_MUTATION_LOCK = threading.Lock()

_ID_PATTERN = re.compile(REPOSITORY_ID_PATTERN)
_DRIVE_ABSOLUTE = re.compile(r"^[A-Za-z]:[\\/]")
_FORBIDDEN_PATH_CHARACTERS = frozenset('<>"|?*')
_RESERVED_NAMES = frozenset({"CON", "PRN", "AUX", "NUL", *(f"COM{n}" for n in range(1, 10)), *(f"LPT{n}" for n in range(1, 10))})


class ManagementError(Exception):
    """A caller-facing failure. `code` is one of the codes above. `extra` holds optional safe response fields."""

    def __init__(self, code: str, detail: str | None = None, **extra: str) -> None:
        super().__init__(code)
        self.code = code
        self.detail = detail
        self.extra = extra


# ------------------------------------------------------------------------------------------------ input validation


def validate_repository_id(value: object) -> str:
    if not isinstance(value, str) or not _ID_PATTERN.fullmatch(value):
        raise ManagementError(INVALID_REPOSITORY_ID)
    return value


def validate_display_name(value: object) -> str:
    if not isinstance(value, str) or not 1 <= len(value) <= MAX_DISPLAY_NAME_LENGTH or not value.strip():
        raise ManagementError(INVALID_DISPLAY_NAME)
    # Control, format (bidi and zero-width), surrogate, and line or paragraph separator characters are refused.
    if any(unicodedata.category(char) in {"Cc", "Cf", "Cs", "Zl", "Zp"} for char in value):
        raise ManagementError(INVALID_DISPLAY_NAME)
    return value


def validate_path_format(value: object) -> str:
    """Check the text of a path without touching the disk. Return it normalized (backslashes, no trailing separator).

    Only absolute drive-letter paths are accepted. UNC (\\\\server\\share) and device (\\\\?\\, \\\\.\\) paths are refused:
    the registry loader accepts them, but opening a network path can send credentials to a remote host.
    """
    if not isinstance(value, str) or not 1 <= len(value) <= MAX_ROOT_LENGTH:
        raise ManagementError(INVALID_INPUT, "path")
    if value != value.strip() or any(unicodedata.category(char) in {"Cc", "Cs"} for char in value):
        raise ManagementError(INVALID_INPUT, "path")
    if not _DRIVE_ABSOLUTE.match(value):
        raise ManagementError(INVALID_INPUT, "path")
    rest = value[2:]
    if ":" in rest or any(char in _FORBIDDEN_PATH_CHARACTERS for char in rest):
        raise ManagementError(INVALID_INPUT, "path")
    for segment in re.split(r"[\\/]+", rest):
        if segment == "..":
            raise ManagementError(INVALID_INPUT, "path")
        if segment in {"", "."}:
            continue
        # Windows drops trailing dots and spaces, so "a." and "a" would name the same folder.
        if segment.endswith((".", " ")) or segment.split(".")[0].upper() in _RESERVED_NAMES:
            raise ManagementError(INVALID_INPUT, "path")
    return os.path.normpath(value)


def path_key(text: str) -> str:
    """Comparison key for a folder: symlinks, junctions, 8.3 names, case, separators, and dot segments are resolved."""
    try:
        resolved = os.path.realpath(text)
    except (OSError, ValueError):
        resolved = os.path.abspath(text)
    return os.path.normcase(os.path.normpath(resolved))


def verify_work_tree_root(normalized: str) -> None:
    """Check that the folder exists and is the root of a Git work tree. Raises PATH_NOT_FOUND or NOT_A_GIT_REPOSITORY.

    Git runs through `run_git` (allowlisted subcommand, controlled environment, no hooks, bounded output, timeout). A folder
    inside a repository, a bare repository, and the inside of a .git directory are refused.
    """
    real = os.path.realpath(normalized)
    if not os.path.isdir(real):
        raise ManagementError(PATH_NOT_FOUND, "exists" if os.path.exists(real) else "missing")
    try:
        output = run_git(Path(real), "rev-parse", options=("--show-toplevel",))
    except GitError as error:
        logger.info("git check refused outcome=%s", error)
        raise ManagementError(NOT_A_GIT_REPOSITORY) from None
    top = output.decode("utf-8", "replace").strip()
    try:
        same = bool(top) and os.path.samefile(top, real)
    except (OSError, ValueError):
        same = False
    if not same:
        raise ManagementError(NOT_A_GIT_REPOSITORY)


# ------------------------------------------------------------------------------------------------ file access


def _read_document(path: Path | None) -> tuple[list[Any], bytes | None]:
    """Return the raw entry list and the file bytes. A missing file is an empty registry. Anything else wrong is refused."""
    if path is None:
        raise ManagementError(REGISTRY_UNAVAILABLE)
    try:
        with path.open("rb") as handle:
            raw = handle.read(MAX_REGISTRY_BYTES + 1)
    except FileNotFoundError:
        return [], None
    except OSError:
        raise ManagementError(REGISTRY_UNAVAILABLE) from None
    if len(raw) > MAX_REGISTRY_BYTES:
        raise ManagementError(REGISTRY_UNAVAILABLE)

    def _no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("duplicate key")
            result[key] = value
        return result

    try:
        document = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_no_duplicates)
    except (ValueError, RecursionError):
        raise ManagementError(REGISTRY_UNAVAILABLE) from None
    if (
        not isinstance(document, dict)
        or set(document) != {"schema_version", "repositories"}
        or type(document["schema_version"]) is not int
        or document["schema_version"] != SCHEMA_VERSION
        or not isinstance(document["repositories"], list)
    ):
        raise ManagementError(REGISTRY_UNAVAILABLE)
    return document["repositories"], raw


def _write_atomic(path: Path, data: bytes) -> None:
    """Write `data` to `path`: temp file in the same directory, flush, fsync, then replace. The temp file never survives."""
    if len(data) > MAX_REGISTRY_BYTES:
        raise ManagementError(REGISTRY_WRITE_FAILED, "size")
    temp = path.with_name(TEMP_PREFIX + uuid.uuid4().hex)
    try:
        # Only the Sean data directory and its config directory may be created. The directory above them must exist.
        for directory in (path.parent.parent, path.parent):
            directory.mkdir(exist_ok=True)
        descriptor = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0))
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    except OSError:
        raise ManagementError(REGISTRY_WRITE_FAILED) from None
    finally:
        try:
            temp.unlink(missing_ok=True)
        except OSError:
            logger.warning("registry temp file could not be removed")


def _serialize(entries: list[Any]) -> bytes:
    document = {"schema_version": SCHEMA_VERSION, "repositories": entries}
    return (json.dumps(document, indent=2, ensure_ascii=True) + "\n").encode("utf-8")


def _mutate(path: Path | None, change: Callable[[list[Any]], list[Any]]) -> None:
    with _MUTATION_LOCK:
        entries, previous = _read_document(path)
        assert path is not None  # _read_document raised for None
        _write_atomic(path, _serialize(change(entries)))
        if previous is not None:
            # Best effort: one copy of the file as it was before this change. The registry itself is already safe.
            try:
                _write_atomic(path.with_name(path.name + BACKUP_SUFFIX), previous)
            except ManagementError:
                logger.warning("registry backup could not be written")


def _entry_id(raw: Any) -> str | None:
    return raw.get("repository_id") if isinstance(raw, dict) and isinstance(raw.get("repository_id"), str) else None


def _find_path_owner(entries: list[Any], key: str, exclude_id: str | None) -> str | None:
    for raw in entries:
        identifier = _entry_id(raw)
        if identifier is None or identifier == exclude_id:
            continue
        root = raw.get("root")
        if isinstance(root, str) and path_key(root) == key:
            return identifier
    return None


# ------------------------------------------------------------------------------------------------ operations


def add_repository(path: Path | None, repository_id: str, display_name: str, root: str) -> None:
    key = path_key(root)

    def change(entries: list[Any]) -> list[Any]:
        if any(_entry_id(raw) == repository_id for raw in entries):
            raise ManagementError(DUPLICATE_ID)
        owner = _find_path_owner(entries, key, None)
        if owner is not None:
            raise ManagementError(DUPLICATE_PATH, existing_repository_id=owner)
        return [*entries, {"repository_id": repository_id, "root": root, "display_name": display_name}]

    _mutate(path, change)


def update_repository(path: Path | None, repository_id: str, display_name: str, root: str) -> None:
    key = path_key(root)

    def change(entries: list[Any]) -> list[Any]:
        matches = [index for index, raw in enumerate(entries) if _entry_id(raw) == repository_id]
        if not matches:
            raise ManagementError(REPOSITORY_NOT_FOUND)
        if len(matches) > 1:
            # The file repeats this identifier. Sean will not guess which entry to change.
            raise ManagementError(REGISTRY_UNAVAILABLE)
        owner = _find_path_owner(entries, key, repository_id)
        if owner is not None:
            raise ManagementError(DUPLICATE_PATH, existing_repository_id=owner)
        updated = list(entries)
        updated[matches[0]] = {**entries[matches[0]], "root": root, "display_name": display_name}
        return updated

    _mutate(path, change)


def remove_repository(path: Path | None, repository_id: str) -> None:
    def change(entries: list[Any]) -> list[Any]:
        remaining = [raw for raw in entries if _entry_id(raw) != repository_id]
        if len(remaining) == len(entries):
            raise ManagementError(REPOSITORY_NOT_FOUND)
        return remaining

    _mutate(path, change)


def reload_into(path: Path | None, holder: Any) -> None:
    """Read the registry and hand it to the holder, while no write is in progress.

    Done under the same lock as the writes, so two requests that finish close together cannot leave the holder with the older
    of the two registries.
    """
    with _MUTATION_LOCK:
        registry, unavailable = load_snapshot(path)
        holder.replace(registry, unavailable)


def load_snapshot(path: Path | None) -> tuple[LoadedRegistry, tuple[RegistryEntry, ...]]:
    """Load the registry and list entries that are valid but unusable now (so the UI can show, edit, or remove them)."""
    registry = load_registry(path)
    if not any(problem.code == PROBLEM_ROOT_INVALID for problem in registry.problems):
        return registry, ()
    try:
        entries, _ = _read_document(path)
    except ManagementError:
        return registry, ()
    unavailable: list[RegistryEntry] = []
    for raw in entries:
        try:
            entry = RegistryEntry.model_validate(raw)
        except ValueError:
            continue
        if entry.repository_id not in registry.entries and all(
            entry.repository_id != other.repository_id for other in unavailable
        ):
            unavailable.append(entry)
    return registry, tuple(unavailable)
