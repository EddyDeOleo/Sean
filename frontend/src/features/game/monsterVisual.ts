/**
 * The monster's visual: the rigged production model, its skeletal clips (IDLE, WALK, RUN), its procedural attack layer, and
 * the crimson aura. The renderer places it and turns it from the monster's position and yaw, as before. The AI is not
 * touched: the animation controller (monsterAnimation.ts) only reads the AI state.
 *
 * The aura (light, halo, floor pool) is a child of the body, so it moves with the lunge.
 *
 * If the model cannot be loaded, the procedural creature (creature.ts) is shown instead, so the game still runs. Until the
 * model (or that fallback) is ready, nothing is drawn, so the monster never flashes in before the first evidence fragment.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { Creature, type CreatureView } from "./creature";
import { GRASP_RIGHT_ARM, graspBones, MonsterAnimationController, rightArmWeight, type AnimationFrame, type AttackPhase } from "./monsterAnimation";
import type { ScarePose } from "./cinematic";
import { addBoneOffset, findBone, poseWithOffsets, restorePose, slerpBonesTowards, snapshotPose, type PoseSnapshot } from "./monsterPose";

/** The production model: the 250k geometry with its skeleton and the three clips (see docs, section 59). */
export const MONSTER_MODEL_URL = "/models/sean-monster-250k-rigged.glb";
/** Only files of this shape may be chosen by the development override. */
const DEV_MODEL_PATTERN = /^\/models\/sean-monster[\w-]*\.glb$/;
/** Height in tiles. The procedural creature was about 1.05 tiles upright, and the model is scaled to the same height. */
export const MODEL_HEIGHT = 1.05;
/** The aura's colour. Deep crimson: no blue, cyan, purple or pink. */
const LIGHT_COLOUR = 0x8a0812;
/** The aura while the creature is dormant or searching: a faint neutral warm light, so crimson stays a hunting signal. */
const CALM_LIGHT_COLOUR = 0xd8d4cc;
const CALM_LIGHT_INTENSITY = 0.15;
const LIGHT_INTENSITY = 0.55;
/** Quarter turn about Y that maps the rig's front (+z) onto the game's facing (+x). */
const RIG_FACING_TURN = Math.PI / 2;
/** Seconds to blend from one clip to the next. */
const CROSSFADE_SECONDS = 0.25;

/**
 * The model URL. In a development build only, `?monsterModel=/models/<name>.glb` selects another candidate, so the
 * benchmark can compare them in the real game. The name must match DEV_MODEL_PATTERN. Production builds ignore it. The
 * candidates live in assets/monster/variants/, which the dev server alone serves under /models/ (src/dev/modelVariantsPlugin.ts).
 */
export function monsterModelUrl(search: string = typeof window !== "undefined" ? window.location.search : ""): string {
  if (!import.meta.env.DEV) return MONSTER_MODEL_URL;
  const requested = new URLSearchParams(search).get("monsterModel");
  return requested !== null && DEV_MODEL_PATTERN.test(requested) ? requested : MONSTER_MODEL_URL;
}

/** A soft radial falloff: a dark red core that fades to nothing at the edge. Used for the halo and the floor pool. */
function radialTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(192,18,30,0.9)");
    gradient.addColorStop(0.35, "rgba(120,8,18,0.45)");
    gradient.addColorStop(1, "rgba(20,0,2,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  // The gradient is written in sRGB. Without this the crimson core was read as linear and rendered about twice as bright.
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const TEXTURE_SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap", "displacementMap"] as const;

/** Frees the geometry, materials and textures under an object. Used for the model when it is discarded. */
function disposeTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const slot of TEXTURE_SLOTS) {
        const texture = (material as unknown as Record<string, THREE.Texture | null | undefined>)[slot];
        texture?.dispose();
      }
      material.dispose();
    }
  });
}

/** The loaded skeleton and its three clips, all from one AnimationMixer. */
interface Rig {
  mixer: THREE.AnimationMixer;
  skeleton: THREE.Skeleton;
  actions: Record<"IDLE" | "WALK" | "RUN", THREE.AnimationAction>;
}

