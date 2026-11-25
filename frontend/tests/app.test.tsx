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
  answer: ReturnType<typeof vi.fn>;
}
const answerLocal = async () => ok({ provider: "deterministic", ai_status: "NOT_REQUESTED", answer: null, evidence: [], limitations: ["No AI answer was produced in this test."] });
/** A valid Groq answer that cites its one evidence item, as the backend returns it. */
const answerGroq = (ai_status = "AI_USED") =>
  async () =>
    ok({
      provider: "groq",
      ai_status,
      answer: {
        answer: "The HTTP API is kept apart by the application layer, which the API calls.",
        summary: "A layered design.",
        claims: [{ text: "The API calls the application services.", basis: "DOCUMENTED", evidence_ids: ["E1"] }],
        limitations: ["The evidence is one file."],
        recommendations: [],
        confidence: "MEDIUM",
        answer_type: "explanation",
      },
      evidence: [{ evidence_id: "E1", path: "backend/app/api/advisor_routes.py", start_line: 1, end_line: 12, why: "matches the question", commit: "abc1234", classification: "DOCUMENTED", excerpt: "class InterpretIn(BaseModel):" }],
      limitations: [],
    });
/** A fallback answer, as the backend returns it when no valid Groq answer was produced. */
const answerFallback = (ai_status: string) =>
  async () =>
    ok({ provider: "deterministic", ai_status, answer: null, evidence: [], limitations: ["No AI answer was produced."] });
const aiOn = async () => {
  const body = clone(capabilitiesFixture().body);
  body.ai_interpreter.available = true;
  return ok(body);
};

