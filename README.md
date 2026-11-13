# Sean

Summon the reasoning behind the code.

## What Sean Is Designed to Be

Sean is intended to be a local-first engineering intelligence application. It is designed to reconstruct the technical history of a Git repository and explain why code, mechanisms, and decisions exist, using verifiable evidence: commits, blame, pull requests, issues, documentation, and code history.

Sean is not intended to claim knowledge of developers' intent. Each result is specified to separate what the evidence documents, what can be inferred, and what remains unknown. Evidence retrieval, ranking, classification, and a structured explanation are required to work without any AI provider.

The interface is a work tool: a sidebar, one request field, and a unified report (history, findings, a Kiro Advisor with preparable configuration files, and transparency about what was and was not seen). After a successful analysis a short fictional interlude (an Ouija board, then a first-person Three.js game) plays before the report; it can always be skipped and cannot change the report. See [Spec 4](docs/specs/spec-4-engineering-intelligence.md). The earlier two-zone Ouija layout of Spec 2 is superseded where Spec 4 records a departure.

## Status

Initial scaffold only. No runnable application functionality has been implemented or verified. There is no dependency manifest and there are no tests yet. Directory placeholders exist only to hold the intended structure. Everything below describes approved direction, not working behavior.

## Approved Architecture

- Local-first, developed on Windows, and intended to be free to develop and operate. No mandatory paid services or AI providers.
- Modular monolith with one backend and one frontend. No microservices and no unnecessary infrastructure.
- Frontend: React, TypeScript, Vite, Tailwind CSS (`frontend/src/`).
- Backend: Python, FastAPI, Pydantic (`backend/app/`).
- Git CLI for history, GitHub REST API for public pull request and issue metadata, SQLite for persistence, and the Python MCP SDK for MCP.
- Testing: pytest and Hypothesis (backend), Vitest and Playwright (frontend).
- MCP tools are planned to be read-only and to reuse the backend logic.

## Documentation

Approved project documents:

- [Spec 1: Evidence Retrieval](docs/specs/spec-1-evidence-retrieval.md)
- [Spec 2: Ouija Experience](docs/specs/spec-2-ouija-experience.md)
- [Spec 3: Immersive Experience](docs/specs/spec-3-immersive-experience.md) (Phase 4, owner-directed; extends Spec 2)
- [Architecture and Project Setup](docs/architecture/architecture-and-project-setup.md)
- [Kiro Engineering Playbook](docs/development/kiro-engineering-playbook.md)
- [Kiro Operating Guide](docs/development/kiro-operating-guide.md)

Kiro project guidance lives in `.kiro/steering/` and `.kiro/skills/`. Its loading in Kiro has not been verified yet.

## Development

Development uses Kiro IDE as the primary environment, with Kiro CLI as a complement. Work is specification-first and incremental, with human approval at defined gates. Implementation has not started, and open implementation gates are listed in Architecture section 25 and Spec 1 section 25. Setup instructions will be added once the project has package metadata and verified dependencies.

## Running the Frontend (Phase 4)

The frontend is implemented and tested (see `.kiro/reports/phase-status.md`, Phase 4). It requires Node 24 and the backend virtual environment.

```powershell
# Terminal 1: backend (from backend\)
.venv\Scripts\python.exe -m uvicorn app.main_advisor:app --host 127.0.0.1 --port 8000

# Terminal 2: frontend (from frontend\)
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend (override with `SEAN_BACKEND_URL`). The repository ID is typed and must be registered with the backend. Sound is off until you enable it in the interface.

Tests, from `frontend\`: `npx vitest run` for unit, component, and integration tests. `npx playwright test e2e/journey.spec.ts` for browser journeys against the real backend on disposable repositories. It uses the installed Microsoft Edge and downloads nothing.
