/**
 * The level (Spec 4 section 11; Requirement 7).
 *
 * One hand-authored underground archive: rooms with shelves, corridors, a locked exit door. The map is plain text so it can
 * be read, reviewed and tested. One character is one tile; the game logic uses tile units, the renderer scales them.
 *
 *   #  wall          .  floor        P  player start     M  monster start
 *   C  clue spot     D  exit gate (a wall until the exit opens)   E  exit
 */

export const LEVEL_MAP: readonly string[] = [
  "#########################",
  "#P..#.....#.......#.....#",
  "#...#.C...#...C...#..C..#",
  "#...#.....#.......#.....#",
  "#...##.####.#####.##.####",
  "#.......................#",
  "#.####.###.....###.####.#",
  "#.#C...#.........#...#..#",
  "#.#....#....M....#...#..#",
  "#.#....#.........#...#C.#",
  "#.##.###.........##.###.#",
  "#.......................#",
  "###.#####.#####.#########",
  "#.C.#C....#.....#.......#",
  "#...#.....#..C..D.......#",
  "#...#.....#.....#.....E.#",
  "#########################",
];

export interface Point {
  x: number;
  y: number;
}

export type Tile = "WALL" | "FLOOR" | "GATE" | "EXIT";

export interface Level {
  width: number;
  height: number;
  tiles: Tile[];
  playerStart: Point;
  monsterStart: Point;
  /** Candidate clue positions in reading order. */
  clueSpots: Point[];
  gate: Point;
  exit: Point;
}

/** The centre of a tile. */
export const centre = (x: number, y: number): Point => ({ x: x + 0.5, y: y + 0.5 });

export function parseLevel(rows: readonly string[]): Level {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height < 3 || width < 3) throw new Error("level too small");
  const tiles: Tile[] = [];
  let playerStart: Point | null = null;
  let monsterStart: Point | null = null;
  let gate: Point | null = null;
  let exit: Point | null = null;
  const clueSpots: Point[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`row ${y} has width ${row.length}, expected ${width}`);
    [...row].forEach((ch, x) => {
      let tile: Tile = "FLOOR";
      if (ch === "#") tile = "WALL";
      else if (ch === "D") {
        tile = "GATE";
        gate = centre(x, y);
      } else if (ch === "E") {
        tile = "EXIT";
        exit = centre(x, y);
      } else if (ch === "P") playerStart = centre(x, y);
      else if (ch === "M") monsterStart = centre(x, y);
      else if (ch === "C") clueSpots.push(centre(x, y));
      else if (ch !== ".") throw new Error(`unknown character '${ch}' at ${x},${y}`);
      tiles.push(tile);
    });
  });
  if (!playerStart || !monsterStart || !gate || !exit) throw new Error("level needs P, M, D and E");
  return { width, height, tiles, playerStart, monsterStart, clueSpots, gate, exit };
}

export const LEVEL: Level = parseLevel(LEVEL_MAP);

export function tileAt(level: Level, x: number, y: number): Tile {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return "WALL";
  return level.tiles[ty * level.width + tx]!;
}

/** Whether a tile blocks movement and sight. The gate blocks until it is opened. */
export function isBlocked(level: Level, x: number, y: number, gateOpen: boolean): boolean {
  const tile = tileAt(level, x, y);
  return tile === "WALL" || (tile === "GATE" && !gateOpen);
}

/** Breadth-first search over tiles. Returns the tile path from `from` to `to` (inclusive), or null when unreachable. */
export function findPath(level: Level, from: Point, to: Point, gateOpen: boolean): Point[] | null {
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  if (isBlocked(level, goal.x, goal.y, gateOpen)) return null;
  const index = (p: Point): number => p.y * level.width + p.x;
  const previous = new Map<number, number>();
  const queue: Point[] = [start];
  previous.set(index(start), -1);
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;
    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      for (let i = index(current); i !== -1; i = previous.get(i)!) path.push({ x: i % level.width, y: Math.floor(i / level.width) });
      return path.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (isBlocked(level, next.x, next.y, gateOpen) || previous.has(index(next))) continue;
      previous.set(index(next), index(current));
      queue.push(next);
    }
  }
  return null;
}

/** Straight-line visibility between two points, sampled every tenth of a tile. */
export function hasLineOfSight(level: Level, a: Point, b: Point, gateOpen: boolean): boolean {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(distance * 10));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlocked(level, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, gateOpen)) return false;
  }
  return true;
}
