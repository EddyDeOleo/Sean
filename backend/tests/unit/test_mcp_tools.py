"""MCP tool logic tests (Task 17.2; Requirement 13). Temporary repositories and fakes only. No network access."""

from __future__ import annotations

import json

import pytest

from app.modules.github.client import GITHUB_UNAVAILABLE, GitHubError
from app.modules.mcp import tools as _tools
from app.modules.mcp.tools import McpToolError
from app.modules.repository.registry import GitHubIdentity, LoadedRegistry, RegistryEntry


def _as_server_result(function):
    """Return the same structured body the MCP server returns when a tool raises McpToolError."""

    def call(*args, **kwargs):
        try:
            return function(*args, **kwargs)
        except McpToolError as error:
            return error.to_dict()

    return call


class _ServerView:
    """Read and write the tool module. Callables return server-shaped results. Other attributes pass through."""

    def __init__(self, module) -> None:
        object.__setattr__(self, "_module", module)

    def __getattr__(self, name: str):
        value = getattr(self._module, name)
        if callable(value) and not isinstance(value, type):
            return _as_server_result(value)
        return value




tools = _ServerView(_tools)

REPOSITORY_ID = "sample"
SECRET = "ghp_mcp_test_secret_value_0123456789"


def _registry(root, github: GitHubIdentity | None = None) -> LoadedRegistry:
    return LoadedRegistry(
        entries={REPOSITORY_ID: RegistryEntry(repository_id=REPOSITORY_ID, root=str(root), github=github)},
        problems=(),
    )


@pytest.fixture
def repo(make_repo):
    fixture = make_repo()
    fixture.write("src/a.py", "def target():\n    return 1\n")
    fixture.commit("add target")
    fixture.write("src/a.py", "def target():\n    return 2\n")
    fixture.commit("change target")
    return fixture


@pytest.fixture
def registry(repo) -> LoadedRegistry:
    return _registry(repo.path, GitHubIdentity(owner="octo", name="repo"))


def test_search_history_returns_evidence_status_and_limitations_only(registry, repo) -> None:
    result = tools.search_history(registry, REPOSITORY_ID, "src/a.py", symbol="target")
    assert result["retrieval_status"] == "COMPLETE"
    assert result["evidence"]
    assert "ASSOCIATION_NOT_IMPLEMENTED" in {limit["code"] for limit in result["limitations"]}
    # Requirement 13.6: no classification and no conclusion from any MCP tool.
    text = json.dumps(result)
    assert "epistemic_classification" not in text
    assert "conclusion" not in text
    assert str(repo.path) not in text


def test_search_history_respects_max_results(registry) -> None:
    result = tools.search_history(registry, REPOSITORY_ID, "src/a.py", max_results=1)
    assert len(result["evidence"]) == 1


@pytest.mark.parametrize("bad", [0, 51, True, "5", 1.5])
def test_max_results_is_validated(registry, bad) -> None:
    result = tools.search_history(registry, REPOSITORY_ID, "src/a.py", max_results=bad)
    assert result == {"error": "INVALID_INPUT", "message": "The request is invalid.", "retryable": False, "field": "max_results"}


def test_unknown_repository_is_a_structured_error(registry) -> None:
    result = tools.search_history(registry, "missing", "src/a.py")
    assert result["error"] == "REPOSITORY_NOT_FOUND"


@pytest.mark.parametrize("path", ["../escape.py", "/abs.py", "a/../b.py", ""])
def test_invalid_path_is_structured_invalid_input(registry, path: str) -> None:
    result = tools.search_history(registry, REPOSITORY_ID, path)
    assert result["error"] == "INVALID_INPUT"


def test_ambiguous_target_carries_candidates(make_repo) -> None:
    fixture = make_repo()
    fixture.write("src/a.py", "class A:\n    def run(self):\n        return 1\n\nclass B:\n    def run(self):\n        return 2\n")
    fixture.commit("two runs")
    result = tools.search_history(_registry(fixture.path), REPOSITORY_ID, "src/a.py", symbol="run")
    assert result["error"] == "TARGET_AMBIGUOUS"
    assert result["candidates"] == ["A.run", "B.run"]


