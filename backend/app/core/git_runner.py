"""Guarded Git subprocess runner (Tasks 3.1 to 3.4; Requirement 15; design "Git retrieval design").

Every Git call in Sean goes through run_git. The rules it enforces:
- The argument list is an argument array. No shell is used.
- The working directory is the resolved repository root, and the environment is rebuilt from an allowlist.
- Options that neutralize repository-controlled programs (fsmonitor, hooks, external diff) are passed on every call.
- Only read subcommands on an allowlist are reachable.
- User-supplied values (revisions and paths) are checked before Git starts. Values beginning with "-" are rejected.
- Stdout and stderr are bounded. A timeout or an overflow stops the Git process and every descendant.
- A call whose output pipes are still held by a descendant is never reported as a complete result.
- Errors carry an error code only. They never contain stderr text, environment values, or the command line.

On Windows, each Git child is created suspended, assigned to a Job Object with kill-on-close, and only then resumed. No
descendant can start before the job contains the child. The job stops descendants even after their parent has exited.
If the job cannot be created, or the child cannot be assigned or resumed, the child is stopped (if started) and the call
fails with GIT_FAILED. Git is never run outside a job on Windows. taskkill is not used.
Restricted-token and nested-job limits are documented in the Phase 3 closure report.

The default timeout and output limits are the proposed values R1 to R3 (OD-5). They are not owner-approved and are
configured here as defaults.
"""

from __future__ import annotations

import os
import subprocess
import threading
import time
from collections.abc import Sequence
from pathlib import Path

from app.core.limits import (
    GIT_CHILD_WAIT_SECONDS,
    GIT_READER_JOIN_SECONDS,
    GIT_STDERR_LIMIT_BYTES,
    GIT_STDOUT_LIMIT_BYTES,
    GIT_TIMEOUT_SECONDS,
)

GIT_TIMEOUT = "GIT_TIMEOUT"
OUTPUT_LIMIT_EXCEEDED = "OUTPUT_LIMIT_EXCEEDED"
GIT_FAILED = "GIT_FAILED"
GIT_INPUT_REJECTED = "GIT_INPUT_REJECTED"

ALLOWED_SUBCOMMANDS = frozenset({"rev-parse", "log", "blame", "cat-file", "ls-tree", "show", "diff-tree"})

# Subcommands that produce diffs or blame text. They can run an external diff or textconv filter named in repository
# configuration, so those are disabled for each call. Verified against Git 2.50.1 (accepted by log, show, and blame).
_DIFF_SUBCOMMANDS = frozenset({"log", "show", "blame", "diff-tree"})
_DIFF_GUARD_OPTIONS = ("--no-ext-diff", "--no-textconv")

# Subcommands that take a "--" separator before paths. rev-parse and cat-file do not, because "--" would change their
# output.
_SEPARATED_SUBCOMMANDS = frozenset({"log", "blame", "ls-tree", "show"})

# Options passed on every call. -c values override repository and user configuration, so a repository cannot turn
# them back on through .git/config.
GUARD_OPTIONS: tuple[str, ...] = (
    "--no-pager",
    "--no-replace-objects",
    # Pathspecs are literal, so "[id].tsx" names that file and is not a wildcard.
    "--literal-pathspecs",
    "-c", "core.fsmonitor=false",
    "-c", f"core.hooksPath={os.devnull}",
    "-c", "credential.helper=",
    "-c", "core.askPass=",
    # git log would otherwise run the gpg program named by the repository config for every commit.
    "-c", "log.showSignature=false",
    # No transport may run. Every call here reads local objects, so nothing legitimate needs one (owner-authorized, 2026-11-13).
    "-c", "protocol.allow=never",
)

_SAFE_ENVIRONMENT_KEYS = ("PATH", "SYSTEMROOT")

_READER_JOIN_SECONDS = GIT_READER_JOIN_SECONDS


class GitError(Exception):
    """A caller-facing Git failure. The message is the error code only."""


def resolve_git_executable() -> str:
    """Return the absolute path of the Git program found on PATH, skipping relative PATH entries.

    Relative entries, including the empty entry that means the current directory, are skipped so that a program placed in
    the working directory cannot be run as git (Windows CreateProcess searches the current directory first).
    """
    names = ("git.exe",) if os.name == "nt" else ("git",)
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        if not entry or not os.path.isabs(entry):
            continue
        for name in names:
            candidate = os.path.join(entry, name)
            if os.path.isfile(candidate):
                return candidate
    raise GitError(GIT_FAILED)


