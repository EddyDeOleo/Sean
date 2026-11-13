/**
 * The application as a user meets it: the shell, the request screen, the report, saved reports and settings.
 * The backend functions are injected with responses captured from the real backend (tests/fixtures). Storage is a real
 * IndexedDB implementation (fake-indexeddb).
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, type AppProps } from "../src/app/App";
import { createIndexedDbStorage, type SnapshotStorage } from "../src/features/report/reportStore";
import type { CallOutcome } from "../src/services/advisorClient";
import type { SubmitOutcome } from "../src/services/investigationClient";
import type { InterpretedRequest, ProfileResponse } from "../src/types/advisor";
import { act, allByRole, byRole, click, flush, pressKey, render, type } from "./renderHelpers";
import {
  clone, complete, insufficient, interpretAdvise, interpretInvestigate, interpretNeedsTarget, interpretUnresolved, ambiguous,
  capabilitiesFixture, profileRich, repositoriesFixture,
} from "./fixtures";

const tid = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const must = (id: string): HTMLElement => {
  const found = tid(id);
  if (!found) throw new Error(`missing test id ${id}`);
  return found;
};
const text = (id: string): string => tid(id)?.textContent ?? "";

const ok = <T,>(value: T): CallOutcome<T> => ({ kind: "ok", value: clone(value) });
const plan = (body: InterpretedRequest) => async () => ok(body);
const profileOk = async (): Promise<CallOutcome<ProfileResponse>> => ok(profileRich().body);
const resultOk = async (): Promise<SubmitOutcome> => ({ kind: "result", result: clone(complete().body) });

async function settle(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
}

interface Harness {
  props: AppProps;
  storage: SnapshotStorage;
  interpret: ReturnType<typeof vi.fn>;
  investigate: ReturnType<typeof vi.fn>;
  profile: ReturnType<typeof vi.fn>;
}
const aiOn = async () => {
  const body = clone(capabilitiesFixture().body);
  body.ai_interpreter.available = true;
  return ok(body);
};

function harness(over: Partial<{ interpret: (...a: never[]) => unknown; investigate: (...a: never[]) => unknown; profile: (...a: never[]) => unknown; storage: SnapshotStorage }> = {}): Harness {
  const storage = over.storage ?? createIndexedDbStorage(new IDBFactory());
  const interpret = vi.fn((over.interpret as never) ?? plan(interpretInvestigate().body));
  const investigate = vi.fn((over.investigate as never) ?? resultOk);
  const profile = vi.fn((over.profile as never) ?? profileOk);
  return {
    storage, interpret, investigate, profile,
    props: {
      storage,
      systemPrefersReducedMotion: false,
      listRepositories: async () => ok(repositoriesFixture().body.repositories),
      getCapabilities: async () => ok(capabilitiesFixture().body),
      analysisDeps: { interpret: interpret as never, investigate: investigate as never, profile: profile as never, makeId: (() => { let n = 0; return () => `snap-${++n}`; })(), now: () => new Date("2026-11-12T10:00:00.000Z") },
    },
  };
}

async function mount(h: Harness) {
  const view = await render(<App {...h.props} />);
  await settle();
  return view;
}
async function ask(sentence: string): Promise<void> {
  await type(byRole("textbox", "Your request") as HTMLTextAreaElement, sentence);
  await click(byRole("button", "Investigate") as HTMLElement);
  await settle();
}

beforeEach(() => {
  window.localStorage.clear();
  // The surprise experience has its own tests (interlude.test.tsx); here the report opens at once.
  window.localStorage.setItem("sean.settings.v1", JSON.stringify({ horror: false }));
});

describe("first impression", () => {
  it("opens as an engineering tool with the navigation and one request field, and shows nothing of the hidden experience", async () => {
    await mount(harness());
    expect(byRole("heading", "What would you like to understand?")).not.toBeNull();
    const nav = must("sidebar");
    for (const label of ["New Investigation", "Saved Reports", "Repositories", "Settings"]) expect(byRole("button", label, nav)).not.toBeNull();
    expect(byRole("textbox", "Your request")).not.toBeNull();
    expect(byRole("button", "Investigate")).not.toBeNull();
    const everything = document.body.textContent!.toLowerCase();
    for (const word of ["ouija", "planchette", "haunt", "ghost", "escape", "horror", "something is wrong"]) expect(everything).not.toContain(word);
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("lists the available repositories for context", async () => {
    await mount(harness());
    const options = Array.from(document.querySelectorAll("select option")).map((o) => o.textContent);
    expect(options).toEqual(expect.arrayContaining(["sample", "sean", "rich"].filter((id) => repositoriesFixture().body.repositories.some((r) => r.repository_id === id))));
  });
});

describe("a request", () => {
  it("is not sent when empty", async () => {
    const h = harness();
    await mount(h);
    await click(byRole("button", "Investigate") as HTMLElement);
    await settle();
    expect(h.interpret).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Describe what you want");
  });

  it("goes through progress to the unified report with one request set", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why does src/billing.py validate the amount?");
    expect(h.interpret).toHaveBeenCalledTimes(1);
    expect(h.investigate).toHaveBeenCalledTimes(1);
    expect(h.profile).toHaveBeenCalledTimes(1);
    expect(tid("report")).not.toBeNull();
    for (const id of ["section-overview", "section-history", "section-findings", "section-advisor", "section-roadmap", "section-transparency"]) expect(tid(id), id).not.toBeNull();
    expect(tid("report")!.getAttribute("data-origin")).toBe("fresh");
  });

  it("can be submitted with the keyboard", async () => {
    const h = harness();
    await mount(h);
    const field = byRole("textbox", "Your request") as HTMLTextAreaElement;
    await type(field, "sample - Why does src/billing.py exist?");
    await pressKey(field, "Enter", { ctrlKey: true });
    await settle();
    expect(h.interpret).toHaveBeenCalledTimes(1);
  });

  it("an advisory request shows no file history and says why", async () => {
    const h = harness({ interpret: plan(interpretAdvise().body) });
    await mount(h);
    await ask("rich - improve our workflow with Kiro");
    expect(h.investigate).not.toHaveBeenCalled();
    expect(text("history-missing")).toContain("No file history was requested");
    expect(tid("section-advisor")).not.toBeNull();
  });
});

describe("the report keeps the evidence and the labels exactly", () => {
  it("shows backend values unchanged", async () => {
    const fixture = complete().body;
    await mount(harness());
    await ask("sample - Why?");
    expect(text("report-status")).toBe(fixture.retrieval_status);
    expect(text("report-classification")).toBe(fixture.epistemic_classification);
    expect(text("report-conclusion")).toBe(fixture.conclusion);
    expect(text("report-explanation")).toBe(fixture.explanation);
    expect(text("limitations")).toContain(fixture.limitations[0]?.message ?? "");
  });

  it("insufficient evidence shows no conclusion", async () => {
    const h = harness({ investigate: async () => ({ kind: "result", result: clone(insufficient().body) }) });
    await mount(h);
    await ask("sample - Why?");
    expect(text("report-classification")).toBe("INSUFFICIENT_EVIDENCE");
    expect(text("report-status")).toBe("INSUFFICIENT");
    expect(text("report-conclusion")).toContain("No conclusion");
  });

  it("lists every evidence record of the result and no other", async () => {
    const fixture = complete().body;
    await mount(harness());
    await ask("sample - Why?");
    const shown = Array.from(document.querySelectorAll("[data-evidence-id]")).map((e) => e.getAttribute("data-evidence-id"));
    expect(new Set(shown)).toEqual(new Set(fixture.evidence.map((e) => e.evidence_id)));
  });

  it("every recommendation's evidence lines come from the profile's own observations", async () => {
    const body = profileRich().body;
    const explanations = new Set(body.profile.observations.map((o) => o.explanation));
    await mount(harness());
    await ask("sample - Why?");
    const cards = document.querySelectorAll('[data-testid="recommendation"]');
    expect(cards.length).toBe(body.advisor.recommendations.length);
    for (const card of Array.from(cards)) {
      const capability = card.getAttribute("data-capability")!;
      const rec = body.advisor.recommendations.find((r) => r.capability === capability)!;
      const lines = Array.from(card.querySelectorAll('[data-testid="rec-evidence"] li')).map((li) => li.textContent ?? "");
      expect(lines.length).toBe(rec.evidence_references.length);
      for (const line of lines) expect(Array.from(explanations).some((e) => line.includes(e))).toBe(true);
    }
  });

  it("separates recommendations by status and shows the roadmap bands", async () => {
    const body = profileRich().body;
    await mount(harness());
    await ask("sample - Why?");
    const adopt = document.querySelectorAll('[data-status="ADOPT_NOW"][data-testid="recommendation"]');
    expect(adopt.length).toBe(body.advisor.recommendations.filter((r) => r.recommendation_status === "ADOPT_NOW").length);
    for (const band of ["roadmap-immediate", "roadmap-near", "roadmap-long"]) expect(tid(band)).not.toBeNull();
    expect(text("roadmap-immediate")).toContain("Steering");
  });

  it("states what was not analyzed and which interpreter was used", async () => {
    await mount(harness());
    await ask("sample - Why?");
    expect(text("profile-limitations")).toContain("Pull requests, issues and CI results");
    expect(text("interpreter")).toContain("deterministic");
  });

  it("renders repository text as text and links only https addresses", async () => {
    const hostile = clone(complete().body);
    const first = hostile.evidence[0]!;
    first.title = "<img src=x onerror=alert(1)>";
    first.excerpt = "<script>window.__xss=1</script>";
    first.source_url = "javascript:alert(1)";
    const second = hostile.evidence[1]!;
    second.source_url = "https://example.com/commit/1";
    const h = harness({ investigate: async () => ({ kind: "result", result: hostile }) });
    await mount(h);
    await ask("sample - Why?");
    await click(document.querySelector(`[data-evidence-id="${first.evidence_id}"] button`)!);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
    expect(must("evidence-detail").textContent).toContain("<script>window.__xss=1</script>");
    for (const a of Array.from(document.querySelectorAll("main a[href]"))) {
      const href = a.getAttribute("href")!;
      expect(href.startsWith("https://") || href.startsWith("#")).toBe(true);
      if (href.startsWith("https://")) expect(a.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("independent parts", () => {
  it("a failed Advisor leaves the investigation intact and explains the gap", async () => {
    await mount(harness({ profile: async () => ({ kind: "network" }) }));
    await ask("sample - Why?");
    expect(text("report-conclusion")).toBe(complete().body.conclusion);
    expect(text("analysis-missing")).toContain("could not be reached");
    expect(text("advisor-missing")).toContain("No recommendations");
    expect(tid("section-roadmap")).toBeNull();
  });

  it("a failed investigation leaves the Advisor intact", async () => {
    await mount(harness({ investigate: async () => ({ kind: "network" }) }));
    await ask("sample - Why?");
    expect(text("history-missing")).toContain("could not be reached");
    expect(tid("recommendation")).not.toBeNull();
  });

  it("when nothing is available there is an error and no report", async () => {
    await mount(harness({ investigate: async () => ({ kind: "network" }), profile: async () => ({ kind: "network" }) }));
    await ask("sample - Why?");
    expect(tid("report")).toBeNull();
    expect(must("analysis-error").getAttribute("data-kind")).toBe("NOTHING_AVAILABLE");
  });

  it("network failure of the first step says nothing about the evidence", async () => {
    await mount(harness({ interpret: async () => ({ kind: "network" }) }));
    await ask("sample - Why?");
    expect(text("analysis-error")).toContain("says nothing about the repository");
    expect(tid("report")).toBeNull();
  });

  it("an unresolved repository explains that Sean does not clone", async () => {
    await mount(harness({ interpret: plan(interpretUnresolved().body) }));
    await ask("https://github.com/company/project - explain");
    expect(tid("report")).toBeNull();
    expect(text("analysis-error")).toContain("does not clone");
  });
});

describe("choices Sean does not make for the user", () => {
  it("offers files by name and runs once after one is chosen", async () => {
    const h = harness({ interpret: plan(interpretNeedsTarget().body) });
    await mount(h);
    await ask("sample - Why was the billing logic introduced?");
    expect(h.investigate).not.toHaveBeenCalled();
    const group = must("file-candidates");
    const choices = allByRole("button", group).map((b) => b.textContent);
    expect(choices.length).toBeGreaterThan(0);
    await click(allByRole("button", group)[0]!);
    await settle();
    expect(h.investigate).toHaveBeenCalledTimes(1);
    expect(h.investigate.mock.calls[0]![0].target.path).toBe(choices[0]);
    expect(tid("report")).not.toBeNull();
  });

  it("offers the ambiguous definitions and asks again with the chosen one", async () => {
    const calls: unknown[] = [];
    const h = harness({
      investigate: async (request: unknown) => {
        calls.push(request);
        return calls.length === 1
          ? { kind: "rejected", status: 409, error: { ...ambiguous().body, field: null } }
          : { kind: "result", result: clone(complete().body) };
      },
    });
    await mount(h);
    await ask("sample - Why does `run` in src/billing.py exist?");
    const group = must("symbol-candidates");
    const names = allByRole("button", group).map((b) => b.textContent);
    expect(names).toEqual(ambiguous().body.candidates);
    await click(allByRole("button", group)[1]!);
    await settle();
    expect(calls).toHaveLength(2);
    expect((calls[1] as { target: { symbol: string } }).target.symbol).toBe(names[1]);
    expect(tid("report")).not.toBeNull();
  });
});

describe("cancelling", () => {
  it("stops waiting without a conclusion and ignores the late result", async () => {
    let release: (o: SubmitOutcome) => void = () => undefined;
    const h = harness({ investigate: () => new Promise<SubmitOutcome>((r) => (release = r)) });
    await mount(h);
    await ask("sample - Why?");
    expect(tid("progress")).not.toBeNull();
    await click(byRole("button", "Stop waiting") as HTMLElement);
    expect(tid("cancelled")).not.toBeNull();
    await act(async () => release({ kind: "result", result: clone(complete().body) }));
    await settle();
    expect(tid("report")).toBeNull();
    expect(tid("cancelled")).not.toBeNull();
  });
});

describe("saved reports", () => {
  it("saves each report, lists it, and reopens it as a saved snapshot with identical content", async () => {
    const h = harness();
    const first = await mount(h);
    await ask("sample - Why does src/billing.py exist?");
    const conclusion = text("report-conclusion");
    await first.unmount();

    await mount(h);
    expect(allByRole("listitem", must("recent")).length).toBe(1);
    await click(byRole("button", "Saved Reports") as HTMLElement);
    await settle();
    expect(document.querySelectorAll('[data-testid="saved-row"]').length).toBe(1);
    await click(byRole("button", "Open") as HTMLElement);
    await settle();
    expect(must("report").getAttribute("data-origin")).toBe("saved");
    expect(text("report-conclusion")).toBe(conclusion);
    expect(text("provenance")).toContain("SAVED SNAPSHOT");
  });

  it("opens a report from the sidebar", async () => {
    const h = harness();
    const first = await mount(h);
    await ask("sample - Why?");
    await first.unmount();
    await mount(h);
    await click(byRole("button", /Why/, must("recent")) as HTMLElement);
    await settle();
    expect(must("report").getAttribute("data-origin")).toBe("saved");
  });

  it("deletes a report", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why?");
    await click(byRole("button", "Saved Reports") as HTMLElement);
    await settle();
    await click(byRole("button", /Delete saved report/) as HTMLElement);
    await settle();
    expect(tid("no-saved")).not.toBeNull();
  });

  it("a stored report that no longer validates is removed and reported, never shown", async () => {
    const h = harness();
    const first = await mount(h);
    await ask("sample - Why?");
    await first.unmount();
    const rows = await h.storage.all();
    const tampered = JSON.parse(JSON.stringify(rows[0]));
    tampered.snapshot.analysis.advisor.recommendations[0].evidence_references = ["obs-forged"];
    tampered.snapshot.analysis.advisor.recommendations[0].recommendation_status = "ADOPT_NOW";
    await h.storage.put(tampered);
    await mount(h);
    await click(byRole("button", /Why/, must("recent")) as HTMLElement);
    await settle();
    expect(tid("report")).toBeNull();
    expect(text("open-note")).toContain("could not be opened");
    expect(await h.storage.all()).toEqual([]);
  });

  it("works without storage: the report is shown with a note and the list says it is unavailable", async () => {
    const broken: SnapshotStorage = {
      put: async () => Promise.reject(new Error("blocked")),
      get: async () => Promise.reject(new Error("blocked")),
      all: async () => Promise.reject(new Error("blocked")),
      remove: async () => Promise.reject(new Error("blocked")),
    };
    const h = harness({ storage: broken });
    await mount(h);
    await ask("sample - Why?");
    expect(tid("report")).not.toBeNull();
    expect(text("save-note")).toContain("could not be saved");
    await click(byRole("button", "Saved Reports") as HTMLElement);
    await settle();
    expect(tid("storage-unavailable")).not.toBeNull();
  });

  it("a game or any later experience cannot alter a saved snapshot: the stored record is frozen data", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why?");
    const before = JSON.stringify((await h.storage.all())[0]);
    await click(byRole("button", "New Investigation") as HTMLElement);
    await settle();
    expect(JSON.stringify((await h.storage.all())[0])).toBe(before);
  });
});

describe("navigation, settings and preferences", () => {
  it("collapses and expands the sidebar, remembers it, and keeps every item reachable", async () => {
    const first = await mount(harness());
    const toggle = must("sidebar-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await click(toggle);
    expect(must("sidebar-toggle").getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".sx-shell")!.getAttribute("data-collapsed")).toBe("true");
    for (const label of ["New Investigation", "Saved Reports", "Repositories", "Settings"]) expect(byRole("button", label, must("sidebar"))).not.toBeNull();
    await first.unmount();
    await mount(harness());
    expect(document.querySelector(".sx-shell")!.getAttribute("data-collapsed")).toBe("true");
  });

  it("lists the repositories and uses one as the context", async () => {
    await mount(harness());
    await click(byRole("button", "Repositories") as HTMLElement);
    await settle();
    const rows = document.querySelectorAll('[data-testid="repository-row"]');
    expect(rows.length).toBe(repositoriesFixture().body.repositories.length);
    expect(document.body.textContent).not.toMatch(/[A-Z]:\\/);
    await click(byRole("button", "Use", rows[0] as HTMLElement) as HTMLElement);
    await settle();
    expect((document.querySelector("select") as HTMLSelectElement).value).toBe(repositoriesFixture().body.repositories[0]!.repository_id);
  });

  it("changes the motion preference and writes it to the document", async () => {
    await mount(harness());
    await click(byRole("button", "Settings") as HTMLElement);
    await settle();
    const select = must("motion") as HTMLSelectElement;
    await act(async () => {
      select.value = "reduced";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(document.documentElement.getAttribute("data-motion")).toBe("reduced");
    expect(text("motion-status")).toContain("reduced");
    expect(JSON.parse(window.localStorage.getItem("sean.settings.v1")!).motion).toBe("reduced");
  });

  it("deletes all saved reports only after confirmation", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why?");
    await click(byRole("button", "Settings") as HTMLElement);
    await settle();
    await click(byRole("button", /Delete saved reports/) as HTMLElement);
    expect((await h.storage.all()).length).toBe(1);
    await click(byRole("button", "Keep them") as HTMLElement);
    expect((await h.storage.all()).length).toBe(1);
    await click(byRole("button", /Delete saved reports/) as HTMLElement);
    await click(byRole("button", "Delete all saved reports") as HTMLElement);
    await settle();
    expect(await h.storage.all()).toEqual([]);
    expect(text("clear-status")).toContain("were deleted");
  });

  it("New Investigation returns to a clean request screen", async () => {
    await mount(harness());
    await ask("sample - Why?");
    await click(byRole("button", "New Investigation") as HTMLElement);
    await settle();
    expect(tid("report")).toBeNull();
    expect(byRole("heading", "What would you like to understand?")).not.toBeNull();
  });

  it("announces progress for assistive technology", async () => {
    await mount(harness());
    await ask("sample - Why?");
    await flush();
    expect(text("phase-announcer")).toBe("The report is ready.");
  });
});

describe("consent to use an AI provider", () => {
  it("offers nothing to consent to when the backend has no AI provider", async () => {
    await mount(harness());
    expect(tid("allow-ai")).toBeNull();
    expect(tid("ai-disclosure")).toBeNull();
  });

  it("offers an unchecked, explained choice when one exists, and sends consent for one request only", async () => {
    const h = harness();
    h.props.getCapabilities = aiOn;
    await mount(h);
    const box = must("allow-ai") as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(text("ai-disclosure")).toContain("nothing from the repository");
    expect(text("ai-disclosure")).toContain("may keep it");

    await ask("sample - Why did it change?");
    expect(h.interpret.mock.calls[0]![0].allow_ai).toBe(false);

    await click(byRole("button", "New Investigation") as HTMLElement);
    await settle();
    await click(must("allow-ai"));
    expect((must("allow-ai") as HTMLInputElement).checked).toBe(true);
    await ask("sample - Why did it change?");
    expect(h.interpret.mock.calls[1]![0].allow_ai).toBe(true);

    await click(byRole("button", "New Investigation") as HTMLElement);
    await settle();
    expect((must("allow-ai") as HTMLInputElement).checked).toBe(false);
  });

  it("never sends consent when the choice is not offered", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why?");
    expect(h.interpret.mock.calls[0]![0].allow_ai).toBe(false);
  });
});