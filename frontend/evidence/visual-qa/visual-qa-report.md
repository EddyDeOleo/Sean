# Visual QA report: caught cinematic (Workstream C)

Scope: the Playwright-generated frames copied from `frontend/test-results-diagnostics/screenshots/cinematic/` into this folder (originals unchanged). No other directories were read.

## Evidence inspected

| File | Label in file name | What the image shows |
|---|---|---|
| `cinematic/00-ANTICIPATION-90ms.png` | ANTICIPATION, 90 ms | Close-up with the defeat card already on screen. Monster head and chest fill the centre. |
| `cinematic/01-HOLD-1125ms.png` | HOLD, 1125 ms | Monster far down the corridor, arms out, no card, no close-up. |
| `cinematic/02-DEFEAT_CARD-2326ms.png` | DEFEAT_CARD, 2326 ms | Close-up, face readable, no card. Arms cut at the frame edges. |

Not inspected: ACCELERATION, LUNGE, IMPACT (not captured), and the archive (no archive frames have been captured yet).

## Findings

1. **Labels do not match the pixels (defect, capture mechanism).** The phase and time in the file name are read from the canvas before the screenshot is taken, and the screenshot takes 100 to 300 ms. The frame shown can belong to a different phase. The "ANTICIPATION" frame shows the defeat card, which the timeline only shows from 1.4 s. The labels cannot be trusted as evidence of phase.
2. **Phase sequence is not demonstrated.** The three frames are not in a verified order. The frame labelled HOLD is a distant, pre-lunge pose.
3. **Hands are not visible in the impact-like frame.** In the close-up, both forearms run off the bottom and sides of the frame. The hands do not reach toward the camera; the composition shows the torso more than the reaching arms.
4. **Face readability (close-up): acceptable.** The skull and the face are fully in frame in the close-up, with the eye sockets, nose and mouth readable at 1280 x 720.
5. **Defeat-card timing: not verified.** The card appears in one frame, and is absent from a frame labelled DEFEAT_CARD. The card's appearance time cannot be read from these images.
6. **Lighting and atmosphere (archive corridor visible in the frames):** strong red wash over the whole corridor; ceiling acoustic tiles with perforations and a few shelving units visible on the left. The corridor reads as a building interior but the red wash dominates, which conflicts with the palette brief.
7. **LUNGE and IMPACT are not captured.** The cinematic's most important phases have no evidence.

## Decision

Workstream C is **not accepted**. The implementation exists and is unit-tested, but the browser evidence does not demonstrate the required sequence, the hands reaching toward the player, or the defeat-card timing, and the capture labels cannot be trusted.

## Next fixes (required before acceptance)

- Capture frames deterministically: under the development test clock, advance the cinematic to a chosen elapsed time, render exactly one frame, and screenshot that frame. The label then matches the pixels. Needs a test-only render-time argument, kept out of production.
- Extend the grasp so the forearms and hands enter the frame near the camera periphery during LUNGE and IMPACT, and verify with a frame.
- Reduce the red wash in the corridor shots to the palette in the brief.
- Capture and inspect archive frames from gameplay positions (not yet done).

## Deterministic capture (cycle 2)

Method: e2e/cinematic-deterministic.spec.ts plays the real game through the test clock until the creature catches the player, then advances the actual cinematic to six moments. Each moment renders exactly one frame; the phase is read from the simulation state of that frame. Evidence: frontend/evidence/visual-qa/cinematic-det/ (00 to 05 PNG, timeline.json).

| Frame | Phase (from state) | Elapsed | Defeat card visible | Inspection |
|---|---|---|---|---|
| 00 | ANTICIPATION | 0.120 s | no | not inspected in this cycle |
| 01 | ACCELERATION | 0.400 s | no | not inspected in this cycle |
| 02 | LUNGE | 0.550 s | no | Monster close; face readable; one forearm toward the camera left; the hands are cut off at the bottom edge. |
| 03 | IMPACT | 0.700 s | no | Face readable; right forearm toward the bottom right; hand cut off at the bottom edge. |
| 04 | HOLD | 0.950 s | no | not inspected in this cycle |
| 05 | DEFEAT_CARD | 1.600 s | yes | Card covers the torso and legs; face and skull fully in frame. |