def controlled_environment() -> dict[str, str]:
    """Return the only environment variables a Git child process receives.

    Parent-process variables are not inherited, except the fixed allowlist needed to locate the Git executable on Windows.
    """
    environment = {key: os.environ[key] for key in _SAFE_ENVIRONMENT_KEYS if key in os.environ}
    environment.update(
        {
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_OPTIONAL_LOCKS": "0",
            # A partial clone's repository configuration names a remote and an upload-pack command. Without this, a read such
            # as cat-file fetches a missing object by running that command (owner-authorized amendment, 2026-11-13).
            "GIT_NO_LAZY_FETCH": "1",
            "LC_ALL": "C",
        }
    )
    return environment


def _validate_user_values(values: Sequence[str]) -> None:
    for value in values:
        if not isinstance(value, str) or not value or value.startswith("-") or "\x00" in value:
            raise GitError(GIT_INPUT_REJECTED)


def _read_bounded(
    stream,
    limit: int,
    sink: list[bytes],
    overflow: threading.Event,
    done: threading.Event,
    failed: threading.Event,
) -> None:
    """Read a pipe to end of file.

    done is set when the reader stops, whether at end of file or on an error. failed is set on an error. A reader that
    failed or never reached end of file means the collected bytes may be partial.
    """
    total = 0
    try:
        while True:
            chunk = stream.read(65536)
            if not chunk:
                return
            total += len(chunk)
            if total > limit:
                overflow.set()
                # Keep draining so the child cannot block on a full pipe. Discarded data is never stored.
                continue
            sink.append(chunk)
    except Exception:  # The error is recorded as a failure and is never reported with its text.
        failed.set()
    finally:
        done.set()


