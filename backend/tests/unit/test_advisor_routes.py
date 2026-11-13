"""HTTP route tests for the additive repository-intelligence endpoints (Spec 4 section 4.2)."""

from __future__ import annotations

import asyncio
import json
import logging
import threading

import pytest

from advisor_helpers import asgi
from app.api import advisor_routes as routes
from app.api.advisor_routes import create_advisor_router
from app.api.app import create_app
from app.api.local_guard import LocalOnlyMiddleware
from app.modules.advisor.contract import ContractViolation
from app.modules.intent import gemini
from app.modules.repository.registry import GitHubIdentity, LoadedRegistry, RegistryEntry


def _app(entries: dict[str, RegistryEntry], **router_kwargs):
    registry = LoadedRegistry(entries=entries, problems=())
    app = create_app(registry)
    app.include_router(create_advisor_router(registry, **router_kwargs))
    return app


@pytest.fixture
def sample(make_repo):
    repo = make_repo()
    repo.write("src/billing.py", "def charge(amount):\n    return amount\n")
    repo.write("README.md", "# sample\n")
    repo.commit("feat: add billing")
    repo.write("src/billing.py", "def charge(amount):\n    return amount + 1\n")
    repo.commit("fix: correct charge")
    return repo


def _entries(sample, **extra):
    return {"sample": RegistryEntry(repository_id="sample", root=str(sample.path), **extra)}


def test_list_repositories_hides_paths_and_reports_availability(sample, tmp_path):
    entries = _entries(sample, github=GitHubIdentity(owner="acme", name="sample"))
    entries["gone"] = RegistryEntry(repository_id="gone", root=str(tmp_path / "does-not-exist"))
    status, body = asgi(_app(entries), "GET", "/repositories")
    assert status == 200
    assert body["repositories"] == [
        {"repository_id": "gone", "available": False, "github": None},
        {"repository_id": "sample", "available": True, "github": {"owner": "acme", "name": "sample"}},
    ]
    assert str(sample.path) not in json.dumps(body)


def test_profile_returns_profile_and_advisor(sample):
    status, body = asgi(_app(_entries(sample)), "POST", "/repositories/sample/profile")
    assert status == 200
    assert set(body) == {"profile", "advisor"}
    profile, advisor = body["profile"], body["advisor"]
    assert profile["repository_id"] == "sample" and profile["basis"] == "COMMITTED_TREE"
    assert advisor["profile_head"] == profile["head"]
    assert {item["capability"] for item in advisor["recommendations"]} >= {"STEERING", "SPECS", "KIROIGNORE"}
    assert str(sample.path) not in json.dumps(body)
    assert "Ada Example" not in json.dumps(body)


def test_profile_of_unknown_repository_is_404_with_a_fixed_message(sample):
    status, body = asgi(_app(_entries(sample)), "POST", "/repositories/nope/profile")
    assert status == 404
    assert body == {"code": "REPOSITORY_NOT_FOUND", "message": "The repository identifier is not registered.", "retryable": False}


def test_profile_of_unavailable_repository_is_503(tmp_path):
    entries = {"gone": RegistryEntry(repository_id="gone", root=str(tmp_path / "missing"))}
    status, body = asgi(_app(entries), "POST", "/repositories/gone/profile")
    assert status == 503 and body["code"] == "REPOSITORY_UNAVAILABLE"
    assert str(tmp_path) not in json.dumps(body)


def test_profile_of_repository_without_commits_is_422(make_repo):
    empty = make_repo()
    entries = {"empty": RegistryEntry(repository_id="empty", root=str(empty.path))}
    status, body = asgi(_app(entries), "POST", "/repositories/empty/profile")
    assert status == 422 and body["code"] == "PROFILE_UNAVAILABLE"


@pytest.mark.parametrize("bad", ["UPPER", "has space", "..", "a" * 65, "-lead"])
def test_invalid_repository_id_is_rejected(sample, bad):
    status, body = asgi(_app(_entries(sample)), "POST", f"/repositories/{bad.replace(' ', '%20')}/profile")
    assert status in {400, 404} and body.get("code") in {"INVALID_INPUT", None, "REPOSITORY_NOT_FOUND"}


