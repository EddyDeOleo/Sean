/**
 * Connection to the local Sean agent (Sean Local + Web, docs/development/d05-local-web-deployment-decision-record.md).
 *
 * Development: the Vite dev server proxies the relative path /api to the backend, exactly as before. Nothing here changes it.
 * Production (the Netlify site): the browser calls the agent directly at AGENT_URL. Every request is a CORS request that
 * declares `targetAddressSpace: "loopback"`, which Chromium requires to exempt a request from an HTTPS page to
 * http://127.0.0.1 from mixed-content blocking, behind the Local Network Access ("loopback-network") permission.
 *
 * The site pairs with the agent once per browser session: the agent prints a code in its own window, the user types it here,
 * and the agent returns a token. The token is kept in sessionStorage, so it is gone when the tab closes, and a later deploy of
 * the site cannot inherit it. sessionStorage does not protect it from script running on the page. The bundle holds no secret.
 */

/**
 * The agent's local address (scripts/start_agent.ps1). A build may set VITE_SEAN_AGENT_URL to another loopback port (the
 * integration test does); anything that is not http://127.0.0.1:<port> is ignored. It is an address, never a secret. The
 * site's Content-Security-Policy (netlify.toml, connect-src) must list the same address.
 */
const DEFAULT_AGENT_URL = "http://127.0.0.1:8000";
const configuredAgentUrl: unknown = import.meta.env.VITE_SEAN_AGENT_URL;
export const AGENT_URL =
  typeof configuredAgentUrl === "string" && /^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(configuredAgentUrl) ? configuredAgentUrl : DEFAULT_AGENT_URL;
export const DEV_BASE_URL = "/api";
export const TOKEN_KEY = "sean.agent.token.v1";

/** The API base address: the dev proxy in development, the local agent in a production build. */
export function agentBaseUrl(dev: boolean = import.meta.env.DEV): string {
  return dev ? DEV_BASE_URL : AGENT_URL;
}

type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function sessionStore(): TokenStorage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // storage blocked by the browser
  }
}

