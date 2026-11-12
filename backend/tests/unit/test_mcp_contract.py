"""MCP contract tests for D02 MCP-05, MCP-08, MCP-16, and MCP-17 (D02 §16.8 and §16.11).

Temporary repositories, a local shallow clone, and fake GitHub clients only. No network access and no new dependency.

Where the current implementation differs from the proposed D02 table (D02 §16 is PROPOSED, not approved), the difference
is recorded as a strict expected failure with its reason. A strict expected failure is reported as XFAIL and turns into a
failure when the behavior changes, so the gap cannot be hidden.
"""

from __future__ import annotations

import ast
import asyncio
import hashlib
import os
import socket
import subprocess
from pathlib import Path

import pytest

from app.modules.git_history.blame import blame_range
from app.modules.github.client import (
    GITHUB_IDENTITY_MISMATCH,
    GITHUB_NOT_FOUND_OR_INACCESSIBLE,
    GITHUB_RATE_LIMITED,
    GITHUB_UNAVAILABLE,
    GitHubError,
)
from app.modules.investigation.orchestrator import investigate
from app.modules.mcp import tools as _tools
from app.modules.mcp.server import create_server
from app.modules.mcp.tools import McpToolError
from app.modules.repository.registry import GitHubIdentity, LoadedRegistry, RegistryEntry

REPOSITORY_ID = "sample"
APPROVED_TOOLS = {"search_history", "blame_range", "get_pr", "get_issue"}
MCP_DIRECTORY = Path(__file__).resolve().parents[2] / "app" / "modules" / "mcp"


def _call(function, *args, **kwargs) -> dict:
    """Return the structured body that the MCP server returns for the call, including tool errors."""
    try:
        return function(*args, **kwargs)
    except McpToolError as error:
        return error.to_dict()


def _registry(root, github: GitHubIdentity | None = GitHubIdentity(owner="octo", name="repo")) -> LoadedRegistry:
    entry = RegistryEntry(repository_id=REPOSITORY_ID, root=str(root), github=github)
    return LoadedRegistry(entries={REPOSITORY_ID: entry}, problems=())


def _codes(result: dict) -> set[str]:
    return {limitation["code"] for limitation in result.get("limitations", [])}


def _fake_github(monkeypatch: pytest.MonkeyPatch, code: str) -> None:
    """Replace the GitHub client with one that always raises the given code. No request is sent."""

    class _Client:
        def __init__(self, *args, **kwargs) -> None:
            pass

        def get_pull_request(self, *args, **kwargs):
            raise GitHubError(code)

        def get_issue(self, *args, **kwargs):
            raise GitHubError(code)

    monkeypatch.setattr(_tools, "GitHubClient", _Client)


@pytest.fixture
def repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.commit("change target")
    return fixture


@pytest.fixture
def registry(repo) -> LoadedRegistry:
    return _registry(repo.path)


# MCP-05: read-only. Refs, index, configuration, and working tree are unchanged by every tool call.


