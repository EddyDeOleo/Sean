"""Retrieval of explicitly identified GitHub pull requests and issues (Tasks 9.1 to 9.3).

Transport contract (package Part 6A, owner-approved for this scope):
- HTTPS only. A plain http:// URL is refused before any request is made.
- Redirects are refused. A 3xx response is a retrieval failure. No second request is sent to the Location target.
- One per-operation socket timeout (5 s by default) applies to connection and each socket operation. No total request
  deadline is implemented. A server that sends data slowly can keep one request open for a long time. The body limit
  bounds the bytes, not the duration. This residual is accepted under the approved transport contract (package Part 6A)
  and is not claimed to be bounded.
- The response body is read in bounded chunks. A body over 1 MiB is rejected and the request fails.
- Environment and system proxies are not used (an empty proxy map is installed).
- No retries (R13 = 0).
- The GitHub REST API version is pinned to 2022-11-28 (OD-13).
- SEAN_GITHUB_TOKEN is optional. It is sent only to api.github.com over HTTPS. It never appears in errors or results.
- Rate limiting (HTTP 429, a 403 with X-RateLimit-Remaining 0, or a successful response with X-RateLimit-Remaining 0) is
  remembered for the lifetime of the client instance. That instance makes no further network request. The reset header is
  not parsed, and automatic resumption is not supported. A new client instance is not affected (owner decision R14,
  2026-11-12).

Identity (Task 9.2): a record is returned only when its repository matches the registered owner and name, compared
case-insensitively. A pull request endpoint that returns a different repository, or an issue endpoint that returns a pull
request, is a mismatch.

Outcomes (Task 9.3): every failure is a code. Not-found and inaccessible results are reported as retrieval limitations.
They are never reported as proof that the record does not exist.
"""

from __future__ import annotations

import http.client
import json
import os
import ssl
import urllib.error
import urllib.request
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

import re

from app.core.git_objects import is_full_object_name
from app.modules.evidence.contract import SourceType, SourceVerification
from app.modules.evidence.identity import canonical_decimal, is_positive_decimal
from app.modules.evidence.models import EventTimestamps, EvidenceItem, IntegrityRecord
from app.modules.repository.registry import (
    GITHUB_IDENTITY_UNRESOLVED,
    GITHUB_NAME_PATTERN,
    GITHUB_OWNER_PATTERN,
    GitHubIdentity,
)

API_HOST = "api.github.com"
API_BASE_URL = f"https://{API_HOST}"
API_VERSION = "2022-11-28"
TOKEN_ENVIRONMENT_VARIABLE = "SEAN_GITHUB_TOKEN"

from app.core.limits import BODY_LIMIT_BYTES, OPERATION_TIMEOUT_SECONDS
_READ_CHUNK = 65536

GITHUB_NOT_FOUND_OR_INACCESSIBLE = "GITHUB_NOT_FOUND_OR_INACCESSIBLE"
GITHUB_UNAVAILABLE = "GITHUB_UNAVAILABLE"
GITHUB_RATE_LIMITED = "GITHUB_RATE_LIMITED"
GITHUB_IDENTITY_MISMATCH = "GITHUB_IDENTITY_MISMATCH"
INVALID_INPUT = "INVALID_INPUT"

_OWNER_RE = re.compile(GITHUB_OWNER_PATTERN)
_NAME_RE = re.compile(GITHUB_NAME_PATTERN)

_LIMITATION_TEXT = {
    GITHUB_NOT_FOUND_OR_INACCESSIBLE: "GitHub record not found or not accessible. This is not evidence that it does not exist.",
    GITHUB_UNAVAILABLE: "GitHub record could not be retrieved. Its state is unknown.",
    GITHUB_RATE_LIMITED: "GitHub rate limit reached. The record was not retrieved.",
    GITHUB_IDENTITY_MISMATCH: "GitHub record does not belong to the registered repository and was not used.",
    GITHUB_IDENTITY_UNRESOLVED: "GitHub record identity could not be verified and the record was not used.",
}


