# Implementation Plan: Engineering Intelligence (Native Spec)

Order fixed by the owner on 2026-11-12. Checkboxes follow the project convention and are not a status record. State is recorded in `.kiro/reports/phase-status.md`. A stage does not start while the previous stage has unresolved failures.

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
