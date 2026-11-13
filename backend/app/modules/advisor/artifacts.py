"""Kiro artifact preparation (Spec 4 section 7; Requirement 5).

Sean prepares files for the user to review. It never writes to a repository (repository access is read-only), so "applied" is
never claimed from here. The lifecycle the user sees is: recommended, prepared (this module), exported (a browser download or
copy), and verified (a later analysis finds the committed file byte-identical to the prepared one).

Content comes only from fixed templates filled with values that were observed in the committed tree. Observed strings are
repository text and therefore untrusted: a value that holds a control character, a backtick, or an over-long string is dropped
instead of being written into a file. Every file is validated for its format and scanned for secret-looking text before it is
returned, and a file that fails is returned as invalid, never silently fixed.

Formats and locations were checked against the current kiro.dev documentation on 2026-11-12 (see catalog.py).
"""

from __future__ import annotations

import difflib
import hashlib
import json
import re
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.core.git_runner import GitError, run_git
from app.modules.advisor.contract import AdvisorResult, Recommendation
from app.modules.repository_profile.models import RepositoryProfile

MAX_ARTIFACT_BYTES = 64 * 1024
MAX_DIFF_LINES = 200
MAX_AGENTS = 3
MAX_CAPABILITIES = 10

FileStatus = Literal["NEW", "CONFLICT", "VERIFIED"]

# Where a prepared file may live. Anything else is rejected, so a template bug cannot name an arbitrary path.
_ALLOWED_PATH = re.compile(r"^(\.kiroignore|\.kiro/(steering|specs|hooks|agents|skills)/[A-Za-z0-9][A-Za-z0-9._-]*(/[A-Za-z0-9][A-Za-z0-9._-]*)*)$")
_SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{20,}\b"),
    re.compile(r"\b(ghp|gho|ghu|ghs|github_pat)_[0-9A-Za-z_]{20,}\b"),
    re.compile(r"(?i)\b(api[_-]?key|secret|token|password)\b\s*[:=]\s*[\"']?[A-Za-z0-9/+_-]{12,}"),
)
_HOOK_TRIGGERS = frozenset(
    {"SessionStart", "Stop", "UserPromptSubmit", "PreTaskExec", "PostTaskExec", "PreToolUse", "PostToolUse",
     "PostFileCreate", "PostFileSave", "PostFileDelete", "PreCompact", "PostCompact", "SessionEnd"}
)
_STEERING_MODES = frozenset({"always", "fileMatch", "manual", "auto"})
_NAME = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
_CONTROL = re.compile(r"[\x00-\x1f\x7f`]")
# Repository-controlled names and paths are written into files that Kiro loads as instructions. Only plain identifiers and
# paths may be written: no spaces (so no sentences), no markup characters, no quotes, no backslashes, no "#[[".
_SAFE_TEXT = re.compile(r"[A-Za-z0-9._/@+-]+")


