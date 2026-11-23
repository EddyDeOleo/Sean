# Workstream D2: archive palette and lighting fix

Status: IMPLEMENTED. Unit tests and type check pass. Browser verification is not done (the coordinator captures it).

## Values changed

Archive palette (`archiveScene.ts`, now exported as `ARCHIVE_PALETTE`):

| Name | Value | Use |
|---|---|---|
| beige | #B5AD91 | cabinet handles, panel, box colour |
| concrete | #595B59 | steel shelving, fixture housing |
| green | #4C544B | filing cabinets, door leaves |
| ochre | #6E6244 | document boxes, carts, baseboards |
| charcoal | #171717 | dark parts, background |

Crimson #8F171D was removed from the archive palette. It was used for the door plate, which now uses the beige handle material.

Scene lighting (`archiveScene.ts`, exported as `ARCHIVE_LIGHTING`, read by `renderer.ts`):

| Setting | Before | After |
|---|---|---|
| `scene.background` | #050507 (near-black blue) | #171717 (charcoal) |
| `scene.fog` colour (FogExp2, density 0.085 unchanged) | #050507 | #171717 |
| AmbientLight (intensity 1.1 unchanged) | #323A46 | #3A3D3A (neutral) |
| HemisphereLight sky (intensity 0.15 unchanged) | #0A0C12 | #1C1F1D |
| HemisphereLight ground | #050507 | #0D0D0D |
| Ceiling flickering PointLights (intensity 1.6, distance 7 unchanged) | #DFE8DC | #E4F5EC (cold green-white) |
| Fluorescent lens emissive colour | #E6F4FF | #E4F5EC |
| Fluorescent lens emissiveIntensity | 1.2 | 2.0 |

No red is added to the scene. The monster light, the flashlight, the exit glow and the scare branch are unchanged.

## Files changed

- `frontend/src/features/game/archive/archiveScene.ts`
- `frontend/src/features/game/renderer.ts` (import line, the background, fog, ambient and hemisphere lines in the constructor, and the flickering-light colour in `buildLights`)
- `frontend/tests/archiveScene.test.ts` (new "archive palette and lighting" block)

## Unit test results

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx vitest run`: 26 files passed, 684 tests passed, exit 0. The earlier count was 679 tests. The 5 new tests are in `archiveScene.test.ts`.

The new tests check that the palette matches the approved hex values, that crimson is not in the palette, that the background is neutral (not red), that ambient and hemisphere light are neutral and dim, and that the fluorescent colour is cold green-white.

## Where the red came from

In the code I could read, the only red sources were these:
- The monster's own light (`creature.ts`, #8A0812, intensity 0.55, distance 2.6). This is local and was not changed, as instructed.
- The archive door plate, which used crimson (fixed above).
- The gate bars (`renderer.ts` `buildGate`, #5B2420), which are outside my allowed lines.
- Book spines on furniture (`renderer.ts` `buildFurniture`, includes #8F171D), which are outside my allowed lines.

The background and fog were near-black, so they did not cause a red wash. A full-screen red wash may come from CSS overlays in the game view or from the monster's light near the creature. I did not inspect those (`GameView.tsx` and the CSS are not mine), so the browser capture must confirm which source it is.

## Not done (outside my allowed lines)

- **Walls and floor are not beige.** The wall texture in `renderer.ts` `buildLevel` uses a neutral grey-blue noise (base 74). The floor uses a similar grey. Making them beige, linoleum and concrete needs edits to `buildLevel`, which is outside my allowed lines. This is a follow-up that needs approval for that edit.
- **`monsterValidation.ts` (dev tool)** copies the old scene colours (`0x050507`, `0x323a46`, `0x0a0c12`). It now differs from the renderer. This is a dev-only file not owned by D2.
- **Gate bars and book spines** still use red-brown values (see above).

## Needs browser verification (coordinator)

1. Capture the corridor from at least two positions, and check that the corridor is no longer washed in red.
2. Check that the fluorescent fixtures look like emissive cool-white panels from below.
3. Check that the walls and floor still read clearly under the new ambient light. The wall and floor colours have not changed, so they may look greyer than the beige target.
4. Check the monster encounter: its crimson aura should be the only strong red.
5. Check that the level is not too bright. Ambient and fluorescent colours changed, but intensities did not, so the overall brightness is close to before.