def test_interpret_resolves_a_path_from_the_committed_tree(sample):
    status, body = asgi(_app(_entries(sample)), "POST", "/interpret", {"text": "sample — Why did src/billing.py change?"})
    assert status == 200
    assert (body["mode"], body["repository_id"], body["target_path"], body["interpreter"]) == ("INVESTIGATE", "sample", "src/billing.py", "deterministic")


def test_interpret_rejects_unknown_fields_and_oversized_text(sample):
    app = _app(_entries(sample))
    assert asgi(app, "POST", "/interpret", {"text": "x", "extra": 1})[0] == 400
    assert asgi(app, "POST", "/interpret", {"text": "x" * 2001})[0] == 400
    assert asgi(app, "POST", "/interpret", {"text": "x", "selected_repository_id": "BAD ID"})[0] == 400


def test_interpret_uses_the_hint_only_when_needed(sample):
    calls = []

    def transport(payload):
        calls.append(payload)
        return {"candidates": [{"content": {"parts": [{"text": json.dumps({"path": "src/billing.py"})}]}}]}

    app = _app(_entries(sample), gemini_transport=transport)
    status, body = asgi(app, "POST", "/interpret", {"text": "sample — Why was src/billing.py changed?", "allow_ai": True})
    assert status == 200 and body["interpreter"] == "deterministic" and calls == []
    status, body = asgi(app, "POST", "/interpret", {"text": "sample — Why was the money code added?", "allow_ai": True})
    assert status == 200 and body["interpreter"] == "gemini" and body["target_path"] == "src/billing.py"
    sent = json.dumps(calls)
    assert "def charge" not in sent and "src/billing.py" not in sent  # no repository content or paths leave the machine


def test_a_failing_provider_falls_back_to_the_parser(sample):
    def broken(_payload):
        raise OSError("provider down")

    app = _app(_entries(sample), gemini_transport=broken)
    status, body = asgi(app, "POST", "/interpret", {"text": "sample — Why was the money code added?", "allow_ai": True})
    assert status == 200 and body["interpreter"] == "deterministic" and body["mode"] == "NEEDS_TARGET"


def test_phase_3_investigation_route_still_works_in_the_combined_app(sample):
    payload = {"repository_id": "sample", "target": {"path": "src/billing.py"}, "question": "Why?"}
    status, body = asgi(_app(_entries(sample)), "POST", "/investigations", payload)
    assert status == 200 and body["retrieval_status"] in {"COMPLETE", "PARTIAL"}
    assert body["epistemic_classification"] in {"DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE"}


def test_profile_route_logs_the_build_but_not_the_repository_path(sample, caplog):
    caplog.set_level(logging.INFO, logger="sean.api.advisor")
    asgi(_app(_entries(sample)), "POST", "/repositories/sample/profile")
    assert "profile built" in caplog.text
    assert str(sample.path) not in caplog.text


# ---------------------------------------------------------------- local-only guard, cache, concurrency


def _guarded(entries):
    registry = LoadedRegistry(entries=entries, problems=())
    app = create_app(registry)
    app.add_middleware(LocalOnlyMiddleware)
    app.include_router(create_advisor_router(registry))
    return app


def _asgi_with_headers(app, method, path, headers, payload=None):
    raw = json.dumps(payload).encode() if payload is not None else b""
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http",
        "path": path, "raw_path": path.encode(), "query_string": b"", "root_path": "",
        "headers": [(k.encode(), v.encode()) for k, v in {**headers, "content-length": str(len(raw))}.items()],
        "client": ("127.0.0.1", 50000), "server": ("testserver", 80),
    }
    messages = []
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": raw, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    body = b"".join(m.get("body", b"") for m in messages[1:] if m["type"] == "http.response.body")
    return messages[0]["status"], body.decode()


