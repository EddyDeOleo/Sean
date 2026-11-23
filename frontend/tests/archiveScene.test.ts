import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SOLID_MAX_DEPTH, overlapsSolid, planArchive, planFurniture, solidFootprints, type Rect } from "../src/features/game/archive/archiveLayout";
import { FURNITURE_SLIDE, PLAYER_RADIUS, moveCircle } from "../src/features/game/world";
import {
  ARCHIVE_LIGHTING,
  ARCHIVE_PALETTE,
  buildArchiveDecor,
  type ArchiveDecor,
  type ArchiveStats,
} from "../src/features/game/archive/archiveScene";
import { LEVEL, parseLevel, tileAt, type Level, type Point } from "../src/features/game/level";

/** A small level with every glyph: start, monster, clues, hiding places, patrol points, a gate and an exit. */
const SMALL_MAP = [
  "###################",
  "#P....#.....#.....#",
  "#.C...#..H..#...C.#",
  "#.....#.....#.....#",
  "#...##.###.#####..#",
  "#........D........#",
  "#.#..#...#.#...#..#",
  "#.#.M....#.....H.E#",
  "#.#...#.....#.C...#",
  "#........#.....#..#",
  "###################",
];
const SMALL_PATROL: Point[] = [
  { x: 2.5, y: 1.5 },
  { x: 9.5, y: 1.5 },
  { x: 9.5, y: 4.5 },
  { x: 14.5, y: 7.5 },
];

const CLASSES: (keyof ArchiveStats)[] = [
  "filingCabinets",
  "shelvingUnits",
  "archiveBoxes",
  "labels",
  "acousticPanels",
  "fluorescentFixtures",
  "ceilingVents",
  "wallVents",
  "baseboards",
  "institutionalDoors",
  "documentCarts",
  "wasteBins",
  "crateStacks",
];

/** Workstream D reserved tiles, written out from the rule rather than reused from the layout code. */
function reservedByRule(level: Level): Set<string> {
  const key = (x: number, y: number) => `${x},${y}`;
  const reserved = new Set<string>();
  const start = { x: Math.floor(level.playerStart.x), y: Math.floor(level.playerStart.y) };
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) reserved.add(key(start.x + dx, start.y + dy));
  const points = [level.monsterStart, level.exit, level.gate, ...level.clueSpots, ...level.hideSpots, ...level.patrol];
  for (const p of points) reserved.add(key(Math.floor(p.x), Math.floor(p.y)));
  return reserved;
}

/** A canvas 2D context stub. jsdom has no real canvas, and the decoration only paints textures. */
function fakeContext(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    beginPath: noop,
    arc: noop,
    fill: noop,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
    textBaseline: "alphabetic",
  } as unknown as CanvasRenderingContext2D;
}

interface Instance {
  mesh: THREE.InstancedMesh;
  position: THREE.Vector3;
}

/** Every instance the decoration added to the scene, with its world position. */
function instancesOf(scene: THREE.Scene): Instance[] {
  const group = scene.getObjectByName("archive-decor") as THREE.Group;
  const out: Instance[] = [];
  const matrix = new THREE.Matrix4();
  for (const child of group.children) {
    const mesh = child as THREE.InstancedMesh;
    for (let i = 0; i < mesh.count; i += 1) {
      mesh.getMatrixAt(i, matrix);
      out.push({ mesh, position: new THREE.Vector3().setFromMatrixPosition(matrix) });
    }
  }
  return out;
}

function build(level: Level): { scene: THREE.Scene; decor: ArchiveDecor } {
  const scene = new THREE.Scene();
  const decor = buildArchiveDecor(scene, level, { textureSize: 128, quality: "medium" });
  return { scene, decor };
}

const SMALL = parseLevel(SMALL_MAP, SMALL_PATROL);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => fakeContext()) as unknown as HTMLCanvasElement["getContext"]);
});

