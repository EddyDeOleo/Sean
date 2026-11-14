/**
 * The interlude as the application runs it: when it appears, what it shows, and that every way out leads to the same report.
 * Timers are faked (the real pauses add up to about eight seconds); storage is a real IndexedDB implementation.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "../src/app/App";
import type { RenderGame, GameProps } from "../src/features/interlude/gameApi";
import { createIndexedDbStorage, type SnapshotStorage } from "../src/features/report/reportStore";
import type { CallOutcome } from "../src/services/advisorClient";
import type { SubmitOutcome } from "../src/services/investigationClient";
import { act, byRole, click, pressKey, render, type } from "./renderHelpers";
import { capabilitiesFixture, clone, complete, insufficient, interpretInvestigate, profileRich, repositoriesFixture } from "./fixtures";

const tid = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const ok = <T,>(value: T): CallOutcome<T> => ({ kind: "ok", value: clone(value) });

/** Advances in small steps, each in its own act, so React renders (and sets the next timer) between steps. */
async function advance(ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(50, left));
    });
  }
}
async function settle(): Promise<void> {
  await advance(50);
  await advance(50);
}

let storage: SnapshotStorage;
let lastGame: GameProps | null;
const fakeGame: RenderGame = (props) => {
  lastGame = props;
  return <div data-testid="fake-game" data-phase={props.phase} data-attempt={props.attempt}>game</div>;
};

function props(over: Partial<AppProps> & { result?: SubmitOutcome } = {}): AppProps {
  const { result, ...rest } = over;
  let n = 0;
  return {
    storage,
    systemPrefersReducedMotion: false,
    listRepositories: async () => ok(repositoriesFixture().body.repositories),
    getCapabilities: async () => ok(capabilitiesFixture().body),
    analysisDeps: {
      interpret: (async () => ok(interpretInvestigate().body)) as never,
      investigate: (async () => result ?? { kind: "result", result: clone(complete().body) }) as never,
      profile: (async () => ok(profileRich().body)) as never,
      makeId: () => `snap-${++n}`,
      now: () => new Date("2026-11-12T10:00:00.000Z"),
    },
    ...rest,
  };
}

async function ask(sentence = "sample - Why does src/billing.py exist?"): Promise<void> {
  await type(byRole("textbox", "Your request") as HTMLTextAreaElement, sentence);
  await click(byRole("button", "Investigate") as HTMLElement);
  await settle();
}

async function start(app: AppProps) {
  const view = await render(<App {...app} />);
  await settle();
  await ask();
  return view;
}

/** Runs the interlude to the point where the game is requested. */
async function throughInterruption(): Promise<void> {
  await advance(1600 + 5 * 700 + 700 + 2000 + 2600 + 3000 + 100);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout"] });
  window.localStorage.clear();
  storage = createIndexedDbStorage(new IDBFactory());
  lastGame = null;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("when the interlude appears", () => {
  it("is absent from the ordinary view", async () => {
    await render(<App {...props()} />);
    await settle();
    expect(tid("interlude")).toBeNull();
    expect(document.body.textContent).not.toMatch(/ouija/i);
  });

  it("appears after a successful, saved analysis, holds the report back and says it is fiction", async () => {
    await start(props());
    expect(tid("interlude")).not.toBeNull();
    expect(tid("report")).toBeNull();
    expect(tid("preparing")).not.toBeNull();
    expect(tid("fiction-notice")!.textContent).toMatch(/fiction/i);
    expect(tid("fiction-notice")!.textContent).toMatch(/cannot change your report/i);
    expect((await storage.all()).length).toBe(1);
  });

  it("shows the question as plain text, never as markup", async () => {
    const view = await render(<App {...props()} />);
    await settle();
    await ask("sample - Why <img src=x onerror=alert(1)>?");
    expect(tid("whisper")).not.toBeNull();
    expect(tid("interlude")!.querySelector("img")).toBeNull();
    await view.unmount();
  });

  it.each([
    ["insufficient evidence", () => ({ kind: "result", result: clone(insufficient().body) }) as SubmitOutcome],
    ["a failed investigation", () => ({ kind: "network" }) as SubmitOutcome],
  ])("never appears for %s", async (_n, outcome) => {
    await start(props({ result: outcome() }));
    await advance(10000);
    expect(tid("interlude")).toBeNull();
    expect(tid("preparing")).toBeNull();
  });

  it("never appears when the user turned the experience off, and the report opens at once", async () => {
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
    await start(props());
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("never appears for a saved report", async () => {
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
    const first = await start(props());
    await first.unmount();
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: true }));
    await render(<App {...props()} />);
    await settle();
    await click(byRole("button", /Why does/, tid("recent")!) as HTMLElement);
    await settle();
    await advance(10000);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });
});

