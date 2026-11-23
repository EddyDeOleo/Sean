/**
 * The caught cinematic. These tests cover the pure timeline (phases, ordering, continuity, framing, reduced motion), the
 * wall-limited reach, the link between the defeat card's CSS delay and the timeline, and the scare pose, which must not
 * accumulate over repeated frames.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  CAMERA_NEAR,
  CINEMATIC_TIMES,
  CREATURE_DEPTH,
  APPROACH_TILT,
  FACE_DISTANCE,
  MIN_REACH,
  cinematicAt,
  fitReach,
  phaseAt,
  type CinematicFrame,
  type CinematicPhase,
} from "../src/features/game/cinematic";
import { MODEL_HEIGHT } from "../src/features/game/monsterVisual";
import { graspBones } from "../src/features/game/monsterAnimation";
import { poseWithOffsets, snapshotPose, type PoseSnapshot } from "../src/features/game/monsterPose";

const ORDER: CinematicPhase[] = ["ANTICIPATION", "ACCELERATION", "LUNGE", "IMPACT", "HOLD", "DEFEAT_CARD"];
const STEP = 0.001;
const END = 3;

/** Every frame of the timeline, one per millisecond, from the catch to three seconds after it. */
function samples(reducedMotion = false): { time: number; frame: CinematicFrame }[] {
  const out: { time: number; frame: CinematicFrame }[] = [];
  for (let i = 0; i <= Math.round(END / STEP); i += 1) {
    const time = i * STEP;
    out.push({ time, frame: cinematicAt(time, reducedMotion) });
  }
  return out;
}

describe("the phases", () => {
  it("change at the times listed in CINEMATIC_TIMES, in the required order", () => {
    expect(ORDER.map((phase) => CINEMATIC_TIMES[phase])).toEqual([0, 0.3, 0.5, 0.62, 0.8, 1.4]);
    expect(phaseAt(0)).toBe("ANTICIPATION");
    expect(phaseAt(0.29)).toBe("ANTICIPATION");
    expect(phaseAt(0.3)).toBe("ACCELERATION");
    expect(phaseAt(0.5)).toBe("LUNGE");
    expect(phaseAt(0.62)).toBe("IMPACT");
    expect(phaseAt(0.8)).toBe("HOLD");
    expect(phaseAt(1.4)).toBe("DEFEAT_CARD");
  });

  it("never goes back to an earlier phase as time passes, and visits every phase", () => {
    const visited: CinematicPhase[] = [];
    let last = -1;
    for (const { frame } of samples()) {
      const index = ORDER.indexOf(frame.phase);
      expect(index).toBeGreaterThanOrEqual(last);
      if (index !== last) visited.push(frame.phase);
      last = index;
    }
    expect(visited).toEqual(ORDER);
  });

  it("counts times before the catch and NaN as the catch, and an infinite time as the last phase", () => {
    expect(phaseAt(-1)).toBe("ANTICIPATION");
    expect(phaseAt(Number.NaN)).toBe("ANTICIPATION");
    expect(cinematicAt(-5, false)).toEqual(cinematicAt(0, false));
    expect(phaseAt(Number.POSITIVE_INFINITY)).toBe("DEFEAT_CARD");
    expect(cinematicAt(Number.POSITIVE_INFINITY, false).reach).toBeCloseTo(FACE_DISTANCE, 9);
  });
});

