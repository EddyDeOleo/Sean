"""Run the real Sean backend against disposable repositories.

Development tooling for the frontend browser tests and for fixture capture. It builds the repositories, writes a temporary
registry under a temporary LOCALAPPDATA, and starts uvicorn on 127.0.0.1. The real registry is never read or written.

Usage (from the repository root, with the backend virtual environment):
    backend\\.venv\\Scripts\\python.exe scripts\\run_fixture_backend.py --port 8765

Registered repositories: sample (main), shallow, ambiguous, broken, rich.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fixture_repositories import build_all  # noqa: E402


def prepare(root: Path) -> dict[str, str]:
    """Build the repositories, write the registry, and return the environment for the backend process."""
    repos = build_all(root / "repos")
    config = root / "localappdata" / "Sean" / "config"
    config.mkdir(parents=True)
    registry = {
        "schema_version": 1,
        "repositories": [
            {"repository_id": "sample", "root": str(repos["main"])},
            {"repository_id": "shallow", "root": str(repos["shallow"])},
            {"repository_id": "ambiguous", "root": str(repos["ambiguous"])},
            {"repository_id": "broken", "root": str(repos["broken"])},
            {"repository_id": "rich", "root": str(repos["rich"])},
        ],
    }
    (config / "repositories.json").write_text(json.dumps(registry), encoding="utf-8")
    environment = {key: os.environ[key] for key in ("PATH", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE") if key in os.environ}
    environment["LOCALAPPDATA"] = str(root / "localappdata")
    environment["PYTHONPATH"] = str(REPOSITORY_ROOT / "backend")
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    return environment


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8765)
    arguments = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="sean-fixture-backend-") as temporary:
        environment = prepare(Path(temporary))
        print(f"fixture backend: http://127.0.0.1:{arguments.port}", flush=True)
        process = subprocess.Popen(
            [sys.executable, "-P", "-m", "uvicorn", "app.main_advisor:app", "--host", "127.0.0.1", "--port", str(arguments.port)],
            cwd=str(REPOSITORY_ROOT / "backend"),
            env=environment,
        )
        try:
            return process.wait()
        except KeyboardInterrupt:
            process.terminate()
            return process.wait()


if __name__ == "__main__":
    raise SystemExit(main())
