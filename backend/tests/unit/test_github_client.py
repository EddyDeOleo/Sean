"""GitHub retrieval tests (Tasks 9.1 to 9.3).

A loopback HTTP server on 127.0.0.1 stands in for api.github.com. Tests that need it pass require_https=False, which is a
test seam. Production code never sets it. The HTTPS-only rule is tested separately. No test contacts GitHub.
"""

from __future__ import annotations

import http.server
import json
import os
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

import pytest

from app.modules.evidence.contract import SourceType, SourceVerification
from app.modules.github import client as github
from app.modules.github.client import (
    GITHUB_IDENTITY_MISMATCH,
    GITHUB_NOT_FOUND_OR_INACCESSIBLE,
    GITHUB_RATE_LIMITED,
    GITHUB_UNAVAILABLE,
    INVALID_INPUT,
    BODY_LIMIT_BYTES,
    GitHubClient,
    GitHubError,
    retrieval_limitation,
)
from app.modules.repository.registry import GitHubIdentity

RETRIEVED = datetime(2026, 11, 10, 12, 0, 0, tzinfo=UTC)
IDENTITY = GitHubIdentity(owner="octo", name="repo")
REPOSITORY_ID = "sample"
FULL_SHA = "a" * 40


def _pull(number: int = 42, full_name: str = "octo/repo") -> dict[str, Any]:
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


def _issue(number: int = 7, repository: str = "octo/repo") -> dict[str, Any]:
    return {
        "number": number,
        "title": "Bug report",
        "created_at": "2024-02-01T10:00:00Z",
        "html_url": f"https://github.com/{repository}/issues/{number}",
        "repository_url": f"https://api.github.com/repos/{repository}",
        "user": {"login": "reporter", "name": "Jane Doe"},
    }


class _Server:
    """Serves canned responses by path and records every request it receives."""

    def __init__(self, routes: dict[str, Callable[[], tuple[int, dict[str, str], bytes]]]) -> None:
        self.routes = routes
        self.requests: list[dict[str, str]] = []
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args, **kwargs):  # silence the default log
                return

            def do_GET(self) -> None:  # noqa: N802 - http.server naming
                outer.requests.append({"path": self.path, **{k.lower(): v for k, v in self.headers.items()}})
                handler = outer.routes.get(self.path, lambda: (404, {}, b"{}"))
                status, headers, body = handler()
                self.send_response(status)
                for key, value in headers.items():
                    self.send_header(key, value)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                try:
                    self.wfile.write(body)
                except (BrokenPipeError, ConnectionResetError):
                    return

        self.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.httpd.daemon_threads = True
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base(self) -> str:
        host, port = self.httpd.server_address[:2]
        return f"http://{host}:{port}"

    def close(self) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


@pytest.fixture
def server():
    created: list[_Server] = []

    def _make(routes):
        instance = _Server(routes)
        created.append(instance)
        return instance

    yield _make
    for instance in created:
        instance.close()


def _json(document: Any, status: int = 200, headers: dict[str, str] | None = None):
    return lambda: (status, headers or {}, json.dumps(document).encode())


def _client(base: str, **keyword_arguments) -> GitHubClient:
    return GitHubClient(token="", require_https=False, base_url=base, **keyword_arguments)


# ---------- Task 9.1: retrieval and transport ----------


def test_pull_request_becomes_validated_evidence(server) -> None:
    """Task 9.1 and 9.2: a PR from the registered repository becomes PULL_REQUEST evidence."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})

    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)

    assert item.source_type is SourceType.PULL_REQUEST
    assert item.source_id == "42"
    assert item.integrity.source_verification is SourceVerification.VALIDATED_RECORD_IDENTITY
    assert item.timestamp == datetime(2024, 1, 2, 3, 4, 5, tzinfo=UTC)
    assert item.commit_hash == FULL_SHA
    assert item.event_timestamps is not None
    assert item.repository_namespace == REPOSITORY_ID
    assert "author" in item.unavailable_fields  # login only, no display name (OD-12)
    assert "relationship" in item.unavailable_fields


def test_issue_uses_display_name_and_marks_commit_unavailable(server) -> None:
    """Task 9.1: an issue has no commit. Its author is the display name when one is present (OD-12)."""
    srv = server({"/repos/octo/repo/issues/7": _json(_issue())})

    item = _client(srv.base).get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)

    assert item.source_type is SourceType.ISSUE
    assert item.author == "Jane Doe"
    assert item.commit_hash is None
    assert "commit_hash" in item.unavailable_fields


def test_leading_zeros_are_canonical_in_the_request_path(server) -> None:
    """Task 9.1: "0042" is requested as 42 and recorded as 42."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})

    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "0042", retrieved_at=RETRIEVED)

    assert item.source_id == "42"
    assert srv.requests[0]["path"] == "/repos/octo/repo/pulls/42"


