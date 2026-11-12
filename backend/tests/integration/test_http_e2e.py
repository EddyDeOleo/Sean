"""Local HTTP end-to-end tests for POST /investigations (I6; Architecture §12; design C.11).

The real application runs under Uvicorn on 127.0.0.1, in a child process, with a temporary registry selected through
LOCALAPPDATA. The user's registry, repositories, and network are not used. Requests go to the loopback port only.

Windows only: the graceful stop sends CTRL_BREAK_EVENT. Uvicorn re-raises the captured signal after shutdown, so the
exit code is 3 on Windows (source: uvicorn server.py capture_signals; observed with a probe that re-raises SIGBREAK).
"""

from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

from app.core.git_runner import resolve_git_executable

BACKEND_DIR = Path(__file__).resolve().parents[2]
# A fake value that does not match the GitHub token format, so secret scanners do not flag it.
TOKEN = "fake-e2e-probe-value-not-a-credential"
REPOSITORY_ID = "example"
SHUTDOWN_EXIT_CODE = 3  # Windows: re-raised CTRL_BREAK (SIGBREAK) with default disposition.

pytestmark = pytest.mark.skipif(sys.platform != "win32", reason="Windows host verification (Architecture §16)")


def _git_environment() -> dict[str, str]:
    """Git settings that ignore the developer's global and system configuration."""
    return {
        **os.environ,
        "GIT_AUTHOR_NAME": "E2E",
        "GIT_AUTHOR_EMAIL": "e2e@example.invalid",
        "GIT_COMMITTER_NAME": "E2E",
        "GIT_COMMITTER_EMAIL": "e2e@example.invalid",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
    }


def _git(repo: Path, *args: str) -> None:
    # The program is resolved from absolute PATH entries only, as the production runner does.
    subprocess.run(
        [resolve_git_executable(), "-C", str(repo), *args],
        check=True,
        capture_output=True,
        env=_git_environment(),
    )


def _disposable_repository(root: Path) -> Path:
    repo = root / "repo"
    (repo / "src").mkdir(parents=True)
    _git(repo, "init", "-q", ".")
    _git(repo, "config", "commit.gpgsign", "false")
    (repo / "src" / "a.py").write_text("def target():\n    return 1\n", encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "add target")
    (repo / "src" / "a.py").write_text("def target():\n    return 2\n", encoding="utf-8")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "change target")
    return repo


def _shallow_clone(source: Path, destination: Path) -> Path:
    """A depth-1 clone of a disposable repository. Local file transport only, no network."""
    # No template directory and no hooks path, so nothing from the developer's configuration is copied or run.
    subprocess.run(
        [
            resolve_git_executable(),
            "-c", f"core.hooksPath={os.devnull}",
            "clone", "--template=", "--depth", "1", "--quiet", source.as_uri(), str(destination),
        ],
        check=True,
        capture_output=True,
        timeout=60,
        env=_git_environment(),
    )
    return destination


def _ambiguous_repository(root: Path) -> Path:
    """A disposable repository whose file defines two methods with the same name, so the target is ambiguous."""
    repo = root
    (repo / "src").mkdir(parents=True)
    _git(repo, "init", "-q", ".")
    _git(repo, "config", "commit.gpgsign", "false")
    (repo / "src" / "multi.py").write_text(
        "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n",
        encoding="utf-8",
    )
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "two run methods")
    return repo


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


class _Server:
    def __init__(self, process: subprocess.Popen, port: int, repo: Path, log: Path) -> None:
        self.process = process
        self.port = port
        self.repo = repo
        self.log = log

    def post(self, raw: bytes) -> tuple[int, dict | str]:
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/investigations",
            data=raw,
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read().decode("utf-8"))

    def stop(self) -> tuple[int, str]:
        """Send CTRL_BREAK_EVENT, wait for exit, and return (exit code, complete log text)."""
        self.process.send_signal(_ctrl_break())
        self.process.wait(timeout=60)
        return self.process.returncode, self.log.read_text(encoding="utf-8", errors="replace")

    def kill_if_running(self) -> None:
        """Test cleanup. A server left running by a failed test would keep a loopback port and the fake token."""
        if self.process.poll() is None:
            self.process.kill()
            self.process.wait(timeout=30)


def _ctrl_break() -> int:
    import signal

    return signal.CTRL_BREAK_EVENT


