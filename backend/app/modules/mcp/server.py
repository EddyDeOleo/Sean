"""MCP server registration (Task 17.2, 17.3; D02 §8, §16.4).

The server is embedded in the backend process and speaks STDIO only. It opens no network listener. Each tool is a closure
over the shared registry that calls the functions in app.modules.mcp.tools. The SDK derives each input schema from the
function signature.

Errors: a tool returns its structured error body (see tools.McpToolError.to_dict) as its result. It does not raise. The
client therefore always receives the fixed error code and message, never an exception text.
"""

from __future__ import annotations

from typing import Any

from mcp.server.mcpserver import MCPServer

from app.modules.mcp import tools
from app.modules.mcp.tools import McpToolError
from app.modules.repository.registry import LoadedRegistry

SERVER_NAME = "sean"
SERVER_VERSION = "0.1.0"
INSTRUCTIONS = (
    "Read-only repository investigation tools. Results carry evidence, a retrieval status, ranking, and limitations. "
    "They carry no epistemic classification and no conclusion."
)


def create_server(registry: LoadedRegistry) -> MCPServer:
    """Build the MCP server with exactly the four approved tools (Requirement 13.1)."""
    server = MCPServer(name=SERVER_NAME, version=SERVER_VERSION, instructions=INSTRUCTIONS)

    def _run(call) -> dict[str, Any]:
        try:
            return call()
        except McpToolError as error:
            return error.to_dict()

    @server.tool(name="search_history", description="Evidence, ranking, retrieval status, and limitations for a repository path or symbol.")
    def search_history(
        repository_id: str,
        path: str,
        symbol: str | None = None,
        line_start: int | None = None,
        line_end: int | None = None,
        max_results: int | None = None,
    ) -> dict[str, Any]:
        return _run(lambda: tools.search_history(registry, repository_id, path, symbol, line_start, line_end, max_results))

    @server.tool(name="blame_range", description="Blame for a repository path and line range at a full commit name, or HEAD.")
    def blame_range(
        repository_id: str,
        path: str,
        line_start: int,
        line_end: int,
        revision: str | None = None,
    ) -> dict[str, Any]:
        return _run(lambda: tools.blame_range_tool(registry, repository_id, path, line_start, line_end, revision))

    @server.tool(name="get_pr", description="Validated pull request metadata. The number is a positive decimal string.")
    def get_pr(repository_id: str, number: str) -> dict[str, Any]:
        return _run(lambda: tools.get_pr(registry, repository_id, number))

    @server.tool(name="get_issue", description="Validated issue metadata. The number is a positive decimal string.")
    def get_issue(repository_id: str, number: str) -> dict[str, Any]:
        return _run(lambda: tools.get_issue(registry, repository_id, number))

    return server
