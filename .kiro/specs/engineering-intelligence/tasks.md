# Implementation Plan: Engineering Intelligence (Native Spec)

## Overview

The work runs in eight stages in the order the owner fixed on 2026-11-12, followed by the owner decisions of 2026-11-13 (task 9). Task state is recorded in `.kiro/reports/phase-status.md`, not in the checkboxes below.

## Task Dependency Graph

Execution waves for Kiro's task runner are in the JSON block below. Each entry is a leaf task: a subtask, or a top-level task with no subtasks. A wave holds tasks whose prerequisites are all in earlier waves. Wave 9 holds the owner decisions of 2026-11-13, which depend on the stage tasks 2 to 8 they change. Task 9.6 runs last, after 9.1 to 9.5.

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "2.5", "2.6"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4"] },
    { "id": 5, "tasks": ["5"] },
    { "id": 6, "tasks": ["6"] },
    { "id": 7, "tasks": ["7"] },
    { "id": 8, "tasks": ["8"] },
    { "id": 9, "tasks": ["9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 10, "tasks": ["9.6"] }
  ]
}
```

A stage does not start while the previous stage has unresolved failures.

## Tasks

- [x] 1. Plan and specs (Spec 4, this Native Spec). _Requirements: all_
- [x] 2. Backend profile and Advisor, with tests
  - [x] 2.1 `repository_profile` models, scanner, manifest parsing. _Req 1_
  - [x] 2.2 `advisor` catalog, contract, rules, roadmap. _Req 2_
  - [x] 2.3 `intent` deterministic parser and Gemini adapter with injected transport. _Req 3_
  - [x] 2.4 `advisor_routes`, `local_guard` and `main_advisor`. _Req 1 to 3_
  - [x] 2.5 Tests: unit per rule, contract validation, differing-repository tests, no fabricated references, limits, read-only checks, route tests, guard tests.
  - [x] 2.6 Evidence: 184 new tests pass, 1061 Phase 3 tests pass (1245 total), 71 hashes match. Security review done; findings fixed except M4 (Phase 3 runner, needs owner decision).
- [x] 3. Product UI, sidebar and report persistence. _Req 4_ (406 unit tests, 16 browser tests, screenshots reviewed; see phase-status)
- [x] 4. Artifact preview and export (adds `POST /artifacts/preview`). _Req 5_ (backend 55 + 6 review tests; 12 component tests; browser download and verify test)
- [x] 5. Ouija change. _Req 6_ (machine, overlay and App tests; browser tests; screenshots 20-24)
- [x] 6. Three.js game and 2D game removal. _Req 7_ (26 rule tests; 10 browser tests including a full play-through to the exit; screenshots 30-35; D04 written)
- [x] 7. Audio. _Req 8_ (procedural, no assets; 14 controller and director tests; 8 App-level sound tests; browser test with sound on)
- [x] 8. Independent reviews and screenshots. _Req 9_ (security-auditor and code-reviewer run; findings fixed or recorded; full suites run; see phase-status. Limits listed there)
- [x] 9. Owner decisions of 2026-11-13: scarier creature, jumpscare with scream, wooden Ouija sound, the game independent of the investigation, repository management on the Repositories page. _Req 6, 7, 8 and a new repository-management requirement_ (Spec 4 sections 16 and 17; see phase-status for the observed results and the limits)
  - [x] 9.1 Backend: add, edit and remove repositories, atomic write, live reload (112 + 42 tests).
  - [x] 9.2 Creature model, AI (rounds, noise, search, hiding, lunge, difficulty), balance by playing, light limits.
  - [x] 9.3 Jumpscare picture and scream, scare setting, presence sounds, wooden Ouija sounds, measured audio.
  - [x] 9.4 The game as its own experience: Play button, failure notices, play while waiting.
  - [x] 9.5 Repositories page: add, edit, remove with confirmation, immediate selection.
  - [x] 9.6 Independent reviews (security-auditor, code-reviewer) and their fixes.

## Notes

- Checkboxes follow the project convention. A checked box is not a status record. The status record is `.kiro/reports/phase-status.md`, which uses the lifecycle statuses (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `ACCEPTED`).
- A checked box means the work was implemented and its evidence is listed in the task. It does not mean the phase is accepted. Phase 4 is not ACCEPTED.
- Test counts in the task lines are the counts reported at the time of each stage. The current counts are in `phase-status.md`.
