"""Request interpretation tests (Spec 4 section 8; Requirement 3)."""

from __future__ import annotations

import http.client
import logging
import logging
import socket
import time
import urllib.request
import http.server
import json
import threading

import pytest

from app.modules.intent import groq
from app.modules.intent.parser import RepositoryRef, interpret

TREE = {
    "sean": ["backend/app/main.py", "backend/app/api/app.py", "src/billing.py", "src/cache_layer.py", "README.md", "docs/payments.md"],
    "acme": ["lib/auth.py", "lib/session.py"],
}
REFS = {
    "sean": RepositoryRef("sean", ("eddydeoleo", "sean")),
    "acme": RepositoryRef("acme", None),
}


def _tree(repository_id: str) -> list[str]:
    return TREE.get(repository_id, [])


def _run(sentence, **kw):
    return interpret(sentence, REFS, _tree, **kw)


def test_reference_dash_and_a_path_in_the_tree_investigates_that_file():
    plan = _run("sean — Why was src/billing.py changed?")
    assert (plan.mode, plan.repository_id, plan.target_path, plan.interpreter) == ("INVESTIGATE", "sean", "src/billing.py", "deterministic")
    assert plan.question == "Why was src/billing.py changed?"


@pytest.mark.parametrize("separator", ["—", "–", "--", "-", ":"])
def test_separators(separator):
    plan = _run(f"acme {separator} Explain lib/auth.py")
    assert (plan.mode, plan.repository_id, plan.target_path) == ("INVESTIGATE", "acme", "lib/auth.py")


def test_colon_attached_to_the_reference():
    assert _run("acme: Explain lib/auth.py").repository_id == "acme"


def test_github_url_matching_a_registered_identity_resolves_to_the_registered_id():
    plan = _run("https://github.com/EddyDeOleo/Sean — Explain the cache layer")
    assert plan.repository_id == "sean"
    assert plan.mode == "NEEDS_TARGET" and "src/cache_layer.py" in plan.candidates


def test_github_url_with_dot_git_suffix():
    assert _run("https://github.com/eddydeoleo/sean.git - Improve our engineering workflow").repository_id == "sean"


def test_unregistered_github_url_is_unresolved_and_says_it_does_not_clone():
    plan = _run("https://github.com/company/project — Explain the authentication architecture")
    assert plan.mode == "UNRESOLVED" and plan.repository_id is None
    assert "does not clone" in (plan.message or "")


def test_no_reference_uses_the_selected_repository():
    plan = _run("Why does src/billing.py exist?", selected_repository_id="sean")
    assert (plan.mode, plan.repository_id) == ("INVESTIGATE", "sean")


def test_no_reference_and_several_repositories_is_unresolved():
    plan = _run("Why does src/billing.py exist?")
    assert plan.mode == "UNRESOLVED" and plan.repository_id is None


def test_a_single_registered_repository_is_assumed():
    plan = interpret("Why does lib/auth.py exist?", {"acme": REFS["acme"]}, _tree)
    assert plan.repository_id == "acme"


def test_a_leading_word_that_is_a_repository_id_is_not_taken_without_a_separator():
    plan = _run("sean why does src/billing.py exist", selected_repository_id="acme")
    assert plan.repository_id == "acme" and plan.target_path is None


def test_unknown_selected_repository_is_ignored():
    assert _run("explain things", selected_repository_id="nope").mode == "UNRESOLVED"


def test_a_path_that_is_not_in_the_tree_is_never_accepted():
    plan = _run("sean — Why was src/missing.py changed?")
    assert plan.target_path is None and plan.mode == "NEEDS_TARGET"


@pytest.mark.parametrize("token", ["../secret.py", "..\\..\\secret.py", "/etc/passwd.conf", "C:\\Windows\\win.ini"])
def test_traversal_style_tokens_are_never_accepted(token):
    plan = _run(f"sean — Explain {token}")
    assert plan.target_path is None


def test_windows_separators_are_normalized_for_matching():
    assert _run("sean — Explain src\\billing.py").target_path == "src/billing.py"


def test_symbol_extracted_from_backticks_or_keyword():
    assert _run("sean — Why does `charge` in src/billing.py validate input?").symbol == "charge"
    assert _run("sean — Why does function charge in src/billing.py validate?").symbol == "charge"
    assert _run("sean — Explain src/billing.py").symbol is None


