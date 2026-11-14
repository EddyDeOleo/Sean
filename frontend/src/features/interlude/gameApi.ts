/**
 * The contract between the interlude and a game (Requirement 7).
 *
 * A game receives the saved snapshot read-only (it is frozen) and reports what happens through callbacks. It cannot change
 * the snapshot, the report, or the interlude's phase directly. The interlude owns the phases and tells the game which one it is in.
 */

import type { ReactNode } from "react";
import type { ReportSnapshot } from "../report/reportSnapshot";
import type { GameEvent, ThreatInfo } from "../game/world";

export interface GameProps {
  /** A saved snapshot, when there is one. Used only to decorate the fiction with real, clearly labelled records. The game is fully playable without it. */
  snapshot: Readonly<ReportSnapshot> | null;
  phase: "GAME_INITIALIZATION" | "GAME_ACTIVE" | "PLAYER_CAUGHT";
  /** 1 for the first run, then one more for each retry. */
  attempt: number;
  reducedMotion: boolean;
  /** The game was started on its own, not after an analysis. Its exits say "leave the game" instead of "open the report". */
  standalone: boolean;
  intensity: "low" | "normal" | "high";
  jumpscare: boolean;
  quality: "low" | "medium" | "high";
  /** The scare when the player is caught (a close-up, a flash and a scream). The first screen lets the player turn it off before playing. */
  scare?: { enabled: boolean; onToggle(): void };
  /** Sound is off until the user turns it on; this lets the game's first screen offer it. */
  sound?: { enabled: boolean; onToggle(): void };
  /** Gameplay happenings (clue found, monster state, footsteps...) for sound. Optional. */
  onEvent?(event: GameEvent): void;
  /** Where the threat is, reported about ten times a second while the game runs. */
  onThreat?(info: ThreatInfo): void;
  /** The game is ready and playing. */
  onReady(): void;
  /** The game cannot run here (for example without WebGL). The report opens instead. */
  onFailed(): void;
  onCaught(): void;
  onEscaped(): void;
  /** Leave the game for the report. */
  onQuit(): void;
  onRetry(): void;
  onGiveUp(): void;
}

export type RenderGame = (props: GameProps) => ReactNode;