class GitHubError(Exception):
    """A caller-facing GitHub retrieval failure. The message is the error code only.

    `retryable` depends on the cause, not only on the code. A redirect (OD-7) and an oversize body (OD-8) are both
    GITHUB_UNAVAILABLE with retryable False. Other GITHUB_UNAVAILABLE causes, such as a network failure or a timeout,
    and GITHUB_RATE_LIMITED are retryable by default.
    """

    def __init__(self, code: str, *, retryable: bool | None = None) -> None:
        super().__init__(code)
        self.code = code
        self.retryable = code in {GITHUB_UNAVAILABLE, GITHUB_RATE_LIMITED} if retryable is None else retryable


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Return no follow-up request for a redirect. urllib then raises HTTPError for the 3xx response."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401 - urllib hook signature
        return None


def retrieval_limitation(code: str) -> str:
    """Return the limitation text for a retrieval failure code (Task 9.3)."""
    return _LIMITATION_TEXT[code]


def _build_opener() -> urllib.request.OpenerDirector:
    """An opener with only HTTP and HTTPS. No proxies, no redirects, and no file, FTP, or data handlers."""
    opener = urllib.request.OpenerDirector()
    for handler in (
        urllib.request.ProxyHandler({}),
        _NoRedirect(),
        urllib.request.HTTPHandler(),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
        urllib.request.HTTPErrorProcessor(),
        urllib.request.HTTPDefaultErrorHandler(),
        urllib.request.UnknownHandler(),
    ):
        opener.add_handler(handler)
    return opener


def _is_loopback(host: str | None) -> bool:
    return host in {"127.0.0.1", "localhost", "::1"}


def _token_is_usable(token: str) -> bool:
    """A token is sent as a header value, so it must be printable ASCII without spaces or control characters."""
    return all(0x21 <= ord(character) <= 0x7E for character in token)


def _status_code(status: int, headers: Mapping[str, str]) -> str:
    if status == 404:
        return GITHUB_NOT_FOUND_OR_INACCESSIBLE
    if status == 429 or (status == 403 and headers.get("X-RateLimit-Remaining") == "0"):
        return GITHUB_RATE_LIMITED
    if status == 403:
        return GITHUB_NOT_FOUND_OR_INACCESSIBLE
    return GITHUB_UNAVAILABLE


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if moment.tzinfo is None:
        return None
    return moment.astimezone(UTC).replace(microsecond=0)


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


class GitHubClient:
    """Fetches one pull request or issue per call. One client is used for one investigation."""

    def __init__(
        self,
        *,
        token: str | None = None,
        timeout_seconds: float = OPERATION_TIMEOUT_SECONDS,
        require_https: bool = True,
        opener: urllib.request.OpenerDirector | None = None,
        base_url: str = API_BASE_URL,
    ) -> None:
        self._token = token if token is not None else (os.environ.get(TOKEN_ENVIRONMENT_VARIABLE) or None)
        self._token_usable = self._token is None or _token_is_usable(self._token)
        self._timeout = timeout_seconds
        self._require_https = require_https
        self._opener = opener or _build_opener()
        self._base_url = base_url
        # R14 (owner decision 2026-11-12): set once rate limiting is observed. Never cleared for this instance.
        self._exhausted = False

    def get_pull_request(
        self, repository_id: str, identity: GitHubIdentity, number: str, *, retrieved_at: datetime
    ) -> EvidenceItem:
        """Return a validated PULL_REQUEST evidence item, or raise GitHubError with a code."""
        canonical, owner, name = _validated_request(identity, number)
        document = self._get_json(f"/repos/{owner}/{name}/pulls/{canonical}")
        _check_pull_request_identity(document, owner, name, canonical)
        return _pull_request_item(repository_id, owner, name, canonical, document, retrieved_at)

    def get_issue(self, repository_id: str, identity: GitHubIdentity, number: str, *, retrieved_at: datetime) -> EvidenceItem:
        """Return a validated ISSUE evidence item, or raise GitHubError with a code."""
        canonical, owner, name = _validated_request(identity, number)
        document = self._get_json(f"/repos/{owner}/{name}/issues/{canonical}")
        _check_issue_identity(document, owner, name, canonical)
        return _issue_item(repository_id, owner, name, canonical, document, retrieved_at)

    def _get_json(self, path: str) -> dict[str, Any]:
        if self._exhausted:
            raise GitHubError(GITHUB_RATE_LIMITED)
        if not self._token_usable:
            raise GitHubError(GITHUB_UNAVAILABLE)
        url = self._base_url + path
        scheme_and_host = urlsplit(url)
        # HTTPS is required. Plain HTTP is allowed only by the test seam, and only to a loopback host.
        if scheme_and_host.scheme != "https" and (self._require_https or not _is_loopback(scheme_and_host.hostname)):
            raise GitHubError(GITHUB_UNAVAILABLE)
        if scheme_and_host.scheme not in {"http", "https"}:
            raise GitHubError(GITHUB_UNAVAILABLE)
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": API_VERSION,
            "User-Agent": "Sean",
        }
        # The token is attached only to the GitHub API host over HTTPS.
        parts = urlsplit(url)
        if self._token and parts.scheme == "https" and parts.netloc == API_HOST:
            headers["Authorization"] = f"Bearer {self._token}"
        request = urllib.request.Request(url, headers=headers, method="GET")

        try:
            response = self._opener.open(request, timeout=self._timeout)
        except urllib.error.HTTPError as error:
            error.close()
            if _status_code(error.code, error.headers) == GITHUB_RATE_LIMITED:
                self._exhausted = True
            if 300 <= error.code < 400:
                # OD-7: a redirect is a failure. It is never followed, and retrying would send the same request again.
                raise GitHubError(GITHUB_UNAVAILABLE, retryable=False) from None
            raise GitHubError(_status_code(error.code, error.headers)) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, ssl.SSLError, http.client.HTTPException):
            raise GitHubError(GITHUB_UNAVAILABLE) from None

        with response:
            body = self._read_limited(response)
            if response.headers.get("X-RateLimit-Remaining") == "0":
                self._exhausted = True
        try:
            document = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError, RecursionError):
            raise GitHubError(GITHUB_UNAVAILABLE) from None
        if not isinstance(document, dict):
            raise GitHubError(GITHUB_UNAVAILABLE)
        return document

    @staticmethod
    def _read_limited(response) -> bytes:
        chunks: list[bytes] = []
        total = 0
        try:
            while True:
                chunk = response.read1(_READ_CHUNK)
                if not chunk:
                    break
                total += len(chunk)
                if total > BODY_LIMIT_BYTES:
                    # OD-8: an oversize body is a failure and is not retryable.
                    raise GitHubError(GITHUB_UNAVAILABLE, retryable=False)
                chunks.append(chunk)
        except (TimeoutError, ConnectionError, ssl.SSLError, http.client.HTTPException):
            raise GitHubError(GITHUB_UNAVAILABLE) from None
        return b"".join(chunks)


