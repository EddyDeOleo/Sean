"""The owner's Groq diagnostic labels each outcome. These tests pin the labels, so a failure is never reported as another cause.

The script is loaded from its file path because it lives in `scripts/`, outside the backend package.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[3] / "scripts" / "diagnose_groq.py"


@pytest.fixture(scope="module")
def diagnose():
    spec = importlib.util.spec_from_file_location("diagnose_groq", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _error(message: str, code: str | None = None) -> str:
    body: dict = {"message": message, "type": "invalid_request_error"}
    if code:
        body["code"] = code
    return json.dumps({"error": body})


@pytest.mark.parametrize(
    ("status", "detail", "label"),
    [
        # Cloudflare edge block: plain text, not Groq's JSON. It must not be reported as an authentication result.
        (403, "error code: 1010", "EDGE_BLOCKED_BROWSER_SIGNATURE"),
        (401, _error("Invalid API Key"), "AUTHENTICATION_FAILED"),
        (403, _error("Your organization has no credits left"), "PERMISSION_OR_QUOTA_DENIED"),
        (403, _error("forbidden"), "PERMISSION_DENIED"),
        (404, _error("The model does not exist", "model_not_found"), "MODEL_UNAVAILABLE"),
        (400, _error("model has been decommissioned"), "MODEL_UNAVAILABLE"),
        (429, _error("Rate limit reached for requests per minute"), "RATE_LIMITED"),
        (429, _error("You exceeded your current quota, check billing"), "QUOTA_OR_BILLING_LIMIT"),
        (503, "unavailable", "PROVIDER_UNAVAILABLE"),
        (418, "teapot", "HTTP_ERROR_418"),
    ],
)
def test_each_http_outcome_has_its_own_label(diagnose, status, detail, label):
    assert diagnose.classify_http_error(status, detail) == label


def test_the_key_is_never_part_of_the_label(diagnose):
    # Labels are fixed strings from a closed set. No provider text is returned as a label.
    assert diagnose.classify_http_error(403, "secret-looking text sk-123") == "PERMISSION_DENIED"
