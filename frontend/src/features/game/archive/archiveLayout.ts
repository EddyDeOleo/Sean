/**
 * Where the archive decoration stands. Pure tile geometry with no three.js, so the placement rules can be tested without WebGL.
 *
 * Rules:
 * - Nothing stands on a reserved tile: the player start and its eight neighbours, the monster start, the exit, the gate and its
 *   four neighbours, clue spots, hiding places and patrol points.
 * - Every item's footprint lies inside its own tile, so it never reaches into a tile the player walks through.
 * - Wall-mounted items stand flush against one wall, on tiles with three open sides (room edges and junctions). Free-standing
 *   props also stand against a wall, in a corner or at a room edge, so the middle of a room and every corridor stays clear.
 * - A tile holds at most one floor item: a tile with room furniture (planFurniture) takes no archive wall item or prop.
 * - Floor-standing items that a person would walk into (cabinets, shelving, bookshelves, lockers, carts, bins, crates) are
 *   solid: movement stops at their footprint (overlapsSolid). They stand no deeper than SOLID_MAX_DEPTH from their wall, so the
 *   line through the tile centres, which the creature walks and corridors need, stays open. Doors, vents, baseboards and wall
 *   terminals are flush with the wall and do not block.
 * - A solid item never stands on a corridor, doorway or dead-end tile, and keeps MOUTH_CLEARANCE free at an open end of its
 *   wall (fitAlongWall). It moves along its wall to do so; one that does not fit moves to the next tile along the same wall,
 *   and a bookshelf may be the narrow one. Decoration is moved, not dropped, wherever a valid place exists.
 * - Ceiling items sit against the ceiling. They do not touch the floor, so they never block movement.
 */

import { hash } from "../flicker";
import { tileAt, type Level, type Point } from "../level";

/** The ceiling height. It matches WALL_HEIGHT in renderer.ts; the renderer does not export it, so keep the two in step. */
export const ARCHIVE_CEILING = 1.15;

export type ArchiveKind =
  | "filingCabinet"
  | "shelvingUnit"
  | "institutionalDoor"
  | "wallVent"
  | "baseboard"
  | "documentCart"
  | "wasteBin"
  | "crateStack"
  | "acousticPanel"
  | "fluorescentFixture"
  | "ceilingVent";

/** A footprint on the floor plane. `minY`/`maxY` are the tile row axis, which is world z. */
export interface Rect {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * One decoration. `origin` is the floor point the item's local frame starts from: the wall face for wall items, the tile
 * centre for ceiling items. Local +w points into the room; `yaw` rotates the frame about the vertical axis.
 */
export interface ArchiveItem {
  kind: ArchiveKind;
  tileX: number;
  tileY: number;
  origin: Point;
  yaw: number;
  footprint: Rect;
}

/** Local extents of an item, measured from its origin along the wall (u) and into the room (w). */
interface LocalRect {
  u0: number;
  u1: number;
  w0: number;
  w1: number;
}

const SIDES: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * The deepest a solid item may stand out from its wall, in tiles. Movement keeps a square of half-width PLAYER_RADIUS (0.28,
 * world.ts) clear of walls, so a walker on the line through the tile centres reaches 0.22 from the wall. Items no deeper than
 * this never block that line: the creature, which walks from tile centre to tile centre, never meets them, and a player who
 * keeps to the middle of a corridor or room edge passes them. A player who walks along the wall is stopped by them.
 */
export const SOLID_MAX_DEPTH = 0.21;

const WALL_RECT: Record<"filingCabinet" | "shelvingUnit" | "institutionalDoor" | "wallVent" | "documentCart", LocalRect> = {
  filingCabinet: { u0: -0.25, u1: 0.25, w0: 0.01, w1: SOLID_MAX_DEPTH },
  shelvingUnit: { u0: -0.45, u1: 0.45, w0: 0.01, w1: SOLID_MAX_DEPTH },
  institutionalDoor: { u0: -0.48, u1: 0.48, w0: 0.01, w1: 0.09 },
  wallVent: { u0: -0.2, u1: 0.2, w0: 0.01, w1: 0.04 },
  documentCart: { u0: -0.25, u1: 0.25, w0: 0.01, w1: SOLID_MAX_DEPTH },
};
const BASEBOARD_RECT: LocalRect = { u0: -0.5, u1: 0.5, w0: 0.005, w1: 0.03 };
const BIN_RECT: LocalRect = { u0: -0.42, u1: -0.22, w0: 0.01, w1: SOLID_MAX_DEPTH };
const CRATE_RECT: LocalRect = { u0: -0.2, u1: 0.2, w0: 0.01, w1: SOLID_MAX_DEPTH };
const PANEL_RECT: LocalRect = { u0: -0.45, u1: 0.45, w0: -0.45, w1: 0.45 };
const VENT_RECT: LocalRect = { u0: -0.18, u1: 0.18, w0: -0.18, w1: 0.18 };
const FIXTURE_RECT: LocalRect = { u0: -0.4, u1: 0.4, w0: -0.1, w1: 0.1 };

const tileKey = (x: number, y: number): string => `${x},${y}`;

/** Tiles where no decoration may stand (Workstream D rule; see the module comment). */
export function reservedTiles(level: Level): Set<string> {
  const reserved = new Set<string>();
  const add = (p: Point): void => {
    reserved.add(tileKey(Math.floor(p.x), Math.floor(p.y)));
  };
  const start = { x: Math.floor(level.playerStart.x), y: Math.floor(level.playerStart.y) };
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) reserved.add(tileKey(start.x + dx, start.y + dy));
  }
  add(level.monsterStart);
  add(level.exit);
  add(level.gate);
  for (const [dx, dy] of SIDES) add({ x: level.gate.x + dx, y: level.gate.y + dy });
  level.clueSpots.forEach(add);
  level.hideSpots.forEach(add);
  level.patrol.forEach(add);
  return reserved;
}