export class MonsterVisual {
  /** The whole visual. The renderer places it, turns it, and shows or hides it through setShown(). */
  readonly group = new THREE.Group();
  /** Everything that moves with the monster's body: the model, the aura, and the procedural fallback. */
  private readonly body = new THREE.Group();
  private readonly ownLight: THREE.PointLight;
  private readonly halo: THREE.Sprite;
  private readonly floorPool: THREE.Mesh;
  private readonly radial: THREE.CanvasTexture;
  private readonly controller = new MonsterAnimationController();
  private model: THREE.Object3D | null = null;
  private rig: Rig | null = null;
  private current: "IDLE" | "WALK" | "RUN" | null = null;
  private fallback: Creature | null = null;
  private loaded = false;
  private wanted = false;
  private disposed = false;
  private readonly startedAt = performance.now();
  private loadedAt: number | null = null;
  private readonly url: string;
  private frame: AnimationFrame | null = null;
  /** The clip pose of every bone (by skeleton index) from the last mixer update, without any attack offset. */
  private clipPose: PoseSnapshot | null = null;

  constructor(textureSize: number, url: string = monsterModelUrl()) {
    this.url = url;
    this.radial = radialTexture();
    this.ownLight = new THREE.PointLight(CALM_LIGHT_COLOUR, CALM_LIGHT_INTENSITY, 2.6, 2);
    this.ownLight.position.set(0.05, 0.75, 0);
    this.halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.radial, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.42 }),
    );
    this.halo.scale.set(2.4, 2.6, 1);
    this.halo.position.set(0, 0.5, 0);
    this.floorPool = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.8),
      new THREE.MeshBasicMaterial({ map: this.radial, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.38 }),
    );
    this.floorPool.rotation.x = -Math.PI / 2;
    this.floorPool.position.y = 0.01;
    this.body.add(this.ownLight, this.halo, this.floorPool);
    this.group.add(this.body);
    this.group.visible = false;
    this.load(textureSize);
  }

  /** The light that colours the creature's surroundings. The procedural fallback has its own, which takes its place. */
  get light(): THREE.PointLight {
    return this.fallback ? this.fallback.light : this.ownLight;
  }

  /** The attack phase currently shown (NONE when no attack is in progress). */
  get animationPhase(): AttackPhase | "IDLE" | "WALKING" | "RUNNING" {
    if (this.frame?.attack) return this.frame.attackPhase === "NONE" ? "IDLE" : this.frame.attackPhase;
    if (this.frame) return this.frame.clip === "RUN" ? "RUNNING" : this.frame.clip === "WALK" ? "WALKING" : "IDLE";
    return "IDLE";
  }

  /** The clip currently playing, for the validation view and the tests. Null for the fallback or while loading. */
  get clipName(): string | null {
    return this.current;
  }

  /** Milliseconds from construction until the model (or the fallback) was ready. Null while still loading. */
  get loadMilliseconds(): number | null {
    return this.loadedAt === null ? null : this.loadedAt - this.startedAt;
  }

  /** Which asset this visual uses. */
  get modelUrl(): string {
    return this.url;
  }

  /** Show or hide the monster. It is drawn only when wanted and loaded. */
  setShown(shown: boolean): void {
    this.wanted = shown;
    this.applyShown();
  }

  /** Animate toward what the monster is doing. `dt` is the real frame time. */
  update(view: CreatureView, dt: number): void {
    if (this.fallback) {
      this.fallback.update(view, dt);
    } else if (this.rig) {
      this.frame = this.controller.update(
        { state: view.state, speed: view.speed, distance: view.distance ?? Infinity, reducedMotion: view.reducedMotion },
        dt,
      );
      this.setClip(this.frame.clip, this.frame.rate);
      // The mixer blends into the bones' current values, so the previous frame's attack offsets must be removed first.
      // Without this they compound from frame to frame (measured: the neck reached 155 degrees in 0.1 s).
      this.restoreClipPose();
      this.rig.mixer.update(dt);
      this.snapshotClipPose();
      this.applyAttack(this.frame);
    }
    this.pulse(view);
  }

  /**
   * The caught close-up's pose for one frame, from the cinematic timeline. The attack layer is cleared and the grasp is
   * applied on the clean clip pose in the same step, so repeated frames give the same pose. Undone by clearScarePose().
   */
  poseForScare(pose: ScarePose, time: number): void {
    if (this.fallback) {
      this.fallback.poseForScare(pose.grasp, time);
      return;
    }
    this.frame = null;
    this.body.position.set(0, 0, 0);
    if (this.rig && this.clipPose) {
      poseWithOffsets(this.rig.skeleton, this.clipPose, graspBones(pose.grasp));
      slerpBonesTowards(this.rig.skeleton, GRASP_RIGHT_ARM, rightArmWeight(pose.grasp));
    }
    this.body.rotation.set(0, 0, -0.3 * pose.grasp);
    this.flashAura(pose.flash);
  }

  /** A new attempt: the controller forgets any attack or recovery, and the bones return to the clean clip pose. */
  resetAnimation(): void {
    this.controller.reset();
    this.clearScarePose();
    this.clearAttackLayer();
    this.frame = null;
  }
  /**
   * Caught without the cinematic: the creature stops animating and holds a clean pose. The lunge layer is removed and the
   * clip pose is restored, so no attack offset remains on the bones. The aura goes back to its normal level.
   */
  holdCaughtPose(view: CreatureView): void {
    if (this.fallback) {
      this.fallback.update(view, 0);
      return;
    }
    this.clearScarePose();
    this.clearAttackLayer();
    this.pulse(view);
  }
  /**
   * The aura during the caught close-up, set from the cinematic's flash (0 resting, 1 at the impact). The normal aura is
   * driven by pulse(), which the close-up does not call.
   */
  private flashAura(flash: number): void {
    const level = Math.min(1, 0.45 + 0.55 * flash);
    (this.halo.material as THREE.SpriteMaterial).opacity = level;
    (this.floorPool.material as THREE.MeshBasicMaterial).opacity = level * 0.9;
  }

  clearScarePose(): void {
    if (this.fallback) {
      this.fallback.clearScarePose();
      return;
    }
    this.body.rotation.set(0, 0, 0);
  }

  /** Where the head is in the world, after the group has been placed. Used to aim the capture camera. */
  headWorld(target: THREE.Vector3): THREE.Vector3 {
    if (this.fallback) return this.fallback.headWorld(target);
    this.group.updateMatrixWorld(true);
    // The real head bone, so the caught close-up aims at the face as the skeleton is posed, not at a fixed height.
    const head = this.rig ? findBone(this.rig.skeleton, "head") : null;
    if (head) return head.getWorldPosition(target);
    return target.set(0, MODEL_HEIGHT * 0.93, 0).applyMatrix4(this.group.matrixWorld);
  }

  /** The aura's current halo opacity. Read by the development measurements only. */
  get auraOpacity(): number {
    return this.fallback ? 0 : (this.halo.material as THREE.SpriteMaterial).opacity;
  }

  /** The additional light of an attack's impact, read by the renderer for the camera's shake. 0 when there is none. */
  get impactIntensity(): number {
    return this.frame?.attack?.intensity ?? 0;
  }

  /** Frees the model, the mixer, and the aura textures. Safe to call while the model is still loading. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.rig?.mixer.stopAllAction();
    if (this.model) disposeTree(this.model);
    this.radial.dispose();
    (this.halo.material as THREE.SpriteMaterial).dispose();
    this.floorPool.geometry.dispose();
    (this.floorPool.material as THREE.MeshBasicMaterial).dispose();
  }

  private load(textureSize: number): void {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      this.url,
      (gltf) => {
        if (this.disposed) {
          disposeTree(gltf.scene);
          return;
        }
        this.attachModel(gltf);
      },
      undefined,
      (error: unknown) => {
        // Failure is not silent: the console says it, and the procedural creature takes the model's place.
        const kind = error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : "UnknownError";
        console.warn("The monster model could not be loaded; the procedural creature is shown instead.", kind);
        if (!this.disposed) this.useFallback(textureSize);
      },
    );
  }

  private attachModel(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): void {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = MODEL_HEIGHT / size.y;
    gltf.scene.scale.setScalar(scale);
    // Centred on the origin, feet on y = 0. The model's front is +x, the same as the game's facing: it is not turned.
    gltf.scene.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
    // The rig's front is +z (its face is on that side; checked in the validation view). The game faces +x, so the model is turned a quarter turn.
    const holder = new THREE.Group();
    holder.rotation.y = RIG_FACING_TURN;
    holder.add(gltf.scene);
    this.model = holder;
    this.body.add(holder);
    const skinned = findSkinned(gltf.scene);
    if (!skinned) throw new Error("the monster model has no skeleton");
    const mixer = new THREE.AnimationMixer(gltf.scene);
    const action = (name: string): THREE.AnimationAction => {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) throw new Error(`the monster model has no ${name} clip`);
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopRepeat, Infinity);
      return a;
    };
    this.rig = { mixer, skeleton: skinned.skeleton, actions: { IDLE: action("idle"), WALK: action("walk"), RUN: action("run") } };
    // The bind pose is the restore point until the first mixer update, so the caught close-up never adds to an unrecorded pose.
    this.snapshotClipPose();
    this.setClip("IDLE", 1);
    this.markLoaded();
  }

  private useFallback(textureSize: number): void {
    this.fallback = new Creature(textureSize);
    this.body.add(this.fallback.group);
    this.ownLight.visible = false;
    this.markLoaded();
  }

  private markLoaded(): void {
    this.loaded = true;
    this.loadedAt = performance.now();
    this.applyShown();
  }

  private applyShown(): void {
    this.group.visible = this.wanted && this.loaded;
  }

  /** Crossfades to the clip if it changed, and keeps the playback rate in step with the real speed. */
  private setClip(clip: "IDLE" | "WALK" | "RUN", rate: number): void {
    if (!this.rig) return;
    const next = this.rig.actions[clip];
    if (this.current !== clip) {
      const previous = this.current ? this.rig.actions[this.current] : null;
      next.reset().setEffectiveWeight(1).play();
      if (previous) previous.crossFadeTo(next, CROSSFADE_SECONDS, false);
      this.current = clip;
    }
    next.setEffectiveTimeScale(rate);
  }

  /** Applies the attack layer's bone offsets after the mixer has written the clip's pose, and places the body. */
  private applyAttack(frame: AnimationFrame): void {
    if (!this.rig) return;
    const layer = frame.attack;
    this.body.position.set(layer ? layer.bodyX : 0, 0, 0);
    this.body.rotation.set(0, 0, layer ? -layer.bodyPitch : 0);
    if (!layer) return;
    for (const [name, [x, y, z]] of Object.entries(layer.bones)) {
      const bone = findBone(this.rig.skeleton, name);
      if (!bone) continue;
      addBoneOffset(bone, [x, y, z]);
    }
  }

  /** Removes any attack layer from the bones and the body. The caught close-up then poses from the clip pose alone. */
  private clearAttackLayer(): void {
    this.frame = null;
    this.body.position.set(0, 0, 0);
    this.restoreClipPose();
  }

  /**
   * Writes the last recorded clip pose back onto every bone. Called before each mixer update and when the attack layer is
   * cleared. The mixer blends into the bones' current values, so without this the attack offsets compound frame to frame.
   * Does nothing before the first mixer update.
   */
  private restoreClipPose(): void {
    if (!this.rig || !this.clipPose) return;
    restorePose(this.rig.skeleton.bones, this.clipPose);
  }

  /** Records every bone's clip pose, before the attack layer is applied on top of it. */
  private snapshotClipPose(): void {
    if (!this.rig) return;
    this.clipPose = snapshotPose(this.rig.skeleton.bones);
  }

  private pulse(view: CreatureView): void {
    const hunting = view.state === "PURSUING" || view.state === "ATTACKING";
    const attack = this.frame?.attack ? this.frame.attack.intensity * 0.5 : 0;
    // Crimson is the hunting signal: the light, halo and floor pool are crimson only while the creature hunts or attacks.
    // Dormant or searching, they are faint and neutral, so the archive around it is not washed red.
    const base = hunting ? 0.6 + attack : 0.16;
    const beat = hunting && !view.reducedMotion ? Math.sin(view.time * 1.6) * 0.06 : 0;
    (this.halo.material as THREE.SpriteMaterial).opacity = base + beat;
    (this.floorPool.material as THREE.MeshBasicMaterial).opacity = base * 0.9 + beat;
    this.ownLight.color.setHex(hunting ? LIGHT_COLOUR : CALM_LIGHT_COLOUR);
    this.ownLight.intensity = hunting ? LIGHT_INTENSITY : CALM_LIGHT_INTENSITY;
  }
}

function findSkinned(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((object) => {
    if (!found && (object as THREE.SkinnedMesh).isSkinnedMesh) found = object as THREE.SkinnedMesh;
  });
  return found;
}
