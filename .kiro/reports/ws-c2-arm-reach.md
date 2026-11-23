# Workstream C2: arm reach in the caught close-up

Status: IMPLEMENTED and unit-verified. Not browser-verified. Acceptance needs the coordinator's browser capture of the LUNGE and IMPACT frames.

## Files changed

- `frontend/src/features/game/monsterAnimation.ts`: `graspBones` values and its comment. `attackBones` is unchanged.
- `frontend/tests/monsterAnimation.test.ts`: replaced the old grasp asymmetry test (it asserted the old right-arm-forward pattern). Added the rig forward kinematics helper and the hand-in-frame tests.

Not changed: `renderer.ts`, `GameView.tsx`, `cinematic.ts`, `monsterPose.ts`, `monsterVisual.ts`, `creature.ts`, `game.css`, `world.ts`, `archive\**`, e2e files. No git commit or other git operation.

## Why the hands were cut off

- At rest the arms hang from the shoulders. In rig units the head joint is at y 0.839, the elbows at y 0.611, and the hands at y 0.457.
- The rig is scaled to 1.05 tiles. The hands sit about 0.41 tiles below the head joint.
- The caught close-up puts the head joint on the view line at 0.455 tiles from the eye (`FACE_DISTANCE`, 60 degree vertical FOV, head joint 0.03 below the eye at 0.55).
- At that distance the lower edge of the view is about 0.26 tiles below the eye. The hands sat near 0.11 world height, about 0.45 tiles below that edge.

## Angle values (full grasp, `graspBones`, value at t = 1; the curve scales every value by easeInOut(t))

Radians. Torso and head values are unchanged (spine 0.35, chest 0.2, neck -0.5, head -0.3).

| Bone | Before (x, y, z) | After (x, y, z) |
|---|---|---|
| shoulder.L | 0.30, 0, 0 | -0.50, 0, 0 |
| shoulder.R | 0.30, 0, 0 | 0.02, 0, 0 |
| upperArm.L | 1.00, 0, 0.45 | 1.13, 0, 0.60 |
| upperArm.R | 1.20, 0, -0.25 | 0.56, 0, -0.95 |
| lowerArm.L | -0.80, 0, 0 | -0.60, 0, 0 |
| lowerArm.R | -1.00, 0, 0 | -0.60, 0, 0 |
| hand.L | -0.50, 0, 0 | -0.39, 0, 0 |
| hand.R | -0.50, 0, 0 | -0.40, 0, 0 |

`attackBones` (the in-game lunge before the catch) is unchanged. Its arm values at full lunge are upperArm.L (1.25, 0, -0.3), upperArm.R (1.45, 0, 0.2), lowerArm.L -0.7, lowerArm.R -0.9. The caught frames do not use it, so changing it was not needed to fix the cut-off. It still uses the z signs that are opposite to the grasp, so the coordinator may want to review it in a browser.

## Method

Analysis only. Scripts were in `%TEMP%\c2-fk` and are not part of the repository.

1. Read the rest-pose joint positions and quaternions from `frontend/public/models/sean-monster-250k-rigged.glb` (node hierarchy in the GLB JSON chunk).
2. Ran forward kinematics with offsets applied as local rotations, as `addBoneOffset` does.
3. Projected each hand into the caught camera at the reach and grasp values of `cinematicAt`.
4. Searched the arm angles (random local search with penalties) to place both hands in the lower outer corners, with elbows near the lower edge and the hands at or just behind the face plane. Angle caps: shoulder 1.0, upperArm 1.4, lowerArm 1.6, hand 0.8 rad, inside the required limits of 2.0 and 2.2. The first unconstrained search reached the limits and looked contorted, so I rejected it. Then I rounded the values to two decimals.

## Projected results (normalized device coordinates, -1 to 1 inside the frame)

Values from the same projection model. "Before" uses the old grasp values.

| Phase (cinematic time) | Hand | Before (x, y) | After (x, y) |
|---|---|---|---|
| LUNGE, 0.55 s (grasp about 0.90, reach 0.504) | hand.L | 0.49, -1.60 | 0.71, -0.73 |
| LUNGE, 0.55 s | hand.R | -0.32, -1.69 | -0.72, -0.71 |
| IMPACT, 0.70 s (grasp 1.0, reach 0.455) | hand.L | 0.55, -1.81 | 0.78, -0.76 |
| IMPACT, 0.70 s | hand.R | -0.36, -1.91 | -0.79, -0.75 |

