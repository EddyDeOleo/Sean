# Sean Phase Status and Increment I0 Report

Recorded: 2026-11-10. This file is a status record. It is not an approved document and it amends no approved document.

Current AI provider: **Groq** (`openai/gpt-oss-20b`, key in `SEAN_GROQ_API_KEY`). See sections 45 and 46. Every Gemini statement in this file and in the earlier decision records is historical and superseded by section 46.

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


## Owner decisions of 2026-11-13 (stage 9)

Status: IMPLEMENTED and VERIFIED by the executed tests below. Phase 4 is not ACCEPTED. Item 5 of the owner's numbered list was not supplied, and no requirement was invented for it.

| Check | Result |
|---|---|
| Backend full suite | 1463 passed (12 min 57 s) |
| Type check (`tsc --noEmit`, includes the browser tests) | clean |
| Vitest | 21 files, 590 tests passed (with `--maxWorkers=3`; on a busy machine the default worker count can fail to start workers, which is not a test failure) |
| Playwright, Edge, real WebGL, real backend | 51 passed (10.7 min): journeys, game (10), horror and independence (10), repositories (8), screenshots |
| Audio measurements in Edge (`playwright.audio.config.ts`) | 47 passed; table and WAV files in `%TEMP%\sean-audio` |
| Phase 3 hash baseline | 71 entries; 3 differ, all owner-authorized: `core/git_runner.py` (M4, earlier), `api/app.py` and `modules/repository/registry.py` (repository management, Spec 4 section 16) |

What was done: creature model and rules, jumpscare and scream, wooden Ouija sound, presence sounds, the game as its own experience (Play button, failure notices, play while waiting), repository management on the existing Repositories page. Spec 4 sections 16 and 17 describe the behavior and record departures X-7 and X-8.

Balance (80 games per row, a scripted player on the real rules): careful player escapes in 57, 47, 43 of 80 on low, normal, high; reckless sprinter in 36, 20, 4. Written by `tests/gameBalance.test.ts`.

Review: security-auditor and code-reviewer ran again on this work. Fixed with tests: a hiding mechanic that never caught anyone, every locker now takes its turn, a look-around that was cancelled, a flicker above three changes a second (now 2.5 at most, and none with the scare setting off), settings that were disabled for people who press Play, a stale game note, focus on the Repositories page, a window blur that did not pause, a half-built renderer that leaked its WebGL context, stale list after concurrent changes (reload now runs under the write lock), a missing application header on registry changes. One reported "lost registration" was a test that gave up while the server answered busy; the test now fails if any worker gives up. Not fixed and recorded: no cross-process lock for two backends, a `.git` redirect file is accepted, path errors tell a local caller which of a few cases applies, the MCP entry point reads the registry once.

Limits: Edge only. Sound and scare quality were measured and looked at in screenshots, not listened to or felt. Gemini still unreachable at the last attempt. The old backend on port 8000 must be restarted to get the new routes.

## 44. Checkbox convention and task-status audit (2026-11-13)

Scope: the `tasks.md` files of evidence-retrieval, ouija-experience, immersive-experience, and engineering-intelligence. Application code, approved documents, and Native Spec requirements and designs were not changed.

Convention, now in the Notes section of each file: `[x]` means the task is completed and its acceptance criteria are satisfied. Its status in this file is VERIFIED or ACCEPTED. `[ ]` means not yet completed. A checkbox does not show which of VERIFIED or ACCEPTED applies. This file is the authoritative status record. A parent task is checked only when all of its subtasks are checked. The earlier statements that checkboxes are not a status indicator were removed.

Result: Evidence 55 of 75 checked. Ouija 1 of 60 checked. Immersive 11 of 39 checked. Engineering Intelligence 21 of 21 checked (existing checks preserved as instructed).

### 44.1 Evidence Retrieval (55 checked, 20 open)

Checked, with the basis:
- Task 0: VERIFIED (4.1).
- Tasks 1.1 to 1.3: ACCEPTED in I1 (7.1).
- Tasks 2.1 to 2.4, 3.1 to 3.4, 4.1 to 4.2, 5.1 to 5.4, 6.1 to 6.3, 9.1 to 9.3: ACCEPTED in I3 and I4 (42.6). Parameters are the OD-5 values approved in 42.3. Task 2.4 (security review) is covered by the I3 acceptance, and its findings were fixed (section 25). Task 3 is accepted with SHA-256 end-to-end Git integration deferred (42.6). That deferral is not part of the checked claim.
- Tasks 7.1 to 7.3: ACCEPTED in I2 (42.6). Task 7.2 was accepted under a separate owner authorization (section 15).
- Tasks 8.1 to 8.3, 11.1 to 11.2, 12.1 to 12.3, 13.1 to 13.2: ACCEPTED in I5 (42.6).
- Tasks 15.1 (VERIFIED, 4.3) and 15.2 (ACCEPTED in I6, 42.6).
- Tasks 17.1 to 17.3: ACCEPTED in I6 (42.6). Task 17.3 is verified at STDIO handshake level.

Open, with the reason:
- Task 10 (SQLite cache, 10.1 to 10.2): deferred (42.8).
- Task 14 (optional AI wording, 14.1 to 14.2): deferred by owner decision of 2026-11-10 (section 34 and 36).
- Task 16.1 (configuration and numeric limits): the limit values were approved (42.3), but the environment and configuration-file loader does not exist. Section 37 and the Phase 3 closure record say the same (section 30 entry for 16.1, "no environment or configuration-file loader exists").
- Task 16.2 (diagnostics and redaction): IMPLEMENTED and unit-verified (section 28). No accepted increment covers it, so no owner acceptance is recorded.
- Task 17.4 (MCP-01 to MCP-18 tool-level tests): not complete. Section 32.6 lists MCP-03, MCP-05, MCP-08, and MCP-10 as not covered or not executed. MCP-18 (Kiro runtime) is not run.
- Task 17.5 (`mcp.json` validation and enablement): not done as a configuration change. Enablement waits for decision C-D7 (section 31 and 42.8).
- Task 17 (parent): open because of 17.4 and 17.5.
- Task 18 (Golden test suite, 18.1 to 18.3) and task 19 (acceptance and report, 19.1 to 19.3): deferred (42.8). Task 19.3 is a process rule and is not a completion item. It stays open.

### 44.2 Ouija Experience (1 checked, 59 open)

- Task 0 (frontend gate check): VERIFIED (4.2). Checked.
- Tasks 1 to 14: `phase-status.md` records no status for them. The Phase 4 frontend (Immersive spec) implements related behavior, but no mapping from those tasks to that work is recorded. They stay unchecked until the owner decides how they map.
- Discrepancy, not changed: the header still reads "Status: NOT APPROVED. No task may start." That conflicts with task 0 being VERIFIED. The approval status is an owner decision, so it needs the owner's update.

### 44.3 Immersive Experience (11 checked, 28 open)

Checked, with the basis:
- Task 1 and 1.1: the scaffold is in `frontend/package.json`. Vitest and Playwright were executed (stage 9: 590 Vitest tests, 51 Playwright tests).
- Task 1.2: the advisory re-check and the jsdom reason are recorded (P4.3; `npm audit` 0 vulnerabilities).
- Task 2.1: types in `frontend/src/types/contract.ts`. TypeScript is clean, and the fixtures come from the real backend.
- Task 2.3: `frontend/src/services/investigationClient.ts`, tested through the executed suites.
- Task 3 and 3.1: fixture generator at `scripts/capture_frontend_fixtures.py`, with fixtures recaptured from the real backend (stage 2).
- Task 5.1: `frontend/src/features/audio/AudioController.ts` with procedural synthesis and dispose. Stage 7 audio measured in Edge (47 tests).
- Task 11.2: Playwright real-backend journey, keyboard-only use, and 390 px and 1280 px layouts (stage 9, 51 passed).
- Task 11.3: the test execution and observed results are recorded (stage 9 table in phase-status).
- Task 12.2: Phase 4 sections in this file, and the Phase 3 hash baseline (71 entries; three differ, each owner-authorized).

Open, with the reason. Several tasks name modules that a later stage removed or renamed. The grep check found none of these names in `frontend/src`:
- Task 2.2 (`deriveUiState`): no function with that name. The analysis state machine does not provide it.
- Tasks 4.1 to 4.3 (`experienceMachine`, `useExperience`, `sessionStore`): removed in stage 3. `settingsStore.ts` exists, but `sessionStore` does not, so 4.3 is incomplete.
- Task 5.2 (`AudioProvider`): no component with that name.
- Tasks 6.1 to 6.3 (escape engine, `buildClues`, generator, `canComplete`): the 2D escape game was removed in stage 6. The 3D game has different modules, and the mapping is not recorded.
- Tasks 7.1 to 7.2 (`TwoZoneLayout`, `InvestigationForm`, `InvestigationProgress`, `StatusStrip`, `EvidencePanel`, `EvidenceCard`): removed as superseded in stage 3.
- Tasks 8.1 to 8.2 (`OuijaScene`, `Planchette`): not present under those names. `OuijaBoard` exists in the interlude.
- Tasks 9.1 to 9.2 (`HorrorTransition`, `EscapeSequence`, `EscapeEnvironment`, `EvidenceClue`): not present.
- Tasks 10.1 to 10.2 (`InvestigationReport`, `ExperienceSettings`): not present. `ReportView` and the settings feature exist under other names.
- Task 11.1 (Vitest journey with fake timers): the old journey tests were removed in stage 3. Current coverage of this requirement is not recorded.
- Task 12.1 (update Spec 3 and this plan, README setup, license note): no evidence found for the Spec 3 update or a license note in the README.
- Parent tasks 2, 4 to 10, 11, and 12 stay open because of their open children.

Discrepancy, not changed: the Implementation Record (2026-11-12) says "All 12 top-level tasks were implemented." It was kept as history. The later stages (3, 5, and 6) changed the structure it describes.

### 44.4 Engineering Intelligence (21 checked, preserved)

- The 21 existing checks are unchanged, as instructed. The Notes now state the shared convention.
- Discrepancy, not changed: task 1 (plan and specs) is checked, but phase-status records stage 1 as IMPLEMENTED only, not VERIFIED or ACCEPTED. The owner should decide whether to keep or uncheck it.
- Tasks 2 to 9 are checked. Phase-status records stages 2 to 8 as VERIFIED by executed tests, and task 9 as IMPLEMENTED and VERIFIED. Acceptance of Phase 4 is pending, so no task is recorded as ACCEPTED.

### 44.5 Files changed in this audit

- `.kiro/specs/evidence-retrieval/tasks.md`: 55 checkboxes set to `[x]`. Overview, status paragraph, and Notes updated.
- `.kiro/specs/ouija-experience/tasks.md`: 1 checkbox set to `[x]`. Overview and Notes updated. The "NOT APPROVED" header is unchanged (see 44.2).
- `.kiro/specs/immersive-experience/tasks.md`: 11 checkboxes set to `[x]`. Overview, Notes, and an audit line added. The Implementation Record is unchanged.
- `.kiro/specs/engineering-intelligence/tasks.md`: Overview and Notes updated. Checkboxes unchanged.
- `.kiro/reports/phase-status.md`: this section added. No earlier text was changed.

### 44.6 Open discrepancies for the owner

1. Engineering Intelligence task 1 is checked, but phase-status records it as IMPLEMENTED only.
2. Ouija Experience header says "NOT APPROVED. No task may start.", but its task 0 is VERIFIED.
3. Ouija Experience tasks 1 to 14 have no status record. The owner must decide whether they map to the Phase 4 frontend work.
4. The Immersive Experience tasks name modules that later stages removed or renamed. The owner must decide whether to rewrite those tasks to match the implemented structure.
5. Evidence Retrieval task 3 is checked under I3, which was accepted with SHA-256 end-to-end Git integration deferred. The owner should confirm that the checked claim is acceptable.
6. Evidence Retrieval tasks 16.1, 16.2, 17.4, and 17.5 are unchecked. Each needs a decision or a completion step before it can be checked.

## 45. Owner decision: Groq replaces Gemini as the optional request reader (recorded 2026-11-14)

Owner decision (2026-11-14): the optional AI reader for request interpretation uses Groq, not Google Gemini. The key variable is `SEAN_GROQ_API_KEY`, read from the environment or from the line of that name in `.kiro/.env`. The owner placed the key in `.kiro/.env`. No agent read that file.

What this changes in code:
- `backend/app/modules/intent/gemini.py` moved to `backend/app/modules/intent/groq.py` (`smart_relocate`, which did not update imports, so the imports were changed by text replacement). The request uses the OpenAI-compatible endpoint `https://api.groq.com/openai/v1/chat/completions`, a `Bearer` authorization header, a system message and a user message containing only the sentence, `response_format` set to `json_object`, and `temperature` 0. The reply is read from `choices[0].message.content`. Redirect refusal, deadlines, response limits, and status categories are unchanged.
- Model: `openai/gpt-oss-20b`. This is my choice from Groq's official models page (read 2026-11-14), which lists it as a production model with developer-plan limits. It is not an owner approval. Change `MODEL` in `groq.py` if you want `openai/gpt-oss-120b`.
- Labels: the interpreter value is now `groq` in the backend and the frontend. The request screen checkbox reads "Let Groq help read this request". The transparency section and the consent disclosure now state Groq's retention terms.
- Scripts: `scripts/start_backend.ps1` reads `SEAN_GROQ_API_KEY`. `scripts/diagnose_gemini.py` moved to `scripts/diagnose_groq.py`. `scripts/check_connectivity.py` checks `api.groq.com`.
- Tests: `backend/tests/unit/test_intent.py` and `test_advisor_routes.py` use the Groq reply and payload shapes. Three assertions changed to the new design: the privacy scan covers the user message only, the model is checked in the body, and the key header is `Bearer <key>`. `frontend/tests/app.test.tsx` expects the new disclosure text.

What was verified (executed):
- `backend/tests/unit/test_intent.py` and `test_advisor_routes.py`: 113 passed.
- `tsc --noEmit`: clean.
- Vitest: 589 of 590 passed, after the consent expectation was updated. One failure is below.

Not verified:
- A live Groq request. No call was made. The owner must authorize one, and then run `backend\.venv\Scripts\python.exe scripts\diagnose_groq.py`.
- Groq's free plan. The official page lists developer-plan limits for `gpt-oss-20b` (1,000 requests per minute, 250K tokens per minute). Free access and any billing requirement were not confirmed. No automatic paid fallback exists in the code.

Privacy (AI-3 remains OPEN): Groq's official data page (read 2026-11-14) says inference requests are not retained by default. Abuse and reliability logs can be kept up to 30 days, unless Zero Data Retention is turned on in the Groq account. Usage metadata is always collected and contains no customer inputs or outputs. Customer data is stored in US Google Cloud buckets. The owner must decide whether to enable ZDR, and whether AI-3 is closed for this payload.

Governance not changed: E-D13, AI-2, AI-4, Spec 4 section 8, the Gemini records in sections 34 to 36, and `design.md` still name Google Gemini. They need an owner amendment. This section is the decision record for the change.

Failures found and not fixed:
- `frontend/tests/app.test.tsx`, "renders repository text as text and links only https addresses": expects no `<img>` on the page. The sidebar logo (`Sidebar.tsx` line 53, `/sean-favicon.png`) is an `<img>`, added in the favicon change. This test predates the Groq change. It needs its query scoped to the evidence panel, or an owner decision on the test. Not changed here.

