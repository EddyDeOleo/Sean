/**
 * Kiro Repository Advisor and the implementation roadmap (Spec 4 sections 6 and 8.4 to 8.5).
 *
 * Recommendations are grouped by their status. An evidence reference is shown as the observation it points to, with that
 * observation's own classification, so the reader can see what the recommendation rests on. Capabilities that are not
 * recommended are shown, with the reason, because the decision not to recommend them is part of the analysis.
 */

import { useContext, useMemo } from "react";
import type { AdvisorResult, Observation, Recommendation } from "../../types/advisor";
import { ArtifactContext, ArtifactPanel, LifecycleBadge } from "./ArtifactPanel";
import { ClassificationBadge, PlainBadge, StatusBadge } from "./badges";

const SCOPE_LABEL: Record<string, string> = {
  REPOSITORY: "Repository file",
  USER: "Your user settings (not a repository file)",
  RUNTIME: "Depends on your tools (no file)",
};
const STRATEGY_LABEL: Record<string, string> = {
  GENERATE_FILE: "Sean can prepare a file for review",
  INSTRUCTIONS_ONLY: "Instructions only",
  NONE: "No configuration",
};

function Details({ rec, observations }: { rec: Recommendation; observations: Map<string, Observation> }) {
  const refs = rec.evidence_references.map((id) => observations.get(id)).filter((o): o is Observation => o !== undefined);
  return (
    <div className="sx-rec-body">
      <h4>Repository signal</h4>
      <p>{rec.repository_signal}</p>
      <h4>Why</h4>
      <p>{rec.reasoning}</p>
      <h4>Expected benefit</h4>
      <p>{rec.expected_benefit}</p>
      {refs.length > 0 ? (
        <>
          <h4>Supporting evidence</h4>
          <ul className="sx-list" data-testid="rec-evidence">
            {refs.map((o) => (
              <li key={o.observation_id}>
                {o.explanation} {o.path ? <span className="sx-mono">{o.path}</span> : null}{" "}
                <span className="sx-faint">({o.classification}, {o.source.replace("GIT_", "git ").toLowerCase()})</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <h4>Adoption</h4>
      <dl className="sx-kv">
        <dt>Where it lives</dt><dd>{SCOPE_LABEL[rec.adoption_scope] ?? rec.adoption_scope}</dd>
        <dt>How</dt><dd>{STRATEGY_LABEL[rec.configuration_strategy] ?? rec.configuration_strategy}</dd>
        <dt>Effort</dt><dd>{rec.implementation_effort}</dd>
        <dt>How to verify</dt><dd>{rec.verification_method}</dd>
      </dl>
      {rec.prerequisites.length > 0 ? (
        <>
          <h4>Prerequisites</h4>
          <ul className="sx-list">{rec.prerequisites.map((p) => <li key={p}>{p}</li>)}</ul>
        </>
      ) : null}
      {rec.risks.length > 0 ? (
        <>
          <h4>Risks</h4>
          <ul className="sx-list">{rec.risks.map((r) => <li key={r}>{r}</li>)}</ul>
        </>
      ) : null}
      <h4>Limitations</h4>
      <ul className="sx-list">{rec.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
      <ArtifactPanel rec={rec} />
    </div>
  );
}

function LifecycleBadgeFromContext({ capability }: { capability: string }) {
  const context = useContext(ArtifactContext);
  return context ? <LifecycleBadge records={context.records} capability={capability} /> : null;
}

function Card({ rec, observations, open }: { rec: Recommendation; observations: Map<string, Observation>; open?: boolean }) {
  return (
    <details className="sx-rec" id={`rec-${rec.capability}`} data-status={rec.recommendation_status} data-capability={rec.capability} open={open} data-testid="recommendation">
      <summary>
        <span className="sx-rec-title">{rec.title}</span>
        <StatusBadge value={rec.recommendation_status} />
        {rec.recommendation_status === "INSUFFICIENT_EVIDENCE" ? null : <ClassificationBadge value={rec.evidence_classification} />}
        <PlainBadge title="Confidence reflects evidence quality, not model certainty.">{`${rec.confidence} CONFIDENCE`}</PlainBadge>
        {rec.recommendation_status === "ADOPT_NOW" || rec.recommendation_status === "CONSIDER" ? <PlainBadge>{`PRIORITY ${rec.priority.slice(1)}`}</PlainBadge> : null}
        <LifecycleBadgeFromContext capability={rec.capability} />
        <p className="sx-rec-summary">{rec.summary}</p>
      </summary>
      <Details rec={rec} observations={observations} />
    </details>
  );
}

export function AdvisorSection({ analysis, note }: { analysis: { advisor: AdvisorResult; observations: Observation[] } | null; note: string | null }) {
  const observations = useMemo(() => new Map((analysis?.observations ?? []).map((o) => [o.observation_id, o])), [analysis]);
  return (
    <section className="sx-section" id="advisor" aria-labelledby="advisor-heading" data-testid="section-advisor">
      <h2 id="advisor-heading">Kiro Repository Advisor</h2>
      {analysis === null ? (
        <div className="sx-notice" data-tone="warn" role="note" data-testid="advisor-missing">
          <h3>No recommendations</h3>
          <p>{note ?? "The Advisor did not run."}</p>
        </div>
      ) : (
        <Advisor advisor={analysis.advisor} observations={observations} />
      )}
    </section>
  );
}

function Advisor({ advisor, observations }: { advisor: AdvisorResult; observations: Map<string, Observation> }) {
  const by = (status: Recommendation["recommendation_status"]) => advisor.recommendations.filter((r) => r.recommendation_status === status);
  const adopt = by("ADOPT_NOW");
  const consider = by("CONSIDER");
  const not = by("NOT_RECOMMENDED");
  const insufficient = by("INSUFFICIENT_EVIDENCE");
  const repository = insufficient.filter((r) => r.adoption_scope === "REPOSITORY");
  const environment = insufficient.filter((r) => r.adoption_scope !== "REPOSITORY");
  return (
    <>
      <p className="sx-muted" style={{ marginTop: 0, maxWidth: "70ch" }}>
        Each recommendation comes from something found in this repository. A capability appears as recommended only when the evidence supports it, and capabilities that do not apply are listed with the reason.
      </p>
      {adopt.length === 0 && consider.length === 0 ? (
        <div className="sx-notice" role="note" data-testid="no-actionable">
          <h3>Nothing to adopt right now</h3>
          <p>The repository does not show a need for a further Kiro capability that this analysis can support.</p>
        </div>
      ) : null}
      {adopt.length > 0 ? <Group title="Adopt now" items={adopt} observations={observations} open /> : null}
      {consider.length > 0 ? <Group title="Consider" items={consider} observations={observations} /> : null}
      {not.length > 0 ? <Group title="Considered and not recommended" items={not} observations={observations} /> : null}
      {repository.length > 0 ? <Group title="Not enough evidence" items={repository} observations={observations} /> : null}
      {environment.length > 0 ? <Group title="Depends on your tools, not on the repository" items={environment} observations={observations} /> : null}
    </>
  );
}

function Group({ title, items, observations, open }: { title: string; items: Recommendation[]; observations: Map<string, Observation>; open?: boolean }) {
  return (
    <div role="group" aria-label={title}>
      <h3 className="sx-band">{title} <span>({items.length})</span></h3>
      {items.map((rec) => <Card key={rec.capability} rec={rec} observations={observations} open={open && items.length <= 2} />)}
    </div>
  );
}

export function Roadmap({ advisor }: { advisor: AdvisorResult }) {
  const titles = new Map(advisor.recommendations.map((r) => [r.capability, r.title]));
  const column = (heading: string, capabilities: string[], empty: string, testId: string) => (
    <div className="sx-card" data-testid={testId}>
      <h3 className="sx-h3">{heading}</h3>
      {capabilities.length === 0 ? (
        <p className="sx-faint" style={{ margin: "0.3rem 0 0" }}>{empty}</p>
      ) : (
        <ol>
          {capabilities.map((c) => (
            <li key={c}><a href={`#rec-${c}`}>{titles.get(c) ?? c}</a></li>
          ))}
        </ol>
      )}
    </div>
  );
  return (
    <section className="sx-section" id="roadmap" aria-labelledby="roadmap-heading" data-testid="section-roadmap">
      <h2 id="roadmap-heading">Implementation roadmap</h2>
      <p className="sx-muted" style={{ maxWidth: "70ch" }}>
        Ordered by evidence strength, then effort. “Near term” items can be started from the repository alone. “Longer term” items need something outside it, or rest on weaker evidence.
      </p>
      <div className="sx-roadmap">
        {column("Immediate", advisor.roadmap.immediate, "Nothing is urgent.", "roadmap-immediate")}
        {column("Near term", advisor.roadmap.near_term, "Nothing queued.", "roadmap-near")}
        {column("Longer term", advisor.roadmap.longer_term, "Nothing queued.", "roadmap-long")}
      </div>
    </section>
  );
}