@pytest.mark.parametrize(
    "text",
    [
        "sean — Analyze this repository and identify opportunities to improve its engineering workflow with Kiro.",
        "sean — Which hooks would help here?",
        "sean — recommend steering and specs",
    ],
)
def test_workflow_requests_are_advice(text):
    plan = _run(text)
    assert plan.mode == "ADVISE" and plan.repository_id == "sean" and plan.target_path is None


def test_a_path_wins_over_advice_words():
    assert _run("sean — improve src/billing.py").mode == "INVESTIGATE"


def test_needs_target_offers_only_real_paths():
    plan = _run("sean — Why was the billing logic introduced?")
    assert plan.mode == "NEEDS_TARGET"
    assert plan.candidates == ["src/billing.py"]
    assert set(plan.candidates) <= set(TREE["sean"])


def test_needs_target_without_matches_says_how_to_continue():
    plan = _run("sean — Why was zzzz introduced?")
    assert plan.mode == "NEEDS_TARGET" and plan.candidates == [] and "Name a file" in (plan.message or "")


def test_empty_and_oversized_input():
    assert _run("   ").mode == "UNRESOLVED"
    long = "sean — Explain src/billing.py " + "x" * 5000
    assert _run(long).target_path == "src/billing.py"
    assert len(_run(long).question) <= 2000


# ---------------------------------------------------------------- Groq hint


class Counter:
    """A hint that records its calls and returns the outcome a real provider reply would produce."""

    def __init__(self, answer):
        self.calls = []
        self.answer = answer

    def __call__(self, sentence):
        self.calls.append(sentence)
        if isinstance(self.answer, dict):
            return groq.HintOutcome("AI_USED", self.answer)
        return groq.HintOutcome("AI_INVALID_REPLY", None)


def test_the_hint_is_not_called_when_the_parser_resolved_the_request():
    hint = Counter({"path": "src/billing.py"})
    assert _run("sean — Explain src/billing.py", hint=hint).interpreter == "deterministic"
    assert _run("sean — improve our workflow", hint=hint).interpreter == "deterministic"
    assert hint.calls == []


def test_a_valid_hint_is_accepted_and_labelled():
    hint = Counter({"repository_id": "sean", "path": "src/billing.py", "symbol": "charge", "mode": "INVESTIGATE"})
    plan = _run("sean — Why was the money code added?", hint=hint)
    assert (plan.mode, plan.target_path, plan.symbol, plan.interpreter) == ("INVESTIGATE", "src/billing.py", "charge", "groq")
    assert hint.calls == ["Why was the money code added?"]


@pytest.mark.parametrize(
    "answer",
    [
        {"path": "src/invented.py"},
        {"path": "../../etc/passwd"},
        {"repository_id": "acme", "path": "lib/auth.py"},
        {"path": 5},
        {"path": ["src/billing.py"]},
        "src/billing.py",
        None,
        {},
    ],
)
def test_an_invalid_hint_is_discarded(answer):
    plan = _run("sean — Why was zzzz introduced?", hint=Counter(answer))
    assert plan.interpreter == "deterministic" and plan.target_path is None and plan.mode == "NEEDS_TARGET"


def test_a_hint_symbol_must_look_like_a_symbol():
    plan = _run("sean — Why was zzzz introduced?", hint=Counter({"path": "src/billing.py", "symbol": "a; rm -rf /"}))
    assert plan.target_path == "src/billing.py" and plan.symbol is None


def test_hint_advise_mode_is_accepted():
    assert _run("sean — what next?", hint=Counter({"mode": "ADVISE"})).mode == "ADVISE"


# ---------------------------------------------------------------- Groq adapter


def test_payload_contains_only_the_users_sentence():
    payload = groq.build_payload("Why was src/billing.py changed?")
    text = json.dumps(payload)
    assert "src/billing.py" in text  # the user's own words
    body = json.loads(payload["messages"][1]["content"])
    assert body == {"sentence": "Why was src/billing.py changed?"}
    assert set(payload) == {"model", "messages", "response_format", "temperature"}
    # No repository IDs and no registered names can be in the payload: the function takes nothing but the sentence.
    assert "repository" not in json.dumps(payload["messages"][1])  # the user message only; the fixed instruction is not user data


