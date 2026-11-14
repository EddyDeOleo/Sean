/**
 * The game world and its rules (Spec 4 section 11). Pure logic with no rendering: given the same inputs and the same seed,
 * the same things happen. The renderer and the audio only read this state.
 *
 * Units are tiles and seconds. The player is faster than the pursuing creature only while sprinting, and sprinting is loud.
 * Standing still is silent. Hiding places hide the player from a creature that did not see them go in, and the creature
 * searches hiding places, so hiding is a gamble that running away is not.
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
  | { type: "LUNGE" }
  | { type: "HIDING"; hidden: boolean }
  | { type: "FOOTSTEP"; sprinting: boolean }
  | { type: "FLASHLIGHT"; on: boolean }
  | { type: "CAUGHT" }
  | { type: "ESCAPED" };

export interface Clue {
  record: ClueRecord;
  position: Point;
  collected: boolean;
}

/** What the creature is walking toward while it is not chasing. */
export type Goal = "PATROL" | "NOISE" | "HIDING_PLACE" | "LAST_SEEN";

export interface World {
  level: Level;
  intensity: Intensity;
  time: number;
  status: "PLAYING" | "CAUGHT" | "ESCAPED";
  player: {
    pos: Point;
    yaw: number;
    flashlight: boolean;
    moving: boolean;
    sprinting: boolean;
    stepClock: number;
    /** Inside a hiding place. */
    hidden: boolean;
    /** The creature saw the player go in, so it will come straight to the place. */
    hiddenKnown: boolean;
    hideSpot: Point | null;
  };
  monster: {
    pos: Point;
    yaw: number;
    state: MonsterState;
    /** Seconds spent in the current state. */
    clock: number;
    target: Point | null;
    goal: Goal;
    path: Point[];
    repath: number;
    /** Seconds since it last saw the player. */
    unseen: number;
    /** Where it last heard something, or last saw the player. */
    noiseAt: Point | null;
    noiseAge: number;
    lastSeen: Point | null;
    /** Waiting at a waypoint and looking around, in seconds left. */
    wait: number;
    /** Waypoints it still wants to search around `focus`. */
    searchLeft: number;
    focus: Point | null;
    visited: number[];
    /** Hiding places it has checked lately, by index, so it does not check the same one again and again. */
    checked: number[];
    picks: number;
    /** Seconds it has spent close to a hidden player without knowing. */
    dwell: number;
    lunge: number;
    lungeCooldown: number;
    /** Tiles per second it actually moved on the last step. Used to animate it. */
    speedNow: number;
    rng: number;
  };
  clues: Clue[];
  collected: number;
  gateOpen: boolean;
  /** When the threat wakes: a few seconds after the first clue. Null until then. */
  wakeAt: number | null;
}

export const PLAYER_RADIUS = 0.28;
export const WALK_SPEED = 2.2;
export const SPRINT_SPEED = 3.6;
export const PICKUP_DISTANCE = 0.8;
export const HIDE_DISTANCE = 0.95;
export const CLOSE_SENSE = 1.6;
export const CATCH_DISTANCE = 0.75;
/** Distance within which the creature hears sprinting and walking. A player standing still or hiding makes no sound. */
export const HEARING = { sprint: 7, walk: 3.2 } as const;
/** Noise made by collecting a clue (a rustle) and by the gate opening. */
export const CLUE_NOISE = 5;
export const GATE_NOISE = 9;

/** How each difficulty changes the creature. The player's speeds never change. */
interface Profile {
  speed: number;
  sight: number;
  hearing: number;
  wakeDelay: number;
  /** Waypoints it searches around where it lost or heard the player. */
  searchWaypoints: number;
  /** Seconds near a hidden player before it opens the hiding place. */
  hideDwell: number;
}
export const PROFILE: Record<Intensity, Profile> = {
  low: { speed: 0.85, sight: 0.85, hearing: 0.85, wakeDelay: 10, searchWaypoints: 2, hideDwell: 7 },
  normal: { speed: 1, sight: 1, hearing: 1, wakeDelay: 8, searchWaypoints: 3, hideDwell: 4.5 },
  high: { speed: 1.12, sight: 1.1, hearing: 1.15, wakeDelay: 5, searchWaypoints: 4, hideDwell: 2.5 },
};

/** Seconds between the first clue and the creature waking, on normal. */
export const WAKE_DELAY = PROFILE.normal.wakeDelay;