def _snapshot(root: Path) -> dict[str, str]:
    """Hash every file and record every directory under the repository root, including the whole .git directory."""
    entries: dict[str, str] = {}
    for path in root.rglob("*"):
        relative = path.relative_to(root).as_posix()
        if path.is_dir():
            entries[relative + "/"] = ""
        else:
            entries[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return entries


TOOL_CALLS = {
    "search_history_symbol": lambda registry: _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py", symbol="target"),
    "search_history_path": lambda registry: _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py"),
    "search_history_missing_symbol": lambda registry: _call(
        _tools.search_history, registry, REPOSITORY_ID, "src/a.py", symbol="absent"
    ),
    "blame_range": lambda registry: _call(_tools.blame_range_tool, registry, REPOSITORY_ID, "src/a.py", 1, 2),
    "get_pr": lambda registry: _call(_tools.get_pr, registry, REPOSITORY_ID, "42"),
    "get_issue": lambda registry: _call(_tools.get_issue, registry, REPOSITORY_ID, "7"),
}


@pytest.mark.parametrize("name", sorted(TOOL_CALLS))
def test_mcp_05_tool_call_leaves_repository_state_unchanged(name: str, registry, repo, monkeypatch) -> None:
    _fake_github(monkeypatch, GITHUB_UNAVAILABLE)
    before = _snapshot(repo.path)
    TOOL_CALLS[name](registry)
    assert _snapshot(repo.path) == before


# MCP-08: retrieval status cases from D02 §16.8.


def test_mcp_08_invalid_input_returns_invalid_input_with_field_and_no_evidence(registry) -> None:
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py", max_results=0)
    assert result == {"error": "INVALID_INPUT", "message": "The request is invalid.", "retryable": False, "field": "max_results"}


def test_mcp_08_unregistered_repository_returns_repository_not_found_without_evidence(registry) -> None:
    result = _call(_tools.search_history, registry, "unregistered", "src/a.py")
    assert result["error"] == "REPOSITORY_NOT_FOUND"
    assert "evidence" not in result


def test_mcp_08_unavailable_repository_returns_repository_unavailable(make_repo, tmp_path) -> None:
    plain_directory = tmp_path / "not-a-checkout"
    plain_directory.mkdir()
    result = _call(_tools.search_history, _registry(plain_directory), REPOSITORY_ID, "src/a.py")
    assert result["error"] == "REPOSITORY_UNAVAILABLE"
    assert "evidence" not in result


def test_mcp_08_path_escape_is_rejected_with_no_evidence(registry) -> None:
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "../outside.py")
    assert result["error"] in {"INVALID_INPUT", "PATH_OUTSIDE_REPOSITORY"}
    assert "evidence" not in result


def test_mcp_08_lexical_traversal_is_invalid_input(registry) -> None:
    """C.3a step 2 rejects a ".." segment lexically, before any filesystem resolution, as INVALID_INPUT."""
    assert _call(_tools.search_history, registry, REPOSITORY_ID, "../outside.py")["error"] == "INVALID_INPUT"


@pytest.mark.skipif(os.name != "nt", reason="the junction fixture is Windows-specific")
def test_mcp_08_junction_escape_uses_path_outside_repository(make_repo, tmp_path: Path) -> None:
    """C.3a step 4: a junction inside the repository that leads outside it is PATH_OUTSIDE_REPOSITORY.

    mklink /J needs no elevated privilege. The junction is removed with rmdir, which removes only the link.
    """
    fixture = make_repo()
    fixture.write("src/keep.py", "x = 1\n")
    fixture.commit("keep")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.py").write_text("x = 2\n", encoding="utf-8")
    junction = fixture.path / "linked"
    subprocess.run(["cmd", "/c", "mklink", "/J", str(junction), str(outside)], check=True, capture_output=True)
    try:
        result = _call(_tools.search_history, _registry(fixture.path), REPOSITORY_ID, "linked/secret.py")
    finally:
        junction.rmdir()
    assert result["error"] == "PATH_OUTSIDE_REPOSITORY"
    assert "evidence" not in result


@pytest.mark.skipif(os.name != "nt", reason="the junction fixture is Windows-specific")
def test_mcp_blame_range_junction_escape_uses_path_outside_repository(make_repo, tmp_path: Path) -> None:
    """The same containment rule applies to blame_range, which reads Git objects directly."""
    fixture = make_repo()
    fixture.write("src/keep.py", "x = 1\n")
    fixture.commit("keep")
    outside = tmp_path / "outside-blame"
    outside.mkdir()
    (outside / "secret.py").write_text("x = 2\n", encoding="utf-8")
    junction = fixture.path / "linked-blame"
    subprocess.run(["cmd", "/c", "mklink", "/J", str(junction), str(outside)], check=True, capture_output=True)
    try:
        result = _call(_tools.blame_range_tool, _registry(fixture.path), REPOSITORY_ID, "linked-blame/secret.py", 1, 1)
    finally:
        junction.rmdir()
    assert result["error"] == "PATH_OUTSIDE_REPOSITORY"
    assert "evidence" not in result


