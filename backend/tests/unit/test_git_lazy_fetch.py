"""Git must not fetch missing objects over the network because of repository-controlled configuration (security review M4).

A partial clone records a "promisor" remote. By default Git then fetches a missing object on demand, using the remote and
the upload-pack command named in the repository's own .git/config. A registered repository could therefore make a read-only
`cat-file` run an arbitrary program. The runner must refuse: lazy fetching is switched off and no transport is allowed.

The tests use a local partial clone whose remote "upload-pack" is a script that leaves a marker file when it runs.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from app.core.git_runner import GUARD_OPTIONS, GitError, controlled_environment, run_git
from app.modules.repository_profile.scanner import scan_repository

_ENVIRONMENT = {
    **os.environ,
    "GIT_AUTHOR_NAME": "Ada Example", "GIT_AUTHOR_EMAIL": "ada@example.invalid",
    "GIT_COMMITTER_NAME": "Ada Example", "GIT_COMMITTER_EMAIL": "ada@example.invalid",
    "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_NOSYSTEM": "1",
}


def _git(path: Path, *arguments: str) -> str:
    return subprocess.run(["git", "-C", str(path), *arguments], check=True, capture_output=True, text=True, env=_ENVIRONMENT).stdout


@pytest.fixture
def partial_clone(tmp_path: Path):
    """A partial clone with its blobs missing, whose upload-pack command would leave a marker if Git ran it."""
    source = tmp_path / "source"
    source.mkdir()
    _git(source, "init", "-q", ".")
    _git(source, "config", "commit.gpgsign", "false")
    _git(source, "config", "uploadpack.allowFilter", "true")
    _git(source, "config", "uploadpack.allowAnySHA1InWant", "true")
    (source / "package.json").write_text('{"devDependencies": {"vitest": "1"}}', encoding="utf-8")
    (source / "app.py").write_text("a = 1\n", encoding="utf-8")
    _git(source, "add", "-A")
    _git(source, "commit", "-q", "-m", "init")

    clone = tmp_path / "clone"
    subprocess.run(
        ["git", "clone", "-q", "--filter=blob:none", "--no-checkout", source.as_uri(), str(clone)],
        check=True, capture_output=True, env=_ENVIRONMENT,
    )
    marker = tmp_path / "upload-pack-ran.txt"
    script = tmp_path / "upload-pack.cmd"
    script.write_text(f'@echo off\r\necho ran> "{marker}"\r\nexit /b 1\r\n', encoding="ascii")
    # Git runs this value through a POSIX shell, so it needs forward slashes to name the script.
    _git(clone, "config", "remote.origin.uploadpack", script.as_posix())
    head = _git(clone, "rev-parse", "HEAD").strip()
    return clone, marker, head


def test_the_clone_really_is_missing_its_blobs(partial_clone):
    """Guard against a test that proves nothing: without the runner's protections, Git does try to fetch."""
    clone, marker, head = partial_clone
    subprocess.run(["git", "-C", str(clone), "cat-file", "-p", f"{head}:app.py"], capture_output=True, env=_ENVIRONMENT)
    assert marker.exists(), "the fixture does not trigger a lazy fetch, so the protection test below would pass for no reason"
    marker.unlink()


def test_run_git_does_not_fetch_a_missing_object(partial_clone):
    clone, marker, head = partial_clone
    with pytest.raises(GitError):
        run_git(clone, "cat-file", options=["-p"], revisions=[f"{head}:app.py"])
    assert not marker.exists()


def test_the_scanner_reports_unreadable_manifests_instead_of_fetching(partial_clone):
    clone, marker, _ = partial_clone
    profile = scan_repository(clone, "partial")
    assert not marker.exists()
    assert "MANIFEST_NOT_READ" in {item.code for item in profile.limitations}
    assert profile.find("TOOLING") == []
    assert profile.is_incomplete()


def test_the_protections_are_part_of_the_runner_contract():
    assert controlled_environment()["GIT_NO_LAZY_FETCH"] == "1"
    joined = " ".join(GUARD_OPTIONS)
    assert "protocol.allow=never" in joined
