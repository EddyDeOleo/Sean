/** Repository overview (Spec 4 section 8.1): what was read, what was found at a glance, and what could not be read. */

import type { ReportSnapshot } from "../../features/report/reportSnapshot";
import { PlainBadge } from "./badges";

export function OverviewSection({ snapshot }: { snapshot: ReportSnapshot }) {
  const analysis = snapshot.analysis;
  return (
    <section className="sx-section" id="overview" aria-labelledby="overview-heading" data-testid="section-overview">
      <h2 id="overview-heading">Repository overview</h2>
      {analysis === null ? (
        <div className="sx-notice" data-tone="warn" role="note" data-testid="analysis-missing">
          <h3>The repository analysis is not available</h3>
          <p>{snapshot.analysisNote ?? "The repository analysis was not run."}</p>
          <p className="sx-faint">The investigation below is not affected.</p>
        </div>
      ) : (
        <Overview analysis={analysis} />
      )}
    </section>
  );
}

function Overview({ analysis }: { analysis: NonNullable<ReportSnapshot["analysis"]> }) {
  const { profile } = analysis;
  const { summary } = profile;
  const totalFiles = summary.languages.reduce((sum, l) => sum + l.files, 0);
  const frameworks = profile.observations.filter((o) => o.kind === "FRAMEWORK");
  const tooling = profile.observations.filter((o) => o.kind === "TOOLING");
  const kiro = profile.observations.filter((o) => o.kind === "KIRO_CONFIG");
  const ci = profile.observations.filter((o) => o.kind === "CI_CONFIG");

  return (
    <>
      <div className="sx-stats">
        <Stat value={summary.source_files} label="source files" />
        <Stat value={summary.test_files} label="test files" />
        <Stat value={summary.areas.length} label="areas" />
        <Stat value={summary.history.commits_scanned} label={profile.history_limited ? "latest commits read" : "commits read"} />
      </div>

      <div className="sx-card">
        <dl className="sx-kv">
          <dt>Repository</dt>
          <dd className="sx-mono" data-testid="overview-repository">{profile.repository_id}</dd>
          <dt>Analyzed commit</dt>
          <dd className="sx-mono" title={profile.head}>{profile.head.slice(0, 12)}</dd>
          <dt>Analysis scope</dt>
          <dd>
            The committed tree and commit history at that commit ({summary.tree_entries} tree entries).
            {profile.truncated ? <> <PlainBadge tone="partial">TRUNCATED</PlainBadge></> : null}
            {profile.shallow ? <> <PlainBadge tone="partial">SHALLOW CLONE</PlainBadge></> : null}
          </dd>
          {summary.languages.length > 0 ? (
            <>
              <dt>Languages</dt>
              <dd>
                <ul className="sx-bars" aria-label="Source files by language">
                  {summary.languages.slice(0, 6).map((l) => (
                    <li className="sx-bar-row" key={l.language}>
                      <span>{l.language}</span>
                      <span className="sx-bar-track" aria-hidden="true">
                        <span className="sx-bar-fill" style={{ width: `${Math.max(2, Math.round((l.files / totalFiles) * 100))}%` }} />
                      </span>
                      <span className="sx-faint">{l.files}</span>
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {summary.areas.length > 0 ? (
            <>
              <dt>Areas</dt>
              <dd>
                <ul className="sx-pills">
                  {summary.areas.slice(0, 10).map((a) => (
                    <li className="sx-pill" key={a.name}>
                      <bdi>{a.name}</bdi> <span className="sx-faint">{a.source_files}/{a.test_files}</span>
                    </li>
                  ))}
                </ul>
                <p className="sx-faint" style={{ margin: "0.3rem 0 0" }}>Source files / test files per area.</p>
              </dd>
            </>
          ) : null}
          {frameworks.length > 0 ? (
            <>
              <dt>Frameworks (declared)</dt>
              <dd>
                <ul className="sx-pills">
                  {frameworks.map((o) => (
                    <li className="sx-pill" key={o.observation_id} title={o.explanation}>{o.value}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {tooling.length > 0 ? (
            <>
              <dt>Tooling (declared)</dt>
              <dd>
                <ul className="sx-pills">
                  {tooling.map((o) => (
                    <li className="sx-pill" key={o.observation_id} title={o.explanation}>{o.value}</li>
                  ))}
                </ul>
              </dd>
            </>
          ) : null}
          {ci.length > 0 ? (
            <>
              <dt>Continuous integration</dt>
              <dd>{ci.map((o) => o.path).join(", ")}</dd>
            </>
          ) : null}
          <dt>Kiro configuration</dt>
          <dd>
            {kiro.length === 0 ? (
              "None found in the committed tree."
            ) : (
              <ul className="sx-pills">
                {kiro.map((o) => (
                  <li className="sx-pill" key={o.observation_id} title={o.explanation}>
                    {o.value} <span className="sx-faint">{o.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </dd>
          <dt>Data not available</dt>
          <dd>
            <ul className="sx-list" style={{ marginTop: 0 }} data-testid="profile-limitations">
              {profile.limitations.map((l) => (
                <li key={l.code}>{l.message}</li>
              ))}
            </ul>
          </dd>
        </dl>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="sx-stat">
      <div className="sx-stat-value">{value}</div>
      <div className="sx-stat-label">{label}</div>
    </div>
  );
}