def test_failed_retrieval_is_a_status_not_a_tool_error(registry, monkeypatch) -> None:
    from app.core.git_runner import GIT_TIMEOUT, GitError
    from app.modules.investigation import orchestrator

    def fail(*args, **kwargs):
        raise GitError(GIT_TIMEOUT)

    monkeypatch.setattr(orchestrator, "retrieve_history", fail)
    result = tools.search_history(registry, REPOSITORY_ID, "src/a.py")
    assert result["retrieval_status"] == "FAILED"
    assert result["evidence"] == []
    assert result["error"]["code"] == GIT_TIMEOUT


def test_blame_range_returns_evidence_and_revision(registry, repo) -> None:
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 1, 2)
    assert "revision" in result and len(result["revision"]) == 40
    assert result["evidence"]
    assert all(item["source_type"] == "GIT_BLAME" for item in result["evidence"])


def test_blame_span_over_the_limit_is_rejected(registry) -> None:
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 1, tools.BLAME_SPAN_LIMIT + 1)
    assert result["error"] == "INVALID_INPUT"


@pytest.mark.parametrize("revision", ["main", "HEAD", "abc1234"])
def test_blame_rejects_non_full_revisions(registry, revision: str) -> None:
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 1, 1, revision=revision)
    assert result["error"] == "INVALID_INPUT"


def test_blame_missing_path_is_path_not_found(registry) -> None:
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/missing.py", 1, 1)
    assert result["error"] == "PATH_NOT_FOUND"


@pytest.mark.parametrize("number", [42, "0", "abc", "-1", "", None, "1.5"])
def test_github_numbers_must_be_positive_decimal_strings(registry, number) -> None:
    """D9 identity rule. JSON integers are rejected (MCP number schema is a string)."""
    assert tools.get_pr(registry, REPOSITORY_ID, number)["error"] == "INVALID_INPUT"
    assert tools.get_issue(registry, REPOSITORY_ID, number)["error"] == "INVALID_INPUT"


def test_github_tool_without_identity_is_a_structured_error(repo) -> None:
    result = tools.get_pr(_registry(repo.path), REPOSITORY_ID, "42")
    assert result["error"] == "GITHUB_IDENTITY_UNRESOLVED"


