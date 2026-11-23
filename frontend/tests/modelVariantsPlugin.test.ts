/**
 * The dev-server plugin that serves the optional monster model variants from assets/monster/variants/ (src/dev/
 * modelVariantsPlugin.ts). It must serve only file names that exist directly in that folder, never anything outside it, and
 * it must not take part in production builds.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { devModelVariants, variantFile } from "../src/dev/modelVariantsPlugin";

const dir = mkdtempSync(path.join(tmpdir(), "sean-variants-"));
writeFileSync(path.join(dir, "sean-monster-100k.glb"), "glb");
mkdirSync(path.join(dir, "sub"));
writeFileSync(path.join(dir, "sub", "sean-monster-sub.glb"), "glb");
// A file next to the folder, which a traversal would try to reach.
writeFileSync(path.join(path.dirname(dir), `${path.basename(dir)}-outside.glb`), "glb");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(path.join(path.dirname(dir), `${path.basename(dir)}-outside.glb`), { force: true });
});

describe("dev model variants", () => {
  it("serves a variant that exists in the folder, ignoring the query string", () => {
    expect(variantFile("/models/sean-monster-100k.glb", dir)).toBe(path.join(dir, "sean-monster-100k.glb"));
    expect(variantFile("/models/sean-monster-100k.glb?t=1", dir)).toBe(path.join(dir, "sean-monster-100k.glb"));
  });

  it("falls through for a name that is not in the folder, so public/models (the runtime model) is served as before", () => {
    expect(variantFile("/models/sean-monster-250k-rigged.glb", dir)).toBeNull();
  });

  it("refuses anything outside the folder or outside the monster model name rule", () => {
    for (const url of [
      "/models/../sean-monster-100k.glb",
      `/models/../${path.basename(dir)}-outside.glb`,
      "/models/sub/sean-monster-sub.glb",
      "/models/sean-monster%2e%2e.glb",
      "/models/sean-monster-100k.glb/",
      "/models/other.glb",
      "/sean-monster-100k.glb",
      "/assets/monster/variants/sean-monster-100k.glb",
    ]) {
      expect(variantFile(url, dir), url).toBeNull();
    }
  });

  it("applies to the dev server only, never to production builds", () => {
    expect(devModelVariants(dir).apply).toBe("serve");
  });
});
