"""HTTP API (Task 15.2; design C.3 to C.11; owner decisions C-D4, C-D5, and §3.1 of the I5/I6 directive).

One route: POST /investigations. It calls the investigation orchestrator and nothing else. Status codes follow C.11:
- 200 for every category A result, including FAILED.
- 400 for a malformed request, an unknown or missing field, an invalid value, an invalid target path, and any other category B
  request error that C.11 does not list (for example TARGET_PARSE_FAILED).
- 400 PATH_OUTSIDE_REPOSITORY, 404 REPOSITORY_NOT_FOUND, 409 TARGET_AMBIGUOUS (with candidates), 503 REPOSITORY_UNAVAILABLE.
- 500 INTERNAL_ERROR for a category C violation. The body has no rule name, no stack trace, and no internal detail.

Error bodies use the BackendError shape: code, message, retryable, and optional field or candidates. Messages are fixed
strings. They never include request values, repository paths, or exception text.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from app.core.diagnostics import diagnostic_record
from app.modules.investigation.orchestrator import RequestError, investigate
from app.modules.investigation.result import InvestigationResult, ResultInvariantViolation
from app.modules.repository.holder import RegistryHolder
from app.modules.repository.registry import LoadedRegistry

logger = logging.getLogger("sean.api")

_REQUEST_ERROR_STATUS = {
    "REPOSITORY_NOT_FOUND": 404,
    "TARGET_AMBIGUOUS": 409,
    "REPOSITORY_UNAVAILABLE": 503,
    "PATH_OUTSIDE_REPOSITORY": 400,
    "INVALID_INPUT": 400,
}

_REQUEST_ERROR_MESSAGE = {
    "REPOSITORY_NOT_FOUND": "The repository identifier is not registered.",
    "REPOSITORY_UNAVAILABLE": "The registered repository is not available.",
    "PATH_OUTSIDE_REPOSITORY": "The target path is outside the repository.",
    "INVALID_INPUT": "The request is invalid.",
    "TARGET_AMBIGUOUS": "The target matches more than one definition. Choose one candidate and send it again.",
    "TARGET_PARSE_FAILED": "The source file could not be parsed for symbol resolution.",
}

_INTERNAL_MESSAGE = "The investigation result could not be validated. No result is returned."


class TargetIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    symbol: str | None = None
    line_start: int | None = None
    line_end: int | None = None


class InvestigationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    repository_id: str
    target: TargetIn
    question: str


def _error(code: str, message: str, status: int, **extra: Any) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message, "retryable": False}
    body.update(extra)
    return JSONResponse(status_code=status, content=body)


def _serialize(result: InvestigationResult) -> dict[str, Any]:
    """Map the result to the C.4 shape. Retrieval status and classification stay separate fields."""
    return {
        "investigation_id": result.investigation_id,
        "repository": {"repository_id": result.repository_id},
        "target": {
            "path": result.target.path,
            "symbol": result.target.symbol,
            "line_range": list(result.target.line_range) if result.target.line_range else None,
            "resolution": result.target.resolution,
        },
        "retrieval_status": result.retrieval_status.value,
        "epistemic_classification": result.epistemic_classification.value if result.epistemic_classification else None,
        "conclusion": result.conclusion,
        "explanation": result.explanation,
        "evidence": [item.model_dump(mode="json") for item in result.evidence],
        "ranking": [
            {"evidence_id": entry.evidence_id, "score": entry.score, "awards": [list(award) for award in entry.awards]}
            for entry in result.ranking
        ],
        "limitations": [
            {"code": limit.code, "message": limit.message, "scope": limit.scope, "evidence_id": limit.evidence_id}
            for limit in result.limitations
        ],
        "source_references": [
            {
                "evidence_id": ref.evidence_id,
                "source_type": ref.source_type,
                "source_id": ref.source_id,
                "source_url": ref.source_url,
            }
            for ref in result.source_references
        ],
        "error": (
            {"code": result.error.code, "message": result.error.message, "retryable": result.error.retryable}
            if result.error
            else None
        ),
    }


def create_app(registry: LoadedRegistry | RegistryHolder) -> FastAPI:
    """Build the application around a loaded registry, or around a RegistryHolder that is read on every request.

    This function never writes the registry. Phase 3 amendment (owner-authorized for repository management, Spec 4 section
    16): a RegistryHolder lets the registry change without a restart. A plain LoadedRegistry behaves exactly as before.
    """
    app = FastAPI(title="Sean backend", version="0.1.0", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(RequestError)
    async def _request_error(_: Request, error: RequestError) -> JSONResponse:
        status = _REQUEST_ERROR_STATUS.get(error.code, 400)
        extra: dict[str, Any] = {}
        if error.candidates:
            extra["candidates"] = list(error.candidates)
        message = _REQUEST_ERROR_MESSAGE.get(error.code, _REQUEST_ERROR_MESSAGE["INVALID_INPUT"])
        return _error(error.code, message, status, **extra)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
        """Field names only. Input values are never echoed."""
        first = error.errors()[0] if error.errors() else {}
        location = [part for part in first.get("loc", ()) if isinstance(part, str) and part != "body"]
        field = ".".join(location) if location else None
        extra = {"field": field} if field else {}
        return _error("INVALID_INPUT", _REQUEST_ERROR_MESSAGE["INVALID_INPUT"], 400, **extra)

    @app.exception_handler(ResultInvariantViolation)
    async def _internal(_: Request, error: ResultInvariantViolation) -> JSONResponse:
        """Category C. The rule name is logged for diagnosis and is not returned."""
        logger.error("internal result invariant violated: %s", error)
        return _error("INTERNAL_ERROR", _INTERNAL_MESSAGE, 500)

    @app.post("/investigations")
    async def create_investigation(body: InvestigationRequest) -> dict[str, Any]:
        started = time.monotonic()
        result = investigate(
            registry.current if isinstance(registry, RegistryHolder) else registry,
            body.repository_id,
            body.target.path,
            symbol=body.target.symbol,
            line_start=body.target.line_start,
            line_end=body.target.line_end,
        )
        duration_ms = int((time.monotonic() - started) * 1000)
        logger.info(
            diagnostic_record(
                {
                    "investigation_id": result.investigation_id,
                    "repository_id": result.repository_id,
                    "retrieval_status": result.retrieval_status.value,
                    "evidence_count": len(result.evidence),
                    "classification": result.epistemic_classification.value if result.epistemic_classification else None,
                    "ai_available": False,
                    "duration_ms": duration_ms,
                    "error_categories": result.error.code if result.error else None,
                }
            )
        )
        return _serialize(result)

    return app
