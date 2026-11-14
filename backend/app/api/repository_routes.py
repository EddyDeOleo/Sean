r"""Repository management routes (Spec 4 section 16): add, edit, and remove registered repositories without a restart.

POST /repositories, PUT /repositories/{repository_id}, DELETE /repositories/{repository_id}. They change only the registry file
(see `app.modules.repository.management`). After a successful write the shared `RegistryHolder` is replaced, so the next
request on any route sees the new registry. Messages are fixed strings and never include request values or paths.

POST and PUT require `Content-Type: application/json`, a bounded body, and exactly the documented fields. DELETE has no body.
The local-only guard (Host and Origin) is applied by the application, as for every route.
"""

from __future__ import annotations

import json
import logging
import threading
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, ValidationError

from app.modules.repository import management as manage
from app.modules.repository.holder import RegistryHolder
from app.modules.repository.registry import LoadedRegistry, RegistryEntry, default_registry_path, resolve_repository, RepositoryError

logger = logging.getLogger("sean.repositories")

MAX_BODY_BYTES = 16 * 1024
# Add and edit each start one Git process. Keep a small cap, separate from the analysis routes.
MAX_CONCURRENT_CHECKS = 2

_STATUS = {
    "INVALID_INPUT": 400,
    "INVALID_REPOSITORY_ID": 400,
    "INVALID_DISPLAY_NAME": 400,
    "PATH_NOT_FOUND": 400,
    "NOT_A_GIT_REPOSITORY": 400,
    "DUPLICATE_ID": 409,
    "DUPLICATE_PATH": 409,
    "REPOSITORY_NOT_FOUND": 404,
    "REGISTRY_UNAVAILABLE": 503,
    "REGISTRY_WRITE_FAILED": 500,
    "BUSY": 429,
    "CLIENT_REQUIRED": 403,
}
_MESSAGE = {
    "INVALID_INPUT": "The request is invalid. Send a JSON object with exactly the documented fields.",
    "INVALID_REPOSITORY_ID": (
        "The repository identifier must be 1 to 64 characters: lowercase letters, digits, hyphens or underscores, "
        "starting with a letter or digit."
    ),
    "INVALID_DISPLAY_NAME": "The display name must be 1 to 80 characters and contain no control or invisible characters.",
    "PATH_NOT_FOUND": "No folder exists at that path. Check the spelling and that the drive is available.",
    "NOT_A_GIT_REPOSITORY": (
        "The folder is not the root of a Git repository. Choose the folder that contains the .git entry, "
        "and make sure Git is installed."
    ),
    "DUPLICATE_ID": "A repository with this identifier is already registered. Choose another identifier or edit the existing entry.",
    "DUPLICATE_PATH": "This folder is already registered under another identifier.",
    "REPOSITORY_NOT_FOUND": "The repository identifier is not registered.",
    "REGISTRY_UNAVAILABLE": (
        "The repository registry cannot be changed: LOCALAPPDATA is not set, or the registry file is unreadable or invalid. "
        "The file was not modified. Fix or remove it, then try again."
    ),
    "REGISTRY_WRITE_FAILED": "The registry file could not be written. The previous registry is unchanged.",
    "BUSY": "Sean is busy checking other repositories. Try again in a moment.",
    "CLIENT_REQUIRED": "Changing the repository list needs the Sean application. This request did not come from it.",
}
_DETAIL_MESSAGE = {
    ("INVALID_INPUT", "path"): (
        "The path must be an absolute local path with a drive letter, such as C:\\Projects\\app. "
        "Relative paths, '..' segments, network (UNC) and device paths are not accepted."
    ),
    ("INVALID_INPUT", "body"): "The request body must be a JSON object, at most 16 KiB, sent with Content-Type: application/json.",
    ("PATH_NOT_FOUND", "exists"): "The path exists but is not a folder. Choose the repository folder.",
    ("REGISTRY_WRITE_FAILED", "size"): "The registry file would exceed its size limit. Remove an entry first. Nothing was changed.",
}


class AddIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    repository_id: str
    display_name: str
    path: str


