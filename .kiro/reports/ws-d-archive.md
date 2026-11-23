# Workstream D: institutional archive decoration

Status: IMPLEMENTED and unit-tested. Not browser-verified. Not wired into the renderer yet.

## Files (all new, nothing else edited)

- `frontend/src/features/game/archive/archiveLayout.ts`: pure placement rules on the tile grid (no three.js).
- `frontend/src/features/game/archive/archiveScene.ts`: `buildArchiveDecor(scene, level, { textureSize, quality })` returning `{ stats, dispose }`.
- `frontend/tests/archiveScene.test.ts`: 8 tests.
- This file: `.kiro/reports/ws-d-archive.md`.

No existing file was edited. `renderer.ts`, `GameView.tsx`, `level.ts`, `world.ts`, monster code, e2e files and `phase-status.md` are untouched.

## Verification run

- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- `npx vitest run tests/archiveScene.test.ts`: 8 passed, 0 failed.
  - Non-zero count for all 13 counted classes on both a small parsed map and the real `LEVEL`.
  - No instance on a reserved tile or a non-floor tile (checked on the built scene's instance positions).
  - Every planned footprint lies inside its own tile.
  - Two builds give identical instance matrices and stats.
  - `dispose()` fires the dispose event on every geometry, removes the group, and tolerates a second call.
  - Budget guard: at most 40 instanced meshes and 150,000 triangles.

## Element counts on the real game level

| Class | Count |
|---|---|
| Filing cabinets | 23 |
| Shelving units | 10 |
| Archive boxes on shelves | 101 |
| Labels (one per shelf box) | 101 |
| Acoustic panels | 85 |
| Fluorescent fixtures | 23 |
| Ceiling vents | 11 |
| Wall vents | 7 |
| Baseboards | 151 |
| Institutional doors | 10 |
| Document carts | 11 |
| Waste bins | 4 |
| Crate stacks | 2 |

Counts are the same for low, medium and high. Quality only changes the segment count of round parts (bins and casters).

## Budget estimate (real level)

- Instanced meshes (draw calls added): 27. Each part kind and each label material is one InstancedMesh.
- Triangles: about 11,600 (low), 12,000 (medium), 12,750 (high).
- Geometries: 26 shared. Materials: 13. Canvas textures: 5 (one perforated panel texture and four label textures).
- Lights added: none. Fluorescent fixtures are emissive meshes only, so the existing renderer lights are unchanged.

## Hook for the coordinator (renderer.ts)

Add the import:

```ts
import { buildArchiveDecor, type ArchiveDecor } from "./archive/archiveScene";
```

Add the field `private archiveDecor: ArchiveDecor | null = null;`, then in the `GameRenderer` constructor, directly after `this.buildLevel();` (inside the existing `try`), add this one-line call:

```ts
this.archiveDecor = buildArchiveDecor(this.scene, this.level, { textureSize: this.profile.textureSize, quality });
```

`dispose()` in renderer.ts already traverses the scene and frees these resources, so an extra `this.archiveDecor?.dispose()` is optional.

## Known risks and decisions for the coordinator

- Overlap with the existing `buildFurniture` in renderer.ts. It also places shelves, lockers and screens against walls on open tiles, so some wall tiles may get two objects. Decide whether to keep, reduce, or remove the old furniture.
- `ARCHIVE_CEILING = 1.15` in `archiveLayout.ts` duplicates `WALL_HEIGHT` in renderer.ts. Keep them in step, or export one value.
- Reserved tiles are wider than the brief's list. They also exclude the four neighbours of the gate and every patrol point, so the gate and patrol points stay visually clear.
- Free-standing props (carts, bins, crates) stand only in corners or against room-edge walls. Wall items stand only on tiles with three open sides. Corridors keep their full one-tile width.

## Still needs browser evidence

- Screenshots from real gameplay positions, including an encounter, with the flashlight on. Check that the decor reads under the flashlight and does not hide the creature.
- How the emissive fixtures look without a real light attached, and whether a light should be added.
- Frame rate on the low and medium quality profiles.
- That no decor clips the camera at walls during movement.
