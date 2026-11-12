/**
 * The escape game (Spec 3 section 8, Scene E).
 *
 * A real, turn-based game on the pure engine. The player moves with the arrow keys or WASD, waits with the space bar, or uses
 * the on-screen buttons (also for touch). The engine never reads the result. The sequence only reads the real evidence items
 * to build fragments and reports each collected fragment to the experience, which accepts it only if the id exists.
 *
 * Honesty and safety:
 * - The presence is described as a fictional manifestation of forgotten technical history. No motive or crime is assigned
 *   to anyone, and no author is shown.
 * - A skip button is always present. Escaping or skipping leaves the result untouched.
 * - The game announces progress in a live region, since the map itself is decorative.
 * - Keyboard handling is scoped to the game region, so it never captures keys from the rest of the page.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { InvestigationResult } from "../../types/contract";
import { buildClues } from "../experience/clues";
import {
  DORMANT_AFTER_CATCHES,
  createGame,
  proximity,
  remainingFragments,
  step,
  type Action,
  type GameState,
} from "./escapeEngine";
import { EscapeEnvironment } from "./EscapeEnvironment";
import { EvidenceClue } from "./EvidenceClue";

export const FICTION_LINE =
  "The presence is fiction: a manifestation of forgotten technical history. It is not a person, and it says nothing about anyone who worked on this repository.";

interface GameView {
  game: GameState;
  announcement: string;
  /** Fragment indexes in the order they were collected, for the on-screen list. */
  found: number[];
}

type GameEventInput = { type: "ACT"; action: Action } | { type: "RESTART"; game: GameState };

function announce(previous: GameState, next: GameState, clueLabels: string[]): string {
  const event = next.event;
  switch (event.kind) {
    case "COLLECTED":
      return `Fragment found: ${clueLabels[event.index] ?? "an evidence record"}. ${remainingFragments(next)} remaining.`;
    case "CAUGHT":
      return event.catches >= DORMANT_AFTER_CATCHES
        ? "The presence caught you and has gone still. You are back at the entrance. It will not follow you again."
        : `The presence caught you. You are back at the entrance. Your fragments are kept. ${remainingFragments(next)} remaining.`;
    case "EXIT_SEALED":
      return `The exit is sealed. ${event.remaining} fragment${event.remaining === 1 ? "" : "s"} still to find.`;
    case "ESCAPED":
      return "You reached the exit and escaped.";
    case "BLOCKED":
      return "A wall blocks that way.";
    case "MOVED":
    case "NONE": {
      const was = proximity(previous);
      const now = proximity(next);
      if (next.catches >= DORMANT_AFTER_CATCHES) return "The presence is still.";
      return now !== was ? `The presence is ${now}.` : "";
    }
  }
}

export interface EscapeSequenceProps {
  result: InvestigationResult;
  collected: string[];
  onClue(evidenceId: string): void;
  onEscaped(): void;
  onSkip(): void;
  onCue?(cue: "clue" | "caught" | "door" | "escape"): void;
}

