/**
 * The creature: a tall, thin, stooped humanoid built from primitives (Spec 4 section 11.5). Long arms that reach the floor,
 * a gaunt ribcage, an elongated head tilted on a thin neck, hollow eye sockets with a faint glint, a loose jaw with uneven
 * teeth. Its skin is drawn on a canvas (mottling, veins, stains) and every part's surface is roughened, so nothing is a clean
 * primitive. Nothing is downloaded and nothing here is a trademarked character.
 *
 * `update` animates the limbs from what the world says it is doing. The model faces local +x, stands on y = 0, and is about
 * 1.05 tiles tall when upright. The ceiling is 1.15 tiles high, so it stoops.
 */

import * as THREE from "three";
import type { MonsterState } from "./world";

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Push every vertex a little along its normal by a smooth-ish pseudo-random amount, so surfaces are not perfectly clean. */
function roughen(geometry: THREE.BufferGeometry, amount: number, seed: number): THREE.BufferGeometry {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  for (let i = 0; i < position.count; i += 1) {
    // Coarse, so neighbouring vertices move together instead of turning the surface into static.
    const n = hash(Math.round(position.getX(i) * 40) + seed, Math.round(position.getY(i) * 40 + position.getZ(i) * 23)) - 0.5;
    position.setXYZ(i, position.getX(i) + normal.getX(i) * n * amount, position.getY(i) + normal.getY(i) * n * amount, position.getZ(i) + normal.getZ(i) * n * amount);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function skinTexture(size: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#8b8c80";
    ctx.fillRect(0, 0, size, size);
    // Mottling
    for (let i = 0; i < size * 10; i += 1) {
      const v = 95 + Math.floor(hash(i, 3) * 70);
      ctx.fillStyle = `rgba(${v},${v + 2},${v - 6},0.35)`;
      ctx.beginPath();
      ctx.arc(hash(i, 4) * size, hash(i, 5) * size, 1 + hash(i, 6) * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Stains and bruises
    for (let i = 0; i < 26; i += 1) {
      ctx.fillStyle = `rgba(${70 + Math.floor(hash(i, 7) * 40)},${50 + Math.floor(hash(i, 8) * 30)},${55},0.28)`;
      ctx.beginPath();
      ctx.ellipse(hash(i, 9) * size, hash(i, 10) * size, 6 + hash(i, 11) * 24, 4 + hash(i, 12) * 16, hash(i, 13) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark veins
    ctx.strokeStyle = "rgba(48,52,66,0.55)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i += 1) {
      ctx.beginPath();
      let x = hash(i, 14) * size;
      let y = hash(i, 15) * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s += 1) {
        x += (hash(i, 16 + s) - 0.5) * 36;
        y += (hash(i, 30 + s) - 0.3) * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CreatureView {
  state: MonsterState;
  /** Tiles per second it is actually moving. */
  speed: number;
  lunging: boolean;
  /** Where the player is, as an angle relative to the way the creature faces. Positive is to its right in the world. */
  playerBearing: number;
  /** Whether the player is within sight, so the head follows them. */
  watching: boolean;
  /** Seconds of the world clock, for slow idle motion. */
  time: number;
  reducedMotion: boolean;
}

export class Creature {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  private readonly hips: THREE.Group[] = [];
  private readonly knees: THREE.Group[] = [];
  private readonly shoulders: THREE.Group[] = [];
  private readonly elbows: THREE.Group[] = [];
  private readonly waist = new THREE.Group();
  private readonly neck = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly jaw = new THREE.Group();
  private readonly glints: THREE.Mesh[] = [];
  private readonly fingers: THREE.Mesh[] = [];
  private phase = 0;
  private openJaw = 0.08;
  private headYaw = 0;
  private lean = 0.2;
  private reach = 0;

  constructor(textureSize: number) {
    const map = skinTexture(textureSize);
    const skin = new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.2, roughness: 0.92, metalness: 0, color: 0xc9c9bd });
    const dark = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 });
    const tooth = new THREE.MeshStandardMaterial({ color: 0xb9b49a, roughness: 0.7 });
    const glint = new THREE.MeshBasicMaterial({ color: 0xcfc9a8 });

    const limb = (radiusTop: number, radiusBottom: number, length: number, seed: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(roughen(new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 7, 4), 0.006, seed), skin);
      mesh.position.y = -length / 2;
      return mesh;
    };

    // --- legs
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0, 0.52, side * 0.045);
      hip.add(limb(0.024, 0.017, 0.26, 3 + side));
      const knee = new THREE.Group();
      knee.position.y = -0.26;
      knee.add(limb(0.017, 0.012, 0.27, 5 + side));
      const foot = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.09, 0.015, 0.03, 2, 1, 1), 0.004, 9), skin);
      foot.position.set(0.03, -0.27, 0);
      knee.add(foot);
      hip.add(knee);
      this.group.add(hip);
      this.hips.push(hip);
      this.knees.push(knee);
    }

    // --- pelvis and torso (stooped)
    const pelvis = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 8, 2), 0.005, 12), skin);
    pelvis.position.y = 0.53;
    this.group.add(pelvis);
    this.waist.position.y = 0.53;
    const torso = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.058, 0.04, 0.34, 9, 6), 0.007, 14), skin);
    torso.position.y = 0.17;
    torso.scale.set(0.8, 1, 1);
    this.waist.add(torso);
    // Ribs show through the skin of a starved body.
    for (let i = 0; i < 6; i += 1) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.047 - i * 0.002, 0.005, 5, 14, Math.PI * 1.35), skin);
      rib.position.set(0.012, 0.1 + i * 0.035, 0);
      rib.rotation.set(Math.PI / 2, 0, -0.45);
      rib.scale.set(0.8, 1, 1);
      this.waist.add(rib);
    }

    // --- arms: much too long
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0, 0.32, side * 0.078);
      shoulder.add(limb(0.016, 0.012, 0.31, 20 + side));
      const elbow = new THREE.Group();
      elbow.position.y = -0.31;
      elbow.add(limb(0.012, 0.008, 0.36, 22 + side));
      const hand = new THREE.Group();
      hand.position.y = -0.36;
      const palm = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.018, 0.04, 0.03, 1, 2, 1), 0.003, 30), skin);
      palm.position.y = -0.02;
      hand.add(palm);
      for (let f = 0; f < 4; f += 1) {
        const finger = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.004, 0.002, 0.11 + (f % 2) * 0.02, 4, 2), 0.002, 40 + f), skin);
        finger.position.set(0, -0.095, (f - 1.5) * 0.0075);
        finger.rotation.z = 0.12 + f * 0.03;
        hand.add(finger);
        this.fingers.push(finger);
      }
      elbow.add(hand);
      shoulder.add(elbow);
      this.waist.add(shoulder);
      this.shoulders.push(shoulder);
      this.elbows.push(elbow);
    }

    // --- neck and head
    this.neck.position.set(0.004, 0.345, 0);
    const neckMesh = new THREE.Mesh(roughen(new THREE.CylinderGeometry(0.011, 0.016, 0.1, 6, 2), 0.003, 50), skin);
    neckMesh.position.y = 0.05;
    this.neck.add(neckMesh);
    this.head.position.y = 0.1;
    const skull = new THREE.Mesh(roughen(new THREE.SphereGeometry(0.055, 14, 12), 0.006, 52), skin);
    skull.scale.set(0.8, 1.55, 0.78);
    skull.position.y = 0.07;
    this.head.add(skull);
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 8, 6), dark);
      socket.position.set(0.038, 0.1, side * 0.021);
      socket.scale.set(0.6, 1.2, 1);
      this.head.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 6, 6), glint);
      eye.position.set(0.045, 0.1, side * 0.021);
      this.head.add(eye);
      this.glints.push(eye);
    }
    // A flat nose hole and a loose jaw with uneven teeth.
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), dark);
    nose.position.set(0.045, 0.062, 0);
    nose.scale.set(0.5, 1.3, 1.2);
    this.head.add(nose);
    this.jaw.position.set(0.0, 0.02, 0);
    const jawBone = new THREE.Mesh(roughen(new THREE.BoxGeometry(0.058, 0.014, 0.046, 3, 1, 3), 0.004, 60), skin);
    jawBone.position.set(0.018, -0.008, 0);
    this.jaw.add(jawBone);
    for (let t = 0; t < 7; t += 1) {
      const lower = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.011 + hash(t, 61) * 0.007, 4), tooth);
      lower.position.set(0.04, 0.004, (t - 3) * 0.0065);
      this.jaw.add(lower);
      const upper = new THREE.Mesh(new THREE.ConeGeometry(0.0034, 0.011 + hash(t, 62) * 0.008, 4), tooth);
      upper.rotation.z = Math.PI;
      upper.position.set(0.042, 0.032 - 0.0, (t - 3) * 0.0065);
      this.head.add(upper);
    }
    this.head.add(this.jaw);
    this.neck.add(this.head);
    this.waist.add(this.neck);
    this.group.add(this.waist);

    // A faint cold glow that makes the creature readable in the dark without lighting the room.
    this.light = new THREE.PointLight(0x7d93b0, 0.55, 2.6, 2);
    this.light.position.set(0.05, 0.75, 0);
    this.group.add(this.light);
    this.pose({ state: "DORMANT", speed: 0, lunging: false, playerBearing: 0, watching: false, time: 0, reducedMotion: true }, 0);
  }

  /** Animate toward what the creature is doing. `dt` is the real frame time. */
  update(view: CreatureView, dt: number): void {
    this.pose(view, dt);
  }

  private pose(view: CreatureView, dt: number): void {
    const t = view.time;
    const moving = Math.min(1, view.speed / 2.4);
    this.phase += view.speed * dt * 4.6;
    const hunting = view.state === "PURSUING" || view.state === "ATTACKING";
    const still = view.reducedMotion;
    const swing = Math.sin(this.phase) * moving;

    // Legs: a heavy, slightly uneven stride.
    this.hips[0]!.rotation.z = swing * 0.62;
    this.hips[1]!.rotation.z = -swing * 0.62 * (1 + 0.08 * Math.sin(this.phase * 0.5));
    this.knees[0]!.rotation.z = -Math.max(0, Math.sin(this.phase + 0.9)) * 0.95 * moving;
    this.knees[1]!.rotation.z = -Math.max(0, Math.sin(this.phase + Math.PI + 0.9)) * 0.95 * moving;

    // Stoop deeper and reach forward while hunting. Hold a slow, unsettling sway while idle.
    const leanTarget = view.state === "DORMANT" ? 0.12 : hunting ? 0.62 : view.state === "RECOVERING" ? 0.34 : 0.3;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 4);
    const reachTarget = view.lunging ? 1 : hunting ? 0.6 : 0;
    this.reach += (reachTarget - this.reach) * Math.min(1, dt * 7);
    this.waist.rotation.z = -this.lean;
    this.waist.rotation.x = (still ? 0 : Math.sin(this.phase) * 0.07 * moving + Math.sin(t * 0.6) * 0.03);
    const breath = still ? 0 : Math.sin(t * 1.7) * 0.025;
    this.waist.scale.set(1 + breath, 1, 1 + breath);

    // Arms swing against the legs and hang, or reach.
    for (let i = 0; i < 2; i += 1) {
      const sign = i === 0 ? -1 : 1;
      const sway = still ? 0 : Math.sin(t * 0.8 + i * 2.1) * 0.05;
      this.shoulders[i]!.rotation.z = sign * swing * 0.45 + sway + this.reach * (1.15 + 0.12 * i) + this.lean * 0.4;
      this.elbows[i]!.rotation.z = 0.22 + this.reach * 0.5 + (still ? 0 : Math.sin(t * 1.3 + i) * 0.04);
    }
    for (let f = 0; f < this.fingers.length; f += 1) {
      this.fingers[f]!.rotation.z = 0.15 + (still ? 0 : Math.max(0, Math.sin(t * 7 + f * 1.7)) * 0.2) + this.reach * 0.35;
    }

    // Head: tilted, follows the player when it can see them, jerks now and then, hangs low while hunting.
    const rel = Math.atan2(Math.sin(view.playerBearing), Math.cos(view.playerBearing));
    const watchTurn = view.watching ? Math.max(-1.15, Math.min(1.15, -rel)) : Math.sin(t * 0.5) * 0.55;
    this.headYaw += (watchTurn - this.headYaw) * Math.min(1, dt * (view.watching ? 9 : 2.2));
    this.neck.rotation.y = this.headYaw;
    const twitch = still ? 0 : Math.max(0, Math.sin(t * 0.9 + 1)) > 0.985 ? Math.sin(t * 40) * 0.12 : 0;
    this.neck.rotation.x = 0.28 + (hunting ? 0.12 : 0) + Math.sin(t * 0.7) * (still ? 0 : 0.07) + twitch;
    this.neck.rotation.z = -(hunting ? 0.45 : 0.15) + this.lean * 0.5;
    const jawTarget = view.state === "ATTACKING" ? 0.85 : view.lunging ? 0.7 : hunting ? 0.38 : 0.1 + (still ? 0 : Math.max(0, Math.sin(t * 1.1)) * 0.06);
    this.openJaw += (jawTarget - this.openJaw) * Math.min(1, dt * 12);
    this.jaw.rotation.z = -this.openJaw;

    const glow = view.state === "DORMANT" ? 0.3 : hunting ? 1 : 0.7;
    for (const eye of this.glints) eye.scale.setScalar(glow * (hunting ? 1.35 : 1));
  }

  /** The pose for the capture: arms thrown wide, head forward, jaw hanging open. `t` runs 0 to 1 over the first moments. */
  poseForScare(t: number, time: number): void {
    const k = Math.min(1, t * 3);
    this.waist.rotation.z = -(0.55 + 0.15 * k);
    this.neck.rotation.y = 0;
    this.neck.rotation.x = 0.1;
    // The body is thrown forward and the face is thrown up and toward the camera, so the face is what is seen.
    this.neck.rotation.z = 0.75 * k;
    this.jaw.rotation.z = -(0.95 + Math.sin(time * 38) * 0.05 * k);
    for (let i = 0; i < 2; i += 1) {
      this.shoulders[i]!.rotation.z = 1.95 + (i === 0 ? -0.1 : 0.1);
      this.shoulders[i]!.rotation.x = (i === 0 ? 1 : -1) * 0.5 * k;
      this.elbows[i]!.rotation.z = 0.35;
    }
    for (const eye of this.glints) eye.scale.setScalar(0.9);
  }

  /** Where the base of the skull is in the world, after the group has been placed and posed. */
  headWorld(target: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    return this.head.getWorldPosition(target);
  }

  /** Put everything the capture pose changed back. */
  clearScarePose(): void {
    for (const shoulder of this.shoulders) shoulder.rotation.x = 0;
  }
}
