# Design: Engineering Intelligence, Kiro Repository Advisor, and 3D Survival Horror (Native Spec)

Authority: `docs/specs/spec-4-engineering-intelligence.md`. This file records the implementation shape only.

## Overview

Sean adds repository engineering intelligence to the Phase 3 investigation backend. A read-only profile of a registered repository feeds a deterministic Kiro Repository Advisor. The frontend presents the result as an immutable report. A separate, optional interlude (Ouija sequence and 3D game) runs between a successful analysis and the report, and never changes the report. The design keeps the Phase 3 files unchanged, apart from the two owner-authorized amendments in Spec 4 section 16.5.

## Architecture

### Data flow

```
natural-language request
  -> POST /interpret            (deterministic; optional Gemini, text + IDs only)
  -> POST /investigations       (Phase 3, unchanged; only when a target is resolved)
  -> POST /repositories/{id}/profile   (observations + Advisor output)
  -> frontend assembles an immutable report snapshot
  -> snapshot saved to IndexedDB
  -> Ouija overlay -> 3D game -> report
```

### Backend modules

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

## Components and Interfaces

### Endpoints

| Method and path | Result |
|---|---|
| `GET /repositories` | Registered repositories with availability and optional GitHub identity. No filesystem paths. |
| `POST /repositories` | Adds a repository (write to the registry file). Requires `X-Sean-Client: web`. |
| `PUT /repositories/{id}` | Edits a repository name or folder. The identifier cannot change. |
| `DELETE /repositories/{id}` | Removes a registry entry. The folder is not touched. |
| `POST /repositories/{id}/profile` | Read-only profile and Advisor output. |
| `POST /interpret` | Structured plan for a natural-language request. |
| `POST /artifacts/preview` | Generated file, target path, conflict status and diff. Writes nothing. |

Source: Spec 4 sections 4.2 and 16.1.

### Frontend layout (stages 3 to 7)

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

## Data Models

Backend models use Pydantic with `extra=forbid`. Field lists below follow Spec 4 sections 5, 6.2, 7, 8 and 16.

### Observation and profile

- Observation: `observation_id`, `kind`, optional `path`, `value`, `classification` (`DOCUMENTED` or `INFERRED`), `source` (`GIT_TREE`, `GIT_BLOB`, or `GIT_LOG`), and `head` (the commit read).
- Profile: typed observations, derived summaries, and flags for `truncated` and `shallow`. It contains no filesystem paths outside the repository, no file contents beyond parsed manifest fields, and no author names.

### Recommendation

`capability`, `title`, `summary`, `repository_signal`, `evidence_references` (observation IDs), `evidence_classification`, `reasoning`, `expected_benefit`, `priority` (`P1` to `P3`), `recommendation_status` (`ADOPT_NOW`, `CONSIDER`, `NOT_RECOMMENDED`, `INSUFFICIENT_EVIDENCE`), `implementation_effort` (`LOW`, `MEDIUM`, `HIGH`), `prerequisites`, `risks`, `adoption_scope`, `configuration_strategy`, `verification_method`, `confidence` (`HIGH`, `MEDIUM`, `LOW`), and `limitations`. Validation rules are in Spec 4 section 6.2.

### Artifact lifecycle

`RECOMMENDED`, then `ARTIFACT_GENERATED`, then `ARTIFACT_EXPORTED`, then `APPLIED_DETECTED`, then `VERIFIED`. Each state is recorded separately. The UI never claims "applied" from an export.

### Report snapshot

An immutable report stored in one IndexedDB object store, keyed by ID, with a schema version. It is labelled `SAVED SNAPSHOT` and carries its capture time. Loading re-validates every part, and a snapshot that fails validation is discarded.

### Registry entry

Stored in `%LOCALAPPDATA%\Sean\config\repositories.json`. Entry fields: `repository_id`, optional `display_name` (1 to 80 characters), `path` (normalized absolute path), and optional stored fields such as `github`, which edits preserve. The top-level file structure is the one the Phase 3 registry loader reads (`app/modules/repository/registry.py`).

### Interpretation result

`{mode, repository_id, target?, question, unresolved?}`, with `mode` as `INVESTIGATE`, `ADVISE`, or `NEEDS_TARGET`. The response also states which interpreter answered (`deterministic` or `gemini`).

## Correctness Properties

### Property 1: Read-only profile

