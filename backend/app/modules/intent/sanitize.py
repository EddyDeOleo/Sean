"""Privacy sanitizer for the text sent to the optional AI reader (Spec 4 section 8; E-D13 AI-3).

Sean keeps the user's original question for every local operation. This module builds a second text for the external request
only. It removes registered repository identifiers, local folder paths, URLs, and repository-relative file names when it can
recognize them with confidence.

It never guesses. An identifier that appears in a place the rules do not recognize makes the whole question unsafe to send,
and the caller then sends nothing to the AI reader. A question that becomes empty is not sent either.

Limits, stated plainly: the sanitizer knows only the identifiers and folder roots in the local registry. A name that is not
registered is ordinary text and is sent as the user typed it. Identifiers are matched as whole words, not inside other words.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

REASON_EMPTY = "EMPTY_AFTER_SANITIZATION"
REASON_AMBIGUOUS = "UNRECOGNIZED_LOCAL_IDENTIFIER"

# File suffixes that mark a bare token as a file name. Technology names such as "Node.js" are not on the list on purpose.
FILE_SUFFIXES = ("py", "pyi", "md", "json", "yml", "yaml", "toml", "txt", "cfg", "ini", "lock", "tsx", "jsx")
_SUFFIX_PATTERN = "|".join(FILE_SUFFIXES)

# A preposition directly in front of a path or identifier is removed with it, so "in C:\x" leaves no dangling word.
_PREPOSITION = r"(?:\b(?:in|at|under|inside|from|within|of|on|into|to|for|about|across)\s+)?"
# A path token ends on a path character, so a sentence's final punctuation is kept.
_PATH_END = r"[^\s\"'<>|?*]*[^\s\"'<>|?*.,;:!)\]}]"

_URL = re.compile(_PREPOSITION + r"(?:https?|ssh|git|file)://[^\s\"'<>]+", re.IGNORECASE)
_WINDOWS = re.compile(_PREPOSITION + r"(?:[A-Za-z]:|\\\\[\w.$-]+)[\\/]" + _PATH_END, re.IGNORECASE)
_UNIX = re.compile(_PREPOSITION + r"(?<![\w:./\\-])(?:/(?:[\w.@+-]+/)+[\w.@+-]+|~[\\/]" + _PATH_END + ")", re.IGNORECASE)
_RELATIVE = re.compile(_PREPOSITION + r"(?<![\w.@+/\\-])[\w.@+-]+(?:[\\/][\w.@+-]+)+", re.IGNORECASE)
_FILE_NAME = re.compile(_PREPOSITION + r"(?<![\w.@+/\\-])[\w-]+\.(?:" + _SUFFIX_PATTERN + r")(?![\w.])", re.IGNORECASE)
_SEPARATOR_AFTER_ID = r"\s*(?:—|–|--|-|:)\s*"


@dataclass(frozen=True)
class Sanitized:
    """`text` is the only text that may leave the machine. When it is None, `reason` says why nothing is sent."""

    text: str | None
    reason: str | None


def _is_path(token: str) -> bool:
    """A repository-relative token is a path when it has two separators, or ends in a known file suffix.

    A single separator without a file suffix ("and/or", "input/output") is ordinary text and is kept. A token made only of
    numbers ("10/12/2026") is a date, not a path, and is kept.
    """
    if re.fullmatch(r"[\d\\/]+", token):
        return False
    separators = len(re.findall(r"[\\/]", token))
    last = re.split(r"[\\/]", token)[-1]
    has_suffix = re.search(r"\.(?:" + _SUFFIX_PATTERN + r")$", last, re.IGNORECASE) is not None
    return separators >= 2 or has_suffix


def _variants(value: str) -> set[str]:
    return {value, value.replace("\\", "/"), value.replace("/", "\\")}


def _identifier_pattern(identifier: str) -> str:
    return r"(?<![\w-])" + re.escape(identifier) + r"(?![\w-])"


def _tidy(text: str, original: str) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    cleaned = re.sub(r"^[\s,:;\-–—]+", "", cleaned)
    cleaned = re.sub(r",\s*,", ",", cleaned)
    cleaned = re.sub(r"\s+([,.?!:;])", r"\1", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()
    if cleaned[:1].islower() and original.lstrip()[:1].isupper():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def sanitize_for_provider(text: str, repository_ids: Iterable[str], local_roots: Iterable[str] = ()) -> Sanitized:
    """Return the sanitized question for the AI reader, or the reason nothing may be sent.

    `text` is the user's original question. It is not changed. `repository_ids` and `local_roots` come from the local registry
    and are used only here, to recognize what must be removed. They are never sent anywhere.
    """
    ids = sorted({identifier for identifier in repository_ids if identifier}, key=len, reverse=True)
    roots = sorted({root for root in local_roots if root}, key=len, reverse=True)
    work = _URL.sub(" ", text)
    for root in roots:
        for variant in _variants(root):
            work = re.sub(_PREPOSITION + re.escape(variant) + r"(?:[\\/][^\s\"'<>|?*]*|(?![\w.-]))", " ", work, flags=re.IGNORECASE)
    work = _WINDOWS.sub(" ", work)
    work = _UNIX.sub(" ", work)
    work = _RELATIVE.sub(lambda match: " " if _is_path(match.group(0).split()[-1]) else match.group(0), work)
    work = _FILE_NAME.sub(" ", work)
    for identifier in ids:
        escaped = re.escape(identifier)
        # "ID - question" and "ID: question" at the start of the question: the convention the parser already uses.
        work = re.sub(r"^\s*" + escaped + _SEPARATOR_AFTER_ID, "", work, flags=re.IGNORECASE)
        # "in repository ID," and "repo ID:" anywhere in the question.
        work = re.sub(
            _PREPOSITION + r"(?:the\s+)?(?:repository|repo|project|codebase)\s+" + escaped + r"(?![\w-])\s*[,:]?\s*",
            " ",
            work,
            flags=re.IGNORECASE,
        )
        # A name with a digit, hyphen, or underscore cannot be an ordinary word: "in kiroween-2026" is removed everywhere.
        if re.search(r"[\d_-]", identifier):
            work = re.sub(_PREPOSITION + _identifier_pattern(identifier) + r"\s*[,:]?\s*", " ", work, flags=re.IGNORECASE)
    # Anything still matching a registered identifier or root is not recognized with confidence. Send nothing.
    for identifier in ids:
        if re.search(_identifier_pattern(identifier), work, flags=re.IGNORECASE):
            return Sanitized(None, REASON_AMBIGUOUS)
    for root in roots:
        if any(variant in work for variant in _variants(root)):
            return Sanitized(None, REASON_AMBIGUOUS)
    cleaned = _tidy(work, text)
    if not re.search(r"[A-Za-z0-9]{2,}", cleaned):
        return Sanitized(None, REASON_EMPTY)
    return Sanitized(cleaned, None)
