# WS-D3: Red wash in the archive corridor

Scope: read-only investigation of the archive lighting, with proposed changes. No source files were edited.
Browser capture was not run (per the brief). All contribution figures are analytic estimates from the Three.js
lighting formula and the constants in code. They are not pixel measurements. The coordinator should confirm them
with a canvas readback in the deterministic capture.

## Verification run

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit -p tsconfig.json` (in `frontend/`) | exit 0 |
| Archive lighting unit tests | `npx vitest run tests/archiveScene.test.ts` | 13 of 13 passed |

No test assertion encodes a crimson or creature-light value, so no test was changed.

## Headline finding

The archive palette is not the source of the red. `ARCHIVE_PALETTE`, `ARCHIVE_LIGHTING`, the scene background, the fog,
the ambient and hemisphere lights, the fluorescent lights, the wall and floor textures, and the vignette and grain are
all neutral or cool. The red comes from the monster's aura. That aura is active whenever the monster is shown, and it
is not gated on the monster's state.

The monster is shown only after the first fragment is collected (`renderer.ts` ~line 522,
`this.creature.setShown(world.collected > 0)`). So "monster absent" means "no fragment collected yet". Once one
fragment is collected, the monster's light, halo, and floor pool stay on while it is DORMANT, SEARCHING, or
PURSUING.

## Source inventory

Values are as read from the code. "Active in empty corridor" means active after the first fragment is collected and
the monster is DORMANT. Before the first fragment, the monster's group is hidden, so every monster source below is
off.

| # | Source (file:line) | Colour / intensity / opacity | Active, monster dormant | Estimated red contribution on a wall |
|---|---|---|---|---|
| 1 | Monster point light, production path. `monsterVisual.ts` 112 (`ownLight`), 26 (`LIGHT_COLOUR`) | `0x8a0812` (linear R 0.254, G 0.002, B 0.006), intensity 0.55, distance 2.6, decay 2 | Yes, once shown. Not changed by state. Reset by `renderer.ts` ~405 | Wall red about 0.0174 × I(d), where I = 0.55 / d² × range window. About 55 levels (sRGB) at 0.5 m, 24 at 1.0 m, 11 at 1.5 m, 4 at 2.0 m. |
| 2 | Monster halo sprite. `monsterVisual.ts` 114–117 (`opacity: 0.42`), `pulse()` 389–396 | Texture from `radialTexture()` 43–57, core `rgba(192,18,30,0.9)`. Additive. Opacity 0.42 dormant, 0.6 hunting, plus up to 0.5 × attack intensity | Yes, dormant opacity 0.42 ± 0.06 beat | Core adds about 146 red levels (sRGB), about 46 green and 60 blue, on screen. Its glow spans about 2.4 m. This is the largest single source on screen. |
| 3 | Monster floor pool. `monsterVisual.ts` 120–124 (`opacity: 0.38`), `pulse()` | Same radial texture, 1.8 m plane at floor level. Additive. Opacity 0.38 dormant, 0.54 hunting | Yes | Floor pixels only. Core adds about 139 red levels. Walls only at grazing angles. |
| 4 | Radial texture colour space. `monsterVisual.ts` 43–57 | No `colorSpace` set, so the texture is read as linear. Other canvas textures in `renderer.ts` (60, 89) set `SRGBColorSpace` | Applies to sources 2 and 3 | Makes both sprites about 2× brighter at the core than the sRGB colour written in code. This is a bug, separate from the colour choice. |
| 5 | Scare light. `renderer.ts` ~540 (`0.5 + 0.6 * cinematic.flash`) | Same crimson light as source 1. Intensity 0.65 to 1.1 | No. Only in the caught close-up (`PLAYER_CAUGHT`) | About 2× source 1 at the face. Not in the corridor. |
| 6 | Monster light while the model is absent. `monsterVisual.ts` 325 | `ownLight.visible = false` on the procedural fallback path | No (fallback only) | None. |
| 7 | Procedural fallback light. `creature.ts` 233 (`0x8a0812`, 0.55, 2.6, decay 2) | Same as source 1. Used only when the GLB fails to load | Fallback only | Same as source 1 when the fallback is in use. Not the production path. |
| 8 | Flashlight SpotLight. `renderer.ts` 181 (`0xfff1d0`, `FLASHLIGHT_INTENSITY` 9, distance 11, angle 0.5, decay 2). Intensity set at 510–516 | Warm white (R 1.0, G 0.88, B 0.63 linear). Not red | Yes, when the flashlight is on | Largest light in the beam. About 104 levels on a wall 2 m away in the cone, with the same R/G/B warm ratio. Not red, but warm. It is the main reason the walls look warm near the player. |
| 9 | Fluorescent point lights. `renderer.ts` 342–345 (`ARCHIVE_LIGHTING.fluorescent` `0xe4f5ec`, 1.6, distance 7). Count: medium 3, high 5, low 0. Flicker 579–580 | Cool green-white, neutral | Yes | About 31 neutral levels on a wall 2.5 m away. This is the largest neutral source. |
| 10 | Ambient light. `renderer.ts` 178 (`0x3a3d3a`, 1.1) | Neutral green-grey | Yes | About 11 neutral levels on walls. |
| 11 | Hemisphere light. `renderer.ts` ~180–181 (`0x1c1f1d` / `0x0d0d0d`, 0.15) | Neutral | Yes | Negligible. |
| 12 | Scene background and fog. `renderer.ts` 172, 174 (`0x171717`, FogExp2 0.085) | Charcoal, neutral. The palette test asserts channel spread ≤ 2 | Yes | None on walls. Fog is a neutral blend toward charcoal. |
| 13 | Exit glow. `renderer.ts` 284 (`0xc9e7d6`, 1.1, distance 4). Medium and high only | Pale green | Yes, near the exit | Not red. |
| 14 | Wall, floor, and ceiling textures. `renderer.ts` 205–231, `archiveScene.ts` palette | Neutral grey albedo (about 74, 74, 76). Wall pixels contain no red albedo | Yes | None. |
| 15 | `.gm-vignette`. `game.css` 247–253 | Black `rgba(0,0,0,0.82)` at the edge. No red | Yes | None. No CSS change needed. |
| 16 | `.gm-grain`. `game.css` 256–264, `feColorMatrix saturate 0` | Greyscale noise at 5% opacity | Yes | None. Neutral. |
| 17 | `.gm-scare` overlay. `game.css` 175–187 | `rgba(150,10,10,0.1)` to `rgba(110,0,0,0.75)`. Reduced motion: `rgba(90,0,0,0.45)` | No. Only in `PLAYER_CAUGHT` | Full-screen red at up to 0.75 alpha. Caught state only. |
| 18 | `.gm-whiteout` `game.css` 293–300 | `#f5efe6`, neutral. Caught only | No | None. |
| 19 | `ARCHIVE_LIGHTING` values (`archiveScene.ts` 69–76) | background `0x171717`, ambient `0x3a3d3a`, hemisphere `0x1c1f1d` / `0x0d0d0d`, fluorescent `0xe4f5ec`. All neutral or cool | Yes | None. No change needed. |

