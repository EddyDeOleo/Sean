r"""Application entry point for the HTTP API.

Start from the backend directory (Windows PowerShell):
    .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

The registry is read once here, from %LOCALAPPDATA%\\Sean\\config\\repositories.json (see app.core.paths). Nothing writes it.
The GitHub token is optional. It is read from SEAN_GITHUB_TOKEN and registered for redaction. It is never logged.
"""

from __future__ import annotations

import logging
import os

from app.api.app import create_app
from app.core.diagnostics import configure_logging, register_secrets
from app.modules.repository.registry import default_registry_path, load_registry

register_secrets([os.environ.get("SEAN_GITHUB_TOKEN")])
logging.basicConfig(level=logging.INFO)
configure_logging(logging.getLogger("sean"))

app = create_app(load_registry(default_registry_path()))
