/**
 * The report snapshot (Spec 4 sections 9.2 to 9.4).
 *
 * A snapshot is the immutable result of one analysis: the interpreted request, the investigation result (if one was
 * requested), and the repository profile with the Advisor output. It is assembled from validated parts only. It is saved
 * before any cinematic starts and it is never changed afterwards, so nothing that happens in a game can alter it.
 *
 * Every part is optional because the parts fail independently (Spec 4 section 13.1): a failed Advisor does not discard a
 * successful investigation, and a failed investigation does not discard the Advisor result. A missing part carries the
 * reason, so the report can say what is absent instead of hiding it.
 */

import { AI_STATUSES, type AIStatus, type InterpretMode, type ProfileResponse } from "../../types/advisor";
import type { InvestigationResult } from "../../types/contract";
import { isNarrativeEligible, validateResponse } from "../investigation/validateResponse";
import { ALLOWED_ARTIFACT_PATH, validateProfileResponse } from "../analysis/validateAdvisor";

export const SNAPSHOT_SCHEMA = 1;
/** The most artifact records one snapshot keeps. The store refuses more, so a saved report can never become unreadable. */
export const MAX_ARTIFACT_RECORDS = 100;

export interface SnapshotInput {
  /** What the AI reader did. Absent in snapshots saved before this was recorded, and shown as "not recorded". */
  ai_status?: AIStatus;
  /** The sentence the user typed, or a summary of the structured request. */
  text: string;
  repository_id: string;
  mode: InterpretMode;
  interpreter: "deterministic" | "gemini";
  question: string;
  target_path: string | null;
  symbol: string | null;
}

export type ArtifactState = "ARTIFACT_GENERATED" | "ARTIFACT_EXPORTED";

export interface ArtifactRecord {
  capability: string;
  path: string;
  state: ArtifactState;
  at: string;
  /** SHA-256 of the prepared content, so a later check can compare it with the committed file. */
  content_sha256: string;
}

export interface ReportSnapshot {
  schema: typeof SNAPSHOT_SCHEMA;
  id: string;
  createdAt: string;
  input: SnapshotInput;
  investigation: InvestigationResult | null;
  investigationNote: string | null;
  analysis: ProfileResponse | null;
  analysisNote: string | null;
  artifacts: ArtifactRecord[];
}

export interface SnapshotSummary {
  id: string;
  createdAt: string;
  repository_id: string;
  title: string;
  mode: InterpretMode;
  classification: string | null;
  retrievalStatus: string | null;
  actionable: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Build a snapshot from validated parts. At least one part must be present. */
export function buildSnapshot(parts: {
  id: string;
  createdAt: string;
  input: SnapshotInput;
  investigation: InvestigationResult | null;
  investigationNote: string | null;
  analysis: ProfileResponse | null;
  analysisNote: string | null;
}): ReportSnapshot {
  if (parts.investigation === null && parts.analysis === null) throw new Error("a snapshot needs at least one result");
  return Object.freeze({ schema: SNAPSHOT_SCHEMA, ...parts, artifacts: [] });
}

export function summarize(snapshot: ReportSnapshot): SnapshotSummary {
  const actionable = snapshot.analysis
    ? snapshot.analysis.advisor.recommendations.filter((r) => r.recommendation_status === "ADOPT_NOW" || r.recommendation_status === "CONSIDER").length
    : 0;
  return {
    id: snapshot.id,
    createdAt: snapshot.createdAt,
    repository_id: snapshot.input.repository_id,
    title: snapshot.input.question.slice(0, 140),
    mode: snapshot.input.mode,
    classification: snapshot.investigation?.epistemic_classification ?? null,
    retrievalStatus: snapshot.investigation?.retrieval_status ?? null,
    actionable,
  };
}

/** Whether the Ouija interlude may run (Spec 4 section 10): a usable result exists and nothing failed outright. */
export function isInterludeEligible(snapshot: ReportSnapshot): boolean {
  if (snapshot.investigation) return isNarrativeEligible(snapshot.investigation);
  return snapshot.input.mode === "ADVISE" && snapshot.analysis !== null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

/** Revalidate stored data. Returns null for anything that does not satisfy the contract; the caller discards it. */
export function parseSnapshot(raw: unknown): ReportSnapshot | null {
  if (!isRecord(raw) || raw.schema !== SNAPSHOT_SCHEMA) return null;
  const id = text(raw.id, 100);
  const createdAt = text(raw.createdAt, 40);
  if (!id || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  const input = raw.input;
  if (!isRecord(input)) return null;
  const inputText = text(input.text, 2000);
  const repository = text(input.repository_id, 64);
  const question = text(input.question, 2000);
  const mode = input.mode as InterpretMode;
  if (inputText === null || !repository || question === null) return null;
  if (mode !== "INVESTIGATE" && mode !== "ADVISE") return null;
  if (input.interpreter !== "deterministic" && input.interpreter !== "gemini") return null;
  if (input.ai_status !== undefined && !(AI_STATUSES as readonly unknown[]).includes(input.ai_status)) return null;
  const interpreter = input.interpreter as SnapshotInput["interpreter"];
  const targetPath = input.target_path === null ? null : text(input.target_path, 1024);
  const symbol = input.symbol === null ? null : text(input.symbol, 256);
  if ((input.target_path !== null && targetPath === null) || (input.symbol !== null && symbol === null)) return null;

  let investigation: InvestigationResult | null = null;
  if (raw.investigation !== null) {
    const checked = validateResponse(raw.investigation);
    if (!checked.ok) return null;
    investigation = checked.result;
  }
  let analysis: ProfileResponse | null = null;
  if (raw.analysis !== null) {
    const checked = validateProfileResponse(raw.analysis);
    if (!checked.ok) return null;
    analysis = checked.value;
  }
  if (investigation === null && analysis === null) return null;
  const investigationNote = raw.investigationNote === null ? null : text(raw.investigationNote, 1000);
  const analysisNote = raw.analysisNote === null ? null : text(raw.analysisNote, 1000);
  if ((raw.investigationNote !== null && investigationNote === null) || (raw.analysisNote !== null && analysisNote === null)) return null;

  const artifacts: ArtifactRecord[] = [];
  if (!Array.isArray(raw.artifacts) || raw.artifacts.length > MAX_ARTIFACT_RECORDS) return null;
  for (const entry of raw.artifacts) {
    if (!isRecord(entry)) return null;
    const capability = text(entry.capability, 64);
    const path = text(entry.path, 1024);
    const at = text(entry.at, 40);
    if (!capability || !path || !at || !ALLOWED_ARTIFACT_PATH.test(path)) return null;
    if (entry.state !== "ARTIFACT_GENERATED" && entry.state !== "ARTIFACT_EXPORTED") return null;
    const sha = text(entry.content_sha256, 64);
    if (sha === null || !/^[0-9a-f]{64}$/.test(sha)) return null;
    artifacts.push({ capability, path, state: entry.state, at, content_sha256: sha });
  }
  return Object.freeze({
    schema: SNAPSHOT_SCHEMA,
    id,
    createdAt,
    input: {
      text: inputText,
      repository_id: repository,
      mode,
      interpreter,
      question,
      target_path: targetPath,
      symbol,
      ...(input.ai_status !== undefined ? { ai_status: input.ai_status as AIStatus } : {}),
    },
    investigation,
    investigationNote,
    analysis,
    analysisNote,
    artifacts,
  });
}
