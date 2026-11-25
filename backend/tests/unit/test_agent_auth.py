"""The local agent boundary (Spec 4 section 13, amended 2026-11-23; D05): exact origin lists, pairing, bearer tokens,
CORS for configured web origins only, and the body limit. The app is built with the same function as app.main_advisor."""

from __future__ import annotations

import asyncio
import json
import logging

import pytest
from fastapi import FastAPI, Request

from app.api import agent_auth
from app.api.agent_auth import (
    CODE_SECONDS,
    MAX_BODY_BYTES,
    START_COOLDOWN_SECONDS,
    TOKEN_SECONDS,
    PairingService,
    add_agent_boundary,
)
from app.api.local_guard import (
    DEFAULT_LOOPBACK_ORIGINS,
    OriginConfigError,
    loopback_origins_from_environment,
    web_origins_from_environment,
)

WEB = "https://sean-test.netlify.app"
OTHER_WEB = "https://other.netlify.app"
HOST = {"host": "127.0.0.1:8000"}


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


class Console:
    """Captures the codes the agent would print in its console."""

    def __init__(self) -> None:
        self.codes: list[str] = []

    def __call__(self, origin: str, code: str) -> None:
        self.codes.append(code)


def build(web=frozenset({WEB, OTHER_WEB}), loopback=DEFAULT_LOOPBACK_ORIGINS):
    clock, console = Clock(), Console()
    service = PairingService(announce=console, clock=clock)
    app = FastAPI()

    @app.get("/repositories")
    def repositories() -> dict:
        return {"repositories": []}

    @app.post("/repositories")
    async def add(request: Request) -> dict:
        return {"received": len(await request.body())}

    @app.post("/repositories/{repository_id}/profile")
    def profile(repository_id: str) -> dict:
        return {"profiled": repository_id}

    @app.delete("/repositories/{repository_id}")
    def remove(repository_id: str) -> dict:
        return {"removed": repository_id}

    add_agent_boundary(app, loopback, web, service)
    return app, service, clock, console


def call(app, method, path, headers=None, body=None, raw=None, chunks=None):
    """One request through the ASGI app. Returns (status, headers, decoded JSON body or text)."""
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else b"")
    merged = {**HOST, **(headers or {})}
    if body is not None and "content-type" not in merged:
        merged["content-type"] = "application/json"
    if chunks is None and data and "content-length" not in merged:
        merged["content-length"] = str(len(data))
    pieces = chunks if chunks is not None else [data]
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http",
        "path": path, "raw_path": path.encode(), "query_string": b"", "root_path": "",
        "headers": [(k.encode("latin-1"), v.encode("latin-1")) for k, v in merged.items()],
        "client": ("127.0.0.1", 50000), "server": ("127.0.0.1", 8000),
    }
    queue = [{"type": "http.request", "body": piece, "more_body": i < len(pieces) - 1} for i, piece in enumerate(pieces)]
    messages = []

    async def receive():
        return queue.pop(0) if queue else {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    start = messages[0]
    response_headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in start.get("headers", [])}
    text = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body").decode()
    try:
        parsed = json.loads(text) if text else None
    except json.JSONDecodeError:
        parsed = text
    return start["status"], response_headers, parsed


def pair(app, console, origin=WEB):
    status, _, _ = call(app, "POST", "/pair/start", {"origin": origin}, body={})
    assert status == 200
    status, _, body = call(app, "POST", "/pair/complete", {"origin": origin}, body={"code": console.codes[-1]})
    assert status == 200
    return body["token"]


def auth(token, origin=WEB):
    return {"origin": origin, "authorization": f"Bearer {token}"}


# --- origin configuration -------------------------------------------------------------------------------------------


