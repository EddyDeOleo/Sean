/**
 * The monster's animation controller. It reads the monster's AI state, its real speed, and its distance to the player, and
 * decides which skeletal clip plays and which procedural attack layer is active. It never changes the AI, movement,
 * pursuit, detection, attack timing or collision. The attack that the controller shows is driven by the existing
 * ATTACKING state: the game still decides when the catch happens.
 *
 * Clips come from the rigged production model: IDLE, WALK and RUN share one skeleton. The attack is procedural: it is the
 * IDLE clip with additive bone offsets (spine, chest, neck, head, arms) and a short forward displacement of the body.
 *
 * The game's catch timing (ATTACK_FOR in world.ts, 0.35 s) is shorter than a full attack. The controller plays anticipation
 * and the lunge inside that window. After the catch, the existing caught close-up (renderer.ts, poseForScare) takes over.
 */
import type { MonsterState } from "./world";

export type MotionClip = "IDLE" | "WALK" | "RUN";
export type AttackPhase = "NONE" | "ANTICIPATION" | "LUNGE" | "HOLD" | "RECOVERY";

/** Euler angles (x, y, z) in radians, added to a bone's clip pose. */
export type BoneAngles = readonly [number, number, number];

export interface AttackLayer {
  /** Additive rotations by bone name. */
  bones: Record<string, BoneAngles>;
  /** Forward displacement of the whole body in tiles (+x is the monster's front). */
  bodyX: number;
  /** Forward lean of the whole body in radians. */
  bodyPitch: number;
  /** 0 to 1: how far the attack has built up. Used for the aura's flash. */
  intensity: number;
}

export interface AnimationInput {
  state: MonsterState;
  /** Tiles per second the monster actually moved this frame. */
  speed: number;
  /** Tiles from the monster to the player. */
  distance: number;
  reducedMotion: boolean;
}

export interface AnimationFrame {
  clip: MotionClip;
  /** Playback rate of the clip, from the real speed. */
  rate: number;
  attackPhase: AttackPhase;
  /** The active attack layer, or null when there is none. */
  attack: AttackLayer | null;
}

/** Speeds in tiles per second. Below WALK_MIN the monster stands still, whatever its state. */
export const WALK_MIN = 0.3;
export const RUN_MIN = 2.3;
/** The speeds the clips were authored for: the playback rate is 1 at these speeds. */
export const WALK_REFERENCE_SPEED = 1.9;
export const RUN_REFERENCE_SPEED = 2.9;

export const ANTICIPATION_SECONDS = 0.12;
export const LUNGE_SECONDS = 0.2;
export const RECOVERY_SECONDS = 0.35;
/** The forward displacement of the lunge, before it is limited by the distance to the player. */
const LUNGE_DISTANCE = 0.3;
/** The lunge never ends closer than this to the player, so the body never reaches through them. */
const STOP_DISTANCE = 0.6;
const MAX_DT = 0.1;

export function locomotionClip(state: MonsterState, speed: number): MotionClip {
  if (state === "DORMANT" || speed < WALK_MIN) return "IDLE";
  if (state === "PURSUING" && speed >= RUN_MIN) return "RUN";
  return "WALK";
}

/** The clip's playback rate: the real speed relative to the speed the clip was authored for. */
export function playbackRate(clip: MotionClip, speed: number): number {
  if (clip === "IDLE") return 1;
  const reference = clip === "RUN" ? RUN_REFERENCE_SPEED : WALK_REFERENCE_SPEED;
  const lower = clip === "RUN" ? 0.6 : 0.5;
  const upper = clip === "RUN" ? 1.6 : 1.5;
  return Math.min(upper, Math.max(lower, speed / reference));
}