def test_payload_sentence_is_bounded():
    payload = groq.build_payload("x" * 5000)
    assert len(json.loads(payload["messages"][1]["content"])["sentence"]) == groq.MAX_HINT_TEXT


def test_parse_response():
    good = {"choices": [{"message": {"content": json.dumps({"path": "a.py"})}}]}
    assert groq.parse_response(good) == {"path": "a.py"}
    for bad in ({}, {"choices": []}, {"choices": [{"message": {"content": "not json"}}]}, {"choices": [{"message": {"content": "[1]"}}]}):
        assert groq.parse_response(bad) is None


def test_no_hint_without_a_transport():
    assert groq.build_hint(None) is None


def test_transport_failure_returns_no_hint():
    def broken(_payload):
        raise OSError("down")

    outcome = groq.build_hint(broken)("anything")
    assert outcome.value is None and outcome.status == "AI_UNEXPECTED"


@pytest.mark.parametrize("error", [RecursionError(), http.client.BadStatusLine("x"), TimeoutError(), ValueError("x")])
def test_other_provider_errors_also_fall_back(error):
    def broken(_payload):
        raise error

    outcome = groq.build_hint(broken)("anything")
    assert outcome.value is None and outcome.status == "AI_UNEXPECTED"


def test_malformed_provider_reply_returns_no_hint():
    outcome = groq.build_hint(lambda _p: {"unexpected": True})("anything")
    assert outcome.value is None and outcome.status == "AI_INVALID_REPLY"


def test_transport_is_enabled_only_by_the_environment_variable(monkeypatch):
    monkeypatch.delenv(groq.API_KEY_VARIABLE, raising=False)
    assert groq.transport_from_environment() is None
    monkeypatch.setenv(groq.API_KEY_VARIABLE, "   ")
    assert groq.transport_from_environment() is None
    monkeypatch.setenv(groq.API_KEY_VARIABLE, "test-key-not-real")
    assert groq.transport_from_environment() is not None


def test_approved_model_and_fixed_host():
    assert groq.MODEL == "openai/gpt-oss-20b"
    assert groq.ENDPOINT.startswith("https://api.groq.com/")
    assert groq.build_payload("x")["model"] == groq.MODEL


# ---------------------------------------------------------------- real transport against a local server


class _Recorder(http.server.BaseHTTPRequestHandler):
    seen: list[dict] = []
    mode = "ok"

    def log_message(self, *args):  # silence
        return

    def do_POST(self):
        length = int(self.headers.get("content-length", "0"))
        body = self.rfile.read(length)
        type(self).seen.append({"path": self.path, "key": self.headers.get("authorization"), "user_agent": self.headers.get("user-agent"), "body": json.loads(body)})
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", "/followed")
            self.end_headers()
            return
        payload = b"x" * (groq.RESPONSE_LIMIT_BYTES + 10) if type(self).mode == "big" else json.dumps({"ok": True}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


@pytest.fixture
def local_server(monkeypatch):
    _Recorder.seen = []
    _Recorder.mode = "ok"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Recorder)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    monkeypatch.setattr(groq, "ENDPOINT", base + "/generate")
    yield base
    server.shutdown()
    server.server_close()


def test_transport_identifies_sean_with_a_descriptive_user_agent_and_no_browser_string(local_server):
    groq.make_transport("test-key-not-real")({"hello": "world"})
    seen = _Recorder.seen[-1]
    assert seen["user_agent"] == "Sean/1.0"
    assert "Mozilla" not in seen["user_agent"] and "Python-urllib" not in seen["user_agent"]
    assert seen["key"] == "Bearer test-key-not-real"  # authentication unchanged


def test_success_headers_are_passed_only_to_a_diagnostic_callback(local_server):
    received = []
    groq.make_transport("test-key-not-real", on_response_headers=lambda headers: received.append(headers))({"hello": "world"})
    assert len(received) == 1 and received[0].get("content-type") == "application/json"


def test_transport_without_callback_behaves_as_before(local_server):
    assert groq.make_transport("test-key-not-real")({"hello": "world"}) == {"ok": True}

