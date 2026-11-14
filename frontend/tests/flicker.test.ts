import { describe, expect, it } from "vitest";
import { DROPOUT_LEVEL, FLICKER_HOLD, flickerFactor, hash } from "../src/features/game/flicker";

/** Count the changes of brightness per second over a long run, for many lights at once. */
function changesPerSecond(near: number, seeds: number[], seconds = 120, step = 1 / 120): number {
  let worst = 0;
  for (const seed of seeds) {
    const changes: number[] = [];
    let previous = flickerFactor(0, near, seed);
    for (let t = step; t < seconds; t += step) {
      const now = flickerFactor(t, near, seed);
      if (now !== previous) changes.push(t);
      previous = now;
    }
    // The most changes inside any window of one second.
    for (let i = 0; i < changes.length; i += 1) {
      let count = 1;
      while (i + count < changes.length && changes[i + count]! - changes[i]! < 1) count += 1;
      worst = Math.max(worst, count);
    }
  }
  return worst;
}

describe("light disturbances stay within the photosensitivity limit", () => {
  it("no light changes more than three times in any second, however close the creature is and whatever the seed", () => {
    for (const near of [0.3, 0.6, 1]) {
      expect(changesPerSecond(near, Array.from({ length: 40 }, (_, i) => i))).toBeLessThanOrEqual(3);
    }
  });

  it("holds each state for at least the hold time", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      let since = 0;
      let previous = flickerFactor(0, 1, seed);
      for (let t = 0.005; t < 60; t += 0.005) {
        const now = flickerFactor(t, 1, seed);
        if (now !== previous) {
          if (since > 0) expect(t - since).toBeGreaterThanOrEqual(FLICKER_HOLD - 0.01);
          since = t;
          previous = now;
        }
      }
    }
  });

  it("does nothing far from the creature, and gets darker more often when it is close", () => {
    for (let t = 0; t < 30; t += 0.1) expect(flickerFactor(t, 0.2, 5)).toBe(1);
    const dark = (near: number) => {
      let count = 0;
      for (let seed = 0; seed < 200; seed += 1) for (let slot = 0; slot < 50; slot += 1) if (flickerFactor(slot * FLICKER_HOLD, near, seed) === DROPOUT_LEVEL) count += 1;
      return count;
    };
    expect(dark(1)).toBeGreaterThan(dark(0.4));
    expect(dark(0.4)).toBeGreaterThan(0);
  });

  it("is deterministic and its hash stays in range", () => {
    expect(flickerFactor(12.3, 0.8, 4)).toBe(flickerFactor(12.3, 0.8, 4));
    for (let i = 0; i < 1000; i += 1) {
      const h = hash(i, i * 7);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
});
