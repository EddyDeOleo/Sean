/**
 * The game's simulation is deterministic: the same seed and the same input sequence give the same run, step for step. This is
 * what makes the browser test clock meaningful. These tests use the real world and step functions, with no browser.
 */
import { describe, expect, it } from "vitest";
import { LEVEL } from "../src/features/game/level";
import { createWorld, step, type Input, type World } from "../src/features/game/world";
import { FIXED_STEP, worldSeed } from "../src/features/game/testClock";

/** A fixed, varied input script: walk, turn, pause and sprint in a repeating pattern. */
function scriptedInput(i: number): Input {
  const phase = Math.floor(i / 90) % 6;
  return {
    forward: phase === 4 ? 0 : 1,
    strafe: phase === 2 ? 0.5 : 0,
    turn: phase === 1 ? 1.4 : phase === 3 ? -1.1 : 0,
    sprint: phase === 5,
  };
}

/** Runs the script for `steps` fixed steps and returns the monster and player positions after each step, as a string. */
function run(seed: number, steps: number): { trace: string; world: World } {
  const world = createWorld(null, "low", LEVEL, seed);
  const lines: string[] = [];
  for (let i = 0; i < steps && world.status === "PLAYING"; i += 1) {
    step(world, scriptedInput(i), FIXED_STEP);
    lines.push(`${i} ${world.monster.state} ${world.monster.pos.x.toFixed(6)},${world.monster.pos.y.toFixed(6)} ${world.player.pos.x.toFixed(6)},${world.player.pos.y.toFixed(6)}`);
  }
  return { trace: lines.join("\n"), world };
}

describe("the simulation is deterministic for a seed and an input script", () => {
  it("two runs with the same seed and the same inputs are identical, step for step", () => {
    const a = run(7, 3600);
    const b = run(7, 3600);
    expect(a.trace).toBe(b.trace);
    expect(a.trace.length).toBeGreaterThan(0);
  });

  it("a different seed starts the random generator in a different state", () => {
    // The monster stays dormant until the first clue, so routes diverge only after it wakes. The seed itself is compared here.
    expect(createWorld(null, "low", LEVEL, 7).monster.rng).not.toBe(createWorld(null, "low", LEVEL, 8).monster.rng);
    expect(createWorld(null, "low", LEVEL, 7).monster.rng).toBe(createWorld(null, "low", LEVEL, 7).monster.rng);
  });

  it("the test seed for each attempt is reproducible and differs between attempts", () => {
    const first = { seed: 42 };
    expect(worldSeed(1, first)).toBe(42);
    expect(worldSeed(2, first)).toBe(43);
    expect(worldSeed(3, first)).toBe(44);
    // Without the test clock the normal rule holds: the attempt number is the seed.
    expect(worldSeed(3, null)).toBe(3);
  });
});