For any repository the profile is built from, the scanner reads only the committed tree at `HEAD` through the guarded Git runner. No repository file is written and no repository content is executed.

**Validates: Requirements 1.1, 1.6**

### Property 2: Classification integrity

For any recommendation, `evidence_classification` equals the weakest classification among its referenced observations. An incomplete scan yields `PARTIAL_EVIDENCE`. A classification is never upgraded beyond the evidence.

**Validates: Requirements 1.2, 1.3, 2.2**

### Property 3: Traceability

For any `ADOPT_NOW` or `CONSIDER` recommendation, at least one referenced observation exists in the profile. No capability is recommended without a rule that fired.

**Validates: Requirements 2.1, 2.2**

### Property 4: No success from failure

For any `FAILED`, `INVALID`, `REJECTED`, or `CANCELLED` outcome, no classification or conclusion is produced, and the Ouija and reveal do not start.

**Validates: Requirements 4.6, 6.2**

### Property 5: Interlude isolation

For any game or Ouija run, the report snapshot is never written or changed.

**Validates: Requirements 7.5**

### Property 6: Capability scope

For any capability whose scope is not `REPOSITORY`, no repository artifact is produced.

**Validates: Requirements 2.4, 5.1**

### Property 7: No silent overwrite

For any target path that exists at `HEAD`, the artifact preview shows `CONFLICT` and a diff, and the default action is a new file name.

**Validates: Requirements 5.2**

### Property 8: Registry preservation

For any registry write, only the entry being added or edited changes. Other entries keep their content and order, including entries that fail validation now.

**Validates: Spec 4 section 16.3 (no requirement in requirements.md covers registry writes yet)**

## Error Handling

- Errors use the body `{code, message, retryable}`. Messages are fixed strings. They never echo request values or paths (Spec 4 sections 4.2 and 16.1).
- Scan limits and unreadable history set `truncated`, `shallow`, or `PARTIAL_EVIDENCE` with `LOW` confidence. An error is never reported as proof that evidence is absent.
- A GitHub or network failure is a retrieval limitation. It is never reported as evidence that something does not exist.
- An Advisor failure does not discard a successful investigation (Requirement 4.6).
- AI interpreter failure falls back to the deterministic parser, and the response says `interpreter: "deterministic"`. AI failure is never a retrieval failure (Spec 4 section 8).
- A registry write failure leaves the original file untouched and returns `REGISTRY_WRITE_FAILED`. An unreadable or invalid registry file is never overwritten and returns `REGISTRY_UNAVAILABLE`.
- More than 4 concurrent profile or interpret requests return `429 BUSY`.
- A failed snapshot save is shown as "Not saved". The interlude still follows the rules in Spec 4 section 14.
- If WebGL is unavailable, the game shows a note and the report opens directly.

## Testing Strategy

- **Backend.** pytest for unit and route tests. One unit test set per Advisor rule. Pydantic contract validation tests. Hypothesis for property-based checks, as the engineering playbook requires. Golden tests where output format is fixed.
- **Phase 3 regression.** The Phase 3 suite must pass unchanged, and the 71 protected file hashes must match after each stage (Spec 4 section 4.1).
- **Differing repositories.** Advisor tests run on repositories of different shape and assert that the output differs accordingly (Requirement 2.5).
- **Frontend.** Vitest for pure logic and components. Playwright for end-to-end flows in Microsoft Edge.
- **Game.** Pure-rule tests for the monster state machine, collision, and objectives. A balance test runs scripted play on each difficulty (Spec 4 section 17.2). Cleanup tests confirm that leaving the game releases its resources.
- **Audio.** Controller tests with a fake audio context. Peak level checks for jumpscare cues (Spec 4 section 17.3).
- **Evidence.** Each stage records executed test results, observed output, and anything not run in `phase-status.md`. A test result is not claimed without execution.

## Key decisions

| Decision | Reason |
|---|---|
| New entry point instead of editing `main.py` | Keeps the 71-file Phase 3 hash baseline intact. |
| Scan `HEAD` tree, not the working tree | Same data an investigation uses. No working-tree reads. No uncommitted surprises. |
| Observation IDs as evidence references | Every recommendation traces to a recorded observation. |
| Categorical confidence | No unjustified numeric precision. |
| Plain Three.js with pure-logic modules | Testable rules, no React reconciliation inside the render loop, fewer dependencies than React Three Fiber. |
| Sean never writes to repositories | Repository access is read-only by the project security rule. Export is a browser download. |
