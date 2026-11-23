/**
 * A deterministic player for the browser tests. It drives the game through the development test clock (testClock.ts): each
 * call advances the world by one fixed step with the input the controller chose from the state it just read. The controller
 * is a pure function of that state, so a seed and a scenario always give the same run.
 *
 * It plays the real game's rules: it collects clues by walking to them, waits for the gate to open after the last clue, walks
 * to the exit, and avoids the creature's tile neighbourhood while the creature hunts. It never changes the monster, the level
 * or the rules. Every attempt, catch and escape is recorded in a trace that is written to test-results-diagnostics.
 */
import type { Page } from "@playwright/test";
import { LEVEL, hasLineOfSight, isBlocked, type Point } from "../src/features/game/level";
import { CLOSE_SENSE, SIGHT_HALF_ANGLE, SIGHT_RANGE } from "../src/features/game/world";

export interface DriverInput {
  forward: number;
  strafe: number;
  turn: number;
  sprint: boolean;
  /** The hiding action (E) for this step: enters or leaves a hiding place. */
  interact?: boolean;
}

/** Mirrors TestFrameState in src/features/game/testClock.ts. */
export interface FrameState {
  time: number;
  status: "PLAYING" | "CAUGHT" | "ESCAPED";
  monster: string;
  monsterAt: [number, number];
  monsterYaw: number;
  flashlight: boolean;
  canHide: boolean;
  cinematicPhase: string | null;
  cinematicElapsed: number | null;
  player: [number, number];
  yaw: number;
  collected: number;
  clues: Array<[number, number, boolean]>;
  gateOpen: boolean;
  hidden: boolean;
  moving: boolean;
  sprinting: boolean;
  noiseAt: [number, number] | null;
  events: string[];
}

export type Outcome = "ESCAPED" | "CAUGHT" | "TIMEOUT";

export interface AttemptTrace {
  attempt: number;
  outcome: Outcome;
  frames: number;
  seconds: number;
  collectedAtEnd: number;
  /** Events in order, with the frame they happened on. */
  events: Array<{ frame: number; text: string }>;
  /** A sample every `sampleEvery` frames, and on every event frame. */
  samples: Array<{ frame: number; time: number; monster: string; monsterAt: [number, number]; player: [number, number]; collected: number; sprinting: boolean; noiseAt: [number, number] | null; mode: RouteMode }>;
  /** How many decisions each routing rule made in this attempt: shows whether visibility changed the route. */
  routeModes: Partial<Record<RouteMode, number>>;
  /** Monster distance to the player at the catch (tiles), when the attempt ended in a catch. */
  catchDistance: number | null;
  /** The closest the creature came to the player on any frame (not only on sampled frames), with the frame it happened on. */
  closest: { frame: number; distance: number; monster: string; mode: string };
}

const NO_INPUT: DriverInput = { forward: 0, strafe: 0, turn: 0, sprint: false };
const TURN_GAIN = 6;
const MAX_TURN = 3;
/** Tiles around a hunting creature that the controller will not route through. */
const HUNT_AVOID_RADIUS = 1.6;
/** While the creature searches, the route keeps this far from it, the same distance as its sight range (world.ts). */
const SAFETY_RADIUS = SIGHT_RANGE;
/** Within this many tiles of the creature, every frame is sampled into the trace. */
const NEAR_SAMPLE_DISTANCE = 2;
/** On for the escape acceptance runs. The cinematic captures switch it off (setSafetyRouting), so the creature catches the player. */
let safetyRouting = true;
/** On for the acceptance runs. The open-space cinematic fixture turns it off, so the player does not hide and is caught on open floor. */
let hidingEnabled = true;
export function setHidingEnabled(on: boolean): void {
  hidingEnabled = on;
}
export function setSafetyRouting(on: boolean): void {
  safetyRouting = on;
}
const FACING_TOLERANCE = 1.2;

/** One fixed step of the game with the given input. The result is the state after the step, plus the events it produced. */
export async function advance(page: Page, input: DriverInput, frames: number, render: boolean, renderSeconds?: number): Promise<FrameState> {
  return page.evaluate(
    ([i, f, r, rs]) => {
      const api = (window as unknown as { __seanTest?: { advance(input: unknown, frames: number, render: boolean, renderSeconds?: number): unknown } }).__seanTest;
      if (!api) throw new Error("the test clock is not available: open the game with ?testClock=1");
      return api.advance(i, f, r, rs ?? undefined) as FrameState;
    },
    [input, frames, render, renderSeconds ?? null] as const,
  );
}

