"""Deterministic explanation tests (Task 13.1, 13.2; Requirement 10; Spec 1 §11.1)."""

from __future__ import annotations

import pytest

from app.modules.explanation.templates import LIMITATION_SENTENCES, ExplanationInput, explain, limitation_sentence


def _input(**overrides) -> ExplanationInput:
    values = dict(
        classification="DOCUMENTED",
        retrieval_status="COMPLETE",
        target_path="src/a.py",
        symbol=None,
        verified_commit_count=2,
        verified_blame_ranges=0,
        co_changed_document_count=0,
        limitation_messages=(),
    )
    values.update(overrides)
    return ExplanationInput(**values)


def test_failed_retrieval_produces_no_explanation() -> None:
    """Requirement 12: a failed retrieval is not explained as if it were a finding."""
    assert explain(_input(retrieval_status="FAILED", classification=None)) is None


def test_documented_states_the_fact_and_denies_intent() -> None:
    result = explain(_input())
    assert result is not None
    assert "2 commit(s) that changed src/a.py" in result.conclusion
    assert "They do not state why." in result.text
    assert "Unknown:" in result.text


@pytest.mark.parametrize("classification", ["DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE"])
def test_conclusion_present_only_when_supported(classification: str) -> None:
    assert explain(_input(classification=classification)).conclusion is not None


def test_insufficient_evidence_abstains_without_conclusion() -> None:
    result = explain(_input(classification="INSUFFICIENT_EVIDENCE", verified_commit_count=0))
    assert result.conclusion is None
    assert "does not support a reliable conclusion" in result.text
    assert "2 commit" not in result.text


def test_inferred_is_labelled_as_inference_only() -> None:
    result = explain(_input(classification="INFERRED", verified_commit_count=0, co_changed_document_count=1))
    assert "inference only" in result.conclusion
    assert "No verified content relation was established" in result.conclusion


def test_limitations_are_included_in_the_text() -> None:
    result = explain(_input(classification="PARTIAL_EVIDENCE", limitation_messages=("commit scan limit reached",)))
    assert "Limitations: commit scan limit reached" in result.text


def test_symbol_target_states_the_file_level_limit() -> None:
    result = explain(_input(symbol="target"))
    assert "Commit relevance to the symbol is not established" in result.text


def test_output_depends_only_on_its_input() -> None:
    assert explain(_input()) == explain(_input())


def test_missing_classification_for_a_non_failed_result_is_rejected() -> None:
    with pytest.raises(ValueError):
        explain(_input(classification=None))


# Wording improvements (E-D13 addendum, section 5 "Explanation quality objectives"; I5 explanation completion).


@pytest.mark.parametrize("code", sorted(LIMITATION_SENTENCES))
def test_every_defined_limitation_has_a_readable_sentence(code: str) -> None:
    sentence = limitation_sentence(code)
    assert sentence.endswith(".")
    assert "_" not in sentence


def test_undefined_limitation_code_is_shown_as_its_code_not_rephrased() -> None:
    assert limitation_sentence("SOME_NEW_CODE") == "Retrieval limitation SOME_NEW_CODE applies."


def test_limitation_sentences_do_not_describe_intent_or_cause() -> None:
    for sentence in LIMITATION_SENTENCES.values():
        for causal in ("because of", "in order to", "intended", "decided"):
            assert causal not in sentence


@pytest.mark.parametrize(
    "classification, extra",
    [
        ("DOCUMENTED", {}),
        ("PARTIAL_EVIDENCE", {}),
        ("INFERRED", {"verified_commit_count": 0, "co_changed_document_count": 1}),
        ("INSUFFICIENT_EVIDENCE", {"verified_commit_count": 0}),
    ],
)
def test_every_classification_states_what_is_unknown_and_what_would_help(classification: str, extra: dict) -> None:
    text = explain(_input(classification=classification, **extra)).text
    assert "Unknown:" in text
    assert "Evidence that would help:" in text


