"""Local evidence retrieval for the AI advisor (Spec 4 section 8; Architecture 'evidence' and 'investigation').

Everything here is local. Files are read from the committed tree at HEAD through the guarded Git runner. Only small excerpts
of the files that matter to the question are kept, each with a stable identifier, its repository-relative path, and its line
range. Nothing is sent from this module: the caller decides what leaves the machine.

Limits, all bounded: a fixed number of excerpts, a fixed size per excerpt and in total, a file size cap, and a cap on how many
candidate files are read. Secret-looking text is redacted before an excerpt is kept, and sensitive file names are never read.
Retrieval never proves absence: a file that was not selected is not evidence that nothing relevant exists.
"""

from __future__ import annotations

import re
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from app.modules.repository_profile.scanner import is_generated_path

MAX_ITEMS = 6
MAX_EXCERPT_LINES = 60
MAX_EXCERPT_CHARS = 1200
MAX_TOTAL_CHARS = 6000
MAX_FILE_BYTES = 64 * 1024
MAX_CANDIDATES_READ = 40
MAX_PER_FOLDER = 2

_STOPWORDS = frozenset(
    "this that with from have what when where which about does why how was were been being into over under their there then "
    "than them they these those would could should repository code file files explain please kind some much more most also "
    "does are the and for you your our can".split()
)
_SENSITIVE_PATH = re.compile(
    r"(^|/)(\.env[^/]*|id_(rsa|dsa|ecdsa|ed25519)[^/]*|[^/]*\.(pem|key|p12|pfx|kdbx)|[^/]*(secret|credential)[^/]*)$",
    re.IGNORECASE,
)
_TEXT_SUFFIXES = (
    ".py", ".ts", ".tsx", ".js", ".jsx", ".md", ".txt", ".rst", ".json", ".yml", ".yaml", ".toml", ".ini", ".cfg", ".sh",
    ".ps1", ".go", ".rs", ".java", ".kt", ".cs", ".rb", ".php", ".html", ".css", ".sql", ".tf", ".hcl", ".xml", ".gradle",
)
_TEXT_NAMES = frozenset({"Dockerfile", "Makefile", "Procfile", "Jenkinsfile", "Gemfile", "Rakefile", "Vagrantfile"})

# Topics recognized from the question words, with the repository paths that usually answer them.
TOPICS: dict[str, tuple[frozenset[str], tuple[str, ...]]] = {
    "deployment": (
        frozenset("deploy deployed deployment deployments hosting hosted release releases production ship shipped docker container containers kubernetes k8s helm terraform infrastructure cloud".split()),
        (r"(^|/)Dockerfile", r"docker-compose", r"^\.github/workflows/", r"(^|/)k8s/", r"(^|/)deploy", r"\.tf$", r"Procfile",
         r"(^|/)(fly|render|vercel|netlify|railway|app)\.(toml|ya?ml|json)$", r"helm/", r"serverless\.", r"\.gitlab-ci\.yml"),
    ),
    "pipeline": (
        frozenset("ci cd pipeline pipelines workflow workflows build builds lint actions automation".split()),
        (r"^\.github/workflows/", r"\.gitlab-ci\.yml", r"azure-pipelines", r"(^|/)Makefile$", r"(^|/)package\.json$",
         r"(^|/)pyproject\.toml$", r"tox\.ini$", r"pytest\.ini$"),
    ),
    "authentication": (
        frozenset("auth authentication authorization login logout session sessions token tokens permission permissions oauth jwt password identity roles".split()),
        (r"auth", r"login", r"session", r"permission", r"middleware", r"security", r"token"),
    ),
    "architecture": (
        frozenset("architecture architectures architectural design decision decisions layer layers layered component components module modules pattern patterns structure depend depends dependency dependencies boundary api http application applications separate".split()),
        (r"(^|/)README", r"^docs/", r"architecture", r"(^|/)adr", r"^(backend|src)/app/(api|modules|core)/", r"CONTRIBUTING"),
    ),
    "domain": (
        frozenset("domain model models entity entities schema schemas type types".split()),
        (r"models?\.py$", r"schema", r"entities", r"domain", r"types?\.ts$", r"contract"),
    ),
}

_SECRET_LINE = re.compile(
    r"(?i)\b(password|passwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|authorization|credential)s?\b(\s*[:=]\s*).*"
)
_PRIVATE_KEY_BLOCK = re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.DOTALL)
_TOKEN = re.compile(r"\b(ghp_|github_pat_|gho_|sk-|gsk_|AKIA)[A-Za-z0-9_\-]{12,}")
_BEARER = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{12,}")


_USER_PATH = re.compile(r"(?i)(?:[A-Za-z]:[\\/](?:Users|Documents and Settings)|/(?:home|Users))[\\/][^\s\"'<>`]*")


