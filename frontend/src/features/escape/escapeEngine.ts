/**
 * Escape game engine (Spec 3 section 8). Pure and deterministic. No DOM, no clock, no Math.random.
 *
 * The map is an 11 by 9 grid of tiles carved by a seeded depth-first walk, so every floor tile is connected. The seed is a
 * hash of the investigation id and affects geometry only. The game is turn-based: one player action is followed by one
 * presence move. There is no timing pressure.
 *
 * Completable by rule:
 * - The presence moves every turn until the player has been caught twice. After two catches it moves every second turn.
 *   After four catches it is dormant. The game therefore cannot loop forever.
 * - Fragments and the exit are placed on distinct floor tiles of one connected component, and canComplete (a breadth-first
 *   search) verifies it.
 * - Being caught returns the player to the entrance. Collected fragments are kept.
 */

export const GRID_WIDTH = 11;
export const GRID_HEIGHT = 9;
export const MAX_FRAGMENTS = 4;
export const SLOW_AFTER_CATCHES = 2;
export const DORMANT_AFTER_CATCHES = 4;
export const CHASE_DISTANCE = 6;
export const LANTERN_RADIUS = 2;

export type Tile = "WALL" | "FLOOR";
export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
export type Action = Direction | "WAIT";

export interface Point {
  x: number;
  y: number;
}

export interface Fragment {
  /** Index of the evidence item this fragment stands for. */
  index: number;
  at: Point;
  collected: boolean;
}

export interface GameState {
  seed: number;
  tiles: Tile[][];
  entrance: Point;
  exit: Point;
  player: Point;
  presence: Point;
  /** Patrol route for the presence while it is not chasing. */
  patrol: Point[];
  patrolIndex: number;
  hiding: Point[];
  fragments: Fragment[];
  catches: number;
  turn: number;
  status: "PLAYING" | "ESCAPED";
  /** Last event, for announcements and tests. */
  event: GameEvent;
}

export type GameEvent =
  | { kind: "NONE" }
  | { kind: "MOVED" }
  | { kind: "BLOCKED" }
  | { kind: "COLLECTED"; index: number }
  | { kind: "CAUGHT"; catches: number }
  | { kind: "EXIT_SEALED"; remaining: number }
  | { kind: "ESCAPED" };

/** FNV-1a over the text, then mixed. Returns an unsigned 32-bit integer. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** mulberry32. Deterministic for a given seed. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEY = (p: Point): string => `${p.x},${p.y}`;
const SAME = (a: Point, b: Point): boolean => a.x === b.x && a.y === b.y;
const DELTA: Record<Direction, Point> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};
const DIRECTIONS: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

export function isFloor(tiles: Tile[][], p: Point): boolean {
  return p.y >= 0 && p.y < GRID_HEIGHT && p.x >= 0 && p.x < GRID_WIDTH && tiles[p.y]?.[p.x] === "FLOOR";
}

function carveMaze(random: () => number): Tile[][] {
  const tiles: Tile[][] = Array.from({ length: GRID_HEIGHT }, () => Array<Tile>(GRID_WIDTH).fill("WALL"));
  // Cells sit at odd coordinates. The walk removes the wall between two cells.
  const start: Point = { x: 1, y: 1 };
  const row = tiles[start.y];
  if (row) row[start.x] = "FLOOR";
  const stack: Point[] = [start];
  while (stack.length > 0) {
    const current = stack[stack.length - 1] as Point;
    const options = DIRECTIONS.map((direction) => {
      const delta = DELTA[direction];
      return { between: { x: current.x + delta.x, y: current.y + delta.y }, next: { x: current.x + delta.x * 2, y: current.y + delta.y * 2 } };
    }).filter(({ next }) => next.x > 0 && next.x < GRID_WIDTH - 1 && next.y > 0 && next.y < GRID_HEIGHT - 1 && tiles[next.y]?.[next.x] === "WALL");
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(random() * options.length)] as (typeof options)[number];
    const betweenRow = tiles[pick.between.y];
    const nextRow = tiles[pick.next.y];
    if (betweenRow) betweenRow[pick.between.x] = "FLOOR";
    if (nextRow) nextRow[pick.next.x] = "FLOOR";
    stack.push(pick.next);
  }
  return tiles;
}

/** Breadth-first distances from a point over floor tiles. Unreachable tiles are absent. */
export function distances(tiles: Tile[][], from: Point): Map<string, number> {
  const seen = new Map<string, number>([[KEY(from), 0]]);
  const queue: Point[] = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as Point;
    const base = seen.get(KEY(current)) as number;
    for (const direction of DIRECTIONS) {
      const delta = DELTA[direction];
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (isFloor(tiles, next) && !seen.has(KEY(next))) {
        seen.set(KEY(next), base + 1);
        queue.push(next);
      }
    }
  }
  return seen;
}

