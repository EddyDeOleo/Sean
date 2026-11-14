/**
 * Decides which sound goes with what happens (Spec 4 section 12). No audio API is used here: it maps interlude phases and
 * game events to moods and cues, so the mapping is testable without a sound device.
 *
 * Sound is part of the fiction only. It is never played for an investigation result, and the interlude never runs for a
 * failed, cancelled or insufficient result, so no success-like sound can accompany those outcomes.
 *
 * Everything here is deterministic: the same inputs give the same plans, with no Math.random and no clock.
 */

import type { InterludePhase } from "../interlude/interludeMachine";
import type { GameEvent, ThreatInfo } from "../game/world";
import type { Cue, CueOptions, Mood } from "./AudioController";
import { mulberry32 } from "./synth";

export function moodForPhase(phase: InterludePhase): Mood {
  switch (phase) {
    case "OUIJA_INTRODUCTION":
    case "OUIJA_ACTIVE":
      return "ouija";
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
  options?: CueOptions;
}

// --- the Ouija board -------------------------------------------------------------------------------------------------------

/** The planchette's route has waypoints 0 (rest) to this step. */
export const LAST_OUIJA_STEP = 5;

/**
 * What to play when the planchette reaches waypoint `step` (1 to 5 of rest, S, E, A, N, rest), or settles. Step 0 and
 * out-of-range steps are silent. Each move is a slide with a contact tick. A creak joins some moves.
 */
export function planForOuijaStep(step: number, settled: boolean): CuePlan[] {
  if (settled) {
    return [{ cue: "woodThud", options: { gain: 0.8 } }, { cue: "woodKnock", options: { gain: 0.6 } }];
  }
  if (!Number.isInteger(step) || step < 1 || step > LAST_OUIJA_STEP) return [];
  const plans: CuePlan[] = [
    { cue: "planchetteSlide", options: { gain: 0.8 } },
    { cue: "planchetteTick", options: { gain: 0.75 } },
  ];
  if (step === 3) plans.push({ cue: "woodCreak", options: { gain: 0.45 } });
  return plans;
}

// --- the game --------------------------------------------------------------------------------------------------------------

export function planForGameEvent(
  event: GameEvent,
  lastThreat: ThreatInfo | null,
  options: { jumpscare: boolean } = { jumpscare: false },
): CuePlan[] {
  switch (event.type) {
    case "CLUE_COLLECTED":
      return [{ cue: "clue" }];
    case "GATE_OPENED":
      return [{ cue: "door" }];
    case "FOOTSTEP":
      return [{ cue: event.sprinting ? "footstepRun" : "footstep" }];
    case "FLASHLIGHT":
      return [{ cue: "flashlight" }];
    case "CAUGHT":
      // The scream and the heavy impact are priority cues so a busy moment cannot drop them. The controller skips the
      // scream and softens the impact when intense sound is not allowed.
      return options.jumpscare
        ? [{ cue: "scream", options: { priority: true } }, { cue: "caught", options: { priority: true } }]
        : [{ cue: "caught", options: { gain: 0.6 } }];
    case "MONSTER_STATE":
      return event.state === "PURSUING" ? [{ cue: "growl", options: { pan: lastThreat?.pan ?? 0 } }] : [];
    case "LUNGE":
      return [{ cue: "growl", options: { pan: lastThreat?.pan ?? 0, priority: true } }];
    case "HIDING":
      // A locker door: wood creaks as it opens or closes.
      return [{ cue: "woodCreak", options: { gain: 0.5 } }];
    case "ESCAPED":
      return [];
  }
}

/** Gait: how long each step takes relative to the nominal pace, and how hard it lands. Four steps, then it repeats. */
const GAIT_PACE = [1, 1.12, 0.94, 1.08] as const;
const GAIT_WEIGHT = [1, 0.82, 0.95, 0.78] as const;

/** Paces the creature's footsteps: faster and louder as it comes closer, silent when it sleeps or is far. */
export class MonsterSteps {
  private clock = 0;
  private count = 0;

  constructor(private readonly range = 10) {}

  /** Call about every 100 ms with the latest threat. Returns the step to play, if one is due. */
  update(info: ThreatInfo, seconds: number): CuePlan | null {
    if (!info.awake || info.distance > this.range) {
      this.clock = 0;
      return null;
    }
    this.clock += seconds;
    const interval = (0.9 - 0.5 * info.level) * GAIT_PACE[this.count % GAIT_PACE.length]!;
    if (this.clock < interval) return null;
    this.clock = 0;
    const weight = GAIT_WEIGHT[this.count % GAIT_WEIGHT.length]!;
    this.count += 1;
    return { cue: "monsterStep", options: { pan: info.pan, gain: (0.25 + 0.75 * info.level) * weight } };
  }

  reset(): void {
    this.clock = 0;
    this.count = 0;
  }
}

/** Heartbeat below this tension is silent. */
export const HEARTBEAT_MIN_TENSION = 0.2;
export const HEARTBEAT_BPM_RANGE = { min: 55, max: 130 } as const;

/** Beats per minute for a tension from 0 to 1: 55 at 0, 130 at 1. */
export function heartbeatBpm(tension: number): number {
  const t = Number.isFinite(tension) ? Math.min(1, Math.max(0, tension)) : 0;
  return HEARTBEAT_BPM_RANGE.min + (HEARTBEAT_BPM_RANGE.max - HEARTBEAT_BPM_RANGE.min) * t;
}

/** The creature is heard breathing within this many tiles. */
export const BREATH_RANGE = 14;
/** The proximity drone starts within this many tiles, and may start again once the creature has gone beyond REARM_RANGE. */
export const PROXIMITY_RANGE = 6;
const PROXIMITY_REARM_RANGE = 9;
const PROXIMITY_GAP = 14;

/** What is left of a clock after an interval elapsed. After a long stall it restarts instead of firing in a burst. */
function carry(clock: number, interval: number): number {
  const rest = clock - interval;
  return rest > interval ? 0 : rest;
}

interface EnvironmentEvent {
  at: number;
  cue: Cue;
  gain: number;
  pan: number;
}

const ENVIRONMENT_KINDS: { cue: Cue; weight: number; gain: [number, number] }[] = [
  { cue: "drip", weight: 0.42, gain: [0.35, 0.8] },
  { cue: "pipeTick", weight: 0.25, gain: [0.3, 0.7] },
  { cue: "woodCreak", weight: 0.23, gain: [0.2, 0.4] },
  { cue: "rumble", weight: 0.1, gain: [0.4, 0.7] },
];

/**
 * Everything the player hears of the creature and the house before the creature is in view: footsteps, breathing, a
 * heartbeat that follows the tension, a drone when it is close, and now and then a drip, a pipe, a far creak or a rumble.
 *
 * Environmental sounds follow a fixed sequence of game times, so the same game replays the same house. The other sounds
 * follow the real elapsed time passed in. Most calls return an empty list.
 */
export class PresenceSounds {
  private readonly steps = new MonsterSteps(16);
  private breathClock = 0;
  private heartClock = 0;
  private lastProximity = Number.NEGATIVE_INFINITY;
  private proximityArmed = true;
  private schedule: EnvironmentEvent[] = [];
  private scheduleRng = mulberry32(0x5ea17);
  private scheduleEnd = 4;
  private nextIndex = 0;

  /** Call about every 100 ms while the game runs. `seconds` is the real time since the last call, `gameTime` the world's clock. */
  update(info: ThreatInfo, seconds: number, gameTime: number): CuePlan[] {
    const plans: CuePlan[] = [];
    const step = this.steps.update(info, seconds);
    if (step) {
      // Far steps are quieter.
      const nearness = Math.max(0.25, 1 - info.distance / 20);
      plans.push({ cue: step.cue, options: { ...step.options, gain: (step.options?.gain ?? 1) * nearness } });
    }

    if (info.awake && info.distance < BREATH_RANGE) {
      const closeness = 1 - info.distance / BREATH_RANGE;
      this.breathClock += seconds;
      // Slow and faint at the edge of hearing, quick and loud when it is on top of the player.
      const breathInterval = 3.6 - 2.1 * closeness;
      if (this.breathClock >= breathInterval) {
        this.breathClock = carry(this.breathClock, breathInterval);
        plans.push({ cue: "breath", options: { pan: info.pan, gain: 0.25 + 0.75 * closeness } });
      }
    } else {
      this.breathClock = 0;
    }

    if (info.level >= HEARTBEAT_MIN_TENSION) {
      this.heartClock += seconds;
      const beatInterval = 60 / heartbeatBpm(info.level);
      if (this.heartClock >= beatInterval) {
        // Keep the remainder, so calls every 100 ms still average the requested rate.
        this.heartClock = carry(this.heartClock, beatInterval);
        plans.push({ cue: "heartbeat", options: { priority: true, gain: 0.5 + 0.5 * info.level } });
      }
    } else {
      this.heartClock = 0;
    }

    if (info.awake && info.distance > PROXIMITY_REARM_RANGE) this.proximityArmed = true;
    if (info.awake && info.distance < PROXIMITY_RANGE && this.proximityArmed && gameTime - this.lastProximity >= PROXIMITY_GAP) {
      this.proximityArmed = false;
      this.lastProximity = gameTime;
      plans.push({ cue: "proximity", options: { pan: info.pan, gain: 0.6 + 0.4 * info.level } });
    }

    const environment = this.nextEnvironment(gameTime);
    if (environment) plans.push({ cue: environment.cue, options: { pan: environment.pan, gain: environment.gain } });
    return plans;
  }

  /** The next scheduled sound if its time has come. Sounds that were due long ago (a stalled tab) are skipped. */
  private nextEnvironment(gameTime: number): EnvironmentEvent | null {
    if (!Number.isFinite(gameTime)) return null;
    while (this.scheduleEnd <= gameTime + 30) this.extendSchedule();
    let due: EnvironmentEvent | null = null;
    while (this.nextIndex < this.schedule.length && this.schedule[this.nextIndex]!.at <= gameTime) {
      const event = this.schedule[this.nextIndex]!;
      this.nextIndex += 1;
      due = gameTime - event.at <= 2 ? event : due;
    }
    return due;
  }

  private extendSchedule(): void {
    const rng = this.scheduleRng;
    const roll = rng();
    let kind = ENVIRONMENT_KINDS[ENVIRONMENT_KINDS.length - 1]!;
    let sum = 0;
    for (const candidate of ENVIRONMENT_KINDS) {
      sum += candidate.weight;
      if (roll < sum) {
        kind = candidate;
        break;
      }
    }
    const [low, high] = kind.gain;
    this.schedule.push({ at: this.scheduleEnd, cue: kind.cue, gain: low + (high - low) * rng(), pan: (rng() * 2 - 1) * 0.8 });
    this.scheduleEnd += 5 + rng() * 7;
  }

  reset(): void {
    this.steps.reset();
    this.breathClock = 0;
    this.heartClock = 0;
    this.lastProximity = Number.NEGATIVE_INFINITY;
    this.proximityArmed = true;
    this.schedule = [];
    this.scheduleRng = mulberry32(0x5ea17);
    this.scheduleEnd = 4;
    this.nextIndex = 0;
  }
}
