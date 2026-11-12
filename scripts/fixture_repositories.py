"""Disposable Git repositories for frontend fixtures and browser tests.

Development tooling only. Nothing here is imported by the application. Repositories are created in a directory that the
caller owns (normally a temporary directory). The Sean repository itself is never used as a fixture.

Commit dates, authors, and contents are fixed, so commit hashes are deterministic across runs.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

BASE_TIME = 1_735_689_600  # 2025-01-01T00:00:00Z


def _git_executable() -> str:
    found = shutil.which("git")
    if found is None:
        raise RuntimeError("git was not found on PATH")
    return found


def _environment(author: str, email: str, stamp: str) -> dict[str, str]:
    environment = {key: os.environ[key] for key in ("PATH", "SYSTEMROOT", "TEMP", "TMP") if key in os.environ}
    environment.update(
        {
            "GIT_AUTHOR_NAME": author,
            "GIT_AUTHOR_EMAIL": email,
            "GIT_COMMITTER_NAME": author,
            "GIT_COMMITTER_EMAIL": email,
            "GIT_AUTHOR_DATE": stamp,
            "GIT_COMMITTER_DATE": stamp,
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_TERMINAL_PROMPT": "0",
        }
    )
    return environment


class Repo:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._tick = 0

    def git(self, *args: str, author: str = "Fixture", email: str = "fixture@example.invalid") -> str:
        stamp = f"{BASE_TIME + self._tick * 86_400} +0000"
        completed = subprocess.run(
            [_git_executable(), "-C", str(self.path), *args],
            check=True,
            capture_output=True,
            text=True,
            env=_environment(author, email, stamp),
        )
        return completed.stdout

    def init(self) -> None:
        self.path.mkdir(parents=True, exist_ok=True)
        self.git("init", "-q", ".")
        self.git("config", "commit.gpgsign", "false")

    def write(self, relative: str, text: str) -> None:
        target = self.path / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(text.encode("utf-8"))

    def commit(self, message: str, *, author: str, email: str) -> str:
        self._tick += 3
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message, author=author, email=email)
        return self.git("rev-parse", "HEAD").strip()


def build_main(root: Path) -> Repo:
    """A repository with a billing module that changed five times, with documentation changed alongside."""
    repo = Repo(root)
    repo.init()
    repo.write("src/billing.py", "def charge(amount):\n    return amount\n")
    repo.write("docs/billing.md", "# Billing\n\nCharges are taken at checkout.\n")
    repo.commit("Add charge function", author="Mira Okafor", email="mira@example.invalid")
    repo.write("src/billing.py", "def charge(amount):\n    if amount < 0:\n        raise ValueError('negative')\n    return amount\n")
    repo.commit("Reject negative charge amounts", author="Tomas Lindqvist", email="tomas@example.invalid")
    repo.write("src/billing.py", "def charge(amount, currency='EUR'):\n    if amount < 0:\n        raise ValueError('negative')\n    return (amount, currency)\n")
    repo.write("docs/billing.md", "# Billing\n\nCharges are taken at checkout in a chosen currency.\n")
    repo.commit("Add currency to charge", author="Mira Okafor", email="mira@example.invalid")
    repo.write("src/billing.py", "def charge(amount, currency='EUR'):\n    if amount <= 0:\n        raise ValueError('non-positive')\n    return (amount, currency)\n")
    repo.commit("Treat zero as invalid", author="Priya Raman", email="priya@example.invalid")
    repo.write("src/billing.py", "def charge(amount, currency='EUR'):\n    if amount <= 0:\n        raise ValueError('non-positive')\n    return {'amount': amount, 'currency': currency}\n")
    repo.commit("Return a mapping from charge", author="Tomas Lindqvist", email="tomas@example.invalid")
    return repo


def build_ambiguous(root: Path) -> Repo:
    """One file with two methods named run, so a symbol search is ambiguous."""
    repo = Repo(root)
    repo.init()
    repo.write(
        "src/multi.py",
        "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n",
    )
    repo.commit("Add two run methods", author="Mira Okafor", email="mira@example.invalid")
    return repo


def build_shallow(source: Path, destination: Path) -> Path:
    """A depth-1 clone of source. Local file transport only."""
    subprocess.run(
        [
            _git_executable(),
            "-c",
            f"core.hooksPath={os.devnull}",
            "clone",
            "--template=",
            "--depth",
            "1",
            "--quiet",
            source.as_uri(),
            str(destination),
        ],
        check=True,
        capture_output=True,
        timeout=60,
        env=_environment("Fixture", "fixture@example.invalid", f"{BASE_TIME} +0000"),
    )
    return destination


def build_broken(root: Path) -> Path:
    """A directory with an unreadable .git entry, so the registry accepts it and every Git call fails."""
    (root / ".git").mkdir(parents=True, exist_ok=True)
    (root / "src").mkdir(parents=True, exist_ok=True)
    return root


def build_all(root: Path) -> dict[str, Path]:
    """Create every repository under root and return their paths by name."""
    main = build_main(root / "main").path
    ambiguous = build_ambiguous(root / "ambiguous").path
    shallow = build_shallow(main, root / "shallow")
    broken = build_broken(root / "broken")
    return {"main": main, "ambiguous": ambiguous, "shallow": shallow, "broken": broken}