def _validated_request(identity: GitHubIdentity, number: str) -> tuple[str, str, str]:
    """Validate the registered identity and the number before any request (Task 9.1 input rules)."""
    if not isinstance(identity, GitHubIdentity) or not _OWNER_RE.fullmatch(identity.owner) or not _NAME_RE.fullmatch(identity.name):
        raise GitHubError(GITHUB_IDENTITY_UNRESOLVED)
    if not isinstance(number, str) or not is_positive_decimal(number):
        raise GitHubError(INVALID_INPUT)
    return canonical_decimal(number), identity.owner, identity.name


def _same_repository(full_name: object, owner: str, name: str) -> bool | None:
    if not isinstance(full_name, str) or "/" not in full_name:
        return None
    return full_name.lower() == f"{owner}/{name}".lower()


def _number_matches(document: dict[str, Any], canonical: str) -> bool:
    """Compare as text, so a number with many digits never needs an integer conversion."""
    number = document.get("number")
    return isinstance(number, int) and not isinstance(number, bool) and str(number) == canonical


def _check_pull_request_identity(document: dict[str, Any], owner: str, name: str, canonical: str) -> None:
    """The record must state its repository and number. A different repository or number is a mismatch."""
    base = document.get("base")
    repo = base.get("repo") if isinstance(base, dict) else None
    full_name = repo.get("full_name") if isinstance(repo, dict) else None
    matches = _same_repository(full_name, owner, name)
    if matches is None:
        raise GitHubError(GITHUB_IDENTITY_UNRESOLVED)
    if not matches or not _number_matches(document, canonical):
        raise GitHubError(GITHUB_IDENTITY_MISMATCH)


def _check_issue_identity(document: dict[str, Any], owner: str, name: str, canonical: str) -> None:
    """An issue endpoint that returns a pull request, or another repository, is a mismatch."""
    if "pull_request" in document:
        raise GitHubError(GITHUB_IDENTITY_MISMATCH)
    repository_url = document.get("repository_url")
    if not isinstance(repository_url, str):
        raise GitHubError(GITHUB_IDENTITY_UNRESOLVED)
    expected = f"{API_BASE_URL}/repos/{owner}/{name}".lower()
    if repository_url.lower() != expected or not _number_matches(document, canonical):
        raise GitHubError(GITHUB_IDENTITY_MISMATCH)


