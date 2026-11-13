# Sean Phase Status and Increment I0 Report

Recorded: 2026-11-10. This file is a status record. It is not an approved document and it amends no approved document.

## 1. Phase status

| Phase | Status | Basis |
|---|---|---|
| 1 Definition and Documentation | Complete | Specs, architecture, playbook, and guide are Approved. |
| 2 Technical Preparation and Gate Closure | **ACCEPTED** | Owner acceptance on 2026-11-10 after the four GUI checks (section 3) and the deviation in section 2. |
| 3 MVP Implementation | **IN_PROGRESS** | Increment I0 only. I1 is not started. |
| 4 Testing, Security and Verification | NOT_STARTED | |
| 5 Demo and Hackathon Preparation | NOT_STARTED | |

## 2. Owner-approved environment deviation: Kiro IDE 1.4.154

- Approved documents name Kiro IDE 1.4.121 and Kiro Agent 0.66.89 (Architecture §13 and §25 item 7; D01; D02).
- The installed environment was read on 2026-11-10 from `%LOCALAPPDATA%\Programs\Kiro\resources\app`: Kiro IDE **1.4.154** (`product.json`, `package.json`, `Kiro.exe`), VS Code base 1.131.0 (unchanged), `kiro-agent` extension **1.1.873**.
- The owner approved 1.4.154 as the working environment for Phase 3.
- Scope of this deviation: it records the installed version only. It does not change any approved requirement.
- No approved document was edited. The version text in Architecture §13, §25 item 7, D01, and D02 still says 1.4.121 and is now out of date. Updating it needs a separate owner-authorized document change.
- Carried over, not resolved here: MCP runtime compatibility is still `NOT VERIFIED` for any Kiro version (D02, deferred to Phase 4). The D01 item "Kiro Agent and VS Code base reverification" stays pending.
- The running IDE version was not independently confirmed by Help > About. The installed files are the evidence, plus the owner's approval.

## 3. Phase 2 GUI gate

| Check | Result | Evidence |
|---|---|---|
| 1. `code-reviewer`, `test-engineer`, `security-auditor` in the agent selector | Verified by owner | Owner report |
| 2. `guard-approved-docs` activates and Reject leaves the file unchanged | Verified by owner. Hash of `docs/architecture/architecture-and-project-setup.md` recomputed: `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9`, equal to the baseline. | Owner report and hash |
| 3. Both Native Spec task views open and show pending tasks | Verified by owner | Owner report |
| 4. `kiroAgent.agentIgnoreFiles` contains `.gitignore` and `.kiroignore` | Configuration value verified in `.vscode/settings.json`. Runtime behavior not verified. | File read |

## 4. Increment I0

Tasks executed: Evidence Retrieval task 0, Ouija Experience task 0, Evidence Retrieval task 15.1. No code was written. No checkbox was changed (75 Evidence and 60 Ouija remain unchecked, 0 checked).

### 4.1 Evidence Retrieval task 0: implementation gate check

Status: **VERIFIED** (the checks below were executed and observed). Not ACCEPTED.

| Gate (Spec 1 §25; Architecture §25) | State | Evidence |
|---|---|---|
| Spec 1, Spec 2, Architecture approved (arch. items 1 to 3) | Closed | Spec 1 v2.4, Spec 2 v1.6, Architecture v1.4: Status Approved. |
| Playbook and Operating Guide available (item 4) | Closed | Both v1.0, Approved. |
| Cross-document consistency review (item 5) | Closed | Completed in the Phase 2 closure review. No separate artifact exists. |
| Windows runtime versions and dependency compatibility (item 6) | Closed by owner decision 2, with limits | Python 3.14.10 in the backend venv, Node 24.13.0, Git 2.50.1. D01 records engine ranges only. No frontend toolchain has run, and no dependency is installed or locked. Runtime verification is Phase 3 at the lock step. |
| Kiro IDE version identified (item 7) | Closed by owner deviation | Section 2. Kiro CLI excluded by owner decision 3. |
| Kiro configuration formats and capabilities verified (item 8) | Closed for Phase 3 scope, with limits | Observed: spec parser and validator (0 diagnostics on six files), agents, hook, Spec views. Not verified: ignore-file runtime behavior, MCP runtime. |
| Demo repository and pinned baseline (item 9) | Closed | D03: `django/django`, commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`. Golden cases remain under D04, an outcome of Evidence task 18. |
| MIT copyright holder (item 10) | Closed | Eddy Yail De Oleo Arias, 2026 (Architecture A13). `LICENSE` unchanged. |
| Spec 1 §25: plan consistent with the architecture | Closed | Dependency graph check passed (below). |

Owner decisions recorded in `design.md`: E-D1, E-D2, E-D4, E-D9, C-D1 to C-D10 (C-D5 is a UUID version 4 string), and DEC-13 keep-as-is. Confirmed in the C.13 table (10 of 10 rows closed).

Open decisions and gates, none of which blocks I0:
- O-G1: the numeric values for DEC-10 and E-D14 need owner approval before Evidence 16.1 can be verified. Evidence task 3 waits for 16.1.
- `evidence_id` format: open until before Evidence 7.2.
- A2b (duplicate `evidence_id` behavior): not approved, not documented.
- D04 (Golden cases): pending, an outcome of Evidence task 18.
- D06 (cache invalidation): open, needed at Evidence 10.1.
- `mcp.json`: unmodified. Its entry names `app.modules.mcp`, which does not exist. Check the enabled state before Evidence 17.3 and validate it at 17.5.
- D01: Python 3.14.10 is in the venv. Node 24.13.0 is installed. Package installs need separate authorization and a fresh advisory review.

### 4.2 Ouija Experience task 0: frontend gate check

Status: **VERIFIED**. Not ACCEPTED.

| Item | State | Evidence |
|---|---|---|
| Spec 2 §22.6 and Architecture §25 | Closed, same basis as 4.1 | Section 4.1 |
| O-D1 | Closed (owner decision C-D8) | `ouija-experience/design.md`, Open decisions |
| O-D3 | Closed (E-D1, DEC-3) | same |
| O-D7 | Closed (owner). The asset source and license gate stays before Ouija 10.3. | same |
| O-D11 | Closed (owner decision C-D1) | same |
| O-D2 | Resolved by reference to the canonical contract | same |
| Contract decisions C-D1 to C-D10 recorded in the Evidence design | Closed | Evidence `design.md` C.13, 10 of 10 rows closed |
| Owner-held items still open | O-D4, O-D5, O-D6, O-D8, O-D9, O-D10 | These are implementation-time choices. They are recorded when made. None is needed by I0. |

### 4.3 Evidence Retrieval task 15.1: confirm the canonical contract

Status: **VERIFIED** as a documentation confirmation. Not ACCEPTED.

- Confirmed: the canonical contract is the section "Shared integration contract (canonical)" in `.kiro/specs/evidence-retrieval/design.md` (C.1 to C.14).
- All owner decisions in its C.13 table are closed.
- C-D5: `investigation_id` is a UUID version 4 string, server-generated and unique per response. It appears in the C.4 table, C.11, C.13, the API section, and the open-decisions table. No stale "open" or "opaque" wording remains.
- The Ouija design and tasks reference the same value.
- The confirmation depends on no other task and on no Ouija task. No code was written.
- Effect: Ouija tasks 1 and 7 no longer wait on this prerequisite. They still depend on their other prerequisites.
- Not confirmed here: the `evidence_id` format and the duplicate-ID behavior (A2b).

### 4.4 Verification commands run and observed results

| Check | Result |
|---|---|
| Kiro spec validator on six native files | 0 diagnostics |
| Task and dependency graph check (Evidence: 56 leaf tasks, 11 waves, 409 edges. Ouija: 46 leaf tasks, 10 waves, 507 edges) | ALL DAG CHECKS PASSED |
| Checkboxes | 75 Evidence unchecked, 60 Ouija unchecked, 0 checked |
| Architecture document hash | Equal to the baseline |
| `.kiro/settings/mcp.json` hash | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`. Not opened or edited. `git status` shows no change under `.kiro/settings`. |
| `#[[file:...]]` targets | The four spec documents and the three decision records and architecture they reference exist. |

### 4.5 I0 result

I0 is **COMPLETE**: all three tasks are VERIFIED. No failures. No unresolved blocker for I0.

## 5. Next increment

Next authorized increment: **I1 = Evidence Retrieval subtasks 1.1, 1.2, and 1.3** (repository registration and selection). I1 has not started.

I1 needs, before it starts:
1. Owner approval to start I1.
2. The advisory review that D01 requires before backend work.
3. Authorization to install `pytest`. Nothing is installed.

Task 1.2 and 1.3 read a registry JSON file outside the repository and must not write to it.

## 6. Environment inventory: pytest installation (recorded 2026-11-10)

Owner authorization: granted for `pytest==9.2.0` and the six packages below as its transitive dependency set. D01 is not modified. This installation was not recorded in D01 and needs a document update only if the owner asks for one.

Command run (venv `backend\.venv`, Python 3.14.10):

```powershell
& 'c:\Users\User\source\repos\Sean\backend\.venv\Scripts\python.exe' -m pip install --no-input "pytest==9.2.0" "pluggy==1.7.0" "Pygments==2.21.0" "packaging==26.3" "iniconfig==2.3.1" "colorama==0.4.6"
```

Result: exit code 0. Added packages (exact versions): pytest 9.2.0, pluggy 1.7.0, Pygments 2.21.0, packaging 26.3, iniconfig 2.3.1, colorama 0.4.6. The venv went from 30 to 36 packages. No other package was installed, upgraded, or removed. pip stayed at 26.2.2.

Verification:
- `pip list` shows all six versions above.
- `pip check`: "No broken requirements found." (exit 0)
- `pytest --version`: `pytest 9.2.0` (exit 0)

Advisory results for these versions (2026-11-10): none found in the GitHub Advisory Database, and PyPI `vulnerabilities` is empty for each.

Existing packages, not modified (environment inventory): annotated-types 0.8.0, anyio 4.16.0, attrs 26.1.0, cffi 2.1.1, click 8.5.1, cryptography 50.0.2, h11 0.16.0, httpcore2 2.16.0, httpx2 2.16.0, idna 3.20, jsonschema 4.26.0, jsonschema-specifications 2025.9.1, mcp 2.3.0, mcp-types 2.3.0, opentelemetry-api 1.45.2, pip 26.2.2, pycparser 3.12, pydantic 2.14.3, pydantic_core 2.50.4, PyJWT 2.15.1, python-multipart 0.0.33, pywin32 312, referencing 0.37.0, rpds-py 2026.9.1, sse-starlette 3.7.0, starlette 1.10.0, truststore 0.10.5, typing_extensions 4.16.0, typing-inspection 0.4.5, uvicorn 0.54.0.

MCP-related packages above (mcp, mcp-types, httpx2, httpcore2, sse-starlette, starlette, PyJWT, cryptography, python-multipart, and their dependencies) are not in the D01 direct list. Their status is recorded here and not changed. `fastapi` is not installed.

Not done: no manifest, lockfile, or requirements file was created. No approved document was edited. I1 has not started.

## 7. Increment I1: Evidence Retrieval tasks 1.1 to 1.3 (recorded 2026-11-10)

Owner decision: **I1 ACCEPTED.** Tasks 1.1, 1.2, and 1.3 are accepted within the scope below.

### 7.1 Task status

| Task | Status | Scope accepted |
|---|---|---|
| 1.1 Registry file schema and location | ACCEPTED | Schema, strict unknown-key rejection, `schema_version` integer 1, `repository_id` rule, `%LOCALAPPDATA%\Sean\config\repositories.json` location via `core`. Verified by 83 unit tests (full suite, 0 skipped). |
| 1.2 Read-only loading, validation, resolution | ACCEPTED within module scope | Loader, per-entry validation, exclusion of invalid entries with problem data returned to the caller, duplicate-ID exclusion, root check at load and at each call, `resolve_repository` returning root and GitHub identity, and `REPOSITORY_NOT_FOUND` / `REPOSITORY_UNAVAILABLE`. |
| 1.3 Explicit GitHub identity | ACCEPTED | Explicit `github` object only. Absence returns `GITHUB_IDENTITY_UNRESOLVED` only when identity is requested, and does not block local resolution. Malformed block excludes the whole entry. No Git remote is read. |

Verification basis: `python -m pytest tests -q -rs` from `backend`, using the venv Python 3.14.10. Result: 83 passed, 0 failed, 0 skipped.

### 7.2 Scope boundaries (deferred, not in I1)

- **Application startup invocation of `load_registry`: deferred to Task 15.2** (API bootstrap). No application entry point was created in I1. `backend/app/main.py` remains the empty placeholder.
- **Observability logging of registry problems: deferred to Task 16.2** (Requirement 19). No logging infrastructure was added in I1. Problems are returned as data.
- **Full Git work-tree validation of a root: deferred to Task 3** (guarded Git runner). I1 checks only that an absolute, existing directory with a `.git` entry is present.
- **Requirement 1.2 (distinct evidence for the same source ID in two repositories): Task 7.** Not part of I1.
- **Requirement 1.4 and 1.5 at HTTP and MCP level:** tested at function level only. No HTTP or MCP caller exists before Tasks 15.2 and 17.

### 7.3 Native Spec checkboxes

The Evidence Retrieval `tasks.md` Notes define the convention: a `[ ]` checkbox means `NOT_STARTED`, and no checkbox is marked complete for `VERIFIED` or `ACCEPTED`. Following that convention, no checkbox was changed. All 75 Evidence and 60 Ouija checkboxes remain `[ ]`. No dependent or unrelated task was touched.

### 7.4 Files changed in I1

New files, all under `backend/`:
- `app/core/paths.py` (new; `local_data_dir()`, shared `%LOCALAPPDATA%\Sean` location)
- `app/modules/repository/registry.py` (new; registry models, loader, resolver, GitHub identity)
- `tests/unit/test_repository_registry.py` (new; registry tests)
- `tests/unit/test_core_paths.py` (new; core location tests)

Not changed: approved documents (`docs/`), native specification files, `main.py`, dependencies, manifests, lockfiles, `mcp.json`. Architecture document SHA256 unchanged (`3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9`).

### 7.5 Limitations carried forward

- No caller invokes the registry yet (Task 15.2).
- Problem data is returned but not logged (Task 16.2).
- Root check does not verify Git work-tree structure (Task 3).
- `pydantic` 2.14.3 is used by `registry.py` but is not listed in any manifest; the requirements file is not authorized.
- Symlink and junction handling for `.git` entries is not tested.

### 7.6 Next step

I2 has not started. It requires the owner's explicit authorization.

## 8. Increment I2: status (recorded 2026-11-10)

**Status: NOT STARTED. Blocked on scope definition and gates. No I2 task was implemented, and no checkbox changed.**

### 8.1 Why I2 is not started

1. **I2 scope is not defined in any repository artifact.** The I0 and I1 scopes were given explicitly by the owner. The Phase 3 increment plan (I0 to I6) is not in the workspace. The Native Spec wave graph (`.kiro/specs/evidence-retrieval/tasks.md`, wave 2) lists only candidate leaf tasks: 2.1 to 2.4, 7.1 to 7.3, 16.1, and 16.2. The owner must name the I2 tasks.
2. **Native requirements and design have no recorded approval.** `.kiro/specs/evidence-retrieval/requirements.md` states "Requirement status: draft for human review. Implementation tasks in `tasks.md` are pending approval." `tasks.md` states "NOT APPROVED. No task may start." Approval of I0 and I1 was given per task. No owner approval of the native requirements or design document is recorded. The Phase 2 review (design and requirements) also lists gaps to add and approve before Evidence tasks 2, 4, 5, and 18.
3. **Candidate blockers:**
   - Task 7.2 (derive `evidence_id` from namespace and source identifiers): blocked. The owner's decision is that the `evidence_id` format stays open until before Evidence 7.2.
   - Task 2 (path containment): requires a security review before it closes (2.4), and the Phase 2 review lists its requirement gaps as open.
   - Task 16.1 (configuration values): blocked by owner gate O-G1 (DEC-10 and E-D14 numeric limits). Task 16.2 (diagnostic fields and log hygiene, deferred from I1 by owner decision) does not need the values.
   - Tasks 7.1 and 7.3 (evidence model fields and unavailable-versus-absent rule): no open gate identified. Their requirements (4.1 to 4.5) exist in the draft.

### 8.2 Needed from the owner before I2 can start

1. Name the I2 tasks. Candidates that have no open gate are 7.1, 7.3, and 16.2.
2. Decide whether the native requirements and design are approved. If they are not, state whether the owner accepts per-task authorization as sufficient.
3. Confirm whether task 2 (path containment) is in I2. If it is, the requirement gaps and the security review must be handled first.
4. Confirm that the `evidence_id` format is not needed for I2. Task 7.2 must remain out of I2 until that decision is recorded.

### 8.3 Verification state

No new code was written for I2. The backend suite as of I1 acceptance: 83 passed, 0 failed, 0 skipped.

## 9. I2 authorization record and process deviation (recorded 2026-11-10)

### 9.1 Process deviation (retrospective, not an implementation defect)

Increment I1 was started under explicit per-task owner authorization before the Native Spec approval condition was formally resolved. `.kiro/specs/evidence-retrieval/tasks.md` lines 7 to 9 require, before any task starts, that a human approve `requirements.md` and `design.md`. That condition was not recorded when I1 began. The per-task authorization satisfied the task-level condition only.

Retrospective resolution: the owner now approves the Native Spec requirements and design for Tasks 7.1 and 7.3 only (section 9.2). The I1 result stays ACCEPTED. It is not reopened, and its implementation is not changed by this record.

### 9.2 Scoped Native Spec approval

The owner approves the current Native Spec requirements (`.kiro/specs/evidence-retrieval/requirements.md`) and design (`.kiro/specs/evidence-retrieval/design.md`) as the implementation baseline for Tasks 7.1 and 7.3 only.

This approval does not:
- authorize any other task;
- waive the D01 gaps (`docs/development/d01-dependency-decision-record.md` line 281), which keep Tasks 2, 4, 5, and 18 blocked;
- resolve O-G1, E-D15, or the evidence_id format;
- authorize changes to approved source documents.

### 9.3 Authorized scope

- Task 7.1: implement the evidence item fields and the source-type enumeration.
- Task 7.3: keep unavailable fields distinct from verified absence. Follows the data model established by 7.1.

### 9.4 Not authorized

- Task 7.2 (evidence_id derivation): the evidence_id format remains unresolved.
- Tasks 2.1 to 2.4 (blocked by D01 gaps, the security review, and O-G1 for the length bound).
- Task 16.1 (blocked by O-G1).
- Task 16.2 (diagnostic records and logging).
- Tasks 3, 4, 5, 8, 9, 11, and 18.
- Installation of any package, including Hypothesis.
- Any change to approved source documents.

### 9.5 Test environment

Installed: pytest 9.2.0, pydantic 2.14.3. Not installed: Hypothesis. The Property 6 verification text (`design.md` lines 408 to 415) asks for a test that simulates a failure for each field and asserts the listing and the absence of a value. That can be done with explicit enumeration over the field list, so no property-based library is needed for 7.3.

### 9.6 Checkbox convention

All task checkboxes stay unchanged, following the Evidence `tasks.md` Notes convention (`[ ]` for NOT_STARTED, no checkbox for VERIFIED or ACCEPTED).

## 10. Increment I2: results (recorded 2026-11-11)

Scope: Tasks 7.1 and 7.3 only, under the scoped Native Spec approval in section 9.2. Task 7.2 was not started. Tasks 2.x, 16.1, 16.2, and I3 were not started. Task checkboxes were not changed (all remain `[ ]`).

### 10.1 Task status

| Task | Status | Basis |
|---|---|---|
| 7.1 Evidence item fields and source-type enumeration | IMPLEMENTED | `EvidenceItem` and `SourceType` (six types, Requirement 4.2) are implemented and tested. Not VERIFIED against Requirement 4.1 in full: the "fields that apply to its source" rule needs an owner decision (see 10.3, item 1). |
| 7.3 Unavailable fields distinct from verified absence | VERIFIED (unit level) | Requirements 4.3 and 4.4 and design Property 6 are tested by explicit enumeration over all nine metadata fields. 125 evidence-model tests pass. |

Neither task is ACCEPTED. Only the owner accepts.

### 10.2 Files

New (both under `backend/`):
- `app/modules/evidence/models.py`
- `tests/unit/test_evidence_model.py`

No other file was created or modified by I2. Approved documents were last written on 11/10 between 8:19 and 8:30 PM, during the Phase 2 closure, and were not modified by I2.

### 10.3 Review findings and resolutions (`code-reviewer`, read-only)

Verdict: APPROVE_WITH_CHANGES. Resolutions:

1. **Blocking, working-tree scope (B1): resolved as not an I2 issue.** The reviewer listed approved-document modifications and untracked folders. Those predate I2. The four approved documents were edited during Phase 2 closure (section 2 and D01 "Approved sources changed in the Phase 2 closure"). The untracked `.kiro/specs/`, `.kiro/reports/`, and `docs/development/d03` predate I2 by the conversation record. The deletion of `.kiro/specs/.gitkeep` is attributed to Phase 2 native spec creation; the exact deletion time is not recorded in the workspace, so the owner should confirm that attribution.
2. **Major, placeholder whitespace (M2): fixed.** `NonEmptyStr` now rejects whitespace-only text (`app/modules/evidence/models.py`). Eleven text fields and `limitations` are covered by tests for spaces, tab, and mixed whitespace.
3. **Major, "not applicable" state (M1): open, owner decision required.** Requirement 4.1 says "the fields that apply to its source", and Spec 1 §8 says "as applicable". The model forces each metadata field to be a value, unavailable, or verified absent. For a `PULL_REQUEST` or `ISSUE`, `file_path` and `line_range` do not apply, so a caller would have to state a verified absence that the source never had. The approved text defines no applicability rule per source type. I did not invent one. Options for the owner: a per-source-type applicability table, or a third marker set `not_applicable_fields`. Either changes the design, so it needs approval.
4. **Minor, iteration order (m7): fixed.** The validator iterates `sorted(METADATA_FIELDS)`, so the reported field is stable across runs.
5. **Minor, frozen model (m6): covered.** A test asserts that a validated item cannot be changed.
6. **Minor, deferred items (m1): recorded.** `ranking` (task 8) and `relationship_to_target` (vocabulary not yet defined) are rejected by `extra="forbid"`, and a test pins that. Task 8 must update that test.
7. **Minor, open items not changed by I2:**
   - `commit_hash` accepts any non-empty, non-blank string. It is not checked as hexadecimal or against `source_id` (Spec 1 §8).
   - Code regions (Spec 1 §8, "line range or code region") are not modelled, only `line_range`.
   - `limitations=()` means "none" and cannot express "not determined".
   - Strict-mode input types (`SourceType` instances, `LineRange` instances, tuples, `datetime`) are reasoned, not tested against JSON input. That contract must be decided before API or MCP use (tasks 15.2 and 17.2).
   - Design "Core data model" (`design.md` lines 330 to 336) omits `verified_absent_fields` and `commit_hash`, and still lists `ranking` and `relationship_to_target`. Update at the design's approval.

### 10.4 Verification

| Command | Result |
|---|---|
| `python -m pytest tests/unit/test_evidence_model.py -q -rs` (from `backend`) | 125 passed, 0 failed, 0 skipped |
| `python -m pytest tests -q -rs` (from `backend`) | 208 passed, 0 failed, 0 skipped |

The test-engineer agent's shell is denied, so I ran the tests myself.

### 10.5 Test environment

pytest 9.2.0 and pydantic 2.14.3 are installed and sufficient. Hypothesis is not installed, and nothing was installed for I2. Design Property 6 is verified by explicit enumeration over the nine metadata fields. Property 5 (evidence identity, task 7.2) is out of scope and will need either Hypothesis, with separate authorization, or an explicit enumerated alternative.

### 10.6 Deferred work and remaining limitations

- Task 7.2 (evidence_id derivation): blocked by the evidence_id format decision. The model accepts an `evidence_id` value supplied by the caller and derives nothing.
- Task 8 (ranking): `ranking` is not modelled.
- Relationship to the target: not modelled. Its vocabulary must be defined before it is added.
- Owner decision M1 (above): the not-applicable state.
- The design-to-model mismatches in 10.3, item 7.

### 10.7 Next step

Wait for owner acceptance of I2. Tasks 7.1 and 7.3 are not accepted. The M1 decision is needed before 7.1 can be VERIFIED against Requirement 4.1. Task 7.2, Task 16.2, and I3 remain unstarted.

## 11. I2 applicability decision and review round (recorded 2026-11-11)

Owner decision on M1: use source-type applicability rules. No third `not_applicable_fields` marker. I2 tasks 7.1 and 7.3 remain in scope. Task 7.2 was not started, I3 was not started, and no checkbox changed. I2 is not ACCEPTED.

### 11.1 Applicability matrix (approved basis only)

Legend:
- **A**: applicable. The approved text lists the field for this source type, or names it as applicable ("when available", "as applicable"). Value, unavailable, or verified absent. This is the generic rule.
- **V**: applicable and must hold a value. Enforced only where approved text requires it (rule R1).
- **?**: applicability not stated in approved text. The generic rule applies (value, unavailable, or verified absent). Owner decision needed on whether the cell is not applicable or required.
- Commit column: rule R2 (40 lowercase hex) applies to every populated value.

| Source type | URL | Commit | File path | Line range | Author | Timestamp | Title | Excerpt | Integrity |
|---|---|---|---|---|---|---|---|---|---|
| GIT_COMMIT | A (§8 "when available") | A (§8 commit hash; R2) | ? | ? | A (§8; Spec 2 §9.2 "when available") | A (Spec 2 §9.2 "date") | A (§8 title; commit message §6) | A (Spec 2 §10.2 commit messages) | ? |
| GIT_BLAME | A | A (R2) | ? (blame_range input, §12) | ? (blame_range input, §12) | A | A | ? | A | ? |
| PULL_REQUEST | A | ? (merge commit, §7) | ? | ? | A (§7 "author and timestamps") | A (§7) | A (§7 "title and number") | A (§7 "description") | ? |
| ISSUE | A | ? | ? | ? | ? (§7 lists no issue author) | ? | A (§7 "issue title") | A (§7 "issue description") | ? |
| DOCUMENTATION | A | V (R1, Req 4.6; and R2) | V (R1, Req 4.6) | ? | ? | ? | ? | A (Spec 2 §10.2 documentation excerpts) | ? |
| CODE_HISTORY | A | A (R2) | ? (§5, §6) | ? (§5 "code region or line range") | A | A | ? | A | ? |

Four states per cell in the model:
- **Populated**: a value (always allowed for any field; R1 and R2 still apply).
- **Unavailable**: listed in `unavailable_fields`. Allowed only where the cell is A or ?. Not allowed for V cells.
- **Verified absent**: listed in `verified_absent_fields`. Same restriction as unavailable.
- **Not applicable**: no value and no marker. The model cannot represent this for any cell today, because no owner-approved not-applicable cell exists. Proposed not-applicable cells are in section 11.4.

### 11.2 Rules enforced now

Only two rules are enforced. Both are supported by approved text.

- **R1** (Requirement 4.6): a DOCUMENTATION item must hold `commit_hash` and `file_path` values. A marker is not accepted in place of a value, because Requirement 4.6 says the item is returned "with its commit and path." Implemented in `backend/app/modules/evidence/models.py` (DOCUMENTATION check before the generic loop).
- **R2** (Spec 1 §8 "commit hash"; Requirement 13.8 applied by analogy): a populated `commit_hash` must match `^[0-9a-f]{40}$`. Rejects uppercase, a short or long value, non-hex characters, a trailing newline, and SHA-256 length (64 characters). Implemented as `CommitHash` in `models.py`.

