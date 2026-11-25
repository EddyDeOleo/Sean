"""Local environment file loader, shared by every way of starting the backend (Spec 4 section 8).

The optional provider key lives in `.kiro/.env` at the repository root. The file is found from this module's own location, so
the result does not depend on the current working directory. Only the names listed in ALLOWED are read. A value already set in
the process environment is never replaced. Values are never printed, logged, or returned: the function returns only the names
it loaded.
"""

from __future__ import annotations

import os
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[3] / ".kiro" / ".env"
# The two optional secrets, and the two origin lists of the local agent boundary (app/api/local_guard.py).
ALLOWED = ("SEAN_GROQ_API_KEY", "SEAN_GITHUB_TOKEN", "SEAN_ALLOWED_ORIGINS", "SEAN_LOOPBACK_ORIGINS")


def load_local_environment(path: Path = ENV_FILE) -> list[str]:
    """Set the allowed variables from `path` where they are not already set. Returns the names that were set."""
    if not path.is_file():
        return []
    loaded: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        if name not in ALLOWED or os.environ.get(name, "").strip():
            continue
        value = value.strip().strip('"').strip("'")
        if value:
            os.environ[name] = value
            loaded.append(name)
    return loaded