describe("the defeat card", () => {
  it("is never visible before the defeat card phase, and is visible from it on", () => {
    for (const { time, frame } of samples()) {
      expect(frame.cardVisible).toBe(time >= CINEMATIC_TIMES.DEFEAT_CARD);
    }
  });

  it("matches the CSS delay of the defeat card in game.css", () => {
    // The test runs from the frontend directory (npm scripts and vitest both do), so the stylesheet is read from there.
    const css = readFileSync(join(process.cwd(), "src", "styles", "game.css"), "utf8");
    const rule = /\.gm-caught\[data-scare="true"\]\s*\{\s*animation:\s*gm-card-in\s+[\d.]+s\s+ease-out\s+([\d.]+)s/.exec(css);
    expect(rule).not.toBeNull();
    expect(Number(rule![1])).toBe(CINEMATIC_TIMES.DEFEAT_CARD);
  });
});

describe("continuity", () => {
  it("has no jumps in reach, grasp or field of view between frames", () => {
    let previous = cinematicAt(0, false);
    for (const { frame } of samples().slice(1)) {
      expect(Math.abs(frame.reach - previous.reach)).toBeLessThan(0.01);
      expect(Math.abs(frame.grasp - previous.grasp)).toBeLessThan(0.02);
      expect(Math.abs(frame.fov - previous.fov)).toBeLessThan(0.1);
      previous = frame;
    }
  });

  it("has matching values at each phase boundary for reach, grasp and field of view", () => {
    for (const phase of ORDER.slice(1)) {
      const at = CINEMATIC_TIMES[phase];
      const before = cinematicAt(at - 1e-9, false);
      const after = cinematicAt(at, false);
      expect(before.reach).toBeCloseTo(after.reach, 3);
      expect(before.grasp).toBeCloseTo(after.grasp, 3);
      expect(before.fov).toBeCloseTo(after.fov, 3);
    }
  });
});

describe("the approach and the hold", () => {
  it("brings the head monotonically closer from the start of the approach to the impact", () => {
    let previous = Number.POSITIVE_INFINITY;
    for (const { time, frame } of samples()) {
      if (time > CINEMATIC_TIMES.IMPACT) break;
      expect(frame.reach).toBeLessThanOrEqual(previous + 1e-9);
      previous = frame.reach;
    }
  });

  it("holds the face at the framed distance and the scare field of view from the impact on", () => {
    for (const { time, frame } of samples()) {
      if (time < CINEMATIC_TIMES.IMPACT) continue;
      expect(frame.reach).toBeCloseTo(FACE_DISTANCE, 9);
      expect(frame.grasp).toBe(1);
      expect(frame.fov).toBe(60);
    }
  });

  it("starts the approach at more than a model height away and ends it at the framed face distance", () => {
    expect(cinematicAt(0, false).reach).toBeCloseTo(MODEL_HEIGHT * 1.2, 9);
    expect(cinematicAt(CINEMATIC_TIMES.LUNGE, false).reach).toBeCloseTo(MODEL_HEIGHT * 0.67, 3);
  });
});

describe("the framing is derived from the model height and the near plane", () => {
  it("places the face where a span of half the model height fills the view at the scare field of view", () => {
    const half = Math.tan((60 * Math.PI) / 360);
    expect(FACE_DISTANCE * half * 2).toBeCloseTo(MODEL_HEIGHT * 0.5, 9);
  });

  it("keeps the face far beyond the camera's near plane", () => {
    expect(CAMERA_NEAR).toBe(0.05);
    expect(FACE_DISTANCE).toBeGreaterThan(MIN_REACH);
    expect(FACE_DISTANCE / CAMERA_NEAR).toBeGreaterThan(8);
  });

  it("uses the creature's depth as a third of its height", () => {
    expect(CREATURE_DEPTH).toBeCloseTo(MODEL_HEIGHT * 0.3, 9);
  });
});

describe("reduced motion", () => {
  it("has no shake, no kick and no approach, and sits at the final framing from the first frame", () => {
    for (const { frame } of samples(true)) {
      expect(frame.shake).toBe(0);
      expect(frame.kick).toBe(0);
      expect(frame.reach).toBeCloseTo(FACE_DISTANCE, 9);
      expect(frame.grasp).toBe(1);
    }
  });

  it("keeps the same phase timing and defeat card time as the full sequence", () => {
    const full = samples(false).map((s) => [s.frame.phase, s.frame.cardVisible]);
    const reduced = samples(true).map((s) => [s.frame.phase, s.frame.cardVisible]);
    expect(reduced).toEqual(full);
  });
});

describe("the approach tilt", () => {
  it("pitches the view down during the acceleration and is level from the impact on and with reduced motion", () => {
    for (const { frame } of samples()) {
      if (frame.phase === "ACCELERATION") expect(frame.tilt).toBe(APPROACH_TILT);
      if (["IMPACT", "HOLD", "DEFEAT_CARD"].includes(frame.phase)) expect(frame.tilt).toBe(0);
    }
    for (const { frame } of samples(true)) expect(frame.tilt).toBe(0);
    expect(cinematicAt(0, false).tilt).toBeCloseTo(0, 12);
  });

  it("has no jumps in tilt between frames", () => {
    const tilts = samples().map(({ frame }) => frame.tilt);
    tilts.slice(1).forEach((tilt, i) => expect(Math.abs(tilt - (tilts[i] ?? tilt))).toBeLessThan(0.02));
  });
});

describe("the impact", () => {
  it("shakes and kicks only at the impact and the first moments after it, and then settles", () => {
    const at = (time: number): CinematicFrame => cinematicAt(time, false);
    expect(at(CINEMATIC_TIMES.IMPACT).shake).toBeGreaterThan(0.04);
    expect(at(CINEMATIC_TIMES.IMPACT).kick).toBeGreaterThan(0.05);
    expect(at(CINEMATIC_TIMES.HOLD + 0.5).shake).toBeLessThan(1e-3);
    expect(at(CINEMATIC_TIMES.HOLD + 0.5).kick).toBe(0);
    for (const { time, frame } of samples()) {
      if (time < CINEMATIC_TIMES.IMPACT || time >= CINEMATIC_TIMES.HOLD) expect(frame.kick).toBe(0);
      expect(frame.shake).toBeLessThanOrEqual(0.05 + 1e-9);
    }
  });

  it("flashes the aura at the impact, and the flash never exceeds 1", () => {
    expect(cinematicAt(CINEMATIC_TIMES.IMPACT, false).flash).toBeCloseTo(1, 9);
    for (const { frame } of samples()) {
      expect(frame.flash).toBeGreaterThanOrEqual(0);
      expect(frame.flash).toBeLessThanOrEqual(1);
    }
  });
});

describe("fitReach", () => {
  it("keeps the wanted reach when the floor is open far enough for the body", () => {
    expect(fitReach(FACE_DISTANCE, 5)).toBe(FACE_DISTANCE);
  });

  it("pulls the head in when a wall would pass through the body", () => {
    const open = FACE_DISTANCE + 0.1;
    expect(fitReach(FACE_DISTANCE, open)).toBeCloseTo(open - CREATURE_DEPTH, 9);
    expect(fitReach(FACE_DISTANCE, open)).toBeLessThan(FACE_DISTANCE);
  });

  it("never comes closer than the minimum reach, even against a wall right in front", () => {
    expect(fitReach(FACE_DISTANCE, 0)).toBe(MIN_REACH);
    expect(fitReach(FACE_DISTANCE, 0.1)).toBe(MIN_REACH);
  });
});

describe("the scare pose does not accumulate", () => {
  /** A small skeleton with a constant clip pose on every bone, and the grasp applied as offsets by bone name. */
  function skeleton(): { skel: THREE.Skeleton; clip: PoseSnapshot } {
    const names = ["spine", "chest", "neck", "head", "shoulder.L", "upperArmL", "lowerArm.L", "hand.L"];
    const bones = names.map((name, i) => {
      const bone = new THREE.Bone();
      bone.name = name;
      bone.quaternion.setFromEuler(new THREE.Euler(0.05 * (i + 1), 0.02 * i, -0.03 * i));
      return bone;
    });
    const skel = new THREE.Skeleton(bones);
    return { skel, clip: snapshotPose(bones) };
  }

  it("gives the same pose after many frames as after one, for every frame of the close-up", () => {
    const { skel, clip } = skeleton();
    const first = (grasp: number): PoseSnapshot => {
      poseWithOffsets(skel, clip, graspBones(grasp));
      return snapshotPose(skel.bones);
    };
    for (let time = 0; time <= END; time += 0.05) {
      const { grasp } = cinematicAt(time, false);
      const expected = first(grasp);
      for (let repeat = 0; repeat < 50; repeat += 1) poseWithOffsets(skel, clip, graspBones(grasp));
      const after = snapshotPose(skel.bones);
      // angleTo goes through acos, which turns float rounding of about 1e-16 into about 1e-8, so 1e-6 is the honest bound.
      for (let i = 0; i < expected.length; i += 1) expect(after[i]!.angleTo(expected[i]!)).toBeLessThan(1e-6);
    }
  });

  it("returns to the clean clip pose when the grasp is zero", () => {
    const { skel, clip } = skeleton();
    poseWithOffsets(skel, clip, graspBones(1));
    poseWithOffsets(skel, clip, graspBones(0));
    skel.bones.forEach((bone, i) => expect(bone.quaternion.angleTo(clip[i]!)).toBeLessThan(1e-6));
  });

  it("applies the grasp to the bones it names, including the sanitised name of a dotted bone", () => {
    const { skel, clip } = skeleton();
    poseWithOffsets(skel, clip, { "upperArm.L": [0.5, 0, 0] });
    const arm = skel.getBoneByName("upperArmL")!;
    expect(arm.quaternion.angleTo(clip[5]!)).toBeGreaterThan(0.4);
  });
});
