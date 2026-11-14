/**
 * The full-screen interlude (Spec 4 section 10; Requirement 6).
 *
 * It covers the whole viewport. The application behind it is made inert by the caller, so keyboard focus stays here. The
 * way out is always present: the "Skip to the report" button, and the Escape key before the game. Nothing shown here is
 * evidence: a notice says so and says that the report cannot be changed by what follows.
 */

import { useEffect, useRef } from "react";
import { isGamePhase, type InterludeState } from "../../features/interlude/interludeMachine";
import { OuijaBoard } from "./OuijaBoard";

export const FIRST_LINE = "Wait... something is wrong.";
export const SECOND_LINE = "Something else is still in this repository.";
const QUESTION_PREVIEW = 90;

export interface InterludeOverlayProps {
  state: InterludeState;
  /** The user's original question. It informs the fiction and is shown as text only. */
  question: string;
  reducedMotion: boolean;
  /** The game was started on its own, with no report behind it. */
  standalone?: boolean;
  onSkip(): void;
  /** The game, rendered when the interlude is in a game phase. */
  children?: React.ReactNode;
}

export function InterludeOverlay({ state, question, reducedMotion, standalone = false, onSkip, children }: InterludeOverlayProps) {
  const { phase } = state;
  const skipRef = useRef<HTMLButtonElement>(null);
  const inGame = isGamePhase(phase);

  useEffect(() => {
    skipRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (inGame) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inGame, onSkip]);

  const interrupted = phase === "NARRATIVE_INTERRUPTION";
  const shownQuestion = question.length > QUESTION_PREVIEW ? `${question.slice(0, QUESTION_PREVIEW)}…` : question;

  return (
    <div className="il-overlay" role="dialog" aria-modal="true" aria-label="Narrative experience" data-phase={phase} data-reduced={reducedMotion} data-testid="interlude">
      <p className="il-fiction" role="note" data-testid="fiction-notice">
        {standalone ? "Fiction. This game is part of the experience, not a finding. It does not change any report." : "Fiction. What follows is part of the experience, not a finding. It cannot change your report."}
      </p>
      <button type="button" className="il-skip" onClick={onSkip} ref={skipRef} data-testid="skip-interlude">
        {standalone ? "Leave the game" : "Skip to the report"}
      </button>

      {!inGame && phase !== "GAME_COMPLETED" && phase !== "GAME_SKIPPED" ? (
        <div className="il-stage" data-glitch={interrupted && state.beat === 1 && !reducedMotion}>
          <OuijaBoard step={state.step} settled={state.boardSettled} dim={interrupted} reducedMotion={reducedMotion} />
          <p className="il-whisper" data-testid="whisper" aria-hidden={interrupted}>
            The board remembers your question: <q><bdi>{shownQuestion}</bdi></q>
          </p>
          <div className="il-lines" role="status" aria-live="assertive" aria-atomic="false">
            {state.beat >= 1 ? <p className="il-line" data-testid="line-one">{FIRST_LINE}</p> : null}
            {state.beat >= 2 ? <p className="il-line il-line-two" data-testid="line-two">{SECOND_LINE}</p> : null}
          </div>
        </div>
      ) : null}

      {inGame ? <div className="il-game">{children}</div> : null}
      {phase === "GAME_COMPLETED" || phase === "GAME_SKIPPED" ? (
        <p className="il-closing" role="status" data-testid="closing">{standalone ? "Returning to Sean." : "Returning to your report."}</p>
      ) : null}
    </div>
  );
}
