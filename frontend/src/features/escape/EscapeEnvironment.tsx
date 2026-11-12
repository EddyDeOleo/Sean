/**
 * The escape game's map (Spec 3 section 8). A grid of tiles drawn from the engine state.
 *
 * The map is decorative and hidden from assistive technology. The same information is announced in the live region of the
 * sequence (fragments, proximity, catches, the exit), and all controls are buttons. Tiles outside the lantern radius are
 * dark. Walls and the player's own tile are always drawn, so the layout stays readable.
 */

import {
  GRID_HEIGHT,
  GRID_WIDTH,
  isLit,
  pointKey,
  remainingFragments,
  samePoint,
  type GameState,
  type Point,
} from "./escapeEngine";

interface Cell {
  key: string;
  kind: "wall" | "floor" | "exit" | "alcove";
  lit: boolean;
  glyph: string;
  className: string;
  open?: boolean;
}

function cellFor(state: GameState, point: Point): Cell {
  const lit = isLit(state, point);
  const key = pointKey(point);
  const wall = state.tiles[point.y]?.[point.x] === "WALL";
  if (wall) return { key, kind: "wall", lit, glyph: "", className: "" };

  const player = samePoint(state.player, point);
  const presence = samePoint(state.presence, point) && state.catches < 4;
  const fragment = state.fragments.find((entry) => !entry.collected && samePoint(entry.at, point));
  const exit = samePoint(state.exit, point);
  const alcove = state.hiding.some((entry) => samePoint(entry, point));

  // The presence is shown only inside the lantern light, so the dark stays dark.
  if (player) return { key, kind: exit ? "exit" : alcove ? "alcove" : "floor", lit: true, glyph: "◉", className: "tile-player", open: remainingFragments(state) === 0 };
  if (presence && lit) return { key, kind: "floor", lit, glyph: "☠", className: "tile-presence" };
  if (fragment && lit) return { key, kind: "floor", lit, glyph: "✦", className: "tile-fragment" };
  if (exit) return { key, kind: "exit", lit, glyph: lit ? "▤" : "", className: "", open: remainingFragments(state) === 0 };
  if (alcove) return { key, kind: "alcove", lit, glyph: lit ? "◌" : "", className: "" };
  return { key, kind: "floor", lit, glyph: "", className: "" };
}

export function EscapeEnvironment({ state }: { state: GameState }) {
  const cells: Cell[] = [];
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) cells.push(cellFor(state, { x, y }));
  }
  return (
    <div
      className="game-grid"
      style={{ ["--cols" as string]: GRID_WIDTH }}
      aria-hidden="true"
      data-testid="game-grid"
      data-player={pointKey(state.player)}
      data-catches={state.catches}
    >
      {cells.map((cell) => (
        <div
          key={cell.key}
          className={`tile ${cell.className}`}
          data-kind={cell.kind}
          data-lit={cell.lit}
          data-open={cell.open === undefined ? undefined : cell.open}
        >
          {cell.glyph}
        </div>
      ))}
    </div>
  );
}
