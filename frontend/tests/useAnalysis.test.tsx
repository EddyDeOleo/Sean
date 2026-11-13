/**
 * The analysis flow: interpret, then investigate and profile together (Spec 4 sections 9.2 and 13).
 * The API functions are injected; every payload is a response captured from the real backend.
 */
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { useAnalysis, type Analysis, type AnalysisDependencies } from "../src/features/analysis/useAnalysis";
import type { CallOutcome } from "../src/services/advisorClient";
import type { SubmitOutcome } from "../src/services/investigationClient";
import type { InterpretedRequest, ProfileResponse } from "../src/types/advisor";
import type { ReportSnapshot } from "../src/features/report/reportSnapshot";
import { act, render } from "./renderHelpers";
import { clone, complete, failed, interpretAdvise, interpretInvestigate, interpretNeedsTarget, interpretUnresolved, notRegistered, profileRich } from "./fixtures";

const plan = (fixtureBody: InterpretedRequest): CallOutcome<InterpretedRequest> => ({ kind: "ok", value: clone(fixtureBody) });
const profile = (): CallOutcome<ProfileResponse> => ({ kind: "ok", value: clone(profileRich().body) });
const result = (): SubmitOutcome => ({ kind: "result", result: clone(complete().body) });

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function mount(deps: Partial<AnalysisDependencies>, onSnapshot?: (s: ReportSnapshot) => void) {
  const ref: { current: Analysis | null } = { current: null };
  function Probe() {
    const analysis = useAnalysis({ deps: { makeId: () => "snap-test", now: () => new Date("2026-11-12T10:00:00.000Z"), ...deps }, onSnapshot });
    useEffect(() => {
      ref.current = analysis;
    });
    return null;
  }
  return { ref, ready: render(<Probe />) };
}

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("a complete analysis", () => {
  it("interprets once, investigates and profiles once each, and builds one snapshot", async () => {
    const interpret = vi.fn(async (_body: unknown, _options?: unknown) => plan(interpretInvestigate().body));
    const investigate = vi.fn(async (_request: unknown, _options?: unknown) => result());
    const prof = vi.fn(async (_id: string, _options?: unknown) => profile());
    const saved: ReportSnapshot[] = [];
    const { ref, ready } = mount({ interpret, investigate, profile: prof }, (s) => saved.push(s));
    await ready;
    await act(async () => ref.current!.submit("sample - Why does src/billing.py validate?", "sample"));
    await settle();
    const { state } = ref.current!;
    expect(state.phase).toBe("READY");
    expect(interpret).toHaveBeenCalledTimes(1);
    expect(investigate).toHaveBeenCalledTimes(1);
    expect(prof).toHaveBeenCalledTimes(1);
    expect(interpret.mock.calls[0]![0]).toEqual({ text: "sample - Why does src/billing.py validate?", selected_repository_id: "sample", allow_ai: false });
    const body = investigate.mock.calls[0]![0];
    expect(body).toEqual({ repository_id: "sample", target: { path: "src/billing.py" }, question: expect.any(String) });
    expect(state.snapshot?.id).toBe("snap-test");
    expect(state.snapshot?.investigation?.retrieval_status).toBe("COMPLETE");
    expect(state.snapshot?.analysis?.profile.repository_id).toBe("rich");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toBe(state.snapshot);
  });

  it("an advisory request runs only the profile", async () => {
    const investigate = vi.fn(async () => result());
    const { ref, ready } = mount({ interpret: async () => plan(interpretAdvise().body), investigate, profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("rich - improve our workflow with Kiro", "rich"));
    await settle();
    expect(ref.current!.state.phase).toBe("READY");
    expect(investigate).not.toHaveBeenCalled();
    expect(ref.current!.state.snapshot?.investigation).toBeNull();
    expect(ref.current!.state.snapshot?.input.mode).toBe("ADVISE");
  });

  it("ignores a second submit while one is running", async () => {
    const gate = deferred<CallOutcome<InterpretedRequest>>();
    const interpret = vi.fn(() => gate.promise);
    const { ref, ready } = mount({ interpret, investigate: async () => result(), profile: async () => profile() });
    await ready;
    await act(async () => {
      ref.current!.submit("a", null);
      ref.current!.submit("a", null);
      ref.current!.submit("a", null);
    });
    expect(interpret).toHaveBeenCalledTimes(1);
    await act(async () => gate.resolve(plan(interpretInvestigate().body)));
    await settle();
    expect(ref.current!.state.phase).toBe("READY");
  });

  it("can start again after finishing", async () => {
    const interpret = vi.fn(async () => plan(interpretInvestigate().body));
    const { ref, ready } = mount({ interpret, investigate: async () => result(), profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("one", null));
    await settle();
    await act(async () => ref.current!.submit("two", null));
    await settle();
    expect(interpret).toHaveBeenCalledTimes(2);
    expect(ref.current!.state.text).toBe("two");
  });
});

describe("independent failure of the parts", () => {
  it("a failed profile does not discard a good investigation", async () => {
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate: async () => result(), profile: async () => ({ kind: "network" }) });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    const snap = ref.current!.state.snapshot!;
    expect(ref.current!.state.phase).toBe("READY");
    expect(snap.investigation).not.toBeNull();
    expect(snap.analysis).toBeNull();
    expect(snap.analysisNote).toContain("could not be reached");
  });

  it("an invalid profile is not shown and is explained", async () => {
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate: async () => result(), profile: async () => ({ kind: "invalid", reason: "x" }) });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.snapshot?.analysis).toBeNull();
    expect(ref.current!.state.snapshot?.analysisNote).toContain("could not be validated");
  });

  it("a failed investigation does not discard the profile, and says a failure is not absence", async () => {
    const { ref, ready } = mount({
      interpret: async () => plan(interpretInvestigate().body),
      investigate: async () => ({ kind: "result", result: clone(failed().body) }),
      profile: async () => profile(),
    });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    const snap = ref.current!.state.snapshot!;
    expect(snap.investigation).toBeNull();
    expect(snap.investigationNote).toContain("does not mean that no evidence exists");
    expect(snap.analysis).not.toBeNull();
  });

  it("a network failure of the investigation is not described as missing evidence", async () => {
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate: async () => ({ kind: "network" }), profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.snapshot?.investigationNote).toContain("says nothing about the evidence");
  });

  it("when every part fails there is an error and no snapshot", async () => {
    const saved = vi.fn();
    const { ref, ready } = mount(
      { interpret: async () => plan(interpretInvestigate().body), investigate: async () => ({ kind: "network" }), profile: async () => ({ kind: "network" }) },
      saved,
    );
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.phase).toBe("ERROR");
    expect(ref.current!.state.error?.kind).toBe("NOTHING_AVAILABLE");
    expect(ref.current!.state.snapshot).toBeNull();
    expect(saved).not.toHaveBeenCalled();
  });

  it("a rejected investigation request is an error, not a report", async () => {
    const saved = vi.fn();
    const { ref, ready } = mount(
      {
        interpret: async () => plan(interpretInvestigate().body),
        investigate: async () => ({ kind: "rejected", status: 404, error: notRegistered().body }),
        profile: async () => profile(),
      },
      saved,
    );
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.phase).toBe("ERROR");
    expect(ref.current!.state.error).toMatchObject({ kind: "REQUEST_REJECTED", status: 404 });
    expect(saved).not.toHaveBeenCalled();
  });
});

