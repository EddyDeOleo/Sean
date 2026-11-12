import { describe, expect, it } from "vitest";
import {
  DORMANT_AFTER_CATCHES,
  GRID_HEIGHT,
  GRID_WIDTH,
  MAX_FRAGMENTS,
  SLOW_AFTER_CATCHES,
  canComplete,
  createGame,
  distances,
  hashSeed,
  isFloor,
  makeRandom,
  pathActions,
  pointKey,
  presenceActs,
  remainingFragments,
  samePoint,
  step,
  type Action,
  type GameState,
  type Point,
} from "../src/features/escape/escapeEngine";

const SEEDS = Array.from({ length: 60 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

describe("seed and random", () => {
  it("hashes the same text to the same unsigned 32-bit seed", () => {
    expect(hashSeed("abc")).toBe(hashSeed("abc"));
    expect(hashSeed("abc")).not.toBe(hashSeed("abd"));
    expect(hashSeed("abc")).toBeGreaterThanOrEqual(0);
    expect(hashSeed("abc")).toBeLessThan(2 ** 32);
  });

  it("produces a repeatable sequence in [0, 1)", () => {
    const a = makeRandom(7);
    const b = makeRandom(7);
    for (let i = 0; i < 50; i += 1) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("level generation", () => {
  it("is deterministic for the same seed and fragment count", () => {
    const a = createGame(SEEDS[3] as string, 3);
    const b = createGame(SEEDS[3] as string, 3);
    expect(a).toEqual(b);
  });

  it("changes geometry for a different seed", () => {
    const layouts = new Set(SEEDS.map((seed) => JSON.stringify(createGame(seed, 2).tiles)));
    expect(layouts.size).toBeGreaterThan(20);
  });

  it("keeps the grid size and a walled border", () => {
    const game = createGame(SEEDS[0] as string, 4);
    expect(game.tiles).toHaveLength(GRID_HEIGHT);
    for (const row of game.tiles) expect(row).toHaveLength(GRID_WIDTH);
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      expect(game.tiles[0]?.[x]).toBe("WALL");
      expect(game.tiles[GRID_HEIGHT - 1]?.[x]).toBe("WALL");
    }
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      expect(game.tiles[y]?.[0]).toBe("WALL");
      expect(game.tiles[y]?.[GRID_WIDTH - 1]).toBe("WALL");
    }
  });

  it("clamps the fragment count to 0..MAX_FRAGMENTS and never invents fragments", () => {
    expect(createGame(SEEDS[0] as string, 0).fragments).toHaveLength(0);
    expect(createGame(SEEDS[0] as string, 99).fragments).toHaveLength(MAX_FRAGMENTS);
    expect(createGame(SEEDS[0] as string, -3).fragments).toHaveLength(0);
    expect(createGame(SEEDS[0] as string, 2.9).fragments).toHaveLength(2);
  });

  it("places the entrance, exit, fragments, and hiding places on distinct floor tiles", () => {
    for (const seed of SEEDS) {
      const game = createGame(seed, MAX_FRAGMENTS);
      const points: Point[] = [game.entrance, game.exit, ...game.fragments.map((f) => f.at), ...game.hiding];
      const keys = points.map(pointKey);
      expect(new Set(keys).size).toBe(keys.length);
      for (const point of points) expect(isFloor(game.tiles, point)).toBe(true);
    }
  });

  it("makes every fragment and the exit reachable for every seed and fragment count", () => {
    for (const seed of SEEDS) {
      for (let count = 0; count <= MAX_FRAGMENTS; count += 1) {
        const game = createGame(seed, count);
        expect(canComplete(game)).toBe(true);
      }
    }
  });

  it("reports an unreachable layout as not completable", () => {
    const game = createGame(SEEDS[0] as string, 2);
    const walled = game.tiles.map((row) => [...row]);
    // Wall off the exit's neighbours.
    for (const delta of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const row = walled[game.exit.y + delta[1]];
      if (row && row[game.exit.x + delta[0]]) row[game.exit.x + delta[0]] = "WALL";
    }
    expect(canComplete({ ...game, tiles: walled })).toBe(false);
  });

  it("keeps fragments away from the entrance", () => {
    for (const seed of SEEDS) {
      const game = createGame(seed, MAX_FRAGMENTS);
      const reach = distances(game.tiles, game.entrance);
      for (const fragment of game.fragments) expect(reach.get(pointKey(fragment.at)) ?? 0).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("rules", () => {
  it("blocks movement into a wall without moving the player", () => {
    const game = createGame(SEEDS[0] as string, 1);
    const blocked = (["UP", "LEFT"] as const).find((d) => !isFloor(game.tiles, { x: game.player.x + (d === "LEFT" ? -1 : 0), y: game.player.y + (d === "UP" ? -1 : 0) }));
    expect(blocked).toBeDefined();
    const next = step(game, blocked as Action);
    expect(next.player).toEqual(game.player);
    expect(next.event.kind).toBe("BLOCKED");
  });

  it("does nothing once the game is over", () => {
    const base = createGame(SEEDS[0] as string, 0);
    const over: GameState = { ...base, status: "ESCAPED" };
    expect(step(over, "WAIT")).toBe(over);
  });

  it("keeps the exit sealed until every fragment is collected", () => {
    const game = createGame(SEEDS[1] as string, 2);
    const toExit = pathActions(game.tiles, game.entrance, game.exit) as Action[];
    // Teleport-free: walk the path with the presence made harmless by dormancy.
    let state: GameState = { ...game, catches: DORMANT_AFTER_CATCHES };
    for (const action of toExit) state = step(state, action);
    // The straight path to the exit can pass over a fragment. Only assert when it left some uncollected.
    if (remainingFragments(state) > 0) {
      expect(state.status).toBe("PLAYING");
      expect(samePoint(state.player, game.exit)).toBe(true);
      expect(state.event.kind).toBe("EXIT_SEALED");
    } else {
      expect(state.status).toBe("ESCAPED");
    }
  });

  it("slows the presence after two catches and stops it after four", () => {
    expect(presenceActs({ catches: 0, turn: 1 })).toBe(true);
    expect(presenceActs({ catches: SLOW_AFTER_CATCHES, turn: 1 })).toBe(false);
    expect(presenceActs({ catches: SLOW_AFTER_CATCHES, turn: 2 })).toBe(true);
    expect(presenceActs({ catches: DORMANT_AFTER_CATCHES, turn: 2 })).toBe(false);
    expect(presenceActs({ catches: DORMANT_AFTER_CATCHES + 3, turn: 4 })).toBe(false);
  });

  it("returns a caught player to the entrance and keeps collected fragments", () => {
    const game = createGame(SEEDS[2] as string, 2);
    const fragments = game.fragments.map((f, i) => ({ ...f, collected: i === 0 }));
    // Put the presence next to the player so the next step catches them.
    const neighbour = (["UP", "DOWN", "LEFT", "RIGHT"] as const)
      .map((d) => ({ x: game.player.x + (d === "LEFT" ? -1 : d === "RIGHT" ? 1 : 0), y: game.player.y + (d === "UP" ? -1 : d === "DOWN" ? 1 : 0) }))
      .find((p) => isFloor(game.tiles, p)) as Point;
    const moved = step({ ...game, fragments, presence: neighbour, player: { ...game.player } }, "WAIT");
    expect(moved.event.kind).toBe("CAUGHT");
    expect(moved.catches).toBe(1);
    expect(moved.player).toEqual(game.entrance);
    expect(moved.fragments[0]?.collected).toBe(true);
  });

  it("does not catch a hidden player", () => {
    const game = createGame(SEEDS[4] as string, 1);
    const alcove = game.hiding[0];
    if (!alcove) return;
    const next = (["UP", "DOWN", "LEFT", "RIGHT"] as const)
      .map((d) => ({ x: alcove.x + (d === "LEFT" ? -1 : d === "RIGHT" ? 1 : 0), y: alcove.y + (d === "UP" ? -1 : d === "DOWN" ? 1 : 0) }))
      .find((p) => isFloor(game.tiles, p)) as Point;
    const state: GameState = { ...game, player: alcove, presence: next };
    const after = step(state, "WAIT");
    expect(after.catches).toBe(0);
    expect(samePoint(after.presence, alcove)).toBe(false);
  });
});

/** Walk the shortest route to each fragment, then to the exit. Re-plans after every catch. */
function playToTheEnd(seed: string, fragments: number, limit: number): GameState {
  let state = createGame(seed, fragments);
  for (let turns = 0; turns < limit && state.status === "PLAYING"; turns += 1) {
    const pending = state.fragments.filter((f) => !f.collected);
    const goal = pending.length > 0 ? (pending[0] as (typeof pending)[number]).at : state.exit;
    const route = pathActions(state.tiles, state.player, goal);
    state = step(state, route && route.length > 0 ? (route[0] as Action) : "WAIT");
  }
  return state;
}

describe("completability", () => {
  it("lets a persistent player escape on every seed and fragment count, even when caught repeatedly", () => {
    for (const seed of SEEDS) {
      for (const count of [0, 1, 2, 3, MAX_FRAGMENTS]) {
        const end = playToTheEnd(seed, count, 4000);
        expect(end.status, `seed ${seed} fragments ${count} caught ${end.catches} turn ${end.turn}`).toBe("ESCAPED");
        expect(remainingFragments(end)).toBe(0);
      }
    }
  });

  it("never needs more than the dormancy bound of catches", () => {
    for (const seed of SEEDS) {
      const end = playToTheEnd(seed, MAX_FRAGMENTS, 4000);
      expect(end.catches).toBeLessThanOrEqual(DORMANT_AFTER_CATCHES);
    }
  });
});
