"""Symbol validation (Task 2.3) and target resolution at HEAD (Tasks 4.1 and 4.2)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.modules.repository.paths import PathError
from app.modules.symbol_resolution import resolver
from app.modules.symbol_resolution.resolver import (
    AMBIGUOUS,
    NOT_IN_CURRENT_STATE,
    PARSE_FAILED,
    PATH_NOT_FOUND,
    RESOLVED,
    UNSUPPORTED_LANGUAGE,
    resolve_symbol,
)
from app.modules.symbol_resolution.validation import (
    MAX_LINE_SPAN,
    MAX_SYMBOL_LENGTH,
    InvalidInput,
    validate_line_range,
    validate_symbol,
)

# ---------- Task 2.3: input validation ----------


@pytest.mark.parametrize("symbol", ["f", "Class.method", "_private", "x" * MAX_SYMBOL_LENGTH, "é"])
def test_valid_symbols_are_accepted(symbol: str) -> None:
    assert validate_symbol(symbol) == symbol


@pytest.mark.parametrize(
    "symbol",
    ["", " f", "f ", "a\nb", "a\x00b", "a\tb", "x" * (MAX_SYMBOL_LENGTH + 1), "a..b", ".a", "a.", None, 3],
    ids=["empty", "leading-space", "trailing-space", "newline", "nul", "tab", "too-long", "double-dot", "leading-dot",
         "trailing-dot", "none", "int"],
)
def test_invalid_symbols_are_rejected(symbol) -> None:
    with pytest.raises(InvalidInput):
        validate_symbol(symbol)


def test_line_range_omitted_entirely_is_allowed() -> None:
    assert validate_line_range(None, None) is None


@pytest.mark.parametrize(
    ("start", "end"),
    [(1, 1), (1, 3), (5, 5)],
)
def test_valid_line_ranges(start: int, end: int) -> None:
    assert validate_line_range(start, end) == (start, end)


@pytest.mark.parametrize(
    ("start", "end"),
    [(None, 3), (3, None), (0, 1), (-1, 2), (3, 2), (True, 2), (1.0, 2), (1, MAX_LINE_SPAN + 1)],
    ids=["missing-start", "missing-end", "zero", "negative", "reversed", "bool", "float", "span-over-limit"],
)
def test_invalid_line_ranges(start, end) -> None:
    with pytest.raises(InvalidInput):
        validate_line_range(start, end)


def test_span_at_the_limit_is_accepted() -> None:
    assert validate_line_range(1, MAX_LINE_SPAN) == (1, MAX_LINE_SPAN)


# ---------- Tasks 4.1 and 4.2: resolution at HEAD ----------


def test_single_function_resolves_with_exact_lines(make_repo) -> None:
    """Task 4.1: one definition gives RESOLVED with its line range. Decorators are included."""
    repo = make_repo()
    repo.write(
        "src/a.py",
        "import os\n\n\n@staticmethod\ndef target():\n    return os.sep\n\n\ndef other():\n    return 1\n",
    )
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "target")

    assert resolution.status == RESOLVED
    assert resolution.definition.qualified_name == "target"
    assert (resolution.definition.start_line, resolution.definition.end_line) == (4, 6)
    assert resolution.historical_fallback is False


def test_dotted_name_selects_one_method(make_repo) -> None:
    """Task 4.1: "Class.method" matches the qualified name and is not ambiguous with the other class."""
    repo = make_repo()
    repo.write(
        "src/a.py",
        "class A:\n    def run(self):\n        return 1\n\n\nclass B:\n    def run(self):\n        return 2\n",
    )
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "B.run")

    assert resolution.status == RESOLVED
    assert resolution.definition.qualified_name == "B.run"
    assert (resolution.definition.start_line, resolution.definition.end_line) == (7, 8)


def test_simple_name_shared_by_two_definitions_is_ambiguous_with_candidates(make_repo) -> None:
    """Task 4.1: ambiguity is returned with every candidate. No candidate is chosen silently."""
    repo = make_repo()
    repo.write(
        "src/a.py",
        "class A:\n    def run(self):\n        return 1\n\n\nclass B:\n    def run(self):\n        return 2\n",
    )
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "run")

    assert resolution.status == AMBIGUOUS
    assert resolution.definition is None
    assert [candidate.qualified_name for candidate in resolution.candidates] == ["A.run", "B.run"]
    assert resolution.historical_fallback is False


def test_line_range_filters_candidates(make_repo) -> None:
    """Task 4.1: a line range keeps only definitions that overlap it, which can resolve an ambiguity."""
    repo = make_repo()
    repo.write(
        "src/a.py",
        "class A:\n    def run(self):\n        return 1\n\n\nclass B:\n    def run(self):\n        return 2\n",
    )
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "run", 7, 8)

    assert resolution.status == RESOLVED
    assert resolution.definition.qualified_name == "B.run"


def test_missing_symbol_is_not_in_current_state_and_allows_historical_search(make_repo) -> None:
    """Task 4.2: a file that parses without the symbol gives NOT_IN_CURRENT_STATE and enables the historical fallback."""
    repo = make_repo()
    repo.write("src/a.py", "def other():\n    return 1\n")
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "gone")

    assert resolution.status == NOT_IN_CURRENT_STATE
    assert resolution.historical_fallback is True


def test_syntax_error_at_head_is_a_parse_failure_not_zero_matches(make_repo) -> None:
    """OD-11 parse-failure outcome: never NOT_IN_CURRENT_STATE, and no historical fallback for the symbol."""
    repo = make_repo()
    repo.write("src/a.py", "def broken(:\n")
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.py", "broken")

    assert resolution.status == PARSE_FAILED
    assert resolution.code == "TARGET_PARSE_FAILED"
    assert resolution.historical_fallback is False


def test_invalid_utf8_source_is_a_parse_failure(make_repo) -> None:
    """Undecodable source is a parse failure, not an empty result."""
    repo = make_repo()
    (repo.path / "src").mkdir()
    (repo.path / "src" / "a.py").write_bytes(b"\xff\xfe def f(): pass\n")
    repo.git("add", "-A")
    repo.commit("bytes", paths=None)

    resolution = resolve_symbol(repo.path, "src/a.py", "f")

    assert resolution.status == PARSE_FAILED


def test_non_python_file_is_reported_as_unsupported(make_repo) -> None:
    repo = make_repo()
    repo.write("src/a.ts", "export function f() {}\n")
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/a.ts", "f")

    assert resolution.status == UNSUPPORTED_LANGUAGE


def test_path_absent_at_head_is_reported_with_fallback(make_repo) -> None:
    """Task 4.2: a path that is not a file at HEAD gives PATH_NOT_FOUND and enables the historical fallback."""
    repo = make_repo()
    repo.write("src/a.py", "def f():\n    return 1\n")
    repo.commit("create")

    resolution = resolve_symbol(repo.path, "src/missing.py", "f")

    assert resolution.status == PATH_NOT_FOUND
    assert resolution.historical_fallback is True


def test_resolution_reads_head_not_the_working_tree(make_repo) -> None:
    """Task 4.1: the current state is HEAD. An uncommitted edit to the file is not read."""
    repo = make_repo()
    repo.write("src/a.py", "def f():\n    return 1\n")
    repo.commit("create")
    repo.write("src/a.py", "def g():\n    return 2\n")

    resolution = resolve_symbol(repo.path, "src/a.py", "f")

    assert resolution.status == RESOLVED


def test_path_outside_the_repository_is_rejected_before_git(make_repo) -> None:
    repo = make_repo()
    repo.write("src/a.py", "def f():\n    return 1\n")
    repo.commit("create")
    with pytest.raises(PathError):
        resolve_symbol(repo.path, "../a.py", "f")


def test_resolver_has_no_parser_dependency() -> None:
    """OD-11: the standard library ast module is the only parser. No third-party parser is imported."""
    source = Path(resolver.__file__).read_text(encoding="utf-8")
    assert "import ast" in source
    assert "tree_sitter" not in source and "libcst" not in source