/** The sides of a tile that touch a wall, in the order of SIDES. */
function wallSides(level: Level, x: number, y: number): (readonly [number, number])[] {
  return SIDES.filter(([dx, dy]) => tileAt(level, x + 0.5 + dx, y + 0.5 + dy) === "WALL");
}

/** How many neighbouring tiles are open floor. A closed gate counts as a wall. */
function openSideCount(level: Level, x: number, y: number): number {
  return SIDES.filter(([dx, dy]) => {
    const tile = tileAt(level, x + 0.5 + dx, y + 0.5 + dy);
    return tile === "FLOOR" || tile === "EXIT";
  }).length;
}

/** The footprint of a local rectangle placed at `origin` and turned by `yaw`. Local X is (cos, -sin); local Z is (sin, cos). */
export function footprintOf(origin: Point, yaw: number, rect: LocalRect): Rect {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const u of [rect.u0, rect.u1]) {
    for (const w of [rect.w0, rect.w1]) {
      xs.push(origin.x + u * cos + w * sin);
      ys.push(origin.y - u * sin + w * cos);
    }
  }
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** The turn of an item against the wall on `side`: local +w is (sin yaw, cos yaw) in (x, z) and points away from the wall. */
const wallYaw = ([dx, dy]: readonly [number, number]): number => Math.atan2(-dx, -dy);

/**
 * The frame of an item standing against the wall on `side` of tile (x, y), moved `shift` tiles along the wall (local u). The
 * origin moves with the shift, so the footprint and every mesh placed from the origin move together.
 */
function wallPlacement(x: number, y: number, side: readonly [number, number], rect: LocalRect, shift = 0): { origin: Point; yaw: number; footprint: Rect } {
  const [dx, dy] = side;
  const yaw = wallYaw(side);
  // Local u is (cos yaw, -sin yaw) in (x, z).
  const origin = { x: x + 0.5 + 0.5 * dx + shift * Math.cos(yaw), y: y + 0.5 + 0.5 * dy - shift * Math.sin(yaw) };
  return { origin, yaw, footprint: footprintOf(origin, yaw, rect) };
}

/** An archive item standing against the wall on `side` of its tile. */
function againstWall(kind: ArchiveKind, x: number, y: number, side: readonly [number, number], rect: LocalRect, shift = 0): ArchiveItem {
  return { kind, tileX: x, tileY: y, ...wallPlacement(x, y, side, rect, shift) };
}

/** An item at the tile centre, turned by `yaw`. Used for ceiling items. */
function atCentre(kind: ArchiveKind, x: number, y: number, yaw: number, rect: LocalRect): ArchiveItem {
  const origin = { x: x + 0.5, y: y + 0.5 };
  return { kind, tileX: x, tileY: y, origin, yaw, footprint: footprintOf(origin, yaw, rect) };
}

/** Which wall-mounted item a room-edge tile gets. Most edge tiles get none. */
function wallKind(roll: number): "filingCabinet" | "shelvingUnit" | "institutionalDoor" | "wallVent" | null {
  if (roll < 0.2) return "filingCabinet";
  if (roll < 0.34) return "shelvingUnit";
  if (roll < 0.42) return "institutionalDoor";
  if (roll < 0.5) return "wallVent";
  return null;
}

