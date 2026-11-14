/**
 * Validation of the repository-intelligence responses (Spec 4 section 4.2).
 *
 * Every response is untrusted until it passes. A response that does not match the contract is rejected with a reason, and
 * nothing from it is shown. The cross-checks repeat the backend contract (Spec 4 section 6.2), so a bug or a tampered
 * response cannot display a recommendation without evidence, an overstated classification, or a repository file for a
 * capability that cannot be one.
 */

import {
  OBSERVATION_KINDS,
  RECOMMENDATION_STATUSES,
  AI_STATUSES,
  type AdvisorResult,
  type ArtifactFile,
  type Capabilities,
  type PreviewResponse,
  type InterpretedRequest,
  type Observation,
  type ProfileResponse,
  type Recommendation,
  type RepositoryListItem,
  type RepositoryProfile,
} from "../../types/advisor";

export type Validated<T> = { ok: true; value: T } | { ok: false; reason: string };

const MAX_OBSERVATIONS = 1000;
const MAX_RECOMMENDATIONS = 50;
const MAX_TEXT = 4000;
const MAX_LIST = 200;

class Invalid extends Error {}

type Rec = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new Invalid(`${path}: expected ${expected}`);
}
function rec(value: unknown, path: string): Rec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "an object");
  return value as Rec;
}
function exact(value: Rec, path: string, keys: readonly string[]): void {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, "no unknown field");
  for (const key of keys) if (!(key in value)) fail(`${path}.${key}`, "a value");
}
function str(value: unknown, path: string, max = MAX_TEXT): string {
  if (typeof value !== "string" || value.length > max) fail(path, `a string of at most ${max} characters`);
  return value as string;
}
function strOrNull(value: unknown, path: string): string | null {
  return value === null ? null : str(value, path);
}
function int(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1e9) fail(path, "a non-negative integer");
  return value as number;
}
function bool(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "a boolean");
  return value as boolean;
}
function oneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) fail(path, `one of ${allowed.join(", ")}`);
  return value as T;
}
function list<T>(value: unknown, path: string, item: (v: unknown, p: string) => T, max = MAX_LIST): T[] {
  if (!Array.isArray(value) || value.length > max) fail(path, `an array of at most ${max} items`);
  return (value as unknown[]).map((entry, index) => item(entry, `${path}[${index}]`));
}
function strings(value: unknown, path: string): string[] {
  return list(value, path, (v, p) => str(v, p));
}

function observation(raw: unknown, path: string): Observation {
  const r = rec(raw, path);
  exact(r, path, ["observation_id", "kind", "path", "value", "count", "role", "classification", "source", "explanation"]);
  return {
    observation_id: str(r.observation_id, `${path}.observation_id`, 64),
    kind: oneOf(r.kind, `${path}.kind`, OBSERVATION_KINDS),
    path: strOrNull(r.path, `${path}.path`),
    value: strOrNull(r.value, `${path}.value`),
    count: r.count === null ? null : int(r.count, `${path}.count`),
    role: r.role === null ? null : oneOf(r.role, `${path}.role`, ["TEST_TOOL", "LINT_TOOL", "BUILD_TOOL", "SCRIPT"] as const),
    classification: oneOf(r.classification, `${path}.classification`, ["DOCUMENTED", "INFERRED"] as const),
    source: oneOf(r.source, `${path}.source`, ["GIT_TREE", "GIT_BLOB", "GIT_LOG"] as const),
    explanation: str(r.explanation, `${path}.explanation`),
  };
}

