# Implementation Plan: Immersive Experience (Native Spec)

## Overview

This plan turns the immersive-experience requirements and design into ordered tasks for the Phase 4 owner directive of 2026-11-12. It has 12 top-level tasks. Each task lists the requirements it covers. Task state is recorded in `.kiro/reports/phase-status.md` (Phase 4 sections). Checkboxes follow the project convention and are not a status record.

**Status (2026-11-12): authorized for implementation by the Phase 4 owner directive.** Acceptance of the result is the owner's decision.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3"] },
    { "id": 2, "tasks": ["4", "5", "6"] },
    { "id": 3, "tasks": ["7", "8"] },
    { "id": 4, "tasks": ["9"] },
    { "id": 5, "tasks": ["10"] },
    { "id": 6, "tasks": ["11"] },
    { "id": 7, "tasks": ["12"] }
  ]
}
```

## Tasks

- [ ] 1. Toolchain and scaffold (no dependencies)
  - [ ] 1.1 Create `package.json` with the approved dependency set and `jsdom` (Spec 3 §15), `tsconfig`, Vite, Vitest, and Playwright configuration, and the `/api` dev proxy. Install and record the versions.
  - [ ] 1.2 Record the advisory re-check and the `jsdom` dependency reason.
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 2. Contract types, validator, and client (depends on 1)
  - [ ] 2.1 Types from the real response, including the real `target.resolution` labels.
  - [ ] 2.2 `validateResponse` and `deriveUiState` over all valid status and classification combinations and invalid cases.
  - [ ] 2.3 `investigationClient` with abort, error mapping, and an exact request body.
  - _Requirements: 3.1 to 3.7, 5.1 to 5.3_

- [ ] 3. Fixtures from the real backend (depends on 1)
  - [ ] 3.1 A generator that runs the real backend on disposable repositories and writes JSON fixtures for COMPLETE, PARTIAL, INSUFFICIENT, FAILED, ambiguous, and rejected cases.
  - _Requirements: 15.1_

- [ ] 4. Experience state machine (depends on 2)
  - [ ] 4.1 `experienceMachine` with all transitions, tokens, and eligibility.
  - [ ] 4.2 `useExperience` with one call per submission, abort on cancel, and timers for settle and interruption.
  - [ ] 4.3 `sessionStore` and `settingsStore` with defensive loading.
  - _Requirements: 4.1 to 4.4, 8.1, 8.2, 13.1 to 13.3_

- [ ] 5. Audio controller (depends on 1)
  - [ ] 5.1 Web Audio synthesis, lazy context, master gain and compressor, bed, cues, and `dispose`.
  - [ ] 5.2 `AudioProvider` with state-keyed moods and guarded success cues.
  - _Requirements: 11.1 to 11.6_

- [ ] 6. Escape engine (depends on 1)
  - [ ] 6.1 Seeded generator, maze, placements, `step`, and `canComplete`.
  - [ ] 6.2 Solver and rules tests.
  - [ ] 6.3 `buildClues` from evidence.
  - _Requirements: 9.1 to 9.4, 9.8_

- [ ] 7. Application shell and investigation flow (depends on 4)
  - [ ] 7.1 `TwoZoneLayout`, `InvestigationForm`, `InvestigationProgress`, `StatusStrip`, and error rendering.
  - [ ] 7.2 `EvidencePanel` and `EvidenceCard`.
  - _Requirements: 1.1 to 1.4, 2.1 to 2.5, 5.2, 7.1 to 7.3_

- [ ] 8. Ouija scene (depends on 4)
  - [ ] 8.1 `OuijaScene` and `Planchette`, with lighting, dust, and reduced-motion behavior.
  - [ ] 8.2 Phrase reveal and neutral phrase.
  - _Requirements: 6.1 to 6.6_

- [ ] 9. Narrative interruption and escape UI (depends on 5, 6, 7, 8)
  - [ ] 9.1 `HorrorTransition` with the beat sequence and the fiction label.
  - [ ] 9.2 `EscapeSequence`, `EscapeEnvironment`, `EvidenceClue`, controls, live region, and skip.
  - _Requirements: 8.1 to 8.6, 9.1 to 9.7_

- [ ] 10. Final report and settings (depends on 7, 9)
  - [ ] 10.1 `InvestigationReport` with grouping, chronology, and source links.
  - [ ] 10.2 `ExperienceSettings` with sound, motion, horror switch, and skip.
  - _Requirements: 10.1 to 10.6, 12.1 to 12.6_

- [ ] 11. Automated tests (depends on 1 to 10)
  - [ ] 11.1 Vitest unit and component tests, including the full journey with deterministic fixtures and fake timers.
  - [ ] 11.2 Playwright: real backend journey, responsive layout, keyboard-only operation.
  - [ ] 11.3 Execute the tests and record observed results.
  - _Requirements: 15.1 to 15.3_

- [ ] 12. Documentation and phase status (depends on 11)
  - [ ] 12.1 Update Spec 3 and this plan to the implemented product, the README setup instructions, and the license note.
  - [ ] 12.2 Phase 4 sections in `phase-status.md`, the Phase 3 unchanged proof, and the final report.
  - _Requirements: 14.3, 15.3_

## Notes

Format note: the "depends on" text is for human readers. Status mapping: this plan's checkboxes are not a status record. Status uses the Engineering Playbook §15 vocabulary and is recorded in phase-status. Only the owner marks `ACCEPTED`.

## Implementation Record (2026-11-12)
All 12 top-level tasks were implemented. Verification evidence and known limitations are in `.kiro/reports/phase-status.md` (Phase 4). Deviations from this plan: test helpers are custom (`tests/renderHelpers.tsx`) because testing-library is not an approved dependency, and the E2E suite uses the installed Edge.
