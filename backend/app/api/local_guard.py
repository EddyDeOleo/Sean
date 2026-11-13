"""Local-only request guard (security review M2, Spec 4 section 13).

Sean's API has no authentication because it is meant to be reached only by the local frontend. Binding to 127.0.0.1 keeps
other machines out, but it does not stop a web page in the user's browser from sending requests to it. Two checks close that:

- Host: only localhost names are accepted, which defeats DNS rebinding (the page reads responses as "its own" origin).
- Origin: a request that carries an Origin header must come from a localhost origin. Browsers always send Origin on a
  cross-origin POST, so a page on another site is refused. Requests without Origin (curl, the test client, the Vite proxy)
  are accepted, because they are not browser cross-site requests.

This is added in `app.main_advisor`. The Phase 3 application factory is not changed.
"""

from __future__ import annotations

import re

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

ALLOWED_HOSTS = frozenset({"127.0.0.1", "localhost", "[::1]"})
_ORIGIN = re.compile(r"^https?://(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?$")
_REFUSAL = {"code": "REQUEST_REFUSED", "message": "The request was refused.", "retryable": False}


def _host_name(host_header: str) -> str:
    host = host_header.strip().lower()
    if host.startswith("["):
        return host.split("]")[0] + "]"
    return host.split(":")[0]


class LocalOnlyMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = {key.decode("latin-1").lower(): value.decode("latin-1") for key, value in scope["headers"]}
        host_ok = _host_name(headers.get("host", "")) in ALLOWED_HOSTS
        origin = headers.get("origin")
        origin_ok = origin is None or bool(_ORIGIN.match(origin))
        if not (host_ok and origin_ok):
            await JSONResponse(_REFUSAL, status_code=403)(scope, receive, send)
            return
        await self.app(scope, receive, send)
