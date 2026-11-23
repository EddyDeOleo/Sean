/**
 * The institutional archive decoration (Workstream D). It adds shelving, filing cabinets, labelled boxes, institutional doors,
 * ceiling panels, fluorescent fixtures, vents, baseboards and a few carts and bins to a scene. The placements come from
 * planArchive (archiveLayout.ts), which only uses the existing level grid.
 *
 * The meshes add no lights and no AI input. Collision comes from the same plan: archiveLayout.ts solidFootprints, which world.ts
 * applies to movement, and every mesh of a solid item stays inside its footprint. Repeated parts are InstancedMeshes, one per
 * part kind, so each part kind costs one draw call. Geometries and materials are shared, and dispose() frees all of them.
 */

import * as THREE from "three";
import { hash } from "../flicker";
import type { Level, Point } from "../level";
import { ARCHIVE_CEILING, planArchive, type ArchiveItem } from "./archiveLayout";

export type ArchiveQuality = "low" | "medium" | "high";

export interface ArchiveOptions {
  /** Edge length in pixels of the square canvases behind the label and acoustic-panel textures. */
  textureSize: number;
  /** Sets the detail of round parts (bins, cart casters). Low uses the fewest segments. */
  quality: ArchiveQuality;
}

export interface ArchiveStats {
  filingCabinets: number;
  shelvingUnits: number;
  /** Document boxes on shelves. Each one carries a label. */
  archiveBoxes: number;
  labels: number;
  acousticPanels: number;
  fluorescentFixtures: number;
  ceilingVents: number;
  wallVents: number;
  baseboards: number;
  institutionalDoors: number;
  documentCarts: number;
  wasteBins: number;
  crateStacks: number;
  /** Draw calls the decoration adds: one per InstancedMesh. */
  instancedMeshes: number;
  /** Triangles the decoration adds, counting every instance. */
  triangles: number;
  geometries: number;
  materials: number;
  textures: number;
}

export interface ArchiveDecor {
  readonly stats: ArchiveStats;
  /** Remove the decoration from the scene and free its geometries, materials and textures. Safe to call twice. */
  dispose(): void;
}

/**
 * The archive palette. Crimson is deliberately absent: it is reserved for the monster's own aura, never for the building.
 */
export const ARCHIVE_PALETTE = {
  beige: 0xb5ad91,
  concrete: 0x595b59,
  green: 0x4c544b,
  ochre: 0x6e6244,
  charcoal: 0x171717,
} as const;

/**
 * Scene lighting for the archive. Cold green-white fluorescent light, a dim neutral ambient, and a charcoal background and
 * fog. The renderer reads these values; nothing in the scene is red except the monster's own light.
 */
export const ARCHIVE_LIGHTING = {
  background: ARCHIVE_PALETTE.charcoal,
  ambient: 0x3a3d3a,
  ambientIntensity: 1.1,
  /**
   * The corridor fill. The ceiling lights are few (none on low quality), so outside the flashlight the corridors were black
   * and their walls, openings and floor could not be told apart. A neutral hemisphere lights the floor more than the walls
   * and the ceiling least, which keeps edges readable without a flat wash. Checked on gameplay captures (cycle D4).
   */
  hemisphereSky: 0x5c625e,
  hemisphereGround: 0x262624,
  hemisphereIntensity: 1.2,
  fogDensity: 0.07,
  /** Fluorescent tube colour. Used for the emissive lens and the ceiling point lights. */
  fluorescent: 0xe4f5ec,
} as const;

const PALETTE = ARCHIVE_PALETTE;
const LAMP_COLOUR = ARCHIVE_LIGHTING.fluorescent;
const PAPER_COLOUR = "#d8d2bd";
const INK_COLOUR = "#171717";

/** Neutral archive classification text. These are shelf labels, never repository findings. */
const LABEL_TEXTS = ["BOX 0412 / 1987-1993", "SERIES C-7 / FILE 03", "STORAGE 3/14 / RECEIVED", "NO. 218 / DRAFT 1961"] as const;

