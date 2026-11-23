/**
 * The monster's animation controller: which clip plays, the playback rate, the procedural attack (its single trigger, its
 * order, its distance limit, its recovery), reduced motion and frame-rate independence. Pure logic: no browser needed.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  ANTICIPATION_SECONDS,
  LUNGE_SECONDS,
  MonsterAnimationController,
  RECOVERY_SECONDS,
  RUN_REFERENCE_SPEED,
  WALK_REFERENCE_SPEED,
  GRASP_RIGHT_ARM,
  attackBones,
  graspBones,
  rightArmWeight,
  locomotionClip,
  playbackRate,
  type AnimationFrame,
  type AnimationInput,
  type BoneAngles,
} from "../src/features/game/monsterAnimation";
import { cinematicAt } from "../src/features/game/cinematic";
import { MODEL_HEIGHT } from "../src/features/game/monsterVisual";
import type { MonsterState } from "../src/features/game/world";

/**
 * Rest pose of the rigged production model (public/models/sean-monster-250k-rigged.glb), read from its node hierarchy:
 * each joint's translation and rotation quaternion relative to its parent, parents first.
 */
const REST: Record<string, { parent: string | null; t: [number, number, number]; q: [number, number, number, number] }> = {
  hips: { parent: null, t: [0, 0.5137013776302337, -0.05311627155297423], q: [0.021161589675927347, 0, 0, 0.999776068488533] },
  spine: { parent: "hips", t: [0, 0.08340776669655481, 0], q: [-0.04882176158855504, 0, 0, 0.9988075067776525] },
  chest: { parent: "spine", t: [0, 0.09538389262830604, 0], q: [-0.019767148366732257, 0, 0, 0.9998046108342608] },
  neck: { parent: "chest", t: [0, 0.11958524341595744, 0], q: [0.49895156858263867, 0, 0, 0.8666298703650391] },
  head: { parent: "neck", t: [0, 0.04702939606316109, 0], q: [-0.4572869829405688, 0, 0, 0.8893191863628671] },
  "shoulder.L": { parent: "chest", t: [0.0176165771484375, 0.09708958706973492, -0.0026085594503999845], q: [0.03223525051898356, 0.0344724754348685, -0.6698490240973607, 0.7409958312819205] },
  "upperArm.L": { parent: "shoulder.L", t: [0, 0.05859026834693773, 0], q: [-0.03381066359293067, 0.03372426654199373, -0.6449519661534415, 0.7627296206575567] },
  "lowerArm.L": { parent: "upperArm.L", t: [0, 0.19111665564676406, 0], q: [0.1682731782411391, -0.0028102480530136716, -0.03860639307712466, 0.9849800944202279] },
  "hand.L": { parent: "lowerArm.L", t: [0, 0.16197186092178895, 0], q: [-0.14299060789036203, 0.0034359268642871984, 0.03484127355131411, 0.9891046284994577] },
  "shoulder.R": { parent: "chest", t: [-0.0176165771484375, 0.09708958706973492, -0.0026085594503999845], q: [0.03223525051898356, -0.0344724754348685, 0.6698490240973607, 0.7409958312819205] },
  "upperArm.R": { parent: "shoulder.R", t: [0, 0.05859026834693773, 0], q: [-0.03381066359293067, -0.03372426654199373, 0.6449519661534415, 0.7627296206575567] },
  "lowerArm.R": { parent: "upperArm.R", t: [0, 0.19111665564676406, 0], q: [0.1682731782411391, 0.0028102480530136716, 0.03860639307712466, 0.9849800944202279] },
  "hand.R": { parent: "lowerArm.R", t: [0, 0.16197186092178895, 0], q: [-0.14299060789036203, -0.0034359268642871984, -0.03484127355131411, 0.9891046284994577] },
};

/**
 * The rig's height in its own units, from the bounds of assets/monster/source/original/sean-monster-model.glb (0.9787). The
 * model is scaled to MODEL_HEIGHT.
 */
const RIG_HEIGHT = 0.9787;
/** Camera constants of the caught close-up (renderer.ts): the eye height, the head joint 0.03 below it, and a 1280 x 720 view. */
const EYE_Y = 0.55;
const HEAD_Y = EYE_Y - 0.03;
const ASPECT = 1280 / 720;

