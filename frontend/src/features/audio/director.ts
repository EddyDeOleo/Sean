/**
 * Decides which sound goes with what happens (Spec 4 section 12). No audio API is used here: it maps interlude phases and
 * game events to moods and cues, so the mapping is testable without a sound device.
 *
 * Sound is part of the fiction only. It is never played for an investigation result, and the interlude never runs for a
 * failed, cancelled or insufficient result, so no success-like sound can accompany those outcomes.
 */

import type { InterludePhase } from "../interlude/interludeMachine";
import type { GameEvent, ThreatInfo } from "../game/world";
import type { Cue, Mood } from "./AudioController";

export function moodForPhase(phase: InterludePhase): Mood {
  switch (phase) {
    case "OUIJA_INTRODUCTION":
      return "idle";
    case "OUIJA_ACTIVE":
      return "search";
    case "NARRATIVE_INTERRUPTION":
    case "GAME_INITIALIZATION":
    case "GAME_ACTIVE":
    case "PLAYER_CAUGHT":
      return "tension";
    case "GAME_COMPLETED":
      return "escape";
    case "GAME_SKIPPED":
    case "REPORT_AVAILABLE":
    case "OFF":
      return "silent";
  }
}

/** The one-shot cue that starts a phase, if any. */
export function cueForPhase(phase: InterludePhase): Cue | null {
  switch (phase) {
    case "OUIJA_INTRODUCTION":
      return "whisper";
    case "NARRATIVE_INTERRUPTION":
      return "glitch";
    case "GAME_COMPLETED":
      return "escape";
    default:
      return null;
  }
}

export interface CuePlan {
  cue: Cue;
  options?: { pan?: number; gain?: number };
}

export function planForGameEvent(event: GameEvent, lastThreat: ThreatInfo | null): CuePlan | null {
  switch (event.type) {
    case "CLUE_COLLECTED":
      return { cue: "clue" };
    case "GATE_OPENED":
      return { cue: "door" };
    case "FOOTSTEP":
      return { cue: event.sprinting ? "footstepRun" : "footstep" };
    case "FLASHLIGHT":
      return { cue: "flashlight" };
    case "CAUGHT":
      return { cue: "caught" };
    case "MONSTER_STATE":
      return event.state === "PURSUING" ? { cue: "growl", options: { pan: lastThreat?.pan ?? 0 } } : null;
    case "ESCAPED":
      return null;
  }
}

/** Paces the creature's footsteps: faster and louder as it comes closer, silent when it sleeps or is far. */
export class MonsterSteps {
  private clock = 0;

  /** Call about every 100 ms with the latest threat. Returns the step to play, if one is due. */
  update(info: ThreatInfo, seconds: number): CuePlan | null {
    if (!info.awake || info.distance > 10) {
      this.clock = 0;
      return null;
    }
    this.clock += seconds;
    const interval = 0.9 - 0.5 * info.level;
    if (this.clock < interval) return null;
    this.clock = 0;
    return { cue: "monsterStep", options: { pan: info.pan, gain: 0.25 + 0.75 * info.level } };
  }
}