const RADIAL_SEGMENTS: Record<ArchiveQuality, number> = { low: 6, medium: 8, high: 12 };
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const UNIT_SCALE = new THREE.Vector3(1, 1, 1);

/**
 * A local frame on the floor plane: `origin` is where it starts, `yaw` turns it. A point at (u, v, w) is `u` along the wall,
 * `v` up, and `w` into the room. Ceiling items pass an absolute height for `v`.
 */
class Frame {
  private readonly cos: number;
  private readonly sin: number;
  private readonly quaternion: THREE.Quaternion;

  constructor(private readonly origin: Point, yaw: number) {
    this.cos = Math.cos(yaw);
    this.sin = Math.sin(yaw);
    this.quaternion = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, yaw);
  }

  matrix(u: number, v: number, w: number): THREE.Matrix4 {
    const position = new THREE.Vector3(this.origin.x + u * this.cos + w * this.sin, v, this.origin.y - u * this.sin + w * this.cos);
    return new THREE.Matrix4().compose(position, this.quaternion, UNIT_SCALE);
  }
}

/** Instances that share one geometry and one material. They become one InstancedMesh. */
interface Batch {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrices: THREE.Matrix4[];
  colours: (THREE.Color | null)[];
}

function trianglesOf(geometry: THREE.BufferGeometry): number {
  return (geometry.index ? geometry.index.count : geometry.attributes.position!.count) / 3;
}