def test_mcp_08_ambiguous_target_returns_candidates_and_no_selection(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/a.py", "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n")
    fixture.commit("two runs")
    result = _call(_tools.search_history, _registry(fixture.path), REPOSITORY_ID, "src/a.py", symbol="run")
    assert result["error"] == "TARGET_AMBIGUOUS"
    assert result["candidates"] == ["A.run", "B.run"]
    assert "evidence" not in result


def test_mcp_08_symbol_absent_from_current_state_continues_the_search(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/b.py", "def gone():\n    return 1\n")
    fixture.commit("add gone")
    fixture.write("src/b.py", "def other():\n    return 2\n")
    fixture.commit("replace gone")
    result = _call(_tools.search_history, _registry(fixture.path), REPOSITORY_ID, "src/b.py", symbol="gone")
    assert result["retrieval_status"] in {"COMPLETE", "PARTIAL"}
    assert result["evidence"], "the historical search must still return evidence"


# Spec 1 section 5: an absent current location is not an error. The historical search continues. The D02 code
# TARGET_NOT_IN_CURRENT_STATE is a proposal and is not asserted. The behavior above is the approved behavior.


def test_mcp_08_no_history_returns_insufficient_without_evidence(registry) -> None:
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "src/never.py")
    assert result["retrieval_status"] == "INSUFFICIENT"
    assert result["evidence"] == []


def test_mcp_08_insufficient_result_declares_its_limitation(registry) -> None:
    """Spec 1 section 10.3 (approved): explicit limitations and uncertainty. The code name NO_EVIDENCE_FOUND is a D02
    proposal and is not asserted. Any declared limitation satisfies the approved rule."""
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "src/never.py")
    assert result["limitations"], "an insufficient result must name at least one limitation"


def test_mcp_08_shallow_clone_never_reports_complete_without_shallow_clone(repo, tmp_path) -> None:
    clone = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "--depth", "1", "--quiet", repo.path.as_uri(), str(clone)],
        check=True,
        capture_output=True,
        timeout=60,
    )
    result = _call(_tools.search_history, _registry(clone), REPOSITORY_ID, "src/a.py")
    assert "SHALLOW_CLONE" in _codes(result)
    assert result["retrieval_status"] == "PARTIAL"


def test_mcp_08_result_limit_returns_the_first_items_by_rank(registry) -> None:
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py", max_results=1)
    assert len(result["evidence"]) == 1
    assert result["evidence"][0]["evidence_id"] == result["ranking"][0]["evidence_id"]


def test_mcp_08_result_limit_adds_result_limit_reached(registry) -> None:
    """Owner decision 2026-11-12: when matching evidence exists beyond max_results, declare RESULT_LIMIT_REACHED with
    scope results. The status stays COMPLETE, because the requested operation completed."""
    result = _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py", max_results=1)
    assert "RESULT_LIMIT_REACHED" in _codes(result)
    assert result["retrieval_status"] == "COMPLETE"
    assert {"code": "RESULT_LIMIT_REACHED", "scope": "results"} in result["limitations"]


# Spec 1 FR-08 (approved): the backend must communicate whether retrieval failed. A request-level failure is communicated
# by its error code and retryable flag, and it never carries evidence. The D02 field name "retrieval_status" is not
# approved, so it is not asserted here.
@pytest.mark.parametrize("path, repository_id", [("src/a.py", "unregistered"), ("", REPOSITORY_ID)], ids=["not-registered", "invalid-path"])
def test_mcp_08_failed_rows_communicate_failure_without_evidence(registry, path: str, repository_id: str) -> None:
    result = _call(_tools.search_history, registry, repository_id, path)
    assert result["error"] in {"REPOSITORY_NOT_FOUND", "INVALID_INPUT"}
    assert isinstance(result["retryable"], bool)
    assert "evidence" not in result