@pytest.mark.parametrize("number", ["0", "-1", "1.5", "abc", "", "+3", " 4"])
def test_invalid_numbers_are_rejected_before_any_request(server, number: str) -> None:
    """Task 2.3 applied to GitHub input: a non-positive-decimal number never reaches the network."""
    srv = server({})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, number, retrieved_at=RETRIEVED)
    assert str(raised.value) == INVALID_INPUT
    assert srv.requests == []


def test_redirects_are_refused_and_the_target_is_never_requested(server) -> None:
    """Requirement 16 and E-D8: a redirect is a failure. The Location target receives no request."""
    target = server({"/repos/octo/repo/pulls/42": _json(_pull())})
    origin = server(
        {"/repos/octo/repo/pulls/42": lambda: (301, {"Location": f"{target.base}/repos/octo/repo/pulls/42"}, b"")}
    )

    with pytest.raises(GitHubError) as raised:
        _client(origin.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)

    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert raised.value.retryable is False, "OD-7: a redirect is a non-retryable failure"
    assert target.requests == []


def test_oversize_body_is_rejected(server) -> None:
    """Requirement 16.1, R11, and OD-8 (approved 2026-11-12): a body over 1 MiB fails with GITHUB_UNAVAILABLE, and the
    failure is not retryable. Both the code and retryable == False are asserted."""
    padded = lambda: (200, {}, b"{" + b" " * (BODY_LIMIT_BYTES + 10) + b"}")  # noqa: E731
    srv = server({"/repos/octo/repo/pulls/42": padded})

    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)

    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert raised.value.code == GITHUB_UNAVAILABLE
    assert raised.value.retryable is False


def test_stalled_response_fails_within_the_operation_timeout(server) -> None:
    """R9: the per-operation timeout stops a server that does not respond. No total deadline is claimed."""

    def stall():
        time.sleep(3)
        return 200, {}, b"{}"

    srv = server({"/repos/octo/repo/pulls/42": stall})
    started = time.monotonic()
    with pytest.raises(GitHubError) as raised:
        _client(srv.base, timeout_seconds=0.5).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)

    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert time.monotonic() - started < 2.5


def test_http_url_is_refused_before_any_request(server) -> None:
    """Transport contract: HTTPS only. A plain HTTP URL is refused before a request is sent."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})
    with pytest.raises(GitHubError) as raised:
        GitHubClient(token="", base_url=srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert srv.requests == []


def test_unreachable_host_is_reported_as_unavailable() -> None:
    """Task 9.3: a network failure is an unavailable result, not an absence claim."""
    with pytest.raises(GitHubError) as raised:
        _client("http://127.0.0.1:1").get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert raised.value.retryable is True, "a network failure stays retryable (R14 and OD-7/OD-8 scope)"


def test_environment_proxy_is_not_used(server, monkeypatch) -> None:
    """Transport contract: an environment proxy does not receive the request (empty proxy map)."""
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:1")
    monkeypatch.setenv("http_proxy", "http://127.0.0.1:1")
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})

    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)

    assert item.source_id == "42"
    assert len(srv.requests) == 1


def test_api_version_is_pinned_and_user_agent_is_sent(server) -> None:
    """OD-13 pin: every request names the pinned API version."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})
    _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert srv.requests[0]["x-github-api-version"] == "2022-11-28"
    assert srv.requests[0]["user-agent"] == "Sean"


# ---------- Token handling ----------


class _FakeResponse:
    def __init__(self, body: bytes) -> None:
        self._body = body
        self._sent = False
        self.headers: dict[str, str] = {}

    def read1(self, size: int) -> bytes:
        if self._sent:
            return b""
        self._sent = True
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc) -> None:
        return None


class _RecordingOpener:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.requests = []

    def open(self, request, timeout):
        self.requests.append(request)
        return _FakeResponse(self.body)


def test_token_is_sent_only_to_the_github_api_host_over_https() -> None:
    """The token is attached to https://api.github.com requests."""
    opener = _RecordingOpener(json.dumps(_pull()).encode())
    client = GitHubClient(token="secret-token-value", opener=opener)
    client.get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert opener.requests[0].get_header("Authorization") == "Bearer secret-token-value"


