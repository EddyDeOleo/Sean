"""Canonical source identifiers and the evidence_id derivation (I2 owner decisions D9, D11, O12, X1).

Canonical source identifier formats (D11):
- GIT_COMMIT:           <commit>
- PULL_REQUEST, ISSUE:  canonical positive decimal (leading zeros removed for identity only)
- GIT_BLAME:            <revision>:<path>:<start>-<end>
- CODE_HISTORY:         <commit>:<revision>:<path>                  (whole-file record)
                        <commit>:<revision>:<path>:<start>-<end>    (line-range record)
- DOCUMENTATION:        <commit>:<path>

For CODE_HISTORY, <commit> is the change commit and <revision> is the observation revision (X1). Both are full
Git object names, validated with the shared contract in app.core.git_objects. The change side is not part of the
identifier. For a line-range record, revision equals commit for POST_CHANGE and differs for PRE_CHANGE (the rule
enforced in models.py), so the revision already determines the side.

In every composite form, <path> is percent-encoded over the UTF-8 bytes of the normalized repository-relative
path. Only ASCII letters, digits, and "-._~/" are left unencoded, and every other byte is written as "%" followed
by two uppercase hexadecimal digits. Colons and percent signs are therefore always encoded, so a colon cannot
act as a delimiter inside a path. Path case is preserved. No Unicode normalization is applied.

evidence_id (O12): "ev1_" followed by the SHA-256 hexadecimal digest of a length-prefixed serialization of the
version, the repository namespace, the source type, and the canonical source identifier. Mutable metadata
(titles, excerpts, timestamps, retrieval time, ranking, relationships) never enters the derivation.
"""

from __future__ import annotations

import hashlib
import re

from app.core.git_objects import is_full_object_name

EVIDENCE_ID_VERSION = "ev1"

_UNENCODED_BYTES = frozenset(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~/")
_DECIMAL = re.compile(r"[0-9]+")


def encode_path(path: str) -> str:
    """Percent-encode a normalized repository-relative path over its UTF-8 bytes (D11)."""
    encoded: list[str] = []
    for byte in path.encode("utf-8"):
        if byte in _UNENCODED_BYTES:
            encoded.append(chr(byte))
        else:
            encoded.append(f"%{byte:02X}")
    return "".join(encoded)


def is_positive_decimal(value: str) -> bool:
    """True for a string of ASCII digits, matched in full, that is not all zeros (D9)."""
    return _DECIMAL.fullmatch(value) is not None and value.lstrip("0") != ""


def canonical_decimal(value: str) -> str:
    """Canonical identity form of a validated positive decimal string: leading zeros removed (D11)."""
    return value.lstrip("0")


def _full_object_name(value: str) -> str:
    if not is_full_object_name(value):
        raise ValueError("a canonical identifier requires full 40 or 64 character lowercase Git object names")
    return value


def blame_source_id(revision: str, path: str, start: int, end: int) -> str:
    return f"{revision}:{encode_path(path)}:{start}-{end}"


def code_history_source_id(commit: str, revision: str, path: str) -> str:
    """Whole-file CODE_HISTORY identifier (D11, X1). Both Git names are validated."""
    return f"{_full_object_name(commit)}:{_full_object_name(revision)}:{encode_path(path)}"


def code_history_range_source_id(commit: str, revision: str, path: str, start: int, end: int) -> str:
    """Line-range CODE_HISTORY identifier (D11, X1). Both Git names are validated."""
    return f"{_full_object_name(commit)}:{_full_object_name(revision)}:{encode_path(path)}:{start}-{end}"


def documentation_source_id(commit: str, path: str) -> str:
    return f"{commit}:{encode_path(path)}"


def derive_evidence_id(repository_namespace: str, source_type: str, canonical_source_id: str) -> str:
    """Return the versioned evidence identifier for one canonical record (O12)."""
    fields = (EVIDENCE_ID_VERSION, repository_namespace, source_type, canonical_source_id)
    payload = b"".join(_length_prefixed(field) for field in fields)
    return f"{EVIDENCE_ID_VERSION}_{hashlib.sha256(payload).hexdigest()}"


def _length_prefixed(text: str) -> bytes:
    data = text.encode("utf-8")
    return f"{len(data)}:".encode("ascii") + data
