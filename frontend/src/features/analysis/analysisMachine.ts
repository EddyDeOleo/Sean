/**
 * The analysis state machine (Spec 4 sections 9.2 and 13).
 *
 * It owns the requests that produce a report: interpreting the sentence, the investigation, and the repository profile with
 * the Advisor. It does not own the cinematic experience or the settings. The parts fail independently: a failed profile does
 * not discard a successful investigation, and a failed investigation does not discard the profile.
 *
 * Staleness: every started analysis gets a token. A result that arrives for an older token (after a cancel or a new
 * submission) is dropped, so a late response can never replace what the user sees.
 *
 * Phases: IDLE, INTERPRETING, NEEDS_TARGET, ANALYZING, READY, ERROR, CANCELLED.
 */

import type { InterpretedRequest, ProfileResponse } from "../../types/advisor";
import type { BackendError, InvestigationResult } from "../../types/contract";
import { buildSnapshot, type ReportSnapshot, type SnapshotInput } from "../report/reportSnapshot";

export type AnalysisPhase = "IDLE" | "INTERPRETING" | "NEEDS_TARGET" | "ANALYZING" | "READY" | "ERROR" | "CANCELLED";

export type AnalysisError =
  | { kind: "UNRESOLVED"; message: string }
  | { kind: "REQUEST_REJECTED"; status: number; backend: BackendError }
  | { kind: "NETWORK" }
  | { kind: "INVALID_RESPONSE"; reason: string }
  | { kind: "NOTHING_AVAILABLE"; investigationNote: string | null; analysisNote: string | null };

type PartStatus = "IDLE" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED";

export interface AnalysisState {
  phase: AnalysisPhase;
  token: number;
  text: string;
  plan: InterpretedRequest | null;
  investigation: { status: PartStatus; result: InvestigationResult | null; note: string | null };
  profile: { status: PartStatus; value: ProfileResponse | null; note: string | null };
  snapshot: ReportSnapshot | null;
  error: AnalysisError | null;
}

export const initialAnalysis: AnalysisState = {
  phase: "IDLE",
  token: 0,
  text: "",
  plan: null,
  investigation: { status: "IDLE", result: null, note: null },
  profile: { status: "IDLE", value: null, note: null },
  snapshot: null,
  error: null,
};

export type AnalysisEvent =
  | { type: "START"; token: number; text: string }
  | { type: "PLAN"; token: number; plan: InterpretedRequest }
  | { type: "BEGIN_ANALYSIS"; token: number; plan: InterpretedRequest }
  | { type: "INVESTIGATION_DONE"; token: number; result: InvestigationResult }
  | { type: "INVESTIGATION_FAILED"; token: number; note: string }
  | { type: "PROFILE_DONE"; token: number; value: ProfileResponse }
  | { type: "PROFILE_FAILED"; token: number; note: string }
  | { type: "FAIL"; token: number; error: AnalysisError }
  | { type: "FINALIZE"; token: number; id: string; createdAt: string }
  | { type: "CANCEL" }
  | { type: "RESET" }
  | { type: "OPEN"; snapshot: ReportSnapshot };

function isCurrent(state: AnalysisState, token: number): boolean {
  return token === state.token && (state.phase === "INTERPRETING" || state.phase === "ANALYZING");
}

function inputFor(state: AnalysisState): SnapshotInput | null {
  const plan = state.plan;
  if (!plan || plan.repository_id === null || (plan.mode !== "INVESTIGATE" && plan.mode !== "ADVISE")) return null;
  return {
    text: state.text,
    repository_id: plan.repository_id,
    mode: plan.mode,
    interpreter: plan.interpreter,
    question: plan.question,
    target_path: plan.target_path,
    symbol: plan.symbol,
    ai_status: plan.ai_status,
  };
}

/** Whether the analysis has nothing left to wait for. */
export function isSettled(state: AnalysisState): boolean {
  const open = (s: PartStatus) => s === "RUNNING";
  return state.phase === "ANALYZING" && !open(state.investigation.status) && !open(state.profile.status);
}

export function analysisReducer(state: AnalysisState, event: AnalysisEvent): AnalysisState {
  switch (event.type) {
    case "START":
      return { ...initialAnalysis, phase: "INTERPRETING", token: event.token, text: event.text };

    case "PLAN": {
      if (!isCurrent(state, event.token) || state.phase !== "INTERPRETING") return state;
      const plan = event.plan;
      if (plan.mode === "UNRESOLVED") return { ...state, plan, phase: "ERROR", error: { kind: "UNRESOLVED", message: plan.message ?? "The request could not be resolved." } };
      if (plan.mode === "NEEDS_TARGET") return { ...state, plan, phase: "NEEDS_TARGET" };
      return reducerBegin(state, plan);
    }

    case "BEGIN_ANALYSIS": {
      // A chosen candidate or a structured request starts the analysis for a plan that is already resolved.
      if (event.token !== state.token) return state;
      return reducerBegin({ ...state, phase: "INTERPRETING" }, event.plan);
    }

    case "INVESTIGATION_DONE": {
      if (!isCurrent(state, event.token)) return state;
      if (event.result.retrieval_status === "FAILED") {
        const note = event.result.error?.message ?? "The investigation failed.";
        return { ...state, investigation: { status: "FAILED", result: null, note: `${note} A failed retrieval does not mean that no evidence exists.` } };
      }
      return { ...state, investigation: { status: "DONE", result: event.result, note: null } };
    }
    case "INVESTIGATION_FAILED":
      if (!isCurrent(state, event.token)) return state;
      return { ...state, investigation: { status: "FAILED", result: null, note: event.note } };

    case "PROFILE_DONE":
      if (!isCurrent(state, event.token)) return state;
      return { ...state, profile: { status: "DONE", value: event.value, note: null } };
    case "PROFILE_FAILED":
      if (!isCurrent(state, event.token)) return state;
      return { ...state, profile: { status: "FAILED", value: null, note: event.note } };

    case "FAIL":
      if (!isCurrent(state, event.token)) return state;
      return { ...state, phase: "ERROR", error: event.error };

    case "FINALIZE": {
      if (!isCurrent(state, event.token) || !isSettled(state)) return state;
      const input = inputFor(state);
      const investigation = state.investigation.result;
      const analysis = state.profile.value;
      if (input === null || (investigation === null && analysis === null)) {
        return {
          ...state,
          phase: "ERROR",
          error: { kind: "NOTHING_AVAILABLE", investigationNote: state.investigation.note, analysisNote: state.profile.note },
        };
      }
      const snapshot = buildSnapshot({
        id: event.id,
        createdAt: event.createdAt,
        input,
        investigation,
        investigationNote: state.investigation.note,
        analysis,
        analysisNote: state.profile.note,
      });
      return { ...state, phase: "READY", snapshot, error: null };
    }

    case "CANCEL":
      if (state.phase !== "INTERPRETING" && state.phase !== "ANALYZING") return state;
      return { ...initialAnalysis, phase: "CANCELLED", token: state.token, text: state.text };

    case "RESET":
      return { ...initialAnalysis, token: state.token };

    case "OPEN":
      return { ...initialAnalysis, phase: "READY", token: state.token, text: event.snapshot.input.text, snapshot: event.snapshot };
  }
}

function reducerBegin(state: AnalysisState, plan: InterpretedRequest): AnalysisState {
  const investigate = plan.mode === "INVESTIGATE";
  return {
    ...state,
    plan,
    phase: "ANALYZING",
    investigation: { status: investigate ? "RUNNING" : "SKIPPED", result: null, note: null },
    profile: { status: "RUNNING", value: null, note: null },
    error: null,
  };
}
