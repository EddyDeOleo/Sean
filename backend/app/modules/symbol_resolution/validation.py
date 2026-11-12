"""Symbol and line-range input validation (Task 2.3).

Inputs are checked before any use. The symbol bound (1 to 256 characters, no control characters or newlines) comes from
the approved design (`target.symbol`). The line span bound is a proposed default (OD-5, row V4) and is not owner-approved.
Path validation lives in app.modules.repository.paths.
"""

from __future__ import annotations

from app.core.limits import MAX_LINE_SPAN, MAX_SYMBOL_LENGTH

INVALID_INPUT = "INVALID_INPUT"


class InvalidInput(Exception):
    """A caller-facing input rejection. The message is the error code only."""


def validate_symbol(value: object) -> str:
    """Return the symbol if it is 1 to 256 characters with no control characters or newlines.

    A dotted name such as "Class.method" is allowed. Each part must be a non-empty identifier-like text, with no leading
    or trailing dot.
    """
    if not isinstance(value, str) or not value or len(value) > MAX_SYMBOL_LENGTH:
        raise InvalidInput(INVALID_INPUT)
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in value):
        raise InvalidInput(INVALID_INPUT)
    if value.strip() != value or any(part == "" for part in value.split(".")):
        raise InvalidInput(INVALID_INPUT)
    return value


def validate_line_range(start: object, end: object) -> tuple[int, int] | None:
    """Return (start, end) for a valid range, or None when both values are omitted.

    Both values must be given together. Lines are 1-based integers with start at most end, and the span is bounded by
    MAX_LINE_SPAN. Booleans are rejected even though Python treats them as integers.
    """
    if start is None and end is None:
        return None
    if start is None or end is None:
        raise InvalidInput(INVALID_INPUT)
    for value in (start, end):
        if isinstance(value, bool) or not isinstance(value, int) or value < 1:
            raise InvalidInput(INVALID_INPUT)
    if start > end or end - start + 1 > MAX_LINE_SPAN:
        raise InvalidInput(INVALID_INPUT)
    return start, end