def redact(text: str, local_roots: Iterable[str] = ()) -> str:
    """Remove secret-looking material and local folder locations from an excerpt. Ordinary text is left as it is.

    `local_roots` are the registered repository folders. Any copy of them, and any path under a user profile, is replaced
    so that no local folder layout leaves the machine inside an excerpt.
    """
    text = _PRIVATE_KEY_BLOCK.sub("[REDACTED PRIVATE KEY]", text)
    text = _BEARER.sub("Bearer [REDACTED]", text)
    text = _TOKEN.sub("[REDACTED TOKEN]", text)
    text = "\n".join(_SECRET_LINE.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", line) for line in text.split("\n"))
    for root in sorted({root for root in local_roots if root}, key=len, reverse=True):
        for variant in {root, root.replace("\\", "/"), root.replace("/", "\\")}:
            text = re.sub(re.escape(variant) + r"(?:[\\/][^\s\"'<>`]*)?", "[LOCAL REPOSITORY]", text, flags=re.IGNORECASE)
    return _USER_PATH.sub("[LOCAL PATH]", text)


@dataclass(frozen=True)
class EvidenceItem:
    evidence_id: str
    path: str
    start_line: int
    end_line: int
    excerpt: str
    why: str
    commit: str
    classification: str = "DOCUMENTED"


@dataclass
class EvidenceSet:
    items: list[EvidenceItem] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)

    @property
    def ids(self) -> set[str]:
        return {item.evidence_id for item in self.items}


def _is_text_path(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return name in _TEXT_NAMES or path.lower().endswith(_TEXT_SUFFIXES)


def _question_words(question: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z0-9_]{2,}", question.lower()) if w not in _STOPWORDS}


def _score(path: str, words: set[str], topic_patterns: list[str]) -> tuple[int, str]:
    lowered = path.lower()
    reasons: list[str] = []
    score = 0
    name = path.rsplit("/", 1)[-1]
    if any(re.search(pattern, path, re.IGNORECASE) for pattern in topic_patterns):
        score += 3
        reasons.append("matches the topic")
        # A topic named by the file itself (for example architecture.md) is stronger evidence than a folder match.
        if any(re.search(pattern, name, re.IGNORECASE) for pattern in topic_patterns):
            score += 2
    overlap = [w for w in words if w in lowered]
    if overlap:
        score += 2 * len(overlap)
        reasons.append("its path mentions " + ", ".join(sorted(overlap)[:3]))
    if re.search(r"(^|/)README", path, re.IGNORECASE):
        score += 1
    return score, "; ".join(reasons) or "general repository context"


def select_candidates(question: str, tree: list[str]) -> tuple[list[tuple[str, str]], int]:
    """Rank committed files for the question. Returns [(path, why)] up to the read cap, and how many candidates were dropped."""
    words = _question_words(question)
    topic_patterns: list[str] = []
    for keywords, patterns in TOPICS.values():
        if words & keywords:
            topic_patterns.extend(patterns)
    ranked: list[tuple[int, str, str]] = []
    for path in tree:
        if _SENSITIVE_PATH.search(path) or is_generated_path(path) or not _is_text_path(path):
            continue
        score, why = _score(path, words, topic_patterns)
        if score:
            ranked.append((score, path, why))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    # No single folder supplies more than MAX_PER_FOLDER candidates, so the evidence spans the layers of the repository.
    per_folder: Counter[str] = Counter()
    spread: list[tuple[str, str]] = []
    for _, path, why in ranked:
        folder = path.rsplit("/", 1)[0] if "/" in path else ""
        if per_folder[folder] >= MAX_PER_FOLDER:
            continue
        per_folder[folder] += 1
        spread.append((path, why))
    chosen = spread[:MAX_CANDIDATES_READ]
    return chosen, max(0, len(spread) - MAX_CANDIDATES_READ)


def retrieve(
    question: str,
    tree: list[str],
    read: Callable[[str], bytes | None],
    commit: str,
    local_roots: Iterable[str] = (),
) -> EvidenceSet:
    """Build the evidence set for one question. `read` returns the committed bytes of a path, or None when unavailable."""
    result = EvidenceSet()
    candidates, dropped = select_candidates(question, tree)
    if dropped:
        result.limitations.append(f"{dropped} more candidate files matched but were not read, because of the read limit.")
    total = 0
    for path, why in candidates:
        if len(result.items) >= MAX_ITEMS or total >= MAX_TOTAL_CHARS:
            break
        raw = read(path)
        if raw is None or len(raw) > MAX_FILE_BYTES or b"\x00" in raw[:4096]:
            continue
        lines = raw.decode("utf-8", "replace").split("\n")
        excerpt_lines = lines[:MAX_EXCERPT_LINES]
        excerpt = redact("\n".join(excerpt_lines), local_roots)[:MAX_EXCERPT_CHARS]
        if not excerpt.strip():
            continue
        total += len(excerpt)
        result.items.append(
            EvidenceItem(
                evidence_id=f"E{len(result.items) + 1}",
                path=path,
                start_line=1,
                end_line=max(1, min(len(excerpt_lines), excerpt.count("\n") + 1)),
                excerpt=excerpt,
                why=why,
                commit=commit,
            )
        )
    if not result.items:
        result.limitations.append("No committed file relevant to the question was found. That does not prove that nothing relevant exists.")
    return result
