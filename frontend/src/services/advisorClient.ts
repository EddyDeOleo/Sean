/**
 * Client for the repository-intelligence endpoints (Spec 4 section 4.2).
 *
 * Same outcome model as the investigation client: `ok` (a validated body), `invalid` (a 200 body that failed validation),
 * `rejected` (a BackendError), `network`, and `aborted`. A failure is never turned into an empty result, so a network error
 * is never shown as "nothing found".
 */

import type { Capabilities, InterpretedRequest, PreviewResponse, ProfileResponse, RepositoryListItem } from "../types/advisor";
import type { BackendError } from "../types/contract";
import {
  validateCapabilities,
  validateInterpreted,
  validatePreviewResponse,
  validateProfileResponse,
  validateRemoved,
  validateRepositories,
  validateRepositoryItem,
  type Validated,
} from "../features/analysis/validateAdvisor";
import { DEFAULT_BASE_URL, toBackendError } from "./investigationClient";

export type CallOutcome<T> =
  | { kind: "ok"; value: T }
  | { kind: "invalid"; reason: string }
  | { kind: "rejected"; status: number; error: BackendError }
  | { kind: "network" }
  | { kind: "aborted" };

export interface CallOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export type ListRepositoriesFn = (options?: CallOptions) => Promise<CallOutcome<RepositoryListItem[]>>;
export type CapabilitiesFn = (options?: CallOptions) => Promise<CallOutcome<Capabilities>>;
export type InterpretFn = (
  body: { text: string; selected_repository_id: string | null; allow_ai?: boolean },
  options?: CallOptions,
) => Promise<CallOutcome<InterpretedRequest>>;
export type PreviewBody = { repository_id: string; capabilities: string[]; verify?: { path: string; content_sha256: string }[] };
export type PreviewFn = (body: PreviewBody, options?: CallOptions) => Promise<CallOutcome<PreviewResponse>>;
export type ProfileFn = (repositoryId: string, options?: CallOptions) => Promise<CallOutcome<ProfileResponse>>;

function isAbort(caught: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted) || (caught instanceof DOMException && caught.name === "AbortError");
}

async function call<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body: unknown,
  validate: (raw: unknown) => Validated<T>,
  options: CallOptions,
  successStatus = 200,
): Promise<CallOutcome<T>> {
  const { signal, baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch } = options;
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        // Every call that is not a read says it comes from the application. The backend refuses changes to the repository
        // list without it, which keeps a web page on another origin from making them.
        ...(method !== "GET" ? { "X-Sean-Client": "web" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      credentials: "omit",
      cache: "no-store",
    });
  } catch (caught) {
    return isAbort(caught, signal) ? { kind: "aborted" } : { kind: "network" };
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (caught) {
    if (isAbort(caught, signal)) return { kind: "aborted" };
    if (response.status === successStatus) return { kind: "invalid", reason: "body: not JSON" };
    return { kind: "rejected", status: response.status, error: toBackendError(response.status, null) };
  }
  if (response.status !== successStatus) return { kind: "rejected", status: response.status, error: toBackendError(response.status, parsed) };
  const checked = validate(parsed);
  return checked.ok ? { kind: "ok", value: checked.value } : { kind: "invalid", reason: checked.reason };
}

export const listRepositories: ListRepositoriesFn = (options = {}) =>
  call("GET", "/repositories", undefined, validateRepositories, options);

export const getCapabilities: CapabilitiesFn = (options = {}) => call("GET", "/capabilities", undefined, validateCapabilities, options);

export const interpretRequest: InterpretFn = (body, options = {}) =>
  call(
    "POST",
    "/interpret",
    {
      text: body.text,
      ...(body.selected_repository_id ? { selected_repository_id: body.selected_repository_id } : {}),
      // Consent is explicit and per request. Absent means no.
      ...(body.allow_ai === true ? { allow_ai: true } : {}),
    },
    validateInterpreted,
    options,
  );

export const fetchProfile: ProfileFn = (repositoryId, options = {}) =>
  call("POST", `/repositories/${encodeURIComponent(repositoryId)}/profile`, undefined, validateProfileResponse, options);

export const previewArtifacts: PreviewFn = (body, options = {}) => call("POST", "/artifacts/preview", body, validatePreviewResponse, options);

// --- repository registration (the Repositories page) ---------------------------------------------------------------------

/** What the user types to register a repository. The backend validates every field again. */
export interface RepositoryInput {
  repository_id: string;
  display_name: string;
  path: string;
}
export type EditableRepository = Pick<RepositoryInput, "display_name" | "path">;

export type CreateRepositoryFn = (body: RepositoryInput, options?: CallOptions) => Promise<CallOutcome<RepositoryListItem>>;
export type UpdateRepositoryFn = (repositoryId: string, body: EditableRepository, options?: CallOptions) => Promise<CallOutcome<RepositoryListItem>>;
export type DeleteRepositoryFn = (repositoryId: string, options?: CallOptions) => Promise<CallOutcome<{ removed: string }>>;

export const createRepository: CreateRepositoryFn = (body, options = {}) =>
  call("POST", "/repositories", { repository_id: body.repository_id, display_name: body.display_name, path: body.path }, validateRepositoryItem, options, 201);

export const updateRepository: UpdateRepositoryFn = (repositoryId, body, options = {}) =>
  call("PUT", `/repositories/${encodeURIComponent(repositoryId)}`, { display_name: body.display_name, path: body.path }, validateRepositoryItem, options);

/** Removes only the registration. The repository's folder is never touched. */
export const deleteRepository: DeleteRepositoryFn = (repositoryId, options = {}) =>
  call("DELETE", `/repositories/${encodeURIComponent(repositoryId)}`, undefined, validateRemoved, options);
