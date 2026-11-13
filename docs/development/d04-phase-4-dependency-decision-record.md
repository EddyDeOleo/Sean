# D04. Phase 4 dependency decision record

Status: ACCEPTED by the owner's directive (Three.js approved as a new dependency). Date: 2026-11-12.

## three 0.187.0 (runtime) and @types/three 0.187.0 (development)

| Question | Answer |
|---|---|
| Why | The first-person game (Spec 4 section 11) needs a WebGL renderer. Plain Three.js was chosen over React Three Fiber: fewer dependencies, no reconciler in the animation loop, and the game rules are pure TypeScript modules that Three.js never touches. |
| Licence | MIT. |
| Maintenance | Actively maintained, frequent releases. |
| Security | `npm audit` reported 0 vulnerabilities after installation (checked for production and all dependencies). No install scripts. Exact versions are pinned. |
| Windows | Browser library, no native code. Verified in Microsoft Edge on Windows with real WebGL (Playwright). |
| Cost | Free. No service, no key, no network request at run time. |
| Size | The renderer chunk is about 546 kB (136 kB gzip). It is loaded by a dynamic `import()` only when the game starts. The main bundle is about 370 kB (112 kB gzip) and does not contain Three.js. |
| Assets | None. Geometry is procedural, textures are drawn on small canvases at start-up, sound is synthesised. There are no asset licences to track. |

## fake-indexeddb 6.2.8 (development, from stage 3)

Test-only IndexedDB implementation (MIT). Used by the unit and component tests to exercise the real storage code.

## Not added

React Three Fiber, drei, physics engines, audio libraries, animation libraries. Collision, pathfinding and sound are small and are written in the project.