Contradictory states now rejected:
- A DOCUMENTATION item with no commit or path, with or without a marker.
- A DOCUMENTATION item marking its commit or path unavailable or absent.
- A populated commit that is not 40 lowercase hex.
- Any value that also appears in a marker set, and any missing A or ? field with no marker (generic rule, unchanged).

### 11.3 Gaps against Spec 1 §8 and owner decisions

| Spec 1 §8 item | Status in model | Needed |
|---|---|---|
| Stable evidence identifier | Field present; value caller-supplied | Task 7.2 (blocked, evidence_id decision) |
| Repository namespace, source type, source identifier, retrieval method, limitations | Present | None |
| Source URL | Present | None |
| Commit hash or external record identifier | Commit hash present (R2). External record identifier (PR or issue number) has no field; it can only go in `source_id`. | **D9**: separate field or `source_id` |
| File path | Present | Applicability (D1) |
| Line range or code region | Line range only. Code region not modelled. | **D7**: model structure. The "or" suggests one slot with two forms, and the code-region structure is undefined in approved text. |
| Author, timestamp, title, excerpt | Present | Applicability (D1). **D5**: whether a commit timestamp is the author date or the committer date. |
| Retrieval method | Free text | None for MVP |
| Integrity and availability metadata | `integrity` is free text, plus markers. Spec 1 §8 says the model must not imply the same integrity for every source type. | **D6**: integrity vocabulary per source type |
| Relationship to the investigated target | **Missing** | **D8**: vocabulary and owner decision. Required for 7.1 to be VERIFIED. Spec 2 §9.5 requires only that verified events be distinguished from inferred relationships, which is not a target-relationship vocabulary. |
| Ranking information | Deferred to task 8 (task 8.2 stores per-criterion awards) | None now. Explicitly assigned, not silent. |

### 11.4 Owner decisions required

1. **D1, applicability of "?" cells.** Approve the not-applicable and required cells in the matrix, or amend them. Proposed:
   - GIT_BLAME: file path and line range required (V). Basis: Spec 1 §12 defines `blame_range` by path and line range.
   - PULL_REQUEST: merge commit is not applicable when unmerged, and that absence is verified absent. Basis: §7 "merge status and merge commit".
   - ISSUE: commit and merge fields not applicable. Author and timestamp: owner to confirm the approved basis, because §7 does not list them.
   - CODE_HISTORY: file path and line range required. Basis: §5 and §6.
   - All other "?" cells: owner to decide.
   Until approved, "?" cells stay on the generic rule. No cell is treated as not applicable.
2. **D2.** For GIT_COMMIT, should `source_id` equal `commit_hash`? Not enforced. Proposed: yes, because a commit's source identifier is its hash.
3. **D5.** Commit timestamp semantics (author date or committer date).
4. **D6.** Integrity vocabulary per source type.
5. **D7.** Code-region representation: a separate field, or a union with line range.
6. **D8.** Relationship-to-target vocabulary, and whether it belongs in 7.1 (Spec 1 §8 and design list it; Requirement 4.1 does not).
7. **D9.** External record identifier: `source_id`, or a separate field.
8. **D10.** SHA-256 repositories: out of scope for MVP, or a supported case (R2 currently rejects them).
9. **R2 scope.** The reviewer asked whether R2 should apply only to commit-bearing types. R2 applies to the field named `commit_hash`. The model has no slot for a PR or issue number, so R2 rejects nothing that is stored today. Owner to confirm the scope once D9 is decided.

### 11.5 Test and review results

| Command or step | Result |
|---|---|
| `python -m pytest tests/unit/test_evidence_model.py -q -rs` (from `backend`) | 134 passed, 0 failed, 0 skipped |
| `python -m pytest tests -q -rs` (from `backend`) | 217 passed, 0 failed, 0 skipped |
| Fresh independent review (`code-reviewer`) | APPROVE_WITH_CHANGES. No blocking findings. Major: R2 scope for non-commit types (owner decision D9, section 11.4 item 9). Minor: regex trailing-newline behavior is engine-dependent; the test passes under pydantic's engine. Misleading comment above the R2 tests: fixed. Test isolation for R1: the marker cases isolate R1. |

Verification limits: the reviewer could not run tests and noted that the repository has no baseline for these untracked files. Its review was based on reading the code and approved text.

### 11.6 Task status after this round

| Task | Status | Basis |
|---|---|---|
| 7.1 Evidence item fields and source-type enumeration | IMPLEMENTED | Fields and enumeration are in place. Not VERIFIED: applicability cells, relationship_to_target, code region, integrity semantics, and the external record identifier still need owner decisions (section 11.3). |
| 7.3 Unavailable fields distinct from verified absence | VERIFIED (unit level) | Requirements 4.3 and 4.4 and design Property 6 are tested by enumeration over all nine metadata fields. |

Neither task is ACCEPTED. Only the owner accepts.

### 11.7 Process record: `.kiro/specs/.gitkeep`

**Finding: the deletion's cause and actor are unknown. Attribution is not established.** The file was left untouched.

Evidence:
- Git: the file was committed in `0e0e535 chore: initialize Sean project`. The index still tracks it (empty blob `e69de29`). The working tree lacks it (`git status`: ` D`). No commit removes it.
- Present at 2026-11-10 00:09:49 UTC. A read-only inventory in session `sess_58a5cd1d`, line 372, listed `.kiro\specs | otherEntries=0`, meaning the file existed with no other entries.
- Absent by 2026-11-10 23:51:47 UTC. `git status` in session `sess_7358965b`, line 1476, already shows ` D .kiro/specs/.gitkeep`.
- The `.kiro/specs` directory's own last entry change was 2026-11-10 23:04:41 UTC (local 19:04:41, timezone -04:00 per the HEAD commit). This is the last recorded change to its entries. It falls inside the window above.
- At 23:04:10 UTC a new user task began in session `sess_7358965b`. The next logged tool call was a read-only grep at 23:05:02 UTC. No logged tool call in any session deletes `.kiro/specs/.gitkeep`. The logged `delete_file` calls target `.kiro/agents` files (09:01 UTC on 11/10) and this session's temporary script.

Not established: the actor (the owner, the IDE, or a tool outside the logs), the reason, and whether the deletion caused any other change. Git history cannot show it because the deletion was never committed.

Correction: section 10.3, item 1 of this report said the deletion was "attributed to Phase 2 native spec creation." That statement had no evidence behind it and is withdrawn. The deletion is unknown.

Owner action: confirm whether you removed the file. If you did, confirm the reason. Leave the file untouched until you decide whether to restore it (for example, with `git checkout -- .kiro/specs/.gitkeep`), which needs your authorization.

### 11.8 Next step

Owner decisions D1 to D10 and the R2 scope item are needed before 7.1 can be VERIFIED. Task 7.2 requires the evidence_id decision. I3 has not started. I2 is not ACCEPTED.

## 12. I2: implementation of owner decision D9 (recorded 2026-11-11)

Owner authorization: D9 implemented with the final rules in the owner's brief. Scope limited to `backend/app/modules/evidence/models.py`, `backend/tests/unit/test_evidence_model.py`, and this report. No approved document, Native Spec requirement or design, task file, checkbox, or dependency changed. `.kiro/specs/.gitkeep` was not touched. Task 7.2 was not implemented. D1, D4, D5, D6, D7, D8, D10, and D11 remain open. Tasks 7.1 and 7.3, and I2, are not accepted. I3 has not started.

### 12.1 Implementation

`models.py`:
- Removed the universal 40-character lowercase SHA-1 rule (`CommitHash`). `commit_hash` is `NonEmptyStr | None`. No replacement length or hex rule was added. The `blame_range` revision rule (Requirement 13.8, Property 12) is not in the evidence model and was not changed.
- Added `DECIMAL_DIGITS = re.compile(r"[0-9]+")`, used with `fullmatch`. An all-zero value is rejected by `lstrip("0") == ""`. No upper bound.
- Added `_source_identity_is_consistent`, a model validator that runs before the metadata validator:
  - GIT_COMMIT: `commit_hash` must hold a value. A marker cannot replace it. `commit_hash` must equal `source_id`.
  - PULL_REQUEST and ISSUE: `source_id` must be a positive decimal string. `commit_hash` must not equal `source_id` (see 12.3, item 2).
- R1 (DOCUMENTATION requires commit and path values) is unchanged. Generic marker rules are unchanged.
- Added `import re`. Removed the `CommitHash` alias.

`test_evidence_model.py`:
- Deleted the six-case universal-hash test (R2). Those cases would have passed for the wrong reason under D9.
- Updated tests affected by the new rules: the each-source-type test now gives PR and ISSUE a numeric `source_id`. The unavailable and verified-absent tests, the missing-values test, and the missing-without-marker, marked-with-value, and marked-both tests use GIT_BLAME so that the D9 GIT_COMMIT rule does not mask the generic rule. The ISSUE marker test uses a numeric `source_id`.
- Added D9 tests: GIT_COMMIT without `commit_hash` (none, unavailable, verified-absent); GIT_COMMIT matching and mismatching identifiers; positive decimal identifiers accepted (including `01`, `2147483648`, and a 40-digit value); zero, negative, plus sign, leading and trailing whitespace, trailing newline, decimal point, underscore, letters, non-ASCII digits, and a commit SHA rejected; PR with a distinct merge commit; PR and ISSUE without a commit association, with a marker and without one; ISSUE with an optional commit; PR or ISSUE identifier used as `commit_hash` rejected; no equality for GIT_BLAME, CODE_HISTORY, or DOCUMENTATION; R1 still rejects markers in place of values.
- D9 rejection tests use `pytest.raises(..., match=...)`, so each test shows which rule fired.

### 12.2 Test results

| Command | Result |
|---|---|
| `python -m pytest tests/unit/test_evidence_model.py -q -rs` (from `backend`) | 187 passed, 0 failed, 0 skipped |
| `python -m pytest tests -q -rs` (from `backend`) | 270 passed, 0 failed, 0 skipped |

Both runs were repeated after the review fixes. The totals above are from the final runs.

### 12.3 Review and resolution

First fresh review (`code-reviewer`, read-only): APPROVE_WITH_CHANGES, no blocking findings. Resolutions:
1. **Leading zeros (major).** The reviewer found that the rule rejected `01`, which the owner text does not list. Resolved: the rule now follows the owner's list (zero, signs, whitespace, non-digits). `01` is accepted. Open owner question: see 12.4, item 1.
2. **PR and ISSUE `commit_hash` equal to `source_id` (major).** The reviewer said this is not in the D9 text. Resolution: kept, and cited as the enforcement of D9 semantic 9 ("PR and issue identifiers must never be interpreted as commit hashes"). Storing a PR or issue number as `commit_hash` is that interpretation. Open owner question: see 12.4, item 2.
3. **Blame, code-history, and documentation equality test (minor).** It checked only construction. Resolved: it now asserts the stored value.
4. **Generic-rule tests passing through the GIT_COMMIT path (minor).** Resolved: those tests use GIT_BLAME.
5. **Missing `match=` on D9 and generic-rule rejections (minor).** Resolved: each rejection test matches its rule's message.
6. **Spacing before `_not_blank` (style).** Resolved.
7. **Comment wording (informational).** Corrected where it said "number" for the owner's "identifier."

Follow-up review (`code-reviewer`, read-only): APPROVE, no blocking or major findings. Its one low finding, two generic-rule tests without `match=`, was resolved and the suites were rerun.

Mutation coverage, as reported by the reviewer: removing the GIT_COMMIT missing-value check, the GIT_COMMIT equality check, the regex anchoring, the PR and ISSUE commit-equality check, the blame or documentation equality exclusion, or R1 causes the corresponding D9 tests to fail. The reviewer did not execute these mutations. This is an inspection finding, not an executed result.

Known limit of the review: both reviews read the code and tests but did not run them. The results in 12.2 come from my own execution.

### 12.4 Remaining findings and open decisions

1. **Leading zeros (owner question).** The owner text does not list leading zeros as rejected, so `01` and `1` are both accepted as PR or issue identifiers. Two strings then name the same record, which can make identity unstable once 7.2 derives `evidence_id`. Owner should confirm whether canonical form (no leading zeros) is required.
2. **Semantic 9 equality check (owner confirmation).** The PR and ISSUE rule rejects `commit_hash == source_id`. It is kept as the enforcement of semantic 9. Owner should confirm it is wanted.
3. **Validator order (diagnostics only).** The D9 identity check runs before the generic metadata check. For GIT_COMMIT with a missing `commit_hash`, the D9 message replaces the generic message. Neither order can accept an invalid item. Only the first error is reported.
4. **Unchanged open decisions:** D1 (applicability of "?" cells), D4 (unmerged PR marker), D5 (commit timestamp semantics), D6 (integrity vocabulary), D7 (code region), D8 (relationship to target), D10 (SHA-256 and 40-character commit length), and D11 (composite identity for GIT_BLAME, CODE_HISTORY, and DOCUMENTATION). Task 7.1 cannot be VERIFIED until they are resolved.
5. **Working tree (pre-existing).** `git status` shows modified approved documents and untracked folders from earlier rounds. D9 did not change them. The earlier I2 review flagged the modified `spec-1` file; that remains for the owner to check.
6. **`.kiro/specs/.gitkeep`:** deletion cause and actor remain unknown (section 11.7). Not touched.

### 12.5 Status

| Item | Status |
|---|---|
| Task 7.1 | IMPLEMENTED (not VERIFIED; open decisions in 12.4) |
| Task 7.3 | VERIFIED at unit level, as before |
| I2 | Not accepted |
| Task 7.2, I3 | Not started |

## 13. I2: narrow correction to D9 (recorded 2026-11-11)

Owner clarification applied. Removed the rule that rejected `commit_hash == source_id` for PULL_REQUEST and ISSUE, and removed the test that expected that rejection (two parametrized cases). No replacement equality rule was introduced.

Kept unchanged: the GIT_COMMIT rule (`commit_hash` mandatory and equal to `source_id`); the PULL_REQUEST and ISSUE positive-decimal rule (full-string match of `[0-9]+`, all-zero values rejected, leading zeros accepted, no upper bound); R1; the generic marker rules; and all GIT_BLAME, CODE_HISTORY, and DOCUMENTATION behaviour. D10 and D11 remain open. No approved document, checkbox, or dependency changed.

| Command | Result |
|---|---|
| `python -m pytest tests/unit/test_evidence_model.py -q -rs` (from `backend`) | 185 passed, 0 failed, 0 skipped |
| `python -m pytest tests -q -rs` (from `backend`) | 268 passed, 0 failed, 0 skipped |

Counts fell by two from the previous run (187 and 270), matching the two removed cases.

Independent review (`code-reviewer`, read-only): APPROVE. No blocking or major findings. The reviewer confirmed the removed rule and test are gone, the GIT_COMMIT and decimal rules are intact, no replacement equality rule exists, and R1 and the generic rules are unchanged. The reviewer could not run tests and could not diff against a pre-correction baseline, because the files are untracked. One optional suggestion, a positive test for PR or ISSUE with equal values, was not added, since it was not requested.

Status: Task 7.1 IMPLEMENTED (not VERIFIED; open decisions D1, D4 to D8, D10, D11). Task 7.3 VERIFIED at unit level. I2 not accepted. Task 7.2 and I3 not started.

## 14. Owner acceptance of the D9 correction (recorded 2026-11-11)

The owner explicitly accepts the D9 implementation correction, with these decisions:

1. `GIT_COMMIT` requires a non-null `commit_hash`, and `commit_hash` must equal `source_id`.
2. `PULL_REQUEST` and `ISSUE` require a positive decimal `source_id`, validated by a full-string match. Zero-only values are rejected. Leading zeros are accepted. No upper bound is imposed.
3. `PULL_REQUEST` and `ISSUE` do not require `commit_hash` to differ from `source_id`. No equality restriction applies to these source types.
4. No universal 40-character SHA-1 restriction applies to evidence `commit_hash`.
5. The existing DOCUMENTATION R1 requirements and the generic unavailable and verified-absent marker rules remain unchanged.
6. Composite source identifier formats remain unresolved and are reserved for D11.

Verification record, as reported:
- Evidence model tests: 185 passed, 0 failed, 0 skipped.
- Full backend test suite: 268 passed, 0 failed, 0 skipped.
- Independent review: APPROVE, with no blocking or major findings. The reviewer did not execute tests and could not compare against a prior Git baseline, because the reviewed files are untracked.
- Non-blocking, not implemented: the reviewer's optional suggestion for a positive PR or ISSUE equality test (`source_id` and `commit_hash` both "123", accepted). The owner's decision 3 makes this test unnecessary, so it was not added.

Status:
- Task 7.1: IMPLEMENTED. Not VERIFIED, and not ACCEPTED. Open decisions D1, D4 to D8, D10, and D11 remain.
- Task 7.3: VERIFIED at unit-test level.
- I2: NOT ACCEPTED.
- Task 7.2: NOT STARTED.
- I3: NOT STARTED.
- Native Spec task checkboxes: unchanged.
- Approved specifications, architecture documents, decision records, source code, tests, dependencies, and configuration: not modified by this record.
- D1, D4 to D8, D10, and D11: not resolved by this record.

## 15. I2 consolidated resolution, implementation, and closure (recorded 2026-11-11)

Status: I2 IMPLEMENTED, ready for owner review. NOT ACCEPTED. No checkbox changed (75 Evidence and 60 Ouija tasks remain `[ ]`). I3 has not started. Task 16.2 is out of scope. Task 7.2 was included in I2 by the owner's latest authorization.

### 15.1 Task statuses (lifecycle)

| Task | Status | Basis |
|---|---|---|
| 7.1 Evidence item fields and source-type enumeration | IMPLEMENTED | Model, contract matrix, unit tests. Owner acceptance pending. |
| 7.2 Canonical identity, composite identifiers, `evidence_id` | IMPLEMENTED | `identity.py`, `evidence_id` derivation, identity tests. Owner acceptance pending. |
| 7.3 Metadata applicability and missing-value markers | IMPLEMENTED | Applicability matrix and marker rules, unit tests. |

Verification level: unit tests only. No property-based (Hypothesis) test exists because Hypothesis is not installed, and no install was authorized. Property 5 identity coverage uses enumerated tests.

### 15.2 Owner decisions implemented

- SHA-1 and SHA-256 object names (DEC-14 as updated). Shared validator `backend/app/core/git_objects.py`: exactly 40 or 64 lowercase hex characters, full-string match.
- D9: GIT_COMMIT `commit_hash` equals `source_id`. PULL_REQUEST and ISSUE `source_id` is a positive decimal, leading zeros accepted, no upper bound. No `commit_hash != source_id` rule. DOCUMENTATION keeps R1 (commit and path values required).
- D1: applicability states REQUIRED, OPTIONAL, NOT_APPLICABLE. Missing-value markers are only `unavailable_fields` and `verified_absent_fields`.
- D4: PR `commit_hash` is an optional merge commit. Not blocked on any GitHub API claim.
- D5: primary `timestamp` (creation time for PR and ISSUE). Optional `event_timestamps` (`merged_at`, `closed_at`). Timezone-aware, normalized to UTC, whole seconds. Naive and sub-second values are rejected, not truncated.
- D6: `IntegrityRecord` with `retrieved_at`, `served_from_cache`, `source_verification`, and optional `content_digest` (SHA-256 over the UTF-8 excerpt). A cache-served record must be `NOT_PERFORMED`. `VERIFIED_IN_REPOSITORY` applies only to Git types. `VALIDATED_RECORD_IDENTITY` applies only to GitHub types.
- D7 and X1: `line_range` is 1-based and inclusive. `revision` and `change_side` (PRE_CHANGE, POST_CHANGE) are coupled to CODE_HISTORY ranges. POST_CHANGE `revision` equals `commit_hash`; PRE_CHANGE `revision` differs from it. GIT_BLAME `revision` is the queried version and `commit_hash` is optional, so uncommitted lines are represented without an invented commit.
- D8: relationship kinds and fixed bases. TOUCHES_TARGET_PATH, CHANGES_TARGET_LINES, BLAMES_TARGET_LINES, DOCUMENTS_TARGET_PATH, and MENTIONS_TARGET are VERIFIED. SEMANTICALLY_RELATES_TO_TARGET is INFERRED.
- D10 and D11: canonical source identifiers. Path components are UTF-8 encoded with uppercase percent escapes. Colon and percent are always encoded. Path case is preserved. No Unicode normalization. `source_id` is stored as given and never mutated.
- O12: `evidence_id = "ev1_" + SHA-256` over a length-prefixed serialization of (`ev1`, namespace, source type, canonical source identifier). Excludes titles, excerpts, timestamps, retrieval time, and ranking.
- X2 to X10: HEAD is input convenience only (stored revision is a full object name). Author is name only. Source URLs are HTTPS only. No `untrusted_fields` model. Path normalization is rejected at the evidence layer if not normalized (owned by the repository module). ISSUE author is optional. Ranking is deferred to Task 8.

### 15.3 Files

New: `backend/app/core/git_objects.py`, `backend/app/modules/repository/paths.py`, `backend/app/modules/evidence/contract.py`, `backend/app/modules/evidence/identity.py`, `backend/tests/unit/test_git_objects.py`, `backend/tests/unit/test_repository_paths.py`, `backend/tests/unit/test_evidence_identity.py`.
Rewritten: `backend/app/modules/evidence/models.py`, `backend/tests/unit/test_evidence_model.py`.
Draft documents updated (SHA wording, data model, field list): `.kiro/specs/evidence-retrieval/design.md` (core data model, E-D4, Property 12), `requirements.md` (Requirement 13.8), `tasks.md` (6.1 wording only; checkboxes unchanged), `docs/development/d02-mcp-integration-decision-record.md` (DEC-14, §16.6 revision paragraph and error row, editorial subordination note above the §16.5 evidence field table). Approved Spec 1, Spec 2, and Architecture were not edited. `mcp.json` was not modified (SHA256 verified unchanged).

### 15.4 Verification

- Full backend suite: `python -m pytest tests -q -rs` from `backend`: 540 passed, 0 failed, 0 skipped (before review fixes: the same run passed; after review fixes it still passed, 540 passed).
- Focused evidence tests before the full run: 457 passed, 0 failed, 0 skipped.
- Git SHA-256 end-to-end compatibility: NOT demonstrated. Only the validation contract accepts 64-character names. No Git runner (Task 3) or blame interface (Task 17) exists yet. The planned temporary-repository check (`git init --object-format=sha256`) was not run.

### 15.5 Independent review (code-reviewer, read-only)

Verdict: APPROVE_WITH_CHANGES. No blocking findings. Changes made:
- Three rejection tests now assert their reason (`match=`).
- Design evidence field list corrected to the implemented fields (`relationship`; `ranking` deferred to Task 8, X10).

Open review findings, not resolved in I2:
- MAJOR: repository identity cross-check for `source_url` and PR or ISSUE `source_id` is not in the evidence model. It must be enforced where GitHub records are built (Task 9). I2 does not claim it.
- MAJOR: the test oracle for the applicability matrix (`test_evidence_model.py`) duplicates the `APPLICABILITY` matrix by hand. A wrong cell copied into both would pass. The owner should compare the matrix cell by cell against the approved I2 table before accepting D1.
- MINOR: `LineRange` tests do not cover `start > end` as a reason check, and there is no model-level test for abbreviated or uppercase `commit_hash`. Not added in this round.
- NOTE: error messages cite decision IDs and requirement numbers (for example `(D9)`). They must not reach user-facing API responses without review.
- NOTE: no length limits on title, excerpt, author, or limitations at the model level. Ingestion must enforce limits (DEC-10).
- NOTE: `repository_namespace` is case-sensitive. The registry must normalize names.
- NOTE: `paths.py` is a lexical subset of C.3a. Reserved names, trailing dots and spaces, and containment remain Task 2. The predicate is not a containment check.
- NOTE: one blank-line style point in `paths.py` after the `__future__` import.

### 15.6 Dependencies and limitations

- Task 2 (full C.3a path rules): not implemented.
- Task 3 (guarded Git runner) and Task 16.1 (numeric limits, O-G1): not implemented. Full SHA-256 support in Git interfaces is blocked until these tasks.
- Task 9 (GitHub): depends on the unverified `merge_commit_sha` availability claim (third-party reports only). Not relied on by I2.
- Git author date versus committer date semantics: not verified against official Git documentation. `timestamp` for GIT_COMMIT follows the author date proposal and remains unverified.
- `event_timestamps`: `None` cannot distinguish unmerged from unreported.
- Hypothesis is not installed. No property-based test exists for I2.
- Working tree status (`git status`) shows approved documents as modified and `.kiro/specs/.gitkeep` as deleted. These predate I2 (section 2 and D01). The `.gitkeep` deletion attribution remains unknown and was not changed.
- Owner acceptance of I2, and of Task 7.1, 7.2, and 7.3 individually, is pending. Nothing in this section is ACCEPTED.

## 16. I2 final closure: independent verification and remediation (recorded 2026-11-11)

Status: I2 IMPLEMENTED. NOT VERIFIED for Task 7.3 and therefore for I2, because four applicability cells have unresolved owner decisions (U-1 to U-4 below). I2 is not ACCEPTED. No checkbox changed (0 checked; 75 Evidence and 60 Ouija tasks `[ ]`). I3 was not started. Tasks 2, 3, 9, 12, 16, and 17 were not started.

### 16.1 Applicability matrix: independent comparison (closure requirement 1)

Approved source used: the six-source applicability matrix in the I2 investigation artifact, section 5 (`96a96c9d-b10a-4f45-a85b-cf3a4fe60eaf.md`, under the Kiro session artifacts folder, outside this repository). Its own status is PROPOSAL. Recommendation O1 asked the owner to approve it "as proposed, with ISSUE author OPTIONAL". The workspace contains no record that O1 was approved cell by cell. The owner's D1 decision approved the three states and the no-third-marker rule. It did not enumerate the cells. This is therefore an unconfirmed source for the cell values, and that gap is reported as U-1 to U-4 rather than resolved by assumption.

Comparison method: the test oracle `ARTIFACT_MATRIX` in `backend/tests/unit/test_evidence_model.py` is a literal transcription of artifact section 5. It is not derived from `contract.py`. 70 of the 72 field-by-type cells are in the oracle. CODE_HISTORY `revision` and `change_side` are excluded because they depend on `line_range` and are tested separately. Each rejection is checked against its expected reason, and the regular expression for each state is in `_expected_rejection`.

Result: 65 cells match. 5 cells disagree and are shown below. Artifact-silent cells (`change_side`, `event_timestamps`) follow owner decisions X1 and D5, not the artifact, and are marked as such in the oracle.

| Source type | Field | Approved candidate (artifact §5) | Implemented (`contract.py`) | Result |
|---|---|---|---|---|
| GIT_COMMIT | file_path | O | N | Disagree. U-3 |
| GIT_COMMIT | line_range | O | N | Disagree. U-3 |
| CODE_HISTORY | file_path | O | R | Disagree. U-1 |
| CODE_HISTORY | revision (unconditional) | R | R only when `line_range` is present (X1) | Disagree. U-4 |
| PULL_REQUEST | timestamp | O | R | Disagree. U-2 |
| ISSUE | timestamp | O | R | Disagree. U-2 |

Unresolved decisions (strict expected failures, `xfail(strict=True)`, 13 cases in total):
- U-1: CODE_HISTORY `file_path`. The artifact says O. The implementation says R, because the D11 identifier for a history item includes the path. A marker-free O would leave an identifier without its path. Owner decision needed.
- U-2: PULL_REQUEST and ISSUE `timestamp`. The artifact says O. The implementation says R, because D5 defines the primary timestamp as the creation time, which GitHub always reports. Owner decision needed. This is a strictness question, not a correctness question.
- U-3: GIT_COMMIT `file_path` and `line_range`. The artifact says O. The implementation says N. I first changed these to O. That change broke 77 tests, because every commit item then needed a marker. The only available marker is verified-absent, and it would assert a fact Sean did not check. The change was reverted. Owner decision needed.
- U-4: CODE_HISTORY `revision` without a line range. The artifact says R. X1 requires revision only for a line range, so the implementation says N. Owner decision needed.