Verified: phase labels match simulation state; the defeat card is gated to DEFEAT_CARD (the test asserts card visibility at every moment and passed).

Defects (open):
1. Hands cut off at the bottom edge during LUNGE and IMPACT. The brief requires both hands visibly reaching toward the camera periphery. Not met.
2. Red wash persists across the archive frames (walls, boxes, ceiling). The palette fix (D2) changed background, fog and fluorescent colours, but the frames are still red. Likely sources: the monster's crimson light (intensity 0.5 + 0.6 * flash, distance 2.6) and the aura halo. Needs a measured check of each source.
3. Face readability through the caught close-up: met in LUNGE, IMPACT and DEFEAT_CARD frames.

Acceptance of Workstream C: NOT ACCEPTED (defect 1 open).

## Cycle 3: arm reach, red-wash source fix, capture v2 (coordinator)

Evidence: frontend/evidence/visual-qa/cinematic-det-v2/ (00 to 05 PNG, timeline.json). Method unchanged: deterministic capture.

Changes applied:
- C2 (ws-c2-arm-reach.md): graspBones re-solved; shoulders, upper arms, elbows and hands moved outward and down so both hands sit in the lower outer corners at LUNGE and IMPACT.
- D3 fixes (ws-d3-red-wash.md): monsterVisual.ts pulse() gates the monster light, halo and floor pool on PURSUING/ATTACKING; dormant or searching uses a faint neutral light (0xd8d4cc, 0.15). Radial texture set to sRGB (it was rendering about twice as bright).

Inspection of cinematic-det-v2:
- IMPACT (03, 0.70 s): face fully readable and dominant; right hand visible at the right edge with fingers in frame; left hand at the bottom-left corner, its lower part cut by the bottom edge. Partly met.
- LUNGE (02, 0.55 s): face readable; right hand visible at the right; left hand at the bottom-left corner, cut by the bottom edge. Partly met.
- The red over the whole frame is expected here: the frames are in the caught state, where the .gm-scare overlay and the scare light are red by design. These frames cannot judge the archive's base colour.

Status: Workstream C NOT ACCEPTED (left hand still clipped at the bottom edge in both phases).
Workstream D: the monster-side red sources are fixed in code; the archive base look is NOT yet verified (needs dormant and exploration captures, not yet taken).
Workstream A: not progressed this cycle (no browser time spent on it).
Workstream B: GameView.tsx review complete, no conflicts found; B's browser suites were verified earlier and were not re-run this cycle.

## Archive visual inspection (cycle 4)

Evidence: frontend/evidence/visual-qa/archive-states/ (1-empty-corridor.png, 2-monster-dormant.png, 3-monster-hunting.png, states.json). Captured through the deterministic test clock, seed 1.

- 1-empty-corridor (no monster, before first clue): neutral grey and charcoal, no red wash. Very dark: lit only by the flashlight pool. Ceiling tiles and a shelf visible. Defect: too dark to read the architecture.
- 2-monster-dormant (first clue collected): filing cabinets, labelled archive boxes on shelving, cold fluorescent strip. Neutral. Only a small crimson accent on two cabinet panels (an object colour). No persistent red wash. Defect: no doors, vents or ceiling detail in frame.
- 3-monster-hunting: NOT a monster frame. The player was hidden in a locker, so the view is the locker slit; the creature is not drawn. Hunting visual still uncaptured.

Workstream D: PARTIALLY ACCEPTED. Verified: neutral base colour in empty and dormant states (crimson wash removed). Not verified: corridor readability, door and vent detail, hunting-state visual.

## Archive hunting capture (cycle 5)

