/**
 * The game world and its rules (Spec 4 section 11). Pure logic with no rendering and no randomness: given the same inputs,
 * the same things happen. The renderer and the audio only read this state.
 *
 * Units are tiles and seconds. The player is faster than the pursuing monster only while sprinting, and sprinting is loud.
 */

import { buildClues, type ClueRecord } from "./clues";
import {
  LEVEL, centre, findPath, hasLineOfSight, isBlocked, tileAt, type Level, type Point,
} from "./level";
import type { ReportSnapshot } from "../report/reportSnapshot";

export type MonsterState = "DORMANT" | "INVESTIGATING" | "SEARCHING" | "PURSUING" | "ATTACKING" | "RECOVERING";
export type Intensity = "low" | "normal" | "high";

export interface Input {
  /** -1 to 1. Forward is positive. */
  forward: number;
  /** -1 to 1. Right is positive. */
  strafe: number;
  /** Radians per second, positive turns right. */
  turn: number;
  sprint: boolean;
}

export const NO_INPUT: Input = { forward: 0, strafe: 0, turn: 0, sprint: false };

export type GameEvent =
  | { type: "CLUE_COLLECTED"; clue: ClueRecord; collected: number; total: number }
  | { type: "GATE_OPENED" }
  | { type: "MONSTER_STATE"; state: MonsterState; previous: MonsterState }
  | { type: "FOOTSTEP"; sprinting: boolean }
  | { type: "FLASHLIGHT"; on: boolean }
  | { type: "CAUGHT" }
  | { type: "ESCAPED" };

export interface Clue {
  record: ClueRecord;
  position: Point;
  collected: boolean;
}

export interface World {
  level: Level;
  intensity: Intensity;
  time: number;
  status: "PLAYING" | "CAUGHT" | "ESCAPED";
  player: { pos: Point; yaw: number; flashlight: boolean; moving: boolean; sprinting: boolean; stepClock: number };
  monster: {
    pos: Point;
    yaw: number;
    state: MonsterState;
    /** Seconds spent in the current state. */
    clock: number;
    target: Point | null;
    path: Point[];
    repath: number;
    patrol: number;
    /** Seconds since it last saw the player. */
    unseen: number;
  };
  clues: Clue[];
  collected: number;
  gateOpen: boolean;
  /** When the threat wakes: a few seconds after the first clue. Null until then. */
  wakeAt: number | null;
}

/** Seconds between the first clue and the threat waking. */
export const WAKE_DELAY = 8;

export const PLAYER_RADIUS = 0.28;
export const WALK_SPEED = 2.2;
export const SPRINT_SPEED = 3.6;
export const PICKUP_DISTANCE = 0.8;
export const SIGHT_RANGE = 8;
export const SIGHT_HALF_ANGLE = Math.PI / 3;
export const CLOSE_SENSE = 1.6;
export const CATCH_DISTANCE = 0.75;
/** Distance within which the monster hears sprinting and walking. A player standing still makes no sound. */
export const HEARING = { sprint: 7, walk: 3.2 } as const;

const MONSTER_SPEED: Record<Intensity, number> = { low: 0.85, normal: 1, high: 1.12 };
/** Tiles per second before the intensity setting is applied. The player walks at 2.2 and sprints at 3.6. */
const BASE_SPEED = { INVESTIGATING: 1.7, SEARCHING: 1.4, PURSUING: 2.9 } as const;
const LOSE_SIGHT_AFTER = 5;
const RECOVER_FOR = 3;
const ATTACK_FOR = 0.35;

/** Clue spots chosen evenly by their order along the level, so the route covers several rooms. */
export function placeClues(level: Level, records: ClueRecord[]): Clue[] {
  const spots = level.clueSpots;
  return records.map((record, i) => ({
    record,
    position: spots[Math.floor((i * spots.length) / records.length) % spots.length]!,
    collected: false,
  }));
}

export function createWorld(snapshot: ReportSnapshot, intensity: Intensity, level: Level = LEVEL): World {
  return createWorldFromClues(buildClues(snapshot), intensity, level);
}

export function createWorldFromClues(records: ClueRecord[], intensity: Intensity, level: Level = LEVEL): World {
  return {
    level,
    intensity,
    time: 0,
    status: "PLAYING",
    player: { pos: { ...level.playerStart }, yaw: 0, flashlight: true, moving: false, sprinting: false, stepClock: 0 },
    monster: { pos: { ...level.monsterStart }, yaw: 0, state: "DORMANT", clock: 0, target: null, path: [], repath: 0, patrol: 0, unseen: 0 },
    clues: placeClues(level, records),
    collected: 0,
    gateOpen: false,
    wakeAt: null,
  };
}