export const SIGHT_RANGE = 8;
export const SIGHT_HALF_ANGLE = Math.PI / 3;

/** Tiles per second before the difficulty is applied. The player walks at 2.2 and sprints at 3.6. */
const BASE_SPEED = { PATROL: 1.35, NOISE: 1.9, PURSUING: 2.9, LAST_SEEN: 2.1 } as const;
const LUNGE_SPEED = 1.35;
const LUNGE_FOR = 0.7;
const LUNGE_COOLDOWN = 7;
const LUNGE_RANGE = 3.2;
const LOSE_SIGHT_AFTER = 5;
const RECOVER_FOR = 2.5;
const ATTACK_FOR = 0.35;
const LOOK_AROUND_FOR = 1.6;
const NEAR_HIDING_PLACE = 2.5;
const RECENTLY_VISITED = 5;
const REHEAR_AFTER = 1.2;

/** Clue spots chosen evenly by their order along the level, so the route covers several rooms. */
export function placeClues(level: Level, records: ClueRecord[]): Clue[] {
  const spots = level.clueSpots;
  return records.map((record, i) => ({
    record,
    position: spots[Math.floor((i * spots.length) / records.length) % spots.length]!,
    collected: false,
  }));
}

/** A snapshot may be absent: the game is playable on its own, with atmosphere items only. */
export function createWorld(snapshot: ReportSnapshot | null, intensity: Intensity, level: Level = LEVEL, seed = 1): World {
  return createWorldFromClues(buildClues(snapshot), intensity, level, seed);
}

