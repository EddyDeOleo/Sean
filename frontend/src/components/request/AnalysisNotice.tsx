/** What went wrong, in plain words. A failure is never described as the absence of evidence. */

import type { AnalysisError } from "../../features/analysis/analysisMachine";

export function AnalysisNotice({ error, onDismiss }: { error: AnalysisError; onDismiss(): void }) {
  let title: string;
  let body: string;
  let tone: "danger" | "warn" = "danger";
  switch (error.kind) {
    case "UNRESOLVED":
      title = "Sean could not tell which repository you mean";
      body = error.message;
      tone = "warn";
      break;
    case "REQUEST_REJECTED":
      title = error.status === 404 ? "That repository is not registered" : error.status === 409 ? "The target is ambiguous" : "The request was not accepted";
      body = error.backend.message;
      tone = "warn";
      break;
    case "NETWORK":
      title = "The backend could not be reached";
      body = "Nothing was analyzed. This says nothing about the repository or its history. Check that the backend is running, then try again.";
      break;
    case "INVALID_RESPONSE":
      title = "The response could not be validated";
      body = "The backend answered, but not in the expected form, so nothing from it is shown.";
      break;
    case "NOTHING_AVAILABLE":
      title = "No result is available";
      body = [error.investigationNote, error.analysisNote].filter(Boolean).join(" ") || "Neither the investigation nor the repository analysis produced a result.";
      break;
  }
  return (
    <div className="sx-notice" data-tone={tone} role="alert" data-testid="analysis-error" data-kind={error.kind}>
      <h3>{title}</h3>
      <p>{body}</p>
      <p><button type="button" className="sx-btn sx-btn-small" onClick={onDismiss}>Dismiss</button></p>
    </div>
  );
}
