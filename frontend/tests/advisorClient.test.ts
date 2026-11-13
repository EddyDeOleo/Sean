import { describe, expect, it, vi } from "vitest";
import { fetchProfile, getCapabilities, interpretRequest, listRepositories } from "../src/services/advisorClient";
import { capabilitiesFixture, clone, interpretInvestigate, profileNotRegistered, profileRich, repositoriesFixture } from "./fixtures";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function fetcher(response: Response | (() => Promise<Response>)) {
  return vi.fn<typeof fetch>(async () => (typeof response === "function" ? response() : response));
}

describe("request shapes", () => {
  it("lists repositories with GET and no body", async () => {
    const f = fetcher(json(200, repositoriesFixture().body));
    const outcome = await listRepositories({ fetchImpl: f, baseUrl: "/api" });
    expect(outcome.kind).toBe("ok");
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe("/api/repositories");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.credentials).toBe("omit");
  });

  it("profiles with POST and no body, and encodes the identifier", async () => {
    const f = fetcher(json(200, profileRich().body));
    await fetchProfile("rich", { fetchImpl: f });
    expect(f.mock.calls[0]![0]).toBe("/api/repositories/rich/profile");
    expect(f.mock.calls[0]![1]?.body).toBeUndefined();
    const g = fetcher(json(404, profileNotRegistered().body));
    await fetchProfile("a/../b?x", { fetchImpl: g });
    expect(g.mock.calls[0]![0]).toBe("/api/repositories/a%2F..%2Fb%3Fx/profile");
  });

  it("sends the sentence and the selected repository, and nothing else", async () => {
    const f = fetcher(json(200, interpretInvestigate().body));
    await interpretRequest({ text: "sean - why?", selected_repository_id: "sean" }, { fetchImpl: f });
    expect(JSON.parse(f.mock.calls[0]![1]?.body as string)).toEqual({ text: "sean - why?", selected_repository_id: "sean" });
    const g = fetcher(json(200, interpretInvestigate().body));
    await interpretRequest({ text: "why?", selected_repository_id: null }, { fetchImpl: g });
    expect(JSON.parse(g.mock.calls[0]![1]?.body as string)).toEqual({ text: "why?" });
  });

  it("sends consent only when it is explicitly true", async () => {
    for (const [allow, expected] of [[true, true], [false, undefined], [undefined, undefined]] as const) {
      const f = fetcher(json(200, interpretInvestigate().body));
      await interpretRequest({ text: "x", selected_repository_id: null, allow_ai: allow }, { fetchImpl: f });
      expect(JSON.parse(f.mock.calls[0]![1]?.body as string).allow_ai).toBe(expected);
    }
  });

  it("reads capabilities with GET and no body", async () => {
    const f = fetcher(json(200, capabilitiesFixture().body));
    const outcome = await getCapabilities({ fetchImpl: f });
    expect(outcome.kind).toBe("ok");
    expect(f.mock.calls[0]![0]).toBe("/api/capabilities");
    expect(f.mock.calls[0]![1]?.method).toBe("GET");
  });
});

describe("outcomes", () => {
  it("ok for a valid body", async () => {
    const outcome = await fetchProfile("rich", { fetchImpl: fetcher(json(200, profileRich().body)) });
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") expect(outcome.value.profile.repository_id).toBe("rich");
  });

  it("invalid for a 200 body that breaks the contract, with no data passed on", async () => {
    const body = clone(profileRich().body);
    body.advisor.recommendations[0]!.evidence_references = ["obs-forged"];
    body.advisor.recommendations[0]!.recommendation_status = "ADOPT_NOW";
    const outcome = await fetchProfile("rich", { fetchImpl: fetcher(json(200, body)) });
    expect(outcome.kind).toBe("invalid");
    expect(outcome).not.toHaveProperty("value");
  });

  it("invalid for a 200 body that is not JSON", async () => {
    const outcome = await fetchProfile("rich", { fetchImpl: fetcher(new Response("<html>", { status: 200 })) });
    expect(outcome).toEqual({ kind: "invalid", reason: "body: not JSON" });
  });

  it("rejected for an error body, keeping the backend code and message", async () => {
    const outcome = await fetchProfile("missing", { fetchImpl: fetcher(json(404, profileNotRegistered().body)) });
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind === "rejected") {
      expect(outcome.status).toBe(404);
      expect(outcome.error.code).toBe("REPOSITORY_NOT_FOUND");
    }
  });

  it("rejected with a generic error for a non-JSON failure", async () => {
    const outcome = await fetchProfile("x", { fetchImpl: fetcher(new Response("Bad gateway", { status: 502 })) });
    expect(outcome.kind).toBe("rejected");
    if (outcome.kind === "rejected") expect(outcome.error.code).toBe("INTERNAL_ERROR");
  });

  it("network when the request fails, and never as an empty result", async () => {
    const outcome = await listRepositories({ fetchImpl: vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("failed"))) });
    expect(outcome).toEqual({ kind: "network" });
  });

  it("aborted when the caller cancels", async () => {
    const controller = new AbortController();
    const f = vi.fn<typeof fetch>((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const pending = fetchProfile("rich", { fetchImpl: f, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ kind: "aborted" });
  });
});
