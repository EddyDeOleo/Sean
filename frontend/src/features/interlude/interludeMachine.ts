/**
 * The interlude state machine (Spec 4 sections 9.2 and 10; Requirements 6 and 7).
 *
 * The interlude is the surprise between "the analysis is finished" and "here is the report": a full-screen Ouija, an
 * interruption, and a first-person game. It owns only its own phases. It has no access to the report snapshot, which was
 * saved before it started and cannot be changed by anything that happens here. Every way out (escape, capture and giving up,
 * skip, quit, a game that fails to start) ends in REPORT_AVAILABLE.
 *
 * Phases follow the lifecycle names of the owner directive:
 *   OFF -> OUIJA_INTRODUCTION -> OUIJA_ACTIVE -> NARRATIVE_INTERRUPTION -> GAME_INITIALIZATION -> GAME_ACTIVE
 *       -> PLAYER_CAUGHT (retry -> GAME_INITIALIZATION) | GAME_COMPLETED | GAME_SKIPPED -> REPORT_AVAILABLE
 * An event that does not apply to the current phase is ignored.
 */

export type InterludePhase =
  | "OFF"
  | "OUIJA_INTRODUCTION"
  | "OUIJA_ACTIVE"
  | "NARRATIVE_INTERRUPTION"
  | "GAME_INITIALIZATION"
  | "GAME_ACTIVE"
  | "PLAYER_CAUGHT"
  | "GAME_COMPLETED"
  | "GAME_SKIPPED"
  | "REPORT_AVAILABLE";

export type InterludeEnd = "ESCAPED" | "SKIPPED" | "QUIT" | "GAVE_UP" | "NO_GAME" | "GAME_FAILED";

export interface InterludeState {
  phase: InterludePhase;
  /** The snapshot this interlude belongs to. Used to start each interlude once. */
  snapshotId: string | null;
  /** The planchette's current waypoint. */
  step: number;
  boardSettled: boolean;
  /** 0: nothing yet, 1: "Wait... something is wrong.", 2: the second line. */
  beat: 0 | 1 | 2;
  attempts: number;
  endedBy: InterludeEnd | null;
}

export const initialInterlude: InterludeState = {
  phase: "OFF",
  snapshotId: null,
  step: 0,
  boardSettled: false,
  beat: 0,
  attempts: 0,
  endedBy: null,
};

export type InterludeEvent =
  | { type: "BEGIN"; snapshotId: string }
  | { type: "INTRO_DONE" }
  | { type: "STEP"; step: number }
  | { type: "SETTLED" }
  | { type: "INTERRUPT" }
  | { type: "SECOND_LINE" }
  | { type: "INTERRUPTION_DONE"; gameAllowed: boolean }
  | { type: "GAME_READY" }
  | { type: "GAME_FAILED" }
  | { type: "CAUGHT" }
  | { type: "RETRY" }
  | { type: "GIVE_UP" }
  | { type: "ESCAPED" }
  | { type: "SKIP" }
  | { type: "QUIT" }
  | { type: "FINISH" };

/** Timings in milliseconds. Spec 4 section 9.2: the first line appears about two seconds after the board settles. */
export const TIMING = {
  introduction: 1600,
  planchetteStep: 700,
  settleToInterruption: 2000,
  firstLineHold: 2600,
  secondLineHold: 3000,
  closing: 600,
} as const;

/** The planchette's route: out of rest, across the letters of the product name, and back to rest. */
export const PLANCHETTE_ROUTE = ["rest", "S", "E", "A", "N", "rest"] as const;

export function isActive(phase: InterludePhase): boolean {
  return phase !== "OFF" && phase !== "REPORT_AVAILABLE";
}

export function isGamePhase(phase: InterludePhase): boolean {
  return phase === "GAME_INITIALIZATION" || phase === "GAME_ACTIVE" || phase === "PLAYER_CAUGHT";
}

export function interludeReducer(state: InterludeState, event: InterludeEvent): InterludeState {
  switch (event.type) {
    case "BEGIN":
      if (state.phase !== "OFF" && state.phase !== "REPORT_AVAILABLE") return state;
      if (state.snapshotId === event.snapshotId) return state;
      return { ...initialInterlude, phase: "OUIJA_INTRODUCTION", snapshotId: event.snapshotId };

    case "INTRO_DONE":
      return state.phase === "OUIJA_INTRODUCTION" ? { ...state, phase: "OUIJA_ACTIVE" } : state;
    case "STEP":
      return state.phase === "OUIJA_ACTIVE" && event.step > state.step ? { ...state, step: event.step } : state;
    case "SETTLED":
      return state.phase === "OUIJA_ACTIVE" ? { ...state, boardSettled: true, step: PLANCHETTE_ROUTE.length - 1 } : state;
    case "INTERRUPT":
      return state.phase === "OUIJA_ACTIVE" && state.boardSettled ? { ...state, phase: "NARRATIVE_INTERRUPTION", beat: 1 } : state;
    case "SECOND_LINE":
      return state.phase === "NARRATIVE_INTERRUPTION" && state.beat === 1 ? { ...state, beat: 2 } : state;
    case "INTERRUPTION_DONE":
      if (state.phase !== "NARRATIVE_INTERRUPTION") return state;
      return event.gameAllowed
        ? { ...state, phase: "GAME_INITIALIZATION", attempts: state.attempts + 1 }
        : { ...state, phase: "REPORT_AVAILABLE", endedBy: "NO_GAME" };

    case "GAME_READY":
      return state.phase === "GAME_INITIALIZATION" ? { ...state, phase: "GAME_ACTIVE" } : state;
    case "GAME_FAILED":
      return isGamePhase(state.phase) ? { ...state, phase: "REPORT_AVAILABLE", endedBy: "GAME_FAILED" } : state;
    case "CAUGHT":
      return state.phase === "GAME_ACTIVE" ? { ...state, phase: "PLAYER_CAUGHT" } : state;
    case "RETRY":
      return state.phase === "PLAYER_CAUGHT" ? { ...state, phase: "GAME_INITIALIZATION", attempts: state.attempts + 1 } : state;
    case "GIVE_UP":
      return state.phase === "PLAYER_CAUGHT" ? { ...state, phase: "GAME_SKIPPED", endedBy: "GAVE_UP" } : state;
    case "ESCAPED":
      return state.phase === "GAME_ACTIVE" ? { ...state, phase: "GAME_COMPLETED", endedBy: "ESCAPED" } : state;
    case "QUIT":
      return isGamePhase(state.phase) ? { ...state, phase: "GAME_SKIPPED", endedBy: "QUIT" } : state;

    case "SKIP":
      if (!isActive(state.phase) || state.phase === "GAME_COMPLETED" || state.phase === "GAME_SKIPPED") return state;
      return isGamePhase(state.phase)
        ? { ...state, phase: "GAME_SKIPPED", endedBy: "SKIPPED" }
        : { ...state, phase: "REPORT_AVAILABLE", endedBy: "SKIPPED" };

    case "FINISH":
      return state.phase === "GAME_COMPLETED" || state.phase === "GAME_SKIPPED" ? { ...state, phase: "REPORT_AVAILABLE" } : state;
  }
}
