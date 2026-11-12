/**
 * Response validation and the Spec 2 section 8.5 mapping (canonical contract C.7, owner decision C-D8).
 *
 * validateResponse checks required fields, recognized values, and the status and classification combination. A body that
 * fails is invalid and never reaches the reveal. Unknown extra fields are ignored and are not copied into the result.
 * The backend invariants of Spec 1 section 10.4 are enforced by the backend, so they are not re-checked here, except for
 * the combinations that would make the frontend show a conclusion where none is allowed.
 */

import {
  CHANGE_SIDES,
  CLASSIFICATIONS,
  RELATIONSHIP_BASES,
  RELATIONSHIP_KINDS,
  RETRIEVAL_STATUSES,
  SOURCE_TYPES,
  SOURCE_VERIFICATIONS,
  type Classification,
  type EvidenceItem,
  type InvestigationResult,
  type Limitation,
  type RankingEntry,
  type RetrievalStatus,
  type SourceReference,
  type UiState,
} from "../../types/contract";

export type Validation = { ok: true; result: InvestigationResult } | { ok: false; reason: string };

type Rec = Record<string, unknown>;

class Invalid extends Error {}

function fail(path: string, what: string): never {
  throw new Invalid(`${path}: ${what}`);
}

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rec(value: unknown, path: string): Rec {
  if (!isRec(value)) fail(path, "expected an object");
  return value;
}

function str(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "expected a string");
  return value;
}

function strOrNull(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  return str(value, path);
}

function num(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "expected a number");
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
  return value;
}

function arr(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) fail(path, "unrecognized value");
  return value as T;
}

function strings(value: unknown, path: string): string[] {
  return arr(value, path).map((entry, index) => str(entry, `${path}[${index}]`));
}

function lineRange(value: unknown, path: string): { start: number; end: number } | null {
  if (value === null || value === undefined) return null;
  const record = rec(value, path);
  return { start: num(record.start, `${path}.start`), end: num(record.end, `${path}.end`) };
}

function evidenceItem(value: unknown, path: string): EvidenceItem {
  const r = rec(value, path);
  const integrity = rec(r.integrity, `${path}.integrity`);
  const digest = integrity.content_digest;
  let relationship: EvidenceItem["relationship"] = null;
  if (r.relationship !== null && r.relationship !== undefined) {
    const rel = rec(r.relationship, `${path}.relationship`);
    relationship = {
      kind: oneOf(rel.kind, RELATIONSHIP_KINDS, `${path}.relationship.kind`),
      basis: oneOf(rel.basis, RELATIONSHIP_BASES, `${path}.relationship.basis`),
    };
  }
  let eventTimestamps: EvidenceItem["event_timestamps"] = null;
  if (r.event_timestamps !== null && r.event_timestamps !== undefined) {
    const events = rec(r.event_timestamps, `${path}.event_timestamps`);
    eventTimestamps = {
      merged_at: strOrNull(events.merged_at, `${path}.event_timestamps.merged_at`),
      closed_at: strOrNull(events.closed_at, `${path}.event_timestamps.closed_at`),
    };
  }
  return {
    evidence_id: str(r.evidence_id, `${path}.evidence_id`),
    repository_namespace: str(r.repository_namespace, `${path}.repository_namespace`),
    source_type: oneOf(r.source_type, SOURCE_TYPES, `${path}.source_type`),
    source_id: str(r.source_id, `${path}.source_id`),
    retrieval_method: str(r.retrieval_method, `${path}.retrieval_method`),
    limitations: strings(r.limitations ?? [], `${path}.limitations`),
    integrity: {
      retrieved_at: str(integrity.retrieved_at, `${path}.integrity.retrieved_at`),
      served_from_cache: bool(integrity.served_from_cache, `${path}.integrity.served_from_cache`),
      source_verification: oneOf(integrity.source_verification, SOURCE_VERIFICATIONS, `${path}.integrity.source_verification`),
      content_digest:
        digest === null || digest === undefined
          ? null
          : (() => {
              const d = rec(digest, `${path}.integrity.content_digest`);
              return {
                algorithm: str(d.algorithm, `${path}.integrity.content_digest.algorithm`),
                scope: str(d.scope, `${path}.integrity.content_digest.scope`),
                value: str(d.value, `${path}.integrity.content_digest.value`),
              };
            })(),
    },
    source_url: strOrNull(r.source_url, `${path}.source_url`),
    commit_hash: strOrNull(r.commit_hash, `${path}.commit_hash`),
    revision: strOrNull(r.revision, `${path}.revision`),
    change_side:
      r.change_side === null || r.change_side === undefined ? null : oneOf(r.change_side, CHANGE_SIDES, `${path}.change_side`),
    file_path: strOrNull(r.file_path, `${path}.file_path`),
    line_range: lineRange(r.line_range, `${path}.line_range`),
    author: strOrNull(r.author, `${path}.author`),
    timestamp: strOrNull(r.timestamp, `${path}.timestamp`),
    event_timestamps: eventTimestamps,
    title: strOrNull(r.title, `${path}.title`),
    excerpt: strOrNull(r.excerpt, `${path}.excerpt`),
    relationship,
    unavailable_fields: strings(r.unavailable_fields ?? [], `${path}.unavailable_fields`),
    verified_absent_fields: strings(r.verified_absent_fields ?? [], `${path}.verified_absent_fields`),
  };
}

