"""Read-only repository scanner (Spec 4 sections 4.3 and 5).

Everything is read from the committed tree at one commit, through the Phase 3 guarded Git runner (`ls-tree`, `cat-file`,
`log`, `rev-parse`). The working tree is never opened, symbolic links and submodules are never followed, and no repository
content is executed. Commit subjects and file text are untrusted: they are matched against fixed expressions and counted.

Limits are local to this module (Spec 4 section 4.3). Reaching one is reported, never hidden.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from pathlib import PurePosixPath

from app.core.git_runner import GitError, run_git
from app.modules.repository_profile import manifests
from app.modules.repository_profile.models import (
    KIRO_AGENTS,
    KIRO_AGENTS_MD,
    KIRO_HOOKS,
    KIRO_IGNORE,
    KIRO_MCP,
    KIRO_SKILLS,
    KIRO_SPECS,
    KIRO_STEERING,
    AreaSummary,
    HistorySummary,
    LanguageSummary,
    Observation,
    ProfileError,
    ProfileLimitation,
    ProfileSummary,
    RepositoryProfile,
    observation_id,
)

MAX_TREE_ENTRIES = 20_000
TREE_STDOUT_LIMIT = 8 * 1024 * 1024
MANIFEST_BYTES = 64 * 1024
MAX_MANIFESTS_PARSED = 20
MAX_COMMITS = 500
MAX_PATHS_PER_COMMIT = 200
LOG_STDOUT_LIMIT = 8 * 1024 * 1024
MAX_OBSERVATIONS = 800
# Repository-controlled strings are echoed in responses. Anything longer than these bounds is counted but not echoed.
MAX_ECHOED_PATH = 300
MAX_AREA_NAME = 100
MAX_AREAS = 50
RECURRING_FIX_THRESHOLD = 3
MAX_RECURRENCE_OBSERVATIONS = 5

LIMIT_TREE_TRUNCATED = "TREE_TRUNCATED"
LIMIT_SHALLOW = "SHALLOW_CLONE"
LIMIT_HISTORY_WINDOW = "HISTORY_WINDOW"
LIMIT_UNREADABLE_PATHS = "UNREADABLE_PATHS_SKIPPED"
LIMIT_HISTORY_UNREADABLE = "HISTORY_UNREADABLE"
LIMIT_OBSERVATIONS_CAPPED = "OBSERVATIONS_CAPPED"
LIMIT_MANIFEST_SKIPPED = "MANIFEST_NOT_READ"
LIMIT_NO_PLATFORM_DATA = "PULL_REQUESTS_ISSUES_CI_NOT_ANALYZED"

_LANGUAGES = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".cs": "C#",
    ".c": "C/C++",
    ".h": "C/C++",
    ".cc": "C/C++",
    ".cpp": "C/C++",
    ".hpp": "C/C++",
    ".rb": "Ruby",
    ".php": "PHP",
    ".swift": "Swift",
    ".scala": "Scala",
}
_GENERATED_SEGMENTS = frozenset({"node_modules", "dist", "build", ".venv", "venv", "__pycache__", ".next", "coverage"})
_TEST_SEGMENTS = frozenset({"test", "tests", "__tests__"})
_TEST_NAME = re.compile(r"(^test_.+\.py$)|(_test\.(py|go)$)|(\.(test|spec)\.(ts|tsx|js|jsx)$)|(Tests?\.(java|cs|kt)$)")
_GENERIC_ROOTS = frozenset({"src", "lib", "app", "apps", "packages", "services", "modules"})
_CONVENTION_FILES = (
    re.compile(r"^\.editorconfig$"),
    re.compile(r"^\.eslintrc(\..+)?$"),
    re.compile(r"^eslint\.config\..+$"),
    re.compile(r"^\.prettierrc(\..+)?$"),
    re.compile(r"^prettier\.config\..+$"),
    re.compile(r"^\.?ruff\.toml$"),
    re.compile(r"^\.flake8$"),
    re.compile(r"^\.pylintrc$"),
    re.compile(r"^mypy\.ini$"),
    re.compile(r"^\.pre-commit-config\.yaml$"),
    re.compile(r"^\.golangci\.ya?ml$"),
    re.compile(r"^rustfmt\.toml$"),
    re.compile(r"^\.clang-format$"),
)
_MANIFEST_NAMES = {
    "package.json": "package.json",
    "pyproject.toml": "pyproject.toml",
    "go.mod": "go.mod",
    "cargo.toml": "Cargo.toml",
    "pom.xml": "pom.xml",
    "build.gradle": "build.gradle",
    "build.gradle.kts": "build.gradle.kts",
    "gemfile": "Gemfile",
    "composer.json": "composer.json",
}
_SENSITIVE_EXTENSIONS = (".pem", ".key", ".p12", ".pfx", ".keystore", ".jks", ".tfstate", ".tfvars")
_SENSITIVE_NAMES = frozenset(
    {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519", "credentials.json", ".git-credentials", ".pypirc", ".netrc", ".npmrc"}
)
_ENV_SAFE_SUFFIXES = (".example", ".sample", ".template", ".dist")
_INTEGRATION_FILE = re.compile(r"^(openapi|swagger)\.(json|ya?ml)$|^(docker-)?compose(\.[\w-]+)?\.ya?ml$")
_CI_PATHS = (
    re.compile(r"^\.github/workflows/[^/]+\.ya?ml$"),
    re.compile(r"^\.gitlab-ci\.yml$"),
    re.compile(r"^azure-pipelines\.ya?ml$"),
    re.compile(r"^Jenkinsfile$"),
    re.compile(r"^\.circleci/config\.yml$"),
)
_ADR_PATH = re.compile(r"^(docs/)?(adr|decisions|architecture/decisions)/.+\.md$", re.IGNORECASE)

_SENTINEL = "@@SEAN-PROFILE-COMMIT@@"
_HEADER = re.compile(rf"^{re.escape(_SENTINEL)}([0-9a-f]{{40,64}})\x00(.*)\x00(.*)$")
_FIX_SUBJECT = re.compile(r"^\s*(fix|fixes|fixed|bugfix|hotfix)\b", re.IGNORECASE)
_FEATURE_SUBJECT = re.compile(r"^\s*(feat|feature|add|implement)\b", re.IGNORECASE)
_REVERT_SUBJECT = re.compile(r"^\s*revert\b", re.IGNORECASE)
_CONVENTIONAL_SUBJECT = re.compile(r"^\s*(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([^)]*\))?!?:")


@dataclass(frozen=True)
class _Entry:
    path: str
    mode: str


class _Collector:
    """Collects observations, dropping repeats and enforcing the cap."""

    def __init__(self) -> None:
        self._items: dict[str, Observation] = {}
        self.capped = False

    def add(self, **fields) -> None:
        path = fields.get("path")
        if path is not None and len(path) > MAX_ECHOED_PATH:
            return
        item = Observation(
            observation_id=observation_id(fields["kind"], fields.get("path"), fields.get("value")), **fields
        )
        if item.observation_id in self._items:
            return
        if len(self._items) >= MAX_OBSERVATIONS:
            self.capped = True
            return
        self._items[item.observation_id] = item

    def items(self) -> list[Observation]:
        return list(self._items.values())


def language_of(path: str) -> str | None:
    return _LANGUAGES.get(PurePosixPath(path).suffix.lower())


def _segments(path: str) -> list[str]:
    return path.split("/")


def is_generated_path(path: str) -> bool:
    return any(segment in _GENERATED_SEGMENTS for segment in _segments(path)[:-1])


def is_test_path(path: str) -> bool:
    parts = _segments(path)
    return any(part in _TEST_SEGMENTS for part in parts[:-1]) or bool(_TEST_NAME.search(parts[-1]))


def area_of(path: str) -> str:
    parts = _segments(path)
    if len(parts) == 1:
        return "."
    if parts[0] in _GENERIC_ROOTS and len(parts) >= 3:
        return f"{parts[0]}/{parts[1]}"
    return parts[0]


def committed_paths(repo_root) -> list[str]:
    """Paths of regular files in the committed tree at HEAD, bounded. Returns an empty list if the tree cannot be read."""
    try:
        head = run_git(repo_root, "rev-parse", revisions=["HEAD"]).decode("ascii", "replace").strip()
        if not re.fullmatch(r"[0-9a-f]{40,64}", head):
            return []
        output = run_git(
            repo_root, "ls-tree", options=["-r", "-z", "--full-tree"], revisions=[head], stdout_limit=TREE_STDOUT_LIMIT
        )
    except GitError:
        return []
    entries, _ = _parse_tree(output)
    return [e.path for e in entries[:MAX_TREE_ENTRIES] if e.mode in {"100644", "100755"}]


def _unquote_git_path(line: str) -> str:
    """Undo Git's C-style quoting of a path that has non-ASCII or special characters. Unquoted lines are returned as they are."""
    if len(line) < 2 or not (line.startswith('"') and line.endswith('"')):
        return line
    body = line[1:-1]
    out = bytearray()
    simple = {"\\": 92, '"': 34, "t": 9, "n": 10, "r": 13, "a": 7, "b": 8, "f": 12, "v": 11}
    index = 0
    while index < len(body):
        char = body[index]
        if char != "\\":
            out.extend(char.encode("utf-8"))
            index += 1
            continue
        index += 1
        if index >= len(body):
            return line
        escape = body[index]
        if escape in simple:
            out.append(simple[escape])
            index += 1
        elif escape in "01234567":
            digits = body[index:index + 3]
            if len(digits) < 3 or any(d not in "01234567" for d in digits):
                return line
            value = int(digits, 8)
            if value > 255:
                return line
            out.append(value)
            index += 3
        else:
            return line
    try:
        return out.decode("utf-8")
    except UnicodeDecodeError:
        return line


