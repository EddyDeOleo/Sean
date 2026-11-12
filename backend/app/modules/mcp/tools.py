"""MCP tool logic (Task 17.2; Requirement 13; D02 §16.4 to §16.7).

The four approved tools are thin adapters over the existing modules:
- search_history -> investigation orchestrator (evidence, ranking, retrieval status, limitations).
- blame_range -> git_history.blame.
- get_pr, get_issue -> github.client.GitHubClient.

Output contract (Requirement 13.6): evidence records, a retrieval status, ranking, limitations, and source references only.
No epistemic classification, conclusion, or explanation is returned by any MCP tool.

Error contract: every failure is an McpToolError with a fixed code and a fixed message. No exception text, path, token, or
request value is included.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.core.git_runner import GitError
from app.core.limits import MCP_BLAME_SPAN_LINES, MCP_MAX_RESULTS_DEFAULT, MCP_MAX_RESULTS_LIMIT
from app.modules.evidence.identity import is_positive_decimal
from app.modules.git_history.blame import BlameError, blame_range
from app.modules.github.client import GitHubClient, GitHubError
from app.modules.investigation.orchestrator import RequestError, investigate
from app.modules.investigation.classification import RetrievalStatus
from app.modules.repository.paths import PathError
from app.modules.repository.registry import (
    GITHUB_IDENTITY_UNRESOLVED,
    LoadedRegistry,
    RepositoryError,
    resolve_github_identity,
    resolve_repository,
)
from app.modules.symbol_resolution.validation import InvalidInput

# MCP bounds are defined once in app.core.limits (D02 §16.6 proposed; OD-5 V5 and V9; not owner-approved).
BLAME_SPAN_LIMIT = MCP_BLAME_SPAN_LINES
MAX_RESULTS_DEFAULT = MCP_MAX_RESULTS_DEFAULT
MAX_RESULTS_LIMIT = MCP_MAX_RESULTS_LIMIT
# Limitation code for a caller-requested result bound with more matching evidence beyond it (owner decision, 2026-11-12).
RESULT_LIMIT_REACHED = "RESULT_LIMIT_REACHED"

_MESSAGES = {
    "INVALID_INPUT": "The request is invalid.",
    "REPOSITORY_NOT_FOUND": "The repository identifier is not registered.",
    "REPOSITORY_UNAVAILABLE": "The registered repository is not available.",
    "PATH_OUTSIDE_REPOSITORY": "The path is outside the repository.",
    "TARGET_AMBIGUOUS": "The target matches more than one definition.",
    "TARGET_PARSE_FAILED": "The source file could not be parsed for symbol resolution.",
    "REVISION_NOT_FOUND": "The revision is not a commit in the repository.",
    "PATH_NOT_FOUND": "The path is not a file at the requested revision.",
    "GIT_FAILED": "Git retrieval failed.",
    "GIT_TIMEOUT": "Git retrieval timed out.",
    "OUTPUT_LIMIT_EXCEEDED": "Git output exceeded the configured bound.",
    "GITHUB_NOT_FOUND_OR_INACCESSIBLE": "The GitHub record was not found or is not accessible. This is not proof that it does not exist.",
    "GITHUB_UNAVAILABLE": "The GitHub record could not be retrieved.",
    "GITHUB_RATE_LIMITED": "The GitHub rate limit was reached.",
    "GITHUB_IDENTITY_MISMATCH": "The GitHub record does not belong to the registered repository.",
    "GITHUB_IDENTITY_UNRESOLVED": "The repository has no explicit GitHub identity in the registry.",
}


class McpToolError(Exception):
    """A structured tool failure. The message is the fixed text for the code. Nothing else is carried."""

    def __init__(self, code: str, *, retryable: bool | None = None, **extra: Any) -> None:
        super().__init__(code)
        self.code = code
        # The caller may state the cause-specific value (for example OD-7 and OD-8). Otherwise the code decides.
        self.retryable = code in {"GIT_TIMEOUT", "GITHUB_UNAVAILABLE", "GITHUB_RATE_LIMITED"} if retryable is None else retryable
        self.extra = extra

    def to_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {"error": self.code, "message": _MESSAGES.get(self.code, "The request failed."), "retryable": self.retryable}
        body.update(self.extra)
        return body


def _require_text(value: object) -> str:
    if not isinstance(value, str) or not value:
        raise McpToolError("INVALID_INPUT", field="repository_id")
    return value


def _resolve(registry: LoadedRegistry, repository_id: object):
    try:
        return resolve_repository(registry, _require_text(repository_id))
    except RepositoryError as error:
        raise McpToolError(str(error)) from None


def _plain_item(item) -> dict[str, Any]:
    return item.model_dump(mode="json")


def _bounded_max_results(value: object) -> int:
    if value is None:
        return MAX_RESULTS_DEFAULT
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= MAX_RESULTS_LIMIT:
        raise McpToolError("INVALID_INPUT", field="max_results")
    return value


def search_history(
    registry: LoadedRegistry,
    repository_id: str,
    path: str,
    symbol: str | None = None,
    line_start: int | None = None,
    line_end: int | None = None,
    max_results: int | None = None,
) -> dict[str, Any]:
    """Evidence, ranking, retrieval status, and limitations for a path or symbol. No classification or conclusion."""
    limit = _bounded_max_results(max_results)
    _resolve(registry, repository_id)
    if not isinstance(path, str) or not path:
        raise McpToolError("INVALID_INPUT", field="path")
    try:
        result = investigate(registry, repository_id, path, symbol=symbol, line_start=line_start, line_end=line_end)
    except RequestError as error:
        extra = {"candidates": list(error.candidates)} if error.candidates else {}
        raise McpToolError(error.code, **extra) from None
    except (InvalidInput, PathError):
        raise McpToolError("INVALID_INPUT", field="path") from None
    if result.retrieval_status is RetrievalStatus.FAILED:
        error = result.error
        return {
            "retrieval_status": "FAILED",
            "error": {"code": error.code, "retryable": error.retryable} if error else None,
            "evidence": [],
            "ranking": [],
            "limitations": [],
            "source_references": [],
        }
    limitations = [{"code": lim.code, "scope": lim.scope} for lim in result.limitations]
    # The caller's max_results is a presentation bound. It never changes the status, the classification, or the evidence
    # content. It is declared only when matching evidence exists beyond the returned maximum (owner decision, 2026-11-12).
    if len(result.evidence) > limit:
        limitations.append({"code": RESULT_LIMIT_REACHED, "scope": "results"})
    return {
        "retrieval_status": result.retrieval_status.value,
        "evidence": [_plain_item(item) for item in result.evidence[:limit]],
        "ranking": [{"evidence_id": entry.evidence_id, "score": entry.score} for entry in result.ranking[:limit]],
        "limitations": limitations,
        "source_references": [
            {"evidence_id": ref.evidence_id, "source_type": ref.source_type, "source_id": ref.source_id, "source_url": ref.source_url}
            for ref in result.source_references[:limit]
        ],
    }


def blame_range_tool(
    registry: LoadedRegistry,
    repository_id: str,
    path: str,
    line_start: int,
    line_end: int,
    revision: str | None = None,
) -> dict[str, Any]:
    """Blame for a path and line range. The revision is a full object name, or HEAD when omitted (DEC-14)."""
    root = _resolve(registry, repository_id).root
    if not isinstance(line_start, int) or isinstance(line_start, bool) or not isinstance(line_end, int) or isinstance(line_end, bool):
        raise McpToolError("INVALID_INPUT", field="line_start")
    if line_end - line_start + 1 > BLAME_SPAN_LIMIT or line_end < line_start:
        raise McpToolError("INVALID_INPUT", field="line_end")
    try:
        result = blame_range(root, repository_id, path, line_start, line_end, revision=revision)
    except BlameError as error:
        raise McpToolError(str(error)) from None
    except PathError as error:
        # Keeps the code the path layer chose: INVALID_INPUT for lexical rejection, PATH_OUTSIDE_REPOSITORY for a link.
        raise McpToolError(str(error), field="path") from None
    except InvalidInput:
        # Raised by the line-range validator, so the error names the line field.
        raise McpToolError("INVALID_INPUT", field="line_start") from None
    except GitError as error:
        raise McpToolError(str(error)) from None
    except (UnicodeDecodeError, ValueError):
        # Git output that does not decode or parse is a retrieval failure. The message is the code only.
        raise McpToolError("GIT_FAILED") from None
    return {
        "revision": result.revision,
        "evidence": [_plain_item(item) for item in result.items],
        "limitations": [{"code": code} for code in result.limitations],
    }


def _github_record(registry: LoadedRegistry, repository_id: str, number: object, kind: str) -> dict[str, Any]:
    """Shared path for get_pr and get_issue. The number is a positive decimal string (D9). JSON integers are rejected."""
    resolved = _resolve(registry, repository_id)
    if not isinstance(number, str) or not is_positive_decimal(number):
        raise McpToolError("INVALID_INPUT", field="number")
    try:
        identity = resolve_github_identity(registry, repository_id)
    except RepositoryError as error:
        raise McpToolError(str(error)) from None
    if identity is None:
        raise McpToolError(GITHUB_IDENTITY_UNRESOLVED)
    client = GitHubClient()
    now = datetime.now(UTC).replace(microsecond=0)
    try:
        if kind == "pull_request":
            item = client.get_pull_request(resolved.repository_id, identity, number, retrieved_at=now)
        else:
            item = client.get_issue(resolved.repository_id, identity, number, retrieved_at=now)
    except GitHubError as error:
        raise McpToolError(str(error), retryable=error.retryable) from None
    return {"retrieval_status": "COMPLETE", "evidence": [_plain_item(item)], "limitations": []}


def get_pr(registry: LoadedRegistry, repository_id: str, number: str) -> dict[str, Any]:
    """Validated pull request metadata for the registered repository."""
    return _github_record(registry, repository_id, number, "pull_request")


def get_issue(registry: LoadedRegistry, repository_id: str, number: str) -> dict[str, Any]:
    """Validated issue metadata for the registered repository. Pull request numbers are rejected."""
    return _github_record(registry, repository_id, number, "issue")


TOOL_NAMES = ("search_history", "blame_range", "get_pr", "get_issue")
