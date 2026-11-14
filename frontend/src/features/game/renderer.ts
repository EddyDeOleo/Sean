/**
 * The Three.js renderer for the game (Spec 4 section 11.5). It only reads the world; it decides nothing.
 *
 * Everything is procedural: geometry from boxes, cylinders and spheres, textures drawn on small canvases at start-up. There
 * are no downloaded assets, so there are no asset licences and no network requests. `dispose` frees every GPU resource,
 * removes the canvas and releases the WebGL context, so leaving the game leaves nothing behind.
 */

import * as THREE from "three";
import { Creature } from "./creature";
import { FLICKER_HOLD, flickerFactor, hash } from "./flicker";
import { tileAt, type Level, type Point } from "./level";
import { monsterSeesPlayer, type World } from "./world";

export type Quality = "low" | "medium" | "high";

interface QualityProfile {
  pixelRatio: number;
  antialias: boolean;
  textureSize: number;
  pointLights: number;
  shadows: boolean;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 0.75, antialias: false, textureSize: 128, pointLights: 0, shadows: false },
  medium: { pixelRatio: 1.25, antialias: true, textureSize: 256, pointLights: 3, shadows: false },
  high: { pixelRatio: 2, antialias: true, textureSize: 512, pointLights: 5, shadows: true },
};

const WALL_HEIGHT = 1.15;
const EYE_HEIGHT = 0.55;
const BASE_FOV = 72;
/** Flashlight brightness. With decay 2 the light falls off faster, so the near pool would clip to white at the old 14. */
const FLASHLIGHT_INTENSITY = 9;
const CLUE_COLOUR: Record<string, number> = { DOCUMENTED: 0xf2c14e, INFERRED: 0x6fa8dc, PARTIAL_EVIDENCE: 0xe69138, NONE: 0x9a9a9a };