def test_loopback_origins_default_to_the_dev_server_and_none_means_none():
    assert loopback_origins_from_environment({}) == DEFAULT_LOOPBACK_ORIGINS
    assert loopback_origins_from_environment({"SEAN_LOOPBACK_ORIGINS": "  "}) == DEFAULT_LOOPBACK_ORIGINS
    assert loopback_origins_from_environment({"SEAN_LOOPBACK_ORIGINS": "none"}) == frozenset()
    assert loopback_origins_from_environment({"SEAN_LOOPBACK_ORIGINS": "http://127.0.0.1:5273, HTTP://LOCALHOST:5273"}) == {
        "http://127.0.0.1:5273", "http://localhost:5273",
    }


@pytest.mark.parametrize("value", ["http://127.0.0.1", "http://example.com:80", "http://127.0.0.1:5173/", "*", "http://*:5173"])
def test_invalid_loopback_origins_stop_the_agent(value):
    with pytest.raises(OriginConfigError):
        loopback_origins_from_environment({"SEAN_LOOPBACK_ORIGINS": value})


def test_web_origins_are_exact():
    assert web_origins_from_environment({}) == frozenset()
    assert web_origins_from_environment({"SEAN_ALLOWED_ORIGINS": f"{WEB},http://127.0.0.1:4173"}) == {WEB, "http://127.0.0.1:4173"}


@pytest.mark.parametrize("value", ["https://*.netlify.app", "http://sean.netlify.app", f"{WEB}/", f"{WEB}/path", "null", "sean.netlify.app"])
def test_invalid_web_origins_stop_the_agent(value):
    with pytest.raises(OriginConfigError):
        web_origins_from_environment({"SEAN_ALLOWED_ORIGINS": value})


# --- guard: exact origins, unchanged Host rule ----------------------------------------------------------------------


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "https://sean-test.netlify.app.evil.example",  # lookalike
        "http://sean-test.netlify.app",  # wrong scheme
        "https://sean-test.netlify.app:8443",  # wrong port
        "https://sean-test.netlify.app/",  # not an exact origin
        "null",
        "http://localhost:3000",  # another local web page
        "http://127.0.0.1:8000",
    ],
)
def test_unlisted_origins_are_refused_on_every_route(origin):
    app, _, _, console = build()
    for method, path, body in (("GET", "/repositories", None), ("POST", "/repositories", {}), ("POST", "/pair/start", {}), ("GET", "/agent/status", None)):
        status, headers, response = call(app, method, path, {"origin": origin}, body=body)
        assert (status, response["code"]) == (403, "REQUEST_REFUSED"), (origin, path)
        assert "access-control-allow-origin" not in headers
    assert console.codes == []


@pytest.mark.parametrize("host", ["evil.example", "127.0.0.1.evil.example", ""])
def test_rebinding_hosts_are_refused_even_with_a_valid_token(host):
    app, _, _, console = build()
    token = pair(app, console)
    status, _, body = call(app, "GET", "/repositories", {**auth(token), "host": host})
    assert (status, body["code"]) == (403, "REQUEST_REFUSED")


def test_loopback_dev_origins_and_requests_without_origin_are_unchanged():
    app, _, _, _ = build()
    for headers in ({}, {"origin": "http://127.0.0.1:5173"}, {"origin": "http://localhost:5173"}):
        assert call(app, "GET", "/repositories", headers)[0] == 200
        assert call(app, "POST", "/repositories", headers, body={"a": 1})[0] == 200
    assert call(app, "GET", "/repositories", {"origin": "http://127.0.0.1:5173"})[0] == 200


def test_agent_mode_refuses_every_loopback_browser_origin():
    app, _, _, _ = build(loopback=frozenset())
    assert call(app, "GET", "/repositories", {"origin": "http://127.0.0.1:5173"})[0] == 403
    assert call(app, "GET", "/repositories")[0] == 200  # no Origin: a local program, as before


# --- tokens ----------------------------------------------------------------------------------------------------------