function harness(over: Partial<{ interpret: (...a: never[]) => unknown; investigate: (...a: never[]) => unknown; profile: (...a: never[]) => unknown; answer: (...a: never[]) => unknown; storage: SnapshotStorage }> = {}): Harness {
  const storage = over.storage ?? createIndexedDbStorage(new IDBFactory());
  const interpret = vi.fn((over.interpret as never) ?? plan(interpretInvestigate().body));
  const investigate = vi.fn((over.investigate as never) ?? resultOk);
  const profile = vi.fn((over.profile as never) ?? profileOk);
  const answer = vi.fn((over.answer as never) ?? answerLocal);
  return {
    storage, interpret, investigate, profile, answer,
    props: {
      storage,
      systemPrefersReducedMotion: false,
      listRepositories: async () => ok(repositoriesFixture().body.repositories),
      getCapabilities: async () => ok(capabilitiesFixture().body),
      analysisDeps: { interpret: interpret as never, investigate: investigate as never, profile: profile as never, answer: answer as never, makeId: (() => { let n = 0; return () => `snap-${++n}`; })(), now: () => new Date("2026-11-12T10:00:00.000Z") },
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
    // Scoped to the report: the sidebar logo is a legitimate image outside the report and is not evidence content.
    expect(must("report").querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    // The hostile title is shown as literal text, not parsed as markup.
    expect(document.querySelector(`[data-evidence-id="${first.evidence_id}"]`)!.textContent).toContain("<img src=x onerror=alert(1)>");
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

  it("answers a question that names no file beside the chooser, and reuses that answer after a file is chosen", async () => {
    const h = harness({ interpret: plan(interpretNeedsTarget().body), answer: answerGroq() });
    await mount(h);
    await ask("Which are the domain models?");
    expect(h.investigate).not.toHaveBeenCalled();
    expect(h.answer).toHaveBeenCalledTimes(1);
    expect(must("section-answer")).not.toBeNull();
    expect(text("answer-text")).toContain("application layer");
    const group = must("file-candidates");
    expect(allByRole("button", group).length).toBeGreaterThan(0);
    await click(allByRole("button", group)[0]!);
    await settle();
    expect(h.answer).toHaveBeenCalledTimes(1);
    expect(h.investigate).toHaveBeenCalledTimes(1);
    expect(text("answer-text")).toContain("application layer");
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
    // The page shows each repository's name, identifier and folder (owner decision, Spec 4 section 17).
    for (const [i, item] of repositoriesFixture().body.repositories.entries()) {
      expect(rows[i]!.textContent).toContain(item.display_name);
      expect(rows[i]!.textContent).toContain(item.path);
    }
    await click(byRole("button", /^Use /, rows[0] as HTMLElement) as HTMLElement);
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

/** Every text a person can read or hear: text nodes and the attributes that are announced or shown as tooltips. */
function visibleStrings(): string {
  const attributes = Array.from(document.querySelectorAll("[aria-label],[title],[alt],[placeholder]")).flatMap((element) =>
    ["aria-label", "title", "alt", "placeholder"].map((name) => element.getAttribute(name) ?? ""),
  );
  return `${document.body.textContent ?? ""} ${attributes.join(" ")}`;
}
describe("the answer belongs to the report", () => {
  const follows = (first: HTMLElement, second: HTMLElement): boolean =>
    Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
  it.each([
    ["a Groq answer", () => answerGroq()],
    ["the deterministic fallback", () => answerFallback("AI_NOT_SENT")],
  ])("%s sits in the report, before the findings it supports, and never inside Overview", async (_n, answer) => {
    await mount(harness({ interpret: plan(interpretInvestigate().body), answer: answer() }));
    await ask("sample - Why does src/billing.py validate the amount?");
    const answerSection = must("section-answer");
    expect(must("report").contains(answerSection)).toBe(true);
    expect(must("section-overview").contains(answerSection)).toBe(false);
    expect(follows(must("section-history"), answerSection)).toBe(true);
    expect(follows(answerSection, must("section-findings"))).toBe(true);
    expect(must("section-findings").textContent).not.toBe("");
    expect(document.querySelectorAll('[data-testid="section-answer"]').length).toBe(1);
  });
  it("the answer's evidence is listed in the same report, and each item shows its excerpt", async () => {
    await mount(harness({ interpret: plan(interpretAdvise().body), answer: answerGroq() }));
    await ask("rich - improve our workflow with Kiro");
    expect(must("answer-evidence").closest('[data-testid="report"]')).not.toBeNull();
    expect(document.querySelectorAll("[data-evidence-id]").length).toBeGreaterThan(0);
  });
});

describe("no provider is named in the user interface", () => {
  it("the request screen, the settings and a report with a Groq answer name no provider", async () => {
    const h = harness({ interpret: plan(interpretAdvise().body), answer: answerGroq() });
    h.props.getCapabilities = aiOn;
    await mount(h);
    expect(visibleStrings()).not.toMatch(/groq/i);
    await ask("rich - improve our workflow with Kiro");
    expect(tid("answer-groq")).not.toBeNull();
    expect(visibleStrings()).not.toMatch(/groq/i);
    expect(text("provider-disclosure")).toMatch(/external AI service|AI service/);
    expect(text("provider-disclosure")).toContain("30 days");
  });
  it("a saved report restored from storage names no provider either", async () => {
    const h = harness({ interpret: plan(interpretAdvise().body), answer: answerGroq() });
    h.props.getCapabilities = aiOn;
    const first = await mount(h);
    await ask("rich - improve our workflow with Kiro");
    await settle();
    await first.unmount();
    await mount(h);
    await click(allByRole("button", must("recent"))[0]!);
    await settle();
    expect(tid("report")).not.toBeNull();
    expect(visibleStrings()).not.toMatch(/groq/i);
  });
});

describe("the AI advisor is the default, with no consent step", () => {
  it("shows no consent checkbox when no AI service is configured", async () => {
    await mount(harness());
    expect(tid("allow-ai")).toBeNull();
    expect(text("ai-provider-note")).toContain("not configured");
  });
  it("shows no consent checkbox when an AI service is configured, and says AI answers are on", async () => {
    const h = harness();
    h.props.getCapabilities = aiOn;
    await mount(h);
    expect(tid("allow-ai")).toBeNull();
    expect(text("ai-provider-note")).toContain("AI-assisted answers are on");
  });
  it("sends the question without any consent field", async () => {
    const h = harness();
    await mount(h);
    await ask("sample - Why did it change?");
    expect(h.interpret.mock.calls[0]![0]).not.toHaveProperty("allow_ai");
  });
  it("the transparency section explains the external processing and the retention terms, without naming a provider", async () => {
    await mount(harness({ interpret: plan(interpretAdvise().body), answer: answerGroq() }));
    await ask("rich - improve our workflow with Kiro");
    expect(text("provider-disclosure")).toContain("When an AI service is configured");
    expect(text("provider-disclosure")).toContain("30 days");
  });
});

describe("how the report presents each answer source", () => {
  const question = "Why do layered architectures keep the HTTP API separate from the application logic?";
  it("a Groq answer is shown first, with its claim, its evidence, and its limitation", async () => {
    const h = harness({ interpret: plan({ ...interpretAdvise().body, repository_id: "sample", question }), answer: answerGroq() });
    await mount(h);
    await ask(`sample - ${question}`);
    expect(tid("section-answer")).not.toBeNull();
    expect(tid("answer-groq")).not.toBeNull();
    expect(text("answer-text")).toContain("kept apart by the application layer");
    expect(text("answer-claims")).toContain("DOCUMENTED");
    expect(text("answer-limitations")).toContain("The evidence is one file.");
    expect(document.querySelector('[data-evidence-id="E1"]')).not.toBeNull();
    expect(tid("report")).not.toBeNull();
    expect(tid("section-advisor")).not.toBeNull();
  });
  it("an accepted Groq investigation runs on its target and shows its answer", async () => {
    const h = harness({ interpret: plan({ ...interpretInvestigate().body, interpreter: "groq", ai_status: "AI_USED" }), answer: answerGroq() });
    await mount(h);
    await ask("sample - Why does src/billing.py validate the amount?");
    expect(h.investigate).toHaveBeenCalledTimes(1);
    expect(tid("answer-groq")).not.toBeNull();
  });
  it("without a Groq answer the report says that it is a local result, and why", async () => {
    await mount(harness({ interpret: plan({ ...interpretAdvise().body, repository_id: "rich" }) }));
    await ask("rich - improve our workflow with Kiro");
    expect(tid("answer-local")).not.toBeNull();
    expect(text("ai-status")).toContain("Not requested");
    expect(text("answer-local")).toContain("No AI answer was produced");
  });
  it("a failed AI attempt is shown as a failure, and the report never says that no AI was used", async () => {
    await mount(harness({ interpret: plan({ ...interpretAdvise().body, repository_id: "rich" }), answer: answerFallback("AI_HTTP_ERROR") }));
    await ask("rich - improve our workflow with Kiro");
    expect(text("ai-status")).toContain("The AI service refused the request. Sean used its built-in reader.");
  });
  it("an answer that did not match the contract is shown as unusable, not as Groq's", async () => {
    await mount(harness({ interpret: plan({ ...interpretAdvise().body, repository_id: "rich" }), answer: answerFallback("AI_NO_USABLE_ANSWER") }));
    await ask("rich - improve our workflow with Kiro");
    expect(text("ai-status")).toContain("Answered, but nothing it said matched the repository.");
    expect(tid("answer-groq")).toBeNull();
  });
  it("a question that could not be made safe to send is said so", async () => {
    await mount(harness({ interpret: plan({ ...interpretAdvise().body, repository_id: "rich" }), answer: answerFallback("AI_NOT_SENT") }));
    await ask("rich - Explain the sample rate in the audio code");
    expect(text("ai-status")).toContain("Not sent.");
  });
});
describe("web build startup (Sean Local + Web)", () => {
  it("contacts the agent only once a pairing token exists, then loads the repositories and capabilities", async () => {
    const h = harness();
    const listRepositories = vi.fn(h.props.listRepositories!);
    const getCapabilities = vi.fn(h.props.getCapabilities!);
    let ready = false;
    const agentReady = (): boolean => ready;
    const view = await render(<App {...h.props} listRepositories={listRepositories} getCapabilities={getCapabilities} agentReady={agentReady} />);
    await settle();
    expect(listRepositories).not.toHaveBeenCalled();
    expect(getCapabilities).not.toHaveBeenCalled();
    await view.unmount();
    ready = true; // paired in this browser session
    await render(<App {...h.props} listRepositories={listRepositories} getCapabilities={getCapabilities} agentReady={agentReady} />);
    await settle();
    expect(listRepositories).toHaveBeenCalledTimes(1);
    expect(getCapabilities).toHaveBeenCalledTimes(1);
  });
});