## 46. Groq migration: completion, live validation, and supersession index (2026-11-14)

Scope: finish the Gemini-to-Groq migration recorded in section 45, validate the adapter, run the diagnostic, and list every superseded Gemini record. No application behavior was changed beyond the provider. The consent gate, the deterministic fallback, and the logging rules were kept.

### 46.1 Live outcomes, with the source of each

| Check | Outcome | Basis |
|---|---|---|
| Configuration present | Yes. The backend reports the Groq interpreter as available. The key was loaded by `start_backend.ps1` and was never printed or displayed. | `GET /capabilities` on the running backend |
| Direct diagnostic, `scripts/diagnose_groq.py` | `EDGE_BLOCKED_BROWSER_SIGNATURE`: HTTP 403, body `error code: 1010`, 0.21 s, before any key check | One live request, the diagnostic's authorized run |
| Live application, consent off | `NOT_REQUESTED`, no provider call | `POST /interpret` with `allow_ai: false` |
| Live application, consent on | `AI_HTTP_ERROR` (HTTP 403, stage `BEFORE_HEADERS`, 115 ms). The deterministic answer was still returned. | `POST /interpret` with `allow_ai: true`, backend log line |
| Successful live inference | **Not achieved.** No request reached the model. | Both live checks above |

What the 1010 result means: Cloudflare error 1010 is a block based on the request's browser signature. It is issued at the edge, before the request reaches Groq. The result says nothing about whether the key is valid, and it does not show quota or billing status. The earlier run was labelled `PERMISSION_DENIED` by the first classifier. The corrected classifier labels it `EDGE_BLOCKED_BROWSER_SIGNATURE`.

Not done, on purpose: the User-Agent was not changed to get past the block. Changing a request signature to avoid a provider's filter is a circumvention of an access control, and it needs your decision (section 46.5).

### 46.2 Diagnostic labels (`scripts/diagnose_groq.py`)

The script prints one `RESULT` line with one of these labels: `CONFIGURATION_MISSING`, `SUCCESS`, `EDGE_BLOCKED_BROWSER_SIGNATURE`, `AUTHENTICATION_FAILED` (401), `PERMISSION_DENIED` and `PERMISSION_OR_QUOTA_DENIED` (403, the second when the provider message names a quota, billing, credit, or limit), `MODEL_UNAVAILABLE` (404, or 400 naming the model), `RATE_LIMITED` and `QUOTA_OR_BILLING_LIMIT` (429), `PROVIDER_UNAVAILABLE` (5xx), `TIMEOUT`, `CONNECTION_FAILED`, `PROTOCOL_ERROR`, `RESPONSE_TOO_LARGE`, `INVALID_REPLY`, and `HTTP_ERROR_<status>` for anything else. The labels are tested in `backend/tests/unit/test_diagnose_groq.py` (11 tests).

Known limit: the diagnostic prints up to 600 characters of the provider's error text, with the key removed. It is an owner-only tool and is not used by the application.

### 46.3 Adapter validation (`backend/app/modules/intent/groq.py`)

Checked against Groq's official documentation (read 2026-11-14):
- Endpoint and method: `POST https://api.groq.com/openai/v1/chat/completions`. Matches the official OpenAI-compatible route.
- Authentication: `Authorization: Bearer <key>`, sent only to the fixed host. Redirects are refused, so the header cannot be forwarded.
- Request body: `model`, `messages` (a fixed system instruction, and a user message holding only `{"sentence": ...}`), `response_format` `{"type": "json_object"}`, and `temperature` 0. JSON Object mode is supported on all models. The instruction asks for JSON, as the documentation requires.
- Response: `choices[0].message.content`, parsed as a JSON object. Anything else returns no hint.
- Deterministic validation: a hint is accepted only after the parser checks that the repository is registered and the path exists in the committed tree (`parser.py`, `_accept_hint`). Nothing the model returns is trusted.
- Deadlines and limits: 10 s per socket operation, 15 s total (checked between reads), response body limit 256 KiB. Errors are mapped to fixed categories (`TIMEOUT`, `HTTP_ERROR`, `CONNECTION_FAILED`, `PROTOCOL_ERROR`, `RESPONSE_TOO_LARGE`, `INVALID_REPLY`), and unexpected exceptions become `AI_UNEXPECTED`.
- Logging: the log line carries the status, stage, HTTP code, and elapsed time. It does not carry the key, the sentence, or the reply. The live log line shown in 46.1 confirms this.
- Known limit, unchanged from section 8: a single blocked read is bounded by the 10 s operation timeout, not by the 15 s total.

Model identifier: `MODEL` is defined once, in `groq.py`. The other references are the capabilities response (which imports it), the diagnostic (which imports it), and test fixtures.

### 46.4 Privacy and retention (Groq official documentation, read 2026-11-14)

- Inference requests are not retained by default (`console.groq.com/docs/your-data`).
- Abuse-investigation and reliability logs can contain inputs and outputs. They are kept up to 30 days, unless legally required to keep them longer. An account can opt out in Data Controls. Whether the opt-out is on for this account was **not read and not changed**.
- Usage metadata is always collected and, according to Groq, contains no customer inputs or outputs.
- Customer data is stored in Google Cloud Platform buckets in the United States, with standard contractual clauses available for transfers.
- Zero Data Retention (ZDR) is available per organization or per feature. It was **not enabled**. Enabling it, or accepting any new terms, is an account decision for you.
- Inference retention and abuse or reliability logs are separate. The 30-day period applies to the logs, not to the inference response itself.

Consent controls verified in this migration:
- `allow_ai` is a strict boolean and defaults to false (`advisor_routes.py`). The live check with it false made no provider call.
- Consent applies to one request. The interface clears the checkbox after each request, and the test "sends consent for one request only" passes.
- The only payload is the sentence, bounded to 600 characters. The payload test checks that no repository identifier or path is included.
- Provider failure returns the deterministic answer. There is no second provider and no automatic switch.

AI-3 (privacy gate) remains OPEN, because the owner has not decided whether this payload is acceptable under it.

### 46.5 Owner decisions still required

1. **Cloudflare block (blocking for live use).** Choose one:
   (a) Check Groq's account and network status, or contact Groq support about error 1010 for this client and network. This is the safest option.
   (b) Approve a change so that Sean sends an identifying User-Agent for itself (for example, `Sean/0.1`). This is not browser impersonation, but it changes the request signature, so you must approve it separately from the migration.
   (c) Approve the official Groq Python SDK as a new dependency (it sets its own client headers). This needs a dependency decision record (D01) and cost and license review.
   I did not perform any of these.
2. **Model.** `openai/gpt-oss-20b` is kept. The official models page lists it as a production model with developer-plan limits. Account access is unverified, because no request reached the model. `openai/gpt-oss-120b` is the alternative, and changing either requires your approval.
3. **Plan and billing.** Confirm the account's plan and whether the free access you expect requires billing. No paid fallback exists in the code.
4. **Privacy.** Decide whether to enable ZDR, and whether AI-3 is closed for the one-sentence payload.
5. **Governance.** Sign off on this record as the owner decision that supersedes the Gemini decisions (E-D13, AI-2, AI-4). The earlier records are preserved unchanged, as described in 46.6.
6. **Start script.** `scripts/start_backend.ps1` sets `LOCALAPPDATA` to a temporary runtime folder (`...\Temp\sean-i6-runtime\...`). That is an operational path, not a provider setting, and it is left as it was. Decide whether the registry should move to the standard `%LOCALAPPDATA%\Sean` location.
7. **Environment file.** The `.kiro/.env` line names were not read. Please confirm that no stale `SEAN_GEMINI_API_KEY` line remains, since it would have no effect.

### 46.6 Supersession index: Gemini records

Current provider: Groq. The records below are historical. Each entry says what it covered and where its supersession is recorded. Files with recorded hashes were not edited, so their hashes still match.

| Record | Status | Notes |
|---|---|---|
| `docs/development/e-d13-optional-ai-provider-decision-record.md` (hash `27F294DD…`) | Historical. Gemini and model decisions superseded by section 46. | Not edited (hash on record in sections 34 and 36). |
| `docs/development/e-d13-addendum-2026-11-10-privacy-free-tier-and-design.md` | Historical. Superseded by section 46. | Not edited. |
| Sections 30 to 36 of this file | Historical. Superseded by sections 45 and 46. | Left as written. |
| `docs/development/phase-3-closure-report.md`, `phase-3-owner-acceptance-record.md`, `i5-i6-owner-acceptance-package.md` | Historical mentions only. | Not edited (hashes on record in sections 37 to 43). |
| `docs/specs/spec-4-engineering-intelligence.md` | **Active. Updated.** | Section 8 and decision rows O-3 and X-6 now name Groq, and the original Gemini decisions are marked as superseded. New hash `C7A22977…`. No earlier hash was recorded. |
| `.kiro/specs/engineering-intelligence/{design,requirements,tasks}.md` | **Active. Updated.** | Provider, key name, and file name changed to Groq. The description of checked task 2.3 now reads "Groq adapter" (its checkbox is unchanged). |
| `.kiro/specs/evidence-retrieval/design.md` (line 129) | **Active. Updated.** | Hash recorded in section 42.10 was `0FE90C69…`. New hash `FE7ABEDE2CD97B7B0D756CDEF71FD6DCDCD45C2B7C4358DB8F9A434DAA70A5F2`. The change is one sentence, which states the 2026-11-14 supersession. |
| `.kiro/specs/evidence-retrieval/tasks.md` | Recorded hash was stale before this migration. | Section 42.10 recorded `2F30F345…`. The checkbox audit in section 44 changed the file, so the current hash is `CDB123845F32848A09A5E2B7B4113498F383DB83DF32FC24162BF7B8A6781D06`. This was not caused by the migration. |
| `.kiro/specs/evidence-retrieval/requirements.md` | Unchanged. Hash `FB04C9E2…` matches section 42.10. | |

### 46.7 Files changed in this migration

Application and tests:
- `backend/app/modules/intent/groq.py` (renamed from `gemini.py`, rewritten for the Groq request and reply shapes)
- `backend/app/modules/intent/parser.py`, `backend/app/api/advisor_routes.py`, `backend/app/main_advisor.py` (names and labels)
- `backend/tests/unit/test_intent.py`, `backend/tests/unit/test_advisor_routes.py` (Groq shapes; three assertions changed to the new design, as listed in section 45)
- `backend/tests/unit/test_diagnose_groq.py` (new, 11 tests)

Frontend:
- `frontend/src/types/advisor.ts`, `frontend/src/features/analysis/validateAdvisor.ts`, `frontend/src/features/report/reportSnapshot.ts`, `frontend/src/components/request/RequestScreen.tsx`, `frontend/src/components/report/TransparencySection.tsx` (labels and retention wording)
- `frontend/tests/fixtures/advisor-capabilities.json`
- `frontend/tests/app.test.tsx`: the XSS test now checks the report for images, not the whole page, and asserts that the hostile title is shown as text. The consent expectation now matches the Groq wording.

Scripts:
- `scripts/start_backend.ps1`, `scripts/check_connectivity.py` (host `api.groq.com`), `scripts/diagnose_groq.py` (renamed from `diagnose_gemini.py`; labels in 46.2)

Governance and specs: the files listed in 46.6.

Environment: none read or changed. `.kiro/.env` was not opened by this work. The diagnostic and the backend read it through their own code.

### 46.8 Test results (executed 2026-11-14)

| Suite | Result |
|---|---|
| Backend, full (`pytest tests -q -rfxXs` from `backend`) | **1474 passed, 0 failed, 0 skipped, 0 xfailed**, 839 s, exit 0. This includes the interpreter, route, consent, and fallback tests and the 11 new diagnostic tests. |
| Frontend type check (`tsc --noEmit`) | Clean, exit 0 |
| Frontend Vitest, full | **590 passed, 21 of 21 files**, exit 0. The XSS test that failed earlier (the sidebar logo was caught by a page-wide image query) now passes with the report-scoped query. |
| Live diagnostic | Edge block (`EDGE_BLOCKED_BROWSER_SIGNATURE`), see 46.1 |
| Live application | Consent off: no call. Consent on: `AI_HTTP_ERROR`, deterministic answer returned. See 46.1 |

These are new counts. Earlier counts were not reused.

Pre-existing failures found and resolved in this scope: one (the XSS test, described above). Pre-existing and unrelated: none remain.

### 46.9 Status

- The active implementation uses Groq consistently. The only Gemini strings left are historical and are marked as superseded.
- Groq has **not** been verified by a successful live request. The provider is reachable only as a 403 edge block, and this must be resolved with you (46.5, item 1).
- Consent, the deterministic fallback, and the logging rules were verified against the live backend and by the tests.
- No purchase, paid call, account privacy change, or new terms acceptance was made.

## 47. Groq Cloudflare error 1010: investigation, facts, hypotheses, and options (2026-11-14)

No live request was sent in this investigation. The adapter request was rebuilt locally, without a network call. No User-Agent change, proxy, or other transport change was made to get past the block.

### 47.1 Confirmed facts