/**
 * Clear floor, in tiles, kept between a solid item's end and an open end of its wall (a doorway, a corridor mouth, or the end
 * of the wall). A walker rounding that corner reaches PLAYER_RADIUS (0.28, world.ts) past it, so it never meets the item.
 */
const MOUTH_CLEARANCE = 0.3;
/** How far along its tile's wall a solid item may reach from the tile centre, so items on neighbouring tiles stay 0.05 apart. */
const WALL_RUN = 0.475;

/** A corridor or doorway tile (walls on two opposite sides) or a dead end. A room corner is not one. */
function passage(level: Level, x: number, y: number): boolean {
  const walls = wallSides(level, x, y);
  return walls.length >= 3 || (walls.length === 2 && !isCorner(walls));
}

/**
 * Where a solid item fits on tile (x, y) against the wall on `side`: the shift along the wall (local u) nearest to the tile
 * centre that keeps MOUTH_CLEARANCE free at each open end of the wall, or null when it does not fit. Corridor, doorway and
 * dead-end tiles take no solid item. An end is open where the floor goes on beside the item and either the wall stops there
 * or that floor is a corridor or doorway tile. Walkers cut those corners; an item at one used to stop them (cycle D4).
 */
function fitAlongWall(level: Level, x: number, y: number, side: readonly [number, number], rect: LocalRect): number | null {
  if (passage(level, x, y)) return null;
  const floor = (tx: number, ty: number) => tileAt(level, tx + 0.5, ty + 0.5) !== "WALL";
  const yaw = wallYaw(side);
  const ux = Math.round(Math.cos(yaw));
  const uy = Math.round(-Math.sin(yaw));
  const open = (dir: number): boolean => {
    const lx = x + dir * ux;
    const ly = y + dir * uy;
    return floor(lx, ly) && (floor(lx + side[0], ly + side[1]) || passage(level, lx, ly));
  };
  // At an open end no item can stand on the next tile along this wall, so the clearance is measured from the tile edge.
  const lo = open(-1) ? -0.5 + MOUTH_CLEARANCE : -WALL_RUN;
  const hi = open(1) ? 0.5 - MOUTH_CLEARANCE : WALL_RUN;
  let shift = 0;
  if (rect.u0 + shift < lo) shift = lo - rect.u0;
  if (rect.u1 + shift > hi) shift = hi - rect.u1;
  return rect.u0 + shift >= lo - 1e-9 ? shift : null;
}

/** Whether a tile's two walls meet in a corner. Two walls on opposite sides make a corridor, which stays clear. */
function isCorner(sides: readonly (readonly [number, number])[]): boolean {
  return sides.length === 2 && sides[0]![0] + sides[1]![0] !== 0 && sides[0]![1] + sides[1]![1] !== 0;
}

/** Which prop a free wall-side tile gets. */
function propKind(roll: number): "documentCart" | "wasteBin" | "crateStack" | null {
  if (roll < 0.08) return "documentCart";
  if (roll < 0.12) return "wasteBin";
  if (roll < 0.2) return "crateStack";
  return null;
}

/** The renderer's room furniture: bookshelves, storage lockers and wall terminals (renderer.ts buildFurniture). */
export type FurnitureKind = "bookshelf" | "storageLocker" | "terminal";

export interface FurnitureItem {
  kind: FurnitureKind;
  tileX: number;
  tileY: number;
  /** The wall face the item stands against, and the turn that points local +w into the room. As for ArchiveItem. */
  origin: Point;
  yaw: number;
  footprint: Rect;
  /** The item's length along its wall. The renderer sizes the meshes from it, so they match the footprint. */
  span: number;
}

/** The highest tile roll, hash(x, y), that takes room furniture. */
const FURNITURE_ROLL = 0.22;
const BOOKSHELF_RECT: LocalRect = { u0: -0.45, u1: 0.45, w0: 0.01, w1: SOLID_MAX_DEPTH };
/** A narrower bookshelf, for a wall too short for the full one once the clearance at a doorway or wall end is kept. */
const NARROW_BOOKSHELF_RECT: LocalRect = { u0: -0.3, u1: 0.3, w0: 0.01, w1: SOLID_MAX_DEPTH };
const STORAGE_LOCKER_RECT: LocalRect = { u0: -0.25, u1: 0.25, w0: 0, w1: 0.2 };
const TERMINAL_RECT: LocalRect = { u0: -0.17, u1: 0.17, w0: 0, w1: 0.01 };

