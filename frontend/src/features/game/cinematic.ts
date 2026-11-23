/**
 * The caught cinematic: a pure timeline of the close-up, read from the seconds elapsed since the catch (world status CAUGHT).
 * It only decides the camera and the creature's pose. The catch itself, and its timing in world.ts, are not touched.
 *
 * Sequence: ANTICIPATION -> ACCELERATION -> LUNGE -> IMPACT -> HOLD -> DEFEAT_CARD. The phases are contiguous, the values
 * are continuous at each boundary, and every value is computed from the elapsed time alone, so the result never depends on
 * how many frames were drawn.
 *
 * The framing is derived from the real model height (MODEL_HEIGHT) and the camera's near plane, not chosen by eye:
 * - the view spans FRAMED_SPAN tiles vertically at the face, which covers the head, neck and top of the shoulders;
 * - the face distance is what makes that span fit the SCARE_FOV_DEG field of view;
 * - the face must stay well beyond the near plane, which is checked by the unit tests.
 */
import { MODEL_HEIGHT } from "./monsterVisual";

/** The camera's near plane in tiles. The renderer creates the camera with this value. */
export const CAMERA_NEAR = 0.05;

/** The most the creature's body extends behind its head, in tiles. An estimate of the torso depth: a third of the height. */
export const CREATURE_DEPTH = MODEL_HEIGHT * 0.3;

/** The closest the head may come to the eye. Four near planes keep the face clear of the lens. */
export const MIN_REACH = CAMERA_NEAR * 4;

const SCARE_FOV_DEG = 60;
const ANTICIPATION_FOV_DEG = 70;
/** The vertical span of the view at the face: the head, the neck and the top of the shoulders. */
const FRAMED_SPAN = MODEL_HEIGHT * 0.5;
/** Tiles from the eye to the head centre, at which FRAMED_SPAN fills the view at SCARE_FOV_DEG. */
export const FACE_DISTANCE = FRAMED_SPAN / 2 / Math.tan((SCARE_FOV_DEG * Math.PI) / 360);

/** When each phase starts, in seconds after the catch. The defeat card appears at DEFEAT_CARD. */
export const CINEMATIC_TIMES = {
  ANTICIPATION: 0,
  ACCELERATION: 0.3,
  LUNGE: 0.5,
  IMPACT: 0.62,
  HOLD: 0.8,
  DEFEAT_CARD: 1.4,
} as const;

export type CinematicPhase = keyof typeof CINEMATIC_TIMES;

/** The creature's pose and the aura's brightness. Read by MonsterVisual.poseForScare. */
export interface ScarePose {
  /** 0 is the clean clip pose, 1 is the full grasp. */
  grasp: number;
  /** 0 is the resting aura, 1 is the impact flash. */
  flash: number;
}

export interface CinematicFrame extends ScarePose {
  phase: CinematicPhase;
  /** Tiles from the eye to the head centre, along the view. */
  reach: number;
  /** Vertical field of view in degrees. */
  fov: number;
  /** Camera shake amplitude in tiles. */
  shake: number;
  /** Pitch kick at the impact, in radians. */
  kick: number;
  /** Camera pitch during the approach, in radians (negative looks down). See APPROACH_TILT. */
  tilt: number;
  /** Whether the defeat card may be shown. */
  cardVisible: boolean;
}

/** The creature's head is placed this far in front of the eye at the start of the approach, in model heights. */
const APPROACH_START_REACH = MODEL_HEIGHT * 1.2;
const ANTICIPATION_END_REACH = MODEL_HEIGHT * 1.0;
const ACCELERATION_END_REACH = MODEL_HEIGHT * 0.67;
/**
 * The camera looks slightly down while the creature approaches. In the acceleration the clip pose's hanging hand is at floor
 * height about 0.75 tiles from the eye, 37 degrees below the view line, past the 32 degree lower edge (cycle 17 captures:
 * the screen-right hand reached the bottom pixel row). The tilt rises from 0 over the anticipation, holds through the
 * acceleration and returns to 0 over the lunge, so the close-up from the impact on is unchanged.
 */
