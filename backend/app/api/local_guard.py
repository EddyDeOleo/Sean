"""Local-only request guard (security review M2, Spec 4 section 13, amended 2026-11-23 for Sean Local + Web).

Binding to 127.0.0.1 keeps other machines out, but it does not stop a web page in the user's browser from sending requests
to the API. Two checks close that:
- Host: only localhost names are accepted, which defeats DNS rebinding (the page reads responses as "its own" origin).
- Origin: a request that carries an Origin header must come from an exact, configured origin. Browsers always send Origin
  on a cross-origin POST, so a page on any other site, or on another localhost port, is refused. Requests without Origin
  (curl, the test client) are accepted, because they are not browser cross-site requests.

Two exact lists are accepted (scheme, host and port; no wildcards):
- Loopback development origins, from SEAN_LOOPBACK_ORIGINS. Unset means the Vite dev server (port 5173); "none" means no
  loopback browser origin at all (agent mode).
- Web origins such as the Netlify site, from SEAN_ALLOWED_ORIGINS. They also need a paired token (app/api/agent_auth.py).

This is added in `app.main_advisor`. The Phase 3 application factory is not changed.
"""

from __future__ import annotations

import os
import re
from collections.abc import Mapping

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

ALLOWED_HOSTS = frozenset({"127.0.0.1", "localhost", "[::1]"})
LOOPBACK_ORIGINS_VARIABLE = "SEAN_LOOPBACK_ORIGINS"
WEB_ORIGINS_VARIABLE = "SEAN_ALLOWED_ORIGINS"
# The Vite dev server (frontend/vite.config.ts: host 127.0.0.1, port 5173, strictPort).
DEFAULT_LOOPBACK_ORIGINS = frozenset({"http://127.0.0.1:5173", "http://localhost:5173"})
_NO_LOOPBACK = "none"
_LOOPBACK_ORIGIN = re.compile(r"https?://(127\.0\.0\.1|localhost|\[::1\]):\d{1,5}")
# A web origin is an HTTPS host, or a plain-HTTP loopback origin (for local tests of the web path).
_WEB_ORIGIN = re.compile(r"https://[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d{1,5})?|http://(?:127\.0\.0\.1|localhost|\[::1\]):\d{1,5}")
_REFUSAL = {"code": "REQUEST_REFUSED", "message": "The request was refused.", "retryable": False}


class OriginConfigError(ValueError):
    """A configured origin list holds an entry that is not an exact origin."""


def _parse(value: str, pattern: re.Pattern[str], variable: str) -> frozenset[str]:
    entries = [entry.strip().lower() for entry in value.split(",") if entry.strip()]
    for entry in entries:
        if not pattern.fullmatch(entry):
            raise OriginConfigError(f"{variable} must list exact origins (scheme, host and port, no path): {entry!r}")
    return frozenset(entries)


def loopback_origins_from_environment(environ: Mapping[str, str] = os.environ) -> frozenset[str]:
    """The loopback browser origins. Unset or empty means the dev default; "none" means none."""
    raw = environ.get(LOOPBACK_ORIGINS_VARIABLE, "").strip()
    if not raw:
        return DEFAULT_LOOPBACK_ORIGINS
    if raw.lower() == _NO_LOOPBACK:
        return frozenset()
    return _parse(raw, _LOOPBACK_ORIGIN, LOOPBACK_ORIGINS_VARIABLE)


def web_origins_from_environment(environ: Mapping[str, str] = os.environ) -> frozenset[str]:
    """The configured web origins (for example the Netlify site). Unset means none."""
    return _parse(environ.get(WEB_ORIGINS_VARIABLE, ""), _WEB_ORIGIN, WEB_ORIGINS_VARIABLE)


def _host_name(host_header: str) -> str:
    host = host_header.strip().lower()
    if host.startswith("["):
        return host.split("]")[0] + "]"
    return host.split(":")[0]


class LocalOnlyMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        loopback_origins: frozenset[str] = DEFAULT_LOOPBACK_ORIGINS,
        web_origins: frozenset[str] = frozenset(),
    ) -> None:
        self.app = app
        self.origins = loopback_origins | web_origins

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.decode("latin-1").lower(): value.decode("latin-1") for key, value in scope["headers"]}
        host_ok = _host_name(headers.get("host", "")) in ALLOWED_HOSTS
        origin = headers.get("origin")
        origin_ok = origin is None or origin.strip().lower() in self.origins
        if not (host_ok and origin_ok):
            await JSONResponse(_REFUSAL, status_code=403)(scope, receive, send)
            return
        await self.app(scope, receive, send)
