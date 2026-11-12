"""Unit tests for app.modules.repository.paths (normalized repository-relative path form).

The predicate is the lexical subset of design section C.3a that Evidence validation relies on. The reserved-name,
trailing-character, and containment rules remain Task 2 and are not tested here.
"""

from __future__ import annotations

import pytest

from app.modules.repository.paths import is_normalized_repository_path


@pytest.mark.parametrize(
    "path",
    ["a.py", "src/a.py", "src/a b.py", "café.md", "docs/Guide-1_2~3.rst", "x/y/z"],
    ids=["file", "nested", "space", "unicode", "unreserved", "deep"],
)
def test_normalized_paths_are_accepted(path: str) -> None:
    """Design C.3a (lexical subset): relative paths with forward slashes and ordinary segments are accepted."""
    assert is_normalized_repository_path(path)


@pytest.mark.parametrize(
    "path",
    [
        "",
        "/abs.py",
        "\\abs.py",
        "a\\b.py",
        "C:/x.py",
        "c:x.py",
        "Z:",
        "a//b.py",
        "./a.py",
        "a/./b.py",
        "../a.py",
        "a/../b.py",
        "a/",
        "a\x00b",
        "a\nb",
        "a\tb",
        "a\x7fb",
        "\ud800",
        "a:b.py",
        "x/a:b",
    ],
    ids=[
        "empty", "leading-slash", "leading-backslash", "backslash", "drive", "drive-no-slash", "drive-only",
        "empty-segment", "dot", "dot-inside", "parent", "parent-inside", "trailing-slash", "nul", "newline", "tab",
        "delete", "lone-surrogate", "colon-in-name", "colon-in-nested-name",
    ],
)
def test_non_normalized_paths_are_rejected(path: str) -> None:
    """Design C.3a (lexical subset) and Requirement 14.2: traversal, drives, control characters, and empty segments are rejected."""
    assert not is_normalized_repository_path(path)
