/**
 * Client for POST /investigations (backend/app/api/app.py).
 *
 * One call per submission. The request body is built by the caller from a typed InvestigationRequest, so no other field
 * can be sent. The response is mapped into a closed set of outcomes:
 *
 *   result   a 200 body that passed validateResponse
 *   invalid  a 200 body that failed validation (shown as "could not be validated", never as a conclusion)
 *   rejected a non-200 BackendError (category B, no retrieval status)
 *   network  the request did not complete (never described as missing evidence)
 *   aborted  the caller cancelled
 *
 * The client holds no credential and reads no environment value. The default base path "/api" is proxied to the backend
 * by the Vite dev server, because the backend has no CORS configuration.
 */

import type { BackendError, InvestigationRequest, InvestigationResult } from "../types/contract";
import { validateResponse } from "../features/investigation/validateResponse";

export type SubmitOutcome =
  | { kind: "result"; result: InvestigationResult }
  | { kind: "invalid"; reason: string }
  | { kind: "rejected"; status: number; error: BackendError }
  | { kind: "network" }
  | { kind: "aborted" };

export interface SubmitOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type SubmitFn = (request: InvestigationRequest, options?: SubmitOptions) => Promise<SubmitOutcome>;

export const DEFAULT_BASE_URL = "/api";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a BackendError body defensively. Unknown shapes become a generic error that carries no backend text. */
export function toBackendError(status: number, body: unknown): BackendError {
  if (isRecord(body) && typeof body.code === "string" && typeof body.message === "string") {
    return {
      code: body.code,
      message: body.message,
      retryable: body.retryable === true,
      field: typeof body.field === "string" ? body.field : null,
      candidates: Array.isArray(body.candidates) ? body.candidates.filter((c): c is string => typeof c === "string") : [],
    };
  }
  return {
    code: status >= 500 ? "INTERNAL_ERROR" : "HTTP_ERROR",
    message: `The backend returned HTTP ${status}.`,
    retryable: false,
    field: null,
    candidates: [],
  };
}

export const submitInvestigation: SubmitFn = async (request, options = {}) => {
  const { signal, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch } = options;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}/investigations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(request),
      signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (caught) {
    if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return { kind: "aborted" };
    return { kind: "network" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (caught) {
    if (signal?.aborted || (caught instanceof DOMException && caught.name === "AbortError")) return { kind: "aborted" };
    if (response.status === 200) return { kind: "invalid", reason: "body: not JSON" };
    return { kind: "rejected", status: response.status, error: toBackendError(response.status, null) };
  }

  if (response.status === 200) {
    const checked = validateResponse(body);
    return checked.ok ? { kind: "result", result: checked.result } : { kind: "invalid", reason: checked.reason };
  }
  return { kind: "rejected", status: response.status, error: toBackendError(response.status, body) };
};