export function createWorldFromClues(records: ClueRecord[], intensity: Intensity, level: Level = LEVEL, seed = 1): World {
  return {
    level,
    intensity,
    time: 0,
    status: "PLAYING",
    player: { pos: { ...level.playerStart }, yaw: 0, flashlight: true, moving: false, sprinting: false, stepClock: 0, hidden: false, hiddenKnown: false, hideSpot: null },
    monster: {
      pos: { ...level.monsterStart }, yaw: 0, state: "DORMANT", clock: 0, target: null, goal: "PATROL", path: [], repath: 0, unseen: 0,
      noiseAt: null, noiseAge: 99, lastSeen: null, wait: 0, searchLeft: 0, focus: null, visited: [], checked: [], picks: 0, dwell: 0,
      lunge: 0, lungeCooldown: 3, speedNow: 0, rng: (Math.imul(seed, 2654435761) >>> 0) || 1,
    },
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

/** A small deterministic generator, so a seed gives the same creature behaviour and different seeds differ. */
function nextRandom(world: World): number {
  const m = world.monster;
  m.rng = (Math.imul(m.rng, 1664525) + 1013904223) >>> 0;
  return m.rng / 4294967296;
}

function setMonsterState(world: World, next: MonsterState, events: GameEvent[]): void {
  const m = world.monster;
  if (m.state === next) return;
  events.push({ type: "MONSTER_STATE", state: next, previous: m.state });
  m.state = next;
  m.clock = 0;
  m.path = [];
  m.repath = 0;
  m.wait = 0;
}

/** Whether the creature currently sees the player: close enough to sense, or in its view cone with a clear line. */
export function monsterSeesPlayer(world: World): boolean {
  const { monster: m, player: p, level } = world;
  // A hidden player is seen only by a creature that watched them go in.
  if (p.hidden && !p.hiddenKnown) return false;
  const d = distance(m.pos, p.pos);
  if (d <= CLOSE_SENSE && hasLineOfSight(level, m.pos, p.pos, world.gateOpen)) return true;
  // A lit flashlight makes the player easier to see from afar.
  const range = SIGHT_RANGE * (p.flashlight ? 1 : 0.6) * PROFILE[world.intensity].sight;
  if (d > range) return false;
  const bearing = Math.atan2(p.pos.y - m.pos.y, p.pos.x - m.pos.x);
  if (Math.abs(angleDifference(bearing, m.yaw)) > SIGHT_HALF_ANGLE) return false;
  return hasLineOfSight(level, m.pos, p.pos, world.gateOpen);
}

export function playerNoise(world: World): number {
  const p = world.player;
  if (!p.moving || p.hidden) return 0;
  return (p.sprinting ? HEARING.sprint : HEARING.walk) * PROFILE[world.intensity].hearing;
}

function followPath(world: World, speed: number, dt: number): boolean {
  const m = world.monster;
  let budget = speed * dt;
  let moved = 0;
  while (m.path.length > 0 && budget > 0) {
    const next = centre(m.path[0]!.x, m.path[0]!.y);
    const d = distance(m.pos, next);
    m.yaw = Math.atan2(next.y - m.pos.y, next.x - m.pos.x);
    if (d <= budget) {
      m.pos = next;
      m.path.shift();
      budget -= d;
      moved += d;
    } else {
      m.pos = { x: m.pos.x + ((next.x - m.pos.x) / d) * budget, y: m.pos.y + ((next.y - m.pos.y) / d) * budget };
      moved += budget;
      budget = 0;
    }
  }
  m.speedNow = dt > 0 ? moved / dt : 0;
  return m.path.length === 0;
}

function pathTo(world: World, target: Point): boolean {
  const path = findPath(world.level, world.monster.pos, target, world.gateOpen);
  world.monster.path = path ? path.slice(1) : [];
  world.monster.target = target;
  return path !== null;
}

/** A sound the creature may hear. It goes to where the sound was, not to where the player is now. */
function hearNoise(world: World, at: Point, radius: number): void {
  const m = world.monster;
  if (m.state === "DORMANT" || m.state === "PURSUING" || m.state === "ATTACKING") return;
  if (distance(m.pos, at) > radius) return;
  if (m.noiseAge < REHEAR_AFTER && m.noiseAt && distance(m.noiseAt, at) < 1.5) return;
  m.noiseAt = { ...at };
  m.noiseAge = 0;
}

/** Pick the next waypoint: the ones near where it heard or lost the player first, then others it has not visited lately. */
function nextWaypoint(world: World): Point | null {
  const m = world.monster;
  const points = world.level.patrol.filter((p) => world.gateOpen || findPath(world.level, m.pos, p, false) !== null);
  if (points.length === 0) return null;
  const indexOf = (p: Point): number => world.level.patrol.indexOf(p);
  const fresh = points.filter((p) => !m.visited.includes(indexOf(p)));
  const pool = fresh.length > 0 ? fresh : points;
  let chosen: Point;
  if (m.searchLeft > 0 && m.focus) {
    const focus = m.focus;
    chosen = [...pool].sort((a, b) => distance(a, focus) - distance(b, focus))[0]!;
    m.searchLeft -= 1;
  } else {
    chosen = pool[Math.floor(nextRandom(world) * pool.length)]!;
  }
  m.visited.push(indexOf(chosen));
  if (m.visited.length > RECENTLY_VISITED) m.visited.shift();
  return chosen;
}

/** Choose where to go next while not chasing. Every few picks it checks the nearest hiding place. */
function chooseGoal(world: World): void {
  const m = world.monster;
  m.picks += 1;
  if (m.noiseAt && m.noiseAge < 30 && distance(m.pos, m.noiseAt) > 1.2) {
    m.goal = "NOISE";
    pathTo(world, m.noiseAt);
    m.noiseAt = null;
    return;
  }
  if (m.picks % 3 === 0 && world.level.hideSpots.length > 0) {
    // The nearest hiding place it has not looked in lately, so every locker gets its turn.
    const spots = world.level.hideSpots;
    let candidates = spots.map((spot, index) => ({ spot, index })).filter(({ index }) => !m.checked.includes(index));
    if (candidates.length === 0) {
      m.checked = [];
      candidates = spots.map((spot, index) => ({ spot, index }));
    }
    const { spot, index } = candidates.sort((a, b) => distance(a.spot, m.pos) - distance(b.spot, m.pos))[0]!;
    if (distance(spot, m.pos) < 14 && pathTo(world, spot)) {
      m.checked.push(index);
      m.goal = "HIDING_PLACE";
      return;
    }
  }
  const waypoint = nextWaypoint(world);
  m.goal = "PATROL";
  if (waypoint) pathTo(world, waypoint);
}

function updateMonster(world: World, dt: number, events: GameEvent[]): void {
  const m = world.monster;
  const p = world.player;
  const profile = PROFILE[world.intensity];
  m.clock += dt;
  m.repath -= dt;
  m.noiseAge += dt;
  m.lungeCooldown -= dt;
  m.speedNow = 0;
  const seen = monsterSeesPlayer(world);
  m.unseen = seen ? 0 : m.unseen + dt;
  if (seen) m.lastSeen = { ...p.pos };
  const d = distance(m.pos, p.pos);

  if (m.state === "DORMANT") {
    if (world.wakeAt !== null && world.time >= world.wakeAt) {
      // It wakes where it is and goes about its rounds. Which way it goes first depends on the seed, so no two games start alike.
      setMonsterState(world, "SEARCHING", events);
      chooseGoal(world);
    }
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

  // A hiding place the creature knows about: it comes straight there and opens it.
  if (p.hidden && p.hiddenKnown && p.hideSpot && m.state !== "RECOVERING") {
    if (m.state !== "PURSUING") setMonsterState(world, "PURSUING", events);
    if (m.repath <= 0) {
      pathTo(world, p.hideSpot);
      m.repath = 0.4;
    }
    followPath(world, BASE_SPEED.PURSUING * profile.speed, dt);
    if (distance(m.pos, p.pos) <= CATCH_DISTANCE) setMonsterState(world, "ATTACKING", events);
    return;
  }

  if (seen && m.state !== "RECOVERING") {
    if (d <= CATCH_DISTANCE) {
      setMonsterState(world, "ATTACKING", events);
      return;
    }
    if (m.state !== "PURSUING") setMonsterState(world, "PURSUING", events);
    if (m.repath <= 0) {
      pathTo(world, p.pos);
      m.repath = 0.3;
    }
    // When it is close it lunges: a short burst of speed, then a long rest. It never lunges twice in a row.
    if (m.lunge <= 0 && m.lungeCooldown <= 0 && d < LUNGE_RANGE) {
      m.lunge = LUNGE_FOR;
      m.lungeCooldown = LUNGE_COOLDOWN;
      events.push({ type: "LUNGE" });
    }
    const boost = m.lunge > 0 ? LUNGE_SPEED : 1;
    m.lunge = Math.max(0, m.lunge - dt);
    followPath(world, BASE_SPEED.PURSUING * profile.speed * boost, dt);
    return;
  }

  const noise = playerNoise(world);
  if (noise > 0 && d <= noise) hearNoise(world, p.pos, noise);

  switch (m.state) {
    case "PURSUING": {
      // Out of sight: run to where the player was last seen, then lose the trail.
      if (m.path.length > 0) followPath(world, BASE_SPEED.PURSUING * profile.speed, dt);
      if (m.unseen >= LOSE_SIGHT_AFTER || m.path.length === 0) {
        m.focus = m.lastSeen ? { ...m.lastSeen } : null;
        m.searchLeft = profile.searchWaypoints + 1;
        setMonsterState(world, "RECOVERING", events);
      }
      break;
    }
    case "RECOVERING": {
      // It stands, turns its head, and listens.
      m.yaw += Math.sin(m.clock * 3) * dt * 2.2;
      if (m.clock >= RECOVER_FOR) {
        setMonsterState(world, "SEARCHING", events);
        chooseGoal(world);
      }
      break;
    }
    case "INVESTIGATING":
    case "SEARCHING": {
      if (m.state === "SEARCHING" && m.noiseAt && m.noiseAge < 0.5 && m.clock > 1) {
        // Something new was heard while searching: go and look.
        m.focus = { ...m.noiseAt };
        m.searchLeft = profile.searchWaypoints;
        setMonsterState(world, "INVESTIGATING", events);
        chooseGoal(world);
        break;
      }
      if (m.wait > 0) {
        m.wait -= dt;
        // Looking around: a slow sweep of the head, so what it can see changes while it waits.
        m.yaw += Math.sin(m.clock * 2.4) * dt * 1.8;
        if (m.goal === "HIDING_PLACE" && p.hidden && p.hideSpot && distance(m.pos, p.hideSpot) < NEAR_HIDING_PLACE) {
          m.dwell += dt;
          if (m.dwell >= profile.hideDwell) {
            // It has stood beside the place long enough to know. It opens it.
            p.hiddenKnown = true;
            setMonsterState(world, "PURSUING", events);
          }
        }
        break;
      }
      if (m.path.length === 0) {
        // Arrived (or had nowhere to go).
        if (m.target && distance(m.pos, m.target) < 1.3) {
          if (m.goal === "HIDING_PLACE" && p.hidden && p.hideSpot && distance(m.target, p.hideSpot) < 0.6) {
            // It opens the hiding place the player is in.
            setMonsterState(world, "ATTACKING", events);
            break;
          }
          if (m.state === "INVESTIGATING") setMonsterState(world, "SEARCHING", events);
          // After the state change, because a change of state clears the wait.
          m.wait = LOOK_AROUND_FOR;
          m.target = null;
          m.dwell = 0;
          break;
        }
        chooseGoal(world);
      }
      const speed = (m.goal === "NOISE" ? BASE_SPEED.NOISE : BASE_SPEED.PATROL) * profile.speed;
      followPath(world, speed, dt);
      break;
    }
    default:
      break;
  }
  m.lunge = Math.max(0, m.lunge - dt);
}

function enterHiding(world: World, events: GameEvent[]): void {
  const p = world.player;
  const spot = world.level.hideSpots.find((h) => distance(h, p.pos) <= HIDE_DISTANCE);
  if (!spot) return;
  const m = world.monster;
  p.hidden = true;
  p.hideSpot = { ...spot };
  p.pos = { ...spot };
  p.moving = false;
  p.sprinting = false;
  // The creature knows where the player went if it is chasing, or is looking at them as they go in.
  p.hiddenKnown = m.state === "PURSUING" || m.state === "ATTACKING" || (m.state !== "DORMANT" && monsterSeesPlayerAt(world, p.pos));
  events.push({ type: "HIDING", hidden: true });
}

function monsterSeesPlayerAt(world: World, at: Point): boolean {
  const { monster: m, level } = world;
  const d = distance(m.pos, at);
  // Close enough to sense, with a clear line, whichever way it is looking.
  if (d <= CLOSE_SENSE && hasLineOfSight(level, m.pos, at, world.gateOpen)) return true;
  if (d > SIGHT_RANGE * PROFILE[world.intensity].sight) return false;
  const bearing = Math.atan2(at.y - m.pos.y, at.x - m.pos.x);
  return Math.abs(angleDifference(bearing, m.yaw)) <= SIGHT_HALF_ANGLE && hasLineOfSight(level, m.pos, at, world.gateOpen);
}

function leaveHiding(world: World, events: GameEvent[]): void {
  const p = world.player;
  if (!p.hidden) return;
  p.hidden = false;
  p.hiddenKnown = false;
  p.hideSpot = null;
  world.monster.dwell = 0;
  events.push({ type: "HIDING", hidden: false });
}

/** Enter or leave a hiding place (the interact key). Returns what happened. */
export function toggleHiding(world: World): GameEvent[] {
  const events: GameEvent[] = [];
  if (world.status !== "PLAYING") return events;
  if (world.player.hidden) leaveHiding(world, events);
  else enterHiding(world, events);
  return events;
}

/** Whether a hiding place is close enough to enter. Used for the on-screen hint. */
export function nearHidingPlace(world: World): boolean {
  return !world.player.hidden && world.level.hideSpots.some((h) => distance(h, world.player.pos) <= HIDE_DISTANCE);
}

function updatePlayer(world: World, input: Input, dt: number, events: GameEvent[]): void {
  const p = world.player;
  p.yaw += input.turn * dt;
  if (p.hidden) {
    // Moving leaves the hiding place. Turning the head does not.
    if (input.forward !== 0 || input.strafe !== 0) leaveHiding(world, events);
    else {
      p.moving = false;
      p.sprinting = false;
      return;
    }
  }
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
  if (world.player.hidden) return;
  for (const clue of world.clues) {
    if (clue.collected || distance(clue.position, world.player.pos) > PICKUP_DISTANCE) continue;
    clue.collected = true;
    world.collected += 1;
    events.push({ type: "CLUE_COLLECTED", clue: clue.record, collected: world.collected, total: world.clues.length });
    // Picking something up rustles. The creature goes to where the rustle was.
    hearNoise(world, clue.position, CLUE_NOISE * PROFILE[world.intensity].hearing);
    // The creature wakes a few seconds after the first clue.
    if (world.collected === 1 && world.wakeAt === null) world.wakeAt = world.time + PROFILE[world.intensity].wakeDelay;
    if (world.collected === world.clues.length && !world.gateOpen) {
      world.gateOpen = true;
      events.push({ type: "GATE_OPENED" });
      // The gate groans: a creature near enough comes to look. The player is not told where it is.
      hearNoise(world, world.level.gate, GATE_NOISE * PROFILE[world.intensity].hearing);
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