Corrections made in this closure:
- The copied oracle was replaced with the artifact transcription, so the test no longer repeats the implementation.
- Matrix tests now check the rejection reason, not only that a `ValidationError` occurred.
- Three rejection tests from the review were already pinned to their reasons in the previous round.

Implementation changes in this closure: none to the applicability matrix. The GIT_COMMIT change was tried and reverted (U-3). The rest of the code changes are in 16.2.

### 16.2 Independent-review findings and their dispositions (closure requirement 2)

| Finding | Disposition |
|---|---|
| MAJOR-1: repository identity not checked for external metadata | Documented as an ingestion boundary (16.3). Not claimed as verified. Task 9. |
| MAJOR-2: applicability oracle duplicated the implementation | Fixed. The oracle is now the artifact transcription. The 5 disagreeing cells surface as U-1 to U-4. |
| MINOR-1: rejection tests did not check the reason | Fixed for the matrix and the CODE_HISTORY range tests (`match=`). |
| MINOR-2: LineRange and abbreviated/uppercase `commit_hash` tests missing | Fixed. Added: `start` below 1, `start` after `end`, a single line, abbreviated (7 and 39 characters), uppercase, over-long, and trailing-newline GIT_COMMIT commit names, and an abbreviated blame commit. |
| MINOR-3: design field list did not match the model and X10 | Fixed. The design lists `relationship`, `verified_absent_fields`, and no `ranking` (deferred to Task 8, X10). |
| NOTE-1: decision IDs and requirement references in error messages | Not verified at API level, because no HTTP or MCP layer exists yet. Messages such as `(D9)` and `(Requirement 4.6)` are internal. The API layer must map errors to the public codes in D02 §16.5 and must not forward model messages. Task 9 and the API tasks own this. |
| NOTE-2: no length limits | Documented in `models.py` as an ingestion responsibility under DEC-10 and E-D14. The numeric values are owner gate O-G1 (Task 16.1). |
| NOTE-3: namespace case | Registry responsibility, enforced there. `REPOSITORY_ID_PATTERN` is `^[a-z0-9][a-z0-9_-]{0,63}$` (`registry.py`). The evidence model does not repeat the rule, so it accepts any non-empty string. Ingestion must pass only registry-issued identifiers. |
| NOTE-4: style blank line in `repository/paths.py` | Fixed. |
| NOTE-5: `paths.py` is a lexical subset of C.3a | Confirmed. Its docstring states that it is not a containment check. Containment and reserved names belong to Task 2. |
| Check: `core/paths.py` duplicates path normalization | Confirmed not duplicated. It only returns `%LOCALAPPDATA%\Sean`. |

### 16.3 Repository identity validation boundary (closure requirement 3)

- The evidence model checks structure only: HTTPS URL form, full object names, normalized paths, and positive decimal PR and ISSUE numbers. It does not authenticate external metadata. It does not check that a PR, issue, or URL belongs to the registered repository.
- Repository identity validation must happen in the GitHub ingestion module (Task 9) before external records are accepted as repository-grounded evidence. Design section on GitHub ingestion: owner and name are compared case-insensitively, a mismatch returns `GITHUB_IDENTITY_MISMATCH`, and the registry supplies the explicit owner and name (Requirement 1.7).
- Responsible scope: Task 9. Verification status: NOT VERIFIED. Nothing in I2 claims this control.

### 16.4 SHA-256 status (closure requirement 4)

- Contract level, implemented and tested: `is_full_object_name` accepts 40 or 64 lowercase hexadecimal characters (`app/core/git_objects.py`), and the evidence model uses it for `commit_hash` and `revision`. Unit tests cover both lengths.
- Integration level: NOT VERIFIED. The planned check (`git init --object-format=sha256` in a temporary directory, then confirm that `git rev-parse` returns a 64-character name) was not run. It belongs to Task 3, which is not started. The Git runner and the blame interface (Task 17) do not exist.
- Documentation: E-D4, Property 12, Requirement 13.8, tasks 6.1 and 6.2, and D02 DEC-14 and §16.6 all describe the contract, and state that SHA-256 support is claimed only where implementation and tests demonstrate it. Checked by search: no document claims end-to-end SHA-256 support.

### 16.5 Documentation audit (closure requirement 5)

Protected hashes (SHA-256):

| File | Recorded baseline | Current | Result |
|---|---|---|---|
| `docs/architecture/architecture-and-project-setup.md` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | Match |
| `.kiro/settings/mcp.json` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | Match. Not modified. |
| `docs/specs/spec-1-evidence-retrieval.md` | None recorded | `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004` | Cannot verify. No baseline. |
| `docs/specs/spec-2-ouija-experience.md` | None recorded | `EF7971157A0CE169780F012D3436A6B42717F7C55B7C963DE659BB7254776AEC` | Cannot verify. No baseline. `git diff` shows no change against HEAD. |

Remaining modified tracked documents (`git diff` against HEAD):
- `docs/specs/spec-1-evidence-retrieval.md` (22 lines): version 2.3 to 2.4. Changes to D01 to D08 status rows and to FR-10. Not edited in this closure. The change is recorded as Phase 2 closure work (phase-status section 2; D01 "Approved sources changed in the Phase 2 closure"). The Spec 1 file has no change-history entry, so the owner must confirm these edits.
- `docs/architecture/architecture-and-project-setup.md` (19 lines): version 1.3 to 1.4. Its own change history records the edits (licence holder, Kiro IDE version, DEC-13 deviation). Not edited in this closure. Its current hash matches the recorded baseline.
- `docs/development/d01-dependency-decision-record.md` (122 lines) and `docs/development/d02-mcp-integration-decision-record.md` (150 lines): decision records, not approved sources. D01 was not edited in this closure. D02 was edited in this closure only for DEC-14, the §16.6 revision paragraph and input row, the §16.6 error row, and the editorial note above the §16.5 field table. The note states that §16 is subordinate to approved Spec 1 §8 and Requirement 4.4.

Untracked and deleted entries: the untracked `.kiro/reports/`, `.kiro/specs/evidence-retrieval/`, `.kiro/specs/ouija-experience/`, and `docs/development/d03...` predate I2 (section 2). The four `.gitkeep` deletions are described in 16.7.

Other observation (not changed): the Architecture and Spec 1 files show mojibake sequences (for example `ΓÇö` in place of an em dash), in HEAD and in the working copy. Those characters predate I2. Fixing them would edit approved documents, so the owner must decide.

### 16.6 Final verification (closure requirement 7)

- Command: `python -m pytest tests -q -rxXs --tb=short`. Working directory: `backend`. Interpreter: `backend\.venv\Scripts\python.exe` (Python 3.14.10). Result: 538 passed, 0 failed, 0 skipped, 13 xfailed (strict expected failures for U-1 to U-4). Exit status 0.
- `python -m pip check`: "No broken requirements found." Exit status 0.
- Dependencies: no installs and no changes in this closure. Hypothesis is not installed and was not installed.
- Property-based testing: NOT RUN. Property 5 and Property 12 use enumerated tests only.
- `.kiro/settings/mcp.json`: unchanged (hash match above).
- Task checkboxes: 0 `[x]` in both task files. 75 open in the Evidence tasks and 60 open in the Ouija tasks, which matches the prior count.
- I3 and unrelated work: not started. The untracked files are limited to I2 scope (`git_objects.py`, `core/paths.py`, `repository/paths.py`, `repository/registry.py` from I1, and `evidence/{contract,identity,models}.py`, plus their tests).
- Git: changes are not staged and not committed.

### 16.7 `.kiro/specs/.gitkeep` (closure requirement 6)

`.kiro/specs/.gitkeep` is still deleted in the working tree. It was not restored, staged, or changed. Its attribution and motivation are unknown and are not attributed to I2 or to any person. It is an unresolved repository-history item, separate from I2 status. The three other `.gitkeep` deletions (`backend/app/modules/evidence/`, `backend/app/modules/repository/`, and `backend/tests/unit/`) are expected results of creating files in those directories for I2. They are listed here for transparency.

### 16.8 Task statuses

| Task | Status | Basis |
|---|---|---|
| 7.1 Evidence item fields and source-type enumeration | VERIFIED (unit level) | `test_evidence_model.py` passes, except the cells listed under 7.3 that depend on the applicability matrix. |
| 7.2 Canonical identity, composite identifiers, `evidence_id` | VERIFIED (unit level) | `test_evidence_identity.py` and `test_git_objects.py` pass. Property-based coverage not run (Hypothesis not installed). |
| 7.3 Applicability and missing-value markers | IMPLEMENTED, NOT VERIFIED | Four cell decisions remain open (U-1 to U-4). |
| I2 overall | IMPLEMENTED, NOT VERIFIED | Blocked by 7.3 open owner decisions. |

Owner acceptance: none recorded. I2 is not ACCEPTED.

### 16.9 Owner decisions needed to close I2

1. U-1: CODE_HISTORY `file_path` optional (artifact) or required (implementation, D11)?
2. U-2: PULL_REQUEST and ISSUE `timestamp` optional or required?
3. U-3: GIT_COMMIT `file_path` and `line_range` optional (which forces a marker on every commit item) or not applicable?
4. U-4: CODE_HISTORY `revision` required without a line range, or only with one?
5. Confirm that artifact section 5 is the approved matrix (its O1 recommendation). If so, U-1 to U-4 must be decided by reference to it. If not, the owner must supply the approved matrix.
6. Confirm the Spec 1 v2.4 edits and the Phase 2 closure edits to the approved documents (16.5), and the `.gitkeep` attribution (16.7).
7. Task 3 (integration check of SHA-256 with Git) and Task 9 (identity validation) remain required before any SHA-256 or GitHub-grounding claim.

## 17. I2 owner decisions U-1 to U-4 applied, and final verification (recorded 2026-11-11)

Status: Task 7.1 VERIFIED (unit level). Task 7.2 VERIFIED (unit level). Task 7.3 IMPLEMENTED, NOT VERIFIED, because owner decision U-2 contains a clause the REQUIRED rule cannot satisfy (17.2, conflict C-1). I2 is therefore NOT VERIFIED. I2 is NOT ACCEPTED. No checkbox changed: 0 `[x]`, 75 open Evidence tasks, 60 open Ouija tasks. I3 was not started.

### 17.1 Owner decisions applied

| Decision | Matrix cell | Implementation (`contract.py`) | Test evidence |
|---|---|---|---|
| U-1 | CODE_HISTORY `file_path`: REQUIRED | R (unchanged) | Oracle R. Positive: base item accepted. Negative: no value gives `CODE_HISTORY requires file_path`. Marker gives `... requires file_path (a marker cannot replace it)`. Expected failures removed. |
| U-2 | PULL_REQUEST and ISSUE `timestamp`: REQUIRED | R (unchanged) | Oracle R. Positive: value accepted. Negative: no value gives `<kind> requires timestamp`. Marker gives `... (a marker cannot replace it)`. Expected failures removed. Clause C-1 open (17.2). |
| U-3 | GIT_COMMIT `file_path` and `line_range`: NOT_APPLICABLE | N (unchanged; my earlier change to OPTIONAL was reverted in 16.1) | Oracle N. Positive: absent accepted. Negative: value gives `... is not applicable to GIT_COMMIT`. Marker gives `... and cannot carry a marker`. |
| U-4 | CODE_HISTORY `revision`: REQUIRED with or without a line range | R. Changed from R-only-with-range (RWL). | Oracle R. Positive: whole-file record with revision and no line range accepted. Negative: no value or marker gives `CODE_HISTORY requires revision` (with or without the marker text). |

Other fixture changes, all required by U-4 and not new decisions:
- The CODE_HISTORY test base now has `revision` set to the commit. Before, the base had no revision, so every CODE_HISTORY test would fail.
- The test `test_code_history_whole_file_record_needs_no_revision_or_side` now asserts that a whole-file record carries its revision and no change side.
- `test_revision_is_rejected_when_line_range_is_absent` was rewritten as `test_change_side_is_rejected_when_line_range_is_absent`. The old assertion expected revision to be rejected without a range, which U-4 reverses. The new assertion checks change_side (X1).
- The identity test `test_sha256_composite_identifiers_are_accepted_by_the_model` now sets `revision` to the SHA-256 commit. This failed before the fix because U-4 requires it.

### 17.2 Corrected matrix comparison

Approved baseline: artifact section 5 (`96a96c9d-b10a-4f45-a85b-cf3a4fe60eaf.md`) with resolutions U-1 to U-4. The oracle `ARTIFACT_MATRIX` in `test_evidence_model.py` is a literal transcription. It is not derived from `contract.py`.

Coverage: 70 field-by-type cells, each tested in three states (value, marker, none), giving 210 test cases. Excluded: CODE_HISTORY `line_range` and `change_side`, which are coupled by X1 and tested explicitly.

Result: all 70 cells match the implementation. Changes between the previous round and this round:

| Cell | Previous implementation | Corrected baseline | Implementation after this round | Result |
|---|---|---|---|---|
| GIT_COMMIT file_path | N | N (U-3) | N | Match |
| GIT_COMMIT line_range | N | N (U-3) | N | Match |
| CODE_HISTORY file_path | R | R (U-1) | R | Match |
| CODE_HISTORY revision | R only with line range | R (U-4) | R | Match. Implementation changed. |
| PULL_REQUEST timestamp | R | R (U-2) | R | Match |
| ISSUE timestamp | R | R (U-2) | R | Match |

Cells outside the matrix (not in artifact section 5), decided by other owner decisions and left unchanged:
- CODE_HISTORY `change_side`: REQUIRED with a line range, NOT_APPLICABLE without one (X1).
- `event_timestamps`: OPTIONAL for PULL_REQUEST (D5 and X3), NOT_APPLICABLE for the other types. Artifact silent.
- `source_id`, `integrity`, `limitations`: structural fields, not in the matrix.

Expected failures: none. The `xfail` markers and `UNRESOLVED_CELLS` were removed. A repository search for `xfail` in `backend/` finds no marker.

### 17.3 Conflict C-1 (requires owner clarification; not resolved by assumption)

U-2 says the timestamp is REQUIRED and that, "if it cannot be obtained, represent its unavailability explicitly". The three-state rule in D1 says REQUIRED accepts a value and no marker. Both cannot hold. The implementation keeps the REQUIRED rule, so a PULL_REQUEST or ISSUE without a timestamp is rejected, and a marker is rejected too. The tests assert this strict reading. No new state was added.

The owner must choose one:
- (a) Keep REQUIRED as value-only. The unavailability sentence is dropped. A record without a creation time cannot be stored. Tasks 7.3 and I2 can then be VERIFIED.
- (b) Add an explicit unavailable state for REQUIRED timestamps. This changes the D1 three-state rule, so it needs an owner decision that the owner's D1 approval does not cover, and a new test set.

### 17.4 Test results

- Command: `python -m pytest tests -q -rfxXs --tb=short`. Working directory: `backend`. Interpreter: `backend\.venv\Scripts\python.exe`.
- Result: 571 passed, 0 failed, 0 skipped, 0 xfailed. Exit status 0. The earlier run in this round had one failure, the SHA-256 identity fixture described in 17.1, which was then fixed and re-run.
- Evidence model file alone: 401 passed, 0 xfailed.
- `python -m pip check`: "No broken requirements found." Exit status 0.
- Not run: property-based tests. Hypothesis is not installed and was not installed in this closure.

### 17.5 Task status

| Task | Status | Basis |
|---|---|---|
| 7.1 Evidence item fields and source-type enumeration | VERIFIED (unit level) | Field and source-type tests pass. Matrix cells pass. |
| 7.2 Canonical identity, composite identifiers, `evidence_id` | VERIFIED (unit level) | Identity and `git_objects` tests pass. Property 5 covered by enumerated tests only (no Hypothesis). |
| 7.3 Applicability and missing-value markers | IMPLEMENTED, NOT VERIFIED | The owner's U-2 unavailability clause is not satisfiable under the REQUIRED rule (C-1). |
| I2 overall | IMPLEMENTED, NOT VERIFIED | Blocked by C-1. |

NOT ACCEPTED. No owner acceptance is recorded.

### 17.6 Spec 1 diff audit (v2.4)

Command: `git --no-pager diff -U0 -- docs/specs/spec-1-evidence-retrieval.md`. The diff has 22 changed lines (11 removed, 11 added), in four hunks. Spec 1 was not modified in this closure.

| Lines (current) | Change | Trace | Result |
|---|---|---|---|
| 4 | Version 2.3 to 2.4 | D01 "Approved sources changed in the Phase 2 closure: Spec 1 (version 2.4)". Phase-status §4 gate table: "Spec 1 v2.4 ... Approved". | Traced |
| 7 | Previous version 2.2 to 2.3 | Same record (version 2.4 supersedes 2.3). | Traced |
| 115 | FR-10 wording (MCP tools) | D01 item 2: "FR-10 clarified in version 2.4 (CC-2, Option A)". Design C.12 and C-D6: keep the four §12 tools. The exact wording of "Option A" is not recorded in the workspace. | Partly traced. The wording itself is not verifiable from the record. |
| 771 (D01 row) | "Resolved for Phase 2 by documentary compatibility research... Runtime and lock verification in Phase 3." | D01 status table: Phase 2 dependency compatibility accepted by owner decision 2. Phase 3 for installation and locks. | Traced |
| D02 row | "Design resolved (`mcp==2.3.0`, STDIO)... Runtime verification in Phase 4." | D02 SDK pin row: "Selected by owner (Phase 2 closure) ... Runtime verification deferred to Phase 4." | Traced |
| D03 row | Resolved, `django/django`, tag 5.2, commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0`. | Design E-D9; phase-status Phase 2 decision closure (D03 created, tag verified). | Traced |
| D04 row | "Pending, Phase 4." | No record found for the Phase 4 assignment. | Not traced |
| D05 row | "Pending, Phase 4 (calibration depends on Golden results)." | No record found. | Not traced |
| D06 row | "Pending, Phase 3." | No record found. | Not traced |
| D07 row | Partly resolved: registry location under `%LOCALAPPDATA%\Sean\config\`. | Design E-D1 and E-D7. | Traced |
| D08 row | "Pending, Phase 3." | No record found. | Not traced |

Result: the approved v2.4 release is recorded only at the header level and in D01 and the design. Four status rows (D04, D05, D06, D08) carry phase assignments that no workspace record supports. The FR-10 wording cannot be checked against the exact "Option A" text. The owner must confirm these before Spec 1 v2.4 can be treated as fully traced. Spec 1 is not modified by this closure.

### 17.7 Document audit and protected hashes

| File | Baseline | Current SHA-256 | Result |
|---|---|---|---|
| `docs/architecture/architecture-and-project-setup.md` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | Match |
| `.kiro/settings/mcp.json` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | Match |
| `docs/specs/spec-1-evidence-retrieval.md` | None recorded | `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004` | No baseline. 17.6. |
| `docs/specs/spec-2-ouija-experience.md` | None recorded | `EF7971157A0CE169780F012D3436A6B42717F7C55B7C963DE659BB7254776AEC` | No baseline. No diff against HEAD. |

Modified I2 drafts in this closure: `design.md` (CODE_HISTORY and GIT_COMMIT sentence in the evidence item contract; Property 12 heading), and the test and implementation files. D02 was not edited in this closure. `phase-status.md` gained sections 16 and 17.

### 17.8 Scope boundaries (preserved)

- GitHub repository identity validation: Task 9. Not claimed.
- Git SHA-256 integration check (`git init --object-format=sha256`): Task 3. Not run.
- Public API error mapping (internal decision IDs such as `(D9)` appear in model messages): API implementation. No API exists yet, so it is not verified.
- Ingestion length limits (DEC-10): Task 16.1, gate O-G1.
- `.kiro/specs/.gitkeep`: still deleted in the working tree (`Test-Path` returns False). Not restored, staged, or attributed. The other three `.gitkeep` deletions (`backend/app/modules/evidence/`, `backend/app/modules/repository/`, `backend/tests/unit/`) occur because files now exist in those directories.
- No dependencies installed. No commit or stage. No I3 work started.

### 17.9 Owner actions required before I2 can be VERIFIED and accepted

1. Resolve conflict C-1 (17.3): option (a) or option (b).
2. Confirm D04, D05, D06, and D08 phase assignments in Spec 1 v2.4, and the exact FR-10 wording (17.6).
3. Note a model observation (not changed): for a whole-file CODE_HISTORY record, the canonical identifier is `<commit>:<path>` and does not include `revision`. Two records with the same commit and path but different revisions therefore get the same `evidence_id`. The owner should decide whether whole-file revision must equal `commit_hash`, or whether revision belongs in the identifier.
4. External dependencies that remain: Task 3 (Git SHA-256), Task 9 (GitHub identity and `merge_commit_sha`), API error mapping, and DEC-10 / Task 16.1 (length limits and numeric values).
5. Owner acceptance of I2 is pending. Nothing in this section is ACCEPTED.

## 18. I2 final contract decisions and closure (recorded 2026-11-11)

Status: Task 7.1 VERIFIED (unit level). Task 7.2 VERIFIED (unit level). Task 7.3 VERIFIED (unit level). I2 VERIFIED at unit level, with the caveats in 18.6. I2 is NOT ACCEPTED. No checkbox changed: 0 `[x]`, 75 open Evidence tasks, 60 open Ouija tasks. I3 was not started. No dependency was installed. Nothing was staged or committed. Spec 1 and Spec 2 were not modified.

### 18.1 C-1: required timestamps (owner option A)

- `PULL_REQUEST.timestamp` and `ISSUE.timestamp` are REQUIRED. A value must be present. Neither `unavailable_fields` nor `verified_absent_fields` may mark them.
- The earlier sentence that allowed explicit unavailability for these timestamps is removed from the draft design and the test comments. The record in section 17.3 is kept as history.
- The four-state rule and D1 are unchanged. No fourth applicability state was added.
- Code status: `contract.py` already had both timestamps as REQUIRED. The tests assert that a value is accepted, that an absent value gives `<kind> requires timestamp`, and that a marker gives `<kind> requires timestamp (a marker cannot replace it)`. No code change was needed for C-1.
- Ingestion boundary: if the source creation timestamp cannot be obtained, the ingestion layer must not build a compliant evidence record. It reports an ingestion limitation. The evidence model is not weakened. This rule is written in the design draft (Evidence item contract). Its implementation belongs to the GitHub ingestion module (Task 9). It is not verified in I2.

### 18.2 CODE_HISTORY whole-file identity collision (resolved)

The collision: the earlier whole-file identifier `<commit>:<path_enc>` gave the same canonical source ID to two whole-file records with the same commit and path but different revisions. X1 allows the revision to differ from the commit, so the collision was real.

Decision (owner): use the revision as an identity dimension. `revision` is not forced to equal `commit_hash`.

Identifier formats (D11 as updated):

| Record | Earlier format (superseded) | Current format |
|---|---|---|
| CODE_HISTORY whole file | `<commit>:<path_enc>` | `<commit>:<revision>:<path_enc>` |
| CODE_HISTORY line range | `<commit>:<pre\|post>:<revision>:<path_enc>:<start>-<end>` | `<commit>:<revision>:<path_enc>:<start>-<end>` |
| DOCUMENTATION | `<commit>:<path_enc>` | `<commit>:<path_enc>` (unchanged) |
| GIT_BLAME | `<revision>:<path_enc>:<start>-<end>` | unchanged |

Implementation:
- `backend/app/modules/evidence/identity.py`: `code_history_source_id(commit, revision, path)` and `code_history_range_source_id(commit, revision, path, start, end)`. Both validate `commit` and `revision` as full object names through the shared contract in `app/core/git_objects.py`, and raise `ValueError` otherwise. `documentation_source_id(commit, path)` keeps the DOCUMENTATION form, so it no longer shares a builder with CODE_HISTORY.
- `models.py` (`_expected_composite_id`): CODE_HISTORY uses the new builders. Change-side coupling is still checked before a range identifier is built.
- `contract.py`: `SIDE_TOKEN` was removed, because no formula uses the side token now.
- Path encoding (UTF-8 bytes, uppercase percent escapes, colon and percent always encoded, case preserved, no Unicode normalization) is unchanged.

Side token: the owner's formula does not include the side token. I followed it. The side is still determined by the identifier, because of the change-side coupling rule. POST_CHANGE requires `revision == commit_hash`, and PRE_CHANGE requires `revision != commit_hash` (X1, enforced in `models.py`). So the revision already carries the side, and PRE and POST records at different revisions remain distinct. Two range records at the same revision cannot have different sides.

Unambiguity: path components encode `:` and `%`, so a colon always separates fields. A whole-file identifier has three fields after the commit and a range identifier has four, the last being `<start>-<end>`.

O12: the `evidence_id` derivation tuple `(ev1, namespace, source type, canonical source identifier)` is unchanged. The change is carried in the canonical source identifier only.

Document updates: `design.md` (Evidence item contract paragraph, with the identifier forms and the C-1 rule). The D11 record in the repository is section 15.2 of this file, which predates this decision. Section 15.2 is kept as history, and its CODE_HISTORY formats are superseded by this section. There is no separate D11 file in the repository. The consolidated investigation artifact (outside the repository, under the Kiro session artifacts folder) was not modified.

Tests:
- Positive: the whole-file and range identifier formats, with exact strings, and the revision-based PRE and POST identifiers (`test_evidence_identity.py`).
- Collision (canonical source IDs): whole-file records that differ only in revision (`test_whole_file_records_differing_only_in_revision_have_distinct_canonical_ids`), and line-range records that differ only in revision (`test_line_range_records_differing_only_in_revision_have_distinct_canonical_ids`).
- Collision (evidence IDs, model level): whole-file records that differ only in revision, two PRE_CHANGE ranges at different revisions, and a whole-file record compared with a POST_CHANGE range (`test_evidence_model.py`).
- Whole-file and range records never share an identifier, and a table of awkward paths gives no collisions across whole-file and range forms (`test_code_history_identifiers_are_injective_over_paths_revisions_and_ranges`).
- Negative: abbreviated, uppercase, and over-long names in either position raise `ValueError` (`test_code_history_builders_reject_abbreviated_and_uppercase_names`). Model-level rejection of these names is also tested (section 15 tests).
- DOCUMENTATION keeps its format (`test_documentation_identifier_is_unchanged_by_the_code_history_decision`).

### 18.3 Spec 1 v2.4 traceability gaps (owner confirmation required; Spec 1 not modified)

Spec 1 was not modified. The 22 changed lines were traced in section 17.6. Four items remain untraced, and I do not claim them as traced. No retrospective decision record was created for them.

| Item | Spec 1 v2.4 text | Gap |
|---|---|---|
| D04 phase | "Pending, Phase 4." | No workspace record assigns D04 to Phase 4. |
| D05 phase | "Pending, Phase 4 (calibration depends on Golden results)." | No workspace record assigns D05 to Phase 4. |
| D06 phase | "Pending, Phase 3." | No workspace record assigns D06 to Phase 3. |
| D08 phase | "Pending, Phase 3." | No workspace record assigns D08 to Phase 3. |
| FR-10 wording | "Sean must expose the four MCP tools listed in Section 12 through MCP..." | D01 and the design record "FR-10 clarified in version 2.4 (CC-2, Option A)" and C-D6. The exact "Option A" wording is not in the workspace. The line cannot be checked against it. |

These gaps are visible here. They do not authorize reopening the approved specification. The owner must confirm them.

### 18.4 Final verification

- Command: `python -m pytest tests -q -rfxXs --tb=short`. Working directory: `backend`. Interpreter: `backend\.venv\Scripts\python.exe`.
- Result: 582 passed, 0 failed, 0 skipped, 0 xfailed. Exit status 0.
- Identity, model, and collision selection (`-k` over collision, code_history, whole_file, line_range, documentation, U-1 to U-4, decimal, sha256, git_commit): 184 passed, 0 failed.
- `python -m pip check`: "No broken requirements found." Exit status 0.
- Expected failures: none. A search of `backend/tests` finds no `xfail` marker. The only `skip` is a conditional symlink test in `test_repository_registry.py`, which did not skip in this run.
- Applicability matrix: 70 field-by-type cells, three states each, with no unresolved cells. U-1 to U-4 and C-1 are reflected in the matrix oracle.
- Dependencies: no install. Hypothesis is not installed.

### 18.5 Protected documents and working tree

| File | Baseline | Current SHA-256 | Result |
|---|---|---|---|
| `docs/architecture/architecture-and-project-setup.md` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9` | Match |
| `.kiro/settings/mcp.json` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2` | Match. Not modified. |
| `docs/specs/spec-1-evidence-retrieval.md` | None recorded | `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004` | No baseline. Diff unchanged from section 17.6 (22 lines). Not modified in this closure. |
| `docs/specs/spec-2-ouija-experience.md` | None recorded | `EF7971157A0CE169780F012D3436A6B42717F7C55B7C963DE659BB7254776AEC` | No baseline. No diff against HEAD. |

- `git status`: the same tracked changes as section 17.7. Tracked and unchanged in this closure: the Architecture, Spec 1, D01, and D02 files. Untracked I2 files: `backend/app/core/git_objects.py`, `backend/app/core/paths.py`, `backend/app/modules/repository/{paths,registry}.py`, `backend/app/modules/evidence/{contract,identity,models}.py`, and the matching tests. Also untracked from earlier rounds: `.kiro/reports/`, `.kiro/specs/evidence-retrieval/`, `.kiro/specs/ouija-experience/`, and the D03 record.
- Staged files: 0. No commit.
- `.kiro/specs/.gitkeep`: still absent (`Test-Path` returns False). Not restored, staged, or attributed. The three other `.gitkeep` deletions are the result of files now existing in those directories.
- Task checkboxes: 0 `[x]`, 75 open Evidence, 60 open Ouija. Unchanged.
- I3: not started. No I3 module or test exists.

### 18.6 Caveats and remaining external dependencies

- Property-based verification (Properties 5 and 12) is not run. Hypothesis is not installed. Coverage is by enumerated tests only. The owner must decide whether this is acceptable for unit-level verification.
- Task 3 (Git SHA-256 integration check with `git init --object-format=sha256`): not run. Git runner not started.
- Task 9 (GitHub identity validation, `merge_commit_sha`, and the ingestion rule for missing creation timestamps, C-1): not started.
- API error mapping: model messages cite internal IDs such as `(D9)`. Public mapping belongs to the API implementation.
- DEC-10 and Task 16.1 (ingestion length limits and numeric values, gate O-G1): not started.
- Model observation (no change requested): `revision` is now part of the CODE_HISTORY identifier. The owner should confirm that this is the intended identity behavior for records where the revision differs from the commit.

### 18.7 Status

- Task 7.1: VERIFIED (unit level).
- Task 7.2: VERIFIED (unit level), with the Hypothesis caveat (18.6).
- Task 7.3: VERIFIED (unit level). All matrix cells pass with no expected failures.
- I2: VERIFIED (unit level), all in-scope checks pass.
- I2 is NOT ACCEPTED. Owner acceptance is required.

## 19. Owner decision: G-L reference discovery, resolution, and association (recorded 2026-11-11)

Status: owner decision recorded. Responsibility split only. This record approves no task, no task definition, no Native Spec, no I2 acceptance, and no G-1, G-2, G-3, G-4, D-5, D-6, D-7, D-8, D-9, or D-10. It does not authorize implementation, network access, dependency installation, or any change to `mcp.json`. No checkbox changed (0 `[x]`; 75 Evidence and 60 Ouija open).

### 19.1 Owner decision (verbatim scope)

Git History (`git_history`) is responsible for:
1. Detecting references to GitHub pull requests and issues in commit messages.
2. Extracting candidate references without assuming that every textual match is valid.
3. Preserving the originating commit identity and repository context.
4. Returning structured reference candidates to the integration layer.
5. Reporting malformed, ambiguous, or unsupported references as limitations, not as associations.

Git History must not perform GitHub HTTP requests or validate external record existence.

GitHub (`github`) is responsible for:
1. Retrieving explicitly identified pull requests and issues.
2. Validating that each external record belongs to the registered repository identity.
3. Retrieving available source metadata.
4. Returning evidence records using the I2 Evidence contract.
5. Distinguishing unavailable information from verified absence.
6. Reporting network, rate-limit, identity, and retrieval limitations.

GitHub must not parse Git commit messages or reconstruct local Git history.

The Evidence and Investigation integration layer is responsible for:
1. Associating a validated GitHub record with its originating Git evidence.
2. Preserving the distinct identity of commits, pull requests, and issues.
3. Avoiding unsupported causal claims between a commit and an external record.
4. Preserving provenance and limitations for each association.
5. Ensuring that a textual reference alone is not treated as proof that the record exists or is relevant.

A discovered reference is a candidate until GitHub validates and retrieves the corresponding record.

Also approved as direction: Task 8 must depend on GitHub evidence (Task 9) wherever pull request or issue relevance contributes to ranking (G-K). Task 8 must not close before that dependency is satisfied.

### 19.2 Verified facts supporting this decision

- Spec 1 §9 gives "Pull request or issue relevance" an initial weight of 10 (verified, `docs/specs/spec-1-evidence-retrieval.md`).
- Spec 1 §7 requires that external references be validated "before associating them with evidence". Requirement 5.1 repeats this (verified, native `requirements.md`).
- D03 §1 and §6: Django has GitHub Issues disabled. Django tracks issues in Trac. Commit messages reference Trac tickets (for example `#36149`, `#20760`), not GitHub issues. Commit-to-pull-request association is an unverified D04 question (verified, `d03-golden-repository-and-baseline-decision-record.md`).

