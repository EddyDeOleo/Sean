/**
 * Investigation form model: early client-side feedback and the exact request body.
 *
 * The rules below mirror the backend's input rules (canonical contract C.3 and C.3a, backend/app/modules/repository/paths.py,
 * backend/app/modules/symbol_resolution/validation.py) so that an obviously invalid request gets feedback before it is sent.
 * They are a convenience. The backend is authoritative: it can reject what passes here, and its `field` errors are shown at
 * the matching input. The question cap is a client-only usability limit. The backend does not interpret the question.
 */

import type { InvestigationRequest } from "../../types/contract";

export const REPOSITORY_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const MAX_PATH_LENGTH = 1024;
export const MAX_SYMBOL_LENGTH = 256;
export const MAX_LINE_SPAN = 2000;
export const MAX_QUESTION_LENGTH = 500;

export interface FormValues {
  repositoryId: string;
  path: string;
  symbol: string;
  lineStart: string;
  lineEnd: string;
  question: string;
}

export const EMPTY_FORM: FormValues = { repositoryId: "", path: "", symbol: "", lineStart: "", lineEnd: "", question: "" };

export type FieldName = keyof FormValues;
export type FormErrors = Partial<Record<FieldName, string>>;

const RESERVED_STEMS = new Set([
  "CON", "PRN", "AUX", "NUL", "CONIN$", "CONOUT$",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

function pathError(raw: string): string | null {
  if (raw.length === 0) return "Enter a repository-relative path, for example src/billing.py.";
  if (raw.length > MAX_PATH_LENGTH) return `The path is longer than ${MAX_PATH_LENGTH} characters.`;
  const text = raw.replaceAll("\\", "/");
  if (text.startsWith("/")) return "The path must be relative to the repository root.";
  if (text.includes(":")) return "The path cannot contain a colon.";
  if (CONTROL.test(text)) return "The path contains a control character.";
  for (const segment of text.split("/")) {
    if (segment === "" || segment === "." || segment === "..") return "The path cannot contain empty, '.' or '..' segments.";
    if (segment.endsWith(".") || segment.endsWith(" ")) return "A path segment cannot end with a dot or a space.";
    if (RESERVED_STEMS.has((segment.split(".", 1)[0] ?? "").trimEnd().toUpperCase())) return "A path segment uses a reserved device name.";
  }
  return null;
}

function symbolError(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length > MAX_SYMBOL_LENGTH) return `The symbol is longer than ${MAX_SYMBOL_LENGTH} characters.`;
  if (CONTROL.test(value)) return "The symbol contains a control character.";
  if (value.split(".").some((part) => part === "")) return "The symbol cannot contain empty parts.";
  return null;
}

function parseLine(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
}

export function validateForm(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  const repositoryId = values.repositoryId.trim();
  if (repositoryId.length === 0) errors.repositoryId = "Enter the identifier of a registered repository.";
  else if (!REPOSITORY_ID_PATTERN.test(repositoryId)) {
    errors.repositoryId = "Use lowercase letters, digits, hyphens and underscores, starting with a letter or digit (64 characters at most).";
  }

  const path = pathError(values.path.trim());
  if (path) errors.path = path;

  const symbol = symbolError(values.symbol.trim());
  if (symbol) errors.symbol = symbol;

  const start = values.lineStart.trim();
  const end = values.lineEnd.trim();
  if (start !== "" || end !== "") {
    if (start === "" || end === "") {
      errors[start === "" ? "lineStart" : "lineEnd"] = "Enter both line numbers, or leave both empty.";
    } else {
      const a = parseLine(start);
      const b = parseLine(end);
      if (a === null) errors.lineStart = "Use a whole number of 1 or more.";
      if (b === null) errors.lineEnd = "Use a whole number of 1 or more.";
      if (a !== null && b !== null) {
        if (a > b) errors.lineEnd = "The end line cannot be before the start line.";
        else if (b - a + 1 > MAX_LINE_SPAN) errors.lineEnd = `The range cannot span more than ${MAX_LINE_SPAN} lines.`;
      }
    }
  }

  const question = values.question.trim();
  if (question.length === 0) errors.question = "Ask a question about the repository.";
  else if (question.length > MAX_QUESTION_LENGTH) errors.question = `Keep the question to ${MAX_QUESTION_LENGTH} characters or fewer.`;
  return errors;
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** Build the exact request body. Call only after validateForm returns no errors. */
export function buildRequest(values: FormValues): InvestigationRequest {
  const target: InvestigationRequest["target"] = { path: values.path.trim() };
  const symbol = values.symbol.trim();
  if (symbol !== "") target.symbol = symbol;
  if (values.lineStart.trim() !== "" && values.lineEnd.trim() !== "") {
    target.line_start = Number(values.lineStart.trim());
    target.line_end = Number(values.lineEnd.trim());
  }
  return { repository_id: values.repositoryId.trim(), target, question: values.question.trim() };
}

/** Map a backend `field` name (for example "target.path") to the form input that holds it. */
export function fieldForBackendField(field: string | null): FieldName | null {
  switch (field) {
    case "repository_id":
      return "repositoryId";
    case "target.path":
      return "path";
    case "target.symbol":
      return "symbol";
    case "target.line_start":
      return "lineStart";
    case "target.line_end":
      return "lineEnd";
    case "question":
      return "question";
    default:
      return null;
  }
}

/** Rebuild form values from a stored request. */
export function valuesFromRequest(request: InvestigationRequest): FormValues {
  return {
    repositoryId: request.repository_id,
    path: request.target.path,
    symbol: request.target.symbol ?? "",
    lineStart: request.target.line_start === undefined ? "" : String(request.target.line_start),
    lineEnd: request.target.line_end === undefined ? "" : String(request.target.line_end),
    question: request.question,
  };
}
