import { describe, expect, it } from "vitest";
import {
  INITIAL_STATE,
  allowsSuccessPresentation,
  experienceReducer,
  planchetteStage,
  type ExperienceEvent,
  type ExperienceState,
  type Phase,
} from "../src/features/experience/experienceMachine";
import { ambiguous, clone, complete, failed, insufficient, notRegistered, partial } from "./fixtures";

const REQUEST = complete().request;

function run(events: ExperienceEvent[], from: ExperienceState = INITIAL_STATE): ExperienceState {
  return events.reduce(experienceReducer, from);
}

function started(): ExperienceState {
  return run([{ type: "SUBMIT", request: REQUEST }, { type: "REQUEST_STARTED", token: 1 }]);
}

function revealing(body: unknown = complete().body): ExperienceState {
  return experienceReducer(started(), { type: "RESPONSE_RESULT", token: 1, body });
}

describe("submission", () => {
  it("moves from IDLE to INVESTIGATING and keeps the question client-side", () => {
    const state = experienceReducer(INITIAL_STATE, { type: "SUBMIT", request: REQUEST });
    expect(state.phase).toBe("INVESTIGATING");
    expect(state.stage).toBe("INVOKING");
    expect(state.token).toBe(1);
    expect(state.question).toBe(REQUEST.question);
    expect(state.request).toEqual(REQUEST);
  });

  it("moves to the retrieving stage once the request has started", () => {
    expect(started().stage).toBe("RETRIEVING");
  });

  it("ignores a second submission while one is running", () => {
    const running = started();
    const again = experienceReducer(running, { type: "SUBMIT", request: { ...REQUEST, question: "Another?" } });
    expect(again).toBe(running);
  });

  it("ignores a submission during the reveal, the interruption, and the escape game", () => {
    const states: ExperienceState[] = [
      revealing(),
      run([{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }], revealing()),
      run([{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }, { type: "INTERRUPTION_DONE" }], revealing()),
    ];
    for (const state of states) expect(experienceReducer(state, { type: "SUBMIT", request: REQUEST })).toBe(state);
  });

  it("allows a new submission after an error, a cancellation, and the final report", () => {
    const error = experienceReducer(started(), { type: "RESPONSE_NETWORK_FAILURE", token: 1 });
    const cancelled = experienceReducer(started(), { type: "CANCEL" });
    const report = run([{ type: "SKIP_CINEMATIC" }], revealing());
    for (const state of [error, cancelled, report]) {
      const next = experienceReducer(state, { type: "SUBMIT", request: REQUEST });
      expect(next.phase).toBe("INVESTIGATING");
      expect(next.result).toBeNull();
      expect(next.error).toBeNull();
      expect(next.token).toBe(state.token + 1);
    }
  });
});

describe("responses", () => {
  it("reveals a valid COMPLETE result and stores it unchanged", () => {
    const state = revealing();
    expect(state.phase).toBe("REVEALING");
    expect(state.settled).toBe(false);
    expect(state.result?.retrieval_status).toBe("COMPLETE");
    expect(state.result?.epistemic_classification).toBe("DOCUMENTED");
    expect(state.result?.evidence).toEqual(complete().body.evidence);
  });

  it("reveals PARTIAL and INSUFFICIENT_EVIDENCE results with their original values", () => {
    const p = revealing(partial().body);
    expect(p.phase).toBe("REVEALING");
    expect([p.result?.retrieval_status, p.result?.epistemic_classification]).toEqual(["PARTIAL", "PARTIAL_EVIDENCE"]);
    const i = revealing(insufficient().body);
    expect(i.phase).toBe("REVEALING");
    expect([i.result?.retrieval_status, i.result?.epistemic_classification]).toEqual(["INSUFFICIENT", "INSUFFICIENT_EVIDENCE"]);
  });

  it("treats a FAILED retrieval as an error with no result, never a reveal", () => {
    const state = revealing(failed().body);
    expect(state.phase).toBe("ERROR");
    expect(state.result).toBeNull();
    expect(state.error).toMatchObject({ kind: "RETRIEVAL_FAILED", code: "GIT_FAILED" });
  });

  it("treats an invalid body as an error with no result", () => {
    const state = revealing({ retrieval_status: "COMPLETE" });
    expect(state.phase).toBe("ERROR");
    expect(state.result).toBeNull();
    expect(state.error?.kind).toBe("INVALID_RESPONSE");
  });

  it("treats a contradictory body as invalid, never as a conclusion", () => {
    const body = clone(insufficient().body);
    body.conclusion = "Made up.";
    const state = revealing(body);
    expect(state.phase).toBe("ERROR");
    expect(state.result).toBeNull();
  });

  it("maps a request-level rejection to a rejected-request error with the backend message", () => {
    const state = experienceReducer(started(), { type: "RESPONSE_REJECTED", token: 1, status: 404, error: { ...notRegistered().body, field: null, candidates: [] } });
    expect(state.phase).toBe("ERROR");
    expect(state.error).toMatchObject({ kind: "REQUEST_REJECTED", status: 404 });
    expect(state.result).toBeNull();
  });

  it("keeps ambiguity candidates in the error", () => {
    const state = experienceReducer(started(), { type: "RESPONSE_REJECTED", token: 1, status: 409, error: { ...ambiguous().body, field: null } });
    expect(state.error).toMatchObject({ kind: "REQUEST_REJECTED" });
    if (state.error?.kind === "REQUEST_REJECTED") expect(state.error.backend.candidates).toEqual(["A.run", "B.run"]);
  });

  it("separates an internal backend error from a rejected request", () => {
    const state = experienceReducer(started(), {
      type: "RESPONSE_REJECTED",
      token: 1,
      status: 500,
      error: { code: "INTERNAL_ERROR", message: "x", retryable: false, field: null, candidates: [] },
    });
    expect(state.error?.kind).toBe("BACKEND_INTERNAL");
  });

  it("maps a network failure to a network error and never to missing evidence", () => {
    const state = experienceReducer(started(), { type: "RESPONSE_NETWORK_FAILURE", token: 1 });
    expect(state.phase).toBe("ERROR");
    expect(state.error).toEqual({ kind: "NETWORK" });
    expect(state.result).toBeNull();
  });

  it("maps a client-side invalid outcome to the invalid-response error", () => {
    const state = experienceReducer(started(), { type: "RESPONSE_INVALID", token: 1, reason: "body: not JSON" });
    expect(state.error).toEqual({ kind: "INVALID_RESPONSE", reason: "body: not JSON" });
  });
});

