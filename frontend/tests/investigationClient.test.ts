import { describe, expect, it, vi } from "vitest";
import { submitInvestigation, toBackendError } from "../src/services/investigationClient";
import { ambiguous, clone, complete, failed, insufficient, notRegistered, partial, traversal, unknownField } from "./fixtures";

function response(status: number, body: unknown, raw?: string): Response {
  return new Response(raw ?? JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const REQUEST = complete().request;

describe("successful responses", () => {
  it.each([
    ["complete", complete],
    ["partial", partial],
    ["insufficient", insufficient],
  ])("returns the validated %s result", async (_name, load) => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, load().body));
    const outcome = await submitInvestigation(REQUEST, { fetchImpl });
    expect(outcome.kind).toBe("result");
    if (outcome.kind === "result") {
      expect(outcome.result.retrieval_status).toBe(load().body.retrieval_status);
      expect(outcome.result.epistemic_classification).toBe(load().body.epistemic_classification);
    }
  });

  it("returns a FAILED retrieval as a result for the machine to classify, not as a transport error", async () => {
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(200, failed().body)) });
    expect(outcome.kind).toBe("result");
    if (outcome.kind === "result") expect(outcome.result.retrieval_status).toBe("FAILED");
  });
});

describe("the request", () => {
  it("posts JSON to /api/investigations once, with no credentials and no cache", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, complete().body));
    await submitInvestigation(REQUEST, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/investigations");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
  });

  it("honors a different base URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, complete().body));
    await submitInvestigation(REQUEST, { fetchImpl, baseUrl: "/other" });
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe("/other/investigations");
  });

  it("sends no Authorization header and no token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, complete().body));
    await submitInvestigation(REQUEST, { fetchImpl });
    const init = (fetchImpl.mock.calls[0] as [string, RequestInit])[1];
    expect(JSON.stringify(init.headers).toLowerCase()).not.toContain("authorization");
  });
});

describe("failures", () => {
  it.each([
    ["not registered", 404, notRegistered],
    ["traversal", 400, traversal],
    ["unknown field", 400, unknownField],
    ["ambiguous", 409, ambiguous],
  ])("maps a %s response to a rejected request", async (_name, status, load) => {
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(status, load().body)) });
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind === "rejected") {
      expect(outcome.status).toBe(status);
      expect(outcome.error.code).toBe(load().body.code);
      expect(outcome.error.message).toBe(load().body.message);
    }
  });

  it("keeps ambiguity candidates and field names", async () => {
    const a = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(409, ambiguous().body)) });
    if (a.kind === "rejected") expect(a.error.candidates).toEqual(["A.run", "B.run"]);
    const u = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(400, unknownField().body)) });
    if (u.kind === "rejected") expect(u.error.field).toBe("retrieval_status");
  });

  it("maps a thrown fetch to a network failure", async () => {
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) });
    expect(outcome).toEqual({ kind: "network" });
  });

  it("maps an abort to aborted, never to an error", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException("aborted", "AbortError"));
    });
    expect(await submitInvestigation(REQUEST, { fetchImpl, signal: controller.signal })).toEqual({ kind: "aborted" });
  });

  it("maps an invalid 200 body to invalid", async () => {
    const body = clone(complete().body) as unknown as Record<string, unknown>;
    body.retrieval_status = "MAYBE";
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(200, body)) });
    expect(outcome.kind).toBe("invalid");
  });

  it("maps a 200 body that is not JSON to invalid", async () => {
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(200, null, "<html>proxy error</html>")) });
    expect(outcome).toEqual({ kind: "invalid", reason: "body: not JSON" });
  });

  it("maps a non-JSON error body to a generic rejection that carries no backend text", async () => {
    const outcome = await submitInvestigation(REQUEST, { fetchImpl: vi.fn().mockResolvedValue(response(502, null, "<html>Bad gateway: secret-internal-host</html>")) });
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind === "rejected") {
      expect(JSON.stringify(outcome.error)).not.toContain("secret-internal-host");
      expect(outcome.error.code).toBe("INTERNAL_ERROR");
    }
  });
});

describe("toBackendError", () => {
  it("parses a well-formed error", () => {
    expect(toBackendError(404, { code: "X", message: "m", retryable: true })).toEqual({ code: "X", message: "m", retryable: true, field: null, candidates: [] });
  });

  it("ignores wrongly typed optional parts", () => {
    const parsed = toBackendError(400, { code: "X", message: "m", field: 5, candidates: [1, "ok", null], retryable: "yes" });
    expect(parsed).toEqual({ code: "X", message: "m", retryable: false, field: null, candidates: ["ok"] });
  });

  it("falls back for an unknown shape", () => {
    expect(toBackendError(500, "boom").code).toBe("INTERNAL_ERROR");
    expect(toBackendError(418, { nope: 1 }).code).toBe("HTTP_ERROR");
  });
});