/**
 * Where the room furniture stands: about one room-edge tile in five (open floor on three sides), against its first wall, never
 * on the player start, the monster start, the exit or a clue spot. Deterministic, from `hash` on the tile.
 */
export function planFurniture(level: Level): FurnitureItem[] {
  const reserved = new Set([level.playerStart, level.monsterStart, level.exit, ...level.clueSpots].map((p) => tileKey(Math.floor(p.x), Math.floor(p.y))));
  const items: FurnitureItem[] = [];
  for (let y = 1; y < level.height - 1; y += 1) {
    for (let x = 1; x < level.width - 1; x += 1) {
      if (tileAt(level, x + 0.5, y + 0.5) !== "FLOOR" || reserved.has(tileKey(x, y))) continue;
      const roll = hash(x, y);
      if (roll > FURNITURE_ROLL) continue;
      const side = SIDES.find(([dx, dy]) => tileAt(level, x + 0.5 + dx, y + 0.5 + dy) === "WALL");
      const open = SIDES.filter(([dx, dy]) => tileAt(level, x + 0.5 + dx, y + 0.5 + dy) === "FLOOR").length;
      if (!side || open < 3) continue;
      const kind: FurnitureKind = roll < 0.12 ? "bookshelf" : roll < 0.18 ? "storageLocker" : "terminal";
      // A terminal is flush with the wall and may stand anywhere. Bookshelves and lockers are solid: they move along the wall
      // to keep a doorway or wall end clear, and a bookshelf that still does not fit is the narrow one.
      const rects = kind === "bookshelf" ? [BOOKSHELF_RECT, NARROW_BOOKSHELF_RECT] : [kind === "storageLocker" ? STORAGE_LOCKER_RECT : TERMINAL_RECT];
      for (const rect of rects) {
        const shift = SOLID_KINDS.has(kind) ? fitAlongWall(level, x, y, side, rect) : 0;
        if (shift === null) continue;
        items.push({ kind, tileX: x, tileY: y, ...wallPlacement(x, y, side, rect, shift), span: rect.u1 - rect.u0 });
        break;
      }
    }
  }
  return items;
}

/** Floor-standing decoration that blocks movement. Doors, vents, baseboards, terminals and ceiling items do not. */
const SOLID_KINDS: ReadonlySet<ArchiveKind | FurnitureKind> = new Set<ArchiveKind | FurnitureKind>([
  "filingCabinet", "shelvingUnit", "documentCart", "wasteBin", "crateStack", "bookshelf", "storageLocker",
]);

/** A solid footprint, and whether the wall it stands against runs along x. A move along the wall meets one of its ends. */
export interface SolidRect extends Rect {
  alongX: boolean;
}

const solidCache = new WeakMap<Level, SolidRect[]>();

/**
 * Whether a square of half-width `half` centred on (x, y) overlaps a solid item. The same square moveCircle (world.ts) tests
 * against walls, so furniture and walls stop a walker at the same distance. Touching an edge is not an overlap.
 */
export function overlapsSolid(level: Level, x: number, y: number, half: number): boolean {
  return solidAt(level, x, y, half) !== null;
}

/** The first solid footprint that a square of half-width `half` centred on (x, y) overlaps, or null. */
export function solidAt(level: Level, x: number, y: number, half: number): SolidRect | null {
  return solidFootprints(level).find((f) => x + half > f.minX && x - half < f.maxX && y + half > f.minY && y - half < f.maxY) ?? null;
}

/** The footprints of every solid decoration and furniture item of a level. Computed once per level. */
export function solidFootprints(level: Level): SolidRect[] {
  let rects = solidCache.get(level);
  if (!rects) {
    // Local u, the direction along the wall, is (cos yaw, -sin yaw).
    rects = [...planArchive(level), ...planFurniture(level)]
      .filter((item) => SOLID_KINDS.has(item.kind))
      .map((item) => ({ ...item.footprint, alongX: Math.abs(Math.cos(item.yaw)) > 0.5 }));
    solidCache.set(level, rects);
  }
  return rects;
}

/**
 * The full archive plan for a level, in reading order. Deterministic: the same level always gives the same items, because
 * every choice comes from `hash` on tile coordinates.
 */