def current_head(repo_root) -> str | None:
    """The full name of HEAD, or None if the repository has no readable commit."""
    try:
        head = run_git(repo_root, "rev-parse", revisions=["HEAD"]).decode("ascii", "replace").strip()
    except GitError:
        return None
    return head if re.fullmatch(r"[0-9a-f]{40,64}", head) else None


def _parse_tree(output: bytes) -> tuple[list[_Entry], int]:
    entries: list[_Entry] = []
    skipped = 0
    for raw in output.split(b"\x00"):
        if not raw:
            continue
        head, separator, name = raw.partition(b"\t")
        if not separator:
            continue
        fields = head.split(b" ")
        if len(fields) != 3:
            continue
        try:
            path = name.decode("utf-8")
        except UnicodeDecodeError:
            skipped += 1
            continue
        if not path or "\x00" in path:
            skipped += 1
            continue
        entries.append(_Entry(path=path, mode=fields[0].decode("ascii", "replace")))
    return entries, skipped


def scan_repository(repo_root, repository_id: str) -> RepositoryProfile:
    """Build the profile of the committed tree at HEAD. Raises ProfileError with a fixed code on failure."""
    try:
        head = run_git(repo_root, "rev-parse", revisions=["HEAD"]).decode("ascii", "replace").strip()
    except GitError:
        raise ProfileError("NO_COMMITS") from None
    if not re.fullmatch(r"[0-9a-f]{40,64}", head):
        raise ProfileError("NO_COMMITS")
    try:
        shallow = run_git(repo_root, "rev-parse", options=["--is-shallow-repository"]).strip() == b"true"
    except GitError:
        shallow = False
    try:
        tree_output = run_git(
            repo_root, "ls-tree", options=["-r", "-z", "--full-tree"], revisions=[head], stdout_limit=TREE_STDOUT_LIMIT
        )
    except GitError:
        raise ProfileError("TREE_UNAVAILABLE") from None
    entries, unreadable = _parse_tree(tree_output)
    truncated = len(entries) > MAX_TREE_ENTRIES
    entries = entries[:MAX_TREE_ENTRIES]
    # Symbolic links (120000) and submodules (160000) are listed but never read or counted as source.
    files = [e for e in entries if e.mode in {"100644", "100755"}]

    collector = _Collector()
    limitations: list[ProfileLimitation] = []

    source_counts: Counter[str] = Counter()
    area_source: Counter[str] = Counter()
    area_test: Counter[str] = Counter()
    test_files = 0
    source_files = 0
    source_like: set[str] = set()
    for entry in files:
        path = entry.path
        if is_generated_path(path):
            continue
        language = language_of(path)
        if language is None:
            continue
        source_like.add(path)
        if is_test_path(path):
            test_files += 1
            area_test[area_of(path)] += 1
        else:
            source_files += 1
            source_counts[language] += 1
            area_source[area_of(path)] += 1

    languages = [LanguageSummary(language=name, files=count) for name, count in source_counts.most_common()]
    area_names = sorted(
        (n for n in set(area_source) | set(area_test) if len(n) <= MAX_AREA_NAME), key=lambda n: (-area_source[n], n)
    )[:MAX_AREAS]
    areas = [AreaSummary(name=n, source_files=area_source[n], test_files=area_test[n]) for n in area_names]

    for item in languages:
        collector.add(
            kind="LANGUAGE", value=item.language, count=item.files, classification="DOCUMENTED", source="GIT_TREE",
            explanation=f"{item.files} committed source file(s) with a {item.language} extension.",
        )
    for item in areas[:12]:
        collector.add(
            kind="AREA", path=item.name, value=item.name, count=item.source_files, classification="DOCUMENTED",
            source="GIT_TREE", explanation=f"{item.source_files} source and {item.test_files} test file(s) under this area.",
        )
    if test_files:
        collector.add(
            kind="TEST_LAYOUT", value="test files", count=test_files, classification="DOCUMENTED", source="GIT_TREE",
            explanation=f"{test_files} committed file(s) match test naming or test directory conventions.",
        )

    _tree_observations(files, collector)
    manifest_paths = _manifest_observations(files, collector)
    skipped_manifests = _read_manifests(repo_root, head, manifest_paths, collector)

    history, recurrence, history_read = _scan_history(repo_root, head, source_like)
    _history_observations(history, recurrence, collector)

    history_limited = history.commits_scanned >= MAX_COMMITS
    if truncated:
        limitations.append(ProfileLimitation(code=LIMIT_TREE_TRUNCATED, message=f"The tree has more than {MAX_TREE_ENTRIES} entries. Only the first {MAX_TREE_ENTRIES} were analyzed."))
    if shallow:
        limitations.append(ProfileLimitation(code=LIMIT_SHALLOW, message="The repository is a shallow clone. History-based signals cover only the available commits."))
    if history_limited:
        limitations.append(ProfileLimitation(code=LIMIT_HISTORY_WINDOW, message=f"Only the latest {MAX_COMMITS} commits were read. History counts describe that window."))
    if not history_read:
        limitations.append(ProfileLimitation(code=LIMIT_HISTORY_UNREADABLE, message="Commit history could not be read, so history signals are missing. Their absence says nothing about the repository."))
    if collector.capped:
        limitations.append(ProfileLimitation(code=LIMIT_OBSERVATIONS_CAPPED, message=f"More than {MAX_OBSERVATIONS} observations were found. The rest were dropped."))
    if unreadable:
        limitations.append(ProfileLimitation(code=LIMIT_UNREADABLE_PATHS, message=f"{unreadable} path(s) are not valid UTF-8 and were skipped."))
    if skipped_manifests:
        limitations.append(ProfileLimitation(code=LIMIT_MANIFEST_SKIPPED, message=f"{skipped_manifests} manifest(s) were too large, unreadable or over the parse limit and were not read."))
    limitations.append(ProfileLimitation(code=LIMIT_NO_PLATFORM_DATA, message="Pull requests, issues and CI results are not read in this analysis. Only the committed tree and commit history are used."))

    return RepositoryProfile(
        repository_id=repository_id,
        head=head,
        truncated=truncated,
        history_limited=history_limited,
        shallow=shallow,
        summary=ProfileSummary(
            tree_entries=len(entries),
            source_files=source_files,
            test_files=test_files,
            languages=languages,
            areas=areas,
            history=history,
        ),
        observations=collector.items(),
        limitations=limitations,
    )


