/**
 * Backend contract types for POST /investigations.
 *
 * These mirror the real response of backend/app/api/app.py (`_serialize`) and the evidence model in
 * backend/app/modules/evidence/models.py. They were checked against responses captured from the running backend
 * (frontend/tests/fixtures). The frontend adds no field and changes no value.
 */

export const RETRIEVAL_STATUSES = ["COMPLETE", "PARTIAL", "INSUFFICIENT", "FAILED"] as const;
export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number];

export const CLASSIFICATIONS = ["DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE", "INSUFFICIENT_EVIDENCE"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export const SOURCE_TYPES = ["GIT_COMMIT", "GIT_BLAME", "CODE_HISTORY", "DOCUMENTATION", "PULL_REQUEST", "ISSUE"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const RELATIONSHIP_KINDS = [
  "TOUCHES_TARGET_PATH",
  "CHANGES_TARGET_LINES",
  "BLAMES_TARGET_LINES",
  "DOCUMENTS_TARGET_PATH",
  "MENTIONS_TARGET",
  "SEMANTICALLY_RELATES_TO_TARGET",
] as const;
export type RelationshipKind = (typeof RELATIONSHIP_KINDS)[number];

export const RELATIONSHIP_BASES = ["VERIFIED", "INFERRED"] as const;
export type RelationshipBasis = (typeof RELATIONSHIP_BASES)[number];

export const SOURCE_VERIFICATIONS = ["VERIFIED_IN_REPOSITORY", "VALIDATED_RECORD_IDENTITY", "NOT_PERFORMED"] as const;
export type SourceVerification = (typeof SOURCE_VERIFICATIONS)[number];

export const CHANGE_SIDES = ["PRE_CHANGE", "POST_CHANGE"] as const;
export type ChangeSide = (typeof CHANGE_SIDES)[number];

/** Presentation states derived by the frontend (Spec 2 section 8.5). Never sent by the backend. */
export type UiState = "COMPLETED" | "PARTIAL" | "INSUFFICIENT_EVIDENCE" | "FAILED";

export interface LineRange {
  start: number;
  end: number;
}

export interface ContentDigest {
  algorithm: string;
  scope: string;
  value: string;
}

export interface Integrity {
  retrieved_at: string;
  served_from_cache: boolean;
  source_verification: SourceVerification;
  content_digest: ContentDigest | null;
}

export interface Relationship {
  kind: RelationshipKind;
  basis: RelationshipBasis;
}

export interface EventTimestamps {
  merged_at?: string | null;
  closed_at?: string | null;
}

export interface EvidenceItem {
  evidence_id: string;
  repository_namespace: string;
  source_type: SourceType;
  source_id: string;
  retrieval_method: string;
  limitations: string[];
  integrity: Integrity;
  source_url: string | null;
  commit_hash: string | null;
  revision: string | null;
  change_side: ChangeSide | null;
  file_path: string | null;
  line_range: LineRange | null;
  author: string | null;
  timestamp: string | null;
  event_timestamps: EventTimestamps | null;
  title: string | null;
  excerpt: string | null;
  relationship: Relationship | null;
  unavailable_fields: string[];
  verified_absent_fields: string[];
}

export interface Limitation {
  code: string;
  message: string;
  scope: string;
  evidence_id: string | null;
}

export interface RankingEntry {
  evidence_id: string;
  score: number;
  awards: [string, number][];
}

export interface SourceReference {
  evidence_id: string;
  source_type: string;
  source_id: string;
  source_url: string | null;
}

export interface ResultError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface TargetInfo {
  path: string;
  symbol: string | null;
  line_range: [number, number] | null;
  /** Displayed unchanged. The backend returns labels such as RESOLVED, NOT_REQUESTED, and NOT_RESOLVED. */
  resolution: string;
}

export interface InvestigationResult {
  investigation_id: string;
  repository: { repository_id: string };
  target: TargetInfo;
  retrieval_status: RetrievalStatus;
  epistemic_classification: Classification | null;
  conclusion: string | null;
  explanation: string | null;
  evidence: EvidenceItem[];
  ranking: RankingEntry[];
  limitations: Limitation[];
  source_references: SourceReference[];
  error: ResultError | null;
}

/** Request-level error (category B). It has no retrieval status. */
export interface BackendError {
  code: string;
  message: string;
  retryable: boolean;
  field: string | null;
  candidates: string[];
}

/** The exact request body. No other field is ever sent. */
export interface InvestigationRequest {
  repository_id: string;
  target: {
    path: string;
    symbol?: string;
    line_start?: number;
    line_end?: number;
  };
  question: string;
}