function canvasTexture(size: { width: number; height: number }, paint: (ctx: CanvasRenderingContext2D) => void, store: THREE.Texture[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (ctx) paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  store.push(texture);
  return texture;
}

/** Builds the decoration for one scene. Nothing here is shared across scenes. */
class ArchiveBuilder {
  private readonly geometries = new Map<string, THREE.BufferGeometry>();
  private readonly batches = new Map<string, Batch>();
  private readonly materials: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly segments: number;
  private readonly counts = {
    filingCabinets: 0,
    shelvingUnits: 0,
    archiveBoxes: 0,
    labels: 0,
    acousticPanels: 0,
    fluorescentFixtures: 0,
    ceilingVents: 0,
    wallVents: 0,
    baseboards: 0,
    institutionalDoors: 0,
    documentCarts: 0,
    wasteBins: 0,
    crateStacks: 0,
  };

  private readonly metal = this.standard(PALETTE.green, { roughness: 0.6, metalness: 0.25 });
  private readonly dark = this.standard(PALETTE.charcoal, { roughness: 0.6 });
  private readonly steel = this.standard(PALETTE.concrete, { roughness: 0.6, metalness: 0.3 });
  private readonly handle = this.standard(PALETTE.beige, { roughness: 0.4, metalness: 0.5 });
  private readonly ochre = this.standard(PALETTE.ochre, { roughness: 0.9 });
  private readonly cardboard = this.standard(0xffffff, { roughness: 0.95 });
  private readonly lens = this.standard(LAMP_COLOUR, { roughness: 0.3, emissive: LAMP_COLOUR, emissiveIntensity: 2 });
  private readonly panel: THREE.MeshStandardMaterial;
  private readonly labels: THREE.MeshStandardMaterial[];

  constructor(options: ArchiveOptions) {
    this.segments = RADIAL_SEGMENTS[options.quality];
    const { textureSize } = options;
    this.panel = this.standard(PALETTE.beige, {
      roughness: 1,
      map: canvasTexture({ width: textureSize / 2, height: textureSize / 2 }, (ctx) => perforate(ctx, textureSize / 2), this.textures),
    });
    this.labels = LABEL_TEXTS.map((text) =>
      this.standard(0xffffff, {
        roughness: 0.9,
        map: canvasTexture({ width: textureSize, height: textureSize / 2 }, (ctx) => paintLabel(ctx, textureSize, textureSize / 2, text), this.textures),
      }),
    );
  }

  private standard(colour: number, options: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({ color: colour, ...options });
    this.materials.push(material);
    return material;
  }

  private geometry(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let geometry = this.geometries.get(key);
    if (!geometry) {
      geometry = make();
      this.geometries.set(key, geometry);
    }
    return geometry;
  }

  private add(batchName: string, geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4, colour: number | null): void {
    // One batch per part and geometry. Parts of different sizes under one name (a cart's tray and its posts, a shelf's back and
    // its sides) were all drawn with the first part's geometry, so posts became trays and shelf sides reached into the next tile.
    const key = `${batchName}#${geometry.uuid}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { geometry, material, matrices: [], colours: [] };
      this.batches.set(key, batch);
    }
    batch.matrices.push(matrix);
    batch.colours.push(colour === null ? null : new THREE.Color(colour));
  }

  private box(batch: string, material: THREE.Material, size: readonly [number, number, number], frame: Frame, u: number, v: number, w: number, colour: number | null = null): void {
    const [width, height, depth] = size;
    const geometry = this.geometry(`box:${width},${height},${depth}`, () => new THREE.BoxGeometry(width, height, depth));
    this.add(batch, geometry, material, frame.matrix(u, v, w), colour);
  }

  private cylinder(batch: string, material: THREE.Material, radius: number, height: number, frame: Frame, u: number, v: number, w: number): void {
    const segments = this.segments;
    const geometry = this.geometry(`cylinder:${radius},${height},${segments}`, () => new THREE.CylinderGeometry(radius, radius, height, segments));
    this.add(batch, geometry, material, frame.matrix(u, v, w), null);
  }

  /** A flat label facing +w, on the front of a box. */
  private label(batch: string, material: THREE.Material, width: number, height: number, frame: Frame, u: number, v: number, w: number): void {
    const geometry = this.geometry(`plane:${width},${height}`, () => new THREE.PlaneGeometry(width, height));
    this.add(batch, geometry, material, frame.matrix(u, v, w), null);
  }

  emit(item: ArchiveItem): void {
    const frame = new Frame(item.origin, item.yaw);
    switch (item.kind) {
      case "filingCabinet":
        this.filingCabinet(frame);
        break;
      case "shelvingUnit":
        this.shelvingUnit(item, frame);
        break;
      case "institutionalDoor":
        this.institutionalDoor(frame);
        break;
      case "wallVent":
        this.wallVent(frame);
        break;
      case "baseboard":
        this.box("baseboard", this.ochre, [1, 0.1, 0.025], frame, 0, 0.05, 0.0175);
        this.counts.baseboards += 1;
        break;
      case "documentCart":
        this.documentCart(item, frame);
        break;
      case "wasteBin":
        this.cylinder("wasteBin", this.dark, 0.1, 0.3, frame, -0.32, 0.15, 0.11);
        this.counts.wasteBins += 1;
        break;
      case "crateStack":
        this.box("crateBox", this.cardboard, [0.36, 0.2, 0.2], frame, 0, 0.1, 0.11, PALETTE.ochre);
        this.box("crateBox", this.cardboard, [0.36, 0.2, 0.2], frame, 0.02, 0.3, 0.11, PALETTE.beige);
        this.counts.crateStacks += 1;
        break;
      case "acousticPanel":
        this.box("acousticPanel", this.panel, [0.9, 0.025, 0.9], frame, 0, ARCHIVE_CEILING - 0.0125, 0);
        this.counts.acousticPanels += 1;
        break;
      case "fluorescentFixture":
        this.box("fixtureHousing", this.steel, [0.8, 0.04, 0.2], frame, 0, ARCHIVE_CEILING - 0.02, 0);
        this.box("fixtureLens", this.lens, [0.74, 0.012, 0.16], frame, 0, ARCHIVE_CEILING - 0.046, 0);
        this.counts.fluorescentFixtures += 1;
        break;
      case "ceilingVent":
        this.box("ceilingVentPlate", this.dark, [0.36, 0.02, 0.36], frame, 0, ARCHIVE_CEILING - 0.01, 0);
        for (const w of [-0.12, 0, 0.12]) this.box("ceilingVentSlat", this.steel, [0.3, 0.01, 0.02], frame, 0, ARCHIVE_CEILING - 0.025, w);
        this.counts.ceilingVents += 1;
        break;
    }
  }

  private filingCabinet(frame: Frame): void {
    // The body fills the footprint (w 0.01 to 0.19); the seams and handles stand on its front, inside SOLID_MAX_DEPTH.
    this.box("cabinetBody", this.metal, [0.5, 0.85, 0.18], frame, 0, 0.425, 0.1);
    for (const v of [0.283, 0.566]) this.box("cabinetSeam", this.dark, [0.46, 0.01, 0.006], frame, 0, v, 0.193);
    for (const v of [0.142, 0.425, 0.708]) this.box("cabinetHandle", this.handle, [0.14, 0.022, 0.02], frame, 0, v, 0.2);
    this.counts.filingCabinets += 1;
  }

  private shelvingUnit(item: ArchiveItem, frame: Frame): void {
    this.box("shelfFrame", this.steel, [0.9, 1.05, 0.02], frame, 0, 0.525, 0.02);
    for (const u of [-0.435, 0.435]) this.box("shelfFrame", this.steel, [0.03, 1.05, 0.2], frame, u, 0.525, 0.11);
    for (let board = 0; board < 5; board += 1) this.box("shelfBoard", this.steel, [0.87, 0.02, 0.2], frame, 0, 0.03 + board * 0.26, 0.11);
    // Boxes sit in the four bays between the boards. Each box has a label on its room-facing side.
    for (let bay = 0; bay < 4; bay += 1) {
      const boardTop = 0.04 + bay * 0.26;
      [-0.27, 0, 0.27].forEach((u, column) => {
        const roll = hash(item.tileX * 7 + bay, item.tileY * 13 + column);
        if (roll < 0.15) return;
        const colour = roll > 0.7 ? PALETTE.ochre : PALETTE.beige;
        const v = boardTop + 0.1;
        this.box("archiveBox", this.cardboard, [0.22, 0.2, 0.17], frame, u, v, 0.115, colour);
        const labelIndex = Math.min(this.labels.length - 1, Math.floor(hash(item.tileY * 5 + bay, item.tileX * 3 + column) * this.labels.length));
        this.label(`label${labelIndex}`, this.labels[labelIndex]!, 0.15, 0.08, frame, u, v, 0.202);
        this.counts.archiveBoxes += 1;
        this.counts.labels += 1;
      });
    }
    this.counts.shelvingUnits += 1;
  }

  private institutionalDoor(frame: Frame): void {
    this.box("doorLeaf", this.metal, [0.8, 0.98, 0.04], frame, 0, 0.49, 0.03);
    this.box("doorPlate", this.handle, [0.06, 0.1, 0.006], frame, 0.3, 0.5, 0.053);
    for (const u of [-0.44, 0.44]) this.box("doorFrame", this.steel, [0.08, 1.05, 0.08], frame, u, 0.525, 0.05);
    this.box("doorFrame", this.steel, [0.96, 0.08, 0.08], frame, 0, 1.01, 0.05);
    this.counts.institutionalDoors += 1;
  }

  private wallVent(frame: Frame): void {
    this.box("wallVent", this.dark, [0.36, 0.2, 0.016], frame, 0, 0.82, 0.018);
    for (const v of [0.76, 0.8, 0.84, 0.88]) this.box("wallVentSlat", this.steel, [0.3, 0.012, 0.01], frame, 0, v, 0.034);
    this.counts.wallVents += 1;
  }

  private documentCart(item: ArchiveItem, frame: Frame): void {
    this.box("cartFrame", this.steel, [0.5, 0.02, 0.2], frame, 0, 0.08, 0.11);
    for (const u of [-0.24, 0.24]) {
      for (const w of [0.02, 0.2]) this.box("cartFrame", this.steel, [0.02, 0.46, 0.02], frame, u, 0.33, w);
    }
    this.box("cartTray", this.ochre, [0.5, 0.02, 0.2], frame, 0, 0.56, 0.11);
    for (const u of [-0.21, 0.21]) {
      for (const w of [0.05, 0.17]) this.cylinder("cartCaster", this.dark, 0.035, 0.07, frame, u, 0.035, w);
    }
    // A stack of loose documents on the tray. Each sheet is a thin beige box; the stack height varies by tile.
    const sheets = 4 + Math.floor(hash(item.tileX, item.tileY) * 3);
    for (let sheet = 0; sheet < sheets; sheet += 1) {
      this.box("cartDocs", this.cardboard, [0.3, 0.012, 0.16], frame, 0, 0.582 + sheet * 0.013, 0.11, PALETTE.beige);
    }
    this.counts.documentCarts += 1;
  }

  /** Free every GPU resource the builder made. The scene no longer references them after the group is removed. */
  disposeResources(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
    for (const material of this.materials) material.dispose();
    for (const texture of this.textures) texture.dispose();
  }

  /** The decoration as one group, with one InstancedMesh per batch. */
  flush(): { group: THREE.Group; instancedMeshes: number; triangles: number } {
    const group = new THREE.Group();
    group.name = "archive-decor";
    let triangles = 0;
    for (const [name, batch] of this.batches) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
      mesh.name = name.slice(0, name.indexOf("#"));
      batch.matrices.forEach((matrix, i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, batch.colours[i] ?? new THREE.Color(0xffffff));
      });
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
      triangles += trianglesOf(batch.geometry) * batch.matrices.length;
    }
    return { group, instancedMeshes: this.batches.size, triangles };
  }

  get geometryCount(): number {
    return this.geometries.size;
  }

  get materialCount(): number {
    return this.materials.length;
  }

  get textureCount(): number {
    return this.textures.length;
  }

  get countsSnapshot(): Omit<ArchiveStats, "instancedMeshes" | "triangles" | "geometries" | "materials" | "textures"> {
    return { ...this.counts };
  }
}

/** A dotted acoustic-panel texture: a light base with a grid of darker perforations. */
function perforate(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.fillStyle = "#d6d6d2";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#8a8a86";
  const step = size / 8;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, step * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** A paper label: an off-white card with a thin border and one line of ink. */
function paintLabel(ctx: CanvasRenderingContext2D, width: number, height: number, text: string): void {
  ctx.fillStyle = PAPER_COLOUR;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = INK_COLOUR;
  ctx.lineWidth = Math.max(2, height / 32);
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, width - 2 * ctx.lineWidth, height - 2 * ctx.lineWidth);
  ctx.fillStyle = INK_COLOUR;
  ctx.font = `bold ${Math.round(height * 0.3)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, width / 2, height / 2);
}

/**
 * Build the archive decoration into `scene`. Pure visual: it reads `level` and adds meshes, nothing else.
 * Building twice with the same level gives identical placements.
 */
export function buildArchiveDecor(scene: THREE.Scene, level: Level, options: ArchiveOptions): ArchiveDecor {
  const builder = new ArchiveBuilder(options);
  let group: THREE.Group;
  let instancedMeshes: number;
  let triangles: number;
  try {
    for (const item of planArchive(level)) builder.emit(item);
    ({ group, instancedMeshes, triangles } = builder.flush());
  } catch (error) {
    builder.disposeResources();
    throw error;
  }
  scene.add(group);
  const stats: ArchiveStats = {
    ...builder.countsSnapshot,
    instancedMeshes,
    triangles,
    geometries: builder.geometryCount,
    materials: builder.materialCount,
    textures: builder.textureCount,
  };
  let disposed = false;
  return {
    stats,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      for (const child of group.children) (child as THREE.InstancedMesh).dispose();
      group.clear();
      builder.disposeResources();
    },
  };
}
