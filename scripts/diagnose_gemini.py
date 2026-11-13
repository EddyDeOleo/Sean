"""Make one Gemini request with the configured key and report exactly what happened (Spec 4 section 8, E-D13 AI-15).

Development tooling run by the owner. It sends one fixed synthetic sentence and nothing from any repository. The key is read
from SEAN_GEMINI_API_KEY or from the line of that name in .kiro/.env, and it is never printed. Provider error text is printed
with the key removed.

The outcome is one of these categories, so a failure is never confused with another:
    TIMEOUT             no bytes arrived within the timeout, or the total deadline passed
    CONNECTION_FAILED   DNS, TCP, or TLS failed
    PROTOCOL_ERROR      the HTTP exchange was malformed
    HTTP_ERROR          the provider answered with an error status (the status and text are shown)
    RESPONSE_TOO_LARGE  the reply exceeded the size limit
    INVALID_REPLY       the body was not JSON, or was not the expected shape

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\diagnose_gemini.py            (timeout 60 s)
    backend\\.venv\\Scripts\\python.exe scripts\\diagnose_gemini.py --timeout 120
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPOSITORY_ROOT / "backend"))

from app.modules.intent import gemini  # noqa: E402


def load_key() -> str | None:
    value = os.environ.get("SEAN_GEMINI_API_KEY", "").strip()
    if value:
        return value
    env_file = REPOSITORY_ROOT / ".kiro" / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("SEAN_GEMINI_API_KEY"):
                _, _, rest = line.partition("=")
                return rest.strip().strip('"').strip("'") or None
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--timeout", type=float, default=60.0, help="seconds per socket operation and in total")
    arguments = parser.parse_args()

    key = load_key()
    if not key:
        print("no key found in the environment or .kiro/.env")
        return 1
    print(f"model: {gemini.MODEL}")
    print(f"endpoint: {gemini.ENDPOINT}")
    print(f"timeout: {arguments.timeout:g} s per operation and in total")

    transport = gemini.make_transport(key, timeout=arguments.timeout, deadline=arguments.timeout, diagnostic=True)
    payload = gemini.build_payload("sample — What would make this project easier to maintain over time?")
    started = time.monotonic()
    try:
        reply = transport(payload)
    except gemini.ProviderError as error:
        elapsed = time.monotonic() - started
        print(f"RESULT {error.category} after {elapsed:.2f} s", end="")
        print(f" (HTTP {error.http_status})" if error.http_status else "")
        if error.detail:
            print("provider said:", error.detail)
        return 2
    except Exception as error:  # diagnostic: report the class only
        print(f"RESULT UNEXPECTED {type(error).__name__} after {time.monotonic() - started:.2f} s")
        return 3
    elapsed = time.monotonic() - started
    value = gemini.parse_response(reply)
    if value is None:
        print(f"RESULT INVALID_REPLY after {elapsed:.2f} s: the reply has top-level keys {sorted(reply)} and no usable text")
        return 4
    print(f"RESULT HTTP 200 and parsed after {elapsed:.2f} s")
    print("parsed reply:", json.dumps(value))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