function drawTexture(size: number, paint: (ctx: CanvasRenderingContext2D, size: number) => void, repeat: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function noise(ctx: CanvasRenderingContext2D, size: number, base: number, spread: number, seed: number): void {
  ctx.fillStyle = `rgb(${base},${base},${base + 2})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 14; i += 1) {
    const v = base + Math.floor((hash(i, seed) - 0.5) * spread);
    ctx.fillStyle = `rgba(${v},${v},${v + 2},0.5)`;
    ctx.fillRect(hash(i, seed + 1) * size, hash(i, seed + 2) * size, 2, 2);
  }
}

function signTexture(text: string, colour: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#08130b";
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = colour;
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 50);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * A procedural grain map for concrete and panels (no image file). Values sit in the rough part of the range, so as a roughness
 * map they make the surface matte with small variations, and as a bump map they give a faint grain. A few darker seams mark
 * panel joints.
 */
function grainCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = 170 + Math.floor(hash(x, y) * 85);
      const i = (y * size + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  ctx.strokeStyle = "rgba(96,96,96,0.6)";
  ctx.lineWidth = Math.max(1, size / 128);
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.stroke();
  return canvas;
}

export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly flashlight: THREE.SpotLight;
  private readonly creature: Creature;
  private readonly lockers: { mesh: THREE.Mesh; camera: { x: number; z: number }; spot: Point }[] = [];
  private jumpscare = true;
  private readonly scratch = new THREE.Vector3();
  private readonly clueMeshes: THREE.Mesh[] = [];
  private readonly flickering: THREE.PointLight[] = [];
  private readonly screens: THREE.MeshBasicMaterial[] = [];
  /** Grain maps made for the walls and the floor. Freed in dispose(). */
  private readonly grainTextures: THREE.Texture[] = [];
  private gate: THREE.Mesh | null = null;
  private readonly profile: QualityProfile;
  private disposed = false;
  private pitch = 0;
  private viewYawOffset = 0;
  private caughtFor = 0;

  readonly canvas: HTMLCanvasElement;

  constructor(private readonly container: HTMLElement, private readonly level: Level, quality: Quality) {
    this.profile = QUALITY[quality];
    this.renderer = new THREE.WebGLRenderer({ antialias: this.profile.antialias, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.profile.pixelRatio));
    this.renderer.shadowMap.enabled = this.profile.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.dataset.testid = "game-canvas";
    this.container.appendChild(this.canvas);

    this.scene.background = new THREE.Color(0x050507);
    this.scene.fog = new THREE.FogExp2(0x050507, 0.085);
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 40);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.scene.add(new THREE.AmbientLight(0x323a46, 1.1));
    // A faint cool sky and dark floor, so walls keep a silhouette even outside the flashlight.
    this.scene.add(new THREE.HemisphereLight(0x0a0c12, 0x050507, 0.15));
    this.flashlight = new THREE.SpotLight(0xfff1d0, FLASHLIGHT_INTENSITY, 11, 0.5, 0.65, 2);
    this.flashlight.position.set(0.12, -0.08, 0);
    this.flashlight.target.position.set(0, 0, -3);
    this.flashlight.castShadow = this.profile.shadows;
    if (this.profile.shadows) this.flashlight.shadow.mapSize.set(1024, 1024);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    try {
      this.buildLevel();
      this.creature = new Creature(this.profile.textureSize);
      this.buildMonster();
      this.buildHidingPlaces();
      this.resize();
    } catch (error) {
      // A half-built renderer would leave a canvas and a WebGL context behind.
      this.dispose();
      throw error;
    }
  }

  private buildLevel(): void {
    const { level, profile } = this;
    const wallTexture = drawTexture(profile.textureSize, (ctx, s) => {
      noise(ctx, s, 74, 40, 1);
      ctx.strokeStyle = "rgba(20,20,22,0.55)";
      for (let y = 0; y < s; y += s / 4) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(s, y);
        ctx.stroke();
      }
    }, 1);
    const floorTexture = drawTexture(profile.textureSize, (ctx, s) => {
      noise(ctx, s, 52, 30, 7);
      ctx.strokeStyle = "rgba(10,10,12,0.7)";
      ctx.strokeRect(0, 0, s, s);
    }, 1);
    const ceilingTexture = drawTexture(profile.textureSize, (ctx, s) => noise(ctx, s, 40, 20, 11), 1);
    floorTexture.repeat.set(level.width, level.height);
    ceilingTexture.repeat.set(level.width / 2, level.height / 2);

    const grain = grainCanvas(profile.textureSize);
    const floorGrain = this.grain(grain, level.width, level.height);
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture, roughness: 1, metalness: 0, roughnessMap: floorGrain, bumpMap: floorGrain, bumpScale: 0.03,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(level.width, level.height), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(level.width / 2, 0, level.height / 2);
    floor.receiveShadow = profile.shadows;
    this.scene.add(floor);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(level.width, level.height), new THREE.MeshLambertMaterial({ map: ceilingTexture }));
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(level.width / 2, WALL_HEIGHT, level.height / 2);
    this.scene.add(ceiling);

    const walls: Point[] = [];
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        if (tileAt(level, x + 0.5, y + 0.5) !== "WALL") continue;
        const touchesOpen = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(level, x + 0.5 + dx!, y + 0.5 + dy!) !== "WALL");
        if (touchesOpen) walls.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    const wallGrain = this.grain(grain, 2, 2);
    const wallMaterial = new THREE.MeshStandardMaterial({
      map: wallTexture, roughness: 1, metalness: 0, roughnessMap: wallGrain, bumpMap: wallGrain, bumpScale: 0.03,
    });
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_HEIGHT, 1), wallMaterial, walls.length);
    const matrix = new THREE.Matrix4();
    walls.forEach((w, i) => wallMesh.setMatrixAt(i, matrix.makeTranslation(w.x, WALL_HEIGHT / 2, w.y)));
    wallMesh.castShadow = profile.shadows;
    wallMesh.receiveShadow = profile.shadows;
    this.scene.add(wallMesh);

    this.buildGate();
    this.buildExit();
    this.buildFurniture();
    this.buildLights();
  }

  private buildGate(): void {
    const { gate } = this.level;
    const bars = new THREE.MeshLambertMaterial({ color: 0x5b2420 });
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(0.2, WALL_HEIGHT * 0.96, 1), bars);
    this.gate.position.set(gate.x, WALL_HEIGHT / 2, gate.y);
    this.scene.add(this.gate);
  }

  private buildExit(): void {
    const { exit } = this.level;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ color: 0x1f6b3a }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(exit.x, 0.01, exit.y);
    this.scene.add(pad);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: signTexture("EXIT", "#5dff8f") }));
    // The exit stands against the south wall; the sign hangs on that wall, facing the room.
    sign.position.set(exit.x, WALL_HEIGHT - 0.25, exit.y + 0.49);
    sign.rotation.y = Math.PI;
    this.scene.add(sign);
    if (this.profile.pointLights > 0) {
      const glow = new THREE.PointLight(0x3dff80, 1.5, 4);
      glow.position.set(exit.x, 0.6, exit.y);
      this.scene.add(glow);
    }
  }

  /** Shelves, lockers and terminals standing against walls. They are scenery only: thin enough not to matter for collision. */
  private buildFurniture(): void {
    const { level } = this;
    const shelfMaterial = new THREE.MeshLambertMaterial({ color: 0x3a2c20 });
    const bookMaterials = [0x6b2e2e, 0x2e4a6b, 0x4a5a2e, 0x6b5a2e].map((color) => new THREE.MeshLambertMaterial({ color }));
    const lockerMaterial = new THREE.MeshLambertMaterial({ color: 0x3a4650 });
    const screenGeometry = new THREE.PlaneGeometry(0.34, 0.24);
    const reserved = new Set<string>([level.playerStart, level.monsterStart, level.exit, ...level.clueSpots].map((p) => `${Math.floor(p.x)},${Math.floor(p.y)}`));
    for (let y = 1; y < level.height - 1; y += 1) {
      for (let x = 1; x < level.width - 1; x += 1) {
        if (tileAt(level, x + 0.5, y + 0.5) !== "FLOOR" || reserved.has(`${x},${y}`)) continue;
        const roll = hash(x, y);
        if (roll > 0.22) continue;
        // Find a wall side to stand against.
        const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const side = sides.find(([dx, dy]) => tileAt(level, x + 0.5 + dx, y + 0.5 + dy) === "WALL");
        // Corridors stay clear: only furnish tiles that have open floor on at least three sides.
        const open = sides.filter(([dx, dy]) => tileAt(level, x + 0.5 + dx, y + 0.5 + dy) === "FLOOR").length;
        if (!side || open < 3) continue;
        const [dx, dy] = side;
        const cx = x + 0.5 + dx * 0.4;
        const cz = y + 0.5 + dy * 0.4;
        const alongX = dy !== 0;
        if (roll < 0.12) {
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.9 : 0.18, 0.95, alongX ? 0.18 : 0.9), shelfMaterial);
          shelf.position.set(cx, 0.475, cz);
          this.scene.add(shelf);
          for (let row = 0; row < 3; row += 1) {
            const books = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.8 : 0.1, 0.16, alongX ? 0.1 : 0.8), bookMaterials[(x + y + row) % bookMaterials.length]);
            books.position.set(cx - dx * 0.0 - (alongX ? 0 : dx * 0.06), 0.2 + row * 0.3, cz - (alongX ? dy * 0.06 : 0));
            this.scene.add(books);
          }
        } else if (roll < 0.18) {
          const locker = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.5 : 0.2, 0.85, alongX ? 0.2 : 0.5), lockerMaterial);
          locker.position.set(cx, 0.425, cz);
          this.scene.add(locker);
        } else {
          const material = new THREE.MeshBasicMaterial({ color: 0x1e8a4c });
          this.screens.push(material);
          const screen = new THREE.Mesh(screenGeometry, material);
          screen.position.set(x + 0.5 + dx * 0.49, 0.6, y + 0.5 + dy * 0.49);
          screen.rotation.y = dx !== 0 ? (dx > 0 ? -Math.PI / 2 : Math.PI / 2) : dy > 0 ? Math.PI : 0;
          this.scene.add(screen);
        }
      }
    }
  }

  private buildLights(): void {
    const count = this.profile.pointLights;
    const spots = [{ x: 8.5, y: 8.5 }, { x: 12.5, y: 5.5 }, { x: 3.5, y: 5.5 }, { x: 20.5, y: 2.5 }, { x: 12.5, y: 14.5 }];
    for (let i = 0; i < count; i += 1) {
      const light = new THREE.PointLight(0xffb066, 1.6, 7);
      light.position.set(spots[i]!.x, WALL_HEIGHT - 0.1, spots[i]!.y);
      this.scene.add(light);
      this.flickering.push(light);
    }
  }

  /** Create one marker per clue. Called once per world. */
  setClues(world: World): void {
    for (const mesh of this.clueMeshes) this.disposeMesh(mesh);
    this.clueMeshes.length = 0;
    for (const clue of world.clues) {
      const colour = CLUE_COLOUR[clue.record.classification ?? "NONE"]!;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.3), new THREE.MeshBasicMaterial({ color: colour }));
      mesh.position.set(clue.position.x, 0.3, clue.position.y);
      this.scene.add(mesh);
      this.clueMeshes.push(mesh);
    }
  }

  private buildMonster(): void {
    this.scene.add(this.creature.group);
  }

  /** Lockers and alcoves the player can hide in: a cabinet against the nearest wall of each hiding tile. */
  private buildHidingPlaces(): void {
    const { level } = this;
    const metal = new THREE.MeshLambertMaterial({ map: drawTexture(this.profile.textureSize, (ctx, s) => {
      noise(ctx, s, 58, 22, 21);
      ctx.fillStyle = "rgba(8,10,12,0.8)";
      for (let i = 0; i < 6; i += 1) ctx.fillRect(s * 0.18, s * (0.12 + i * 0.035), s * 0.64, s * 0.014);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.strokeRect(2, 2, s - 4, s - 4);
    }, 1), color: 0x7f9096 });
    for (const spot of level.hideSpots) {
      const sides: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [dx, dz] = sides.find(([sx, sz]) => tileAt(level, spot.x + sx, spot.y + sz) === "WALL") ?? [0, -1];
      const alongX = dz !== 0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.58 : 0.22, 0.98, alongX ? 0.22 : 0.58), metal);
      mesh.position.set(spot.x + dx * 0.39, 0.49, spot.y + dz * 0.39);
      this.scene.add(mesh);
      this.lockers.push({ mesh, camera: { x: spot.x + dx * 0.3, z: spot.y + dz * 0.3 }, spot });
    }
  }

  /** Show the close-up of the creature when the player is caught. Off: the camera only turns toward it. */
  setJumpscare(enabled: boolean): void {
    this.jumpscare = enabled;
  }

  /** Forget the previous attempt's camera state. Called when a new world starts. */
  resetView(): void {
    this.pitch = 0;
    this.viewYawOffset = 0;
    this.caughtFor = 0;
    this.camera.fov = BASE_FOV;
    this.camera.rotation.z = 0;
    this.camera.updateProjectionMatrix();
    this.creature.clearScarePose();
    this.creature.group.scale.setScalar(1);
    this.creature.light.intensity = 0.55;
  }
  /** Look up or down (pitch is only a view matter; the world has none). */
  addPitch(delta: number): void {
    this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch + delta));
  }

  resize(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height, false);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Update the scene to match the world and draw it. `dt` is the real frame time in seconds. */
  render(world: World, dt: number, reducedMotion: boolean): void {
    if (this.disposed) return;
    const { player, monster } = world;
    const t = world.time;
    const toMonster = Math.hypot(monster.pos.x - player.pos.x, monster.pos.y - player.pos.y);
    const awake = monster.state !== "DORMANT";
    // How close the creature is, 0 to 1. It drives the light disturbances and the camera's unease.
    const near = awake ? Math.min(1, Math.max(0, (8 - toMonster) / 7)) : 0;
    const hunting = monster.state === "PURSUING" || monster.state === "ATTACKING";

    // --- camera position (inside the cabinet while hiding)
    let eyeX = player.pos.x;
    let eyeZ = player.pos.y;
    let eyeY = EYE_HEIGHT + (player.moving && !reducedMotion ? Math.sin(t * (player.sprinting ? 14 : 9)) * 0.012 : 0);
    for (const locker of this.lockers) {
      const inside = player.hidden && player.hideSpot !== null && Math.hypot(locker.spot.x - player.hideSpot.x, locker.spot.y - player.hideSpot.y) < 0.1;
      locker.mesh.visible = !inside;
      if (inside) {
        eyeX = locker.camera.x;
        eyeZ = locker.camera.z;
        eyeY = 0.5;
      }
    }

    // Strobing and shaking follow both the motion setting and the scare setting. With either, lights dim steadily instead.
    const calm = reducedMotion || !this.jumpscare;
    // --- unease: a faint shake and a pulse in the field of view that grow as it nears.
    let shake = 0;
    let fov = BASE_FOV;
    if (!calm) {
      shake = 0.0032 * near * near + (hunting ? 0.0025 : 0) + (monster.lunge > 0 ? 0.006 : 0);
      const beat = Math.pow(Math.max(0, Math.sin(t * (2 + near * 2.2) * Math.PI)), 6);
      fov = BASE_FOV - near * 3.5 + beat * near * 1.4 - (monster.lunge > 0 ? 4 : 0);
    }

    let yaw = player.yaw;
    let scareProgress = 0;
    const scaring = world.status === "CAUGHT";
    if (scaring) {
      this.caughtFor += dt;
      const bearing = Math.atan2(monster.pos.y - player.pos.y, monster.pos.x - player.pos.x);
      let diff = bearing - player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.viewYawOffset += (diff - this.viewYawOffset) * Math.min(1, dt * 18);
      this.pitch += ((this.jumpscare ? 0 : 0.05) - this.pitch) * Math.min(1, dt * 10);
      yaw += this.viewYawOffset;
      scareProgress = Math.min(1, this.caughtFor / 0.14);
      fov = BASE_FOV - (reducedMotion ? 6 : Math.min(this.caughtFor * 55, 26));
      // The picture shakes hard for the first moments, then settles. Reduced motion keeps it still.
      shake = reducedMotion || !this.jumpscare ? 0 : 0.03 * Math.exp(-this.caughtFor * 3.2);
    } else {
      this.caughtFor = 0;
      this.viewYawOffset = 0;
    }
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    const sx = Math.sin(t * 47 + this.caughtFor * 61) * shake;
    const sy = Math.sin(t * 53 + 1 + this.caughtFor * 67) * shake;
    this.camera.position.set(eyeX + sx, eyeY + sy, eyeZ + sx * 0.6);
    this.camera.rotation.y = -yaw - Math.PI / 2;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = Math.sin(t * 31) * shake * 4;

    // --- flashlight: it stutters when the creature is close. Reduced motion dims it steadily instead.
    if (player.flashlight) {
      if (calm) this.flashlight.intensity = FLASHLIGHT_INTENSITY * (1 - 0.35 * near);
      else {
        // Dropouts hold for at least FLICKER_HOLD seconds, so nothing changes faster than 2.5 times a second.
        this.flashlight.intensity = FLASHLIGHT_INTENSITY * flickerFactor(t, near, 3) * (1 - 0.25 * near) + (hunting ? Math.sin(t * 9) * 1.5 : 0);
      }
    } else {
      this.flashlight.intensity = 0;
    }

    // --- the creature
    const group = this.creature.group;
    if (scaring && this.jumpscare) {
      // It is suddenly there, in the camera's face: thrown forward in a fraction of a second.
      const ease = 1 - Math.pow(1 - scareProgress, 3);
      // Its head ends about half a tile from the eye, at eye height, with the arms thrown wide on either side. The body is
      // placed by where its head ends up after posing, so the face is in front of the camera whatever the pose does.
      const scale = 0.8 + ease * 0.45;
      const reach = 1.55 - ease * 1.15;
      group.scale.setScalar(scale);
      group.rotation.y = -(yaw + Math.PI);
      group.position.set(eyeX + Math.cos(yaw) * reach, 0, eyeZ + Math.sin(yaw) * reach);
      this.creature.poseForScare(scareProgress, t);
      const head = this.creature.headWorld(this.scratch);
      group.position.x += eyeX + Math.cos(yaw) * reach - head.x;
      group.position.y += EYE_HEIGHT - 0.03 - head.y;
      group.position.z += eyeZ + Math.sin(yaw) * reach - head.z;
      this.creature.light.intensity = 1.8;
    } else {
      group.position.set(monster.pos.x, 0, monster.pos.y);
      group.rotation.y = -monster.yaw;
      group.scale.setScalar(1);
      this.creature.update({
        state: monster.state,
        speed: monster.speedNow,
        lunging: monster.lunge > 0,
        playerBearing: Math.atan2(player.pos.y - monster.pos.y, player.pos.x - monster.pos.x) - monster.yaw,
        watching: awake && monsterSeesPlayer(world),
        time: t,
        reducedMotion,
      }, dt);
    }

    world.clues.forEach((clue, i) => {
      const mesh = this.clueMeshes[i];
      if (!mesh) return;
      mesh.visible = !clue.collected;
      mesh.position.y = 0.3 + (reducedMotion ? 0 : Math.sin(t * 2 + i) * 0.03);
      mesh.rotation.y = reducedMotion ? 0.4 : t * 0.8 + i;
    });

    if (this.gate) this.gate.visible = !world.gateOpen;
    // Lights near the creature die and stutter. Far lights are as they were.
    this.flickering.forEach((light, i) => {
      const lightNear = awake ? Math.min(1, Math.max(0, (6.5 - Math.hypot(light.position.x - monster.pos.x, light.position.z - monster.pos.y)) / 5)) : 0;
      const base = reducedMotion ? 1.5 : 1.5 + Math.sin(t * (1.5 + i * 0.2) + i * 5) * 0.2 + (hash(Math.floor(t / FLICKER_HOLD), i) > 0.93 ? -0.9 : 0);
      const disturbed = calm ? 1 - 0.6 * lightNear : flickerFactor(t, lightNear, i + 7) * (1 - 0.3 * lightNear);
      light.intensity = base * disturbed;
    });
    if (!reducedMotion) {
      this.screens.forEach((material, i) => material.color.setHex(Math.sin(t * 2 + i) > 0.6 ? 0x2bd16d : 0x1e8a4c));
    }
    this.renderer.render(this.scene, this.camera);
  }
  /** A grain map tiled over a surface. Kept so dispose() can free it. */
  private grain(canvas: HTMLCanvasElement, repeatX: number, repeatY: number): THREE.CanvasTexture {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeatX, repeatY);
    this.grainTextures.push(texture);
    return texture;
  }

  /** Free every resource and remove the canvas. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((object) => {
      if ((object as THREE.InstancedMesh).isInstancedMesh) (object as THREE.InstancedMesh).dispose();
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map;
        map?.dispose();
        material.dispose();
      }
    });
    for (const texture of this.grainTextures) texture.dispose();
    this.flashlight.shadow.map?.dispose();
    this.scene.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private disposeMesh(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  }
}
