---
name: verify-game
description: Verify Sean's 3D game, creature, jumpscare, game-independence and audio after a change. Use when asked to check the horror experience, the standalone game, difficulty balance or the scare and sound settings.
---

Follow the steering files and the `verify-feature` skill. This skill adds the procedure for the game only. It changes no source file.

## What must stay true

- The game works with no backend and no report (Spec 4 section 17.1). A failed, cancelled or empty investigation never blocks it, and the game never changes an investigation's status, error, snapshot or saved report.
- Fiction is never shown as evidence: report clues keep the report's label, torn archive tags say "not evidence".
- The scare setting off means no flash, no close-up, no scream, no shake and no light strobing. Reduced motion means the same for motion.
- No light changes brightness more than three times a second.
- The scream never goes above -3 dBFS, at any volume setting.
- Leaving the game frees the canvas, the animation loop, the pointer lock and the audio nodes.

## Procedure (Windows, from `frontend`)

1. Rules and balance (fast, no browser): `npx vitest run tests/gameWorld.test.ts tests/gameAi.test.ts tests/gameBalance.test.ts tests/flicker.test.ts --maxWorkers=2`. To see the win rates, set `SEAN_BALANCE_REPORT` to a file path first. Note the win rate of a careful and of a reckless player on every difficulty. They must fall as the difficulty rises.
2. Application behavior: `npx vitest run tests/interlude.test.tsx tests/interludeMachine.test.ts tests/audio.test.tsx tests/audioDirector.test.ts tests/audioCues.test.ts tests/audioController.test.ts --maxWorkers=2`.
3. Real browser, real WebGL, real backend: `npx playwright test e2e/game.spec.ts e2e/horror.spec.ts`. Set `SEAN_SHOT_DIR` to a folder to keep screenshots (creature close, hiding view, three frames of the jumpscare, caught screen, retry). Look at them. A screenshot that is black, or in which the creature is not visible at a few tiles, is a failure even when the test passes.
4. Audio measurements (Edge, offline render, separate ports): `npx playwright test -c playwright.audio.config.ts`. It writes WAV files and a table of peak, RMS and spectral centroid per cue to `%TEMP%\sean-audio`. Check the scream's peak and that the table has not got worse. Say plainly that listening is a human step.
5. When the machine is busy, vitest can fail to start workers. That is not a test failure: use `--maxWorkers=3` and say so.
6. Report each command and its observed result. Report what was not run.
