"""Repository-relative path rules (design section C.3a).

Three functions live here:
- is_normalized_repository_path: the lexical normalized-form predicate that Evidence validation relies on (I2).
  It is a subset of C.3a and is unchanged. It rejects backslashes because it checks already-normalized paths.
- normalize_target_path (Task 2.1): the lexical input rules. Backslashes are normalized to forward slashes. Absolute,
  drive-qualified, UNC, and device forms, traversal, control characters, colons, reserved device names, and segments
  that end in a dot or a space are rejected.
- resolve_contained_path (Task 2.2): containment on resolved filesystem paths. Symbolic links and Windows junctions
  that lead outside the resolved root are rejected.

A rejection raises PathError with the error code only. The code does not say whether the path exists.
"""

from __future__ import annotations

import os
from pathlib import Path

INVALID_INPUT = "INVALID_INPUT"
PATH_OUTSIDE_REPOSITORY = "PATH_OUTSIDE_REPOSITORY"
from app.core.limits import MAX_TARGET_PATH_LENGTH

# Windows device names, compared case-insensitively against the part of a segment before its first dot.
# COM0 and LPT0 are included as a conservative choice. The superscript digits are the Unicode forms Windows maps to
# COM1 to COM3 and LPT1 to LPT3.
_RESERVED_STEMS = frozenset(
    {"CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$", "COM\u00b9", "COM\u00b2", "COM\u00b3", "LPT\u00b9", "LPT\u00b2", "LPT\u00b3"}
    | {f"COM{number}" for number in range(10)}
    | {f"LPT{number}" for number in range(10)}
)


class PathError(Exception):
    """A caller-facing path rejection. The message is the error code only."""


def is_normalized_repository_path(path: str) -> bool:
    """Return True when the path satisfies the lexical normalized form above."""
    # Design C.3a rejects any colon, which covers drive syntax and alternate data streams.
    if not path or path.startswith("/") or "\\" in path or ":" in path:
        return False
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in path):
        return False
    try:
        path.encode("utf-8")
    except UnicodeEncodeError:
        return False
    return all(segment not in ("", ".", "..") for segment in path.split("/"))


def _is_control(character: str) -> bool:
    return ord(character) < 0x20 or ord(character) == 0x7F


def normalize_target_path(raw: object) -> str:
    """Apply the C.3a lexical input rules (steps 1 and 2) and return the forward-slash form.

    Raises PathError(INVALID_INPUT) for any rejected form. The length bound is MAX_TARGET_PATH_LENGTH (OD-5 row V2). That
    value is PROPOSED and not owner-approved, and it is applied here.
    """
    if not isinstance(raw, str) or not raw:
        raise PathError(INVALID_INPUT)
    try:
        raw.encode("utf-8")
    except UnicodeEncodeError:
        raise PathError(INVALID_INPUT) from None
    if len(raw) > MAX_TARGET_PATH_LENGTH:
        raise PathError(INVALID_INPUT)
    text = raw.replace("\\", "/")
    # A leading slash covers absolute paths, UNC paths (\\server), and device namespaces (\\?\ and \\.\).
    if text.startswith("/"):
        raise PathError(INVALID_INPUT)
    # A colon covers drive syntax (C:) and alternate data streams (name:stream).
    if ":" in text or any(_is_control(character) for character in text):
        raise PathError(INVALID_INPUT)
    segments = text.split("/")
    for segment in segments:
        # Empty segments cover doubled and trailing slashes. "." and ".." are rejected here as well: ".." is traversal,
        # and "." is not part of the normalized form that the rest of the system stores.
        if segment in ("", ".", ".."):
            raise PathError(INVALID_INPUT)
        if segment.endswith((".", " ")):
            raise PathError(INVALID_INPUT)
        # Windows ignores trailing spaces in a device name, so "NUL .txt" names the NUL device.
        if segment.split(".", 1)[0].rstrip(" ").upper() in _RESERVED_STEMS:
            raise PathError(INVALID_INPUT)
    return "/".join(segments)


def resolve_contained_path(root: Path, normalized: str) -> Path:
    """Check containment of a normalized path under a resolved root (C.3a steps 4 to 7).

    The path is joined lexically to the root. The longest existing ancestor is resolved with the platform real-path
    function, which follows symbolic links and Windows junctions. The result must lie inside the resolved root, compared
    by path segments. Paths that do not exist yet are allowed, because historical paths may be absent from the working
    tree (C.3a step 5). Their missing components are appended lexically after the resolved ancestor.

    Every failure raises PathError(PATH_OUTSIDE_REPOSITORY), whether the target exists outside the root or not. A failure
    to resolve a path is also reported this way, because containment then cannot be shown.
    """
    segments = normalize_target_path(normalized).split("/")
    try:
        real_root = Path(os.path.realpath(root))
        ancestor = real_root.joinpath(*segments)
        missing: list[str] = []
        while not os.path.lexists(ancestor):
            if ancestor == ancestor.parent:
                raise PathError(PATH_OUTSIDE_REPOSITORY)
            missing.insert(0, ancestor.name)
            ancestor = ancestor.parent
        resolved = Path(os.path.realpath(ancestor))
    except (OSError, ValueError):
        raise PathError(PATH_OUTSIDE_REPOSITORY) from None
    if not resolved.is_relative_to(real_root):
        raise PathError(PATH_OUTSIDE_REPOSITORY)
    return resolved.joinpath(*missing)
