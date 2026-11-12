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
