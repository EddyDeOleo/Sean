/**
 * Status strip (Spec 2 section 8.5, requirement 5).
 *
 * Shows the original backend retrieval status and the original classification as two separate labelled values, plus the
 * presentation state the frontend derived from them. The derived value is labelled as derived and never replaces either
 * backend value.
 */

import { deriveUiState } from "../../features/investigation/validateResponse";
import type { InvestigationResult, UiState } from "../../types/contract";

const UI_LABEL: Record<UiState, string> = {
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence",
  FAILED: "Failed",
};

function statusTone(status: string): string {
  if (status === "COMPLETE") return "badge-ok";
  if (status === "PARTIAL" || status === "INSUFFICIENT") return "badge-warn";
  return "badge-danger";
}

function classificationTone(classification: string | null): string {
  if (classification === "DOCUMENTED") return "badge-ok";
  if (classification === "INFERRED" || classification === "PARTIAL_EVIDENCE") return "badge-warn";
  if (classification === "INSUFFICIENT_EVIDENCE") return "badge-neutral";
  return "badge-neutral";
}

export function StatusStrip({ result }: { result: InvestigationResult }) {
  const ui = deriveUiState(result);
  return (
    <dl className="status-strip" aria-label="Investigation status">
      <div>
        <dt>Retrieval status</dt>
        <dd>
          <span className={`badge ${statusTone(result.retrieval_status)}`} data-testid="retrieval-status">
            {result.retrieval_status}
          </span>
        </dd>
      </div>
      <div>
        <dt>Classification</dt>
        <dd>
          <span className={`badge ${classificationTone(result.epistemic_classification)}`} data-testid="classification">
            {result.epistemic_classification ?? "NOT CLASSIFIED"}
          </span>
        </dd>
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <dt>Shown as (derived by the interface)</dt>
        <dd>
          <span data-testid="ui-state">{UI_LABEL[ui]}</span>
        </dd>
      </div>
    </dl>
  );
}
