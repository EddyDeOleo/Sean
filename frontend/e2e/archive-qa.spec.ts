/**
 * Workstream D acceptance fixture for the archive, played through the development test clock with real input (no teleport):
 *
 * 1. Collision: the player walks along a wall into a filing cabinet, a bookshelf and a document cart. The positions where it
 *    stops are recorded and compared with each object's footprint.
 * 2. Drawers and bookshelves: the player stands in the start room and looks at the east wall, where they stand.
 * 3. Corridors: the player walks into the west and south corridors and looks along them.
 * 4. Hunting: after the first clue, the player walks toward the creature in the open until it pursues, then turns to face it.
 *    The frame is kept only when the creature is drawn, in front of the camera and in line of sight.
 * 5. Monster clearance: every creature position of the run is checked against the solid footprints.
 *
 * Frames and measurements go to test-results-diagnostics/screenshots/archive-qa-<label>/ (ARCHIVE_QA_LABEL, default "run").
 * ARCHIVE_QA_QUALITY sets the graphics quality (default medium, the game's default).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { advance, route, type DriverInput, type FrameState } from "./deterministicDriver";
import { LEVEL, hasLineOfSight, type Point } from "../src/features/game/level";
import { solidFootprints } from "../src/features/game/archive/archiveLayout";
import { PLAYER_RADIUS } from "../src/features/game/world";

const LABEL = process.env.ARCHIVE_QA_LABEL ?? "run";
const QUALITY = process.env.ARCHIVE_QA_QUALITY ?? "medium";
const OUT = resolve("test-results-diagnostics", "screenshots", `archive-qa-${LABEL}`);
const STILL: DriverInput = { forward: 0, strafe: 0, turn: 0, sprint: false };
/** Half the horizontal view, in radians, with a margin: 70 degrees vertical at 16:9 is about 51 degrees each side. */
const VIEW_HALF = 0.75;
/** Half the creature's width across the view, in tiles, for the hunting frame's line-of-sight check. */
const BODY_HALF_WIDTH = 0.2;

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
const at = (s: FrameState): Point => ({ x: s.player[0], y: s.player[1] });
/** Every player position the collision and walking steps reached. */
const playerTrack: Array<[number, number]> = [];

async function startGame(page: Page): Promise<FrameState> {
  await page.addInitScript((quality) => {
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true, jumpscare: true, intensity: "low", quality, skipGameplay: false }));
  }, QUALITY);
  await page.goto("/?testClock=1&seed=1");
  await page.getByRole("textbox", { name: "Your request" }).fill("sample - Why does src/billing.py validate the amount?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("game-begin").click();
  await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
  await page.waitForFunction(() => typeof window.__seanTest === "object");
  return advance(page, STILL, 0, false);
}

/** Turns in place until the view faces `yaw` (within 0.02 rad). */
async function face(page: Page, s: FrameState, yaw: number): Promise<FrameState> {
  for (let i = 0; i < 240 && Math.abs(wrap(yaw - s.yaw)) > 0.02; i += 1) {
    s = await advance(page, { ...STILL, turn: Math.max(-3, Math.min(3, wrap(yaw - s.yaw) * 8)) }, 1, false);
  }
  return s;
}

/** Walks to `target`: turns to face it, then walks straight, until within 0.05 or `frames` run out. */
async function walkStraight(page: Page, s: FrameState, target: Point, frames = 600): Promise<FrameState> {
  for (let i = 0; i < frames; i += 1) {
    const dx = target.x - s.player[0];
    const dy = target.y - s.player[1];
    if (Math.hypot(dx, dy) < 0.05) break;
    const diff = wrap(Math.atan2(dy, dx) - s.yaw);
    s = await advance(page, { forward: Math.abs(diff) < 0.3 ? 1 : 0, strafe: 0, turn: Math.max(-3, Math.min(3, diff * 8)), sprint: false }, 1, false);
    playerTrack.push(s.player);
  }
  return s;
}

