"""Request interpretation (Spec 4 section 8).

`interpret` turns one sentence into a structured plan. The deterministic parser decides everything it can. The optional
Groq hint (see groq.py) is consulted only when the parser could not resolve a target, and every hint it returns is
re-validated here: a repository must be registered and a path must exist in the committed tree. Nothing a model says is
trusted.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.modules.intent.groq import HintOutcome
from app.modules.intent.sanitize import sanitize_for_provider

MAX_SENTENCE_LENGTH = 2000
MAX_CANDIDATES = 5
MAX_SYMBOL_LENGTH = 256
MAX_CANDIDATE_WORDS = 20
# Logs carry fixed reason codes only: never the question, the sanitized text, a path, an identifier, or a model value.
logger = logging.getLogger("sean.intent")
NEEDS_TARGET_ANSWERED = "NEEDS_TARGET_ANSWERED"
_KNOWN_MODES = ("INVESTIGATE", "ADVISE", "NEEDS_TARGET")

Mode = Literal["INVESTIGATE", "ADVISE", "NEEDS_TARGET", "UNRESOLVED"]
Interpreter = Literal["deterministic", "groq"]
AIStatus = Literal[
    "NOT_REQUESTED",
    "NOT_NEEDED",
    "AI_USED",
    "AI_NO_USABLE_ANSWER",
    "AI_NOT_SENT",
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


# A hint from an optional model. Its value is untrusted and is checked by _judge_hint.
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
    local_roots: Iterable[str] = (),
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
        # The original question stays local. Only the sanitized text may leave the machine.
        sanitized = sanitize_for_provider(question, refs.keys(), local_roots)
        if sanitized.text is None:
            logger.info("AI reader not used: the question could not be made safe to send (%s)", sanitized.reason)
            ai_status = "AI_NOT_SENT"
        else:
            outcome = hint(sanitized.text)
            ai_status = outcome.status  # type: ignore[assignment]
            accepted, reason = _judge_hint(outcome.value, ref, tree, question)
            if accepted is not None:
                logger.info("AI answer accepted: %s", reason)
                return accepted.model_copy(update={"ai_status": "AI_USED"})
            if outcome.status == "AI_USED":
                if reason == NEEDS_TARGET_ANSWERED:
                    ai_status = "AI_USED"
                else:
                    logger.warning("AI answer not used: %s", reason)
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


def _judge_hint(raw: dict | None, ref: RepositoryRef, tree: set[str], question: str) -> tuple[InterpretedRequest | None, str]:
    """Judge a model answer against Sean's accepted contract. Returns (plan, reason).

    A plan is returned only for an answer Sean accepts: a path that exists in the committed tree (INVESTIGATE), or mode ADVISE.
    NEEDS_TARGET_ANSWERED means the model asked for a target. The deterministic plan is kept, and the answer counts as used.
    Every other answer returns (None, reason). `reason` is a fixed code, optionally with the Python type of an unexpected value.
    It never contains the model's text, a path, an identifier, or the question.
    """
    if not isinstance(raw, dict):
        return None, "NOT_AN_OBJECT"
    if raw.get("repository_id") not in (None, ref.repository_id):
        return None, "REPOSITORY_ID_MISMATCH"
    path = raw.get("path")
    if isinstance(path, str) and path in tree:
        symbol = raw.get("symbol")
        valid_symbol = symbol if isinstance(symbol, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_.]*", symbol) and len(symbol) <= MAX_SYMBOL_LENGTH else None
        plan = InterpretedRequest(
            mode="INVESTIGATE", interpreter="groq", repository_id=ref.repository_id, target_path=path, symbol=valid_symbol, question=question
        )
        return plan, "ACCEPTED_TARGET"
    mode = raw.get("mode")
    if mode == "ADVISE":
        return InterpretedRequest(mode="ADVISE", interpreter="groq", repository_id=ref.repository_id, question=question), "ACCEPTED_ADVISE"
    if mode == "NEEDS_TARGET":
        return None, NEEDS_TARGET_ANSWERED
    if mode is None:
        return None, "MODE_MISSING"
    if not isinstance(mode, str):
        return None, f"MODE_NOT_TEXT:{type(mode).__name__}"
    if mode == "INVESTIGATE":
        if path is None:
            return None, "PATH_MISSING"
        if not isinstance(path, str):
            return None, f"PATH_NOT_TEXT:{type(path).__name__}"
        return None, "PATH_NOT_IN_COMMITTED_TREE"
    if mode.strip().upper() in _KNOWN_MODES:
        return None, "MODE_NOT_EXACT"
    return None, "MODE_NOT_ALLOWED"