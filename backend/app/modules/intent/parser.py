"""Request interpretation (Spec 4 section 8).

`interpret` turns one sentence into a structured plan. The deterministic parser decides everything it can. The optional
Gemini hint (see gemini.py) is consulted only when the parser could not resolve a target, and every hint it returns is
re-validated here: a repository must be registered and a path must exist in the committed tree. Nothing a model says is
trusted.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.modules.intent.gemini import HintOutcome

MAX_SENTENCE_LENGTH = 2000
MAX_CANDIDATES = 5
MAX_SYMBOL_LENGTH = 256
MAX_CANDIDATE_WORDS = 20

Mode = Literal["INVESTIGATE", "ADVISE", "NEEDS_TARGET", "UNRESOLVED"]
Interpreter = Literal["deterministic", "gemini"]
AIStatus = Literal[
    "NOT_REQUESTED",
    "NOT_NEEDED",
    "AI_USED",
    "AI_NO_USABLE_ANSWER",
    "AI_TIMEOUT",
    "AI_HTTP_ERROR",
    "AI_CONNECTION_FAILED",
    "AI_PROTOCOL_ERROR",
    "AI_RESPONSE_TOO_LARGE",
    "AI_INVALID_REPLY",
    "AI_UNEXPECTED",
]

_GITHUB_URL = re.compile(r"^https://github\.com/([A-Za-z0-9-]{1,39})/([A-Za-z0-9._-]{1,100}?)(?:\.git)?/?$")
_SEPARATOR = re.compile(r"^\s*(?:—|–|--|-|:)\s*")
_PATH_TOKEN = re.compile(r"[A-Za-z0-9_./\\-]*[A-Za-z0-9_-]\.[A-Za-z0-9]{1,8}")
_SYMBOL_BACKTICK = re.compile(r"`([A-Za-z_][A-Za-z0-9_.]*)`")
_SYMBOL_WORD = re.compile(r"\b(?:function|method|class|symbol)\s+`?([A-Za-z_][A-Za-z0-9_.]*)`?", re.IGNORECASE)
_ADVISE_WORDS = re.compile(
    r"\b(kiro|workflow|workflows|engineering practices?|improv\w*|recommend\w*|opportunit\w*|steering|hooks?|specs?|"
    r"agents?|skills?|automat\w*)\b",
    re.IGNORECASE,
)
_WORD = re.compile(r"[A-Za-z][A-Za-z0-9_]{3,}")
_STOPWORDS = frozenset(
    "this that with from have what when where which about does why how was were been being into over under "
    "their there then than them they these those would could should repository code file files explain "
    "investigate analyze analyse please".split()
)
_SOURCE_SUFFIXES = (".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".go", ".rs", ".cs", ".rb", ".php", ".md")


@dataclass(frozen=True)
class RepositoryRef:
    repository_id: str
    github: tuple[str, str] | None  # (owner, name), lowercase


class InterpretedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    mode: Mode
    interpreter: Interpreter
    repository_id: str | None = None
    target_path: str | None = None
    symbol: str | None = None
    question: str
    candidates: list[str] = []
    message: str | None = None
    # What happened with the optional AI reader. Never a reason to hide the deterministic answer.
    ai_status: AIStatus = "NOT_REQUESTED"


# A hint from an optional model. Its value is untrusted and is checked by _accept_hint.
Hint = Callable[[str], HintOutcome]
TreePaths = Callable[[str], list[str]]


def _unused(hint: Hint | None) -> AIStatus:
    """The status of a request that never needed the AI reader: it was offered, or it was not offered at all."""
    return "NOT_NEEDED" if hint is not None else "NOT_REQUESTED"


def _clean_token(token: str) -> str:
    return token.strip().rstrip(",;:)'\"").lstrip("('\"")


def _split_reference(text: str, refs: dict[str, RepositoryRef]) -> tuple[RepositoryRef | None, str | None, str]:
    """Return (reference, problem, remainder). A reference is only taken from the first token, with a separator after it."""
    stripped = text.strip()
    parts = stripped.split(None, 1)
    if not parts:
        return None, None, ""
    first = parts[0].rstrip(":")
    remainder = parts[1] if len(parts) > 1 else ""
    colon = parts[0].endswith(":") and len(parts[0]) > 1
    has_separator = colon or bool(_SEPARATOR.match(remainder))
    match = _GITHUB_URL.match(first)
    if match and (has_separator or not remainder):
        owner, name = match.group(1).lower(), match.group(2).lower()
        for ref in refs.values():
            if ref.github == (owner, name):
                return ref, None, _SEPARATOR.sub("", remainder, count=1).strip()
        return None, "That GitHub repository is not registered. Sean analyzes registered local repositories and does not clone.", remainder
    ref = refs.get(first.lower()) if has_separator or not remainder else None
    if ref is not None:
        return ref, None, _SEPARATOR.sub("", remainder, count=1).strip()
    return None, None, stripped


def _find_path(text: str, tree: set[str]) -> str | None:
    for raw in _PATH_TOKEN.findall(text):
        token = _clean_token(raw).replace("\\", "/")
        if token in tree:
            return token
    return None


def _find_symbol(text: str) -> str | None:
    match = _SYMBOL_BACKTICK.search(text) or _SYMBOL_WORD.search(text)
    if match and len(match.group(1)) <= MAX_SYMBOL_LENGTH:
        return match.group(1)
    return None


def _candidates(question: str, tree: list[str]) -> list[str]:
    words = sorted({w.lower() for w in _WORD.findall(question)} - _STOPWORDS)[:MAX_CANDIDATE_WORDS]
    scored: list[tuple[int, int, str]] = []
    for path in tree:
        if not path.lower().endswith(_SOURCE_SUFFIXES):
            continue
        lowered = path.lower()
        score = sum(1 for word in words if word in lowered)
        if score:
            scored.append((-score, len(path), path))
    scored.sort()
    return [path for _, _, path in scored[:MAX_CANDIDATES]]


def interpret(
    sentence: str,
    refs: dict[str, RepositoryRef],
    tree_paths: TreePaths,
    *,
    selected_repository_id: str | None = None,
    hint: Hint | None = None,
) -> InterpretedRequest:
    text = " ".join(sentence.split())[:MAX_SENTENCE_LENGTH]
    if not text:
        return InterpretedRequest(mode="UNRESOLVED", interpreter="deterministic", question="", message="Describe what you want to investigate.")
    ref, problem, rest = _split_reference(text, refs)
    if problem:
        return InterpretedRequest(mode="UNRESOLVED", interpreter="deterministic", question=text, message=problem)
    if ref is None:
        if selected_repository_id and selected_repository_id in refs:
            ref = refs[selected_repository_id]
        elif len(refs) == 1:
            ref = next(iter(refs.values()))
        rest = text
    if ref is None:
        return InterpretedRequest(
            mode="UNRESOLVED", interpreter="deterministic", question=text,
            message="Choose a registered repository, or start the request with its ID followed by a dash.",
        )
    question = rest.strip() or text
    tree_list = tree_paths(ref.repository_id)
    tree = set(tree_list)
    path = _find_path(question, tree)
    symbol = _find_symbol(question) if path else None
    if path:
        return InterpretedRequest(
            mode="INVESTIGATE", interpreter="deterministic", repository_id=ref.repository_id, target_path=path,
            symbol=symbol, question=question, ai_status=_unused(hint),
        )
    if _ADVISE_WORDS.search(question):
        return InterpretedRequest(
            mode="ADVISE", interpreter="deterministic", repository_id=ref.repository_id, question=question, ai_status=_unused(hint)
        )
    ai_status: AIStatus = _unused(hint)
    if hint is not None:
        outcome = hint(question)
        ai_status = outcome.status  # type: ignore[assignment]
        accepted = _accept_hint(outcome.value, ref, tree, question)
        if accepted is not None:
            return accepted.model_copy(update={"ai_status": "AI_USED"})
        if outcome.status == "AI_USED":
            ai_status = "AI_NO_USABLE_ANSWER"
    candidates = _candidates(question, tree_list)
    return InterpretedRequest(
        mode="NEEDS_TARGET", interpreter="deterministic", repository_id=ref.repository_id, question=question, candidates=candidates,
        message=(
            "Choose the file this question is about."
            if candidates
            else "Name a file in the question, or ask for an engineering workflow review of the repository."
        ),
        ai_status=ai_status,
    )


def _accept_hint(raw: dict | None, ref: RepositoryRef, tree: set[str], question: str) -> InterpretedRequest | None:
    """Accept a model hint only if it passes the same checks as user text. Anything else is discarded."""
    if not isinstance(raw, dict):
        return None
    if raw.get("repository_id") not in (None, ref.repository_id):
        return None
    path = raw.get("path")
    if isinstance(path, str) and path in tree:
        symbol = raw.get("symbol")
        valid_symbol = symbol if isinstance(symbol, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]*", symbol) and len(symbol) <= MAX_SYMBOL_LENGTH else None
        return InterpretedRequest(
            mode="INVESTIGATE", interpreter="gemini", repository_id=ref.repository_id, target_path=path, symbol=valid_symbol, question=question
        )
    if raw.get("mode") == "ADVISE":
        return InterpretedRequest(mode="ADVISE", interpreter="gemini", repository_id=ref.repository_id, question=question)
    return None
