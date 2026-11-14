import { describe, expect, it } from "vitest";
import { LEVEL, findPath, hasLineOfSight, isBlocked, tileAt } from "../src/features/game/level";
import {
  CATCH_DISTANCE, HEARING, NO_INPUT, PROFILE, SPRINT_SPEED, createWorldFromClues, nearHidingPlace, step, toggleHiding,
  type GameEvent, type Intensity, type Input, type World,
} from "../src/features/game/world";

const atmosphere = () => [0, 1, 2].map((n) => ({ id: `a${n}`, kind: "ATMOSPHERE" as const, classification: null, label: "tag", detail: null }));
const make = (intensity: Intensity = "normal", seed = 1): World => {
  const w = createWorldFromClues(atmosphere(), intensity, LEVEL, seed);
  w.monster.state = "SEARCHING";
  return w;
};
function run(world: World, seconds: number, input: Input = NO_INPUT): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...step(world, input, 0.05));
  return events;
}
const SAFE = { x: 21.5, y: 14.5 };
/** An offset from a hiding place with a clear line of sight back to it, and the creature facing it from there. */
function open(spot: { x: number; y: number }, far = 3): { x: number; y: number; yaw: number } {
  for (const [dx, dy] of [[far, 0], [-far, 0], [0, far], [0, -far]] as const) {
    const at = { x: spot.x + dx, y: spot.y + dy };
    if (tileAt(LEVEL, at.x, at.y) === "FLOOR" && hasLineOfSight(LEVEL, at, spot, false)) return { ...at, yaw: Math.atan2(-dy, -dx) };
  }
  throw new Error("no open side");
}
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const stateChanges = (events: GameEvent[]) => events.filter((e) => e.type === "MONSTER_STATE").map((e) => (e as { state: string }).state);

describe("the level supports the creature", () => {
  it("has hiding places and patrol points on open floor, all reachable", () => {
    expect(LEVEL.hideSpots.length).toBeGreaterThanOrEqual(6);
    expect(LEVEL.patrol.length).toBeGreaterThanOrEqual(12);
    for (const p of [...LEVEL.hideSpots, ...LEVEL.patrol]) {
      expect(tileAt(LEVEL, p.x, p.y)).toBe("FLOOR");
      expect(findPath(LEVEL, LEVEL.monsterStart, p, true)).not.toBeNull();
    }
    for (const h of LEVEL.hideSpots) expect(findPath(LEVEL, LEVEL.playerStart, h, false)).not.toBeNull();
  });
  it("hiding places are not on clue spots, the start, or the exit", () => {
    for (const h of LEVEL.hideSpots) {
      for (const other of [...LEVEL.clueSpots, LEVEL.playerStart, LEVEL.monsterStart, LEVEL.exit]) expect(dist(h, other)).toBeGreaterThan(0.5);
    }
  });
});

describe("patrol", () => {
  it("walks through many rooms, never through a wall, and keeps moving", () => {
    const w = make();
    w.player.pos = { ...SAFE };
    const tiles = new Set<string>();
    let moved = 0;
    for (let t = 0; t < 120; t += 0.1) {
      step(w, NO_INPUT, 0.1);
      expect(isBlocked(LEVEL, w.monster.pos.x, w.monster.pos.y, w.gateOpen)).toBe(false);
      tiles.add(`${Math.floor(w.monster.pos.x / 4)},${Math.floor(w.monster.pos.y / 4)}`);
      if (w.monster.speedNow > 0) moved += 0.1;
      if (w.status !== "PLAYING") break;
    }
    expect(tiles.size).toBeGreaterThanOrEqual(5);
    expect(moved).toBeGreaterThan(40);
  });

  it("stops at waypoints to look around, so it is not always moving", () => {
    const w = make();
    w.player.pos = { ...SAFE };
    let still = 0;
    let waited = false;
    for (let t = 0; t < 90; t += 0.1) {
      step(w, NO_INPUT, 0.1);
      if (w.monster.wait > 0) waited = true;
      if (w.monster.speedNow === 0) still += 0.1;
    }
    expect(waited).toBe(true);
    expect(still).toBeGreaterThan(3);
  });

  it("differs from one seed to the next and repeats for the same seed", () => {
    const route = (seed: number): string => {
      const w = make("normal", seed);
      w.player.pos = { ...SAFE };
      const seen: string[] = [];
      for (let t = 0; t < 80; t += 0.1) {
        step(w, NO_INPUT, 0.1);
        const key = `${Math.floor(w.monster.pos.x)},${Math.floor(w.monster.pos.y)}`;
        if (seen[seen.length - 1] !== key) seen.push(key);
        if (w.status !== "PLAYING") break;
      }
      return seen.join("|");
    };
    expect(route(1)).toBe(route(1));
    expect(route(2)).not.toBe(route(1));
  });
});

