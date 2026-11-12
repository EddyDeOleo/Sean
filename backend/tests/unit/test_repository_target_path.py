"""Unit tests for the C.3a lexical input rules (Task 2.1).

Property-style coverage uses enumerated cases. Hypothesis is not installed, and its installation is not authorized (OD-19).
"""

from __future__ import annotations

import pytest

from app.modules.repository.paths import INVALID_INPUT, PathError, normalize_target_path


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("a.py", "a.py"),
        ("src/a.py", "src/a.py"),
        ("src\\a.py", "src/a.py"),
        ("src\\nested\\a.py", "src/nested/a.py"),
        ("a b/c d.txt", "a b/c d.txt"),
        ("café/notes.md", "café/notes.md"),
        ("docs/.hidden", "docs/.hidden"),
        ("a.b.c", "a.b.c"),
        ("CONSOLE.txt", "CONSOLE.txt"),
        ("NULL.txt", "NULL.txt"),
        ("COM10/x.txt", "COM10/x.txt"),
        ("LPT0x/y", "LPT0x/y"),
    ],
    ids=[
        "file", "nested", "backslash-normalized", "backslash-deep", "space", "unicode", "leading-dot", "multi-dot",
        "console-not-reserved", "null-not-reserved", "com10-not-reserved", "lpt-prefix-not-reserved",
    ],
)
def test_accepted_forms_are_normalized(raw: str, expected: str) -> None:
    """C.3a step 1: both separators are accepted and normalized to forward slashes."""
    assert normalize_target_path(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "",
        None,
        3,
        "/abs.py",
        "\\abs.py",
        "\\\\server\\share\\x.py",
        "//server/share/x.py",
        "\\\\?\\C:\\x.py",
        "\\\\.\\pipe\\x",
        "C:/x.py",
        "C:x.py",
        "z:",
        "a/../b.py",
        "a\\..\\b.py",
        "..",
        "../outside",
        ".",
        "./a.py",
        "a/./b.py",
        "a//b.py",
        "a/",
        "a\x00b",
        "a\nb",
        "a\tb",
        "a\x7fb",
        "\ud800",
        "a:stream",
        "a/b.txt:ads",
        "CON",
        "con",
        "Con.txt",
        "nul.tar.gz",
        "aux/x",
        "COM1",
        "com9.log",
        "LPT1",
        "lpt5/x",
        "CONIN$",
        "CONOUT$",
        "COM\u00b9",
        "lpt\u00b3.txt",
        "a/b.",
        "a/b ",
        "a /b",
        "NUL .txt",
    ],
    ids=[
        "empty", "none", "not-a-string", "leading-slash", "leading-backslash", "unc-backslash", "unc-slash",
        "device-question", "device-dot", "drive-slash", "drive-no-slash", "drive-only", "traversal", "traversal-back",
        "parent-only", "parent-prefix", "dot-only", "dot-prefix", "dot-inside", "empty-segment", "trailing-slash",
        "nul", "newline", "tab", "delete", "lone-surrogate", "ads-colon", "ads-in-name", "con", "con-lower",
        "con-extension", "nul-compound", "aux-segment", "com1", "com9-extension", "lpt1", "lpt5-segment", "conin",
        "conout", "com-superscript", "lpt-superscript-extension", "trailing-dot", "trailing-space", "space-before-slash",
        "nul-stem-trailing-space",
    ],
)
def test_rejected_forms_raise_invalid_input(raw: object) -> None:
    """C.3a step 2 (category B, INVALID_INPUT). Rejections carry the code only."""
    with pytest.raises(PathError) as raised:
        normalize_target_path(raw)
    assert str(raised.value) == INVALID_INPUT