def test_transport_sends_the_key_in_a_header_and_never_in_the_url_or_body(local_server):
    reply = groq.make_transport("test-key-not-real")({"hello": "world"})
    assert reply == {"ok": True}
    seen = _Recorder.seen[0]
    assert seen["key"] == "Bearer test-key-not-real"
    assert seen["path"] == "/generate" and "key" not in seen["path"]
    assert "test-key-not-real" not in json.dumps(seen["body"])


def test_transport_does_not_follow_redirects(local_server, monkeypatch):
    monkeypatch.setattr(groq, "ENDPOINT", local_server + "/redirect")
    with pytest.raises(groq.ProviderError) as caught:
        groq.make_transport("test-key-not-real")({})
    assert caught.value.category == "HTTP_ERROR" and caught.value.http_status == 302
    assert [item["path"] for item in _Recorder.seen] == ["/redirect"]  # the redirect target was never contacted


def test_transport_rejects_an_oversized_reply(local_server):
    _Recorder.mode = "big"
    with pytest.raises(groq.ProviderError) as caught:
        groq.make_transport("test-key-not-real")({})
    assert caught.value.category == "RESPONSE_TOO_LARGE"


def test_a_provider_that_trickles_its_reply_hits_the_total_deadline(local_server, monkeypatch):
    import time

    class Slow(_Recorder):
        def do_POST(self):
            self.rfile.read(int(self.headers.get("content-length", "0")))
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", "100000")
            self.end_headers()
            for _ in range(40):
                try:
                    self.wfile.write(b" " * 10)
                    self.wfile.flush()
                except OSError:
                    return
                time.sleep(0.1)

    slow_server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Slow)
    threading.Thread(target=slow_server.serve_forever, daemon=True).start()
    try:
        monkeypatch.setattr(groq, "ENDPOINT", f"http://127.0.0.1:{slow_server.server_address[1]}/generate")
        started = time.monotonic()
        with pytest.raises(groq.ProviderError) as caught:
            groq.make_transport("test-key-not-real", deadline=0.5)({})
        assert caught.value.category == "TIMEOUT"
        assert time.monotonic() - started < 3
    finally:
        slow_server.shutdown()
        slow_server.server_close()


# ---------------------------------------------------------------- failure categories (diagnostic, requirement 5)


class _Behaviour(http.server.BaseHTTPRequestHandler):
    """A local stand-in for the provider. Its behaviour is chosen per test: reply, sleep, error, or garbage."""

    plan: dict = {}

    def log_message(self, *args):
        return

    def do_POST(self):
        self.rfile.read(int(self.headers.get("content-length", "0")))
        behaviour = type(self).plan
        if behaviour.get("sleep"):
            time.sleep(behaviour["sleep"])
        status = behaviour.get("status", 200)
        body = behaviour.get("body", json.dumps({"choices": [{"message": {"content": json.dumps({"mode": "ADVISE"})}}]}).encode())
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except OSError:
            return


@pytest.fixture
def provider(monkeypatch):
    _Behaviour.plan = {}
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Behaviour)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    monkeypatch.setattr(groq, "ENDPOINT", f"http://127.0.0.1:{server.server_address[1]}/generate")
    yield _Behaviour
    server.shutdown()
    server.server_close()


def _category(transport, payload=None):
    with pytest.raises(groq.ProviderError) as caught:
        transport(payload or {})
    return caught.value


def test_a_reply_is_parsed(provider):
    assert groq.make_transport("test-key-not-real")({})["choices"]


def test_timeout_is_reported_as_timeout_not_as_a_connection_failure(provider):
    provider.plan = {"sleep": 2.0}
    started = time.monotonic()
    error = _category(groq.make_transport("test-key-not-real", timeout=0.3, deadline=0.3))
    assert error.category == "TIMEOUT" and error.http_status is None
    assert error.stage == "BEFORE_HEADERS"
    assert time.monotonic() - started < 2.5


def test_http_error_keeps_its_status_and_redacts_the_key_in_diagnostics(provider):
    secret = "test-key-not-real"
    provider.plan = {"status": 403, "body": f'{{"error": "denied for {secret}"}}'.encode()}
    error = _category(groq.make_transport(secret, diagnostic=True))
    assert error.category == "HTTP_ERROR" and error.http_status == 403
    assert error.detail is not None and secret not in error.detail and "[key removed]" in error.detail


