"""Target resolution in the current state (Tasks 4.1 and 4.2; OD-11 method).

The current state is the committed content at HEAD. The working tree is never read, so results match the commit that the
investigation names. Python files (.py) are parsed with the standard library ast module. No parser dependency is used.

Outcomes are distinct and never substitute for one another:
- RESOLVED: exactly one definition matches the symbol (and the optional line range).
- AMBIGUOUS (TARGET_AMBIGUOUS): two or more definitions match. Every candidate is listed. No choice is made.
- NOT_IN_CURRENT_STATE (TARGET_NOT_IN_CURRENT_STATE): the file parsed, and no definition matches.
- PARSE_FAILED (TARGET_PARSE_FAILED): the file at HEAD could not be parsed. This is not treated as zero matches.
- PATH_NOT_FOUND: the path is not a file at HEAD.
- UNSUPPORTED_LANGUAGE: the file is not Python. No symbol is resolved.

Task 4.2: when the current location is absent (NOT_IN_CURRENT_STATE or PATH_NOT_FOUND), historical_fallback is True. The
history retrieval continues from the path and symbol name. It is not treated as a current-state match.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path

from app.modules.git_history.objects import blob_at_revision
from app.modules.repository.paths import normalize_target_path
from app.modules.symbol_resolution.validation import validate_line_range, validate_symbol

RESOLVED = "RESOLVED"
AMBIGUOUS = "AMBIGUOUS"
NOT_IN_CURRENT_STATE = "NOT_IN_CURRENT_STATE"
PARSE_FAILED = "PARSE_FAILED"
PATH_NOT_FOUND = "PATH_NOT_FOUND"
UNSUPPORTED_LANGUAGE = "UNSUPPORTED_LANGUAGE"

TARGET_AMBIGUOUS = "TARGET_AMBIGUOUS"
TARGET_NOT_IN_CURRENT_STATE = "TARGET_NOT_IN_CURRENT_STATE"
TARGET_PARSE_FAILED = "TARGET_PARSE_FAILED"

_STATUS_CODES = {
    AMBIGUOUS: TARGET_AMBIGUOUS,
    NOT_IN_CURRENT_STATE: TARGET_NOT_IN_CURRENT_STATE,
    PARSE_FAILED: TARGET_PARSE_FAILED,
}

_FALLBACK_STATUSES = frozenset({NOT_IN_CURRENT_STATE, PATH_NOT_FOUND})


@dataclass(frozen=True)
class Definition:
    qualified_name: str
    kind: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class SymbolResolution:
    status: str
    code: str | None
    definition: Definition | None
    candidates: tuple[Definition, ...]
    historical_fallback: bool


def _collect(body: list[ast.stmt], prefix: str, found: list[Definition]) -> None:
    for node in body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            name = prefix + node.name
            start = min([node.lineno, *(decorator.lineno for decorator in node.decorator_list)])
            kind = {ast.FunctionDef: "function", ast.AsyncFunctionDef: "async_function", ast.ClassDef: "class"}[
                type(node)
            ]
            found.append(Definition(name, kind, start, node.end_lineno or node.lineno))
            if isinstance(node, ast.ClassDef):
                _collect(node.body, name + ".", found)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for target in targets:
                if isinstance(target, ast.Name):
                    found.append(
                        Definition(prefix + target.id, "assignment", node.lineno, node.end_lineno or node.lineno)
                    )
        elif isinstance(node, ast.If):
            _collect(node.body, prefix, found)
            _collect(node.orelse, prefix, found)
        elif isinstance(node, ast.Try):
            _collect(node.body, prefix, found)
            for handler in node.handlers:
                _collect(handler.body, prefix, found)
            _collect(node.orelse, prefix, found)
            _collect(node.finalbody, prefix, found)
        elif isinstance(node, ast.With):
            _collect(node.body, prefix, found)


def _matches(definition: Definition, symbol: str) -> bool:
    if "." in symbol:
        return definition.qualified_name == symbol
    return definition.qualified_name.rsplit(".", 1)[-1] == symbol


def _result(status: str, definition: Definition | None = None, candidates: tuple[Definition, ...] = ()) -> SymbolResolution:
    return SymbolResolution(
        status=status,
        code=_STATUS_CODES.get(status),
        definition=definition,
        candidates=candidates,
        historical_fallback=status in _FALLBACK_STATUSES,
    )


def resolve_symbol(
    repo_root: Path,
    path: str,
    symbol: str,
    line_start: int | None = None,
    line_end: int | None = None,
) -> SymbolResolution:
    """Resolve a symbol in the file at HEAD. Input is validated before any Git call.

    Raises PathError for an invalid path and InvalidInput for an invalid symbol or line range (see the validators).
    """
    normalized = normalize_target_path(path)
    checked_symbol = validate_symbol(symbol)
    line_range = validate_line_range(line_start, line_end)

    if not normalized.endswith(".py"):
        return SymbolResolution(UNSUPPORTED_LANGUAGE, None, None, (), False)
    source = blob_at_revision(repo_root, "HEAD", normalized)
    if source is None:
        return _result(PATH_NOT_FOUND)

    try:
        tree = ast.parse(source, filename=normalized)
    except (SyntaxError, ValueError, RecursionError, MemoryError):
        return _result(PARSE_FAILED)

    definitions: list[Definition] = []
    _collect(tree.body, "", definitions)
    matches = [definition for definition in definitions if _matches(definition, checked_symbol)]
    if line_range is not None:
        low, high = line_range
        matches = [definition for definition in matches if definition.start_line <= high and definition.end_line >= low]
    matches.sort(key=lambda definition: (definition.start_line, definition.qualified_name))

    if not matches:
        return _result(NOT_IN_CURRENT_STATE)
    if len(matches) > 1:
        return _result(AMBIGUOUS, candidates=tuple(matches))
    return _result(RESOLVED, definition=matches[0])
