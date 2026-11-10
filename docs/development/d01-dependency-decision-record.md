# Sean — D01 Dependency and Version Compatibility Decision Record

**Gate:** D01 (SEAN-SPEC-01 §24, "Confirm final technology stack and compatible dependency versions")
**Audit date:** 2026-11-09
**Decision date:** 2026-11-10
**Status:** APPROVED WITH CONDITIONS (documentation closure only)
**Basis:** Read-only metadata and documentation audit, supplemental review, and owner approval

This record closes D01 as a documentation decision. It does not authorize installation, manifest or lockfile creation, virtual environment creation, runtime testing, or any later gate.

---

## 1. Approved runtimes

| Runtime | Approved version | Installed on this machine (as of audit) | Action required |
|---|---|---|---|
| Python | **3.14.10** (Windows x64 installer) | 3.14.0 (outdated) | Installation or upgrade needs separate authorization |
| Node.js | **26.13.0** (Active LTS), track the latest 26.x patch | 24.13.0 (outdated, Maintenance LTS line) | Installation needs separate authorization |

Approved virtual environment command (to be run only when separately authorized):

```powershell
py -3.14 -m venv .venv
```

Verify the selected interpreter after installation with `py -0p` and `.\.venv\Scripts\python.exe --version`.

Node.js patch policy: track the latest 26.x patch. Apply security patch releases promptly. Do not move to a new major line without a new decision.

Sources: python.org release pages for 3.14.10 and 3.12.16 (2026-10-25); Node.js Release schedule (Node 26 Active LTS, end of life 2029-04-30).

---

## 2. Approved dependency set

Recommendations only. No manifest, lockfile, or requirements file has been created.

### Backend runtime

| Package | Approved constraint | Notes |
|---|---|---|
| fastapi | `>=0.162.2,<0.163` (exact pin `0.162.2` for lock) | Pulls `opentelemetry-api` as a new transitive dependency |
| pydantic | `>=2.14.3,<2.15` (exact pin `2.14.3`) | `pydantic-core` 2.50.4 is resolved through this Pydantic version, which requires `pydantic-core==2.50.4`. It is not an independently approved package and must not be listed as a direct dependency. |
| uvicorn | `>=0.54.0,<0.55` (exact pin `0.54.0`), plain install | Do not use `uvicorn[standard]`; uvloop has no Windows support |
| mcp | **Not selected.** See Section 4. | Package approved; major line pending D02 |

### Backend development and testing

| Package | Approved constraint | Notes |
|---|---|---|
| pytest | `>=9.2.0,<10` (exact pin `9.2.0`) | Development and test only |
| hypothesis | `>=6.170.15,<7` (exact pin `6.170.15`) | **MPL-2.0. Approved for development and testing only.** Not shipped. |

### Frontend runtime

| Package | Approved constraint |
|---|---|
| react | `^19.3.1` |
| react-dom | `^19.3.1` |

### Frontend build and types

| Package | Approved constraint |
|---|---|
| vite | `^8.3.7` |
| @vitejs/plugin-react | `^6.3.0` |
| tailwindcss | `^4.3.5` |
| @tailwindcss/vite | `^4.3.5` |
| typescript | `~6.0.3` (TypeScript 7.x not approved) |
| @types/react | `^19.3.0` |
| @types/react-dom | `^19.3.0` |
| @types/node | `^26.6.6` (matches Node.js 26) |

### Frontend testing

| Package | Approved constraint | Restrictions |
|---|---|---|
| vitest | `^5.1.0` | **UI, browser, and API modes excluded.** Do not add `@vitest/ui`, `@vitest/browser`, or `@vitest/browser-playwright`. |
| @playwright/test | `^1.65.0` | Installation and browser binaries pending. See Section 3. |

### Locking approach

- Python: exact pins in `backend/requirements.txt` and `backend/requirements-dev.txt`. Approved in principle; file creation pending authorization.
- npm: caret ranges in `package.json` and a committed `package-lock.json`. Approved in principle; file creation pending authorization.

---

## 3. Platform support

| Item | Status | Evidence |
|---|---|---|
| Windows edition for Playwright | **PASS** | Owner confirmation on 2026-11-09 that the operating system is Windows 11 Home. Supporting local evidence: WMI caption `Microsoft Windows 11 Home`, build `10.0.26300`, registry UBR `9818`. Registry ProductName still reads "Windows 10 Home"; this is recorded as a known inconsistency in the registry, not as evidence against the owner's confirmation. |
| Playwright installation and runtime verification | **Pending** | Not installed. Browser binaries not downloaded. Requires separate authorization. |

Playwright's documented requirement is Windows 11 or later, Windows Server 2019 or later, or WSL. The owner confirmation satisfies the Windows 11 condition for documentation purposes.

---

## 4. MCP SDK

| Item | Decision | Status |
|---|---|---|
| Python MCP SDK package (`mcp`) | **Approved.** License: MIT. | Approved |
| MCP major version | **Not selected.** Candidates: `>=2.3.0,<3` (v2 stable line) or `>=1.30.0,<2` (v1 maintenance line). | **Pending D02** |
| STDIO compatibility with Kiro 1.4.121 | Not verified | **Pending D02** |

Facts recorded for the D02 decision:
- v2.3.0 declares MIT in the PyPI `license` field and in the upstream LICENSE (tagged `v2.3.0`).
- The upstream LICENSE copyright line reads `Copyright (c) 2024 Anthropic, PBC`. The PyPI `author` field reads `Model Context Protocol a Series of LF Projects, LLC.` Attribution in project documentation should cite the LICENSE text.
- Advisory floors: `>=2.2.0` for the 2.x line and `>=1.30.0` for the 1.x line. Both candidate floors are clear of the advisories checked.
- The v1.x line receives critical bug and security fixes only, per the migration guide.
- v2 changes the API surface substantially (see migration guide). Choosing the line affects the MCP entry point implementation.