def test_http_error_outside_diagnostics_carries_no_provider_text(provider):
    provider.plan = {"status": 500, "body": b'{"error": "internal detail"}'}
    error = _category(groq.make_transport("test-key-not-real"))
    assert error.category == "HTTP_ERROR" and error.http_status == 500 and error.detail is None


def test_connection_refused_is_a_connection_failure():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        closed_port = probe.getsockname()[1]
    original = groq.ENDPOINT
    groq.ENDPOINT = f"http://127.0.0.1:{closed_port}/generate"
    try:
        error = _category(groq.make_transport("test-key-not-real", timeout=2))
    finally:
        groq.ENDPOINT = original
    # On some Windows setups a refused localhost connection surfaces as a connect timeout. Either way no reply started.
    assert error.category in {"CONNECTION_FAILED", "TIMEOUT"} and error.stage == "BEFORE_HEADERS"


def test_a_body_that_is_not_json_is_an_invalid_reply(provider):
    provider.plan = {"body": b"<html>not json</html>"}
    assert _category(groq.make_transport("test-key-not-real")).category == "INVALID_REPLY"


def test_a_json_reply_without_text_is_a_parse_failure_not_a_transport_failure(provider):
    provider.plan = {"body": b'{"choices": []}'}
    outcome = groq.build_hint(groq.make_transport("test-key-not-real"))("a sentence")
    assert outcome.status == "AI_INVALID_REPLY" and outcome.value is None


def test_each_outcome_status_is_reported_by_the_hint(provider):
    provider.plan = {"sleep": 2.0}
    hint = groq.build_hint(groq.make_transport("test-key-not-real", timeout=0.3, deadline=0.3))
    assert hint("a sentence").status == "AI_TIMEOUT"
    provider.plan = {"status": 503, "body": b"{}"}
    outcome = hint("a sentence")
    assert outcome.status == "AI_HTTP_ERROR" and outcome.http_status == 503
    provider.plan = {}
    outcome = hint("a sentence")
    assert outcome.status == "AI_USED" and outcome.value == {"mode": "ADVISE"}
    assert outcome.elapsed_ms >= 0


def test_the_timeout_is_taken_from_the_argument_not_a_constant(provider, monkeypatch):
    seen = {}
    real_open = urllib.request.build_opener

    def recording_builder(*handlers):
        opener = real_open(*handlers)
        original = opener.open

        def open_with_record(request, timeout=None, **kwargs):
            seen["timeout"] = timeout
            return original(request, timeout=timeout, **kwargs)

        opener.open = open_with_record
        return opener

    monkeypatch.setattr(groq.urllib.request, "build_opener", recording_builder)
    groq.make_transport("test-key-not-real", timeout=37.5)({})
    assert seen["timeout"] == 37.5


# ---------------------------------------------------------------- what reaches the logs (requirement 4 and 7)


def test_logs_show_the_failure_without_the_key_the_sentence_or_the_reply(provider, caplog):
    secret = "test-key-not-real"
    sentence = "a private sentence about pricing"
    provider.plan = {"status": 403, "body": b'{"error": "reply text with test-key-not-real"}'}
    caplog.set_level(logging.DEBUG)
    groq.build_hint(groq.make_transport(secret, diagnostic=True))(sentence)
    assert "AI_HTTP_ERROR" in caplog.text and "http=403" in caplog.text
    assert secret not in caplog.text
    assert sentence not in caplog.text
    assert "reply text" not in caplog.text


def test_an_unexpected_exception_is_logged_by_class_only(caplog):
    def broken(_payload):
        raise ValueError("secret-bearing message test-key-not-real")

    caplog.set_level(logging.DEBUG)
    outcome = groq.build_hint(broken)("sentence")
    assert outcome.status == "AI_UNEXPECTED"
    assert "ValueError" in caplog.text
    assert "test-key-not-real" not in caplog.text


# ---------------------------------------------------------------- the parser reports what happened


