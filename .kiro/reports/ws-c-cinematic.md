# Workstream C: cinematic caught sequence

Status: IMPLEMENTED and unit-verified. Not browser-verified. The capture spec is written but has not been run.

## Files changed

- `frontend/src/features/game/cinematic.ts` (new): pure timeline `cinematicAt(elapsed, reducedMotion)`, plus `phaseAt`, `fitReach`, and the framing constants.
- `frontend/src/features/game/renderer.ts`: the caught/scare branch, the camera rotation lines that follow it, the `openDistance` helper placed next to `catchPull`, and the imports the branch needs. Dev-only dataset attributes `cinematicPhase` and `cinematicElapsed` are set inside the cinematic branch. Nothing else in the renderer was changed.
- `frontend/src/features/game/monsterVisual.ts`: `poseForScare(pose, time)` takes the timeline frame. The grasp is applied through `poseWithOffsets` on the clean clip pose. The bind pose is recorded at load. The local `findBone` moved to `monsterPose.ts`.
- `frontend/src/features/game/monsterPose.ts`: `findBone` and `poseWithOffsets`, which restore the clean clip pose before adding offsets, so repeated frames never accumulate.
- `frontend/src/features/game/monsterAnimation.ts`: the torso lean in `graspBones` is reduced (spine 0.55 to 0.35, chest 0.3 to 0.2).
- `frontend/src/styles/game.css`: `.gm-caught[data-scare="true"]` card delay changed from 0.9 s to 1.4 s, matching `CINEMATIC_TIMES.DEFEAT_CARD`.
- `frontend/tests/cinematic.test.ts` (new): 23 tests.
- `frontend/e2e/cinematic-capture.spec.ts` (new): browser capture, not run.

Not touched: GameView.tsx, App.tsx, the archive folder, level.ts, world.ts, other e2e files, phase-status.md.

## Timeline (seconds after CAUGHT)

| Phase | Start | Reach (tiles, eye to head) | Grasp | FOV (deg) | Other |
|---|---|---|---|---|---|
| ANTICIPATION | 0.00 | 1.26 to 1.05 (1.2 to 1.0 model heights), ease in-out | 0 to 0.15 | 70 to 66 | shake up to 0.004 |
| ACCELERATION | 0.30 | 1.05 to 0.70, ease in | 0.15 to 0.50 | 66 to 62 | shake 0.008 to 0.012 |
| LUNGE | 0.50 | 0.70 to 0.455, ease out | 0.50 to 1.0 | 62 to 60 | shake 0.014 |
| IMPACT | 0.62 | 0.455 | 1.0 | 60 | flash 1.0, shake 0.05 and kick 0.06 rad, both decaying |
| HOLD | 0.80 | 0.455 | 1.0 | 60 | aura 0.35, shake decays to near zero |
| DEFEAT_CARD | 1.40 | 0.455 | 1.0 | 60 | card appears |

Previous values: head at 1.55 to 0.95 tiles, creature scaled 0.8 to 1.25, card at 0.9 s. Creature scale is now 1.0.

## Framing

- MODEL_HEIGHT is 1.05 tiles. A span of half that (0.525 tiles) should fill the view at the face.
- At a 60° vertical FOV, the face distance is 0.455 tiles. That is 9.1 times the 0.05 near plane.
- The body extends about 0.315 tiles behind the head. `fitReach` pulls the head in when a wall is ahead, down to a floor of 0.2 tiles.

## Unit-test coverage (cinematic.test.ts, 23 tests, passing)

- Phase boundaries and required order. All six phases are visited across 3 s sampled every millisecond.
- Times before the catch and NaN count as the catch. +Infinity counts as the last phase.
- The defeat card is hidden before 1.4 s and shown from 1.4 s. The CSS delay is read from `game.css` and must equal `CINEMATIC_TIMES.DEFEAT_CARD`.
- No frame-to-frame jumps in reach (0.01 tiles), grasp (0.02) or FOV (0.1°). Values match at each phase boundary.
- Head approaches monotonically to the impact, then holds the framed distance and 60° FOV.
- Framing: the span at the face equals MODEL_HEIGHT / 2, and the face distance is far beyond the near plane.
- Reduced motion: no shake, no kick, final framing from the first frame, same phase and card timing.
- Shake and kick occur only at the impact and the moments after it, then settle to zero. The flash stays within 0 to 1.
- `fitReach` keeps the wanted reach in open floor, pulls in against a wall, and never goes below MIN_REACH.
- The scare pose does not accumulate: 50 repeated applications at each 50 ms of the close-up equal one application (tolerance 1e-6 rad, because `angleTo` uses acos).

## Checks run

- `npx tsc --noEmit -p tsconfig.json`: exit 0. This covers src, tests and e2e.
- `npx vitest run`, final run: 26 files, 678 tests passed, exit 0.
- An earlier full run reported 1 failed test (25 of 26 files passed). Its name was not captured. The next two full runs passed (27 files / 679 tests, then 26 / 678). Other workstreams were adding test files at the same time, so the cause is unattributed. Recheck if it recurs.

## Not verified (needs browser evidence)

- **Composition:** whether the face is the focal point, whether the hands stay at the periphery, and whether the arms clip the near plane (hands closer than 0.05 tiles to the lens).
- **Head size:** the framing assumes the face is about a fifth of the model height.
- **Walls:** `fitReach` checks only the centre line along the view, not the arms or the sides of the body.
- **Near plane:** the renderer constructs the camera with the literal 0.05. The constructor is outside the allowed edit area, so `CAMERA_NEAR` in cinematic.ts is not yet linked to it. Replace the literal with `CAMERA_NEAR` in a follow-up.
- **Existing e2e:** `horror.spec.ts` takes a caught screenshot 0.7 s after the catch, before the card appears at 1.4 s. Check that test when the browser suite runs.
- **Capture spec:** run `npx playwright test e2e/cinematic-capture.spec.ts` from `frontend`. It writes full-page frames and `timeline.json` to `frontend/test-results-diagnostics/screenshots/cinematic/`, with the phase and elapsed time in each filename. Each screenshot takes roughly 100 to 300 ms, so the 0.12 s LUNGE and 0.18 s IMPACT phases may get no frame. The spec asserts only ANTICIPATION, HOLD and DEFEAT_CARD, and their order.

## Unchanged behaviour

- Jumpscare-off uses the same camera pull and clean-pose hold as before. Shake was already zero there. The roll line now reads `cinematic ? 0 : ...`, which is unchanged in that mode.
- ATTACK_FOR (0.35 s) and world.ts are untouched.