Evidence: frontend/evidence/visual-qa/archive-states/3-monster-hunting.png, states.json. Route: deterministic driver with hiding disabled (hidAtCollected pinned), seed 1.
- Creature state: PURSUING, drawn (data-creature-visible true), player not hidden.
- Inspected frame: the creature is NOT in the image. It is about 6 tiles away (monster 12.38, 8.5; player 8.91, 13.61), behind walls and outside the view. The attribute says drawn; the picture does not show it.
- Neutral base confirmed again: cool fluorescent, labelled archive boxes on shelving, no red wash.
- Workstream D hunting criterion: NOT MET. A capture with the creature visible in frame still needs a closer encounter position.
Workstream D: PARTIALLY ACCEPTED (neutral base and storage view verified; hunting-in-view not verified).

## Cycle 6 browser results (coordinator)

A (escape, locker driver, deterministic, real trace files in frontend/test-results-diagnostics/):
- Seed 1: caught at 71.98 s, caught at 108.85 s, escaped at 98.22 s on attempt 3. NOT CLEAN (2 catches, 2 retries).
- Seed 2: caught at 108.85 s, escaped at 98.22 s on attempt 2. NOT CLEAN (1 catch, 1 retry).
- Seed 3: escaped at 98.22 s on attempt 1, 0 catches. CLEAN.
- Workstream A: PARTIALLY ACCEPTED (1 of 3 seeds clean). Remaining defect: the route to clue 2 and clue 3 meets the creature before the player hides; the driver's hide-before-wake rule is not enough for seeds 1 and 2. Owner: driver (e2e/deterministicDriver.ts).

C (cinematic, deterministic capture v3, frontend/evidence/visual-qa/cinematic-det-v3/):
- 02-LUNGE and 03-IMPACT inspected: face readable and dominant; right hand fully inside the frame with margin; LEFT hand still clipped below the bottom edge (bottom-left corner). NOT ACCEPTED. Owner: pose (monsterAnimation.ts graspBones).
- ANTICIPATION, ACCELERATION, HOLD and DEFEAT_CARD frames captured and not yet inspected in this cycle.

B (startup browser regression): NOT RUN this cycle. Status: not accepted in this cycle; last verified results remain 24/24 (startup and horror specs) from an earlier cycle, before the recent GameView and renderer changes.

D (archive): PARTIALLY ACCEPTED. Hunting-in-view capture not achieved (creature out of frame).

## Cycle 7 results (coordinator)

B (startup and horror browser suites, current code, run this cycle): 24 passed, 0 failed (startup-scenarios.spec.ts and horror.spec.ts). tsc exit 0. Status: BROWSER-TESTED on current code. Not visually relevant. Accepted for the startup scope.

A (escape, deterministic locker driver):
- Trace analysis: seeds 1 and 2 were caught at frames 4319 and 6531 after the player left a locker on the route to clue 4. The monster began pursuing about 0.2 s after the leave.
- Correction tried: leave a locker only after 3 calm seconds, 12 tiles away, out of the creature's sight. Result: seed 1 caught once then timeout; seed 2 timeout at 240 s; seed 3 caught twice then escaped. Worse. REVERTED (driver restored to previous values).
- Previous run (before correction, same driver code): seed 1 caught twice then escaped on attempt 3 (98.22 s); seed 2 caught once then escaped on attempt 2 (98.22 s); seed 3 escaped on attempt 1 (98.22 s), 0 catches, 0 retries. Traces: frontend/test-results-diagnostics/escape-seed{1,2,3}-2026-11-20T05-*.json.
- Acceptance: NOT ACCEPTED. Only seed 3 is a clean first-attempt escape. Owner: driver route for clue 4 (e2e/deterministicDriver.ts).

C (cinematic): NOT CORRECTED in this cycle. Latest inspected frames (cinematic-det-v3 LUNGE and IMPACT): left hand still cut off at the bottom-left edge. Right hand fully visible. Face dominant. NOT ACCEPTED. Owner: graspBones (monsterAnimation.ts). No new capture this cycle.

D (archive): PARTIALLY ACCEPTED (unchanged). Hunting-in-view capture still open. Not run this cycle.

