/**
 * Orchestrates one analysis: interpret the sentence, then run the investigation and the repository profile together
 * (Spec 4 section 13). The reducer (analysisMachine.ts) holds the state. This hook owns the requests, the abort controller,
 * and the guarantee of one request set per submission.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { AnswerRecord, InterpretedRequest } from "../../types/advisor";
import type { InvestigationRequest } from "../../types/contract";
import { answerRequest, fetchProfile, interpretRequest, type AnswerFn, type InterpretFn, type ProfileFn } from "../../services/advisorClient";
import { submitInvestigation, type SubmitFn } from "../../services/investigationClient";
import type { ReportSnapshot } from "../report/reportSnapshot";
import { analysisReducer, initialAnalysis, type AnalysisState } from "./analysisMachine";

/** The answer as the report stores it: a validated record, or the reason none is shown. */
export interface AnswerFromState {
  value: AnswerRecord | null;
  note: string | null;
}

function answerFromOutcome(outcome: Awaited<ReturnType<AnswerFn>>): AnswerFromState {
  if (outcome.kind === "ok") return { value: outcome.value, note: null };
  if (outcome.kind === "invalid") return { value: null, note: "The AI advisor answer could not be validated, so it is not shown." };
  if (outcome.kind === "network") return { value: null, note: "The backend could not be reached for the AI advisor answer." };
  if (outcome.kind === "rejected") return { value: null, note: outcome.error.message };
  return { value: null, note: "The AI advisor answer was stopped before it finished." };
}

/** Upper bound for the investigation request. Each Git command in the backend is bounded at 30 seconds (core/limits.py). */
export const INVESTIGATION_TIMEOUT_MS = 60_000;

export interface AnalysisDependencies {
  interpret: InterpretFn;
  profile: ProfileFn;
  answer: AnswerFn;
  investigate: SubmitFn;
  now: () => Date;
  makeId: () => string;
}