1. The observed response (from the earlier diagnostic run, section 46.1): HTTP 403, body exactly `error code: 1010`, 0.21 s after the request was sent. The body is plain text, not Groq's documented JSON error object (`{"error": {"message", "type"}}`). Groq's error page (console.groq.com/docs/errors) does not list error 1010.
2. The request Sean sends (verified by local construction and by the opener's default headers): `POST https://api.groq.com/openai/v1/chat/completions`, `Content-Type: application/json`, `Authorization: Bearer <key>`, and `User-agent: Python-urllib/3.14`, which is urllib's default for every request. There is no `Accept` header. There is no proxy configured in the environment (`urllib.request.getproxies()` is empty).
3. The Cloudflare error 1010 page (developers.cloudflare.com, read 2026-11-14) says the error means access was denied "based on your browser's signature". Its first listed cause is a client sending a non-browser User-Agent, and it names the default Python urllib User-Agent as an example. Its documented client-side resolution is to send a descriptive User-Agent that identifies the application. Its documented site-owner resolution is to turn off Browser Integrity Check for the zone. That setting belongs to the site owner, and Cloudflare support cannot override it.
4. Groq's official Python SDK sends its own `User-Agent` (built from the client class name and the word "Python") plus `Accept` and `Content-Type` headers, as `_base_client.py` in the `groq-python` repository shows. The source does not show any handling of error 1010.
5. Sean's adapter does not use the official SDK. It uses the standard library, so it does not send the SDK's headers.

### 47.2 Hypotheses, with confidence

- **H1, most likely (moderate confidence):** Cloudflare Browser Integrity Check on `api.groq.com` blocks the default `Python-urllib` User-Agent. Supporting evidence: fact 1 (the edge body, not Groq JSON), fact 2 (the default User-Agent), fact 3 (the documented trigger), and a third-party report (OmniRoute issue 8775, unverified, and not from Sean's account) in which the same host returned 200 to `curl` and to Python with a browser User-Agent, and 403 with 1010 to Python's default User-Agent, from the same IP at the same time. The same report also shows 403 with 1010 for an OmniRoute request that overrode the User-Agent with a Chrome string, which points to other signals (for example the TLS fingerprint) in some setups. This hypothesis has not been tested against Groq's zone.
- **H2, possible (low confidence, cannot be assessed yet):** TLS or header fingerprinting in addition to the User-Agent. Evidence is the same third-party report. Not tested.
- **H3, less likely (low confidence):** Account restriction, missing API access, or billing. The 1010 block happens at the edge, before the request reaches Groq's account logic, so it cannot show account state. Groq's error page documents 401, 403, and 429 as account-level errors, and none of them was returned.
- **H4, unlikely (low confidence):** IP reputation. The third-party report shows the same IP succeeding with `curl`. This was not verified for Sean's network.
- **Ruled out for this block:** the model name and endpoint path. Cloudflare evaluates the request before Groq routes it to a model, and the body does not come from Groq's application.

### 47.3 Legitimate resolution paths

- **A. Ask Groq (recommended first step).** Groq's console offers a "Chat with us" option in the organization menu. This is documented in Groq's OpenAI-compatibility guide. Include: the UTC timestamp, the endpoint, the HTTP 403 with body `error code: 1010`, the Cloudflare Ray ID (`cf-ray`) once a request produces one, the account or organization name, and the User-Agent Sean sends. Do not include the key. Ask Groq whether the zone blocks the default Python User-Agent, and what identifier it accepts for API clients.
- **B. Identifying User-Agent (needs approval; not implemented).** Cloudflare documents a descriptive, application-identifying User-Agent as the client-side fix. This is not browser impersonation. It still changes the request signature, so it should happen only after Groq confirms it is acceptable, or with your explicit approval.
- **C. Official SDK (no evidence it fixes this).** The SDK sends a different User-Agent and extra headers. That differs from the urllib default, but no Groq or Cloudflare document says the SDK resolves 1010. Adopting it adds a dependency that needs a D01 decision record, license and maintenance review, and a security review.
- **Rejected:** browser User-Agent spoofing, User-Agent rotation, TLS impersonation, proxies or alternate IPs, and repeated probing. These circumvent an access control.

### 47.4 Code changes

- Necessary for the connection: none. The fixes depend on Groq's answer (path A) or your approval (B or C).
- Diagnostics improved (no transport change): `groq.ProviderError` now carries `request_id`, taken from the first safe value of `cf-ray` or `x-request-id` in an error response (64 characters maximum, `[A-Za-z0-9._-]`). The diagnostic prints it as "provider request id (for support)". The backend log is unchanged and does not contain it. Tests: 2 new (accepted and rejected values).
- Verification: `test_intent.py`, `test_advisor_routes.py`, `test_diagnose_groq.py`: 126 passed, 0 failed, exit 0. `diagnose_groq.py` compiles.

### 47.5 Current safety and function

- Without a working Groq connection, the deterministic interpreter answers every request. The live check in section 46.1 showed this: with consent on, the provider returned 403, the answer was still produced, and the status was `AI_HTTP_ERROR`.
- Consent stays off by default. The AI status is returned to the interface, and no alternative provider is contacted.
- Logging is unchanged. It does not contain the key, the sentence, or the reply.

### 47.6 Needed from you

1. **Ask Groq (path A).** I cannot contact Groq support. Please send the request in section 47.3, or tell me to prepare the text for you.
2. **Authorization for one diagnostic request, if you want a Ray ID now.** The request costs one call, and it would show `cf-ray` in the diagnostic output for the support ticket. I will not send it without your explicit go-ahead.
3. **Decision on path B or C,** after Groq's reply. Each needs your approval.
4. The account checks from section 46.5 (plan, billing, API access, and the ZDR and privacy decisions) remain open.

## 48. Groq support test: descriptive User-Agent `Sean/1.0`, one controlled live diagnostic (2026-11-14)

Authorization: Groq Support reviewed the 403 / Cloudflare error 1010 report and recommended a descriptive User-Agent, with `Sean/1.0` as the example. The owner authorized this one test.

### 48.1 Change (one place)

- `backend/app/modules/intent/groq.py`: `USER_AGENT = "Sean/1.0"`. The opener's default `Python-urllib/x.y` User-Agent is replaced in `make_transport`, and that is the only header change. Authorization, endpoint, model, request body, and response parsing are unchanged. No SDK, no browser string, no User-Agent rotation, no proxy, no other signature change.
- Diagnostic-only callback: `make_transport(..., on_response_headers=...)` passes the response headers of a successful request to the owner's diagnostic script. The application does not use it. The request-identifier check is the same `_request_id` used for errors.

### 48.2 Live diagnostic (one request, not repeated)

| Field | Value |
|---|---|
| Timestamp | 2026-11-14 07:08:16 UTC (local, UTC-04:00: 03:08:16) |
| User-Agent sent | `Sean/1.0` |
| Endpoint and method | `POST https://api.groq.com/openai/v1/chat/completions` |
| Model | `openai/gpt-oss-20b` |
| Input | The fixed synthetic sentence of the diagnostic. No repository content, identifiers, or private data. |
| HTTP status | 200 |
| Cloudflare Ray ID (`cf-ray`) | `a5a42f1e9bdfd198-SDQ` |
| `x-request-id` | Not recorded. The safe-identifier helper returns one value, and `cf-ray` is preferred. Whether Groq also sent `x-request-id` was not captured. |
| Response time | 0.72 s (measured around the transport call, including the network) |
| Body classification | A Groq chat reply: a `choices` list with a message whose content is a JSON object. Mode `ADVISE`, path and symbol null. |
| Result | **SUCCESS** |

What was evaluated: the request reached Groq's API and produced a model reply, so authentication for this key and access to `openai/gpt-oss-20b` were both evaluated and passed for this request. Quota and billing were not restricted for this request.

What this does not show: that access is stable over time, that rate limits will not apply, or that the account's plan or billing are configured as intended. One successful request is not a capacity test.

Key handling: the key was supplied by `.kiro/.env` to the diagnostic script, which read it itself. It was not printed. The output above contains no key, no authorization header, and no sentence from the repository.

### 48.3 Earlier failure, for the support file

- The 403 / 1010 responses in sections 46 and 47 came from the default `Python-urllib` User-Agent. Their exact timestamps and Ray IDs were not captured, because the diagnostic at that time did not print the Ray ID. The one earlier record is the body `error code: 1010` on 2026-11-14, with HTTP 403 and 0.21 s elapsed.
- The earlier failure cannot be recovered from the record. Groq Support can search their logs for the User-Agent `Python-urllib/3.14` on `api.groq.com` on 2026-11-14 and match it by time, if they need to.

### 48.4 Tests (executed after the change, before the live request)

- `backend/tests/unit/test_intent.py`, `test_advisor_routes.py`, `test_diagnose_groq.py`: **129 passed, 0 failed**, exit 0. This includes 3 new tests: the descriptive User-Agent reaches a local server, the success callback receives headers, and a call without the callback behaves as before. The earlier count was 126.
- `scripts/diagnose_groq.py` compiles.
- The live request was made once. The full backend and frontend suites were not rerun in this step. Their last results are in section 46.8, and this change only affects the adapter's User-Agent and an optional callback.

### 48.5 Preserved guarantees

- Explicit per-request consent, default false. Unchanged.
- Deterministic fallback and no secondary provider. Unchanged.
- Redirect refusal, 10 s and 15 s deadlines, 256 KiB limit. Unchanged.
- Safe logging: the backend log line is unchanged, with no key, sentence, reply, or identifier.
- No account, billing, or privacy setting was changed.

### 48.6 Support information (sanitized)

- Organization and account: to be filled in by the owner from the Groq console. Not included here.
- Timestamp of the success: 2026-11-14 07:08:16 UTC.
- Ray ID of the success: `a5a42f1e9bdfd198-SDQ`.
- Endpoint: `POST https://api.groq.com/openai/v1/chat/completions`.
- User-Agent that succeeded: `Sean/1.0`. The earlier failing User-Agent: `Python-urllib/3.14`.
- Result: HTTP 200 with a valid chat reply for `openai/gpt-oss-20b`, 0.72 s.
- Hosting context: a local Windows developer workstation running PowerShell, with the backend started locally on 127.0.0.1. Not a hosted server. The hosting provider and location are not part of this setup, and none are stated here.
- Public IP address: not determined. Obtaining it needs a request to an external service, and that is your decision. This record does not include it.
- Credentials: not included. No authorization header or key is in this report.

### 48.7 Remaining checks

1. Confirm that the Groq account is the intended one, and that its plan and billing are as expected (owner, Groq console).
2. Decide whether Groq should be told the success, and whether the earlier failure's logs should be searched (section 48.3).
3. The privacy decisions in section 46.5, items 4 and 7 (ZDR and AI-3) remain open. They are not affected by this change.
4. The stale `.kiro/.env` check (section 46.5, item 7) remains open.
5. Run the live `/interpret` consent path through the running backend (one more live request). Not run here, because only one diagnostic request was authorized.

## 49. Groq migration: application-level consent validation, privacy closure, configuration audit, and regression (2026-11-14)

Section 48 (the successful diagnostic with `Sean/1.0`) is preserved unchanged. This section records the application-level work that followed it.

### 49.1 Live requests made in this step

- **One application-level request** to `POST /interpret` on the running backend, with `allow_ai: true`. Synthetic sentence: "sean - Summarize the mood of a quiet afternoon in a small library". No repository content, identifiers beyond the registered name `sean`, paths, or private data.
- Request timestamp: 2026-11-14 07:24:00 UTC (03:24:00 at UTC-04:00). The response took 1.67 s, and the Groq call inside it took 697 ms (backend log).
- No other live request was made in this step.

### 49.2 Consent-enabled path (phase 1A)

Verified by the code, by automated tests, and by the live request:

1. The frontend sends `allow_ai: true` only when the user has checked the box and the backend reported a provider. `advisorClient.ts` adds the field only when it is true. (`App.tsx`, `RequestScreen.tsx`, `advisorClient.ts`.)
2. The backend validates the flag as a strict boolean that defaults to false (`advisor_routes.py`, `StrictBool`). A non-boolean is rejected (`test_consent_must_be_a_real_boolean`).
3. The adapter was invoked once. The parser calls the hint only when it cannot resolve the request itself: the sentence named no file and no advisory keyword. The live sentence met that condition.
4. Groq answered with HTTP 200 and a JSON object (backend log: "AI interpreter answered in 697 ms"). **Sean's contract then rejected that answer**, so the route returned `ai_status: AI_NO_USABLE_ANSWER`, `interpreter: deterministic`, and `mode: NEEDS_TARGET`. The response was HTTP 200.
5. The user-facing text for that status is "Answered, but nothing it said matched the repository. Sean used its built-in reader." (`TransparencySection.tsx`).

**Result:** the transport and provider inference succeeded. The application outcome was a deterministic fallback, because the model's answer did not satisfy Sean's accepted shape for this request. The reply content is not logged by design, so the exact field that failed is **not known**. The most likely cause, which is a hypothesis: the system instruction gives the model only `INVESTIGATE` or `ADVISE`. For a general question with no file, the model chose `INVESTIGATE` with no path, which the contract rejects. Confirming this needs one more live request, which needs your authorization. A prompt change, if you approve it, must be verified the same way.

Automated coverage added in this step:
- `test_a_usable_json_answer_that_fails_the_contract_is_reported_and_the_parser_answers` (route): a valid JSON answer with `mode: INVESTIGATE` and no path gives `AI_NO_USABLE_ANSWER`, a deterministic result, and no target.
- `test_each_http_status_falls_back_and_keeps_its_status` (adapter, 4 cases): 403, 429, 500, 503 each give `AI_HTTP_ERROR` with the status kept, and no value.
- Frontend (`app.test.tsx`): a failed attempt shows "The provider refused the request…" in the AI reader row, and the report does not say "No AI provider was used". A successful Groq answer is attributed to Groq, with its checked status.

### 49.3 Consent-disabled path (phase 1B)

- No live request was made, by design, to avoid spending a request on a path that makes no call.
- Automated proof of zero AI calls: `test_the_sentence_never_leaves_the_machine_without_consent` runs the same request with the flag absent and with `false`, and asserts that the transport was called zero times. The route passes `hint=None` unless `allow_ai` is true (`advisor_routes.py`).
- The deterministic result is returned with `ai_status: NOT_REQUESTED` (`test_the_interpret_response_reports_not_requested_and_not_needed`). The UI text is "Not requested. Sean used its built-in reader." (`TransparencySection.tsx`).
- Quota: no request, so no quota was used.

### 49.4 Error and fallback behavior (phase 1C)

| Condition | Test | Result |
|---|---|---|
| HTTP 403, 429, 500, 503 | new parametrized test (4 cases) | `AI_HTTP_ERROR`, status kept, deterministic answer |
| Timeout (before the reply) | existing timeout tests | `AI_TIMEOUT` |
| Connection refused | `test_connection_refused_is_a_connection_failure` | `AI_CONNECTION_FAILED` |
| Trickling reply past the total deadline | `test_a_provider_that_trickles_its_reply_hits_the_total_deadline` | deadline enforced |
| Reply over 256 KiB | `test_transport_rejects_an_oversized_reply` | `AI_RESPONSE_TOO_LARGE` |
| Redirect | `test_transport_does_not_follow_redirects` | redirect refused, target never contacted |
| Non-JSON or wrong shape | two invalid-reply tests | `AI_INVALID_REPLY` |
| Unexpected exception | `test_an_unexpected_exception_is_logged_by_class_only` | `AI_UNEXPECTED`, class name only |
| Unusable JSON answer | new route test | `AI_NO_USABLE_ANSWER` |

Logs: `test_logs_show_the_failure_without_the_key_the_sentence_or_the_reply` and the live log line (status, stage, HTTP code, elapsed time). Neither contains the key, the sentence, or the reply.

No second provider, no paid fallback, and no weakening of deadlines, limits, redirect refusal, or consent. The code was not changed in this step, except for the tests and the UI wording listed in 49.9.

### 49.5 Privacy and data flow (phase 2)

What leaves the machine when consent is on, for one request:

| Item | Sent? | Notes |
|---|---|---|
| The user's sentence | Yes | After the repository token is removed when the user used the `ID - question` form. Truncated to 600 characters (`MAX_HINT_TEXT`) before sending. |
| Repository identifier | No, by the parser's design | The leading `ID -` token is removed. **Exception:** if the user omits the separator, the identifier stays in the sentence, because it is the user's own text. |
| Repository path, file content, commits, evidence, profile, registry data | No | The payload function accepts only the sentence (`build_payload`). Tested (`test_the_payload_that_leaves_contains_no_repository_identifiers`). |
| System instruction | Yes, fixed text | Contains no user or repository data. |
| Request parameters | Yes, fixed | Model, JSON response format, temperature 0. |
| Headers | Yes | `Authorization` (the key), `Content-Type`, `User-Agent: Sean/1.0`. |
| Connection metadata | Yes, inherent to HTTPS | Groq can see the workstation's public IP address. Sean does not send it deliberately. |

Minimization: the payload is already the sentence alone. No further reduction is possible without changing what the interpreter can understand.

### 49.6 ZDR and retention (verified against Groq's official documentation, read 2026-11-14)

Distinct statements:
- **General policy (documented):** inference requests are not retained by default. Abuse and reliability logs can be kept up to 30 days, unless legally required to keep them longer. Usage metadata is always collected and does not contain inputs or outputs. Customer data is stored in US Google Cloud buckets. (`console.groq.com/docs/your-data`.)
- **Availability (documented):** "All customers may enable Zero Data Retention (ZDR) in Data Controls settings." ZDR disables the abuse and reliability retention, and it disables features that need retention (batch files and fine-tuning, which Sean does not use).
- **Account configuration (not verified):** the environment cannot read the account's Data Controls. Whether ZDR is enabled, or the abuse-log opt-out is set, is **unknown**. This report does not claim either.
- **Enabled by Sean:** no. No account setting was changed.

Manual check you must do in the Groq console (Data Controls): confirm whether ZDR is on for the organization, and whether the abuse and reliability logging setting matches your decision.

### 49.7 AI-3 privacy gate: remains OPEN

Implemented and documented:
- The payload is minimized to the user's sentence, with no repository content, identifiers from the registry, or derived context (49.5).
- Consent is explicit, per request, and defaults to off (49.2, 49.3).
- The retention behavior and the account-level options are documented (49.6).

Not met, so AI-3 is not closed:
- The owner has not decided that a one-sentence, user-typed payload is acceptable under AI-3. That is a privacy decision, and it is not one an agent can close from implementation evidence.
- The account's ZDR and abuse-log configuration has not been confirmed.
- The payload exception in 49.5 (the identifier left in the sentence when the separator is omitted) needs a decision: strip it, or accept it as the user's own text.

Evidence needed to close AI-3: (1) your written decision on the payload; (2) a screenshot or confirmation of the Groq Data Controls setting for the organization, which you can share without the key; (3) your decision on the omitted-separator case.

### 49.8 Environment and configuration audit (phase 3)

- Active provider key: `SEAN_GROQ_API_KEY`. `scripts/start_backend.ps1` and `scripts/diagnose_groq.py` read it. `scripts/check_connectivity.py` checks `api.groq.com`. The live backend reported `ai_interpreter.available: true`, `provider: Groq`, `model: openai/gpt-oss-20b`, without showing the key.
- No active execution path requires `SEAN_GEMINI_API_KEY`. A recursive search of the active backend, tests, scripts, and frontend (excluding the environment file) found one Gemini reference: a docstring in `groq.py` that records the owner's decision.
- A recursive search of `.kiro` (excluding the environment file) found Gemini references only in historical records (`phase-status.md`) and in one sentence of the Evidence design that states the 2026-11-14 supersession (`evidence-retrieval/design.md`, line 129).
- Key exposure: no `print` or `Write-Host` of the key in the backend, scripts, or frontend. No `VITE_` variable and no key name in the frontend sources. The fixture backend used by the browser tests receives an environment without the key (`scripts/run_fixture_backend.py`).
- `.kiro/.env`: **not opened by this work.** Ignored by `.gitignore` (line 42, pattern `.env`); `git check-ignore` confirms that it is ignored; `git ls-files` shows that it is not tracked. Local variable names can be verified without showing values by running `Select-String -Path .kiro\.env -Pattern '^SEAN_' | ForEach-Object { $_.Line.Split('=')[0] }` in PowerShell, which prints only the names.
- An earlier search in this session used a frontend path pattern that did not recurse. The corrected recursive search (49.8) found the AI-reader UI rows, which had no tests. Those tests are added in 49.2.

### 49.9 Files changed in this step

- `frontend/src/components/report/TransparencySection.tsx`: the deterministic-reader text no longer says "No AI provider was used" after a failed attempt. It now says that the built-in reader decided, and it points to the AI reader row below.
- `frontend/tests/app.test.tsx`: 2 new tests (failed attempt; successful Groq answer).
- `backend/tests/unit/test_intent.py`: 4 new parametrized status tests (403, 429, 500, 503).
- `backend/tests/unit/test_advisor_routes.py`: 1 new test (usable JSON answer that fails the contract).
- `docs/specs/spec-4-engineering-intelligence.md` (section 8): the sentence that said "tests with a fake transport only" now lists the authorized live calls.
- `.kiro/reports/phase-status.md`: this section. Sections 1 to 48 are unchanged, apart from the top-of-file note added in section 46.

No backend application code changed in this step. No prompt, model, User-Agent, endpoint, or consent logic changed.

### 49.10 Test results (executed 2026-11-14, after the changes above)

| Suite | Command | Result |
|---|---|---|
| Backend, full, including integration tests | `pytest tests -q -rfxXs` in `backend` | **1484 passed, 0 failed, 0 skipped, 0 xfailed**, 841.95 s, exit 0 |
| Backend, adapter, route, and diagnostic (targeted, before the last route test was added) | `pytest tests/unit/test_intent.py tests/unit/test_advisor_routes.py tests/unit/test_diagnose_groq.py` | **133 passed**, exit 0 |
| Frontend type check | `tsc --noEmit -p tsconfig.json` | Clean, exit 0 |
| Frontend unit and component tests | `vitest run --maxWorkers=3` | **592 passed, 21 of 21 files**, exit 0 |
| Frontend lint | not configured (no lint script in `frontend/package.json`; no backend lint configuration in the repository) | Not run |
| Browser E2E, default config | `npx playwright test` | **51 passed, 0 failed, 47 skipped**, 15.0 min, exit 0 |
| Browser E2E, audio suite | `npx playwright test -c playwright.audio.config.ts` | **47 passed, 0 failed, 0 skipped**, 32.2 s, exit 0 |

About the 47 skips in the default E2E run: they are the audio suite. `e2e/audio/cues.spec.ts` skips itself unless `SEAN_AUDIO_SUITE=1`, which the audio config sets. The skip is by design. The audio suite was run separately, as shown above.

Deterministic path without a key: the backend suite and the E2E backend (which receives no key) run without the Groq key. The E2E journeys and the route fallback tests pass in that state.

Browser E2E makes no live provider call: the fixture backend has no key, and no E2E test enables consent (checked in 49.8).

A run was stopped by mistake during this step, and it was restarted from the beginning. Its partial output was discarded. Only the restarted run's results are reported.

### 49.11 Status

- Application-level consent path: verified through automated tests and one live request. The live request reached Groq and was answered. Sean's contract then rejected the answer, so the user-facing result was the deterministic fallback. The exact field that failed is not known. See 49.2.
- Consent-disabled path: verified by automated tests, with zero provider calls. No live request was made for it.
- Deterministic fallback: verified by automated tests (49.4) and by the E2E journeys without a key.
- Privacy: payload minimized and documented (49.5). ZDR: documented as available, account configuration not verified (49.6). AI-3: open (49.7).
- No task is marked ACCEPTED or VERIFIED by this section.

## 50. Groq response contract, sanitized AI payload, and reason-coded diagnostics (2026-11-14)

Sections 48 and 49 are preserved unchanged.

### 50.1 Root cause of AI_NO_USABLE_ANSWER (diagnosed from the code; the reply was not logged)

Sean accepted a model answer in exactly two shapes, checked in this order by `_accept_hint`:
1. `path` is a string that exists in the committed tree. The result is INVESTIGATE, and a valid `symbol` is kept.
2. `mode` is exactly `"ADVISE"`. The result is ADVISE.

Any other answer was discarded. That includes `mode: "INVESTIGATE"` with no path, `NEEDS_TARGET`, a missing mode, a lowercase or padded mode, a path that is not in the tree, and a non-text value. The live reply content was not logged, so the exact shape is not known. The most likely shape, from the earlier prompt (which offered only INVESTIGATE or ADVISE) and the non-advisory sentence used, is `INVESTIGATE` with no path. That remains a hypothesis. Section 50.4 adds a reason code that will name the failing field on the next request.

### 50.2 Accepted response contract (after this change)

A reply is a JSON object (`choices[0].message.content`). The fields are read as follows.
- `repository_id`, if present, must equal the registered identifier of the request. Otherwise the reply is rejected (REPOSITORY_ID_MISMATCH).
- `path`, if it is a string that exists in the committed tree, makes the result INVESTIGATE (ACCEPTED_TARGET). This is unchanged, and it takes precedence.
- `mode` `"ADVISE"` makes the result ADVISE (ACCEPTED_ADVISE).
- `mode` `"NEEDS_TARGET"` is accepted as an answer. The deterministic plan is kept, and the status is AI_USED (NEEDS_TARGET_ANSWERED).
- Anything else is rejected with one fixed reason code.

Validity levels:
- Valid JSON: the content parses as a JSON object (`AI_INVALID_REPLY` otherwise).
- Structurally valid model output: the object has a `mode` in the accepted set, with the right types.
- Semantically valid Sean interpretation: ADVISE, or NEEDS_TARGET, or INVESTIGATE with a path that exists in the committed tree.
- Valid investigation target: an existing path in the committed tree, and, if given, a symbol that matches `[A-Za-z_][A-Za-z0-9_.]*` and is at most 256 characters.

The contract was not weakened. No arbitrary answer is accepted, and no path or mode is invented.

### 50.3 Strict separation of the local question and the outbound text

- `original_question`: the user's question, unchanged. It is used for local resolution, the response, and the report. It is never sent.
- `sanitized_ai_question`: built by `app/modules/intent/sanitize.py` only for the external request. It is the only text the adapter receives. The adapter's payload is the system instruction plus `{"sentence": <sanitized>}`.

The sanitizer removes, only when it recognizes them with confidence:
- URLs (with a preceding preposition).
- Registered folder roots, with any folder beneath them.
- Windows drive paths and UNC paths, Unix absolute paths with at least two segments, and home-relative paths.
- Repository-relative tokens with two separators, or a known file suffix (`billing.py`, `src/billing.py`). Tokens of digits and separators (dates) and single-separator words (`and/or`) are kept.
- Registered identifiers in the forms the user writes: at the start with `ID -`, `ID:`, or `ID —`; after `in`/`repository`/`repo`/`project`; and any identifier that contains a digit, hyphen, or underscore.

It never guesses:
- A registered plain word (for example `sample`) that appears anywhere else makes the question unsafe to send. The result is AI_NOT_SENT and the AI reader is not called.
- A question that becomes empty is not sent (AI_NOT_SENT).

Limits, stated plainly:
- The sanitizer knows only the registered identifiers and roots. A name that is not registered is ordinary user text and is sent as typed.
- A repeated identifier can leave a connecting word behind ("kiroween-2026 and kiroween-2026 again" becomes "and again"). Meaning can be lost; nothing sensitive is sent.
- Technology names are kept (`Node.js`). A relative path such as `api/v1/users` is removed as a path.

### 50.4 Diagnostics (privacy-preserving, logger `sean.intent`)

Logs carry fixed reason codes only, never the question, the sanitized text, a path, an identifier, or a model value. Examples:
- `AI answer accepted: ACCEPTED_ADVISE` (or `ACCEPTED_TARGET`, `NEEDS_TARGET_ANSWERED`).
- `AI answer not used: PATH_MISSING`, `MODE_NOT_EXACT`, `MODE_NOT_ALLOWED`, `MODE_MISSING`, `MODE_NOT_TEXT:<python type>`, `PATH_NOT_TEXT:<python type>`, `PATH_NOT_IN_COMMITTED_TREE`, `REPOSITORY_ID_MISMATCH`, `NOT_AN_OBJECT`.
- `AI reader not used: the question could not be made safe to send (<UNRECOGNIZED_LOCAL_IDENTIFIER or EMPTY_AFTER_SANITIZATION>)`.
- The adapter's existing status line (status, stage, HTTP code, elapsed time).

Tests: `test_a_rejected_answer_is_reported_with_its_reason_and_no_content` (the reason is logged, and neither the question nor the word in it appears in the log).

### 50.5 Prompt (`groq.py`, `_INSTRUCTION`)

The instruction now describes the two modes Sean needs, and a path is never chosen by the model. ADVISE is for general engineering questions that do not depend on one file (architecture, design decisions, components and infrastructure, technical rationale, recommendations, general behavior). NEEDS_TARGET is for the history, behavior, or implementation of one specific piece of code, or when the question is unclear. The reply must return `path` and `symbol` as null, because file targets are resolved by the application. The instruction does not name the product or any registry value (`test_the_fixed_instruction_never_names_the_product_or_a_registry_value`).

The prompt change has not been verified against the live service. The only live request in this step did not reach the provider (50.6).

### 50.6 Live application request (one, authorized, did not reach the provider)

- Timestamp: 2026-11-14 20:46:26 UTC (16:46:26 at UTC-04:00). Endpoint: the application route `POST /interpret` with `allow_ai: true`.
- Question: "Why do layered architectures keep the HTTP API separate from the application logic?" It contains no registered identifier, path, or private data.
- Result: HTTP 200, `interpreter: deterministic`, `ai_status: NOT_REQUESTED`, `mode: UNRESOLVED`, in 0.08 s. The response keys match the frontend's exact interpretation key list.
- Cause: the request had no repository reference and no selected repository, and the registry holds two repositories. The parser returns UNRESOLVED before it reaches the AI reader, so no provider call was made. This was an error in how the request was constructed, not a failure of the provider. The outbound payload was verified offline (below), but it was not sent.
- The one authorized live request was spent without validating the provider. A second live request needs your authorization, and it must include a repository reference, for example `sean - Why do layered architectures...`, or a selected repository in the interface.

Offline verification of the outbound payload for the same question (no network call; the real sanitizer, the real registry values from the running backend, and the real payload builder): the sanitized text equals the original question, the outbound user message is `{"sentence": "Why do layered architectures keep the HTTP API separate from the application logic?"}`, and a whole-word search of the complete outbound body (system instruction, user message, and model parameters) finds no registered identifier or root.

### 50.7 Tests (executed after the changes)

| Suite | Result |
|---|---|
| Backend targeted (sanitizer, adapter, parser, routes, diagnostic) | 185 passed, 0 failed, exit 0 (includes the new sanitizer, reason-code, payload, and instruction tests) |
| Backend full, including integration | 1535 passed, 0 failed, 0 skipped, 0 xfailed, 627 s, exit 0 |
| Frontend type check | Clean, exit 0 |
| Frontend Vitest, full | 593 passed, 21 of 21 files, exit 0 (includes the new AI_NOT_SENT display test) |
| Browser E2E, default config | 51 passed, 0 failed, 47 skipped (the audio suite, skipped by design), 11.2 min, exit 0 |
| Browser E2E, audio config | 47 passed, 0 failed, 28.7 s, exit 0 (run twice; both passed) |

Failures found and fixed during this step (all new code): the answer-mode check ran before the exact `INVESTIGATE` check, so a correct `INVESTIGATE` with no path was reported as not exact (fixed, with the four tests that caught it); the sanitizer removed `10/12/2026` and `Node.js` (fixed); a folder under a registered root left `\backend` behind (fixed); a URL left a dangling preposition (fixed); and the instruction shared the product name with a registered identifier (removed, with a test).

### 50.8 Files changed

Backend:
- `backend/app/modules/intent/sanitize.py` (new): the sanitizer.
- `backend/app/modules/intent/parser.py`: the sanitized text goes to the hint, the original question stays in the plan, `AI_NOT_SENT` status, `_judge_hint` with reason codes (`_accept_hint` is replaced), and the log lines.
- `backend/app/modules/intent/groq.py`: the system instruction (only).
- `backend/app/api/advisor_routes.py`: reads the registry once per request and passes the local roots to the parser. The roots are never sent.
- `backend/tests/unit/test_sanitize.py` (new): 24 sanitizer tests.
- `backend/tests/unit/test_intent.py`: new tests for reason codes, NEEDS_TARGET, AI_NOT_SENT, the sanitized-only hint, the reason log, the instruction, and malformed content.
- `backend/tests/unit/test_advisor_routes.py`: new tests for the exact outbound payload, an ambiguous question not being sent, and local resolution being unchanged.

Frontend:
- `frontend/src/types/advisor.ts`: `AI_NOT_SENT` in the status list.
- `frontend/src/components/report/TransparencySection.tsx`: text for `AI_NOT_SENT`.
- `frontend/tests/app.test.tsx`: test for the `AI_NOT_SENT` display.

Governance and specs:
- `docs/specs/spec-4-engineering-intelligence.md` (section 8): the sentence on what may be sent now states the sanitization and the `AI_NOT_SENT` case.
- `.kiro/reports/phase-status.md`: this section.

### 50.9 Status

- Transport: verified in section 48 (unchanged).
- Response contract: fixed for the shapes that Sean can use, with reason codes for every rejection. Not yet verified live: the next live request must confirm it.
- Frontend presentation: the AI reader row shows AI_NOT_SENT, and the other statuses are unchanged. Verified by tests.
- Local repository resolution: unchanged. Verified by a route test and the full backend suite.
- Outbound sanitization: verified offline and by tests. Not yet verified with a live request that reaches the provider.
- Privacy and consent: consent is still per request and off by default. A question that cannot be sanitized is not sent. AI-3 remains OPEN (section 49.7); this step adds evidence, but it does not close the privacy decision.
- The migration is not complete until one authorized live request reaches Groq and returns a reply that Sean accepts.

### 50.10 Remaining decisions and blockers

1. Authorize one live request with a repository reference (for example `sean - Why do layered architectures...`). It must be the only live request in this step. It validates the prompt, the contract, and the sanitized payload together.
2. AI-3 remains open. The owner decides whether a one-sentence, sanitized payload is acceptable. The ZDR setting of the account is still to be checked in the Groq console.
3. The omitted-separator case (49.7, item 3) is unchanged: an identifier at the start without the separator is handled only if it is registered and recognized by the rules above.

## 51. Final live application validation of the Groq path (2026-11-14)

Authorization: the owner authorized exactly one additional live application-level request, with a repository reference, explicit consent for that request, and no retry. Sections 48 to 50 are preserved unchanged.

### 51.1 Offline verification before the live request (no network)

The real `/interpret` route ran in-process, with the real local repository tree of `sean`, and a recording transport in place of Groq. The recording transport captured the outbound payload and returned an answer in the accepted shape, without network access.

- Local resolution: `repository_id = sean`. Repository resolution is local and happens before any AI call.
- Outbound provider calls recorded: 1.
- Outbound payload equals `build_payload("Why do layered architectures keep the HTTP API separate from the application logic?")` exactly.
- Outbound user message: `{"sentence": "Why do layered architectures keep the HTTP API separate from the application logic?"}`.
- Repository ID in the outbound payload (whole-word search): none. Registry root or any part of it (either slash style): none. Drive-letter or absolute path: none.
- Original question: kept in the response, and the caller's text was not modified.

### 51.2 The live request (exactly one; not retried)

- Timestamp: 2026-11-14 21:20:23 UTC (17:20:23 at UTC-04:00).
- Application route: `POST /interpret`, with `text` = `sean - Why do layered architectures keep the HTTP API separate from the application logic?`, `selected_repository_id` = null, `allow_ai` = true.
- Model: `openai/gpt-oss-20b`. Endpoint: `https://api.groq.com/openai/v1/chat/completions`. User-Agent: `Sean/1.0`.

Observed in the backend log (the only observed evidence for the live stages):

| Stage | Observed |
|---|---|
| Groq endpoint reached and answered | `AI interpreter answered in 566 ms` (status `AI_USED`: the response was a valid JSON object) |
| Sean accepted the response contract | `AI answer accepted: ACCEPTED_ADVISE` |
| Route | `POST /interpret HTTP/1.1 200 OK` |

No key, authorization header, question, sanitized text, or reply appeared in the log. The log contained only the fixed lines above.

Not observed, and why: my command printed the timestamp, but the response body did not appear in my output, and the request cannot be repeated. The following fields are therefore inferred from the accepted-answer log line and the route code, and they are not read from the response body:
- `interpreter = groq`, `ai_status = AI_USED`, `mode = ADVISE`, `repository_id = sean`, `target_path = null`, `symbol = null`.
- The response keys are unchanged from the earlier live response (the frontend's exact interpretation key list), because the route code is unchanged. That earlier body was observed.

This gap is recorded as a limitation. It does not change the verdict on the stages that the log proves.

### 51.3 Stage verdict

| Stage | Verdict | Evidence |
|---|---|---|
| Local repository resolution | Verified (offline and live, consistent) | Offline route check; live request was constructed with the same reference |
| Sanitization | Verified offline; the live request sent the same sanitized question | Offline payload check |
| Groq receives the sanitized question | Verified by the live call reaching the provider and returning in 566 ms; the exact bytes received by Groq are not observable from Sean, but the payload is built from the offline-verified sanitized text | Log plus offline check |
| Groq returns a valid response | Verified by the log (`AI_USED`) | Log |
| Sean accepts the response contract | Verified by the log (`ACCEPTED_ADVISE`) | Log |
| The application returns the AI interpretation | Inferred from the accepted-answer path in the code (`interpreter groq`, `AI_USED`); not read from the live body | Code path plus log |
| Frontend-compatible response and AI status | Shape verified on an earlier live body; the values of this response were not read | Partially observed |

Overall: **the Groq integration is validated end to end at the transport, response-contract, and route levels.** The final returned body was not read. A repeat request is needed only to observe it, and it would require a new authorization.

### 51.4 Sanitizer limitation: registered identifiers that are ordinary words

Documented, not changed. The sanitizer removes a registered identifier only in the forms it recognizes with confidence: at the start with a separator, after a repository phrase, or as a name containing a digit, hyphen, or underscore. A registered plain word (for example `sample`, which is registered on this machine) that appears anywhere else makes the whole question unsafe to send. The result is `AI_NOT_SENT`, and the AI reader is not called.

Consequences:
- A question such as "Explain the sample rate in the audio code" is never sent to Groq while `sample` is registered. The deterministic reader answers it.
- The rule is deliberately narrow. A broad substring deletion (removing every occurrence of `sample`) would also remove ordinary words, such as "sampled" or "samples", and change the meaning of the question. It was not added.
- A question that puts a plain-word identifier in a recognized position (`sample - ...`, or `in repository sample`) is sanitized, and the identifier is removed.

Users who hit this case can rephrase the question, or select the repository in the interface, which does not require the identifier to be typed. Changing this limit would need an owner decision on the trade-off between meaning and removal.

### 51.5 Tests and code state

No code or test changed in this step. The last full backend run (1535 passed, 0 failed) and the frontend suites (type check clean; Vitest 593 passed) were executed after the final code change, which is recorded in section 50.7. The offline route check in 51.1 used the same code.

### 51.6 Privacy, consent, account, and ZDR

- Consent: explicit for this one request, set by the request body. It defaults to false and is not stored.
- Outbound content: the sanitized sentence only, with the fixed instruction. No repository ID, name, filesystem path, or registry metadata (51.1).
- Account settings, billing, ZDR, and other privacy decisions: not modified. The ZDR setting of the account is still unconfirmed (section 49.6). AI-3 remains OPEN (section 49.7).

### 51.7 Status

- The Groq path has been exercised by one authorized live request that reached Groq, received a valid answer, and was accepted by Sean's contract.
- The final body was not read, so the application-level response is verified by the log and the code path, not by the body.
- Remaining decisions, unchanged: AI-3 (owner), the account's ZDR setting (owner, in the Groq console), and whether one more authorized request should be made to read the returned body.

## 52. Frontend validation of Groq interpretations (2026-11-14)

Scope: how the frontend consumes, validates, and displays interpretation responses from `/interpret`, including accepted Groq answers. Sections 48 to 51 are unchanged. No live request was made in this step. No production code was changed.

### 52.1 Backend response contract (read from the code, not from a captured body)

`InterpretedRequest` (`backend/app/modules/intent/parser.py`, `extra="forbid"`) has exactly nine fields:
`mode`, `interpreter`, `repository_id`, `target_path`, `symbol`, `question`, `candidates`, `message`, `ai_status`.
- `mode`: INVESTIGATE, ADVISE, NEEDS_TARGET, or UNRESOLVED.
- `interpreter`: `deterministic` or `groq`.
- `ai_status`: one of 12 values (`NOT_REQUESTED`, `NOT_NEEDED`, `AI_USED`, `AI_NO_USABLE_ANSWER`, `AI_NOT_SENT`, `AI_TIMEOUT`, `AI_HTTP_ERROR`, `AI_CONNECTION_FAILED`, `AI_PROTOCOL_ERROR`, `AI_RESPONSE_TOO_LARGE`, `AI_INVALID_REPLY`, `AI_UNEXPECTED`).
- Backend invariant (from the route and parser code): an accepted Groq plan always carries `interpreter: groq` and `ai_status: AI_USED`. An accepted NEEDS_TARGET answer keeps `interpreter: deterministic` and sets `ai_status: AI_USED`.

The frontend type (`frontend/src/types/advisor.ts`) and runtime validator (`validateInterpreted` in `validateAdvisor.ts`) match these nine fields exactly, with the same enums. The validator rejects unknown fields, unknown values, a missing field, and an INVESTIGATE without a repository and path.

### 52.2 Verified by tests (executed)

Representative accepted responses (built from the backend model; the test file says so, and these are not captured bodies):
- Accepted Groq ADVISE: validates, and every value is kept unchanged.
- Accepted Groq INVESTIGATE with a target: validates.
- Accepted NEEDS_TARGET with `AI_USED` and deterministic attribution: validates.
- All 12 AI status values validate. The previous test covered 8, so the four missing values (`AI_NO_USABLE_ANSWER`, `AI_NOT_SENT`, `AI_PROTOCOL_ERROR`, `AI_RESPONSE_TOO_LARGE`) are now covered too.
- Contract violations (a null repository, an unknown interpreter such as `gemini`, candidates as a string, an unknown status) are rejected.

Presentation through the real app (mocked backend responses, real components and analysis flow):
- Accepted Groq ADVISE: the advisory report appears, the interpretation says "Groq helped read the request", the AI reader row says "Answered, and its answer was checked against the repository.", no investigation runs, and the report does not say that the deterministic reader decided.
- Accepted Groq INVESTIGATE: the investigation runs once on the returned target, and the report is attributed to Groq.
- A request without consent: the AI reader row says "Not requested. Sean used its built-in reader.", there is no consent checkbox, and nothing claims Groq helped.
- An accepted but unusable answer (`AI_NO_USABLE_ANSWER`): the row says the answer matched nothing, and the attribution is not Groq.

Already covered before this step and still passing: a failed AI attempt (`AI_HTTP_ERROR`) is shown as a failure, and the report never says "No AI provider was used"; `AI_NOT_SENT` is shown as not sent; a network failure, a rejected response, and an invalid body are each reported with their cause and no result.

Saved reports: a report attributed to Groq with `AI_USED` is saved, reopened, and keeps its attribution and status. A record with an unknown interpreter (`gemini`) or an unknown status is discarded, not shown.

### 52.3 Defects found

None that the frontend's current behavior can reproduce. The frontend reads and displays every field the backend returns, and it attributes each outcome to the source that produced it. No fix was needed, so no production code was changed.

One contract observation (not a defect with the current backend, and not changed): the validator accepts `interpreter: groq` together with an `ai_status` other than `AI_USED`. The backend never returns that combination. Stricter validation would reject it, and that would be a hardening change to be decided separately. It is not applied here.

### 52.4 Tests added (test files only)

- `frontend/tests/validateAdvisor.test.ts`: 5 new tests (accepted Groq ADVISE, accepted Groq INVESTIGATE, accepted NEEDS_TARGET, all 12 statuses, contract violations).
- `frontend/tests/app.test.tsx`: 4 new tests (accepted Groq ADVISE through the report, accepted Groq INVESTIGATE, not-requested consent, unusable answer).
- `frontend/tests/reportStore.test.ts`: 2 new tests (a Groq-attributed report round-trips through save and reopen; unknown interpreter or status is discarded).

### 52.5 Results (executed 2026-11-14)

| Check | Result |
|---|---|
| Frontend type check (`tsc --noEmit -p tsconfig.json`) | Clean, exit 0 |
| `tests/validateAdvisor.test.ts` | 31 passed |
| `tests/app.test.tsx` | 43 passed |
| `tests/reportStore.test.ts` | Passed as part of the full run |
| Frontend Vitest, full suite | **604 passed, 0 failed, 21 of 21 files**, exit 0 |

Backend: no backend code changed, so no backend suite was rerun in this step. The last backend result is in section 50.7 (1535 passed, 0 failed). Browser E2E: no production code changed, so it was not rerun in this step. The last E2E result is in section 50.7.

### 52.6 Files modified in this step

- `frontend/tests/validateAdvisor.test.ts` (tests only)
- `frontend/tests/app.test.tsx` (tests only)
- `frontend/tests/reportStore.test.ts` (tests only)
- `.kiro/reports/phase-status.md` (this section)

### 52.7 Assessment

The frontend consumes the backend's Groq interpretation contract correctly, and it presents AI and deterministic outcomes with their true source. The frontend has no defect that this validation could reproduce. No production code changed. The frontend's handling of a live Groq body is inferred from the representative tests and from the contract match in 52.1, and it has not been checked against a captured live body. Final assessment: **PASS** (no code change was necessary).

## 53. Groq as the default engineering advisor: local evidence, a validated answer, and the report (2026-11-14)

Scope of this change: per-request consent removed; Groq answers by default; local evidence retrieval; a strict answer contract; a prominent AI Engineering Advisor section; persistence; fallback; one startup configuration path. Sections 48 to 52 are unchanged.

### 53.1 Previous and new behavior

- Previous: a checkbox ("Let Groq help read this request") was needed for each request. Groq was used only to read the intent of a question that the local parser could not resolve. The explanations were all deterministic.
- New: Groq is the default AI provider. The checkbox is gone. For every ADVISE or INVESTIGATE analysis, Sean retrieves evidence locally, sends the question and the selected excerpts to Groq once, validates the answer, and shows it first in the report. A failed or invalid answer gives the local result.

### 53.2 Request flow

1. The request is interpreted locally (`POST /interpret`). No provider call happens here. `allow_ai` is refused (400), so old clients fail clearly instead of silently keeping the old consent behavior.
2. For an ADVISE or INVESTIGATE plan, the frontend runs the investigation, the repository profile, and the answer together (`POST /repositories/{id}/answer`).
3. The answer route resolves the repository locally, lists the committed tree at HEAD, and retrieves evidence (`app/modules/answer/evidence.py`). It then sanitizes the question with the registry (`sanitize_for_provider`), and calls Groq once (`service.answer_question`).
4. The answer is validated (`app/modules/answer/contract.py`). A valid answer is shown with its evidence. Any other result is the deterministic result, with its status.
5. The report is saved with the answer. A saved report is re-validated on reopen, and an invalid stored answer discards the report.

### 53.3 Evidence retrieval (local)

- Source: committed files at HEAD, read through the guarded Git runner (`cat-file`). The working tree is not read.
- Selection: files matching the question's words in their path, and files matching a topic when the question names one: deployment (Dockerfile, compose, `.github/workflows`, Kubernetes, Terraform, deploy manifests, platform configs), pipeline, authentication, architecture (README, `docs/`, the backend's own `api`, `modules`, `core` folders), and domain models.
- Excluded: generated folders (`node_modules`, `dist`, `.venv`, and others), binary and image files, sensitive names (`.env*`, private keys, names containing `secret` or `credential`), and files over 64 KiB.
- Limits: at most 6 items, 60 lines and 1,200 characters per item, 6,000 characters in total, and at most 40 candidate files read. Dropped candidates are reported as limitations.
- Redaction before an excerpt is kept: private-key blocks, bearer tokens, provider-style tokens (`ghp_`, `sk-`, `gsk_`, `AKIA`), and lines that assign a value to a secret-looking name.
- Each item has a stable identifier (`E1` to `E6`), its repository-relative path, its line range, the reason it was selected, and the commit.
- Absence is never proven. No retrieved item is reported as "nothing exists", and the limitation says so.

### 53.4 What is sent to Groq

Sent: the sanitized question, the fixed answer instruction, and the selected evidence (identifier, path, line range, reason, commit, classification, and the redacted excerpt). Repository-relative paths are part of the evidence, because the answer must cite them.

Not sent: registered identifiers, folder roots, absolute paths, the registry, the whole repository, excluded or redacted content, and any other file. Tests check this on the exact outbound payload (`test_the_outbound_payload_is_exactly_the_sanitized_question_and_the_original_stays_local`, `test_the_provider_request_never_contains_a_registered_root_or_identifier_from_the_question`).

Untrusted content: the evidence and the question are placed in the user message as data. The instruction tells the model to ignore instructions inside them (`test_injected_instructions_in_evidence_stay_inside_the_data_message`). The provider call has no tools and no filesystem access; the model only returns JSON.

### 53.5 The answer contract

Strict, with `extra="forbid"` on every object: `answer`, `summary`, `claims` (each with `text`, `basis` as DOCUMENTED, INFERRED, or UNKNOWN, and `evidence_ids`), `limitations`, `recommendations`, `confidence` (LOW, MEDIUM, or HIGH), and `answer_type`.

Rules: a DOCUMENTED or INFERRED claim must cite at least one evidence identifier; an UNKNOWN claim cites none; every cited identifier must be one that was retrieved; with no retrieved evidence, every claim must be UNKNOWN. A rejected answer is never shown. Only the reason code is logged (for example `UNKNOWN_EVIDENCE_ID` or `SCHEMA_INVALID:claims.0.basis`), never the model's text.

The frontend validator (`validateAnswer`) applies the same rules, including that a cited identifier must appear in the evidence list.

### 53.6 Fallback

If the provider is not configured, the answer is `NOT_REQUESTED`. If the question cannot be sanitized with confidence, it is not sent and the status is `AI_NOT_SENT`. Timeouts, HTTP errors, connection failures, invalid JSON, unexpected exceptions, and contract violations give their status (`AI_TIMEOUT`, `AI_HTTP_ERROR`, `AI_CONNECTION_FAILED`, `AI_INVALID_REPLY`, `AI_UNEXPECTED`, or `AI_NO_USABLE_ANSWER`). In every case the report still shows the local evidence and says that no AI answer was produced. No retry happens. The investigation and the profile are never discarded because of the answer.

### 53.7 Presentation

- The AI Engineering Advisor section is the first section of the report. For a Groq answer it shows the direct answer, the summary, each claim with its basis and evidence identifiers, recommendations, limitations, confidence, and kind. Each evidence item is shown with its path, lines, reason, commit, and excerpt (rendered as text).
- For a local result it says that no AI answer was produced, lists the limitations, and shows the evidence.
- Transparency: "Default AI provider" states that Groq is the default, what is sent, that retrieval is local, that secrets are redacted, and the 30-day retention for abuse and reliability checks, unless Zero Data Retention applies. It does not say that Groq is used only when a user asks.
- Request screen: no checkbox. A note states whether Groq is configured.

### 53.8 Configuration (one path for both start methods)

- The key is loaded by the application (`app/core/env.py`), from `.kiro/.env` at the repository root, for every start method. Only `SEAN_GROQ_API_KEY` and `SEAN_GITHUB_TOKEN` are read. A value already in the process environment is never replaced. Values are never printed, logged, or returned.
- `scripts/start_backend.ps1` no longer loads the key itself, so the key is not duplicated. The script still sets `LOCALAPPDATA` to a temporary registry folder (see Known limits).
- Verified by `tests/unit/test_env.py` (6 tests), including the rule that the start script does not contain the key name.

### 53.9 Tests and results (executed 2026-11-14)

| Suite | Result |
|---|---|
| Backend, full suite (`pytest tests`) | 1566 passed, 0 failed, 0 skipped, 0 xfailed, 799.5 s, exit 0 |
| Backend, new and changed files | `test_answer.py` and `test_env.py` 40 passed; `test_advisor_routes.py` and `test_answer.py` 69 passed |
| Frontend type check (`tsc --noEmit`) | Clean, exit 0 |
| Frontend Vitest, full suite | 606 passed, 0 failed, 21 of 21 files, exit 0 |
| Browser E2E, default config, first run | 50 passed, 1 failed, 47 skipped (the audio suite, skipped by design) |
| The one failure | `game.spec.ts`: "a player who collects every clue and reaches the exit escapes to the report" ("escaped after 1 attempt"). This is the timing-sensitive full-escape test that phase-status §39 and §42 recorded as the least stable. It was re-run alone and passed (1 passed, 4.0 min). It is not caused by this change, and no test was changed to hide it. |
| Browser E2E, audio config | 47 passed, 0 failed, 31.4 s, exit 0 |

About the counts: the backend suite counts include tests created in this change and the earlier Groq steps. Frontend tests were rewritten for the consent removal: the consent tests were replaced, the presentation tests now use the answer, and the analysis hook test has a default answer.

### 53.10 Files changed

Backend:
- `app/core/env.py` (new): the shared local environment loader.
- `app/main_advisor.py`: loads the local environment before secrets are registered.
- `app/modules/intent/groq.py`: one attempt function (`run_attempt`) shared by the intent hint and the answer, and `build_chat_payload`. The sentence path is unchanged.
- `app/modules/answer/__init__.py`, `evidence.py`, `contract.py`, `service.py` (new).
- `app/api/advisor_routes.py`: the answer route; `allow_ai` removed from `/interpret`, which never calls the provider.
- Tests: `tests/unit/test_env.py` (new), `tests/unit/test_answer.py` (new), `tests/unit/test_advisor_routes.py` (ten tests of the removed consent behavior replaced by the answer-route and refusal tests).

Frontend:
- `src/types/advisor.ts`: answer types.
- `src/features/analysis/validateAdvisor.ts`: `validateAnswer`.
- `src/services/advisorClient.ts`: `answerRequest`; no `allow_ai` in the interpret body.
- `src/features/analysis/useAnalysis.ts`, `analysisMachine.ts`: the answer runs with the other parts and is stored with the report.
- `src/features/report/reportSnapshot.ts`: `answer` and `answerNote` in the snapshot; the stored answer is re-validated on reopen.
- `src/components/report/AnswerSection.tsx` (new), `ReportView.tsx`, `TransparencySection.tsx`.
- `src/components/request/RequestScreen.tsx`: checkbox removed. `src/app/App.tsx`: consent removed from the submit path.
- Tests: `tests/app.test.tsx`, `tests/useAnalysis.test.tsx`, `tests/advisorClient.test.ts` (consent expectations replaced).

Docs and governance:
- `docs/specs/spec-4-engineering-intelligence.md` section 13: dated amendment of the consent paragraph. The superseded text is kept as history.
- `.kiro/reports/phase-status.md`: this section.

### 53.11 Implemented, tested, and unverified

Implemented and tested (automated):
- Consent removed from the request, the client, the hook, the route, and the interface. The interpret route refuses `allow_ai`.
- Evidence retrieval, redaction, limits, and stable identifiers (`test_answer.py`).
- The answer contract, including rejection of unknown and unsupported references (`test_answer.py`, `validateAnswer` tests).
- Provider call: once per answer, no retry, exact outbound payload, instruction and untrusted-content handling.
- Fallback for every failure status, with the local result shown (`test_answer.py`, `app.test.tsx`).
- Report section, transparency disclosure, persistence and re-validation on reopen (`app.test.tsx`, `reportStore.test.ts`).
- Shared configuration loader for both start methods (`test_env.py`).

Not verified:
- A live Groq answer with the new prompt. No live request was made in this change. The first live request must be authorized.
- The response-quality of Groq's answers. Tests use recorded replies that follow the contract, not the model's real output.
- Real retrieval quality on large repositories. Tests use small trees.
- Browser behavior of the answer section beyond the existing E2E journeys, which passed. No E2E test checks the answer text.

### 53.12 Known limits and open gaps

1. NEEDS_TARGET questions still get no answer. A question with no file and no advisory word (for example "Which are the domain models?") resolves to `NEEDS_TARGET` and shows the file chooser. Only ADVISE and INVESTIGATE plans run the answer. This is the largest gap relative to the product goal. Fixing it needs a decision: run the answer alongside the chooser, or treat a no-target question as an advisory question. Either changes the chooser flow and its tests.
2. The sanitizer is unchanged. Registered plain-word identifiers (for example `sample`) still block the AI for a question in which they appear unrecognized (`AI_NOT_SENT`). This is the documented limit from section 51.4.
3. Privacy gate AI-3 is still recorded as OPEN in section 49.7. AI-3 said that source code, file excerpts, and commit messages remain excluded, and that any expansion needs a separate owner decision. This change sends selected evidence excerpts by default, which is that expansion. The owner must record the decision. Until then, the implementation exceeds the recorded privacy gate.
4. The start script still sets `LOCALAPPDATA` to a temporary registry folder (section 50.x and earlier), while a direct uvicorn start uses the default location. So the two start methods can read different repository registries. The provider configuration is now shared, but the registry is not. Changing it needs an owner decision.
5. Groq's live response behavior with the new answer prompt is unverified (see 53.11).
6. The E2E game full-escape test is timing-sensitive (see 53.9).

### 53.13 Final assessment for this change

- Groq is the default for ADVISE and INVESTIGATE analyses, without a checkbox. Verified by tests.
- The answer comes from local evidence and passes a strict contract. Verified by tests.
- Fallback keeps the report usable. Verified by tests.
- NEEDS_TARGET questions are not answered yet (gap 1). That is the first thing to change before the product goal is met.
- Live verification is still required, and the privacy decision (gap 3) must be recorded before the excerpt transmission is treated as approved.


## 54. NEEDS_TARGET answers, AI-3 owner approval, and the live answer check (2026-11-14)
Scope: the owner's decisions of this session. Sections 46 to 53 are unchanged, except where noted in 54.2. Status of this section: partially verified. The answer route was called once live and the contract rejected the reply. The live answer was not shown in the report.

### 54.1 Owner decisions (recorded as given)
1. NEEDS_TARGET: run the AI answer alongside the file chooser. A question that names no file is answered from the repository. The chooser stays available as an optional path for one file.
2. AI-3: approved the transmission of selected, sanitized, redacted repository excerpts to Groq as part of the default Advisor. Conditions: never the whole repository; never `.env` files, credentials, keys, tokens, or secrets; local repository resolution and evidence retrieval stay local; minimum relevant excerpts; repository content is untrusted; no filesystem or execution permissions for Groq. This decision supersedes the E-D13 AI-3 text for this purpose. That text is kept as history in `docs/development/e-d13-optional-ai-provider-decision-record.md`, and it was not edited.
3. One live request to `POST /repositories/sean/answer` with the synthetic question "Why do layered architectures keep the HTTP API separate from the application logic?". Exactly one request was authorized. No retry.
4. Registry location: decision needed (54.5). Not changed.
5. Model: `openai/gpt-oss-20b` kept. Endpoint, authentication, billing, account, and ZDR settings not changed.

### 54.2 Changes
- NEEDS_TARGET (`frontend/src/features/analysis/analysisMachine.ts`, `useAnalysis.ts`, `frontend/src/app/App.tsx`): a NEEDS_TARGET plan with a repository now calls `POST /repositories/{id}/answer` once. It does not start an investigation or a profile. The answer shows above the file chooser through `AnswerSection`, with the state "Sean is answering from the repository's local evidence" while it runs. Choosing a file starts the investigation and carries the answer already produced, so the question is sent to Groq once. A pending answer is stopped when the user chooses a file, and the report then shows that the answer was not finished.
- NEEDS_TARGET answers are shown beside the chooser only. They are not saved as a report. A report saved after a file is chosen includes the answer.
- Excerpt scrubbing (`backend/app/modules/answer/evidence.py`): `redact` now also replaces copies of the registered repository folders with `[LOCAL REPOSITORY]`, and any path under a user profile or `/home` or `/Users` with `[LOCAL PATH]`. The answer route passes the registered roots to `retrieve`. Before this change, excerpts were redacted for secrets only.
- Retrieval topic (`evidence.py`): the architecture topic now includes "architectures", "layered", "http", and "application" and their stems.
- Capability text (`backend/app/api/advisor_routes.py`, `frontend/tests/fixtures/advisor-capabilities.json`): `GET /capabilities` said that only the sentence was sent. It now says what is sent: the question and up to six excerpts, with secrets and local folder paths removed first.
- Spec 4 §8: dated amendment (2026-11-14, owner decision) added, with the approved conditions. The superseded sentence text is kept.
- Tests added: backend `test_answer.py` (2 tests: excerpt scrubbing and a root in another slash form); frontend `useAnalysis.test.tsx` (answer runs alone for NEEDS_TARGET, a failed answer is recorded, a chosen file reuses the answer); `app.test.tsx` (the answer shows beside the chooser and is requested once after a file is chosen). The old assertion that a NEEDS_TARGET request starts no analysis now also checks that the answer runs.
- Copy: the NEEDS_TARGET status line changed from "Sean needs a file to continue." to "Sean answered from the repository. Choose a file to investigate one file in depth."

### 54.3 Offline check of the outbound payload (before the live request, no network)
Run with the same functions the route uses, a recording stand-in, and the registry of the start script (`sean`, `sample`). Results:
- Registry resolution: `sean` resolves to a Git checkout. HEAD is `44c7769b899db3d47479b19e3f45f234b0681890`.
- Sanitizer: the question was sent unchanged (`sanitize_reason` none). The question contains no registered identifier.
- Payload: model `openai/gpt-oss-20b`; top-level keys `messages`, `model`, `response_format`, `temperature`; no tools, functions, or tool choice. User content is 7,477 characters, under the 16,384 limit.
- Evidence: five items, E1 to E4 under `backend/app/api/` and E5 `README.md`, each capped at 1,200 characters. The retrieval limit reported 25 more candidate files that were not read.
- Checks: the API key value is absent; no `.env` path; no local user path; no registered root; no secret-pattern match.
- Limitation found: the architecture documents (`docs/architecture/...`) rank below the API files for this question, because the path ties sort alphabetically. The answer can only cite what the five excerpts show.

### 54.4 The live request (one, no retry)
- Backend restarted through `scripts/start_backend.ps1` at 22:23:46 local time, because the running process was started before this session's changes. The stale process was stopped (two uvicorn processes: the venv launcher and its child). `GET /capabilities` returned `available: true`, provider Groq, model `openai/gpt-oss-20b`.
- Request: `POST http://127.0.0.1:8000/repositories/sean/answer` with the question in 54.1.
- Response: HTTP 200. Client time 3,494 ms. `provider: "deterministic"`, `ai_status: "AI_NO_USABLE_ANSWER"`, `answer: null`.
- Evidence returned: E1 `backend/app/api/advisor_routes.py` 1-27, E2 `backend/app/api/app.py` 1-25, E3 `backend/app/api/local_guard.py` 1-23, E4 `backend/app/api/repository_routes.py` 1-27, E5 `README.md` 1-11. All at commit `44c7769`. Each evidence path resolved against the committed tree at HEAD.
- Limitations returned: "25 more candidate files matched but were not read, because of the read limit." and "The AI answer did not match Sean's contract, so the local result is shown."
- Stage reached: the request reached Groq, and Groq returned a reply that parsed as a JSON object (the service returns `AI_NO_USABLE_ANSWER` only after the transport reports a usable reply). The contract validator then rejected the reply.
- Diagnostic not captured: the rejection reason (`SCHEMA_INVALID:<field>` or a rule code such as `UNKNOWN_EVIDENCE_ID`) is written to the backend log with `logger.warning`. The backend was started in a hidden window, so the log output was lost. The reply text is not kept, by design. No second request was sent.
- Not verified by this request: the answer text, the claims and their evidence references, the frontend validation of a live answer, and the report display of a live answer. These remain unverified against the live model. Tests cover the same paths with recorded stand-ins.

### 54.5 Registry location (not changed; owner decision needed)
Two registry files exist, and their contents differ:
- `%LOCALAPPDATA%\Sean\config\repositories.json` (the default, used by a direct uvicorn start): `sean` to `C:\Users\User\source\repos\Boro`, `sic` to `SIC`, `dp` to `DocumentProcessor`.
- `C:\Users\User\AppData\Local\Temp\sean-i6-runtime\localappdata\Sean\config\repositories.json` (used by `scripts/start_backend.ps1`): `sample` to the runtime fixture repository, and `sean` to `C:\Users\User\source\repos\Sean`.
Both use the identifier `sean` for different folders. A merge needs the owner to choose which `sean` stays, or to rename one. Nothing was written, merged, or deleted. The start script still sets the runtime location, so the two start methods still differ. Options: (a) make `%LOCALAPPDATA%\Sean` canonical, after the owner decides on `sean` and the other entries; (b) keep the runtime location as canonical and remove the default location's use by direct starts. Option (a) matches Architecture section 8.

### 54.6 Verification run after the final changes
- Frontend type-check (`npx tsc --noEmit`): clean.
- Frontend Vitest (`npx vitest run`): 21 files, 608 tests passed (606 before this change, plus 2 new).
- Backend (`pytest tests`): 1568 passed in 11 min 41 s (1566 before, plus 2 new). Exit 0.
- Playwright default (`npx playwright test`): 51 passed, 47 skipped (audio tests gated), exit 0. The game timing test that flaked in section 53 passed in this run. Run time 17.7 min.
- Playwright audio (`playwright.audio.config.ts`): 47 passed, exit 0.

### 54.7 Known gaps and what remains open
- Live answer: unverified. Owner decision: authorize one more `POST /repositories/sean/answer` request, after the backend writes its log to a file, so the rejection reason is recorded. The request must not be retried.
- Registry: 54.5.
- Retrieval: architecture documents are not selected for the synthetic question (54.3).
- Saved reports: a NEEDS_TARGET answer is not saved on its own.
- AI-3: approved by the owner as described in 54.1. This closes the decision, not the live verification.
- E-D13 record: AI-3 text remains as history, and the owner may decide whether to amend it.


## 55. Groq Advisor end to end: evidence relevance, diagnostics, one live request through the UI (2026-11-14)
Scope: complete the Groq Advisor for the user. The repository registry was not changed, merged, or migrated. The model, provider, endpoint, authentication, billing, and ZDR settings were not changed. Sections 46 to 54 are unchanged.

### 55.1 Changes
- Retrieval (`backend/app/modules/answer/evidence.py`):
  - A topic named by a file (for example `architecture-and-project-setup.md` or `architecture.md`) scores 2 points more than a folder match. Before, the first matching topic pattern ended the check, so the architecture document never scored.
  - No single folder supplies more than 2 candidates (`MAX_PER_FOLDER`). Before, the top five were all in `backend/app/api/`.
  - The architecture topic recognizes "architectures", "layered", "http", "application", and "applications".
  - Result for the synthetic question, at HEAD `44c7769`: E1 `README.md`, E2 `.kiro/steering/architecture.md`, E3 `backend/app/api/advisor_routes.py`, E4 `backend/app/api/app.py`, E5 `docs/architecture/architecture-and-project-setup.md`.
- Diagnostics:
  - A rejected answer logs `SCHEMA_INVALID:<field>:<pydantic error type>:<fixed rule text>` (`contract.py`). Pydantic's rule text names the rule and does not echo the model's value. The reason is logged only, never returned.
  - The log now also goes to `%LOCALAPPDATA%\Sean\logs\backend.log` (`backend/app/main_advisor.py`), with the same redaction filter as the console. Under the start script's override, that path is `...\sean-i6-runtime\localappdata\Sean\logs\backend.log`. The registry folder is not used.
- Instruction (`service.py`): the answer instruction now gives the exact JSON shape, the allowed enum values, the 300-character summary limit, the 400-character claim limit, and the limits of 8 claims and 6 evidence IDs per claim. The contract already enforced these limits.
- Disclosure (from 54.2): `/capabilities` describes the excerpts that are sent.
- Tests:
  - `test_answer.py`: a folder is capped at two items; a topic-named file outranks a folder match; a schema rejection names the field and the rule and does not include the rejected value. One existing test (the item bound) now uses one file per folder, because the folder cap would otherwise reduce the count.
  - Backend suite: 1571 passed, exit 0. Previously 1568.

### 55.2 Offline verification before the live request
- Registry: `sean` resolves to a Git checkout at HEAD `44c7769b899db3d47479b19e3f45f234b0681890`. The sanitizer sends the question unchanged.
- Payload: model `openai/gpt-oss-20b`; top-level keys `messages`, `model`, `response_format`, `temperature`; no tools. User content 7,421 characters, under the 16,384 limit. Five evidence items, each capped at 1,200 characters.
- Checks: the API key value is absent; no `.env` path; no local user path; no registered root; no secret-pattern match.

### 55.3 The live request (one, through the UI, no retry)
- The Vite dev server, which proxies `/api` to the backend on `127.0.0.1:8000`, was started by a one-off Playwright configuration outside the repository. The backend was restarted through `scripts/start_backend.ps1` with the final code.
- The test typed `sean - Why do layered architectures keep the HTTP API separate from the application logic?` into the request field and clicked Investigate. The parser split off `sean`, so the answer request carried exactly the authorized question. The test counted exactly one `POST /repositories/sean/answer` request.
- Result:
  - HTTP 200. The request body equals the authorized question.
  - `provider: "groq"`, `ai_status: "AI_USED"`. The log line `AI answer accepted: ACCEPTED` appears at 23:14:03.
  - Answer: "Layered architectures keep the HTTP API separate from the application logic to isolate the interface layer from business logic, enabling clearer separation of concerns, easier testing, and maintainability." Confidence MEDIUM, kind explanation.
  - Three claims: one DOCUMENTED (E3, E4) and two INFERRED (E3, E4; E2, E5). One limitation: the evidence does not state the rationale behind the separation.
  - Every cited evidence ID resolves to one of the five returned evidence items.
  - The page showed the "Generated by Groq" section, the answer text, the summary, all three claims, the limitation, and five evidence entries. The Playwright assertions passed, and the screenshot was saved to `%TEMP%\sean-live\answer-section.png`.
  - Exactly one Groq call happened in this window. The log line "AI interpreter answered in 1566 ms" comes from the shared `run_attempt` helper, which the answer service calls. The label says "interpreter", which is misleading for this call. The interpret route passes `hint=None`, so it makes no provider call.
- The earlier live rejection (section 54.4) was not diagnosed. The instruction and the reason format changed after it, so the cause is not known. This success does not establish what caused the earlier rejection.
- The raw response was deleted from the temporary folder. It held repository excerpts.

### 55.4 Verification after the final changes
- Frontend type-check: clean.
- Frontend Vitest: 21 files, 608 tests passed.
- Backend (`pytest tests`): 1571 passed in 12 min 6 s, exit 0.
- Playwright default: 51 passed, 47 skipped (audio gated), exit 0.
- Playwright audio: 47 passed, exit 0.

### 55.5 Limits and open items
- Retrieval matches path words and topic names. It reads only the first 60 lines of each file. Relevance depends on file names, so a question whose words do not appear in any path can still find weak evidence.
- A NEEDS_TARGET answer is shown beside the file chooser. It is not saved as a report on its own (section 54.2).
- The log label "AI interpreter answered" applies to answer calls too. Renaming it is a cosmetic change, not made here.
- Groq's account setting (ZDR), billing, and the model choice were not changed. AI-3 is decided by the owner as recorded in section 54.1.
- The registry remains as the owner described: the owner removes the incorrect Boro entries. Nothing in the registry was changed by this section.


## 56. UX corrections: the Investigate button starts the game, provider-neutral interface, and the answer inside the report (2026-11-14)
Scope: three owner corrections after testing. No change to the provider, model, endpoint, authentication, billing, ZDR, the registry, the evidence scope, the sanitizer, the answer contract, or the fallback. The backend is unchanged in this section.

### 56.1 Causes
1. The game did not start for some questions. `isInterludeEligible` (`reportSnapshot.ts`) allowed the Ouija and game only for an ADVISE report or an investigation whose classification was narrative-eligible. A repository-level question resolves to NEEDS_TARGET and produces no report, so nothing started the game. The predefined examples worked only because they produce an ADVISE or INVESTIGATE report.
2. Provider names appeared in the interface as literal text: "Generated by Groq" (`AnswerSection`), the "Interpreted by" and "Default AI provider" rows and the status messages (`TransparencySection`), the request-screen note (`RequestScreen`), and the Settings copy (`ListViews`).
3. The answer was placed as the first section after the header, directly above Overview, so it read as part of Overview and was separated from the findings it supports.

### 56.2 The game trigger now
- The Investigate button is the only trigger (`App.tsx`: `armInvestigation`, `submitText`, `submitStructured`). Clicks that the analysis ignores because it is already running do not arm it.
- A ready report (any classification, any question) starts the Ouija, then the game, after the report is saved. This is `onSnapshot` with the classification gate removed. Saved reports never start it.
- A repository-level question (NEEDS_TARGET) starts the game alone, once per click, while the file chooser and the answer stay available underneath. A standalone game ends in the same place as before: the chooser.
- A failed or invalid analysis (ERROR) starts nothing, and a cancelled one starts nothing. This keeps the existing rule ("a failure offers no game in its place", test `horror.spec.ts`). The user can retry with the button. This is my reading of "must not prevent the game from being available through the intended user action"; please confirm it.
- The game is still off when horror mode is off or the game is skipped in Settings.
- Removed: `isInterludeEligible` and `isNarrativeEligible` (`validateResponse.ts`), with their tests, because nothing else used them.

### 56.3 Provider-neutral interface
- No user-facing text names a provider. The strings that changed:
  - Answer badge: "Generated by Groq" is now "AI-generated answer".
  - Transparency: "Interpreted by" text, the "Default AI provider" row is now "AI-assisted answers", and the status messages say "AI service".
  - Request screen note: "AI-assisted answers are on." or "are not configured".
  - Settings: "When you investigate, Sean can show a short fictional interlude, and a game, before the result."
- Privacy disclosure is kept, in neutral words: an external AI service may receive the question (identifiers and folder paths removed) and only the selected evidence excerpts, never the whole repository; secrets are redacted; the service may keep inference data for up to 30 days unless zero data retention is turned on. The consent and sanitization code is unchanged.
- Not changed: the API field `ai_interpreter.provider` (`"Groq"`) and the internal enum values (`"groq"`). The UI does not display them. A test scans the rendered text and the labels, titles, and alt text for "groq", and it passes.
- The interlude sound comment (`director.ts`) was corrected: the interlude runs for every Investigate, and its sounds are fiction.

### 56.4 Where the answer and the report appear
- In a report, the answer is a section directly before the findings (`ReportView.tsx`). Order: header, table of contents (with a new "Answer" link), Overview, History, the answer, Findings, Kiro Advisor, Roadmap, Transparency. The answer is no longer inside or directly under Overview.
- The deterministic fallback uses the same section ("Local result"), in the same place.
- A saved report reopens with the same section and order (the snapshot stores the answer, unchanged).
- A repository-level question shows the answer on the request screen, beside the file chooser, because it produces no report. The answer is not saved. This is unchanged from section 54.2.

### 56.5 Files changed in this section
Frontend source: `src/app/App.tsx`, `src/components/report/AnswerSection.tsx`, `src/components/report/TransparencySection.tsx`, `src/components/report/ReportView.tsx`, `src/components/request/RequestScreen.tsx`, `src/components/shell/ListViews.tsx`, `src/features/report/reportSnapshot.ts`, `src/features/investigation/validateResponse.ts`, `src/features/audio/director.ts` (comment only).
Tests: `tests/app.test.tsx`, `tests/interlude.test.tsx`, `tests/reportStore.test.ts`, `tests/validateResponse.test.ts`, `tests/audio.test.tsx`, `e2e/journey.spec.ts`.
Documentation: `docs/specs/spec-4-engineering-intelligence.md` (§8 is unchanged here; amendments in §9.4 and §10 dated 2026-11-14), `.kiro/reports/phase-status.md` (this section).

### 56.6 Tests
- New tests:
  - Game: a predefined, a custom, a repository-level, and a file-specific question each start the game once (`interlude.test.tsx`). A repository-level question starts the game at once while the chooser and the answer remain. One click starts one game. Typing does not start it. Turning the game off in Settings prevents it.
  - Provider wording: no provider name in the request screen, the settings, a report with a Groq answer, or a saved report restored from storage (`app.test.tsx`). The privacy disclosure is still present.
  - Report: for a Groq answer and for the fallback, the answer is inside the report, after History and before Findings, and never inside Overview (`app.test.tsx`).
  - Browser: a repository-level question starts the game, and the chooser stays available (`e2e/journey.spec.ts`).
- Changed tests (intended by the corrections): the insufficient-evidence and failed-investigation cases now expect the interlude after the button is pressed (`interlude.test.tsx`). The audio test for insufficient evidence now expects the interlude's fiction sound, since silence no longer holds for that case (`audio.test.tsx`). The journey test for an insufficient result now expects the interlude.
- Results after the final code:
  - TypeScript: clean.
  - Vitest: 21 files, 615 tests passed.
  - Playwright default: 52 passed, 47 skipped (audio tests gated), exit 0.
  - Playwright audio: 47 passed, exit 0.
- Flakiness: in one default run, `game.spec.ts` "the game starts after the interruption", "without WebGL the report opens", and "the jumpscare can be turned off" failed, and an isolated rerun of the first one also failed. The same tests passed in later runs, and a debug run that sampled the interlude state showed the Ouija timeline and the game intro appearing about 20 seconds after the click. I have not identified a cause. The 30-second limits are close to the observed timing, so the tests may be sensitive to load.
- Backend: not changed in this section. The last full backend run (section 55) passed 1571 tests.

### 56.7 Limitations and decisions to confirm
- An insufficient-evidence or failed-retrieval report now opens the interlude, which the previous rule excluded. The Ouija text states no conclusion, so the fiction does not reveal a result. Please confirm this is what you want.
- A failed analysis starts no game. A retry does, through the button.
- The answer for a repository-level question is still not saved as a report (section 54.2).
- The backend log label "AI interpreter" also applies to answer calls (section 55.5). The API field `provider: "Groq"` remains in `/capabilities`, which the UI does not show.

## 57. Monster model replaced and aura changed to red (2026-11-14)
Scope: visual only. The monster AI, pursuit, detection, aggression, collision, evidence collection, the first-fragment activation, and game controls are unchanged.

### 57.1 Changes
- Model: sean-monster.glb (copied from the repository root to rontend/public/models/sean-monster.glb, byte-identical, SHA-256 7F2AB28A...). A static mesh: one mesh, no skeleton, no animations, three textures, meshopt-compressed. Loaded with the three.js GLTFLoader and MeshoptDecoder already in the installed three package (no new dependency).
- Placement: scaled to 1.05 tiles tall (the procedural creature's height), centred on the origin, feet on y = 0, turned half a turn so it faces the same way as before (+x in the game frame). Facing was checked on a preview render at four angles.
- Motion: the static model cannot bend, so its motion is a whole-body sway, a forward lean while hunting, a slow breath bob while moving, and the aura pulse. The head no longer turns to follow the player; the monster's facing still follows its yaw.
- Visibility: unchanged rule (hidden until the first evidence fragment). The model is drawn only after it has loaded and the fragment condition holds, so nothing shows before it is ready.
- Loading failure: a console warning is written, and the procedural creature (creature.ts) is shown in place of the model, so the game keeps working.
- Aura: deep crimson, replacing the blue point light: a red point light (0x8a0812), a soft radial red halo around the body (additive, depth-tested off), and a red pool of light on the floor under it. The halo and pool pulse slowly; reduced motion holds them steady. The procedural fallback's light is also red.
- Files: new rontend/src/features/game/monsterVisual.ts (MonsterVisual, same interface the renderer used); enderer.ts (uses MonsterVisual, setShown for visibility, disposes it); creature.ts (fallback light red).

### 57.2 Validation
- Type-check: clean.
- Vitest: 21 files, 615 tests passed.
- Playwright default: 52 passed, 47 skipped, exit 0. Creature tests (horror.spec.ts "creature") passed with screenshots: before the first fragment the room shows no monster; after it the model stands in the corridor with a red aura.
- Playwright audio: 47 passed.
- Not verified: the fallback path (model failing to load) was not run in a browser; it is checked by reading the code only. Frame rate was not measured, so no performance claim is made.

### 57.3 Risk and open items
- Model weight: about 2.0 million triangles and a 22 MB file. The model loads in about one second on the development machine, and it is one draw call. On low-quality settings, or on weaker hardware, this may cost frames. A decimated copy would reduce it; that needs a tool such as gltf-transform, which needs owner approval before it is added.
- Repository size: the 22 MB model is in the repository now. If it is committed, consider Git LFS. The original file also remains at the repository root (sean-monster-model.glb, untracked); I left it in place for you to remove.
- Head turn: the model cannot turn its head toward the player. The procedural creature could.


## Final horror experience pass: investigation independence (approved decision)

- Decision (owner, Option B): a failed, cancelled, incomplete or unavailable investigation no longer blocks the game. It supersedes the earlier rule ("a failure offers no game in its place") recorded above.
- Implemented: App starts the game on ERROR and CANCELLED when the game is enabled, passing the technical reason as investigationNote. GameView shows it as game-investigation-note on the intro card.
- Tests: horror.spec.ts "a failed investigation still starts the game" (new, passes). The quiet-setting failure test keeps its no-game assertion (the game is off there) and waits 60 s for the retried report. Two reruns of that test passed (31.7 s and 31.1 s).
- Not yet done: startup integration tests for delayed, 429/BUSY, malformed, timeout, cancel, repeated and concurrent startup; the reproducible escape seed; the cinematic jumpscare redesign; the institutional archive environment redesign.

## Parallel workstreams: status at this checkpoint (coordinator)

- Workstream B (startup independence): IMPLEMENTED, UNIT-TESTED (679/679), BROWSER-TESTED (startup-scenarios and horror specs, 24/24). Detail: .kiro/reports/ws-b-startup.md. Ownership note: B edited GameView.tsx (intro technical note), which was assigned to Workstream A. The change was reviewed and the browser suite passes. Not accepted until the human reviews the GameView diff.
- Workstream C (cinematic jumpscare): IMPLEMENTED, UNIT-TESTED (cinematic timeline, 23 tests). BROWSER-CAPTURED: ANTICIPATION (90 ms), HOLD (1125 ms), DEFEAT_CARD (2326 ms onward). LUNGE and IMPACT are not captured. NOT VISUALLY INSPECTED: the screenshot folder is denied to the file tool by a permission rule sourced from .gitignore, even though the owner authorized reading frontend/test-results-diagnostics/screenshots/. Status: BLOCKED on visual verification.
- Workstream D (archive environment): IMPLEMENTED, UNIT-TESTED (8 tests), INTEGRATED (renderer hook added and disposed). NOT BROWSER-VERIFIED and NOT VISUALLY INSPECTED for the same reason. Status: BLOCKED on visual verification.
- Workstream A (escape): deterministic harness with hiding policy; seeds 1 to 3 each escape with 0 to 2 catches. Not clean. Status: IN PROGRESS.
- Blocker: the permission rule denying reads under test-results-diagnostics/ (source .gitignore) must be changed by the owner, or the owner must name another explicitly authorized read path. The file tool does not honour the in-chat authorization alone.

## Visual QA checkpoint (coordinator)

- Evidence copied (only the Playwright-generated cinematic frames) to frontend/evidence/visual-qa/cinematic/. Report: frontend/evidence/visual-qa/visual-qa-report.md.
- Workstream C: NOT ACCEPTED. Frames inspected: ANTICIPATION (90 ms label, shows the defeat card), HOLD (1125 ms label, distant pre-lunge pose), DEFEAT_CARD (2326 ms label, close-up, face readable, forearms cut at frame edges). Defect: phase labels are read before the screenshot and do not match the pixels. LUNGE and IMPACT are not captured.
- Workstream D: NO archive screenshots exist yet. Not accepted. The corridor frames show a red wash exceeding the palette brief.
- GameView.tsx ownership crossover (B edited a file assigned to A): documented; B's browser tests pass (24/24); human review of that diff is still required.
- Workstream A: deterministic escape unchanged this checkpoint (seeds 1 to 3, 0 to 2 catches each).

## Visual QA cycle 2 (coordinator)
- Deterministic cinematic capture implemented and passing (e2e/cinematic-deterministic.spec.ts). Evidence: frontend/evidence/visual-qa/cinematic-det/. C: NOT ACCEPTED: hands cut off at bottom edge in LUNGE/IMPACT; red wash persists in archive frames (D2 palette fix not visible in frames). Archive: NOT ACCEPTED.

## Cycle 3 (coordinator)
- Arm reach changed (C2); red-source fix in monsterVisual (D3). Capture v2 in frontend/evidence/visual-qa/cinematic-det-v2/. C: NOT ACCEPTED (left hand clipped at bottom). D: archive base look not yet verified. A: not progressed. B: GameView review complete.

## Cycle 6 (coordinator)
- A: seed 3 clean; seeds 1 and 2 need catches first. PARTIALLY ACCEPTED.
- C: left hand still clipped at bottom edge. NOT ACCEPTED.
- B: not run this cycle. Last verified 24/24 earlier.
- D: partially accepted; hunting-in-view not verified.

## Cycle 7 (coordinator)
- B: 24/24 on current code. Accepted for startup scope.
- A: seed 3 clean; seeds 1 and 2 need catches. Locker-leave correction tried and reverted. NOT ACCEPTED.
- C: left hand still clipped; not corrected this cycle. NOT ACCEPTED.
- D: partially accepted; hunting-in-view open.

## Cycle 8
- C: two single-joint pose iterations; left hand still clipped at bottom edge. NOT ACCEPTED. Current graspBones holds iteration 2 (not accepted).
- A: route correction not implemented this cycle. NOT ACCEPTED.
- B, D: unchanged.

## Cycle 11 status (A and C)
- A (escape): IMPLEMENTED and BROWSER-TESTED. Three-seed clean run: seeds 1, 2, 3 each ESCAPED on attempt 1, 0 catches. Browser-tested only. NOT ACCEPTED: seeds 2 and 3 produced byte-identical traces, so the three runs are not independent. Owner decision needed on the seed-to-world mapping.
- C (cinematic hand pose): IMPLEMENTED, BROWSER-TESTED, VISUALLY INSPECTED (LUNGE, IMPACT, HOLD, DEFEAT_CARD, ANTICIPATION). ACCEPTED against the stated criteria. Remaining defect: ACCELERATION 0.40 s, screen-left hand 15 px past bottom edge (pre-lunge, not an acceptance frame).
- Temporary probe, pose override and sweep specs removed. setSafetyRouting kept for the capture specs.
- B: unchanged this cycle. D: unchanged this cycle.

## Cycle 12 status
- A (escape): IMPLEMENTED; UNIT-TESTED (seedMixing 4 tests); BROWSER-TESTED (three seeds, two reproducible runs, retries disabled). Criteria for the three worlds are met. NOT ACCEPTED: the seed-mixing change makes gameBalance.test.ts fail (0.5875 vs 0.65). Needs owner decision on the difficulty re-baseline.
- C (cinematic): LUNGE/IMPACT/HOLD/DEFEAT_CARD accepted in Cycle 11. ACCELERATION NOT ACCEPTED (hand 15 px past bottom edge, cycle 11 frame). Cycle 12 probe attempt produced an invalid capture; no new evidence.
- B: unchanged. D: unchanged.

## Cycle 13 status
- A (escape): IMPLEMENTED; balance regression explained (sampling noise, stream verified). Balance suite 6/6 with 400 seeds (test-method change needs owner review). Closest-approach driver implemented, not yet run. NOT ACCEPTED.
- C (cinematic): NOT ACCEPTED. ACCELERATION unresolved. Caught close-up breaks with the seed-mixed stream (valid under the old stream). Blocker: caught placement for seed 1 attempt 1 under the new stream.
- B, D: unchanged.

## Cycle 14 status
- A (escape): ACCEPTED on the current code. Balance 6/6 with the approved 400-seed sample (148 s). Three seeds escape first attempt, zero catches, zero retries, reproducible twice. Closest approach 0.815 (seed 1) every frame, above the 0.75 threshold.
- C (cinematic): NOT ACCEPTED. Root cause established (corner-catch reach clamp: MIN_REACH 0.2 below CREATURE_DEPTH 0.315 with 0.15 tiles open). Regression fixture added (known-defect marker). Fix needs owner decision on framing or catch rule. ACCELERATION uncorrected.
- B, D: unchanged.

## Cycle 17 status
- C (cinematic): ACCEPTED. Pose v7 plus APPROACH_TILT -0.25. All six phases inspected and passing for open, enclosed (seeds 1, 2, 3), near-wall and worst-case locker catches (evidence/visual-qa/cinematic-cycle17/). Temporary diagnostics removed. tsc exit 0; vitest 707/707; Playwright cinematic 1/1, game and escape 13/13.
- A, B: unchanged and accepted. D: not touched.
## Cycle 18 status
- C (cinematic): ACCEPTED after a narrow right-arm correction (GRASP_RIGHT_ARM targets plus rightArmWeight; root cause: a backward forearm rotation and a level clavicle in the old .R offsets). Open and enclosed catches recaptured and inspected (evidence/visual-qa/cinematic-cycle18/final-*). tsc exit 0; vitest 709/709; Playwright cinematic 1/1, game and escape 13/13.
- A, B, D: not touched.
## Cycle D4 status (Workstream D, Archive)
- D: ACCEPTED against the stated criteria. Decoration collision works for the player and the creature with routes open (0 overlaps; creature clearance 0.29). Drawers and shelves are separate objects. Corridors are readable and still dark. Hunting frames were captured and inspected (archive-cycle-d4/final2-medium, final2-low).
- Results: tsc exit 0; vitest 720/720; Playwright cinematic, game and escape 14/14 in one command; archive-qa 2/2.
- A: escape gate seeds changed from [1, 2, 3] to [2, 3, 4] (seed 1 is caught after the now-solid cart changes its route; 37 of 40 seed outcomes unchanged). Owner review requested. Also fixed a pre-existing setSafetyRouting leak from cinematic-deterministic.spec.ts.
- C: cinematic recaptured and inspected with the new lighting: no regression. B: not touched.
- Known: e2e/archive-states.spec.ts is a pre-existing failure, superseded and left unchanged.
## Archive visual restoration (post-acceptance refinement of D)
- 18 of the 20 decorations dropped in cycle D4 are restored on their own tiles. fitAlongWall shifts each item along its wall to keep 0.3 clear at doorways and wall ends. The junction bookshelves use a narrow variant. A waste bin's end-face step uses the wall direction. Two items stay unplaced.
- Results: tsc exit 0; vitest 724/724; archive-qa 2/2 at medium and low (8 wall-hugging walks, 0 stalls, 0 overlaps); cinematic 1/1; game 10/10.
- Escape gate [1, 2, 3] restored and failing: seed 3 escapes; seeds 1 (also failing on the accepted D layout) and 2 are caught on attempt 1. Owner decision required; seeds not changed.
- D: remains ACCEPTED. A, B, C: no regression observed apart from the escape gate result above.
## Pre-publication audit (README, media, repository hygiene)
- README.md rewritten from the audited code. Media moved to docs/media/ under their exact names, byte-identical: sean-banner.png, sean-demo.gif, sean-jumpscare.gif. They are not optimized; a re-encode gave no saving.
- Cleanup: 20 ignored Python cache folders removed. .gitignore reviewed: no accidental exclusions and no change needed.
- Validation:
  - pytest 1571 passed; vitest 724/724; typecheck exit 0; build exit 0.
  - Playwright default config: 72 passed, 3 failed (archive-states; escape seeds 1 and 2), 47 skipped. Audio config: 47/47.
  - Documented launch verified: frontend 200, /api proxy 200.
- Escape gate [1, 2, 3]: seed 3 passes; seeds 1 and 2 fail on their first attempt. Unchanged, owner decision.
- Owner decisions before publication: monster model provenance and licence; size of the untracked models (root 92 MB, public/models 95 MB, of which production uses 16.4 MB); 387 MB of visual QA evidence (131.6 MB marked superseded or invalid); sean-demo.gif at 56.4 MB (over GitHub's 50 MB warning); machine paths in .kiro/settings/mcp.json and scripts/start_backend.ps1; the archive-states spec.
- Nothing committed or pushed.
