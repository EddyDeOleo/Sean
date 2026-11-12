"""Unit tests for C.3a containment on resolved paths (Task 2.2), and the junction probe for Task 2.1.

Links are created only inside pytest's temporary directory. A junction or symbolic link that cannot be created on this
machine causes a skip, and the skip is reported. Creation uses argument arrays, not shell-concatenated commands.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

from app.modules.repository.paths import (
    INVALID_INPUT,
    PATH_OUTSIDE_REPOSITORY,
    PathError,
    resolve_contained_path,
)


@pytest.fixture
def layout(tmp_path: Path) -> dict[str, Path]:
    """A root, a sibling whose name starts with the root's name, and a directory outside both."""
    root = tmp_path / "root"
    sibling = tmp_path / "root-other"
    outside = tmp_path / "outside"
    for directory in (root, sibling, outside, root / "sub"):
        directory.mkdir()
    (root / "inside.txt").write_text("inside", encoding="utf-8")
    (outside / "secret.txt").write_text("outside", encoding="utf-8")
    return {"tmp": tmp_path, "root": root, "sibling": sibling, "outside": outside}


def _make_junction(link: Path, target: Path) -> None:
    try:
        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(target)], check=True, capture_output=True)
    except (OSError, subprocess.CalledProcessError) as error:
        pytest.skip(f"junction could not be created on this machine: {error!r}")


def _make_symlink(link: Path, target: Path) -> None:
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError as error:
        pytest.skip(f"symbolic link could not be created (privilege or policy): {error!r}")


def test_platform_realpath_resolves_junction(layout: dict[str, Path]) -> None:
    """Task 2.1 verification item: the platform real-path function follows a Windows junction."""
    link = layout["root"] / "link"
    _make_junction(link, layout["outside"])
    assert os.path.realpath(link).lower() == os.path.realpath(layout["outside"]).lower()


def test_existing_file_inside_root_is_contained(layout: dict[str, Path]) -> None:
    """C.3a step 4: a path that resolves inside the root is accepted."""
    resolved = resolve_contained_path(layout["root"], "inside.txt")
    assert resolved.is_relative_to(os.path.realpath(layout["root"]))
    assert resolved.name == "inside.txt"


def test_missing_historical_path_inside_root_is_contained(layout: dict[str, Path]) -> None:
    """C.3a step 5: a path absent from the working tree is allowed when its ancestor is inside the root."""
    resolved = resolve_contained_path(layout["root"], "sub/removed/file.py")
    assert resolved.is_relative_to(os.path.realpath(layout["root"]))
    assert resolved.parts[-3:] == ("sub", "removed", "file.py")


def test_junction_to_outside_is_rejected_for_existing_target(layout: dict[str, Path]) -> None:
    """C.3a step 4: a junction inside the root that leads outside is rejected."""
    _make_junction(layout["root"] / "link", layout["outside"])
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], "link/secret.txt")
    assert str(raised.value) == PATH_OUTSIDE_REPOSITORY


def test_junction_to_outside_is_rejected_for_missing_target(layout: dict[str, Path]) -> None:
    """C.3a step 5: the longest existing ancestor is checked, so a missing child under an escaping junction is rejected."""
    _make_junction(layout["root"] / "link", layout["outside"])
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], "link/does-not-exist.txt")
    assert str(raised.value) == PATH_OUTSIDE_REPOSITORY


def test_rejection_does_not_disclose_existence(layout: dict[str, Path]) -> None:
    """C.3a step 6: an existing and a missing target outside the root produce the same error."""
    _make_junction(layout["root"] / "link", layout["outside"])
    codes = []
    for relative in ("link/secret.txt", "link/absent.txt"):
        with pytest.raises(PathError) as raised:
            resolve_contained_path(layout["root"], relative)
        codes.append(str(raised.value))
    assert codes[0] == codes[1] == PATH_OUTSIDE_REPOSITORY


def test_sibling_with_shared_name_prefix_is_rejected(layout: dict[str, Path]) -> None:
    """C.3a step 4: containment compares path segments, so root-other does not count as inside root."""
    _make_junction(layout["root"] / "link", layout["sibling"])
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], "link/anything.txt")
    assert str(raised.value) == PATH_OUTSIDE_REPOSITORY


def test_junction_to_directory_inside_root_is_contained(layout: dict[str, Path]) -> None:
    """A junction whose target stays inside the root is accepted, and the result is the real inside path."""
    _make_junction(layout["root"] / "alias", layout["root"] / "sub")
    resolved = resolve_contained_path(layout["root"], "alias/new.py")
    assert resolved.is_relative_to(os.path.realpath(layout["root"]))
    assert resolved.name == "new.py"


def test_nested_junction_escape_is_rejected(layout: dict[str, Path]) -> None:
    """An escaping junction inside a subdirectory is also rejected."""
    _make_junction(layout["root"] / "sub" / "link", layout["outside"])
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], "sub/link/secret.txt")
    assert str(raised.value) == PATH_OUTSIDE_REPOSITORY


def test_symbolic_link_to_outside_is_rejected(layout: dict[str, Path]) -> None:
    """C.3a step 4 for a symbolic link. Skipped when the platform does not allow creating one."""
    _make_symlink(layout["root"] / "symlink", layout["outside"])
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], "symlink/secret.txt")
    assert str(raised.value) == PATH_OUTSIDE_REPOSITORY


@pytest.mark.parametrize("raw", ["../outside/secret.txt", "a\\..\\..\\outside", "C:/outside/secret.txt"])
def test_lexical_rejection_runs_before_resolution(layout: dict[str, Path], raw: str) -> None:
    """The input rules from Task 2.1 apply first. Such inputs fail as INVALID_INPUT, not as containment results."""
    with pytest.raises(PathError) as raised:
        resolve_contained_path(layout["root"], raw)
    assert str(raised.value) == INVALID_INPUT