def _start(tmp_path_factory) -> _Server:
    root = tmp_path_factory.mktemp("e2e")
    repo = _disposable_repository(root)
    config = root / "localappdata" / "Sean" / "config"
    config.mkdir(parents=True)
    shallow = _shallow_clone(repo, root / "shallow")
    ambiguous = _ambiguous_repository(root / "ambiguous")
    doomed = _disposable_repository(root / "doomed")
    registry = {
        "schema_version": 1,
        "repositories": [
            {"repository_id": REPOSITORY_ID, "root": str(repo)},
            {"repository_id": "shallow", "root": str(shallow)},
            {"repository_id": "ambiguous", "root": str(ambiguous)},
            {"repository_id": "doomed", "root": str(doomed)},
        ],
    }
    (config / "repositories.json").write_text(json.dumps(registry), encoding="utf-8")

    # Minimal inherited environment: only what Windows needs to start Python. Application settings are set explicitly, so
    # no other variable from the developer's session reaches the child.
    environment = {key: os.environ[key] for key in ("PATH", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE") if key in os.environ}
    environment["LOCALAPPDATA"] = str(root / "localappdata")
    environment["SEAN_GITHUB_TOKEN"] = TOKEN
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    environment["PYTHONPATH"] = str(BACKEND_DIR)
    port = _free_port()
    log = root / "uvicorn.log"
    with log.open("wb") as handle:
        process = subprocess.Popen(
            [sys.executable, "-P", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(BACKEND_DIR),
            env=environment,
            stdout=handle,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP,
        )
    server = _Server(process, port, repo, log)
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                return server
        except OSError:
            if process.poll() is not None:
                raise RuntimeError("uvicorn exited during startup")
            time.sleep(0.25)
    process.kill()
    raise RuntimeError("uvicorn did not accept connections")


@pytest.fixture(scope="module")
def server(tmp_path_factory):
    started = _start(tmp_path_factory)
    try:
        yield started
    finally:
        started.kill_if_running()


def _body(**overrides) -> bytes:
    document = {
        "repository_id": REPOSITORY_ID,
        "target": {"path": "src/a.py", "symbol": "target"},
        "question": "What changed?",
    }
    document.update(overrides)
    return json.dumps(document).encode("utf-8")


def test_valid_request_returns_documented_result_with_separate_fields(server) -> None:
    status, body = server.post(_body())
    assert status == 200
    assert body["retrieval_status"] == "COMPLETE"
    assert body["epistemic_classification"] == "DOCUMENTED"
    assert body["explanation"] and "They do not state why." in body["explanation"]
    assert body["error"] is None
    assert all(item["evidence_id"] for item in body["evidence"])


def test_unregistered_repository_returns_404(server) -> None:
    status, body = server.post(_body(repository_id="missing"))
    assert status == 404
    assert body["code"] == "REPOSITORY_NOT_FOUND"


def test_traversal_is_rejected_without_echoing_the_value(server) -> None:
    status, body = server.post(_body(target={"path": "../secret-e2e-value.py"}))
    assert status == 400
    assert body["code"] == "INVALID_INPUT"
    assert "secret-e2e-value" not in json.dumps(body)


def test_unknown_field_names_the_field_only(server) -> None:
    status, body = server.post(_body(retrieval_status="COMPLETE"))
    assert status == 400
    assert body == {"code": "INVALID_INPUT", "message": "The request is invalid.", "retryable": False, "field": "retrieval_status"}


def test_malformed_json_is_400_without_a_field_name(server) -> None:
    status, body = server.post(b"{not json")
    assert status == 400
    assert body["code"] == "INVALID_INPUT"
    assert "field" not in body


def test_no_response_contains_the_repository_path_or_the_token(server) -> None:
    responses = [
        server.post(_body())[1],
        server.post(_body(repository_id="missing"))[1],
        server.post(b"{not json")[1],
    ]
    text = json.dumps(responses)
    assert str(server.repo) not in text
    assert TOKEN not in text


def test_graceful_shutdown_completes_and_leaks_nothing(tmp_path_factory) -> None:
    started = _start(tmp_path_factory)
    try:
        status, _ = started.post(_body())
        assert status == 200
        exit_code, output = started.stop()
    finally:
        started.kill_if_running()
    assert "Shutting down" in output
    assert "Application shutdown complete" in output
    assert "Finished server process" in output
    assert exit_code == SHUTDOWN_EXIT_CODE
    assert TOKEN not in output
    assert str(started.repo) not in output


# Additional cases over the same live process: insufficient evidence, partial retrieval, ambiguous target, and an
# unavailable repository. The repositories are disposable and created under the test's temporary directory.


def test_insufficient_evidence_abstains_over_http(server) -> None:
    status, body = server.post(_body(target={"path": "src/never.py"}))
    assert status == 200
    assert body["retrieval_status"] == "INSUFFICIENT"
    assert body["epistemic_classification"] == "INSUFFICIENT_EVIDENCE"
    assert body["conclusion"] is None
    assert body["evidence"] == []


def test_partial_retrieval_names_the_shallow_clone_limit_over_http(server) -> None:
    status, body = server.post(json.dumps({
        "repository_id": "shallow",
        "target": {"path": "src/a.py"},
        "question": "What changed?",
    }).encode("utf-8"))
    assert status == 200
    assert body["retrieval_status"] == "PARTIAL"
    assert body["epistemic_classification"] == "PARTIAL_EVIDENCE"
    assert "SHALLOW_CLONE" in {limit["code"] for limit in body["limitations"]}


def test_ambiguous_target_returns_409_with_candidates_over_http(server) -> None:
    status, body = server.post(json.dumps({
        "repository_id": "ambiguous",
        "target": {"path": "src/multi.py", "symbol": "run"},
        "question": "What changed?",
    }).encode("utf-8"))
    assert status == 409
    assert body["code"] == "TARGET_AMBIGUOUS"
    assert body["candidates"] == ["A.run", "B.run"]


def test_unavailable_repository_returns_503_when_its_root_disappears(server) -> None:
    """The registry is read at startup, but each call re-checks the root. Removing the directory makes it unavailable."""
    import shutil
    import stat

    doomed = server.repo.parent / "doomed"
    base = doomed.resolve()

    def _clear_read_only(function, path, _exc_info):
        # Git marks object files read-only on Windows. Only paths inside the fixture directory are changed, and reparse
        # points (symbolic links and junctions) are never followed.
        target = Path(path).resolve()
        if target != base and base not in target.parents:
            raise PermissionError("cleanup refused a path outside the disposable fixture")
        if os.path.islink(path) or getattr(os.path, "isjunction", lambda _p: False)(path):
            raise PermissionError("cleanup refused a reparse point inside the fixture")
        os.chmod(path, stat.S_IWRITE)
        function(path)

    shutil.rmtree(doomed, onexc=_clear_read_only)
    status, body = server.post(json.dumps({
        "repository_id": "doomed",
        "target": {"path": "src/a.py"},
        "question": "What changed?",
    }).encode("utf-8"))
    assert status == 503
    assert body["code"] == "REPOSITORY_UNAVAILABLE"
    assert str(doomed) not in json.dumps(body)