function profile(raw: unknown, path: string): RepositoryProfile {
  const r = rec(raw, path);
  exact(r, path, ["repository_id", "head", "basis", "truncated", "history_limited", "shallow", "summary", "observations", "limitations"]);
  const s = rec(r.summary, `${path}.summary`);
  exact(s, `${path}.summary`, ["tree_entries", "source_files", "test_files", "languages", "areas", "history"]);
  const h = rec(s.history, `${path}.summary.history`);
  exact(h, `${path}.summary.history`, ["commits_scanned", "fix_commits", "feature_commits", "revert_commits", "conventional_commits", "distinct_authors"]);
  const observations = list(r.observations, `${path}.observations`, observation, MAX_OBSERVATIONS);
  const ids = new Set(observations.map((o) => o.observation_id));
  if (ids.size !== observations.length) fail(`${path}.observations`, "unique observation IDs");
  return {
    repository_id: str(r.repository_id, `${path}.repository_id`, 64),
    head: str(r.head, `${path}.head`, 64),
    basis: oneOf(r.basis, `${path}.basis`, ["COMMITTED_TREE"] as const),
    truncated: bool(r.truncated, `${path}.truncated`),
    history_limited: bool(r.history_limited, `${path}.history_limited`),
    shallow: bool(r.shallow, `${path}.shallow`),
    summary: {
      tree_entries: int(s.tree_entries, `${path}.summary.tree_entries`),
      source_files: int(s.source_files, `${path}.summary.source_files`),
      test_files: int(s.test_files, `${path}.summary.test_files`),
      languages: list(s.languages, `${path}.summary.languages`, (v, p) => {
        const e = rec(v, p);
        exact(e, p, ["language", "files"]);
        return { language: str(e.language, `${p}.language`, 100), files: int(e.files, `${p}.files`) };
      }),
      areas: list(s.areas, `${path}.summary.areas`, (v, p) => {
        const e = rec(v, p);
        exact(e, p, ["name", "source_files", "test_files"]);
        return { name: str(e.name, `${p}.name`, 200), source_files: int(e.source_files, `${p}.source_files`), test_files: int(e.test_files, `${p}.test_files`) };
      }, 100),
      history: {
        commits_scanned: int(h.commits_scanned, "commits_scanned"),
        fix_commits: int(h.fix_commits, "fix_commits"),
        feature_commits: int(h.feature_commits, "feature_commits"),
        revert_commits: int(h.revert_commits, "revert_commits"),
        conventional_commits: int(h.conventional_commits, "conventional_commits"),
        distinct_authors: int(h.distinct_authors, "distinct_authors"),
      },
    },
    observations,
    limitations: list(r.limitations, `${path}.limitations`, (v, p) => {
      const e = rec(v, p);
      exact(e, p, ["code", "message"]);
      return { code: str(e.code, `${p}.code`, 100), message: str(e.message, `${p}.message`) };
    }),
  };
}

const REC_KEYS = [
  "capability", "title", "summary", "repository_signal", "evidence_references", "evidence_classification", "reasoning",
  "expected_benefit", "priority", "recommendation_status", "implementation_effort", "prerequisites", "needs_external_setup",
  "risks", "adoption_scope", "configuration_strategy", "artifact_kind", "verification_method", "confidence", "limitations",
] as const;

