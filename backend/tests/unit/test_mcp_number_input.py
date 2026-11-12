"""MCP `number` input for get_pr and get_issue (owner decision DEC-15, D02 §19.2; phase-status §33).

Approved contract: JSON type string; ASCII decimal digits only; strictly positive; leading zeros accepted and normalized
to canonical decimal form; no upper numeric bound; JSON integers rejected by the MCP schema.

The tests call the SDK tool layer (list_tools and call_tool). A registered repository with no GitHub identity is used,
so every accepted value stops at GITHUB_IDENTITY_UNRESOLVED before any GitHub request. No network access.
"""

from __future__ import annotations

import asyncio
import json

import pytest
from mcp.server.mcpserver.exceptions import ToolError

from app.modules.github.client import GitHubError, _validated_request
from app.modules.mcp.server import create_server
from app.modules.repository.registry import GitHubIdentity, LoadedRegistry, RegistryEntry

REPOSITORY_ID = "sample"
NUMBER_TOOLS = ("get_pr", "get_issue")


@pytest.fixture
def server(make_repo):
    fixture = make_repo()
    entry = RegistryEntry(repository_id=REPOSITORY_ID, root=str(fixture.path), github=None)
    return create_server(LoadedRegistry(entries={REPOSITORY_ID: entry}, problems=()))


def _tool_schemas(server) -> dict[str, dict]:
    return {tool.name: tool.input_schema for tool in asyncio.run(server.list_tools())}


@pytest.mark.parametrize("tool_name", NUMBER_TOOLS)
def test_exposed_schema_declares_number_as_a_required_string(server, tool_name: str) -> None:
    schema = _tool_schemas(server)[tool_name]
    number = schema["properties"]["number"]
    assert number["type"] == "string"
    assert set(number) <= {"title", "type"}, "no pattern, minimum, or maximum may be exposed as a constraint"
    assert "number" in schema["required"]


@pytest.mark.parametrize("tool_name", NUMBER_TOOLS)
def test_json_integer_is_rejected_by_the_sdk_schema(server, tool_name: str) -> None:
    with pytest.raises(ToolError):
        asyncio.run(server.call_tool(tool_name, {"repository_id": REPOSITORY_ID, "number": 7}))


def _body(result) -> dict:
    return json.loads(result.content[0].text)


@pytest.mark.parametrize("tool_name", NUMBER_TOOLS)
@pytest.mark.parametrize("value", ["7", "007", "2147483648"])
def test_accepted_number_reaches_the_handler(server, tool_name: str, value: str) -> None:
    """The handler accepted the value. It stopped at the missing GitHub identity, so nothing was requested."""
    body = _body(asyncio.run(server.call_tool(tool_name, {"repository_id": REPOSITORY_ID, "number": value})))
    assert body["error"] == "GITHUB_IDENTITY_UNRESOLVED"


@pytest.mark.parametrize("tool_name", NUMBER_TOOLS)
@pytest.mark.parametrize("value", ["0", "-1", "00", "+7", "1.5", " 7", "7a", ""])
def test_rejected_number_returns_invalid_input_on_number(server, tool_name: str, value: str) -> None:
    body = _body(asyncio.run(server.call_tool(tool_name, {"repository_id": REPOSITORY_ID, "number": value})))
    assert body["error"] == "INVALID_INPUT"
    assert body["field"] == "number"


_IDENTITY = GitHubIdentity(owner="octo", name="repo")


@pytest.mark.parametrize(
    "value, canonical",
    [("7", "7"), ("007", "7"), ("0000042", "42"), ("2147483648", "2147483648")],
)
def test_canonical_decimal_form_is_used_for_the_github_request(value: str, canonical: str) -> None:
    """Leading zeros are removed before any GitHub request is built (D9, D11). No upper bound applies."""
    assert _validated_request(_IDENTITY, value)[0] == canonical


@pytest.mark.parametrize("value", ["0", "-1", "7a"])
def test_client_rejects_the_same_values_as_the_tool(value: str) -> None:
    with pytest.raises(GitHubError):
        _validated_request(_IDENTITY, value)
