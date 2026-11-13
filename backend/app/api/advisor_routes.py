"""Additive HTTP routes for repository intelligence (Spec 4 section 4.2).

These routes are read-only. They never write to a repository, never echo paths, and use the Phase 3 error body shape with
fixed messages. The Phase 3 routes and the Phase 3 application factory are not modified: `app.main_advisor` includes this
router into the application that `create_app` builds.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from typing import Annotated, Any

from fastapi import APIRouter, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictBool

from app.modules.advisor.artifacts import ArtifactError, prepare_artifacts
from app.modules.advisor.contract import ContractViolation
from app.modules.advisor.roadmap import advise
from app.modules.intent.gemini import MODEL, Transport, build_hint
from app.modules.intent.parser import RepositoryRef, interpret
from app.modules.repository.registry import (
    LoadedRegistry,
    RepositoryError,
    resolve_repository,
)
from app.modules.repository_profile.models import ProfileError
from app.modules.repository_profile.scanner import committed_paths, current_head, scan_repository

logger = logging.getLogger("sean.api.advisor")

REPOSITORY_ID_PATTERN = r"^[a-z0-9][a-z0-9_-]{0,63}$"
MAX_TEXT_LENGTH = 2000
# At most this many scans or interpretations run at once. A scan starts about 25 Git processes (security review M2).
MAX_CONCURRENT_WORK = 4
PROFILE_CACHE_ENTRIES = 16

_STATUS = {"REPOSITORY_NOT_FOUND": 404, "REPOSITORY_UNAVAILABLE": 503}
_MESSAGE = {
    "REPOSITORY_NOT_FOUND": "The repository identifier is not registered.",
    "REPOSITORY_UNAVAILABLE": "The registered repository is not available.",
    "PROFILE_UNAVAILABLE": "The repository has no readable commits, or its tree could not be read.",
    "BUSY": "Sean is busy with other requests. Try again in a moment.",
    "INVALID_INPUT": "The request is invalid.",
    "INTERNAL_ERROR": "The analysis could not be validated. No result is returned.",
}


class InterpretIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(max_length=MAX_TEXT_LENGTH)
    selected_repository_id: str | None = Field(default=None, pattern=REPOSITORY_ID_PATTERN)
    # Per-request consent (security review M1). Without it the sentence never leaves this machine.
    allow_ai: StrictBool = False


class VerifyIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str = Field(max_length=300)
    content_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class PreviewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repository_id: str = Field(pattern=REPOSITORY_ID_PATTERN)
    capabilities: list[Annotated[str, Field(max_length=64)]] = Field(default_factory=list, max_length=10)
    # Files the user exported earlier, to check whether the same bytes are now committed.
    verify: list[VerifyIn] = Field(default_factory=list, max_length=20)


def _error(code: str, status: int) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": _MESSAGE[code], "retryable": False})


def create_advisor_router(registry: LoadedRegistry, *, gemini_transport: Transport | None = None) -> APIRouter:
    router = APIRouter()
    slots = threading.BoundedSemaphore(MAX_CONCURRENT_WORK)
    # Responses keyed by (repository, HEAD). A new commit changes the key, so a cached profile is never stale.
    cache: OrderedDict[tuple[str, str], dict[str, Any]] = OrderedDict()
    cache_lock = threading.Lock()

    def _tree_paths(repository_id: str) -> list[str]:
        try:
            return committed_paths(resolve_repository(registry, repository_id).root)
        except RepositoryError:
            return []

    @router.get("/repositories")
    def list_repositories() -> dict[str, Any]:
        items = []
        for repository_id, entry in sorted(registry.entries.items()):
            try:
                resolve_repository(registry, repository_id)
                available = True
            except RepositoryError:
                available = False
            github = {"owner": entry.github.owner, "name": entry.github.name} if entry.github else None
            items.append({"repository_id": repository_id, "available": available, "github": github})
        return {"repositories": items}

    @router.post("/repositories/{repository_id}/profile", response_model=None)
    def profile_repository(repository_id: Annotated[str, Path(pattern=REPOSITORY_ID_PATTERN)]) -> Any:
        try:
            resolved = resolve_repository(registry, repository_id)
        except RepositoryError as error:
            return _error(error.code, _STATUS.get(error.code, 400))
        head = current_head(resolved.root)
        key = (repository_id, head) if head else None
        if key is not None:
            with cache_lock:
                if key in cache:
                    cache.move_to_end(key)
                    return cache[key]
        if not slots.acquire(blocking=False):
            return _error("BUSY", 429)
        try:
            try:
                profile = scan_repository(resolved.root, repository_id)
            except ProfileError as error:
                logger.info("profile unavailable: %s", error.code)
                return _error("PROFILE_UNAVAILABLE", 422)
            try:
                advisor = advise(profile)
            except ContractViolation as error:
                logger.error("advisor contract violated: %s", error)
                return _error("INTERNAL_ERROR", 500)
        finally:
            slots.release()
        logger.info(
            "profile built repository=%s observations=%d truncated=%s shallow=%s",
            repository_id, len(profile.observations), profile.truncated, profile.shallow,
        )
        response = {"profile": profile.model_dump(mode="json"), "advisor": advisor.model_dump(mode="json")}
        with cache_lock:
            cache[(repository_id, profile.head)] = response
            while len(cache) > PROFILE_CACHE_ENTRIES:
                cache.popitem(last=False)
        return response

    @router.post("/artifacts/preview", response_model=None)
    def preview_artifacts(body: PreviewIn) -> Any:
        """Prepare files for review. This reads the committed repository and writes nothing anywhere."""
        try:
            resolved = resolve_repository(registry, body.repository_id)
        except RepositoryError as error:
            return _error(error.code, _STATUS.get(error.code, 400))
        if not slots.acquire(blocking=False):
            return _error("BUSY", 429)
        try:
            try:
                profile = scan_repository(resolved.root, body.repository_id)
            except ProfileError:
                return _error("PROFILE_UNAVAILABLE", 422)
            try:
                advisor = advise(profile)
            except ContractViolation as error:
                logger.error("advisor contract violated: %s", error)
                return _error("INTERNAL_ERROR", 500)
            try:
                result = prepare_artifacts(
                    profile, advisor, body.capabilities, repo_root=resolved.root, existing_paths=set(committed_paths(resolved.root)),
                    verify=[(item.path, item.content_sha256) for item in body.verify],
                )
            except ArtifactError as error:
                logger.info("artifact preview refused: %s", error.code)
                return _error("INVALID_INPUT", 400)
        finally:
            slots.release()
        logger.info("artifact preview repository=%s capabilities=%d bundles=%d", body.repository_id, len(body.capabilities), len(result.bundles))
        return result.model_dump(mode="json")

    @router.get("/capabilities")
    def capabilities() -> dict[str, Any]:
        """What optional services this backend can use. It never returns a key or any part of one."""
        return {
            "ai_interpreter": {
                "available": gemini_transport is not None,
                "provider": "Gemini",
                "model": MODEL,
                "sends": "only the sentence you type, and only when you allow it for that request",
            }
        }

    @router.post("/interpret")
    def interpret_request(body: InterpretIn) -> Any:
        refs = {
            repository_id: RepositoryRef(
                repository_id=repository_id,
                github=(entry.github.owner.lower(), entry.github.name.lower()) if entry.github else None,
            )
            for repository_id, entry in registry.entries.items()
        }
        if not slots.acquire(blocking=False):
            return _error("BUSY", 429)
        try:
            result = interpret(
                body.text, refs, _tree_paths, selected_repository_id=body.selected_repository_id, hint=build_hint(gemini_transport) if body.allow_ai else None
            )
        finally:
            slots.release()
        return result.model_dump(mode="json")

    return router
