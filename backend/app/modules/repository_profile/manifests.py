"""Manifest parsing for the repository profile (Spec 4 sections 4.3 and 5).

Manifest text is untrusted data. It is parsed with `json` and `tomllib` only, never executed or evaluated, and only
dependency names, tool names and script names are kept. Script bodies are never kept, because they are repository-controlled
command text. A script name is kept only if it matches a strict pattern, so it can later be used in a generated command
without any quoting concern.
"""

from __future__ import annotations

import json
import re
import tomllib
from dataclasses import dataclass
from typing import Literal

Role = Literal["FRAMEWORK", "TEST_TOOL", "LINT_TOOL", "INTEGRATION", "BUILD_TOOL"]

SAFE_SCRIPT = re.compile(r"^[a-z0-9][a-z0-9:_-]{0,39}$")
_REQUIREMENT_NAME = re.compile(r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)")

# Known package names mapped to a role. Only these are reported, so an arbitrary dependency list is never echoed.
_NPM: dict[str, tuple[Role, str]] = {
    "react": ("FRAMEWORK", "React"),
    "vue": ("FRAMEWORK", "Vue"),
    "@angular/core": ("FRAMEWORK", "Angular"),
    "svelte": ("FRAMEWORK", "Svelte"),
    "next": ("FRAMEWORK", "Next.js"),
    "express": ("FRAMEWORK", "Express"),
    "@nestjs/core": ("FRAMEWORK", "NestJS"),
    "three": ("FRAMEWORK", "Three.js"),
    "vite": ("BUILD_TOOL", "Vite"),
    "typescript": ("BUILD_TOOL", "TypeScript"),
    "vitest": ("TEST_TOOL", "Vitest"),
    "jest": ("TEST_TOOL", "Jest"),
    "mocha": ("TEST_TOOL", "Mocha"),
    "@playwright/test": ("TEST_TOOL", "Playwright"),
    "cypress": ("TEST_TOOL", "Cypress"),
    "eslint": ("LINT_TOOL", "ESLint"),
    "prettier": ("LINT_TOOL", "Prettier"),
    "axios": ("INTEGRATION", "axios (HTTP client)"),
    "@octokit/rest": ("INTEGRATION", "Octokit (GitHub API client)"),
    "aws-sdk": ("INTEGRATION", "AWS SDK"),
    "stripe": ("INTEGRATION", "Stripe client"),
    "openai": ("INTEGRATION", "OpenAI client"),
    "firebase": ("INTEGRATION", "Firebase client"),
    "pg": ("INTEGRATION", "PostgreSQL client"),
    "mongoose": ("INTEGRATION", "MongoDB client"),
    "prisma": ("INTEGRATION", "Prisma (database)"),
    "redis": ("INTEGRATION", "Redis client"),
}
_PYTHON: dict[str, tuple[Role, str]] = {
    "fastapi": ("FRAMEWORK", "FastAPI"),
    "django": ("FRAMEWORK", "Django"),
    "flask": ("FRAMEWORK", "Flask"),
    "pydantic": ("FRAMEWORK", "Pydantic"),
    "pytest": ("TEST_TOOL", "pytest"),
    "hypothesis": ("TEST_TOOL", "Hypothesis"),
    "ruff": ("LINT_TOOL", "Ruff"),
    "black": ("LINT_TOOL", "Black"),
    "flake8": ("LINT_TOOL", "Flake8"),
    "mypy": ("LINT_TOOL", "mypy"),
    "requests": ("INTEGRATION", "requests (HTTP client)"),
    "httpx": ("INTEGRATION", "httpx (HTTP client)"),
    "boto3": ("INTEGRATION", "AWS SDK (boto3)"),
    "stripe": ("INTEGRATION", "Stripe client"),
    "openai": ("INTEGRATION", "OpenAI client"),
    "sqlalchemy": ("INTEGRATION", "SQLAlchemy (database)"),
    "psycopg2": ("INTEGRATION", "PostgreSQL client"),
    "pymongo": ("INTEGRATION", "MongoDB client"),
    "redis": ("INTEGRATION", "Redis client"),
    "celery": ("INTEGRATION", "Celery (task queue)"),
}
_PYTHON_TOOL_TABLES: dict[str, tuple[Role, str]] = {
    "ruff": ("LINT_TOOL", "Ruff"),
    "black": ("LINT_TOOL", "Black"),
    "mypy": ("LINT_TOOL", "mypy"),
    "pytest": ("TEST_TOOL", "pytest"),
}


@dataclass(frozen=True)
class ManifestFinding:
    """One named thing read from a manifest."""

    role: Role | Literal["SCRIPT"]
    name: str


def parse_package_json(text: str) -> list[ManifestFinding]:
    try:
        document = json.loads(text)
    except (ValueError, RecursionError):
        return []
    if not isinstance(document, dict):
        return []
    found: dict[tuple[str, str], ManifestFinding] = {}
    for section in ("dependencies", "devDependencies"):
        table = document.get(section)
        if isinstance(table, dict):
            for key in table:
                if isinstance(key, str) and key in _NPM:
                    role, label = _NPM[key]
                    found[(role, label)] = ManifestFinding(role, label)
    scripts = document.get("scripts")
    if isinstance(scripts, dict):
        for key in scripts:
            if isinstance(key, str) and key in {"test", "lint", "build", "format", "typecheck"} and SAFE_SCRIPT.match(key):
                found[("SCRIPT", key)] = ManifestFinding("SCRIPT", key)
    return list(found.values())


def parse_requirements(text: str) -> list[ManifestFinding]:
    found: dict[tuple[str, str], ManifestFinding] = {}
    for line in text.splitlines()[:2000]:
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "-")):
            continue
        match = _REQUIREMENT_NAME.match(stripped)
        if match:
            key = match.group(1).lower().replace("_", "-")
            if key in _PYTHON:
                role, label = _PYTHON[key]
                found[(role, label)] = ManifestFinding(role, label)
    return list(found.values())


def parse_pyproject(text: str) -> list[ManifestFinding]:
    try:
        document = tomllib.loads(text)
    except (tomllib.TOMLDecodeError, RecursionError, ValueError):
        return []
    found: dict[tuple[str, str], ManifestFinding] = {}
    project = document.get("project")
    names: list[str] = []
    if isinstance(project, dict):
        deps = project.get("dependencies")
        if isinstance(deps, list):
            names.extend(item for item in deps if isinstance(item, str))
        optional = project.get("optional-dependencies")
        if isinstance(optional, dict):
            for group in optional.values():
                if isinstance(group, list):
                    names.extend(item for item in group if isinstance(item, str))
    for item in names[:500]:
        match = _REQUIREMENT_NAME.match(item)
        if match:
            key = match.group(1).lower().replace("_", "-")
            if key in _PYTHON:
                role, label = _PYTHON[key]
                found[(role, label)] = ManifestFinding(role, label)
    tool = document.get("tool")
    if isinstance(tool, dict):
        for key in tool:
            if isinstance(key, str) and key in _PYTHON_TOOL_TABLES:
                role, label = _PYTHON_TOOL_TABLES[key]
                found[(role, label)] = ManifestFinding(role, label)
    return list(found.values())