### Estimated wall red in an empty corridor (monster dormant, one fragment collected)

Approximate sRGB levels for a neutral grey wall, with the red channel shown. Ambient and fluorescent add the same level
to all channels, so they set the grey. Creature light, halo, and flashlight add red on top.

| Light | Red added (levels) | Notes |
|---|---|---|
| Ambient + hemisphere (neutral) | about 11 | Base grey. |
| Fluorescent, one lamp at about 2.5 m (neutral) | about 31 | Largest neutral source. |
| Monster point light at 1.5 m (crimson) | about 11 | Roughly doubles the red of the ambient base. |
| Monster point light at 1.0 m (crimson) | about 24 | |
| Monster halo core on screen (crimson) | about 146 | Plus about 46 green and 60 blue. Largest red source where it overlaps. |
| Flashlight in the beam at 2 m (warm white) | about 104 | Not red. Warm. |

Monster sources (1, 2, 3) are the only red sources in the corridor. Their red contribution is larger than the
neutral base wherever the halo overlaps a wall. Source 4 makes the halo brighter than intended.

## Proposed changes

These need a renderer and a monster-visual edit. The brief limits this step to `creature.ts` colour and intensity
lines, `game.css` `.gm-vignette`, and `archiveScene.ts` `ARCHIVE_LIGHTING`. None of the allowed lines can gate the
production light on monster state. The `creature.ts` light is used only on the procedural fallback path. Changing its
colour would also change hunting on that path. So I made no edits in this step.

Proposed changes, in order of effect:

1. **Monster light and halo gated on hunting** (`monsterVisual.ts`, coordinator).
   - In `pulse()` (389–396), keep `0x8a0812` for PURSUING and ATTACKING. For DORMANT and SEARCHING, set
     `ownLight.color` to a neutral warm grey (for example `0xd8d4cc`) and intensity to about 0.15. The creature stays
     readable under the fluorescents without red.
   - Set halo and floor-pool opacity to 0 when not hunting. Keep the current 0.6 and 0.54 levels when hunting. The
     attack bump (`attack` term) stays crimson, because it is monster-state.
   - Alternative if the dormant creature becomes too dark: keep a dim neutral halo (opacity about 0.15) instead of 0.
2. **Fix the halo texture colour space** (`monsterVisual.ts` `radialTexture`, 43–57). Add
   `texture.colorSpace = THREE.SRGBColorSpace`, as `renderer.ts` already does for its canvas textures. The crimson
   stays the same, and the halo and pool become about half as bright at the core. This is a small fix, not a colour
   change, so it preserves the monster signal.
3. **Reset and scare lights** (`renderer.ts`, coordinator).
   - Line 405 (`resetView`): set the light intensity to the dormant neutral value from change 1, not 0.55.
   - Line 540 (scare): keep the crimson light at the impact, because the caught state is a hunting outcome. The brief
     asks for neutral warm white here. If the coordinator follows the brief, set the scare light colour to a warm white
     such as `0xfff1d0` and keep the intensity curve. The halo stays crimson.
4. **Flashlight** (`renderer.ts` 181). Already warm white, not red. Optional: `0xfff4e6` for a more neutral white. Not
   a red fix.
5. **Vignette and grain** (`game.css`). No red values in `.gm-vignette` or `.gm-grain`. No change needed.
   `.gm-scare` (175–187) is red, but it only shows in the caught state, which is a hunting outcome. Keep it. If the
   coordinator wants a neutral overlay, change `.gm-scare` only, because it is not `.gm-vignette`.
6. **Archive lighting** (`archiveScene.ts`). No red values. No change needed.

## Blocked or deferred

- Pixel-level confirmation needs a browser capture, which the brief excludes for this step. The coordinator should
  read the canvas in the four scenarios (empty corridor before any fragment, storage room, monster dormant after a
  fragment, active encounter) to confirm the estimates above.
- The fallback creature light (`creature.ts` 233) is not in the production path. Its colour decision follows the
  coordinator's choice in change 1.

## Files

- Read: `renderer.ts`, `monsterVisual.ts`, `creature.ts`, `archive/archiveScene.ts`, `styles/game.css`,
  `tests/archiveScene.test.ts`.
- Written: this report only.
- Not edited: all source files and tests.
