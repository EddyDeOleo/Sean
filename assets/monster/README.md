# Monster 3D assets

The creature's source models and optional variants. The game loads none of these at runtime. Its only model is
`frontend/public/models/sean-monster-250k-rigged.glb`, loaded by `frontend/src/features/game/monsterVisual.ts`
(`MONSTER_MODEL_URL`).

## Layout and roles

| Path | Contents | Role |
|---|---|---|
| `source/original/sean-monster-model.glb` | Static mesh, about 2M triangles, no skeleton, three textures, meshopt-compressed (made with gltfpack 1.2) | Original model. `RIG_HEIGHT` in `frontend/tests/monsterAnimation.test.ts` was measured from its bounds. |
| `source/rigged/sean-monster-idle-animation_rigged.glb` | 250k triangles, 19-joint skin, one clip `idle`, uncompressed (made with Grab3D Auto-Rig Studio) | Merge input |
| `source/rigged/sean-monster-walk-animation_rigged.glb` | Same skin, one clip `walk` | Merge input |
| `source/rigged/sean-monster-run-animation_rigged.glb` | Same skin, one clip `run` | Merge input |
| `variants/sean-monster-100k.glb`, `-250k.glb`, `-500k.glb` | Static decimations of the original, 100k, 250k and 500k triangles (made with glTF-Transform 4.5.0) | Polygon benchmark candidates. The 250k decimation has the rigged files' triangle count. |
| `variants/sean-monster-250k-tex1024.glb`, `-250k-tex2048.glb` | The 250k mesh with 1024 and 2048 textures, no meshopt | Texture benchmark candidates |
| `variants/sean-monster.glb` | Byte-identical to `source/original/sean-monster-model.glb` | The copy that used to sit in `frontend/public/models/`. Kept so no file was deleted. It can be removed. |

## Git

- `variants/` is ignored (`.gitignore`). It stays on this machine only.
- `source/` is not ignored, and uploading it is still to be decided. Its four files total 88 MB, about 22 MB each. If they are
  uploaded, Git LFS is recommended.

## Development benchmark

On the dev server only, `frontend/src/dev/modelVariantsPlugin.ts` serves the files in `variants/` under `/models/<name>.glb`.
So these still work:
- `?monsterModel=/models/sean-monster-100k.glb` in the game (development builds only, `monsterVisual.ts`);
- `frontend/monster-validation.html?monsterModel=/models/sean-monster-100k.glb`.

Production builds (`npm run build`) contain only the runtime model.

## Pipeline

1. **Original to rigged.** The three rigged files were produced outside this repository with Grab3D Auto-Rig Studio, one clip
   per file.
2. **Merge.** `scripts/monster/merge_rigged_animations.cjs` takes the idle file's skin and mesh, adds the idle, walk and run
   clips, and removes the hips' horizontal movement from walk and run. It needs a global
   `npm install -g @gltf-transform/cli`. From the repository root:

   ```powershell
   node scripts/monster/merge_rigged_animations.cjs `
     assets/monster/source/rigged/sean-monster-idle-animation_rigged.glb `
     assets/monster/source/rigged/sean-monster-walk-animation_rigged.glb `
     assets/monster/source/rigged/sean-monster-run-animation_rigged.glb `
     <out.glb>
   ```

3. **Compression.** The runtime model has the merged skeleton and clips (`idle`, `walk`, `run`) and is meshopt-compressed
   (written by glTF-Transform 4.5.0).

## Known reproducibility limits

- The commands that made the variants and that compressed the runtime model were not recorded. The merge step can be run
  again; the runtime file cannot be reproduced byte for byte.
- `scripts/monster/rig_monster.py` is a Blender rigging script that bakes five clips (idle, walk, run, jumpscare,
  recovery). It is not the path that produced the rigged files, which came from Grab3D with one clip each. Its docstring
  refers to a `build_monster_assets.ps1` that does not exist.
- The approved Spec 4 (section on the monster's body) still names `sean-monster.glb` in `frontend/public/models/`. That text
  predates the rigged runtime model, and updating it needs owner approval.