function defaultId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `snap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaults: AnalysisDependencies = {
  interpret: interpretRequest,
  profile: fetchProfile,
  answer: answerRequest,
  investigate: submitInvestigation,
  now: () => new Date(),
  makeId: defaultId,
};

export interface Analysis {
  state: AnalysisState;
  /** Interpret a sentence and analyze it. Ignored while an analysis is running. */
  submit(text: string, selectedRepositoryId: string | null): void;
  /** Analyze an already-resolved request: a chosen candidate file, or the structured form. */
  /**
   * Analyze an already-resolved plan: a chosen candidate file, or the structured form. `carried` is the answer already
   * produced for this question while the chooser was shown. When it is given, the answer is not requested again.
   */
  submitPlan(plan: InterpretedRequest, text: string, carried?: AnswerFromState): void;
  cancel(): void;
  reset(): void;
  open(snapshot: ReportSnapshot): void;
}

export function useAnalysis(options: { deps?: Partial<AnalysisDependencies>; onSnapshot?(snapshot: ReportSnapshot): void } = {}): Analysis {
  const deps = { ...defaults, ...options.deps };
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const onSnapshotRef = useRef(options.onSnapshot);
  onSnapshotRef.current = options.onSnapshot;

  const [state, dispatch] = useReducer(analysisReducer, initialAnalysis);
  const tokenRef = useRef(0);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    busyRef.current = false;
  }, []);

  useEffect(() => stop, [stop]);

  const analyze = useCallback(async (token: number, plan: InterpretedRequest, signal: AbortSignal, carried?: AnswerFromState): Promise<void> => {
    const d = depsRef.current;
    if (plan.repository_id === null) return;
    const repositoryId = plan.repository_id;
    const jobs: Promise<void>[] = [];
    // The AI advisor answers from local evidence. It runs alongside the other parts, and a failure here never discards them.
    // An answer already produced for this question (from the file chooser) is reused, so the question is sent once.
    const answerPart: AnswerFromState = carried ?? { value: null, note: null };

    if (plan.mode === "INVESTIGATE" && plan.target_path !== null) {
      const request: InvestigationRequest = {
        repository_id: repositoryId,
        target: { path: plan.target_path, ...(plan.symbol ? { symbol: plan.symbol } : {}) },
        question: plan.question,
      };
      // The investigation has its own deadline. The backend runs several Git commands, each bounded at 30 seconds, so this
      // is longer than an advisor request. A timeout is a failed investigation: the profile and the game do not wait for it.
      const deadline = new AbortController();
      const timer = window.setTimeout(() => deadline.abort(), INVESTIGATION_TIMEOUT_MS);
      const cancel = (): void => deadline.abort();
      signal.addEventListener("abort", cancel);
      jobs.push(
        d.investigate(request, { signal: deadline.signal }).then((outcome) => {
          window.clearTimeout(timer);
          signal.removeEventListener("abort", cancel);
          if (outcome.kind === "result") dispatch({ type: "INVESTIGATION_DONE", token, result: outcome.result });
          else if (outcome.kind === "aborted" && !signal.aborted) dispatch({ type: "INVESTIGATION_FAILED", token, note: "The backend did not answer the investigation in time. This says nothing about the evidence." });
          else if (outcome.kind === "invalid") dispatch({ type: "INVESTIGATION_FAILED", token, note: "The investigation result could not be validated, so it is not shown." });
          else if (outcome.kind === "network") dispatch({ type: "INVESTIGATION_FAILED", token, note: "The backend could not be reached for the investigation. This says nothing about the evidence." });
          else if (outcome.kind === "rejected") {
            dispatch({ type: "FAIL", token, error: { kind: "REQUEST_REJECTED", status: outcome.status, backend: outcome.error } });
            // The user may answer at once (for example by choosing a definition), so stop the other request and free the slot.
            if (tokenRef.current === token) {
              abortRef.current?.abort();
              busyRef.current = false;
            }
          }
        }),
      );
    }
    jobs.push(
      d.profile(repositoryId, { signal }).then((outcome) => {
        if (outcome.kind === "ok") dispatch({ type: "PROFILE_DONE", token, value: outcome.value });
        else if (outcome.kind === "invalid") dispatch({ type: "PROFILE_FAILED", token, note: "The repository analysis could not be validated, so it is not shown." });
        else if (outcome.kind === "network") dispatch({ type: "PROFILE_FAILED", token, note: "The backend could not be reached for the repository analysis." });
        else if (outcome.kind === "rejected") dispatch({ type: "PROFILE_FAILED", token, note: outcome.error.message });
      }),
    );
    if (carried === undefined) {
      jobs.push(
        d.answer(repositoryId, plan.question, { signal }).then((outcome) => {
          Object.assign(answerPart, answerFromOutcome(outcome));
        }),
      );
    }
    await Promise.all(jobs);
    if (signal.aborted || tokenRef.current !== token) return;
    dispatch({ type: "FINALIZE", token, id: d.makeId(), createdAt: d.now().toISOString(), answer: answerPart.value, answerNote: answerPart.note });
    busyRef.current = false;
  }, []);

  /** The answer for a question that needs a target. It runs alone and never starts an investigation or a profile. */
  const answerOnly = useCallback(async (token: number, plan: InterpretedRequest, signal: AbortSignal): Promise<void> => {
    if (plan.repository_id === null) return;
    const outcome = await depsRef.current.answer(plan.repository_id, plan.question, { signal });
    if (signal.aborted || tokenRef.current !== token) return;
    dispatch({ type: "ANSWER_SETTLED", token, ...answerFromOutcome(outcome) });
  }, []);

  const submit = useCallback(
    (text: string, selectedRepositoryId: string | null): void => {
      if (busyRef.current) return;
      stop();
      busyRef.current = true;
      const token = ++tokenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "START", token, text });
      void depsRef.current.interpret({ text, selected_repository_id: selectedRepositoryId }, { signal: controller.signal }).then((outcome) => {
        if (controller.signal.aborted || tokenRef.current !== token) return;
        if (outcome.kind === "ok") {
          dispatch({ type: "PLAN", token, plan: outcome.value });
          if (outcome.value.mode === "INVESTIGATE" || outcome.value.mode === "ADVISE") void analyze(token, outcome.value, controller.signal);
          else {
            // The chooser waits for the user, so the analysis is not busy. A pending answer can still be stopped by a choice.
            busyRef.current = false;
            if (outcome.value.mode === "NEEDS_TARGET") void answerOnly(token, outcome.value, controller.signal);
          }
        } else {
          busyRef.current = false;
          if (outcome.kind === "network") dispatch({ type: "FAIL", token, error: { kind: "NETWORK" } });
          else if (outcome.kind === "invalid") dispatch({ type: "FAIL", token, error: { kind: "INVALID_RESPONSE", reason: outcome.reason } });
          else if (outcome.kind === "rejected") dispatch({ type: "FAIL", token, error: { kind: "REQUEST_REJECTED", status: outcome.status, backend: outcome.error } });
        }
      });
    },
    [analyze, answerOnly, stop],
  );

  const submitPlan = useCallback(
    (plan: InterpretedRequest, text: string, carried?: AnswerFromState): void => {
      if (busyRef.current) return;
      // A pending answer for the previous question is stopped here. Its result would arrive under a stale token anyway.
      stop();
      busyRef.current = true;
      const token = ++tokenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "START", token, text });
      dispatch({ type: "BEGIN_ANALYSIS", token, plan });
      void analyze(token, plan, controller.signal, carried);
    },
    [analyze, stop],
  );

  const cancel = useCallback((): void => {
    stop();
    tokenRef.current += 1;
    dispatch({ type: "CANCEL" });
  }, [stop]);

  const reset = useCallback((): void => {
    stop();
    tokenRef.current += 1;
    dispatch({ type: "RESET" });
  }, [stop]);

  const open = useCallback(
    (snapshot: ReportSnapshot): void => {
      stop();
      tokenRef.current += 1;
      dispatch({ type: "OPEN", snapshot });
    },
    [stop],
  );

  // A freshly built snapshot is handed to the caller exactly once, so it can be saved before anything else happens.
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase === "READY" && state.snapshot && announced.current !== state.snapshot.id) {
      announced.current = state.snapshot.id;
      if (state.token === tokenRef.current) onSnapshotRef.current?.(state.snapshot);
    }
  }, [state.phase, state.snapshot, state.token]);

  return { state, submit, submitPlan, cancel, reset, open };
}