describe("stale and cancelled requests", () => {
  it("discards a response with an old token", () => {
    const running = started();
    for (const event of [
      { type: "RESPONSE_RESULT", token: 0, body: complete().body },
      { type: "RESPONSE_RESULT", token: 2, body: complete().body },
      { type: "RESPONSE_NETWORK_FAILURE", token: 0 },
      { type: "RESPONSE_REJECTED", token: 5, status: 404, error: { ...notRegistered().body, field: null, candidates: [] } },
      { type: "RESPONSE_INVALID", token: 9, reason: "x" },
    ] as ExperienceEvent[]) {
      expect(experienceReducer(running, event)).toBe(running);
    }
  });

  it("enters CANCELLED, advances the token, and discards the late response", () => {
    const cancelled = experienceReducer(started(), { type: "CANCEL" });
    expect(cancelled.phase).toBe("CANCELLED");
    expect(cancelled.token).toBe(2);
    const late = experienceReducer(cancelled, { type: "RESPONSE_RESULT", token: 1, body: complete().body });
    expect(late).toBe(cancelled);
    expect(late.result).toBeNull();
  });

  it("never reveals after a cancellation, even if the same token returns", () => {
    const cancelled = experienceReducer(started(), { type: "CANCEL" });
    expect(experienceReducer(cancelled, { type: "RESPONSE_RESULT", token: cancelled.token, body: complete().body })).toBe(cancelled);
  });

  it("does not let a superseded request replace a newer one", () => {
    const first = started();
    const error = experienceReducer(first, { type: "RESPONSE_NETWORK_FAILURE", token: 1 });
    const second = experienceReducer(error, { type: "SUBMIT", request: REQUEST });
    expect(second.token).toBe(2);
    // The response of request 1 arrives late.
    expect(experienceReducer(second, { type: "RESPONSE_RESULT", token: 1, body: complete().body })).toBe(second);
  });

  it("only cancels while investigating", () => {
    for (const state of [INITIAL_STATE, revealing()]) expect(experienceReducer(state, { type: "CANCEL" })).toBe(state);
  });
});

