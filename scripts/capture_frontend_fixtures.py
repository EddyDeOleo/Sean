"""Capture real backend responses as frontend test fixtures.

Development tooling. It starts the real backend on a free loopback port with disposable repositories, posts a fixed set of
requests, and writes each status and body to frontend/tests/fixtures/. Nothing is hand-written: if the backend contract
changes, rerunning this script changes the fixtures and the frontend tests show the drift.

Usage (from the repository root):
    backend\\.venv\\Scripts\\python.exe scripts\\capture_frontend_fixtures.py
"""

from __future__ import annotations

import json
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from run_fixture_backend import prepare  # noqa: E402

FIXTURE_DIRECTORY = REPOSITORY_ROOT / "frontend" / "tests" / "fixtures"

QUESTION = "Why does charge validate its amount?"

CASES: dict[str, dict] = {
    "complete": {
        "repository_id": "sample",
        "target": {"path": "src/billing.py", "symbol": "charge"},
        "question": QUESTION,
    },
    "complete-no-symbol": {
        "repository_id": "sample",
        "target": {"path": "src/billing.py"},
        "question": QUESTION,
    },
    "partial-shallow": {
        "repository_id": "shallow",
        "target": {"path": "src/billing.py"},
        "question": QUESTION,
    },
    "insufficient": {
        "repository_id": "sample",
        "target": {"path": "src/never_existed.py"},
        "question": QUESTION,
    },
    "failed-broken": {
        "repository_id": "broken",
        "target": {"path": "src/billing.py"},
        "question": QUESTION,
    },
    "ambiguous": {
        "repository_id": "ambiguous",
        "target": {"path": "src/multi.py", "symbol": "run"},
        "question": QUESTION,
    },
    "not-registered": {
        "repository_id": "missing",
        "target": {"path": "src/billing.py"},
        "question": QUESTION,
    },
    "traversal": {
        "repository_id": "sample",
        "target": {"path": "../outside.py"},
        "question": QUESTION,
    },
    "unknown-field": {
        "repository_id": "sample",
        "target": {"path": "src/billing.py"},
        "question": QUESTION,
        "retrieval_status": "COMPLETE",
    },
}


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def post(port: int, document: dict) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{port}/investigations",
        data=json.dumps(document).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


def wait_until_ready(port: int) -> None:
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return
        except OSError:
            time.sleep(0.2)
    raise RuntimeError("the backend did not start")


def main() -> int:
    port = free_port()
    FIXTURE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="sean-fixture-capture-") as temporary:
        environment = prepare(Path(temporary))
        process = subprocess.Popen(
            [sys.executable, "-P", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(REPOSITORY_ROOT / "backend"),
            env=environment,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        try:
            wait_until_ready(port)
            for name, document in CASES.items():
                status, body = post(port, document)
                payload = {"name": name, "request": document, "status": status, "body": body}
                (FIXTURE_DIRECTORY / f"{name}.json").write_text(
                    json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
                )
                label = body.get("retrieval_status") or body.get("code")
                classification = body.get("epistemic_classification")
                print(f"{name:22} HTTP {status} {label} {classification or ''} evidence={len(body.get('evidence', []))}")
        finally:
            process.terminate()
            process.wait(timeout=30)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