@pytest.mark.parametrize(
    ("headers", "allowed"),
    [
        ({"host": "127.0.0.1:8000"}, True),
        ({"host": "localhost:5173"}, True),
        ({"host": "[::1]:8000"}, True),
        ({"host": "127.0.0.1:5173", "origin": "http://127.0.0.1:5173"}, True),
        ({"host": "localhost", "origin": "http://localhost:5273"}, True),
        ({"host": "evil.example"}, False),  # DNS rebinding
        ({"host": "127.0.0.1.evil.example"}, False),
        ({"host": ""}, False),
        ({}, False),
        ({"host": "127.0.0.1:8000", "origin": "https://evil.example"}, False),  # cross-site browser request
        ({"host": "127.0.0.1:8000", "origin": "http://127.0.0.1.evil.example"}, False),
        ({"host": "127.0.0.1:8000", "origin": "null"}, False),
    ],
)
def test_local_only_guard(sample, headers, allowed):
    status, body = _asgi_with_headers(_guarded(_entries(sample)), "GET", "/repositories", headers)
    assert (status == 200) is allowed
    if not allowed:
        assert status == 403 and "REQUEST_REFUSED" in body


def test_guard_also_protects_the_phase_3_route(sample):
    payload = {"repository_id": "sample", "target": {"path": "src/billing.py"}, "question": "Why?"}
    status, _ = _asgi_with_headers(_guarded(_entries(sample)), "POST", "/investigations", {"host": "127.0.0.1:8000", "origin": "https://evil.example", "content-type": "application/json"}, payload)
    assert status == 403
    status, _ = _asgi_with_headers(_guarded(_entries(sample)), "POST", "/investigations", {"host": "127.0.0.1:8000", "content-type": "application/json"}, payload)
    assert status == 200


def test_profile_is_cached_per_head_and_refreshed_by_a_new_commit(sample, monkeypatch):
    calls = []
    real = routes.scan_repository

    def counting(root, repository_id):
        calls.append(repository_id)
        return real(root, repository_id)

    monkeypatch.setattr(routes, "scan_repository", counting)
    app = _app(_entries(sample))
    first = asgi(app, "POST", "/repositories/sample/profile")
    second = asgi(app, "POST", "/repositories/sample/profile")
    assert first == second and calls == ["sample"]
    sample.write("src/new.py", "n = 1\n")
    sample.commit("feat: new file")
    third = asgi(app, "POST", "/repositories/sample/profile")
    assert calls == ["sample", "sample"] and third[1]["profile"]["head"] != first[1]["profile"]["head"]


def test_busy_server_answers_429_without_starting_more_work(sample, monkeypatch):
    app = _app(_entries(sample))
    real = threading.BoundedSemaphore

    class Exhausted:
        def __init__(self, _n):
            pass

        def acquire(self, blocking=True):
            return False

        def release(self):
            raise AssertionError("must not release a slot that was never taken")

    monkeypatch.setattr(routes.threading, "BoundedSemaphore", Exhausted)
    busy_app = _app(_entries(sample))
    monkeypatch.setattr(routes.threading, "BoundedSemaphore", real)
    status, body = asgi(busy_app, "POST", "/repositories/sample/profile")
    assert status == 429 and body["code"] == "BUSY"
    status, body = asgi(busy_app, "POST", "/interpret", {"text": "sample — hello"})
    assert status == 429 and body["code"] == "BUSY"
    assert asgi(app, "POST", "/repositories/sample/profile")[0] == 200


def test_slots_are_released_after_each_request(sample):
    app = _app(_entries(sample))
    for index in range(routes.MAX_CONCURRENT_WORK + 3):
        assert asgi(app, "POST", "/interpret", {"text": f"sample — question {index}"})[0] == 200