def test_token_is_not_sent_to_other_hosts(server) -> None:
    """The token is not attached to a loopback or any other host."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})
    _client(srv.base, timeout_seconds=2).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert "authorization" not in srv.requests[0]


def test_token_never_appears_in_errors(server) -> None:
    """Errors contain the code only, even when the token is configured."""
    srv = server({"/repos/octo/repo/pulls/42": lambda: (500, {}, b"{}")})
    with pytest.raises(GitHubError) as raised:
        GitHubClient(token="secret-token-value", require_https=False, base_url=srv.base).get_pull_request(
            REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED
        )
    assert "secret-token-value" not in str(raised.value)
    assert "secret-token-value" not in repr(raised.value)


def test_token_is_read_from_the_named_environment_variable(monkeypatch) -> None:
    monkeypatch.setenv(github.TOKEN_ENVIRONMENT_VARIABLE, "from-environment")
    opener = _RecordingOpener(json.dumps(_pull()).encode())
    GitHubClient(opener=opener).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert opener.requests[0].get_header("Authorization") == "Bearer from-environment"
    assert os.environ[github.TOKEN_ENVIRONMENT_VARIABLE] == "from-environment"


# ---------- Task 9.2: identity ----------


def test_pull_request_from_another_repository_is_a_mismatch(server) -> None:
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull(full_name="other/repo"))})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_IDENTITY_MISMATCH


def test_identity_comparison_is_case_insensitive(server) -> None:
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull(full_name="OCTO/Repo"))})
    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert item.source_id == "42"


def test_pull_request_with_a_different_number_is_a_mismatch(server) -> None:
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull(number=43))})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_IDENTITY_MISMATCH


def test_issue_endpoint_returning_a_pull_request_is_a_mismatch(server) -> None:
    """Issues endpoints may return pull requests, identified by the pull_request key."""
    document = _issue()
    document["pull_request"] = {"url": "https://api.github.com/repos/octo/repo/pulls/7"}
    srv = server({"/repos/octo/repo/issues/7": _json(document)})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_IDENTITY_MISMATCH


def test_issue_from_another_repository_is_a_mismatch(server) -> None:
    srv = server({"/repos/octo/repo/issues/7": _json(_issue(repository="other/repo"))})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_IDENTITY_MISMATCH


# ---------- Task 9.3: outcome mapping ----------


def test_not_found_is_a_limitation_not_proof_of_absence(server) -> None:
    srv = server({})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_NOT_FOUND_OR_INACCESSIBLE
    assert "not evidence that it does not exist" in retrieval_limitation(GITHUB_NOT_FOUND_OR_INACCESSIBLE)


def test_rate_limit_403_is_reported_and_stops_further_requests(server) -> None:
    """Task 9.3 and R14: rate limiting ends requests for the lifetime of this client instance, with no further network
    calls. The reset header is not parsed, and no automatic resumption is tested or supported."""
    srv = server(
        {
            "/repos/octo/repo/pulls/42": lambda: (403, {"X-RateLimit-Remaining": "0"}, b"{}"),
            "/repos/octo/repo/issues/7": _json(_issue()),
        }
    )
    client = _client(srv.base)
    with pytest.raises(GitHubError) as first:
        client.get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(first.value) == GITHUB_RATE_LIMITED
    with pytest.raises(GitHubError) as second:
        client.get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert str(second.value) == GITHUB_RATE_LIMITED
    assert len(srv.requests) == 1


def test_429_is_rate_limited(server) -> None:
    srv = server({"/repos/octo/repo/pulls/42": lambda: (429, {"Retry-After": "60"}, b"{}")})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_RATE_LIMITED


def test_server_error_is_unavailable_and_not_retried(server) -> None:
    """R13 = 0: one attempt, no retry."""
    srv = server({"/repos/octo/repo/pulls/42": lambda: (503, {}, b"{}")})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert len(srv.requests) == 1


def test_malformed_json_is_unavailable(server) -> None:
    srv = server({"/repos/octo/repo/pulls/42": lambda: (200, {}, b"not json")})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_UNAVAILABLE


# ---------- Security review regressions (M-2, L-1, L-7, L-8) ----------


def test_html_url_on_another_repository_is_not_used(server) -> None:
    """M-2: a source link that points to a different repository is dropped and marked unavailable."""
    document = _issue()
    document["html_url"] = "https://github.com/evil/repo/issues/7"
    srv = server({"/repos/octo/repo/issues/7": _json(document)})
    item = _client(srv.base).get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert item.source_url is None
    assert "source_url" in item.unavailable_fields


def test_html_url_on_another_host_is_not_used(server) -> None:
    document = _pull()
    document["html_url"] = "https://example.invalid/octo/repo/pull/42"
    srv = server({"/repos/octo/repo/pulls/42": _json(document)})
    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert item.source_url is None


def test_file_scheme_is_refused_even_with_the_test_seam(server) -> None:
    """L-1: the test seam allows plain HTTP to loopback only. A file: base URL is never read."""
    with pytest.raises(GitHubError) as raised:
        GitHubClient(token="", require_https=False, base_url="file:///C:/Windows/win.ini").get_pull_request(
            REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED
        )
    assert str(raised.value) == GITHUB_UNAVAILABLE


def test_plain_http_to_a_non_loopback_host_is_refused_by_the_seam(server) -> None:
    """L-1: the seam does not allow plain HTTP to a remote host."""
    with pytest.raises(GitHubError) as raised:
        GitHubClient(token="", require_https=False, base_url="http://example.invalid").get_pull_request(
            REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED
        )
    assert str(raised.value) == GITHUB_UNAVAILABLE


def test_token_with_control_characters_is_refused_before_any_request(server) -> None:
    """L-7: a token that cannot be a header value is refused before a request, and is never echoed."""
    srv = server({"/repos/octo/repo/pulls/42": _json(_pull())})
    with pytest.raises(GitHubError) as raised:
        GitHubClient(token="abc\r\ndef", require_https=False, base_url=srv.base).get_pull_request(
            REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED
        )
    assert str(raised.value) == GITHUB_UNAVAILABLE
    assert "abc" not in str(raised.value)
    assert srv.requests == []


def test_deeply_nested_json_is_unavailable_not_an_uncaught_error(server) -> None:
    """L-8: a body that exhausts the JSON parser's recursion limit is reported as unavailable."""
    deep = lambda: (200, {}, b"[" * 200000)  # noqa: E731
    srv = server({"/repos/octo/repo/pulls/42": deep})
    with pytest.raises(GitHubError) as raised:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(raised.value) == GITHUB_UNAVAILABLE


