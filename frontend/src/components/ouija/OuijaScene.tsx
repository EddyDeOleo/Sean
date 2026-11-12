/**
 * The Ouija scene (Spec 3 section 5, Scenes B and C).
 *
 * The scene shows the board, the planchette, and the reveal. It reads the experience state and renders. It never decides
 * a status, a classification, or a conclusion.
 *
 * What it shows, and when:
 * - Idle, error, cancelled: the board at rest and a short instruction. No reveal.
 * - Investigating: the planchette wakes and then follows a fixed search path. The text says the search is under way and that
 *   nothing is revealed until the complete result arrives.
 * - Revealing, not settled: the planchette moves to its final position. The reveal area stays empty.
 * - Revealing, settled and later phases: the complete phrase appears as one line. For a supported result the phrase is the
 *   backend conclusion. For INSUFFICIENT_EVIDENCE it is only the neutral phrase INSUFFICIENT EVIDENCE with the backend
 *   explanation. A partial result shows its limitation notice with the phrase.
 */

import type { ReactNode } from "react";
import { deriveUiState } from "../../features/investigation/validateResponse";
import { planchetteStage, type ExperienceState } from "../../features/experience/experienceMachine";
import { Planchette } from "./Planchette";
import { StatusStrip } from "./StatusStrip";

export const NEUTRAL_PHRASE = "INSUFFICIENT EVIDENCE";

const STAGE_CLASS: Record<ReturnType<typeof planchetteStage>, string> = {
  REST: "stage-rest",
  WAKE: "stage-wake",
  SEARCH: "stage-search",
  REVEAL_PREP: "stage-reveal-prep",
  SETTLED: "stage-settled",
};

const STAGE_TEXT: Record<ReturnType<typeof planchetteStage>, string> = {
  REST: "The board is at rest.",
  WAKE: "The planchette stirs. Your request is being prepared.",
  SEARCH: "The planchette searches while the backend reads the repository history. Nothing is revealed yet.",
  REVEAL_PREP: "The result has arrived. The planchette is moving to its final position.",
  SETTLED: "The planchette has settled.",
};

export interface OuijaSceneProps {
  state: ExperienceState;
  /** Called when the planchette's final transition ends. A timer in useExperience also settles, so this is a fast path. */
  onSettled?(): void;
  children?: ReactNode;
}

export function OuijaScene({ state, onSettled, children }: OuijaSceneProps) {
  const stage = planchetteStage(state);
  const result = state.result;
  const showResult = result !== null && (state.phase === "REVEALING" ? state.settled : state.phase !== "ERROR" && state.phase !== "CANCELLED");
  const ui = result ? deriveUiState(result) : null;

  return (
    <div className={`board-wrap ${STAGE_CLASS[stage]}`} data-stage={stage}>
      <div className="board" role="img" aria-label="Ouija board with a planchette">
        <span className="board-text board-yes">YES</span>
        <span className="board-text board-no">NO</span>
        <span className="board-text board-arc-1">A B C D E F G H I J K L M</span>
        <span className="board-text board-arc-2">N O P Q R S T U V W X Y Z</span>
        <span className="board-text board-numbers">1 2 3 4 5 6 7 8 9 0</span>
        <span className="board-text board-goodbye">GOODBYE</span>
        <div className="board-glow" />
        <div className="dust" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <Planchette stage={stage} onSettled={onSettled} />
      </div>

      <p className="muted" role="status" aria-live="polite" data-testid="stage-text" style={{ margin: "0.5rem 0 0", textAlign: "center" }}>
        {STAGE_TEXT[stage]}
      </p>

      <section className="reveal" aria-label="Revealed answer" aria-live="polite" data-testid="reveal">
        {showResult && result ? (
          <div className="arrive">
            {ui === "INSUFFICIENT_EVIDENCE" ? (
              <>
                <p className="reveal-phrase neutral" data-testid="phrase">
                  {NEUTRAL_PHRASE}
                </p>
                <p className="muted" style={{ margin: "0.5rem 0 0" }}>
                  The available evidence does not support a reliable historical conclusion. This is a system status, not an
                  answer about the repository's history.
                </p>
              </>
            ) : (
              <>
                <p className="reveal-phrase" data-testid="phrase">
                  {result.conclusion}
                </p>
                {ui === "PARTIAL" ? (
                  <p className="notice notice-warn" style={{ margin: "0.6rem 0 0" }} data-testid="partial-notice">
                    <strong>Partial result.</strong> This conclusion covers only the evidence that was retrieved. It is not a
                    complete historical explanation. The limitations are listed with the evidence.
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <p className="reveal-empty" data-testid="reveal-empty">
            {state.phase === "INVESTIGATING" || state.phase === "REVEALING"
              ? "The answer appears here, whole, once the planchette settles."
              : "Ask a question to summon the reasoning behind the code."}
          </p>
        )}
      </section>

      {result && showResult ? <StatusStrip result={result} /> : null}
      {children}
    </div>
  );
}