def _tree_observations(files: list[_Entry], collector: _Collector) -> None:
    paths = [e.path for e in files]

    steering = [p for p in paths if re.fullmatch(r"\.kiro/steering/[^/]+\.md", p)]
    hooks = [p for p in paths if re.fullmatch(r"\.kiro/hooks/[^/]+\.json", p)]
    agents = [p for p in paths if re.fullmatch(r"\.kiro/agents/[^/]+\.(md|json)", p)]
    skills = [p for p in paths if re.fullmatch(r"\.kiro/skills/[^/]+/SKILL\.md", p)]
    specs = sorted({p.split("/")[2] for p in paths if re.match(r"\.kiro/specs/[^/]+/[^/]+\.md$", p)})
    mcp = [p for p in paths if p == ".kiro/settings/mcp.json"]
    ignore = [p for p in paths if PurePosixPath(p).name == ".kiroignore"]
    agents_md = [p for p in paths if PurePosixPath(p).name == "AGENTS.md"]
    for value, found, label in (
        (KIRO_STEERING, steering, "Kiro steering file(s)"),
        (KIRO_HOOKS, hooks, "Kiro hook file(s)"),
        (KIRO_AGENTS, agents, "Kiro custom agent file(s)"),
        (KIRO_SKILLS, skills, "Kiro skill(s)"),
        (KIRO_MCP, mcp, "project MCP configuration file"),
        (KIRO_IGNORE, ignore, ".kiroignore file(s)"),
        (KIRO_AGENTS_MD, agents_md, "AGENTS.md file(s)"),
    ):
        if found:
            collector.add(
                kind="KIRO_CONFIG", path=found[0], value=value, count=len(found), classification="DOCUMENTED",
                source="GIT_TREE", explanation=f"{len(found)} committed {label}.",
            )
    if specs:
        collector.add(
            kind="KIRO_CONFIG", path=f".kiro/specs/{specs[0]}", value=KIRO_SPECS, count=len(specs),
            classification="DOCUMENTED", source="GIT_TREE", explanation=f"{len(specs)} committed Kiro spec folder(s).",
        )

    conventions = [p for p in paths if any(rx.match(PurePosixPath(p).name) for rx in _CONVENTION_FILES)]
    for path in conventions[:10]:
        collector.add(
            kind="CONVENTION", path=path, value=PurePosixPath(path).name, classification="DOCUMENTED",
            source="GIT_TREE", explanation="A committed style, lint or formatting configuration file.",
        )
    for path in paths:
        if re.fullmatch(r"(?i)contributing(\.\w+)?", path):
            collector.add(
                kind="CONVENTION", path=path, value="contribution guide", classification="DOCUMENTED",
                source="GIT_TREE", explanation="A committed contribution guide.",
            )
    for name in ("README", "ARCHITECTURE", "SECURITY", "CHANGELOG", "CONTRIBUTING"):
        match = next((p for p in paths if re.fullmatch(rf"(?i){name}(\.\w+)?", p)), None)
        if match:
            collector.add(
                kind="DOCUMENTATION", path=match, value=name.title(), classification="DOCUMENTED", source="GIT_TREE",
                explanation=f"A committed {name.title()} document at the repository root.",
            )
    doc_files = [p for p in paths if p.lower().startswith("docs/") and p.lower().endswith((".md", ".rst"))]
    if doc_files:
        collector.add(
            kind="DOCUMENTATION", path="docs", value="docs folder", count=len(doc_files), classification="DOCUMENTED",
            source="GIT_TREE", explanation=f"{len(doc_files)} committed document(s) under docs/.",
        )
    adr = [p for p in paths if _ADR_PATH.match(p)]
    if adr:
        collector.add(
            kind="DOCUMENTATION", path=adr[0], value="decision records", count=len(adr), classification="DOCUMENTED",
            source="GIT_TREE", explanation=f"{len(adr)} committed architecture decision record(s).",
        )

    for path in paths:
        if any(rx.match(path) for rx in _CI_PATHS):
            collector.add(
                kind="CI_CONFIG", path=path, value=PurePosixPath(path).name, classification="DOCUMENTED",
                source="GIT_TREE", explanation="A committed continuous-integration configuration file.",
            )

    sensitive = []
    for path in paths:
        name = PurePosixPath(path).name
        lower = name.lower()
        is_env = lower == ".env" or (lower.startswith(".env.") and not lower.endswith(_ENV_SAFE_SUFFIXES))
        if is_env or lower.endswith(_SENSITIVE_EXTENSIONS) or lower in _SENSITIVE_NAMES:
            sensitive.append(path)
    for path in sensitive[:20]:
        collector.add(
            kind="SENSITIVE_PATH", path=path, value="tracked", classification="DOCUMENTED", source="GIT_TREE",
            explanation="A path with a name that usually holds secrets is committed. Only the path was read, never the content.",
        )

    generated: Counter[str] = Counter()
    for path in paths:
        for segment in _segments(path)[:-1]:
            if segment in _GENERATED_SEGMENTS:
                generated[segment] += 1
                break
    for segment, count in generated.items():
        collector.add(
            kind="GENERATED_TRACKED", path=segment, value=segment, count=count, classification="DOCUMENTED",
            source="GIT_TREE", explanation=f"{count} committed file(s) under a directory named {segment}, which usually holds generated or installed files.",
        )

    scripts = [p for p in paths if p.startswith("scripts/") and p.count("/") == 1]
    if scripts:
        collector.add(
            kind="SCRIPT_SET", path="scripts", value="scripts folder", count=len(scripts), classification="DOCUMENTED",
            source="GIT_TREE", explanation=f"{len(scripts)} committed file(s) directly under scripts/.",
        )

    for path in paths:
        if _INTEGRATION_FILE.match(PurePosixPath(path).name.lower()):
            collector.add(
                kind="INTEGRATION", path=path, value=PurePosixPath(path).name, classification="DOCUMENTED",
                source="GIT_TREE", explanation="A committed API description or service composition file.",
            )


