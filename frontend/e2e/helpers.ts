import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Page } from "@playwright/test";
import { LEVEL, findPath } from "../src/features/game/level";

/**
 * Shared helpers for the browser tests that play the game. The 3D game in a real browser (Edge) against the real backend. The tests play the game: a small closed-loop controller
 * reads the player's position from the game's data attributes and presses the real keys. Nothing in the game is mocked.
 * Setting SEAN_SHOT_DIR also saves screenshots.
 */
export const SHOTS = process.env.SEAN_SHOT_DIR ?? null;
export const shot = async (page: Page, name: string): Promise<void> => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: resolve(SHOTS, `${name}.png`) });
};

export async function ask(page: Page): Promise<void> {
  await page.getByRole("textbox", { name: "Your request" }).fill("sample - Why does src/billing.py validate the amount?");
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
}

export async function enterGame(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify(value));
  }, { horror: true, intensity: "low", quality: "low", ...settings });
  await page.goto("/");
  await ask(page);
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 30_000 });
}

export async function begin(page: Page): Promise<void> {
  await page.getByTestId("game-begin").click();
  await expect(page.getByTestId("game")).toHaveAttribute("data-phase", "GAME_ACTIVE");
}

export interface Snapshot {
  x: number;
  y: number;
  yaw: number;
  monster: string;
  monsterAt: [number, number];
  status: string;
  hidden: boolean;
}
export async function read(page: Page): Promise<Snapshot | null> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('[data-testid="game"]');
    if (!root?.dataset.player) return null;
    const [x, y, yaw] = root.dataset.player.split(",").map(Number);
    const [mx, my] = (root.dataset.monsterAt ?? "0,0").split(",").map(Number);
    return { x: x!, y: y!, yaw: yaw!, monster: root.dataset.monster ?? "", monsterAt: [mx!, my!] as [number, number], status: root.dataset.status ?? "", hidden: root.dataset.hidden === "true" };
  });
}

export class Keys {
  private held = new Set<string>();
  constructor(private readonly page: Page) {}
  async set(wanted: string[]): Promise<void> {
    const next = new Set(wanted);
    for (const key of this.held) if (!next.has(key)) await this.page.keyboard.up(key);
    for (const key of next) if (!this.held.has(key)) await this.page.keyboard.down(key);
    this.held = next;
  }
  release(): Promise<void> {
    return this.set([]);
  }
}

export const normalise = (angle: number): number => {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

/** When hunted: the nearby tile that is farthest from the creature, reached without first stepping toward it. */
export function fleeTarget(s: Snapshot, gateOpen: boolean): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestScore = -Infinity;
  const away = (p: { x: number; y: number }): number => Math.hypot(p.x - s.monsterAt[0], p.y - s.monsterAt[1]);
  for (let ty = 0; ty < LEVEL.height; ty += 1) {
    for (let tx = 0; tx < LEVEL.width; tx += 1) {
      const spot = { x: tx + 0.5, y: ty + 0.5 };
      const path = findPath(LEVEL, { x: s.x, y: s.y }, spot, gateOpen);
      if (!path || path.length < 2 || path.length > 14) continue;
      const first = { x: path[1]!.x + 0.5, y: path[1]!.y + 0.5 };
      if (away(first) < away({ x: s.x, y: s.y }) - 0.01) continue;
      const score = away(spot) - path.length * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = spot;
      }
    }
  }
  return best;
}

/** Walk to a point by pressing keys. Returns false if the game ended (caught) or the time ran out. */
export async function walkTo(page: Page, target: { x: number; y: number }, opts: { gateOpen: boolean; sprint?: boolean; careful?: boolean; ms?: number }): Promise<boolean> {
  const keys = new Keys(page);
  const startedAt = Date.now();
  const deadline = Date.now() + (opts.ms ?? 45_000);
  let frozen = 0;
  try {
    while (Date.now() < deadline) {
      const s = await read(page);
      // The first frame after Begin may not have been drawn yet. Give it a moment before concluding the game is gone.
      if (!s && Date.now() - startedAt < 2000) {
        await page.waitForTimeout(50);
        continue;
      }
      if (!s || s.status !== "PLAYING") return false;
      if (Math.hypot(s.x - target.x, s.y - target.y) < 0.35) return true;
      // A careful player stands still (it makes no sound) while the creature is close and has not seen them.
      const closeBy = Math.hypot(s.x - s.monsterAt[0], s.y - s.monsterAt[1]) < 11;
      if (opts.careful && closeBy && frozen < 6_000 && ["SEARCHING", "INVESTIGATING", "RECOVERING"].includes(s.monster)) {
        await keys.set([]);
        await page.waitForTimeout(100);
        frozen += 100;
        continue;
      }
      let goal = target;
      if (opts.careful && ["PURSUING", "ATTACKING"].includes(s.monster)) goal = fleeTarget(s, opts.gateOpen) ?? target;
      const path = findPath(LEVEL, { x: s.x, y: s.y }, goal, opts.gateOpen);
      if (!path) throw new Error("no path");
      const next = path.length > 1 ? { x: path[1]!.x + 0.5, y: path[1]!.y + 0.5 } : goal;
      // Cut corners only when the next tile is straight ahead of the current one.
      const diff = normalise(Math.atan2(next.y - s.y, next.x - s.x) - s.yaw);
      const wanted: string[] = [];
      if (Math.abs(diff) > 0.12) wanted.push(diff > 0 ? "ArrowRight" : "ArrowLeft");
      if (Math.abs(diff) < 1.3) wanted.push("KeyW");
      if (opts.sprint && Math.abs(diff) < 1.3) wanted.push("ShiftLeft");
      await keys.set(wanted);
      await page.waitForTimeout(25);
    }
    return false;
  } finally {
    await keys.release();
  }
}


/** Start the game from the Play button, with no investigation at all. */
export async function enterStandalone(page: Page, settings: Record<string, unknown> = {}): Promise<void> {
  await page.addInitScript((value) => {
    if (window.localStorage.getItem("sean.settings.v1") === null) window.localStorage.setItem("sean.settings.v1", JSON.stringify(value));
  }, { horror: true, intensity: "low", quality: "low", ...settings });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByTestId("play-demo").click();
  await expect(page.getByTestId("game-intro")).toBeVisible({ timeout: 15_000 });
}

/** The player's tile centre and the creature's, as the game publishes them. */
export async function monsterDistance(page: Page): Promise<number | null> {
  const s = await read(page);
  return s ? Math.hypot(s.x - s.monsterAt[0], s.y - s.monsterAt[1]) : null;
}