Consequence: a bare `#NNN` in a commit message is not evidence of a GitHub issue or pull request. Django's own convention demonstrates this.

### 19.3 Affected requirements (native `requirements.md`)

| Requirement | Why it is affected |
|---|---|
| 5.1 | Validation before association. Owner split makes GitHub validate and the integration layer associate. |
| 5.2 | Source URL and identifier of each validated reference must be preserved. |
| 5.3 | A commit reference and a pull request reference are not the same fact. Association must keep them distinct. |
| 5.4 | Inaccessible records are not reported as nonexistent. Applies to the GitHub retrieval step. |
| 4.5 | Identities come from namespace and source identifiers, never from titles. Association must not change identities. |
| 3.4 | No causal inference from timing or from a textual reference. Association must not imply causation. |
| 6.3 | Missing metadata is not positive evidence. A PR relevance criterion without an association gives no award. |
| 6.4 | Each ranked item must explain its score, including the association basis. |
| 6.5 | Ranking must not decide classification. Association must not change classification. |
| 9.1, 9.5 | Source references in the result must agree with evidence. Contradictions return a safe error. |
| 10.3 | Explanations include source references and limitations. |
| 16.1, 16.2 | Limits and rate-limit handling apply to the GitHub retrieval step only. |

### 19.4 Affected design sections (native `design.md`), not applied

- "Module responsibilities": rows `git_history`, `github`, `evidence`, `investigation`.
- "Data flow": the diagram sends git_history output directly to `evidence` and GitHub records to `evidence`. The integration layer and the association step are not drawn.
- "Git retrieval design": needs a reference-candidate bullet (no HTTP).
- "GitHub design": needs the split between explicit-identifier retrieval and identity validation.
- "Ranking design": the PR or issue criterion needs associated, validated records.

### 19.5 Affected task IDs (native `tasks.md`), not applied

| Task | Current text (summary) | Required change | Owner approval needed |
|---|---|---|---|
| 5.1 | Retrieve commits for a file or symbol, including renames | Add candidate extraction of GitHub references from commit messages, with no HTTP (I3) | Yes (task text) |
| 8 | Deterministic ranking (depends on 7) | Depends on 5, 7, and 9. Association rule is applied before the PR relevance criterion (G-K, G-L) | Yes (dependency and task text) |
| 9.1 | Retrieve public PR and issue records (depends on 1, 7) | Retrieval by explicit identifier only (I4). Identifiers come from the integration layer or the MCP `number` input | Yes (task text) |
| 9.2 | Identity validation (unchanged) | Stated as the validation that must precede any association (Requirement 5.1) | No change to text; clarified in design |
| 11, 12 | Classification and result assembly | No dependency change. The result carries association limitations. Transitive dependency on 9 through 8 | No |
| 17.2 | MCP `get_pr`, `get_issue` | No change. These take an explicit `number` and do not use association | No |
| 18.2 | Golden cases | Add association regression cases later (not now) | Later |

Task IDs are not created or renumbered. Task definitions are not changed by this record.

### 19.6 Placement of association

Association is a pure function over plain evidence records. Its inputs are a commit evidence record, a validated GitHub evidence record, and a reference candidate. It has no HTTP, no Git call, and no import from `github` or `git_history`. This keeps `evidence` with no outgoing module dependency (design "Module responsibilities" row `evidence` stays `none`).

Placement options considered:
- Task 7: rejected. It is accepted in I2 scope and would reopen I2.
- Task 5 or Task 9: rejected. The owner split assigns association to the integration layer, and 5 and 9 would then perform it.
- Task 12.1: rejected. Task 8 must consume the association, and 12 comes after 8, so the order would be circular.
- Task 8 (text extended): the only existing task that precedes ranking and sits in the `evidence` module. Recommended, pending owner approval of the text change.

### 19.7 Remaining owner decisions

