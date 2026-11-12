/**
 * Left zone: Evidence & History (Spec 2 section 4.2, Spec 3 section 9).
 *
 * Visible from the first render with reserved dimensions. Before a result it shows an honest empty state. Once the board has
 * settled on a result it shows the technical report: the question, the backend explanation, limitations, and the evidence
 * grouped by relationship basis, with a chronological view. It stays fully usable when every cinematic feature is off.
 *
 * Two label families are kept apart and the report says so: the classification (what the evidence supports, set by the
 * backend) and the relationship basis of each item (VERIFIED or INFERRED, how that item relates to the target).
 */

import { useMemo, useState } from "react";
import type { EvidenceItem, InvestigationResult } from "../../types/contract";
import { deriveUiState } from "../../features/investigation/validateResponse";
import { EvidenceCard, EvidenceDetail } from "./EvidenceCard";
import { NOT_AVAILABLE, SOURCE_TYPE_LABEL, chronological, formatTimestamp, safeHttpsUrl } from "./format";

export interface EvidencePanelProps {
  result: InvestigationResult | null;
  question: string;
  /** Show the evidence now. False while the board has not yet settled. */
  revealed: boolean;
  restored: boolean;
  collected: string[];
  /** The panel is empty because of an error or cancellation, not because nothing was found. */
  emptyReason: "none" | "error" | "cancelled" | "investigating";
}

function group(items: EvidenceItem[], basis: "VERIFIED" | "INFERRED" | "NONE"): EvidenceItem[] {
  return items.filter((item) => (item.relationship ? item.relationship.basis === basis : basis === "NONE"));
}

export function EvidencePanel({ result, question, revealed, restored, collected, emptyReason }: EvidencePanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = result?.evidence ?? [];
  const selected = useMemo(() => items.find((item) => item.evidence_id === selectedId) ?? null, [items, selectedId]);
  const ordered = useMemo(() => chronological(items), [items]);

  return (
    <section className="zone zone-evidence" aria-label="Evidence and history" data-zone="evidence">
      <h2 className="zone-heading">Evidence &amp; History</h2>

      {result === null || !revealed ? (
        <div data-testid="evidence-empty">
          {emptyReason === "investigating" ? (
            <p className="muted">Evidence appears here once the result has arrived and the board has settled.</p>
          ) : emptyReason === "error" ? (
            <p className="muted">No evidence is shown, because the request did not produce a valid result. This does not mean that no evidence exists.</p>
          ) : emptyReason === "cancelled" ? (
            <p className="muted">The investigation was cancelled. Nothing was concluded, and nothing is shown.</p>
          ) : (
            <p className="muted">The source records behind each answer appear here: commits, blame, documentation, and the limitations of the search.</p>
          )}
        </div>
      ) : (
        <ReportBody
          result={result}
          question={question}
          restored={restored}
          selected={selected}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          ordered={ordered}
          collected={collected}
        />
      )}
    </section>
  );
}