## Cycle 8 (coordinator): C pose iterations and A status

C (left hand, hand.R / upperArm.R side at bottom-left of frame). Captures in frontend/evidence/visual-qa/:
- cinematic-c4-baseline: upperArm.R (0.56, 0, -0.95), lowerArm.R -0.6. Hand clipped at bottom edge.
- cinematic-c4-iter1: upperArm.R (0.56, 0, -0.55), lowerArm.R -0.9. Forearm moved inward; hand still touches bottom edge in LUNGE and IMPACT. NOT fixed. Unit tests: 4 hand-projection tests fail (projection, not visual evidence).
- cinematic-c4-iter2: upperArm.R (0.9, 0, -0.55), lowerArm.R -1.3. Hand still at bottom edge in LUNGE (x about 440-490) and IMPACT (x about 355-400). NOT fixed.
- Current code state: iter2 values are live in monsterAnimation.ts graspBones. They are NOT the accepted pose. Revert or choose a new approach before acceptance.
- C: NOT ACCEPTED. Right hand visible; left hand still clipped at bottom edge in both LUNGE and IMPACT. ANTICIPATION, HOLD and DEFEAT_CARD in iter2 not inspected.

A: no route change this cycle beyond the earlier revert. Three-seed run with current driver (prior to C work): seed 3 clean; seeds 1 and 2 need retries. Route-level correction NOT implemented in this cycle. NOT ACCEPTED.

D: unchanged, PARTIALLY ACCEPTED. B: unchanged, accepted for startup scope.

## Cycle 11 visual QA (cinematic hand pose)
- Frames: frontend/evidence/visual-qa/cinematic-cycle11/ (00 to 05, timeline.json). Probe margins (pre-removal): frontend/evidence/visual-qa/hand-probe/probe.json and 00 to 05 PNGs (candidate pose, same as final).
- Accepted pose: upperArm.R (-0.3, 0, -0.6), lowerArm.R -1.8. Rejected candidate (upperArm.R 0.0, 0, 1.0): frontend/evidence/visual-qa/hand-probe/01-LUNGE (folded into chest).
- Inspected: LUNGE (02): screen-left hand visible, extended, separate from torso, inside frame. IMPACT (03): same. HOLD (04): same pose held. DEFEAT_CARD (05): card visible only in this phase. ANTICIPATION (00): wide shot, arms down, no card.
- Known defect: ACCELERATION (01) screen-left hand 15 px below bottom edge.
- Sweep screenshots for rejected candidates: frontend/evidence/visual-qa/hand-sweep-cycle11/ (sweep-01 to sweep-08, sweep-baseline).

## Cycle 12 visual QA
- Escape traces: frontend/evidence/visual-qa/escape-traces-cycle12/. Cycle 11 traces SUPERSEDED (escape-traces-cycle11/SUPERSEDED.txt).
- ACCELERATION: last valid frame frontend/evidence/visual-qa/cinematic-cycle11/01-ACCELERATION-0.400s.png. Defect remains (screen-left hand at the bottom edge).
- Cycle 12 timeline capture (frontend/evidence/visual-qa/hand-timeline-cycle12/) was deleted: LUNGE frame invalid (dark, head only).
- No new cinematic frames were accepted in Cycle 12.

## Cycle 13 visual QA
- INVALID (do not cite): frontend/evidence/visual-qa/cinematic-cycle13-candidateA/ (dark, detached head; see INVALID.txt); frontend/evidence/visual-qa/hand-timeline-cycle13/ (deleted: dark frame, probe run).
- Diagnostic: frontend/evidence/visual-qa/cinematic-oldseed-check/00-ANTICIPATION-0.120s.png valid under the old seed formula (creature upright). Diagnostic only, not acceptance evidence.
- Last valid ACCELERATION frame remains cinematic-cycle11/01-ACCELERATION-0.400s.png (screen-left hand at bottom edge). No valid cycle 13 frames exist.

