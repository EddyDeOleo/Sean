/**
 * Loaders for the fixtures captured from the real backend (scripts/capture_frontend_fixtures.py).
 * Nothing here is hand-written backend output.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BackendError, InvestigationRequest, InvestigationResult } from "../src/types/contract";

export interface CapturedFixture<T = unknown> {
  name: string;
  request: InvestigationRequest;
  status: number;
  body: T;
}

export function fixture<T = unknown>(name: string): CapturedFixture<T> {
  const path = resolve(__dirname, "fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf-8")) as CapturedFixture<T>;
}

export const complete = (): CapturedFixture<InvestigationResult> => fixture("complete");
export const completeNoSymbol = (): CapturedFixture<InvestigationResult> => fixture("complete-no-symbol");
export const partial = (): CapturedFixture<InvestigationResult> => fixture("partial-shallow");
export const insufficient = (): CapturedFixture<InvestigationResult> => fixture("insufficient");
export const failed = (): CapturedFixture<InvestigationResult> => fixture("failed-broken");
export const ambiguous = (): CapturedFixture<BackendError> => fixture("ambiguous");
export const notRegistered = (): CapturedFixture<BackendError> => fixture("not-registered");
export const traversal = (): CapturedFixture<BackendError> => fixture("traversal");
export const unknownField = (): CapturedFixture<BackendError> => fixture("unknown-field");

/** A deep copy, so a test can mutate it without touching another test's data. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---- repository-intelligence fixtures (captured from the real backend by scripts/capture_frontend_fixtures.py)
import type { InterpretedRequest, ProfileResponse, RepositoryListItem } from "../src/types/advisor";

export const profileRich = (): CapturedFixture<ProfileResponse> => fixture("advisor-profile-rich");
export const profileSample = (): CapturedFixture<ProfileResponse> => fixture("advisor-profile-sample");
export const profileShallow = (): CapturedFixture<ProfileResponse> => fixture("advisor-profile-shallow");
export const profileNotRegistered = (): CapturedFixture<BackendError> => fixture("advisor-profile-not-registered");
export const repositoriesFixture = (): CapturedFixture<{ repositories: RepositoryListItem[] }> => fixture("advisor-repositories");
export const interpretInvestigate = (): CapturedFixture<InterpretedRequest> => fixture("advisor-interpret-investigate");
export const interpretAdvise = (): CapturedFixture<InterpretedRequest> => fixture("advisor-interpret-advise");
export const interpretNeedsTarget = (): CapturedFixture<InterpretedRequest> => fixture("advisor-interpret-needs-target");
export const interpretUnresolved = (): CapturedFixture<InterpretedRequest> => fixture("advisor-interpret-unresolved");
export const capabilitiesFixture = (): CapturedFixture<{ ai_interpreter: { available: boolean; provider: string; model: string; sends: string } }> => fixture("advisor-capabilities");
export const artifactsRich = (): CapturedFixture<import("../src/types/advisor").PreviewResponse> => fixture("advisor-artifacts-rich");
