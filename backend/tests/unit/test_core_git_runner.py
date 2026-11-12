"""Unit and temporary-repository tests for the guarded Git runner (Tasks 3.1 to 3.4).

Fake programs are small Python scripts in pytest's temporary directory. They stand in for Git only where a test needs a
deterministic timeout, output size, argument list, or environment. Behavior of the real Git option set is tested against
repositories created in temporary directories. No test writes to the Sean repository. Commands that create the test
fixture use argument arrays.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import pytest

from app.core.git_runner import (
    GIT_FAILED,
    GIT_INPUT_REJECTED,
    GIT_TIMEOUT,
    OUTPUT_LIMIT_EXCEEDED,
    GitError,
    controlled_environment,
    run_git,
)

SECRET = "sentinel-secret-value-0123456789"

FAKE_GIT = r'''
import json, os, sys, time
mode = next((a for a in sys.argv[1:] if a in {"log", "show", "blame", "cat-file", "ls-tree"}), "")
if mode == "log":
    sys.stdout.write(json.dumps({"argv": sys.argv[1:], "env_keys": sorted(os.environ)}))
elif mode == "show":
    time.sleep(30)
elif mode == "blame":
    sys.stdout.write("x" * (2 * 1024 * 1024))
elif mode == "cat-file":
    sys.stderr.write("STDERR-MARKER-DO-NOT-REPORT")
    sys.exit(3)
else:
    sys.stdout.write("ok")
'''


@pytest.fixture
def fake_git(tmp_path: Path) -> tuple[str, str]:
    script = tmp_path / "fake_git.py"
    script.write_text(FAKE_GIT, encoding="utf-8")
    return (sys.executable, str(script))


def test_user_value_starting_with_dash_is_rejected_before_any_process(tmp_path: Path) -> None:
    """Task 3.3. The executable does not exist, so a started process would fail with GIT_FAILED instead."""
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "log", revisions=["--output=/tmp/x"], executable=("no-such-program-sean",))
    assert str(raised.value) == GIT_INPUT_REJECTED


@pytest.mark.parametrize("path", ["-x", "--upload-pack=evil", ""], ids=["dash", "long-option", "empty"])
def test_user_paths_starting_with_dash_are_rejected(tmp_path: Path, path: str) -> None:
    """Task 3.3 for paths: values that begin with "-" never reach Git."""
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "blame", paths=[path], executable=("no-such-program-sean",))
    assert str(raised.value) == GIT_INPUT_REJECTED


@pytest.mark.parametrize("subcommand", ["fetch", "commit", "gc", "config", "push", "reset", "checkout"])
def test_non_allowlisted_subcommands_are_rejected(tmp_path: Path, subcommand: str) -> None:
    """Requirement 15: only read subcommands on the allowlist are reachable."""
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, subcommand, executable=("no-such-program-sean",))
    assert str(raised.value) == GIT_INPUT_REJECTED


def test_argument_array_contains_guards_and_separator(tmp_path: Path, fake_git: tuple[str, str]) -> None:
    """Task 3.2 (argument composition): guards come before the subcommand, and "--" precedes paths for log."""
    output = run_git(tmp_path, "log", options=["-n", "1"], revisions=["HEAD"], paths=["src/a.py"], executable=fake_git)
    argv = json.loads(output)["argv"]
    assert "--no-pager" in argv and "--no-replace-objects" in argv
    assert "core.fsmonitor=false" in argv
    assert f"core.hooksPath={os.devnull}" in argv
    assert "--no-ext-diff" in argv and "--no-textconv" in argv
    assert argv.index("--") > argv.index("log")
    assert argv[argv.index("--") + 1 :] == ["src/a.py"]


def test_child_receives_only_allowlisted_environment(tmp_path: Path, fake_git: tuple[str, str], monkeypatch) -> None:
    """Task 3.4: inherited secrets are not passed to the child process."""
    monkeypatch.setenv("SEAN_GITHUB_TOKEN", SECRET)
    output = run_git(tmp_path, "log", executable=fake_git)
    env_keys = set(json.loads(output)["env_keys"])
    assert "SEAN_GITHUB_TOKEN" not in env_keys
    assert SECRET.encode() not in output
    assert {"GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_OPTIONAL_LOCKS"} <= env_keys


def test_controlled_environment_contains_no_parent_secret(monkeypatch) -> None:
    """Task 3.4 (unit): the environment builder copies only the fixed allowlist."""
    monkeypatch.setenv("SEAN_GITHUB_TOKEN", SECRET)
    environment = controlled_environment()
    assert SECRET not in environment.values()
    assert "SEAN_GITHUB_TOKEN" not in environment


def test_errors_do_not_contain_stderr_text(tmp_path: Path, fake_git: tuple[str, str]) -> None:
    """Task 3.4: a failing child writes text to stderr. The raised error contains only the code."""
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "cat-file", executable=fake_git)
    assert str(raised.value) == GIT_FAILED
    assert "STDERR-MARKER" not in repr(raised.value)


def test_timeout_kills_the_child(tmp_path: Path, fake_git: tuple[str, str]) -> None:
    """Requirement 15.2: a child that runs past the timeout is terminated and reported with GIT_TIMEOUT."""
    started = time.monotonic()
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=fake_git, timeout_seconds=1.0)
    assert str(raised.value) == GIT_TIMEOUT
    assert time.monotonic() - started < 15


def test_output_over_limit_is_rejected(tmp_path: Path, fake_git: tuple[str, str]) -> None:
    """Requirement 15.2 and 20.2: output beyond the limit is not returned, and the child is stopped."""
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "blame", executable=fake_git, stdout_limit=1024)
    assert str(raised.value) == OUTPUT_LIMIT_EXCEEDED


def test_output_within_limit_is_returned(tmp_path: Path, fake_git: tuple[str, str]) -> None:
    """Small output is returned unchanged."""
    assert run_git(tmp_path, "ls-tree", executable=fake_git) == b"ok"


def _git(repo: Path, *arguments: str) -> None:
    """Create fixture state in a temporary repository. Argument array, no shell."""
    subprocess.run(["git", "-C", str(repo), *arguments], check=True, capture_output=True)


@pytest.fixture
def temp_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", ".")
    _git(repo, "config", "user.email", "fixture@example.invalid")
    _git(repo, "config", "user.name", "Fixture")
    _git(repo, "config", "commit.gpgsign", "false")
    (repo / "f.txt").write_text("one\n", encoding="utf-8")
    _git(repo, "add", "f.txt")
    _git(repo, "commit", "-q", "-m", "first")
    (repo / "f.txt").write_text("two\n", encoding="utf-8")
    _git(repo, "commit", "-q", "-am", "second")
    return repo


TEXTCONV_TRAP_PROGRAM = "sean-no-such-textconv-program"


def _install_textconv_trap(repo: Path) -> None:
    """Attach a repository-local textconv driver to f.txt. The program does not exist, so an enabled textconv fails.

    .git/info/attributes is local to the fixture repository and is not tracked. The driver is set in the local config.
    """
    info = repo / ".git" / "info"
    info.mkdir(exist_ok=True)
    (info / "attributes").write_text("f.txt diff=trap\n", encoding="utf-8")
    _git(repo, "config", "diff.trap.textconv", TEXTCONV_TRAP_PROGRAM)


def test_control_textconv_trap_breaks_raw_git(temp_repo: Path) -> None:
    """Control for the next test. Without the guard, the repository's textconv driver makes git log -p fail.

    Without this control, the guard test below could pass vacuously.
    """
    _install_textconv_trap(temp_repo)
    raw = subprocess.run(["git", "-C", str(temp_repo), "log", "-p", "-n", "1"], capture_output=True, check=False)
    assert raw.returncode != 0


def test_guard_neutralizes_repository_textconv(temp_repo: Path) -> None:
    """Task 3.2 verified against installed Git. The same repository works through the runner."""
    _install_textconv_trap(temp_repo)
    output = run_git(temp_repo, "log", options=["-p", "-n", "1"])
    assert b"second" in output
    assert b"-one" in output and b"+two" in output


def test_guard_does_not_alter_history_output(temp_repo: Path) -> None:
    """Read output matches what Git prints for the same history, without the trap."""
    expected = subprocess.run(
        ["git", "-C", str(temp_repo), "log", "--format=%H %s"], capture_output=True, check=True
    ).stdout
    assert run_git(temp_repo, "log", options=["--format=%H %s"]) == expected




def _give_head_a_signature_header(repo: Path) -> None:
    """Rewrite HEAD with a crafted gpgsig header. Git runs the signature program only for signed commits."""
    raw = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "commit", "HEAD"], capture_output=True, check=True
    ).stdout.decode("utf-8")
    header, _, message = raw.partition("\n\n")
    signature = "gpgsig -----BEGIN PGP SIGNATURE-----\n fake\n -----END PGP SIGNATURE-----"
    crafted = f"{header}\n{signature}\n\n{message}".encode("utf-8")
    created = subprocess.run(
        ["git", "-C", str(repo), "hash-object", "-t", "commit", "-w", "--stdin"],
        input=crafted,
        capture_output=True,
        check=True,
    ).stdout.decode("ascii").strip()
    _git(repo, "update-ref", "HEAD", created)


def test_control_repository_signature_program_breaks_raw_log(temp_repo: Path) -> None:
    """Control for the next test. A signed commit with a missing gpg program breaks a raw git log call.

    Without this control, the guard test below could pass vacuously.
    """
    _give_head_a_signature_header(temp_repo)
    _git(temp_repo, "config", "log.showSignature", "true")
    _git(temp_repo, "config", "gpg.program", "sean-no-such-signature-program")
    raw = subprocess.run(["git", "-C", str(temp_repo), "log", "-n", "1"], capture_output=True, check=False)
    assert raw.returncode != 0 or b"sean-no-such-signature-program" in raw.stderr


def test_guard_neutralizes_repository_signature_program(temp_repo: Path) -> None:
    """H-1 regression: a repository cannot make git log run its configured signature program."""
    _give_head_a_signature_header(temp_repo)
    _git(temp_repo, "config", "log.showSignature", "true")
    _git(temp_repo, "config", "gpg.program", "sean-no-such-signature-program")
    output = run_git(temp_repo, "log", options=["-n", "1", "--format=%s"])
    assert output.strip() == b"second"


def test_pathspecs_are_literal_so_brackets_are_not_wildcards(temp_repo: Path) -> None:
    """M-1 regression: "[id].txt" names that file, and does not match i.txt or d.txt."""
    (temp_repo / "i.txt").write_text("i\n", encoding="utf-8")
    _git(temp_repo, "add", "i.txt")
    _git(temp_repo, "commit", "-q", "-m", "touch i")
    (temp_repo / "[id].txt").write_text("bracket\n", encoding="utf-8")
    _git(temp_repo, "add", "--", "[id].txt")
    _git(temp_repo, "commit", "-q", "-m", "touch bracket")

    control = subprocess.run(
        ["git", "-C", str(temp_repo), "log", "--format=%s", "--", "[id].txt"], capture_output=True, check=True
    ).stdout
    guarded = run_git(temp_repo, "log", options=["--format=%s"], paths=["[id].txt"])

    assert b"touch i" in control
    assert guarded.strip() == b"touch bracket"


def test_git_executable_is_absolute_and_skips_relative_path_entries(tmp_path: Path, monkeypatch) -> None:
    """L-6: a relative PATH entry, including the current directory, is never used to find git."""
    from app.core.git_runner import resolve_git_executable

    program = tmp_path / ("git.exe" if os.name == "nt" else "git")
    program.write_text("", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PATH", os.pathsep.join([".", "", str(tmp_path / "missing-dir")]))
    with pytest.raises(GitError):
        resolve_git_executable()

    monkeypatch.setenv("PATH", os.pathsep.join([".", str(tmp_path)]))
    found = resolve_git_executable()
    assert os.path.isabs(found)
    assert Path(found).parent == tmp_path


# Process-tree termination (I6 completion; Requirement 15.2; D02 MCP-17). Windows only.

GRANDCHILD_FAKE_GIT = r'''
import os, subprocess, sys, time
here = os.path.dirname(os.path.abspath(__file__))
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
with open(os.path.join(here, "grandchild.pid"), "w", encoding="utf-8") as handle:
    handle.write(str(child.pid))
time.sleep(120)
'''


@pytest.mark.skipif(os.name != "nt", reason="Windows process-tree termination")
def test_timeout_also_stops_a_descendant_that_holds_the_output_pipes(tmp_path: Path) -> None:
    """A descendant that inherits stdout keeps the pipe open. The runner must stop it and return promptly."""
    script = tmp_path / "grandchild_git.py"
    script.write_text(GRANDCHILD_FAKE_GIT, encoding="utf-8")
    started = time.monotonic()
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=(sys.executable, str(script)), timeout_seconds=1.0)
    elapsed = time.monotonic() - started
    assert str(raised.value) == GIT_TIMEOUT
    assert elapsed < 20, f"runner blocked for {elapsed:.1f}s, waiting for the descendant"
    pid = int((tmp_path / "grandchild.pid").read_text(encoding="utf-8"))
    try:
        assert not _process_alive(pid)
    finally:
        _stop_if_alive(pid)


def _system32_tool(name: str) -> str:
    """Absolute System32 path for a Windows tool, so no PATH or current-directory lookup happens."""
    return os.path.join(os.environ.get("SYSTEMROOT") or r"C:\Windows", "System32", name)


def _process_alive(pid: int) -> bool:
    listing = subprocess.run(
        [_system32_tool("tasklist.exe"), "/FI", f"PID eq {pid}", "/NH"],
        capture_output=True,
        text=True,
        check=False,
        shell=False,
    ).stdout
    return str(pid) in listing


def _stop_if_alive(pid: int) -> None:
    """Kill the process only after confirming that the recorded process ID is still alive."""
    if _process_alive(pid):
        subprocess.run([_system32_tool("taskkill.exe"), "/PID", str(pid), "/F"], capture_output=True, check=False, shell=False)


DESCENDANT_HOLDS_PIPE_AFTER_PARENT_EXITS = r'''
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
with open(os.path.join(here, "grandchild.pid"), "w", encoding="utf-8") as handle:
    handle.write(str(child.pid))
sys.exit(0)
'''


@pytest.mark.skipif(os.name != "nt", reason="Windows process-tree termination")
def test_output_is_not_success_when_a_descendant_keeps_the_pipe_after_the_child_exits(tmp_path: Path) -> None:
    """Partial output must never be returned as a complete result. The runner reports GIT_TIMEOUT instead."""
    script = tmp_path / "descendant_git.py"
    script.write_text(DESCENDANT_HOLDS_PIPE_AFTER_PARENT_EXITS, encoding="utf-8")
    try:
        with pytest.raises(GitError) as raised:
            run_git(tmp_path, "show", executable=(sys.executable, str(script)), timeout_seconds=5.0)
        assert str(raised.value) == GIT_TIMEOUT
    finally:
        pid_file = tmp_path / "grandchild.pid"
        if pid_file.exists():
            _stop_if_alive(int(pid_file.read_text(encoding="utf-8")))


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object lifecycle")
def test_orphaned_descendant_is_stopped_when_the_direct_child_exits_first(tmp_path: Path) -> None:
    """The parent exits with status 0 while a descendant still holds the pipe. The descendant must not survive the call.

    taskkill /T cannot reach a descendant whose parent has exited. The Job Object with kill-on-close can.
    """
    script = tmp_path / "orphan_git.py"
    script.write_text(DESCENDANT_HOLDS_PIPE_AFTER_PARENT_EXITS, encoding="utf-8")
    try:
        with pytest.raises(GitError) as raised:
            run_git(tmp_path, "show", executable=(sys.executable, str(script)), timeout_seconds=30.0)
        assert str(raised.value) == GIT_TIMEOUT
        pid = int((tmp_path / "grandchild.pid").read_text(encoding="utf-8"))
        assert not _process_alive(pid), "the orphaned descendant is still running after run_git returned"
    finally:
        pid_file = tmp_path / "grandchild.pid"
        if pid_file.exists():
            _stop_if_alive(int(pid_file.read_text(encoding="utf-8")))


def test_a_failed_reader_is_recorded_so_truncated_output_cannot_pass_as_complete() -> None:
    """A pipe read that raises must set the failed flag and the done flag. run_git then reports GIT_FAILED instead of
    returning the bytes read so far as a complete result."""
    import threading

    from app.core.git_runner import _read_bounded

    class _BrokenStream:
        def read(self, size: int) -> bytes:
            raise OSError("pipe broke mid-read")

    sink: list[bytes] = []
    overflow, done, failed = threading.Event(), threading.Event(), threading.Event()
    _read_bounded(_BrokenStream(), 1024, sink, overflow, done, failed)
    assert done.is_set()
    assert failed.is_set()
    assert sink == []


def test_a_clean_reader_reaches_end_of_file_without_failing() -> None:
    import io
    import threading

    from app.core.git_runner import _read_bounded

    sink: list[bytes] = []
    overflow, done, failed = threading.Event(), threading.Event(), threading.Event()
    _read_bounded(io.BytesIO(b"abc"), 1024, sink, overflow, done, failed)
    assert done.is_set()
    assert not failed.is_set()
    assert b"".join(sink) == b"abc"


# Contained start (Windows Job Object before resume). A program that writes a marker file on startup proves whether the
# child ever ran. The marker must be absent in every failure case below.

MARKER_PROGRAM = r'''
import os
here = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(here, "started.marker"), "w", encoding="utf-8") as handle:
    handle.write("started")
'''


def _marker_program(tmp_path: Path) -> tuple[str, str]:
    script = tmp_path / "marker_git.py"
    script.write_text(MARKER_PROGRAM, encoding="utf-8")
    return (sys.executable, str(script))


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_git_never_starts_when_the_job_object_cannot_be_created(tmp_path: Path, monkeypatch) -> None:
    """Without a job, the child would run uncontained. The runner must refuse before creating a process."""
    from app.core import git_runner

    monkeypatch.setattr(git_runner._JobObject, "create", classmethod(lambda cls: None))
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=_marker_program(tmp_path))
    assert str(raised.value) == GIT_FAILED
    assert not (tmp_path / "started.marker").exists()


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_child_is_stopped_and_never_resumed_when_assignment_fails(tmp_path: Path, monkeypatch) -> None:
    """If AssignProcessToJobObject fails, the suspended child is killed and never runs."""
    from app.core import git_runner

    monkeypatch.setattr(git_runner._JobObject, "assign", lambda self, pid: False)
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=_marker_program(tmp_path))
    assert str(raised.value) == GIT_FAILED
    assert not (tmp_path / "started.marker").exists()


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_unexpected_setup_exception_stops_the_child_and_closes_the_job(tmp_path: Path, monkeypatch) -> None:
    """An exception raised during assignment must not leak the job handle or leave the suspended child running."""
    from app.core import git_runner

    closed: list[bool] = []

    def failing_assign(self, pid: int) -> bool:
        raise RuntimeError("simulated setup failure")

    monkeypatch.setattr(git_runner._JobObject, "assign", failing_assign)
    original_close = git_runner._JobObject.close
    monkeypatch.setattr(git_runner._JobObject, "close", lambda self: (closed.append(True), original_close(self)))
    with pytest.raises(RuntimeError):
        run_git(tmp_path, "show", executable=_marker_program(tmp_path))
    assert closed == [True]
    assert not (tmp_path / "started.marker").exists()


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_resume_failure_is_reported_and_the_child_does_not_run(tmp_path: Path, monkeypatch) -> None:
    """If the suspended thread cannot be resumed, the call fails with GIT_FAILED and no program code runs."""
    from app.core import git_runner

    def failing_resume(pid: int) -> None:
        raise GitError(GIT_FAILED)

    monkeypatch.setattr(git_runner, "_resume_threads", failing_resume)
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=_marker_program(tmp_path))
    assert str(raised.value) == GIT_FAILED
    assert not (tmp_path / "started.marker").exists()


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_contained_child_runs_after_resume(tmp_path: Path) -> None:
    """Control: the normal path resumes the suspended child, so the program does run and its output is returned."""
    assert run_git(tmp_path, "ls-tree", executable=_marker_program(tmp_path)) == b""
    assert (tmp_path / "started.marker").exists()


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_resume_fails_when_no_thread_belongs_to_the_process() -> None:
    """Real Toolhelp and thread bindings, no monkeypatch: a process ID with no threads cannot be resumed, so the call fails
    with GIT_FAILED rather than reporting success."""
    from app.core import git_runner

    with pytest.raises(GitError) as raised:
        git_runner._resume_threads(0x7FFFFFF0)
    assert str(raised.value) == GIT_FAILED


OVERFLOW_WITH_DESCENDANT = r'''
import os, subprocess, sys, time
here = os.path.dirname(os.path.abspath(__file__))
child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(120)"])
with open(os.path.join(here, "grandchild.pid"), "w", encoding="utf-8") as handle:
    handle.write(str(child.pid))
sys.stdout.write("x" * (4 * 1024 * 1024))
sys.stdout.flush()
time.sleep(120)
'''


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_output_overflow_terminates_a_descendant_in_the_job(tmp_path: Path) -> None:
    """Overflow stops the whole assigned tree, not only the direct child. The descendant is still running when the
    overflow occurs, and it must be gone when run_git returns."""
    script = tmp_path / "overflow_git.py"
    script.write_text(OVERFLOW_WITH_DESCENDANT, encoding="utf-8")
    started = time.monotonic()
    try:
        with pytest.raises(GitError) as raised:
            run_git(tmp_path, "show", executable=(sys.executable, str(script)), stdout_limit=1024, timeout_seconds=30.0)
        assert str(raised.value) == OUTPUT_LIMIT_EXCEEDED
        assert time.monotonic() - started < 20
        pid = int((tmp_path / "grandchild.pid").read_text(encoding="utf-8"))
        assert not _process_alive(pid), "the descendant survived output overflow"
    finally:
        pid_file = tmp_path / "grandchild.pid"
        if pid_file.exists():
            _stop_if_alive(int(pid_file.read_text(encoding="utf-8")))


STDERR_FLOOD = r'''
import sys, time
sys.stderr.write("e" * (2 * 1024 * 1024))
sys.stderr.flush()
time.sleep(120)
'''


@pytest.mark.skipif(os.name != "nt", reason="Windows Job Object containment")
def test_stderr_overflow_is_an_output_limit_error_not_a_timeout(tmp_path: Path) -> None:
    """Stderr is never stored, but a flood must stop the child and report OUTPUT_LIMIT_EXCEEDED promptly."""
    script = tmp_path / "stderr_flood.py"
    script.write_text(STDERR_FLOOD, encoding="utf-8")
    started = time.monotonic()
    with pytest.raises(GitError) as raised:
        run_git(tmp_path, "show", executable=(sys.executable, str(script)), stderr_limit=1024, timeout_seconds=30.0)
    assert str(raised.value) == OUTPUT_LIMIT_EXCEEDED
    assert time.monotonic() - started < 20