/**
 * Rig-space joint positions of the posed skeleton, applied as the renderer applies them: offsets are local-frame Euler angles,
 * then the right arm turns toward GRASP_RIGHT_ARM by `rightArm` (0 to 1).
 */
function jointPositions(offsets: Record<string, BoneAngles>, rightArm = 0): Map<string, THREE.Vector3> {
  const world = new Map<string, { p: THREE.Vector3; q: THREE.Quaternion }>();
  for (const [name, joint] of Object.entries(REST)) {
    const local = new THREE.Quaternion(joint.q[0], joint.q[1], joint.q[2], joint.q[3]);
    const offset = offsets[name];
    if (offset) local.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(offset[0], offset[1], offset[2], "XYZ")));
    const target = GRASP_RIGHT_ARM[name];
    if (target) local.slerp(new THREE.Quaternion(target[0], target[1], target[2], target[3]).normalize(), rightArm);
    const parent = joint.parent ? world.get(joint.parent)! : { p: new THREE.Vector3(), q: new THREE.Quaternion() };
    const p = new THREE.Vector3(joint.t[0], joint.t[1], joint.t[2]).applyQuaternion(parent.q).add(parent.p);
    world.set(name, { p, q: parent.q.clone().multiply(local) });
  }
  return new Map([...world].map(([name, w]) => [name, w.p]));
}

/**
 * Where each hand is on the screen during the caught close-up at `time` seconds after the catch. The head joint sits on the
 * view line at the cinematic's reach, so every hand is measured from the head. `ndcX` and `ndcY` are in [-1, 1] inside the frame.
 * `behindFace` is how far the hand is beyond the face's plane (positive means further from the eye).
 */
function handsOnScreen(time: number): Record<"L" | "R", { ndcX: number; ndcY: number; behindFace: number }> {
  const frame = cinematicAt(time, false);
  const joints = jointPositions(graspBones(frame.grasp), rightArmWeight(frame.grasp));
  const head = joints.get("head")!;
  const scale = MODEL_HEIGHT / RIG_HEIGHT;
  const tanHalf = Math.tan((frame.fov * Math.PI) / 360);
  const out = {} as Record<"L" | "R", { ndcX: number; ndcY: number; behindFace: number }>;
  for (const side of ["L", "R"] as const) {
    const rel = joints.get(`hand.${side}`)!.clone().sub(head);
    const distance = frame.reach - rel.z * scale;
    out[side] = {
      ndcX: (rel.x * scale) / (distance * tanHalf * ASPECT),
      ndcY: (HEAD_Y + rel.y * scale - EYE_Y) / (distance * tanHalf),
      behindFace: distance - frame.reach,
    };
  }
  return out;
}

const input = (over: Partial<AnimationInput> & { state: MonsterState }): AnimationInput => ({
  speed: 0,
  distance: 10,
  reducedMotion: false,
  ...over,
});

/** Steps the controller by `seconds` with the same input, returning the last frame. */
function run(c: MonsterAnimationController, over: Partial<AnimationInput> & { state: MonsterState }, seconds: number, step = 1 / 60): AnimationFrame {
  let frame: AnimationFrame | null = null;
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i += 1) frame = c.update(input(over), step);
  return frame!;
}

describe("the clip follows the AI state and the real speed", () => {
  it("is IDLE while the monster is dormant, or standing still", () => {
    expect(locomotionClip("DORMANT", 3)).toBe("IDLE");
    expect(locomotionClip("PURSUING", 0)).toBe("IDLE");
  });
  it("is WALK while the monster moves at a walking pace", () => {
    expect(locomotionClip("INVESTIGATING", 1.5)).toBe("WALK");
    expect(locomotionClip("SEARCHING", 3)).toBe("WALK");
  });
  it("is RUN only while pursuing at a pursuit pace", () => {
    expect(locomotionClip("PURSUING", 3)).toBe("RUN");
    expect(locomotionClip("PURSUING", 1.5)).toBe("WALK");
  });
});

