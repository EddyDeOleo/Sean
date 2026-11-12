"""Deterministic explanation from verified fields (Task 13.1, 13.2; Requirement 10; Spec 1 §11.1).

No AI provider is used or assumed (Task 14 is deferred, E-D13). Output depends only on the values passed in.

Each explanation states, in this order:
- the statement the verified records establish (or that they do not support one),
- what could not be verified and why, in the limitation sentences,
- what remains unknown,
- the evidence that would help answer the question.

The wording never states why a change was made. A commit records that a change occurred, not its intent.

Abstention (INSUFFICIENT_EVIDENCE) gives no conclusion. FAILED retrieval gives no explanation (Requirement 12). The module
takes plain values, not investigation types, so it does not depend on the investigation module.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

# Fixed sentences for each limitation code. Codes come from the code, never from repository text. A code without a
# sentence is shown as its code, so an unexpected limitation is visible rather than silently rephrased.
LIMITATION_SENTENCES: dict[str, str] = {
    "HEURISTIC_RENAME_AND_COPY_DETECTION": "Rename and copy detection is heuristic, so some history may be attributed to a different path.",
    "SHALLOW_CLONE": "The repository is a shallow clone, so older history may be missing.",
    "COMMIT_SCAN_LIMIT_REACHED": "The commit scan limit was reached, so older commits were not examined.",
    "SYMBOL_HISTORY_FILE_LEVEL": "Symbol history is tracked at file level, so commits that changed other parts of the file are included.",
    "DOCUMENT_PATH_NOT_REPRESENTABLE": "A documentation path could not be represented safely and was skipped.",
    "CO_CHANGED_IN_COMMIT_NO_CONTENT_RELATION_VERIFIED": "Documentation changed in the same commits, but no content relation was verified.",
    "UNCOMMITTED_LINES_NOT_REPORTED": "Some lines have uncommitted changes, which are not reported as commit history.",
    "BLAME_UNAVAILABLE": "Blame for the resolved region could not be retrieved.",
    "NO_HISTORY_RETRIEVED": "No commit history was retrieved for the target.",
    "ASSOCIATION_NOT_IMPLEMENTED": "Pull request and issue evidence is not included, because the association step is not implemented.",
}

_NOT_ESTABLISHED_WHY = "why these changes were made"
_HISTORY_OUTSIDE_SCOPE = "whether history outside the retrieved scope affects this answer"


def limitation_sentence(code: str) -> str:
    """Return the fixed sentence for a limitation code, or the code itself when no sentence is defined."""
    return LIMITATION_SENTENCES.get(code, f"Retrieval limitation {code} applies.")


@dataclass(frozen=True)
class ExplanationInput:
    classification: str | None
    retrieval_status: str
    target_path: str
    symbol: str | None
    verified_commit_count: int
    verified_blame_ranges: int
    co_changed_document_count: int
    limitation_messages: tuple[str, ...]


@dataclass(frozen=True)
class Explanation:
    text: str
    conclusion: str | None


def _single_line(value: str) -> str:
    """Make an untrusted value safe for one line of text.

    Control characters (Cc) and format characters (Cf, which include bidirectional overrides) are replaced by spaces, and
    runs of whitespace are collapsed. Inputs are validated upstream as well. This is a second layer.
    """
    cleaned = "".join(" " if unicodedata.category(char) in ("Cc", "Cf") else char for char in value)
    return " ".join(cleaned.split())


def explain(data: ExplanationInput) -> Explanation | None:
    """Return the deterministic explanation, or None when retrieval FAILED (no explanation is produced)."""
    if data.retrieval_status == "FAILED":
        return None

    # Retrieval for a symbol target is file-level history (SYMBOL_HISTORY_FILE_LEVEL). The conclusions therefore name only
    # the path, and the note states that the symbol is not separated from that history.
    path = _single_line(data.target_path)
    scope = path
    symbol_note = (
        f" The symbol {_single_line(data.symbol)} is not separated from the file history. "
        "Commit relevance to the symbol is not established."
        if data.symbol
        else ""
    )
    limits = " ".join(data.limitation_messages)
    blame_note = (
        f" Blame attributes {data.verified_blame_ranges} line range(s) in the target to verified commits."
        if data.verified_blame_ranges
        else ""
    )

    if data.classification == "DOCUMENTED":
        conclusion = f"Verified repository history records {data.verified_commit_count} commit(s) that changed {scope}."
        co_change_note = (
            f" Documentation changed in {data.co_changed_document_count} of these commits. That co-change does not "
            "establish a content relation or intent."
            if data.co_changed_document_count
            else ""
        )
        established = (
            f"{conclusion} These records establish that the changes occurred. They do not state why."
            f"{blame_note}{co_change_note}{symbol_note}"
        )
        unknown = f"Unknown: {_NOT_ESTABLISHED_WHY}, and {_HISTORY_OUTSIDE_SCOPE}."
        help_text = "Evidence that would help: the diff of each listed commit, to see what each change did."
    elif data.classification == "PARTIAL_EVIDENCE":
        if data.verified_commit_count:
            conclusion = (
                f"Verified repository history records {data.verified_commit_count} change(s) to {scope}. "
                "Retrieval was incomplete, so the supported portion is limited to these records."
            )
        else:
            conclusion = (
                f"Retrieval was incomplete, and no verified change to {scope} was retrieved. "
                "No historical statement is supported for the part that was not retrieved."
            )
        established = f"{conclusion}{blame_note}{symbol_note}"
        unknown = f"Unknown: {_NOT_ESTABLISHED_WHY}, and the history that the incomplete retrieval did not cover."
        help_text = "Evidence that would help: the complete history for the target, from a full clone."
    elif data.classification == "INFERRED":
        conclusion = (
            f"Documentation changed in {data.co_changed_document_count} commit(s) that also changed {scope}. "
            "No verified content relation was established, so this is an inference only."
        )
        established = f"{conclusion}{symbol_note}"
        unknown = (
            f"Unknown: whether the documentation change concerns {scope}, and {_NOT_ESTABLISHED_WHY}."
        )
        help_text = "Evidence that would help: the documentation diff for those commits, and the pull request or issue discussion."
    elif data.classification == "INSUFFICIENT_EVIDENCE":
        conclusion = None
        established = (
            f"The available evidence about {scope} does not support a reliable conclusion.{symbol_note} "
            "No historical conclusion is stated."
        )
        unknown = f"Unknown: whether {scope} has a documented change history, and {_NOT_ESTABLISHED_WHY}."
        help_text = "Evidence that would help: complete history for the target, from a full clone or a broader retrieval."
    else:
        raise ValueError("classification is required for a non-failed explanation")

    parts = [established, unknown]
    if limits:
        parts.append(f"Limitations: {limits}")
    parts.append(help_text)
    return Explanation(text=" ".join(parts), conclusion=conclusion)