if os.name == "nt":
    import ctypes
    from ctypes import wintypes

    _kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000
    _JOB_OBJECT_EXTENDED_LIMIT_INFORMATION = 9
    _PROCESS_SET_QUOTA = 0x0100
    _PROCESS_TERMINATE = 0x0001
    _THREAD_SUSPEND_RESUME = 0x0002
    _TH32CS_SNAPTHREAD = 0x00000004
    _CREATE_SUSPENDED = 0x00000004
    _INVALID_HANDLE = ctypes.c_void_p(-1).value
    _RESUME_FAILED = 0xFFFFFFFF

    class _IoCounters(ctypes.Structure):
        _fields_ = [
            ("ReadOperationCount", ctypes.c_ulonglong),
            ("WriteOperationCount", ctypes.c_ulonglong),
            ("OtherOperationCount", ctypes.c_ulonglong),
            ("ReadTransferCount", ctypes.c_ulonglong),
            ("WriteTransferCount", ctypes.c_ulonglong),
            ("OtherTransferCount", ctypes.c_ulonglong),
        ]

    class _BasicLimitInformation(ctypes.Structure):
        _fields_ = [
            ("PerProcessUserTimeLimit", ctypes.c_longlong),
            ("PerJobUserTimeLimit", ctypes.c_longlong),
            ("LimitFlags", wintypes.DWORD),
            ("MinimumWorkingSetSize", ctypes.c_size_t),
            ("MaximumWorkingSetSize", ctypes.c_size_t),
            ("ActiveProcessLimit", wintypes.DWORD),
            ("Affinity", ctypes.c_size_t),
            ("PriorityClass", wintypes.DWORD),
            ("SchedulingClass", wintypes.DWORD),
        ]

    class _ExtendedLimitInformation(ctypes.Structure):
        _fields_ = [
            ("BasicLimitInformation", _BasicLimitInformation),
            ("IoInfo", _IoCounters),
            ("ProcessMemoryLimit", ctypes.c_size_t),
            ("JobMemoryLimit", ctypes.c_size_t),
            ("PeakProcessMemoryUsed", ctypes.c_size_t),
            ("PeakJobMemoryUsed", ctypes.c_size_t),
        ]

    _kernel32.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    _kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    _kernel32.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    _kernel32.SetInformationJobObject.restype = wintypes.BOOL
    _kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    _kernel32.OpenProcess.restype = wintypes.HANDLE
    _kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    _kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    _kernel32.TerminateJobObject.argtypes = [wintypes.HANDLE, wintypes.UINT]
    _kernel32.TerminateJobObject.restype = wintypes.BOOL
    _kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    _kernel32.CloseHandle.restype = wintypes.BOOL

    class _ThreadEntry(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ThreadID", wintypes.DWORD),
            ("th32OwnerProcessID", wintypes.DWORD),
            ("tpBasePri", wintypes.LONG),
            ("tpDeltaPri", wintypes.LONG),
            ("dwFlags", wintypes.DWORD),
        ]

    _kernel32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    _kernel32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    _kernel32.Thread32First.argtypes = [wintypes.HANDLE, ctypes.POINTER(_ThreadEntry)]
    _kernel32.Thread32First.restype = wintypes.BOOL
    _kernel32.Thread32Next.argtypes = [wintypes.HANDLE, ctypes.POINTER(_ThreadEntry)]
    _kernel32.Thread32Next.restype = wintypes.BOOL
    _kernel32.OpenThread.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    _kernel32.OpenThread.restype = wintypes.HANDLE
    _kernel32.ResumeThread.argtypes = [wintypes.HANDLE]
    _kernel32.ResumeThread.restype = wintypes.DWORD

    class _JobObject:
        """A Windows Job Object that owns one Git child and its descendants.

        KILL_ON_JOB_CLOSE stops every remaining member when the last handle closes, so no process survives run_git.
        """

        def __init__(self, handle: int) -> None:
            self._handle = handle

        @classmethod
        def create(cls) -> _JobObject | None:
            handle = _kernel32.CreateJobObjectW(None, None)
            if not handle:
                return None
            info = _ExtendedLimitInformation()
            info.BasicLimitInformation.LimitFlags = _JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            if not _kernel32.SetInformationJobObject(
                handle, _JOB_OBJECT_EXTENDED_LIMIT_INFORMATION, ctypes.byref(info), ctypes.sizeof(info)
            ):
                _kernel32.CloseHandle(handle)
                return None
            return cls(handle)

        def assign(self, pid: int) -> bool:
            process = _kernel32.OpenProcess(_PROCESS_SET_QUOTA | _PROCESS_TERMINATE, False, pid)
            if not process:
                return False
            try:
                return bool(_kernel32.AssignProcessToJobObject(self._handle, process))
            finally:
                _kernel32.CloseHandle(process)

        def terminate(self) -> None:
            _kernel32.TerminateJobObject(self._handle, 1)

        def close(self) -> None:
            _kernel32.CloseHandle(self._handle)

    def _resume_threads(pid: int) -> None:
        """Resume every thread of a child that was created suspended. Raise GIT_FAILED if any step fails.

        A child created suspended has one thread. Each owned thread is resumed once. Thread enumeration uses the Toolhelp
        snapshot API, not NtResumeProcess, because it is a documented interface.
        """
        snapshot = _kernel32.CreateToolhelp32Snapshot(_TH32CS_SNAPTHREAD, 0)
        if snapshot in (None, 0, _INVALID_HANDLE):
            raise GitError(GIT_FAILED)
        try:
            entry = _ThreadEntry()
            entry.dwSize = ctypes.sizeof(_ThreadEntry)
            resumed = 0
            more = _kernel32.Thread32First(snapshot, ctypes.byref(entry))
            while more:
                if entry.th32OwnerProcessID == pid:
                    thread = _kernel32.OpenThread(_THREAD_SUSPEND_RESUME, False, entry.th32ThreadID)
                    if not thread:
                        raise GitError(GIT_FAILED)
                    try:
                        if _kernel32.ResumeThread(thread) == _RESUME_FAILED:
                            raise GitError(GIT_FAILED)
                    finally:
                        _kernel32.CloseHandle(thread)
                    resumed += 1
                more = _kernel32.Thread32Next(snapshot, ctypes.byref(entry))
            if resumed == 0:
                raise GitError(GIT_FAILED)
        finally:
            _kernel32.CloseHandle(snapshot)


def _stop_tree(process: subprocess.Popen, job: _JobObject | None) -> None:
    """Stop the Git child and its descendants. On Windows the job terminates every member. The direct child is killed in
    every case, which also covers a child that is still suspended."""
    if job is not None:
        job.terminate()
    if process.poll() is None:
        process.kill()


