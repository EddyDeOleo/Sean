/**
 * Progress while retrieving (Spec 3 section 5, Scene B; canonical contract C.9).
 *
 * The backend reports no progress. This panel therefore shows only what the frontend knows: that the request was sent, that
 * it is waiting, and how long it has waited. It claims no percentage and no discovery, and it says so.
 */

import { useEffect, useState } from "react";
import type { InvestigatingStage } from "../../features/experience/experienceMachine";

export interface InvestigationProgressProps {
  stage: InvestigatingStage | null;
  onCancel(): void;
  /** Injectable clock for tests. */
  now?: () => number;
}

export function InvestigationProgress({ stage, onCancel, now = Date.now }: InvestigationProgressProps) {
  const [started] = useState(() => now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const handle = window.setInterval(() => setElapsed(Math.floor((now() - started) / 1000)), 1000);
    return () => window.clearInterval(handle);
  }, [now, started]);

  const sent = stage === "RETRIEVING";
  return (
    <section className="progress" aria-label="Investigation progress">
      <p style={{ margin: 0 }}>
        <strong>Sean is reading the repository history.</strong>{" "}
        <span className="muted">Waiting {elapsed}s.</span>
      </p>
      <ol className="progress-steps">
        <li data-state="done">Request prepared</li>
        <li data-state={sent ? "done" : "active"}>Request sent to the backend</li>
        <li data-state={sent ? "active" : "waiting"}>Backend retrieving evidence</li>
        <li data-state="waiting">Result received</li>
      </ol>
      <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
        The backend reports no percentage, and the board's movement does not show discoveries. Nothing is revealed until the
        complete result arrives.
      </p>
      <div className="button-row" style={{ marginTop: "0.6rem" }}>
        <button type="button" className="btn btn-quiet btn-small" onClick={onCancel}>
          Stop waiting
        </button>
      </div>
    </section>
  );
}