/** Move a circle through the grid, one axis at a time so it slides along walls. */
export function moveCircle(level: Level, from: Point, dx: number, dy: number, radius: number, gateOpen: boolean): Point {
  const hits = (x: number, y: number): boolean =>
    isBlocked(level, x - radius, y - radius, gateOpen) || isBlocked(level, x + radius, y - radius, gateOpen) ||
    isBlocked(level, x - radius, y + radius, gateOpen) || isBlocked(level, x + radius, y + radius, gateOpen);
  let { x, y } = from;
  if (!hits(x + dx, y)) x += dx;
  if (!hits(x, y + dy)) y += dy;
  return { x, y };
}

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const angleDifference = (a: number, b: number): number => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** Forward is the direction of yaw: yaw 0 looks along +x, positive yaw turns toward +y (right when y points down the map). */
export function forwardOf(yaw: number): Point {
  return { x: Math.cos(yaw), y: Math.sin(yaw) };
}

function setMonsterState(world: World, next: MonsterState, events: GameEvent[]): void {
  const m = world.monster;
  if (m.state === next) return;
  events.push({ type: "MONSTER_STATE", state: next, previous: m.state });
  m.state = next;
  m.clock = 0;
  m.path = [];
  m.repath = 0;
}

/** Whether the monster currently sees the player: close enough to sense, or in its view cone with a clear line. */
export function monsterSeesPlayer(world: World): boolean {
  const { monster: m, player: p, level } = world;
  const d = distance(m.pos, p.pos);
  if (d <= CLOSE_SENSE && hasLineOfSight(level, m.pos, p.pos, world.gateOpen)) return true;
  // A lit flashlight makes the player easier to see from afar.
  const range = SIGHT_RANGE * (p.flashlight ? 1 : 0.6) * MONSTER_SPEED[world.intensity];
  if (d > range) return false;
  const bearing = Math.atan2(p.pos.y - m.pos.y, p.pos.x - m.pos.x);
  if (Math.abs(angleDifference(bearing, m.yaw)) > SIGHT_HALF_ANGLE) return false;
  return hasLineOfSight(level, m.pos, p.pos, world.gateOpen);
}

export function playerNoise(world: World): number {
  const p = world.player;
  if (!p.moving) return 0;
  return p.sprinting ? HEARING.sprint : HEARING.walk;
}

function followPath(world: World, speed: number, dt: number): boolean {
  const m = world.monster;
  let budget = speed * dt;
  while (m.path.length > 0 && budget > 0) {
    const next = centre(m.path[0]!.x, m.path[0]!.y);
    const d = distance(m.pos, next);
    m.yaw = Math.atan2(next.y - m.pos.y, next.x - m.pos.x);
    if (d <= budget) {
      m.pos = next;
      m.path.shift();
      budget -= d;
    } else {
      m.pos = { x: m.pos.x + ((next.x - m.pos.x) / d) * budget, y: m.pos.y + ((next.y - m.pos.y) / d) * budget };
      budget = 0;
    }
  }
  return m.path.length === 0;
}

function pathTo(world: World, target: Point): void {
  const path = findPath(world.level, world.monster.pos, target, world.gateOpen);
  world.monster.path = path ? path.slice(1) : [];
  world.monster.target = target;
}

function updateMonster(world: World, dt: number, events: GameEvent[]): void {
  const m = world.monster;
  const p = world.player;
  m.clock += dt;
  m.repath -= dt;
  const speed = MONSTER_SPEED[world.intensity];
  const seen = monsterSeesPlayer(world);
  m.unseen = seen ? 0 : m.unseen + dt;
  const d = distance(m.pos, p.pos);

  if (m.state === "DORMANT") {
    if (world.wakeAt !== null && world.time >= world.wakeAt) setMonsterState(world, "SEARCHING", events);
    return;
  }

  if (m.state === "ATTACKING") {
    if (d > CATCH_DISTANCE * 1.4) {
      setMonsterState(world, "PURSUING", events);
    } else if (m.clock >= ATTACK_FOR) {
      world.status = "CAUGHT";
      events.push({ type: "CAUGHT" });
    }
    return;
  }

  if (seen && m.state !== "RECOVERING") {
    if (d <= CATCH_DISTANCE) {
      setMonsterState(world, "ATTACKING", events);
      return;
    }
    setMonsterState(world, "PURSUING", events);
    if (m.repath <= 0) {
      pathTo(world, p.pos);
      m.repath = 0.3;
    }
    followPath(world, BASE_SPEED.PURSUING * speed, dt);
    return;
  }

  switch (m.state) {
    case "PURSUING": {
      // Went out of sight: run to where the player was last seen, then lose the trail.
      if (m.path.length > 0) followPath(world, BASE_SPEED.PURSUING * speed, dt);
      if (m.unseen >= LOSE_SIGHT_AFTER || m.path.length === 0) setMonsterState(world, "RECOVERING", events);
      break;
    }
    case "RECOVERING": {
      if (m.clock >= RECOVER_FOR) setMonsterState(world, "SEARCHING", events);
      break;
    }
    case "INVESTIGATING": {
      const noise = playerNoise(world);
      if (noise > 0 && d <= noise && m.repath <= 0) {
        pathTo(world, p.pos);
        m.repath = 0.5;
      }
      const arrived = followPath(world, BASE_SPEED.INVESTIGATING * speed, dt);
      if (arrived && m.repath <= 0) setMonsterState(world, "SEARCHING", events);
      break;
    }
    case "SEARCHING": {
      const noise = playerNoise(world);
      if (noise > 0 && d <= noise && m.clock > 1) {
        setMonsterState(world, "INVESTIGATING", events);
        pathTo(world, p.pos);
        m.repath = 0.5;
        break;
      }
      if (m.path.length === 0) {
        // Visit the clue spots in turn.
        const spots = world.level.clueSpots;
        pathTo(world, spots[m.patrol % spots.length]!);
        m.patrol += 1;
      }
      followPath(world, BASE_SPEED.SEARCHING * speed, dt);
      break;
    }
    default:
      break;
  }
}

