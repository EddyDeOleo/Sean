// Merges the three rigged animation GLBs into one production GLB: the idle file's skin and mesh, with the idle, walk and run
// clips. The source files are read only. Joint names and bind data are checked to match before anything is written.
//
// usage: node merge_rigged_animations.cjs <idle.glb> <walk.glb> <run.glb> <out.glb>
// The source inputs are in assets/monster/source/rigged/. From the repository root:
//   node scripts/monster/merge_rigged_animations.cjs assets/monster/source/rigged/sean-monster-idle-animation_rigged.glb
//     assets/monster/source/rigged/sean-monster-walk-animation_rigged.glb
//     assets/monster/source/rigged/sean-monster-run-animation_rigged.glb <out.glb>
// The production model (frontend/public/models/sean-monster-250k-rigged.glb) has this output's skeleton and three clips and
// is meshopt-compressed; the exact compression command was not recorded (see assets/monster/README.md).
//
// In-place locomotion: the hips' horizontal translation is removed from the walk and run clips, so the AI's movement is
// the only horizontal displacement. The vertical bob is kept.
//
// Requires a global install of the glTF Transform CLI (npm install -g @gltf-transform/cli). Its bundled libraries are loaded
// from the global npm folder, so the script does not depend on one machine's user path.
const path = require("node:path");
const { execSync } = require("node:child_process");
const cliModules = path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "@gltf-transform", "cli", "node_modules");
const core = require(path.join(cliModules, "@gltf-transform", "core"));
const ext = require(path.join(cliModules, "@gltf-transform", "extensions"));
const { MeshoptDecoder } = require(path.join(cliModules, "meshoptimizer"));
const { NodeIO } = core;

const io = () => new NodeIO().registerExtensions([ext.KHRMeshQuantization, ext.EXTMeshoptCompression]).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

function jointNames(doc) {
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) throw new Error("no skin");
  return skin.listJoints().map((j) => j.getName());
}

async function main() {
  const [idlePath, walkPath, runPath, outPath] = process.argv.slice(2);
  const reader = io();
  const idle = await reader.read(idlePath);
  const walk = await reader.read(walkPath);
  const run = await reader.read(runPath);
  const base = jointNames(idle);
  for (const [label, doc] of [["walk", walk], ["run", run]]) {
    const names = jointNames(doc);
    if (JSON.stringify(names) !== JSON.stringify(base)) throw new Error(`${label} skeleton does not match the idle skeleton`);
  }
  const root = idle.getRoot();
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));

  for (const [clipName, doc] of [["walk", walk], ["run", run]]) {
    const src = doc.getRoot().listAnimations()[0];
    const dst = idle.createAnimation(clipName);
    for (const ch of src.listChannels()) {
      const target = byName.get(ch.getTargetNode().getName());
      if (!target) throw new Error(`no node ${ch.getTargetNode().getName()} in idle file`);
      const inAcc = idle.createAccessor().setType("SCALAR").setArray(new Float32Array(ch.getSampler().getInput().getArray()));
      const srcOut = ch.getSampler().getOutput();
      const outType = srcOut.getType();
      let values = Float32Array.from(srcOut.getArray());
      if (ch.getTargetPath() === "translation" && target.getName() === "hips") {
        // Keep only the vertical bob: horizontal root motion would fight the AI's own movement.
        const rest = target.getTranslation();
        for (let i = 0; i < values.length; i += 3) {
          values[i] = rest[0];
          values[i + 2] = rest[2];
        }
      }
      const outAcc = idle.createAccessor().setType(outType).setArray(values);
      const sampler = idle.createAnimationSampler().setInterpolation(ch.getSampler().getInterpolation()).setInput(inAcc).setOutput(outAcc);
      dst.addSampler(sampler);
      dst.addChannel(idle.createAnimationChannel().setTargetNode(target).setTargetPath(ch.getTargetPath()).setSampler(sampler));
    }
  }
  // Remove the walk and run files' own copies of the mesh: nothing from them is used except their clips.
  await reader.write(outPath, idle);
  const clips = idle.getRoot().listAnimations().map((a) => a.getName());
  console.log(`MERGED ${outPath} clips=${clips.join(",")} joints=${base.length}`);
}
main().catch((e) => { console.error("ERROR " + e.message); process.exit(1); });
