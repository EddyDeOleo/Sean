# Design: Engineering Intelligence, Kiro Repository Advisor, and 3D Survival Horror (Native Spec)

Authority: `docs/specs/spec-4-engineering-intelligence.md`. This file records the implementation shape only.

## Data flow

```
natural-language request
  -> POST /interpret            (deterministic; optional Gemini, text + IDs only)
  -> POST /investigations       (Phase 3, unchanged; only when a target is resolved)
  -> POST /repositories/{id}/profile   (observations + Advisor output)
  -> frontend assembles an immutable report snapshot
  -> snapshot saved to IndexedDB
  -> Ouija overlay -> 3D game -> report
```

## Backend modules

```
backend/app/
  main_advisor.py                    new entry point: create_app(registry) + advisor router
  api/advisor_routes.py              GET /repositories, POST /repositories/{id}/profile, /interpret, /artifacts/preview
  modules/repository_profile/
    models.py                        Observation, RepositoryProfile (Pydantic, extra=forbid)
    scanner.py                       run_git ls-tree / cat-file / log -> observations (bounded)
    manifests.py                     package.json, requirements*.txt, pyproject.toml parsing (json, tomllib)
  modules/advisor/
    catalog.py                       capability catalog (scope, paths, docs_url), verified 2026-11-12
    contract.py                      Recommendation, AdvisorResult, validation rules
    rules.py                         one pure function per capability
    roadmap.py                       banding and ordering
    artifacts.py                     templates, validators, conflict and diff (stage 4)
  modules/intent/
    parser.py                        deterministic interpretation
    gemini.py                        optional adapter, injected transport (stage 2, not live)
```

Registry access reuses `resolve_repository` from the Phase 3 registry module. No existing module is modified.

## Frontend layout (stages 3 to 7)

```
frontend/src/
  app/            AppShell, routes (view state), InvestigationView (kept, adapted)
  features/
    analysis/     analysisMachine, advisorClient, interpretClient
    report/       reportSnapshot, reportStore (IndexedDB), ReportView sections
    artifacts/    ArtifactPreview, lifecycle
    experience/   experienceMachine (Ouija and game phases only)
    game/         pure modules (map, collision, objectives, flashlight, monster) + three renderer
    audio/        AudioController (extended)
  components/     layout, sidebar, ouija, evidence, settings
```

## Key decisions

| Decision | Reason |
|---|---|
| New entry point instead of editing `main.py` | Keeps the 71-file Phase 3 hash baseline intact. |
| Scan `HEAD` tree, not the working tree | Same data an investigation uses. No working-tree reads. No uncommitted surprises. |
| Observation IDs as evidence references | Every recommendation traces to a recorded observation. |
| Categorical confidence | No unjustified numeric precision. |
| Plain Three.js with pure-logic modules | Testable rules, no React reconciliation inside the render loop, fewer dependencies than React Three Fiber. |
| Sean never writes to repositories | Repository access is read-only by the project security rule. Export is a browser download. |
