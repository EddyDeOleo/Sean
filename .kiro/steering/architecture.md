---
inclusion: always
---

# Architecture

Authoritative source: `docs/architecture/architecture-and-project-setup.md`. Consult the current approved version (check its Version and Status header) before relying on this file. If this file conflicts with it, the document wins. Stop and report the conflict.

## Principles

- Local-first, developed and run on Windows.
- Zero-cost development is mandatory. No mandatory paid services or paid AI APIs.
- Modular monolith: one backend application and one frontend application. No microservices.
- Minimal runtime: at most two persistent development processes (backend, frontend dev server). An MCP STDIO entry point may be launched by its host and must reuse backend modules.
- No speculative infrastructure. No Redis, Kubernetes, mandatory Docker, distributed queues, cloud databases, or unnecessary abstraction layers (interfaces, factories, managers, wrappers).
- Evidence retrieval, ranking, classification, and explanation must work without an AI provider.

## Approved Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS (native CSS where necessary).
- Backend: Python, FastAPI, Pydantic.
- Git CLI for history. GitHub REST API for public PR and issue metadata.
- SQLite for MVP persistence and cache.
- Official Python MCP SDK.
- Testing: pytest, Hypothesis, Vitest, Playwright.
- Tooling: Python `venv` and `pip` for the backend, `npm` for the frontend. Do not assume an editable-install command or a `dev` extra exists until package metadata defines it.
- Frontend state: native React state and `useReducer`. Animation: CSS and browser-native APIs.
- Do not add another styling framework or an animation library without explicit approval.
- Exact versions and Windows compatibility must be verified before project initialization.

## Layout

- Backend root: `backend/app/`. Frontend root: `frontend/src/`.
- The scaffold may contain additional organizational placeholders. Do not migrate or rename established directories solely to match a conventional package layout.
- Create files and directories when their implementation phase begins. Do not create empty feature modules, test suites, agents, hooks, or Skills before their purpose is defined.

## Backend Modules (`backend/app/`)

- `api`: FastAPI routes, HTTP transport, and request/response handling.
- `core`: shared configuration, logging, common utilities, and foundational concerns.
- `modules/repository`: repository discovery, identity, validation, and safe path handling.
- `modules/symbol_resolution`: symbol identification, source context, and code-region resolution.
- `modules/git_history`: read-only Git retrieval (commits, blame, diffs, renames, deletions, moves).
- `modules/github`: PR and issue metadata retrieval and reference validation.
- `modules/evidence`: evidence models, normalization, provenance, identity, integrity, deduplication, ranking, and evidence-related validation.
- `modules/investigation`: retrieval orchestration, retrieval status, epistemic classification, and result assembly.
- `modules/explanation`: deterministic explanation synthesis, plus optional AI-assisted wording.
- `modules/mcp`: MCP tool definitions, transport entry point, and adapters that reuse application logic.

Persistence and caching are implementation concerns of these modules. They are not extra architectural modules. Do not add a persistence framework or abstraction layer just to mirror a conventional pattern.

## Frontend Organization (`frontend/src/`)

- `app/`, `components/` (`ouija/`, `evidence/`, `layout/`), `features/`, `hooks/`, `services/`, `styles/`, `types/`.
- Organize implementation by feature: put feature-specific files in `features/` when that feature begins. Keep shared visual components in `components/`, and shared hooks, services, styles, and types in their existing locations.
- Audio code goes in an appropriate feature when audio implementation begins. Do not create an empty audio directory in advance.

## MCP

- MCP is an integration interface, not a reason for a separate backend.
- HTTP API and MCP call the same application logic. No duplicated retrieval or ranking logic.
- Two distinct purposes, never to be conflated:
  - Sean as an MCP provider: a product integration exposing read-only investigation tools.
  - Kiro as an MCP client: optional external engineering tools.
  Neither justifies a separate persistent backend service.
- STDIO is the proposed local transport. Its compatibility with the installed Kiro is unverified until explicitly tested.
- Do not create or configure an MCP server entry in Kiro until the entry point exists, contracts are implemented, validation and security behavior are tested, read-only behavior is confirmed, and Windows host compatibility is verified. Do not create an empty MCP configuration to reserve one.

## UI

- Evidence & History on the LEFT, Ouija Board on the RIGHT. No third primary zone. A header or status strip is not a zone.
- Narrow screens stack the zones vertically.
- Local data lives outside the repository by default (`%LOCALAPPDATA%\Sean\`).

## Gates

Non-trivial architecture, stack, or scope changes need human approval. Implementation gates in Architecture section 25 and Spec 1 section 25 apply (see the `implement-spec` skill).