def _manifest_observations(files: list[_Entry], collector: _Collector) -> list[str]:
    found: list[str] = []
    for entry in files:
        name = PurePosixPath(entry.path).name
        lower = name.lower()
        if is_generated_path(entry.path):
            continue
        label = _MANIFEST_NAMES.get(lower)
        if label is None and re.fullmatch(r"requirements[\w.-]*\.txt", lower):
            label = "requirements.txt"
        if label is None and lower.endswith(".csproj"):
            label = ".csproj"
        if label is None:
            continue
        collector.add(
            kind="MANIFEST", path=entry.path, value=label, classification="DOCUMENTED", source="GIT_TREE",
            explanation=f"A committed {label} dependency or build manifest.",
        )
        if label in {"package.json", "pyproject.toml", "requirements.txt"}:
            found.append(entry.path)
    found.sort(key=lambda p: (p.count("/"), p))
    return found


def _read_manifests(repo_root, head: str, paths: list[str], collector: _Collector) -> int:
    skipped = max(0, len(paths) - MAX_MANIFESTS_PARSED)
    for path in paths[:MAX_MANIFESTS_PARSED]:
        try:
            blob = run_git(repo_root, "cat-file", options=["-p"], revisions=[f"{head}:{path}"], stdout_limit=MANIFEST_BYTES + 1)
            if len(blob) > MANIFEST_BYTES:
                skipped += 1
                continue
            text = blob.decode("utf-8")
        except (GitError, UnicodeDecodeError):
            skipped += 1
            continue
        name = PurePosixPath(path).name.lower()
        if name == "package.json":
            findings = manifests.parse_package_json(text)
        elif name == "pyproject.toml":
            findings = manifests.parse_pyproject(text)
        else:
            findings = manifests.parse_requirements(text)
        for finding in findings:
            if finding.role == "SCRIPT":
                collector.add(
                    kind="TOOLING", path=path, value=f"npm script: {finding.name}", role="SCRIPT",
                    classification="DOCUMENTED", source="GIT_BLOB", explanation=f"package.json declares a '{finding.name}' script.",
                )
            elif finding.role == "FRAMEWORK":
                collector.add(
                    kind="FRAMEWORK", path=path, value=finding.name, classification="DOCUMENTED", source="GIT_BLOB",
                    explanation=f"{finding.name} is declared as a dependency in {path}.",
                )
            elif finding.role == "INTEGRATION":
                collector.add(
                    kind="INTEGRATION", path=path, value=finding.name, classification="DOCUMENTED", source="GIT_BLOB",
                    explanation=f"{finding.name} is declared as a dependency in {path}.",
                )
            else:
                collector.add(
                    kind="TOOLING", path=path, value=finding.name, role=finding.role, classification="DOCUMENTED",
                    source="GIT_BLOB", explanation=f"{finding.name} is declared in {path}.",
                )
    return skipped


