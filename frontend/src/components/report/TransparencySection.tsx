/** Evidence and transparency (Spec 4 section 8.6): what each kind of statement in the report is, and how this one was made. */

import type { ReportSnapshot } from "../../features/report/reportSnapshot";
import { ClassificationBadge, PlainBadge } from "./badges";

const AI_STATUS_TEXT: Record<string, string> = {
  NOT_REQUESTED: "Not requested. Sean used its built-in reader.",
  NOT_NEEDED: "Offered, but not needed. Sean resolved the request itself.",
  NOT_RECORDED: "Not recorded for this report.",
  AI_USED: "Answered, and its answer was checked against the repository.",
  AI_NO_USABLE_ANSWER: "Answered, but nothing it said matched the repository. Sean used its built-in reader.",
  AI_TIMEOUT: "Did not answer in time. Sean used its built-in reader.",
  AI_HTTP_ERROR: "The provider refused the request. Sean used its built-in reader.",
  AI_CONNECTION_FAILED: "The provider could not be reached. Sean used its built-in reader.",
  AI_PROTOCOL_ERROR: "The provider answered incorrectly. Sean used its built-in reader.",
  AI_RESPONSE_TOO_LARGE: "The provider's answer was too large to use. Sean used its built-in reader.",
  AI_INVALID_REPLY: "The provider's answer had an unexpected form. Sean used its built-in reader.",
  AI_UNEXPECTED: "The AI reader failed unexpectedly. Sean used its built-in reader.",
};

export function TransparencySection({ snapshot, origin }: { snapshot: ReportSnapshot; origin: "fresh" | "saved" }) {
  const { input } = snapshot;
  return (
    <section className="sx-section" id="transparency" aria-labelledby="transparency-heading" data-testid="section-transparency">
      <h2 id="transparency-heading">Evidence and transparency</h2>
      <div className="sx-card">
        <h3 className="sx-h3">What the labels mean</h3>
        <dl className="sx-kv">
          <dt><ClassificationBadge value="DOCUMENTED" /></dt>
          <dd>Directly observed in the repository: a file exists, a dependency is declared, a record says so.</dd>
          <dt><ClassificationBadge value="INFERRED" /></dt>
          <dd>A reading of a pattern. It can be wrong. A commit shows that a change occurred, not why.</dd>
          <dt><ClassificationBadge value="PARTIAL_EVIDENCE" /></dt>
          <dd>The search was incomplete, so related items may be missing.</dd>
          <dt><ClassificationBadge value="INSUFFICIENT_EVIDENCE" /></dt>
          <dd>There is not enough to support a conclusion. Sean says so and does not guess.</dd>
        </dl>
        <p className="sx-faint" style={{ margin: "0.9rem 0 0" }}>
          Recommendations are advice that Sean derived from these observations. They are not repository facts. A generated configuration file is not installed, and nothing is installed or changed in your repository by this report.
        </p>
      </div>
      <div className="sx-card">
        <h3 className="sx-h3">How this report was made</h3>
        <dl className="sx-kv" data-testid="provenance">
          <dt>Snapshot</dt>
          <dd>
            <PlainBadge tone={origin === "saved" ? "neutral" : "documented"}>{origin === "saved" ? "SAVED SNAPSHOT" : "FRESH ANALYSIS"}</PlainBadge>{" "}
            <span className="sx-faint">Captured {snapshot.createdAt}. {origin === "saved" ? "Nothing was re-checked since then." : ""}</span>
          </dd>
          <dt>Request</dt>
          <dd><bdi>{input.text}</bdi></dd>
          <dt>Interpreted by</dt>
          <dd data-testid="interpreter">
            {input.interpreter === "gemini"
              ? "Gemini helped read the request. Text you type may be retained by the provider on the free tier. No repository content was sent. Every path was checked against the repository."
              : "Sean's built-in deterministic reader. No AI provider was used."}
          </dd>
          <dt>AI reader</dt>
          <dd data-testid="ai-status">{AI_STATUS_TEXT[input.ai_status ?? "NOT_RECORDED"]}</dd>
          <dt>Explanations and recommendations</dt>
          <dd>Deterministic. No AI provider writes the findings or the advice.</dd>
          <dt>Not analyzed</dt>
          <dd>Pull requests, issues and CI results. Uncommitted files.</dd>
        </dl>
      </div>
    </section>
  );
}
