/**
 * Orchestrates one analysis: interpret the sentence, then run the investigation and the repository profile together
 * (Spec 4 section 13). The reducer (analysisMachine.ts) holds the state. This hook owns the requests, the abort controller,
 * and the guarantee of one request set per submission.
 */

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { InterpretedRequest } from "../../types/advisor";
import type { InvestigationRequest } from "../../types/contract";
import { fetchProfile, interpretRequest, type InterpretFn, type ProfileFn } from "../../services/advisorClient";
import { submitInvestigation, type SubmitFn } from "../../services/investigationClient";
import type { ReportSnapshot } from "../report/reportSnapshot";
import { analysisReducer, initialAnalysis, type AnalysisState } from "./analysisMachine";

export interface AnalysisDependencies {
  interpret: InterpretFn;
  profile: ProfileFn;
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
  investigate: submitInvestigation,
  now: () => new Date(),
  makeId: defaultId,
};

export interface Analysis {
  state: AnalysisState;
  /** Interpret a sentence and analyze it. Ignored while an analysis is running. */
  submit(text: string, selectedRepositoryId: string | null, allowAi?: boolean): void;
  /** Analyze an already-resolved request: a chosen candidate file, or the structured form. */
  submitPlan(plan: InterpretedRequest, text: string): void;
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

  const analyze = useCallback(async (token: number, plan: InterpretedRequest, signal: AbortSignal): Promise<void> => {
    const d = depsRef.current;
    if (plan.repository_id === null) return;
    const repositoryId = plan.repository_id;
    const jobs: Promise<void>[] = [];

    if (plan.mode === "INVESTIGATE" && plan.target_path !== null) {
      const request: InvestigationRequest = {
        repository_id: repositoryId,
        target: { path: plan.target_path, ...(plan.symbol ? { symbol: plan.symbol } : {}) },
        question: plan.question,
      };
      jobs.push(
        d.investigate(request, { signal }).then((outcome) => {
          if (outcome.kind === "result") dispatch({ type: "INVESTIGATION_DONE", token, result: outcome.result });
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
    await Promise.all(jobs);
    if (signal.aborted || tokenRef.current !== token) return;
    dispatch({ type: "FINALIZE", token, id: d.makeId(), createdAt: d.now().toISOString() });
    busyRef.current = false;
  }, []);

  const submit = useCallback(
    (text: string, selectedRepositoryId: string | null, allowAi = false): void => {
      if (busyRef.current) return;
      busyRef.current = true;
      const token = ++tokenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "START", token, text });
      void depsRef.current.interpret({ text, selected_repository_id: selectedRepositoryId, allow_ai: allowAi }, { signal: controller.signal }).then((outcome) => {
        if (controller.signal.aborted || tokenRef.current !== token) return;
        if (outcome.kind === "ok") {
          dispatch({ type: "PLAN", token, plan: outcome.value });
          if (outcome.value.mode === "INVESTIGATE" || outcome.value.mode === "ADVISE") void analyze(token, outcome.value, controller.signal);
          else busyRef.current = false;
        } else {
          busyRef.current = false;
          if (outcome.kind === "network") dispatch({ type: "FAIL", token, error: { kind: "NETWORK" } });
          else if (outcome.kind === "invalid") dispatch({ type: "FAIL", token, error: { kind: "INVALID_RESPONSE", reason: outcome.reason } });
          else if (outcome.kind === "rejected") dispatch({ type: "FAIL", token, error: { kind: "REQUEST_REJECTED", status: outcome.status, backend: outcome.error } });
        }
      });
    },
    [analyze],
  );

  const submitPlan = useCallback(
    (plan: InterpretedRequest, text: string): void => {
      if (busyRef.current) return;
      busyRef.current = true;
      const token = ++tokenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      dispatch({ type: "START", token, text });
      dispatch({ type: "BEGIN_ANALYSIS", token, plan });
      void analyze(token, plan, controller.signal);
    },
    [analyze],
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