| ID | Question | Recommendation (not approved) |
|---|---|---|
| G-M | Relationship kind for a commit that references a validated PR or issue | Add a kind `REFERENCES_RECORD` to the D8 vocabulary, with basis VERIFIED only for a full URL that names the registered repository and a validated record. Requires owner approval (D8 vocabulary is "at minimum", so adding a kind is within the owner's direction, but it is still a decision). |
| G-N | Bare `#NNN` references | Classify as AMBIGUOUS. Never send them to GitHub automatically. Report as a limitation. |
| G-O | Approve the association placement in Task 8 text (19.6) | Approve. |
| G-P | Keywords such as "Fixes" or "Closes" in commit messages | No relationship semantics. Record the matched text only, as untrusted content. |
| G-Q | Whether DOCUMENTATION text (Task 5.4) produces candidates by the same rules | Yes, with the same classification and limitations. Owner confirmation needed (Requirement 4.6 applies to documentation evidence). |
| G-R | Whether a commit-to-pull-request GitHub lookup (a GitHub endpoint keyed by commit identifier) may be a candidate source | Not authorized. Its behavior is unverified (D03 §6 item 2 and D04). It would be a GitHub-side lookup from an explicit commit identifier, which the owner split does not address. Owner decision needed. |
| G-S | Limits on candidates per commit and per investigation | Part of O-G1 (D-9). Values are not proposed here. |

## 20. Owner decisions G-N, G-O, G-P; exclusions G-Q, G-R; preparation of G-M and G-S (recorded 2026-11-11)

Status: the decisions in 20.1 are APPROVED. The exclusions in 20.2 are recorded as NOT INCLUDED or NOT AUTHORIZED. G-M (20.3) and G-S (20.4) are prepared for review and are NOT approved. This record does not approve Task 8, I3, I4, I2 acceptance, any Native Spec, or any of G-1, G-2, G-3, G-4, D-5, D-6, D-7, D-8, D-9, or D-10. It does not change the I2 Evidence model, approved specifications, `mcp.json`, or any task checkbox (0 `[x]`; 75 Evidence and 60 Ouija open). No live GitHub request was made, and no dependency was installed.

### 20.1 Approved decisions

**G-N: bare `#NNN` references (APPROVED).**
- A bare `#NNN` reference is AMBIGUOUS by default.
- It is never interpreted as a GitHub issue solely from its textual form.
- It is never used to query GitHub automatically.
- Repository-specific evidence may support a more precise interpretation only in a future, separately approved scope. No such inference is authorized here.

**G-O: association placement (APPROVED WITH IMPLEMENTATION BOUNDARIES).**
- Reference association stays within the Evidence workflow associated with Task 8. No new task ID is created.
- Reference association is logically independent from ranking. The implementation separates four operations:
  1. candidate extraction (Git History);
  2. external record resolution (GitHub, identifier-driven and identity-validated);
  3. evidence association (Evidence);
  4. ranking (Evidence).
- Ranking consumes the available validated evidence and the association records. It does not create associations.
- Association must not change the epistemic classification of any evidence item.

**G-P: keywords such as `Fixes`, `Closes`, `Resolves` (APPROVED).**
- These keywords do not establish causation, issue resolution, or a verified relationship between a commit and an external record.
- They may be retained as textual context only.
- They must not, by themselves, establish causation, resolution, a verified relationship, or a change in epistemic classification.
- A stronger interpretation requires independent supporting evidence and a separate decision.

**Direction carried forward (recorded in §19.1, not re-approved here): Task 8 depends on GitHub evidence from Task 9 wherever PR or issue relevance contributes to ranking (G-K).** The task text change is not approved by this record.

### 20.2 Explicit exclusions

- **G-Q, documentation references: NOT INCLUDED in the current G-L scope.** The current scope covers commit messages only. GitHub candidates are not extracted from documentation text under I3 or I4. Documentation references may be considered only in a future, separately approved scope.
- **G-R, commit-to-pull-request lookup: NOT AUTHORIZED.** It is not used as a discovery mechanism. It is not implemented, and its results are not relied on, until its API behavior, identity semantics, and evidence provenance are verified and separately approved.

### 20.3 G-M, relationship vocabulary (prepared for review; NOT approved; NOT added)

The full analysis is in the review artifact "G-M and G-S analysis, and I3/I4 diffs" (outside the repository). Summary:
- The I2 Evidence model is not modified. `RelationshipKind` in `contract.py` is unchanged.
- The proposed relation connects a Git commit evidence item (origin commit of a message) with a validated GitHub evidence item (pull request or issue). It is an item-to-item relation, not item-to-target.
- `relationship` on an evidence item is item-to-target (D8). It is not the place for an item-to-item relation.
- Recommended placement: a separate association structure at investigation-result level, not a new `RelationshipKind`. Its content is a textual reference observed in a commit message, validated against the registered repository. It makes no claim of causation or resolution.
- Adding a kind to `RelationshipKind` would change the I2 contract (enum, basis table, tests, and the wire contract). The separate structure avoids that, but it adds a result-level field that needs canonical-contract approval (C.4).
- Owner decision required before any implementation: placement (separate structure versus new kind), and the basis rule (VERIFIED only for a textual reference that Git re-reads and that GitHub validates).

### 20.4 G-S, candidate limits (prepared for review; NOT approved; pending O-G1)

The proposed numeric limits and their rationale are in the same review artifact. They are proposals, not approved values. Values from D02 §16.6 are not treated as approved. Existing registry constants (`GITHUB_OWNER_PATTERN`, `GITHUB_NAME_PATTERN`, accepted in I1) are used as derivations where a rationale depends on them.

### 20.5 Authorization boundary

No approval of I2, Task 8, I3, I4, any Native Spec, or any decision in 20.3 or 20.4 is recorded here. Each requires separate owner authorization.

## 21. I3 and I4 readiness closure report (recorded 2026-11-11)

Factual progress only. No approval, acceptance, or authorization was recorded.

- Created `docs/development/i3-i4-readiness-closure-report.md`. It contains:
  - a cache-semantics decision table for five cases (display, verified association, status, reason and code, classification effect);
  - a Task 16.1 limit table, classified by input, retrieval, processing, and display, with status per row;
  - an owner decision register (OD-1 to OD-20);
  - a task-level dependency graph for I3 (2.1 to 6.3) and I4 (9.1 to 9.3, 10.1 to 10.2), with proposed native header amendments for Tasks 3, 9, and 16.1;
  - the readiness verdicts for I3 and I4 separately.
- Status of the decisions in that report:
  - The cache rules are owner rules stated in the review request. Their document wording awaits approval.
  - Task 16.1 values, the header amendments, and the 20 decision items are recommendations or open decisions. None is approved.
- Verdict recorded in the report: I3 and I4 are not ready for full authorization. Partial starts are identified; they require the owner's Native Spec approval and, for limit-enforcing tasks, approval of the Task 16.1 values.
- No implementation was started. No task checkbox changed. No approved source document, dependency, or `mcp.json` was changed. I2 remains NOT ACCEPTED. I3 and I4 are not authorized.

## 22. I3 and I4 owner decision package (recorded 2026-11-10)

Factual progress only. No approval, acceptance, or authorization was recorded.

- Created `docs/development/i3-i4-owner-decision-package.md`. It contains the OD-1 to OD-20 matrix (status, problem, references, recommendation, exact proposed rule, rationale, consequences, dependencies, owner response field), the cache cases A to E with the OD-3 rationale, the numeric limit table with status per row, the OD-9 header replacement text, recommendations for OD-11 (symbol resolution), OD-12 (author field), and OD-13 (GitHub API version pin), a cross-decision consistency review, a compact owner approval section, and an implementation authorization map by task and group.
- Status of the decisions in that package: all OD items are OPEN. Limit rows marked AIP are not approved values. No recommendation is approved.
- Findings beyond the source report: Requirements 2, 3, and 14 are unapproved and gate Tasks 2.x, 4.x, 5.x, and 18 under D01. D02 §16.7 and Spec 1 §10.2 conflict on the result-limit status. Both map to existing decisions (OD-16 and OD-17).
- Verdict recorded in the package: I3 and I4 are not authorized. Their groups can be authorized concurrently after the owner decisions listed in Part 10.
- No implementation was started. No task checkbox changed. No approved source document, native Spec file, D02, D03, dependency, or `mcp.json` was changed. I2 remains NOT ACCEPTED.

## 23. Owner approval OD-16 and Group A1 authorization (recorded 2026-11-10)

- Owner approved OD-16 for the Native Spec baseline at these SHA-256 hashes (checked at recording time): `requirements.md` 51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7; `design.md` EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3; `tasks.md` B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8.
- Scope of approval: Requirements 2, 3, and 14 and the corresponding design baseline.
- Not approved: proposed Task 3 and Task 9 header amendments (OD-9). The `tasks.md` file still carries its original headers.
- Group A1 (Tasks 2.1 and 2.2) authorized for implementation and verification only.
- Not started: Group A2 (Tasks 3.1 to 3.4) and Group B (Task 9.1).
- Still OPEN: OD-5, OD-9, OD-13, OD-14, OD-18, and the other items in the owner decision package Part 15.3.
- I2 remains NOT ACCEPTED. I3 and I4 are not authorized beyond the items above.
- The date in the owner's message (2026-11-11) differs from the session date (2026-11-10). This record uses the session date.

## 24. Group A1 execution record (Tasks 2.1 and 2.2, recorded 2026-11-10)

- Task 2.1 (C.3a lexical input rules): `backend/app/modules/repository/paths.py` gained `normalize_target_path`, `PathError`, and the codes `INVALID_INPUT` and `PATH_OUTSIDE_REPOSITORY`. `is_normalized_repository_path` is unchanged. Tests: `backend/tests/unit/test_repository_target_path.py`. Junction probe (realpath resolves a Windows junction): in `test_repository_containment.py`.
- Task 2.2 (containment on resolved paths): `resolve_contained_path` in the same module. Tests: `backend/tests/unit/test_repository_containment.py`, covering junctions, a symbolic link, a sibling with a shared name prefix, historical missing paths, and non-disclosure of existence.
- Test results: focused Task 2 files 69 passed, 0 failed, 0 skipped. Full backend suite 651 passed (582 before this group plus 69 new). Junction and symbolic-link tests executed without skips.
- Interpretations to confirm: reserved device list includes COM0, LPT0, CONIN$, CONOUT$ (stricter); "." segments rejected; a path that cannot be resolved is reported as PATH_OUTSIDE_REPOSITORY.
- Not done (outside authorization or dependent on OD-5): length bound (Task 2.3, row V2 OPEN); Task 2.3 validation; Task 2.4 security review; Tasks 2.3 and 2.4 remain NOT_STARTED.
- Checkboxes in `tasks.md` unchanged. Verification status: Tasks 2.1 and 2.2 VERIFIED at unit level. Owner acceptance: not recorded.
- Tasks 3.x, 9.1, and all other tasks: not started.

## 25. I3 and I4 implementation record (recorded 2026-11-10)

Authorization: owner directive to complete the I3 and I4 implementation scope. Tasks in scope: 2.1 to 2.4, 3.1 to 3.4, 4.1 to 4.2, 5.1 to 5.4, 6.1 to 6.3, 9.1 to 9.3. Checkboxes in `tasks.md` are unchanged. The approved baseline note in that file says no checkbox marks VERIFIED or ACCEPTED work, so status is recorded here instead. I2 remains NOT ACCEPTED. Nothing here is owner acceptance.

Implemented (status: IMPLEMENTED, with unit tests executed):
- 2.1 C.3a lexical input rules (`repository/paths.py`, `normalize_target_path`). VERIFIED at unit level.
- 2.2 containment on resolved paths (`resolve_contained_path`). VERIFIED at unit level, including a Windows junction probe.
- 2.3 symbol and line-range validation (`symbol_resolution/validation.py`). Path length bound (proposed 1,024, OD-5 V2). VERIFIED at unit level.
- 2.4 security review: performed by the security-auditor sub-agent on this scope. Findings H-1, M-1, L-1, L-3 to L-8 were fixed with regression tests. The review verdict is recorded in the session. The owner decides task acceptance.
- 3.1 to 3.4 guarded Git runner (`core/git_runner.py`). Option set verified against Git 2.50.1 with a repository-configured textconv trap and a signature-header trap (control tests show the trap fires without the guard).
- 4.1 and 4.2 target resolution at HEAD with the standard library `ast` (`symbol_resolution/resolver.py`). Parse failure is a distinct outcome.
- 5.1 to 5.4 history (`git_history/history.py`): commits with `--follow`, heuristic rename label, shallow-clone limitation capped at PARTIAL, co-changed documentation as INFERRED.
- 6.1 to 6.3 blame (`git_history/blame.py`): full object names only, HEAD resolved to full name, PATH_NOT_FOUND and REVISION_NOT_FOUND, uncommitted-line limitation.
- 9.1 to 9.3 GitHub client (`github/client.py`): HTTPS only, no redirects, empty proxy map, 5 s per-operation timeout, 1 MiB body limit, no retries, pinned API version 2022-11-28, token only to api.github.com, identity checks, outcome codes with limitation text.

Parameters used (proposed defaults, NOT owner-approved): Git timeout 30 s, stdout 16 MiB, stderr 64 KiB (R1 to R3); commit scan 2,000 (R4); GitHub operation timeout 5 s (R9); body 1 MiB (R11); symbol 256 characters (approved design); line span 2,000 (V4); path length 1,024 (V2).

Live verification (owner-authorized, read-only): GET https://api.github.com/repos/octocat/Hello-World/pulls/1 returned 200 under API version 2022-11-28. `merged` is a boolean, and `merge_commit_sha` is a full 40-character name. The request was made twice: once to read field presence and once through the client.

Known limitations (recorded):
- Total GitHub request time is not bounded. Only per-operation timeouts and the body limit apply (approved residual, package Part 6A; the review asks the owner to confirm).
- Symbol-scoped history is file-level. Commit relevance to the symbol is not established.
- One diff-tree call per commit, up to the scan limit. The total time is not shared across calls.
- DNS resolution is not covered by the socket timeout.
- Windows-specific behavior of the process kill and the signature-header control was verified on this machine only.

Not in scope and not implemented: Tasks 7 (I2, already implemented), 8, 10 to 17, 18, and 19. Frontend work is not part of I3 or I4. Each needs a separate authorization.

## 26. I5 and I6 planning artifact (recorded 2026-11-10)

- Created `docs/development/i5-i6-backend-implementation-plan.md`. It is a planning artifact, not an approval.
- Purpose: records the owner-provided I0 to I6 plan as a recovered plan (not found on disk), maps the remaining backend tasks to I5 (Investigation & Explanation) and I6 (API, System Integration & MCP), and lists the blockers and owner decisions.
- Discrepancies between this record and the repository are listed in that document, section 13. Earlier sections of this file are not changed.
- No implementation, dependency installation, network access, configuration change, Native Spec change, or checkbox change occurred in this step.
- I2 remains NOT ACCEPTED. I3 and I4 remain NOT AUTHORIZED beyond the authorizations recorded in §23 to §25.

## 27. I5 and I6 plan reconciliation (recorded 2026-11-10)

- `docs/development/i5-i6-backend-implementation-plan.md` was reconciled. It is a planning artifact, not an approval.
- Review status: the listed documents were read to end of file by delegated read-only readers (five reports). Hashes are the identifiers. Line counts differ between tools and are not used. Hashes are listed in that plan, section 1.2.
- Task 7.2: the record in §15 includes it under a later owner authorization. The verbatim owner text is not in the repository. The earlier exclusion in §9.4 is superseded. I2 remains NOT ACCEPTED.
- Recorded test totals: 582 passed (§18), 651 passed after Task 2 (§24). The total of 794 cited in an earlier draft of the plan was session output only. It is not recorded here.
- No implementation, dependency change, network access, configuration change, Native Spec change, decision-record change, or checkbox change occurred in this step.
- Discrepancies recorded in the plan (section 7 and section 13) include: the blame span (code 2,000, D02 500), the Task 8 dependency (G-K versus the approved header), the Task 11 and Task 17 header gaps, and the FastAPI installation state.

## 28. I5 and I6 implementation record, partial (recorded 2026-11-10)

Authorization: owner directive to implement I5 and I6 as far as approved contracts and repository state permit. Checkboxes in `tasks.md` are unchanged. I2 remains NOT ACCEPTED. I5 and I6 are not complete.

Implemented in this record (unit-level tests executed):
- Task 8.1 to 8.3, ranking (`backend/app/modules/investigation/ranking.py`). Spec 1 §9 criteria and initial weights (25, 20, 20, 15, 10, 5, 5). Each result keeps its per-criterion awards. Ties break on evidence_id in UTF-8 byte order. Missing metadata gives no award. The PR and issue criterion stays at zero until an association step validates an item. Temporal is never awarded. Weights are configuration, not validated (D05). Status: IMPLEMENTED, UNIT-VERIFIED. Closure is not claimed: the PR criterion awaits association (G-M not approved). Task 9 is implemented, so its G-K dependency is met at implementation level.
- Task 16.1, mechanism only (`backend/app/core/limits.py`). Every retrieval limit is now defined in one module, and each existing module imports it. All values are proposed defaults. None is owner-approved (OD-5). No environment configuration exists yet. Status: IMPLEMENTED. Not VERIFIED, because the owner has not approved the values.
- Task 16.2, diagnostics and redaction (`backend/app/core/diagnostics.py`). Allowed fields are those of Requirement 19.1. Registered secrets are removed from log messages and exception text. Status: IMPLEMENTED, UNIT-VERIFIED. No application logging is wired yet, because there is no application entry point.

Not implemented in this record, with the blocker for each:
- Task 10 (cache): D06 and D07 are open (design Open decisions, E-D6 and E-D7).
- Tasks 11, 12, 13: no implementation. Classification and result-assembly rules were not read in full in this session, so they are not implemented. Task 11 header also omits Task 9 (native amendment candidate).
- Task 14: provider decision E-D13 is open. Owner approval of a dependency is required.
- Investigation orchestration: depends on 11 to 13. No native task names it (native amendment needed).
- Evidence association (G-O placement, G-M contract): G-M is not approved. No association code exists.
- Task 15.2 (HTTP endpoint): FastAPI is approved in D01 §2 but not installed. Installation needs separate authorization (D01 and phase-status §4.1). Dependencies 12 and 13 are not complete.
- Task 17 (MCP adapter): header requires owner approval of task 17, which is not recorded. The `mcp` module does not exist. `.kiro/settings/mcp.json` is unchanged.

Limits and status: the blame span is still the general 2,000-line bound in code. D02 proposes 500 (OD-5 V5). Not changed in this record.
No dependency was installed. No network request was made. No Native Spec, decision record, or checkbox changed.

## 29. I5 continuation checkpoint: Tasks 11, 12, 13 and orchestration (recorded 2026-11-10)

Authorization: owner directive to continue I5 and I6 from §28. Checkboxes in `tasks.md` are unchanged. I2 remains NOT ACCEPTED.

Implemented (unit tests executed in this record):
- Task 11.1 and 11.2, classification (`backend/app/modules/investigation/classification.py`). Status: IMPLEMENTED, UNIT-VERIFIED. The mapping from evidence to classification is an implementation decision. The approved text (Spec 1 §10.1) defines the four classes but not the mapping. Rules: verified Git structural support on a complete retrieval gives DOCUMENTED. Verified support on a partial or insufficient retrieval gives PARTIAL_EVIDENCE. Co-change documentation alone gives INFERRED on a complete retrieval. Anything else gives INSUFFICIENT_EVIDENCE. Cache-served records and GitHub records never support a classification.
- Task 12.1 to 12.3, result assembly and invariants (`backend/app/modules/investigation/result.py`). Status: IMPLEMENTED, UNIT-VERIFIED. Each invariant of the status and classification rules table raises a category C error. No value is changed silently.
- Task 13.1 and 13.2, deterministic explanation (`backend/app/modules/explanation/templates.py`). Status: IMPLEMENTED, UNIT-VERIFIED. Each explanation states the fact, the inference if any, and what is unknown. Insufficient evidence abstains. A failed retrieval gets no explanation. No AI provider is used.
- Investigation orchestration (`backend/app/modules/investigation/orchestrator.py`, function `investigate`). Status: IMPLEMENTED, integration-tested. Flow: registry resolution, input validation, symbol resolution, history, blame for the resolved region, ranking, classification, assembly, explanation.
- Task 8 (ranking) and Task 16.1 (central limits) and Task 16.2 (diagnostics) were recorded in §28. Their status is unchanged.

Design conflict recorded, not resolved: the status and classification rules table in the design says a violated rule "returns `INTERNAL_ERROR` as a `FAILED` result". Design C.5 and C.6 say a category C violation is never returned as an investigation result. It becomes a category B `BackendError` (HTTP 500). Task 12.2 repeats the FAILED wording. The code follows C.5 and C.6, because C.11 depends on them. The owner must decide the representation before the API maps violations.

Traceability gap: orchestration has no native task ID. Recorded here as a gap, not as a new task ID. Proposed native amendment: name the orchestration step in the Task 12 subtasks, for owner review.

Code-level choices that need owner review:
- Symbol resolution returning PARSE_FAILED is raised as a category B request error with the code `TARGET_PARSE_FAILED`. This code is proposed in the owner package and is not approved.
- A blame failure adds `BLAME_UNAVAILABLE` and makes the status PARTIAL.
- No history with COMPLETE status gives INSUFFICIENT with `NO_HISTORY_RETRIEVED`.
- Every result carries `ASSOCIATION_NOT_IMPLEMENTED`, because no PR or issue evidence is requested.
- INFERRED is reachable only through the classification function. A commit always carries verified support, so the orchestrator produces INFERRED only when such a commit is absent. The tests cover the function directly.

Not implemented, with blockers:
- Task 10 (cache): D06 and D07 open.
- Task 14 (optional AI): provider decision E-D13 open.
- Association (G-M): not approved. PR and issue evidence is not requested.
- Task 15.2 (HTTP endpoint): FastAPI not installed, and no installation is authorized. Also the category C representation conflict above.
- Task 17 (MCP): owner approval of task 17 not recorded. No `mcp` module. `mcp.json` unchanged.
- Task 16.1 verification: values unapproved.
- Task 8 closure: PR criterion waits for association. Task 9 is implemented.

Verification: full backend suite 868 passed, 0 failed, 0 skipped, 0 xfailed (session output, `python -m pytest tests -q -rfxXs` from `backend`). `pip check`: no broken requirements. The earlier 817-passed-4-failed result is superseded: those four failures were fixed in the test helper and re-run in focused form (27 passed) and in the full suite above.

Service status: the backend cannot start as a service. No HTTP application or MCP entry point exists. The orchestrator is callable from Python only.
No dependency was installed. No network request was made. No Native Spec, decision record, checkbox, or `mcp.json` changed.

## 30. I5 and I6 checkpoint: HTTP API and application entry point (recorded 2026-11-10)

Authorization: owner directive to finalize I5 and I6 (installation of the exact D01 FastAPI pin; Task 17 authorized; owner decisions in §3.1 and §3.2 of the directive). Checkboxes in `tasks.md` are unchanged. I2 remains NOT ACCEPTED. Nothing in this record is owner acceptance.

Provider premise checked and not supported: the directive states that the approved architecture names Gemini 3.5 Flash as the AI provider. A search of the whole repository (docs, `.kiro`, dependency records, and code) for "Gemini", "3.5 Flash", "google-genai", and "generativelanguage" returned no matches. No Gemini integration was implemented. E-D13 (optional AI provider, design Open decisions) remains open. Task 14 stays BLOCKED. The deterministic path does not depend on it.

Dependency installed under the directive:
- `fastapi==0.162.2` (exact pin in D01 §2). `pip install --dry-run` listed only this package and its dependency `annotated-doc==0.0.6` before installation. Installed both. No other package changed.
- `pip check`: "No broken requirements found."
- Lock file: not inspected or updated in this record. The repository's lock or requirements file was not reviewed here, so reproducibility of the pin is not verified.
- `httpx` was not installed. It is not in D01 §2. API tests use the ASGI interface directly.

Implemented (unit and integration tests executed):
- Task 15.2, HTTP API (`backend/app/api/app.py`). `create_app(registry)` exposes `POST /investigations` and calls `investigate` only. Status mapping follows C.11: 200 for every category A result (including FAILED); 400 for malformed, unknown, or invalid input and PATH_OUTSIDE_REPOSITORY; 404 REPOSITORY_NOT_FOUND; 409 TARGET_AMBIGUOUS with candidates; 503 REPOSITORY_UNAVAILABLE; 500 INTERNAL_ERROR for a category C violation. TARGET_PARSE_FAILED returns 400 (category B, not listed in C.11; approved as a code in directive §3.2). Error bodies carry fixed messages and field names only. No request values, paths, or stack traces. Status: IMPLEMENTED, UNIT-VERIFIED (12 tests).
- Application entry point (`backend/app/main.py`). Reads the registry once through `load_registry(None)`, registers SEAN_GITHUB_TOKEN for redaction when set, and attaches the redacting filter to the root handlers. Import verified with warnings as errors. Not started as a server in this record.
- Task 16.2 adjustment: `configure_logging` now attaches the filter to root handlers as well as the named logger. A logger-level filter does not run for child-logger records. The token-redaction test runs through the `sean.api` logger.

Not implemented, with reasons:
- Task 17, MCP (all of 17.1 to 17.5). No `mcp` module was written in this checkpoint. `.kiro/settings/mcp.json` is unchanged. The four tools (`search_history`, `blame_range`, `get_pr`, `get_issue`) are not exposed.
- Task 16.1 environment configuration. Limits remain centralized in `core/limits.py` with proposed defaults. OD-5 values are not approved. No environment or configuration-file loader exists.
- Task 10 (cache): D06 and D07 open. Not started.
- Task 14 (optional AI): provider premise unsupported (see above). Not started.
- Association (G-M): not approved. Not implemented.
- Evidence association for GitHub records: not requested by the orchestrator.

Verification: full backend suite 880 passed, 0 failed, 0 skipped, 0 xfailed (`python -m pytest tests -q -rfxXs`, from `backend`). `pip check`: no broken requirements.

Service status: the HTTP application imports and registers the route. The server has not been started and no HTTP request has been made against a running process in this record. Start command (Windows PowerShell, from `backend`): `.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`.

No Native Spec, decision record, checkbox, approved document, or `mcp.json` changed. No network request to any external provider or GitHub was made in this record.

## 31. I6 checkpoint: MCP integration, Task 17 (recorded 2026-11-10)

Authorization: owner directive to continue I6 with the MCP integration (Task 17) under D02. Checkboxes in `tasks.md` are unchanged. I2 remains NOT ACCEPTED. Nothing here is owner acceptance.

Files created:
- `backend/app/modules/mcp/tools.py`: tool logic. Thin adapters over the existing modules (`investigate`, `blame_range`, `GitHubClient`). Errors are `McpToolError` with fixed messages.
- `backend/app/modules/mcp/server.py`: `create_server(registry)` builds an `MCPServer` (SDK 2.3.0, `mcp.server.mcpserver`) with exactly four tools.
- `backend/app/modules/mcp/__main__.py`: STDIO entry point. Logs go to stderr. Standard output carries protocol messages only.
- `backend/tests/unit/test_mcp_tools.py` (26 tests), `backend/tests/unit/test_mcp_server.py` (4 tests, including a STDIO handshake against the real entry point).

Tools exposed (names verified by `tools/list` over STDIO): `search_history`, `blame_range`, `get_pr`, `get_issue`. No other tool exists.

Contract decisions in the MCP layer (each needs owner confirmation; none changes an approved product rule):
- `search_history` requires `path`. Symbol and line range are optional and need `path`. D02 §16.6 wording "exactly one of path or symbol" is unclear. Path-required is the only form the backend can execute.
- Output carries evidence, ranking, retrieval status, limitations, and source references. It carries no classification, conclusion, or explanation (Requirement 13.6).
- `max_results` defaults to 20, range 1 to 50 (D02 §16.6, proposed).
- `blame_range` span limit 500 (D02 §16.6, proposed; OD-5 V5 open). Enforced at the MCP layer.
- `number` for `get_pr` and `get_issue` is a positive decimal string (D9, identity rule). JSON integers are rejected. D02 §16.6 describes an integer schema; the string form is the accepted-in-principle MCP shape recorded in phase-status §18 and is not owner-approved.
- Tool failures return the structured error body (`error`, `message`, `retryable`), not an SDK exception. Messages are fixed strings. No exception text, token, path, or request value is returned.

Verification performed:
- Unit tests: 30 tests pass (`test_mcp_tools.py` and the in-process server tests). Covers invalid input, every rejected path form, ambiguous target, FAILED as a status, unavailable GitHub (fake client, no network), identity unresolved, and secret absence in errors.
- STDIO: the real entry point, launched with the same flags that `.kiro/settings/mcp.json` uses (`-P -m app.modules.mcp`, `PYTHONPATH` set to the backend). Handshake: `initialize`, `notifications/initialized`, `tools/list`. Returned exactly the four tools. The child exited with code 0 after stdin closed.
- Full backend suite: 914 passed, 0 failed, 0 skipped, 0 xfailed (`python -m pytest tests -q -rfxXs` from `backend`).
- `pip check`: no broken requirements.
- The MCP path uses only STDIO and the outbound GitHub client. No listener is created by the MCP code. This was checked by code reading, not by port inspection.

HTTP/MCP integration status:
- Both interfaces call the same functions: `investigate` for search, the blame module for blame, and the GitHub client for PR and issue. No retrieval or classification logic is duplicated in MCP. No test compares HTTP and MCP results for the same input, so MCP-16 equivalence is not verified.
- The HTTP application still imports and its 12 API tests pass.

Configuration: `.kiro/settings/mcp.json` was not changed. Its launch entry already matches the verified command, so no edit is needed. Enablement in Kiro is not claimed. C-D7 and D02 §12 runtime tests (T3, T7b, T10, T12) remain open.

D02 MCP-01 to MCP-18 coverage, honestly stated:
- Covered by tests: MCP-01 (tool set, approved names), MCP-02 (partial: input validation for each tool), MCP-04 (option injection: the Git runner rejects values beginning with "-"), MCP-07 (Git timeout and output bounds, from the Git runner tests), MCP-09 (no classification or conclusion in MCP output), MCP-11 (provenance, from evidence identity), MCP-14 (stdout carries protocol messages only: STDIO handshake succeeds).
- Not covered: MCP-03 (containment through MCP input, partial), MCP-05 (read-only snapshot of refs and working tree before and after each call), MCP-06 (hook and configuration trap through MCP, covered at the Git runner level only), MCP-08 (retrieval status cases through MCP), MCP-10 (determinism, requires Hypothesis, OD-19), MCP-12 (untrusted-field placement), MCP-13 (GitHub behaviors through MCP, partly covered), MCP-15 (no-AI behavior through MCP, covered by the deterministic path), MCP-16 (HTTP and MCP equivalence), MCP-17 (lifecycle and exit on stdin close, partly covered by the STDIO test), MCP-18 (real Kiro integration, needs runtime verification).

Task status:
- Task 17.1: prerequisites met in the record. Owner approval of task 17 is given in the directive of this checkpoint. Its scope is recorded here.
- Task 17.2: IMPLEMENTED, UNIT-VERIFIED (tool logic and in-process invocation).
- Task 17.3: IMPLEMENTED, VERIFIED at the STDIO handshake level.
- Task 17.4: IMPLEMENTED in part. The full MCP-01 to MCP-18 suite is not complete (see above).
- Task 17.5: NOT DONE as a configuration change. The existing entry already matches the verified launch shape. Enablement waits for C-D7.

Still open or blocked:
- Task 10 (cache): D06 and D07 unresolved. Not started.
- Task 14 (optional AI): no provider named in the repository. E-D13 open. Not started.
- Association (G-M): not approved. Not implemented.
- Task 16.1 verification: limit values unapproved (OD-5).

I5 and I6 status: partially complete. I5 implementation is in place for ranking, classification, assembly, deterministic explanation, and orchestration. Association, cache, and optional AI remain open. I6 implementation is in place for the HTTP route, diagnostics, and MCP tools over STDIO. The D02 MCP suite is incomplete, and runtime compatibility with Kiro is unverified. Neither I5 nor I6 is complete, and neither is owner-accepted.

Service status: the HTTP application is startable with uvicorn (`app.main:app`), not started in this record. The MCP server is startable with `python -m app.modules.mcp` and runs over STDIO.

No dependency was added in this checkpoint. No Native Spec, decision record, checkbox, or `mcp.json` changed. No network request to GitHub or any provider was made in the test suite.

## 32. I5 and I6 verification checkpoint: HTTP runtime, MCP contract tests (recorded 2026-11-10)

Authorization: owner directive "Complete I6 verification and remaining MCP tests". Checkboxes in `tasks.md` are unchanged. I2 remains NOT ACCEPTED. Nothing here is owner acceptance. I5 and I6 are NOT complete and NOT accepted.

Protected state re-checked after this checkpoint (SHA-256, 16-character prefix): architecture `3AB618886BBE2F70`, spec-1 `71FEF399A02C35EC`, D01 `053E3E373EA2D076`, D02 `62561C74471D6144`, `.kiro/settings/mcp.json` `02FB9811E5EBDBDF`. All unchanged. No dependency was installed. Hypothesis and httpx were not installed. No request went to GitHub or to any AI provider. The `mcp.json` file was not changed (C-D7 still open).

### 32.1 Defects found and fixed in completed modules

1. `backend/app/main.py` and `backend/app/modules/mcp/__main__.py` called `load_registry(None)`. That returns REGISTRY_LOCATION_UNAVAILABLE, so neither the HTTP application nor the MCP server registered any repository. Both now call `load_registry(default_registry_path())`. The earlier MCP handshake test listed tools only and did not catch this. Found by the runtime check in 32.2. Regression test: `test_entry_point_loads_the_approved_registry_path`.
2. `backend/app/modules/mcp/__main__.py`: a non-raw docstring contained `.\.venv`, which produces a SyntaxWarning. The docstring is now raw.
3. `backend/app/api/app.py`: a malformed JSON body reported the parser's character index as the field name (`"field": "1"`). Only string field names are reported now. Assertion added to `test_malformed_json_is_400`.

No approved document, decision record, or Native Spec was changed by these fixes.

### 32.2 HTTP runtime verification (executed, observed)

Environment: disposable repository (two commits, `src/a.py`) and a temporary registry under `%TEMP%\sean-i6-runtime`. The server read the registry through `LOCALAPPDATA`, so the approved path `%LOCALAPPDATA%\Sean\config\repositories.json` and the loader `load_registry` were used. The user's registry was not read or written by the HTTP run. Server: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8765`, from `backend`. A fake token was set in `SEAN_GITHUB_TOKEN` to test redaction.

| Check | Observed |
|---|---|
| Startup | Succeeded. Startup completed without error. |
| Listener | Bound to 127.0.0.1:8765 only (`netstat`). |
| Valid request (`sample`, `src/a.py`, symbol `target`) | 200. `retrieval_status` COMPLETE, `epistemic_classification` DOCUMENTED, conclusion and explanation present. Separate fields as in C.4. |
| Unregistered `repository_id` | 404 `REPOSITORY_NOT_FOUND`. |
| Path traversal (`../secret-probe.py`) | 400 `INVALID_INPUT`. |
| Absolute path (`C:/Windows/win.ini`) | 400 `INVALID_INPUT`. |
| Unknown field | 400 `INVALID_INPUT` with `field: retrieval_status`. |
| Missing `question` | 400 `INVALID_INPUT` with `field: question`. |
| Wrong type (`line_start` as a string) | 400 `INVALID_INPUT` with `field: target.line_start`. |
| Malformed JSON, and a JSON array as the body | 400 `INVALID_INPUT`, no field name. |
| Leakage | No response body contained the repository path or the fake token. The server log contained no path and no token. |
| Category C (500 `INTERNAL_ERROR`) | Not triggered live, because no fault injection was used. Covered by the ASGI unit test `test_category_c_violation_is_500_without_rule_name`. |
| Shutdown | Graceful stop via `CTRL_BREAK_EVENT` in a disposable harness. Log: "Shutting down", "Application shutdown complete", "Finished server process". The process exit code was 3, not 0. This was not explained. The re-raised break signal is one likely cause, but it is not confirmed. |

A stop through the process-control tool terminated the server without shutdown messages. That stop is not used as shutdown evidence.

The diagnostic log line for each successful request has the fields in the allowlist. Several fields print as `unavailable` (for example `operations` and `ranking_outcome`) because the handler does not supply them. This is cosmetic and was not changed.

### 32.3 MCP STDIO verification (executed, observed)

Launch shape from `.kiro/settings/mcp.json`: `<venv>\Scripts\python.exe -P -m app.modules.mcp`, with `PYTHONPATH` set to the backend. The inherited environment was otherwise unchanged.

| Run | Observed |
|---|---|
| Inherited environment (real `LOCALAPPDATA`) | `initialize` succeeded. `tools/list` returned exactly `search_history`, `blame_range`, `get_pr`, `get_issue`. Exit code 0 after stdin closed. stderr empty. Every stdout line parsed as a JSON-RPC message. |
| Temporary registry (`LOCALAPPDATA` set to the temp directory) | Same handshake. `tools/call search_history` returned COMPLETE with 4 evidence items. The result has no `epistemic_classification` field. Exit code 0 after stdin closed. stderr empty. |

The inherited-environment run read the user's registry at startup. Only the loaded-entry status was used, and its contents were not inspected or recorded. The read was not a write.

### 32.4 Automated tests added and run

New file: `backend/tests/unit/test_mcp_contract.py`.

- MCP-05 (read-only): for six tool calls, a hash of every file and directory under the repository, including all of `.git`, is identical before and after the call. Passes.
- MCP-08 (retrieval status cases): invalid input, unregistered repository, unavailable repository, ambiguous target with candidates, no history, shallow clone (never COMPLETE without SHALLOW_CLONE), result limit ordering, and four GitHub failure codes with their retryable flags. These pass. Symbol absent from the current state: evidence is returned and the status is COMPLETE or PARTIAL. See the expected failures in 32.5.
- MCP-16 (equivalence): `search_history` matches `investigate()` for status, evidence IDs, ranking IDs, and limitation codes. `blame_range` matches `blame_range()` for revision and evidence IDs. A dependency inspection (AST) shows that the `mcp` package does not import `subprocess`, `socket`, `urllib`, `http`, the history module, or the ranking module, and does not import `run_git`. All pass.
- MCP-17 (lifecycle): startup creates no socket and resolves no name (socket, create_connection, and getaddrinfo are patched to fail during `create_server`). Passes. Exit when stdin closes is covered by the existing `test_stdio_handshake_lists_the_four_tools_and_exits_when_stdin_closes` (passes) and by the runtime run in 32.3.
- Entry point regression: `app/main.py` and `app/modules/mcp/__main__.py` must call `load_registry(default_registry_path())`. Passes.

Results:
- Focused run (`test_mcp_contract.py`, `test_mcp_tools.py`, `test_mcp_server.py`, `test_api_investigations.py`, before the entry-point fix and regression test): 69 passed, 6 xfailed, 0 failed. Command: `& '.\.venv\Scripts\python.exe' -m pytest tests/unit/test_mcp_contract.py tests/unit/test_mcp_tools.py tests/unit/test_mcp_server.py tests/unit/test_api_investigations.py -q -rfxXs --tb=short -p no:cacheprovider`.
- Full suite, after all fixes: `& '.\.venv\Scripts\python.exe' -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`. Result: 939 passed, 0 failed, 0 skipped, 6 xfailed. Duration 223.6 s.
- `pip check`: No broken requirements found.
- Import with warnings as errors: `python -W error -c "import app.main"`, `"import app.modules.mcp.server, app.modules.mcp.tools"`, and `py_compile` of `app\modules\mcp\__main__.py`. All exit 0.

### 32.5 Contract differences from D02 (PROPOSED, not approved). Not changed. Owner decision needed.

Each row is a strict expected failure. A strict expected failure is reported as XFAIL, and it becomes a failure if the behavior changes without the test being updated.

| ID | D02 text | Implementation | Test |
|---|---|---|---|
| G1 | §16.5 and §16.8: a failure has `retrieval_status` FAILED and an `errors` list in one envelope. | Error bodies are `{error, message, retryable}`. No `retrieval_status`. The envelope fields `schema_version`, `tool`, and `repository` are absent from every response. | `test_mcp_08_failed_rows_carry_retrieval_status_failed` (2 cases) |
| G2 | §16.8: a path that escapes the repository gives `PATH_OUTSIDE_REPOSITORY`. | Lexical traversal gives `INVALID_INPUT`. The HTTP API behaves the same way. | `test_mcp_08_path_escape_uses_path_outside_repository_code` |
| G3 | §16.8: no evidence gives `NO_EVIDENCE_FOUND`. | `NO_HISTORY_RETRIEVED`. | `test_mcp_08_no_history_reports_no_evidence_found` |
| G4 | §16.8: a result truncated by `max_results` adds `RESULT_LIMIT_REACHED`. | Truncation is silent. | `test_mcp_08_result_limit_adds_result_limit_reached` |
| G5 | §16.8: a symbol absent from the current state gives `TARGET_NOT_IN_CURRENT_STATE`. | Not present in MCP output. The HTTP response reports it as `target.resolution`. | `test_mcp_08_symbol_absent_from_current_state_reports_its_code` |

Owner decision needed for each row: keep the implementation and amend D02, or change the implementation to match D02. Changing the failure envelope (G1) also changes every MCP response shape and needs its own decision.

### 32.6 Verification status by requirement

- Implemented: HTTP route `POST /investigations`, the four MCP tools, the STDIO entry point, the HTTP entry point.
- Unit-verified: API status mapping and sanitized errors (12 tests and the new malformed-JSON assertion), MCP tool logic (MCP-05, MCP-08 partly, MCP-16, MCP-17 startup), and the entry-point registry path.
- Runtime-verified (local, observed in 32.2 and 32.3): HTTP startup, the valid and error responses, loopback binding, graceful shutdown messages (exit code 3 unexplained), MCP STDIO handshake with the `mcp.json` launch shape, and one `search_history` call through STDIO.
- Integration-verified: `investigate()` runs against temporary Git repositories through the HTTP route, the MCP tools, and the STDIO server, as shown above. No live GitHub request was made.
- Partially covered, not complete: MCP-08 (five rows are expected failures, 32.5), MCP-16 (`get_pr` and `get_issue` equivalence is not tested because the shared GitHub record path is not exercised with a real record), MCP-17 (in-flight subprocess termination on exit or cancellation is not tested).
- Not executed: MCP-10 (determinism, Hypothesis, OD-19 not approved), MCP-18 (Kiro runtime, C-D7 and Section 12 tests T3, T7b, T10, T12 open), live Category C 500 response.
- Blocked by owner decision (unchanged): cache (D06, D07), optional AI provider (E-D13, Task 14), association (G-M), Task 16.1 values (OD-5), `mcp.json` enablement (C-D7), property testing dependency (OD-19), and the envelope and code differences in 32.5.
- Owner-accepted: none. I5 and I6 are partially complete and not accepted.

### 32.7 Temporary artifacts

`%TEMP%\sean-i6-runtime` holds the disposable repository, the temporary registry, and the probe scripts (`probe_http.py`, `shutdown_probe.py`, `mcp_probe.py`). None of these are in the repository. The directory can be deleted by the owner. It was not deleted in this checkpoint.

## 33. Owner decision DEC-15: MCP `number` input, and correction of §31 (recorded 2026-11-10)

Status: owner decision recorded. Scope is the MCP tool input for `get_pr` and `get_issue` only. Checkboxes in `tasks.md` are unchanged (0 `[x]`). I2 remains NOT ACCEPTED. I5 and I6 remain partially complete and NOT accepted. Nothing here is owner acceptance of any phase, increment, or task.

### 33.1 Owner decision (DEC-15)

The owner approved the MCP `number` input for `get_pr` and `get_issue` as follows:

- JSON type `string`.
- ASCII decimal digits only.
- Value strictly positive.
- Leading zeros accepted at input and normalized to canonical decimal form.
- No upper numeric bound in the MCP input contract.
- JSON integer values rejected by the MCP schema.
- The canonical PR and ISSUE evidence `source_id` remains a positive decimal string under D9.
- The decision governs the MCP tool input only. It does not alter other numeric limits, `source_id` semantics, G1 to G5, or any other contract.

Recorded in D02 as DEC-15 (`docs/development/d02-mcp-integration-decision-record.md`, §19.2). This section is the phase-status reference for DEC-15.

### 33.2 Correction of §31 reference

§31 states that the string form is "the accepted-in-principle MCP shape recorded in phase-status §18." That is incorrect. §18 covers I2 contract decisions and holds no MCP record. §31 is not rewritten. This section is the correction. The owner decision is now recorded in D02 DEC-15 and in this §33.

The readiness closure report (`docs/development/i3-i4-readiness-closure-report.md`, V7) and the owner decision package (`docs/development/i3-i4-owner-decision-package.md`, §3.3) still describe the MCP shape as AIP or as a non-approval. Those files were not edited. Their statements are superseded for this input by DEC-15.

### 33.3 D02 edits

D02 is a decision record, and the owner authorized these edits. Only the following changed:

- Status table, "Production MCP contract": changed from "DECISIONS CLOSED BY OWNER" to "PROPOSED, NOT APPROVED as a whole", with DEC-15 as the only approved item.
- Status table, "MCP implementation" and §19.4 "MCP implementation": changed from "NOT STARTED" to "PARTIAL. Not accepted." The earlier text contradicted §31 and §32.
- §16.1: the sentence "It is not approved" now excludes the `number` input approved by DEC-15.
- §16.6 `number` row: changed from integer 1 to 2,147,483,647 to the DEC-15 string contract. The row states that the integer form was a proposal and is withdrawn.
- §19.2: added DEC-15 (APPROVED, recorded in this section).
- §19.4 "Production MCP contract": "PROPOSED, NOT APPROVED, except the MCP `number` input approved by DEC-15."

Not changed: the rest of §16, including G1 to G5 and the §16.8 table. The §12 status snapshot near line 628 ("MCP implementation: NOT STARTED") is an earlier revision. It was left as history.

D02 SHA-256 after this edit: `65B0C43B9E296124A7F8D489C94A3DB1EA562E7CB36B0AF8D1344538935386B5`. Earlier value recorded in §32 (16-character prefix `62561C74471D6144`) is superseded for D02 only.

Other protected hashes re-checked after this edit and unchanged: architecture `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9`, spec-1 `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004`, D01 `053E3E373EA2D076C6B75990F6B700D928A22B6937A218D58DC3368AFCFAAEA7`, `.kiro/settings/mcp.json` `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`.

### 33.4 Implementation check against DEC-15

No source change was needed. The implementation already matches DEC-15:

- `backend/app/modules/mcp/server.py`: `get_pr(repository_id: str, number: str)` and `get_issue(repository_id: str, number: str)`.
- `backend/app/modules/evidence/identity.py`, `is_positive_decimal`: `[0-9]+` matched in full, and not all zeros. No upper bound.
- `backend/app/modules/mcp/tools.py`, `_github_record`: rejects non-strings and non-positive-decimal values with `INVALID_INPUT`, `field: number`.
- `backend/app/modules/github/client.py`, `_validated_request`: applies the same rule and returns `canonical_decimal(number)`, which strips leading zeros.
- The exposed SDK schema is `{"number": {"type": "string"}}`, required, with no pattern, minimum, or maximum.

### 33.5 Files changed in this checkpoint

- `docs/development/d02-mcp-integration-decision-record.md`: DEC-15, status corrections, §16.1 and §16.6 edits (see 33.3).
- `backend/tests/unit/test_mcp_number_input.py`: new focused tests (see 33.6).
- `.kiro/reports/phase-status.md`: this section appended. No earlier text was changed.

No other file was changed. No dependency was installed. No checkbox, approved specification, architecture document, or `mcp.json` was changed.

### 33.6 Tests and results

New file `backend/tests/unit/test_mcp_number_input.py` (33 tests). It uses the SDK tool layer, a registered repository with no GitHub identity, and no network access:

- Exposed schema: `number` is a required `string` for both tools, with no pattern, minimum, or maximum (2 tests).
- JSON integer `7` raises `ToolError` from the SDK schema (2 tests).
- Accepted values reach the handler and stop at `GITHUB_IDENTITY_UNRESOLVED`: `"7"`, `"007"`, `"2147483648"` for both tools (6 tests).
- Rejected values return `INVALID_INPUT` with `field: number`: `"0"`, `"-1"`, `"00"`, `"+7"`, `"1.5"`, `" 7"`, `"7a"`, `""` for both tools (16 tests).
- Canonical form in the GitHub request builder: `"7"`→`"7"`, `"007"`→`"7"`, `"0000042"`→`"42"`, `"2147483648"`→`"2147483648"` (4 tests).
- Client rejects `"0"`, `"-1"`, `"7a"` (3 tests).

Commands and results (from `backend`):

- `& '.\.venv\Scripts\python.exe' -m pytest tests/unit/test_mcp_number_input.py -q -rfxXs --tb=short -p no:cacheprovider`: 33 passed.
- `& '.\.venv\Scripts\python.exe' -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider`: 972 passed, 0 failed, 0 skipped, 6 xfailed (the strict G1 to G5 expectations from §32, unchanged). Duration 239.6 s.
- `& '.\.venv\Scripts\python.exe' -m pip check`: No broken requirements found.

### 33.7 Not claimed

- This record does not mark D02 §16 approved. Only DEC-15 is approved.
- G1 to G5 remain proposal differences with their strict xfails (§32.5). They are unchanged.
- The §32 gaps still apply: no successful `get_pr` or `get_issue` record is driven through MCP, no in-flight subprocess termination test exists, no live Category C response was observed, and the Uvicorn exit code 3 is unexplained.
- Kiro runtime behavior of the schema (MCP-18) is not verified.
- I5 and I6 are not complete and not accepted.

## 34. E-D13 governance record: optional AI provider (recorded 2026-11-10)

Status: governance record created. It approves nothing. E-D13 is OPEN. Gemini implementation is BLOCKED. Native Task 14 is BLOCKED and unchanged. No checkbox changed (0 `[x]`). No Gemini API call was made. No dependency was installed. No source code, test, configuration, or approved document was changed. I5 and I6 remain partially implemented and NOT accepted.

### 34.1 Record created

`docs/development/e-d13-optional-ai-provider-decision-record.md`. It contains:

- A status legend (APPROVED, PROPOSED, OPEN, BLOCKED).
- A decision matrix for AI-1 to AI-15 with status and gates. Each item is PROPOSED, OPEN, or BLOCKED. None is APPROVED.
- A privacy and external-service prerequisite list (P1 to P7). P1 and P2 are partially verified. P3, P4, P6, and P7 are not met.
- The proposed minimal architecture and failure table.
- Model and dependency rules. `gemini-3.5-flash` is not to be used.
- The implementation authorization boundary.
- A traceability map to Requirement 11, Spec 1 §11, §15, §22, §24, Architecture §2.1, §2.7, §7, §18, §19, the Operating Guide §9, the Playbook §3, §6, §8, design.md lines 130 and 567 to 570, tasks.md Task 14 and 16.1, and the I5 plan §4.1.
- Required document amendments A1 to A6. None was made.
- Sources with verification dates.

### 34.2 Status of the Gemini premise

- No approved source names Gemini. The earlier premise (phase-status §30) remains unsupported.
- The model named in the earlier directive, `gemini-3.5-flash`, is deprecated. Its official model page, read on 2026-11-10, routes it to `gemini-3.6-flash` ([source](https://aistudio.google.com/docs/models/gemini-3.5-flash)).
- Under the unpaid tier, Google's terms state that submitted content and responses may be used to improve Google products, and that human reviewers may read them ([source](https://aistudio.google.com/docs/terms), read on 2026-11-10). The paid-service clause was truncated in retrieval and must be read in full.

### 34.3 Record issues found, not changed

- phase-status §1 still lists Phase 3 as "Increment I0 only." The later sections (§28 to §33) record I5 and I6 partially implemented. §1 was not edited in this checkpoint.
- The E-D13 record's sources are the Google documentation pages listed in its section 9. Two of them are search snippets only, and the record labels them that way.

### 34.4 Not claimed

- No proposed decision is approved.
- I5 and I6 are not accepted, and Phase 3 remains in progress.
- Task 14 is not started or complete.

### 34.5 Owner decisions still required

The E-D13 record's section 10 lists them. Before Task 14 can start, the owner must approve AI-2 and AI-3 through AI-10, decide AI-1 and the section 8 amendments, and confirm the section 6 conditions. AI-3 requires the privacy gate (P1 to P4) to be closed first.

## 35. Owner decisions AI-2 and AI-4 recorded: Gemini API, Free Tier, gemini-3.6-flash (recorded 2026-11-10)

Status: owner decisions recorded in the E-D13 decision record. Gemini implementation is NOT AUTHORIZED. Native Task 14 remains BLOCKED. No checkbox changed (0 `[x]`). I5 and I6 remain partially implemented and NOT accepted. No phase or increment status changed.

### 35.1 Decisions recorded

- **AI-2, provider: APPROVED.** Google Gemini API is the selected optional AI provider. The owner's stated basis is prior practical testing. This record does not verify that testing. Approval covers provider selection only.
- **Usage tier: Free Tier.** Google's terms call this "Unpaid Services." No paid plan, billing account, or billing authorization is approved. No automatic fallback to a paid tier is permitted.
- **AI-4, model: APPROVED, `gemini-3.6-flash`.** Verified against Google's model page on 2026-11-10 (code `gemini-3.6-flash`, stable). Free Tier eligibility and pricing were not confirmed by that page.
- **Excluded:** `gemini-3.5-flash` (deprecated, routed to `gemini-3.6-flash`). No substitution is permitted. `gemini-3.8-flash` is named as newer by Google and is not approved.
- **AI-3, privacy and data use: remains OPEN.** Selecting the Free Tier does not authorize confidential content. Source code, diffs, file excerpts, commit messages, private repository metadata, credentials, and other confidential information remain excluded. Only minimal, structured, non-sensitive, appropriately anonymized information may be considered. Anonymization does not by itself guarantee privacy. Any expansion needs a separate owner decision.

### 35.2 Pre-implementation verification still required

- Exact API model identifier, current availability, lifecycle status, and Free Tier eligibility for `gemini-3.6-flash`, on the implementation date.
- If any check fails or the status has changed, stop and request owner direction. Do not select a replacement independently.

### 35.3 Open contradictions recorded, not resolved

- **C1:** AI-10 (proposed field list) may include commit hashes, file paths, author names, and dates, which can be private repository metadata that AI-3 excludes. AI-10 must be revised before use.
- **C2:** `design.md` line 567 (E-D13) and line 130 ("No provider is selected") still state that no provider is chosen. The amendments that would correct them (A1, A2) are not authorized and were not made.
- **C3:** Free Tier eligibility of `gemini-3.6-flash` is not established.
- **C4:** The owner's prior testing is recorded as the owner's statement. It is not verified here.
- **C5:** Whether any content Sean would still send, after AI-3, supports a useful explanation is an owner question.

### 35.4 Documents changed

- `docs/development/e-d13-optional-ai-provider-decision-record.md`: updated (AI-2 and AI-4 approved, AI-3 and the other items kept, section 0 added, contradictions recorded). Hashes are reported in the session report.
- `.kiro/reports/phase-status.md`: this section appended. Earlier sections not rewritten.

No source code, test, dependency, configuration, MCP settings, approved specification, architecture document, or design or task baseline was changed. No Gemini API call was made. No checkbox changed. I5 and I6 acceptance status unchanged.

### 35.5 Still required before Task 14 can start

AI-3 closed, AI-5 to AI-11 decided, AI-1 decided, the section 8 amendments authorized (including C2), AI-15 authorization boundary decided, and every section 6 condition of the E-D13 record met. I5 and I6 must also be accepted (AI-1 and section 6 conditions 1 and 2).

## 36. E-D13 addendum: privacy classification, Free Tier verification, payload redesign, design alignment (recorded 2026-11-10)

Status: documentation and research checkpoint. Gemini implementation is NOT AUTHORIZED. Native Task 14 remains BLOCKED. No Gemini API call was made. No dependency, source code, test, configuration, approved specification, or approved baseline was changed. No checkbox changed (0 `[x]`). I5 and I6 remain partially implemented and NOT accepted. No phase or increment status changed.

### 36.1 Artifact

`docs/development/e-d13-addendum-2026-11-10-privacy-free-tier-and-design.md`. It contains:

- Verified Free Tier facts with URLs and the verification date (section 2).
- A 25-row privacy classification matrix for AI-3 with the categories ALLOWED, ALLOWED_ONLY_AFTER_TRANSFORMATION, PROHIBITED, and REQUIRES_SEPARATE_OWNER_APPROVAL (section 3).
- A reconciled AI-10 payload, expected response, prohibited-field list, and validation rules V1 to V10 (section 4).
- A value assessment and recommendation (section 4.5).
- Design alignment: eight outdated or incorrect statements, with proposed replacement text that is not applied (section 5).
- A gate table for AI-2 to AI-15 (section 6), sources (section 7), questions (section 8), and blockers (section 9).

### 36.2 Verified facts (documentation, read 2026-11-10)

- `gemini-3.6-flash` is the model code. It is listed as stable, and the page describes it as a previous-generation Flash model that remains available for production use.
- The pricing table lists `gemini-3.6-flash` with input, output, and context caching "Free of charge" in the Free Tier column. The same table states "Used to improve our products: Yes" for the Free Tier.
- Free Tier content may be used by Google to provide, improve, and develop products and machine-learning technologies. Human reviewers may read and annotate inputs and outputs.
- Linking a billing account makes Gemini API access a paid service. The Gemini API serves paid requests only with a positive prepaid balance. Free to Tier 1 upgrades require a linked billing account.
- Default logging is on for Generate Content calls in projects created on or after October 26, 2026. Logs are retained for a default maximum of 55 days. The logs page also says logging is "only available for billing-enabled projects." These two statements conflict for a Free Tier project.

### 36.3 Not verified

- Account-level Free Tier eligibility, project verification status, and regional availability for the owner's account.
- Numeric per-model Free Tier limits for `gemini-3.6-flash`. The per-model table is behind sign-in.
- The HTTP status and error body for Free Tier RPM, TPM, and RPD exhaustion. Only the spend-limit 429 is documented in the pages read.
- The Gemini Developer API endpoint, request schema, and authentication header.
- The owner's logging setting.

### 36.4 Findings and recommendations (proposals, not approvals)

- **Privacy:** Only the classification, retrieval status, evidence-type enum, integer counts, limitation codes, and generic skeleton are both allowed and necessary. Every field that identifies a repository, file, symbol, commit, developer, or record is PROHIBITED or requires separate owner approval. Under Free Tier terms, even this minimal payload is submitted content that Google may use.
- **Payload value:** The compliant payload offers little beyond the deterministic text. The validator cannot check semantic faithfulness. Recommendation: do not implement the Gemini provider on this basis. Improving the deterministic templates is a lower-risk alternative and needs its own owner decision.
- **Design:** Eight statements are outdated or incorrect. The most important are `design.md` line 129 (no provider selected) and its citation of "Architecture §5" (the no-interface rule is in §2.7 and §7). The file-status header in `tasks.md` line 7 ("NOT APPROVED. No task may start") conflicts with the OD-16 approval of that file's hash. It is flagged, not changed.

### 36.5 Contradictions and open questions (not resolved)

- Logging setting for Free Tier projects (addendum Q3). Conflicting statements in the logs policy.
- Whether any useful explanation is possible under AI-3 (Q1). Whether the Free Tier data-use condition is acceptable even for the minimal payload (Q2).
- The tasks.md file-status header against the OD-16 approval (Q8). The design's "Architecture §5" citation (Q9).
- The owner's prior testing is recorded as the owner's statement (Q11). Not verified here.

### 36.6 Gate status (unchanged)

- AI-2: APPROVED (preserved). AI-4: APPROVED (preserved). Account-level Free Tier eligibility: OPEN.
- AI-3: OPEN. Proposed matrix ready for owner decision.
- AI-10: PROPOSED, redesigned. Recommendation not to implement.
- AI-5 through AI-15: unchanged status. No additional decision was marked APPROVED.

### 36.7 Implementation blockers

Task 14 header and file status; AI-3 policy decision; account-level Free Tier checks and logging setting; AI-6 key name and E-D15 amendment; AI-7 configuration (Task 16.1, blocked by O-G1 and OD-5); AI-5 endpoint and transport verification; AI-9 validation rules; AI-11 numeric limits; design and task amendments D1 to D6 (owner authorization required); owner decision on value; live API calls (none authorized); phase and increment gates.

### 36.8 Files changed in this checkpoint

- Created: `docs/development/e-d13-addendum-2026-11-10-privacy-free-tier-and-design.md`.
- Appended: `.kiro/reports/phase-status.md` (this section). Earlier sections not rewritten.

Hashes and the protected-file verification are reported in the session report.

## 37. I5 and I6 completion checkpoint, governance closure, and acceptance package (recorded 2026-11-10)

Status: I5 and I6 are technically ready for owner review with the caveats in the acceptance package. **Neither increment is OWNER_ACCEPTED.** Phase 3 remains IN_PROGRESS. Phase 4 has not started. Checkboxes: none changed. Task 14 remains `[ ]`. Nothing in this record is owner acceptance.

### 37.1 Amendment to §1 (dated correction; §1 is not rewritten)

The §1 phase table above still shows Phase 3 as "Increment I0 only." That table is historical. The current status is:

- I0: VERIFIED (§4).
- I1: ACCEPTED by owner (§7).
- I2: implemented, unit-verified, NOT ACCEPTED (§15 to §18).
- I3 and I4: implemented, unit-verified, NOT ACCEPTED (§25).
- I5 and I6: partially complete at §28 to §33. Technically ready for owner review at §37, NOT ACCEPTED.
- Phase 3: IN_PROGRESS. Phase 4: NOT_STARTED.

### 37.2 Owner-authorized execution in this checkpoint

- Deterministic explanation improved (`templates.py`, `orchestrator.py`), with tests.
- I6 HTTP end-to-end test added (7 tests, real uvicorn process on loopback).
- MCP successful `get_pr` and `get_issue` through the tools tested (canned opener, no network).
- Process-tree termination on Git timeout added (`git_runner.py`), after a reproduced 120-second blocking defect.
- Independent security review by the review-only security-auditor sub-agent. Its findings were fixed, except those recorded below as limitations.
- Governance: owner-authorized outdated-statement edits applied to `design.md` (Explanation design bullet and E-D13 row) and `tasks.md` (Task 14 header and subtask 14.1). Checkboxes unchanged. E-D13 record §9 appended with the owner's deferral decision.

### 37.3 Defects found and fixed

- **Runner blocked on a descendant that holds the output pipe.** Measured at 120.4 seconds for a 1-second timeout. After the fix, 1.5 seconds. Cause: `Popen.kill` stops only the direct child, and closing a pipe that a reader thread still uses blocks until the descendant exits.
- **Runner could return partial output as success** when a descendant kept the pipe after the child exited 0. Now raises `GIT_TIMEOUT`.
- **Explanation overstated a symbol-level change.** The history for a symbol target is file-level. Conclusions now name only the path.
- **Explanation repeated the same limitation** in three places. Consolidated.
- **Explanation text carried raw limitation codes** ("symbol history file level"). Replaced by fixed sentences in one table, with a visible fallback for unknown codes.
- **Explanation ignored `verified_blame_ranges` and `co_changed_document_count`.** Both are now used when they are non-zero.
- **Explanation text passed control and bidirectional characters through.** Now replaced.
- **Test tooling resolved `taskkill` and `tasklist` by bare name.** Now absolute System32 paths, and a PID is killed only after it is confirmed alive.

### 37.4 Verification (fresh runs, 2026-11-10)

- Full backend suite: `python -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`. Result: **1024 passed, 0 failed, 0 skipped, 6 xfailed** (strict expected failures G1 to G5, unchanged). Duration 257 seconds.
- `python -m pip check`: no broken requirements.
- `python -W error -c "import app.main"`: exit 0.
- `python -W error` import of the MCP server, tool, explanation, and Git runner modules: exit 0.
- Focused explanation, Git runner, MCP GitHub, orchestrator, and HTTP end-to-end suites: 104 passed.
- HTTP end-to-end (`tests/integration/test_http_e2e.py`): 7 passed. Includes graceful shutdown, leak checks, and a fake-token check.

### 37.5 Uvicorn exit code 3

Explained, not left open. Uvicorn's `capture_signals` (installed `uvicorn/server.py`) re-raises the captured signal after shutdown, and it handles `SIGBREAK` on Windows. A probe that re-raises `SIGBREAK` exits with code 3 on this machine. The graceful shutdown messages were observed before the re-raise. The end-to-end test asserts code 3 for this reason.

### 37.6 Governance issues and their disposition

- **`tasks.md` header "NOT APPROVED. No task may start."** Conflicts with the OD-16 approval of the file's hash (§23). **Not resolved here. Owner decision required.** The header is part of the approved baseline text, and the OD-16 record is preserved.
- **Approved baselines changed under owner authorization:** `design.md` (three text edits) and `tasks.md` (two text edits in Task 14). The OD-16 hashes no longer match. **The owner must re-review and re-approve the amended files.** Kiro has not recorded that approval.
- **E-D13 decisions:** AI-2 and AI-4 remain APPROVED. AI-3 remains OPEN. Gemini and Task 14 are DEFERRED by owner decision (E-D13 record §9).
- **D02 §16:** only DEC-15 is approved. The rest of §16 remains PROPOSED. The §12 snapshot line "MCP implementation: NOT STARTED" is an earlier revision (historical).
- **D01 reproducibility:** no lock file and no `requirements.txt` exists in `backend/`. Deferred to the lock step.

### 37.7 Findings that need an owner decision

- **F1. INFERRED is not reached end to end.** A co-changed document always comes with verified commits for the target, which classify as DOCUMENTED. The INFERRED branch is unit-tested only.
- **F2. Association (G-M) is not approved.** The PR and issue criterion stays at zero.
- **F3. Cache (Task 10) is not implemented.** D06 and D07 are open.
- **F4. MCP contract differences G1 to G5** are differences from the proposed D02 §16. They are strict expected failures.
- **F5. Limits (OD-5)** are unapproved. Task 16.1 is BLOCKED.

### 37.8 Limitations recorded, not fixed

- A descendant whose parent exited before the timeout is not killed by `taskkill /T`. A Windows job object is needed.
- `retrieved_at` with sub-second precision passed directly to `investigate` raises a raw validation error. The HTTP path is unaffected.
- The diagnostic field `ai_available` is hard-coded to `False`.
- Test helpers call `git` by bare name (`conftest.py` and `test_core_git_runner.py::_git`).
- The HTTP test's port probe has a race window. Test-only.

### 37.9 Files changed in this checkpoint, with SHA256

Code:
- `backend/app/core/git_runner.py`: `5E09DD7E64CF807D34A213B8B6A3CA59E29A9FCF5872349C8F797827233F4BC6`
- `backend/app/modules/explanation/templates.py`: `6BB6DC0B4E1FDC620A5F12EE7D1352D509089D3F16657BC8BE7115FF3128816A`
- `backend/app/modules/investigation/orchestrator.py`: `68A376914B2B1D908E00B99CE89F004F31A193BA963B1F35DBE723E2BCB233A7`

Tests:
- `backend/tests/unit/test_explanation_templates.py`: `D4E4A5AFCA0987B78C53A1FAFB9F176DCDE8A7E61FC1C47F3B0D0EDFBD3A4E3C`
- `backend/tests/unit/test_explanation_integration.py` (new): `C007723342AAE7D92A26944B6F073F401FBCB4DD7A3478A6548CF172C89462FE`
- `backend/tests/unit/test_mcp_github_success.py` (new): `29EB44A077EFD803F8F0D0FD3DBD14D19C3B78A3CEBFCD0EE6989087E0C4B988`
- `backend/tests/unit/test_core_git_runner.py`: `37793DEC22E67764F6606397F18D6B8A4592EB1253F99F5C20D696A0DF424E0F`
- `backend/tests/integration/test_http_e2e.py` (new): `DE168FFA7585393BEB29325BC5D45E327C1CC3ACE41D266BAD03798A311F338D`

Approved baselines (owner-authorized text edits; re-approval required):
- `.kiro/specs/evidence-retrieval/design.md`: `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A` (OD-16 baseline was `EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3`)
- `.kiro/specs/evidence-retrieval/tasks.md`: `E7855B78F87BD4FBDCDF898E51830513CA6054CC378CBC78D302B48259A4D564` (OD-16 baseline was `B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8`)

Decision and documentation records:
- `docs/development/e-d13-optional-ai-provider-decision-record.md`: `27F294DD503BB17C2B6F386F981AC588471EAED36AAE5D5B0845E4EC4B4A9723` (§9 appended)
- `docs/development/i5-i6-owner-acceptance-package.md` (new): `3A3D1538D220DD5082CA68E4EAEBB91204B4ADDDDC12C55B049A0FEC1E61B99B`
- `.kiro/reports/phase-status.md`: this section appended. Its hash is reported in the session report, because a file cannot record its own hash.

### 37.10 Protected documents verified unchanged

Verified by SHA256 in this checkpoint: architecture (`3AB618886BBE…`), Spec 1 (`71FEF399A02C…`), Spec 2 (`EF7971157A0C…`), D01 (`053E3E373EA2…`), D02 (`65B0C43B9E29…`), `requirements.md` (`51123AEA8E15…`), `.kiro/settings/mcp.json` (`02FB9811E5ED…`), and D03 (`12AA12BC302F…`). None was changed in this checkpoint.

### 37.11 Owner decisions required before acceptance

1. F1: INFERRED reachability. Keep and document, or change the classification rule through an approved amendment.
2. The `tasks.md` header conflict (§37.6).
3. Re-approval of the amended design and task files.
4. Task 10 cache: required for I5, or deferred with D06 and D07.
5. MCP contract differences G1 to G5: amend D02 or change the implementation.
6. OD-5 numeric limits for Task 16.1.
7. Association (G-M): required for I5, or deferred.
8. Confirm the new system-binary invocation (`taskkill.exe`) in the Git runner.

The acceptance package is `docs/development/i5-i6-owner-acceptance-package.md`. The owner's acceptance decision is recorded separately.

## 38. Phase 3 closure pass (2026-11-10)

### 38.1 Verdict
BLOCKED. Phase 3 is not recommended for closure. The full closure report is `docs/development/phase-3-closure-report.md`, which states the blocking owner decisions in its section 10.

### 38.2 Verification evidence
- Last full backend run: 1031 passed, 0 failed, 0 skipped, 6 xfailed (267.85 s), from `backend` with `.venv\Scripts\python.exe -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider`.
- `pip check`: clean. Import check `python -W error -c "import app.main"`: clean.
- The xfailed tests are the MCP differences G1 to G5 from D02 section 16, each kept with its own reason.

### 38.3 Acceptance status
- I0: VERIFIED. I1: ACCEPTED by owner (section 7).
- I2 to I6: implemented and verified by tests. None is accepted by the owner. No acceptance is recorded in this section.
- Gemini and Task 14: DEFERRED by owner decision (E-D13 record section 9).

### 38.4 Final SHA256 of changed files
Code:
- `backend/app/core/git_runner.py`: `E48D29F6C1650A87FA7B649181F96792C02471A0611C920485B2A30137DE4FA6`
- `backend/app/core/limits.py`: `49FE8D230C96E2A31365A3E4E407A39BDF8132A0ABEA894D2F528FFC029D55C4`
- `backend/app/modules/mcp/tools.py`: `346287B6770701A0DEC705D19D977D6B41022D6BE4C41DA7CCEFB4E25A5DFAF9`
- `backend/app/modules/repository/registry.py`: `104A84609094B9A658B65A3AC90514C4D8E837EC2293B29E7A668417A7CCDF1E`
Tests:
- `backend/tests/unit/test_core_git_runner.py`: `E2D41874910E1CE4FEDB62AA53969833238460A8CE9A16B8D2D2B38302FD3CAB`
- `backend/tests/integration/test_http_e2e.py`: `16D75B8497C67D38C262C39E525E0DB395EF8AA93EE95BBD9FC33CDC129A671D`
- `backend/tests/unit/test_explanation_templates.py`: `D4E4A5AFCA0987B78C53A1FAFB9F176DCDE8A7E61FC1C47F3B0D0EDFBD3A4E3C`
- `backend/tests/unit/test_explanation_integration.py`: `C007723342AAE7D92A26944B6F073F401FBCB4DD7A3478A6548CF172C89462FE`
- `backend/tests/unit/test_mcp_github_success.py`: `29EB44A077EFD803F8F0D0FD3DBD14D19C3B78A3CEBFCD0EE6989087E0C4B988`
Documents:
- `docs/development/phase-3-closure-report.md` (new): `E1B366FC22836972F333C9B643B193DA324C382988FB7157684AC9A897846F73`
- `docs/development/i5-i6-owner-acceptance-package.md` (new): `3A3D1538D220DD5082CA68E4EAEBB91204B4ADDDDC12C55B049A0FEC1E61B99B`
- `docs/development/e-d13-optional-ai-provider-decision-record.md`: `27F294DD503BB17C2B6F386F981AC588471EAED36AAE5D5B0845E4EC4B4A9723`
Amended approved baselines (owner-authorized text edits, not approved; re-approval required):
- `.kiro/specs/evidence-retrieval/design.md`: `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`
- `.kiro/specs/evidence-retrieval/tasks.md`: `E7855B78F87BD4FBDCDF898E51830513CA6054CC378CBC78D302B48259A4D564`

The hashes of `git_runner.py`, `test_core_git_runner.py`, and `test_http_e2e.py` in section 37.9 are superseded by the values above. Those files changed after section 37 was written. Section 37 is not edited, to preserve the historical record.

This file cannot record its own hash. Its hash is reported in the session report.

### 38.5 Protected documents verified unchanged
Verified by SHA256 in this checkpoint, and matching the values in section 37.10:
- Architecture: `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9`
- Spec 1: `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004`
- Spec 2: `EF7971157A0CE169780F012D3436A6B42717F7C55B7C963DE659BB7254776AEC`
- D01: `053E3E373EA2D076C6B75990F6B700D928A22B6937A218D58DC3368AFCFAAEA7`
- D02: `65B0C43B9E296124A7F8D489C94A3DB1EA562E7CB36B0AF8D1344538935386B5`
- D03: `12AA12BC302F1D5CB21CB4130D51B507B0681BF93B428C401A320054048EE6E6`
- `.kiro/specs/evidence-retrieval/requirements.md`: `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7`
- `.kiro/settings/mcp.json`: `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`

### 38.6 Open owner decisions (closure report section 10)
1. G-M association: approve the mechanism, or amend Spec 1 section 7 to defer it.
2. Task 10 cache: decide D06 and D07, or defer with an amendment.
3. OD-5 numeric limits and Task 16.1, including the blame span contradiction (MCP 500 against core 2000).
4. MCP differences G1 to G5: amend D02 section 16, or change the implementation.
5. `mcp.json` enablement in Kiro and the Kiro runtime test (MCP-18). MCP-10 Hypothesis tests are not authorized.
6. Dependency manifest and lockfile authorization under D01. Neither exists, so builds are not reproducible.
7. The `tasks.md` header conflict ("NOT APPROVED. No task may start.") and re-approval of the amended design and tasks files.
8. F1: acceptance of the INFERRED reachability clarification (DOCUMENTED is returned for commit-based evidence).
9. Residual R1 (descendant created before Job Object assignment; a fix needs CREATE_SUSPENDED and approval) and awareness of the `taskkill.exe` fallback.
10. Owner acceptance of I2, I3, I4, I5, and I6.

### 38.7 Known gaps
- The repository has no commits, so there is no diff baseline. All changes are untracked.
- No live Category C HTTP response was observed.
- The Kiro runtime was not exercised.
- `backend/app/api/app.py` diagnostics hardcode `"ai_available": False`.

## 39. Final remediation pass and closure decision (2026-11-10)

### 39.1 Verdict
BLOCKED BY OWNER DECISION. The full assessment is section 15 of `docs/development/phase-3-closure-report.md`, which supersedes the verdict in its sections 1 and 14. No owner acceptance is recorded here.

### 39.2 What changed in this pass
- Windows Git containment: the child starts suspended, is assigned to a kill-on-close Job Object, and resumes only after assignment. The `taskkill.exe` fallback is removed. Job creation or assignment failure, or a non-Windows platform, returns `GIT_FAILED` without starting Git.
- Path containment (C.3a steps 4 to 7) was defined but had no caller. It is now applied in `investigate()` (HTTP and MCP `search_history`) and in `blame_range` (MCP).
- MCP path errors keep the code chosen by the path layer.
- One MCP xfail that expected the wrong code (`PATH_OUTSIDE_REPOSITORY` for a lexical `..`) is replaced by a lexical `INVALID_INPUT` test and a junction `PATH_OUTSIDE_REPOSITORY` test.
- Dependency manifests: `backend/requirements.txt` (32 runtime pins) and `backend/requirements-dev.txt` (includes runtime, plus 6 pytest-closure pins). No hashes, Windows-only set.
- `tasks.md` header replaced. The text is "owner approval of this amended text is NOT RECORDED".

### 39.3 Evidence (executed in this pass)
- Clean venv from `requirements-dev.txt`, Python 3.14.0, pip 25.2: install exit 0; `pip check` "No broken requirements found."; import check with `-W error` prints `IMPORT_OK`.
- Full suite in that venv, `pytest tests -q -rfxXs --tb=short -p no:cacheprovider`: 1040 passed, 0 failed, 0 skipped, 5 xfailed (288.57 s), exit 0.
- Security review (security-auditor, review only): findings fixed or recorded in closure report 15.9.

### 39.4 Known gaps
- The approved interpreter is Python 3.14.10 (D01). It is not on this machine. Verification ran on 3.14.0. Installing 3.14.10 needs owner authorization.
- The D01 advisory re-review has not been run for the pinned set.
- The five remaining xfails are owner decisions (closure report 15.11).
- Native `design.md` and `tasks.md` are amended and not approved.
- Limits (500 MCP blame span against 2000 core span) are proposals awaiting an owner decision.
- The production `.kiro/settings/mcp.json` (C-D7) was not changed or exercised.

### 39.5 SHA256 of changed files
Code:
- `backend/app/core/git_runner.py`: `852865512C0C33A06BA600184DC80CC67F47DE36C6D06FBF3A88C2CD0C4D42D3`
- `backend/app/modules/investigation/orchestrator.py`: `AE1A91E2AB4B12BE56C1FDE518C071BF76BE33AD9242BB172574A0359CF149EA`
- `backend/app/modules/git_history/blame.py`: `0CE568BF898622AE9A82DF1FBD8A833F3FFDEC0514A42822E3D471F76080491D`
- `backend/app/modules/mcp/tools.py`: `75A10AB4FF9380ECA5276CAAB96B11D1EBE867D3A47F6E51289A8117BEF8419B`
- `backend/app/modules/repository/paths.py`: `BAA5560F8DB2E0ADBE9FD9F4A72A12E15FB85E2590DA07A31AB238382A5C9DB0`
- `backend/app/core/limits.py` (not changed in this pass): `49FE8D230C96E2A31365A3E4E407A39BDF8132A0ABEA894D2F528FFC029D55C4`
Tests:
- `backend/tests/unit/test_core_git_runner.py`: `E283658ED26E653543ED0DB007A51692E6790F12F00841ED32A951D292FEB9A9`
- `backend/tests/unit/test_mcp_contract.py`: `C2450148F6C49C0FDFEDBBD6A6B0F1E259938E7524ECC2C848D0322A11DAA4B8`
Dependency manifests (new):
- `backend/requirements.txt`: `3C7634A97EB1A70CE84E4836060C8A85CAD9184B9E4A7B209AC879DDFC50BA57`
- `backend/requirements-dev.txt`: `8C2D32DB3096911EBCAC0D8AF0FD9DAE6A6A19810A20FA8DD2C65EFBB5061298`
Documents and Spec baselines:
- `docs/development/phase-3-closure-report.md`: `CAC984006CA851677A3F1FC06308C7BDA7C4511507E58CC1CAD286E4B6A636DD`
- `.kiro/specs/evidence-retrieval/design.md` (not changed in this pass; amended value, not OD-16 `EBDB3BFD…`): `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`
- `.kiro/specs/evidence-retrieval/tasks.md` (header amended in this pass; OD-16 baseline `B286FD21…`): `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5`

### 39.6 Protected documents verified unchanged (SHA256)
Architecture `3AB618886BBE…`; Spec 1 `71FEF399A02C…`; Spec 2 `EF7971157A0C…`; D01 `053E3E373EA2…`; D02 `65B0C43B9E29…`; D03 `12AA12BC302F…`; `requirements.md` `51123AEA8E15…`; `.kiro/settings/mcp.json` `02FB9811E5ED…`. All match sections 37 and 38.

### 39.7 Owner decisions still required
1. Python 3.14.10 installation and re-verification, or amend D01 to accept 3.14.0. Confirm the two manifests as the backend lock.
2. D01 advisory re-review authorization for the pinned set.
3. Re-approval or rejection of the amended `design.md` and `tasks.md`.
4. Confirm deferral of Task 10 (cache) and G-M (PR and Issue association).
5. Five MCP xfails (closure report 15.11).
6. Limits: one value set for the line span, and approval of each proposed value.
7. Owner acceptance of I2, I3, I4, I5, and I6.

### 39.8 Note on this file
This file cannot record its own hash. Its hash is reported in the session report.

## 40. Final Phase 3 closure attempt and Phase 4 gate (2026-11-12)

### 40.1 Verdict
**BLOCKED BY OWNER DECISION.** Phase 3 is not closed, and Phase 4 is not set to READY TO START. The full assessment is section 16 of `docs/development/phase-3-closure-report.md`. No acceptance of I2 to I6 is recorded.

### 40.2 Python 3.14.10 (D01 approved runtime)
- Installed from the official Python.Python.3.14 winget package, version 3.14.10. Installer hash verified by winget against python.org. The install upgraded the existing Python314 directory in place.
- Executable: `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`. `sys.version`: `3.14.10 (tags/v3.14.10:b703b2c, Oct 25 2026, 17:36:52) [MSC v.1944 64 bit (AMD64)]`.
- Clean venv: `C:\Users\User\AppData\Local\Temp\sean-3140-e3be415f`, built from that interpreter.
- `pip install -r backend\requirements-dev.txt`: exit 0.
- `pip check`: "No broken requirements found." Exit 0.
- `python -W error -c "import app.main, app.api.app, app.modules.mcp.server, app.modules.mcp.__main__"`: `IMPORT_OK`, exit 0.

### 40.3 Full suite (clean 3.14.10 venv)
Command, from `backend`: `pytest tests -q -rfxXs --tb=short -p no:cacheprovider`.
Result: **1047 passed, 0 failed, 0 skipped, 5 xfailed** (318.20 s), exit 0.
Added in this pass: `test_mcp_blame_span_boundary` (499, 500, 501), `test_core_blame_span_boundary` (1999, 2000, 2001), `test_output_overflow_terminates_a_descendant_in_the_job`.

Exact xfail inventory (all in `backend/tests/unit/test_mcp_contract.py`):
- `test_mcp_08_symbol_absent_from_current_state_reports_its_code`
- `test_mcp_08_no_history_reports_no_evidence_found`
- `test_mcp_08_result_limit_adds_result_limit_reached`
- `test_mcp_08_failed_rows_carry_retrieval_status_failed[not-registered]`
- `test_mcp_08_failed_rows_carry_retrieval_status_failed[invalid-path]`

### 40.4 Blame-span boundary
The MCP tool rejects spans above 500 (`MCP_BLAME_SPAN_LINES`) before it calls the core. The core `validate_line_range` rejects spans above 2000 (`MAX_LINE_SPAN`) on its own. Both are defined in `backend/app/core/limits.py`. No code change was needed. Boundary tests were added for both layers.

### 40.5 Dependency advisory review (2026-11-12)
- Source: GitHub Advisory Database, `ecosystem=pip`. Control: `pyjwt@2.4.0` matched GHSA-pxh4-856f-4h89, which confirms the filter works for transitive packages.
- All 38 installed distributions, one list query: no matching advisory.
- Six most exposed packages, individual queries (fastapi 0.162.2, starlette 1.10.0, mcp 2.3.0, cryptography 50.0.2, pydantic 2.14.3, pygments 2.21.0): no matching advisory.
- Result: no finding. No upgrade was needed. Limitation: one database, one point in time.

### 40.6 MCP stdio runtime (production launch shape)
Probe script in the temporary directory `sean-mcp-probe`, outside the repository. The probe used:
- The production command: `C:\Users\User\source\repos\Sean\backend\.venv\Scripts\python.exe -P -m app.modules.mcp`.
- The production `PYTHONPATH`: `C:\Users\User\source\repos\Sean\backend`.
- Working directory: `C:\Users\User\source\repos\Sean`.
- Environment changed for the probe: `LOCALAPPDATA` set to a temporary directory holding a disposable registry. Other inherited variables were limited to PATH, SYSTEMROOT, TEMP, TMP, and USERPROFILE. The real registry was not used.

Results:
- `initialize`: server `sean` version `0.1.0`.
- `tools/list`: `blame_range`, `get_issue`, `get_pr`, `search_history`. Exactly four tools.
- `search_history` valid request (`symbol` run): evidence returned, with ranking, limitations, and source references.
- `search_history` path `../outside.py`: `INVALID_INPUT`, no evidence.
- `search_history` unregistered repository: `REPOSITORY_NOT_FOUND`.
- `blame_range` lines 1 to 2: `GIT_BLAME` evidence with the revision.
- `blame_range` lines 1 to 501: `INVALID_INPUT`, `field: line_end`.
- `get_pr` on a repository with no GitHub identity: `GITHUB_IDENTITY_UNRESOLVED`, no network request.
- `get_issue` with JSON integer `7`: rejected by the schema (DEC-15, positive decimal string).
- Listening sockets owned by the server process: 0.
- Exit code after stdin closed: 0. Stderr: 0 bytes.
- Repository `git status --porcelain` before and after: unchanged.
- `git.exe` processes left after exit: none.

Not exercised: Kiro's own MCP client. The `mcp.json` `sean` entry has no `disabled` key, so enablement in Kiro is not verified. C-D7 and MCP-18 remain gated. `mcp.json` was not changed.

### 40.7 Process containment
The Windows Job Object paths were exercised by the test suite on this machine, through the real Win32 calls. This covers the suspended-create, assignment, resume, timeout tree, overflow tree (new descendant test), and orphaned-descendant cases. Limits: nested-job and restricted-token conditions were not forced on this machine (section 15.5).

### 40.8 Security review
Independent review of this pass's Job Object and containment changes (security-auditor, review only). Medium finding (`blame_range` bypassed containment) fixed. No critical or high finding. Details in section 15.9 of the closure report.

### 40.9 Native Spec governance (not approved)
- The OD-16 approved text of `design.md` and `tasks.md` is not retained in the repository or in Git. The native Spec files are untracked. A diff against the OD-16 text is therefore not possible.
- Known edits, recorded in §37 and §38: three design edits, two task edits in Task 14, and the `tasks.md` header replacement in this pass. These were not checked line by line.
- Native Spec approval is **not** given. Owner action: provide the OD-16 approved copies, or explicitly approve the recorded edit list.

### 40.10 Exit criteria and open blockers
Criteria 11 (native Spec approval consistency) and 13 (no unresolved mandatory owner decision) are not met. Detail in closure report section 16.6.

Owner decisions required, minimum set:
1. Provide the OD-16 approved `design.md` and `tasks.md` copies, or approve the recorded edit list at hash level.
2. MCP error envelope: should an MCP error body carry `retrieval_status: FAILED`? (Native C.5 says no; D02 §16.5 says yes.)
3. Four D02 §16.8 rows, each keep, rename, or drop: `TARGET_NOT_IN_CURRENT_STATE` in MCP output, `NO_EVIDENCE_FOUND` versus `NO_HISTORY_RETRIEVED`, and `RESULT_LIMIT_REACHED`.
4. Owner acceptance of I2, I3, I4, I5, and I6. Not recorded. The conditions in (1) and (2) must be settled first.

### 40.11 Hashes of files changed in this pass
- `backend/tests/unit/test_mcp_tools.py`: `C057BC0309717D2C21A60567193713ECCA00E5EC2D283742EDDF1F98DC1B0FCC`
- `backend/tests/unit/test_git_blame.py`: `84D81D66FE3938664CAA7817D5F834747B08E524F8FEC466312977214768F46E`
- `backend/tests/unit/test_core_git_runner.py`: `EEFBFE9569AC2C19677AA7EED4E771DE81134514C13DD4086A550B4EB20B8934`
- `docs/development/phase-3-closure-report.md` (section 16 added): `CAC984006CA851677A3F1FC06308C7BDA7C4511507E58CC1CAD286E4B6A636DD` was the value before section 16. The current value is recorded in the session report, because this file cannot record its own hash.
- `.kiro/specs/evidence-retrieval/tasks.md` (not changed in this pass): `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5`
- `.kiro/specs/evidence-retrieval/design.md` (not changed in this pass): `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`
- `backend/requirements.txt` and `backend/requirements-dev.txt` (not changed in this pass): `3C7634A97EB1A70CE84E4836060C8A85CAD9184B9E4A7B209AC879DDFC50BA57` and `8C2D32DB3096911EBCAC0D8AF0FD9DAE6A6A19810A20FA8DD2C65EFBB5061298`
- `backend/app/core/limits.py` (not changed): `49FE8D230C96E2A31365A3E4E407A39BDF8132A0ABEA894D2F528FFC029D55C4`

Protected documents, verified unchanged by SHA256 in this pass: architecture `3AB618886BBE…`, Spec 1 `71FEF399A02C…`, Spec 2 `EF7971157A0C…`, D01 `053E3E373EA2…`, D02 `65B0C43B9E29…`, D03 `12AA12BC302F…`, `requirements.md` `51123AEA8E15…`, `.kiro/settings/mcp.json` `02FB9811E5ED…`. All match sections 37 and 38.

### 40.12 Note on this file
This file cannot record its own hash. Its hash is reported in the session report.

## 41. Final Phase 3 closure reconciliation (2026-11-12)

### 41.1 Verdict
**BLOCKED BY A SPECIFIC OWNER DECISION.** Phase 3 is not closed. I2 to I6 are not accepted. Phase 4 is not active. The full record is section 17 of `docs/development/phase-3-closure-report.md`. The owner acceptance record is `docs/development/phase-3-owner-acceptance-record.md`. It is a draft and unsigned.

### 41.2 Native Spec hashes and modifications
- `requirements.md`: `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7`. Matches OD-16. Unchanged.
- `design.md`: `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`. Does not match OD-16 (`EBDB3BFD…`). Not approved.
- `tasks.md`: `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5`. Does not match OD-16 (`B286FD21…`). Not approved.
- Modifications since OD-16, from the records: design, two outdated-statement edits (§37.2) and one further edit that §37.3 mentions but does not identify. Tasks, two Task 14 wording edits (§37.2) and the header replacement (this pass). The OD-16 text is not retained, so no diff was produced. Closure report 17.1 has the full inventory.

### 41.3 MCP xfails
Before this pass: 5 xfails, which the earlier report counted as 6 cases (G1 has 2). Now: **1 xfail**. Exact node ID: `backend/tests/unit/test_mcp_contract.py::test_mcp_08_result_limit_adds_result_limit_reached`.
- Replaced with tests that assert approved behavior (Spec 1 FR-08, §5, §10.3): `test_mcp_08_failed_rows_communicate_failure_without_evidence[not-registered]` and `[invalid-path]`, and `test_mcp_08_insufficient_result_declares_its_limitation`.
- Removed (approved behavior already tested elsewhere): `test_mcp_08_symbol_absent_from_current_state_reports_its_code`.
- Remaining decision: approve a code name for the truncation limitation, or decline the row.

### 41.4 D02 row reconciliation
D02 §16.8 has 15 situation rows. The 6 xfail cases before this pass covered 6 of those rows, grouped under 5 labels (G1 covers two rows). After this pass, 1 row still differs. The earlier "five" and "six" were both correct, for different counts. Closure report 17.3 has the reconciliation. Historical reports are unchanged.

### 41.5 Kiro MCP client
Not possible from this session. Kiro's client cannot be started or read from here, and no temporary `mcp.json` was used, because that would not test Kiro's client. Verified instead: the production launch shape over stdio (§40.6). `mcp.json` unchanged.

### 41.6 Security
Second, final review of the final code: no critical or high findings. Fixes made after the first review: stderr overflow now enforced; cleanup always closes the job; pipe handles closed once; containment-failure test added; raw decode and parse errors now return `GIT_FAILED`; line errors name `line_start`. Residual findings are low or informational, and are listed in closure report 17.6. Not verified by execution: `BufferedReader.close()` behavior on a blocked reader, and handle release of the `Popen` object.

### 41.7 Tests (final run, clean Python 3.14.10 venv)
`pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`: **1054 passed, 0 failed, 0 skipped, 1 xfailed** (348.22 s). Collected 1055. `pip check`: clean. Warnings-as-errors imports: `IMPORT_OK`.

### 41.8 Exit criteria
Met: Python 3.14.10; clean install; advisory check for 2026-11-12 (single source); full suite; HTTP integration; MCP stdio (production launch shape); Windows containment; security with no critical or high; deferrals and limitations documented.
Not met: native Spec governance (41.2); no unresolved owner decision (41.9).

### 41.9 Blocking owner decisions (minimum)
1. **Native Spec.** Approve the current `design.md` and `tasks.md` by hash after checking the modification list, or supply the OD-16 approved copies. The third `design.md` edit must be identified first.
2. **Truncation code.** Approve `RESULT_LIMIT_REACHED` or another code name, or decline the row. This decides the one xfail.
3. **OD-5 limit values.** Approve or revise the proposed values, and decide whether the MCP blame span (500) and the core span (2000) are separate values. This blocks Task 16.1.
4. **I2 to I6 acceptance.** Owner decision only. The acceptance record is ready for completion.

### 41.10 Phase transitions
Phase 3 is **not** accepted. Phase 4 is **not** set to READY TO START or active. Phase 1 and Phase 2 entries are unchanged. Phase 5 and I7 were not started.

### 41.11 Hashes of files changed in this closure pass
- `backend/app/core/git_runner.py`: `7FFA8461DEB652230BEDD234BC4F975F28DF9FDE09D73D8A6D61B829360DA1D3`
- `backend/app/modules/mcp/tools.py`: `097F86BCCB2A2FF33A25F20D0EDE03E18FB3B4EECB4535FA6D9F7E584FF56A9A`
- `backend/tests/unit/test_mcp_contract.py`: `0B5DDC2D99BB7A286D8BAE7B48961C03937A9C9A3D915D99E18DCA38DA298C2D`
- `backend/tests/unit/test_mcp_tools.py`: `6653E61ADF0404033B6407DB603A8CE44FB2135DC8FC02331D3364D1F077F683`
- `backend/tests/unit/test_core_git_runner.py`: `726F768CF586342DC48901712A9F3678F5C43ABFA25AFA1EDF52E28A408A2C64`
- `docs/development/phase-3-closure-report.md` (section 17): `F433B2BFE0B9684C11073C06C3F6AC7C8AF36E33436D1F06997C862B48FB0544`
- `docs/development/phase-3-owner-acceptance-record.md` (new, draft): `DE8BE9696A3ED3E274E06FA21FCD28EBB9CFA944361E39EAA22B4583CB4D1736`

Unchanged in this pass, with hashes matching §38 to §40:
- `backend/app/core/limits.py`: `49FE8D230C96E2A31365A3E4E407A39BDF8132A0ABEA894D2F528FFC029D55C4`
- `backend/requirements.txt`: `3C7634A97EB1A70CE84E4836060C8A85CAD9184B9E4A7B209AC879DDFC50BA57`
- `backend/requirements-dev.txt`: `8C2D32DB3096911EBCAC0D8AF0FD9DAE6A6A19810A20FA8DD2C65EFBB5061298`

Protected documents, verified by SHA256 in this pass and unchanged: architecture `3AB618886BBE…`, Spec 1 `71FEF399A02C…`, Spec 2 `EF7971157A0C…`, D01 `053E3E373EA2…`, D02 `65B0C43B9E29…`, D03 `12AA12BC302F…`, `requirements.md` `51123AEA8E15…`, `.kiro/settings/mcp.json` `02FB9811E5ED…`.

### 41.12 Note on this file
This file cannot record its own hash. Its hash is reported in the session report.

## 42. Phase 3 final owner decisions, remediation, acceptance, and closure (2026-11-12)

### 42.1 Basis
Owner instruction "Phase 3 — Final Owner Decisions, Remediation, Acceptance, and Closure" (2026-11-12). The instruction text is in the conversation and is not retained in the repository. Its decisions are recorded here and in `docs/development/i3-i4-owner-decision-package.md` Part 16. Earlier sections are unchanged.

### 42.2 Amendment to the section 1 table (dated; section 1 is not rewritten)
Current status as of 2026-11-12:
- Phase 1: Complete. Phase 2: ACCEPTED (section 1, 2026-11-10).
- Phase 3 — MVP Implementation: **CLOSED** (2026-11-12, owner instruction).
- Phase 4 — Testing, Security and Verification: **READY TO START** (not active).
- Phase 5 — Demo and Hackathon Preparation: NOT_STARTED.

### 42.3 Owner decisions recorded
- **OD-7 (redirects): APPROVED.** 3xx is `GITHUB_UNAVAILABLE`, `retryable: false`. Renamed repository: `PARTIAL` for investigation, `FAILED` for single record.
- **OD-8 (oversize response): APPROVED.** Body over 1 MiB is `GITHUB_UNAVAILABLE`, `retryable: false`.
- **OD-14 (token variable): APPROVED.** `SEAN_GITHUB_TOKEN`.
- **OD-5 (limits): APPROVED** for R1, R2, R3, R4, R9, R11, R13, R14, R16, V1 to V9, the reader join (5 s), and the child wait (10 s). R18 and R19 remain APPROVED (I1). R10 is an accepted residual. R5 to R8, R17, D1, and D2 are deferred.
- **Result-limit semantics: APPROVED and implemented** (section 42.4).
- **Task 8: authorized** under the I5/I6 implementation directives (sections 28 and 30). B-4 is superseded for implementation purposes.

### 42.4 MCP remediation: result limit and retryable mapping
Files changed:
- `backend/app/modules/mcp/tools.py`: `search_history` declares `RESULT_LIMIT_REACHED` (scope `results`) when `len(result.evidence) > max_results`. Status, classification, and evidence are not changed. `McpToolError` accepts an explicit `retryable`. `get_pr` and `get_issue` pass the cause-specific `retryable` from `GitHubError`.
- `backend/app/modules/github/client.py`: `GitHubError(code, *, retryable=None)`. A 3xx response and an oversize body are raised with `retryable=False`. Other `GITHUB_UNAVAILABLE` causes and `GITHUB_RATE_LIMITED` remain retryable by default.
- `backend/app/core/limits.py`: comments only. The stale "proposed, not owner-approved" statements are corrected. The values are unchanged.
- Tests: `test_mcp_contract.py` (xfail replaced by a normal test), `test_mcp_tools.py` (three new tests), `test_github_client.py` (oversize and redirect tests assert `retryable is False`).

Results: the strict xfail count is zero. The final suite is 1058 passed, 0 failed, 0 skipped, 0 xfailed. Verified over the production STDIO command: `COMPLETE` with `RESULT_LIMIT_REACHED` and one evidence item.

### 42.5 Native Spec regularization
**requirements.md.** One line changed: the stale status line 17 ("draft for human review… pending approval") was replaced with the approval basis (OD-16 for 2, 3, 14; scoped approval for Requirement 4 items cited by Tasks 7.1 and 7.3; other requirements derived from approved Spec 1 v2.4). Requirement text is not changed. Verification: restoring the old line in memory reproduces `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7` exactly. The change is proven and reversible.
- Final SHA256: `FB04C9E2A3A7B0CF9B6E6D0359A6EA8BE24AC695CEE7A66178B57C31D9FCD8B4`.

**design.md (D3 resolved).** The records describe three design statements changed under owner instruction (E-D13 addendum section 5.1, E-D13 record section 9):
- D1: explanation bullet 2 (optional AI deferred; provider and model approved; deterministic explanation authoritative). Current text matches the addendum's proposed wording, with the later deferral decision incorporated.
- D2: the citation in the same bullet, `Architecture §5` → `Architecture §2.7 and §7`. The addendum verified that §5 is "High-Level Architecture", and the rule is in §2.7 and §7. **D2 is the change previously reported as the unexplained third change (D3).**
- D3: E-D13 row (line 567): deferral and open items. Current text carries the owner's 2026-11-10 deferral decision, which is a later variant of the addendum proposal.
- Provenance: addendum section 5.1 (proposal) and E-D13 record section 9 (applied under owner instruction). E-D15 (line 570) was not changed, because its addendum amendment (D4) was conditional and AI-6 is not approved.
- Limit of proof: the OD-16 text (`EBDB3BFD…`) is not retained. The addendum records only summaries of the prior text of D1 and D2, not verbatim copies. The OD-16 hash cannot be reconstructed, so the current file is **not** claimed to be equivalent to it. It is accepted as the implementation baseline by owner regularization.
- Final SHA256: `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`.

**tasks.md.**
- T1 (Task 14 header: deferral, 2026-11-10 owner decision). Retained. Changes status only. Task 14 was not started, so no behavior changes.
- T2 (subtask 14.1: deferral and reconsideration conditions). Retained. Status and dependency wording only.
- T3 (header "NOT APPROVED. No task may start."). Replaced by a status note that records this instruction. Governance only. Retained.
- T4 (intro sentence "every checkbox is pending"). Replaced by "Checkbox state is not a status record. Status is recorded in phase-status." Editorial. Checkboxes are unchanged. Retained.
- Limit of proof: as for design.md, the OD-16 text (`B286FD21…`) is not retained. The file is accepted as the Native Spec task baseline by owner regularization. It is not claimed to be equivalent to OD-16.
- Final SHA256: `2F30F345B7CA75E997C694D8C4C96CBF19B56EEC75C036BFE4B27B4B54CDB092`.

### 42.6 Increment acceptance (owner)
- **I2: ACCEPTED.** Scoped approval for 7.1 and 7.3 (9.2); 7.2 by separate owner authorization (15).
- **I3: ACCEPTED.** Implementation directive (25). OD-5 values approved (42.3). SHA-256 end-to-end Git integration deferred, not claimed.
- **I4: ACCEPTED.** OD-7, OD-8 (`retryable` verified by tests), OD-14 recorded. Live rate-limit header semantics not claimed.
- **I5: ACCEPTED.** Task 8 authorized under sections 28 and 30. Tasks 8.1 to 8.3, 11, 12, 13 implemented and tested. Cache, AI, and PR/Issue association deferred. Property and golden tests assigned to Phase 4.
- **I6: ACCEPTED**, after the result-limit remediation and its verification (42.4).

### 42.7 Verification (clean Python 3.14.10 environment)
- Interpreter: `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`, `sys.version` = `3.14.10 (tags/v3.14.10:b703b2c, Oct 25 2026, 17:36:52) [MSC v.1944 64 bit (AMD64)]`.
- Clean venv: `C:\Users\User\AppData\Local\Temp\sean-3140-e3be415f`, built from `backend/requirements-dev.txt`. pip 26.2.2.
- Command: `pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`. Result: **1058 passed, 0 failed, 0 skipped, 0 xfailed** (298.59 s), exit 0.
- `pip check`: "No broken requirements found." Exit 0.
- Imports with warnings as errors (`app.main`, `app.api.app`, `app.modules.mcp.server`, `app.modules.mcp.__main__`): `IMPORT_OK`, exit 0.
- HTTP: 11 real-process end-to-end tests and the ASGI tests, all in the suite and passing.
- MCP STDIO, production launch shape (`backend\.venv\Scripts\python.exe -P -m app.modules.mcp`, Python 3.14.10): server `sean` 0.1.0; four tools; `COMPLETE` with `RESULT_LIMIT_REACHED`; `INVALID_INPUT` for traversal; `field: line_end` for span 501; `GITHUB_IDENTITY_UNRESOLVED` for a repository without identity; exit 0 after stdin closes; stderr empty; no listening sockets; repository unchanged; no git process left.
- Leak checks: the suite log contains no fake token value and no repository path. The probe output contains no repository path, no `C:\Users` path, and no token string.
- `mcp.json`: unchanged. SHA256 `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`. No activation was performed.
- Protected documents: unchanged by this pass (42.9).

### 42.8 Deferred work and residual risks
Deferred, not implemented, and not claimed:
- R5 to R8, D1, D2, R17 (cache size). Task 10 cache. Task 14 AI and Gemini. PR/Issue association (G-M).
- R10 total GitHub request deadline. Accepted residual: a slow provider can hold a request across several per-operation timeouts.
- Property-based testing (Hypothesis, MCP-10). Golden repository tests (Tasks 18 and 19). Cross-repository portability. Language-specific semantic-analysis limits.
- SHA-256 end-to-end Git repository integration. The data model accepts 64-character names. No integration claim is made.
- Kiro client activation and `mcp.json` enablement (MCP-18, C-D7). Separate operational gate, not performed.

Residual technical risks:
- R14 rate-limit semantics. The client detects `X-RateLimit-Remaining: 0`, a 403 with that header, and HTTP 429, and stops for the rest of the client instance. It does not parse `X-RateLimit-Reset`. Live header semantics were not verified beyond one read-only request.
- A failed single-record MCP call has `error`, `message`, and `retryable`, with no `retrieval_status` field. This follows the FR-08 reading recorded in closure section 15.11. D02 §16.5 proposes the field and is not binding.
- A generic `GITHUB_UNAVAILABLE` (network failure, timeout) stays retryable. Only redirects and oversize bodies are non-retryable.
- `design.md` line 570 (E-D15) does not name `SEAN_GITHUB_TOKEN`. Traceability only. The name is recorded here.
- `requirements.md` Requirement 13.7 still says "during Phase 2". Its requirement text is unchanged. Recorded as a traceability note.

### 42.9 Protected documents and Git state
- Protected documents verified unchanged by SHA256 in this pass: architecture `3AB618886BBE…`, Spec 1 `71FEF399A02C…`, Spec 2 `EF7971157A0C…`, D01 `053E3E373EA2…`, D02 `65B0C43B9E29…`, D03 `12AA12BC302F…`, `mcp.json` `02FB9811E5ED…`.
- Git: `git status` lists the tracked modifications `backend/app/main.py`, architecture, D01, D02, and Spec 1 relative to HEAD `6e6c343`. Those modifications predate this pass, and this pass did not make them. The protected documents' hashes match the recorded values.

### 42.10 Hashes of files changed or finalized in this pass
Code:
- `backend/app/modules/github/client.py`: `3C7DD7A295C2A5AC743242E81AEE7887091B7F3A6DFFC85C1FB1B7B7055B7170`
- `backend/app/modules/mcp/tools.py`: `EF4F7857271F603446588413869A634AAAB659550E33760F3AC423EC51C87D95`
- `backend/app/core/limits.py` (comments only): `FD569D5AD8F5DE32BDB5B547E458437CCF5108CB18B1781942207476D3A92019`

Tests:
- `backend/tests/unit/test_github_client.py`: `D8A62CDAE13222DB6F48045ECF011281B6A7307E90BE0FCC9FE8737E1F51ECAF`
- `backend/tests/unit/test_mcp_tools.py`: `74670BB574631C0B904A3D53D89CA458CF00CD6971F0077A0E24067E808D801C`
- `backend/tests/unit/test_mcp_contract.py`: `605C4335187774A5AE145D3D8329AFC2C425C501E80AE4B10076AD9EBF58683F`

Native Specs (final):
- `.kiro/specs/evidence-retrieval/requirements.md`: `FB04C9E2A3A7B0CF9B6E6D0359A6EA8BE24AC695CEE7A66178B57C31D9FCD8B4`
- `.kiro/specs/evidence-retrieval/design.md`: `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`
- `.kiro/specs/evidence-retrieval/tasks.md`: `2F30F345B7CA75E997C694D8C4C96CBF19B56EEC75C036BFE4B27B4B54CDB092`

Records:
- `docs/development/phase-3-closure-report.md` (section 18): `021E29530E156A51AB6293362249ED2E833FCF8FD9192067128B4ABD24BBFE79`
- `docs/development/phase-3-owner-acceptance-record.md` (final): `D9709814C0EB4216AA80782B2A937DF302FBA089D5C427BD5AF3A35AEBAEC22A`
- `docs/development/i3-i4-owner-decision-package.md` (Part 16 appended): `0E743BFC64715F7A68EE07528A09CDE7FC0B5A55E4C5DB6857302E9A0D01B288`

Unchanged in this pass, verified: `backend/app/core/git_runner.py` `7FFA8461DEB652230BEDD234BC4F975F28DF9FDE09D73D8A6D61B829360DA1D3`; `backend/requirements.txt` `3C7634A97EB1A70CE84E4836060C8A85CAD9184B9E4A7B209AC879DDFC50BA57`; `backend/requirements-dev.txt` `8C2D32DB3096911EBCAC0D8AF0FD9DAE6A6A19810A20FA8DD2C65EFBB5061298`.

### 42.11 Phase status
- Phase 3 — MVP Implementation: **CLOSED** (2026-11-12, owner instruction).
- Phase 4 — Testing, Security and Verification: **READY TO START**. Not active. Phase 4 starts as a separate project phase, under the handoff scope recorded in the closure report.
- Phase 5 — NOT_STARTED.

### 42.12 Note on this file
This file cannot record its own hash. The phase-status hash is reported in the session report.

## 43. R14 final alignment (2026-11-12)

### 43.1 Owner decision
For the MVP, once GitHub rate limiting is detected, the client stops making further requests for the lifetime of that client instance. Automatic resumption based on the provider's reset header is not required. This clarifies the R14 approval in section 42.3. It does not reopen I2 to I6, and the Phase 3 closure in section 42 is unchanged.

### 43.2 Consistency across the record
- **Decision record:** `docs/development/i3-i4-owner-decision-package.md` Part 16.1 records the behavior, the limitation, and the superseded wording. Earlier R14 rows (Part 3 and Part 10.1) are kept as history.
- **Implementation:** no behavior change. The reset header was never parsed, and no resumption code exists. `backend/app/modules/github/client.py` now documents this accurately, in its module docstring and at the exhaustion flag. The rate-limit detection rules are unchanged: HTTP 429, 403 with `X-RateLimit-Remaining: 0`, and a successful response with `X-RateLimit-Remaining: 0`.
- **Tests:** `backend/tests/unit/test_github_client.py` adds three tests. A successful response with an exhausted header blocks the next request on the same instance, with no network call. A new instance is not blocked. An ordinary 503 is retryable and does not set the rate-limit state. The existing 403 test now describes instance lifetime. The unreachable-host test asserts `retryable is True`.
- **Closure documentation:** `docs/development/phase-3-closure-report.md` section 18.8, and the R14 rows in sections 18.3 and 18.6. Section 18.6 already states that the client does not parse the reset header and does not resume.

### 43.3 Documentation corrections in this pass
- Client module docstring: "No further request is made while the client is exhausted" → the instance-lifetime wording above.
- Client exhaustion flag: comment added.
- Rate-limit test docstring: "for this investigation" → "for the lifetime of this client instance".
- Decision package Part 16.1: records the MCP per-call instance (`tools.py` `_github_record`) rather than per investigation. Investigations do not call GitHub yet.

### 43.4 Verification
- Focused: `pytest tests/unit/test_github_client.py -q -rfxXs --tb=short -p no:cacheprovider`, clean Python 3.14.10 venv `sean-3140-e3be415f`. Result: **40 passed**.
- Complete suite, same command and environment: **1061 passed, 0 failed, 0 skipped, 0 xfailed** (522.77 s), exit 0.
- `pip check`: "No broken requirements found." Warnings-as-errors imports: `IMPORT_OK`.
- Ordinary network failures keep their retryability: `GITHUB_UNAVAILABLE` from a network failure has `retryable` true (test `test_unreachable_host_is_reported_as_unavailable`), and from a 503 (test `test_ordinary_unavailable_is_retryable_and_does_not_block_later_requests`). The MCP-level default for `GITHUB_UNAVAILABLE` is still retryable (test `test_github_unavailable_is_structured_and_retryable`).

### 43.5 Status
- Phase 3 — MVP Implementation: **CLOSED** (unchanged).
- Phase 4 — Testing, Security and Verification: **READY TO START** (unchanged, not active).
- I2, I3, I4, I5, I6: ACCEPTED (unchanged).

### 43.6 Limitation carried forward
An investigation or MCP call that is rate-limited is not retried later. Its result reports the limitation. Live provider header semantics remain unverified beyond one read-only request. Both are accepted for the MVP by the owner decision above.

### 43.7 Hashes of files changed in this pass
- `backend/app/modules/github/client.py`: `64058481FA4B7C2A3A2C8D2862E73E0423853517FDFB7BBF7DE4BB390CDA65BE`
- `backend/tests/unit/test_github_client.py`: `AAA89F38155025461764FE93575737AB1F942871C1F5015FCAD6414D3BC13002`
- `docs/development/i3-i4-owner-decision-package.md` (Part 16.1): `79CD66CF052425C20AC514903A4087726A8765BEDE82BD82422BB265207753B9`
- `docs/development/phase-3-closure-report.md` (section 18.8): `9F76C1FD4B15CDC0EF1F7AF7DC30CC22AB9A691B12C21C138A7BF469237083E5`

Unchanged in this pass: `backend/app/modules/mcp/tools.py` `EF4F7857271F603446588413869A634AAAB659550E33760F3AC423EC51C87D95`. Approved product specifications, the native specs, `mcp.json`, and the other protected documents were not modified.

### 43.8 Note on this file
This file cannot record its own hash. The phase-status hash is reported in the session report.

## Phase 4 - Frontend and Immersive Experience (2026-11-12)

### P4.1 Status
IMPLEMENTED and VERIFIED by executed tests. Acceptance is the owner's decision. Phase 3 remains CLOSED.

### P4.2 Executed verification
- Vitest: 9 files, 272 tests passed (validator, state machine, form, client, game engine with a 400-seed completability sweep, audio controller lifecycle, palette contrast and CSS motion rules, full-journey component tests).
- Playwright (Edge, real backend, disposable repositories): 13 passed. Covered: complete journey with the game played to the exit by keyboard, skip paths, refresh restore, partial, insufficient, failed, rejected, ambiguous, invalid input, keyboard-only form, cancel, 390 px and 1280 px layout, reduced motion.
- TypeScript typecheck clean. Production build OK. `npm audit --omit=dev`: 0 vulnerabilities.
- Backend suite re-run after Phase 4 (backend\.venv): 1061 passed. SHA256 of all 71 protected Phase 3 files matched the baseline captured before Phase 4 began.

### P4.3 Dependencies
Only `jsdom` ~29.1.1 was added to the D01 set, for Vitest component tests (MIT, maintained, pure JavaScript, works on Windows, no cost). jsdom 31 was rejected because it needs Node 24.15 or later and 24.13.0 is installed. No testing-library, animation, or audio packages.

### P4.4 Known limitations
- Sound is Web Audio synthesis, verified only against a fake audio context. No person has heard it.
- Horror quality is subjective and was reviewed only through screenshots.
- Browser testing covers Microsoft Edge only.
- The backend does not echo the question, so the frontend keeps it client-side. There is no repository listing endpoint, so the ID is typed.
- The Kiro MCP client configuration was not touched or tested in this phase.
- No security-auditor pass has been run on the Phase 4 frontend.

## Phase 4 Master Directive (2026-11-12): stages 1 and 2

Owner choices: leave Spec 1 and Spec 2 untouched and record departures in Spec 4; additive read-only backend modules only; Gemini optional behind `SEAN_GEMINI_API_KEY`; remove the 2D game; stage order fixed. Phase 4 is not ACCEPTED. Phase 3 remains CLOSED.

### Stage 1: plan and specs. IMPLEMENTED
- `docs/specs/spec-4-engineering-intelligence.md` (SEAN-SPEC-04 v1.0) with departures X-1 to X-6 from Spec 2 and Spec 3.
- `.kiro/specs/engineering-intelligence/{requirements,design,tasks}.md`.
- Kiro capability catalog verified against kiro.dev documentation on 2026-11-12 (formats, paths, scopes).

### Stage 2: backend profile and Advisor. VERIFIED by executed tests
- New files only: `app/modules/repository_profile/`, `app/modules/advisor/`, `app/modules/intent/`, `app/api/advisor_routes.py`, `app/api/local_guard.py`, `app/main_advisor.py`. Start with `uvicorn app.main_advisor:app`.
- Endpoints: `GET /repositories`, `POST /repositories/{id}/profile`, `POST /interpret`. `POST /artifacts/preview` belongs to stage 4.
- Executed: 184 new tests passed. Full backend suite: 1245 passed (1061 Phase 3 + 184). SHA256 of all 71 protected Phase 3 files matched the baseline. Mutation check: changing two Advisor thresholds made the boundary tests fail.
- Live check against the running backend and the Vite proxy: profile of the registered `sean` repository returned 200 and was byte-identical through the proxy; `/interpret` and the Phase 3 `/investigations` route worked through the proxy.
- Result on the real `sean` repository: 1 `CONSIDER` (sub-agents), 8 `NOT_RECOMMENDED` (Steering, Specs, Hooks, MCP, Custom agents, Skills, Kiroignore, Permissions, because the repository already uses Kiro or shows no signal), 6 `INSUFFICIENT_EVIDENCE` (bugfix specs: only 4 commits; powers, ACP, checkpoints, compaction, chat/IDE/CLI: not decidable from a repository).
- Independent security review (security-auditor, read-only): 0 HIGH, 4 MEDIUM, 6 LOW, 5 INFO. Fixed in new files: Gemini payload no longer carries repository IDs (M1); Host and Origin guard, concurrency cap and per-HEAD cache (M2); incomplete scans can no longer support a confident negative (M3); redirect refusal, wider error handling, key stripping before redaction, bounded echoed strings, quoted-path handling, longer secret-name list, dead code removed (L1 to L5, I2, I4, I5); weak tests replaced and missing tests added (symlink entry, hostile repository config, transport behavior).
- Open for the owner: M4. The closed Phase 3 Git runner does not disable Git lazy fetching. Register only trusted repositories until the owner decides whether to authorize a change to that file.
- Known limits: the Gemini adapter has not called the live service (needs the owner's go-ahead and `SEAN_GEMINI_API_KEY`); the model and request shape are unverified live. Because paths are never sent, the hint can rarely add information beyond the parser. Pull requests, issues and CI results are not analyzed. Only committed content is seen.
- Operational note: the running backend uses the registry at `...\Temp\sean-i6-runtime\localappdata\Sean\config\repositories.json` (set through `LOCALAPPDATA` in its start command). The frontend dev server proxies `/api` to it.

### Stage 3: product UI, sidebar and report persistence. VERIFIED by executed tests
- New shell (`src/app/App.tsx`): collapsible sidebar (New Investigation, Recent Investigations, Saved Reports, Repositories, Settings), one natural-language request field, repository context, "Advanced target" for the structured fields, progress with "Stop waiting", and a unified report (overview, engineering history, technical findings, Kiro Repository Advisor, roadmap, evidence and transparency).
- Independent state: `analysisMachine` and `useAnalysis` own the requests (interpret, then investigation and profile together). A failed Advisor does not discard the investigation, and the reverse. Snapshots (`reportSnapshot.ts`) are frozen, revalidated when read, and stored in IndexedDB (`reportStore.ts`, newest 50, invalid records deleted). Storage failure is reported and the report stays on screen.
- Every new response is validated before display (`validateAdvisor.ts`), including that each recommendation's evidence exists in the profile and that no classification claims more than the evidence.
- Fixed during testing: a candidate chosen immediately after a rejected request was ignored because the profile request still held the slot. The rejected request now aborts the other one and frees the slot (regression test in `useAnalysis.test.tsx`).
- Executed: TypeScript clean. Vitest 13 files, 406 tests passed. Playwright (Edge, real backend, real IndexedDB) 16 passed, covering the natural-language flow, repository-specific Advisor output (the `rich` fixture repository gets 4 adopt-now items, `sample` gets none), save and reopen after reload, file and definition choices, insufficient, failed and unregistered cases, cancel, keyboard-only use, 1280 px and 390 px layouts, reduced motion, and the backend's refusal of foreign Origin and Host headers.
- Visual review: 19 real browser screenshots were inspected. Fixed: menu button visible on desktop, missing list bullets, misaligned roadmap cards, duplicate badge on not-assessable items.
- Dependency added: `fake-indexeddb` 6.2.8, dev only, exact pin (Apache-2.0, no dependencies, maintained, used only to test IndexedDB logic; `npm audit` 0 vulnerabilities).
- Removed as superseded: `InvestigationView`, `TwoZoneLayout`, `EvidencePanel`, `EvidenceCard`, `ErrorPanel`, `InvestigationProgress`, `InvestigationForm`, `sessionStore`, `useExperience`, and the old journey tests.
- Departure from Spec 2 (recorded as X-1 and X-2 in Spec 4): the ordinary view no longer shows a resting Ouija board. The Ouija components (`OuijaScene`, `HorrorTransition`, `StatusStrip`, `Planchette`), `experienceMachine`, the audio controller and the 2D game are kept in the tree but are NOT mounted. Until stage 5 the report appears directly after the analysis. Stage 5 rewires the interlude, stage 6 replaces the 2D game, stage 7 adds the audio settings.
- Settings shown now: motion and deleting saved reports. Audio, horror intensity, jumpscare, skip-gameplay and graphics controls appear in the stage in which they take effect, so no control is decorative.
- Known limits: the report layout was reviewed in Edge only; the Ouija and the game are intentionally absent until their stages.

### Security review follow-up (2026-11-13): M1 to M4 resolved
- **M1 (free-tier privacy).** Repository IDs were already removed from the payload. Added per-request consent: `allow_ai` (strict boolean, default false) on `/interpret`; `GET /capabilities`; an unchecked, explained checkbox in the interface that resets after each request. Tests: no provider call without consent, consent must be a real boolean, the outgoing payload contains no repository identifiers or paths, capabilities never contain a secret, the checkbox is absent when no provider exists and sends consent for one request only.
- **M2 (local access).** Host and Origin guard, concurrency cap and per-HEAD cache were done earlier. Added a 15 second total deadline for the provider exchange (reads in non-blocking chunks), tested against a server that trickles its reply.
- **M3 (absence reported as proof).** Done earlier: every limit hit, unreadable history or skipped manifest makes recommendations `PARTIAL_EVIDENCE` with `LOW` confidence.
- **M4 (Git lazy fetch).** Reproduced first: with a partial clone whose config names an upload-pack command, `git cat-file` ran the command. Fixed in the Phase 3 runner by owner authorization: `GIT_NO_LAZY_FETCH=1` and `-c protocol.allow=never`. This is the only Phase 3 file changed. New SHA256 of `backend/app/core/git_runner.py`: `C510CAD60CD6B86F12D45EA101A4E8FFD87C2FD89D86545B5B8DE87BA3580948`. The other 70 protected files still match. Tests: 4 new (fixture proves unprotected Git does run the command; the runner does not; the scanner reports the gap; the protections are in the contract). Mutation check: either protection alone blocks the fetch, and removing both fails the tests.
- Executed: backend 1254 passed. Frontend: TypeScript clean, 412 unit tests passed.
- Live Gemini call: authorized by the owner on 2026-11-13. NOT yet performed: the key is not visible to processes started by Kiro (not set at user or machine level, and not in the Kiro process environment), so the running backend reports the AI interpreter as unavailable.

### Gemini timeout investigation (2026-11-13)
- **Connectivity (measured, no key used).** DNS 0.02 s, TCP 0.05 s, TLS 0.05 s, unauthenticated HTTPS request HTTP 403 in 0.18 s, from the backend's Python 3.14.10. No proxy configured. Connectivity is not the cause.
- **Timeouts in use.** Backend `TIMEOUT_SECONDS = 10` per socket operation, `TOTAL_DEADLINE_SECONDS = 15` checked between reads. The diagnostic uses the value given by `--timeout` (default 60 s), for both limits.
- **Root cause, as found in code.** The client's reads waited for 8192 bytes instead of returning on the first bytes, so the total deadline could not stop a slow reply. Fixed by `read1`. The 10 s per-operation limit is still the likely reason a reasoning model that is silent before its first byte times out. That is measured by the 60 s diagnostic run, not assumed.
- **Silent fallback removed.** Every failed attempt now returns a status (`AI_TIMEOUT`, `AI_HTTP_ERROR`, `AI_CONNECTION_FAILED`, `AI_PROTOCOL_ERROR`, `AI_RESPONSE_TOO_LARGE`, `AI_INVALID_REPLY`, `AI_UNEXPECTED`, `AI_NO_USABLE_ANSWER`), returned in `/interpret` as `ai_status`, logged with stage, HTTP status and elapsed time, and never with the key, the sentence, or the reply. The deterministic answer is still produced.
- **Failure stage.** Each timeout records where it happened: `BEFORE_HEADERS`, `READING_BODY`, or `DEADLINE`. On this machine a refused localhost connection surfaces as a connect timeout, so `BEFORE_HEADERS` is reported for both.
- **Frontend.** The validator requires `ai_status`. The transparency section shows the AI reader's status in plain words. Fixtures were recaptured from the real backend.
- **Tests.** Backend full suite 1274 passed. Frontend 414 unit tests passed, type-check clean. New tests cover each failure category against a local server, the redaction of the key in diagnostics, log contents, the timeout argument, and the status in the response.
- **Pending.** The live result with the owner's key, run by `scripts/diagnose_gemini.py --timeout 60`, decides whether the per-operation timeout must change. Gemini is not declared operational until HTTP 200 is parsed and the result reaches the frontend.


## Stages 4 to 8 (2026-11-13)

Status of the work: IMPLEMENTED and VERIFIED by executed tests (results below). Phase 4 is not ACCEPTED; that needs the owner.

### Results observed in this session
| Check | Result |
|---|---|
| Backend full suite | 1349 passed (9 min 50 s) |
| Frontend type check (`tsc --noEmit`) | clean |
| Vitest | 15 files, 449 tests passed |
| Playwright (Edge, real backend, real WebGL) | 33 tests; the full run passed 32 and the one failure was the timing-sensitive full-escape test hitting its time limit under load. After a longer limit and a shorter wait, `e2e/game.spec.ts` passed 10 of 10, and `e2e/screenshots.spec.ts` passed 2 of 2 |
| Phase 3 hash baseline | 71 entries; only `backend/app/core/git_runner.py` differs (owner-authorized, finding M4) |
| `npm audit` | 0 vulnerabilities |

The full escape test plays the game with real key presses and retries after capture; it passed on a later run in one to a few attempts. It can still fail on a slow machine. Treat it as the least stable test.

### Stage 4: artifacts
`POST /artifacts/preview`, ArtifactPanel, lifecycle RECOMMENDED -> PREPARED -> EXPORTED -> VERIFIED (a committed file is byte-identical). Download and copy only; Sean never writes to a repository. Browser test downloads `project-conventions.md` and checks it against the committed tree.

### Stage 5: Ouija
Full-screen interlude after a successful, saved, eligible analysis. Never for failed, cancelled, insufficient, saved or disabled cases. Question shown as text. Skip button and Escape. Static board with reduced motion.

### Stage 6: game
Three.js 0.187.0 (D04). One hand-authored archive level, flashlight, noise, a threat with six states, clues taken from the report's own findings, retry, give up, pause, fullscreen, graphics quality, intensity and scare settings. 2D game removed.

### Stage 7: sound
Procedural Web Audio with ambient and effects buses, positioned creature sounds, tension swell, gesture-gated start, mute and three volume controls, full release on exit. Manifest in `docs/development/audio-asset-manifest.md`.

### Stage 8: reviews and fixes
security-auditor (0 high, 1 medium, 10 low) and code-reviewer (2 high, 9 medium, many low) ran independently. Fixed with regression tests: repository text in generated files (M1), path regex newline (L1), secret text sent to the browser (L4), YAML quoting (L5), capability length (L6), artifact record races and limits (L7, L8), double enable of sound (L9), partial renderer construction (L10), camera field of view after a catch (H1), the interlude holding the screen after the user moved on (H2), focus after the interlude (M2), the lose-the-trail timer (M3), keys blocked in the pause menu (M4), flashlight shader recompiles (M6), dead audio cues (M8), game failure shown to the user (M9), and smaller items.
Not fixed, recorded in Spec 4 section 14 and 15: variable time step (departure), the 20 000-path limit for "file exists" (L2), the HEAD race between scan and lookup (L3, cosmetic), a shallow freeze of the snapshot (the game code never mutates it; no deep freeze), per-frame data attributes used by browser tests (M7), duplicated literal types.

### Limits
Edge only. Gemini was not reachable (HTTP 503 from the provider); the deterministic reader is the tested path. Pull requests, issues and CI are not analysed. Only locally registered, committed content is read. Gameplay feel and sound quality were judged only through screenshots and graph tests.