class _UnavailableClient:
    """Stands in for the GitHub client. It never touches the network."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    def get_pull_request(self, *args, **kwargs):
        raise GitHubError(GITHUB_UNAVAILABLE)

    def get_issue(self, *args, **kwargs):
        raise GitHubError(GITHUB_UNAVAILABLE)


def test_github_unavailable_is_structured_and_retryable(registry, monkeypatch) -> None:
    monkeypatch.setattr(_tools, "GitHubClient", _UnavailableClient)
    result = tools.get_pr(registry, REPOSITORY_ID, "42")
    assert result == {
        "error": GITHUB_UNAVAILABLE,
        "message": "The GitHub record could not be retrieved.",
        "retryable": True,
    }


def test_no_secret_appears_in_a_tool_error(registry, monkeypatch) -> None:
    monkeypatch.setenv("SEAN_GITHUB_TOKEN", SECRET)
    monkeypatch.setattr(_tools, "GitHubClient", _UnavailableClient)
    text = json.dumps(tools.get_issue(registry, REPOSITORY_ID, "7"))
    assert SECRET not in text


@pytest.mark.parametrize(("span", "rejected"), [(499, False), (500, False), (501, True)], ids=["499", "500", "501"])
def test_mcp_blame_span_boundary(registry, span: int, rejected: bool) -> None:
    """The MCP public bound is 500 lines. 501 is rejected by the tool before the core runs. 499 and 500 are not rejected
    by the tool. A short fixture file may still fail inside Git, and that is a different result."""
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 1, span)
    if rejected:
        assert result["error"] == "INVALID_INPUT"
        assert result.get("field") == "line_end"
    else:
        assert result.get("field") != "line_end"


def test_blame_containment_failure_returns_its_path_field_and_never_runs_git(registry, monkeypatch) -> None:
    """A traversal path is refused before any Git call. The error keeps its own code and names the path field."""
    from app.modules.git_history import blame

    def must_not_run(*args, **kwargs):
        raise AssertionError("Git must not run when containment fails")

    monkeypatch.setattr(blame, "run_git", must_not_run)
    monkeypatch.setattr(blame, "resolve_revision", must_not_run)
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "../outside.py", 1, 1)
    assert result["error"] == "INVALID_INPUT"
    assert result.get("field") == "path"


def test_blame_line_range_error_names_the_line_field(registry) -> None:
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 2, 1)
    assert result["error"] == "INVALID_INPUT"
    assert result.get("field") == "line_end"


def test_blame_undecodable_git_output_is_a_structured_retrieval_failure(registry, monkeypatch) -> None:
    """Git output that does not decode must not escape as a raw exception. It is reported as GIT_FAILED with no text."""
    def undecodable(*args, **kwargs):
        raise UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid start byte")

    # Patch the module itself. The test wrapper `tools` only converts results and does not own blame_range.
    monkeypatch.setattr(_tools, "blame_range", undecodable)
    result = tools.blame_range_tool(registry, REPOSITORY_ID, "src/a.py", 1, 1)
    assert result["error"] == "GIT_FAILED"
    assert "invalid start byte" not in str(result)


class _NonRetryableClient:
    """Stands in for the GitHub client. A redirect or an oversize body raises a non-retryable failure (OD-7, OD-8)."""

    def __init__(self, *args, **kwargs) -> None:
        pass

    def get_pull_request(self, *args, **kwargs):
        raise GitHubError(GITHUB_UNAVAILABLE, retryable=False)

    get_issue = get_pull_request


def test_github_redirect_or_oversize_is_not_retryable_through_mcp(registry, monkeypatch) -> None:
    """OD-7 and OD-8: GITHUB_UNAVAILABLE with retryable false. The MCP body carries the cause-specific value."""
    monkeypatch.setattr(_tools, "GitHubClient", _NonRetryableClient)
    result = tools.get_pr(registry, REPOSITORY_ID, "42")
    assert result["error"] == GITHUB_UNAVAILABLE
    assert result["retryable"] is False


def test_caller_limit_declared_only_when_evidence_exists_beyond_the_bound(make_repo) -> None:
    """Owner decision 2026-11-12. Exactly as many items as the bound: no declaration. One fewer: declared."""
    fixture = make_repo()
    fixture.write("src/a.py", "x = 1\n")
    fixture.commit("one")
    fixture.write("src/a.py", "x = 2\n")
    fixture.commit("two")
    unlimited = tools.search_history(_registry(fixture.path), REPOSITORY_ID, "src/a.py", max_results=50)
    count = len(unlimited["evidence"])
    assert count >= 2, "the fixture must produce at least two evidence items"
    assert "RESULT_LIMIT_REACHED" not in [lim["code"] for lim in unlimited["limitations"]]

    at_bound = tools.search_history(_registry(fixture.path), REPOSITORY_ID, "src/a.py", max_results=count)
    assert "RESULT_LIMIT_REACHED" not in [lim["code"] for lim in at_bound["limitations"]]
    assert at_bound["retrieval_status"] == unlimited["retrieval_status"]

    below = tools.search_history(_registry(fixture.path), REPOSITORY_ID, "src/a.py", max_results=count - 1)
    assert {"code": "RESULT_LIMIT_REACHED", "scope": "results"} in below["limitations"]
    assert below["retrieval_status"] == unlimited["retrieval_status"], "a presentation bound must not change the status"
    assert len(below["evidence"]) == count - 1


def test_internal_scan_truncation_stays_partial_and_is_not_a_result_limit(make_repo, monkeypatch) -> None:
    """An internal processing limit that prevents completion reports PARTIAL with its own limitation. It is not
    misreported as the caller-requested bound."""
    from app.modules.investigation import orchestrator

    fixture = make_repo()
    for version in range(3):
        fixture.write("src/a.py", f"x = {version}\n")
        fixture.commit(f"change {version}")
    real_retrieve = orchestrator.retrieve_history

    def scan_limited(*args, **kwargs):
        kwargs["scan_limit"] = 1
        return real_retrieve(*args, **kwargs)

    monkeypatch.setattr(orchestrator, "retrieve_history", scan_limited)
    result = tools.search_history(_registry(fixture.path), REPOSITORY_ID, "src/a.py")
    assert result["retrieval_status"] == "PARTIAL"
    codes = [lim["code"] for lim in result["limitations"]]
    assert "COMMIT_SCAN_LIMIT_REACHED" in codes
    assert "RESULT_LIMIT_REACHED" not in codes
