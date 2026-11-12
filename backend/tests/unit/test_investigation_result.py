"""Result assembly and invariant tests (Task 12.1 to 12.3; Requirement 9; design "Status and classification rules")."""

from __future__ import annotations

import pytest

from app.modules.investigation.classification import Classification, RetrievalStatus
from app.modules.investigation.result import (
    InvestigationResult,
    Limitation,
    ResultError,
    ResultInvariantViolation,
    TargetInfo,
    check_invariants,
)

_TARGET = TargetInfo(path="src/a.py", symbol=None, line_range=None, resolution="NOT_REQUESTED")
_LIMIT = Limitation(code="COMMIT_SCAN_LIMIT_REACHED", message="limit", scope="history")


def _result(**overrides) -> InvestigationResult:
    values = dict(
        investigation_id="00000000-0000-4000-8000-000000000000",
        repository_id="sample",
        target=_TARGET,
        retrieval_status=RetrievalStatus.COMPLETE,
        epistemic_classification=Classification.INSUFFICIENT_EVIDENCE,
        conclusion=None,
        explanation="text",
        evidence=(),
        ranking=(),
        limitations=(),
        source_references=(),
        error=None,
    )
    values.update(overrides)
    return InvestigationResult(**values)


def test_consistent_insufficient_result_passes() -> None:
    check_invariants(_result())


def test_consistent_partial_result_with_limitation_passes() -> None:
    check_invariants(
        _result(
            retrieval_status=RetrievalStatus.PARTIAL,
            epistemic_classification=Classification.INSUFFICIENT_EVIDENCE,
            limitations=(_LIMIT,),
        )
    )


@pytest.mark.parametrize(
    ("overrides", "rule"),
    [
        (
            dict(
                retrieval_status=RetrievalStatus.FAILED,
                epistemic_classification=None,
                explanation=None,
                error=ResultError("GIT_TIMEOUT", "x", True),
            ),
            None,
        ),
        (
            dict(
                retrieval_status=RetrievalStatus.FAILED,
                epistemic_classification=Classification.DOCUMENTED,
                error=ResultError("GIT_TIMEOUT", "x", True),
            ),
            "failed_result_has_classification_or_conclusion",
        ),
        (
            dict(retrieval_status=RetrievalStatus.FAILED, error=None, epistemic_classification=None),
            "failed_result_without_error",
        ),
        (dict(epistemic_classification=None), "non_failed_result_without_classification"),
        (
            dict(epistemic_classification=Classification.DOCUMENTED, conclusion="c"),
            "classified_without_supporting_evidence",
        ),
        (
            dict(epistemic_classification=Classification.PARTIAL_EVIDENCE, conclusion="c", limitations=()),
            "partial_evidence_without_supported_portion_or_limitations",
        ),
        (
            dict(epistemic_classification=Classification.INSUFFICIENT_EVIDENCE, conclusion="claim"),
            "insufficient_evidence_with_conclusion",
        ),
        (
            dict(retrieval_status=RetrievalStatus.PARTIAL, limitations=()),
            "partial_or_insufficient_without_limitations",
        ),
        (
            dict(error=ResultError("GIT_TIMEOUT", "x", True)),
            "error_present_without_failure",
        ),
    ],
)
def test_each_invariant_violation_raises_category_c(overrides, rule) -> None:
    """Category C (C.5, C.6): a violation is raised, never silently repaired. The message is the rule name."""
    result = _result(**overrides)
    if rule is None:
        check_invariants(result)
        return
    with pytest.raises(ResultInvariantViolation) as raised:
        check_invariants(result)
    assert str(raised.value) == rule


def test_violation_does_not_change_the_result_object() -> None:
    result = _result(epistemic_classification=None)
    snapshot = (result.retrieval_status, result.epistemic_classification)
    with pytest.raises(ResultInvariantViolation):
        check_invariants(result)
    assert (result.retrieval_status, result.epistemic_classification) == snapshot