describe("the playback rate is the real speed relative to the clip's authored speed", () => {
  it("is 1 at the authored speeds and idle is always 1", () => {
    expect(playbackRate("WALK", WALK_REFERENCE_SPEED)).toBeCloseTo(1, 6);
    expect(playbackRate("RUN", RUN_REFERENCE_SPEED)).toBeCloseTo(1, 6);
    expect(playbackRate("IDLE", 3)).toBe(1);
  });
  it("is clamped so a very fast or slow monster does not distort the clip", () => {
    expect(playbackRate("RUN", 50)).toBe(1.6);
    expect(playbackRate("WALK", 0.4)).toBe(0.5);
  });
});

describe("the attack starts once, from its entry into ATTACKING", () => {
  it("begins with anticipation on entry", () => {
    const c = new MonsterAnimationController();
    const frame = c.update(input({ state: "ATTACKING" }), 1 / 60);
    expect(frame.attackPhase).toBe("ANTICIPATION");
    expect(frame.attack).not.toBeNull();
  });
  it("is not restarted by later attack ticks: the phase moves on and does not return to anticipation", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "ATTACKING" }, ANTICIPATION_SECONDS + 0.05);
    expect(c.update(input({ state: "ATTACKING" }), 1 / 60).attackPhase).toBe("LUNGE");
    const later = run(c, { state: "ATTACKING" }, 0.3);
    expect(later.attackPhase).toBe("HOLD");
  });
  it("plays the clip IDLE during the attack, whatever the monster was doing before", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "PURSUING", speed: 3 }, 0.5);
    expect(c.update(input({ state: "ATTACKING" }), 1 / 60).clip).toBe("IDLE");
  });
});

