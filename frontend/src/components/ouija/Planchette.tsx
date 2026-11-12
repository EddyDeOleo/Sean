/**
 * The planchette (Spec 2 section 6.4, Spec 3 section 5 Scene B).
 *
 * Its position is set in CSS from the stage class on the board, so it is a pure function of the stage: the same stage always
 * gives the same position. It carries no result content and uses no randomness. It is decorative: it is hidden from
 * assistive technology, and the status is communicated as text elsewhere.
 */

import type { PlanchetteStage } from "../../features/experience/experienceMachine";

export function Planchette({ stage, onSettled }: { stage: PlanchetteStage; onSettled?: () => void }) {
  return (
    <div
      className="planchette"
      aria-hidden="true"
      data-stage={stage}
      onTransitionEnd={(event) => {
        if (stage === "SETTLED" && event.propertyName === "transform") onSettled?.();
      }}
    >
      <div className="planchette-body" />
      <div className="planchette-window" />
    </div>
  );
}
