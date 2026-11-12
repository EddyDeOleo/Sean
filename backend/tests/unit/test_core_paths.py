"""Unit tests for app.core.paths (shared local data location, Architecture section 8).

The real %LOCALAPPDATA% is never read: the variable is set to a temporary directory or removed.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.paths import local_data_dir
from app.modules.repository.registry import default_registry_path


def test_local_data_dir_is_sean_under_localappdata(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Architecture section 8 and Requirement 1.5: the data directory is %LOCALAPPDATA%\\Sean."""
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))

    assert local_data_dir() == tmp_path / "local" / "Sean"
    assert not (tmp_path / "local").exists(), "local_data_dir must not create directories"


@pytest.mark.parametrize("value", [None, ""], ids=["unset", "empty"])
def test_local_data_dir_is_none_without_localappdata(
    monkeypatch: pytest.MonkeyPatch, value: str | None
) -> None:
    """Requirement 1.5: no LOCALAPPDATA means no data location, and no fallback location."""
    if value is None:
        monkeypatch.delenv("LOCALAPPDATA", raising=False)
    else:
        monkeypatch.setenv("LOCALAPPDATA", value)

    assert local_data_dir() is None


def test_registry_path_is_built_from_core_data_dir(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Requirement 1.5: the registry location is the core data directory plus config\\repositories.json."""
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "local"))

    data_dir = local_data_dir()
    assert data_dir is not None
    assert default_registry_path() == data_dir / "config" / "repositories.json"
