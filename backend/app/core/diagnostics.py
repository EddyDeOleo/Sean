"""Diagnostic records and secret redaction (Task 16.2; Requirement 19; Spec 1 §20).

- Diagnostic records accept only the fields listed in Requirement 19.1. Any other field name is rejected.
- Registered secret values (for example the GitHub token) are removed from every log message and exception text that
  passes through the redacting filter. Redaction is exact-match on the registered values.
- Nothing in this module reads or stores the token. The caller registers the value it read from the environment.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping

REDACTED = "[REDACTED]"

# Requirement 19.1 fields. The order is the output order.
DIAGNOSTIC_FIELDS: tuple[str, ...] = (
    "investigation_id",
    "repository_id",
    "operations",
    "retrieval_status",
    "evidence_count",
    "ranking_outcome",
    "classification",
    "ai_available",
    "duration_ms",
    "error_categories",
)


class RedactionRegistry:
    """Holds the secret values that must never appear in output. Empty values are ignored."""

    def __init__(self) -> None:
        self._secrets: set[str] = set()

    def register(self, value: str | None) -> None:
        if value:
            self._secrets.add(value)

    def redact(self, text: str) -> str:
        for secret in sorted(self._secrets, key=len, reverse=True):
            text = text.replace(secret, REDACTED)
        return text


_registry = RedactionRegistry()


class RedactingFilter(logging.Filter):
    """Removes registered secrets from the formatted message and from exception text."""

    def __init__(self, registry: RedactionRegistry) -> None:
        super().__init__()
        self._registry = registry

    def filter(self, record: logging.LogRecord) -> bool:
        message = self._registry.redact(record.getMessage())
        record.msg = message
        record.args = ()
        if record.exc_info:
            record.exc_text = self._registry.redact(logging.Formatter().formatException(record.exc_info))
            record.exc_info = None
        return True


def register_secrets(values: Iterable[str | None]) -> None:
    """Register secret values for redaction. The caller supplies the values it read from the environment."""
    for value in values:
        _registry.register(value)


def configure_logging(logger: logging.Logger | None = None) -> None:
    """Attach the redacting filter to a logger and its handlers. Safe to call more than once."""
    target = logger or logging.getLogger("sean")
    if not any(isinstance(item, RedactingFilter) for item in target.filters):
        target.addFilter(RedactingFilter(_registry))
    # A logger filter does not run for records from child loggers. Handler filters run for every record that reaches
    # the handler, so the filter is attached to the handlers as well.
    for handler in logging.getLogger().handlers:
        if not any(isinstance(item, RedactingFilter) for item in handler.filters):
            handler.addFilter(RedactingFilter(_registry))


def diagnostic_record(fields: Mapping[str, object]) -> str:
    """Return one diagnostic line with only the allowed Requirement 19.1 fields, redacted.

    Unknown field names raise ValueError. A missing field is written as "unavailable" rather than omitted, so an absent
    value is never mistaken for a value of zero.
    """
    unknown = set(fields) - set(DIAGNOSTIC_FIELDS)
    if unknown:
        raise ValueError(f"unknown diagnostic field: {sorted(unknown)[0]}")
    parts = []
    for name in DIAGNOSTIC_FIELDS:
        value = fields.get(name, "unavailable")
        parts.append(f"{name}={value}")
    return _registry.redact(" ".join(parts))