Do not install `mcp` until D02 selects the line.

---

## 5. Excluded items

- Vitest UI mode (`@vitest/ui`).
- Vitest browser mode (`@vitest/browser`, `@vitest/browser-playwright`).
- Vitest API mode (`api` configuration).
- `uvicorn[standard]`.
- Any animation library (Spec 2 §22.3 requires separate approval).
- TypeScript 7.x (not approved; 6.x only).
- Any test framework beyond Vitest and Playwright (for frontend) and pytest and Hypothesis (for backend).

---

## 6. Advisory coverage and limitations

These limitations apply to the approved set. They must be stated whenever the advisory position is cited.

| Area | Position | Limitation |
|---|---|---|
| Vitest 5.1.0 core | Clear of the advisories checked: CVE-2026-112948 (fixed 5.0.5, release tag verified), CVE-2026-84373 (fixed 5.0.0-rc.2), CVE-2026-47429 (5.x not in range). | Advisory data came from the GitHub Advisory API `affects` filter. Coverage is not proven complete. |
| Vitest browser and UI packages | Excluded. CVE-2026-47428, CVE-2026-53633, and CVE-2026-73653 apply to `@vitest/browser` (and `vite-plus` for 53633). | Would become blockers if browser mode is added. |
| Vite 8.3.7 | Fixed versions for all 8.x advisories found are ≤ 8.3.3. | Confirmed from the API fix lines. No single primary page listing every 8.x advisory was read. |
| MCP | Clear at `>=2.2.0` (2.x) and `>=1.30.0` (1.x). | Advisory queries are filtered by package name. |
| CVE-2026-39313 | Not applicable. Affects npm `mcp-framework`, not the Python SDK. | None |
| pytest, FastAPI, Pydantic, Uvicorn, React | Advisories found are older and fixed in earlier versions. | Filtered queries; coverage not proven complete. |
| Hypothesis, Tailwind CSS, TypeScript, Playwright | No advisories returned. | A null result from a filtered query is not proof of absence. |

**Metadata compatibility is not runtime-tested compatibility.** Every compatibility statement in D01 is based on package metadata, declared engines and peer dependencies, wheel lists, and official documentation. No package has been installed or executed. Runtime compatibility is pending the verification gates in Section 7.

---

## 7. Conditions and pending work

### Conditions that must be satisfied before installation

1. Fresh vulnerability review. Re-run the GitHub Advisory API queries and registry checks for every approved package immediately before any installation. Advisory data changes frequently, and this record reflects 2026-11-09 only.
2. Separate authorization for installing or upgrading Python to 3.14.10 and Node.js to 26.13.0.
3. Separate authorization for creating the virtual environment and any manifest or lockfile.
4. Verification of the chosen Python interpreter after installation (`py -0p`, `python --version` inside `.venv`).

### Pending gates (not closed by D01)

| Gate | Status |
|---|---|
| D02: MCP transport and STDIO compatibility with Kiro 1.4.121, and the MCP major version | Pending |
| D03: Golden repository baseline (Django) pinned | Pending |
| D04: Historical Git retrieval confirmed against Golden Tests | Pending |
| D05: Evidence-ranking weight calibration | Pending |
| D06: Cache invalidation behavior | Pending |
| D07: Local data and deployment locations on Windows | Pending validation |
| D08: GitHub API behavior and rate-limit handling | Pending validation |
| Kiro Steering and Skills loading verification | Pending |
| `.kiroignore` and `agentIgnoreFiles` behavior | Pending |
| MIT License copyright holder and year | Pending |
| Kiro Agent 0.66.89 and VS Code base 1.131.0 reverification | Pending (recorded in the architecture document; not reverified in this audit) |
| Playwright installation and runtime verification | Pending |
| Runtime-tested compatibility for all approved packages | Pending |

---

## 8. Reconciliation with earlier audit findings

| Earlier finding | Resolution |
|---|---|
| Python 3.12.0 and 3.14.0 installed; neither is the current patch | Resolved as a decision: 3.14.10 approved. Upgrade pending authorization. |
| Node.js 24.13.0 installed; 24 is now Maintenance LTS | Resolved as a decision: 26.13.0 approved. Upgrade pending authorization. |
| Architecture §16.1 proposed `py -m venv .venv` | Superseded by the explicit `py -3.14 -m venv .venv`. The architecture document itself was not modified. |
| MCP license recorded as empty in the first D01 report | Corrected to MIT (PyPI license field and upstream LICENSE). |
| CVE-2026-39313 cited as an MCP SDK issue | Corrected: not applicable to the Python SDK. |
| CVE-2026-53633 and CVE-2026-73653 unverified | Resolved as not applicable to the approved set (browser packages excluded). |
| Windows edition unresolved | Resolved by owner confirmation: Windows 11 Home. |
| Playwright Windows requirement conditional | Resolved to PASS. Installation and runtime verification pending. |

---

## 9. Scope of this record

This record closes D01 as a documentation decision.

It does not:
- Install, update, or remove any software or dependency.
- Create or modify a manifest, lockfile, requirements file, or virtual environment.
- Change any approved architecture, specification, or playbook document.
- Change PATH, environment variables, Git configuration, or Kiro configuration.
- Execute project code or scripts.
- Begin D02, D03, D04, D05, or implementation.

Further work requires explicit authorization from the project owner.