describe("interpretation outcomes", () => {
  it("needs a target: no analysis runs, candidates are kept", async () => {
    const investigate = vi.fn();
    const prof = vi.fn();
    const { ref, ready } = mount({ interpret: async () => plan(interpretNeedsTarget().body), investigate, profile: prof });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.phase).toBe("NEEDS_TARGET");
    expect(ref.current!.state.plan?.candidates.length).toBeGreaterThan(0);
    expect(investigate).not.toHaveBeenCalled();
    expect(prof).not.toHaveBeenCalled();
  });

  it("choosing a candidate runs the analysis once", async () => {
    const investigate = vi.fn(async () => result());
    const { ref, ready } = mount({ interpret: async () => plan(interpretNeedsTarget().body), investigate, profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    const chosen: InterpretedRequest = { ...ref.current!.state.plan!, mode: "INVESTIGATE", target_path: "src/billing.py", candidates: [], message: null };
    await act(async () => ref.current!.submitPlan(chosen, "x"));
    await settle();
    expect(investigate).toHaveBeenCalledTimes(1);
    expect(ref.current!.state.phase).toBe("READY");
  });

  it("unresolved: an error with the message, no requests", async () => {
    const investigate = vi.fn();
    const { ref, ready } = mount({ interpret: async () => plan(interpretUnresolved().body), investigate, profile: vi.fn() });
    await ready;
    await act(async () => ref.current!.submit("https://github.com/company/project - explain", null));
    await settle();
    expect(ref.current!.state.phase).toBe("ERROR");
    expect(ref.current!.state.error).toMatchObject({ kind: "UNRESOLVED" });
    expect(investigate).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "network" }, "NETWORK"],
    [{ kind: "invalid", reason: "x" }, "INVALID_RESPONSE"],
    [{ kind: "rejected", status: 400, error: notRegistered().body }, "REQUEST_REJECTED"],
  ] as const)("interpret failure %j", async (outcome, kind) => {
    const { ref, ready } = mount({ interpret: async () => outcome as CallOutcome<InterpretedRequest>, investigate: vi.fn(), profile: vi.fn() });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.error?.kind).toBe(kind);
  });
});

