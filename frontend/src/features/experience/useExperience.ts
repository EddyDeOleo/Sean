/**
 * Orchestration hook for the experience (Spec 3 sections 4, 7, and 12).
 *
 * The reducer is pure. This hook owns the effects:
 *
 * - One API call per accepted submission. submit() mints a token, dispatches SUBMIT, and calls the client once. Re-renders
 *   and scene transitions never call it again, because no effect depends on the phase to start a request.
 * - The response is dispatched with the token of the request that produced it. The reducer discards a stale token, so a
 *   cancelled or superseded request cannot change the state.
 * - Cancel aborts the in-flight request and dispatches CANCEL. The late response, if any, is discarded.
 * - The settle timer raises REVEAL_SETTLED after SETTLE_MS (the planchette's reveal movement), or at once under reduced
 *   motion.
 * - The interruption timer raises INTERRUPT INTERRUPTION_DELAY_MS after the board has settled, only for an eligible result
 *   and only while the horror sequence is on. Every timer is cleared on phase change and on unmount.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { InvestigationRequest } from "../../types/contract";
import { submitInvestigation, type SubmitFn } from "../../services/investigationClient";
import { isNarrativeEligible } from "../investigation/validateResponse";
import { INITIAL_STATE, experienceReducer, type ExperienceState } from "./experienceMachine";
import { clearSession, loadSession, saveSession } from "./sessionStore";

/** Spec 3 section 7: the interruption starts 2000 ms after the board settles. */
export const INTERRUPTION_DELAY_MS = 2000;
/** How long the planchette's reveal movement takes before it counts as settled. */
export const SETTLE_MS = 1800;

export interface ExperienceOptions {
  submit?: SubmitFn;
  /** Resolved reduced-motion value. Reduced motion settles at once and replaces the glitch with static text. */
  reducedMotion: boolean;
  /** The horror sequence setting. When false, the interruption and the escape game never start. */
  horror: boolean;
  /** Restore the last session result at mount. */
  restoreSession?: boolean;
  /** Persist a validated result for a refresh. */
  persistSession?: boolean;
}

export interface Experience {
  state: ExperienceState;
  submit(request: InvestigationRequest): void;
  cancel(): void;
  reset(): void;
  skipCinematic(): void;
  skipEscape(): void;
  collectClue(evidenceId: string): void;
  completeEscape(): void;
  finishInterruption(): void;
}

export function useExperience(options: ExperienceOptions): Experience {
  const { reducedMotion, horror, restoreSession = true, persistSession = true } = options;
  const submitRef = useRef<SubmitFn>(options.submit ?? submitInvestigation);
  submitRef.current = options.submit ?? submitInvestigation;

  const [state, dispatch] = useReducer(experienceReducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const controllerRef = useRef<AbortController | null>(null);

  // Restore the last validated result once, at mount. The restored report opens without a cinematic.
  const restoredOnce = useRef(false);
  useEffect(() => {
    if (!restoreSession || restoredOnce.current) return;
    restoredOnce.current = true;
    const stored = loadSession();
    if (stored) dispatch({ type: "RESTORE", request: stored.request, result: stored.result });
  }, [restoreSession]);

  // Persist a freshly validated result, so a refresh keeps the report.
  useEffect(() => {
    if (!persistSession) return;
    if (state.result && state.request && !state.restored && state.phase !== "INVESTIGATING") {
      saveSession({ request: state.request, result: state.result });
    }
  }, [persistSession, state.result, state.request, state.restored, state.phase]);

  // Abort anything in flight when the component unmounts.
  useEffect(
    () => () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    },
    [],
  );

  const submit = useCallback((request: InvestigationRequest): void => {
    const current = stateRef.current;
    // The reducer ignores a submission while one is running. The same guard here stops a second network call.
    if (current.phase === "INVESTIGATING") return;
    const token = current.token + 1;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    clearSession();
    dispatch({ type: "SUBMIT", request });
    dispatch({ type: "REQUEST_STARTED", token });
    void submitRef.current(request, { signal: controller.signal }).then((outcome) => {
      if (controller.signal.aborted && outcome.kind !== "aborted") return;
      switch (outcome.kind) {
        case "result":
          // The client has validated this body. The reducer validates it once more, so the state never holds a result that
          // did not pass validateResponse, whatever the caller.
          dispatch({ type: "RESPONSE_RESULT", token, body: outcome.result });
          break;
        case "invalid":
          dispatch({ type: "RESPONSE_INVALID", token, reason: outcome.reason });
          break;
        case "rejected":
          dispatch({ type: "RESPONSE_REJECTED", token, status: outcome.status, error: outcome.error });
          break;
        case "network":
          dispatch({ type: "RESPONSE_NETWORK_FAILURE", token });
          break;
        case "aborted":
          break;
      }
    });
  }, []);

  const cancel = useCallback((): void => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    dispatch({ type: "CANCEL" });
  }, []);

  const reset = useCallback((): void => {
    clearSession();
    dispatch({ type: "RESET" });
  }, []);

  // Settle: the planchette's reveal movement ends. Reduced motion settles at once.
  useEffect(() => {
    if (state.phase !== "REVEALING" || state.settled) return;
    const handle = window.setTimeout(() => dispatch({ type: "REVEAL_SETTLED" }), reducedMotion ? 0 : SETTLE_MS);
    return () => window.clearTimeout(handle);
  }, [state.phase, state.settled, reducedMotion]);

  // Interruption: 2000 ms after the board settles, only for an eligible result and only while the horror sequence is on.
  useEffect(() => {
    if (state.phase !== "REVEALING" || !state.settled || state.result === null) return;
    if (!horror || !isNarrativeEligible(state.result)) return;
    const handle = window.setTimeout(() => dispatch({ type: "INTERRUPT" }), INTERRUPTION_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [state.phase, state.settled, state.result, horror]);

  // When the horror sequence is off, or the result is not eligible, a settled board is final and the report follows it.
  useEffect(() => {
    if (state.phase !== "REVEALING" || !state.settled || state.result === null) return;
    if (horror && isNarrativeEligible(state.result)) return;
    dispatch({ type: "SKIP_CINEMATIC" });
  }, [state.phase, state.settled, state.result, horror]);

  return useMemo(
    () => ({
      state,
      submit,
      cancel,
      reset,
      skipCinematic: () => dispatch({ type: "SKIP_CINEMATIC" }),
      skipEscape: () => dispatch({ type: "SKIP_ESCAPE" }),
      collectClue: (evidenceId: string) => dispatch({ type: "CLUE_COLLECTED", evidenceId }),
      completeEscape: () => dispatch({ type: "ESCAPE_COMPLETED" }),
      finishInterruption: () => dispatch({ type: "INTERRUPTION_DONE" }),
    }),
    [state, submit, cancel, reset],
  );
}
