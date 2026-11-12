import { describe, expect, it } from "vitest";
import { MAX_FRAGMENTS, createGame, pathActions, remainingFragments, step, type Action, type GameState } from "../src/features/escape/escapeEngine";

/** A persistent player who never uses the hiding places: the worst case for the completability guarantee. */
function play(seed: string, fragments: number, limit: number): GameState {
  let state = createGame(seed, fragments);
  for (let turns = 0; turns < limit && state.status === "PLAYING"; turns += 1) {
    const pending = state.fragments.filter((f) => !f.collected);
    const goal = pending.length > 0 ? (pending[0] as (typeof pending)[number]).at : state.exit;
    const route = pathActions(state.tiles, state.player, goal);
    state = step(state, route && route.length > 0 ? (route[0] as Action) : "WAIT");
  }
  return state;
}

describe("completability sweep", () => {
  it("escapes within a bounded number of turns on 400 seeds", () => {
    let worstTurns = 0;
    let worstCatches = 0;
    for (let i = 0; i < 400; i += 1) {
      const seed = `sweep-${i}`;
      const end = play(seed, MAX_FRAGMENTS, 3000);
      expect(end.status, `seed ${seed}`).toBe("ESCAPED");
      expect(remainingFragments(end)).toBe(0);
      worstTurns = Math.max(worstTurns, end.turn);
      worstCatches = Math.max(worstCatches, end.catches);
    }
    // The bound is a regression guard: if the rules change so that play takes much longer, the guarantee needs review.
    expect(worstCatches).toBeLessThanOrEqual(4);
    expect(worstTurns).toBeLessThan(1500);
    console.log(`sweep: 400 seeds escaped, worst turns ${worstTurns}, worst catches ${worstCatches}`);
  });
});