/** Walks the tile route to `target`, through tile centres. */
async function walkTo(page: Page, s: FrameState, target: Point): Promise<FrameState> {
  const path = route(at(s), target, s.gateOpen, null);
  if (!path) throw new Error(`no route to ${target.x},${target.y}`);
  for (const point of [...path.slice(1, -1), target]) s = await walkStraight(page, s, point);
  return s;
}

/** Pushes with the given input for `frames` steps and returns the furthest position reached. */
async function push(page: Page, s: FrameState, input: DriverInput, frames: number): Promise<FrameState> {
  for (let i = 0; i < frames; i += 1) {
    s = await advance(page, input, 1, false);
    playerTrack.push(s.player);
  }
  return s;
}

async function shot(page: Page, name: string): Promise<FrameState> {
  const s = await advance(page, STILL, 0, true);
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  return s;
}

test("archive QA: collision, drawers and shelves, corridors, hunting", async ({ page }) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const record: Record<string, unknown> = { label: LABEL, quality: QUALITY };
  let s = await startGame(page);

  // 1. Collision. The start room's east wall (x = 4) holds, from north to south: a document cart in the corner (tile 3,1),
  // a door (3,2), and the filing cabinet and bookshelf tiles (3,3) and (3,4). Walk east along y = 1.5 into the cart, then
  // slide south along the east wall into the furniture.
  s = await face(page, s, 0);
  s = await push(page, s, { forward: 1, strafe: 0, turn: 0, sprint: false }, 90);
  record.eastIntoCart = { player: s.player };
  await shot(page, "1a-collision-cart");
  s = await walkStraight(page, s, { x: 3.5, y: 2.5 });
  s = await face(page, s, 0);
  s = await push(page, s, { forward: 1, strafe: 0, turn: 0, sprint: false }, 60);
  s = await face(page, s, Math.PI / 2);
  s = await push(page, s, { forward: 1, strafe: 0, turn: 0, sprint: false }, 120);
  record.southAlongEastWall = { player: s.player };
  await shot(page, "1b-collision-wall-furniture");

  // 2. Drawers and bookshelves on the east wall of the start room, seen from the room.
  s = await walkStraight(page, s, { x: 1.6, y: 3.3 });
  s = await face(page, s, -0.15);
  await shot(page, "2a-drawers-shelves-east-wall");
  s = await face(page, s, -Math.PI / 2 - 0.35);
  await shot(page, "2b-drawers-shelves-north-wall");

  // 3. Corridors: the long corridor on row 5 from its west end, and the west corridor (column 1) looking south.
  s = await walkTo(page, s, { x: 1.5, y: 5.5 });
  s = await face(page, s, 0);
  await shot(page, "3a-corridor-row5-east");
  s = await walkTo(page, s, { x: 1.5, y: 7.5 });
  s = await face(page, s, Math.PI / 2);
  await shot(page, "3b-corridor-column1-south");
  s = await walkTo(page, s, { x: 1.5, y: 11.5 });
  s = await face(page, s, 0);
  await shot(page, "3c-corridor-row11-east");

  // 4. Hunting: collect the first clue (the nearest, in the room at 3,7), then walk toward the creature until it pursues.
  const clue = s.clues.map(([x, y]) => ({ x, y })).sort((a, b) => Math.hypot(a.x - s.player[0], a.y - s.player[1]) - Math.hypot(b.x - s.player[0], b.y - s.player[1]))[0]!;
  s = await walkTo(page, s, clue);
  for (let i = 0; i < 120 && s.collected < 1; i += 1) s = await advance(page, STILL, 1, false);
  record.firstClue = { collected: s.collected, at: s.player };
  const monsterTrack: Array<[number, number]> = [];
  let hunting: Record<string, unknown> | null = null;
  const misses: Array<Record<string, unknown>> = [];
  record.huntMisses = misses;
  for (let i = 0; i < 60 * 90 && s.status === "PLAYING"; i += 1) {
    monsterTrack.push(s.monsterAt);
    const creature = { x: s.monsterAt[0], y: s.monsterAt[1] };
    const d = Math.hypot(creature.x - s.player[0], creature.y - s.player[1]);
    const huntingNow = s.monster === "PURSUING";
    if (huntingNow && d < 6) {
      // Stop and face it. Keep the frame only when the creature is in front of the camera and in line of sight.
      s = await face(page, s, Math.atan2(creature.y - s.player[1], creature.x - s.player[0]));
      const c = { x: s.monsterAt[0], y: s.monsterAt[1] };
      const off = Math.abs(wrap(Math.atan2(c.y - s.player[1], c.x - s.player[0]) - s.yaw));
      // The whole body must be clear, not only its centre: a wall corner hid most of it in the first capture.
      const len = Math.hypot(c.x - s.player[0], c.y - s.player[1]) || 1;
      const side = { x: (-(c.y - s.player[1]) / len) * BODY_HALF_WIDTH, y: ((c.x - s.player[0]) / len) * BODY_HALF_WIDTH };
      const sight = [0, 1, -1].every((k) => hasLineOfSight(LEVEL, at(s), { x: c.x + k * side.x, y: c.y + k * side.y }, s.gateOpen));
      if (s.status === "PLAYING" && off < VIEW_HALF && sight) {
        const drawn = await shot(page, "4-hunting");
        hunting = {
          monster: drawn.monster, status: drawn.status, hidden: drawn.hidden, player: drawn.player, monsterAt: drawn.monsterAt,
          distance: Number(Math.hypot(drawn.monsterAt[0] - drawn.player[0], drawn.monsterAt[1] - drawn.player[1]).toFixed(2)),
          bearingOffView: Number(off.toFixed(3)), lineOfSight: sight,
          creatureDrawn: await page.locator("canvas").first().getAttribute("data-creature-visible"),
        };
        break;
      }
      misses.push({ time: Number(s.time.toFixed(2)), status: s.status, monster: s.monster, off: Number(off.toFixed(2)), sight, d: Number(d.toFixed(2)) });
    }
    // Once it is awake, walk toward it in the open until it is 5 tiles away, then stand and face it, so it sees the player.
    const path = route(at(s), creature, s.gateOpen, null);
    const next = path && path.length > 1 ? path[1]! : creature;
    const approach = s.monster !== "DORMANT" && !huntingNow && d > 5;
    const aim = approach ? next : creature;
    const diff = wrap(Math.atan2(aim.y - s.player[1], aim.x - s.player[0]) - s.yaw);
    s = await advance(page, { forward: approach && Math.abs(diff) < 0.3 ? 1 : 0, strafe: 0, turn: Math.max(-3, Math.min(3, diff * 8)), sprint: false }, 1, false);
  }
  record.hunting = hunting;
  record.huntEnd = { status: s.status, monster: s.monster, player: s.player, monsterAt: s.monsterAt, time: s.time };

  // 5. Monster clearance over the whole run: the distance from each creature position to the nearest solid footprint.
  const solids = solidFootprints(LEVEL);
  let nearest = Infinity;
  for (const [x, y] of monsterTrack) {
    for (const f of solids) nearest = Math.min(nearest, Math.hypot(Math.max(f.minX - x, 0, x - f.maxX), Math.max(f.minY - y, 0, y - f.maxY)));
  }
  record.monsterClearance = { samples: monsterTrack.length, nearestSolid: Number(nearest.toFixed(3)) };
  // The player's square (half-width PLAYER_RADIUS, as in moveCircle) never overlaps a solid footprint.
  const inside = playerTrack.filter(([x, y]) => solids.some((f) => x + PLAYER_RADIUS > f.minX + 1e-6 && x - PLAYER_RADIUS < f.maxX - 1e-6 && y + PLAYER_RADIUS > f.minY + 1e-6 && y - PLAYER_RADIUS < f.maxY - 1e-6));
  record.playerInsideSolid = { samples: playerTrack.length, overlapping: inside.length, first: inside[0] ?? null };
  writeFileSync(resolve(OUT, "archive-qa.json"), JSON.stringify(record, null, 1));

  expect(hunting, "a hunting frame with the creature in view").not.toBeNull();
  expect(hunting!.hidden).toBe(false);
  expect(hunting!.creatureDrawn).toBe("true");
  expect(inside.length, "player positions inside a solid footprint").toBe(0);
  expect(nearest, "the creature's centre stays clear of solid furniture").toBeGreaterThanOrEqual(PLAYER_RADIUS);
});