describe("archive decoration on the small level", () => {
  it("adds a non-zero count for every element class", () => {
    const { decor } = build(SMALL);
    for (const name of CLASSES) expect(decor.stats[name], name).toBeGreaterThan(0);
    decor.dispose();
  });

  it("keeps every decoration off reserved tiles and off wall and gate tiles", () => {
    const { scene, decor } = build(SMALL);
    const reserved = reservedByRule(SMALL);
    const instances = instancesOf(scene);
    expect(instances.length).toBeGreaterThan(0);
    for (const { position } of instances) {
      const x = Math.floor(position.x);
      const y = Math.floor(position.z);
      expect(tileAt(SMALL, x + 0.5, y + 0.5), `tile ${x},${y}`).toBe("FLOOR");
      expect(reserved.has(`${x},${y}`), `reserved ${x},${y}`).toBe(false);
    }
    decor.dispose();
  });
});

describe("archive decoration on the game level", () => {
  it("adds a non-zero count for every element class", () => {
    const { decor } = build(LEVEL);
    for (const name of CLASSES) expect(decor.stats[name], name).toBeGreaterThan(0);
    decor.dispose();
  });

  it("keeps every decoration off reserved tiles and off wall and gate tiles", () => {
    const { scene, decor } = build(LEVEL);
    const reserved = reservedByRule(LEVEL);
    for (const { position } of instancesOf(scene)) {
      const x = Math.floor(position.x);
      const y = Math.floor(position.z);
      expect(tileAt(LEVEL, x + 0.5, y + 0.5), `tile ${x},${y}`).toBe("FLOOR");
      expect(reserved.has(`${x},${y}`), `reserved ${x},${y}`).toBe(false);
    }
    decor.dispose();
  });

  it("keeps every footprint inside its own tile, so nothing reaches a neighbouring walkable tile", () => {
    const eps = 1e-9;
    for (const item of planArchive(LEVEL)) {
      const { footprint, tileX, tileY } = item;
      expect(footprint.minX, item.kind).toBeGreaterThanOrEqual(tileX - eps);
      expect(footprint.maxX, item.kind).toBeLessThanOrEqual(tileX + 1 + eps);
      expect(footprint.minY, item.kind).toBeGreaterThanOrEqual(tileY - eps);
      expect(footprint.maxY, item.kind).toBeLessThanOrEqual(tileY + 1 + eps);
    }
  });

  it("stays within a modest draw-call and triangle budget", () => {
    const { decor } = build(LEVEL);
    expect(decor.stats.instancedMeshes).toBeLessThanOrEqual(40);
    expect(decor.stats.triangles).toBeLessThanOrEqual(150000);
    decor.dispose();
  });
});

