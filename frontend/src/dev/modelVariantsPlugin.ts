/**
 * Development-only access to the optional monster model variants (polygon and texture benchmarks).
 *
 * The variants live in assets/monster/variants/, outside public/, so `vite build` never copies them into dist/. On the dev
 * server only (`apply: "serve"`), this plugin answers GET and HEAD for /models/<name>.glb from that folder, so
 * `?monsterModel=/models/<name>.glb` (monsterVisual.ts) and monster-validation.html can still load them. A name that is not in
 * the folder falls through to Vite, which serves public/models/ as before, so the runtime model is unaffected.
 *
 * Node-only. It is used by vite.config.ts and must not be imported by application code.
 */
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** The same rule as DEV_MODEL_PATTERN in monsterVisual.ts: one file name under /models/, with no folder and no dots in the name. */
const VARIANT_URL = /^\/models\/(sean-monster[\w-]*\.glb)$/;

/** The variant file a request URL names, when it exists directly in `dir`; otherwise null. The query string is ignored. */
export function variantFile(url: string, dir: string): string | null {
  const pathname = url.split("?", 1)[0] ?? "";
  const match = VARIANT_URL.exec(pathname);
  if (!match) return null;
  const root = path.resolve(dir);
  const file = path.resolve(root, match[1]!);
  // The pattern already rules out separators and "..". Containment is checked again on the resolved path.
  if (path.dirname(file) !== root) return null;
  return statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

/** The dev-server plugin that serves the variants in `dir` under /models/. It is not part of production builds. */
export function devModelVariants(dir: string): Plugin {
  return {
    name: "sean-dev-model-variants",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = req.method === "GET" || req.method === "HEAD" ? variantFile(req.url ?? "", dir) : null;
        if (!file) {
          next();
          return;
        }
        res.setHeader("Content-Type", "model/gltf-binary");
        res.setHeader("Content-Length", String(statSync(file).size));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        // A read error goes to Vite's error handler, so it is reported and does not stop the dev server.
        createReadStream(file).on("error", (error) => next(error)).pipe(res);
      });
    },
  };
}