export function readToken(storage: TokenStorage | null = sessionStore()): string | null {
  try {
    return storage?.getItem(TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveToken(token: string, storage: TokenStorage | null = sessionStore()): void {
  try {
    storage?.setItem(TOKEN_KEY, token);
  } catch {
    // Without storage the token is not kept; the user pairs again.
  }
}

export function clearToken(storage: TokenStorage | null = sessionStore()): void {
  try {
    storage?.removeItem(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Whether the app may contact the agent on its own, without a click. Always in development (the Vite proxy). In a production
 * build only once this browser session holds a token: before that, the first request must come from the user's click on
 * Connect, so opening the site never triggers the browser's local network permission prompt.
 */
export function agentReady(dev: boolean = import.meta.env.DEV, storage: TokenStorage | null = sessionStore()): boolean {
  return dev || readToken(storage) !== null;
}

/** RequestInit with the Local Network Access option, which the TypeScript DOM types do not list yet. */
type AgentRequestInit = RequestInit & { targetAddressSpace?: "loopback" };

export interface AgentFetchOptions {
  dev?: boolean;
  baseFetch?: typeof fetch;
  storage?: TokenStorage | null;
}

/**
 * A fetch for the agent. In development it is the plain fetch. In production it adds the token, makes the request a CORS
 * request to the loopback address space, and forgets a token the agent no longer accepts (agent restarted or token expired).
 */
export function createAgentFetch(options: AgentFetchOptions = {}): typeof fetch {
  const dev = options.dev ?? import.meta.env.DEV;
  const storage = options.storage === undefined ? sessionStore() : options.storage;
  return async (input, init = {}) => {
    const baseFetch = options.baseFetch ?? fetch;
    if (dev) return baseFetch(input, init);
    const token = readToken(storage);
    // Before pairing, only the connection card talks to the agent (after the user clicks Connect). Any other call is answered
    // here, without a request, so nothing reaches 127.0.0.1 and the browser shows no permission prompt on its own.
    if (!token && !isPairingRoute(input)) return notPaired();
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const request: AgentRequestInit = { ...init, headers, mode: "cors", credentials: "omit", targetAddressSpace: "loopback" };
    const response = await baseFetch(input, request);
    if (response.status === 401) clearToken(storage);
    return response;
  };
}

export const agentFetch: typeof fetch = (input, init) => createAgentFetch()(input, init);

/** The agent routes a browser session may call before it holds a token (backend app/api/agent_auth.py, PUBLIC_ROUTES). */
const PAIRING_PATHS = ["/agent/status", "/pair/start", "/pair/complete"];

function isPairingRoute(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return PAIRING_PATHS.some((path) => url.endsWith(path));
}

export const NOT_PAIRED_CODE = "AGENT_NOT_PAIRED";

/** The answer to a call made before pairing: the same shape as the agent's own 401, and no request is sent. */
function notPaired(): Response {
  return new Response(
    JSON.stringify({ code: NOT_PAIRED_CODE, message: "This site is not connected to the Sean agent. Connect it in Settings first.", retryable: false }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

export type LoopbackPermission = "granted" | "prompt" | "denied";

/** The Local Network Access permission for the loopback address. Browsers without it report "prompt". */
export async function loopbackPermission(permissions: Permissions | undefined = globalThis.navigator?.permissions): Promise<LoopbackPermission> {
  if (!permissions?.query) return "prompt";
  try {
    const status = await permissions.query({ name: "loopback-network" as PermissionName });
    return status.state;
  } catch {
    return "prompt"; // unknown permission name: the request itself will prompt where it is supported
  }
}

export interface AgentStatus {
  pairingRequired: boolean;
  paired: boolean;
}

export type AgentResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

async function readError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && typeof (body as { code?: unknown }).code === "string") {
      const record = body as { code: string; message?: unknown };
      return { code: record.code, message: typeof record.message === "string" ? record.message : `The agent returned HTTP ${response.status}.` };
    }
  } catch {
    // fall through
  }
  return { code: "HTTP_ERROR", message: `The agent returned HTTP ${response.status}.` };
}

const UNREACHABLE: AgentResult<never> = {
  ok: false,
  code: "AGENT_UNREACHABLE",
  message: "The Sean agent could not be reached. Start it with scripts\\start_agent.ps1, and allow this site to connect to your device.",
};

export async function getAgentStatus(fetchImpl: typeof fetch = agentFetch, base = agentBaseUrl()): Promise<AgentResult<AgentStatus>> {
  let response: Response;
  try {
    response = await fetchImpl(`${base}/agent/status`, { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" });
  } catch {
    return UNREACHABLE;
  }
  if (!response.ok) return { ok: false, ...(await readError(response)) };
  try {
    const body = (await response.json()) as { pairing_required?: unknown; paired?: unknown };
    return { ok: true, value: { pairingRequired: body.pairing_required === true, paired: body.paired === true } };
  } catch {
    return { ok: false, code: "INVALID_RESPONSE", message: "The agent sent an answer Sean could not read." };
  }
}

async function postJson(fetchImpl: typeof fetch, url: string, body: unknown): Promise<Response | null> {
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

/** Ask the agent to show a pairing code in its window. Returns the code's lifetime in seconds. */
export async function startPairing(fetchImpl: typeof fetch = agentFetch, base = agentBaseUrl()): Promise<AgentResult<number>> {
  const response = await postJson(fetchImpl, `${base}/pair/start`, {});
  if (response === null) return UNREACHABLE;
  if (!response.ok) return { ok: false, ...(await readError(response)) };
  const body = (await response.json().catch(() => ({}))) as { expires_in?: unknown };
  return { ok: true, value: typeof body.expires_in === "number" ? body.expires_in : 120 };
}

/** Send the code the user typed. On success the token is saved for this browser session. */
export async function completePairing(
  code: string,
  fetchImpl: typeof fetch = agentFetch,
  base = agentBaseUrl(),
  storage: TokenStorage | null = sessionStore(),
): Promise<AgentResult<true>> {
  const response = await postJson(fetchImpl, `${base}/pair/complete`, { code: code.trim() });
  if (response === null) return UNREACHABLE;
  if (!response.ok) return { ok: false, ...(await readError(response)) };
  const body = (await response.json().catch(() => ({}))) as { token?: unknown };
  if (typeof body.token !== "string" || body.token.length < 20) {
    return { ok: false, code: "INVALID_RESPONSE", message: "The agent sent an answer Sean could not read." };
  }
  saveToken(body.token, storage);
  return { ok: true, value: true };
}