const centre = (tile: { x: number; y: number }): Point => ({ x: tile.x + 0.5, y: tile.y + 0.5 });
const distance = (a: Point | [number, number], b: Point | [number, number]): number => {
  const ax = Array.isArray(a) ? a[0] : a.x;
  const ay = Array.isArray(a) ? a[1] : a.y;
  const bx = Array.isArray(b) ? b[0] : b.x;
  const by = Array.isArray(b) ? b[1] : b.y;
  return Math.hypot(ax - bx, ay - by);
};
const wrap = (angle: number): number => {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** Breadth-first search over tiles. `avoid` marks tiles the route must not use (the creature's neighbourhood). */
export function route(from: Point, to: Point, gateOpen: boolean, avoid: ((tile: Point) => boolean) | null): Point[] | null {
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const width = LEVEL.width;
  const key = (x: number, y: number): number => y * width + x;
  const blocked = (x: number, y: number): boolean => {
    if (isBlocked(LEVEL, x, y, gateOpen)) return true;
    return avoid !== null && avoid(centre({ x, y })) && !(x === goal.x && y === goal.y);
  };
  if (blocked(goal.x, goal.y)) return null;
  const previous = new Map<number, number>([[key(start.x, start.y), -1]]);
  const queue: Array<{ x: number; y: number }> = [start];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head]!;
    if (cell.x === goal.x && cell.y === goal.y) {
      const path: Point[] = [];
      let k = key(cell.x, cell.y);
      while (k !== -1) {
        path.unshift({ x: k % width, y: Math.floor(k / width) });
        k = previous.get(k)!;
      }
      return path.map(centre);
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (x < 0 || y < 0 || x >= width || y >= LEVEL.height || blocked(x, y)) continue;
      const k = key(x, y);
      if (previous.has(k)) continue;
      previous.set(k, key(cell.x, cell.y));
      queue.push({ x, y });
    }
  }
  return null;
}

/** The next place the player is going: the nearest uncollected clue, then the exit once the gate is open. */
export function nextTarget(s: FrameState): Point | null {
  const here: Point = { x: s.player[0], y: s.player[1] };
  const pending = s.clues.filter(([, , collected]) => !collected);
  if (pending.length > 0) {
    let best = pending[0]!;
    for (const clue of pending) if (distance(here, [clue[0], clue[1]]) < distance(here, [best[0], best[1]])) best = clue;
    return { x: best[0], y: best[1] };
  }
  return LEVEL.exit;
}

/** The controller: one input from the state. It turns toward the next waypoint and walks; it sprints when the creature is far
 *  or is hunting (a hunted player must sprint to keep ahead), and it routes around the creature while it hunts. */
/**
 * Whether the creature could see a player standing on `tile`. It mirrors monsterSeesPlayer (world.ts): close enough to sense,
 * or within its view cone with a clear line. The range uses the flashlight rule with the full multiplier, the most generous
 * view, so the route avoids every place the creature could plausibly see.
 */
export function creatureSees(tile: Point, s: FrameState): boolean {
  const creature: Point = { x: s.monsterAt[0], y: s.monsterAt[1] };
  const d = distance(tile, creature);
  if (d <= CLOSE_SENSE) return hasLineOfSight(LEVEL, creature, tile, s.gateOpen);
  if (d > SIGHT_RANGE * (s.flashlight ? 1 : 0.6)) return false;
  const bearing = Math.atan2(tile.y - creature.y, tile.x - creature.x);
  if (Math.abs(wrap(bearing - s.monsterYaw)) > SIGHT_HALF_ANGLE) return false;
  return hasLineOfSight(LEVEL, creature, tile, s.gateOpen);
}

/** Which rule chose the route. Recorded in the trace, so it is visible whether visibility changed the path. */
export type RouteMode = "DIRECT" | "HUNT_AVOIDING" | "SAFETY_AVOIDING" | "RETREATING" | "HOLD_CLEAR" | "SIGHT_AVOIDING" | "NO_TARGET" | "NO_PATH" | "SEEK_HIDING" | "HIDE" | "HIDDEN_WAIT" | "LEAVE_HIDING";

export interface Decision {
  input: DriverInput;
  mode: RouteMode;
}

/** Context the controller keeps between decisions (a counter, nothing else). */
export interface DriverContext {
  /** Consecutive frames, while hidden, in which the creature was calm and far away. */
  quietFrames: number;
  /** The number of collected clues when the player last hid. A player hides once per clue. */
  hidAtCollected: number | null;
}