describe("the reveal and the narrative layer", () => {
  it("settles once and then allows the interruption for an eligible result", () => {
    const settled = experienceReducer(revealing(), { type: "REVEAL_SETTLED" });
    expect(settled.settled).toBe(true);
    expect(experienceReducer(settled, { type: "REVEAL_SETTLED" })).toBe(settled);
    expect(experienceReducer(settled, { type: "INTERRUPT" }).phase).toBe("NARRATIVE_INTERRUPTION");
  });

  it("refuses the interruption before the board has settled", () => {
    const unsettled = revealing();
    expect(experienceReducer(unsettled, { type: "INTERRUPT" })).toBe(unsettled);
  });

  it("refuses the interruption for insufficient evidence", () => {
    const settled = experienceReducer(revealing(insufficient().body), { type: "REVEAL_SETTLED" });
    expect(experienceReducer(settled, { type: "INTERRUPT" })).toBe(settled);
  });

  it("refuses the interruption for a successful presentation without evidence", () => {
    const body = clone(complete().body);
    body.evidence = [];
    const settled = experienceReducer(revealing(body), { type: "REVEAL_SETTLED" });
    expect(experienceReducer(settled, { type: "INTERRUPT" })).toBe(settled);
  });

  it("goes interruption, then escape, then the final report, with the result unchanged", () => {
    const result = complete().body;
    const state = run(
      [{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }, { type: "INTERRUPTION_DONE" }, { type: "ESCAPE_COMPLETED" }],
      revealing(),
    );
    expect(state.phase).toBe("FINAL_REPORT");
    expect(state.result?.evidence).toEqual(result.evidence);
    expect(state.result?.epistemic_classification).toBe("DOCUMENTED");
    expect(state.skips).toBe(0);
  });

  it("goes straight to the report when the cinematic is skipped, at any point, with the result intact", () => {
    const afterReveal = revealing();
    const afterInterrupt = run([{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }], afterReveal);
    const afterEscapeStart = experienceReducer(afterInterrupt, { type: "INTERRUPTION_DONE" });
    for (const state of [afterReveal, afterInterrupt, afterEscapeStart]) {
      const skipped = experienceReducer(state, { type: "SKIP_CINEMATIC" });
      expect(skipped.phase).toBe("FINAL_REPORT");
      expect(skipped.result).toBe(state.result);
      expect(skipped.skips).toBe(1);
    }
  });

  it("goes to the report when only the escape game is skipped", () => {
    const interruption = run([{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }], revealing());
    expect(experienceReducer(interruption, { type: "SKIP_ESCAPE" }).phase).toBe("FINAL_REPORT");
    const escape = experienceReducer(interruption, { type: "INTERRUPTION_DONE" });
    const skipped = experienceReducer(escape, { type: "SKIP_ESCAPE" });
    expect(skipped.phase).toBe("FINAL_REPORT");
    expect(skipped.result).toBe(escape.result);
  });

  it("ignores skip events when there is no cinematic to skip", () => {
    for (const state of [INITIAL_STATE, started()]) {
      expect(experienceReducer(state, { type: "SKIP_CINEMATIC" })).toBe(state);
      expect(experienceReducer(state, { type: "SKIP_ESCAPE" })).toBe(state);
    }
  });
});

describe("clues", () => {
  const escape = () => run([{ type: "REVEAL_SETTLED" }, { type: "INTERRUPT" }, { type: "INTERRUPTION_DONE" }], revealing());

  it("records a collected clue only for a real evidence id", () => {
    const state = escape();
    const real = complete().body.evidence[0]!.evidence_id;
    const collected = experienceReducer(state, { type: "CLUE_COLLECTED", evidenceId: real });
    expect(collected.collected).toEqual([real]);
    expect(experienceReducer(collected, { type: "CLUE_COLLECTED", evidenceId: real })).toBe(collected);
  });

  it("rejects a clue that names no evidence item", () => {
    const state = escape();
    expect(experienceReducer(state, { type: "CLUE_COLLECTED", evidenceId: "ev1_invented" })).toBe(state);
  });

  it("ignores clues outside the escape phase", () => {
    const real = complete().body.evidence[0]!.evidence_id;
    const state = revealing();
    expect(experienceReducer(state, { type: "CLUE_COLLECTED", evidenceId: real })).toBe(state);
  });

  it("never changes the stored evidence when clues are collected", () => {
    let state = escape();
    for (const item of complete().body.evidence.slice(0, 4)) state = experienceReducer(state, { type: "CLUE_COLLECTED", evidenceId: item.evidence_id });
    expect(state.result?.evidence).toEqual(complete().body.evidence);
    expect(state.collected).toHaveLength(4);
  });
});

describe("restore and reset", () => {
  it("restores a stored result straight into the final report, marked as restored", () => {
    const state = experienceReducer(INITIAL_STATE, { type: "RESTORE", request: REQUEST, result: complete().body });
    expect(state.phase).toBe("FINAL_REPORT");
    expect(state.restored).toBe(true);
    expect(state.settled).toBe(true);
    expect(state.skips).toBe(0);
  });

  it("restores only from IDLE", () => {
    const running = started();
    expect(experienceReducer(running, { type: "RESTORE", request: REQUEST, result: complete().body })).toBe(running);
  });

  it("does not reset while investigating, and clears everything else", () => {
    const running = started();
    expect(experienceReducer(running, { type: "RESET" })).toBe(running);
    const reset = experienceReducer(revealing(), { type: "RESET" });
    expect(reset.phase).toBe("IDLE");
    expect(reset.result).toBeNull();
    expect(reset.token).toBe(1);
  });
});

