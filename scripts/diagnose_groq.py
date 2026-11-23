"""Make one Groq request with the configured key and report exactly what happened (Spec 4 section 8, E-D13 AI-15).

Development tooling run by the owner. It sends one fixed synthetic sentence and nothing from any repository. The key is read
from SEAN_GROQ_API_KEY or from the line of that name in .kiro/.env, and it is never printed. Provider error text is printed
with the key removed. A provider request identifier (cf-ray or x-request-id) is printed only when it passes the adapter's
safe-token check.

The outcome is one label, so a failure is never confused with another:
    CONFIGURATION_MISSING          no SEAN_GROQ_API_KEY in the environment or .kiro/.env
    SUCCESS                        HTTP 200, a Groq chat reply, and a model output with a valid mode
    INVALID_REPLY                  HTTP 200 but not a usable Groq chat reply (not a success)
    EDGE_BLOCKED_BROWSER_SIGNATURE Cloudflare error 1010 before Groq checked the key (not an authentication result)
    AUTHENTICATION_FAILED          HTTP 401
    PERMISSION_DENIED              HTTP 403 without a quota or billing message
    PERMISSION_OR_QUOTA_DENIED     HTTP 403 with a quota, billing, credit, or limit message
    MODEL_UNAVAILABLE              HTTP 404, or 400 that names the model
    RATE_LIMITED                   HTTP 429 without a quota or billing message
    QUOTA_OR_BILLING_LIMIT         HTTP 429 with a quota, billing, or spend message
    PROVIDER_UNAVAILABLE           HTTP 5xx
    TIMEOUT                        no bytes arrived within the timeout, or the total deadline passed
    CONNECTION_FAILED              DNS, TCP, or TLS failed
    PROTOCOL_ERROR                 the HTTP exchange was malformed
    RESPONSE_TOO_LARGE             the reply exceeded the size limit
    HTTP_ERROR_<status>            any other HTTP status

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\diagnose_groq.py            (timeout 60 s)
    backend\\.venv\\Scripts\\python.exe scripts\\diagnose_groq.py --timeout 120
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "backend"))

from app.modules.intent import groq  # noqa: E402

VALID_MODES = ("INVESTIGATE", "ADVISE")

# What each HTTP-level label proves about authentication and model access. A label never implies more than this.
EVALUATED = {
    "EDGE_BLOCKED_BROWSER_SIGNATURE": "not evaluated: the edge refused the request before the Groq API",
    "AUTHENTICATION_FAILED": "authentication evaluated: the API rejected the key",
    "PERMISSION_DENIED": "access evaluated: the API denied the request (authentication not confirmed)",
    "PERMISSION_OR_QUOTA_DENIED": "access evaluated: denied with a quota, billing, or limit message",
    "MODEL_UNAVAILABLE": "model access evaluated: the model is not available to this request",
    "RATE_LIMITED": "not evaluated: rate limited before a model reply",
    "QUOTA_OR_BILLING_LIMIT": "not evaluated: a quota or billing limit applied before a model reply",
    "PROVIDER_UNAVAILABLE": "not evaluated: the provider failed",
}


def load_key() -> str | None:
    value = os.environ.get("SEAN_GROQ_API_KEY", "").strip()
    if value:
        return value
    env_file = REPOSITORY_ROOT / ".kiro" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("SEAN_GROQ_API_KEY"):
                _, _, rest = line.partition("=")
                return rest.strip().strip('"').strip("'") or None
    return None


def classify_http_error(status: int | None, detail: str | None) -> str:
    """Name an HTTP error from the status and Groq's error object (console.groq.com/docs/errors, read 2026-11-14).

    The error object is {"error": {"message", "type"}}. Some providers add "code" (for example "model_not_found"). The text
    is matched only to separate two causes that share a status code. Nothing else is inferred.
    """
    text = (detail or "").lower()
    try:
        error = json.loads(detail or "{}").get("error", {})
        code = str(error.get("code", "")).lower()
        text = f"{code} {error.get('type', '')} {error.get('message', '')}".lower()
    except (ValueError, AttributeError):
        pass  # not JSON: keep the raw text for matching
    # Cloudflare error 1010: the edge refused the request by its browser signature before Groq checked the key. It says nothing
    # about the key (Cloudflare Error 1010 documentation, read 2026-11-14).
    if "error code: 1010" in text or "browser_signature" in text or "browser's signature" in text:
        return "EDGE_BLOCKED_BROWSER_SIGNATURE"
    if status == 401:
        return "AUTHENTICATION_FAILED"
    if status == 403:
        return "PERMISSION_OR_QUOTA_DENIED" if any(word in text for word in ("quota", "billing", "credit", "limit")) else "PERMISSION_DENIED"
    if status == 404 or (status == 400 and "model" in text):
        return "MODEL_UNAVAILABLE"
    if status == 429:
        return "QUOTA_OR_BILLING_LIMIT" if any(word in text for word in ("quota", "billing", "credit", "spend")) else "RATE_LIMITED"
    if status is not None and status >= 500:
        return "PROVIDER_UNAVAILABLE"
    return f"HTTP_ERROR_{status}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=60.0, help="seconds per socket operation and in total")
    arguments = parser.parse_args()

    started_utc = datetime.now(timezone.utc)
    print(f"started (UTC): {started_utc.strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print(f"started (local): {started_utc.astimezone().isoformat(timespec='seconds')}")

    key = load_key()
    if not key:
        print("RESULT CONFIGURATION_MISSING: no SEAN_GROQ_API_KEY in the environment or in .kiro/.env")
        return 1
    print(f"model: {groq.MODEL}")
    print(f"endpoint: {groq.ENDPOINT}")
    print(f"user-agent: {groq.USER_AGENT}")
    print(f"timeout: {arguments.timeout:g} s per operation and in total")

    request_ids: list[str] = []

    def capture_success_headers(headers) -> None:
        request_id = groq._request_id(headers)  # the same safe-token check the adapter uses for errors
        if request_id:
            request_ids.append(request_id)

    transport = groq.make_transport(
        key,
        timeout=arguments.timeout,
        deadline=arguments.timeout,
        diagnostic=True,
        on_response_headers=capture_success_headers,
    )
    payload = groq.build_payload("sample — What would make this project easier to maintain over time?")
    started = time.monotonic()
    try:
        reply = transport(payload)
    except groq.ProviderError as error:
        elapsed = time.monotonic() - started
        if error.category == groq.CATEGORY_HTTP:
            outcome = classify_http_error(error.http_status, error.detail)
            print(f"RESULT {outcome} (HTTP {error.http_status}) after {elapsed:.2f} s")
        else:
            outcome = error.category
            print(f"RESULT {outcome} after {elapsed:.2f} s (stage {error.stage or 'n/a'})")
        print(f"authentication and model access: {EVALUATED.get(outcome, 'not evaluated')}")
        if error.request_id:
            print(f"provider request id (for support): {error.request_id}")
        if error.detail:
            print("provider said:", error.detail)
        return 2
    except Exception as error:  # diagnostic: report the class only
        print(f"RESULT UNEXPECTED {type(error).__name__} after {time.monotonic() - started:.2f} s")
        return 3
    elapsed = time.monotonic() - started
    if request_ids:
        print(f"provider request id (for support): {request_ids[0]}")

    # HTTP 200 is not inference. A success needs a Groq chat reply with a JSON model output whose mode Sean accepts.
    choices = reply.get("choices") if isinstance(reply, dict) else None
    if not isinstance(choices, list) or not choices:
        print(f"RESULT INVALID_REPLY after {elapsed:.2f} s: HTTP 200 without a Groq chat reply (top-level keys {sorted(reply)})")
        print("authentication and model access: the reply has no chat choices, so model output cannot be confirmed")
        return 4
    value = groq.parse_response(reply)
    if value is None:
        print(f"RESULT INVALID_REPLY after {elapsed:.2f} s: the chat reply has no JSON object in its message content")
        print("authentication and model access: a reply came back, but its model output is not usable")
        return 4
    if value.get("mode") not in VALID_MODES:
        print(f"RESULT INVALID_REPLY after {elapsed:.2f} s: the model output has no valid mode")
        print("authentication and model access: a reply came back, but its model output is not usable")
        return 4
    print(f"RESULT SUCCESS: HTTP 200, a Groq chat reply, and a valid model output, after {elapsed:.2f} s")
    print("authentication and model access: evaluated, and a model reply was returned")
    print("parsed reply:", json.dumps(value))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