/** The nearest hiding place the creature cannot see from where it stands. */
function nearestConcealedHideSpot(s: FrameState, here: Point): Point | null {
  const creature: Point = { x: s.monsterAt[0], y: s.monsterAt[1] };
  let best: Point | null = null;
  for (const spot of LEVEL.hideSpots) {
    if (creatureSees(spot, s)) continue;
    // A hiding place inside the safety radius is not used: the creature searches toward a player who hides near it.
    if (safetyRouting && distance(spot, creature) < SAFETY_RADIUS) continue;
    if (best === null || distance(spot, here) < distance(best, here)) best = spot;
  }
  return best;
}

/** A player hides only from a creature that is awake, not hunting, and cannot see the hiding place from where it stands. */
const QUIET_FRAMES_TO_LEAVE = 120;
const LEAVE_DISTANCE = 10;

export function decide(s: FrameState, ctx: DriverContext): Decision {
  const target = nextTarget(s);
  if (!target) return { input: NO_INPUT, mode: "NO_TARGET" };
  const hunted = s.monster === "PURSUING" || s.monster === "ATTACKING";
  const creature: Point = { x: s.monsterAt[0], y: s.monsterAt[1] };
  const here: Point = { x: s.player[0], y: s.player[1] };
  const d = distance(here, creature);

  if (s.hidden) {
    // Wait still. Come out only after the creature has been calm and far for a while (the real E key, to leave).
    const calm = !hunted && d > LEAVE_DISTANCE;
    ctx.quietFrames = calm ? ctx.quietFrames + 1 : 0;
    if (ctx.quietFrames >= QUIET_FRAMES_TO_LEAVE) {
      ctx.quietFrames = 0;
      return { input: { ...NO_INPUT, interact: true }, mode: "LEAVE_HIDING" };
    }
    return { input: NO_INPUT, mode: "HIDDEN_WAIT" };
  }
  // After the first clue the creature will wake soon. Before it does (or while it is awake and has not seen the player), the
  // player hides in a hiding place the creature cannot see, once per clue. Hiding while it hunts would let it see the player enter.
  if (hidingEnabled && !hunted && s.collected >= 1 && ctx.hidAtCollected !== s.collected) {
    if (s.canHide && !creatureSees(here, s) && (!safetyRouting || d >= SAFETY_RADIUS)) {
      ctx.hidAtCollected = s.collected;
      return { input: { ...NO_INPUT, interact: true }, mode: "HIDE" };
    }
    const spot = nearestConcealedHideSpot(s, here);
    if (spot) return { ...routeTo(s, spot, hunted, creature, here, d), mode: "SEEK_HIDING" };
  }
  return routeTo(s, target, hunted, creature, here, d);
}

function routeTo(s: FrameState, target: Point, hunted: boolean, creature: Point, here: Point, d: number): Decision {
  // While hunted: keep out of the creature's immediate reach. Otherwise keep out of the whole safety radius around it. Pursuit
  // began at 5.0 to 7.2 tiles from the player in the traced runs, inside SIGHT_RANGE, and the creature turns while it searches,
  // so a view-cone test alone misses it. Where no route keeps that distance, the route keeps only out of sight. If that also
  // fails, the player backs away inside the radius or holds still outside it. A hunted player keeps the direct fallback.
  const hunt = (tile: Point) => distance(tile, creature) < HUNT_AVOID_RADIUS;
  const safe = (tile: Point) => distance(tile, creature) < SAFETY_RADIUS || creatureSees(tile, s);
  const sight = (tile: Point) => creatureSees(tile, s);
  let avoid: ((tile: Point) => boolean) | null = hunted ? hunt : safetyRouting ? safe : sight;
  let avoiding = route(here, target, s.gateOpen, avoid);
  let mode: RouteMode = hunted ? "HUNT_AVOIDING" : safetyRouting ? "SAFETY_AVOIDING" : "SIGHT_AVOIDING";
  if (!hunted && avoiding === null) {
    avoid = sight;
    avoiding = route(here, target, s.gateOpen, avoid);
    mode = "SIGHT_AVOIDING";
  }
  if (!hunted && avoiding === null && safetyRouting) {
    // No route keeps clear of the creature. Inside the radius: step to the free neighbour farthest from it. Outside it: hold
    // still until a clear route opens. The hold reacts to the creature's position, and nothing is timed.
    if (d < SAFETY_RADIUS) {
      const away = fartherNeighbour(s, here, creature, d);
      if (away) return steer(s, [here, away], "RETREATING", hunted, d);
    }
    return { input: NO_INPUT, mode: "HOLD_CLEAR" };
  }
  // Hunted with no avoiding route: the direct route, as before.
  if (avoiding === null) mode = "DIRECT";
  const path = avoiding ?? route(here, target, s.gateOpen, null);
  if (!path) return { input: NO_INPUT, mode: "NO_PATH" };
  return steer(s, path, mode, hunted, d);
}