def test_a_web_origin_needs_a_valid_token_for_every_protected_route():
    app, _, _, console = build()
    for headers in ({"origin": WEB}, {"origin": WEB, "authorization": "Bearer not-a-token"}, {"origin": WEB, "authorization": "Basic abc"}):
        for method, path, body in (("GET", "/repositories", None), ("POST", "/repositories", {}), ("DELETE", "/repositories/alpha", None)):
            status, _, response = call(app, method, path, headers, body=body)
            assert (status, response["code"]) == (401, "AGENT_UNAUTHORIZED"), (headers, path)
    token = pair(app, console)
    assert call(app, "GET", "/repositories", auth(token))[0] == 200
    assert call(app, "POST", "/repositories", auth(token), body={"a": 1})[0] == 200
    assert call(app, "DELETE", "/repositories/alpha", auth(token))[0] == 200


def test_a_token_is_bound_to_the_origin_it_was_issued_to():
    app, _, _, console = build()
    token = pair(app, console)
    status, _, body = call(app, "GET", "/repositories", auth(token, OTHER_WEB))
    assert (status, body["code"]) == (401, "AGENT_UNAUTHORIZED")


def test_a_token_expires_after_twelve_hours():
    app, _, clock, console = build()
    token = pair(app, console)
    clock.now += TOKEN_SECONDS - 1
    assert call(app, "GET", "/repositories", auth(token))[0] == 200
    clock.now += 1
    assert call(app, "GET", "/repositories", auth(token))[0] == 401


def test_restarting_the_agent_revokes_every_token():
    # A restart is a new process with a new, empty store. Nothing is read from or written to disk.
    app, _, _, console = build()
    token = pair(app, console)
    restarted, _, _, _ = build()
    assert call(restarted, "GET", "/repositories", auth(token))[0] == 401
    assert call(app, "GET", "/repositories", auth(token))[0] == 200


def test_pairing_again_issues_a_new_token_and_the_old_one_stays_valid_until_expiry(monkeypatch):
    app, _, clock, console = build()
    first = pair(app, console)
    clock.now += START_COOLDOWN_SECONDS
    second = pair(app, console)
    assert first != second
    assert call(app, "GET", "/repositories", auth(first))[0] == 200
    assert call(app, "GET", "/repositories", auth(second))[0] == 200


def test_only_token_hashes_are_kept_and_nothing_is_written_to_disk(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))
    app, service, _, console = build()
    token = pair(app, console)
    stored = repr(vars(service))
    assert token not in stored and console.codes[-1] not in stored
    assert list(tmp_path.iterdir()) == []


# --- pairing --------------------------------------------------------------------------------------------------------


def test_pairing_codes_are_shown_in_the_console_only_and_never_returned_or_logged(caplog, capsys):
    caplog.set_level(logging.DEBUG)
    service = PairingService()  # the real console printer
    app = FastAPI()
    add_agent_boundary(app, DEFAULT_LOOPBACK_ORIGINS, frozenset({WEB}), service)
    status, _, start = call(app, "POST", "/pair/start", {"origin": WEB}, body={})
    assert status == 200 and start == {"expires_in": CODE_SECONDS}
    printed = capsys.readouterr().out
    code = printed.split(": ")[1].split(" ")[0].replace("-", "")
    assert len(code) == 8
    assert code not in json.dumps(start)
    assert all(code not in record.getMessage() and code[:4] not in record.getMessage() for record in caplog.records)
    status, _, done = call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": f"{code[:4]}-{code[4:].lower()}"})
    assert status == 200 and len(done["token"]) >= 43 and done["expires_in"] == TOKEN_SECONDS