function ReportBody(props: {
  result: InvestigationResult;
  question: string;
  restored: boolean;
  selected: EvidenceItem | null;
  selectedId: string | null;
  setSelectedId(id: string | null): void;
  ordered: EvidenceItem[];
  collected: string[];
}) {
  const { result, question, restored, selected, selectedId, setSelectedId, ordered, collected } = props;
  const ui = deriveUiState(result);
  const verified = group(result.evidence, "VERIFIED");
  const inferred = group(result.evidence, "INFERRED");
  const unlabelled = group(result.evidence, "NONE");

  function list(items: EvidenceItem[], label: string, note: string) {
    if (items.length === 0) return null;
    return (
      <section aria-label={label} style={{ marginTop: "0.9rem" }}>
        <h3 style={{ margin: "0 0 0.15rem", fontSize: "1rem" }}>
          {label} <span className="muted">({items.length})</span>
        </h3>
        <p className="muted" style={{ margin: "0 0 0.4rem", fontSize: "0.86rem" }}>
          {note}
        </p>
        <ul className="evidence-list stagger">
          {items.map((item, index) => (
            <EvidenceCard
              key={item.evidence_id}
              item={item}
              index={index}
              selected={selectedId === item.evidence_id}
              collected={collected.includes(item.evidence_id)}
              onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
            />
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div data-testid="report" data-ui-state={ui}>
      {restored ? (
        <p className="notice" role="note" data-testid="restored-note">
          Restored from this browser session. This is the result of an earlier investigation in this tab. Nothing was
          re-checked.
        </p>
      ) : null}

      <dl className="kv" aria-label="Investigation summary">
        <dt>Question</dt>
        <dd>
          <bdi>{question}</bdi>
        </dd>
        <dt>Repository</dt>
        <dd className="mono">{result.repository.repository_id}</dd>
        <dt>Target</dt>
        <dd className="mono">
          {result.target.path}
          {result.target.symbol ? ` · ${result.target.symbol}` : ""}
          {result.target.line_range ? ` · lines ${result.target.line_range[0]}–${result.target.line_range[1]}` : ""}
        </dd>
        <dt>Target resolution</dt>
        <dd className="mono">{result.target.resolution}</dd>
        <dt>Retrieval status</dt>
        <dd className="mono" data-testid="report-status">
          {result.retrieval_status}
        </dd>
        <dt>Classification</dt>
        <dd className="mono" data-testid="report-classification">
          {result.epistemic_classification ?? "NOT CLASSIFIED"}
        </dd>
        <dt>Investigation</dt>
        <dd className="mono">{result.investigation_id}</dd>
      </dl>

      <section aria-label="Conclusion and explanation" style={{ marginTop: "0.6rem" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>Conclusion</h3>
        {ui === "INSUFFICIENT_EVIDENCE" ? (
          <p className="prose" data-testid="report-conclusion">
            No conclusion. The available evidence does not support a reliable historical conclusion.
          </p>
        ) : (
          <p className="prose" data-testid="report-conclusion">
            {result.conclusion ?? NOT_AVAILABLE}
          </p>
        )}
        <h3 style={{ margin: "0.7rem 0 0.25rem", fontSize: "1rem" }}>Explanation</h3>
        <p className="prose muted" data-testid="report-explanation">
          {result.explanation ?? NOT_AVAILABLE}
        </p>
      </section>

      <section aria-label="Limitations" style={{ marginTop: "0.9rem" }}>
        <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
          Limitations <span className="muted">({result.limitations.length})</span>
        </h3>
        {result.limitations.length === 0 ? (
          <p className="muted">The backend reported no limitations for this result.</p>
        ) : (
          <ul className="fragment-log" data-testid="limitations">
            {result.limitations.map((limitation, index) => (
              <li key={`${limitation.code}-${index}`}>
                <span className="mono">{limitation.code}</span> <span className="muted">({limitation.scope})</span>
                <br />
                {limitation.message}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted" style={{ fontSize: "0.86rem", marginTop: "0.9rem" }} data-testid="label-note">
        The classification above says what the evidence as a whole supports. The labels below describe how each single record
        relates to the target. They are different things: a verified relation is not a documented explanation.
      </p>

      {list(verified, "Verified relations", "Relationships Sean checked against the repository or a validated record.")}
      {list(inferred, "Inferred relations", "Relationships that are interpretations. They do not establish intent or cause.")}
      {list(unlabelled, "Records without a stated relation", "These records carry no relationship to the target.")}

      {result.evidence.length === 0 ? <p className="muted">The result contains no evidence records.</p> : null}

      {selected ? <EvidenceDetail item={selected} /> : null}

      {ordered.length > 0 ? (
        <section aria-label="Chronology" style={{ marginTop: "0.9rem" }}>
          <h3 style={{ margin: "0 0 0.15rem", fontSize: "1rem" }}>Chronology</h3>
          <p className="muted" style={{ margin: "0 0 0.4rem", fontSize: "0.86rem" }}>
            Records in the order of their returned dates. The order shows when things were recorded. It does not show that one
            caused another.
          </p>
          <ol className="timeline" data-testid="timeline">
            {ordered.map((item) => (
              <li key={item.evidence_id} data-basis={item.relationship?.basis ?? "NONE"}>
                <span className="mono">{formatTimestamp(item.timestamp)}</span> · {SOURCE_TYPE_LABEL[item.source_type]}
                {item.commit_hash ? <span className="mono"> · {item.commit_hash.slice(0, 8)}</span> : null}
                <br />
                <bdi>{item.title ?? item.file_path ?? item.source_id}</bdi>{" "}
                <span className="muted">({item.relationship ? (item.relationship.basis === "VERIFIED" ? "verified" : "inferred") : "no stated relation"})</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {result.source_references.length > 0 ? (
        <section aria-label="Source references" style={{ marginTop: "0.9rem" }}>
          <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
            Source references <span className="muted">({result.source_references.length})</span>
          </h3>
          <ul className="fragment-log" data-testid="source-references">
            {result.source_references.map((reference) => {
              const url = safeHttpsUrl(reference.source_url);
              return (
                <li key={reference.evidence_id}>
                  <span className="mono">{reference.source_type}</span> · <span className="mono">{reference.source_id}</span>
                  {url ? (
                    <>
                      {" "}
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        open source
                      </a>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