describe("noise", () => {
  it("goes to where a sound was made, not to where the player is now", () => {
    const w = make();
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.clock = 5;
    w.player.pos = { x: 6.5, y: 11.5 };
    w.player.yaw = 0;
    // The player sprints east along the corridor for a moment, then stands still far away.
    const heardEvents = run(w, 0.3, { ...NO_INPUT, forward: 1, sprint: true });
    w.player.pos = { x: 22.5, y: 11.5 };
    const events = [...heardEvents, ...run(w, 6)];
    expect(stateChanges(events)).toContain("INVESTIGATING");
    expect(dist(w.monster.pos, { x: 22.5, y: 11.5 })).toBeGreaterThan(8);
  });

  it("hearing range grows with difficulty: only the hardest creature hears a walk from 3.4 tiles", () => {
    const heard = (intensity: Intensity): boolean => {
      const w = make(intensity);
      w.monster.pos = { x: 5.5, y: 5.5 };
      w.monster.yaw = Math.PI;
      w.monster.clock = 5;
      w.player.pos = { x: 5.5 + 3.4, y: 5.5 };
      w.player.yaw = 0;
      step(w, { ...NO_INPUT, forward: 1 }, 0.05);
      return w.monster.state === "INVESTIGATING";
    };
    expect(HEARING.walk * PROFILE.low.hearing).toBeLessThan(3.4);
    expect(heard("low")).toBe(false);
    expect(heard("high")).toBe(true);
  });

  it("picking up a clue makes a sound it can hear, and a silent player is not heard", () => {
    const w = make();
    w.monster.pos = { x: 6.5, y: 5.5 };
    w.monster.clock = 5;
    w.clues[0]!.position = { x: 6.5, y: 2.5 };
    w.player.pos = { x: 6.5, y: 2.5 };
    step(w, NO_INPUT, 0.05);
    expect(w.monster.state).toBe("INVESTIGATING");
    const quiet = make();
    quiet.monster.pos = { x: 3.5, y: 5.5 };
    quiet.monster.yaw = Math.PI;
    quiet.monster.clock = 5;
    quiet.player.pos = { x: 6.5, y: 5.5 };
    step(quiet, NO_INPUT, 0.05);
    expect(quiet.monster.state).toBe("SEARCHING");
  });
});

describe("looking around", () => {
  it("after reaching the place of a noise it stands and looks around before moving on", () => {
    const w = make();
    w.player.pos = { ...SAFE };
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.clock = 5;
    w.monster.state = "INVESTIGATING";
    w.monster.goal = "NOISE";
    w.monster.target = { x: 4.5, y: 5.5 };
    w.monster.path = [{ x: 4, y: 5 }];
    let waited = false;
    for (let t = 0; t < 4; t += 0.05) {
      step(w, NO_INPUT, 0.05);
      if (w.monster.wait > 0.5) waited = true;
    }
    expect(waited).toBe(true);
    expect(w.monster.state).toBe("SEARCHING");
  });
});

describe("searching after losing the player", () => {
  it("recovers, then searches the waypoints nearest to where the player was last seen", () => {
    const w = make();
    w.monster.state = "PURSUING";
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 9.5, y: 5.5 };
    run(w, 0.4);
    expect(w.monster.lastSeen).not.toBeNull();
    const lastSeen = { ...w.monster.lastSeen! };
    w.player.pos = { x: 22.5, y: 14.5 };
    const events = run(w, 25);
    const states = stateChanges(events);
    expect(states).toContain("RECOVERING");
    expect(states).toContain("SEARCHING");
    expect(w.monster.focus && dist(w.monster.focus, lastSeen)).toBeLessThan(0.01);
  });
});