class EditIn(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    display_name: str
    path: str


def _error(code: str, detail: str | None = None, **extra: Any) -> JSONResponse:
    message = _DETAIL_MESSAGE.get((code, detail), _MESSAGE[code]) if detail else _MESSAGE[code]
    body: dict[str, Any] = {"code": code, "message": message, "retryable": code == "BUSY"}
    if code == "INVALID_INPUT" and detail and detail not in {"body"}:
        body["field"] = detail
    body.update(extra)
    return JSONResponse(status_code=_STATUS[code], content=body)


def _from_exception(error: manage.ManagementError) -> JSONResponse:
    return _error(error.code, error.detail, **error.extra)


def repository_item(registry: LoadedRegistry, entry: RegistryEntry) -> dict[str, Any]:
    """The shape shared by GET /repositories and the add and edit responses."""
    try:
        resolve_repository(registry, entry.repository_id)
        available = True
    except RepositoryError:
        available = False
    github = {"owner": entry.github.owner, "name": entry.github.name} if entry.github else None
    return {
        "repository_id": entry.repository_id,
        "display_name": entry.display_name or entry.repository_id,
        "path": entry.root,
        "available": available,
        "github": github,
    }


# A request that changes the registry must carry this header. A web page on another origin cannot add a custom header
# without a CORS preflight, and this backend answers none, so such a page cannot change the registry even if the Host and
# Origin checks were bypassed. Sean's own frontend sends it on every call that is not a read.
CLIENT_HEADER = "x-sean-client"
CLIENT_VALUE = "web"


def _client_required(request: Request) -> JSONResponse | None:
    return None if request.headers.get(CLIENT_HEADER) == CLIENT_VALUE else _error("CLIENT_REQUIRED")


async def _read_json(request: Request) -> dict[str, Any] | JSONResponse:
    media_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    if media_type != "application/json":
        return _error("INVALID_INPUT", "body")
    declared = request.headers.get("content-length")
    if declared is not None and (not declared.isdigit() or int(declared) > MAX_BODY_BYTES):
        return _error("INVALID_INPUT", "body")
    received = bytearray()
    async for chunk in request.stream():
        received.extend(chunk)
        if len(received) > MAX_BODY_BYTES:
            return _error("INVALID_INPUT", "body")
    try:
        document = json.loads(bytes(received).decode("utf-8"))
    except (ValueError, RecursionError):
        return _error("INVALID_INPUT", "body")
    if not isinstance(document, dict):
        return _error("INVALID_INPUT", "body")
    return document


def _parse(model: type[BaseModel], document: dict[str, Any]) -> Any:
    try:
        return model.model_validate(document)
    except ValidationError as error:
        first = error.errors()[0] if error.errors() else {}
        location = [part for part in first.get("loc", ()) if isinstance(part, str)]
        return _error("INVALID_INPUT", location[0] if location else "body")


def create_repository_router(
    holder: RegistryHolder, *, path_provider: Callable[[], Path | None] = default_registry_path
) -> APIRouter:
    router = APIRouter()
    slots = threading.BoundedSemaphore(MAX_CONCURRENT_CHECKS)

    def _reload(path: Path | None) -> None:
        manage.reload_into(path, holder)

    def _respond(repository_id: str, root: str, display_name: str, status: int) -> JSONResponse:
        registry = holder.current
        entry = registry.entries.get(repository_id) or RegistryEntry(
            repository_id=repository_id, root=root, display_name=display_name
        )
        return JSONResponse(status_code=status, content=repository_item(registry, entry))

    def _save(operation: str, repository_id: str, display_name: str, raw_path: str) -> JSONResponse:
        """Validate everything, then write. Runs in a worker thread because it starts Git and touches the disk."""
        try:
            root = manage.validate_path_format(raw_path)
            registry_path = path_provider()
            if registry_path is None:
                raise manage.ManagementError(manage.REGISTRY_UNAVAILABLE)
            if not slots.acquire(blocking=False):
                return _error("BUSY")
            try:
                manage.verify_work_tree_root(root)
            finally:
                slots.release()
            if operation == "add":
                manage.add_repository(registry_path, repository_id, display_name, root)
            else:
                manage.update_repository(registry_path, repository_id, display_name, root)
            _reload(registry_path)
        except manage.ManagementError as error:
            # repository_id was validated by the caller before this runs.
            logger.info("repository %s id=%s outcome=%s", operation, repository_id, error.code)
            return _from_exception(error)
        logger.info("repository %s id=%s outcome=ok", operation, repository_id)
        return _respond(repository_id, root, display_name, 201 if operation == "add" else 200)

    @router.post("/repositories", response_model=None)
    async def add_repository(request: Request) -> Any:
        refused = _client_required(request)
        if refused is not None:
            return refused
        document = await _read_json(request)
        if isinstance(document, JSONResponse):
            return document
        body = _parse(AddIn, document)
        if isinstance(body, JSONResponse):
            return body
        try:
            repository_id = manage.validate_repository_id(body.repository_id)
            display_name = manage.validate_display_name(body.display_name)
        except manage.ManagementError as error:
            return _from_exception(error)
        return await run_in_threadpool(_save, "add", repository_id, display_name, body.path)

    @router.put("/repositories/{repository_id}", response_model=None)
    async def edit_repository(repository_id: str, request: Request) -> Any:
        refused = _client_required(request)
        if refused is not None:
            return refused
        document = await _read_json(request)
        if isinstance(document, JSONResponse):
            return document
        body = _parse(EditIn, document)
        if isinstance(body, JSONResponse):
            return body
        try:
            manage.validate_repository_id(repository_id)
            display_name = manage.validate_display_name(body.display_name)
        except manage.ManagementError as error:
            return _from_exception(error)
        return await run_in_threadpool(_save, "edit", repository_id, display_name, body.path)

    @router.delete("/repositories/{repository_id}", response_model=None)
    def remove_repository(repository_id: str, request: Request) -> Any:
        """Removes the registry entry only. The repository folder is never opened, listed, or changed."""
        refused = _client_required(request)
        if refused is not None:
            return refused
        try:
            manage.validate_repository_id(repository_id)
            registry_path = path_provider()
            if registry_path is None:
                raise manage.ManagementError(manage.REGISTRY_UNAVAILABLE)
            manage.remove_repository(registry_path, repository_id)
            _reload(registry_path)
        except manage.ManagementError as error:
            shown = "-" if error.code == manage.INVALID_REPOSITORY_ID else repository_id  # never log unvalidated text
            logger.info("repository remove id=%s outcome=%s", shown, error.code)
            return _from_exception(error)
        logger.info("repository remove id=%s outcome=ok", repository_id)
        return {"removed": repository_id}

    return router
