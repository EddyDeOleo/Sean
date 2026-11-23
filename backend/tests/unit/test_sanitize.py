"""Privacy sanitizer tests (Spec 4 section 8; E-D13 AI-3). The sanitized text is the only text that may leave the machine.

The original question is never modified. Ambiguous identifiers are not guessed at: the question is not sent.
"""

from __future__ import annotations

import re

import pytest

from app.modules.intent.sanitize import REASON_AMBIGUOUS, REASON_EMPTY, sanitize_for_provider

IDS = ["kiroween-2026", "sean"]
ROOTS = [r"C:\Users\User\source\repos\Sean"]


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # The existing "ID:" convention at the start of the question.
        ("kiroween-2026: Why was the caching system introduced?", "Why was the caching system introduced?"),
        # A repository phrase in the middle of the question.
        ("In repository kiroween-2026, how does the Advisor work?", "How does the Advisor work?"),
        # Nothing to remove: the question is returned unchanged.
        ("Why was the caching system introduced?", "Why was the caching system introduced?"),
        # An identifier placed naturally in a sentence.
        ("Why was the caching system introduced in kiroween-2026?", "Why was the caching system introduced?"),
        # Windows drive path, with the preposition in front of it.
        ("Analyze the implementation in C:\\Projects\\Kiroween", "Analyze the implementation"),
        # Unix absolute path, with the identifier inside it.
        ("Why does the cache in /home/developer/kiroween behave this way?", "Why does the cache behave this way?"),
        # A repository-relative file, and a URL that names the repository.
        ("Why is src/billing.py slow?", "Why is slow?"),
        ("Review billing.py at https://github.com/owner/kiroween-2026/blob/main/x.py", "Review"),
        # Technical words and dates that resemble paths or identifiers are kept.
        ("Why does it use Node.js and React?", "Why does it use Node.js and React?"),
        ("Why is the cache slow on 10/12/2026?", "Why is the cache slow on 10/12/2026?"),
        ("Why does the and/or logic matter?", "Why does the and/or logic matter?"),
        # The registered folder root, and a folder under it.
        ("Explain how the advisor works in C:\\Users\\User\\source\\repos\\Sean\\backend", "Explain how the advisor works"),
        # Repeated identifiers are all removed.
        ("kiroween-2026 and kiroween-2026 again, why?", "and again, why?"),
    ],
)
def test_recognized_identifiers_and_paths_are_removed(text, expected):
    result = sanitize_for_provider(text, IDS, ROOTS)
    assert result.text == expected and result.reason is None


@pytest.mark.parametrize(
    ("text", "ids", "reason"),
    [
        # "sample" is an ordinary word and a registered name here. Its meaning cannot be decided, so nothing is sent.
        ("Explain the sample rate in the audio code", ["sample"], REASON_AMBIGUOUS),
        # A bare registered name with no recognized context is not guessed at.
        ("sean", IDS, REASON_AMBIGUOUS),
        # Only an identifier and a separator remain: nothing meaningful is left to send.
        ("kiroween-2026 -", IDS, REASON_EMPTY),
        ("   ", IDS, REASON_EMPTY),
        ("", IDS, REASON_EMPTY),
    ],
)
def test_ambiguous_or_empty_questions_send_nothing(text, ids, reason):
    result = sanitize_for_provider(text, ids, ROOTS)
    assert result.text is None and result.reason == reason


def test_the_original_text_is_never_changed():
    original = "kiroween-2026: Why does the cache in /home/developer/kiroween behave this way?"
    snapshot = str(original)
    sanitize_for_provider(original, IDS, ROOTS)
    assert original == snapshot


@pytest.mark.parametrize(
    "text",
    [
        "kiroween-2026: Why was the caching system introduced?",
        "In repository kiroween-2026, how does the Advisor work?",
        "Why is src/billing.py slow in C:\\Projects\\Kiroween?",
        "Why does the cache in /home/developer/kiroween behave this way?",
        "Why does it run in C:\\Users\\User\\source\\repos\\Sean\\backend and in /srv/app/kiroween-2026?",
    ],
)
def test_nothing_that_leaves_contains_an_identifier_or_a_registered_root(text):
    result = sanitize_for_provider(text, IDS, ROOTS)
    assert result.text is not None
    lowered = result.text.lower()
    for identifier in IDS:
        assert not re.search(r"(?<![\w-])" + re.escape(identifier) + r"(?![\w-])", lowered)
    assert "c:\\" not in lowered and "/home/" not in lowered and "/srv/" not in lowered
    assert "source\\repos" not in lowered