function recommendation(raw: unknown, path: string): Recommendation {
  const r = rec(raw, path);
  exact(r, path, REC_KEYS);
  const out: Recommendation = {
    capability: str(r.capability, `${path}.capability`, 64),
    title: str(r.title, `${path}.title`, 200),
    summary: str(r.summary, `${path}.summary`),
    repository_signal: str(r.repository_signal, `${path}.repository_signal`),
    evidence_references: strings(r.evidence_references, `${path}.evidence_references`),
    evidence_classification: oneOf(r.evidence_classification, `${path}.evidence_classification`, ["DOCUMENTED", "INFERRED", "PARTIAL_EVIDENCE", "INSUFFICIENT_EVIDENCE"] as const),
    reasoning: str(r.reasoning, `${path}.reasoning`),
    expected_benefit: str(r.expected_benefit, `${path}.expected_benefit`),
    priority: oneOf(r.priority, `${path}.priority`, ["P1", "P2", "P3"] as const),
    recommendation_status: oneOf(r.recommendation_status, `${path}.recommendation_status`, RECOMMENDATION_STATUSES),
    implementation_effort: oneOf(r.implementation_effort, `${path}.implementation_effort`, ["LOW", "MEDIUM", "HIGH"] as const),
    prerequisites: strings(r.prerequisites, `${path}.prerequisites`),
    needs_external_setup: bool(r.needs_external_setup, `${path}.needs_external_setup`),
    risks: strings(r.risks, `${path}.risks`),
    adoption_scope: oneOf(r.adoption_scope, `${path}.adoption_scope`, ["REPOSITORY", "USER", "RUNTIME"] as const),
    configuration_strategy: oneOf(r.configuration_strategy, `${path}.configuration_strategy`, ["GENERATE_FILE", "INSTRUCTIONS_ONLY", "NONE"] as const),
    artifact_kind: strOrNull(r.artifact_kind, `${path}.artifact_kind`),
    verification_method: str(r.verification_method, `${path}.verification_method`),
    confidence: oneOf(r.confidence, `${path}.confidence`, ["HIGH", "MEDIUM", "LOW"] as const),
    limitations: strings(r.limitations, `${path}.limitations`),
  };
  const actionable = out.recommendation_status === "ADOPT_NOW" || out.recommendation_status === "CONSIDER";
  if (actionable && out.evidence_references.length === 0) fail(path, "evidence for an actionable recommendation");
  if (out.recommendation_status === "INSUFFICIENT_EVIDENCE" && out.evidence_classification !== "INSUFFICIENT_EVIDENCE") fail(path, "an insufficient-evidence classification");
  if (out.adoption_scope !== "REPOSITORY" && out.configuration_strategy === "GENERATE_FILE") fail(path, "no repository file for a non-repository capability");
  if (out.artifact_kind !== null && out.configuration_strategy !== "GENERATE_FILE") fail(path, "an artifact only with GENERATE_FILE");
  if (!actionable && out.configuration_strategy === "GENERATE_FILE") fail(path, "no file for a capability that is not recommended");
  return out;
}

function advisor(raw: unknown, path: string): AdvisorResult {
  const r = rec(raw, path);
  exact(r, path, ["repository_id", "profile_head", "catalog_verified_on", "recommendations", "roadmap", "limitations"]);
  const road = rec(r.roadmap, `${path}.roadmap`);
  const bands = ["immediate", "near_term", "longer_term", "not_recommended", "insufficient_evidence"] as const;
  exact(road, `${path}.roadmap`, bands);
  const recommendations = list(r.recommendations, `${path}.recommendations`, recommendation, MAX_RECOMMENDATIONS);
  const known = new Set(recommendations.map((x) => x.capability));
  const roadmap = {
    immediate: strings(road.immediate, "immediate"),
    near_term: strings(road.near_term, "near_term"),
    longer_term: strings(road.longer_term, "longer_term"),
    not_recommended: strings(road.not_recommended, "not_recommended"),
    insufficient_evidence: strings(road.insufficient_evidence, "insufficient_evidence"),
  };
  for (const band of bands) for (const capability of roadmap[band]) if (!known.has(capability)) fail(`${path}.roadmap.${band}`, "a capability that was assessed");
  return {
    repository_id: str(r.repository_id, `${path}.repository_id`, 64),
    profile_head: str(r.profile_head, `${path}.profile_head`, 64),
    catalog_verified_on: str(r.catalog_verified_on, `${path}.catalog_verified_on`, 20),
    recommendations,
    roadmap,
    limitations: strings(r.limitations, `${path}.limitations`),
  };
}

function guard<T>(build: () => T): Validated<T> {
  try {
    return { ok: true, value: build() };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, reason: error.message };
    throw error;
  }
}

/** Validate a profile response, including that every evidence reference resolves and no classification claims more than the evidence. */
export function validateProfileResponse(raw: unknown): Validated<ProfileResponse> {
  return guard(() => {
    const top = rec(raw, "response");
    exact(top, "response", ["profile", "advisor"]);
    const p = profile(top.profile, "profile");
    const a = advisor(top.advisor, "advisor");
    if (a.profile_head !== p.head || a.repository_id !== p.repository_id) fail("advisor", "a result built from this profile");
    const byId = new Map(p.observations.map((o) => [o.observation_id, o]));
    const incomplete = p.truncated || p.shallow;
    for (const item of a.recommendations) {
      const refs = item.evidence_references.map((id) => byId.get(id));
      if (refs.some((x) => x === undefined)) fail(`advisor.${item.capability}`, "evidence references that exist in the profile");
      if (item.evidence_classification === "DOCUMENTED") {
        if (refs.some((x) => x?.classification === "INFERRED")) fail(`advisor.${item.capability}`, "no DOCUMENTED claim over inferred evidence");
        if (incomplete) fail(`advisor.${item.capability}`, "no DOCUMENTED claim from an incomplete scan");
      }
    }
    return { profile: p, advisor: a };
  });
}