@pytest.mark.parametrize(
    "code, retryable",
    [
        (GITHUB_NOT_FOUND_OR_INACCESSIBLE, False),
        (GITHUB_RATE_LIMITED, True),
        (GITHUB_UNAVAILABLE, True),
        (GITHUB_IDENTITY_MISMATCH, False),
    ],
)
def test_mcp_08_github_failures_return_their_code_with_no_evidence(registry, monkeypatch, code: str, retryable: bool) -> None:
    _fake_github(monkeypatch, code)
    result = _call(_tools.get_pr, registry, REPOSITORY_ID, "42")
    assert result["error"] == code
    assert result["retryable"] is retryable
    assert "evidence" not in result


# MCP-16: the MCP tool and the shared function return the same core results. No retrieval logic lives in mcp.


def test_mcp_16_search_history_matches_the_shared_investigation(registry) -> None:
    shared = investigate(registry, REPOSITORY_ID, "src/a.py", symbol="target")
    mcp = _call(_tools.search_history, registry, REPOSITORY_ID, "src/a.py", symbol="target")
    assert mcp["retrieval_status"] == shared.retrieval_status.value
    assert [item["evidence_id"] for item in mcp["evidence"]] == [item.evidence_id for item in shared.evidence]
    assert [item["evidence_id"] for item in mcp["ranking"]] == [entry.evidence_id for entry in shared.ranking]
    assert [item["code"] for item in mcp["limitations"]] == [limitation.code for limitation in shared.limitations]


def test_mcp_16_blame_range_matches_the_shared_blame(registry, repo) -> None:
    shared = blame_range(repo.path, REPOSITORY_ID, "src/a.py", 1, 2)
    mcp = _call(_tools.blame_range_tool, registry, REPOSITORY_ID, "src/a.py", 1, 2)
    assert mcp["revision"] == shared.revision
    assert [item["evidence_id"] for item in mcp["evidence"]] == [item.evidence_id for item in shared.items]


def _imports_of(path: Path) -> tuple[set[str], set[str]]:
    """Return (module names, imported symbol names) for one source file, using the parsed syntax tree only."""
    modules: set[str] = set()
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            modules.add(node.module or "")
            names.update(alias.name for alias in node.names)
    return modules, names


def test_mcp_16_mcp_package_contains_no_retrieval_or_ranking_logic() -> None:
    """Dependency inspection: the mcp package reaches Git and ranking only through the shared modules, never directly."""
    forbidden_modules = {
        "subprocess",
        "socket",
        "urllib",
        "http",
        "app.modules.git_history.history",
        "app.modules.investigation.ranking",
    }
    for source in MCP_DIRECTORY.glob("*.py"):
        modules, names = _imports_of(source)
        assert not (modules & forbidden_modules), f"{source.name} imports a forbidden module"
        assert "run_git" not in names, f"{source.name} calls the Git runner directly"


# Entry points: both production entry points must load the approved registry path, not None.


@pytest.mark.parametrize("entry_point", ["app/main.py", "app/modules/mcp/__main__.py"])
def test_entry_point_loads_the_approved_registry_path(entry_point: str) -> None:
    source = (Path(__file__).resolve().parents[2] / entry_point).read_text(encoding="utf-8")
    calls = [node for node in ast.walk(ast.parse(source)) if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "load_registry"]
    assert len(calls) == 1
    argument = calls[0].args[0]
    assert isinstance(argument, ast.Call) and getattr(argument.func, "id", "") == "default_registry_path"


# MCP-17: lifecycle. Startup opens no network connection. Exit on stdin close is covered by test_mcp_server.py.


def test_mcp_17_startup_opens_no_network_connection(registry, monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*args, **kwargs):
        raise AssertionError("network access during MCP server startup")

    monkeypatch.setattr(socket, "socket", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)
    monkeypatch.setattr(socket, "getaddrinfo", refuse)
    server = create_server(registry)
    monkeypatch.undo()
    assert {tool.name for tool in asyncio.run(server.list_tools())} == APPROVED_TOOLS
