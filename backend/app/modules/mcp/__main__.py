r"""STDIO entry point for the MCP server (Task 17.3).

Start from the backend directory:
    .\.venv\Scripts\python.exe -m app.modules.mcp

Standard output carries protocol messages only. Logs go to standard error. The registry is read once at startup. The
GitHub token is optional (SEAN_GITHUB_TOKEN) and is registered for redaction. No HTTP listener is started.
"""

from __future__ import annotations

import logging
import os
import sys

from app.core.diagnostics import configure_logging, register_secrets
from app.modules.mcp.server import create_server
from app.modules.repository.registry import default_registry_path, load_registry


def main() -> None:
    register_secrets([os.environ.get("SEAN_GITHUB_TOKEN")])
    logging.basicConfig(stream=sys.stderr, level=logging.WARNING)
    configure_logging(logging.getLogger("sean"))
    registry = load_registry(default_registry_path())
    create_server(registry).run("stdio")


if __name__ == "__main__":
    main()
