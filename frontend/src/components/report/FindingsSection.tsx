/** Technical findings (Spec 4 section 8.3). Each finding states its classification, its supporting items and its limits. */

import type { Finding } from "../../features/report/findings";
import { ClassificationBadge } from "./badges";

export function FindingsSection({ findings }: { findings: Finding[] }) {
  return (
    <section className="sx-section" id="findings" aria-labelledby="findings-heading" data-testid="section-findings">
      <h2 id="findings-heading">Technical findings</h2>
      {findings.length === 0 ? (
        <p className="sx-muted">No findings could be derived from the results that are available.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {findings.map((finding) => (
            <li key={finding.id} className="sx-card" data-testid="finding" data-classification={finding.classification}>
              <div className="sx-meta" style={{ margin: "0 0 0.35rem" }}>
                <ClassificationBadge value={finding.classification} />
              </div>
              <h3 className="sx-h3"><bdi>{finding.title}</bdi></h3>
              <p style={{ margin: "0.2rem 0 0.6rem" }}>{finding.explanation}</p>
              {finding.evidence.length > 0 ? (
                <>
                  <p className="sx-faint" style={{ margin: 0, fontSize: "0.84rem" }}>Supporting items</p>
                  <ul className="sx-list">
                    {finding.evidence.map((item, index) => (
                      <li key={`${item.label}-${index}`}>
                        <bdi>{item.label}</bdi>
                        {item.detail ? <span className="sx-faint"> · {item.detail}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p className="sx-faint" style={{ margin: "0.5rem 0 0", fontSize: "0.86rem" }}>
                Limits: {finding.limitations.join(" ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