/** Floor-standing items of the archive plan (doors are flush with the wall but stand on the floor too). */
const FLOOR_KINDS = new Set(["filingCabinet", "shelvingUnit", "documentCart", "wasteBin", "crateStack", "institutionalDoor"]);
/** The batches that draw solid archive items. Each of their instances must lie inside a solid footprint. */
const SOLID_BATCHES = /^(cabinet|shelf|archiveBox|label\d|cart|wasteBin|crateBox)/;
const gap = (a: Rect, b: Rect): number => Math.max(a.minX - b.maxX, b.minX - a.maxX, a.minY - b.maxY, b.minY - a.maxY);
const OPEN_SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe("archive furniture: one object per tile, solid where it stands, and every route open", () => {
  // Regression (cycle D4): the room furniture and the archive's wall items rolled the same hash on the same tiles, so every
  // bookshelf, locker and terminal had a filing cabinet standing inside or in front of it.
  it("never puts two floor items on one tile, and keeps every pair of floor items apart", () => {
    const items = [
      ...planArchive(LEVEL).filter((item) => FLOOR_KINDS.has(item.kind)),
      ...planFurniture(LEVEL),
    ];
    const tiles = items.map((item) => `${item.tileX},${item.tileY}`);
    expect(new Set(tiles).size, "tiles with two floor items").toBe(tiles.length);
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        expect(gap(items[i]!.footprint, items[j]!.footprint), `${items[i]!.kind} ${tiles[i]} and ${items[j]!.kind} ${tiles[j]}`).toBeGreaterThanOrEqual(0.05);
      }
    }
    for (const item of items) {
      const spot = LEVEL.hideSpots.some((p) => Math.floor(p.x) === item.tileX && Math.floor(p.y) === item.tileY);
      expect(spot, `${item.kind} on the hiding place ${tiles[items.indexOf(item)]}`).toBe(false);
    }
  });

  it("still places drawers, shelving and bookshelves", () => {
    const kinds = planArchive(LEVEL).map((item) => item.kind);
    expect(kinds.filter((k) => k === "filingCabinet").length).toBeGreaterThanOrEqual(4);
    expect(kinds.filter((k) => k === "shelvingUnit").length).toBeGreaterThanOrEqual(4);
    expect(planFurniture(LEVEL).filter((item) => item.kind === "bookshelf").length).toBeGreaterThanOrEqual(4);
  });

  it("puts no prop in a corridor tile (walls on two opposite sides)", () => {
    for (const item of planArchive(LEVEL)) {
      if (!["documentCart", "wasteBin", "crateStack"].includes(item.kind)) continue;
      const walls = OPEN_SIDES.filter(([dx, dy]) => tileAt(LEVEL, item.tileX + 0.5 + dx, item.tileY + 0.5 + dy) === "WALL");
      const corridor = walls.length === 2 && walls[0]![0] + walls[1]![0] === 0 && walls[0]![1] + walls[1]![1] === 0;
      expect(corridor, `${item.kind} at ${item.tileX},${item.tileY}`).toBe(false);
    }
  });

  it("keeps every solid item within SOLID_MAX_DEPTH of a wall, and its meshes inside its footprint", () => {
    const solids = solidFootprints(LEVEL);
    expect(solids.length).toBeGreaterThan(30);
    for (const f of solids) {
      // The footprint's tile centre stays at least 0.5 - SOLID_MAX_DEPTH from it: the item hugs its wall.
      const cx = Math.floor((f.minX + f.maxX) / 2) + 0.5;
      const cy = Math.floor((f.minY + f.maxY) / 2) + 0.5;
      const dx = Math.max(f.minX - cx, 0, cx - f.maxX);
      const dy = Math.max(f.minY - cy, 0, cy - f.maxY);
      expect(Math.hypot(dx, dy), `footprint at ${cx},${cy}`).toBeGreaterThanOrEqual(0.5 - SOLID_MAX_DEPTH - 1e-9);
    }
    const { scene, decor } = build(LEVEL);
    const group = scene.getObjectByName("archive-decor") as THREE.Group;
    const matrix = new THREE.Matrix4();
    for (const mesh of group.children as THREE.InstancedMesh[]) {
      mesh.geometry.computeBoundingBox();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        const box = mesh.geometry.boundingBox!.clone().applyMatrix4(matrix);
        // Every part, solid or not, stays inside the tile it stands on.
        const tx = Math.floor((box.min.x + box.max.x) / 2);
        const tz = Math.floor((box.min.z + box.max.z) / 2);
        expect(box.min.x >= tx - 0.005 && box.max.x <= tx + 1.005 && box.min.z >= tz - 0.005 && box.max.z <= tz + 1.005, `${mesh.name} ${i} leaves tile ${tx},${tz}`).toBe(true);
        if (!SOLID_BATCHES.test(mesh.name)) continue;
        const inside = solids.some((f) => box.min.x >= f.minX - 0.005 && box.max.x <= f.maxX + 0.005 && box.min.z >= f.minY - 0.005 && box.max.z <= f.maxY + 0.005);
        expect(inside, `${mesh.name} instance ${i} box x ${box.min.x.toFixed(3)}..${box.max.x.toFixed(3)} z ${box.min.z.toFixed(3)}..${box.max.z.toFixed(3)}`).toBe(true);
      }
    }
    decor.dispose();
  });

  it("stops a player who walks into the front of a solid item, at its face", () => {
    // The bookshelf at tile 3,3 stands against the east wall (x = 4) of the start room. Walk east into it along y = 3.5.
    const shelf = planFurniture(LEVEL).find((item) => item.tileX === 3 && item.tileY === 3)!;
    expect(shelf.kind).toBe("bookshelf");
    let p = { x: 1.5, y: 3.5 };
    for (let i = 0; i < 200; i += 1) p = moveCircle(LEVEL, p, 0.02, 0, PLAYER_RADIUS, false);
    expect(p.x + PLAYER_RADIUS).toBeLessThanOrEqual(shelf.footprint.minX + 1e-9);
    expect(p.x + PLAYER_RADIUS).toBeGreaterThan(shelf.footprint.minX - 0.03);
  });

  it("never lets a player who walks along a wall into the end of a solid item pass through it", () => {
    // The walker either stops or steps around the end (moveCircle), but no step enters the item or jumps past it.
    let checked = 0;
    for (const f of solidFootprints(LEVEL)) {
      // The item's wall is the side of its tile it touches; the walk runs along that wall, toward the item's side.
      const tx = Math.floor((f.minX + f.maxX) / 2);
      const ty = Math.floor((f.minY + f.maxY) / 2);
      const alongY = !f.alongX;
      for (const dir of [1, -1]) {
        const start = alongY
          ? { x: f.minX < tx + 0.5 ? tx + PLAYER_RADIUS : tx + 1 - PLAYER_RADIUS, y: dir > 0 ? f.minY - PLAYER_RADIUS - 0.3 : f.maxY + PLAYER_RADIUS + 0.3 }
          : { x: dir > 0 ? f.minX - PLAYER_RADIUS - 0.3 : f.maxX + PLAYER_RADIUS + 0.3, y: f.minY < ty + 0.5 ? ty + PLAYER_RADIUS : ty + 1 - PLAYER_RADIUS };
        if (overlapsSolid(LEVEL, start.x, start.y, PLAYER_RADIUS)) continue;
        // The start must be reachable floor: no wall inside the square.
        const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => tileAt(LEVEL, start.x + sx! * PLAYER_RADIUS * 0.999, start.y + sy! * PLAYER_RADIUS * 0.999));
        if (corners.some((t) => t === "WALL")) continue;
        let p = start;
        for (let i = 0; i < 60; i += 1) {
          const next = moveCircle(LEVEL, p, alongY ? 0 : dir * 0.02, alongY ? dir * 0.02 : 0, PLAYER_RADIUS, false);
          expect(overlapsSolid(LEVEL, next.x, next.y, PLAYER_RADIUS), `item at ${tx},${ty} from ${dir}`).toBe(false);
          expect(Math.max(Math.abs(next.x - p.x), Math.abs(next.y - p.y))).toBeLessThanOrEqual(0.02 + FURNITURE_SLIDE + 1e-9);
          p = next;
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  // Regression (Archive visual restoration): the cycle D4 placement rule dropped 20 decorations next to doorways, corridor
  // mouths and wall ends, among them three of the four waste bins and the bookshelves at the row-5 junction. They are moved
  // along their wall instead (fitAlongWall); 18 of the 20 are back on their own tiles.
  it("keeps the decoration that stands beside doorways and wall ends: bins, carts, crates, cabinets and junction bookshelves", () => {
    const kinds = [...planArchive(LEVEL), ...planFurniture(LEVEL)].map((item) => item.kind);
    const n = (kind: string) => kinds.filter((k) => k === kind).length;
    expect(n("wasteBin")).toBeGreaterThanOrEqual(4);
    expect(n("documentCart")).toBeGreaterThanOrEqual(6);
    expect(n("crateStack")).toBeGreaterThanOrEqual(4);
    expect(n("filingCabinet")).toBeGreaterThanOrEqual(16);
    expect(n("bookshelf")).toBeGreaterThanOrEqual(13);
    expect(n("storageLocker")).toBeGreaterThanOrEqual(8);
    expect(solidFootprints(LEVEL).length).toBeGreaterThanOrEqual(58);
    for (const [x, y] of [[1, 5], [2, 5], [3, 5]]) {
      expect(planFurniture(LEVEL).some((item) => item.kind === "bookshelf" && item.tileX === x && item.tileY === y), `bookshelf at ${x},${y}`).toBe(true);
    }
  });

  it("keeps clear floor at every open end of a solid item's wall, and no solid item on a corridor or doorway tile", () => {
    const floor = (x: number, y: number) => tileAt(LEVEL, x + 0.5, y + 0.5) !== "WALL";
    const walls = (x: number, y: number) => OPEN_SIDES.filter(([dx, dy]) => tileAt(LEVEL, x + 0.5 + dx, y + 0.5 + dy) === "WALL");
    const passage = (x: number, y: number) => {
      const w = walls(x, y);
      return w.length >= 3 || (w.length === 2 && w[0]![0] + w[1]![0] === 0 && w[0]![1] + w[1]![1] === 0);
    };
    let openEnds = 0;
    for (const f of solidFootprints(LEVEL)) {
      const tx = Math.floor((f.minX + f.maxX) / 2);
      const ty = Math.floor((f.minY + f.maxY) / 2);
      expect(passage(tx, ty), `solid item on the passage tile ${tx},${ty}`).toBe(false);
      // The wall the item touches, and the item's ends along it.
      const side: [number, number] = f.alongX ? [0, f.minY - ty < 0.05 ? -1 : 1] : [f.minX - tx < 0.05 ? -1 : 1, 0];
      expect(tileAt(LEVEL, tx + 0.5 + side[0], ty + 0.5 + side[1]), `the wall of the item at ${tx},${ty}`).toBe("WALL");
      for (const dir of [-1, 1]) {
        const lx = tx + (f.alongX ? dir : 0);
        const ly = ty + (f.alongX ? 0 : dir);
        if (!floor(lx, ly) || !(floor(lx + side[0], ly + side[1]) || passage(lx, ly))) continue;
        const clear = f.alongX ? (dir < 0 ? f.minX - tx : tx + 1 - f.maxX) : (dir < 0 ? f.minY - ty : ty + 1 - f.maxY);
        expect(clear, `clear floor beside the item at ${tx},${ty} toward ${lx},${ly}`).toBeGreaterThanOrEqual(0.3 - 1e-9);
        openEnds += 1;
      }
    }
    expect(openEnds, "items standing beside an open wall end").toBeGreaterThanOrEqual(15);
  });

  it("sizes each piece of room furniture by its footprint, so the renderer's meshes match the solid area", () => {
    for (const item of planFurniture(LEVEL)) {
      const alongX = Math.abs(Math.cos(item.yaw)) > 0.5;
      const length = alongX ? item.footprint.maxX - item.footprint.minX : item.footprint.maxY - item.footprint.minY;
      expect(item.span, `${item.kind} at ${item.tileX},${item.tileY}`).toBeCloseTo(length, 9);
    }
    const spans = new Set(planFurniture(LEVEL).filter((item) => item.kind === "bookshelf").map((item) => item.span.toFixed(2)));
    expect([...spans].sort()).toEqual(["0.60", "0.90"]);
  });

  it("steps a walker who follows the wall around a waste bin, which is square", () => {
    // Regression (Archive visual restoration): the end-face step chose by the footprint's longer side, so a walker following
    // the wall stopped dead at a square bin (the escape player stood 0.35 s at the bin at 8,11).
    const free = (x: number, y: number) =>
      !overlapsSolid(LEVEL, x, y, PLAYER_RADIUS) &&
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => tileAt(LEVEL, x + sx! * PLAYER_RADIUS * 0.999, y + sy! * PLAYER_RADIUS * 0.999) !== "WALL");
    const bin = planArchive(LEVEL).find((item) => item.kind === "wasteBin" && item.tileX === 8 && item.tileY === 11)!;
    expect(bin, "the waste bin at 8,11").toBeDefined();
    const f = bin.footprint;
    // It stands against the south wall (y = 12). Walk west along that wall, from east of the bin.
    const start = { x: f.maxX + PLAYER_RADIUS + 0.1, y: 12 - PLAYER_RADIUS - 1e-6 };
    expect(free(start.x, start.y)).toBe(true);
    let p = start;
    for (let i = 0; i < 60; i += 1) {
      p = moveCircle(LEVEL, p, -0.02, 0, PLAYER_RADIUS, false);
      expect(overlapsSolid(LEVEL, p.x, p.y, PLAYER_RADIUS)).toBe(false);
    }
    expect(p.x + PLAYER_RADIUS, "walked around the bin").toBeLessThan(f.minX);
  });

  it("slides a walker who grazes the end of a solid item around it, and still stops one who walks into it", () => {
    // Regression (cycle D4): with no slide, the balance player jammed on item ends thousands of frames per 400 games.
    // A square of half-width PLAYER_RADIUS at (x, y) touches neither a wall nor a solid item.
    const free = (x: number, y: number) =>
      !overlapsSolid(LEVEL, x, y, PLAYER_RADIUS) &&
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => tileAt(LEVEL, x + sx! * PLAYER_RADIUS, y + sy! * PLAYER_RADIUS) !== "WALL");
    // An item against a north wall (it spans y from the wall face to SOLID_MAX_DEPTH into the room), with clear floor along
    // the wall on both sides of it, so the walk is limited by the item alone.
    const f = solidFootprints(LEVEL).find((r) => {
      const northWall = r.minY - Math.floor(r.minY) < 0.05 && tileAt(LEVEL, (r.minX + r.maxX) / 2, Math.floor(r.minY) - 0.5) === "WALL";
      const lane = r.maxY + PLAYER_RADIUS;
      return northWall && free(r.minX - PLAYER_RADIUS - 0.1, lane - 0.03) && free(r.maxX + PLAYER_RADIUS + 0.1, lane) && free((r.minX + r.maxX) / 2, lane);
    });
    expect(f, "an item against a north wall with clear floor beside it").toBeDefined();
    const grazing = { x: f!.minX - PLAYER_RADIUS - 0.1, y: f!.maxY + PLAYER_RADIUS - 0.03 };
    expect(overlapsSolid(LEVEL, grazing.x, grazing.y, PLAYER_RADIUS)).toBe(false);
    let p = grazing;
    for (let i = 0; i < 30; i += 1) p = moveCircle(LEVEL, p, 0.02, 0, PLAYER_RADIUS, false);
    expect(p.x - grazing.x, "slid past the item's end").toBeGreaterThan(0.5);
    expect(p.y).toBeGreaterThanOrEqual(f!.maxY + PLAYER_RADIUS);
    expect(p.y - grazing.y).toBeLessThanOrEqual(FURNITURE_SLIDE);
    // A walker hugging the wall meets the item's end face. It steps around the end at walking speed (cycle D4: the escape
    // player stopped against a locker's end while following a wall) and never enters the item.
    const hugging = { x: grazing.x, y: Math.floor(f!.minY) + PLAYER_RADIUS };
    expect(free(hugging.x, hugging.y)).toBe(true);
    let q = hugging;
    for (let i = 0; i < 80; i += 1) {
      const next = moveCircle(LEVEL, q, 0.02, 0, PLAYER_RADIUS, false);
      expect(overlapsSolid(LEVEL, next.x, next.y, PLAYER_RADIUS)).toBe(false);
      expect(Math.max(Math.abs(next.x - q.x), Math.abs(next.y - q.y)), "no jump larger than the move and a graze step").toBeLessThanOrEqual(0.02 + FURNITURE_SLIDE + 1e-9);
      q = next;
    }
    expect(q.x - PLAYER_RADIUS, "walked around the item's end").toBeGreaterThan(f!.maxX);
    // Into the front face, a walker stops.
    const facing = { x: (f!.minX + f!.maxX) / 2, y: f!.maxY + PLAYER_RADIUS + 0.1 };
    let r = facing;
    for (let i = 0; i < 30; i += 1) r = moveCircle(LEVEL, r, 0, -0.02, PLAYER_RADIUS, false);
    expect(r.x).toBe(facing.x);
    expect(r.y - PLAYER_RADIUS, "stopped at the front face").toBeGreaterThanOrEqual(f!.maxY - 1e-9);
  });

  it("does not push a walker back when a slight drift brushes an item it walks along", () => {
    // Regression (cycle D4): walking along an item's front face past its end, a small drift into the face was stepped aside
    // against the walker's own motion, so it barely moved (the escape player stalled beside a crate for half a second).
    const f = solidFootprints(LEVEL).find((r) => {
      const northWall = r.minY - Math.floor(r.minY) < 0.05 && tileAt(LEVEL, (r.minX + r.maxX) / 2, Math.floor(r.minY) - 0.5) === "WALL";
      const lane = r.maxY + PLAYER_RADIUS + 1e-6;
      return northWall && [r.minX - PLAYER_RADIUS + 0.03, (r.minX + r.maxX) / 2, r.maxX + PLAYER_RADIUS + 0.1].every((x) =>
        !overlapsSolid(LEVEL, x, lane, PLAYER_RADIUS) &&
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].every(([sx, sy]) => tileAt(LEVEL, x + sx! * PLAYER_RADIUS, lane + sy! * PLAYER_RADIUS) !== "WALL"));
    });
    expect(f, "an item against a north wall with clear floor along its front").toBeDefined();
    const start = { x: f!.minX - PLAYER_RADIUS + 0.03, y: f!.maxY + PLAYER_RADIUS + 1e-6 };
    let p = start;
    for (let i = 0; i < 40; i += 1) {
      const next = moveCircle(LEVEL, p, 0.02, -0.0005, PLAYER_RADIUS, false);
      expect(next.x - p.x, "full progress along the face").toBeCloseTo(0.02, 9);
      expect(overlapsSolid(LEVEL, next.x, next.y, PLAYER_RADIUS)).toBe(false);
      p = next;
    }
  });

  it("lets a walker cross between the centres of every pair of neighbouring floor tiles", () => {
    // The creature walks exactly these segments (world.ts followPath), and the escape route and the test driver follow them.
    // Every segment keeps a clearance of PLAYER_RADIUS from every solid item, and moveCircle completes it.
    const solids = solidFootprints(LEVEL);
    const open = (x: number, y: number) => tileAt(LEVEL, x + 0.5, y + 0.5) !== "WALL";
    let segments = 0;
    for (let y = 0; y < LEVEL.height; y += 1) {
      for (let x = 0; x < LEVEL.width; x += 1) {
        if (!open(x, y)) continue;
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          if (!open(x + dx, y + dy)) continue;
          segments += 1;
          const a = { x: x + 0.5, y: y + 0.5 };
          for (const f of solids) {
            // Distance from the axis-aligned segment a..a+(dx,dy) to the footprint.
            const sx = Math.max(f.minX - Math.max(a.x, a.x + dx), 0, Math.min(a.x, a.x + dx) - f.maxX);
            const sy = Math.max(f.minY - Math.max(a.y, a.y + dy), 0, Math.min(a.y, a.y + dy) - f.maxY);
            expect(Math.hypot(sx, sy), `segment ${x},${y} +${dx},${dy}`).toBeGreaterThanOrEqual(PLAYER_RADIUS);
          }
          let p = a;
          for (let i = 0; i < 50; i += 1) p = moveCircle(LEVEL, p, dx * 0.02, dy * 0.02, PLAYER_RADIUS, true);
          expect(Math.hypot(p.x - a.x - dx, p.y - a.y - dy), `walk ${x},${y} +${dx},${dy}`).toBeLessThan(1e-9);
        }
      }
    }
    expect(segments).toBeGreaterThan(200);
  });

  it("keeps doors, vents, baseboards, terminals and ceiling items non-blocking", () => {
    const key = (f: Rect) => [f.minX, f.maxX, f.minY, f.maxY].map((v) => v.toFixed(6)).join(",");
    const solids = new Set(solidFootprints(LEVEL).map(key));
    const flush = [
      ...planArchive(LEVEL).filter((item) => ["institutionalDoor", "wallVent", "baseboard", "acousticPanel", "fluorescentFixture", "ceilingVent"].includes(item.kind)),
      ...planFurniture(LEVEL).filter((item) => item.kind === "terminal"),
    ];
    expect(flush.length).toBeGreaterThan(50);
    for (const item of flush) expect(solids.has(key(item.footprint)), `${item.kind} at ${item.tileX},${item.tileY}`).toBe(false);
    // A door is flush with its wall: a walker against the wall never reaches it.
    for (const item of planArchive(LEVEL).filter((i) => i.kind === "institutionalDoor")) {
      const f = item.footprint;
      expect(Math.min(f.maxX - f.minX, f.maxY - f.minY)).toBeLessThan(0.5 - PLAYER_RADIUS);
    }
  });
});