def test_parser_status_for_a_failed_attempt_reaches_the_plan():
    failed = lambda _q: groq.HintOutcome("AI_TIMEOUT", None, None, 10000)  # noqa: E731
    plan = _run("sean — Why was the discount logic moved here?", hint=failed)
    assert plan.mode == "NEEDS_TARGET" and plan.interpreter == "deterministic"
    assert plan.ai_status == "AI_TIMEOUT"


def test_parser_status_for_a_used_answer():
    plan = _run("sean — Why was the discount logic moved here?", hint=Counter({"path": "src/billing.py"}))
    assert plan.ai_status == "AI_USED" and plan.interpreter == "groq"


def test_parser_status_when_the_answer_was_unusable():
    plan = _run("sean — Why was the discount logic moved here?", hint=Counter({"path": "src/invented.py"}))
    assert plan.ai_status == "AI_NO_USABLE_ANSWER" and plan.interpreter == "deterministic"


def test_parser_status_when_the_reader_was_not_needed_or_not_offered():
    assert _run("sean — Explain src/billing.py", hint=Counter({})).ai_status == "NOT_NEEDED"
    assert _run("sean — Explain src/billing.py").ai_status == "NOT_REQUESTED"
    assert _run("sean — improve our workflow", hint=Counter({})).ai_status == "NOT_NEEDED"
    assert _run("Why was the discount logic moved here?").ai_status == "NOT_REQUESTED"


def test_a_failed_attempt_still_produces_the_deterministic_answer_and_its_candidates():
    failed = lambda _q: groq.HintOutcome("AI_CONNECTION_FAILED", None, None, 40)  # noqa: E731
    plan = _run("sean — Why was the billing logic introduced?", hint=failed)
    assert plan.mode == "NEEDS_TARGET" and plan.candidates == ["src/billing.py"]


# ---------------------------------------------------------------- provider request identifier (support only)


def test_request_id_keeps_only_a_short_plain_token():
    assert groq._request_id({"cf-ray": "8a1b2c3d4e5f6789-MXP"}) == "8a1b2c3d4e5f6789-MXP"
    assert groq._request_id({"x-request-id": "req_01abc.def"}) == "req_01abc.def"
    # cf-ray is preferred when both are present.
    assert groq._request_id({"x-request-id": "req_1", "cf-ray": "ray_2"}) == "ray_2"


def test_request_id_rejects_anything_unsafe_or_too_long():
    assert groq._request_id({"cf-ray": "abc\r\nInjected: header"}) is None
    assert groq._request_id({"cf-ray": "x" * 65}) is None
    assert groq._request_id({"cf-ray": "<script>"}) is None
    assert groq._request_id({"cf-ray": "   "}) is None
    assert groq._request_id({}) is None
    assert groq._request_id(None) is None


@pytest.mark.parametrize("status", [403, 429, 500, 503])
def test_each_http_status_falls_back_and_keeps_its_status(provider, status):
    provider.plan = {"status": status, "body": b"{}"}
    outcome = groq.build_hint(groq.make_transport("test-key-not-real"))("a sentence")
    assert outcome.status == "AI_HTTP_ERROR" and outcome.http_status == status
    assert outcome.value is None


# ---------------------------------------------------------------- contract reasons, sanitized payload, diagnostics (Spec 4 section 8)

from app.modules.intent import parser as parser_module  # noqa: E402
from app.modules.intent.groq import HintOutcome  # noqa: E402


@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ({"mode": "INVESTIGATE"}, "PATH_MISSING"),
        ({"mode": "INVESTIGATE", "path": "nope.py"}, "PATH_NOT_IN_COMMITTED_TREE"),
        ({"mode": "INVESTIGATE", "path": 5}, "PATH_NOT_TEXT:int"),
        ({"mode": "advise"}, "MODE_NOT_EXACT"),
        ({"mode": "ADVISE "}, "MODE_NOT_EXACT"),
        ({"mode": "ANSWER"}, "MODE_NOT_ALLOWED"),
        ({"mode": 5}, "MODE_NOT_TEXT:int"),
        ({}, "MODE_MISSING"),
        ("ADVISE", "NOT_AN_OBJECT"),
        ({"repository_id": "acme", "mode": "ADVISE"}, "REPOSITORY_ID_MISMATCH"),
    ],
)
def test_each_rejected_answer_has_a_fixed_reason(raw, reason):
    plan, got = parser_module._judge_hint(raw, REFS["sean"], set(TREE["sean"]), "a question")
    assert plan is None and got == reason


