/**
 * Experience state machine (Spec 3 section 4).
 *
 * A pure reducer. It owns the experience phase and the data the scenes read: the request token, the validated result, the
 * request and question that produced it, the settled flag, the collected clue ids, and the error.
 *
 * Rules enforced here:
 * - Every (phase, event) pair that is not listed is ignored, so scenes cannot overlap or repeat.
 * - A result, rejection, or failure is applied only when its token is current. A stale response is discarded.
 * - A FAILED retrieval, an invalid body, a rejection, a network failure, and a cancellation never reach REVEALING, so no
 *   reveal, interruption, or success cue can follow them.
 * - The stored result is exactly the validated response. The presentation state is derived, never stored over it.
 * - The narrative eligibility rule is one function (isNarrativeEligible) shared by every consumer.
 */

import type { BackendError, InvestigationRequest, InvestigationResult } from "../../types/contract";
import { isNarrativeEligible, validateResponse } from "../investigation/validateResponse";

export type Phase =
  | "IDLE"
  | "INVESTIGATING"
  | "REVEALING"
  | "NARRATIVE_INTERRUPTION"
  | "ESCAPE_SEQUENCE"
  | "FINAL_REPORT"
  | "ERROR"
  | "CANCELLED";

export type InvestigatingStage = "INVOKING" | "RETRIEVING";

export type ExperienceError =
  | { kind: "RETRIEVAL_FAILED"; code: string; message: string; retryable: boolean }
  | { kind: "INVALID_RESPONSE"; reason: string }
  | { kind: "REQUEST_REJECTED"; backend: BackendError; status: number }
  | { kind: "BACKEND_INTERNAL"; backend: BackendError; status: number }
  | { kind: "NETWORK" };

export interface ExperienceState {
  phase: Phase;
  stage: InvestigatingStage | null;
  /** Monotonic request counter. A response is applied only when its token equals this value. */
  token: number;
  question: string;
  request: InvestigationRequest | null;
  result: InvestigationResult | null;
  /** The planchette has settled on the revealed result. */
  settled: boolean;
  error: ExperienceError | null;
  collected: string[];
  /** True when the report was restored from the browser session instead of a fresh investigation. */
  restored: boolean;
  /** How many times the phase left a scene early through a skip. Recorded for tests and diagnostics only. */
  skips: number;
}

export const INITIAL_STATE: ExperienceState = {
  phase: "IDLE",
  stage: null,
  token: 0,
  question: "",
  request: null,
  result: null,
  settled: false,
  error: null,
  collected: [],
  restored: false,
  skips: 0,
};

export type ExperienceEvent =
  | { type: "SUBMIT"; request: InvestigationRequest }
  | { type: "REQUEST_STARTED"; token: number }
  | { type: "RESPONSE_RESULT"; token: number; body: unknown }
  | { type: "RESPONSE_INVALID"; token: number; reason: string }
  | { type: "RESPONSE_REJECTED"; token: number; status: number; error: BackendError }
  | { type: "RESPONSE_NETWORK_FAILURE"; token: number }
  | { type: "CANCEL" }
  | { type: "REVEAL_SETTLED" }
  | { type: "INTERRUPT" }
  | { type: "INTERRUPTION_DONE" }
  | { type: "CLUE_COLLECTED"; evidenceId: string }
  | { type: "ESCAPE_COMPLETED" }
  | { type: "SKIP_CINEMATIC" }
  | { type: "SKIP_ESCAPE" }
  | { type: "RESTORE"; request: InvestigationRequest; result: InvestigationResult }
  | { type: "RESET" };

const CAN_SUBMIT: ReadonlySet<Phase> = new Set(["IDLE", "ERROR", "CANCELLED", "FINAL_REPORT"]);

function isCurrent(state: ExperienceState, token: number): boolean {
  return state.phase === "INVESTIGATING" && token === state.token;
}

