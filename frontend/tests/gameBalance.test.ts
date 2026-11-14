/**
 * Balance by playing. A scripted player (it walks to the clues by the shortest path, stands still when the creature is near and
 * has not seen it, runs and hides when it is hunted, and leaves by the exit) plays many games on every difficulty against the
 * real rules. The game must be winnable and not trivial, harder settings must be harder, and a player who sprints without a
 * thought must lose far more often. The numbers are written to the file named by SEAN_BALANCE_REPORT when it is set.
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVEL, hasLineOfSight, isBlocked, type Point } from "../src/features/game/level";
import {
  NO_INPUT, createWorldFromClues, nearHidingPlace, step, toggleHiding, type Input, type Intensity, type World,
} from "../src/features/game/world";

const clues = () => [0, 1, 2, 3, 4].map((n) => ({ id: `a${n}`, kind: "ATMOSPHERE" as const, classification: null, label: "tag", detail: null }));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

type Outcome = "ESCAPED" | "CAUGHT" | "TIMEOUT";
interface Result { outcome: Outcome; seconds: number; hid: number; chases: number }
type Policy = "careful" | "reckless" | "idle";

/** One breadth-first search from the player: steps to every tile, and the first tile to step onto to get there. */
interface Map2 { steps: Map<number, number>; first: Map<number, Point> }
function search(world: World): Map2 {
  const { level } = world;
  const key = (x: number, y: number) => y * level.width + x;
  const start = { x: Math.floor(world.player.pos.x), y: Math.floor(world.player.pos.y) };
  const steps = new Map<number, number>([[key(start.x, start.y), 0]]);
  const first = new Map<number, Point>();
  const queue = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const here = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = here.x + dx;
      const y = here.y + dy;
      if (isBlocked(level, x + 0.5, y + 0.5, world.gateOpen) || steps.has(key(x, y))) continue;
      steps.set(key(x, y), steps.get(key(here.x, here.y))! + 1);
      first.set(key(x, y), steps.get(key(here.x, here.y))! === 0 ? { x: x + 0.5, y: y + 0.5 } : first.get(key(here.x, here.y))!);
      queue.push({ x, y });
    }
  }
  return { steps, first };
}

