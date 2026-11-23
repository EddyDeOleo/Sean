/**
 * Clean-pose restoration for the monster's skeleton. These tests use the real three.js AnimationMixer and bones, with no
 * browser. They prove that the procedural attack and arm lift never accumulate across frames, that each frame starts from
 * the clean clip pose, and that a cancelled attack leaves no residual transform.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { MonsterAnimationController, attackBones, type AnimationFrame, type AnimationInput } from "../src/features/game/monsterAnimation";
import { addBoneOffset, restorePose, snapshotPose, type PoseSnapshot } from "../src/features/game/monsterPose";
import type { MonsterState } from "../src/features/game/world";

const FRAME = 1 / 60;
const DEG = 180 / Math.PI;
/** The clip holds the neck at a constant pitch, so any extra rotation is visible as an angle from it. */
const CLIP_PITCH = 0.3;

interface Rig {
  mixer: THREE.AnimationMixer;
  bones: THREE.Bone[];
  clip: THREE.Quaternion;
  neck: THREE.Bone;
  arm: THREE.Bone;
}

/** A small rig: a neck, a head and a left upper arm, all animated by one constant clip pose. */
function rig(): Rig {
  const root = new THREE.Group();
  const names = ["neck", "head", "upperArmL"];
  const bones = names.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    root.add(bone);
    return bone;
  });
  const clip = new THREE.Quaternion().setFromEuler(new THREE.Euler(CLIP_PITCH, 0, 0));
  const values = [clip.x, clip.y, clip.z, clip.w, clip.x, clip.y, clip.z, clip.w];
  const tracks = names.map((name) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, [0, 1], values));
  const action = new THREE.AnimationMixer(root).clipAction(new THREE.AnimationClip("idle", 1, tracks));
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  const mixer = action.getMixer();
  return { mixer, bones, clip, neck: bones[0]!, arm: bones[2]! };
}

/** The angle, in degrees, between a bone's rotation and the clean clip pose. */
function degreesFromClip(bone: THREE.Bone, clip: THREE.Quaternion): number {
  return bone.quaternion.angleTo(clip) * DEG;
}

/** The same frame the game runs: restore the clean pose, let the mixer write the clip, record it, then add the offsets. */
function frameWithOffsets(r: Rig, pose: PoseSnapshot | null, offsets: (bones: Rig) => void): PoseSnapshot {
  if (pose) restorePose(r.bones, pose);
  r.mixer.update(FRAME);
  const recorded = snapshotPose(r.bones);
  offsets(r);
  return recorded;
}

describe("without restoration, the real mixer adds the offsets up frame to frame", () => {
  it("grows an attack offset of 11.46 degrees into 57 degrees over five frames", () => {
    const r = rig();
    const offset = [0, 0, 0.2] as const;
    const angles: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      r.mixer.update(FRAME);
      angles.push(degreesFromClip(r.neck, r.clip));
      addBoneOffset(r.neck, offset);
    }
    // Each frame adds the same offset to what is already there, so the angle grows by the same step every frame.
    expect(angles[0]).toBeCloseTo(0, 6);
    for (let i = 1; i < angles.length; i += 1) expect(angles[i]! - angles[i - 1]!).toBeCloseTo(11.46, 1);
    expect(angles[5]).toBeCloseTo(57.3, 0);
  });
});