export function validateInterpreted(raw: unknown): Validated<InterpretedRequest> {
  return guard(() => {
    const r = rec(raw, "interpretation");
    exact(r, "interpretation", ["mode", "interpreter", "repository_id", "target_path", "symbol", "question", "candidates", "message", "ai_status"]);
    const out: InterpretedRequest = {
      mode: oneOf(r.mode, "mode", ["INVESTIGATE", "ADVISE", "NEEDS_TARGET", "UNRESOLVED"] as const),
      interpreter: oneOf(r.interpreter, "interpreter", ["deterministic", "gemini"] as const),
      repository_id: strOrNull(r.repository_id, "repository_id"),
      target_path: strOrNull(r.target_path, "target_path"),
      symbol: strOrNull(r.symbol, "symbol"),
      question: str(r.question, "question", 2000),
      candidates: list(r.candidates, "candidates", (v, p) => str(v, p, 1024), 10),
      message: strOrNull(r.message, "message"),
      ai_status: oneOf(r.ai_status, "ai_status", AI_STATUSES),
    };
    if (out.mode === "INVESTIGATE" && (out.repository_id === null || out.target_path === null)) fail("interpretation", "a repository and a path to investigate");
    if ((out.mode === "ADVISE" || out.mode === "NEEDS_TARGET") && out.repository_id === null) fail("interpretation", "a repository");
    return out;
  });
}

export function validateRepositories(raw: unknown): Validated<RepositoryListItem[]> {
  return guard(() => {
    const top = rec(raw, "response");
    exact(top, "response", ["repositories"]);
    const items = list(top.repositories, "repositories", (v, p) => {
      const e = rec(v, p);
      exact(e, p, ["repository_id", "display_name", "path", "available", "github"]);
      let github: RepositoryListItem["github"] = null;
      if (e.github !== null) {
        const g = rec(e.github, `${p}.github`);
        exact(g, `${p}.github`, ["owner", "name"]);
        github = { owner: str(g.owner, "owner", 100), name: str(g.name, "name", 100) };
      }
      const id = str(e.repository_id, `${p}.repository_id`, 64);
      if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(id)) fail(`${p}.repository_id`, "a valid repository ID");
      return { repository_id: id, display_name: str(e.display_name, `${p}.display_name`, 200), path: str(e.path, `${p}.path`, 1100), available: bool(e.available, `${p}.available`), github };
    }, 100);
    return items;
  });
}

/** One registered repository, as returned by the add and edit calls. */
export function validateRepositoryItem(raw: unknown): Validated<RepositoryListItem> {
  const wrapped = validateRepositories({ repositories: [raw] });
  return wrapped.ok ? { ok: true, value: wrapped.value[0]! } : wrapped;
}

/** The answer to a removal: only the identifier that was removed. */
export function validateRemoved(raw: unknown): Validated<{ removed: string }> {
  return guard(() => {
    const top = rec(raw, "response");
    exact(top, "response", ["removed"]);
    return { removed: str(top.removed, "removed", 64) };
  });
}

