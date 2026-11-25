# D05: Sean Local + Web deployment

**Status:** Approved by the owner (2026-11-23). Implements Architecture decision A27 and the Spec 4 §13 amendment of
2026-11-23.

## Decision

The built frontend is served from Netlify. The FastAPI backend runs unchanged on the user's Windows machine as a local
agent bound to `127.0.0.1`. Repository access, Git execution (Windows Job Objects), the registry, MCP and the Groq and
GitHub keys stay on that machine. A hosted backend ("Sean Cloud") was rejected: it would replace local folders with
uploaded or cloned repositories, needs Linux Git containment, accounts, storage and paid infrastructure, and conflicts with
Architecture §2.1 and §2.2.

## Security design

- Host check unchanged (loopback names only); the agent binds to `127.0.0.1`.
- Exact origin lists (`SEAN_LOOPBACK_ORIGINS`, `SEAN_ALLOWED_ORIGINS`). The previous rule accepted any localhost port.
- Configured web origins need a paired bearer token. Tokens are in memory, hashed, bound to their origin, valid for 12
  hours, and revoked by restarting the agent.
- Pairing: one active 8-character code, shown only in the agent console, 2 minutes, 5 attempts, 30-second start cooldown.
- CORS only for configured web origins, without credentials. Request bodies are limited to 64 KiB.
- The frontend keeps the token in `sessionStorage`. Neither `sessionStorage` nor `localStorage` protects a token from
  script injection; `sessionStorage` was chosen so that a later compromised deploy cannot inherit a token silently.

## Browser findings (official sources, 2026-11-23)

- Chrome and Edge (Chromium): a public HTTPS page needs the `loopback-network` permission (Local Network Access) to call
  `127.0.0.1`. Requests must set `targetAddressSpace: 'loopback'` to be exempt from mixed-content blocking, and the first
  request must follow a user gesture. Private Network Access preflight headers are not used.
  [Chrome LNA guide](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access),
  [Edge policy](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/localnetworkaccessallowedforurls).
- Firefox: LNA protections with a permission prompt are on by default since Firefox 153. Whether it honours
  `targetAddressSpace` for `http://127.0.0.1` is unverified.
  [Firefox policy](https://firefox-admin-docs.mozilla.org/reference/policies/localnetworkaccess/).
- Safari: out of scope; it does not run on Windows.

## Known limitations of the first release

- Script injection on the Netlify origin can use the token while the page is open.
- Requests without an Origin header (local programs running as the user) need no token.
- In development, a page that takes port 5173 while the dev server is not running passes the origin check.
- No revoke endpoint: revocation means restarting the agent.
- No general rate limits beyond pairing; the existing 4-request concurrency limit and Git limits apply.
- The LNA prompt, the mixed-content exemption and the Netlify CSP are unverified until an authorized HTTPS preview test.

## Deferred

Local UI mode (the agent serving the frontend), report export and import between origins, a configurable agent address
and port, a revoke endpoint, a dev-token proxy, config outside the repository, log rotation, autostart, installer, and
Firefox validation.