def _scan_history(repo_root, head: str, source_like: set[str]) -> tuple[HistorySummary, Counter[str], bool]:
    empty = HistorySummary(commits_scanned=0, fix_commits=0, feature_commits=0, revert_commits=0, conventional_commits=0, distinct_authors=0)
    try:
        output = run_git(
            repo_root,
            "log",
            options=["--name-only", "-n", str(MAX_COMMITS), f"--format={_SENTINEL}%H%x00%an%x00%s"],
            revisions=[head],
            stdout_limit=LOG_STDOUT_LIMIT,
        )
    except GitError:
        return empty, Counter(), False
    text = output.decode("utf-8", "replace")
    fix = feature = revert = conventional = scanned = 0
    authors: set[str] = set()
    recurrence: Counter[str] = Counter()
    current_is_fix = False
    paths_in_commit = 0
    for line in text.split("\n"):
        header = _HEADER.match(line)
        if header:
            scanned += 1
            authors.add(header.group(2))
            subject = header.group(3)
            current_is_fix = bool(_FIX_SUBJECT.match(subject))
            fix += current_is_fix
            feature += bool(_FEATURE_SUBJECT.match(subject))
            revert += bool(_REVERT_SUBJECT.match(subject))
            conventional += bool(_CONVENTIONAL_SUBJECT.match(subject))
            paths_in_commit = 0
            continue
        if not line or not current_is_fix:
            continue
        paths_in_commit += 1
        if paths_in_commit <= MAX_PATHS_PER_COMMIT:
            path = _unquote_git_path(line)
            if path in source_like:
                recurrence[path] += 1
    summary = HistorySummary(
        commits_scanned=scanned, fix_commits=fix, feature_commits=feature, revert_commits=revert,
        conventional_commits=conventional, distinct_authors=len(authors),
    )
    return summary, recurrence, True