/** Red, green and blue channels of a 24-bit colour. */
function channels(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

describe("archive palette and lighting", () => {
  it("uses the approved institutional colours", () => {
    expect(ARCHIVE_PALETTE).toEqual({ beige: 0xb5ad91, concrete: 0x595b59, green: 0x4c544b, ochre: 0x6e6244, charcoal: 0x171717 });
  });

  it("keeps the palette free of crimson, which belongs to the monster's aura", () => {
    expect(Object.values(ARCHIVE_PALETTE)).not.toContain(0x8f171d);
  });

  it("uses a charcoal background, not a red one", () => {
    expect(ARCHIVE_LIGHTING.background).toBe(ARCHIVE_PALETTE.charcoal);
    const [r, g, b] = channels(ARCHIVE_LIGHTING.background);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
  });

  it("keeps the ambient and hemisphere light neutral and dim", () => {
    for (const hex of [ARCHIVE_LIGHTING.ambient, ARCHIVE_LIGHTING.hemisphereSky, ARCHIVE_LIGHTING.hemisphereGround]) {
      const [r, g, b] = channels(hex);
      expect(Math.max(r, g, b) - Math.min(r, g, b), hex.toString(16)).toBeLessThanOrEqual(8);
      expect(Math.max(r, g, b), hex.toString(16)).toBeLessThan(0x80);
    }
  });

  it("lights the corridors enough to read, and no more: the floor gets more fill than the ceiling, and fog still closes in", () => {
    // Regression (cycle D4): the hemisphere fill was 0x1c1f1d at 0.15, so the corridors were black outside the flashlight.
    const sky = Math.max(...channels(ARCHIVE_LIGHTING.hemisphereSky));
    const ground = Math.max(...channels(ARCHIVE_LIGHTING.hemisphereGround));
    expect(sky * ARCHIVE_LIGHTING.hemisphereIntensity).toBeGreaterThanOrEqual(0x40);
    expect(sky).toBeGreaterThan(ground);
    expect(ARCHIVE_LIGHTING.hemisphereIntensity).toBeLessThanOrEqual(1.5);
    expect(ARCHIVE_LIGHTING.fogDensity).toBeGreaterThanOrEqual(0.05);
    expect(ARCHIVE_LIGHTING.fogDensity).toBeLessThanOrEqual(0.1);
  });

  it("makes the fluorescent light cold green-white, with no red", () => {
    const [r, g, b] = channels(ARCHIVE_LIGHTING.fluorescent);
    expect(g).toBeGreaterThanOrEqual(r);
    expect(b).toBeGreaterThanOrEqual(r);
    expect(Math.min(r, g, b)).toBeGreaterThan(0xc0);
  });
});

describe("determinism", () => {
  it("places identical instances when built twice", () => {
    const first = build(LEVEL);
    const second = build(LEVEL);
    const a = first.scene.getObjectByName("archive-decor") as THREE.Group;
    const b = second.scene.getObjectByName("archive-decor") as THREE.Group;
    expect(b.children.length).toBe(a.children.length);
    a.children.forEach((child, i) => {
      const mesh = child as THREE.InstancedMesh;
      const other = b.children[i] as THREE.InstancedMesh;
      expect(Array.from(other.instanceMatrix.array)).toEqual(Array.from(mesh.instanceMatrix.array));
    });
    expect(second.decor.stats).toEqual(first.decor.stats);
    first.decor.dispose();
    second.decor.dispose();
  });
});

describe("dispose", () => {
  it("frees every geometry, removes the group, and tolerates a second call", () => {
    const { scene, decor } = build(LEVEL);
    const group = scene.getObjectByName("archive-decor") as THREE.Group;
    const geometries = new Set(group.children.map((child) => (child as THREE.InstancedMesh).geometry));
    const freed = new Set<THREE.BufferGeometry>();
    for (const geometry of geometries) geometry.addEventListener("dispose", () => freed.add(geometry));

    decor.dispose();

    expect(freed.size).toBe(geometries.size);
    expect(scene.getObjectByName("archive-decor")).toBeUndefined();
    expect(() => decor.dispose()).not.toThrow();
  });
});
