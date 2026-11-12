"""Diagnostic records and redaction tests (Task 16.2; Requirement 19)."""

from __future__ import annotations

import logging

import pytest

from app.core import diagnostics
from app.core.diagnostics import DIAGNOSTIC_FIELDS, REDACTED, RedactionRegistry, diagnostic_record

SECRET = "ghp_fixture_token_value_0123456789"


@pytest.fixture(autouse=True)
def _fresh_registry(monkeypatch):
    """Each test starts with an empty registry, so registrations do not leak between tests."""
    monkeypatch.setattr(diagnostics, "_registry", RedactionRegistry())


def test_registry_redacts_every_registered_value_and_ignores_empty() -> None:
    registry = RedactionRegistry()
    registry.register(SECRET)
    registry.register("")
    registry.register(None)
    assert registry.redact(f"token={SECRET} again {SECRET}") == f"token={REDACTED} again {REDACTED}"


def test_longer_secret_is_removed_before_a_shorter_overlapping_one() -> None:
    registry = RedactionRegistry()
    registry.register("abc")
    registry.register("abcdef")
    assert registry.redact("abcdef") == REDACTED


def test_logging_filter_removes_a_secret_from_the_message(caplog) -> None:
    logger = logging.getLogger("sean.test.redaction")
    diagnostics.register_secrets([SECRET])
    diagnostics.configure_logging(logger)
    with caplog.at_level(logging.INFO, logger="sean.test.redaction"):
        logger.info("request used %s", SECRET)
    assert SECRET not in caplog.text
    assert REDACTED in caplog.text


def test_logging_filter_removes_a_secret_from_exception_text(caplog) -> None:
    logger = logging.getLogger("sean.test.exception")
    diagnostics.register_secrets([SECRET])
    diagnostics.configure_logging(logger)
    with caplog.at_level(logging.ERROR, logger="sean.test.exception"):
        try:
            raise RuntimeError(f"failed with {SECRET}")
        except RuntimeError:
            logger.exception("operation failed")
    assert SECRET not in caplog.text


def test_configure_logging_is_idempotent() -> None:
    logger = logging.getLogger("sean.test.idempotent")
    diagnostics.configure_logging(logger)
    diagnostics.configure_logging(logger)
    assert sum(isinstance(item, diagnostics.RedactingFilter) for item in logger.filters) == 1


def test_diagnostic_record_has_exactly_the_requirement_19_1_fields_in_order() -> None:
    line = diagnostic_record({name: "x" for name in DIAGNOSTIC_FIELDS})
    assert [part.split("=", 1)[0] for part in line.split(" ")] == list(DIAGNOSTIC_FIELDS)


def test_missing_diagnostic_field_is_written_as_unavailable_not_zero() -> None:
    line = diagnostic_record({"evidence_count": 0})
    assert "evidence_count=0" in line
    assert "classification=unavailable" in line


def test_unknown_diagnostic_field_is_rejected() -> None:
    with pytest.raises(ValueError):
        diagnostic_record({"repository_path": "C:/secret/location"})


def test_diagnostic_record_never_contains_a_registered_secret() -> None:
    diagnostics.register_secrets([SECRET])
    line = diagnostic_record({"repository_id": f"repo-{SECRET}", "error_categories": SECRET})
    assert SECRET not in line
    assert REDACTED in line
