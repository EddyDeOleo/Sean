/**
 * The Three.js renderer for the game (Spec 4 section 11.5). It only reads the world; it decides nothing.
 *
 * Everything is procedural: geometry from boxes, cylinders and spheres, textures drawn on small canvases at start-up. There
 * are no downloaded assets, so there are no asset licences and no network requests. `dispose` frees every GPU resource,
 * removes the canvas and releases the WebGL context, so leaving the game leaves nothing behind.
 */

import * as THREE from "three";
import { tileAt, type Level, type Point } from "./level";
import type { World } from "./world";

export type Quality = "low" | "medium" | "high";

interface QualityProfile {
  pixelRatio: number;
  antialias: boolean;
  textureSize: number;
  pointLights: number;
  shadows: boolean;
  fogDensity: number;
}

export const QUALITY: Record<Quality, QualityProfile> = {
  low: { pixelRatio: 0.75, antialias: false, textureSize: 128, pointLights: 0, shadows: false, fogDensity: 0.2 },
  medium: { pixelRatio: 1.25, antialias: true, textureSize: 256, pointLights: 3, shadows: false, fogDensity: 0.17 },
  high: { pixelRatio: 2, antialias: true, textureSize: 512, pointLights: 5, shadows: true, fogDensity: 0.15 },
};

const WALL_HEIGHT = 1.15;
const EYE_HEIGHT = 0.55;
const BASE_FOV = 72;
const CLUE_COLOUR: Record<string, number> = { DOCUMENTED: 0xf2c14e, INFERRED: 0x6fa8dc, PARTIAL_EVIDENCE: 0xe69138, NONE: 0x9a9a9a };

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

export class GameRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly flashlight: THREE.SpotLight;
  private readonly monster = new THREE.Group();
  private readonly eyes: THREE.Mesh[] = [];
  private readonly clueMeshes: THREE.Mesh[] = [];
  private readonly flickering: THREE.PointLight[] = [];
  private readonly screens: THREE.MeshBasicMaterial[] = [];
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

    this.scene.background = new THREE.Color(0x020304);
    this.scene.fog = new THREE.FogExp2(0x020304, this.profile.fogDensity);
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 40);
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.scene.add(new THREE.AmbientLight(0x323a46, 1.1));
    this.flashlight = new THREE.SpotLight(0xfff1d0, 14, 11, 0.5, 0.55, 1.4);
    this.flashlight.position.set(0.12, -0.08, 0);
    this.flashlight.target.position.set(0, 0, -3);
    this.flashlight.castShadow = this.profile.shadows;
    if (this.profile.shadows) this.flashlight.shadow.mapSize.set(1024, 1024);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);

    this.buildLevel();
    this.buildMonster();
    this.resize();
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

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(level.width, level.height), new THREE.MeshLambertMaterial({ map: floorTexture }));
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
    const wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_HEIGHT, 1), new THREE.MeshLambertMaterial({ map: wallTexture }), walls.length);
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
    const dark = new THREE.MeshLambertMaterial({ color: 0x0c0c0e });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.62, 8), dark);
    body.position.y = 0.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dark);
    head.position.y = 0.97;
    head.scale.set(0.9, 1.25, 0.9);
    const armGeometry = new THREE.CylinderGeometry(0.025, 0.02, 0.62, 5);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeometry, dark);
      arm.position.set(0.03, 0.5, side * 0.2);
      arm.rotation.x = side * 0.18;
      this.monster.add(arm);
    }
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1c });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMaterial);
      eye.position.set(0.095, 1.0, side * 0.04);
      this.monster.add(eye);
      this.eyes.push(eye);
    }
    this.monster.add(body, head);
    this.scene.add(this.monster);
  }

  /** Forget the previous attempt's camera state. Called when a new world starts. */
  resetView(): void {
    this.pitch = 0;
    this.viewYawOffset = 0;
    this.caughtFor = 0;
    this.camera.fov = BASE_FOV;
    this.camera.updateProjectionMatrix();
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
    const bob = player.moving && !reducedMotion ? Math.sin(world.time * (player.sprinting ? 14 : 9)) * 0.012 : 0;
    this.camera.position.set(player.pos.x, EYE_HEIGHT + bob, player.pos.y);

    let yaw = player.yaw;
    if (world.status === "CAUGHT") {
      // The head snaps toward what caught the player.
      this.caughtFor += dt;
      const bearing = Math.atan2(monster.pos.y - player.pos.y, monster.pos.x - player.pos.x);
      let diff = bearing - player.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.viewYawOffset += (diff - this.viewYawOffset) * Math.min(1, dt * 14);
      this.pitch += (0.05 - this.pitch) * Math.min(1, dt * 8);
      yaw += this.viewYawOffset;
      this.camera.fov = BASE_FOV - Math.min(this.caughtFor * 40, 22);
      this.camera.updateProjectionMatrix();
    } else {
      this.caughtFor = 0;
      this.viewYawOffset = 0;
      if (this.camera.fov !== BASE_FOV) {
        this.camera.fov = BASE_FOV;
        this.camera.updateProjectionMatrix();
      }
    }
    this.camera.rotation.y = -yaw - Math.PI / 2;
    this.camera.rotation.x = this.pitch;

    // Switching a light on and off changes the shader programs and stutters, so the light stays and its intensity changes.
    if (player.flashlight) {
      // A weak shimmer while the monster is close. Reduced motion keeps the light steady.
      const near = world.monster.state === "PURSUING" || world.monster.state === "ATTACKING";
      this.flashlight.intensity = near && !reducedMotion ? 9 + Math.sin(world.time * 40) * 4 : 14;
    } else {
      this.flashlight.intensity = 0;
    }

    this.monster.position.set(monster.pos.x, 0, monster.pos.y);
    this.monster.rotation.y = -monster.yaw;
    this.monster.visible = true;
    const alert = monster.state === "PURSUING" || monster.state === "ATTACKING";
    this.monster.scale.setScalar(alert ? 1.08 : 1);
    for (const eye of this.eyes) eye.visible = monster.state !== "DORMANT";

    world.clues.forEach((clue, i) => {
      const mesh = this.clueMeshes[i];
      if (!mesh) return;
      mesh.visible = !clue.collected;
      mesh.position.y = 0.3 + (reducedMotion ? 0 : Math.sin(world.time * 2 + i) * 0.03);
      mesh.rotation.y = reducedMotion ? 0.4 : world.time * 0.8 + i;
    });

    if (this.gate) this.gate.visible = !world.gateOpen;
    if (!reducedMotion) {
      this.flickering.forEach((light, i) => {
        light.intensity = 1.5 + Math.sin(world.time * (3 + i) + i * 5) * 0.2 + (hash(Math.floor(world.time * 8), i) > 0.93 ? -0.9 : 0);
      });
      this.screens.forEach((material, i) => material.color.setHex(Math.sin(world.time * 2 + i) > 0.6 ? 0x2bd16d : 0x1e8a4c));
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Free every resource and remove the canvas. Safe to call twice. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) {
        const map = (material as THREE.MeshBasicMaterial).map;
        map?.dispose();
        material.dispose();
      }
    });
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
