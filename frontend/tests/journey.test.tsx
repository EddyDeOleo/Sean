/**
 * Component and integration tests for the complete experience, driven through the real composition root with the
 * submit function injected and the fixtures captured from the real backend (tests/fixtures).
 * Timers are fake, so the 2000 ms interruption boundary is exact. Audio uses the fake Web Audio context.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvestigationView } from "../src/app/InvestigationView";
import { buildClues } from "../src/features/experience/clues";
import { createGame, pathActions, step, type Action } from "../src/features/escape/escapeEngine";
import { INTERRUPTION_DELAY_MS, SETTLE_MS } from "../src/features/experience/useExperience";
import { SESSION_KEY } from "../src/features/experience/sessionStore";
import type { SubmitFn, SubmitOutcome } from "../src/services/investigationClient";
import type { InvestigationResult } from "../src/types/contract";
import { act, byRole, click, flush, pressKey, render, type } from "./renderHelpers";
import { FakeContext } from "./fakeAudio";
import { clone, complete, failed, insufficient, partial } from "./fixtures";

const tid = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const must = (id: string): HTMLElement => {
  const found = tid(id);
  if (!found) throw new Error(`missing test id ${id}`);
  return found;
};
const content = (id: string): string => tid(id)?.textContent ?? "";

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function submitReturning(outcome: SubmitOutcome | (() => Promise<SubmitOutcome>)) {
  return vi.fn<SubmitFn>(async () => (typeof outcome === "function" ? outcome() : outcome));
}
const resultOutcome = (result: InvestigationResult): SubmitOutcome => ({ kind: "result", result: clone(result) });

interface MountOptions {
  submit: SubmitFn;
  reduced?: boolean;
  restoreSession?: boolean;
  persistSession?: boolean;
  factory?: () => FakeContext;
}
async function mount(options: MountOptions) {
  return render(
    <InvestigationView
      submit={options.submit}
      audioFactory={options.factory}
      restoreSession={options.restoreSession ?? false}
      persistSession={options.persistSession ?? false}
      systemPrefersReducedMotion={options.reduced ?? false}
    />,
  );
}
async function fillAndSubmit(path = "src/billing.py", symbol = "charge"): Promise<void> {
  const field = (label: string): HTMLInputElement => byRole("textbox", label) as HTMLInputElement;
  await type(field("Repository"), "sample");
  await type(field("File path"), path);
  await type(field("Symbol (optional)"), symbol);
  await type(byRole("textbox", "Your question") as HTMLTextAreaElement, "Why does charge validate its amount?");
  await click(byRole("button", "Summon") as HTMLElement);
  await flush();
}
/** Submit and let the board settle (but not the 2 s interruption delay). */
async function submitAndSettle(): Promise<void> {
  await fillAndSubmit();
  await advance(SETTLE_MS);
}
async function reachEscape(): Promise<void> {
  await submitAndSettle();
  await advance(INTERRUPTION_DELAY_MS);
  expect(tid("interruption")).not.toBeNull();
  await advance(20000); // the interruption plays out on its own
  expect(tid("escape")).not.toBeNull();
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("form validation", () => {
  it("does not call the API for an invalid form and shows field errors", async () => {
    const submit = submitReturning(resultOutcome(complete().body));
    await mount({ submit });
    await click(byRole("button", "Summon") as HTMLElement);
    expect(submit).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".field-error").length).toBeGreaterThan(0);
    expect(tid("ui-state")).toBeNull();
  });
});

