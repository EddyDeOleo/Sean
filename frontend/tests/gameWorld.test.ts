import { describe, expect, it } from "vitest";
import { buildClues, MAX_CLUES, MIN_CLUES } from "../src/features/game/clues";
import { LEVEL, LEVEL_MAP, findPath, hasLineOfSight, isBlocked, parseLevel, tileAt } from "../src/features/game/level";
import {
  CATCH_DISTANCE, NO_INPUT, WAKE_DELAY, SPRINT_SPEED, WALK_SPEED, createWorld, createWorldFromClues, moveCircle, monsterSeesPlayer,
  step, tension, toggleFlashlight, type GameEvent, type World,
} from "../src/features/game/world";
import { buildSnapshot, type ReportSnapshot } from "../src/features/report/reportSnapshot";
import { clone, complete, insufficient, profileRich } from "./fixtures";

const input = { text: "q", repository_id: "sample", mode: "INVESTIGATE" as const, interpreter: "deterministic" as const, question: "q", target_path: "a.py", symbol: null };
const snap = (over: Partial<Parameters<typeof buildSnapshot>[0]> = {}): ReportSnapshot =>
  buildSnapshot({ id: "s", createdAt: "2026-11-12T10:00:00.000Z", input, investigation: clone(complete().body), investigationNote: null, analysis: clone(profileRich().body), analysisNote: null, ...over });

const atmosphere = () => [0, 1, 2].map((n) => ({ id: `a${n}`, kind: "ATMOSPHERE" as const, classification: null, label: "tag", detail: null }));
const fresh = (): World => createWorldFromClues(atmosphere(), "normal");
function run(world: World, seconds: number, input = NO_INPUT): GameEvent[] {
  const events: GameEvent[] = [];
  for (let t = 0; t < seconds; t += 0.05) events.push(...step(world, input, 0.05));
  return events;
}

describe("the level", () => {
  it("is rectangular, closed by walls and has what the game needs", () => {
    expect(LEVEL.width).toBe(25);
    expect(LEVEL.height).toBe(17);
    for (let x = 0; x < LEVEL.width; x += 1) {
      expect(tileAt(LEVEL, x + 0.5, 0.5)).toBe("WALL");
      expect(tileAt(LEVEL, x + 0.5, LEVEL.height - 0.5)).toBe("WALL");
    }
    for (let y = 0; y < LEVEL.height; y += 1) {
      expect(tileAt(LEVEL, 0.5, y + 0.5)).toBe("WALL");
      expect(tileAt(LEVEL, LEVEL.width - 0.5, y + 0.5)).toBe("WALL");
    }
    expect(LEVEL.clueSpots.length).toBeGreaterThanOrEqual(MAX_CLUES);
  });

  it("every clue spot, the monster and the exit are reachable from the start once the gate is open", () => {
    for (const target of [...LEVEL.clueSpots, LEVEL.monsterStart, LEVEL.exit]) expect(findPath(LEVEL, LEVEL.playerStart, target, true)).not.toBeNull();
  });

  it("the exit is not reachable while the gate is closed, and every clue spot is", () => {
    expect(findPath(LEVEL, LEVEL.playerStart, LEVEL.exit, false)).toBeNull();
    for (const spot of LEVEL.clueSpots) expect(findPath(LEVEL, LEVEL.playerStart, spot, false)).not.toBeNull();
  });

  it("rejects malformed maps", () => {
    expect(() => parseLevel(["###", "#P#"])).toThrow();
    expect(() => parseLevel(["####", "#P.#", "###"])).toThrow(/width/);
    expect(() => parseLevel(["####", "#P?#", "####"])).toThrow(/unknown/);
    expect(() => parseLevel(["####", "#P.#", "####"])).toThrow(/needs/);
    expect(LEVEL_MAP.every((r) => r.length === LEVEL.width)).toBe(true);
  });

  it("walls and the closed gate block sight and paths", () => {
    expect(isBlocked(LEVEL, LEVEL.gate.x, LEVEL.gate.y, false)).toBe(true);
    expect(isBlocked(LEVEL, LEVEL.gate.x, LEVEL.gate.y, true)).toBe(false);
    expect(hasLineOfSight(LEVEL, { x: 1.5, y: 1.5 }, { x: 8.5, y: 1.5 }, false)).toBe(false);
    expect(hasLineOfSight(LEVEL, { x: 1.5, y: 5.5 }, { x: 8.5, y: 5.5 }, false)).toBe(true);
  });
});