def test_a_contract_violation_is_a_fixed_500_and_frees_the_slot(sample, monkeypatch):
    def broken(_profile):
        raise ContractViolation("rule detail that must not leak")

    monkeypatch.setattr(routes, "advise", broken)
    app = _app(_entries(sample))
    for _ in range(routes.MAX_CONCURRENT_WORK + 2):
        status, body = asgi(app, "POST", "/repositories/sample/profile")
        assert status == 500 and body["code"] == "INTERNAL_ERROR"
        assert "rule detail" not in json.dumps(body)


def test_profile_route_does_not_log_commit_subjects_or_authors(sample, caplog):
    sample.write("src/z.py", "z = 1\n")
    sample.commit("fix: confidential-subject-text")
    caplog.set_level(logging.DEBUG)
    asgi(_app(_entries(sample)), "POST", "/repositories/sample/profile")
    assert "confidential-subject-text" not in caplog.text and "Ada Example" not in caplog.text


# ---------------------------------------------------------------- consent and capabilities (security review M1)


def test_the_sentence_never_leaves_the_machine_without_consent(sample):
    calls = []

    def transport(payload):
        calls.append(payload)
        return {"candidates": [{"content": {"parts": [{"text": json.dumps({"path": "src/billing.py"})}]}}]}

    app = _app(_entries(sample), gemini_transport=transport)
    for body in (
        {"text": "sample — Why was the money code added?"},
        {"text": "sample — Why was the money code added?", "allow_ai": False},
    ):
        status, result = asgi(app, "POST", "/interpret", body)
        assert status == 200 and result["interpreter"] == "deterministic" and result["mode"] == "NEEDS_TARGET"
    assert calls == []


def test_consent_must_be_a_real_boolean(sample):
    app = _app(_entries(sample), gemini_transport=lambda _p: {})
    assert asgi(app, "POST", "/interpret", {"text": "x", "allow_ai": "yes"})[0] == 400


def test_the_payload_that_leaves_contains_no_repository_identifiers(sample):
    sent = []

    def transport(payload):
        sent.append(json.dumps(payload))
        return {}

    entries = _entries(sample)
    entries["another"] = RegistryEntry(repository_id="another", root=entries["sample"].root)
    asgi(_app(entries, gemini_transport=transport), "POST", "/interpret", {"text": "sample — Why was the money code added?", "allow_ai": True})
    assert len(sent) == 1
    for name in ("another", "allowed_repository_ids", str(sample.path)):
        assert name not in sent[0]
    assert "Why was the money code added?" in sent[0]


def test_capabilities_report_availability_and_never_a_secret(sample):
    secret = "AIza-test-secret-value"
    off = asgi(_app(_entries(sample)), "GET", "/capabilities")
    assert off[0] == 200 and off[1]["ai_interpreter"]["available"] is False
    on = asgi(_app(_entries(sample), gemini_transport=lambda _p: {}), "GET", "/capabilities")
    assert on[1]["ai_interpreter"]["available"] is True
    assert on[1]["ai_interpreter"]["model"] == "gemini-3.6-flash"
    assert secret not in json.dumps(on[1])


def test_the_interpret_response_says_what_the_ai_reader_did(sample):
    def refuse(_payload):
        raise gemini.ProviderError("HTTP_ERROR", http_status=403, stage="BEFORE_HEADERS")

    app = _app(_entries(sample), gemini_transport=refuse)
    status, body = asgi(app, "POST", "/interpret", {"text": "sample — Why was the money code added?", "allow_ai": True})
    assert status == 200
    assert body["interpreter"] == "deterministic" and body["mode"] == "NEEDS_TARGET"
    assert body["ai_status"] == "AI_HTTP_ERROR"
    assert "403" not in json.dumps(body)  # the provider status is logged, not returned


def test_the_interpret_response_reports_not_requested_and_not_needed(sample):
    app = _app(_entries(sample), gemini_transport=lambda _p: {})
    assert asgi(app, "POST", "/interpret", {"text": "sample — Why was the money code added?"})[1]["ai_status"] == "NOT_REQUESTED"
    assert asgi(app, "POST", "/interpret", {"text": "sample — Explain src/billing.py", "allow_ai": True})[1]["ai_status"] == "NOT_NEEDED"