def test_only_one_pairing_code_is_active_and_starts_have_a_cooldown():
    app, _, clock, console = build()
    assert call(app, "POST", "/pair/start", {"origin": WEB}, body={})[0] == 200
    status, headers, body = call(app, "POST", "/pair/start", {"origin": OTHER_WEB}, body={})
    assert (status, body["code"]) == (429, "PAIRING_IN_PROGRESS") and int(headers["retry-after"]) > 0
    assert len(console.codes) == 1
    clock.now += CODE_SECONDS  # the first code expires; the cooldown has passed too
    assert call(app, "POST", "/pair/start", {"origin": WEB}, body={})[0] == 200
    pair_code = console.codes[-1]
    assert call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": pair_code})[0] == 200
    status, headers, body = call(app, "POST", "/pair/start", {"origin": WEB}, body={})
    assert (status, body["code"]) == (429, "PAIRING_COOLDOWN") and 0 < int(headers["retry-after"]) <= START_COOLDOWN_SECONDS
    clock.now += START_COOLDOWN_SECONDS
    assert call(app, "POST", "/pair/start", {"origin": WEB}, body={})[0] == 200
    assert len(console.codes) == 3


def test_five_wrong_codes_lock_the_pairing():
    app, _, _, console = build()
    call(app, "POST", "/pair/start", {"origin": WEB}, body={})
    right = console.codes[-1]
    wrong = "AAAAAAAA" if right != "AAAAAAAA" else "BBBBBBBB"
    for _ in range(4):
        status, _, body = call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": wrong})
        assert (status, body["code"]) == (400, "PAIRING_CODE_INVALID")
    status, _, body = call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": wrong})
    assert (status, body["code"]) == (400, "PAIRING_LOCKED")
    status, _, body = call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": right})
    assert (status, body["code"]) == (400, "PAIRING_NOT_STARTED")


def test_an_expired_code_is_refused():
    app, _, clock, console = build()
    call(app, "POST", "/pair/start", {"origin": WEB}, body={})
    clock.now += CODE_SECONDS
    status, _, body = call(app, "POST", "/pair/complete", {"origin": WEB}, body={"code": console.codes[-1]})
    assert (status, body["code"]) == (400, "PAIRING_EXPIRED")


def test_a_code_is_bound_to_the_origin_that_started_it():
    app, _, _, console = build()
    call(app, "POST", "/pair/start", {"origin": WEB}, body={})
    status, _, body = call(app, "POST", "/pair/complete", {"origin": OTHER_WEB}, body={"code": console.codes[-1]})
    assert (status, body["code"]) == (400, "PAIRING_NOT_STARTED")


def test_pairing_is_refused_for_loopback_origins_and_requests_without_origin():
    app, _, _, console = build()
    for headers in ({}, {"origin": "http://127.0.0.1:5173"}):
        status, _, body = call(app, "POST", "/pair/start", headers, body={})
        assert (status, body["code"]) == (403, "PAIRING_NOT_ALLOWED")
    assert console.codes == []


def test_agent_status_reports_pairing_without_repository_data():
    app, _, _, console = build()
    assert call(app, "GET", "/agent/status", {"origin": WEB})[2] == {"agent": "sean", "pairing_required": True, "paired": False}
    token = pair(app, console)
    assert call(app, "GET", "/agent/status", auth(token))[2] == {"agent": "sean", "pairing_required": True, "paired": True}
    assert call(app, "GET", "/agent/status")[2] == {"agent": "sean", "pairing_required": False, "paired": False}


# --- CSRF, CORS and limits ------------------------------------------------------------------------------------------


def test_cross_origin_simple_requests_are_refused_without_side_effects():
    app, _, _, console = build()
    token = pair(app, console)
    # A form post from a foreign page: refused by the guard before any handler.
    assert call(app, "POST", "/repositories", {"origin": "https://evil.example", "content-type": "text/plain"}, raw=b"{}")[0] == 403
    # Even the paired origin must send JSON, so a text/plain simple request never reaches a handler.
    status, _, body = call(app, "POST", "/repositories", {**auth(token), "content-type": "text/plain"}, raw=b"{}")
    assert (status, body["code"]) == (415, "UNSUPPORTED_MEDIA_TYPE")
    # Form bodies and chunked bodies without a JSON type are refused the same way.
    form = {**auth(token), "content-type": "application/x-www-form-urlencoded"}
    assert call(app, "POST", "/repositories", form, raw=b"a=1")[0] == 415
    chunked = {**auth(token), "content-type": "text/plain", "transfer-encoding": "chunked"}
    assert call(app, "POST", "/repositories", chunked, chunks=[b"{", b"}"])[0] == 415


