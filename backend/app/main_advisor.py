r"""Application entry point with the repository-intelligence routes (Spec 4 section 4.1).

Start from the backend directory (Windows PowerShell):
    .\.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000

It builds the unchanged Phase 3 application with `create_app` and includes the additive router. `app.main` is not edited and
still works on its own. Optional environment variables: SEAN_GITHUB_TOKEN (Phase 3) and SEAN_GEMINI_API_KEY (request
interpretation only). Both are registered for redaction and are never logged.
"""

from __future__ import annotations

import logging
import os

from app.api.advisor_routes import create_advisor_router
from app.api.app import create_app
from app.api.local_guard import LocalOnlyMiddleware
from app.core.diagnostics import configure_logging, register_secrets
from app.modules.intent.gemini import API_KEY_VARIABLE, transport_from_environment
from app.modules.repository.registry import default_registry_path, load_registry

register_secrets([os.environ.get("SEAN_GITHUB_TOKEN"), (os.environ.get(API_KEY_VARIABLE) or "").strip() or None])
logging.basicConfig(level=logging.INFO)
configure_logging(logging.getLogger("sean"))
_registry = load_registry(default_registry_path())
app = create_app(_registry)
app.add_middleware(LocalOnlyMiddleware)
app.include_router(create_advisor_router(_registry, gemini_transport=transport_from_environment()))