function limitation(value: unknown, path: string): Limitation {
  const r = rec(value, path);
  return {
    code: str(r.code, `${path}.code`),
    message: str(r.message, `${path}.message`),
    scope: str(r.scope, `${path}.scope`),
    evidence_id: strOrNull(r.evidence_id, `${path}.evidence_id`),
  };
}

function rankingEntry(value: unknown, path: string): RankingEntry {
  const r = rec(value, path);
  return {
    evidence_id: str(r.evidence_id, `${path}.evidence_id`),
    score: num(r.score, `${path}.score`),
    awards: arr(r.awards ?? [], `${path}.awards`).map((award, index) => {
      const pair = arr(award, `${path}.awards[${index}]`);
      return [str(pair[0], `${path}.awards[${index}][0]`), num(pair[1], `${path}.awards[${index}][1]`)] as [string, number];
    }),
  };
}

function sourceReference(value: unknown, path: string): SourceReference {
  const r = rec(value, path);
  return {
    evidence_id: str(r.evidence_id, `${path}.evidence_id`),
    source_type: str(r.source_type, `${path}.source_type`),
    source_id: str(r.source_id, `${path}.source_id`),
    source_url: strOrNull(r.source_url, `${path}.source_url`),
  };
}

export function validateResponse(body: unknown): Validation {
  try {
    const r = rec(body, "body");
    const status: RetrievalStatus = oneOf(r.retrieval_status, RETRIEVAL_STATUSES, "retrieval_status");
    const classification: Classification | null =
      r.epistemic_classification === null || r.epistemic_classification === undefined
        ? null
        : oneOf(r.epistemic_classification, CLASSIFICATIONS, "epistemic_classification");
    const target = rec(r.target, "target");
    let targetRange: [number, number] | null = null;
    if (target.line_range !== null && target.line_range !== undefined) {
      const pair = arr(target.line_range, "target.line_range");
      targetRange = [num(pair[0], "target.line_range[0]"), num(pair[1], "target.line_range[1]")];
    }

    let error: InvestigationResult["error"] = null;
    if (r.error !== null && r.error !== undefined) {
      const e = rec(r.error, "error");
      error = { code: str(e.code, "error.code"), message: str(e.message, "error.message"), retryable: bool(e.retryable, "error.retryable") };
    }

    const result: InvestigationResult = {
      investigation_id: str(r.investigation_id, "investigation_id"),
      repository: { repository_id: str(rec(r.repository, "repository").repository_id, "repository.repository_id") },
      target: {
        path: str(target.path, "target.path"),
        symbol: strOrNull(target.symbol, "target.symbol"),
        line_range: targetRange,
        resolution: str(target.resolution, "target.resolution"),
      },
      retrieval_status: status,
      epistemic_classification: classification,
      conclusion: strOrNull(r.conclusion, "conclusion"),
      explanation: strOrNull(r.explanation, "explanation"),
      evidence: arr(r.evidence, "evidence").map((item, index) => evidenceItem(item, `evidence[${index}]`)),
      ranking: arr(r.ranking ?? [], "ranking").map((entry, index) => rankingEntry(entry, `ranking[${index}]`)),
      limitations: arr(r.limitations ?? [], "limitations").map((entry, index) => limitation(entry, `limitations[${index}]`)),
      source_references: arr(r.source_references ?? [], "source_references").map((entry, index) =>
        sourceReference(entry, `source_references[${index}]`),
      ),
      error,
    };

    if (status === "FAILED") {
      if (classification !== null) fail("epistemic_classification", "a failed retrieval has no classification");
      if (result.conclusion !== null) fail("conclusion", "a failed retrieval has no conclusion");
      if (error === null) fail("error", "a failed retrieval carries an error");
    } else {
      if (classification === null) fail("epistemic_classification", "a non-failed result carries a classification");
      if (error !== null) fail("error", "only a failed retrieval carries an error");
      if (classification === "INSUFFICIENT_EVIDENCE" && result.conclusion !== null && result.conclusion !== "") {
        fail("conclusion", "insufficient evidence carries no conclusion");
      }
    }
    return { ok: true, result };
  } catch (caught) {
    if (caught instanceof Invalid) return { ok: false, reason: caught.message };
    throw caught;
  }
}

/**
 * Spec 2 section 8.5, first matching row wins.
 *
 * validateResponse already rejects a non-failed result without a classification. This function is safe on its own as well:
 * a non-failed status with no classification is an invalid combination, and an invalid combination is presented as FAILED
 * (canonical contract C.7), never as a success.
 */
export function deriveUiState(result: Pick<InvestigationResult, "retrieval_status" | "epistemic_classification">): UiState {
  if (result.retrieval_status === "FAILED") return "FAILED";
  const classification = result.epistemic_classification;
  if (classification === null) return "FAILED";
  if (classification === "INSUFFICIENT_EVIDENCE") return "INSUFFICIENT_EVIDENCE";
  if (classification === "PARTIAL_EVIDENCE") return "PARTIAL";
  if (result.retrieval_status === "PARTIAL" || result.retrieval_status === "INSUFFICIENT") return "PARTIAL";
  return "COMPLETED";
}

/**
 * The one eligibility rule shared by the narrative interruption, the escape game, and every success cue. A result is
 * eligible only when it is valid, presented as COMPLETED or PARTIAL, and has at least one evidence item.
 */
export function isNarrativeEligible(result: InvestigationResult): boolean {
  const state = deriveUiState(result);
  return (state === "COMPLETED" || state === "PARTIAL") && result.evidence.length > 0;
}