def test_success_response_with_exhausted_header_blocks_later_requests(server) -> None:
    """R14: a successful response that reports X-RateLimit-Remaining 0 returns its data, and the next request on the same
    client instance is blocked with no network call."""
    srv = server(
        {
            "/repos/octo/repo/pulls/42": _json(_pull(), headers={"X-RateLimit-Remaining": "0"}),
            "/repos/octo/repo/issues/7": _json(_issue()),
        }
    )
    client = _client(srv.base)
    item = client.get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert item.source_id == "42"
    with pytest.raises(GitHubError) as blocked:
        client.get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert str(blocked.value) == GITHUB_RATE_LIMITED
    assert blocked.value.retryable is True
    assert len(srv.requests) == 1


def test_a_new_client_instance_is_not_blocked_by_an_earlier_rate_limit(server) -> None:
    """R14 scope: the block belongs to the client instance that observed the limit, for its lifetime. A new instance
    makes its own request. This is the documented limitation, not a resumption feature."""
    calls = {"count": 0}

    def limited_then_ok():
        calls["count"] += 1
        if calls["count"] == 1:
            return 429, {}, b"{}"
        return 200, {}, json.dumps(_pull()).encode()

    srv = server({"/repos/octo/repo/pulls/42": limited_then_ok})
    with pytest.raises(GitHubError) as first:
        _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(first.value) == GITHUB_RATE_LIMITED
    item = _client(srv.base).get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert item.source_id == "42"
    assert len(srv.requests) == 2


def test_ordinary_unavailable_is_retryable_and_does_not_block_later_requests(server) -> None:
    """A 503 is a GITHUB_UNAVAILABLE failure. It is retryable, it does not set the rate-limit state, and the next request
    on the same client instance is made."""
    srv = server(
        {
            "/repos/octo/repo/pulls/42": _json({}, status=503),
            "/repos/octo/repo/issues/7": _json(_issue()),
        }
    )
    client = _client(srv.base)
    with pytest.raises(GitHubError) as unavailable:
        client.get_pull_request(REPOSITORY_ID, IDENTITY, "42", retrieved_at=RETRIEVED)
    assert str(unavailable.value) == GITHUB_UNAVAILABLE
    assert unavailable.value.retryable is True
    item = client.get_issue(REPOSITORY_ID, IDENTITY, "7", retrieved_at=RETRIEVED)
    assert item.source_id == "7"
    assert len(srv.requests) == 2
