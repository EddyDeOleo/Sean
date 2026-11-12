"""HTTP API tests for POST /investigations (Task 15.2; design C.3 to C.11).

The application is called through the ASGI interface directly. This avoids the httpx dependency, which is not part of the
approved dependency set (D01 §2).
"""

from __future__ import annotations

import asyncio
import json
import logging

import pytest

from app.api import app as api_module
from app.api.app import create_app
from app.core.diagnostics import RedactionRegistry, configure_logging, register_secrets
from app.modules.investigation.result import ResultInvariantViolation
from app.modules.repository.registry import LoadedRegistry, RegistryEntry

REPOSITORY_ID = "sample"
SECRET = "ghp_api_test_secret_value_0123456789"


def _registry(root) -> LoadedRegistry:
    return LoadedRegistry(
        entries={REPOSITORY_ID: RegistryEntry(repository_id=REPOSITORY_ID, root=str(root))},
        problems=(),
    )


def _post(app, raw: bytes) -> tuple[int, dict | str]:
    """Send one POST /investigations through the ASGI interface and return (status, parsed body)."""
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/investigations",
        "raw_path": b"/investigations",
        "query_string": b"",
        "root_path": "",
        "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(raw)).encode())],
        "client": ("127.0.0.1", 50000),
        "server": ("testserver", 80),
    }
    messages: list[dict] = []
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": raw, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    status = messages[0]["status"]
    payload = b"".join(m.get("body", b"") for m in messages[1:] if m["type"] == "http.response.body")
    text = payload.decode("utf-8")
    try:
        return status, json.loads(text)
    except json.JSONDecodeError:
        return status, text


def _body(**overrides) -> bytes:
    document = {
        "repository_id": REPOSITORY_ID,
        "target": {"path": "src/a.py", "symbol": "target"},
        "question": "What changed?",
    }
    document.update(overrides)
    return json.dumps(document).encode()


@pytest.fixture
def repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.commit("change target")
    return fixture


@pytest.fixture
def app(repo):
    return create_app(_registry(repo.path))


def test_complete_documented_investigation_returns_200_with_separate_fields(app, repo) -> None:
    status, body = _post(app, _body())
    assert status == 200
    assert body["retrieval_status"] == "COMPLETE"
    assert body["epistemic_classification"] == "DOCUMENTED"
    assert body["conclusion"]
    assert body["error"] is None
    assert body["evidence"] and all(item["evidence_id"].startswith("ev1_") for item in body["evidence"])
    assert str(repo.path) not in json.dumps(body)


def test_insufficient_investigation_returns_200_and_abstains(app) -> None:
    status, body = _post(app, _body(target={"path": "src/never.py"}))
    assert status == 200
    assert body["retrieval_status"] == "INSUFFICIENT"
    assert body["epistemic_classification"] == "INSUFFICIENT_EVIDENCE"
    assert body["conclusion"] is None


def test_failed_retrieval_is_200_with_error_and_no_classification(app, monkeypatch) -> None:
    from app.core.git_runner import GIT_TIMEOUT, GitError
    from app.modules.investigation import orchestrator

    def fail(*args, **kwargs):
        raise GitError(GIT_TIMEOUT)

    monkeypatch.setattr(orchestrator, "retrieve_history", fail)
    status, body = _post(app, _body())
    assert status == 200
    assert body["retrieval_status"] == "FAILED"
    assert body["epistemic_classification"] is None
    assert body["evidence"] == []
    assert body["error"]["code"] == GIT_TIMEOUT


def test_ambiguous_target_is_409_with_candidates(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/a.py", "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n")
    fixture.commit("two runs")
    status, body = _post(create_app(_registry(fixture.path)), _body(target={"path": "src/a.py", "symbol": "run"}))
    assert status == 409
    assert body["code"] == "TARGET_AMBIGUOUS"
    assert body["candidates"] == ["A.run", "B.run"]


def test_unknown_repository_is_404(app) -> None:
    status, body = _post(app, _body(repository_id="missing"))
    assert status == 404
    assert body["code"] == "REPOSITORY_NOT_FOUND"


def test_path_traversal_is_400_invalid_input(app) -> None:
    status, body = _post(app, _body(target={"path": "../outside.py"}))
    assert status == 400
    assert body["code"] == "INVALID_INPUT"


def test_unknown_field_is_400_and_names_the_field_only(app) -> None:
    status, body = _post(app, _body(retrieval_status="COMPLETE"))
    assert status == 400
    assert body["code"] == "INVALID_INPUT"
    assert body["field"] == "retrieval_status"


def test_malformed_json_is_400(app) -> None:
    status, body = _post(app, b"{not json")
    assert status == 400
    assert body["code"] == "INVALID_INPUT"
    assert "field" not in body


def test_request_error_body_never_echoes_input_values(app) -> None:
    status, body = _post(app, _body(target={"path": "../secret-value-xyz.py"}))
    assert status == 400
    assert "secret-value-xyz" not in json.dumps(body)


def test_category_c_violation_is_500_without_rule_name(app, monkeypatch) -> None:
    """C.5 and C.6, with owner decision 3.1: a violated invariant returns a category B 500 INTERNAL_ERROR, no result."""

    def violate(*args, **kwargs):
        raise ResultInvariantViolation("classified_without_supporting_evidence")

    monkeypatch.setattr(api_module, "investigate", violate)
    status, body = _post(app, _body())
    assert status == 500
    assert body["code"] == "INTERNAL_ERROR"
    assert "classified_without_supporting_evidence" not in json.dumps(body)
    assert "retrieval_status" not in body


def test_token_is_redacted_in_the_real_logging_path(caplog) -> None:
    """Task 16.2: a registered secret does not appear in log output produced through the application logger."""
    register_secrets([SECRET])
    configure_logging(logging.getLogger("sean"))
    with caplog.at_level(logging.INFO, logger="sean.api"):
        logging.getLogger("sean.api").info("request used %s", SECRET)
    assert SECRET not in caplog.text


def test_redaction_registry_covers_the_token_value_used_in_responses() -> None:
    registry = RedactionRegistry()
    registry.register(SECRET)
    assert SECRET not in registry.redact(f"error {SECRET}")