## Cycle 14 visual QA
- Escape traces (A acceptance): frontend/evidence/visual-qa/escape-traces-cycle14/.
- Balance report: frontend/evidence/visual-qa/balance-cycle14/.
- Caught placement log (diagnosis): frontend/evidence/visual-qa/caught-placement-cycle14/.
- No new cinematic frames accepted. Frame evidence for the defect: cycle 13 cinematic-cycle13-candidateA (INVALID, corner catch; marked as invalid). Old open-floor valid frame: cinematic-oldseed-check/00.
- ACCELERATION: no valid capture this cycle.

## Cycle 17 visual QA (Workstream C acceptance)
- Accepted evidence: cinematic-cycle17/seed1-open, seed1-corner, seed2-corner, seed3-corner, nearwall-s2-v10, locker-23-8-s1. For each, 012-ANTICIPATION, 044-ACCELERATION, 055-LUNGE, 070-IMPACT, 095-HOLD and 160-DEFEAT_CARD were inspected: PASS. Both hands are in frame, with no wall, locker or near-plane clipping, and the defeat card shows only in DEFEAT_CARD. bounds.json in each folder holds the measured hand NDC and near-plane counts.
- 0.15-tile enclosed case: the locker-corner catches (seed1/seed3 at 9.5,3.5; seed2 at 17.5,1.5).
- Superseded, do not cite: cinematic-cycle15/, cinematic-cycle16/, cinematic-cycle17/nearwall-s2-v6, nearwall-s2-v7, nearwall-s2-v9.
- Status: Workstream C ACCEPTED.
## Cycle 18 visual QA (right-arm correction)
- Accepted evidence: cinematic-cycle18/final-seed1-open, final-seed1-corner, final-seed2-corner, final-seed3-corner.
- Inspected and PASS: 048-ACCELERATION, 052-LUNGE, 070-IMPACT and 095-HOLD for the enclosed catches; 048, 052, 070 and 160 for the open catch; 055-LUNGE (seed 3) and 160-DEFEAT_CARD (seed 3, seed 1 open).
- Checks: right shoulder raised, elbow open and flexed forward, claw inside the frame, left hand in frame, no clipping, and the defeat card only in DEFEAT_CARD.
- Superseded, do not cite: every other folder in cinematic-cycle18/ (each has SUPERSEDED.txt).
- Not recaptured: cinematic-cycle17 nearwall-s2-v10 and locker-23-8-s1.
- Status: Workstream C ACCEPTED.
## Cycle D4 visual QA (Workstream D, Archive)
- Accepted evidence: archive-cycle-d4/final2-medium and final2-low (frames plus archive-qa.json).
- Inspected and PASS: 2a (drawers and shelves separate), 3a, 3b and 3c (corridors readable and dark), 4-hunting (creature PURSUING in view at 3.49 tiles, player not hidden).
- Not informative: 1b (point-blank wash) and 2b (no furniture in view). Collision is proven by metrics.
- Reproduction before the fix: archive-cycle-d4/before/.
- Cinematic regression check: archive-cycle-d4/cinematic-regression/ (LUNGE, HOLD, DEFEAT_CARD inspected, PASS).
- Superseded, do not cite: archive-cycle-d4/after-medium, after-low, final-medium, final-low (each has SUPERSEDED.txt).
- Status: Workstream D ACCEPTED.
## Archive visual restoration (post-acceptance refinement of D)
- Evidence: archive-restoration/medium and archive-restoration/low (frames, archive-qa.json, restored-walks.json), plus archive-restoration/cinematic-regression.
- Inspected and PASS (medium): 5a to 5i restored areas, 2a drawers and shelves separate (with the restored locker), 3a corridor readable and dark, 4-hunting. Low: 5a matches medium.
- Not informative: 2b (the reserved start corner, no decoration by rule).
- Cinematic: IMPACT and DEFEAT_CARD PASS.
- archive-cycle-d4/final2-*: kept as the D acceptance record (NOTE.txt points to the current frames).