export function planArchive(level: Level): ArchiveItem[] {
  const reserved = reservedTiles(level);
  const furnished = new Set(planFurniture(level).map((item) => tileKey(item.tileX, item.tileY)));
  const free = (x: number, y: number): boolean => tileAt(level, x + 0.5, y + 0.5) === "FLOOR" && !reserved.has(tileKey(x, y));
  // Props stand against a wall: in a corner, or at a room edge (three open sides). Never in open floor or a corridor.
  const takesProp = (x: number, y: number): boolean => {
    const sides = wallSides(level, x, y);
    return sides.length >= 1 && (isCorner(sides) || openSideCount(level, x, y) >= 3);
  };
  // A wall-mounted item stands on a room-edge tile: one wall, three open sides.
  const takesWallItem = (x: number, y: number): boolean => wallSides(level, x, y).length === 1 && openSideCount(level, x, y) >= 3;
  const fit = (kind: ArchiveKind, x: number, y: number, side: readonly [number, number], rect: LocalRect): ArchiveItem | null => {
    const shift = SOLID_KINDS.has(kind) ? fitAlongWall(level, x, y, side, rect) : 0;
    return shift === null ? null : againstWall(kind, x, y, side, rect, shift);
  };

  // One floor item per tile, and none on a tile that holds room furniture: a cabinet in front of a bookshelf merged the two
  // into one object. A solid item that does not fit on its tile (fitAlongWall) moves to the next tile along the same wall.
  const floorItems = new Map<string, ArchiveItem>();
  const moved: { kind: ArchiveKind; rect: LocalRect; x: number; y: number; side: readonly [number, number]; prop: boolean }[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (!free(x, y) || furnished.has(tileKey(x, y))) continue;
      const side = wallSides(level, x, y)[0];
      if (!side) continue;
      if (takesProp(x, y)) {
        const kind = propKind(hash(x + 11, y + 7));
        if (kind) {
          const rect = kind === "documentCart" ? WALL_RECT.documentCart : kind === "wasteBin" ? BIN_RECT : CRATE_RECT;
          const item = fit(kind, x, y, side, rect);
          if (item) {
            floorItems.set(tileKey(x, y), item);
            continue;
          }
          moved.push({ kind, rect, x, y, side, prop: true });
        }
      }
      if (takesWallItem(x, y)) {
        // Rolled on an offset tile, not hash(x, y): planFurniture rolls hash(x, y) on the same tiles.
        const kind = wallKind(hash(x + 5, y + 3));
        if (kind) {
          const item = fit(kind, x, y, side, WALL_RECT[kind]);
          if (item) floorItems.set(tileKey(x, y), item);
          else moved.push({ kind, rect: WALL_RECT[kind], x, y, side, prop: false });
        }
      }
    }
  }
  for (const m of moved) {
    const yaw = wallYaw(m.side);
    for (const dir of [-1, 1]) {
      const nx = m.x + dir * Math.round(Math.cos(yaw));
      const ny = m.y + dir * Math.round(-Math.sin(yaw));
      if (!free(nx, ny) || furnished.has(tileKey(nx, ny)) || floorItems.has(tileKey(nx, ny))) continue;
      if (tileAt(level, nx + 0.5 + m.side[0], ny + 0.5 + m.side[1]) !== "WALL" || !(m.prop ? takesProp(nx, ny) : takesWallItem(nx, ny))) continue;
      const item = fit(m.kind, nx, ny, m.side, m.rect);
      if (item) {
        floorItems.set(tileKey(nx, ny), item);
        break;
      }
    }
  }

  const items: ArchiveItem[] = [];
  for (let y = 0; y < level.height; y += 1) {
    for (let x = 0; x < level.width; x += 1) {
      if (!free(x, y)) continue;
      // Ceiling: one fluorescent fixture on a sparse grid, acoustic panels between them, and a few vent grilles among the panels.
      if (x % 3 === 1 && y % 3 === 1) {
        items.push(atCentre("fluorescentFixture", x, y, (x + y) % 2 === 0 ? 0 : Math.PI / 2, FIXTURE_RECT));
      } else if ((x + y) % 2 === 0) {
        items.push((x + 2 * y) % 7 === 0 ? atCentre("ceilingVent", x, y, 0, VENT_RECT) : atCentre("acousticPanel", x, y, 0, PANEL_RECT));
      }
      // A tile with a floor item or room furniture gets no baseboard.
      const item = floorItems.get(tileKey(x, y));
      if (item) items.push(item);
      else if (!furnished.has(tileKey(x, y))) {
        for (const side of wallSides(level, x, y)) items.push(againstWall("baseboard", x, y, side, BASEBOARD_RECT));
      }
    }
  }
  return items;
}
