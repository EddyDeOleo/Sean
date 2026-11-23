/** Evidence and transparency (Spec 4 section 8.6): what each kind of statement in the report is, and how this one was made. */

import type { ReportSnapshot } from "../../features/report/reportSnapshot";
import { ClassificationBadge, PlainBadge } from "./badges";

const AI_STATUS_TEXT: Record<string, string> = {
  NOT_REQUESTED: "Not requested. Sean used its built-in reader.",
  NOT_NEEDED: "Offered, but not needed. Sean resolved the request itself.",
  NOT_RECORDED: "Not recorded for this report.",
  AI_USED: "Answered, and its answer was checked against the repository.",
  AI_NO_USABLE_ANSWER: "Answered, but nothing it said matched the repository. Sean used its built-in reader.",
  AI_NOT_SENT: "Not sent. The question could not be made safe to send, so Sean used its built-in reader.",
  AI_TIMEOUT: "Did not answer in time. Sean used its built-in reader.",
  AI_HTTP_ERROR: "The AI service refused the request. Sean used its built-in reader.",
  AI_CONNECTION_FAILED: "The AI service could not be reached. Sean used its built-in reader.",
  AI_PROTOCOL_ERROR: "The AI service answered incorrectly. Sean used its built-in reader.",
  AI_RESPONSE_TOO_LARGE: "The AI service's answer was too large to use. Sean used its built-in reader.",
  AI_INVALID_REPLY: "The AI service's answer had an unexpected form. Sean used its built-in reader.",
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
            {input.interpreter === "groq"
              ? "An AI model helped read the request. For this step only the request text was sent. The AI service may keep that text for up to 30 days for reliability and abuse checks, unless zero data retention is turned on. Every path was checked against the repository."
              : "Sean's built-in deterministic reader decided this request. The AI reader status is shown below."}
          </dd>
          <dt>AI reader</dt>
          <dd data-testid="ai-status">{snapshot.answer ? AI_STATUS_TEXT[snapshot.answer.ai_status] : (snapshot.answerNote ?? AI_STATUS_TEXT["NOT_RECORDED"])}</dd>
          <dt>AI-assisted answers</dt>
          <dd data-testid="provider-disclosure">
            When an AI service is configured, Sean answers questions with it. Sean retrieves evidence on this machine first. The AI service receives the question, with registered identifiers and folder paths removed, and only the selected evidence excerpts, never the whole repository. Secrets are redacted before anything is sent. The AI service may keep inference data for up to 30 days for abuse and reliability checks, unless the account has zero data retention turned on.
          </dd>
          <dt>Explanations and recommendations</dt>
          <dd>Deterministic. No AI service writes the findings or the advice.</dd>
          <dt>Not analyzed</dt>
          <dd>Pull requests, issues and CI results. Uncommitted files.</dd>
        </dl>
      </div>
    </section>
  );
}