/** The free tile next to the player that is farther from the creature than the player is now, or null if there is none. */
function fartherNeighbour(s: FrameState, here: Point, creature: Point, d: number): Point | null {
  const x0 = Math.floor(here.x);
  const y0 = Math.floor(here.y);
  let best: Point | null = null;
  let bestDistance = d;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = x0 + dx;
    const y = y0 + dy;
    if (x < 0 || y < 0 || x >= LEVEL.width || y >= LEVEL.height || isBlocked(LEVEL, x, y, s.gateOpen)) continue;
    const tile = centre({ x, y });
    const dist = distance(tile, creature);
    if (dist > bestDistance) {
      best = tile;
      bestDistance = dist;
    }
  }
  return best;
}

/** Turns toward the path's second waypoint and walks; it sprints only when the creature is far or hunting. */
function steer(s: FrameState, path: Point[], mode: RouteMode, hunted: boolean, d: number): Decision {
  if (path.length < 2) return { input: NO_INPUT, mode: "NO_PATH" };
  const next = path[1]!;
  const diff = wrap(Math.atan2(next.y - s.player[1], next.x - s.player[0]) - s.yaw);
  const forward = Math.abs(diff) < FACING_TOLERANCE ? 1 : 0;
  return {
    input: {
      forward,
      strafe: 0,
      turn: Math.max(-MAX_TURN, Math.min(MAX_TURN, diff * TURN_GAIN)),
      sprint: forward > 0 && (hunted || d > 9),
    },
    mode,
  };
}

/** Plays one attempt until the player escapes, is caught, or the frame budget runs out. */
export async function playAttempt(page: Page, attempt: number, maxFrames: number, sampleEvery: number): Promise<AttemptTrace> {
  let s = await advance(page, NO_INPUT, 0, true);
  const events: AttemptTrace["events"] = [];
  const samples: AttemptTrace["samples"] = [];
  let frame = 0;
  const modeCounts: Partial<Record<RouteMode, number>> = {};
  let lastMode: RouteMode = "NO_TARGET";
  const ctx: DriverContext = { quietFrames: 0, hidAtCollected: null };
  const sample = (): void => {
    samples.push({ frame, time: s.time, monster: s.monster, monsterAt: s.monsterAt, player: s.player, collected: s.collected, sprinting: s.sprinting, noiseAt: s.noiseAt, mode: lastMode });
  };
  sample();
  let outcome: Outcome = "TIMEOUT";
  let closest = { frame: 0, distance: Infinity, monster: s.monster, mode: lastMode as string };
  while (frame < maxFrames) {
    if (s.status === "ESCAPED") {
      outcome = "ESCAPED";
      break;
    }
    if (s.status === "CAUGHT") {
      outcome = "CAUGHT";
      break;
    }
    const decision = decide(s, ctx);
    modeCounts[decision.mode] = (modeCounts[decision.mode] ?? 0) + 1;
    lastMode = decision.mode;
    frame += 1;
    s = await advance(page, decision.input, 1, frame % 6 === 0);
    for (const text of s.events) events.push({ frame, text });
    const apart = distance([s.player[0], s.player[1]], s.monsterAt);
    if (apart < closest.distance) closest = { frame, distance: apart, monster: s.monster, mode: lastMode };
    // Every frame is recorded while the creature is near: a closer approach between samples would otherwise be invisible.
    if (s.events.length > 0 || frame % sampleEvery === 0 || apart < NEAR_SAMPLE_DISTANCE) sample();
  }
  const catchDistance = outcome === "CAUGHT" ? distance([s.player[0], s.player[1]], s.monsterAt) : null;
  return {
    attempt,
    outcome,
    frames: frame,
    seconds: Number((frame / 60).toFixed(2)),
    collectedAtEnd: s.collected,
    events,
    samples,
    catchDistance: catchDistance === null ? null : Number(catchDistance.toFixed(2)),
    closest: { ...closest, distance: Number(closest.distance.toFixed(3)) },
    routeModes: modeCounts,
  };
}