describe("the attack's order and extent", () => {
  it("anticipation leans back, then the lunge drives forward", () => {
    const early = attackBones(0.5, 0);
    const late = attackBones(1, 1);
    expect(early.spine![0]).toBeLessThan(0);
    expect(late.spine![0]).toBeGreaterThan(0.4);
    expect(late["upperArm.L"]![0]).toBeGreaterThan(0.6);
  });
  it("the grasp's left arm swings outward, bends the elbow and curls the hand", () => {
    const g = graspBones(1);
    expect(g["upperArm.L"]![2]).toBeGreaterThan(0);
    expect(g["lowerArm.L"]![0]).toBeLessThan(-0.4);
    expect(g["hand.L"]![0]).toBeLessThan(-0.2);
  });
  it("the right arm is driven only by its targets, not by grasp offsets", () => {
    for (const name of Object.keys(GRASP_RIGHT_ARM)) expect(graspBones(1)[name]).toBeUndefined();
    for (const q of Object.values(GRASP_RIGHT_ARM)) expect(Math.hypot(...q)).toBeCloseTo(1, 3);
  });
  it("the right shoulder rises with the arm, the elbow flexes forward, and the arm is not folded", () => {
    const rest = jointPositions({}, 0);
    const grasp = jointPositions({}, 1);
    // Regression (cycle 18): the clavicle stayed level, so the shoulder joint sat low beside a raised arm.
    expect(grasp.get("upperArm.R")!.y - rest.get("upperArm.R")!.y).toBeGreaterThan(0.01);
    // The rig's elbow flexion is +x on the forearm. The old offset turned it the other way and bent the elbow backward.
    const restQ = new THREE.Quaternion(...REST["lowerArm.R"]!.q);
    const relative = restQ.clone().invert().multiply(new THREE.Quaternion(...GRASP_RIGHT_ARM["lowerArm.R"]!));
    expect(relative.x * Math.sign(relative.w)).toBeGreaterThan(0.3);
    // The elbow's interior angle (shoulder, elbow, wrist) is a clear bend, neither straight nor collapsed.
    const elbow = grasp.get("lowerArm.R")!;
    const interior = grasp.get("upperArm.R")!.clone().sub(elbow).angleTo(grasp.get("hand.R")!.clone().sub(elbow)) * (180 / Math.PI);
    expect(interior).toBeGreaterThan(70);
    expect(interior).toBeLessThan(120);
    // The forearm rises from the elbow to the wrist: an attacking claw, not a hanging arm.
    expect(grasp.get("hand.R")!.y - elbow.y).toBeGreaterThan(0.05);
  });
  it("the right arm's weight eases out: it starts at 0, ends at 1, never reverses, and leads the grasp mid-way", () => {
    expect(rightArmWeight(0)).toBe(0);
    expect(rightArmWeight(1)).toBe(1);
    expect(rightArmWeight(2)).toBe(1);
    let previous = 0;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const w = rightArmWeight(t);
      expect(w).toBeGreaterThanOrEqual(previous);
      previous = w;
    }
    const easeInOut = (u: number) => u * u * (3 - 2 * u);
    for (const t of [0.25, 0.5, 0.75]) expect(rightArmWeight(t)).toBeGreaterThan(easeInOut(t));
  });
  it("keeps every joint of the grasp within natural limits at every point of the close-up", () => {
    for (let t = 0; t <= 1.4001; t += 0.01) {
      const g = graspBones(Math.min(1, t));
      for (const [name, [x, , z]] of Object.entries(g)) {
        const limit = name.startsWith("lowerArm") ? 2.2 : name.startsWith("shoulder") || name.startsWith("upperArm") ? 2.0 : Infinity;
        expect(Math.abs(x)).toBeLessThanOrEqual(limit);
        expect(Math.abs(z)).toBeLessThanOrEqual(limit);
      }
    }
  });
  it("the grasp starts from nothing: at 0 every bone is at the clean clip pose", () => {
    for (const angles of Object.values(graspBones(0))) for (const v of angles) expect(v).toBeCloseTo(0, 12);
  });
  it("the lunge carries the body forward, and never closer than the stop distance to the player", () => {
    const c = new MonsterAnimationController();
    const frames: number[] = [];
    for (let i = 0; i < 60; i += 1) frames.push(c.update(input({ state: "ATTACKING", distance: 1.5 }), 1 / 60).attack!.bodyX);
    const maxTravel = Math.max(...frames);
    expect(maxTravel).toBeGreaterThan(0.1);
    expect(maxTravel).toBeLessThanOrEqual(1.5 - 0.6 + 1e-9);
  });
  it("does not move the body at all when the player is already at the stop distance", () => {
    const c = new MonsterAnimationController();
    const frame = run(c, { state: "ATTACKING", distance: 0.6 }, LUNGE_SECONDS + ANTICIPATION_SECONDS + 0.1);
    expect(frame.attack!.bodyX).toBe(0);
  });
  it("reaches the hold with full intensity", () => {
    const c = new MonsterAnimationController();
    const frame = run(c, { state: "ATTACKING" }, ANTICIPATION_SECONDS + LUNGE_SECONDS + 0.1);
    expect(frame.attackPhase).toBe("HOLD");
    expect(frame.attack!.intensity).toBe(1);
  });
});

describe("recovery returns to the locomotion clip and restores the rest pose", () => {
  it("fades the attack layer out over the recovery time and then clears it", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "ATTACKING" }, 0.4);
    const first = c.update(input({ state: "PURSUING", speed: 3 }), 1 / 60);
    expect(first.attackPhase).toBe("RECOVERY");
    expect(first.attack).not.toBeNull();
    const done = run(c, { state: "PURSUING", speed: 3 }, RECOVERY_SECONDS + 0.05);
    expect(done.attack).toBeNull();
    expect(done.attackPhase).toBe("NONE");
    expect(done.clip).toBe("RUN");
  });
  it("a new attack during recovery takes priority and starts anticipation again", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "ATTACKING" }, 0.3);
    run(c, { state: "PURSUING", speed: 3 }, 0.1);
    expect(c.update(input({ state: "ATTACKING" }), 1 / 60).attackPhase).toBe("ANTICIPATION");
  });
});

