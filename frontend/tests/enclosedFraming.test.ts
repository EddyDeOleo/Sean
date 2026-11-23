/**
 * Enclosed catch framing (cycle 15). Measured geometry: wall 0.5 tiles past a locker's tile centre; locker eye 0.3 tiles from the
 * centre toward the wall; clear floor behind the locker eye 1.8 to 3.98 tiles across the nine hiding spots (worst 1.8 at 23.5, 8.5).
 * Creature body extent behind its head, measured per phase from skinned bounds: 0.25 to 0.57 tiles.
 */
import { describe, expect, it } from "vitest";
import {
  ANCHOR_SHIFT, CREATURE_BACK_CLEARANCE, CREATURE_BACK_EXTENT, CREATURE_DEPTH, LOCKER_WALL_DISTANCE, RETREAT_MARGIN, enclosedCamera, framingFor,
} from "../src/features/game/cinematic";

const WALL_CLEARANCE = 0.05;
const forward = { x: 1, y: 0 };

describe("framing selection", () => {
  it("open catch: the normal framing fits", () => {
    expect(framingFor(2, 0.504)).toBe("NORMAL");
  });
  it("0.15-tile enclosed depth: the enclosed framing is chosen", () => {
    expect(framingFor(0.15, 0.504)).toBe("ENCLOSED");
  });
  it("a wall close to the eye with enough depth for the creature: the normal framing holds", () => {
    expect(framingFor(0.9, 0.455)).toBe("NORMAL");
  });
});

describe("enclosed camera", () => {
  it("locker corner (seed 1, 9.5, 3.5): the eye steps out of the locker and the head stays at the creature's tile", () => {
    const cam = enclosedCamera({ x: 9.5, y: 3.5 }, forward, { x: 9.8, y: 3.5 }, 0.455, 3.98);
    expect(cam.reach).toBeCloseTo(0.455, 6);
    expect(cam.eye.x + cam.reach).toBeCloseTo(cam.anchor.x, 6);
    expect(cam.anchor.x).toBeCloseTo(9.5 - ANCHOR_SHIFT, 6);
    expect(cam.eye.x).toBeLessThan(9.78);
  });
  it("worst-case locker (23.5, 8.5, 1.8 clear behind): an anticipation reach is shortened to keep the retreat margin", () => {
    const cam = enclosedCamera({ x: 23.5, y: 8.5 }, forward, { x: 23.8, y: 8.5 }, 1.186, 1.8);
    expect(cam.retreat).toBeLessThanOrEqual(1.8 - RETREAT_MARGIN + 1e-9);
    expect(cam.reach).toBeLessThan(1.186);
    expect(cam.reach).toBeGreaterThan(0.9);
  });
  it("the eye never passes through the locker front (0.28 tiles from the spot centre)", () => {
    for (const reach of [0.455, 0.504, 0.963, 1.186]) {
      const cam = enclosedCamera({ x: 9.5, y: 3.5 }, forward, { x: 9.8, y: 3.5 }, reach, 1.8);
      expect(cam.eye.x).toBeLessThan(9.5 + 0.28);
    }
  });
});

describe("creature bounds against the wall", () => {
  // Measured head-relative extents toward the wall, per phase, from the skinned bounds (seed 1 enclosed fixture).
  const measuredBack = { ANTICIPATION: 0.27, ACCELERATION: 0.44, LUNGE: 0.55, IMPACT: 0.57, HOLD: 0.57 };
  it("the body's furthest extent behind the head stays CREATURE_BACK_CLEARANCE from the wall in every phase", () => {
    for (const [phase, extent] of Object.entries(measuredBack)) {
      const wallFromAnchor = LOCKER_WALL_DISTANCE + ANCHOR_SHIFT;
      expect(extent, phase).toBeLessThanOrEqual(wallFromAnchor - CREATURE_BACK_CLEARANCE + 1e-9);
    }
  });
  it("the shift is the measured worst extent plus the margin, less the wall distance", () => {
    expect(ANCHOR_SHIFT).toBeCloseTo(CREATURE_BACK_EXTENT + CREATURE_BACK_CLEARANCE - LOCKER_WALL_DISTANCE, 9);
  });
  it("the near-plane clearance at HOLD is far larger than the camera's near distance", () => {
    expect(0.455 - CREATURE_DEPTH / 2).toBeGreaterThan(WALL_CLEARANCE);
  });
});