/**
 * Session persistence for the last validated result (Spec 3 section 14).
 *
 * The result is stored in sessionStorage after validation. On load it is validated again with validateResponse, and a value
 * that fails is discarded and removed. A restored result opens the final report without a cinematic and is labelled as
 * restored. The stored request is validated for shape only, and it holds exactly what was sent to the backend.
 */

import type { InvestigationRequest, InvestigationResult } from "../../types/contract";
import { validateResponse } from "../investigation/validateResponse";

export const SESSION_KEY = "sean.session.v1";

export interface StoredSession {
  request: InvestigationRequest;
  result: InvestigationResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRequest(value: unknown): InvestigationRequest | null {
  if (!isRecord(value) || !isRecord(value.target)) return null;
  if (typeof value.repository_id !== "string" || typeof value.question !== "string" || typeof value.target.path !== "string") return null;
  const target: InvestigationRequest["target"] = { path: value.target.path };
  if (value.target.symbol !== undefined) {
    if (typeof value.target.symbol !== "string") return null;
    target.symbol = value.target.symbol;
  }
  if (value.target.line_start !== undefined || value.target.line_end !== undefined) {
    if (typeof value.target.line_start !== "number" || typeof value.target.line_end !== "number") return null;
    target.line_start = value.target.line_start;
    target.line_end = value.target.line_end;
  }
  return { repository_id: value.repository_id, target, question: value.question };
}

export function parseSession(raw: string | null): StoredSession | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const request = validRequest(value.request);
  if (request === null) return null;
  const checked = validateResponse(value.result);
  if (!checked.ok) return null;
  // A restored report is only offered for a result that is not a failed retrieval.
  if (checked.result.retrieval_status === "FAILED") return null;
  return { request, result: checked.result };
}

function safeSessionStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function loadSession(storage: Pick<Storage, "getItem" | "removeItem"> | undefined = safeSessionStorage()): StoredSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_KEY);
    const parsed = parseSession(raw);
    if (raw !== null && parsed === null) storage.removeItem(SESSION_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession, storage: Pick<Storage, "setItem"> | undefined = safeSessionStorage()): void {
  try {
    storage?.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage can be full or blocked. The report then lasts for this page only.
  }
}

export function clearSession(storage: Pick<Storage, "removeItem"> | undefined = safeSessionStorage()): void {
  try {
    storage?.removeItem(SESSION_KEY);
  } catch {
    // Nothing to clear.
  }
}
