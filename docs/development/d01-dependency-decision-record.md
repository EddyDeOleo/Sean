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
| Node.js | **24.13.0** (Maintenance LTS, end of life 2028-04-30), track the latest 24.x patch. Revised in the Phase 2 closure (owner decision 1) from the earlier 26.13.0 selection. | 26.13.0 (Active LTS). Not adopted: the frontend stack below verifies on 24.x, and installing 26.x requires a separate authorization. | Installed: 24.13.0. No installation performed in Phase 2. |

Approved virtual environment command (to be run only when separately authorized):

```powershell
py -3.14 -m venv .venv
```

Verify the selected interpreter after installation with `py -0p` and `.\.venv\Scripts\python.exe --version`.

Node.js patch policy: track the latest 24.x patch. Apply security patch releases promptly. Do not move to a new major line without a new decision. Node 24 is in Maintenance LTS until 2028-04-30 (Node.js release schedule, `nodejs/Release` `schedule.json`).

**Node.js compatibility evidence for the frontend stack (read-only, Phase 2).** Engine ranges declared in each package's published npm manifest:

| Package (approved version) | Declared Node engine | Includes 24.13.0? |
|---|---|---|
| vite 8.3.7 | `^20.19.0 \|\| >=22.12.0` | Yes |
| rolldown 1.2.18 (Vite dependency) | `^20.19.0 \|\| >=22.12.0` | Yes |
| @vitejs/plugin-react 6.3.0 | `^20.19.0 \|\| >=22.12.0` | Yes |
| vitest 5.1.0 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` | Yes |
| @playwright/test 1.65.0 | `>=20` | Yes |
| typescript 6.0.3 | `>=14.17` | Yes |
| react 19.3.1 | `>=0.10.0` | Yes |
| tailwindcss 4.3.5, @tailwindcss/vite 4.3.5 | No `engines` field in the manifest | Not restricted by a declared range |

Consequences: `@types/node` is revised to `^24.19.2`, which exists on npm and matches the runtime major. The Vitest range `^24.0.0` is the one that makes 24.x a supported Vitest runtime.

**Limits of this evidence.** Declared engine ranges are metadata. No package was installed and no code was run under Node 24.13.0. Transitive packages were not checked individually. Runtime verification of the frontend toolchain is Phase 3, at the lock step.

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
| @types/node | `^24.19.2` (matches the Node.js 24 runtime; revised in the Phase 2 closure from `^26.6.6`) |

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
| MCP major version | **Selected: exact pin `mcp==2.3.0` (v2 stable line).** `mcp==1.30.0` is the fallback only if a Kiro test fails on 2.3.0. | Design closed (owner, Phase 2). Runtime tests in D02 Section 12 remain open. |
| STDIO transport with Kiro 1.4.121 | **Selected design: STDIO.** One probe tool call succeeded. Protocol revision, framing, line endings, and shutdown are not verified. | Design closed. Runtime compatibility **not verified** (D02 T3, T7b, T10, T12). |

Facts recorded for the D02 decision:
- v2.3.0 declares MIT in the PyPI `license` field and in the upstream LICENSE (tagged `v2.3.0`).
- The upstream LICENSE copyright line reads `Copyright (c) 2024 Anthropic, PBC`. The PyPI `author` field reads `Model Context Protocol a Series of LF Projects, LLC.` Attribution in project documentation should cite the LICENSE text.
- Advisory floors: `>=2.2.0` for the 2.x line and `>=1.30.0` for the 1.x line. Both candidate floors are clear of the advisories checked.
- The v1.x line receives critical bug and security fixes only, per the migration guide.
- v2 changes the API surface substantially (see migration guide). Choosing the line affects the MCP entry point implementation.

`mcp==2.3.0` is installed in `backend/.venv` for the D02 experiment under owner authorization. Changing the version requires repeating the D02 runtime tests.

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
2. Separate authorization for installing or upgrading Python to 3.14.10. Node.js is not in this list: the approved runtime is 24.13.0, already installed (owner decision 1, Phase 2 closure).
3. Separate authorization for creating the virtual environment and any manifest or lockfile.
4. Verification of the chosen Python interpreter after installation (`py -0p`, `python --version` inside `.venv`).

### Pending gates (not closed by D01)

| Gate | Status |
|---|---|
| D02: MCP major version and STDIO design | **Closed by owner:** `mcp==2.3.0` exact pin, STDIO. Runtime compatibility with Kiro 1.4.121 **not verified** (D02 Section 12 runtime tests remain open). |
| D03: Golden repository baseline (Django) | **Approved by owner:** repository `django/django`; baseline Django 5.2 tag `5.2`, commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`. Golden cases remain under D04. |
| D04: Historical Git retrieval confirmed against Golden Tests | Pending |
| D05: Evidence-ranking weight calibration | Pending |
| D06: Cache invalidation behavior | Pending |
| D07: Local data and deployment locations on Windows | Pending validation |
| D08: GitHub API behavior and rate-limit handling | Pending validation |
| Kiro Steering and Skills loading verification | Partially verified: steering and skills recognized in Kiro context. Manual GUI checks are outstanding (see the closure report). |
| `.kiroignore` and `agentIgnoreFiles` behavior | Pending |
| MIT License copyright holder and year | **Closed.** Holder confirmed by owner: Eddy Yail De Oleo Arias, 2026 (Architecture A13). `LICENSE` unchanged. |
| Kiro CLI (Architecture §25 item 7, as amended by CC-6) | **Closed by owner decision 3.** Kiro CLI is excluded from the mandatory environment. Kiro IDE 1.4.121 is the primary environment, and the CLI is complementary. The CLI is not installed and was not installed for this gate. |
| Dependency compatibility for Phase 2 (Spec 1 §25; Architecture §25 item 6) | **Accepted by owner decision 2.** D01's documented compatibility research and the existing `mcp 2.3.0` environment are sufficient for Phase 2 preparation. Backend and frontend installations and lock generation belong to Phase 3, with a fresh advisory review first. |
| Kiro Agent 0.66.89 and VS Code base 1.131.0 reverification | Pending (recorded in the architecture document; not reverified in this audit) |
| Playwright installation and runtime verification | Pending, Phase 3 |
| Runtime-tested compatibility for all approved packages | Pending |

