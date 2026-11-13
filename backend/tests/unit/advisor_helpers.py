"""Helpers for the repository profile, Advisor, intent, and route tests.

`synthetic_profile` builds a profile directly, so threshold boundaries can be tested without Git. `asgi` calls an
application through the ASGI interface, as the existing API tests do (httpx is not in the approved dependency set).
"""

from __future__ import annotations

import asyncio
import json

from app.modules.repository_profile.models import (
    AreaSummary,
    HistorySummary,
    LanguageSummary,
    Observation,
    ProfileLimitation,
    ProfileSummary,
    RepositoryProfile,
    observation_id,
)

HEAD = "a" * 40


def obs(
    kind: str,
    *,
    path: str | None = None,
    value: str | None = None,
    count: int | None = None,
    role: str | None = None,
    classification: str = "DOCUMENTED",
    source: str = "GIT_TREE",
) -> Observation:
    return Observation(
        observation_id=observation_id(kind, path, value),
        kind=kind,
        path=path,
        value=value,
        count=count,
        role=role,
        classification=classification,
        source=source,
        explanation="synthetic",
    )


def history(scanned: int = 100, fixes: int = 0, features: int = 0, authors: int = 3) -> HistorySummary:
    return HistorySummary(
        commits_scanned=scanned, fix_commits=fixes, feature_commits=features, revert_commits=0,
        conventional_commits=0, distinct_authors=authors,
    )


def synthetic_profile(
    *,
    areas: dict[str, tuple[int, int]] | None = None,
    observations: list[Observation] | None = None,
    hist: HistorySummary | None = None,
    truncated: bool = False,
    shallow: bool = False,
    history_limited: bool = False,
) -> RepositoryProfile:
    """`areas` maps an area name to (source files, test files)."""
    areas = areas or {}
    summary_areas = [AreaSummary(name=n, source_files=s, test_files=t) for n, (s, t) in areas.items()]
    items = list(observations or [])
    for area in summary_areas:
        items.append(obs("AREA", path=area.name, value=area.name, count=area.source_files))
    hist = hist or history()
    if hist.commits_scanned:
        items.append(obs("COMMIT_STATS", value="commits scanned", count=hist.commits_scanned, source="GIT_LOG"))
        items.append(obs("COMMIT_STATS", value="fix commits", count=hist.fix_commits, source="GIT_LOG"))
    unique = {item.observation_id: item for item in items}
    return RepositoryProfile(
        repository_id="synthetic",
        head=HEAD,
        truncated=truncated,
        history_limited=history_limited,
        shallow=shallow,
        summary=ProfileSummary(
            tree_entries=sum(s + t for s, t in areas.values()),
            source_files=sum(s for s, _ in areas.values()),
            test_files=sum(t for _, t in areas.values()),
            languages=[LanguageSummary(language="Python", files=sum(s for s, _ in areas.values()))],
            areas=summary_areas,
            history=hist,
        ),
        observations=list(unique.values()),
        limitations=[ProfileLimitation(code="X", message="synthetic")],
    )


def asgi(app, method: str, path: str, payload: dict | None = None) -> tuple[int, dict | str]:
    raw = json.dumps(payload).encode("utf-8") if payload is not None else b""
    headers = [(b"content-length", str(len(raw)).encode())]
    if payload is not None:
        headers.append((b"content-type", b"application/json"))
    scope = {
        "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": method, "scheme": "http",
        "path": path, "raw_path": path.encode(), "query_string": b"", "root_path": "", "headers": headers,
        "client": ("127.0.0.1", 50000), "server": ("testserver", 80),
    }
    messages: list[dict] = []
    delivered = False

    async def receive():
        nonlocal delivered
        if not delivered:
            delivered = True
            return {"type": "http.request", "body": raw, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message):
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    status = messages[0]["status"]
    body = b"".join(m.get("body", b"") for m in messages[1:] if m["type"] == "http.response.body").decode("utf-8")
    try:
        return status, json.loads(body)
    except json.JSONDecodeError:
        return status, body
