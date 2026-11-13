/**
 * Timers for the interlude. The machine decides what is allowed; this hook decides when things happen.
 *
 * Reduced motion keeps every pause that lets the text be read: the lines still appear after the same pauses. It removes the
 * movement (the introduction ends at once and the planchette is placed at rest) and the glitch.
 */

import { useCallback, useEffect, useReducer } from "react";
import { PLANCHETTE_ROUTE, TIMING, initialInterlude, interludeReducer, type InterludeState } from "./interludeMachine";

export interface InterludeOptions {
  reducedMotion: boolean;
  /** Whether a game may follow the interruption. False when the user skips the game, or no game can run. */
  gameAllowed: boolean;
}

export interface Interlude {
  state: InterludeState;
  begin(snapshotId: string): void;
  skip(): void;
  gameReady(): void;
  gameFailed(): void;
  caught(): void;
  retry(): void;
  giveUp(): void;
  escaped(): void;
  quit(): void;
}

export function useInterlude(options: InterludeOptions): Interlude {
  const { reducedMotion, gameAllowed } = options;
  const [state, dispatch] = useReducer(interludeReducer, initialInterlude);
  const { phase, step, boardSettled, beat } = state;

  // The lights go down, then the board comes alive.
  useEffect(() => {
    if (phase !== "OUIJA_INTRODUCTION") return;
    const handle = window.setTimeout(() => dispatch({ type: "INTRO_DONE" }), reducedMotion ? 0 : TIMING.introduction);
    return () => window.clearTimeout(handle);
  }, [phase, reducedMotion]);

  // The planchette moves by itself along a fixed route and settles. The route is the same every time.
  useEffect(() => {
    if (phase !== "OUIJA_ACTIVE" || boardSettled) return;
    if (reducedMotion) {
      dispatch({ type: "SETTLED" });
      return;
    }
    if (step >= PLANCHETTE_ROUTE.length - 1) {
      const handle = window.setTimeout(() => dispatch({ type: "SETTLED" }), TIMING.planchetteStep);
      return () => window.clearTimeout(handle);
    }
    const handle = window.setTimeout(() => dispatch({ type: "STEP", step: step + 1 }), TIMING.planchetteStep);
    return () => window.clearTimeout(handle);
  }, [phase, step, boardSettled, reducedMotion]);

  // Two seconds after the board settles, something is wrong.
  useEffect(() => {
    if (phase !== "OUIJA_ACTIVE" || !boardSettled) return;
    const handle = window.setTimeout(() => dispatch({ type: "INTERRUPT" }), TIMING.settleToInterruption);
    return () => window.clearTimeout(handle);
  }, [phase, boardSettled]);

  useEffect(() => {
    if (phase !== "NARRATIVE_INTERRUPTION") return;
    if (beat === 1) {
      const handle = window.setTimeout(() => dispatch({ type: "SECOND_LINE" }), TIMING.firstLineHold);
      return () => window.clearTimeout(handle);
    }
    if (beat === 2) {
      const handle = window.setTimeout(() => dispatch({ type: "INTERRUPTION_DONE", gameAllowed }), TIMING.secondLineHold);
      return () => window.clearTimeout(handle);
    }
  }, [phase, beat, gameAllowed]);

  // A finished or skipped game is given a moment to be taken apart before the report appears.
  useEffect(() => {
    if (phase !== "GAME_COMPLETED" && phase !== "GAME_SKIPPED") return;
    const handle = window.setTimeout(() => dispatch({ type: "FINISH" }), TIMING.closing);
    return () => window.clearTimeout(handle);
  }, [phase]);

  return {
    state,
    begin: useCallback((snapshotId: string) => dispatch({ type: "BEGIN", snapshotId }), []),
    skip: useCallback(() => dispatch({ type: "SKIP" }), []),
    gameReady: useCallback(() => dispatch({ type: "GAME_READY" }), []),
    gameFailed: useCallback(() => dispatch({ type: "GAME_FAILED" }), []),
    caught: useCallback(() => dispatch({ type: "CAUGHT" }), []),
    retry: useCallback(() => dispatch({ type: "RETRY" }), []),
    giveUp: useCallback(() => dispatch({ type: "GIVE_UP" }), []),
    escaped: useCallback(() => dispatch({ type: "ESCAPED" }), []),
    quit: useCallback(() => dispatch({ type: "QUIT" }), []),
  };
}
