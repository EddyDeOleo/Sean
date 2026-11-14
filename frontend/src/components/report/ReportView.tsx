/** The unified technical intelligence report (Spec 4 section 8). */

import { deriveFindings } from "../../features/report/findings";
import type { ReportSnapshot } from "../../features/report/reportSnapshot";
import { AdvisorSection, Roadmap } from "./AdvisorSection";
import { ArtifactContext, type ArtifactContextValue } from "./ArtifactPanel";
import { FindingsSection } from "./FindingsSection";
import { HistorySection } from "./HistorySection";
import { OverviewSection } from "./OverviewSection";
import { TransparencySection } from "./TransparencySection";
import { PlainBadge } from "./badges";

export interface ReportViewProps {
  snapshot: ReportSnapshot;
  origin: "fresh" | "saved";
  onNew(): void;
  artifacts: ArtifactContextValue;
}

export function ReportView({ snapshot, origin, onNew, artifacts }: ReportViewProps) {
  const findings = deriveFindings(snapshot);
  const analysis = snapshot.analysis;
  return (
    <article aria-labelledby="report-title" data-testid="report" data-origin={origin}>
      <header className="sx-report-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="sx-h1" id="report-title"><bdi>{snapshot.input.question}</bdi></h1>
          <p className="sx-meta">
            <span className="sx-mono" data-testid="report-repository">{snapshot.input.repository_id}</span>
            {snapshot.input.target_path ? <span className="sx-mono">{snapshot.input.target_path}{snapshot.input.symbol ? ` · ${snapshot.input.symbol}` : ""}</span> : <span>Repository review</span>}
            <PlainBadge tone={origin === "saved" ? "neutral" : "documented"}>{origin === "saved" ? "SAVED SNAPSHOT" : "FRESH ANALYSIS"}</PlainBadge>
            <span>{snapshot.createdAt}</span>
          </p>
        </div>
        <button type="button" className="sx-btn" onClick={onNew}>New investigation</button>

      </header>

      <nav className="sx-toc" aria-label="Report sections">
        <a href="#overview">Overview</a>
        <a href="#history">History</a>
        <a href="#findings">Findings</a>
        <a href="#advisor">Kiro Advisor</a>
        {analysis ? <a href="#roadmap">Roadmap</a> : null}
        <a href="#transparency">Transparency</a>
      </nav>

      <OverviewSection snapshot={snapshot} />
      <HistorySection snapshot={snapshot} />
      <FindingsSection findings={findings} />
      <ArtifactContext.Provider value={artifacts}>
        <AdvisorSection analysis={analysis ? { advisor: analysis.advisor, observations: analysis.profile.observations } : null} note={snapshot.analysisNote} />
      </ArtifactContext.Provider>
      {analysis ? <Roadmap advisor={analysis.advisor} /> : null}
      <TransparencySection snapshot={snapshot} origin={origin} />
    </article>
  );
}
