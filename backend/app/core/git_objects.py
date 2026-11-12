"""Full Git object names, shared by every interface that accepts a commit identifier.

Owner decision DEC-14 as updated for I2: a full object name is either 40 lowercase hexadecimal characters
(SHA-1) or 64 lowercase hexadecimal characters (SHA-256). Abbreviated names, uppercase letters, and any other
characters are rejected. Validation is a full-string match, so a trailing newline is rejected.

Support for SHA-256 in MVP interfaces is established only where the implementation and tests demonstrate it.
This module defines the syntactic contract that those interfaces share.
"""

from __future__ import annotations

import re

SHA1_OBJECT_NAME_LENGTH = 40
SHA256_OBJECT_NAME_LENGTH = 64

_FULL_OBJECT_NAME = re.compile(rf"[0-9a-f]{{{SHA1_OBJECT_NAME_LENGTH}}}|[0-9a-f]{{{SHA256_OBJECT_NAME_LENGTH}}}")


def is_full_object_name(value: str) -> bool:
    """Return True only for a full lowercase SHA-1 or SHA-256 object name."""
    return _FULL_OBJECT_NAME.fullmatch(value) is not None
