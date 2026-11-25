# Deploying Sean (Local + Web)

Status: **deployed as Netlify deploy previews.** The frontend is published to the Netlify project `sean-local-web-preview`
as draft deploy previews made with the Netlify CLI. The project has no production deploy, so its main address
(`https://sean-local-web-preview.netlify.app`) is not in use. The latest preview at the time of writing is
`https://6b0506eb6980cdb8e5c62d89--sean-local-web-preview.netlify.app`. Each deploy has its own address, so use the one
Netlify reports for the deploy you want. The backend is never deployed: it runs as the local agent.

Before pairing, the site sends nothing to the agent: calls other than status and pairing are answered in the browser as
"not connected" (`AGENT_NOT_PAIRED`). An investigation then fails without a request. The Ouija still plays (it opens every
game, whatever the investigation's outcome), then the game starts with atmosphere clues and a technical note.

A draft deploy can be published again from the repository root, after `npm run build` in `frontend\`:
`npx netlify-cli deploy --site <project id> --dir frontend/dist --no-build`. Each draft deploy has its own origin, and the
agent must be started with that exact origin.

Decision record: `docs/development/d05-local-web-deployment-decision-record.md` (Architecture v1.4 amendment A27, Spec 4
section 13 amendment).

## Architecture

| Part | Runs where | State |
|---|---|---|
| React and Vite frontend, the game and its runtime model | Netlify (`netlify.toml`) | Deployed as deploy previews |
| FastAPI backend (investigations, repositories, advisor, Groq, GitHub) | The user's own Windows computer, as the **Sean agent** (`scripts/start_agent.ps1`) | Implemented and tested locally |
| Site-to-agent link | The browser calls `http://127.0.0.1:8000` directly, with CORS and a bearer token from pairing | Tested locally over HTTP. On the HTTPS deploy previews, the site, the demo, the Ouija and the caught screen were checked without the agent; pairing over HTTPS is covered by the checklist below |

The backend is not hosted. Repository investigation stays on the user's computer, as Architecture section 2.2 requires. The
Netlify site holds no secret and no backend address other than the loopback address.

In development nothing changes: the Vite dev server proxies `/api` to the backend, and the pairing card is not shown.

## How the agent protects itself

`backend/app/api/local_guard.py` and `backend/app/api/agent_auth.py`:

- The agent listens on `127.0.0.1` only and accepts only the `Host` values `127.0.0.1` and `localhost`.
- Browser origins come from exact lists, with no wildcards:
  - `SEAN_ALLOWED_ORIGINS`: the web site origins (for example `https://<site>.netlify.app`).
  - `SEAN_LOOPBACK_ORIGINS`: loopback dev origins. Unset or empty means `http://127.0.0.1:5173` and `http://localhost:5173`;
    `none` means no loopback browser origin. `start_agent.ps1` sets `none`.
- A web origin needs a bearer token for every request except `GET /agent/status`, `POST /pair/start` and
  `POST /pair/complete`. Without one the agent answers 401.
- Pairing: one active code at a time (429 `PAIRING_IN_PROGRESS`), a 30-second cooldown between starts (429
  `PAIRING_COOLDOWN`, with `Retry-After`), a code lifetime of 120 seconds, and 5 attempts per code (then
  `PAIRING_LOCKED`). The 8-character code is printed in the agent window only, never logged.
- Tokens last 12 hours and are kept in agent memory only. **Restarting the agent revokes every token.**
- CORS is sent to web origins only, without credentials, for `GET`, `POST`, `PUT`, `DELETE` and the headers
  `Content-Type`, `Authorization` and `X-Sean-Client`.
- Request bodies are limited to 64 KiB (413). A request body from a web origin must be `application/json`
  (415), whatever the method. A request without a body (for example `POST /repositories/{id}/profile`) has no media type and
  needs none; it still needs the token.

The site keeps the token in `sessionStorage`, so it is gone when the tab closes and a later deploy cannot inherit it. A 401
clears it.

## Using the deployed site

1. On your Windows computer, with the backend installed (README, "Install"), start the agent:

   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\start_agent.ps1 -AllowedOrigin https://<your-site>.netlify.app
   ```

   The origin is the scheme and host only, exactly as the browser shows it: no path and no trailing slash. The script refuses
   anything else (for example `https://<site>.netlify.app/` or `http://...`) and exits before the agent starts. The origin can
   instead be set as `SEAN_ALLOWED_ORIGINS` in `.kiro\.env`. The script sets `SEAN_ALLOWED_ORIGINS` and
   `SEAN_LOOPBACK_ORIGINS=none` only while the agent runs, and restores the previous values when it stops, so a development
   backend started later from the same shell is unaffected. The agent uses your real registry in `%LOCALAPPDATA%\Sean`.
   Port 8000 must be free: stop any development backend on it first.
2. Open the site in Chrome or Edge, and go to **Settings**, card **Sean agent**. Until you pair, the Repositories page says
   "Connect to the Sean agent in Settings to see your repositories."
3. Click **Connect to the Sean agent**. The browser asks whether the site may connect to devices on your local network or
   this device. Allow it. The site sends no request to the agent before this click (it waits until the browser session holds
   a token), so opening the site does not trigger the prompt.
4. Type the code shown in the agent window, and click **Pair**. The card shows "Connected to the Sean agent."
5. Investigations, repositories and reports now use the agent. The game works without it.

To disconnect this browser, click **Disconnect**. To revoke every pairing, stop the agent (Ctrl+C) and start it again.

## Netlify configuration

`netlify.toml` at the repository root:

| Setting | Value | Why |
|---|---|---|
| Base directory | `frontend` | The frontend and its `package.json` live there |
| Build command | `npm run build` | `tsc -b && vite build` (`frontend/package.json`) |
| Publish directory | `dist` (so `frontend/dist`) | Vite's output |
| Node version | `NODE_VERSION = "24"` | The version the project is verified with |
| SPA redirect | None | One page at `/`, with no client-side routes |
| Headers | CSP with `connect-src 'self' http://127.0.0.1:8000 blob: data:`, `'wasm-unsafe-eval'`, `frame-ancestors 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: no-referrer` | Limits where the page may connect, and blocks framing |

The build output contains only the runtime monster model (`dist/models/sean-monster-250k-rigged.glb`). The model variants are
served by the dev server only (`frontend/src/dev/modelVariantsPlugin.ts`), and all audio is synthesised at run time.

### Manual Netlify steps (when you choose to deploy)

1. Create a site from the GitHub repository in the Netlify dashboard. The settings come from `netlify.toml`.
2. Set no environment variables for the site. It reads none, and secrets must never go there.
3. Start the agent with the site's exact origin (step 1 above), then run the preview checklist.

## Preview checklist (Chrome and Edge, with a paired agent; not yet run)

Run on a Netlify deploy preview, in Chrome and in Edge:

1. The site loads over HTTPS, and the console shows no CSP violation.
2. Before **Connect** is clicked, the agent window shows no request from the site.
3. **Connect** shows the browser's local network (loopback) permission prompt. After allowing it, the request is not blocked
   as mixed content.
4. The agent prints a code, and pairing with it succeeds.
5. The Repositories page lists your repositories, and an investigation completes.
6. A wrong code is refused, and the fifth wrong attempt locks the code.
7. Restarting the agent makes the next request fail with 401, and the card asks to connect again.
8. With the permission blocked in site settings, the card explains how to allow it.

## What is verified and what is not

Verified locally (`frontend/e2e/agent/agent-pairing.spec.ts`, run with `npx playwright test -c playwright.agent.config.ts`
from `frontend\`): a production build served on its own origin (`http://127.0.0.1:5473`) pairs with the real agent through
the Settings card, using the code read from the agent's console. The test then checks:

- opening the site and visiting every page sends no request to the agent before Connect is clicked;
- the token is in `sessionStorage` and not in `localStorage`;
- an authenticated request succeeds, and the same request without the token or with a wrong token gets 401;
- the Repositories page loads through the app's own client;
- the agent console never shows the token;
- an origin that is not allowed gets 403.

The backend rules are covered by `backend/tests/unit/test_agent_auth.py` and the card and client by
`frontend/tests/agentConnection.test.tsx`.

`frontend/e2e/agent/web-monster.spec.ts` serves the production build under the `netlify.toml` headers (or, with
`SEAN_PREVIEW_URL`, uses a deployed preview) and checks the demo: the Ouija first, the creature after the first clue, the
"You were caught" card, Try again and Give up and leave. On the deployed previews, the CSP, `X-Content-Type-Options` and
`Referrer-Policy` headers were observed in the responses, and that spec passed against the preview.

Not verified: Local Network Access prompts and mixed-content behaviour from HTTPS to `http://127.0.0.1` with a paired
agent (the preview checklist above). The local pairing test runs on loopback, where neither applies. Firefox has not been
verified.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `SEAN_ALLOWED_ORIGINS` | Agent | Exact web site origins, comma-separated |
| `SEAN_LOOPBACK_ORIGINS` | Agent | Exact loopback dev origins; unset means port 5173, `none` means none |
| `SEAN_GROQ_API_KEY` | Agent only (optional) | Groq API key for AI wording of answers |
| `SEAN_GITHUB_TOKEN` | Agent only (optional) | Higher GitHub API limits for public pull request and issue metadata |
| `LOCALAPPDATA` | Agent (set by Windows) | Location of the registry and log |
| `SEAN_BACKEND_URL` | Vite dev server only | Overrides the dev proxy target; not used in production builds |
| `VITE_SEAN_AGENT_URL` | Frontend build (tests only) | Another agent port; only `http://127.0.0.1:<port>` is accepted. The CSP must list it |
| `NODE_VERSION` | Netlify build | Set in `netlify.toml` |

The agent variables go in `.kiro/.env` (template: `.kiro/.env.example`). Never give a secret a `VITE_` prefix: Vite would
embed it in the public bundle.

## Remaining limitations

- Script running on the site origin (XSS, or a compromised deploy) can use a token in the same tab. `sessionStorage` limits
  how long a token lives, not who can read it.
- Requests without an `Origin` header (local programs, not browsers) are accepted as before. Any local program can already
  read the user's repositories.
- Another local program could listen on port 5173 and use the default loopback origins. `start_agent.ps1` sets
  `SEAN_LOOPBACK_ORIGINS=none` for this reason.
- There is no revoke endpoint; restart the agent. There is no general rate limit beyond pairing.

## Validation commands

From `frontend\`: `npm run typecheck`, `npm test`, `npm run build`, then `npx playwright test -c playwright.agent.config.ts`
and `npm run build` again (the agent test builds with a test port). Check that `dist\models\` holds only
`sean-monster-250k-rigged.glb`.

From `backend\`: `.\.venv\Scripts\python.exe -m pytest`.

## Local development

Unchanged; see the README, "Run Sean".
