/** The AI engineering advisor: the direct answer, what it rests on, and what is not known (Spec 4 section 8). */
import type { AnswerRecord } from "../../types/advisor";
import { PlainBadge } from "./badges";

function reference(id: string, path: string, start: number, end: number): string {
  return `${id} · ${path}:${start}-${end}`;
}

export function AnswerSection({ answer, note }: { answer: AnswerRecord | null; note: string | null }) {
  const groq = answer !== null && answer.provider === "groq" && answer.answer !== null;
  return (
    <section className="sx-section" id="advisor-answer" aria-labelledby="advisor-answer-heading" data-testid="section-answer">
      <h2 id="advisor-answer-heading">AI Engineering Advisor</h2>
      {answer === null ? (
        <p className="sx-muted" data-testid="answer-missing">{note ?? "No answer was recorded for this report."}</p>
      ) : groq && answer.answer !== null ? (
        <div className="sx-card" data-testid="answer-groq">
          <p>
            <PlainBadge tone="documented">AI-generated answer</PlainBadge>{" "}
            <span className="sx-faint">from the evidence listed below. Confidence: {answer.answer.confidence}. Kind: {answer.answer.answer_type}.</span>
          </p>
          <p style={{ fontSize: "1.05rem" }} data-testid="answer-text">{answer.answer.answer}</p>
          <p className="sx-muted" data-testid="answer-summary">{answer.answer.summary}</p>
          <h3 className="sx-h3">Claims and their evidence</h3>
          <ul data-testid="answer-claims">
            {answer.answer.claims.map((claim, index) => (
              <li key={index} data-testid="answer-claim">
                <PlainBadge tone={claim.basis === "DOCUMENTED" ? "documented" : claim.basis === "INFERRED" ? "inferred" : "neutral"}>{claim.basis}</PlainBadge>{" "}
                {claim.text}{" "}
                <span className="sx-mono sx-faint">{claim.evidence_ids.length ? claim.evidence_ids.join(", ") : "no evidence cited"}</span>
              </li>
            ))}
          </ul>
          {answer.answer.recommendations.length ? (
            <>
              <h3 className="sx-h3">Recommendations</h3>
              <ul data-testid="answer-recommendations">{answer.answer.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </>
          ) : null}
          <h3 className="sx-h3">Limitations</h3>
          <ul data-testid="answer-limitations">{answer.answer.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </div>
      ) : (
        <div className="sx-card" data-testid="answer-local">
          <p>
            <PlainBadge tone="neutral">Local result</PlainBadge>{" "}
            <span className="sx-faint">No AI answer was produced for this report. The evidence Sean found locally is listed below.</span>
          </p>
          {answer.limitations.length ? (
            <ul data-testid="answer-limitations">{answer.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul>
          ) : null}
        </div>
      )}
      {answer !== null && answer.evidence.length ? (
        <div data-testid="answer-evidence">
          <h3 className="sx-h3">Evidence</h3>
          {answer.evidence.map((item) => (
            <details key={item.evidence_id} className="sx-card" data-evidence-id={item.evidence_id}>
              <summary className="sx-mono">{reference(item.evidence_id, item.path, item.start_line, item.end_line)}</summary>
              <p className="sx-faint">Why it was selected: {item.why}. Commit {item.commit}. {item.classification}.</p>
              <pre className="sx-mono" style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{item.excerpt}</pre>
            </details>
          ))}
        </div>
      ) : null}
    </section>
  );
}