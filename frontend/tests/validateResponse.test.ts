import { describe, expect, it } from "vitest";
import { deriveUiState, isNarrativeEligible, validateResponse } from "../src/features/investigation/validateResponse";
import { CLASSIFICATIONS, RETRIEVAL_STATUSES, type Classification, type RetrievalStatus } from "../src/types/contract";
import { clone, complete, failed, insufficient, partial } from "./fixtures";

describe("real backend responses validate", () => {
  it.each([
    ["complete", complete],
    ["partial-shallow", partial],
    ["insufficient", insufficient],
    ["failed-broken", failed],
  ])("accepts the captured %s response unchanged", (_name, load) => {
    const body = load().body;
    const checked = validateResponse(body);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      // Backend values are stored exactly as received.
      expect(checked.result.retrieval_status).toBe(body.retrieval_status);
      expect(checked.result.epistemic_classification).toBe(body.epistemic_classification);
      expect(checked.result.conclusion).toBe(body.conclusion);
      expect(checked.result.explanation).toBe(body.explanation);
      expect(checked.result.evidence).toEqual(body.evidence);
      expect(checked.result.limitations).toEqual(body.limitations);
      expect(checked.result.source_references).toEqual(body.source_references);
      expect(checked.result.investigation_id).toBe(body.investigation_id);
    }
  });

  it("keeps the real target resolution label unchanged", () => {
    const labels = [complete(), partial(), failed()].map((f) => f.body.target.resolution);
    expect(labels).toEqual(["RESOLVED", "NOT_REQUESTED", "NOT_RESOLVED"]);
    for (const load of [complete, partial, failed]) {
      const checked = validateResponse(load().body);
      expect(checked.ok && checked.result.target.resolution).toBe(load().body.target.resolution);
    }
  });

  it("does not copy unknown extra fields into the result", () => {
    const body = { ...clone(complete().body), surprise: "x", conclusion_override: "y" };
    const checked = validateResponse(body);
    expect(checked.ok).toBe(true);
    if (checked.ok) {
      expect(Object.keys(checked.result)).not.toContain("surprise");
      expect(Object.keys(checked.result)).not.toContain("conclusion_override");
    }
  });
});

describe("invalid responses are rejected", () => {
  const rejected = (mutate: (body: Record<string, unknown>) => void): string => {
    const body = clone(complete().body) as unknown as Record<string, unknown>;
    mutate(body);
    const checked = validateResponse(body);
    expect(checked.ok).toBe(false);
    return checked.ok ? "" : checked.reason;
  };

  it.each([null, undefined, "text", 42, [], true])("rejects a non-object body: %s", (value) => {
    expect(validateResponse(value).ok).toBe(false);
  });

  it("rejects a missing retrieval_status", () => {
    expect(rejected((b) => delete b.retrieval_status)).toMatch(/retrieval_status/);
  });

  it("rejects an unrecognized retrieval status", () => {
    expect(rejected((b) => (b.retrieval_status = "DONE"))).toMatch(/retrieval_status/);
  });

  it("rejects an unrecognized classification", () => {
    expect(rejected((b) => (b.epistemic_classification = "PROVEN"))).toMatch(/epistemic_classification/);
  });

  it("rejects a non-failed result without a classification", () => {
    expect(rejected((b) => (b.epistemic_classification = null))).toMatch(/classification/);
  });

  it("rejects a non-failed result that carries an error", () => {
    expect(rejected((b) => (b.error = { code: "X", message: "m", retryable: false }))).toMatch(/error/);
  });

  it("rejects a failed result that carries a classification", () => {
    const body = clone(failed().body) as unknown as Record<string, unknown>;
    body.epistemic_classification = "DOCUMENTED";
    expect(validateResponse(body).ok).toBe(false);
  });

  it("rejects a failed result that carries a conclusion", () => {
    const body = clone(failed().body) as unknown as Record<string, unknown>;
    body.conclusion = "A conclusion";
    expect(validateResponse(body).ok).toBe(false);
  });

  it("rejects a failed result without an error", () => {
    const body = clone(failed().body) as unknown as Record<string, unknown>;
    body.error = null;
    expect(validateResponse(body).ok).toBe(false);
  });

  it("rejects insufficient evidence that carries a conclusion", () => {
    const body = clone(insufficient().body) as unknown as Record<string, unknown>;
    body.conclusion = "The change was made to fix a bug.";
    expect(validateResponse(body).ok).toBe(false);
  });

  it("rejects an evidence item with an unrecognized source type", () => {
    expect(rejected((b) => ((b.evidence as Record<string, unknown>[])[0]!.source_type = "RUMOR"))).toMatch(/source_type/);
  });

  it("rejects an evidence item with an unrecognized relationship basis", () => {
    expect(rejected((b) => ((((b.evidence as Record<string, unknown>[])[0]!.relationship as Record<string, unknown>).basis = "GUESSED")))).toMatch(/basis/);
  });

  it("rejects an evidence item with a wrongly typed field", () => {
    expect(rejected((b) => ((b.evidence as Record<string, unknown>[])[0]!.author = 12))).toMatch(/author/);
  });

  it("rejects an evidence list that is not an array", () => {
    expect(rejected((b) => (b.evidence = {}))).toMatch(/evidence/);
  });

  it("rejects a limitation without a code", () => {
    expect(rejected((b) => ((b.limitations as Record<string, unknown>[])[0] = { message: "m", scope: "s" }))).toMatch(/limitations/);
  });
});