describe("hiding", () => {
  const spot = LEVEL.hideSpots[0]!;
  const hideNear = (w: World): void => {
    w.player.pos = { x: spot.x + 0.3, y: spot.y };
    expect(nearHidingPlace(w)).toBe(true);
    expect(toggleHiding(w)).toEqual([{ type: "HIDING", hidden: true }]);
  };

  it("only works next to a hiding place, and can be left", () => {
    const w = make();
    w.player.pos = { x: 12.5, y: 5.5 };
    expect(nearHidingPlace(w)).toBe(false);
    expect(toggleHiding(w)).toEqual([]);
    hideNear(w);
    expect(w.player.hidden).toBe(true);
    expect(toggleHiding(w)).toEqual([{ type: "HIDING", hidden: false }]);
    expect(w.player.hidden).toBe(false);
  });

  it("moving leaves the hiding place, turning does not, and a hidden player makes no sound", () => {
    const w = make();
    hideNear(w);
    run(w, 0.3, { ...NO_INPUT, turn: 1 });
    expect(w.player.hidden).toBe(true);
    expect(w.player.moving).toBe(false);
    const events = run(w, 0.2, { ...NO_INPUT, forward: 1 });
    expect(w.player.hidden).toBe(false);
    expect(events.some((e) => e.type === "HIDING" && !e.hidden)).toBe(true);
  });

  it("a creature that did not see the player go in does not find them by sight", () => {
    const w = make();
    w.monster.pos = { x: spot.x + 2.5, y: spot.y };
    w.monster.yaw = Math.PI;
    w.monster.state = "SEARCHING";
    w.monster.clock = 5;
    w.player.pos = { x: spot.x + 0.3, y: spot.y };
    // It is looking away when the player slips in.
    w.monster.yaw = 0;
    toggleHiding(w);
    expect(w.player.hiddenKnown).toBe(false);
    w.monster.yaw = Math.PI;
    run(w, 3);
    expect(w.status).toBe("PLAYING");
  });

  it("a creature that saw the player go in comes straight to the place and catches them", () => {
    const w = make();
    const side = open(spot);
    w.monster.pos = { x: side.x, y: side.y };
    w.monster.yaw = side.yaw;
    w.monster.clock = 5;
    w.player.pos = { x: spot.x + 0.3, y: spot.y };
    toggleHiding(w);
    expect(w.player.hiddenKnown).toBe(true);
    run(w, 8);
    expect(w.status).toBe("CAUGHT");
  });

  it("a creature that dwells beside a hiding place eventually opens it, sooner on harder settings", () => {
    const timeToFind = (intensity: Intensity): number => {
      const w = make(intensity);
      w.player.pos = { x: spot.x + 0.3, y: spot.y };
      w.monster.pos = { x: spot.x + 4, y: spot.y };
      w.monster.yaw = 0;
      toggleHiding(w);
      expect(w.player.hiddenKnown).toBe(false);
      // It is standing 1.5 tiles away, looking around, on its way to check the hiding places.
      const beside = open(spot, 1.5);
      w.monster.pos = { x: beside.x, y: beside.y };
      w.monster.goal = "HIDING_PLACE";
      w.monster.wait = 100;
      w.monster.clock = 5;
      for (let t = 0; t < 20; t += 0.05) {
        step(w, NO_INPUT, 0.05);
        if (w.status === "CAUGHT") return w.time;
      }
      return Infinity;
    };
    const low = timeToFind("low");
    const high = timeToFind("high");
    expect(high).toBeLessThan(low);
    expect(high).toBeLessThanOrEqual(PROFILE.high.hideDwell + 2);
    expect(low).toBeGreaterThan(PROFILE.normal.hideDwell);
  });

  it("a creature with the player one tile away does not lose them by their slipping into a locker", () => {
    const w = make();
    const near = open(spot, 1.2);
    w.monster.pos = { x: near.x, y: near.y };
    w.monster.yaw = near.yaw + Math.PI; // looking away
    w.monster.clock = 5;
    w.player.pos = { x: spot.x + 0.3, y: spot.y };
    toggleHiding(w);
    expect(w.player.hiddenKnown).toBe(true);
  });

  it("the creature checks every hiding place in turn, not only the nearest one", () => {
    const w = make();
    w.player.pos = { ...SAFE };
    const targets = new Set<string>();
    for (let t = 0; t < 600; t += 0.1) {
      step(w, NO_INPUT, 0.1);
      if (w.monster.goal === "HIDING_PLACE" && w.monster.target) targets.add(`${w.monster.target.x},${w.monster.target.y}`);
    }
    expect(targets.size).toBeGreaterThanOrEqual(5);
  });

  it("hiding while far from the creature is safe for a good while", () => {
    const w = make();
    w.monster.pos = { x: 20.5, y: 14.5 };
    w.monster.clock = 5;
    hideNear(w);
    run(w, 6);
    expect(w.status).toBe("PLAYING");
  });
});