function updatePlayer(world: World, input: Input, dt: number, events: GameEvent[]): void {
  const p = world.player;
  p.yaw += input.turn * dt;
  const f = forwardOf(p.yaw);
  const right = { x: -f.y, y: f.x };
  let mx = f.x * input.forward + right.x * input.strafe;
  let my = f.y * input.forward + right.y * input.strafe;
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  p.sprinting = input.sprint && length > 0;
  const speed = p.sprinting ? SPRINT_SPEED : WALK_SPEED;
  const before = p.pos;
  p.pos = moveCircle(world.level, p.pos, mx * speed * dt, my * speed * dt, PLAYER_RADIUS, world.gateOpen);
  p.moving = distance(before, p.pos) > 1e-6;
  if (p.moving) {
    p.stepClock += distance(before, p.pos);
    const stride = p.sprinting ? 1.1 : 0.8;
    if (p.stepClock >= stride) {
      p.stepClock -= stride;
      events.push({ type: "FOOTSTEP", sprinting: p.sprinting });
    }
  }
}

function collectClues(world: World, events: GameEvent[]): void {
  for (const clue of world.clues) {
    if (clue.collected || distance(clue.position, world.player.pos) > PICKUP_DISTANCE) continue;
    clue.collected = true;
    world.collected += 1;
    events.push({ type: "CLUE_COLLECTED", clue: clue.record, collected: world.collected, total: world.clues.length });
    // The threat wakes with the first clue and is drawn to where the player is.
    if (world.collected === 1 && world.wakeAt === null) world.wakeAt = world.time + WAKE_DELAY;
    if (world.collected === world.clues.length && !world.gateOpen) {
      world.gateOpen = true;
      events.push({ type: "GATE_OPENED" });
    }
  }
}

/** Advance the world by dt seconds (dt is clamped so a stalled tab cannot teleport anyone). Returns what happened. */
export function step(world: World, input: Input, rawDt: number): GameEvent[] {
  const events: GameEvent[] = [];
  if (world.status !== "PLAYING") return events;
  const dt = Math.min(Math.max(rawDt, 0), 0.1);
  world.time += dt;
  updatePlayer(world, input, dt, events);
  collectClues(world, events);
  updateMonster(world, dt, events);
  if (world.status === "PLAYING" && world.gateOpen && tileAt(world.level, world.player.pos.x, world.player.pos.y) === "EXIT") {
    world.status = "ESCAPED";
    events.push({ type: "ESCAPED" });
  }
  return events;
}

export function toggleFlashlight(world: World): GameEvent {
  world.player.flashlight = !world.player.flashlight;
  return { type: "FLASHLIGHT", on: world.player.flashlight };
}

export interface ThreatInfo {
  /** 0 to 1, see `tension`. */
  level: number;
  /** Tiles between the monster and the player. */
  distance: number;
  /** -1 (hard left) to 1 (hard right) relative to where the player looks. Used to place its sounds. */
  pan: number;
  awake: boolean;
}

export function threatInfo(world: World): ThreatInfo {
  const m = world.monster;
  const p = world.player;
  const bearing = Math.atan2(m.pos.y - p.pos.y, m.pos.x - p.pos.x);
  return {
    level: tension(world),
    distance: distance(m.pos, p.pos),
    pan: Math.sin(angleDifference(bearing, p.yaw)),
    awake: m.state !== "DORMANT",
  };
}

/** 0 when the monster is dormant or far, up to 1 when it is on top of the player. Drives the tension of sound and light. */
export function tension(world: World): number {
  const m = world.monster;
  if (m.state === "DORMANT") return 0;
  const d = distance(m.pos, world.player.pos);
  const base = Math.max(0, 1 - d / 10);
  const boost = m.state === "PURSUING" || m.state === "ATTACKING" ? 0.3 : 0;
  return Math.min(1, base + boost);
}
