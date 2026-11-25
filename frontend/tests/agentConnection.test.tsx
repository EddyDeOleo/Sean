/**
 * Sean Local + Web: how the frontend reaches the local agent (src/services/agentConnection.ts) and the Settings card that pairs
 * with it (src/components/shell/AgentConnection.tsx). Development keeps the Vite proxy; production calls the agent directly.
 */
import { describe, expect, it, vi } from "vitest";
import { AgentConnection } from "../src/components/shell/AgentConnection";
import {
  AGENT_URL,
  DEV_BASE_URL,
  TOKEN_KEY,
  agentBaseUrl,
  agentReady,
  completePairing,
  createAgentFetch,
  loopbackPermission,
  readToken,
  startPairing,
} from "../src/services/agentConnection";
import { DEFAULT_BASE_URL } from "../src/services/investigationClient";
import { click, flush, render, type } from "./renderHelpers";

const tid = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** A fake agent: status, pairing with one code, and a protected route. Records every request. */
function fakeAgent(options: { code?: string; reachable?: boolean } = {}) {
  const code = options.code ?? "ABCDEFGH";
  const token = "t".repeat(43);
  const calls: Array<{ url: string; init: RequestInit & { targetAddressSpace?: string } }> = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init: init as RequestInit & { targetAddressSpace?: string } });
    if (options.reachable === false) throw new TypeError("Failed to fetch");
    const url = String(input);
    const auth = new Headers(init.headers).get("Authorization");
    if (url.endsWith("/agent/status")) return json(200, { agent: "sean", pairing_required: true, paired: auth === `Bearer ${token}` });
    if (url.endsWith("/pair/start")) return json(200, { expires_in: 120 });
    if (url.endsWith("/pair/complete")) {
      const sent = JSON.parse(String(init.body)) as { code: string };
      return sent.code.replace("-", "").toUpperCase() === code
        ? json(200, { token, expires_in: 43200 })
        : json(400, { code: "PAIRING_CODE_INVALID", message: "The pairing code is not correct.", retryable: false });
    }
    return auth === `Bearer ${token}` ? json(200, { repositories: [] }) : json(401, { code: "AGENT_UNAUTHORIZED", message: "Not paired.", retryable: false });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, token };
}

describe("the agent address", () => {
  it("lets a production build contact the agent on its own only once the session holds a token", () => {
    const storage = new Map<string, string>();
    const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => void storage.set(k, v), removeItem: (k: string) => void storage.delete(k) };
    expect(agentReady(true, store)).toBe(true);
    expect(agentReady(false, store)).toBe(false);
    store.setItem(TOKEN_KEY, "t".repeat(43));
    expect(agentReady(false, store)).toBe(true);
  });

  it("is the Vite proxy in development and the local agent in a production build", () => {
    expect(agentBaseUrl(true)).toBe(DEV_BASE_URL);
    expect(agentBaseUrl(false)).toBe(AGENT_URL);
    expect(AGENT_URL).toBe("http://127.0.0.1:8000");
    // The tests run as a development build, so the existing clients still use /api.
    expect(DEFAULT_BASE_URL).toBe("/api");
  });
});

