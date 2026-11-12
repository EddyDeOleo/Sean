"""Successful get_pr and get_issue retrieval through the MCP tool layer (I6; D02 MCP-13, MCP-16; DEC-15).

A canned opener replaces the network. The GitHub client validates the response with the real code. No network access.
"""

from __future__ import annotations

import json
import socket
from datetime import UTC, datetime

import pytest

from app.modules.github.client import GitHubClient
from app.modules.mcp import tools as _tools
from app.modules.mcp.tools import McpToolError
from app.modules.repository.registry import GitHubIdentity, LoadedRegistry, RegistryEntry

REPOSITORY_ID = "sample"
IDENTITY = GitHubIdentity(owner="octo", name="repo")
TOKEN = "ghp_mcp_success_probe_token_0123456789"
FULL_SHA = "a" * 40


def _pull(number: int = 42, full_name: str = "octo/repo") -> dict:
    return {
        "number": number,
        "title": "Fix the thing",
        "created_at": "2024-01-02T03:04:05Z",
        "merged_at": "2024-01-03T00:00:00Z",
        "closed_at": "2024-01-03T00:00:00Z",
        "merge_commit_sha": FULL_SHA,
        "html_url": f"https://github.com/{full_name}/pull/{number}",
        "user": {"login": "someone"},
        "base": {"repo": {"full_name": full_name}},
    }


def _issue(number: int = 7, repository: str = "octo/repo") -> dict:
    return {
        "number": number,
        "title": "Bug report",
        "created_at": "2024-02-01T10:00:00Z",
        "html_url": f"https://github.com/{repository}/issues/{number}",
        "repository_url": f"https://api.github.com/repos/{repository}",
        "user": {"login": "reporter", "name": "Jane Doe"},
    }


class _CannedResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body
        self._sent = False
        self.headers: dict[str, str] = {}

    def __enter__(self) -> _CannedResponse:
        return self

    def __exit__(self, *exc_info) -> None:
        return None

    def read1(self, size: int) -> bytes:
        if self._sent:
            return b""
        self._sent = True
        return self._body


class _CannedOpener:
    def __init__(self, document: dict) -> None:
        self._body = json.dumps(document).encode("utf-8")
        self.urls: list[str] = []

    def open(self, request, timeout):
        # The token may travel only to the GitHub API host (security.md, Credentials and Secrets).
        assert request.host == "api.github.com", f"unexpected request host in a unit test: {request.host}"
        self.urls.append(request.full_url)
        return _CannedResponse(self._body)


def _registry(root) -> LoadedRegistry:
    entry = RegistryEntry(repository_id=REPOSITORY_ID, root=str(root), github=IDENTITY)
    return LoadedRegistry(entries={REPOSITORY_ID: entry}, problems=())


def _use(monkeypatch: pytest.MonkeyPatch, document: dict) -> _CannedOpener:
    opener = _CannedOpener(document)
    monkeypatch.setattr(_tools, "GitHubClient", lambda *args, **kwargs: GitHubClient(opener=opener))
    return opener


@pytest.fixture
def registry(make_repo):
    return _registry(make_repo().path)


@pytest.fixture(autouse=True)
def _no_ambient_token_and_no_sockets(monkeypatch: pytest.MonkeyPatch) -> None:
    """The fake token is the only credential in scope. Any socket or name lookup fails the test."""
    monkeypatch.setenv("SEAN_GITHUB_TOKEN", TOKEN)

    def refuse(*args, **kwargs):
        raise AssertionError("network access in a unit test")

    monkeypatch.setattr(socket, "socket", refuse)
    monkeypatch.setattr(socket, "create_connection", refuse)
    monkeypatch.setattr(socket, "getaddrinfo", refuse)


def test_get_pr_success_returns_one_pull_request_item(registry, monkeypatch) -> None:
    opener = _use(monkeypatch, _pull())
    result = _tools.get_pr(registry, REPOSITORY_ID, "42")
    assert result["retrieval_status"] == "COMPLETE"
    assert result["limitations"] == []
    assert len(result["evidence"]) == 1
    item = result["evidence"][0]
    assert item["source_type"] == "PULL_REQUEST"
    assert item["source_id"] == "42"
    assert item["title"] == "Fix the thing"
    assert opener.urls == ["https://api.github.com/repos/octo/repo/pulls/42"]


def test_get_issue_success_returns_one_issue_item(registry, monkeypatch) -> None:
    opener = _use(monkeypatch, _issue())
    result = _tools.get_issue(registry, REPOSITORY_ID, "7")
    assert result["retrieval_status"] == "COMPLETE"
    assert len(result["evidence"]) == 1
    assert result["evidence"][0]["source_type"] == "ISSUE"
    assert result["evidence"][0]["source_id"] == "7"
    assert opener.urls == ["https://api.github.com/repos/octo/repo/issues/7"]


def test_leading_zeros_are_canonicalized_before_the_request(registry, monkeypatch) -> None:
    """DEC-15: '007' is accepted and normalized to canonical decimal form before the request is built."""
    opener = _use(monkeypatch, _pull(number=7))
    result = _tools.get_pr(registry, REPOSITORY_ID, "007")
    assert opener.urls == ["https://api.github.com/repos/octo/repo/pulls/7"]
    assert result["evidence"][0]["source_id"] == "7"


def test_mcp_result_matches_the_shared_client_for_the_same_record(registry, monkeypatch) -> None:
    """MCP-16 for GitHub: the MCP tool and the shared client return the same identity and content."""
    _use(monkeypatch, _pull())
    mcp_item = _tools.get_pr(registry, REPOSITORY_ID, "42")["evidence"][0]
    shared = GitHubClient(opener=_CannedOpener(_pull())).get_pull_request(
        REPOSITORY_ID, IDENTITY, "42", retrieved_at=datetime(2026, 11, 10, tzinfo=UTC)
    )
    assert mcp_item["source_id"] == shared.source_id
    assert mcp_item["source_type"] == shared.source_type.value
    assert mcp_item["title"] == shared.title
    assert mcp_item["source_url"] == (str(shared.source_url) if shared.source_url else None)


def test_successful_github_output_carries_no_classification_or_token(registry, monkeypatch) -> None:
    _use(monkeypatch, _pull())
    text = json.dumps(_tools.get_pr(registry, REPOSITORY_ID, "42"))
    assert "epistemic_classification" not in text
    assert "conclusion" not in text
    assert "explanation" not in text
    assert TOKEN not in text


def test_github_record_for_another_repository_is_not_returned(registry, monkeypatch) -> None:
    _use(monkeypatch, _pull(full_name="other/repo"))
    with pytest.raises(McpToolError) as raised:
        _tools.get_pr(registry, REPOSITORY_ID, "42")
    body = raised.value.to_dict()
    assert body["error"] == "GITHUB_IDENTITY_MISMATCH"
    assert "evidence" not in body
