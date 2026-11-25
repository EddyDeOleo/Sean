r"""Application entry point with the repository-intelligence routes (Spec 4 section 4.1).

Start from the backend directory (Windows PowerShell):
    .\.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000

It builds the unchanged Phase 3 application with `create_app` and includes the additive router. `app.main` is not edited and
still works on its own. Optional environment variables: SEAN_GITHUB_TOKEN (Phase 3) and SEAN_GROQ_API_KEY (request
interpretation only). Both are registered for redaction and are never logged.
"""

from __future__ import annotations

import logging
import os

from app.api.advisor_routes import create_advisor_router
from app.api.app import create_app
from app.api.agent_auth import PairingService, add_agent_boundary
from app.api.local_guard import loopback_origins_from_environment, web_origins_from_environment
from app.core.diagnostics import configure_logging, register_secrets
from app.core.env import load_local_environment
from app.core.paths import local_data_dir
from app.modules.intent.groq import API_KEY_VARIABLE, transport_from_environment
from app.api.repository_routes import create_repository_router
from app.modules.repository.holder import RegistryHolder
from app.modules.repository.management import load_snapshot
from app.modules.repository.registry import default_registry_path

load_local_environment()  # the same local configuration for every start method (app/core/env.py)
register_secrets([os.environ.get("SEAN_GITHUB_TOKEN"), (os.environ.get(API_KEY_VARIABLE) or "").strip() or None])
logging.basicConfig(level=logging.INFO)


def _add_file_log() -> None:
    """Also write the log to %LOCALAPPDATA%\\Sean\\logs\\backend.log, so a rejected answer can be diagnosed later.

    The file receives only what the console receives, and the redacting filter below is attached to every root handler,
    including this one. Without LOCALAPPDATA, the console is the only log.
    """
    directory = local_data_dir()
    if directory is None:
        return
    logs = directory / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    handler = logging.FileHandler(logs / "backend.log", encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logging.getLogger().addHandler(handler)


_add_file_log()
configure_logging(logging.getLogger("sean"))
# The holder is read on every request. Repository management replaces its content after each registry write (Spec 4 section
# 16), so adding, editing, or removing a repository needs no restart. The MCP entry point still loads the registry once.
_holder = RegistryHolder(*load_snapshot(default_registry_path()))
app = create_app(_holder)
app.include_router(create_advisor_router(_holder, groq_transport=transport_from_environment()))
app.include_router(create_repository_router(_holder))

# Sean Local + Web (Spec 4 section 13, amended 2026-11-23): exact origin lists, and configured web origins pair for a token.
add_agent_boundary(app, loopback_origins_from_environment(), web_origins_from_environment(), PairingService())
