import { describe, expect, it } from "vitest";
import {
  EMPTY_FORM,
  MAX_LINE_SPAN,
  MAX_PATH_LENGTH,
  MAX_QUESTION_LENGTH,
  MAX_SYMBOL_LENGTH,
  buildRequest,
  fieldForBackendField,
  hasErrors,
  validateForm,
  valuesFromRequest,
  type FormValues,
} from "../src/features/investigation/formModel";

const VALID: FormValues = { repositoryId: "sample", path: "src/billing.py", symbol: "charge", lineStart: "", lineEnd: "", question: "Why?" };
const with_ = (patch: Partial<FormValues>): FormValues => ({ ...VALID, ...patch });

describe("form validation", () => {
  it("accepts a complete valid form", () => {
    expect(validateForm(VALID)).toEqual({});
    expect(hasErrors(validateForm(VALID))).toBe(false);
  });

  it("reports every empty required field", () => {
    const errors = validateForm(EMPTY_FORM);
    expect(Object.keys(errors).sort()).toEqual(["path", "question", "repositoryId"]);
  });

  it.each(["Sample", "-lead", "has space", "a".repeat(65), "dots.here", "ünï"])("rejects repository id %j", (repositoryId) => {
    expect(validateForm(with_({ repositoryId })).repositoryId).toBeDefined();
  });

  it.each(["a", "0", "a-b_c", "a".repeat(64)])("accepts repository id %j", (repositoryId) => {
    expect(validateForm(with_({ repositoryId })).repositoryId).toBeUndefined();
  });

  it.each([
    ["/etc/passwd", "relative"],
    ["\\\\server\\share", "relative"],
    ["C:\\Windows", "colon"],
    ["src/../secret.py", "segments"],
    ["../outside.py", "segments"],
    ["./a.py", "segments"],
    ["a//b.py", "segments"],
    ["a/b.py/", "segments"],
    ["src/file.", "dot"],
    ["src/file /a.py", "space"],
    ["src/NUL.txt", "reserved"],
    ["con", "reserved"],
    ["src/a\u0000b.py", "control"],
    ["src/a\tb.py", "control"],
  ])("rejects path %j", (path) => {
    expect(validateForm(with_({ path })).path).toBeDefined();
  });

  it.each(["src/billing.py", "a.py", "docs/guide/intro.md", "src\\billing.py", "src/[id].tsx", "src/ünï.py"])("accepts path %j", (path) => {
    expect(validateForm(with_({ path })).path).toBeUndefined();
  });

  it("rejects a path over the length bound and accepts one at the bound", () => {
    expect(validateForm(with_({ path: "a".repeat(MAX_PATH_LENGTH + 1) })).path).toBeDefined();
    expect(validateForm(with_({ path: "a".repeat(MAX_PATH_LENGTH) })).path).toBeUndefined();
  });

  it("checks the symbol length, control characters, and empty parts", () => {
    expect(validateForm(with_({ symbol: "x".repeat(MAX_SYMBOL_LENGTH + 1) })).symbol).toBeDefined();
    expect(validateForm(with_({ symbol: "x".repeat(MAX_SYMBOL_LENGTH) })).symbol).toBeUndefined();
    expect(validateForm(with_({ symbol: "a\nb" })).symbol).toBeDefined();
    expect(validateForm(with_({ symbol: "A..b" })).symbol).toBeDefined();
    expect(validateForm(with_({ symbol: ".a" })).symbol).toBeDefined();
    expect(validateForm(with_({ symbol: "Billing.charge" })).symbol).toBeUndefined();
    expect(validateForm(with_({ symbol: "" })).symbol).toBeUndefined();
  });

  it("requires both line numbers or neither", () => {
    expect(validateForm(with_({ lineStart: "3" })).lineEnd).toBeDefined();
    expect(validateForm(with_({ lineEnd: "3" })).lineStart).toBeDefined();
    expect(validateForm(with_({ lineStart: "3", lineEnd: "9" }))).toEqual({});
  });

  it.each([["0", "5"], ["-1", "5"], ["1.5", "5"], ["a", "5"], ["1", "b"], ["", "5"]])("rejects lines %j to %j", (lineStart, lineEnd) => {
    expect(hasErrors(validateForm(with_({ lineStart, lineEnd })))).toBe(true);
  });

  it("rejects a reversed range and a range over the span bound, and accepts the bound", () => {
    expect(validateForm(with_({ lineStart: "9", lineEnd: "3" })).lineEnd).toBeDefined();
    expect(validateForm(with_({ lineStart: "1", lineEnd: String(MAX_LINE_SPAN + 1) })).lineEnd).toBeDefined();
    expect(validateForm(with_({ lineStart: "1", lineEnd: String(MAX_LINE_SPAN) }))).toEqual({});
    expect(validateForm(with_({ lineStart: "5", lineEnd: "5" }))).toEqual({});
  });

  it("limits the question", () => {
    expect(validateForm(with_({ question: "   " })).question).toBeDefined();
    expect(validateForm(with_({ question: "q".repeat(MAX_QUESTION_LENGTH + 1) })).question).toBeDefined();
    expect(validateForm(with_({ question: "q".repeat(MAX_QUESTION_LENGTH) })).question).toBeUndefined();
  });
});

describe("request building", () => {
  it("sends exactly the contract fields and trims whitespace", () => {
    const request = buildRequest({ repositoryId: " sample ", path: " src/billing.py ", symbol: " charge ", lineStart: " 3 ", lineEnd: " 9 ", question: " Why? " });
    expect(request).toEqual({ repository_id: "sample", target: { path: "src/billing.py", symbol: "charge", line_start: 3, line_end: 9 }, question: "Why?" });
    expect(Object.keys(request).sort()).toEqual(["question", "repository_id", "target"]);
  });

  it("omits optional fields that are empty", () => {
    const request = buildRequest(VALID);
    expect(Object.keys(request.target)).toEqual(["path", "symbol"]);
    const bare = buildRequest(with_({ symbol: "" }));
    expect(bare.target).toEqual({ path: "src/billing.py" });
  });

  it("never includes a backend-owned field", () => {
    const text = JSON.stringify(buildRequest(VALID));
    for (const name of ["retrieval_status", "epistemic_classification", "conclusion", "revision"]) expect(text).not.toContain(name);
  });

  it("round-trips through valuesFromRequest", () => {
    const request = buildRequest({ ...VALID, lineStart: "2", lineEnd: "4" });
    expect(buildRequest(valuesFromRequest(request))).toEqual(request);
  });
});

describe("backend field mapping", () => {
  it("maps each backend field to its input", () => {
    expect(fieldForBackendField("repository_id")).toBe("repositoryId");
    expect(fieldForBackendField("target.path")).toBe("path");
    expect(fieldForBackendField("target.symbol")).toBe("symbol");
    expect(fieldForBackendField("target.line_start")).toBe("lineStart");
    expect(fieldForBackendField("target.line_end")).toBe("lineEnd");
    expect(fieldForBackendField("question")).toBe("question");
  });

  it("returns null for an unknown or missing field", () => {
    expect(fieldForBackendField(null)).toBeNull();
    expect(fieldForBackendField("retrieval_status")).toBeNull();
  });
});
