# Workstream B: investigation-independent startup

Status: IMPLEMENTED and VERIFIED in the browser and unit suite (coordinator re-run).

## Verification (coordinator re-run after the workstream finished)
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx vitest run`: 26 files, 679 tests passed.
- `npx playwright test e2e/startup-scenarios.spec.ts e2e/horror.spec.ts`: 24 passed, 0 failed.

## Behaviour verified
- A failed or cancelled investigation starts the game when the game is enabled, with atmosphere clues, and shows the technical reason on the intro card (`game-investigation-note`).
- Advisor and investigation requests have a timeout (`ADVISOR_TIMEOUT_MS` = 30 s, in `advisorClient.ts`), so a hung backend cannot block startup indefinitely.

## Notes
- The workstream's own summary could not be written to `test-results-diagnostics/` because of a permission rule. Its content is captured in the workflow record (wf_8d53f347e292142c).
- Files changed: `frontend/src/services/advisorClient.ts`, `frontend/src/app/App.tsx`, `frontend/src/components/game/GameView.tsx` (intro card, shared with Workstream A), `frontend/e2e/startup-scenarios.spec.ts` (new), analysis and interlude code.
- The intro-card note edit touched `GameView.tsx`, which is owned by Workstream A. It was reviewed here and the browser suite passes.