/** A small generator, so each game has its own player habits and the results do not hang on one fixed route. */
function habit(seed: number): () => number {
  let s = (Math.imul(seed, 0x9e3779b1) >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Where to walk next: an uncollected clue (usually the nearest, sometimes the next nearest, and it sticks to its choice), then the exit. */
function walkTarget(world: World, map: Map2, choice: { goal: Point | null }, rng: () => number): Point {
  const key = (p: Point) => Math.floor(p.y) * world.level.width + Math.floor(p.x);
  const wanted = world.clues.filter((c) => !c.collected).map((c) => c.position);
  // A clue that was picked up is no longer a goal. Once every clue is in hand the goal is the exit.
  if (choice.goal && choice.goal !== world.level.exit && !wanted.includes(choice.goal)) choice.goal = null;
  if (!choice.goal) {
    const goals = (wanted.length > 0 ? wanted : [world.level.exit]).sort((a, b) => (map.steps.get(key(a)) ?? 999) - (map.steps.get(key(b)) ?? 999));
    choice.goal = goals.length > 1 && rng() < 0.4 ? goals[1]! : goals[0]!;
  }
  return map.first.get(key(choice.goal)) ?? choice.goal;
}

/** The step to take to run toward the tile, within a few steps, that is farthest from the creature. Never toward it. */
function refugeStep(world: World, map: Map2): Point | null {
  const m = world.monster.pos;
  let best: Point | null = null;
  let bestScore = -Infinity;
  for (const [id, steps] of map.steps) {
    if (steps < 1 || steps > 16) continue;
    const spot = { x: (id % world.level.width) + 0.5, y: Math.floor(id / world.level.width) + 0.5 };
    const first = map.first.get(id)!;
    if (dist(first, m) < dist(world.player.pos, m) - 0.01) continue;
    const score = dist(spot, m) - steps * 0.25;
    if (score > bestScore) {
      bestScore = score;
      best = first;
    }
  }
  return best;
}

/** Face a point and walk toward it, like a player with a mouse. */
function steer(world: World, target: Point, sprint: boolean): Input {
  world.player.yaw = Math.atan2(target.y - world.player.pos.y, target.x - world.player.pos.x);
  return { forward: 1, strafe: 0, turn: 0, sprint };
}

function play(intensity: Intensity, seed: number, policy: Policy, limit = 300): Result {
  const world = createWorldFromClues(clues(), intensity, LEVEL, seed);
  let frozenFor = 0;
  let hid = 0;
  let chases = 0;
  let hiddenFor = 0;
  let wasHunted = false;
  let map = search(world);
  let mapAt = 0;
  const rng = habit(seed);
  const choice: { goal: Point | null } = { goal: null };
  // How long this player waits before it sets off, standing still or deciding, as people differ.
  const patience = 0.5 + rng() * 2.5;
  for (let t = 0; t < limit; t += 0.05) {
    const m = world.monster;
    // The plan is refreshed a few times a second, which is as often as a person decides anything.
    if (t - mapAt >= 0.2) {
      map = search(world);
      mapAt = t;
    }
    const hunted = m.state === "PURSUING" || m.state === "ATTACKING";
    if (hunted && !wasHunted) chases += 1;
    wasHunted = hunted;
    const near = dist(m.pos, world.player.pos);
    let input: Input = NO_INPUT;

    if (policy === "idle") {
      input = NO_INPUT;
    } else if (policy === "reckless") {
      input = steer(world, walkTarget(world, map, choice, rng), true);
    } else if (world.player.hidden) {
      hiddenFor += 0.05;
      // Come out once it has gone away for a while, and it does not know where we are.
      if (!world.player.hiddenKnown && near > 9 && hiddenFor > 4) toggleHiding(world);
    } else if (hunted) {
      // Run. If a locker is right here and it has lost sight of us, get in.
      if (nearHidingPlace(world) && m.unseen > 1.5 && near > 3) {
        toggleHiding(world);
        hid += 1;
        hiddenFor = 0;
      } else {
        const away = refugeStep(world, map);
        if (away) input = steer(world, away, true);
      }
    } else if (m.state !== "DORMANT" && near < 10 && frozenFor < 7) {
      // It is about and has not seen us. Slip into a locker if there is one here. If it could see us, step out of its line of
      // sight; if it could not, stand still, which makes no noise.
      frozenFor += 0.05;
      if (nearHidingPlace(world) && near < 8) {
        toggleHiding(world);
        hid += 1;
        hiddenFor = 0;
      } else if (hasLineOfSight(world.level, m.pos, world.player.pos, world.gateOpen)) {
        const away = refugeStep(world, map);
        if (away) input = steer(world, away, false);
      }
    } else {
      if (near >= 10) frozenFor = 0;
      input = t < patience ? NO_INPUT : steer(world, walkTarget(world, map, choice, rng), false);
    }
    step(world, input, 0.05);
    if (world.status === "ESCAPED") return { outcome: "ESCAPED", seconds: world.time, hid, chases };
    if (world.status === "CAUGHT") return { outcome: "CAUGHT", seconds: world.time, hid, chases };
  }
  return { outcome: "TIMEOUT", seconds: limit, hid, chases };
}

const SEEDS = Array.from({ length: 80 }, (_, i) => i + 1);
function summary(intensity: Intensity, policy: Policy, limit = 300) {
  const results = SEEDS.map((seed) => play(intensity, seed, policy, limit));
  const count = (o: Outcome) => results.filter((r) => r.outcome === o).length;
  return {
    intensity, policy, games: results.length, escaped: count("ESCAPED"), caught: count("CAUGHT"), timeout: count("TIMEOUT"),
    winRate: count("ESCAPED") / results.length,
    meanSeconds: results.reduce((s, r) => s + r.seconds, 0) / results.length,
    meanChases: results.reduce((s, r) => s + r.chases, 0) / results.length,
    meanHides: results.reduce((s, r) => s + r.hid, 0) / results.length,
  };
}

describe("balance, by playing", () => {
  const careful = { low: summary("low", "careful"), normal: summary("normal", "careful"), high: summary("high", "careful") };
  const reckless = { low: summary("low", "reckless"), normal: summary("normal", "reckless"), high: summary("high", "reckless") };

  it("writes what the numbers are", () => {
    const rows = [...Object.values(careful), ...Object.values(reckless)];
    if (process.env.SEAN_BALANCE_REPORT) writeFileSync(process.env.SEAN_BALANCE_REPORT, JSON.stringify(rows, null, 2));
    expect(rows).toHaveLength(6);
  });

  it("a careful player can win on every difficulty, and it is not a sure thing on the hardest", () => {
    // Measured with 80 games each (see the table the first test writes): about 71%, 59% and 54%. The bands leave room for noise.
    expect(careful.low.winRate).toBeGreaterThanOrEqual(0.6);
    expect(careful.normal.winRate).toBeGreaterThanOrEqual(0.45);
    expect(careful.high.winRate).toBeGreaterThanOrEqual(0.35);
    for (const intensity of ["low", "normal", "high"] as const) expect(careful[intensity].winRate).toBeLessThan(0.92);
  });

  it("harder settings are harder", () => {
    expect(careful.low.winRate + 0.05).toBeGreaterThanOrEqual(careful.normal.winRate);
    expect(careful.normal.winRate + 0.05).toBeGreaterThanOrEqual(careful.high.winRate);
    expect(careful.high.meanChases).toBeGreaterThan(careful.low.meanChases);
    // A player who sprints without a thought is punished more on each step up.
    expect(reckless.low.winRate).toBeGreaterThan(reckless.normal.winRate);
    expect(reckless.normal.winRate).toBeGreaterThan(reckless.high.winRate);
  });

  it("the creature is a real threat: a reckless sprinter is caught far more often than a careful player", () => {
    for (const intensity of ["low", "normal", "high"] as const) {
      expect(reckless[intensity].caught).toBeGreaterThan(careful[intensity].caught);
    }
    expect(reckless.high.caught / reckless.high.games).toBeGreaterThanOrEqual(0.6);
  });

  it("the careful player is chased now and then, so there is tension to be felt", () => {
    for (const intensity of ["low", "normal", "high"] as const) expect(careful[intensity].meanChases).toBeGreaterThan(0.3);
  });

  it("someone who stands still all game never escapes", () => {
    const idle = summary("normal", "idle", 120);
    expect(idle.escaped).toBe(0);
  });
});