def run_git(
    repo_root: Path,
    subcommand: str,
    *,
    options: Sequence[str] = (),
    revisions: Sequence[str] = (),
    paths: Sequence[str] = (),
    executable: Sequence[str] | None = None,
    timeout_seconds: float = GIT_TIMEOUT_SECONDS,
    stdout_limit: int = GIT_STDOUT_LIMIT_BYTES,
    stderr_limit: int = GIT_STDERR_LIMIT_BYTES,
) -> bytes:
    """Run one read-only Git subcommand inside repo_root and return its stdout.

    options are fixed by the caller's code and are not user input. revisions and paths are user input and are validated.
    executable exists so that tests can substitute a fake program. Production code uses the default.
    """
    if subcommand not in ALLOWED_SUBCOMMANDS:
        raise GitError(GIT_INPUT_REJECTED)
    _validate_user_values(revisions)
    _validate_user_values(paths)

    diff_guard = _DIFF_GUARD_OPTIONS if subcommand in _DIFF_SUBCOMMANDS else ()
    program = [resolve_git_executable()] if executable is None else list(executable)
    argv = [*program, *GUARD_OPTIONS, subcommand, *diff_guard, *options, *revisions]
    if subcommand in _SEPARATED_SUBCOMMANDS:
        argv.append("--")
    argv.extend(paths)

    if os.name != "nt":
        # Containment is implemented only with Windows Job Objects. Elsewhere, Git would run uncontained, so refuse.
        raise GitError(GIT_FAILED)
    job = _JobObject.create()
    if job is None:
        # Git must never run outside a Job Object.
        raise GitError(GIT_FAILED)
    # The child starts suspended, so it cannot create a descendant before it is assigned to the job.
    creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0) | _CREATE_SUSPENDED

    process: subprocess.Popen | None = None
    try:
        try:
            process = subprocess.Popen(
                argv,
                cwd=str(repo_root),
                env=controlled_environment(),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                shell=False,
                creationflags=creation_flags,
            )
        except OSError:
            raise GitError(GIT_FAILED) from None
        if job is not None:
            # Assignment must succeed before the child runs. The finally block stops the suspended child otherwise.
            if not job.assign(process.pid):
                raise GitError(GIT_FAILED)
            _resume_threads(process.pid)

        stdout_chunks: list[bytes] = []
        stdout_overflow = threading.Event()
        stdout_done, stdout_failed = threading.Event(), threading.Event()
        # stderr is drained so the child cannot block, and it is never stored or reported.
        stderr_overflow = threading.Event()
        stderr_done, stderr_failed = threading.Event(), threading.Event()
        readers = [
            threading.Thread(
                target=_read_bounded,
                args=(process.stdout, stdout_limit, stdout_chunks, stdout_overflow, stdout_done, stdout_failed),
            ),
            threading.Thread(
                target=_read_bounded,
                args=(process.stderr, stderr_limit, [], stderr_overflow, stderr_done, stderr_failed),
            ),
        ]
        for reader in readers:
            reader.daemon = True
            reader.start()

        deadline = time.monotonic() + timeout_seconds
        timed_out = False
        overflowed = False
        while process.poll() is None:
            overflowed = stdout_overflow.is_set() or stderr_overflow.is_set()
            if overflowed or time.monotonic() > deadline:
                timed_out = not overflowed
                _stop_tree(process, job)
                break
            time.sleep(0.02)
        try:
            process.wait(timeout=GIT_CHILD_WAIT_SECONDS)
        except subprocess.TimeoutExpired:
            raise GitError(GIT_TIMEOUT) from None
        for reader in readers:
            reader.join(timeout=_READER_JOIN_SECONDS)

        # A reader that has not reached end of file means a descendant still holds an output pipe, so the collected bytes
        # may be partial. The descendants are stopped to release the pipes. The result is never reported as complete.
        pipes_finished = stdout_done.is_set() and stderr_done.is_set()
        failed = stdout_failed.is_set() or stderr_failed.is_set()
        incomplete = not pipes_finished or failed
        if not pipes_finished and job is not None:
            job.terminate()
            for reader in readers:
                reader.join(timeout=_READER_JOIN_SECONDS)

        if timed_out:
            raise GitError(GIT_TIMEOUT)
        if overflowed or stdout_overflow.is_set() or stderr_overflow.is_set():
            raise GitError(OUTPUT_LIMIT_EXCEEDED)
        if failed:
            raise GitError(GIT_FAILED)
        if incomplete:
            raise GitError(GIT_TIMEOUT)
        if process.returncode != 0:
            raise GitError(GIT_FAILED)
        return b"".join(stdout_chunks)
    finally:
        # The Git child must not outlive the call, even when setup or collection raised an exception.
        try:
            if process is not None and process.poll() is None:
                _stop_tree(process, job)
        finally:
            # KILL_ON_JOB_CLOSE stops anything still running in the job, so no descendant outlives the call. The job
            # handle is closed even when stopping the child raised.
            if job is not None:
                job.close()
            # Pipe handles are closed here, once. A reader that still runs has lost its pipe, so it ends with a failure
            # flag that is not used on this path.
            if process is not None:
                for stream in (process.stdout, process.stderr):
                    if stream is not None and not stream.closed:
                        stream.close()
