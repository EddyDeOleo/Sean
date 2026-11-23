/**
 * Seed identity. Consecutive seeds must give independent random streams, the same seed must reproduce the same creature
 * trajectory, and different seeds must diverge. The creature's rules are not part of these tests: they only exercise the
 * generator's initial state and the existing step function under a stationary player.
 */
import { describe, expect, it } from "vitest";
import { createWorld, initialRandomState, step } from "../src/features/game/world";
import { LEVEL } from "../src/features/game/level";

/** The generator's first output for a state, as the world's nextRandom computes it (LCG step, then the unit interval). */
function firstDraw(state: number): number {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return next / 4294967296;
}

/** A stationary-player trajectory: the creature's position every 10 seconds, with its state, for 120 seconds. */
function trajectory(seed: number): string[] {
  const world = createWorld(null, "low", LEVEL, seed);
  world.wakeAt = 0;
  const out: string[] = [];
  for (let frame = 0; frame < 60 * 120; frame += 1) {
    step(world, { forward: 0, strafe: 0, turn: 0, sprint: false, interact: false } as never, 1 / 60);
    if (frame % 600 === 0) out.push(`${world.monster.pos.x.toFixed(2)},${world.monster.pos.y.toFixed(2)},${world.monster.state}`);
  }
  return out;
}

describe("seed identity", () => {
  it("consecutive seeds give well-separated first draws", () => {
    const draws = Array.from({ length: 16 }, (_, i) => firstDraw(initialRandomState(i + 1)));
    for (let i = 1; i < draws.length; i += 1) {
      expect(Math.abs(draws[i]! - draws[i - 1]!), `seeds ${i} and ${i + 1}`).toBeGreaterThan(0.05);
    }
  });

  it("the same seed reproduces the same creature trajectory", () => {
    expect(trajectory(3)).toEqual(trajectory(3));
  });

  it("seeds 2 and 3 diverge under the same stationary player", () => {
    expect(trajectory(2)).not.toEqual(trajectory(3));
  });

  it("the generator state is never zero", () => {
    for (let seed = 0; seed < 64; seed += 1) expect(initialRandomState(seed)).not.toBe(0);
  });
});