describe("with restoration, every frame starts from the clean clip pose", () => {
  it("applies one offset exactly once over sixty consecutive frames", () => {
    const r = rig();
    const offset = [0, 0, 0.2] as const;
    let pose: PoseSnapshot | null = null;
    for (let i = 0; i < 60; i += 1) {
      pose = frameWithOffsets(r, pose, (x) => addBoneOffset(x.neck, offset));
      // Once this frame's offset is added, the neck is exactly one offset from the clip, on every frame.
      expect(degreesFromClip(r.neck, r.clip)).toBeCloseTo(11.46, 1);
    }
    // The last frame's offset is the only one present: a single 0.2 rad turn on top of the clip.
    expect(degreesFromClip(r.neck, r.clip)).toBeCloseTo(11.46, 1);
  });

  it("keeps a sustained attack layer at the same angle on every frame", () => {
    const r = rig();
    const hold = attackBones(1, 1);
    let pose: PoseSnapshot | null = null;
    const seen: number[] = [];
    for (let i = 0; i < 120; i += 1) {
      pose = frameWithOffsets(r, pose, (x) => {
        for (const [name, [ax, ay, az]] of Object.entries(hold)) {
          if (name === "neck") addBoneOffset(x.neck, [ax, ay, az]);
        }
      });
      seen.push(degreesFromClip(r.neck, r.clip));
    }
    const expected = Math.abs(hold.neck![0]) * DEG;
    for (const angle of seen) expect(angle).toBeCloseTo(expected, 3);
  });

  it("applies a changing lunge once per frame, with that frame's value", () => {
    const r = rig();
    let pose: PoseSnapshot | null = null;
    let last = 0;
    for (let i = 0; i <= 12; i += 1) {
      const lunge = i / 12;
      pose = frameWithOffsets(r, pose, (x) => addBoneOffset(x.neck, attackBones(1, lunge).neck!));
      last = lunge;
    }
    // The neck's final offset is the lunge value of the last frame, not a sum over the twelve frames.
    const expected = Math.abs(attackBones(1, last).neck![0]) * DEG;
    expect(degreesFromClip(r.neck, r.clip)).toBeCloseTo(expected, 3);
  });

  it("does not accumulate the caught arm lift over repeated caught frames", () => {
    const r = rig();
    const pose = snapshotPose(r.bones);
    const lift = [0, 0, 1.1] as const;
    for (let caught = 0; caught < 30; caught += 1) {
      // The caught close-up restores the clean pose before it lifts the arm, on every frame.
      restorePose(r.bones, pose);
      addBoneOffset(r.arm, lift);
      expect(r.arm.quaternion.angleTo(new THREE.Quaternion()) * DEG).toBeCloseTo(1.1 * DEG, 3);
    }
  });
});

describe("recovery and interruption leave no residual transform", () => {
  it("returns every bone to the clip pose after the offsets are cleared", () => {
    const r = rig();
    const pose = frameWithOffsets(r, null, (x) => {
      addBoneOffset(x.neck, [0.5, 0, 0]);
      addBoneOffset(x.arm, [0, 0, 1.1]);
    });
    restorePose(r.bones, pose);
    for (const bone of r.bones) expect(bone.quaternion.angleTo(r.clip)).toBeCloseTo(0, 6);
  });
});

/** Steps the controller by `seconds` with one AI state, collecting every frame. */
function frames(c: MonsterAnimationController, state: MonsterState, seconds: number): AnimationFrame[] {
  const input: AnimationInput = { state, speed: 0, distance: 3, reducedMotion: false };
  const out: AnimationFrame[] = [];
  for (let i = 0; i < Math.round(seconds / FRAME); i += 1) out.push(c.update(input, FRAME));
  return out;
}

describe("an interrupted attack does not leave a layer behind", () => {
  it("ends with no attack layer after the attack is cancelled mid-lunge and the recovery finishes", () => {
    const c = new MonsterAnimationController();
    frames(c, "ATTACKING", 0.2);
    const recovery = frames(c, "PURSUING", 0.6);
    const last = recovery[recovery.length - 1]!;
    expect(last.attackPhase).toBe("NONE");
    expect(last.attack).toBeNull();
    // The recovery's layer fades, it never grows back after the interruption.
    const intensities = recovery.map((f) => f.attack?.intensity ?? 0);
    for (let i = 1; i < intensities.length; i += 1) expect(intensities[i]!).toBeLessThanOrEqual(intensities[i - 1]! + 1e-9);
  });

  it("starts a second attack from its anticipation, not from the interrupted lunge", () => {
    const c = new MonsterAnimationController();
    frames(c, "ATTACKING", 0.2);
    frames(c, "DORMANT", 0.05);
    const second = frames(c, "ATTACKING", FRAME);
    const first = second[0]!;
    expect(first.attackPhase).toBe("ANTICIPATION");
    // The neck offset at anticipation is a small lean, far from the lunge's full value.
    expect(Math.abs(first.attack!.bones.neck![0])).toBeLessThan(0.02);
  });
});
