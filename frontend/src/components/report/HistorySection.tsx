/**
 * Engineering history (Spec 4 section 8.2): the investigation result for the requested target, with the evidence behind it.
 *
 * Two label families are kept apart and explained: the classification (what the evidence as a whole supports, set by the
 * backend) and the relationship of each record to the target (VERIFIED or INFERRED). All text from the repository is
 * rendered as text, in an isolated bidirectional context, and a link is shown only for an https address.
 */

import { useMemo, useState } from "react";
import type { EvidenceItem } from "../../types/contract";
import type { ReportSnapshot } from "../../features/report/reportSnapshot";
import { deriveUiState } from "../../features/investigation/validateResponse";
import {
  NOT_AVAILABLE,
  RELATIONSHIP_LABEL,
  SOURCE_TYPE_LABEL,
  VERIFICATION_LABEL,
  chronological,
  formatLineRange,
  formatTimestamp,
  safeHttpsUrl,
  shortHash,
} from "../evidence/format";
import { ClassificationBadge, PlainBadge, RetrievalBadge } from "./badges";

function Untrusted({ children }: { children: string }) {
  return <bdi>{children}</bdi>;
}

function group(items: EvidenceItem[], basis: "VERIFIED" | "INFERRED" | "NONE"): EvidenceItem[] {
  return items.filter((item) => (item.relationship ? item.relationship.basis === basis : basis === "NONE"));
}

export function HistorySection({ snapshot }: { snapshot: ReportSnapshot }) {
  const result = snapshot.investigation;
  return (
    <section className="sx-section" id="history" aria-labelledby="history-heading" data-testid="section-history">
      <h2 id="history-heading">Engineering history</h2>
      {result === null ? (
        <div className="sx-notice" data-tone={snapshot.input.mode === "ADVISE" ? undefined : "warn"} role="note" data-testid="history-missing">
          <h3>{snapshot.input.mode === "ADVISE" ? "No file history was requested" : "The investigation is not available"}</h3>
          <p>
            {snapshot.input.mode === "ADVISE"
              ? "This request asked for a repository-level review, so no single file was investigated."
              : snapshot.investigationNote ?? "The investigation did not produce a result."}
          </p>
        </div>
      ) : (
        <History snapshot={snapshot} />
      )}
    </section>
  );
}