function easeInOut(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

function easeInCubic(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u * u * u;
}


/**
 * The attack layer at a moment of the attack. The anticipation leans the upper body back and lifts the arms slightly.
 * The lunge drives the body forward: the spine, neck and head go forward and the arms come up in front. The angles are in
 * the bones' own frames and were checked on the rigged model in the validation view.
 */
export function attackBones(anticipation: number, lunge: number): Record<string, BoneAngles> {
  // Rig: the lateral axis is X and the front is +z. A positive angle about X tips a bone toward the front; for the arms,
  // +z on the left arm and -z on the right arm swing them outward, so the opposite signs bring them inward.
  // Anticipation: the arms are drawn back, the shoulders pull back, and the torso compresses slightly.
  // Lunge: the shoulders drive forward, the arms reach toward the player with the elbows bent and the hands curled, and the
  // torso leans in. The neck and head counter the spine so the face stays aimed at the player. The two arms are not mirror
  // images: the right reaches further forward and the left comes in across the body, as a grab does.
  const a = easeInOut(anticipation);
  const l = easeInCubic(lunge);
  return {
    spine: [-0.2 * a + 0.8 * l, 0, 0],
    chest: [-0.15 * a + 0.4 * l, 0, 0],
    neck: [-0.1 * a - 0.7 * l, 0, 0],
    head: [-0.05 * a - 0.35 * l, 0, 0],
    "shoulder.L": [-0.25 * a + 0.35 * l, 0, 0],
    "shoulder.R": [-0.25 * a + 0.35 * l, 0, 0],
    "upperArm.L": [-0.6 * a + 1.25 * l, 0, -0.3 * l],
    "upperArm.R": [-0.6 * a + 1.45 * l, 0, 0.2 * l],
    "lowerArm.L": [-0.4 * a - 0.7 * l, 0, 0],
    "lowerArm.R": [-0.4 * a - 0.9 * l, 0, 0],
    "hand.L": [-0.5 * l, 0, 0],
    "hand.R": [-0.5 * l, 0, 0],
  };
}


/**
 * The caught close-up's pose, from 0 (the clean clip pose) to 1 (the full grasp), as offsets on the clean pose for every bone
 * except the creature's right arm (see GRASP_RIGHT_ARM). The left arm comes forward and out with a bent elbow and a curled
 * hand. The torso leans in only a little, so the chest does not fill the frame, and the head stays on the player. The values
 * are added after the clean pose is restored, so they never accumulate.
 *
 * The left arm's angles were solved against the rig's rest-pose bone positions (see monsterAnimation.test.ts) and accepted on
 * browser captures in cycle 17.
 */
export function graspBones(t: number): Record<string, BoneAngles> {
  const k = easeInOut(t);
  return {
    spine: [0.35 * k, 0, 0],
    chest: [0.2 * k, 0, 0],
    neck: [-0.5 * k, 0, 0],
    head: [-0.3 * k, 0, 0],
    "shoulder.L": [-0.5 * k, 0, 0],
    "upperArm.L": [0.4 * k, 0, 0.1 * k],
    "lowerArm.L": [-1.8 * k, 0, 0],
    "hand.L": [-0.39 * k, 0, 0],
  };
}

/**
 * How far the right arm has turned toward GRASP_RIGHT_ARM at grasp time `t`, from 0 to 1. It eases out, so the arm is mostly
 * raised before the close-up's camera arrives. With the grasp's ease-in-out, the arm passed through a sideways reach while
 * the camera was closing in, and the claw swung past the screen's edge for a few frames of the lunge.
 */
export function rightArmWeight(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

/**
 * The creature's right arm (rig ".R", on the left of the screen when it faces the camera) at the full grasp, as local
 * rotations (x, y, z, w) relative to each bone's parent. The close-up turns each bone from its clip pose toward these by
 * rightArmWeight, with a spherical interpolation.
 *
 * Why targets and not offsets: the clip pose at the catch is a cross-fade from WALK or RUN into IDLE, so the arm's starting
 * rotation differs from catch to catch (measured: 17 degrees on the upper arm). An offset on top of it gives a different arm
 * every time, and the large rotation a raised arm needs magnifies the difference. A target relative to the parent bone gives
 * the same arm shape against the torso at every catch.
 *
 * The pose (cycle 18): the clavicle lifts about 20 degrees and comes forward, the upper arm swings out to the side to about
 * 28 degrees below horizontal with the elbow slightly behind the shoulder, the elbow flexes forward to an interior angle of
 * about 83 degrees, and the forearm rises about 44 degrees so the wrist is level with the jaw in the face plane and the claw
 * points up beside the head. The previous offsets bent the elbow backward (the rig's flexion is +x on the forearm; the rest
 * pose already holds +0.34) and left the shoulder level, so the arm folded behind a sunken shoulder. Solved with two-bone IK
 * against the rig's rest pose, then checked on browser captures of open and enclosed catches.
 */
export const GRASP_RIGHT_ARM: Readonly<Record<string, readonly [number, number, number, number]>> = {
  "shoulder.R": [0.0407, -0.0246, 0.535, 0.8435],
  "upperArm.R": [-0.4942, 0.547, 0.3194, 0.5954],
  "lowerArm.R": [0.7474, -0.0002, -0.0015, 0.6643],
  "hand.R": [0.2956, -0.0515, -0.2621, 0.9172],
};

export class MonsterAnimationController {
  private attackActive = false;
  private phase: AttackPhase = "NONE";
  private elapsed = 0;
  private hold = 0;
  private recoverFrom: AttackLayer | null = null;

  /** Clears any attack or recovery in progress. A new attempt starts with none, so nothing carries over from the last one. */
  reset(): void {
    this.attackActive = false;
    this.phase = "NONE";
    this.elapsed = 0;
    this.hold = 0;
    this.recoverFrom = null;
  }
  /** Whether an attack is currently in progress (from its entry until the attack state ends). */
  get attacking(): boolean {
    return this.attackActive;
  }

  update(input: AnimationInput, rawDt: number): AnimationFrame {
    const dt = Math.min(Math.max(rawDt, 0), MAX_DT);
    const attacking = input.state === "ATTACKING";

    // The attack starts once, on entry into ATTACKING. Ticks while the attack state lasts do not restart it.
    if (attacking && !this.attackActive) {
      this.attackActive = true;
      this.phase = "ANTICIPATION";
      this.elapsed = 0;
      this.recoverFrom = null;
    } else if (!attacking && this.attackActive) {
      this.attackActive = false;
      this.recoverFrom = this.layerAt(this.phase === "RECOVERY" ? "HOLD" : this.phase, this.elapsed, this.hold, input.distance);
      this.phase = "RECOVERY";
      this.elapsed = 0;
    }

    let attack: AttackLayer | null = null;
    if (this.attackActive) {
      this.elapsed += dt;
      if (this.phase === "ANTICIPATION" && this.elapsed >= ANTICIPATION_SECONDS) {
        this.phase = "LUNGE";
        this.elapsed -= ANTICIPATION_SECONDS;
      } else if (this.phase === "LUNGE" && this.elapsed >= LUNGE_SECONDS) {
        this.phase = "HOLD";
        this.elapsed -= LUNGE_SECONDS;
      }
      if (this.phase === "HOLD") this.hold += dt;
      attack = this.layerAt(this.phase, this.elapsed, this.hold, input.distance);
    } else if (this.phase === "RECOVERY" && this.recoverFrom) {
      this.elapsed += dt;
      const u = Math.min(1, this.elapsed / RECOVERY_SECONDS);
      if (u >= 1) {
        this.phase = "NONE";
        this.recoverFrom = null;
        this.hold = 0;
      } else {
        attack = scaleLayer(this.recoverFrom, 1 - easeInOut(u));
      }
    } else {
      this.phase = "NONE";
    }

    if (input.reducedMotion && attack) {
      // Reduced motion: the attack is shown as the clip only; no layer moves the body or the bones.
      attack = null;
    }

    const clip = locomotionClip(input.state, input.speed);
    return {
      clip: this.attackActive ? "IDLE" : clip,
      rate: this.attackActive ? 1 : playbackRate(clip, input.speed),
      attackPhase: this.phase,
      attack,
    };
  }

  private layerAt(phase: AttackPhase, elapsed: number, hold: number, distance: number): AttackLayer {
    const lungeTravel = Math.max(0, Math.min(LUNGE_DISTANCE, distance - STOP_DISTANCE));
    if (phase === "ANTICIPATION") {
      return { bones: attackBones(elapsed / ANTICIPATION_SECONDS, 0), bodyX: 0, bodyPitch: -0.05 * easeInOut(elapsed / ANTICIPATION_SECONDS), intensity: 0.3 * easeInOut(elapsed / ANTICIPATION_SECONDS) };
    }
    if (phase === "LUNGE") {
      const l = easeInCubic(elapsed / LUNGE_SECONDS);
      return { bones: attackBones(1, l), bodyX: lungeTravel * l, bodyPitch: 0.1 * l, intensity: 0.3 + 0.7 * l };
    }
    // HOLD and RECOVERY-start: the strike is held, with a slight tremor so the pose is not frozen.
    const tremor = 0.02 * Math.sin(hold * 23);
    return { bones: attackBones(1, 1), bodyX: lungeTravel, bodyPitch: 0.1 + tremor, intensity: 1 };
  }
}

function scaleLayer(layer: AttackLayer, k: number): AttackLayer {
  const bones: Record<string, BoneAngles> = {};
  for (const [name, [x, y, z]] of Object.entries(layer.bones)) bones[name] = [x * k, y * k, z * k];
  return { bones, bodyX: layer.bodyX * k, bodyPitch: layer.bodyPitch * k, intensity: layer.intensity * k };
}
