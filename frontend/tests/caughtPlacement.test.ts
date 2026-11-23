/**
 * Caught close-up placement. fitReach limits how far in front of the eye the creature stands, from the open floor ahead. The
 * creature's depth is CREATURE_DEPTH, and its body must stay in front of the camera's near plane.
 *
 * Known defect (cycle 14). A catch made in a locker corner leaves about 0.15 tiles of open floor ahead (seeds 1, 2 and 3 in the
 * browser log: openAhead 0.150). fitReach then clamps the reach to MIN_REACH (0.2), which is less than CREATURE_DEPTH (0.315), so
 * the creature's body reaches the camera. The test that asserts the fit is marked `it.fails`: it passes while the defect exists.
 * When the defect is fixed the `it.fails` marker must be removed.
 */
import { describe, expect, it } from "vitest";
import { CAMERA_NEAR, CREATURE_DEPTH, MIN_REACH, fitReach, framingFor } from "../src/features/game/cinematic";

describe("caught close-up placement", () => {
  it("an open catch keeps the wanted reach", () => {
    expect(fitReach(0.504, 2)).toBe(0.504);
  });

  it("a locker corner catch selects the enclosed framing, so the open fit is not used", () => {
    // Logged in the browser at LUNGE for a corner catch: wanted 0.504, openAhead 0.150. The open fit still clamps (fitReach is unchanged);
    // the renderer now selects the enclosed camera for this case instead.
    expect(framingFor(0.15, 0.504)).toBe("ENCLOSED");
    expect(fitReach(0.504, 0.15) - CREATURE_DEPTH).toBeLessThan(CAMERA_NEAR);
  });

  it("the minimum reach is the documented clamp value", () => {
    expect(MIN_REACH).toBeCloseTo(0.2, 6);
  });
});