function floorTiles(tiles: Tile[][]): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      if (tiles[y]?.[x] === "FLOOR") out.push({ x, y });
    }
  }
  return out;
}

/** Create a game. fragmentCount is clamped to 0..MAX_FRAGMENTS. */
export function createGame(seedText: string, fragmentCount: number): GameState {
  const seed = hashSeed(seedText);
  const random = makeRandom(seed);
  const tiles = carveMaze(random);
  const entrance: Point = { x: 1, y: 1 };
  const reach = distances(tiles, entrance);
  const floors = floorTiles(tiles);

  const farthest = [...floors].sort((a, b) => (reach.get(KEY(b)) ?? 0) - (reach.get(KEY(a)) ?? 0) || a.y - b.y || a.x - b.x);
  const exit = farthest[0] as Point;

  const used = new Set<string>([KEY(entrance), KEY(exit)]);
  const take = (candidates: Point[]): Point | undefined => {
    const candidate = candidates.find((p) => !used.has(KEY(p)));
    if (candidate) used.add(KEY(candidate));
    return candidate;
  };

  // Fragments are spread across the map: shuffle by the seeded random, then take distinct tiles away from the entrance.
  const shuffled = [...floors]
    .filter((p) => (reach.get(KEY(p)) ?? 0) >= 4)
    .map((p) => ({ p, k: random() }))
    .sort((a, b) => a.k - b.k)
    .map(({ p }) => p);
  const count = Math.max(0, Math.min(MAX_FRAGMENTS, Math.floor(fragmentCount)));
  const fragments: Fragment[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = take(shuffled);
    if (at) fragments.push({ index, at, collected: false });
  }

  // Hiding alcoves: dead ends other than the entrance, exit, and fragments.
  const deadEnds = floors.filter((p) => {
    if (used.has(KEY(p))) return false;
    const open = DIRECTIONS.filter((d) => isFloor(tiles, { x: p.x + DELTA[d].x, y: p.y + DELTA[d].y })).length;
    return open === 1;
  });
  const hiding: Point[] = [];
  for (const candidate of deadEnds) {
    if (hiding.length >= 3) break;
    hiding.push(candidate);
    used.add(KEY(candidate));
  }

  // The presence starts in the middle of the map and patrols between two far-apart floor tiles that are not hiding places.
  const hidingKeys = new Set(hiding.map(KEY));
  const patrolPool = floors.filter((p) => !hidingKeys.has(KEY(p)) && !SAME(p, entrance));
  const startTile = [...patrolPool].sort(
    (a, b) =>
      Math.abs((reach.get(KEY(a)) ?? 0) - (reach.get(KEY(exit)) ?? 0) / 2) - Math.abs((reach.get(KEY(b)) ?? 0) - (reach.get(KEY(exit)) ?? 0) / 2) ||
      a.y - b.y ||
      a.x - b.x,
  )[0] as Point;
  const fromStart = distances(tiles, startTile);
  const patrolEnd = [...patrolPool].sort((a, b) => (fromStart.get(KEY(b)) ?? 0) - (fromStart.get(KEY(a)) ?? 0) || a.y - b.y || a.x - b.x)[0] as Point;
  const patrol = [startTile, patrolEnd];

  return {
    seed,
    tiles,
    entrance,
    exit,
    player: { ...entrance },
    presence: { ...startTile },
    patrol,
    patrolIndex: 1,
    hiding,
    fragments,
    catches: 0,
    turn: 0,
    status: "PLAYING",
    event: { kind: "NONE" },
  };
}

/** True when every fragment and then the exit can be reached from the entrance. This is the solvability check. */
export function canComplete(state: GameState): boolean {
  const reach = distances(state.tiles, state.entrance);
  if (!reach.has(KEY(state.exit))) return false;
  return state.fragments.every((fragment) => reach.has(KEY(fragment.at)));
}

export function isHidden(state: GameState): boolean {
  return state.hiding.some((p) => SAME(p, state.player));
}

export function remainingFragments(state: GameState): number {
  return state.fragments.filter((fragment) => !fragment.collected).length;
}

/** The presence acts this turn. Full speed until SLOW_AFTER_CATCHES, then every second turn, then never. */
export function presenceActs(state: Pick<GameState, "catches" | "turn">): boolean {
  if (state.catches >= DORMANT_AFTER_CATCHES) return false;
  if (state.catches >= SLOW_AFTER_CATCHES) return state.turn % 2 === 0;
  return true;
}

