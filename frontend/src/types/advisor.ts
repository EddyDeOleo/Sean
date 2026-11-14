/**
 * Types for the repository-intelligence endpoints (Spec 4 section 4.2): GET /repositories, POST /repositories/{id}/profile,
 * and POST /interpret. They mirror backend/app/modules/{repository_profile,advisor,intent}. The frontend validates every
 * response against these shapes (features/analysis/validateAdvisor.ts) and never adds or changes a value.
 */

export const OBSERVATION_KINDS = [
  "LANGUAGE", "MANIFEST", "FRAMEWORK", "TOOLING", "INTEGRATION", "TEST_LAYOUT", "CI_CONFIG", "DOCUMENTATION",
  "CONVENTION", "KIRO_CONFIG", "SENSITIVE_PATH", "GENERATED_TRACKED", "SCRIPT_SET", "COMMIT_STATS", "FIX_RECURRENCE", "AREA",
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export type ObservationClassification = "DOCUMENTED" | "INFERRED";
export type ObservationSource = "GIT_TREE" | "GIT_BLOB" | "GIT_LOG";
export type ObservationRole = "TEST_TOOL" | "LINT_TOOL" | "BUILD_TOOL" | "SCRIPT";

export interface Observation {
  observation_id: string;
  kind: ObservationKind;
  path: string | null;
  value: string | null;
  count: number | null;
  role: ObservationRole | null;
  classification: ObservationClassification;
  source: ObservationSource;
  explanation: string;
}

export interface ProfileSummary {
  tree_entries: number;
  source_files: number;
  test_files: number;
  languages: { language: string; files: number }[];
  areas: { name: string; source_files: number; test_files: number }[];
  history: {
    commits_scanned: number;
    fix_commits: number;
    feature_commits: number;
    revert_commits: number;
    conventional_commits: number;
    distinct_authors: number;
  };
}

export interface RepositoryProfile {
  repository_id: string;
  head: string;
  basis: "COMMITTED_TREE";
  truncated: boolean;
  history_limited: boolean;
  shallow: boolean;
  summary: ProfileSummary;
  observations: Observation[];
  limitations: { code: string; message: string }[];
}

export const RECOMMENDATION_STATUSES = ["ADOPT_NOW", "CONSIDER", "NOT_RECOMMENDED", "INSUFFICIENT_EVIDENCE"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];
export type EvidenceClassification = "DOCUMENTED" | "INFERRED" | "PARTIAL_EVIDENCE" | "INSUFFICIENT_EVIDENCE";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type AdoptionScope = "REPOSITORY" | "USER" | "RUNTIME";
export type ConfigurationStrategy = "GENERATE_FILE" | "INSTRUCTIONS_ONLY" | "NONE";

export interface Recommendation {
  capability: string;
  title: string;
  summary: string;
  repository_signal: string;
  evidence_references: string[];
  evidence_classification: EvidenceClassification;
  reasoning: string;
  expected_benefit: string;
  priority: "P1" | "P2" | "P3";
  recommendation_status: RecommendationStatus;
  implementation_effort: "LOW" | "MEDIUM" | "HIGH";
  prerequisites: string[];
  needs_external_setup: boolean;
  risks: string[];
  adoption_scope: AdoptionScope;
  configuration_strategy: ConfigurationStrategy;
  artifact_kind: string | null;
  verification_method: string;
  confidence: Confidence;
  limitations: string[];
}

export interface Roadmap {
  immediate: string[];
  near_term: string[];
  longer_term: string[];
  not_recommended: string[];
  insufficient_evidence: string[];
}

export interface AdvisorResult {
  repository_id: string;
  profile_head: string;
  catalog_verified_on: string;
  recommendations: Recommendation[];
  roadmap: Roadmap;
  limitations: string[];
}

export interface ProfileResponse {
  profile: RepositoryProfile;
  advisor: AdvisorResult;
}

export type InterpretMode = "INVESTIGATE" | "ADVISE" | "NEEDS_TARGET" | "UNRESOLVED";

/** What happened with the optional AI reader for one request. Every value except AI_USED means the deterministic reader decided. */
export const AI_STATUSES = [
  "NOT_REQUESTED",
  "NOT_NEEDED",
  "AI_USED",
  "AI_NO_USABLE_ANSWER",
  "AI_TIMEOUT",
  "AI_HTTP_ERROR",
  "AI_CONNECTION_FAILED",
  "AI_PROTOCOL_ERROR",
  "AI_RESPONSE_TOO_LARGE",
  "AI_INVALID_REPLY",
  "AI_UNEXPECTED",
] as const;
export type AIStatus = (typeof AI_STATUSES)[number];

export interface InterpretedRequest {
  mode: InterpretMode;
  interpreter: "deterministic" | "gemini";
  repository_id: string | null;
  target_path: string | null;
  symbol: string | null;
  question: string;
  candidates: string[];
  message: string | null;
  ai_status: AIStatus;
}

export interface RepositoryListItem {
  repository_id: string;
  /** The name shown to people. It is the identifier when no name was given. */
  display_name: string;
  /** The folder the repository is registered at. */
  path: string;
  available: boolean;
  github: { owner: string; name: string } | null;
}

export interface Capabilities {
  ai_interpreter: { available: boolean; provider: string; model: string; sends: string };
}

export type ArtifactFileStatus = "NEW" | "CONFLICT" | "VERIFIED";
export type VerificationStatus = "ABSENT" | "IDENTICAL" | "DIFFERENT";

export interface ArtifactFile {
  path: string;
  kind: string;
  scope: "REPOSITORY";
  content: string;
  content_sha256: string;
  status: ArtifactFileStatus;
  existing_content: string | null;
  diff: string | null;
  alternative_path: string | null;
  validation: { ok: boolean; problems: string[] };
}

export interface ArtifactBundle {
  capability: string;
  title: string;
  files: ArtifactFile[];
}

export interface ArtifactInstruction {
  capability: string;
  title: string;
  scope: string;
  steps: string[];
  snippet: string | null;
  snippet_language: string | null;
}

export interface PreviewResponse {
  repository_id: string;
  head: string;
  bundles: ArtifactBundle[];
  instructions: ArtifactInstruction[];
  skipped: { capability: string; reason: string }[];
  verification: { path: string; status: VerificationStatus }[];
}