export function validateCapabilities(raw: unknown): Validated<Capabilities> {
  return guard(() => {
    const top = rec(raw, "response");
    exact(top, "response", ["ai_interpreter"]);
    const ai = rec(top.ai_interpreter, "ai_interpreter");
    exact(ai, "ai_interpreter", ["available", "provider", "model", "sends"]);
    return {
      ai_interpreter: {
        available: bool(ai.available, "available"),
        provider: str(ai.provider, "provider", 100),
        model: str(ai.model, "model", 100),
        sends: str(ai.sends, "sends", 300),
      },
    };
  });
}
/** The same location rule the backend applies. A path outside it is never offered for download. */
export const ALLOWED_ARTIFACT_PATH = /^(\.kiroignore|\.kiro\/(steering|specs|hooks|agents|skills)\/[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*)$/;
const MAX_ARTIFACT_CHARACTERS = 64 * 1024;

function artifactFile(raw: unknown, path: string): ArtifactFile {
  const r = rec(raw, path);
  exact(r, path, ["path", "kind", "scope", "content", "content_sha256", "status", "existing_content", "diff", "alternative_path", "validation"]);
  const filePath = str(r.path, `${path}.path`, 300);
  if (!ALLOWED_ARTIFACT_PATH.test(filePath) || filePath.split("/").includes("..")) fail(`${path}.path`, "an allowed Kiro configuration location");
  const alternative = strOrNull(r.alternative_path, `${path}.alternative_path`);
  if (alternative !== null && !ALLOWED_ARTIFACT_PATH.test(alternative)) fail(`${path}.alternative_path`, "an allowed Kiro configuration location");
  const validation = rec(r.validation, `${path}.validation`);
  exact(validation, `${path}.validation`, ["ok", "problems"]);
  const sha = str(r.content_sha256, `${path}.content_sha256`, 64);
  if (!/^[0-9a-f]{64}$/.test(sha)) fail(`${path}.content_sha256`, "a SHA-256 digest");
  return {
    path: filePath,
    kind: str(r.kind, `${path}.kind`, 64),
    scope: oneOf(r.scope, `${path}.scope`, ["REPOSITORY"] as const),
    content: str(r.content, `${path}.content`, MAX_ARTIFACT_CHARACTERS),
    content_sha256: sha,
    status: oneOf(r.status, `${path}.status`, ["NEW", "CONFLICT", "VERIFIED"] as const),
    existing_content: r.existing_content === null ? null : str(r.existing_content, `${path}.existing_content`, MAX_ARTIFACT_CHARACTERS),
    diff: strOrNull(r.diff, `${path}.diff`),
    alternative_path: alternative,
    validation: { ok: bool(validation.ok, `${path}.validation.ok`), problems: strings(validation.problems, `${path}.validation.problems`) },
  };
}

export function validatePreviewResponse(raw: unknown): Validated<PreviewResponse> {
  return guard(() => {
    const top = rec(raw, "response");
    exact(top, "response", ["repository_id", "head", "bundles", "instructions", "skipped", "verification"]);
    return {
      repository_id: str(top.repository_id, "repository_id", 64),
      head: str(top.head, "head", 64),
      bundles: list(top.bundles, "bundles", (v, p) => {
        const b = rec(v, p);
        exact(b, p, ["capability", "title", "files"]);
        return { capability: str(b.capability, `${p}.capability`, 64), title: str(b.title, `${p}.title`, 200), files: list(b.files, `${p}.files`, artifactFile, 20) };
      }, 20),
      instructions: list(top.instructions, "instructions", (v, p) => {
        const i = rec(v, p);
        exact(i, p, ["capability", "title", "scope", "steps", "snippet", "snippet_language"]);
        return {
          capability: str(i.capability, `${p}.capability`, 64),
          title: str(i.title, `${p}.title`, 200),
          scope: str(i.scope, `${p}.scope`, 20),
          steps: strings(i.steps, `${p}.steps`),
          snippet: i.snippet === null ? null : str(i.snippet, `${p}.snippet`, MAX_ARTIFACT_CHARACTERS),
          snippet_language: strOrNull(i.snippet_language, `${p}.snippet_language`),
        };
      }, 20),
      skipped: list(top.skipped, "skipped", (v, p) => {
        const s = rec(v, p);
        exact(s, p, ["capability", "reason"]);
        return { capability: str(s.capability, `${p}.capability`, 64), reason: str(s.reason, `${p}.reason`) };
      }, 20),
      verification: list(top.verification, "verification", (v, p) => {
        const s = rec(v, p);
        exact(s, p, ["path", "status"]);
        return { path: str(s.path, `${p}.path`, 300), status: oneOf(s.status, `${p}.status`, ["ABSENT", "IDENTICAL", "DIFFERENT"] as const) };
      }, 20),
    };
  });
}