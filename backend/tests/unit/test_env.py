"""The shared local environment loader (app/core/env.py). Values are never printed or returned, only the names loaded."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core import env


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.delenv("SEAN_GROQ_API_KEY", raising=False)
    monkeypatch.delenv("SEAN_GITHUB_TOKEN", raising=False)


def _file(tmp_path: Path, text: str) -> Path:
    path = tmp_path / ".env"
    path.write_text(text, encoding="utf-8")
    return path


def test_the_default_location_is_the_repository_kiro_folder_not_the_working_directory():
    assert env.ENV_FILE.name == ".env" and env.ENV_FILE.parent.name == ".kiro"
    assert (env.ENV_FILE.parents[1] / "backend" / "app" / "core" / "env.py").is_file()


def test_allowed_names_are_loaded_and_only_their_names_are_reported(tmp_path, monkeypatch):
    path = _file(tmp_path, 'SEAN_GROQ_API_KEY="test-value-not-real"\n')
    assert env.load_local_environment(path) == ["SEAN_GROQ_API_KEY"]
    import os

    assert os.environ["SEAN_GROQ_API_KEY"] == "test-value-not-real"


def test_a_value_already_in_the_process_environment_is_never_replaced(tmp_path, monkeypatch):
    monkeypatch.setenv("SEAN_GROQ_API_KEY", "from-process")
    path = _file(tmp_path, "SEAN_GROQ_API_KEY=from-file\n")
    assert env.load_local_environment(path) == []
    import os

    assert os.environ["SEAN_GROQ_API_KEY"] == "from-process"


def test_unknown_names_comments_and_blank_lines_are_ignored(tmp_path):
    path = _file(tmp_path, "# a comment\n\nSEAN_GEMINI_API_KEY=old-provider\nOTHER=1\nSEAN_GITHUB_TOKEN=token-not-real\n")
    assert env.load_local_environment(path) == ["SEAN_GITHUB_TOKEN"]
    import os

    assert "SEAN_GEMINI_API_KEY" not in os.environ and "OTHER" not in os.environ


def test_a_missing_file_loads_nothing(tmp_path):
    assert env.load_local_environment(tmp_path / "absent.env") == []


def test_both_start_methods_go_through_the_same_loader():
    """The start script must not duplicate the key loading: the application does it for every start method."""
    script = (env.ENV_FILE.parents[1] / "scripts" / "start_backend.ps1").read_text(encoding="utf-8")
    assert "SEAN_GROQ_API_KEY" not in script
    main = (env.ENV_FILE.parents[1] / "backend" / "app" / "main_advisor.py").read_text(encoding="utf-8")
    assert "load_local_environment()" in main