describe("complete journey", () => {
  it("submits once, reveals, interrupts at exactly 2000 ms, plays the game, and reports the same evidence", async () => {
    const fixture = complete().body;
    const submit = submitReturning(resultOutcome(fixture));
    await mount({ submit });
    await fillAndSubmit();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(tid("report")).toBeNull();
    expect(tid("evidence-empty")).not.toBeNull();

    await advance(SETTLE_MS);
    expect(content("phrase").length).toBeGreaterThan(0);
    expect(tid("report")).not.toBeNull();
    expect(tid("interruption")).toBeNull();

    await advance(INTERRUPTION_DELAY_MS - 1);
    expect(tid("interruption")).toBeNull();
    await advance(1);
    expect(tid("interruption")).not.toBeNull();
    expect(content("fiction-notice").length).toBeGreaterThan(0);
    // The evidence stays on screen throughout the interruption.
    expect(content("report-status")).toBe(fixture.retrieval_status);
    expect(content("report-classification")).toBe(fixture.epistemic_classification);

    await advance(600);
    expect(content("line-one")).toBe("Wait... something is wrong.");
    expect(tid("line-two")).toBeNull();
    await advance(1500 + 1800);
    expect(content("line-two")).toBe("Something else is still in this repository.");
    await advance(20000);
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).not.toBeNull();
    expect(content("report-classification")).toBe(fixture.epistemic_classification);

    // Play the real game with the keyboard, using the deterministic engine to choose the moves.
    const count = buildClues(fixture).length;
    let model = createGame(fixture.investigation_id, count);
    const keyFor: Record<Action, string> = { UP: "ArrowUp", DOWN: "ArrowDown", LEFT: "ArrowLeft", RIGHT: "ArrowRight", WAIT: " " };
    const gameEl = must("escape");
    for (let turns = 0; turns < 3000 && model.status === "PLAYING"; turns += 1) {
      const pending = model.fragments.filter((fragment) => !fragment.collected);
      const goal = pending.length > 0 ? (pending[0] as (typeof pending)[number]).at : model.exit;
      const route = pathActions(model.tiles, model.player, goal);
      const action: Action = route && route.length > 0 ? (route[0] as Action) : "WAIT";
      model = step(model, action);
      await pressKey(gameEl, keyFor[action]);
      if (tid("escape") === null) break;
    }
    await advance(5000);
    expect(model.status).toBe("ESCAPED");
    expect(tid("escape")).toBeNull();
    expect(content("ui-state")).not.toBe("");
    expect(content("report-status")).toBe(fixture.retrieval_status);
    expect(content("report-classification")).toBe(fixture.epistemic_classification);
    expect(content("report-conclusion")).toBe(fixture.conclusion);
    // Every evidence record is still listed after the story.
    for (const evidence of fixture.evidence) expect(document.body.textContent).toContain(evidence.commit_hash?.slice(0, 7) ?? evidence.evidence_id);
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("skips the cinematic straight to the report without losing evidence", async () => {
    const fixture = complete().body;
    const submit = submitReturning(resultOutcome(fixture));
    await mount({ submit });
    await fillAndSubmit();
    await click(must("skip-cinematic"));
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).toBeNull();
    expect(content("report-classification")).toBe(fixture.epistemic_classification);
    await advance(60000);
    expect(tid("interruption")).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("skips the interruption and the game and ends at the same report", async () => {
    const fixture = complete().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await submitAndSettle();
    await advance(INTERRUPTION_DELAY_MS);
    await click(byRole("button", "Skip to the report") as HTMLElement);
    expect(tid("interruption")).toBeNull();
    expect(content("report-conclusion")).toBe(fixture.conclusion);
  });

  it("skips the game and keeps every collected-or-not evidence record", async () => {
    const fixture = complete().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await reachEscape();
    await click(byRole("button", "Skip the game") as HTMLElement);
    expect(tid("escape")).toBeNull();
    expect(content("report-conclusion")).toBe(fixture.conclusion);
    expect(tid("timeline")).not.toBeNull();
  });

  it("shows no author name in the game clues", async () => {
    const fixture = complete().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await reachEscape();
    const game = must("escape").textContent ?? "";
    for (const evidence of fixture.evidence) {
      const author = (evidence as unknown as { author?: { name?: string } | null }).author?.name;
      if (author) expect(game).not.toContain(author);
    }
  });
});

describe("classification rendering and the no-fabrication rules", () => {
  it("partial evidence shows its limitation and keeps the partial notice through the scenes", async () => {
    const fixture = partial().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await submitAndSettle();
    expect(content("report-classification")).toBe("PARTIAL_EVIDENCE");
    expect(content("report-status")).toBe("PARTIAL");
    expect(tid("partial-notice")).not.toBeNull();
    expect(tid("limitations")?.children.length ?? 0).toBe(fixture.limitations.length);
    await advance(INTERRUPTION_DELAY_MS);
    expect(tid("interruption")).not.toBeNull();
    expect(tid("partial-notice")).not.toBeNull();
    await advance(20000);
    expect(tid("escape")).not.toBeNull();
    expect(tid("partial-notice")).not.toBeNull();
    expect(content("report-classification")).toBe("PARTIAL_EVIDENCE");
  });

  it("insufficient evidence shows only the neutral phrase, no interruption, and no conclusion upgrade", async () => {
    const fixture = insufficient().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await submitAndSettle();
    expect(content("phrase")).toBe("INSUFFICIENT EVIDENCE");
    expect(content("report-classification")).toBe("INSUFFICIENT_EVIDENCE");
    expect(content("report-status")).toBe("INSUFFICIENT");
    await advance(60000);
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).toBeNull();
    expect(content("report-status")).toBe("INSUFFICIENT");
  });

  it("a failed retrieval shows no reveal and no interruption", async () => {
    const fixture = failed().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)) });
    await submitAndSettle();
    await advance(60000);
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).toBeNull();
    expect(tid("report")).toBeNull();
    expect(tid("phrase")).toBeNull();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("renders only https source links and never executes source text", async () => {
    const fixture = clone(complete().body);
    const first = fixture.evidence[0];
    if (!first) throw new Error("fixture has no evidence");
    first.excerpt = "<img src=x onerror=alert(1)><script>window.__pwned=1</script>";
    first.title = "<b>bold</b>";
    first.source_url = "javascript:alert(1)";
    await mount({ submit: submitReturning({ kind: "result", result: fixture }) });
    await submitAndSettle();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    for (const anchor of Array.from(document.querySelectorAll("a[href]"))) {
      expect(anchor.getAttribute("href")).toMatch(/^https:\/\//);
      expect(anchor.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("errors and cancellation", () => {
  const cases: Array<[string, SubmitOutcome]> = [
    ["network failure", { kind: "network" }],
    ["invalid response", { kind: "invalid", reason: "body: wrong shape" }],
    ["rejected request", { kind: "rejected", status: 404, error: { code: "REPOSITORY_NOT_FOUND", message: "No such repository.", retryable: false, field: null, candidates: [] } }],
  ];
  it.each(cases)("%s never reveals, interrupts, or reports success", async (_name, outcome) => {
    const submit = submitReturning(outcome);
    await mount({ submit });
    await fillAndSubmit();
    await advance(60000);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).toBeNull();
    expect(tid("phrase")).toBeNull();
    expect(tid("report")).toBeNull();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
  });

  it("cancelling stops the wait, performs no reveal, and ignores a late result", async () => {
    let release: (outcome: SubmitOutcome) => void = () => undefined;
    const submit = submitReturning(() => new Promise<SubmitOutcome>((resolve) => (release = resolve)));
    await mount({ submit });
    await fillAndSubmit();
    expect(byRole("button", /stop waiting|cancel/i)).not.toBeNull();
    await click(byRole("button", /stop waiting|cancel/i) as HTMLElement);
    expect(tid("cancelled")).not.toBeNull();
    await act(async () => {
      release(resultOutcome(complete().body));
      await Promise.resolve();
    });
    await advance(60000);
    expect(tid("phrase")).toBeNull();
    expect(tid("interruption")).toBeNull();
    expect(tid("report")).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("a second click while investigating does not send a second request", async () => {
    const submit = submitReturning(() => new Promise<SubmitOutcome>(() => undefined));
    await mount({ submit });
    await fillAndSubmit();
    const button = byRole("button", /summon/i) as HTMLButtonElement;
    await click(button);
    await click(button);
    expect(submit).toHaveBeenCalledTimes(1);
  });
});

describe("reduced motion and the horror setting", () => {
  it("under reduced motion the interruption is a static notice and the report is still reachable", async () => {
    const fixture = complete().body;
    await mount({ submit: submitReturning(resultOutcome(fixture)), reduced: true });
    await fillAndSubmit();
    await advance(0);
    await advance(INTERRUPTION_DELAY_MS);
    expect(tid("interruption")).not.toBeNull();
    expect(content("line-one")).toBe("Wait... something is wrong.");
    expect(tid("line-two")).toBeNull();
    await advance(1500);
    expect(content("line-two")).toBe("Something else is still in this repository.");
    expect(byRole("button", "Skip to the report")).not.toBeNull();
    expect(content("report-classification")).toBe(fixture.epistemic_classification);
  });

  it("the motion control writes the data-motion attribute", async () => {
    await mount({ submit: submitReturning(resultOutcome(complete().body)) });
    const select = must("motion") as HTMLSelectElement;
    expect(document.documentElement.getAttribute("data-motion")).toBe(select.value);
    await act(async () => {
      select.value = "reduced";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
  });

  it("with the horror sequence off, the report follows the reveal with no interruption", async () => {
    await mount({ submit: submitReturning(resultOutcome(complete().body)) });
    await click(must("horror-toggle"));
    await submitAndSettle();
    await advance(60000);
    expect(tid("interruption")).toBeNull();
    expect(tid("escape")).toBeNull();
    expect(tid("report")).not.toBeNull();
  });
});

describe("audio", () => {
  it("makes no sound until the user enables it, then honours mute and volume, and disposes on unmount", async () => {
    const contexts: FakeContext[] = [];
    const factory = (): FakeContext => {
      const context = new FakeContext();
      contexts.push(context);
      return context;
    };
    const view = await mount({ submit: submitReturning(resultOutcome(complete().body)), factory });
    await submitAndSettle();
    expect(contexts.length).toBe(0);
    expect(tid("sound-off")).toBeNull();

    await click(must("enable-sound"));
    await flush();
    expect(contexts.length).toBe(1);
    const context = contexts[0] as FakeContext;
    expect(context.state).toBe("running");

    await click(must("mute"));
    expect(must("mute").getAttribute("aria-pressed")).toBe("true");
    const slider = must("volume") as HTMLInputElement;
    await act(async () => {
      slider.value = "0.2";
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect((must("volume") as HTMLInputElement).value).toBe("0.2");

    await view.unmount();
    expect(context.closeCount).toBeGreaterThanOrEqual(1);
    expect(context.liveNodes().length).toBe(0);
  });

});

describe("session restore", () => {
  it("restores a valid stored report without the cinematic and discards invalid storage", async () => {
    const fixture = complete();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ request: fixture.request, result: fixture.body }));
    await mount({ submit: submitReturning(resultOutcome(fixture.body)), restoreSession: true });
    await flush();
    await advance(60000);
    expect(tid("report")).not.toBeNull();
    expect(tid("interruption")).toBeNull();
    expect(tid("restored-note")).not.toBeNull();
  });

  it("ignores corrupt stored data", async () => {
    window.sessionStorage.setItem(SESSION_KEY, "{not json");
    await mount({ submit: submitReturning(resultOutcome(complete().body)), restoreSession: true });
    await flush();
    expect(tid("report")).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_KEY)).toBeNull();
  });
});