def _html_url(value: object, owner: str, name: str, kind: str, canonical: str) -> str | None:
    """Accept html_url only when it points to this repository's own page for this record (M-2)."""
    if not isinstance(value, str):
        return None
    parts = urlsplit(value)
    expected_path = f"/{owner}/{name}/{kind}/{canonical}".lower()
    if parts.scheme != "https" or parts.hostname != "github.com" or parts.username or parts.password:
        return None
    if parts.path.lower() != expected_path or parts.query or parts.fragment:
        return None
    return value


def _author(document: dict[str, Any]) -> str | None:
    """Display name only, when non-empty (OD-12). The login and email are never used as the author."""
    user = document.get("user")
    return _text(user.get("name")) if isinstance(user, dict) else None


def _pull_request_item(
    repository_id: str, owner: str, name: str, canonical: str, document: dict[str, Any], retrieved_at: datetime
) -> EvidenceItem:
    created = _parse_time(document.get("created_at"))
    if created is None:
        raise GitHubError(GITHUB_UNAVAILABLE)
    merged_at = _parse_time(document.get("merged_at"))
    closed_at = _parse_time(document.get("closed_at"))
    merge_commit = document.get("merge_commit_sha")
    author = _author(document)
    title = _text(document.get("title"))
    source_url = _html_url(document.get("html_url"), owner, name, "pull", canonical)
    unavailable = {"excerpt", "relationship"}
    if source_url is None:
        unavailable.add("source_url")
    if author is None:
        unavailable.add("author")
    if title is None:
        unavailable.add("title")
    if not (isinstance(merge_commit, str) and is_full_object_name(merge_commit)):
        unavailable.add("commit_hash")
    if merged_at is None and closed_at is None:
        unavailable.add("event_timestamps")
    return EvidenceItem(
        repository_namespace=repository_id,
        source_type=SourceType.PULL_REQUEST,
        source_id=canonical,
        retrieval_method=f"GitHub REST pulls/{canonical} (API {API_VERSION})",
        limitations=(),
        integrity=IntegrityRecord(
            retrieved_at=retrieved_at,
            served_from_cache=False,
            source_verification=SourceVerification.VALIDATED_RECORD_IDENTITY,
            content_digest=None,
        ),
        source_url=source_url,
        commit_hash=merge_commit if "commit_hash" not in unavailable else None,
        revision=None,
        change_side=None,
        file_path=None,
        line_range=None,
        author=author,
        timestamp=created,
        event_timestamps=EventTimestamps(merged_at=merged_at, closed_at=closed_at) if "event_timestamps" not in unavailable else None,
        title=title,
        excerpt=None,
        relationship=None,
        unavailable_fields=frozenset(unavailable),
        verified_absent_fields=frozenset(),
    )


def _issue_item(
    repository_id: str, owner: str, name: str, canonical: str, document: dict[str, Any], retrieved_at: datetime
) -> EvidenceItem:
    created = _parse_time(document.get("created_at"))
    if created is None:
        raise GitHubError(GITHUB_UNAVAILABLE)
    author = _author(document)
    title = _text(document.get("title"))
    source_url = _html_url(document.get("html_url"), owner, name, "issues", canonical)
    unavailable = {"commit_hash", "excerpt", "relationship"}
    if source_url is None:
        unavailable.add("source_url")
    if author is None:
        unavailable.add("author")
    if title is None:
        unavailable.add("title")
    return EvidenceItem(
        repository_namespace=repository_id,
        source_type=SourceType.ISSUE,
        source_id=canonical,
        retrieval_method=f"GitHub REST issues/{canonical} (API {API_VERSION})",
        limitations=(),
        integrity=IntegrityRecord(
            retrieved_at=retrieved_at,
            served_from_cache=False,
            source_verification=SourceVerification.VALIDATED_RECORD_IDENTITY,
            content_digest=None,
        ),
        source_url=source_url,
        commit_hash=None,
        revision=None,
        change_side=None,
        file_path=None,
        line_range=None,
        author=author,
        timestamp=created,
        event_timestamps=None,
        title=title,
        excerpt=None,
        relationship=None,
        unavailable_fields=frozenset(unavailable),
        verified_absent_fields=frozenset(),
    )