---

## 8. Reconciliation with earlier audit findings

| Earlier finding | Resolution |
|---|---|
| Python 3.12.0 and 3.14.0 installed; neither is the current patch | Resolved as a decision: 3.14.10 approved. Upgrade pending authorization. |
| Node.js runtime: 24.13.0 installed; 26.13.0 earlier selected | Resolved in the Phase 2 closure (owner decision 1): runtime is 24.x (Maintenance LTS until 2028-04-30). The frontend stack declares compatible engines. No upgrade required. |
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
- Begin D04, D05, D02 runtime tests, or implementation. The D02 and D03 design decisions are closed by owner decision in the Phase 2 closure. The D02 runtime tests and the D03 Golden cases (D04) still need authorization.

Further work requires explicit authorization from the project owner.

---

## Phase 2 closure consistency review

Scope: D01, D02, D03, the Architecture, both native Specs (`.kiro/specs/evidence-retrieval/` and `.kiro/specs/ouija-experience/`), the Playbook, and the Operating Guide. Method: text search for stale and pending wording, cross-reference checks between the decision records and the native Specs, and task and checkbox counts.

Results:

| Check | Result |
|---|---|
| Golden repository and baseline (D03, Evidence requirement 22.1, design E-D9, task 18.1) | Consistent. Repository `django/django`; commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`. |
| Holder of the MIT license (Architecture A13 and §23, D01) | Consistent. `LICENSE` unchanged. Creation timestamp not investigated, per owner instruction. |
| D02 DEC-1, DEC-2, DEC-3, DEC-4, DEC-11, DEC-13, DEC-14 against the Evidence design, requirements, and tasks | Consistent after this closure. |
| C-D1 to C-D4 and C-D6 to C-D10 (Evidence design C.13) against the Ouija design, requirements, and tasks | Consistent after this closure. |
| Ambiguous target (`TARGET_AMBIGUOUS`) | Request-level error for HTTP and MCP. Not `PARTIAL` anywhere in the native Specs. |
| Revision input | Full 40-character SHA only, default HEAD. The Evidence requirements, design, and tasks match D02 §16.6. |
| Stale "pending owner approval" and "deadline" wording in the native Specs | Removed. Scan returned no remaining match except items listed below. |
| Task and checkbox counts | Evidence Retrieval: 20 top-level, 55 subtasks, 75 checkboxes, 0 completed. Ouija Experience: 15 top-level, 45 subtasks, 60 checkboxes, 0 completed. Totals: 35 top-level, 100 subtasks, 135 checkboxes. |

Status of the contradictions found in the first review, after the Phase 2 closure changes:

1. Spec 1 §24 register: updated to version 2.4 (CC-1).
2. Spec 1 FR-10 and §12: FR-10 clarified in version 2.4 (CC-2, Option A).
3. Spec 2 §3.2: read as satisfied by the lifecycle stage and the result-driven reveal (CC-3). No source edit.
4. Architecture §12.2 and DEC-13: the owner-approved deviation is recorded in the Architecture change history (version 1.4) and in D02 DEC-13. The §12.2 text is unchanged.
5. Architecture §25 item 7: amended to exclude the Kiro CLI from the mandatory environment (CC-6, version 1.4).
6. Architecture version history: version 1.4 with a change-history table (CC-5).
7. The Playbook and Operating Guide were searched only for Kiro CLI wording. Both describe the CLI as complementary, which matches the Architecture. They have not been reviewed for other stale statements. The cross-document review is therefore still partial. See the Phase 2 closure report for the remaining checks.

Approved sources changed in the Phase 2 closure, under the owner's change-control decisions: Spec 1 (version 2.4) and Architecture (version 1.4).

## Bounded cross-document review (second pass)

Scope: Architecture §§3–11 and 13–22; Spec 1 §§1–23 against the Evidence requirements and design; Spec 2 §§2–22 against the Ouija requirements, design, and canonical contract; Playbook §§2–16 and Operating Guide §§2–13. The native task dependency and coverage check was rerun. No approved source was edited in this pass.

Review method: three read-only section reviews and one Playbook and Operating Guide review, then reconciliation of each finding against the owner decisions. Sections outside the stated scope were not reviewed.

Native task dependency and coverage check (rerun):

| Spec | Top-level tasks | Subtasks | Checkboxes | Acceptance criteria | Covered by task references | Dependency errors | Cycles |
|---|---|---|---|---|---|---|---|
| Evidence Retrieval | 20 | 55 | 75 (all `[ ]`) | 103 | 103 (none uncovered) | none | none |
| Ouija Experience | 15 | 45 | 60 (all `[ ]`) | 101 | 101 (none uncovered) | none | none |

Fixed in native specs and decision records (no approved source edited):
- Ouija design lifecycle: request errors (category B) return to `QUESTION_READY` with "request not accepted". They no longer enter the retrieval `FAILED` state.
- Ouija design: a validated `FAILED` result goes directly to `FAILED` and never reveals. `REVEALING` is entered only for `COMPLETED`, `PARTIAL`, or `INSUFFICIENT_EVIDENCE`.
- Ouija design: `INVOKING` to `CANCELLED` added. `REST` is the planchette exit after `FAILED`, `CANCELLED`, and request-not-accepted.
- Ouija design: the reveal sound cue fires only for `COMPLETED` or `PARTIAL`. `INSUFFICIENT_EVIDENCE` has no cue.
- Ouija design: `validateResponse` checks the status and classification mapping (C.7). It does not re-check Spec 1 §10.4 invariants.
- Ouija design: `source_url` renders as a link only for `https`. Tailwind is named as the primary styling approach (Spec 2 §22.2).
- Ouija requirement 6.5: citation corrected to canonical contract C.8.
- D02 §7.1 and the D02 status row: SDK selection and the workspace MCP entry are stated as owner decisions. The workspace entry is retained unchanged, and its enabled or disabled flag is not verified.
- Both native `tasks.md` files: status mapping note added (checkbox `[ ]` means `NOT_STARTED`, and no checkbox means `VERIFIED` or `ACCEPTED`).

Classified as Phase 3 entry items (not Phase 2 blockers):
- Native requirements are drafts (`requirements.md` header: "draft for human review"). Gaps against Spec 1 §§5, 6, 13, and 19 (target resolution, retrieval scope, untrusted-content requirement, and Golden case categories) must be added and approved before the affected tasks start (Evidence tasks 2, 4, 5, 18). The untrusted-content rule already binds implementation through steering `security.md`.
- Cache invalidation rules (Spec 1 §14, Evidence E-D6) are an owner decision required before Evidence task 10 starts.
- Ouija Requirement 24 numbering order (24.4 and 24.5) is editorial and is fixed when the requirements are approved.

Proposed change control for approved sources (owner approval required, not applied):

| ID | Document and section | Current wording | Proposed change | Type |
|---|---|---|---|---|
| CC-7a | Architecture §13 introduction | "The installed environment identified for this project is … Kiro Agent `0.66.89` … VS Code base `1.131.0`" | Add: "Kiro Agent and VS Code versions are recorded from the architecture document and have not been reverified (D01)." | Editorial |
| CC-7b | Architecture §13.6 and §13.8 | Hooks and agents to be introduced "after their events … are verified" and "when their workflows are ready" | Add status note: `.kiro/hooks/guard-approved-docs` and three agent files exist; load and activation not yet verified in Kiro (Phase 2 closure). | Editorial |
| CC-7c | Architecture §14 | "The current project-level configuration uses the following paths" and later "The tree describes the intended organization" | Align the wording to one statement: the tree is the intended organization. | Editorial |
| CC-7d | Architecture §16.1 | `py -m venv .venv` | `py -3.14 -m venv .venv` (per D01 §1 and §8). | Editorial |
| CC-7e | Architecture §20 | Report statuses "Implemented, Tested, Verified, Not verified, Blocked, Accepted" | Replace with the Playbook §15 vocabulary (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `ACCEPTED`). | Editorial |
| CC-7f | Architecture §6.5 step 2 | "reflects actual investigation progress and frontend state" | Align with CC-3: lifecycle stage and reveal on the completed backend result. | Editorial |

If CC-7 is approved, Architecture version becomes 1.5 with a change-history row. The change-history row for CC-7 is not applied until the owner approves.

Reporting structure: the Operating Guide §15 template has no Security or Documentation field. The Playbook §14–15 governs the report format, and the native tasks cite Playbook §15. No edit is made. The Operating Guide phases 1 to 7 are the per-task workflow. Project phases are not Operating Guide phases.