describe("clues", () => {
  it("come from the report's real evidence with its classification", () => {
    const clues = buildClues(snap());
    expect(clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
    expect(clues.length).toBeLessThanOrEqual(MAX_CLUES);
    const evidence = clues.filter((c) => c.kind === "EVIDENCE");
    expect(evidence.length).toBeGreaterThan(0);
    for (const c of evidence) expect(["DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE"]).toContain(c.classification);
  });

  it("insufficient evidence yields atmosphere only, never evidence", () => {
    const clues = buildClues(snap({ investigation: clone(insufficient().body), analysis: null }));
    expect(clues).toHaveLength(MIN_CLUES);
    for (const c of clues) {
      expect(c.kind).toBe("ATMOSPHERE");
      expect(c.classification).toBeNull();
      expect(c.label).toMatch(/not evidence/);
    }
  });
});

describe("the player", () => {
  it("walks and sprints at their speeds and slides along walls", () => {
    const w = fresh();
    w.player.yaw = 0;
    const x0 = w.player.pos.x;
    step(w, { ...NO_INPUT, forward: 1 }, 0.1);
    expect(w.player.pos.x - x0).toBeCloseTo(WALK_SPEED * 0.1, 5);
    step(w, { ...NO_INPUT, forward: 1, sprint: true }, 0.1);
    expect(w.player.sprinting).toBe(true);
    expect(SPRINT_SPEED).toBeGreaterThan(WALK_SPEED);
  });

  it("cannot walk through walls or leave the map", () => {
    const w = fresh();
    w.player.yaw = Math.PI;
    run(w, 3, { ...NO_INPUT, forward: 1 });
    expect(w.player.pos.x).toBeGreaterThan(1);
    w.player.yaw = -Math.PI / 2;
    run(w, 3, { ...NO_INPUT, forward: 1 });
    expect(w.player.pos.y).toBeGreaterThan(1);
    expect(moveCircle(LEVEL, { x: 1.5, y: 1.5 }, -5, 0, 0.28, false).x).toBeGreaterThan(1);
  });

  it("diagonal movement is not faster", () => {
    const a = fresh();
    const b = fresh();
    a.player.pos = { x: 6, y: 5.5 };
    b.player.pos = { x: 6, y: 5.5 };
    step(a, { ...NO_INPUT, forward: 1 }, 0.1);
    step(b, { ...NO_INPUT, forward: 1, strafe: 1 }, 0.1);
    const da = Math.hypot(a.player.pos.x - 6, a.player.pos.y - 5.5);
    const db = Math.hypot(b.player.pos.x - 6, b.player.pos.y - 5.5);
    expect(db).toBeCloseTo(da, 5);
  });

  it("ignores a huge time step and does nothing after the game has ended", () => {
    const w = fresh();
    step(w, { ...NO_INPUT, forward: 1 }, 100);
    expect(w.time).toBeLessThanOrEqual(0.1);
    w.status = "CAUGHT";
    const before = JSON.stringify(w);
    expect(step(w, { ...NO_INPUT, forward: 1 }, 0.1)).toEqual([]);
    expect(JSON.stringify(w)).toBe(before);
  });

  it("toggles the flashlight", () => {
    const w = fresh();
    expect(toggleFlashlight(w)).toEqual({ type: "FLASHLIGHT", on: false });
    expect(toggleFlashlight(w)).toEqual({ type: "FLASHLIGHT", on: true });
  });
});

describe("objectives", () => {
  it("collects a clue by walking to it, wakes the monster, and opens the gate after the last clue", () => {
    const w = createWorld(snap(), "normal");
    expect(w.monster.state).toBe("DORMANT");
    run(w, 5);
    expect(w.monster.state).toBe("DORMANT");
    const events: GameEvent[] = [];
    for (const clue of w.clues) {
      w.player.pos = { ...clue.position };
      events.push(...step(w, NO_INPUT, 0.016));
    }
    const collected = events.filter((e) => e.type === "CLUE_COLLECTED");
    expect(collected).toHaveLength(w.clues.length);
    expect(w.collected).toBe(w.clues.length);
    expect(w.gateOpen).toBe(true);
    expect(events.filter((e) => e.type === "GATE_OPENED")).toHaveLength(1);
    expect(w.monster.state).toBe("DORMANT");
    expect(w.wakeAt).not.toBeNull();
    // It wakes a few seconds after the first clue, not at once.
    w.player.pos = { ...LEVEL.playerStart };
    const later = run(w, WAKE_DELAY + 1);
    expect(later.some((e) => e.type === "MONSTER_STATE" && e.previous === "DORMANT" && e.state === "SEARCHING")).toBe(true);
  });

  it("collects each clue once", () => {
    const w = fresh();
    w.player.pos = { ...w.clues[0]!.position };
    step(w, NO_INPUT, 0.016);
    const again = step(w, NO_INPUT, 0.016);
    expect(again.filter((e) => e.type === "CLUE_COLLECTED")).toHaveLength(0);
    expect(w.collected).toBe(1);
  });

  it("the exit does nothing until the gate is open, and escaping ends the game", () => {
    const w = fresh();
    w.player.pos = { ...LEVEL.exit };
    expect(step(w, NO_INPUT, 0.016)).toEqual([]);
    expect(w.status).toBe("PLAYING");
    w.gateOpen = true;
    expect(step(w, NO_INPUT, 0.016)).toEqual([{ type: "ESCAPED" }]);
    expect(w.status).toBe("ESCAPED");
  });
});

describe("the monster", () => {
  const awake = (): World => {
    const w = fresh();
    w.monster.state = "SEARCHING";
    return w;
  };

  it("is dormant and harmless until the first clue", () => {
    const w = fresh();
    w.player.pos = { x: w.monster.pos.x + 0.3, y: w.monster.pos.y };
    run(w, 5);
    expect(w.status).toBe("PLAYING");
    expect(w.monster.state).toBe("DORMANT");
  });

  it("sees a player in its view with a clear line, and not through walls or behind it", () => {
    const w = awake();
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 8.5, y: 5.5 };
    expect(monsterSeesPlayer(w)).toBe(true);
    w.monster.yaw = Math.PI;
    expect(monsterSeesPlayer(w)).toBe(false);
    w.monster.yaw = 0;
    w.player.pos = { x: 8.5, y: 2.5 };
    expect(monsterSeesPlayer(w)).toBe(false);
  });

  it("an unlit player is seen from a shorter distance", () => {
    const w = awake();
    w.monster.pos = { x: 1.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 7.5, y: 5.5 };
    expect(monsterSeesPlayer(w)).toBe(true);
    w.player.flashlight = false;
    expect(monsterSeesPlayer(w)).toBe(false);
  });

  it("hears a sprinting player, investigates, and a still player is not heard", () => {
    const w = awake();
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = Math.PI;
    w.monster.clock = 2;
    w.player.pos = { x: 6.5, y: 11.5 };
    w.player.yaw = 0;
    const events = run(w, 0.2, { ...NO_INPUT, forward: 1, sprint: true });
    expect(events.some((e) => e.type === "MONSTER_STATE" && e.state === "INVESTIGATING")).toBe(true);
    const quiet = awake();
    quiet.monster.pos = { x: 3.5, y: 5.5 };
    quiet.monster.clock = 2;
    quiet.player.pos = { x: 5.5, y: 5.5 };
    quiet.monster.yaw = Math.PI;
    expect(run(quiet, 0.5).some((e) => e.type === "MONSTER_STATE" && e.state === "INVESTIGATING")).toBe(false);
  });

  it("pursues, attacks and catches a player who stands in front of it", () => {
    const w = awake();
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 6.5, y: 5.5 };
    const events = run(w, 6);
    const states = events.filter((e) => e.type === "MONSTER_STATE").map((e) => (e as { state: string }).state);
    expect(states).toContain("PURSUING");
    expect(states).toContain("ATTACKING");
    expect(events.some((e) => e.type === "CAUGHT")).toBe(true);
    expect(w.status).toBe("CAUGHT");
  });

  it("a sprinting player outruns a pursuing monster", () => {
    const w = awake();
    w.monster.pos = { x: 1.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 5.5, y: 5.5 };
    w.player.yaw = 0;
    run(w, 4, { ...NO_INPUT, forward: 1, sprint: true });
    expect(w.status).toBe("PLAYING");
    expect(Math.hypot(w.player.pos.x - w.monster.pos.x, w.player.pos.y - w.monster.pos.y)).toBeGreaterThan(CATCH_DISTANCE * 2);
  });

  it("loses the trail, recovers and goes back to searching", () => {
    const w = awake();
    w.monster.state = "PURSUING";
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.player.pos = { x: 20.5, y: 1.5 };
    const events = run(w, 12);
    const states = events.filter((e) => e.type === "MONSTER_STATE").map((e) => (e as { state: string }).state);
    expect(states).toContain("RECOVERING");
    expect(states).toContain("SEARCHING");
  });

  it("a long chase that briefly loses sight does not end at once", () => {
    const w = awake();
    w.monster.pos = { x: 3.5, y: 5.5 };
    w.monster.yaw = 0;
    w.player.pos = { x: 9.5, y: 5.5 };
    run(w, 0.5);
    expect(w.monster.state).toBe("PURSUING");
    w.monster.clock = 100; // the chase has lasted a long time
    w.player.pos = { x: 8.5, y: 2.5 }; // out of sight, behind a wall
    run(w, 0.3);
    expect(w.monster.state).toBe("PURSUING");
    expect(w.monster.unseen).toBeGreaterThan(0);
  });

  it("never walks through walls", () => {
    const w = awake();
    w.player.pos = { x: 22.5, y: 14.5 };
    for (let i = 0; i < 400; i += 1) {
      step(w, NO_INPUT, 0.05);
      expect(isBlocked(LEVEL, w.monster.pos.x, w.monster.pos.y, w.gateOpen)).toBe(false);
    }
  });

  it("is deterministic", () => {
    const a = awake();
    const b = awake();
    const ea = run(a, 20, { ...NO_INPUT, forward: 1 });
    const eb = run(b, 20, { ...NO_INPUT, forward: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(ea).toEqual(eb);
  });

  it("tension rises as the monster nears and is zero while it sleeps", () => {
    const w = fresh();
    expect(tension(w)).toBe(0);
    w.monster.state = "SEARCHING";
    w.monster.pos = { x: 1.5, y: 5.5 };
    w.player.pos = { x: 11.5, y: 5.5 };
    const far = tension(w);
    w.player.pos = { x: 3.5, y: 5.5 };
    expect(tension(w)).toBeGreaterThan(far);
    expect(tension(w)).toBeLessThanOrEqual(1);
  });

  it("harder settings make the monster faster", () => {
    const speed = (intensity: "low" | "high"): number => {
      const w = createWorldFromClues(atmosphere(), intensity);
      w.monster.state = "PURSUING";
      w.monster.pos = { x: 3.5, y: 5.5 };
      w.player.pos = { x: 9.5, y: 5.5 };
      w.monster.yaw = 0;
      const x0 = w.monster.pos.x;
      step(w, NO_INPUT, 0.1);
      return w.monster.pos.x - x0;
    };
    expect(speed("high")).toBeGreaterThan(speed("low"));
  });
});