def test_accepted_answers_keep_their_reason_and_their_checks():
    plan, reason = parser_module._judge_hint({"mode": "ADVISE"}, REFS["sean"], set(TREE["sean"]), "q")
    assert plan is not None and plan.mode == "ADVISE" and reason == "ACCEPTED_ADVISE"
    plan, reason = parser_module._judge_hint({"path": "src/billing.py"}, REFS["sean"], set(TREE["sean"]), "q")
    assert plan is not None and plan.target_path == "src/billing.py" and reason == "ACCEPTED_TARGET"
    plan, reason = parser_module._judge_hint({"mode": "NEEDS_TARGET"}, REFS["sean"], set(TREE["sean"]), "q")
    assert plan is None and reason == parser_module.NEEDS_TARGET_ANSWERED


def test_a_needs_target_answer_keeps_the_deterministic_plan_and_counts_as_used():
    hint = Counter({"mode": "NEEDS_TARGET"})
    plan = _run("sean — Why did the team choose this?", hint=hint)
    assert (plan.mode, plan.interpreter, plan.ai_status) == ("NEEDS_TARGET", "deterministic", "AI_USED")
    assert plan.question == "Why did the team choose this?"


def test_the_hint_receives_only_the_sanitized_text_and_the_plan_keeps_the_original():
    hint = Counter({"mode": "NEEDS_TARGET"})
    original = "sean — Why does the cache in C:\\Projects\\Kiroween behave this way?"
    plan = _run(original, hint=hint, local_roots=[r"C:\Projects\Kiroween"])
    assert hint.calls == ["Why does the cache behave this way?"]
    assert plan.question == "Why does the cache in C:\\Projects\\Kiroween behave this way?"


def test_an_ambiguous_question_is_not_sent_at_all_and_says_so():
    hint = Counter({"mode": "ADVISE"})
    plan = _run("sean — Explain why the acme pricing differs", hint=hint)
    assert hint.calls == []
    assert (plan.mode, plan.interpreter, plan.ai_status) == ("NEEDS_TARGET", "deterministic", "AI_NOT_SENT")
    assert plan.question == "Explain why the acme pricing differs"


def test_a_rejected_answer_is_reported_with_its_reason_and_no_content(caplog):
    caplog.set_level(logging.WARNING, logger="sean.intent")
    hint = Counter({"mode": "INVESTIGATE"})
    plan = _run("sean — Summarize the mood of the zebraword afternoon", hint=hint)
    assert plan.ai_status == "AI_NO_USABLE_ANSWER"
    assert "PATH_MISSING" in caplog.text
    assert "zebraword" not in caplog.text and "Summarize" not in caplog.text


def test_the_fixed_instruction_never_names_the_product_or_a_registry_value():
    # The instruction is sent on every request. It must not share words with a registered identifier, so that the check
    # "no registry value leaves" stays a whole-word check with no exceptions.
    assert "sean" not in groq._INSTRUCTION.lower()
    assert "sample" not in groq._INSTRUCTION.lower()

def test_the_system_instruction_describes_the_schema_and_forbids_invention():
    instruction = groq._INSTRUCTION
    assert '\"mode\": \"ADVISE\" or \"NEEDS_TARGET\"' in instruction
    assert "Always return" in instruction and "never invent" in instruction.lower()
    payload = groq.build_payload("Why do layers exist?")
    assert payload["messages"][0]["content"] == groq._INSTRUCTION


@pytest.mark.parametrize(
    "content",
    [None, "", "not json", "[1, 2]", "{\"mode\": ", 12],
)
def test_malformed_chat_content_is_an_invalid_reply(content):
    transport = lambda _payload: {"choices": [{"message": {"content": content}}]}  # noqa: E731
    outcome = groq.build_hint(transport)("a sentence")
    assert outcome.status == "AI_INVALID_REPLY" and outcome.value is None


def test_a_reply_without_choices_is_an_invalid_reply():
    outcome = groq.build_hint(lambda _payload: {"choices": []})("a sentence")
    assert outcome.status == "AI_INVALID_REPLY"