describe("cancel and stale responses", () => {
  it("cancel aborts the requests and a late response changes nothing", async () => {
    const gate = deferred<SubmitOutcome>();
    let signal: AbortSignal | undefined;
    const investigate = vi.fn((_r, options) => {
      signal = options?.signal;
      return gate.promise;
    });
    const saved = vi.fn();
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate, profile: async () => profile() }, saved);
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.phase).toBe("ANALYZING");
    await act(async () => ref.current!.cancel());
    expect(ref.current!.state.phase).toBe("CANCELLED");
    expect(signal?.aborted).toBe(true);
    await act(async () => gate.resolve(result()));
    await settle();
    expect(ref.current!.state.phase).toBe("CANCELLED");
    expect(ref.current!.state.snapshot).toBeNull();
    expect(saved).not.toHaveBeenCalled();
  });

  it("a new submission after a cancel ignores the older request", async () => {
    const first = deferred<SubmitOutcome>();
    const investigate = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(result());
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate, profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("first", null));
    await settle();
    await act(async () => ref.current!.cancel());
    await act(async () => ref.current!.submit("second", null));
    await settle();
    expect(ref.current!.state.snapshot?.input.text).toBe("second");
    await act(async () => first.resolve({ kind: "result", result: { ...clone(complete().body), conclusion: "STALE" } }));
    await settle();
    expect(ref.current!.state.snapshot?.investigation?.conclusion).not.toBe("STALE");
  });

  it("opening a saved snapshot shows it without announcing it for saving again", async () => {
    const saved = vi.fn();
    const { ref, ready } = mount({ interpret: vi.fn(), investigate: vi.fn(), profile: vi.fn() }, saved);
    await ready;
    const { buildSnapshot } = await import("../src/features/report/reportSnapshot");
    const snap = buildSnapshot({
      id: "old", createdAt: "2026-11-01T00:00:00.000Z",
      input: { text: "t", repository_id: "sample", mode: "INVESTIGATE", interpreter: "deterministic", question: "q", target_path: "a.py", symbol: null },
      investigation: clone(complete().body), investigationNote: null, analysis: null, analysisNote: null,
    });
    await act(async () => ref.current!.open(snap));
    await settle();
    expect(ref.current!.state.phase).toBe("READY");
    expect(ref.current!.state.snapshot).toBe(snap);
    expect(saved).not.toHaveBeenCalled();
  });

  it("reset returns to idle", async () => {
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate: async () => result(), profile: async () => profile() });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    await act(async () => ref.current!.reset());
    expect(ref.current!.state.phase).toBe("IDLE");
    expect(ref.current!.state.snapshot).toBeNull();
  });
});


describe("responsiveness after a rejection", () => {
  it("a rejected request frees the slot at once, even while the profile is still running", async () => {
    const slowProfile = deferred<CallOutcome<ProfileResponse>>();
    let profileSignal: AbortSignal | undefined;
    const investigate = vi.fn()
      .mockResolvedValueOnce({ kind: "rejected", status: 409, error: { ...notRegistered().body, code: "TARGET_AMBIGUOUS", candidates: ["A.run", "B.run"] } })
      .mockResolvedValue(result());
    const profileFn = vi.fn((_id: string, options?: { signal?: AbortSignal }) => {
      profileSignal = options?.signal;
      return slowProfile.promise;
    });
    const { ref, ready } = mount({ interpret: async () => plan(interpretInvestigate().body), investigate, profile: profileFn as never });
    await ready;
    await act(async () => ref.current!.submit("x", null));
    await settle();
    expect(ref.current!.state.phase).toBe("ERROR");
    expect(profileSignal?.aborted).toBe(true);
    // The user chooses a definition immediately. The second request must start.
    await act(async () => ref.current!.submitPlan({ ...ref.current!.state.plan!, symbol: "A.run" }, "x"));
    await settle();
    expect(investigate).toHaveBeenCalledTimes(2);
    expect((investigate.mock.calls[1]![0] as { target: { symbol: string } }).target.symbol).toBe("A.run");
    await act(async () => slowProfile.resolve(profile()));
    await settle();
  });
});