describe("reduced motion, timing and blending", () => {
  it("applies no attack layer when reduced motion is on, but the clip still follows the AI", () => {
    const c = new MonsterAnimationController();
    const attack = c.update({ state: "ATTACKING", speed: 0, distance: 1, reducedMotion: true }, 1 / 60);
    expect(attack.attack).toBeNull();
    expect(attack.clip).toBe("IDLE");
    const walk = c.update({ state: "INVESTIGATING", speed: 1.5, distance: 9, reducedMotion: true }, 1 / 60);
    expect(walk.attack).toBeNull();
    expect(walk.clip).toBe("WALK");
  });
  it("gives the same attack phases at 60 frames a second and at 20", () => {
    const fine = new MonsterAnimationController();
    const coarse = new MonsterAnimationController();
    const a = run(fine, { state: "ATTACKING" }, 0.3, 1 / 60);
    const b = run(coarse, { state: "ATTACKING" }, 0.3, 1 / 20);
    expect(a.attackPhase).toBe(b.attackPhase);
    expect(Math.abs(a.attack!.bodyX - b.attack!.bodyX)).toBeLessThan(0.02);
  });
  it("clips a stalled frame, so a long pause does not skip the attack", () => {
    const c = new MonsterAnimationController();
    c.update(input({ state: "ATTACKING" }), 10);
    expect(c.update(input({ state: "ATTACKING" }), 1 / 60).attackPhase).toBe("ANTICIPATION");
  });
});

describe("a new attempt starts with no attack in progress", () => {
  it("reset during the lunge leaves no attack layer on the next frame", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "ATTACKING" }, 0.2);
    c.reset();
    const next = c.update(input({ state: "DORMANT" }), 1 / 60);
    expect(next.attack).toBeNull();
    expect(next.attackPhase).toBe("NONE");
    expect(c.attacking).toBe(false);
  });
  it("a fresh attack after reset starts at anticipation again", () => {
    const c = new MonsterAnimationController();
    run(c, { state: "ATTACKING" }, 0.2);
    c.reset();
    const again = c.update(input({ state: "ATTACKING" }), 1 / 60);
    expect(again.attackPhase).toBe("ANTICIPATION");
  });
});

describe("the hands stay in the caught frame at the lunge and the impact", () => {
  // The frame's edges are at NDC +/-1. The hands are required to stay within +/-0.9, a 5 percent margin.
  const LIMIT = 0.9;
  // The timeline frames the lunge (0.55 s), the impact (0.70 s), and the hold after them (0.8 s to the card at 1.4 s).
  const TIMES = [0.55, 0.7, 0.8, 1.0, 1.4];

  it("keeps both hands inside the frame at the lunge and the impact", () => {
    for (const time of TIMES) {
      const hands = handsOnScreen(time);
      for (const side of ["L", "R"] as const) {
        expect(Math.abs(hands[side].ndcX), `hand ${side} at ${time}s`).toBeLessThanOrEqual(LIMIT);
        expect(hands[side].ndcY, `hand ${side} at ${time}s`).toBeGreaterThanOrEqual(-LIMIT);
        expect(hands[side].ndcY, `hand ${side} at ${time}s`).toBeLessThanOrEqual(LIMIT);
      }
    }
  });

  it("keeps both hands inside the frame across the whole close-up from the lunge on", () => {
    for (let time = 0.55; time <= 1.4; time += 0.01) {
      const hands = handsOnScreen(time);
      for (const side of ["L", "R"] as const) {
        expect(hands[side].ndcY, `hand ${side} at ${time.toFixed(2)}s`).toBeGreaterThanOrEqual(-LIMIT);
        expect(Math.abs(hands[side].ndcX), `hand ${side} at ${time.toFixed(2)}s`).toBeLessThanOrEqual(LIMIT);
      }
    }
  });

  // Removed in cycle 11: the periphery and face-plane checks read wrist joints only. A browser measurement of the rendered hand
  // showed that wrist positions do not predict the visible hand, so these assertions no longer describe the frame. Browser
  // captures are the acceptance evidence for hand placement.

  it("gives asymmetric hand positions, not mirror images, at the impact", () => {
    const hands = handsOnScreen(0.7);
    // A mirror image would have the same depth and vertical position with the lateral offset flipped; the arms differ.
    expect(Math.abs(hands.L.ndcY - hands.R.ndcY)).toBeGreaterThan(0.005);
    expect(Math.abs(Math.abs(hands.L.ndcX) - Math.abs(hands.R.ndcX))).toBeGreaterThan(0.005);
  });


});