/** Shortest-path next step from a toward b, or a itself when there is none. Ties break in a fixed direction order. */
function stepToward(tiles: Tile[][], from: Point, to: Point): Point {
  if (SAME(from, to)) return from;
  const fromTarget = distances(tiles, to);
  let best = from;
  let bestDistance = fromTarget.get(KEY(from)) ?? Number.POSITIVE_INFINITY;
  for (const direction of DIRECTIONS) {
    const delta = DELTA[direction];
    const next = { x: from.x + delta.x, y: from.y + delta.y };
    const d = fromTarget.get(KEY(next));
    if (d !== undefined && d < bestDistance) {
      best = next;
      bestDistance = d;
    }
  }
  return best;
}

export function proximity(state: GameState): "far" | "near" | "very near" {
  const d = distances(state.tiles, state.player).get(KEY(state.presence)) ?? Number.POSITIVE_INFINITY;
  if (d <= 2) return "very near";
  if (d <= 5) return "near";
  return "far";
}

/** Apply one player action, then one presence move. Returns the same state when the game is over. */
export function step(state: GameState, action: Action): GameState {
  if (state.status !== "PLAYING") return state;

  let player = state.player;
  let event: GameEvent = { kind: "NONE" };
  if (action !== "WAIT") {
    const delta = DELTA[action];
    const target = { x: player.x + delta.x, y: player.y + delta.y };
    if (isFloor(state.tiles, target)) {
      player = target;
      event = { kind: "MOVED" };
    } else {
      event = { kind: "BLOCKED" };
    }
  }

  const fragments = state.fragments.map((fragment) => ({ ...fragment }));
  const here = fragments.find((fragment) => !fragment.collected && SAME(fragment.at, player));
  if (here) {
    here.collected = true;
    event = { kind: "COLLECTED", index: here.index };
  }

  const turn = state.turn + 1;
  let status: GameState["status"] = state.status;
  const remaining = fragments.filter((fragment) => !fragment.collected).length;
  if (SAME(player, state.exit)) {
    if (remaining === 0) {
      status = "ESCAPED";
      event = { kind: "ESCAPED" };
    } else if (event.kind === "MOVED" || event.kind === "BLOCKED") {
      event = { kind: "EXIT_SEALED", remaining };
    }
  }
  if (status === "ESCAPED") {
    return { ...state, player, fragments, turn, status, event };
  }

  // The presence moves after the player.
  let presence = state.presence;
  let patrolIndex = state.patrolIndex;
  const hidden = state.hiding.some((p) => SAME(p, player));
  const acting = presenceActs({ catches: state.catches, turn });
  if (acting) {
    const distance = distances(state.tiles, presence).get(KEY(player)) ?? Number.POSITIVE_INFINITY;
    if (!hidden && distance <= CHASE_DISTANCE) {
      presence = stepToward(state.tiles, presence, player);
    } else {
      const goal = state.patrol[patrolIndex % state.patrol.length] as Point;
      if (SAME(presence, goal)) {
        patrolIndex = (patrolIndex + 1) % state.patrol.length;
      } else {
        presence = stepToward(state.tiles, presence, goal);
      }
    }
    // The presence never enters a hiding alcove.
    if (state.hiding.some((p) => SAME(p, presence)) && !SAME(presence, player)) presence = state.presence;
  }

  let catches = state.catches;
  if (SAME(presence, player) && !hidden && state.catches < DORMANT_AFTER_CATCHES) {
    catches += 1;
    return {
      ...state,
      player: { ...state.entrance },
      presence: { ...state.patrol[0] } as Point,
      patrolIndex: 1,
      fragments,
      catches,
      turn,
      status,
      event: { kind: "CAUGHT", catches },
    };
  }

  return { ...state, player, presence, patrolIndex, fragments, catches, turn, status, event };
}

/** Shortest action list from the player to a target over floor tiles. Used by the solver test. */
export function pathActions(tiles: Tile[][], from: Point, to: Point): Action[] | null {
  const queue: Point[] = [from];
  const previous = new Map<string, { from: Point; action: Direction }>();
  const seen = new Set<string>([KEY(from)]);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as Point;
    if (SAME(current, to)) {
      const actions: Action[] = [];
      let cursor = current;
      while (!SAME(cursor, from)) {
        const link = previous.get(KEY(cursor)) as { from: Point; action: Direction };
        actions.unshift(link.action);
        cursor = link.from;
      }
      return actions;
    }
    for (const direction of DIRECTIONS) {
      const delta = DELTA[direction];
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (isFloor(tiles, next) && !seen.has(KEY(next))) {
        seen.add(KEY(next));
        previous.set(KEY(next), { from: current, action: direction });
        queue.push(next);
      }
    }
  }
  return null;
}

/** Tiles within the lantern radius of the player (Chebyshev distance). Used for the lit area. */
export function isLit(state: GameState, p: Point): boolean {
  return Math.max(Math.abs(p.x - state.player.x), Math.abs(p.y - state.player.y)) <= LANTERN_RADIUS;
}

export { KEY as pointKey, SAME as samePoint };