def _history_observations(history: HistorySummary, recurrence: Counter[str], collector: _Collector) -> None:
    if history.commits_scanned == 0:
        return
    for value, count, text in (
        ("commits scanned", history.commits_scanned, "commit(s) were read."),
        ("fix commits", history.fix_commits, "commit subject(s) start with a fix keyword."),
        ("feature commits", history.feature_commits, "commit subject(s) start with a feature keyword."),
        ("revert commits", history.revert_commits, "commit subject(s) start with 'revert'."),
        ("conventional commits", history.conventional_commits, "commit subject(s) follow the conventional-commit form."),
    ):
        collector.add(
            kind="COMMIT_STATS", value=value, count=count, classification="DOCUMENTED", source="GIT_LOG",
            explanation=f"{count} {text}",
        )
    for path, count in recurrence.most_common(MAX_RECURRENCE_OBSERVATIONS):
        if count >= RECURRING_FIX_THRESHOLD:
            collector.add(
                kind="FIX_RECURRENCE", path=path, value="recurring fixes", count=count, classification="INFERRED",
                source="GIT_LOG",
                explanation=(
                    f"{count} fix-labelled commits changed this file. Repeated fixes suggest a defect-prone area. "
                    "The commit subjects label the changes, they do not prove the cause."
                ),
            )