export function experienceReducer(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  switch (event.type) {
    case "SUBMIT": {
      if (!CAN_SUBMIT.has(state.phase)) return state;
      return {
        ...INITIAL_STATE,
        phase: "INVESTIGATING",
        stage: "INVOKING",
        token: state.token + 1,
        question: event.request.question,
        request: event.request,
      };
    }

    case "REQUEST_STARTED": {
      if (!isCurrent(state, event.token) || state.stage !== "INVOKING") return state;
      return { ...state, stage: "RETRIEVING" };
    }

    case "RESPONSE_RESULT": {
      if (!isCurrent(state, event.token)) return state;
      const checked = validateResponse(event.body);
      if (!checked.ok) {
        return { ...state, phase: "ERROR", stage: null, error: { kind: "INVALID_RESPONSE", reason: checked.reason } };
      }
      const result = checked.result;
      if (result.retrieval_status === "FAILED") {
        const error = result.error;
        // validateResponse guarantees a FAILED result carries an error. The fallback keeps the type total.
        return {
          ...state,
          phase: "ERROR",
          stage: null,
          error: {
            kind: "RETRIEVAL_FAILED",
            code: error?.code ?? "UNKNOWN",
            message: error?.message ?? "Retrieval failed.",
            retryable: error?.retryable ?? false,
          },
        };
      }
      return { ...state, phase: "REVEALING", stage: null, result, settled: false, error: null, collected: [] };
    }

    case "RESPONSE_INVALID": {
      if (!isCurrent(state, event.token)) return state;
      return { ...state, phase: "ERROR", stage: null, error: { kind: "INVALID_RESPONSE", reason: event.reason } };
    }

    case "RESPONSE_REJECTED": {
      if (!isCurrent(state, event.token)) return state;
      const internal = event.status >= 500 || event.error.code === "INTERNAL_ERROR";
      return {
        ...state,
        phase: "ERROR",
        stage: null,
        error: internal
          ? { kind: "BACKEND_INTERNAL", backend: event.error, status: event.status }
          : { kind: "REQUEST_REJECTED", backend: event.error, status: event.status },
      };
    }

    case "RESPONSE_NETWORK_FAILURE": {
      if (!isCurrent(state, event.token)) return state;
      return { ...state, phase: "ERROR", stage: null, error: { kind: "NETWORK" } };
    }

    case "CANCEL": {
      if (state.phase !== "INVESTIGATING") return state;
      // The token is advanced so a late response for the cancelled request can never be applied.
      return { ...state, phase: "CANCELLED", stage: null, token: state.token + 1, error: null };
    }

    case "REVEAL_SETTLED": {
      if (state.phase !== "REVEALING" || state.settled || state.result === null) return state;
      // Whether the narrative layer follows is decided by isNarrativeEligible at INTERRUPT. An ineligible result simply
      // stays on the settled board, which already shows the complete presentation and the report.
      return { ...state, settled: true };
    }

    case "INTERRUPT": {
      if (state.phase !== "REVEALING" || !state.settled || state.result === null) return state;
      if (!isNarrativeEligible(state.result)) return state;
      return { ...state, phase: "NARRATIVE_INTERRUPTION" };
    }

    case "INTERRUPTION_DONE": {
      if (state.phase !== "NARRATIVE_INTERRUPTION") return state;
      return { ...state, phase: "ESCAPE_SEQUENCE" };
    }

    case "CLUE_COLLECTED": {
      if (state.phase !== "ESCAPE_SEQUENCE" || state.result === null) return state;
      if (state.collected.includes(event.evidenceId)) return state;
      // A clue must name a real evidence item of the validated result.
      if (!state.result.evidence.some((item) => item.evidence_id === event.evidenceId)) return state;
      return { ...state, collected: [...state.collected, event.evidenceId] };
    }

    case "ESCAPE_COMPLETED": {
      if (state.phase !== "ESCAPE_SEQUENCE") return state;
      return { ...state, phase: "FINAL_REPORT" };
    }

    case "SKIP_CINEMATIC": {
      if (state.phase !== "REVEALING" && state.phase !== "NARRATIVE_INTERRUPTION" && state.phase !== "ESCAPE_SEQUENCE") return state;
      return { ...state, phase: "FINAL_REPORT", settled: true, skips: state.skips + 1 };
    }

    case "SKIP_ESCAPE": {
      if (state.phase !== "ESCAPE_SEQUENCE" && state.phase !== "NARRATIVE_INTERRUPTION") return state;
      return { ...state, phase: "FINAL_REPORT", skips: state.skips + 1 };
    }

    case "RESTORE": {
      if (state.phase !== "IDLE") return state;
      return {
        ...INITIAL_STATE,
        phase: "FINAL_REPORT",
        question: event.request.question,
        request: event.request,
        result: event.result,
        settled: true,
        restored: true,
      };
    }

    case "RESET": {
      if (state.phase === "INVESTIGATING") return state;
      return { ...INITIAL_STATE, token: state.token };
    }
  }
}

/** The planchette stage is a pure function of the phase (Spec 2 section 6.4). No randomness, no result content. */
export type PlanchetteStage = "REST" | "WAKE" | "SEARCH" | "REVEAL_PREP" | "SETTLED";

export function planchetteStage(state: Pick<ExperienceState, "phase" | "stage" | "settled">): PlanchetteStage {
  switch (state.phase) {
    case "INVESTIGATING":
      return state.stage === "RETRIEVING" ? "SEARCH" : "WAKE";
    case "REVEALING":
      return state.settled ? "SETTLED" : "REVEAL_PREP";
    case "NARRATIVE_INTERRUPTION":
    case "ESCAPE_SEQUENCE":
    case "FINAL_REPORT":
      return state.phase === "FINAL_REPORT" && state.stage === null && !state.settled ? "REST" : "SETTLED";
    default:
      return "REST";
  }
}

/** True when a success-oriented presentation (reveal, interruption, success cue) is allowed for this state. */
export function allowsSuccessPresentation(state: Pick<ExperienceState, "phase" | "result">): boolean {
  if (state.result === null) return false;
  if (state.phase === "ERROR" || state.phase === "CANCELLED" || state.phase === "IDLE" || state.phase === "INVESTIGATING") return false;
  return isNarrativeEligible(state.result);
}