describe("deriveUiState follows Spec 2 section 8.5 for every combination", () => {
  const expected = (status: RetrievalStatus, classification: Classification | null): string => {
    // First matching row wins. A non-failed status without a classification is invalid and is presented as FAILED (C.7).
    if (status === "FAILED") return "FAILED";
    if (classification === null) return "FAILED";
    if (classification === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_EVIDENCE";
    if (classification === "PARTIAL_EVIDENCE") return "PARTIAL";
    if ((status === "PARTIAL" || status === "INSUFFICIENT") && (classification === "DOCUMENTED" || classification === "INFERRED")) return "PARTIAL";
    return "COMPLETED";
  };

  for (const status of RETRIEVAL_STATUSES) {
    for (const classification of [...CLASSIFICATIONS, null] as (Classification | null)[]) {
      it(`${status} + ${classification ?? "none"}`, () => {
        expect(deriveUiState({ retrieval_status: status, epistemic_classification: classification })).toBe(expected(status, classification));
      });
    }
  }

  it("derives the captured fixtures' presentation states", () => {
    expect(deriveUiState(complete().body)).toBe("COMPLETED");
    expect(deriveUiState(partial().body)).toBe("PARTIAL");
    expect(deriveUiState(insufficient().body)).toBe("INSUFFICIENT_EVIDENCE");
    expect(deriveUiState(failed().body)).toBe("FAILED");
  });

  it("does not turn INSUFFICIENT (a retrieval status) into INSUFFICIENT_EVIDENCE (a classification)", () => {
    expect(deriveUiState({ retrieval_status: "INSUFFICIENT", epistemic_classification: "DOCUMENTED" })).toBe("PARTIAL");
    expect(deriveUiState({ retrieval_status: "COMPLETE", epistemic_classification: "INSUFFICIENT_EVIDENCE" })).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("narrative eligibility (one rule for the interruption, the game, and success cues)", () => {
  it("is true for a complete documented result with evidence", () => {
    expect(isNarrativeEligible(complete().body)).toBe(true);
  });

  it("is true for a partial result with evidence, because it stays labelled partial", () => {
    expect(isNarrativeEligible(partial().body)).toBe(true);
  });

  it("is false for insufficient evidence", () => {
    expect(isNarrativeEligible(insufficient().body)).toBe(false);
  });

  it("is false for a failed retrieval", () => {
    expect(isNarrativeEligible(failed().body)).toBe(false);
  });

  it("is false for a successful presentation with no evidence", () => {
    const body = clone(complete().body);
    body.evidence = [];
    expect(isNarrativeEligible(body)).toBe(false);
  });
});