function History({ snapshot }: { snapshot: ReportSnapshot }) {
  const result = snapshot.investigation!;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ui = deriveUiState(result);
  const selected = useMemo(() => result.evidence.find((e) => e.evidence_id === selectedId) ?? null, [result, selectedId]);
  const ordered = useMemo(() => chronological(result.evidence), [result]);

  function list(items: EvidenceItem[], label: string, note: string) {
    if (items.length === 0) return null;
    return (
      <div style={{ marginTop: "1.1rem" }} role="group" aria-label={label}>
        <h3 className="sx-h3">
          {label} <span className="sx-faint">({items.length})</span>
        </h3>
        <p className="sx-faint" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>{note}</p>
        <ul className="sx-evidence">
          {items.map((item) => {
            const headline = item.title && item.title.trim() !== "" ? item.title : item.file_path ?? `${SOURCE_TYPE_LABEL[item.source_type]} ${item.source_id}`;
            return (
              <li key={item.evidence_id} className="sx-evidence-item" data-evidence-id={item.evidence_id}>
                <button type="button" aria-pressed={selectedId === item.evidence_id} aria-label={`Inspect evidence: ${headline}`} onClick={() => setSelectedId(selectedId === item.evidence_id ? null : item.evidence_id)}>
                  <span className="sx-meta" style={{ margin: 0 }}>
                    <PlainBadge>{SOURCE_TYPE_LABEL[item.source_type]}</PlainBadge>
                    {item.relationship ? (
                      <PlainBadge tone={item.relationship.basis === "VERIFIED" ? "documented" : "inferred"}>
                        {item.relationship.basis === "VERIFIED" ? "VERIFIED RELATION" : "INFERRED RELATION"}
                      </PlainBadge>
                    ) : null}
                  </span>
                  <p className="sx-evidence-title"><Untrusted>{headline}</Untrusted></p>
                  <span className="sx-meta" style={{ margin: 0 }}>
                    <span className="sx-mono">{shortHash(item.commit_hash)}</span>
                    <span>{formatTimestamp(item.timestamp)}</span>
                    {item.file_path ? <span className="sx-mono">{item.file_path}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div data-testid="history" data-ui-state={ui}>
      <div className="sx-card">
        <dl className="sx-kv">
          <dt>Question</dt>
          <dd><Untrusted>{snapshot.input.question}</Untrusted></dd>
          <dt>Target</dt>
          <dd className="sx-mono">
            {result.target.path}
            {result.target.symbol ? ` · ${result.target.symbol}` : ""}
            {result.target.line_range ? ` · lines ${result.target.line_range[0]}–${result.target.line_range[1]}` : ""}
          </dd>
          <dt>Target resolution</dt>
          <dd className="sx-mono">{result.target.resolution}</dd>
          <dt>Retrieval status</dt>
          <dd><RetrievalBadge value={result.retrieval_status} testId="report-status" /></dd>
          <dt>Classification</dt>
          <dd><ClassificationBadge value={result.epistemic_classification} testId="report-classification" /></dd>
          <dt>Investigation</dt>
          <dd className="sx-mono">{result.investigation_id}</dd>
        </dl>
      </div>

      <h3 className="sx-h3" style={{ marginTop: "1.1rem" }}>Conclusion</h3>
      <p data-testid="report-conclusion" style={{ margin: "0.2rem 0 0.8rem" }}>
        {ui === "INSUFFICIENT_EVIDENCE"
          ? "No conclusion. The available evidence does not support a reliable historical conclusion."
          : result.conclusion ?? NOT_AVAILABLE}
      </p>
      <h3 className="sx-h3">Explanation</h3>
      <p className="sx-muted" data-testid="report-explanation" style={{ margin: "0.2rem 0 0.8rem" }}>{result.explanation ?? NOT_AVAILABLE}</p>

      <h3 className="sx-h3">Limitations <span className="sx-faint">({result.limitations.length})</span></h3>
      {result.limitations.length === 0 ? (
        <p className="sx-faint">The backend reported no limitations for this result.</p>
      ) : (
        <ul className="sx-list" data-testid="limitations">
          {result.limitations.map((limitation, index) => (
            <li key={`${limitation.code}-${index}`}>
              <span className="sx-mono">{limitation.code}</span> <span className="sx-faint">({limitation.scope})</span> {limitation.message}
            </li>
          ))}
        </ul>
      )}

      <p className="sx-faint" style={{ fontSize: "0.88rem", margin: "1rem 0 0" }} data-testid="label-note">
        The classification says what the evidence as a whole supports. The labels on each record describe how that single record relates to the target. They are different things: a verified relation is not a documented explanation. A commit shows that a change occurred, not why.
      </p>

      {list(group(result.evidence, "VERIFIED"), "Verified relations", "Relationships Sean checked against the repository or a validated record.")}
      {list(group(result.evidence, "INFERRED"), "Inferred relations", "Interpretations. They do not establish intent or cause.")}
      {list(group(result.evidence, "NONE"), "Records without a stated relation", "These records carry no relationship to the target.")}
      {result.evidence.length === 0 ? <p className="sx-faint">The result contains no evidence records.</p> : null}

      {selected ? <EvidenceDetail item={selected} /> : null}

      {ordered.length > 0 ? (
        <div style={{ marginTop: "1.2rem" }}>
          <h3 className="sx-h3">Chronology</h3>
          <p className="sx-faint" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
            Records in the order of their returned dates. The order shows when things were recorded, not that one caused another.
          </p>
          <ol className="sx-timeline" data-testid="timeline">
            {ordered.map((item) => (
              <li key={item.evidence_id}>
                <span className="sx-mono">{formatTimestamp(item.timestamp)}</span> · {SOURCE_TYPE_LABEL[item.source_type]}
                {item.commit_hash ? <span className="sx-mono"> · {item.commit_hash.slice(0, 8)}</span> : null}
                <br />
                <Untrusted>{item.title ?? item.file_path ?? item.source_id}</Untrusted>{" "}
                <span className="sx-faint">({item.relationship ? (item.relationship.basis === "VERIFIED" ? "verified" : "inferred") : "no stated relation"})</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {result.source_references.length > 0 ? (
        <div style={{ marginTop: "1.2rem" }}>
          <h3 className="sx-h3">Source references <span className="sx-faint">({result.source_references.length})</span></h3>
          <ul className="sx-list" data-testid="source-references">
            {result.source_references.map((reference) => {
              const url = safeHttpsUrl(reference.source_url);
              return (
                <li key={reference.evidence_id}>
                  <span className="sx-mono">{reference.source_type}</span> · <span className="sx-mono">{reference.source_id}</span>
                  {url ? (
                    <>
                      {" "}
                      <a href={url} target="_blank" rel="noopener noreferrer">open source</a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceDetail({ item }: { item: EvidenceItem }) {
  const url = safeHttpsUrl(item.source_url);
  return (
    <section className="sx-card" style={{ marginTop: "1rem" }} aria-label="Selected evidence detail" data-testid="evidence-detail">
      <h3 className="sx-h3">
        <Untrusted>{item.title && item.title.trim() !== "" ? item.title : `${SOURCE_TYPE_LABEL[item.source_type]} ${item.source_id}`}</Untrusted>
      </h3>
      <dl className="sx-kv">
        <dt>Source type</dt><dd>{SOURCE_TYPE_LABEL[item.source_type]}</dd>
        <dt>Identifier</dt><dd className="sx-mono">{item.source_id}</dd>
        <dt>Commit</dt><dd className="sx-mono">{item.commit_hash ?? NOT_AVAILABLE}</dd>
        <dt>File</dt><dd className="sx-mono">{item.file_path ?? NOT_AVAILABLE}</dd>
        <dt>Lines</dt><dd>{formatLineRange(item.line_range)}</dd>
        <dt>Date</dt><dd>{formatTimestamp(item.timestamp)}</dd>
        <dt>Author (as returned)</dt><dd>{item.author ? <Untrusted>{item.author}</Untrusted> : NOT_AVAILABLE}</dd>
        <dt>Relationship to the target</dt>
        <dd>
          {item.relationship
            ? `${RELATIONSHIP_LABEL[item.relationship.kind] ?? item.relationship.kind} (${item.relationship.basis === "VERIFIED" ? "verified by Sean" : "inferred"})`
            : NOT_AVAILABLE}
        </dd>
        <dt>Retrieved by</dt><dd className="sx-mono">{item.retrieval_method}</dd>
        <dt>Retrieved at</dt><dd>{item.integrity.retrieved_at}</dd>
        <dt>Source verification</dt><dd>{VERIFICATION_LABEL[item.integrity.source_verification]}</dd>
        <dt>Source link</dt>
        <dd>
          {url ? <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> : item.source_url ? <span className="sx-mono">{item.source_url}</span> : NOT_AVAILABLE}
        </dd>
      </dl>
      {item.excerpt ? <pre className="sx-excerpt">{item.excerpt}</pre> : null}
      {item.limitations.length > 0 ? <p className="sx-faint">Item limitations: <span className="sx-mono">{item.limitations.join(", ")}</span></p> : null}
      {item.unavailable_fields.length > 0 ? <p className="sx-faint">Not available from this source: <span className="sx-mono">{item.unavailable_fields.join(", ")}</span></p> : null}
      {item.verified_absent_fields.length > 0 ? <p className="sx-faint">Verified absent at the source: <span className="sx-mono">{item.verified_absent_fields.join(", ")}</span></p> : null}
    </section>
  );
}