/**
 * The decoration restored beside doorways, corridor mouths and wall ends (fitAlongWall, archiveLayout.ts). The player walks to
 * each place and looks at it, then walks along the wall past the restored item, pressed against the wall, the way a player who
 * hugs walls moves. Each walk must reach its end with no long stall, and the player never enters a solid footprint. The routes
 * avoid the clue tiles, so the creature stays dormant and the walks measure the furniture alone.
 */
test("archive QA: restored decoration beside doorways and wall ends, walked along the wall", async ({ page }) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  let s = await startGame(page);
  const clueTiles = new Set(s.clues.map(([x, y]) => `${Math.floor(x)},${Math.floor(y)}`));
  const avoid = (tile: Point): boolean => clueTiles.has(`${Math.floor(tile.x)},${Math.floor(tile.y)}`);
  const track: Array<[number, number]> = [];
  const stepTo = async (target: Point, frames = 900): Promise<{ stallFrames: number; longestStall: number }> => {
    let stallFrames = 0;
    let run = 0;
    let longestStall = 0;
    for (let i = 0; i < frames && Math.hypot(target.x - s.player[0], target.y - s.player[1]) >= 0.05; i += 1) {
      const diff = wrap(Math.atan2(target.y - s.player[1], target.x - s.player[0]) - s.yaw);
      const forward = Math.abs(diff) < 0.3 ? 1 : 0;
      const before = s.player;
      s = await advance(page, { forward, strafe: 0, turn: Math.max(-3, Math.min(3, diff * 8)), sprint: false }, 1, false);
      track.push(s.player);
      if (forward > 0 && Math.hypot(s.player[0] - before[0], s.player[1] - before[1]) < 0.001) {
        stallFrames += 1;
        run += 1;
        longestStall = Math.max(longestStall, run);
      } else run = 0;
    }
    return { stallFrames, longestStall };
  };
  const goTo = async (target: Point): Promise<void> => {
    const path = route(at(s), target, s.gateOpen, avoid);
    if (!path) throw new Error(`no route to ${target.x},${target.y}`);
    for (const point of [...path.slice(1, -1), target]) await stepTo(point);
  };
  const look = async (from: Point, yaw: number, name: string): Promise<void> => {
    await goTo(from);
    s = await face(page, s, yaw);
    s = await shot(page, name);
  };
  // `wall` is the tile centre the walk starts from; the walk then runs from `from` to `to`, a hair off the wall.
  const walks: Array<Record<string, unknown>> = [];
  const hug = async (label: string, wall: Point, from: Point, to: Point): Promise<void> => {
    await goTo(wall);
    await stepTo(from);
    const result = await stepTo(to);
    walks.push({ label, from, to, end: s.player, missed: Number(Math.hypot(to.x - s.player[0], to.y - s.player[1]).toFixed(3)), ...result });
  };
  const H = 1 - PLAYER_RADIUS - 0.01;

  // Row-5 junction: the three bookshelves where the start room, the west corridor and the row-5 corridor meet.
  await look({ x: 2.5, y: 4.5 }, Math.PI / 2 + 0.35, "5a-restored-junction-bookshelves");
  await hug("row-5 south wall, past the junction bookshelves (3,5) and (2,5)", { x: 4.5, y: 5.5 }, { x: 4.6, y: 5 + H }, { x: 1.6, y: 5 + H });
  // The north room: the filing cabinet at (7,3) beside the doorway at (6,4).
  await look({ x: 8.5, y: 2.5 }, Math.PI / 2 + 0.6, "5b-restored-cabinet-by-doorway");
  await hug("room (5..9, 1..3) south wall, past the cabinet (7,3) to the doorway", { x: 8.5, y: 3.5 }, { x: 8.7, y: 3 + H }, { x: 6.5, y: 3 + H });
  // The north-east room: the filing cabinet at (17,3) at the mouth of the corridor (17,4).
  await look({ x: 15.5, y: 2.5 }, 0.45, "5c-restored-cabinet-by-corridor-mouth");
  await hug("corridor (17,4) north into the room along the east wall, past the cabinet (17,3)", { x: 17.5, y: 4.5 }, { x: 17 + H, y: 4.6 }, { x: 17 + H, y: 2.4 });
  // Row-5 corridor: the waste bin at (17,5) and the document cart at (23,5).
  await look({ x: 15.5, y: 5.5 }, 0, "5d-restored-bin-row5");
  await hug("row-5 south wall east, past the bin (17,5)", { x: 16.5, y: 5.5 }, { x: 16.4, y: 5 + H }, { x: 19.6, y: 5 + H });
  await look({ x: 21.5, y: 5.5 }, 0, "5e-restored-cart-row5-east");
  await hug("corridor (23,6) north along the east wall, round the cart (23,5) to the corridor end", { x: 23.5, y: 6.5 }, { x: 23 + H, y: 6.6 }, { x: 23.45, y: 5.32 });
  // Row-11 corridor: the bins at (8,11) and (14,11), with the shelving between them.
  await look({ x: 5.5, y: 11.5 }, 0.05, "5f-restored-bins-row11");
  await hug("row-11 south wall east, past the bins (8,11), (14,11) and the shelving (13,11)", { x: 6.5, y: 11.5 }, { x: 6.6, y: 11 + H }, { x: 15.6, y: 11 + H });
  // The south-west rooms: the locker at (3,13) and the bookshelf at (9,13), each beside a doorway.
  await look({ x: 2.5, y: 14.5 }, -0.9, "5g-restored-locker-by-doorway");
  await hug("doorway (3,12) south along the east wall, round the locker (3,13) into the room", { x: 3.5, y: 12.5 }, { x: 3 + H, y: 12.4 }, { x: 3.5, y: 14.5 });
  await look({ x: 7.5, y: 14.5 }, -0.6, "5h-restored-bookshelf-by-doorway");
  await hug("doorway (9,12) south along the east wall, round the bookshelf (9,13) into the room", { x: 9.5, y: 12.5 }, { x: 9 + H, y: 12.4 }, { x: 9.5, y: 14.5 });
  // The hall: the crate stack at (14,6) on a one-tile wall.
  await look({ x: 12.5, y: 7.5 }, -0.3, "5i-restored-crate-hall");

  const solids = solidFootprints(LEVEL);
  const inside = track.filter(([x, y]) => solids.some((f) => x + PLAYER_RADIUS > f.minX + 1e-6 && x - PLAYER_RADIUS < f.maxX - 1e-6 && y + PLAYER_RADIUS > f.minY + 1e-6 && y - PLAYER_RADIUS < f.maxY - 1e-6));
  writeFileSync(resolve(OUT, "restored-walks.json"), JSON.stringify({ label: LABEL, quality: QUALITY, monster: s.monster, collected: s.collected, walks, samples: track.length, overlapping: inside.length, first: inside[0] ?? null }, null, 1));

  expect(s.collected, "the tour collects no clue").toBe(0);
  expect(inside.length, "player positions inside a solid footprint").toBe(0);
  for (const walk of walks) {
    // A walk ends within 0.05 of its end point; `missed` is rounded to 3 decimals.
    expect(walk.missed as number, `${walk.label}: reached the end`).toBeLessThanOrEqual(0.05);
    expect(walk.longestStall as number, `${walk.label}: longest stall in frames`).toBeLessThanOrEqual(10);
  }
});