After the change, the elbows are at about (0.46, -0.44) for the left and (-0.48, -0.51) for the right at the lunge. Both hands sit 0.24 to 0.29 NDC inside the bottom edge.

Hand depth after the change: 0.51 to 0.57 tiles from the eye, while the face is at 0.455 to 0.504. The hands are therefore a little behind the face plane, not in front of it (see limitations).

## Tests

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx vitest run tests/cinematic.test.ts tests/monsterAnimation.test.ts tests/monsterPose.test.ts`: 3 files, 59 tests, all passed.
- Before the final run, one new test failed. It asserted that the hands rise as the grasp builds, but the NDC value depends on the distance, so the premise was wrong. I removed that test; it was not a product defect.

New tests in `monsterAnimation.test.ts`:
- Asymmetry: the left and right shoulder and upper arm differ by more than 0.4 rad, and the upper arms swing out on opposite z signs.
- Elbows and hands: both elbows bend (below -0.4) and both hands curl (below -0.2).
- Joint limits at every point from 0 to 1.4 s: shoulders and upper arms within 2.0 rad, elbows within 2.2 rad.
- Hands within NDC +/-0.9 (in frame with margin) at 0.55, 0.70, 0.80, 1.0 and 1.4 s, and at every 0.01 s from 0.55 to 1.4 s.
- Hands at |NDC x| >= 0.5 (outside the face column).
- Hands no more than 0.1 tile behind the face plane.
- Hands differ between the two sides at the impact.

The projection helper uses hardcoded rest-pose data, the same camera constants as `renderer.ts` (eye 0.55, head 0.03 lower, 1280 x 720), and `cinematicAt` for reach, FOV, and grasp. It is in the test file, not in production code.

## Browser verification values for the coordinator

Capture at 1280 x 720. Use the phase times LUNGE 0.55 s and IMPACT 0.70 s after the catch. Pixel positions use x = (ndcX + 1) / 2 * 1280 and y = (1 - ndcY) / 2 * 720, with the sign of ndcX depending on the screen side:

- LUNGE: hand centres at about x 179 and x 1094, y about 615 to 623. Elbows at about x 333 and x 934, y about 518 to 543.
- IMPACT: hand centres at about x 134 and x 1139, y about 630 to 634.
- Hand centres sit 85 to 100 px above the bottom edge (720 px). The head joint is at about x 640, y 401, so the face stays the dominant focal point. Check that the face is still the largest readable element.
- Before-change reference: the hands were at y about 936 to 1044 px, which is below the 720 px frame.

## Limitations and assumptions

1. **Model scale.** The scale of 1.0729 tiles per rig unit comes from the model height of 0.9787 units, taken from the bounds of `sean-monster-model.glb`. The running build computes its own bounds. Small differences shift the projected hands slightly. The margin in y is about 0.24 NDC.
2. **Clip pose.** The grasp is applied on the idle clip pose at the moment of the catch. The projection used the bind (rest) pose. Idle breathing can move the hands by a few hundredths of a tile.
3. **Forward reach.** The hands do not come toward the camera. They sit at the lower outer corners at about the face's depth, 0.05 to 0.06 tile behind the face plane. Pulling them in front needed upper arm angles that looked contorted, so I did not use them. The brief asks for arms that extend toward the player, so the coordinator should judge this in the frame.
4. **Left shoulder.** The left shoulder changes from 0.30 to -0.50 rad, tipping back. This is needed to fit the hand positions with natural joint caps. It is not verified visually.
5. **Approach frames.** Before the lunge, at grasp 0.15 to 0.5 (roughly 0.3 to 0.5 s), the hands are still below the lower edge. They enter the frame during the lunge. Check that the entry looks right.
6. **Torso.** Spine, chest, neck and head are unchanged, so the face framing is as before. The spine lean moves the shoulders only a little relative to the head.
7. **Browser evidence.** Nothing here has been run in a browser. Acceptance requires visual inspection of both hands in both phases.