describe("only listed transitions are possible", () => {
  const events: ExperienceEvent[] = [
    { type: "REQUEST_STARTED", token: 1 },
    { type: "REVEAL_SETTLED" },
    { type: "INTERRUPT" },
    { type: "INTERRUPTION_DONE" },
    { type: "ESCAPE_COMPLETED" },
    { type: "SKIP_CINEMATIC" },
    { type: "SKIP_ESCAPE" },
  ];

  it("ignores every scene event from IDLE", () => {
    for (const event of events) expect(experienceReducer(INITIAL_STATE, event)).toBe(INITIAL_STATE);
  });

  it("never reaches a scene phase from an error or cancellation", () => {
    const error = experienceReducer(started(), { type: "RESPONSE_NETWORK_FAILURE", token: 1 });
    const cancelled = experienceReducer(started(), { type: "CANCEL" });
    for (const state of [error, cancelled]) {
      for (const event of events) {
        const next = experienceReducer(state, event);
        expect(["REVEALING", "NARRATIVE_INTERRUPTION", "ESCAPE_SEQUENCE", "FINAL_REPORT"]).not.toContain(next.phase);
      }
    }
  });

  it("visits only declared phases in a full successful journey", () => {
    const seen = new Set<Phase>();
    let state = INITIAL_STATE;
    for (const event of [
      { type: "SUBMIT", request: REQUEST },
      { type: "REQUEST_STARTED", token: 1 },
      { type: "RESPONSE_RESULT", token: 1, body: complete().body },
      { type: "REVEAL_SETTLED" },
      { type: "INTERRUPT" },
      { type: "INTERRUPTION_DONE" },
      { type: "ESCAPE_COMPLETED" },
    ] as ExperienceEvent[]) {
      state = experienceReducer(state, event);
      seen.add(state.phase);
    }
    expect([...seen]).toEqual(["INVESTIGATING", "REVEALING", "NARRATIVE_INTERRUPTION", "ESCAPE_SEQUENCE", "FINAL_REPORT"]);
  });
});

describe("planchette stage is a pure function of the phase", () => {
  it("maps each phase to one stage", () => {
    expect(planchetteStage(INITIAL_STATE)).toBe("REST");
    expect(planchetteStage({ phase: "INVESTIGATING", stage: "INVOKING", settled: false })).toBe("WAKE");
    expect(planchetteStage({ phase: "INVESTIGATING", stage: "RETRIEVING", settled: false })).toBe("SEARCH");
    expect(planchetteStage({ phase: "REVEALING", stage: null, settled: false })).toBe("REVEAL_PREP");
    expect(planchetteStage({ phase: "REVEALING", stage: null, settled: true })).toBe("SETTLED");
    expect(planchetteStage({ phase: "ERROR", stage: null, settled: false })).toBe("REST");
    expect(planchetteStage({ phase: "CANCELLED", stage: null, settled: false })).toBe("REST");
  });

  it("returns the same stage for the same input", () => {
    const input = { phase: "INVESTIGATING", stage: "RETRIEVING", settled: false } as const;
    expect(Array.from({ length: 20 }, () => planchetteStage(input))).toEqual(Array(20).fill("SEARCH"));
  });
});

describe("success presentation is allowed only for eligible results", () => {
  it("is false for errors, cancellations, idle, and investigating", () => {
    const error = experienceReducer(started(), { type: "RESPONSE_NETWORK_FAILURE", token: 1 });
    const cancelled = experienceReducer(started(), { type: "CANCEL" });
    for (const state of [INITIAL_STATE, started(), error, cancelled]) expect(allowsSuccessPresentation(state)).toBe(false);
  });

  it("is true for an eligible reveal and false for insufficient evidence", () => {
    expect(allowsSuccessPresentation(revealing())).toBe(true);
    expect(allowsSuccessPresentation(revealing(insufficient().body))).toBe(false);
  });
});

describe("the stored result is never overwritten", () => {
  it("keeps the backend values through every scene event", () => {
    const original = complete().body;
    let state = revealing(original);
    for (const event of [
      { type: "REVEAL_SETTLED" },
      { type: "INTERRUPT" },
      { type: "INTERRUPTION_DONE" },
      { type: "CLUE_COLLECTED", evidenceId: original.evidence[0]!.evidence_id },
      { type: "ESCAPE_COMPLETED" },
    ] as ExperienceEvent[]) {
      state = experienceReducer(state, event);
      expect(state.result?.retrieval_status).toBe(original.retrieval_status);
      expect(state.result?.epistemic_classification).toBe(original.epistemic_classification);
      expect(state.result?.conclusion).toBe(original.conclusion);
      expect(state.result?.evidence).toEqual(original.evidence);
      expect(state.result?.limitations).toEqual(original.limitations);
    }
  });
});