describe("pursuit is hard but fair", () => {
  it("lunges at most once per cooldown, with a warning event, and only when close", () => {
    const w = make();
    w.monster.state = "PURSUING";
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.monster.lungeCooldown = 0;
    w.player.pos = { x: 5.5, y: 5.5 };
    w.player.yaw = 0;
    const events = run(w, 3, { ...NO_INPUT, forward: 1, sprint: true });
    expect(events.filter((e) => e.type === "LUNGE").length).toBeLessThanOrEqual(1);
    const far = make();
    far.monster.state = "PURSUING";
    far.monster.pos = { x: 3.5, y: 5.5 };
    far.monster.yaw = 0;
    far.monster.lungeCooldown = 0;
    far.player.pos = { x: 10.5, y: 5.5 };
    expect(run(far, 0.5).some((e) => e.type === "LUNGE")).toBe(false);
  });

  it.each(["low", "normal", "high"] as const)("a player who sprints away along a corridor escapes on %s", (intensity) => {
    const w = make(intensity);
    w.monster.state = "PURSUING";
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 8.5, y: 5.5 };
    w.player.yaw = 0;
    run(w, 5, { ...NO_INPUT, forward: 1, sprint: true });
    expect(w.status).toBe("PLAYING");
    expect(dist(w.monster.pos, w.player.pos)).toBeGreaterThan(CATCH_DISTANCE * 2);
    expect(PROFILE[intensity].speed * 2.9).toBeLessThan(SPRINT_SPEED);
  });

  it("a player who walks away is caught eventually, so running matters", () => {
    const w = make();
    w.monster.state = "PURSUING";
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 8.5, y: 5.5 };
    w.player.yaw = 0;
    run(w, 12, { ...NO_INPUT, forward: 1 });
    expect(w.status).toBe("CAUGHT");
  });

  it("the gate opening draws a creature that is near it", () => {
    const w = make();
    w.monster.pos = { x: 15.5, y: 14.5 };
    w.monster.clock = 5;
    w.clues.forEach((c) => (c.collected = true));
    w.collected = w.clues.length - 1;
    w.clues[0]!.collected = false;
    w.player.pos = { ...w.clues[0]!.position };
    const events = run(w, 0.2);
    expect(events.some((e) => e.type === "GATE_OPENED")).toBe(true);
    expect(stateChanges(events)).toContain("INVESTIGATING");
  });
});

describe("difficulty", () => {
  it("wakes sooner, moves faster and sees farther on harder settings", () => {
    expect(PROFILE.high.wakeDelay).toBeLessThan(PROFILE.normal.wakeDelay);
    expect(PROFILE.normal.wakeDelay).toBeLessThan(PROFILE.low.wakeDelay);
    expect(PROFILE.low.speed).toBeLessThan(PROFILE.normal.speed);
    expect(PROFILE.normal.speed).toBeLessThan(PROFILE.high.speed);
    expect(PROFILE.low.sight).toBeLessThan(PROFILE.high.sight);
    expect(PROFILE.low.searchWaypoints).toBeLessThan(PROFILE.high.searchWaypoints);
    expect(PROFILE.low.hideDwell).toBeGreaterThan(PROFILE.high.hideDwell);
  });
  it("the creature wakes after the delay of its own setting", () => {
    for (const intensity of ["low", "normal", "high"] as const) {
      const w = createWorldFromClues(atmosphere(), intensity);
      w.player.pos = { ...w.clues[0]!.position };
      step(w, NO_INPUT, 0.05);
      expect(w.monster.state).toBe("DORMANT");
      run(w, PROFILE[intensity].wakeDelay - 0.5);
      expect(w.monster.state).toBe("DORMANT");
      run(w, 1.5);
      expect(w.monster.state).not.toBe("DORMANT");
    }
  });
});