@pytest.mark.parametrize("classification", ["DOCUMENTED", "PARTIAL_EVIDENCE", "INFERRED", "INSUFFICIENT_EVIDENCE"])
def test_no_classification_text_asserts_intent_or_causation(classification: str) -> None:
    extra = {"verified_commit_count": 0, "co_changed_document_count": 1} if classification != "DOCUMENTED" else {}
    text = explain(_input(classification=classification, **extra)).text.lower()
    for causal in ("because", "due to", "intended", "in order to", "the reason"):
        assert causal not in text


def test_blame_ranges_are_reported_only_when_verified() -> None:
    assert "Blame attributes 3 line range(s)" in explain(_input(verified_blame_ranges=3)).text
    assert "Blame attributes" not in explain(_input(verified_blame_ranges=0)).text


def test_partial_with_no_verified_change_says_so() -> None:
    result = explain(_input(classification="PARTIAL_EVIDENCE", verified_commit_count=0))
    assert "no verified change to src/a.py was retrieved" in result.text
    assert result.conclusion is not None


def test_insufficient_states_no_conclusion_without_repeating_the_limitation() -> None:
    """The missing-history fact is carried by its limitation sentence, so the explanation does not repeat it."""
    result = explain(_input(classification="INSUFFICIENT_EVIDENCE", verified_commit_count=0))
    assert "does not support a reliable conclusion" in result.text
    assert "No historical conclusion is stated." in result.text
    assert "No verified commit" not in result.text


def test_documented_reports_co_changed_documentation_without_claiming_intent() -> None:
    result = explain(_input(co_changed_document_count=1))
    assert "Documentation changed in 1 of these commits." in result.text
    assert "does not establish a content relation or intent" in result.text


def test_documented_without_co_changed_documentation_says_nothing_about_it() -> None:
    assert "Documentation changed" not in explain(_input(co_changed_document_count=0)).text


def test_symbol_file_level_limit_is_stated_once_by_its_limitation_sentence() -> None:
    text = explain(_input(symbol="target", limitation_messages=(limitation_sentence("SYMBOL_HISTORY_FILE_LEVEL"),))).text
    assert text.count("Symbol history is tracked at file level") == 1
    assert "Symbol targets use file-level history" not in text


def test_symbol_note_is_present_for_every_symbol_target() -> None:
    for classification, extra in (
        ("DOCUMENTED", {}),
        ("PARTIAL_EVIDENCE", {}),
        ("INSUFFICIENT_EVIDENCE", {"verified_commit_count": 0}),
    ):
        text = explain(_input(classification=classification, symbol="target", **extra)).text
        assert "Commit relevance to the symbol is not established" in text


def test_line_breaks_in_untrusted_scope_values_cannot_break_the_layout() -> None:
    result = explain(_input(target_path="src/a.py\n\nInjected heading", symbol="run\r\nnext"))
    assert "\n" not in result.text and "\r" not in result.text
    assert "src/a.py Injected heading" in result.text


def test_explanation_is_identical_for_identical_inputs_across_all_classifications() -> None:
    for classification, extra in (
        ("DOCUMENTED", {}),
        ("PARTIAL_EVIDENCE", {}),
        ("INFERRED", {"verified_commit_count": 0, "co_changed_document_count": 1}),
        ("INSUFFICIENT_EVIDENCE", {"verified_commit_count": 0}),
    ):
        first = explain(_input(classification=classification, symbol="target", limitation_messages=("x.",), **extra))
        second = explain(_input(classification=classification, symbol="target", limitation_messages=("x.",), **extra))
        assert first == second


def test_conclusion_names_only_the_path_for_a_symbol_target() -> None:
    """Retrieval for a symbol is file-level history, so the conclusion must not claim a symbol-level change."""
    result = explain(_input(symbol="target"))
    assert "changed src/a.py." in result.conclusion
    assert "(symbol" not in result.conclusion
    assert "The symbol target is not separated from the file history." in result.text


def test_bidirectional_and_control_characters_in_untrusted_names_are_replaced() -> None:
    """A right-to-left override or a control character in a file name must not change the line's meaning."""
    result = explain(_input(target_path="src/\u202eevil\x1b[31m.py"))
    assert "\u202e" not in result.text and "\x1b" not in result.text
    assert "changed src/ evil [31m.py." in result.text