class Validation(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    ok: bool
    problems: list[str]


class ArtifactFile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    path: str
    kind: str
    scope: Literal["REPOSITORY"] = "REPOSITORY"
    content: str
    content_sha256: str
    status: FileStatus
    existing_content: str | None = None
    diff: str | None = None
    alternative_path: str | None = None
    validation: Validation


class ArtifactBundle(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    capability: str
    title: str
    files: list[ArtifactFile]


class Instruction(BaseModel):
    """Guidance for a capability that cannot be a repository file (user-level settings, or a service Sean cannot choose)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    capability: str
    title: str
    scope: str
    steps: list[str]
    snippet: str | None = None
    snippet_language: str | None = None


class Skipped(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    capability: str
    reason: str


VerificationStatus = Literal["ABSENT", "IDENTICAL", "DIFFERENT"]


class Verification(BaseModel):
    """Whether the committed file at a path matches a file the user exported. Sean cannot see uncommitted files."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    path: str
    status: VerificationStatus


class PreviewResult(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    repository_id: str
    head: str
    bundles: list[ArtifactBundle]
    instructions: list[Instruction]
    skipped: list[Skipped]
    verification: list[Verification]


class ArtifactError(Exception):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------- safe text


WITHHELD = "[Withheld: this text looked like a secret, so Sean does not show it.]"


def _looks_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in _SECRET_PATTERNS)


def _safe(value: str | None, limit: int = 200) -> str | None:
    """Return repository-controlled text only if it is safe to write into a file; otherwise None."""
    if value is None or not value or len(value) > limit or _CONTROL.search(value) or not _SAFE_TEXT.fullmatch(value):
        return None
    return value


def _slug(text: str, limit: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:limit].strip("-")
    return slug or "item"


# ---------------------------------------------------------------- check commands (fixed mapping, never repository text)


@dataclass(frozen=True)
class Check:
    label: str
    command: str


def check_commands(profile: RepositoryProfile) -> list[Check]:
    """Commands that the repository's own manifests declare. The mapping is fixed here, so no repository text becomes a command."""
    checks: list[Check] = []
    tools = profile.find("TOOLING")
    scripts = {o.value for o in tools if o.role == "SCRIPT"}
    names = {o.value for o in tools}
    if "npm script: test" in scripts:
        checks.append(Check("Run the tests", "npm run test"))
    elif "pytest" in names:
        checks.append(Check("Run the tests", "python -m pytest -q"))
    if "npm script: lint" in scripts:
        checks.append(Check("Run the linter", "npm run lint"))
    elif "Ruff" in names:
        checks.append(Check("Run the linter", "ruff check ."))
    return checks


_LANGUAGE_EXTENSIONS = {
    "Python": ["py"], "TypeScript": ["ts", "tsx"], "JavaScript": ["js", "jsx", "mjs", "cjs"], "Go": ["go"], "Rust": ["rs"],
    "Java": ["java"], "Kotlin": ["kt"], "C#": ["cs"], "Ruby": ["rb"], "PHP": ["php"],
}


def _source_matcher(profile: RepositoryProfile) -> str | None:
    extensions: list[str] = []
    for item in profile.summary.languages:
        extensions.extend(_LANGUAGE_EXTENSIONS.get(item.language, []))
    if not extensions:
        return None
    return r"\.(" + "|".join(sorted(set(extensions))) + r")$"


# ---------------------------------------------------------------- templates


def _front_matter(fields: dict[str, str]) -> str:
    return "---\n" + "".join(f"{key}: {value}\n" for key, value in fields.items()) + "---\n"


def _steering(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    lines = [
        "# Project conventions",
        "",
        f"Prepared by Sean from what is committed in this repository (commit {profile.head[:8]}). Review it, change it to match how your team really works, then commit it. Sean wrote nothing here that it did not observe.",
        "",
        "## Layout",
    ]
    for language in profile.summary.languages[:6]:
        lines.append(f"- {language.language}: {language.files} source file{'s' if language.files != 1 else ''}")
    for area in profile.summary.areas[:8]:
        name = _safe(area.name, 100)
        if name:
            lines.append(f"- Area `{name}`: {area.source_files} source and {area.test_files} test files")
    conventions = [o for o in profile.find("CONVENTION") if _safe(o.path)]
    if conventions:
        lines += ["", "## Where conventions are written down", "Follow these files. They are included as context:", ""]
        for item in conventions[:8]:
            lines.append(f"#[[file:{item.path}]]")
    checks = check_commands(profile)
    if checks:
        lines += ["", "## Checks the repository declares"]
        for check in checks:
            lines.append(f"- {check.label}: `{check.command}`")
    lines += ["", "## Keeping this file true", "If a convention changes, change this file in the same commit.", ""]
    return [(".kiro/steering/project-conventions.md", "STEERING", _front_matter({"inclusion": "always"}) + "\n".join(lines))]


def _kiroignore(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    lines = [
        "# Prepared by Sean from paths committed in this repository. Review before committing.",
        "# .kiroignore limits what the agent reads. It is not a security boundary. Also add permission deny rules (user level).",
        "",
    ]
    sensitive = [o.path for o in profile.find("SENSITIVE_PATH") if _safe(o.path, 300)]
    patterns: list[str] = []
    if sensitive:
        lines.append("# Secret-bearing files found in the committed tree")
        lines += [f"/{path}" for path in sensitive[:20]]
        lowered = [p.lower() for p in sensitive]
        if any(p.rsplit("/", 1)[-1].startswith(".env") for p in lowered):
            patterns += [".env.*", "!.env.example"]
        for extension in (".pem", ".key", ".p12", ".pfx", ".keystore", ".jks", ".tfstate", ".tfvars"):
            if any(p.endswith(extension) for p in lowered):
                patterns.append(f"*{extension}")
    if patterns:
        lines += ["", "# The same kinds of file elsewhere in the repository", *dict.fromkeys(patterns)]
    generated = [o.value for o in profile.find("GENERATED_TRACKED") if _safe(o.value, 60)]
    if generated:
        lines += ["", "# Generated or installed directories that are committed"]
        lines += [f"{value}/" for value in generated]
    return [(".kiroignore", "KIROIGNORE", "\n".join(lines) + "\n")]


def _spec_scaffold(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    base = ".kiro/specs/feature-template"
    areas = [a.name for a in profile.summary.areas if _safe(a.name, 100)][:6]
    area_text = ", ".join(f"`{a}`" for a in areas) if areas else "the areas of this repository"
    return [
        (
            f"{base}/requirements.md", "SPEC_SCAFFOLD",
            "# Requirements: <feature name>\n\nPrepared by Sean as a starting point. Replace every `<...>` placeholder, then rename this folder.\n\n"
            f"## Scope\nWhich of {area_text} does this feature touch?\n\n## Requirements\n### Requirement 1: <title>\n**User story:** As a <role>, I want <capability>, so that <benefit>.\n\n"
            "#### Acceptance criteria\n1. WHEN <condition> THEN the system SHALL <behavior>.\n2. WHEN <condition> THEN the system SHALL <behavior>.\n",
        ),
        (
            f"{base}/design.md", "SPEC_SCAFFOLD",
            "# Design: <feature name>\n\n## Overview\n<How the feature works, in a few sentences.>\n\n## Components and interfaces\n<What changes, and in which area.>\n\n"
            "## Data and contracts\n<Shapes that cross a boundary.>\n\n## Error handling\n<What can fail, and what the user sees.>\n\n## Testing\n<How each requirement is verified.>\n",
        ),
        (
            f"{base}/tasks.md", "SPEC_SCAFFOLD",
            "# Implementation plan: <feature name>\n\n- [ ] 1. <First task>\n  - <Detail>\n  - _Requirements: 1_\n- [ ] 2. <Second task>\n  - _Requirements: 1_\n",
        ),
    ]


def _bugfix_scaffold(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    recurrence = [o for o in profile.find("FIX_RECURRENCE") if _safe(o.path, 300)]
    target = recurrence[0] if recurrence else None
    subject = target.path if target and target.path else "<file or module>"
    count = f"{target.count} fix-labelled commits changed it" if target and target.count else "fix-labelled commits changed it"
    base = f".kiro/specs/bugfix-{_slug(subject)}"
    return [
        (
            f"{base}/bugfix.md", "BUGFIX_SPEC_SCAFFOLD",
            f"# Bugfix: <defect title>\n\nPrepared by Sean. The history of `{subject}` shows that {count}. Commit subjects only label a change; they do not prove its cause, so confirm the defect before relying on this file.\n\n"
            "## Current behavior (defect)\n1. WHEN <condition> THEN the system <wrong behavior>.\n\n## Expected behavior (correct)\n1. WHEN <condition> THEN the system SHALL <right behavior>.\n\n"
            "## Unchanged behavior (regression prevention)\n1. WHEN <related condition> THEN the system SHALL CONTINUE TO <existing behavior>.\n",
        ),
        (
            f"{base}/design.md", "BUGFIX_SPEC_SCAFFOLD",
            f"# Design: fix for <defect title>\n\n## Root cause\n<What in `{subject}` produces the wrong behavior, and why earlier fixes did not prevent it.>\n\n## Fix\n<The change.>\n\n## Regression test\n<The test that fails before the fix and passes after it.>\n",
        ),
        (
            f"{base}/tasks.md", "BUGFIX_SPEC_SCAFFOLD",
            "# Tasks\n\n- [ ] 1. Write a test that reproduces the defect\n- [ ] 2. Implement the fix\n- [ ] 3. Confirm the unchanged behavior still holds\n",
        ),
    ]


def _hook(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    checks = check_commands(profile)
    if not checks:
        return []
    matcher = _source_matcher(profile)
    hooks = []
    for check in checks:
        entry: dict[str, object] = {
            "name": check.label,
            "description": f"Sean prepared this from the repository's own manifests: {check.label.lower()} after a file is saved.",
            "trigger": "PostFileSave",
            "action": {"type": "command", "command": check.command},
            "timeout": 120,
        }
        if matcher:
            entry["matcher"] = matcher
        hooks.append(entry)
    return [(".kiro/hooks/run-checks-after-edits.json", "HOOK", json.dumps({"version": "v1", "hooks": hooks}, indent=2) + "\n")]


def _agents(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    total = max(profile.summary.source_files, 1)
    areas = [a for a in profile.summary.areas if a.source_files >= 10 and a.source_files / total >= 0.10 and _safe(a.name, 60)]
    files = []
    for area in areas[:MAX_AGENTS]:
        name = f"{_slug(area.name, 40)}-engineer"
        if not _NAME.fullmatch(name):
            continue
        body = (
            f"You work in the `{area.name}` area of this repository ({area.source_files} source files, {area.test_files} test files).\n\n"
            "Rules:\n- Change files in this area. If a change needs another area, say so and stop.\n- Follow the steering files in `.kiro/steering/`.\n"
            "- Read the code before editing it, and keep tests passing.\n- You have read and write access to files only. Ask before anything else.\n"
        )
        fm = _front_matter({"name": name, "description": json.dumps(f"Works on the {area.name} area of this repository"), "tools": '["read", "write"]'})
        files.append((f".kiro/agents/{name}.md", "AGENT", fm + "\n" + body))
    return files


def _skill(profile: RepositoryProfile) -> list[tuple[str, str, str]]:
    scripts = profile.find("SCRIPT_SET")
    if scripts:
        return [
            (
                ".kiro/skills/repository-scripts/SKILL.md", "SKILL",
                _front_matter({"name": "repository-scripts", "description": "Use when asked to run or change one of this repository's repeatable tasks that live in the scripts folder."})
                + "\n# Repository scripts\n\nThe repeatable tasks of this repository are in `scripts/`.\n\n1. List the folder and read a script fully before running it.\n"
                "2. Say what the script will change, and ask before running one that writes files or calls a network.\n3. After running one, report its output and what changed.\n",
            )
        ]
    docs = [o for o in profile.find("DOCUMENTATION") if o.value == "docs folder"]
    if docs:
        return [
            (
                ".kiro/skills/project-documentation/SKILL.md", "SKILL",
                _front_matter({"name": "project-documentation", "description": "Use when asked how this project works, or when documentation must be updated with a change."})
                + "\n# Project documentation\n\nThe documents are in `docs/`.\n\n1. Read the relevant document before answering.\n2. When a change alters behavior described there, update the document in the same change.\n",
            )
        ]
    return []


_GENERATORS = {
    "STEERING": _steering,
    "KIROIGNORE": _kiroignore,
    "SPEC_SCAFFOLD": _spec_scaffold,
    "BUGFIX_SPEC_SCAFFOLD": _bugfix_scaffold,
    "HOOK": _hook,
    "AGENT": _agents,
    "SKILL": _skill,
}

# Steering and hook files have a stand-alone alternative name. Others must be merged by hand because their name is part of
# their format (an agent's name equals its file name, a skill's name equals its folder).
_ALTERNATIVE = {"STEERING": "-prepared", "HOOK": "-prepared"}


# ---------------------------------------------------------------- validation


def _parse_front_matter(text: str) -> tuple[dict[str, str], str] | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end < 0:
        return None
    fields: dict[str, str] = {}
    for line in text[4:end].split("\n"):
        key, separator, value = line.partition(":")
        if not separator or not key.strip():
            return None
        fields[key.strip()] = value.strip()
    return fields, text[end + 5:]


def validate(kind: str, path: str, content: str) -> Validation:
    problems: list[str] = []
    if not _ALLOWED_PATH.fullmatch(path):
        problems.append("The path is not an allowed Kiro configuration location.")
    if len(content.encode("utf-8")) > MAX_ARTIFACT_BYTES:
        problems.append("The file is larger than the size limit.")
    if _looks_secret(content):
        problems.append("The file contains text that looks like a secret.")
    if kind == "STEERING":
        parsed = _parse_front_matter(content)
        if parsed is None:
            problems.append("The steering file needs front matter.")
        else:
            mode = parsed[0].get("inclusion", "always")
            if mode not in _STEERING_MODES:
                problems.append("The steering inclusion mode is not one Kiro supports.")
    elif kind == "HOOK":
        try:
            document = json.loads(content)
        except ValueError:
            problems.append("The hook file is not valid JSON.")
        else:
            hooks = document.get("hooks") if isinstance(document, dict) else None
            if not isinstance(document, dict) or document.get("version") != "v1" or not isinstance(hooks, list) or not hooks:
                problems.append("The hook file does not have the version and hooks list Kiro expects.")
            else:
                for hook in hooks:
                    action = hook.get("action") if isinstance(hook, dict) else None
                    if not isinstance(hook, dict) or hook.get("trigger") not in _HOOK_TRIGGERS:
                        problems.append("A hook uses a trigger Kiro does not support.")
                    elif not isinstance(action, dict) or action.get("type") not in {"command", "agent"}:
                        problems.append("A hook action type is not supported.")
    elif kind == "AGENT":
        parsed = _parse_front_matter(content)
        stem = path.rsplit("/", 1)[-1].removesuffix(".md")
        if parsed is None or parsed[0].get("name") != stem or not _NAME.fullmatch(stem):
            problems.append("The agent's name must be present and equal its file name.")
    elif kind == "SKILL":
        parsed = _parse_front_matter(content)
        folder = path.split("/")[-2] if path.count("/") >= 2 else ""
        if parsed is None or parsed[0].get("name") != folder or not _NAME.fullmatch(folder):
            problems.append("The skill's name must equal its folder name.")
        elif not parsed[0].get("description") or len(parsed[0]["description"]) > 1024:
            problems.append("The skill needs a description of at most 1024 characters.")
    return Validation(ok=not problems, problems=problems)


# ---------------------------------------------------------------- reading the committed state


def read_committed_text(repo_root, head: str, path: str) -> str | None:
    """The committed text of a file, or None if it does not exist, is too large, or is not text."""
    try:
        blob = run_git(repo_root, "cat-file", options=["-p"], revisions=[f"{head}:{path}"], stdout_limit=MAX_ARTIFACT_BYTES + 1)
    except GitError:
        return None
    if len(blob) > MAX_ARTIFACT_BYTES:
        return None
    try:
        return blob.decode("utf-8")
    except UnicodeDecodeError:
        return None


def verify_committed(repo_root, head: str, existing_paths: set[str], expected: list[tuple[str, str]]) -> list[Verification]:
    """Compare committed files with the hashes of files the user exported. Reads only, from the committed tree."""
    results: list[Verification] = []
    for path, sha256 in expected:
        if not _ALLOWED_PATH.fullmatch(path):
            raise ArtifactError("INVALID_VERIFICATION_PATH")
        if path not in existing_paths:
            results.append(Verification(path=path, status="ABSENT"))
            continue
        try:
            blob = run_git(repo_root, "cat-file", options=["-p"], revisions=[f"{head}:{path}"], stdout_limit=MAX_ARTIFACT_BYTES + 1)
        except GitError:
            results.append(Verification(path=path, status="DIFFERENT"))
            continue
        same = len(blob) <= MAX_ARTIFACT_BYTES and hashlib.sha256(blob).hexdigest() == sha256
        results.append(Verification(path=path, status="IDENTICAL" if same else "DIFFERENT"))
    return results


def _diff(existing: str, prepared: str) -> str:
    lines = list(difflib.unified_diff(existing.splitlines(), prepared.splitlines(), fromfile="committed", tofile="prepared", lineterm=""))
    if len(lines) > MAX_DIFF_LINES:
        lines = lines[:MAX_DIFF_LINES] + [f"... {len(lines) - MAX_DIFF_LINES} more lines not shown"]
    return "\n".join(lines)


def _alternative(kind: str, path: str, existing_paths: set[str]) -> str | None:
    suffix = _ALTERNATIVE.get(kind)
    if suffix is None:
        return None
    stem, dot, extension = path.rpartition(".")
    candidate = f"{stem}{suffix}{dot}{extension}"
    return candidate if candidate not in existing_paths and _ALLOWED_PATH.fullmatch(candidate) else None


# ---------------------------------------------------------------- user-level and service instructions


def _instruction(profile: RepositoryProfile, rec: Recommendation) -> Instruction | None:
    if rec.capability == "PERMISSIONS":
        sensitive = [o.path for o in profile.find("SENSITIVE_PATH") if _safe(o.path, 300)]
        if not sensitive:
            return None
        matches = []
        for path in sensitive[:10]:
            matches += [path, f"**/{path.rsplit('/', 1)[-1]}"]
        snippet = "rules:\n  - capability: fs_read\n    effect: deny\n    match:\n" + "".join(f'      - "{m}"\n' for m in dict.fromkeys(matches))
        return Instruction(
            capability="PERMISSIONS", title="Deny the agent access to secret-bearing files", scope="USER",
            steps=[
                "Permissions are enforced by Kiro and live in your own settings. They cannot be committed to the repository, so Sean does not prepare a repository file.",
                "Add the rules below to your Kiro workspace permissions file, or to the user-level permissions.yaml.",
                "Ask the agent to read one of the listed files and confirm the read is denied.",
            ],
            snippet=snippet, snippet_language="yaml",
        )
    if rec.capability == "MCP":
        return Instruction(
            capability="MCP", title="Connect an external system", scope="REPOSITORY",
            steps=[
                "Sean does not choose a server or invent an endpoint. Pick an MCP server for the system your code depends on.",
                "Add it to .kiro/settings/mcp.json and reference credentials with ${VARIABLE}. Never commit a credential.",
                "List the server's tools in Kiro and run one read-only call to verify it.",
            ],
        )
    if rec.capability == "SUB_AGENTS":
        return Instruction(
            capability="SUB_AGENTS", title="Delegate independent work to sub-agents", scope="REPOSITORY",
            steps=[
                "Define which files each task may touch, so parallel work does not collide.",
                "Prepare the area agents (Custom agents) and give the orchestrating agent the subagent tool.",
                "Run two independent tasks in parallel and confirm there is no shared-file conflict.",
            ],
        )
    return None


# ---------------------------------------------------------------- public entry point


def prepare_artifacts(
    profile: RepositoryProfile,
    advisor: AdvisorResult,
    capabilities: list[str],
    *,
    repo_root,
    existing_paths: set[str],
    verify: list[tuple[str, str]] | None = None,
) -> PreviewResult:
    if len(capabilities) > MAX_CAPABILITIES or len(set(capabilities)) != len(capabilities) or (not capabilities and not verify):
        raise ArtifactError("INVALID_CAPABILITIES")
    by_capability = {r.capability: r for r in advisor.recommendations}
    if any(c not in by_capability for c in capabilities):
        raise ArtifactError("UNKNOWN_CAPABILITY")

    bundles: list[ArtifactBundle] = []
    instructions: list[Instruction] = []
    skipped: list[Skipped] = []
    for capability in capabilities:
        rec = by_capability[capability]
        if rec.recommendation_status not in {"ADOPT_NOW", "CONSIDER"}:
            skipped.append(Skipped(capability=capability, reason="This capability is not recommended for this repository, so nothing is prepared."))
            continue
        if rec.configuration_strategy == "INSTRUCTIONS_ONLY" or rec.artifact_kind is None:
            instruction = _instruction(profile, rec)
            if instruction is None:
                skipped.append(Skipped(capability=capability, reason="This capability has no file to prepare."))
            else:
                instructions.append(instruction)
            continue
        generator = _GENERATORS.get(rec.artifact_kind)
        generated = generator(profile) if generator else []
        if not generated:
            skipped.append(Skipped(capability=capability, reason="The repository does not provide what this file needs, so Sean prepared nothing rather than guess."))
            continue
        files: list[ArtifactFile] = []
        for path, kind, content in generated:
            validation = validate(kind, path, content)
            digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
            status: FileStatus = "NEW"
            existing: str | None = None
            diff: str | None = None
            alternative: str | None = None
            if path in existing_paths:
                existing = read_committed_text(repo_root, profile.head, path)
                if existing is not None and existing == content:
                    status = "VERIFIED"
                else:
                    status = "CONFLICT"
                    if existing is not None:
                        diff = _diff(existing, content)
                    alternative = _alternative(kind, path, existing_paths)
            # Text that looks like a secret is never sent to the browser, whether it is ours or already committed.
            shown = content
            if _looks_secret(content):
                shown = WITHHELD
            if _looks_secret(existing or "") or _looks_secret(diff or ""):
                existing, diff = None, None
            files.append(
                ArtifactFile(
                    path=path, kind=kind, content=shown, content_sha256=digest, status=status,
                    existing_content=existing if status == "CONFLICT" else None, diff=diff, alternative_path=alternative, validation=validation,
                )
            )
        bundles.append(ArtifactBundle(capability=capability, title=rec.title, files=files))
    verification = verify_committed(repo_root, profile.head, existing_paths, verify or [])
    return PreviewResult(
        repository_id=profile.repository_id, head=profile.head, bundles=bundles, instructions=instructions, skipped=skipped,
        verification=verification,
    )