export function EscapeSequence({ result, collected, onClue, onEscaped, onSkip, onCue }: EscapeSequenceProps) {
  const clues = useMemo(() => buildClues(result), [result]);
  const labels = useMemo(() => clues.map((clue) => clue.label), [clues]);
  const initial = useMemo(() => createGame(result.investigation_id, clues.length), [result.investigation_id, clues.length]);

  const [view, dispatch] = useReducer(
    (current: GameView, input: GameEventInput): GameView => {
      if (input.type === "RESTART") return { game: input.game, announcement: "", found: [] };
      const next = step(current.game, input.action);
      if (next === current.game) return current;
      const found = next.event.kind === "COLLECTED" ? [...current.found, next.event.index] : current.found;
      return { game: next, announcement: announce(current.game, next, labels), found };
    },
    { game: initial, announcement: "", found: [] },
  );

  // Report effects after the state change: clues to the experience, cues to audio, completion to the parent.
  const reported = useRef<{ turn: number }>({ turn: 0 });
  useEffect(() => {
    const { game } = view;
    if (game.turn === reported.current.turn) return;
    reported.current.turn = game.turn;
    switch (game.event.kind) {
      case "COLLECTED": {
        const clue = clues[game.event.index];
        if (clue) onClue(clue.evidenceId);
        onCue?.("clue");
        break;
      }
      case "CAUGHT":
        onCue?.("caught");
        break;
      case "ESCAPED":
        onCue?.("escape");
        break;
      default:
        break;
    }
  }, [view, clues, onClue, onCue]);

  // Completion is reported once, shortly after the final announcement, so a screen reader hears it.
  const escapedReported = useRef(false);
  useEffect(() => {
    if (view.game.status !== "ESCAPED" || escapedReported.current) return;
    escapedReported.current = true;
    const handle = window.setTimeout(onEscaped, 1400);
    return () => window.clearTimeout(handle);
  }, [view.game.status, onEscaped]);

  const act = useCallback((action: Action) => dispatch({ type: "ACT", action }), []);

  function onKeyDown(event: React.KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const map: Record<string, Action> = {
      arrowup: "UP",
      w: "UP",
      arrowdown: "DOWN",
      s: "DOWN",
      arrowleft: "LEFT",
      a: "LEFT",
      arrowright: "RIGHT",
      d: "RIGHT",
      " ": "WAIT",
    };
    const action = map[key];
    if (!action) return;
    // A focused button handles the space bar itself. Only the region's own keystrokes are taken as moves.
    if (event.target instanceof HTMLButtonElement && (key === " " || key === "enter")) return;
    event.preventDefault();
    act(action);
  }

  const { game } = view;
  const remaining = remainingFragments(game);
  const near = proximity(game);

  return (
    <section
      className="scene"
      aria-label="Escape game"
      data-testid="escape"
      data-status={game.status}
      data-remaining={remaining}
      data-catches={game.catches}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <p className="notice notice-fiction" role="note" style={{ marginTop: 0 }}>
        {FICTION_LINE}
      </p>
      <h3 style={{ margin: "0 0 0.25rem", fontFamily: "var(--font-display)" }}>The archive</h3>
      <p className="muted" style={{ margin: "0 0 0.3rem" }}>
        Gather every fragment, then reach the exit. Each fragment is a real record from the result. The presence is{" "}
        <strong data-testid="proximity">{game.catches >= DORMANT_AFTER_CATCHES ? "still" : near}</strong>. Hiding places (◌) keep
        you out of its sight.
      </p>

      <EscapeEnvironment state={game} />

      <div className="dpad" role="group" aria-label="Move">
        <button type="button" className="btn up" onClick={() => act("UP")} aria-label="Move up">
          ↑
        </button>
        <button type="button" className="btn left" onClick={() => act("LEFT")} aria-label="Move left">
          ←
        </button>
        <button type="button" className="btn wait" onClick={() => act("WAIT")} aria-label="Wait one turn">
          wait
        </button>
        <button type="button" className="btn right" onClick={() => act("RIGHT")} aria-label="Move right">
          →
        </button>
        <button type="button" className="btn down" onClick={() => act("DOWN")} aria-label="Move down">
          ↓
        </button>
      </div>
      <p className="muted" style={{ textAlign: "center", margin: "0 0 0.4rem", fontSize: "0.85rem" }}>
        Arrow keys or W A S D to move, space to wait. Each action is one turn, so there is no rush.
      </p>

      <div role="status" aria-live="polite" aria-atomic="true" className="visually-hidden" data-testid="game-announcer">
        {view.announcement}
      </div>
      <p aria-hidden="true" className="muted" style={{ margin: "0.2rem 0", minHeight: "1.4rem" }} data-testid="game-line">
        {view.announcement}
      </p>

      <h4 style={{ margin: "0.5rem 0 0.2rem" }}>
        Fragments {clues.length - remaining} of {clues.length}
      </h4>
      <ul className="fragment-log" data-testid="clue-list">
        {view.found.map((index) => {
          const clue = clues[index];
          return clue ? <EvidenceClue key={clue.evidenceId} clue={clue} /> : null;
        })}
      </ul>
      {clues.length > 0 && collected.length === 0 ? <p className="muted" style={{ margin: 0 }}>None found yet.</p> : null}
      {game.status === "ESCAPED" ? <p className="notice" data-testid="escaped-note">You escaped. The report follows.</p> : null}

      <div className="button-row" style={{ marginTop: "0.7rem" }}>
        <button type="button" className="btn btn-quiet btn-small" onClick={onSkip}>
          Skip the game
        </button>
      </div>
    </section>
  );
}