describe("the sequence", () => {
  it("follows the board, the interruption and then the report when there is no game", async () => {
    await start(props());
    await advance(1600 + 100);
    expect(tid("board")).not.toBeNull();
    expect(tid("planchette")).not.toBeNull();
    expect(tid("line-one")).toBeNull();
    await advance(5 * 700 + 700 + 2000 + 100);
    expect(tid("line-one")!.textContent).toBe("Wait... something is wrong.");
    expect(tid("line-two")).toBeNull();
    await advance(2600 + 100);
    expect(tid("line-two")!.textContent).toBe("Something else is still in this repository.");
    await advance(3000 + 100);
    await advance(700);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("with reduced motion the board is static and the lines still come", async () => {
    await start(props({ systemPrefersReducedMotion: true }));
    await advance(100);
    expect(tid("interlude")!.getAttribute("data-reduced")).toBe("true");
    await advance(2100);
    expect(tid("line-one")).not.toBeNull();
  });

  it("starts the game after the interruption and gives it the saved snapshot", async () => {
    await start(props({ renderGame: fakeGame }));
    expect(tid("fake-game")).toBeNull();
    await throughInterruption();
    expect(tid("fake-game")!.getAttribute("data-phase")).toBe("GAME_INITIALIZATION");
    expect(lastGame!.attempt).toBe(1);
    expect(lastGame!.snapshot!.id).toBe("snap-1");
    await act(async () => lastGame!.onReady());
    expect(tid("fake-game")!.getAttribute("data-phase")).toBe("GAME_ACTIVE");
  });

  it("the report is unchanged by anything the game does", async () => {
    await start(props({ renderGame: fakeGame }));
    await throughInterruption();
    const saved = JSON.stringify((await storage.all())[0]!.snapshot);
    await act(async () => lastGame!.onReady());
    await act(async () => lastGame!.onCaught());
    await act(async () => lastGame!.onRetry());
    expect(tid("fake-game")!.getAttribute("data-attempt")).toBe("2");
    await act(async () => lastGame!.onReady());
    await act(async () => lastGame!.onEscaped());
    await advance(1000);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
    expect(JSON.stringify((await storage.all())[0]!.snapshot)).toBe(saved);
  });
});

describe("every way out ends at the report", () => {
  it("the skip button", async () => {
    await start(props({ renderGame: fakeGame }));
    await click(tid("skip-interlude")!);
    await settle();
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("the Escape key before the game", async () => {
    await start(props({ renderGame: fakeGame }));
    await pressKey(window, "Escape");
    await settle();
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("a game that cannot start", async () => {
    await start(props({ renderGame: fakeGame }));
    await throughInterruption();
    await act(async () => lastGame!.onFailed());
    await settle();
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("quitting the game", async () => {
    await start(props({ renderGame: fakeGame }));
    await throughInterruption();
    await act(async () => lastGame!.onReady());
    await act(async () => lastGame!.onQuit());
    await advance(1000);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("being caught and giving up", async () => {
    await start(props({ renderGame: fakeGame }));
    await throughInterruption();
    await act(async () => lastGame!.onReady());
    await act(async () => lastGame!.onCaught());
    expect(tid("fake-game")!.getAttribute("data-phase")).toBe("PLAYER_CAUGHT");
    await act(async () => lastGame!.onGiveUp());
    await advance(1000);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });

  it("the setting that skips the game still shows the Ouija and then the report", async () => {
    window.localStorage.setItem("sean.settings.v1", JSON.stringify({ skipGameplay: true }));
    await start(props({ renderGame: fakeGame }));
    await throughInterruption();
    await advance(1000);
    expect(tid("fake-game")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });
});

describe("review follow-up", () => {
  it("does not take over the screen if the user starts something else while the report is still being saved", async () => {
    const real = createIndexedDbStorage(new IDBFactory());
    const slow: SnapshotStorage = {
      ...real,
      put: async (row) => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return real.put(row);
      },
    };
    await render(<App {...props({ storage: slow })} />);
    await settle();
    await ask();
    expect(tid("interlude")).toBeNull();
    await click(byRole("button", "New Investigation") as HTMLElement);
    await advance(5000);
    expect(tid("interlude")).toBeNull();
    expect(document.querySelector(".sx-shell")!.hasAttribute("inert")).toBe(false);
    expect(byRole("textbox", "Your request")).not.toBeNull();
  });

  it("says so on the report when the game cannot start", async () => {
    const failing: RenderGame = (game) => {
      queueMicrotask(game.onFailed);
      return <div data-testid="fake-game">game</div>;
    };
    await start(props({ renderGame: failing }));
    await throughInterruption();
    await advance(1000);
    expect(tid("interlude")).toBeNull();
    expect(tid("report")).not.toBeNull();
    expect(tid("game-note")!.textContent).toMatch(/could not run/);
  });
});
