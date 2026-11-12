"""Shared fixture: temporary Git repositories for history, blame, and symbol tests.

Fixture commands use the Git CLI with argument arrays. They run only inside pytest's temporary directories. Dates and
identities are fixed so that results are deterministic.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

import pytest

_IDENTITY_ENVIRONMENT = {
    "GIT_AUTHOR_NAME": "Ada Example",
    "GIT_AUTHOR_EMAIL": "ada@example.invalid",
    "GIT_COMMITTER_NAME": "Ada Example",
    "GIT_COMMITTER_EMAIL": "ada@example.invalid",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_NOSYSTEM": "1",
}


@dataclass
class FixtureRepo:
    path: Path
    _clock: int = 1_700_000_000

    def git(self, *arguments: str, env_extra: dict[str, str] | None = None) -> str:
        environment = {**os.environ, **_IDENTITY_ENVIRONMENT, **(env_extra or {})}
        completed = subprocess.run(
            ["git", "-C", str(self.path), *arguments],
            check=True,
            capture_output=True,
            text=True,
            env=environment,
        )
        return completed.stdout

    def write(self, relative: str, text: str) -> None:
        target = self.path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text.encode("utf-8"))

    def commit(self, message: str, *, paths: list[str] | None = None) -> str:
        """Stage the given paths (or everything), commit with a fixed date, and return the new full commit name."""
        self._clock += 60
        stamp = f"{self._clock} +0000"
        if paths is None:
            self.git("add", "-A")
        else:
            self.git("add", "--", *paths)
        self.git("commit", "-q", "-m", message, env_extra={"GIT_AUTHOR_DATE": stamp, "GIT_COMMITTER_DATE": stamp})
        return self.git("rev-parse", "HEAD").strip()


@pytest.fixture
def make_repo(tmp_path: Path):
    """Return a factory that creates an empty Git repository in a fresh temporary directory."""
    counter = {"n": 0}

    def _make() -> FixtureRepo:
        counter["n"] += 1
        path = tmp_path / f"repo-{counter['n']}"
        path.mkdir()
        repo = FixtureRepo(path)
        repo.git("init", "-q", ".")
        repo.git("config", "commit.gpgsign", "false")
        return repo

    return _make