describe("the agent fetch", () => {
  it("leaves development requests unchanged", async () => {
    const agent = fakeAgent();
    window.sessionStorage.setItem(TOKEN_KEY, agent.token);
    await createAgentFetch({ dev: true, baseFetch: agent.fetchImpl })("/api/repositories", { method: "GET" });
    const sent = agent.calls[0]!.init;
    expect(sent.targetAddressSpace).toBeUndefined();
    expect(new Headers(sent.headers).get("Authorization")).toBeNull();
  });

  it("makes production requests CORS requests to the loopback space, with the token once paired", async () => {
    const agent = fakeAgent();
    const call = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    await call(`${AGENT_URL}/agent/status`, { method: "GET", credentials: "include" });
    let sent = agent.calls[0]!.init;
    expect(sent.targetAddressSpace).toBe("loopback");
    expect(sent.mode).toBe("cors");
    expect(sent.credentials).toBe("omit");
    expect(new Headers(sent.headers).get("Authorization")).toBeNull();
    window.sessionStorage.setItem(TOKEN_KEY, agent.token);
    await call(`${AGENT_URL}/repositories`, { method: "POST", headers: { "X-Sean-Client": "web" } });
    sent = agent.calls[1]!.init;
    expect(new Headers(sent.headers).get("Authorization")).toBe(`Bearer ${agent.token}`);
    expect(new Headers(sent.headers).get("X-Sean-Client")).toBe("web");
  });

  it("sends nothing but the pairing calls before pairing, and answers the others as not paired", async () => {
    const agent = fakeAgent();
    const call = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    for (const path of ["/interpret", "/repositories", "/repositories/sample/profile", "/investigations", "/capabilities"]) {
      const response = await call(`${AGENT_URL}${path}`, { method: "POST" });
      expect(response.status).toBe(401);
      expect(((await response.json()) as { code: string }).code).toBe("AGENT_NOT_PAIRED");
    }
    expect(agent.calls).toHaveLength(0);
    for (const path of ["/agent/status", "/pair/start", "/pair/complete"]) await call(`${AGENT_URL}${path}`, path === "/agent/status" ? { method: "GET" } : { method: "POST", body: JSON.stringify({ code: "ABCDEFGH" }) });
    expect(agent.calls.map((c) => c.url)).toEqual([`${AGENT_URL}/agent/status`, `${AGENT_URL}/pair/start`, `${AGENT_URL}/pair/complete`]);
  });

  it("forgets a token the agent no longer accepts", async () => {
    const agent = fakeAgent();
    window.sessionStorage.setItem(TOKEN_KEY, "expired-token-from-before-a-restart");
    const response = await createAgentFetch({ dev: false, baseFetch: agent.fetchImpl })(`${AGENT_URL}/repositories`);
    expect(response.status).toBe(401);
    expect(readToken()).toBeNull();
  });

  it("keeps the token in sessionStorage only", async () => {
    const agent = fakeAgent();
    const call = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    expect((await startPairing(call, AGENT_URL)).ok).toBe(true);
    expect((await completePairing("ABCD-EFGH", call, AGENT_URL)).ok).toBe(true);
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe(agent.token);
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
});

describe("pairing", () => {
  it("reports a wrong code and an unreachable agent with their own messages", async () => {
    const agent = fakeAgent();
    const call = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    const wrong = await completePairing("ZZZZZZZZ", call, AGENT_URL);
    expect(wrong).toMatchObject({ ok: false, code: "PAIRING_CODE_INVALID" });
    expect(readToken()).toBeNull();
    const offline = fakeAgent({ reachable: false });
    const unreachable = await startPairing(createAgentFetch({ dev: false, baseFetch: offline.fetchImpl }), AGENT_URL);
    expect(unreachable).toMatchObject({ ok: false, code: "AGENT_UNREACHABLE" });
  });

  it("reads the loopback permission, and treats an unknown permission as a prompt", async () => {
    const query = vi.fn(async () => ({ state: "denied" }) as PermissionStatus);
    expect(await loopbackPermission({ query } as unknown as Permissions)).toBe("denied");
    expect(query).toHaveBeenCalledWith({ name: "loopback-network" });
    const unknown = { query: vi.fn(async () => { throw new TypeError("unknown permission"); }) } as unknown as Permissions;
    expect(await loopbackPermission(unknown)).toBe("prompt");
    expect(await loopbackPermission(undefined)).toBe("prompt");
  });
});

describe("the Settings card", () => {
  it("is not shown in development, where the Vite proxy is used", async () => {
    await render(<AgentConnection dev />);
    expect(tid("agent-connection")).toBeNull();
  });

  it("makes no request until the user clicks Connect, then pairs with the code from the agent window", async () => {
    const agent = fakeAgent();
    const fetchImpl = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    let paired = 0;
    await render(<AgentConnection dev={false} fetchImpl={fetchImpl} permission={async () => "prompt"} onPaired={() => (paired += 1)} />);
    await flush();
    expect(agent.calls).toHaveLength(0);
    await click(tid("agent-connect")!);
    await flush();
    expect(agent.calls.map((c) => c.url)).toEqual([`${AGENT_URL}/agent/status`, `${AGENT_URL}/pair/start`]);
    expect(tid("agent-status")!.textContent).toContain("code shown in the Sean agent window");
    await type(tid("agent-code") as HTMLInputElement, "abcd-efgh");
    await click(tid("agent-pair")!);
    await flush();
    expect(tid("agent-state")!.textContent).toBe("Connected to the Sean agent.");
    expect(readToken()).toBe(agent.token);
    expect(paired).toBe(1);
    await click(tid("agent-disconnect")!);
    expect(readToken()).toBeNull();
    expect(tid("agent-status")!.textContent).toContain("restart the Sean agent");
  });

  it("keeps the code field after a wrong code", async () => {
    const agent = fakeAgent();
    const fetchImpl = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    let paired = 0;
    await render(<AgentConnection dev={false} fetchImpl={fetchImpl} permission={async () => "prompt"} onPaired={() => (paired += 1)} />);
    await click(tid("agent-connect")!);
    await flush();
    await type(tid("agent-code") as HTMLInputElement, "ZZZZZZZZ");
    await click(tid("agent-pair")!);
    await flush();
    expect(tid("agent-code")).not.toBeNull();
    expect(paired).toBe(0);
    expect(tid("agent-status")!.textContent).toBe("The pairing code is not correct.");
  });

  it("explains how to start the agent, or how to allow the site, when the connection fails", async () => {
    const offline = fakeAgent({ reachable: false });
    const fetchImpl = createAgentFetch({ dev: false, baseFetch: offline.fetchImpl });
    const view = await render(<AgentConnection dev={false} fetchImpl={fetchImpl} permission={async () => "prompt"} />);
    await click(tid("agent-connect")!);
    await flush();
    expect(tid("agent-status")!.textContent).toContain("start_agent.ps1");
    await view.unmount();
    await render(<AgentConnection dev={false} fetchImpl={fetchImpl} permission={async () => "denied"} />);
    await flush();
    expect(tid("agent-status")!.textContent).toContain("site settings");
  });

  it("shows a session that is already paired without asking again", async () => {
    const agent = fakeAgent();
    window.sessionStorage.setItem(TOKEN_KEY, agent.token);
    const fetchImpl = createAgentFetch({ dev: false, baseFetch: agent.fetchImpl });
    // "prompt" is also what a browser without the permission API reports; the token shows the session connected before.
    await render(<AgentConnection dev={false} fetchImpl={fetchImpl} permission={async () => "prompt"} />);
    await flush();
    expect(tid("agent-state")!.textContent).toBe("Connected to the Sean agent.");
    expect(agent.calls.map((c) => c.url)).toEqual([`${AGENT_URL}/agent/status`]);
  });
});
