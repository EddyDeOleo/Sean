/**
 * One evidence item (Spec 2 section 9, Spec 3 section 9).
 *
 * The summary line shows fields of the item itself. A missing field shows "Not available" and is never filled in. Selecting
 * the card shows its full detail inside the left zone, with no new zone.
 */

import type { EvidenceItem } from "../../types/contract";
import {
  NOT_AVAILABLE,
  RELATIONSHIP_LABEL,
  SOURCE_TYPE_LABEL,
  VERIFICATION_LABEL,
  formatLineRange,
  formatTimestamp,
  safeHttpsUrl,
  shortHash,
} from "./format";

/** Isolate untrusted text for bidirectional rendering, so a hostile string cannot reorder the surrounding layout. */
function Untrusted({ children }: { children: string }) {
  return <bdi>{children}</bdi>;
}

export interface EvidenceCardProps {
  item: EvidenceItem;
  selected: boolean;
  collected?: boolean;
  onSelect(evidenceId: string): void;
  index?: number;
}

export function EvidenceCard({ item, selected, collected = false, onSelect, index = 0 }: EvidenceCardProps) {
  const headline = item.title && item.title.trim() !== "" ? item.title : item.file_path ?? `${SOURCE_TYPE_LABEL[item.source_type]} ${item.source_id}`;
  const relationship = item.relationship;
  return (
    <li className="evidence-card" data-selected={selected} data-collected={collected} data-evidence-id={item.evidence_id} style={{ ["--i" as string]: index }}>
      <button
        type="button"
        className="card-button"
        aria-pressed={selected}
        aria-label={`Inspect evidence: ${headline}`}
        onClick={() => onSelect(item.evidence_id)}
      >
        <span className="meta">
          <span className="badge badge-neutral">{SOURCE_TYPE_LABEL[item.source_type]}</span>
          {relationship ? (
            <span className={`badge ${relationship.basis === "VERIFIED" ? "badge-ok" : "badge-warn"}`}>
              {relationship.basis === "VERIFIED" ? "Verified relation" : "Inferred relation"}
            </span>
          ) : null}
          {collected ? <span className="badge badge-warn">Found in the archive</span> : null}
        </span>
        <p className="evidence-title">
          <Untrusted>{headline}</Untrusted>
        </p>
        <span className="meta">
          <span className="mono">{shortHash(item.commit_hash)}</span>
          <span>{formatTimestamp(item.timestamp)}</span>
          {item.file_path ? <span className="mono">{item.file_path}</span> : null}
        </span>
      </button>
    </li>
  );
}

export function EvidenceDetail({ item }: { item: EvidenceItem }) {
  const url = safeHttpsUrl(item.source_url);
  return (
    <section className="evidence-card" aria-label="Selected evidence detail" data-testid="evidence-detail">
      <h3 style={{ margin: "0 0 0.4rem", fontSize: "1.05rem" }}>
        <Untrusted>{item.title && item.title.trim() !== "" ? item.title : `${SOURCE_TYPE_LABEL[item.source_type]} ${item.source_id}`}</Untrusted>
      </h3>
      <dl className="kv">
        <dt>Source type</dt>
        <dd>{SOURCE_TYPE_LABEL[item.source_type]}</dd>
        <dt>Identifier</dt>
        <dd className="mono">{item.source_id}</dd>
        <dt>Commit</dt>
        <dd className="mono">{item.commit_hash ?? NOT_AVAILABLE}</dd>
        <dt>File</dt>
        <dd className="mono">{item.file_path ?? NOT_AVAILABLE}</dd>
        <dt>Lines</dt>
        <dd>{formatLineRange(item.line_range)}</dd>
        <dt>Date</dt>
        <dd>{formatTimestamp(item.timestamp)}</dd>
        <dt>Author (as returned)</dt>
        <dd>{item.author ? <Untrusted>{item.author}</Untrusted> : NOT_AVAILABLE}</dd>
        <dt>Relationship to the target</dt>
        <dd>
          {item.relationship
            ? `${RELATIONSHIP_LABEL[item.relationship.kind] ?? item.relationship.kind} (${item.relationship.basis === "VERIFIED" ? "verified by Sean" : "inferred"})`
            : NOT_AVAILABLE}
        </dd>
        <dt>Retrieved by</dt>
        <dd className="mono">{item.retrieval_method}</dd>
        <dt>Retrieved at</dt>
        <dd>{item.integrity.retrieved_at}</dd>
        <dt>Source verification</dt>
        <dd>{VERIFICATION_LABEL[item.integrity.source_verification]}</dd>
        <dt>Source link</dt>
        <dd>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          ) : item.source_url ? (
            <span className="mono">{item.source_url}</span>
          ) : (
            NOT_AVAILABLE
          )}
        </dd>
      </dl>
      {item.excerpt ? <pre className="excerpt">{item.excerpt}</pre> : null}
      {item.limitations.length > 0 ? (
        <p className="muted" style={{ margin: "0.3rem 0" }}>
          Item limitations: <span className="mono">{item.limitations.join(", ")}</span>
        </p>
      ) : null}
      {item.unavailable_fields.length > 0 ? (
        <p className="muted" style={{ margin: "0.3rem 0" }}>
          Not available from this source: <span className="mono">{item.unavailable_fields.join(", ")}</span>
        </p>
      ) : null}
      {item.verified_absent_fields.length > 0 ? (
        <p className="muted" style={{ margin: "0.3rem 0" }}>
          Verified absent at the source: <span className="mono">{item.verified_absent_fields.join(", ")}</span>
        </p>
      ) : null}
    </section>
  );
}