def test_a_post_without_a_body_needs_no_media_type():
    """Regression: the frontend sends POST /repositories/{id}/profile with no body and no Content-Type (415 before)."""
    app, _, _, console = build()
    token = pair(app, console)
    status, _, body = call(app, "POST", "/repositories/alpha/profile", {**auth(token), "x-sean-client": "web"})
    assert (status, body) == (200, {"profiled": "alpha"})
    # Still only with a valid token.
    assert call(app, "POST", "/repositories/alpha/profile", {"origin": WEB, "x-sean-client": "web"})[0] == 401
    # A JSON body is still accepted.
    assert call(app, "POST", "/repositories", auth(token), body={"repository_id": "x"})[0] == 200


def test_cors_is_granted_only_to_configured_web_origins():
    app, _, _, console = build()
    preflight = {"access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type"}
    status, headers, _ = call(app, "OPTIONS", "/repositories", {"origin": WEB, **preflight})
    assert status == 200
    assert headers["access-control-allow-origin"] == WEB
    assert "origin" in headers["vary"].lower()
    assert "access-control-allow-credentials" not in headers
    assert set(headers["access-control-allow-methods"].replace(" ", "").split(",")) == {"GET", "POST", "PUT", "DELETE"}
    # The repository routes require X-Sean-Client on every change, so the web origin must be allowed to send it.
    allowed = {h.strip().lower() for h in headers["access-control-allow-headers"].split(",")}
    assert {"authorization", "content-type", "x-sean-client"} <= allowed
    status, headers, _ = call(app, "OPTIONS", "/repositories", {"origin": "http://127.0.0.1:5173", **preflight})
    assert status >= 400 and "access-control-allow-origin" not in headers
    token = pair(app, console)
    _, headers, _ = call(app, "GET", "/repositories", auth(token))
    assert headers["access-control-allow-origin"] == WEB
    # A 401 is readable by the paired site, so it can ask the user to pair again.
    _, headers, _ = call(app, "GET", "/repositories", {"origin": WEB})
    assert headers["access-control-allow-origin"] == WEB


def test_no_cors_middleware_without_web_origins():
    app, _, _, _ = build(web=frozenset())
    _, headers, _ = call(app, "GET", "/repositories", {"origin": "http://127.0.0.1:5173"})
    assert "access-control-allow-origin" not in headers


def test_request_bodies_are_limited_including_chunked_ones():
    app, _, _, _ = build()
    status, _, body = call(app, "POST", "/repositories", {"content-length": str(MAX_BODY_BYTES + 1)}, raw=b"x")
    assert (status, body["code"]) == (413, "REQUEST_TOO_LARGE")
    chunk = b"x" * (MAX_BODY_BYTES // 2 + 1)
    status, _, body = call(app, "POST", "/repositories", {"content-type": "application/json"}, chunks=[chunk, chunk])
    assert (status, body["code"]) == (413, "REQUEST_TOO_LARGE")
    status, _, body = call(app, "POST", "/repositories", {"content-type": "application/json"}, chunks=[b"a" * 10, b"b" * 10])
    assert (status, body) == (200, {"received": 20})  # a body read by the middleware is passed on intact


def test_error_bodies_have_the_shared_shape():
    app, _, _, _ = build()
    _, _, body = call(app, "GET", "/repositories", {"origin": WEB})
    assert set(body) == {"code", "message", "retryable"} and body["retryable"] is False
    assert agent_auth.MAX_ATTEMPTS == 5 and CODE_SECONDS == 120
