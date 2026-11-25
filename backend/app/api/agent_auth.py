"""Pairing and bearer tokens for configured web origins (Spec 4 section 13, amended 2026-11-23; D05).

A web origin listed in SEAN_ALLOWED_ORIGINS (the Netlify site) is not trusted because of its Origin header alone: CORS and
Origin checks are not authentication. It must pair once per browser session:

1. `POST /pair/start` prints a one-time code in the agent console. The code is never returned or logged. Only one code
   is active at a time, and a new start waits START_COOLDOWN_SECONDS after the previous one.
2. The user types the code in the web page, which sends it to `POST /pair/complete`. The agent returns a random token
   bound to the requesting origin.
3. Every other request from that origin carries `Authorization: Bearer <token>`.

Tokens are kept in memory only, as SHA-256 hashes, and expire after TOKEN_SECONDS. Restarting the agent revokes them all.
Requests from loopback origins and requests without an Origin header are not affected (local_guard.py decides those).

Every request body is limited to MAX_BODY_BYTES.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.api.local_guard import LocalOnlyMiddleware

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0, O, 1 or I, which are easy to misread
CODE_LENGTH = 8
CODE_SECONDS = 120
MAX_ATTEMPTS = 5
START_COOLDOWN_SECONDS = 30
TOKEN_SECONDS = 12 * 60 * 60
MAX_BODY_BYTES = 64 * 1024
PUBLIC_ROUTES = frozenset({("GET", "/agent/status"), ("POST", "/pair/start"), ("POST", "/pair/complete")})
_BODY_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class PairingError(Exception):
    def __init__(self, code: str, status: int, message: str, retry_after: int | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.message = message
        self.retry_after = retry_after


@dataclass
class _ActiveCode:
    origin: str
    code: str
    expires_at: float
    attempts: int = 0


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_code(code: str) -> str:
    return code.replace("-", "").replace(" ", "").upper()


def print_code(origin: str, code: str) -> None:
    """Show the code in the agent console only. It is printed, not logged, so it never reaches the log file."""
    stream = sys.stdout
    if stream is None:
        return
    shown = f"{code[:4]}-{code[4:]}"
    stream.write(f"\nSean pairing code for {origin}: {shown} (valid for {CODE_SECONDS // 60} minutes)\n\n")
    stream.flush()


class PairingService:
    """One active pairing code and the issued tokens, in memory. Thread-safe."""

    def __init__(self, announce: Callable[[str, str], None] = print_code, clock: Callable[[], float] = time.monotonic) -> None:
        self._announce = announce
        self._clock = clock
        self._lock = threading.Lock()
        self._active: _ActiveCode | None = None
        self._last_start: float | None = None
        self._tokens: dict[str, tuple[str, float]] = {}  # SHA-256 of the token -> (origin, expiry)

    def start(self, origin: str) -> int:
        """Create the single active code for `origin` and show it. Returns its lifetime in seconds."""
        with self._lock:
            now = self._clock()
            if self._active is not None and self._active.expires_at <= now:
                self._active = None
            if self._active is not None:
                remaining = max(1, int(self._active.expires_at - now))
                raise PairingError("PAIRING_IN_PROGRESS", 429, "A pairing code is already active. Use it, or wait until it expires.", remaining)
            if self._last_start is not None and now - self._last_start < START_COOLDOWN_SECONDS:
                remaining = max(1, int(START_COOLDOWN_SECONDS - (now - self._last_start)))
                raise PairingError("PAIRING_COOLDOWN", 429, "Wait a moment before asking for a new pairing code.", remaining)
            code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
            self._active = _ActiveCode(origin=origin, code=code, expires_at=now + CODE_SECONDS)
            self._last_start = now
        self._announce(origin, code)
        return CODE_SECONDS

    def complete(self, origin: str, code: str) -> tuple[str, int]:
        """Exchange the active code for a token bound to `origin`. Returns the token and its lifetime in seconds."""
        with self._lock:
            now = self._clock()
            active = self._active
            if active is None or active.origin != origin:
                raise PairingError("PAIRING_NOT_STARTED", 400, "No pairing code is active for this site. Start pairing again.")
            if active.expires_at <= now:
                self._active = None
                raise PairingError("PAIRING_EXPIRED", 400, "The pairing code expired. Start pairing again.")
            if not hmac.compare_digest(_normalize_code(code).encode("utf-8"), active.code.encode("utf-8")):
                active.attempts += 1
                if active.attempts >= MAX_ATTEMPTS:
                    self._active = None
                    raise PairingError("PAIRING_LOCKED", 400, "Too many wrong codes. Start pairing again.")
                raise PairingError("PAIRING_CODE_INVALID", 400, "The pairing code is not correct.")
            self._active = None
            token = secrets.token_urlsafe(32)  # 256 bits
            self._purge(now)
            self._tokens[_hash(token)] = (origin, now + TOKEN_SECONDS)
        return token, TOKEN_SECONDS

    def verify(self, origin: str, token: str) -> bool:
        """Whether `token` was issued to `origin` by this agent process and has not expired."""
        with self._lock:
            now = self._clock()
            entry = self._tokens.get(_hash(token))
            if entry is None:
                return False
            issued_to, expires_at = entry
            if expires_at <= now:
                del self._tokens[_hash(token)]
                return False
            return hmac.compare_digest(issued_to.encode("utf-8"), origin.encode("utf-8"))

    def _purge(self, now: float) -> None:
        for key in [key for key, (_, expires_at) in self._tokens.items() if expires_at <= now]:
            del self._tokens[key]


def _error(code: str, status: int, message: str, retry_after: int | None = None) -> JSONResponse:
    headers = {"Retry-After": str(retry_after)} if retry_after is not None else None
    return JSONResponse({"code": code, "message": message, "retryable": status in (429,)}, status_code=status, headers=headers)


def _bearer(headers: dict[str, str]) -> str | None:
    value = headers.get("authorization", "")
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def _headers(scope: Scope) -> dict[str, str]:
    return {key.decode("latin-1").lower(): value.decode("latin-1") for key, value in scope["headers"]}


class AgentAuthMiddleware:
    """Body limit for every request; token and JSON checks for requests from configured web origins."""

    def __init__(self, app: ASGIApp, service: PairingService, web_origins: frozenset[str]) -> None:
        self.app = app
        self.service = service
        self.web_origins = web_origins

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = _headers(scope)
        method = scope["method"].upper()
        declared = headers.get("content-length")
        if declared is not None and (not declared.strip().isdigit() or int(declared) > MAX_BODY_BYTES):
            await _error("REQUEST_TOO_LARGE", 413, "The request body is too large.")(scope, receive, send)
            return
        origin = (headers.get("origin") or "").strip().lower()
        from_web = origin in self.web_origins and method != "OPTIONS"
        if from_web:
            if (method, scope["path"]) not in PUBLIC_ROUTES:
                token = _bearer(headers)
                if token is None or not self.service.verify(origin, token):
                    await _error("AGENT_UNAUTHORIZED", 401, "This site is not paired with the Sean agent, or its pairing expired.")(scope, receive, send)
                    return
        if method not in _BODY_METHODS:
            await self.app(scope, receive, send)
            return
        # Read the whole body first, so a chunked body without Content-Length is limited too.
        body = b""
        while True:
            message = await receive()
            if message["type"] != "http.request":
                break
            body += message.get("body", b"")
            if len(body) > MAX_BODY_BYTES:
                await _error("REQUEST_TOO_LARGE", 413, "The request body is too large.")(scope, receive, send)
                return
            if not message.get("more_body", False):
                break
        # A body from a web origin must be JSON, so a form or text/plain "simple" request never reaches a handler. A request
        # without a body (POST /repositories/{id}/profile, DELETE) carries nothing to parse and has no media type.
        if from_web and body:
            media_type = headers.get("content-type", "").split(";")[0].strip().lower()
            if media_type != "application/json":
                await _error("UNSUPPORTED_MEDIA_TYPE", 415, "Send the request as application/json.")(scope, receive, send)
                return
        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, replay, send)


class CompleteIn(BaseModel):
    code: str = Field(min_length=1, max_length=32)


def create_agent_router(service: PairingService, web_origins: frozenset[str]) -> APIRouter:
    router = APIRouter()

    def _web_origin(request: Request) -> str | None:
        origin = (request.headers.get("origin") or "").strip().lower()
        return origin if origin in web_origins else None

    @router.get("/agent/status")
    def agent_status(request: Request) -> dict[str, Any]:
        """Whether the agent is running and whether this site's token is valid. It returns no repository data."""
        origin = _web_origin(request)
        token = _bearer({key.lower(): value for key, value in request.headers.items()})
        paired = origin is not None and token is not None and service.verify(origin, token)
        return {"agent": "sean", "pairing_required": origin is not None, "paired": paired}

    @router.post("/pair/start")
    def pair_start(request: Request) -> Any:
        origin = _web_origin(request)
        if origin is None:
            return _error("PAIRING_NOT_ALLOWED", 403, "Pairing is only for configured web origins.")
        try:
            expires_in = service.start(origin)
        except PairingError as error:
            return _error(error.code, error.status, error.message, error.retry_after)
        return {"expires_in": expires_in}

    @router.post("/pair/complete")
    def pair_complete(request: Request, body: CompleteIn) -> Any:
        origin = _web_origin(request)
        if origin is None:
            return _error("PAIRING_NOT_ALLOWED", 403, "Pairing is only for configured web origins.")
        try:
            token, expires_in = service.complete(origin, body.code)
        except PairingError as error:
            return _error(error.code, error.status, error.message, error.retry_after)
        return {"token": token, "expires_in": expires_in}

    return router


def add_agent_boundary(app: FastAPI, loopback_origins: frozenset[str], web_origins: frozenset[str], service: PairingService) -> None:
    """Add the pairing routes and the boundary middleware to `app` (used by app.main_advisor and by the tests).

    The last middleware added runs first: the guard (Host and Origin), then CORS for web origins only, then the token check.
    """
    app.include_router(create_agent_router(service, web_origins))
    app.add_middleware(AgentAuthMiddleware, service=service, web_origins=web_origins)
    if web_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=sorted(web_origins),
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            # X-Sean-Client is required by the repository routes for every change (repository_routes.CLIENT_HEADER).
            allow_headers=["Content-Type", "Authorization", "X-Sean-Client"],
            allow_credentials=False,
            max_age=600,
        )
    app.add_middleware(LocalOnlyMiddleware, loopback_origins=loopback_origins, web_origins=web_origins)
