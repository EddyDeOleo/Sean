"""MCP server registration, in-process invocation, and STDIO protocol tests (Task 17.2 to 17.4).

The STDIO test starts the real entry point as a child process. It does not open a network port. Process cleanup is
checked: the child exits after its stdin is closed.
"""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.modules.mcp.server import create_server
from app.modules.repository.registry import LoadedRegistry, RegistryEntry

REPOSITORY_ID = "sample"
APPROVED_TOOLS = {"search_history", "blame_range", "get_pr", "get_issue"}
BACKEND_DIR = Path(__file__).resolve().parents[2]


def _registry(root) -> LoadedRegistry:
    return LoadedRegistry(entries={REPOSITORY_ID: RegistryEntry(repository_id=REPOSITORY_ID, root=str(root))}, problems=())


@pytest.fixture
def repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    return fixture


def test_exactly_the_four_approved_tools_are_registered(repo) -> None:
    server = create_server(_registry(repo.path))
    names = {tool.name for tool in asyncio.run(server.list_tools())}
    assert names == APPROVED_TOOLS


def test_registered_tool_invocation_reaches_the_shared_logic(repo) -> None:
    server = create_server(_registry(repo.path))
    result = asyncio.run(server.call_tool("search_history", {"repository_id": REPOSITORY_ID, "path": "src/a.py"}))
    assert "COMPLETE" in json.dumps(result, default=str)


def test_unknown_tool_name_is_rejected_by_the_sdk(repo) -> None:
    server = create_server(_registry(repo.path))
    with pytest.raises(Exception):
        asyncio.run(server.call_tool("write_file", {}))


def _send(process: subprocess.Popen, message: dict) -> None:
    process.stdin.write((json.dumps(message) + "\n").encode("utf-8"))
    process.stdin.flush()


def _read(process: subprocess.Popen) -> dict:
    line = process.stdout.readline()
    assert line, "server closed stdout before responding"
    return json.loads(line)


def test_stdio_handshake_lists_the_four_tools_and_exits_when_stdin_closes() -> None:
    """Task 17.3 and 17.4: the real entry point speaks JSON-RPC over STDIO, lists the tools, and exits cleanly."""
    environment = {key: value for key, value in os.environ.items() if key != "SEAN_GITHUB_TOKEN"}
    environment["PYTHONPATH"] = str(BACKEND_DIR)
    # Same launch shape as .kiro/settings/mcp.json: -P (no current directory on sys.path) and PYTHONPATH to the backend.
    process = subprocess.Popen(
        [sys.executable, "-P", "-m", "app.modules.mcp"],
        cwd=str(BACKEND_DIR),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=environment,
    )
    try:
        _send(
            process,
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "sean-test", "version": "0"},
                },
            },
        )
        initialized = _read(process)
        assert initialized["id"] == 1
        assert "result" in initialized
        _send(process, {"jsonrpc": "2.0", "method": "notifications/initialized"})
        _send(process, {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        listed = _read(process)
        assert {tool["name"] for tool in listed["result"]["tools"]} == APPROVED_TOOLS
    finally:
        process.stdin.close()
        try:
            process.wait(timeout=20)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise
    assert process.returncode == 0, process.stderr.read().decode("utf-8", errors="replace")[-400:]
