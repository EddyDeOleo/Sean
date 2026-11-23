/**
 * Development-only validation view for the monster. It renders the production MonsterVisual (model, aura, and animation
 * controller) with the game's lighting, fog, flashlight and field of view, from fixed cameras. It is not part of the game
 * and is not bundled into the production build: only monster-validation.html loads it.
 *
 * Playwright drives it through window.__validation: setSegment() chooses the AI state and speed, advance() steps the
 * simulation by a fixed time at 60 steps a second, and camera() chooses a fixed view. Nothing is random and no
 * requestAnimationFrame loop runs, so every capture is reproducible.
 */
import * as THREE from "three";
import { MonsterVisual } from "../features/game/monsterVisual";
import type { MonsterState } from "../features/game/world";

export interface Segment {
  state: MonsterState;
  speed: number;
}

interface CameraPreset {
  label: string;
  fov: number;
  distance: number;
  direction: [number, number, number];
  height: number;
  target: [number, number, number];
}

/** The fixed cameras. "game" uses the game's field of view and an approximate gameplay distance. */
const CAMERAS: Record<string, CameraPreset> = {
  front: { label: "front, framed", fov: 30, distance: 3.1, direction: [1, 0, 0], height: 0.52, target: [0, 0.5, 0] },
  threeQuarter: { label: "three-quarter, framed", fov: 30, distance: 3.1, direction: [0.7, 0, 0.7], height: 0.52, target: [0, 0.5, 0] },
  side: { label: "side, framed", fov: 30, distance: 3.1, direction: [0, 0, 1], height: 0.52, target: [0, 0.5, 0] },
  game: { label: "in-game distance, game field of view", fov: 72, distance: 3.6, direction: [0.7, 0, 0.7], height: 0.55, target: [0, 0.5, 0] },
  close: { label: "close-up, head", fov: 40, distance: 1.0, direction: [1, 0, 0], height: 0.95, target: [0, 0.92, 0] },
  faceZ: { label: "head close-up from +z", fov: 40, distance: 1.0, direction: [0, 0, 1], height: 0.95, target: [0, 0.92, 0] },
  faceNegZ: { label: "head close-up from -z", fov: 40, distance: 1.0, direction: [0, 0, -1], height: 0.95, target: [0, 0.92, 0] },
};

const STEP = 1 / 60;

function modelNameFromUrl(url: string): string {
  return url.split("/").pop() ?? url;
}

function triangleCount(root: THREE.Object3D): number {
  let total = 0;
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry;
    total += (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;
  });
  return Math.round(total);
}

function setup(): void {
  const params = new URLSearchParams(window.location.search);
  const size = { width: 1280, height: 720 };
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.id = "validation-canvas";
  document.getElementById("stage")!.appendChild(canvas);
  const overlay = document.getElementById("overlay")!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size.width, size.height, false);
  renderer.setClearColor(0x050507);

  // The game's lighting and fog, copied from renderer.ts (ambient, hemisphere, fog, and the flashlight at the eye).
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050507);
  scene.fog = new THREE.FogExp2(0x050507, 0.085);
  scene.add(new THREE.AmbientLight(0x323a46, 1.1));
  scene.add(new THREE.HemisphereLight(0x0a0c12, 0x050507, 0.15));
  const flashlight = new THREE.SpotLight(0xfff1d0, 9, 11, 0.5, 0.65, 2);
  scene.add(flashlight);
  scene.add(flashlight.target);

  const camera = new THREE.PerspectiveCamera(72, size.width / size.height, 0.05, 40);
  const visual = new MonsterVisual(512, params.get("monsterModel") ?? undefined);
  visual.setShown(true);
  scene.add(visual.group);
  // The model is only drawn once it has loaded (visual.group.visible). The loop waits for that.

  let simulated = 0;
  let segment: Segment = { state: "DORMANT", speed: 0 };
  let cameraName = "front";
  const url = visual.modelUrl;

  function placeCamera(): void {
    const preset = CAMERAS[cameraName]!;
    const [dx, dy, dz] = preset.direction;
    const length = Math.hypot(dx, dy, dz) || 1;
    const x = (dx / length) * preset.distance;
    const z = (dz / length) * preset.distance;
    camera.fov = preset.fov;
    camera.position.set(x, preset.height, z);
    camera.lookAt(...preset.target);
    camera.updateProjectionMatrix();
    flashlight.position.copy(camera.position);
    flashlight.target.position.set(...preset.target);
  }

  function draw(phase: string): void {
    placeCamera();
    overlay.textContent = [
      `model: ${modelNameFromUrl(url)}`,
      `triangles: ${triangleCount(visual.group).toLocaleString("en-US")}`,
      `animation: ${phase}`,
      `clip: ${visual.clipName ?? "none"}`,
      `state: ${segment.state} speed ${segment.speed.toFixed(1)} t=${simulated.toFixed(2)}s`,
      `camera: ${CAMERAS[cameraName]!.label}`,
    ].join("\n");
    renderer.render(scene, camera);
  }

  const api = {
    ready(): boolean {
      return visual.group.visible;
    },
    setSegment(next: Segment): void {
      segment = next;
    },
    camera(name: string): void {
      if (!CAMERAS[name]) throw new Error(`unknown camera ${name}`);
      cameraName = name;
    },
    /** Steps the simulation by `seconds` with the current segment, then draws the last step. */
    advance(seconds: number): string {
      const steps = Math.max(1, Math.round(seconds / STEP));
      for (let i = 0; i < steps; i += 1) {
        simulated += STEP;
        visual.update(
          {
            state: segment.state,
            speed: segment.speed,
            playerBearing: 0,
            watching: false,
            time: simulated,
            reducedMotion: false,
            lunging: segment.state === "ATTACKING",
          },
          STEP,
        );
      }
      draw(visual.animationPhase);
      return visual.animationPhase;
    },
    phase(): string {
      return visual.animationPhase;
    },
    triangles(): number {
      return triangleCount(visual.group);
    },
    modelName(): string {
      return modelNameFromUrl(url);
    },
  };
  (window as unknown as { __validation: typeof api }).__validation = api;
  document.body.dataset.validationReady = "pending";
  const poll = (): void => {
    if (visual.group.visible) {
      draw(visual.animationPhase);
      document.body.dataset.validationReady = "true";
      return;
    }
    window.setTimeout(poll, 50);
  };
  poll();
}

setup();
