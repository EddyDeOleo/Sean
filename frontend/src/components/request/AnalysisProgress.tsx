/** Progress of a running analysis, in text, with a way to stop waiting. Stopping is not a finding. */

import type { AnalysisState } from "../../features/analysis/analysisMachine";

type StepState = "waiting" | "running" | "done" | "failed" | "skipped";

function step(status: "IDLE" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED"): StepState {
  switch (status) {
    case "RUNNING": return "running";
    case "DONE": return "done";
    case "FAILED": return "failed";
    case "SKIPPED": return "skipped";
    default: return "waiting";
  }
}

const WORDS: Record<StepState, string> = { waiting: "Waiting", running: "In progress", done: "Done", failed: "Did not complete", skipped: "Not requested" };

export function AnalysisProgress({ state, onCancel }: { state: AnalysisState; onCancel(): void }) {
  const interpreting = state.phase === "INTERPRETING";
  const rows: { label: string; state: StepState }[] = [
    { label: "Reading your request", state: interpreting ? "running" : "done" },
    { label: "Retrieving the file's history", state: interpreting ? "waiting" : step(state.investigation.status) },
    { label: "Analyzing the repository for Kiro opportunities", state: interpreting ? "waiting" : step(state.profile.status) },
  ];
  return (
    <div className="sx-page" data-testid="progress">
      <h1 className="sx-h1">Investigating</h1>
      <p className="sx-lede"><bdi>{state.text}</bdi></p>
      <ol className="sx-steps" aria-label="Analysis steps">
        {rows.map((row) => (
          <li key={row.label} className="sx-step" data-state={row.state}>
            <span className="sx-step-dot" aria-hidden="true" />
            <span>{row.label}</span>
            <span className="sx-spacer" />
            <span className="sx-faint">{WORDS[row.state]}</span>
          </li>
        ))}
      </ol>
      <div role="status" aria-live="polite" className="sx-faint" data-testid="progress-status">
        {interpreting ? "Reading your request." : "Reading the committed repository. This can take a few seconds."}
      </div>
      <p>
        <button type="button" className="sx-btn sx-btn-quiet" onClick={onCancel}>Stop waiting</button>
      </p>
      <p className="sx-faint" style={{ maxWidth: "60ch" }}>
        Stopping only ends the wait here. It does not mean that no evidence exists.
      </p>
    </div>
  );
}