export const APPROACH_TILT = -0.25;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, u: number): number {
  return from + (to - from) * u;
}

function easeInOut(u: number): number {
  const v = clamp01(u);
  return v * v * (3 - 2 * v);
}

function easeIn(u: number): number {
  const v = clamp01(u);
  return v * v;
}

function easeOut(u: number): number {
  const v = clamp01(u);
  return 1 - (1 - v) ** 3;
}

/** Seconds since the catch, never negative. Times before the catch, and NaN, count as the catch itself. */
function sinceCatch(elapsed: number): number {
  return Number.isNaN(elapsed) ? 0 : Math.max(0, elapsed);
}

/** The phase that a given time since the catch falls in. */
export function phaseAt(elapsed: number): CinematicPhase {
  const e = sinceCatch(elapsed);
  if (e >= CINEMATIC_TIMES.DEFEAT_CARD) return "DEFEAT_CARD";
  if (e >= CINEMATIC_TIMES.HOLD) return "HOLD";
  if (e >= CINEMATIC_TIMES.IMPACT) return "IMPACT";
  if (e >= CINEMATIC_TIMES.LUNGE) return "LUNGE";
  if (e >= CINEMATIC_TIMES.ACCELERATION) return "ACCELERATION";
  return "ANTICIPATION";
}

/**
 * The camera and pose for the caught close-up at `elapsed` seconds after the catch. With reduced motion the creature is
 * placed at its final framing at once: no approach, no shake, no kick. The timing of the defeat card is unchanged.
 */
export function cinematicAt(elapsed: number, reducedMotion: boolean): CinematicFrame {
  const e = sinceCatch(elapsed);
  const phase = phaseAt(e);
  const cardVisible = e >= CINEMATIC_TIMES.DEFEAT_CARD;
  if (reducedMotion) {
    return { phase, reach: FACE_DISTANCE, grasp: 1, flash: 0.35, fov: SCARE_FOV_DEG, shake: 0, kick: 0, tilt: 0, cardVisible };
  }

  switch (phase) {
    case "ANTICIPATION": {
      const u = easeInOut(e / CINEMATIC_TIMES.ACCELERATION);
      return {
        phase,
        reach: lerp(APPROACH_START_REACH, ANTICIPATION_END_REACH, u),
        grasp: 0.15 * u,
        flash: 0.25 * u,
        fov: lerp(ANTICIPATION_FOV_DEG, 66, u),
        shake: 0.004 * u,
        kick: 0,
        tilt: APPROACH_TILT * u,
        cardVisible,
      };
    }
    case "ACCELERATION": {
      const u = (e - CINEMATIC_TIMES.ACCELERATION) / (CINEMATIC_TIMES.LUNGE - CINEMATIC_TIMES.ACCELERATION);
      return {
        phase,
        reach: lerp(ANTICIPATION_END_REACH, ACCELERATION_END_REACH, easeIn(u)),
        grasp: lerp(0.15, 0.5, u),
        flash: lerp(0.25, 0.5, u),
        fov: lerp(66, 62, u),
        shake: lerp(0.008, 0.012, u),
        kick: 0,
        tilt: APPROACH_TILT,
        cardVisible,
      };
    }
    case "LUNGE": {
      const u = (e - CINEMATIC_TIMES.LUNGE) / (CINEMATIC_TIMES.IMPACT - CINEMATIC_TIMES.LUNGE);
      const s = easeOut(u);
      return {
        phase,
        reach: lerp(ACCELERATION_END_REACH, FACE_DISTANCE, s),
        grasp: lerp(0.5, 1, s),
        flash: lerp(0.5, 0.8, u),
        fov: lerp(62, SCARE_FOV_DEG, s),
        shake: 0.014,
        kick: 0,
        tilt: APPROACH_TILT * (1 - s),
        cardVisible,
      };
    }
    case "IMPACT": {
      const since = e - CINEMATIC_TIMES.IMPACT;
      const decay = Math.exp(-since * 12);
      return {
        phase,
        reach: FACE_DISTANCE,
        grasp: 1,
        flash: 0.35 + 0.65 * Math.exp(-since * 8),
        fov: SCARE_FOV_DEG,
        shake: 0.05 * decay,
        kick: 0.06 * decay,
        tilt: 0,
        cardVisible,
      };
    }
    case "HOLD":
    case "DEFEAT_CARD": {
      const since = e - CINEMATIC_TIMES.HOLD;
      return {
        phase,
        reach: FACE_DISTANCE,
        grasp: 1,
        flash: 0.35,
        fov: SCARE_FOV_DEG,
        shake: 0.006 * Math.exp(-since * 4),
        kick: 0,
        tilt: 0,
        cardVisible,
      };
    }
  }
}

/**
 * The head's reach, limited so the creature's body stays in open floor. `openDistance` is how far ahead of the eye the floor
 * is clear. The head is pulled in only when a wall would otherwise pass through the body, and never closer than MIN_REACH.
 */
export function fitReach(wanted: number, openDistance: number): number {
  return Math.min(wanted, Math.max(MIN_REACH, openDistance - CREATURE_DEPTH));
}

/**
 * Enclosed catches (cycle 15). A catch in a locker corner leaves the creature no room in front of the eye: the eye stands
 * 0.3 tiles from the locker's tile centre toward the wall, and the wall is 0.2 tiles ahead of the eye. The creature's back
 * extends CREATURE_BACK_EXTENT tiles behind its head (measured over every phase, skinned bounds, cycle 15), so its head
 * anchor is moved ANCHOR_SHIFT toward the camera from the creature's tile centre, which keeps the body CREATURE_BACK_CLEARANCE
 * short of the wall. The camera then steps back along the view, out of the locker, by the same reach as the open framing.
 */
export const CREATURE_BACK_EXTENT = 0.57;
export const CREATURE_BACK_CLEARANCE = 0.1;
/** Wall distance from the locker's tile centre along the view (the wall is one half tile past it). */
export const LOCKER_WALL_DISTANCE = 0.5;
export const ANCHOR_SHIFT = CREATURE_BACK_EXTENT + CREATURE_BACK_CLEARANCE - LOCKER_WALL_DISTANCE;
/** The eye keeps this much clear floor before the nearest wall behind it when it steps back. */
export const RETREAT_MARGIN = 0.25;

export type FramingMode = "NORMAL" | "ENCLOSED";

/** Normal framing when the creature fits in front of the eye, enclosed framing otherwise. Uses the measured open floor ahead. */
export function framingFor(openAhead: number, wantedReach: number): FramingMode {
  return openAhead >= wantedReach + CREATURE_DEPTH ? "NORMAL" : "ENCLOSED";
}

export interface EnclosedCamera {
  eye: { x: number; y: number };
  anchor: { x: number; y: number };
  reach: number;
  /** Distance the eye stands behind the locker's own eye, along the view. */
  retreat: number;
}

/**
 * The enclosed camera for one catch. `forward` is the unit view direction, `spot` the creature's tile centre, `lockerEye` the
 * locker's eye point, and `backClearance` the clear floor measured from the locker eye along -forward. The reach is the wanted
 * reach, shortened only if the retreat would leave less than RETREAT_MARGIN of clear floor behind the eye.
 */
export function enclosedCamera(
  spot: { x: number; y: number },
  forward: { x: number; y: number },
  lockerEye: { x: number; y: number },
  wantedReach: number,
  backClearance: number,
): EnclosedCamera {
  const anchor = { x: spot.x - forward.x * ANCHOR_SHIFT, y: spot.y - forward.y * ANCHOR_SHIFT };
  // Distance from the anchor forward to the locker eye: the retreat that the anchor itself already needs.
  const anchorToLockerEye = (lockerEye.x - anchor.x) * forward.x + (lockerEye.y - anchor.y) * forward.y;
  const maxReach = backClearance - RETREAT_MARGIN - anchorToLockerEye;
  const reach = Math.max(0, Math.min(wantedReach, maxReach));
  const eye = { x: anchor.x - forward.x * reach, y: anchor.y - forward.y * reach };
  const retreat = anchorToLockerEye + reach;
  return { eye, anchor, reach, retreat };
}
