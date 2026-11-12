# Sean — Phase 3 Closure Report (MVP Implementation)

**Date:** 2026-11-10.
**Scope:** Phase 3, increments I0 to I6 of the recovered plan (`docs/development/i5-i6-backend-implementation-plan.md`), and the Native Evidence Retrieval tasks in `.kiro/specs/evidence-retrieval/tasks.md`. The frontend is not an I0 to I6 backend task and is not assessed here.
**Status of this report:** a technical closure assessment. **It accepts nothing.** Owner acceptance is the owner's decision.

**Latest verdict:** section 18 (owner decisions, remediation, acceptance, and closure, 2026-11-12) supersedes sections 1 to 17. Those earlier sections are kept as the historical record of the earlier passes.

## 1. Executive verdict

**BLOCKED.**

The backend is implemented and verified to the extent that the approved contracts allow. The HTTP API and the MCP STDIO server run and are tested. Retrieval, classification, explanation, and the security controls are tested end to end over disposable repositories.

Phase 3 cannot be recommended for closure yet, for these reasons:

1. **Dependencies are not reproducible.** No manifest or lockfile exists. D01 requires separate authorization to create one (section 6).
2. **Two required pieces depend on owner decisions that are still open:** PR and issue association (G-M, not approved) and the SQLite cache (Task 10, invalidation depends on D06). Spec 1 §7 lists both as requirements ("validate... before associating" and "cache suitable responses"). They are blocked, not deferred (section 4).
3. **OD-5 numeric limits and Task 16.1 are unapproved.** The limits are implemented as proposed defaults and centralized. They are not owner-approved.
4. **MCP runtime enablement (C-D7) and Kiro runtime verification (MCP-18) are not done.** The production configuration `.kiro/settings/mcp.json` is unchanged and remains unverified in Kiro.
5. **Governance inconsistencies need an owner decision:** the `tasks.md` header "NOT APPROVED. No task may start.", re-approval of the design and task files amended under owner authorization, and the five MCP contract differences (G1 to G5).
6. **No owner acceptance exists for I2 to I6.** I1 is accepted.

No technical defect is known to block a Phase 3 closure once these owner decisions and authorizations are recorded. The work needed to clear each blocker is in section 10.

## 2. I0 to I6 status

| Increment | Scope | Implementation | Verification | Acceptance | Blockers |
|---|---|---|---|---|---|
| I0 | Initial MVP preparation | Complete | VERIFIED (phase-status §4) | Verified. Not an acceptance | None |
| I1 | Repository registry and core paths (Tasks 1.1 to 1.3) | Complete | UNIT_VERIFIED, 83 tests (§7) | **OWNER_ACCEPTED** (§7) | None |
| I2 | Evidence model and canonical identity (Tasks 7.1 to 7.3) | Complete | UNIT_VERIFIED (§17, §18) | NOT ACCEPTED | Owner acceptance |
| I3 | Git history and evidence retrieval (Tasks 2.x, 3.x, 4.x, 5.x, 6.x) | Complete | UNIT_VERIFIED. Security review and fixes (§25) | NOT ACCEPTED | OD-5 values; owner acceptance |
| I4 | GitHub integration (Tasks 9.x) | Complete | UNIT_VERIFIED (§25) | NOT ACCEPTED | E-D15 token variable name; owner acceptance |
| I5 | Investigation and explanation (Tasks 8, 11, 12, 13; orchestration; Task 10 cache) | Ranking, classification, result assembly, deterministic explanation, orchestration: complete. Association and cache: not implemented | UNIT_VERIFIED and INTEGRATION_VERIFIED (sections 3 and 5) | NOT ACCEPTED | **G-M association (owner decision). Task 10 cache (D06, D07). F1 classification clarification (owner decision)** |
| I6 | API, system integration, MCP (Tasks 15.2, 16.2, 17; configuration Task 16.1) | HTTP route, MCP tools, STDIO entry point, diagnostics: complete. Task 16.1 values: proposed only | UNIT_VERIFIED and RUNTIME_VERIFIED (sections 6 and 7) | NOT ACCEPTED | **Task 16.1 values (OD-5). C-D7 and MCP-18 Kiro runtime. G1 to G5 contract decisions** |
| Task 14 (I5, optional) | Optional AI wording | Not implemented | Not applicable | **DEFERRED** by owner decision (E-D13 record §9) | None for Phase 3, which does not require it |

Phase 3 status: **IN_PROGRESS** until the owner decisions in section 10 are recorded and I2 to I6 are accepted.

## 3. Completed work and exact references

| Area | Implementation | Tests |
|---|---|---|
| Deterministic explanation | `backend/app/modules/explanation/templates.py` (`explain`, `limitation_sentence`, `LIMITATION_SENTENCES`) | `backend/tests/unit/test_explanation_templates.py` (42 tests), `backend/tests/unit/test_explanation_integration.py` (6) |
| Limitation sentences in results | `backend/app/modules/investigation/orchestrator.py` (uses `limitation_sentence`) | `test_investigation_orchestrator.py`, `test_explanation_integration.py` |
| Classification | `backend/app/modules/investigation/classification.py` (unchanged) | `test_investigation_classification.py`; end-to-end in `test_explanation_integration.py` |
| Git subprocess lifecycle | `backend/app/core/git_runner.py` (Windows Job Object with kill-on-close; `taskkill /T` fallback; incomplete output never reported as success) | `backend/tests/unit/test_core_git_runner.py` (30 tests, including descendant, orphan, and reader-failure cases) |
| Centralized limits | `backend/app/core/limits.py` (MCP bounds, registry bounds, and process wait bounds moved here) | Existing suites; `test_repository_registry.py` imports from the registry, which re-exports |
| HTTP API | `backend/app/api/app.py` (`create_app`, `POST /investigations`) | `backend/tests/unit/test_api_investigations.py` (ASGI, 12), `backend/tests/integration/test_http_e2e.py` (real process, 11) |
| MCP tools | `backend/app/modules/mcp/tools.py`, `server.py`, `__main__.py` | `test_mcp_tools.py`, `test_mcp_server.py` (STDIO), `test_mcp_contract.py`, `test_mcp_number_input.py` (DEC-15), `test_mcp_github_success.py` |
| Registry | `backend/app/modules/repository/registry.py`; entry points load `default_registry_path()` | `test_repository_registry.py`, `test_mcp_contract.py::test_entry_point_loads_the_approved_registry_path` |
| Diagnostics and redaction | `backend/app/core/diagnostics.py` | `test_core_diagnostics.py`, `test_api_investigations.py`, `test_http_e2e.py` |
| GitHub retrieval | `backend/app/modules/github/client.py` (HTTPS, no redirects, timeouts, body bound, identity checks) | `test_github_client.py`, `test_mcp_github_success.py` |

## 4. Outstanding items and dispositions (consolidated checklist)

| # | Item | Source and reference | Mandatory for MVP? | Current status | Action required | Verification | Disposition |
|---|---|---|---|---|---|---|---|
| 1 | F1: INFERRED unreachable | Spec 1 §10.1, §10.4; `classification.py` | Yes (the four classifications must be supported) | Behaviour is correct for the implemented question (what changed). INFERRED is structurally unreachable under the current pipeline, because co-changed documentation is discovered only through commits that touched the target (see section 5) | Owner decision: accept the documented clarification, or approve a new inference target | End-to-end test `test_co_changed_documentation_is_reported_without_claiming_intent` | **Blocked on owner decision** |
| 2 | G-M: PR and issue association | Spec 1 §2 ("when available"), §7 (validate before associating); Native requirement 5.1 to 5.3 | Conditional. The requirement applies when association happens, and the mechanism is not approved | Not implemented. G-M is not approved. Ranking awards no PR or issue criterion | Owner decision: approve a mechanism, or formally defer association with a Spec 1 §7 amendment | None until decided | **Blocked on owner decision** |
| 3 | Task 10: SQLite cache | Spec 1 §7 ("cache suitable responses"), §14 (cache optional; invalidation explicit); native Task 10 ("define invalidation after D06") | Partly. A cache is optional, but §7 lists caching as a requirement | Not implemented. D06 (invalidation) and D07 (location) are open | Owner decision on D06 and D07, or an amendment that defers the cache | None until decided | **Blocked on owner decision** |
| 4 | Explanation accuracy and coherence | Spec 1 §10.4, §11.1 | Yes | Improved and tested (section 5). Symbol conclusions name only the path | None | 33 unit and 6 integration tests | **Resolved** |
| 5 | MCP G1 to G5 | D02 §16.5, §16.8 (proposed, not approved as a whole) | No. D02 §16 is PROPOSED except DEC-15 | Five strict expected failures remain. Each one is a difference from a proposal (section 7.3) | Owner decision: amend D02 §16, or change the implementation | Strict xfails in `test_mcp_contract.py` | **Retained with reasons (section 7.3). Owner decision required** |
| 6 | MCP runtime enablement and Kiro runtime verification (C-D7, MCP-18) | Architecture §12.2; D02 §12, §16.11 (MCP-18) | Yes for enablement | `mcp.json` unchanged. The configured command is `<venv>\Scripts\python.exe -P -m app.modules.mcp` with `PYTHONPATH`, and it is verified over STDIO. The Kiro runtime was not exercised in this session, and the configuration's enabled state is unverified | Owner decision C-D7 and a Kiro runtime test, which requires the Kiro client | Manual STDIO check (phase-status §32.3); automated `test_stdio_handshake...` | **Blocked on owner decision and environment** |
| 7 | Windows process-tree termination | `git_runner.py` | Yes (Requirement 15.2; D02 MCP-17) | **Implemented** with a Job Object. Residual: a descendant created before assignment (see section 7.4) | Owner acknowledgement of the residual | `test_orphaned_descendant_is_stopped_when_the_direct_child_exits_first`, `test_timeout_also_stops...` | **Resolved, with a documented residual** |
| 8 | HTTP API verification | D02 and design C.11 | Yes | Verified: success, PARTIAL, insufficient, invalid input, unknown fields, malformed JSON, unregistered, unavailable, ambiguous, traversal, sanitized output, graceful shutdown | None | 11 real-process tests; 12 ASGI tests | **Resolved** (Category C live response not observed; section 6) |
| 9 | MCP tool equivalence and safety | Spec 1 §12; D02 MCP-05, MCP-08, MCP-16, MCP-17 | Yes | Four tools registered; shared logic reused; DEC-15 enforced; GitHub success path covered | None | `test_mcp_*` suites | **Resolved** (MCP-10 not run, section 7.5) |
| 10 | OD-5 numeric limits and Task 16.1 | `limits.py`; OD-5; O-G1; Task 16.1 | Yes | Values are proposed defaults, centralized in `limits.py`. The MCP blame span (500) and the core line span (2000) differ for the same concept | Owner decision on every value, and on which blame span applies | Boundary tests in the affected suites | **Blocked on owner decision** |
| 11 | `tasks.md` header "NOT APPROVED. No task may start." | `tasks.md` line 7; phase-status §23 (OD-16) | Governance | Conflicts with the OD-16 approval of the hash | Owner decision (see section 10) | Not applicable | **Blocked on owner decision** |
| 12 | Amended design and task files | `design.md` (3 edits), `tasks.md` (2 edits in Task 14); E-D13 record §9 | Governance | Applied under owner authorization. OD-16 hashes no longer match. Re-approval not recorded | Owner re-approval | Hashes in section 11 | **Blocked on owner decision** |
| 13 | Dependency reproducibility | D01 "Locking approach"; Architecture §19 | **Yes** (Phase 3 exit criterion) | No `pyproject.toml`, requirements file, or lockfile in the repository. The venv contains 38 packages, including pip (section 8) | Owner authorization to create a manifest and a hash-pinned lockfile (D01 requires separate authorization) | `pip check`: clean. No lock file to verify | **Blocked on authorization** |
| 14 | F1 documentation | This report, section 5 | Yes | Documented clarification in place | Owner decision | None | **Blocked on owner decision** |
| 15 | Task 14 (optional AI) | E-D13 record §9 | No | Deferred by owner decision | None | None | **DEFERRED** (accepted by owner) |
| 16 | Security review | `review-security` and `security-auditor` findings | Yes | Two independent reviews this session. Findings fixed or recorded (section 7.4) | Owner acknowledgement of residuals | Sub-agent reports, phase-status §37 and §38 | **Resolved, with residuals** |
| 17 | Repository baseline | Git state | Governance | The repository has no commits in the recorded baseline. Changes are untracked, so no diff baseline exists | Owner decision on a baseline commit (not made here) | `git status` | **Recorded only. No commit made** |

## 5. Classification (F1): documented clarification, no rule change

**Question.** Why does INFERRED never appear in a real investigation?

**Finding.** Documentation evidence is discovered only through commits that changed the target path (`history.py`, co-change). Every such commit also produces a `GIT_COMMIT` record with a verified relation to the target (`classification.py`, `is_verified_support`). Under the classification rules, any verified support with COMPLETE retrieval classifies as DOCUMENTED. The INFERRED branch is reached only when no verified support exists and documentation co-change exists. The retrieval pipeline cannot produce that combination for the target.

**Epistemic check.** Spec 1 §10.1 defines:

- `DOCUMENTED`: available evidence directly documents the relevant fact or rationale.
- `INFERRED`: the explanation is a reasoned interpretation supported by evidence, but not directly documented.

The investigation's answer is the fact that the target changed. A verified commit documents that fact directly, so DOCUMENTED is the correct classification for that answer. Co-changed documentation does not document a rationale, and the explanation says so ("That co-change does not establish a content relation or intent"). Because the product does not produce an interpretation of why, INFERRED has no current use.

**Resolution.** No code change. The current behaviour is consistent with Spec 1 §10.1 for the implemented question. The owner must decide one of the following:

- Accept this clarification, and record that INFERRED is reserved for a future interpretation target.
- Approve a new inference target (for example, a rationale interpretation drawn from co-changed documentation). That is a product contract change, so it needs an approved amendment, not an implementation.

**Test.** `test_explanation_integration.py::test_co_changed_documentation_is_reported_without_claiming_intent` runs the real investigation path and asserts DOCUMENTED, with the co-change sentence.

## 6. HTTP API verification

Evidence: `backend/tests/integration/test_http_e2e.py` (11 tests, each against a real uvicorn process on 127.0.0.1, with a temporary registry and disposable repositories).

- Success: COMPLETE with DOCUMENTED, and a sanitized response.
- Insufficient evidence: abstains, with no conclusion.
- PARTIAL: a shallow clone returns PARTIAL with `SHALLOW_CLONE`.
- Ambiguous target: 409 with the candidates `A.run` and `B.run`.
- Unregistered repository: 404. Unavailable repository (root removed after startup): 503.
- Traversal: 400, value not echoed. Unknown field: 400 naming the field. Malformed JSON: 400, no field.
- No response contains the repository path or the fake token. The log contains neither.
- Graceful shutdown: the log shows "Shutting down", "Application shutdown complete", and "Finished server process". Exit code 3 on Windows is explained: Uvicorn re-raises the captured `SIGBREAK` (uvicorn `server.py`, `capture_signals`), and a probe that re-raises it exits with code 3 on this machine.

**Not observed:** a live Category C (500 `INTERNAL_ERROR`) response. It is covered by an ASGI test that replaces the orchestrator with a function that raises the invariant error (`test_api_investigations.py::test_category_c_violation_is_500_without_rule_name`). A live fault-injection test would need a test-only seam in production code, which was not added.

## 7. MCP verification

### 7.1 Tools and transport

Four tools are registered: `search_history`, `blame_range`, `get_pr`, `get_issue`. Each calls shared logic: the investigation orchestrator, `git_history.blame`, and the GitHub client. The tools contain no Git, GitHub, ranking, or classification logic. This is checked by an AST test (`test_mcp_16_mcp_package_contains_no_retrieval_or_ranking_logic`).

The STDIO handshake was verified with the exact `mcp.json` launch shape: `-P -m app.modules.mcp`, with `PYTHONPATH` set. The process exits 0 after stdin closes, and stderr is empty.

### 7.2 Input contract

- DEC-15 (approved): `number` is a positive decimal string. ASCII digits only, leading zeros canonicalized, no upper bound. JSON integers are rejected by the schema.
- `max_results` 1 to 50 and the blame span limit are proposed in D02 §16.6 and centralized in `limits.py` (OD-5).

### 7.3 G1 to G5: retained, each with its reason

Each retained failure is a difference from D02 §16, which is PROPOSED and not approved as a whole. None is a violation of an approved requirement.

- **G1** (`test_mcp_08_failed_rows_carry_retrieval_status_failed`, 2 cases). D02 §16.5 and §16.8 specify a `FAILED` envelope. The implementation returns `{error, message, retryable}`. Spec 1 §12 requires structured errors, which the implementation provides. The envelope shape is a proposal. **Retained: owner decision on the envelope.**
- **G2** (`test_mcp_08_path_escape_uses_path_outside_repository_code`). D02 §16.8 expects `PATH_OUTSIDE_REPOSITORY`. Traversal is rejected as `INVALID_INPUT`, which satisfies Spec 1 §13 (containment). The code name is a proposal. **Retained: owner decision on the code.**
- **G3** (`test_mcp_08_no_history_reports_no_evidence_found`). D02 expects `NO_EVIDENCE_FOUND`. The implementation emits `NO_HISTORY_RETRIEVED`, which states the same fact. **Retained: owner decision on the code name.**
- **G4** (`test_mcp_08_result_limit_adds_result_limit_reached`). D02 expects `RESULT_LIMIT_REACHED`. Truncation at `max_results` is a presentation limit, not an incomplete retrieval, so Spec 1 §10.2 does not require it. **Retained: owner decision on whether the row applies.**
- **G5** (`test_mcp_08_symbol_absent_from_current_state_reports_its_code`). D02 expects `TARGET_NOT_IN_CURRENT_STATE` in MCP output. The HTTP response carries it as `target.resolution`. Spec 1 §10.4 requires limitations for incomplete coverage, which the MCP output provides. **Retained: owner decision on whether MCP carries the resolution.**

### 7.4 Security review and residuals

Two independent reviews this session (review-only security-auditor sub-agent; `review-security` skill). Fixed:

- Timed-out Git calls blocked on descendants that held output pipes (120 seconds measured). Now bounded.
- Partial output could be returned as success when a descendant held a pipe. Now `GIT_TIMEOUT`.
- A reader that failed mid-read counted as finished. Now recorded as `GIT_FAILED`.
- An unbounded `process.wait()`. Now bounded.
- The Git child could outlive an exception during collection. Now stopped in `finally`.
- A job handle could leak on non-OS exceptions. Now closed.
- The test helpers used bare `git` and the developer's Git configuration. Now absolute and isolated.
- The HTTP test cleanup handler had no containment check. Now bounded to the fixture and refuses reparse points.
- Explanation text could carry bidirectional and control characters. Now replaced.

**Residuals (not fixed, recorded):**

- **R1. Descendant created before job assignment.** The child runs between `Popen` and `AssignProcessToJobObject`. A descendant created in that window is not in the job. The guards disable external diff, textconv, hooks, credential helpers, and gpg, which makes this unlikely. Closing it needs a suspended start and `ResumeThread`. **Owner acknowledgement.**
- **R2. No job object available.** If job creation or assignment fails, the fallback is `taskkill /T`. It cannot reach a descendant whose parent exited. The condition is logged as the fallback path only, not as an error.
- **R3. `ai_available` is hard-coded to `False`** in the diagnostic log. The provider is deferred, so the value is not used for behaviour.
- **R4. Pre-existing bare `git` in `backend/tests/unit/conftest.py`.** Test-only. Recorded.
- **R5. Port race in the HTTP test's port probe.** Test-only.
- **R6. The `taskkill.exe` fallback is a new system-binary invocation.** It uses an absolute path, an argument array, and an integer PID. Owner awareness is requested (section 10).

### 7.5 Not executed

- MCP-10 (determinism, Hypothesis). Hypothesis is not installed and is not authorized.
- MCP-18 (Kiro runtime). Requires the Kiro client and C-D7.
- Live Category C over HTTP (section 6).

## 8. Dependencies and reproducibility

- **Declarations present:** none. No `pyproject.toml`, `requirements*.txt`, lockfile, `Pipfile`, or `setup.*` exists in the repository root or in `backend/` (checked 2026-11-10).
- **Installed set (evidence only, not written to the repository):** 38 packages, including pip, in `backend/.venv`, including `fastapi` 0.162.2, `pydantic` 2.14.3, `pydantic_core` 2.50.4, `uvicorn` 0.54.0, `mcp` 2.3.0, `mcp-types` 2.3.0, `pytest` 9.2.0, `starlette` 1.10.0, `httpx2` 2.16.0, `pywin32` 312, `cryptography` 50.0.2, `PyJWT` 2.15.1, and their transitive dependencies.
- **Direct imports in Sean:** `fastapi`, `pydantic`, `mcp`, and the standard library, plus `pytest` in tests. `httpx2` is a transitive dependency of `mcp`, and no Sean code imports it.
- **Verification:** `pip check` reports no broken requirements. `python -W error` imports pass for `app.main` and the MCP, explanation, runner, and limits modules.
- **Gap:** the installed set is not declared or hash-pinned. D01 requires a hash-pinned lockfile at the lock step, and creating one needs separate owner authorization (D01). Kiro did not create one.

## 9. Test results (final run, 2026-11-10)

Command, from `backend`: `& '.\.venv\Scripts\python.exe' -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider`.

- **1031 passed, 0 failed, 0 skipped, 6 xfailed** (duration 267.85 s).
- The six xfails are G1 to G5 (section 7.3), each strict, so each would fail if the behaviour changed without its test being updated.
- Focused suites in this session: Git runner, Git history, blame, orchestrator, registry, paths, MCP tools and contract, MCP GitHub success, and the HTTP end-to-end suite, 352 passed and 6 xfailed.
- `pip check`: no broken requirements found.
- Import checks with `-W error`: `app.main`, and the MCP, explanation, Git runner, and limits modules, all exit 0.

Earlier checkpoints recorded other counts (for example 914, 972, and 1024). Each was a run at its own time and is not carried forward.

## 10. Unresolved owner decisions

Each item states the exact decision, the options, the consequence, and the tasks it blocks.

1. **G-M, PR and issue association.** Options: (a) approve a mechanism (for example, extraction of GitHub references from commit messages, validated against repository identity before use), or (b) formally defer association through an amendment to Spec 1 §7. Consequence: until decided, PR and issue evidence is never associated, and the PR criterion stays at zero. Blocks: I5 acceptance.
2. **Cache (Task 10).** Options: (a) decide D06 (invalidation) and D07 (location), then implement, or (b) amend Spec 1 §7 and §14 to defer the cache. Consequence: GitHub responses are fetched live every time. Blocks: I5 acceptance, and Spec 1 §7 completion.
3. **OD-5 numeric limits and Task 16.1.** Decide each value. Decide which blame span applies: 500 lines (MCP, D02 §16.6) or 2000 lines (core, `MAX_LINE_SPAN`). Consequence: the values in `limits.py` remain proposed. Blocks: Task 16.1 and I6 acceptance.
4. **G1 to G5.** Options: (a) amend D02 §16 to match the implementation, or (b) change the implementation to match D02 §16. Consequence: five strict expected failures remain. Blocks: MCP contract acceptance.
5. **MCP enablement (C-D7) and Kiro runtime (MCP-18).** Decide whether to authorize a Kiro runtime test, and whether `mcp.json` stays enabled before that test. The configuration has no `disabled` key, so its enabled state in Kiro is unverified. Blocks: MCP runtime acceptance.
6. **Dependency manifest and lockfile.** Authorize creation of a hash-pinned lockfile under D01. Consequence: dependencies are not reproducible until it exists. Blocks: the Phase 3 exit criterion "dependencies are reproducible."
7. **`tasks.md` header.** Decide whether the header "NOT APPROVED. No task may start." is stale, and whether the file needs re-approval. Consequence: the file's own status blocks task starts, and the OD-16 record conflicts with it. Blocks: governance closure.
8. **Amended design and task files.** Decide whether the three `design.md` edits and two `tasks.md` edits in Task 14 are approved as amended (hashes in section 11). Blocks: governance closure.
9. **F1 classification clarification (section 5).** Accept the documented clarification, or approve a new inference target. Blocks: I5 acceptance.
10. **R1 residual and the `taskkill.exe` fallback.** Accept the residual, or require a suspended-start implementation. Confirm the fallback is acceptable.
11. **Owner acceptance of I2, I3, I4, I5, and I6.** Each is the owner's decision. Kiro has not recorded any.

## 11. Exit-criteria assessment

| Criterion | Assessment |
|---|---|
| I0 to I6 backend scope implemented or explicitly and legitimately deferred | **Partly met.** Implemented except association (G-M, blocked), cache (Task 10, blocked), and Task 16.1 values (blocked). Task 14 is legitimately deferred by owner decision |
| The backend starts and serves a real HTTP request | **Met.** 11 real-process tests |
| The MCP STDIO server starts and exposes all four tools | **Met.** STDIO handshake test and manual run (phase-status §32.3) |
| Git and GitHub retrieval run through shared application logic | **Met.** AST test and tests across suites |
| Investigation produces evidence-grounded results and deterministic explanations | **Met.** Integration tests over disposable repositories |
| Evidence identity, integrity, and epistemic distinctions are preserved | **Met, with item 9 pending owner decision** |
| Security controls and error handling are tested | **Met, with residuals R1 to R6** |
| Dependencies are reproducible | **Not met.** No manifest or lockfile (section 8) |
| Tests and documentation accurately reflect the implementation | **Partly met.** Historical phase-status counts and the §1 phase table are superseded by dated amendments (phase-status §37, §38). This report records the current state |
| No mandatory task is silently left incomplete | **Met.** Every open item is listed in section 4 with its disposition |

**Overall:** BLOCKED. Phase 3 exit requires the owner decisions in section 10, and the dependency authorization in item 6.

## 12. Known limitations and risks

- INFERRED is not produced by any real investigation (section 5).
- PR and issue evidence is never associated (item 1).
- GitHub responses are not cached (item 2).
- The numeric limits are proposed, not approved (item 3).
- The MCP error envelope and several codes differ from the proposal in D02 §16 (section 7.3).
- Kiro runtime behaviour is not verified (item 5).
- Dependencies are not reproducible (item 6).
- A descendant created before job assignment, and a descendant whose parent exits in that window, are not contained (R1).
- Live Category C over HTTP is not observed (section 6).
- MCP-10 is not run (section 7.5).
- The repository has no commits in the recorded baseline (item 17).

## 13. Protected documents and file hashes

Protected approved documents, verified by SHA256 in this closure: architecture (`3AB618886BBE…`), Spec 1 (`71FEF399A02C…`), Spec 2 (`EF7971157A0C…`), D01 (`053E3E373EA2…`), D02 (`65B0C43B9E29…`), D03 (`12AA12BC302F…`), `requirements.md` (`51123AEA8E15…`), and `.kiro/settings/mcp.json` (`02FB9811E5ED…`). None was changed in this closure.

Files changed in this closure, with SHA256 values, are listed in phase-status §38.

## 14. Final assessment

Phase 3 is **BLOCKED** and is not recommended for closure. The blockers are owner decisions and one authorization, all listed in section 10. The technical work that can be verified without them is complete and verified in the final run.

The owner accepts or rejects the increments. Kiro has recorded no acceptance.

## 15. Final remediation pass (2026-11-10)

This section is the latest assessment. It covers the owner direction for the final remediation pass. Each item below states what was implemented or verified in this pass, and what remains open.

### 15.1 Final I0 to I6 status

| Increment | Implementation | Verification in this pass | Owner acceptance |
|---|---|---|---|
| I0 | Done (Phase 2 closure and I0 execution) | Not re-run here | VERIFIED as recorded earlier in phase-status. Not re-accepted here. |
| I1 | Done | Included in the full suite | ACCEPTED (phase-status §7) |
| I2 | Done | Included in the full suite | Not accepted |
| I3 | Done. Retrieval and symbol resolution | Included in the full suite | Not accepted |
| I4 | Done. Git history and blame | Included in the full suite | Not accepted |
| I5 | Done for ranking, classification, assembly, and explanation. Association (G-M) and cache (Task 10) are not implemented, by decision (15.7) | Included in the full suite | Not accepted |
| I6 | Done. HTTP, MCP STDIO with four tools, GitHub metadata | Included in the full suite and the HTTP and MCP tests in 15.4 | Not accepted |

No owner acceptance is recorded in this section.

### 15.2 Implementation and verification evidence

Changes in this pass:

1. **Windows Job Object race (section 15.5).** `backend/app/core/git_runner.py`. The Git child is created suspended, assigned to a kill-on-close Job Object, and resumed only after assignment succeeds. The `taskkill.exe` fallback is removed. If the Job Object cannot be created or assigned, or the child cannot be resumed, the call returns `GIT_FAILED` and the child is stopped. On a non-Windows platform, `run_git` refuses to run Git.
2. **Containment was not enforced (found in this pass).** `resolve_contained_path` (C.3a steps 4 to 7) was defined and tested but had no caller in application code. It is now called in `investigation/orchestrator.py` (HTTP and MCP `search_history`) and in `git_history/blame.py` (MCP `blame_range`), before any retrieval or Git call. A junction that leads outside the root returns `PATH_OUTSIDE_REPOSITORY`.
3. **MCP path-error mapping.** `mcp/tools.py` `blame_range_tool` keeps the code chosen by the path layer. Before this change, every path error was reported as `INVALID_INPUT`.
4. **MCP xfail replaced.** The path-escape xfail (`test_mcp_08_path_escape_uses_path_outside_repository_code`) expected `PATH_OUTSIDE_REPOSITORY` for `../outside.py`. C.3a step 2 rejects a `..` segment lexically as `INVALID_INPUT`, so the expectation was wrong. It is replaced by `test_mcp_08_lexical_traversal_is_invalid_input` and `test_mcp_08_junction_escape_uses_path_outside_repository`, which create a junction with `mklink /J` and remove it with `rmdir`. Both pass.
5. **Dependency manifests.** `backend/requirements.txt` (runtime, 32 pins) and `backend/requirements-dev.txt` (includes runtime, plus pytest and its closure, 6 pins). Section 15.3 has the details.
6. **Stale docstring.** `repository/paths.py` now states that `MAX_TARGET_PATH_LENGTH` is applied in `normalize_target_path`.
7. **Native Spec header.** `.kiro/specs/evidence-retrieval/tasks.md` header replaced. See 15.8.

Tests added in this pass: 5 Git runner containment tests (suspended-start failure cases, the setup exception, and the normal resumed path) were added first, and the suite was then measured at 1036 passed and 6 xfailed. After that, this pass added 4 more: a lexical traversal test, a `search_history` junction test, a `_resume_threads` test with no owned thread (real Toolhelp bindings), and a `blame_range` junction test. It also removed the path-escape xfail. Net: 1040 passed and 5 xfailed.

Final full run in the clean verification venv (section 15.3), from `backend`, using `pytest tests -q -rfxXs --tb=short -p no:cacheprovider`:

- **1040 passed, 0 failed, 0 skipped, 5 xfailed** (288.57 s).
- Command exit code 0.

Targeted runs before the final run: 148 passed and 5 xfailed for the Git runner, MCP contract, blame, MCP tools, MCP server, repository containment, and API investigation modules.

### 15.3 Dependency reproducibility

- **Method.** A clean venv was built from `backend/requirements-dev.txt` in a temporary directory outside the repository. Then `pip check` and an import check with `-W error` were run on `app.main`, `app.api.app`, `app.modules.mcp.server`, and `app.modules.mcp.__main__`. The full suite was run from that venv.
- **Direct runtime pins:** fastapi 0.162.2, pydantic 2.14.3, uvicorn 0.54.0 (plain install), mcp 2.3.0. Transitive pins are included, 32 in total.
- **Dev pins:** pytest 9.2.0 and its closure, 6 packages in total (Pygments 2.21.0, colorama 0.4.6, iniconfig 2.3.1, packaging 26.3, pluggy 1.7.0, pytest 9.2.0).
- **Not included:** hypothesis (approved for development, but no code imports it and MCP-10 is not authorized). No Gemini or AI provider package.
- **Results in the clean venv:** `pip check` reports "No broken requirements found." The import check prints `IMPORT_OK` with exit code 0. The full suite passes (15.2).
- **Interpreter.** The clean venv runs **Python 3.14.0** (pip 25.2). D01 approves **Python 3.14.10**. The machine no longer has a 3.14.10 interpreter. The `py -3.14` launcher resolves to the Python314 install, which reports 3.14.0. The existing developer venv's `pyvenv.cfg` says 3.14.10. Installing 3.14.10 needs separate owner authorization under D01, so it was not done. **This is an owner decision (section 15.10, item 1).**
- **Hashes.** The pins have no hashes. The set is Windows-only, and a wheel for another platform would not match a hash pinned on this machine.
- **Advisory review (D01, required before installation).** Not performed in this pass. The packages were installed into temporary venvs, which D01 gates separately. **Required before acceptance.**
- **Authorization.** The owner's instruction for this pass asked for the manifest and the lock artifact. That instruction is treated as the authorization for the two files only. It does not cover the 3.14.10 install, and it does not cover the advisory gap.

### 15.4 HTTP and MCP verification

HTTP (`backend/tests/integration/test_http_e2e.py`, 11 tests). Each test starts a real uvicorn process on 127.0.0.1 with a temporary registry and disposable Git repositories. Covered: a valid request with the documented result, an unregistered repository (404), traversal (400, value not echoed), an unknown field (400, field name only), malformed JSON (400, no field), no response containing the repository path or token, graceful shutdown with nothing leaked, insufficient evidence over HTTP, a shallow-clone limitation, an ambiguous target (409 with candidates), and a repository root that disappears (503).

MCP (`test_mcp_server.py`, `test_mcp_tools.py`, `test_mcp_contract.py`, `test_mcp_github_success.py`, `test_mcp_number_input.py`):

- Four tools are registered: `search_history`, `blame_range`, `get_pr`, `get_issue`. No other tool is exposed.
- Successful and failed calls for each tool are covered, including `TARGET_AMBIGUOUS`, `REPOSITORY_NOT_FOUND`, lexical traversal, junction escape (both `search_history` and `blame_range`), and GitHub success and error paths.
- Shared logic: an AST test confirms that the MCP package contains no retrieval, ranking, or classification logic (`test_mcp_16_mcp_package_contains_no_retrieval_or_ranking_logic`).
- Clean shutdown: the STDIO process exits with 0 after stdin closes, and stderr is empty.

Not observed in this pass:

- A live STDIO handshake with the production `.kiro/settings/mcp.json`. C-D7 keeps that configuration gated, and it was not changed.
- A live Category C (500 `INTERNAL_ERROR`) response (section 6).
- The Kiro runtime.

Unintended writes: all test fixtures are in pytest temporary directories or in `%TEMP%`. The Sean repository received no writes from the tests. The only repository files changed in this pass are the ones listed in 15.2 and 15.9.

### 15.5 Windows Job Object residual

- **Race fixed.** Before this pass, the child ran before it was assigned to the Job Object. A descendant could start in that gap. Now the child is created suspended, assigned, and resumed only after assignment. A failed assignment or a setup exception stops the suspended child, which never runs.
- **Fail closed.** If the Job Object cannot be created, Git does not start (`GIT_FAILED`). On non-Windows, Git does not start. `taskkill.exe` is no longer used.
- **Tests.** The normal path exercises real suspended creation and resume on this machine, because every Git test uses it. Failure tests: job creation failure (Git never starts), assignment failure (child never resumes), a setup exception (child stopped, job closed), and resume failure (`GIT_FAILED`, no code runs). The existing tests cover the orphaned descendant (parent exits first), a descendant that holds the output pipe, reader I/O failure, and incomplete output, which is never returned as success.
- **Limits that remain.** (a) The race is closed by construction. The old race was not reproduced first, so the fix is verified by the tests above, not by a demonstration of the old race. (b) Nested jobs: assignment needs a Windows version that allows nested jobs. Where it does not, the call fails closed. (c) Breakaway: the job does not set `JOB_OBJECT_LIMIT_BREAKAWAY_OK`, so a child cannot leave the job. (d) No `ActiveProcessLimit` is set, so a descendant can create processes during the short period before the job closes. (e) Restricted tokens are not used. No privilege restriction is applied to Git.
- **Residual R1 (from the earlier pass) is closed.** The `taskkill.exe` fallback (R6) is removed.

### 15.6 Limits (one table)

Values are in `backend/app/core/limits.py`. "Proposed" means not owner-approved.

| Setting | Value | Unit | Consumer | Security or performance rationale | Source of authority | Approval status |
|---|---|---|---|---|---|---|
| `GIT_TIMEOUT_SECONDS` | 30.0 | seconds | `run_git` default | Bounds each Git call | OD-5 row R1 | Proposed |
| `GIT_STDOUT_LIMIT_BYTES` | 16 MiB | bytes | `run_git` default | Bounds memory per call | OD-5 row R2 | Proposed |
| `GIT_STDERR_LIMIT_BYTES` | 64 KiB | bytes | `run_git` default | Stderr is drained and never stored | OD-5 row R3 | Proposed |
| `GIT_READER_JOIN_SECONDS` | 5.0 | seconds | `run_git` | Bounds the wait for pipe readers | Process lifecycle, limits.py header | Proposed |
| `GIT_CHILD_WAIT_SECONDS` | 10.0 | seconds | `run_git` | Bounds the wait after a stop | Process lifecycle, limits.py header | Proposed |
| `COMMIT_SCAN_LIMIT` | 2000 | commits | `git_history/history.py` | Bounds history scan cost | OD-5 row R4 (exact value not approved) | Proposed |
| `MAX_SYMBOL_LENGTH` | 256 | characters | `symbol_resolution/validation.py` | Bounds input | Native design `target.symbol` (1 to 256) | Design baseline. Design approval not recorded |
| `MAX_LINE_SPAN` | 2000 | lines | `validation.py` (investigation target and core blame) | Bounds source reads | OD-5 row V4 | Proposed |
| `MAX_TARGET_PATH_LENGTH` | 1024 | characters | `repository/paths.py` | Bounds input | OD-5 row V2 | Proposed. Applied in code |
| `OPERATION_TIMEOUT_SECONDS` | 5.0 | seconds | `github/client.py` | Socket timeout per operation | OD-5 row R9 | Proposed |
| `BODY_LIMIT_BYTES` | 1 MiB | bytes | `github/client.py` | Bounds response size | OD-5 row R11 | Proposed |
| `MCP_BLAME_SPAN_LINES` | 500 | lines | `mcp/tools.py` `blame_range_tool` | Stricter MCP input bound | D02 §16.6 (proposal) | Proposed |
| `MCP_MAX_RESULTS_DEFAULT` | 20 | results | `mcp/tools.py` | Bounds response size | D02 §16.6 (proposal) | Proposed |
| `MCP_MAX_RESULTS_LIMIT` | 50 | results | `mcp/tools.py` | Bounds response size | D02 §16.6 (proposal) | Proposed |
| `MAX_REGISTRY_BYTES` | 256 KiB | bytes | `repository/registry.py` | Bounds local file read | Registry design | Proposed |
| `MAX_ROOT_LENGTH` | 4096 | characters | `repository/registry.py` | Bounds input | Registry design | Proposed |

**The contradiction (500 against 2000).** Both values bound a line span for a blame operation, but they sit on different paths:

- MCP `blame_range` checks the 500-line bound first. A request above 500 lines is rejected before the core blame code runs.
- The core `validate_line_range` in `blame.py` allows up to 2000. Through MCP this value is never reached, because the MCP bound is checked first. Other callers can reach it. The HTTP API has no blame route.
- The HTTP investigation target uses `MAX_LINE_SPAN` (2000) as its only line bound.

**Decision taken.** No value was changed, because changing either would change an MCP or HTTP contract. The effective limit for MCP blame is 500, and for HTTP investigation it is 2000. A single value for both is an owner decision (section 15.10, item 6).

### 15.7 Deferred work

- **F1 (INFERRED).** Preserved. DOCUMENTED and INFERRED keep their approved meanings, and no rule was changed. The product answers "what changed", and each verified commit documents that change directly, so DOCUMENTED is the correct class. INFERRED would need a reasoned interpretation of why a change was made, which no current investigation question asks for. Future evidence that would support INFERRED: an approved question about intent, and evidence that states that intent, such as a linked PR or issue whose association was validated under Spec 1 §7. Co-change and temporal proximity are not causal evidence and are not used to classify anything as causal.
- **G-M (PR and Issue association).** Not implemented. Spec 1 §7 allows PR and Issue evidence only when association is available and validated. Association is not implemented, so PR and Issue relevance is zero for every investigation. Every investigation carries the association limitation (`_ASSOCIATION_LIMITATION` in `orchestrator.py`), so no result implies that an unassociated record supports the investigation.
- **Task 10 (cache).** Deferred. Spec 1 §7 mentions caching as a permitted behavior ("cache suitable responses"), and §14 requires explicit invalidation rules. Those invalidation rules and D06 or D07 are not decided. No cache exists, so no stale-cache behavior can occur. Task 10 is not marked complete. **The owner must confirm the deferral (section 15.10, item 4).**
- **Gemini and Task 14.** Deferred by owner decision. No Gemini code, provider dependency, or external AI call exists in `backend/app` or `backend/tests` (checked by search in this pass). Deterministic explanations are the MVP behavior.

### 15.8 Native Spec approval status and hash changes

Neither native Spec file is approved in its current form. Owner approval is not recorded for any amended text.

| File | OD-16 approved baseline | Recorded amended hash (phase-status §38) | Current SHA256 | Status |
|---|---|---|---|---|
| `.kiro/specs/evidence-retrieval/design.md` | `EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3` | `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A` | `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A` (unchanged in this pass) | Amended. Re-approval required. Not approved. |
| `.kiro/specs/evidence-retrieval/tasks.md` | `B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8` | `E7855B78F87BD4FBDCDF898E51830513CA6054CC378CBC78D302B48259A4D564` (before this pass) | `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5` | Amended in this pass (header only). Re-approval required. Not approved. |

**The header conflict is resolved as follows.** The header read "NOT APPROVED. No task may start.", and it contradicted the OD-16 approval and the task authorizations recorded in phase-status. The header now reads "Status (amended 2026-11-10): owner approval of this amended text is NOT RECORDED." It states where task state is recorded, and it keeps the three approval conditions for any task that has no recorded owner authorization. The exact amendment is the replaced first paragraph of `tasks.md`. Its approval status is "NOT RECORDED." The checkboxes in `tasks.md` are still all unchecked, and the file does not track task state. The task state is in phase-status.

### 15.9 Security findings and remediation

An independent review (security-auditor, review only) covered the Job Object change, the containment wiring, and the new tests.

| Finding | Severity | Remediation in this pass |
|---|---|---|
| `blame_range` bypassed containment (reachable from MCP) | Medium | Fixed. Containment added in `blame.py` and a junction test added |
| Git ran uncontained on non-Windows | Low, but a fail-open path | Fixed. `run_git` refuses on non-Windows |
| Unused POSIX stub class | Low | Removed |
| Resume failure branch not exercised with real bindings | Low | Test added (`_resume_threads` with no owned thread) |
| `paths.py` docstring stated the length bound was not applied | Informational | Corrected |
| `TerminateJobObject` return value ignored | Low | Not changed. `KILL_ON_JOB_CLOSE` is the backstop, and `close()` runs in every path |
| No concurrency cap, and no `ActiveProcessLimit` | Low | Not changed. Listed in 15.5 as a residual |
| Pipe handles not closed when a reader does not finish | Low | Not changed. Released when the process object is collected |
| Containment check reads the working tree, which investigation does not read | Informational | Defense in depth. Git objects are read through pathspecs, so no current read depends on the check |
| `limits.py` unapproved values are enforced in code (`MAX_TARGET_PATH_LENGTH`) | Owner awareness | Stated in 15.6. Owner decision |

The reviewer's "values only" concern about `limits.py` is answered by the hash in 15.12. `limits.py` was not edited in this pass, and its hash matches the value recorded in phase-status §38. The repository now has commits (`6e6c343` at HEAD of `main`), but most backend files are still untracked, so Git cannot show their changes. Hashes are the only evidence of what changed here.

### 15.10 Remaining owner decisions (minimum)

1. **Python version.** Approve installing Python 3.14.10 (D01 item 2) and re-run the 15.3 verification there, or amend D01 to accept 3.14.0 as the verified runtime. Also confirm the manifest files in `backend/` as the backend lock.
2. **Advisory review.** Authorize the D01 advisory re-review for the pinned set. This is a technical step, and it is listed here because it must complete before acceptance.
3. **Native Spec re-approval.** Approve or reject the amended `design.md` and `tasks.md`. Until then, both are amended and not approved.
4. **Task 10 cache and G-M association.** Confirm that both are out of the MVP for now. Both are deferred as described in 15.7.
5. **MCP xfails (exact node IDs, 15.11).** Decide the five open items: `TARGET_NOT_IN_CURRENT_STATE` in MCP output, the `NO_EVIDENCE_FOUND` code name, the `RESULT_LIMIT_REACHED` row, and the `retrieval_status` envelope on the two failed-row cases.
6. **Limits.** Approve one value set for the line span (500 for MCP, 2000 for the core), or choose a single value for both. Also approve or revise each proposed value in 15.6.
7. **Owner acceptance.** Accept or reject I2, I3, I4, I5, and I6. Kiro has recorded no acceptance.

### 15.11 Exact remaining xfail node IDs

Five strict xfails remain, all in `backend/tests/unit/test_mcp_contract.py`:

| Node ID | Contract source | Legitimate? | Reason for retention |
|---|---|---|---|
| `test_mcp_08_symbol_absent_from_current_state_reports_its_code` | D02 §16.8 (proposal). Native design C.5 treats an absent path as historical search, not an error | Legitimate owner decision | Whether MCP output must carry `TARGET_NOT_IN_CURRENT_STATE`. The HTTP response carries it as `target.resolution` |
| `test_mcp_08_no_history_reports_no_evidence_found` | D02 §16.8. No approved document contains `NO_HISTORY_RETRIEVED` or `NO_EVIDENCE_FOUND` | Legitimate owner decision | Which code name is used. Changing it changes a contract, so it is not changed here |
| `test_mcp_08_result_limit_adds_result_limit_reached` | D02 §16.8 (proposal). No approved document names `RESULT_LIMIT_REACHED` | Legitimate owner decision | Whether the proposed row applies |
| `test_mcp_08_failed_rows_carry_retrieval_status_failed[not-registered]` | D02 §16.5 and §16.8 (proposal). Native design C.5 makes request-level errors category B, with no retrieval status | Legitimate owner decision. The approved sources conflict | Whether MCP error bodies carry `retrieval_status: FAILED` |
| `test_mcp_08_failed_rows_carry_retrieval_status_failed[invalid-path]` | Same as the row above | Same as the row above | Same as the row above |

The path-escape xfail that existed before this pass is no longer an xfail (15.2, item 4). It is replaced by passing tests.

### 15.12 Final SHA256 of changed and protected files

Changed in this pass:

- `backend/app/core/git_runner.py`: `852865512C0C33A06BA600184DC80CC67F47DE36C6D06FBF3A88C2CD0C4D42D3`
- `backend/app/modules/investigation/orchestrator.py`: `AE1A91E2AB4B12BE56C1FDE518C071BF76BE33AD9242BB172574A0359CF149EA`
- `backend/app/modules/git_history/blame.py`: `0CE568BF898622AE9A82DF1FBD8A833F3FFDEC0514A42822E3D471F76080491D`
- `backend/app/modules/mcp/tools.py`: `75A10AB4FF9380ECA5276CAAB96B11D1EBE867D3A47F6E51289A8117BEF8419B`
- `backend/app/modules/repository/paths.py`: `BAA5560F8DB2E0ADBE9FD9F4A72A12E15FB85E2590DA07A31AB238382A5C9DB0`
- `backend/tests/unit/test_core_git_runner.py`: `E283658ED26E653543ED0DB007A51692E6790F12F00841ED32A951D292FEB9A9`
- `backend/tests/unit/test_mcp_contract.py`: `C2450148F6C49C0FDFEDBBD6A6B0F1E259938E7524ECC2C848D0322A11DAA4B8`
- `backend/requirements.txt` (new): `3C7634A97EB1A70CE84E4836060C8A85CAD9184B9E4A7B209AC879DDFC50BA57`
- `backend/requirements-dev.txt` (new): `8C2D32DB3096911EBCAC0D8AF0FD9DAE6A6A19810A20FA8DD2C65EFBB5061298`
- `.kiro/specs/evidence-retrieval/tasks.md` (header amended): `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5`
- `docs/development/phase-3-closure-report.md`: see the phase-status §39 entry (this file cannot record its own hash in the report body)

Not changed in this pass (hash still matches §38): `backend/app/core/limits.py` `49FE8D230C96E2A31365A3E4E407A39BDF8132A0ABEA894D2F528FFC029D55C4`, and `.kiro/specs/evidence-retrieval/design.md` `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A`.

Protected documents, verified unchanged (match section 37 and 38): architecture `3AB618886BBE2F70688C293B0DCAF7C881339D50D098AEFE31611CC17AEED0B9`; Spec 1 `71FEF399A02C35EC10E41FC8521C75C96CFD97C3C06E27CA17BED9585D4D6004`; Spec 2 `EF7971157A0CE169780F012D3436A6B42717F7C55B7C963DE659BB7254776AEC`; D01 `053E3E373EA2D076C6B75990F6B700D928A22B6937A218D58DC3368AFCFAAEA7`; D02 `65B0C43B9E296124A7F8D489C94A3DB1EA562E7CB36B0AF8D1344538935386B5`; D03 `12AA12BC302F1D5CB21CB4130D51B507B0681BF93B428C401A320054048EE6E6`; `requirements.md` `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7`; `.kiro/settings/mcp.json` `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`.

### 15.13 Verdict

**BLOCKED BY OWNER DECISION.**

The backend is reproducible in a clean venv on Python 3.14.0, the full suite passes, and the containment and Job Object gaps found in this pass are fixed. Four items remain open:

- The approved interpreter (3.14.10) is not verified (15.10, item 1).
- The D01 advisory review is not done (15.10, item 2).
- The five MCP xfails are owner decisions (15.10, item 5).
- Native Spec re-approval, limits approval, and owner acceptance are not given (15.10, items 3, 6, 7).

This is not a claim of owner acceptance. Kiro has recorded no acceptance.

## 16. Final closure attempt (2026-11-12)

**Verdict: BLOCKED BY OWNER DECISION. Phase 3 is not closed. Phase 4 is not set to READY TO START.** No owner acceptance of I2 to I6 is recorded, because the conditions in the owner instruction are not met (16.6).

### 16.1 Baseline
- Git: HEAD `6e6c343` on `main` (three commits). Most backend, test, and specs files are still untracked, so Git cannot show their changes. Hashes are the evidence.
- The OD-16 approved text of `design.md` and `tasks.md` was not retained anywhere in the repository. Section 16.5 explains why this blocks a diff.

### 16.2 Python 3.14.10 and dependency reproducibility
- Installed Python 3.14.10 from the official Python.Python.3.14 winget package (installer hash verified by winget against python.org). It upgraded the existing Python314 install in place. Path: `C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`. `sys.version`: `3.14.10 (tags/v3.14.10:b703b2c, Oct 25 2026, 17:36:52) [MSC v.1944 64 bit (AMD64)]`.
- Fresh venv from that interpreter, installed only from `backend/requirements-dev.txt`: install exit 0. `pip check`: "No broken requirements found." Import check `python -W error -c "import app.main, app.api.app, app.modules.mcp.server, app.modules.mcp.__main__"`: prints `IMPORT_OK`, exit 0.
- Declared set: 32 runtime pins and 6 pytest-closure pins (section 15.3). These are version pins without hashes. `requirements.txt` is a pinned requirements file. It is not a lockfile with hashes, and it does not claim lockfile guarantees beyond exact versions.
- Hypothesis, Gemini, and other packages are not present.

### 16.3 Dependency advisory review (2026-11-12)
- Source: GitHub Advisory Database REST API, `ecosystem=pip`, `affects` filter with the exact versions. The filter was checked with a positive control first: `pyjwt@2.4.0` returns GHSA-pxh4-856f-4h89, and `django@3.0` returns advisories.
- Query 1: all 38 installed distributions in one list query returned an empty set.
- Query 2: the six most exposed packages individually (fastapi 0.162.2, starlette 1.10.0, mcp 2.3.0, cryptography 50.0.2, pydantic 2.14.3, pygments 2.21.0) returned empty sets.
- Findings: **none.** No package in the pinned set has a matching advisory in the GitHub Advisory Database. No upgrade was needed or made.
- Limits: one database at one point in time. OSV and the PyPI advisory feed were not queried separately. The record is not a guarantee of absence. Rerun the query before each release.

### 16.4 Verification in the Python 3.14.10 venv (executed)
- Full suite, `pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`: **1047 passed, 0 failed, 0 skipped, 5 xfailed** (318.20 s), exit 0.
- Count change from section 15: +3 MCP blame boundary tests (499, 500, 501), +3 core blame boundary tests (1999, 2000, 2001), +1 output-overflow descendant test. 1040 + 7 = 1047.
- MCP runtime (stdio, production launch shape): see the phase-status §40 entry.
- The production `backend\.venv` was on the same base interpreter (`pyvenv.cfg` version 3.14.10) after the in-place upgrade. The production configuration still points to it.

### 16.5 Remaining items and why they block closure

**a. Native Spec approval (section 9 of the owner instruction).** Approval requires a diff against the exact OD-16 approved text. That text is not in the repository, is not in Git (both native Spec files are untracked), and was not kept as a copy. Hashes alone show that the files changed, not what changed. The known edits are the ones recorded in phase-status §37 (three design edits, two task edits, and the header replacement in section 15.8). Those edits were not verified line by line against the approved text. **Minimum owner action:** provide the OD-16 approved copies of `design.md` and `tasks.md`, or explicitly approve the recorded edit list as the basis for a hash-level approval.

**b. Five MCP xfails (section 4 of the owner instruction).** I checked each against the approved sources. None has a definite expected result in an approved document. The approved sources conflict on the MCP error envelope (Spec 1 FR-10 and FR-08 require retrieval status, native design C.5 treats request-level errors as category B without a retrieval status, and D02 §16.5 proposes a FAILED envelope). The other four are D02 §16.8 proposal rows with no approved wording: `TARGET_NOT_IN_CURRENT_STATE` in MCP output, the name `NO_EVIDENCE_FOUND` against `NO_HISTORY_RETRIEVED`, and `RESULT_LIMIT_REACHED`. Replacing any of them would change a product contract, which the owner instruction forbids. Exact list and reasons: section 15.11. **Minimum owner action:** one decision for the envelope (retrieval status on MCP errors, yes or no), and one decision for each of the four proposed rows (keep, rename, or drop).

**c. Owner acceptance of I2 to I6.** The owner authorized acceptance only when every mandatory requirement is implemented, verified, and consistent with the approved contract. Item (b) is an open contract conflict, and item (a) leaves the approved text unverified. The conditions are therefore not met, and no acceptance is recorded.

### 16.6 Exit criteria assessment (owner instruction section 11)

| # | Criterion | Status |
|---|---|---|
| 1 | I0 to I6 implemented or legitimately deferred | Met for the backend. Cache, G-M association, and Gemini are deferred (16.7) |
| 2 | Backend installs reproducibly with the approved Python | Met for 3.14.10 (16.2). Version pins without hashes |
| 3 | Full suite passes without unexplained xfails | Suite passes. Five xfails remain, each explained (section 15.11). Not met for "unexplained"-free status, since the decisions are open |
| 4 | HTTP API integration-tested | Met (section 15.4, `test_http_e2e.py`, 11 tests on real uvicorn processes) |
| 5 | MCP STDIO runtime verified | Met with the production launch shape (phase-status §40). Kiro's own MCP client was not exercised |
| 6 | All four MCP tools verified | Met (phase-status §40 probe, plus the MCP test modules) |
| 7 | Git process containment verified on Windows | Met (tests run the real suspended-create, Job Object, and resume paths on this machine). Limits are listed in section 15.5 |
| 8 | Evidence identity, integrity, and epistemic distinctions correct | Met by the existing test modules. INFERRED remains unreachable by design (16.7) |
| 9 | No unresolved critical or high security findings | Met. The independent review found no critical or high finding. Medium finding fixed (section 15.9) |
| 10 | Dependency advisory review complete | Met for the pinned set (16.3). Repeat before release |
| 11 | Native Spec approval and traceability consistent | **Not met** (16.5a) |
| 12 | Limitations and deferrals documented | Met (section 15.5, 15.6, 15.7, 16.7) |
| 13 | No mandatory owner decision unresolved | **Not met** (16.5 a and b) |

Criteria 11 and 13 are open. Phase 3 therefore cannot close.

### 16.7 Deferrals and scope (unchanged decisions)
- **Cache (Task 10):** deferred. No cache exists, so no stale-cache behavior exists. D06 and D07 are not decided.
- **PR and Issue association (G-M):** not implemented. Relevance is zero, and every investigation carries the association limitation.
- **INFERRED (F1):** DOCUMENTED is the correct class for commit-based evidence. INFERRED needs a reasoned "why" question and validated association evidence, and neither is in scope. Co-change and temporal proximity are never used as causal evidence.
- **Gemini and Task 14:** deferred. No Gemini code, dependency, or external AI call exists in `backend/app` or `backend/tests`.
- **Frontend:** not part of I0 to I6. Not started.

### 16.8 Phase 4
Phase 4 is not set to READY TO START, because Phase 3 is not closed. I did not start Phase 4 work or write its entry plan in this pass. Phase 5 and I7 were not started.

## 17. Final closure reconciliation (2026-11-12)

**Verdict: BLOCKED BY A SPECIFIC OWNER DECISION.** The blocking decisions are listed in 17.9. Phase 3 is not closed. No acceptance of I2 to I6 is recorded. Phase 4 is not active. The earlier verdicts in sections 1, 14, and 16 are kept as history, and this section supersedes them.

### 17.1 Native Spec hashes and modification inventory

| File | OD-16 approved hash (phase-status §23) | Current SHA256 | Status |
|---|---|---|---|
| `.kiro/specs/evidence-retrieval/requirements.md` | `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7` | `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7` (matches) | Approved baseline, unchanged |
| `.kiro/specs/evidence-retrieval/design.md` | `EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3` | `0FE90C693BE2F07A03C8778C154A4066B62397277E663A27B3BE9117B31F458A` | **Amended. Does not match OD-16.** Not approved |
| `.kiro/specs/evidence-retrieval/tasks.md` | `B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8` | `4473F17B7D4A8B74887DEAD8EA3B1D8B02F4646DB2847D1F9165466922D4ACA5` | **Amended. Does not match OD-16.** Not approved |

The OD-16 approval covers Requirements 2, 3, and 14 and the corresponding design baseline. It does not cover the `tasks.md` header amendment.

**Modifications since OD-16, from the records.** The inventory comes from phase-status §37.2 and §37.3, §38, and this pass. Nothing was compared against the OD-16 text itself, because that text is not retained.

| # | File | Change | Category | Source |
|---|---|---|---|---|
| D1 | `design.md` | Outdated-statement edit to the "Explanation design" bullet | Editorial and status | §37.2 |
| D2 | `design.md` | Outdated-statement edit to the E-D13 row | Status (AI provider deferred) | §37.2 |
| D3 | `design.md` | A third text edit. §37.3 says "three text edits", but the record names only D1 and D2. **The third edit is not identified in the repository.** | Unknown | §37.3 |
| T1 | `tasks.md` | Task 14 header: deferral wording | Status (Task 14 deferred) | §37.2 |
| T2 | `tasks.md` | Subtask 14.1: deferral wording | Status (Task 14 deferred) | §37.2 |
| T3 | `tasks.md` | Header "NOT APPROVED. No task may start." replaced with "owner approval of this amended text is NOT RECORDED" and a pointer to phase-status | Governance and status. **Not a product change** | This pass (closure 15.8) |

No record shows a behavioral change, a new requirement, or a change to an evidence rule in either file. That is a statement of what the records say. It is not proof, because the baseline text is missing. A final approval would need the diff.

### 17.2 Five MCP xfails, resolved against the approved sources

The approved sources are Spec 1 (FR-08, FR-10, §5, §10.2, §10.3) and the requirement that limitations are communicated explicitly. D02 §16 is not binding, and it is referenced here only as the proposal being tested.

| Original xfail (node ID) | Approved source | Action | Result |
|---|---|---|---|
| `test_mcp_08_failed_rows_carry_retrieval_status_failed[not-registered]` | Spec 1 FR-08: communicate whether retrieval failed. The field name `retrieval_status` is D02 only | Replaced by `test_mcp_08_failed_rows_communicate_failure_without_evidence[not-registered]` | **Passes.** Failure is communicated by error code and `retryable`, with no evidence |
| `test_mcp_08_failed_rows_carry_retrieval_status_failed[invalid-path]` | Same | Replaced by `test_mcp_08_failed_rows_communicate_failure_without_evidence[invalid-path]` | **Passes** |
| `test_mcp_08_symbol_absent_from_current_state_reports_its_code` | Spec 1 §5: an absent current location is not an error, and the search continues. The code `TARGET_NOT_IN_CURRENT_STATE` is D02 only | Removed. The approved behavior is already tested by `test_mcp_08_symbol_absent_from_current_state_continues_the_search` | Approved behavior passes. The code is not binding |
| `test_mcp_08_no_history_reports_no_evidence_found` | Spec 1 §10.3: explicit limitations. The code `NO_EVIDENCE_FOUND` is D02 only | Removed. Replaced by `test_mcp_08_insufficient_result_declares_its_limitation` | **Passes** |
| `test_mcp_08_result_limit_adds_result_limit_reached` | Spec 1 §10.3 and FR-line "communicate limitations explicitly" require the limitation. No approved text names a code | **Kept as xfail** | Remaining decision (17.9, item 2) |

**Remaining xfail, exact node ID:** `backend/tests/unit/test_mcp_contract.py::test_mcp_08_result_limit_adds_result_limit_reached`. Justification: the approved sources require the limitation to be declared, but no approved text fixes a code for it. The implementation does not declare it, so a passing test would need a decision on the code name. I did not pick a name for the owner.

### 17.3 Reconciling D02 rows with MCP behaviors

- D02 §16.8 contains **15 situation rows** (the table in `d02-mcp-integration-decision-record.md`, lines 1001 to 1015).
- Rows that the earlier closure report counted as differences: the **6 xfail cases** that existed before this pass. Row 1 (input fails validation, `INVALID_INPUT`) and row 3 (unregistered repository) are both in G1, which has two parametrized cases. That is why the report says "five contract differences" and "six xfails". Both counts are correct for their own meaning.
- The 5 labels (G1 to G5) covered 6 rows: rows 1 and 3 (G1), row 5 (path escape, G2), row 7 (absent symbol, G5), row 10 (nothing found, G3), and row 11 (result limit, G4).
- After this pass, **1** of those 6 rows still differs (row 11). Rows 1 and 3 pass against Spec 1 FR-08. Row 5 passes against C.3a (lexical `INVALID_INPUT`, junction `PATH_OUTSIDE_REPOSITORY`). Rows 7 and 10 pass against the approved behavior.
- The 15 rows are not 15 tests. Several rows have no MCP test, because they are HTTP-only or depend on Git state (for example, the shallow-clone and uncommitted-line rows, which have their own tests).
- Historical reports are not rewritten. The reconciliation is recorded here and in phase-status §41.

### 17.4 MCP runtime through the Kiro client

**Not possible from this session.** Kiro's own MCP client is part of the IDE. This session has no interface to start it or to read its tool list. I did not create a temporary `mcp.json`, because that would only test the configuration and not Kiro's client, and the production gate (C-D7, MCP-18) remains closed. `.kiro/settings/mcp.json` is unchanged.

Verified instead (phase-status §40.6): the stdio server with the production launch shape, a temporary `LOCALAPPDATA` registry, and a disposable repository. It exposes exactly four tools. Validation, containment, unregistered repository, GitHub identity handling, and the schema rejection of a JSON integer behave as specified. It starts no sockets, exits 0, writes nothing to the repository, and leaves no git processes.

### 17.5 I2 to I6 acceptance matrix

Built against the **recovered** I0 to I6 plan in `docs/development/i5-i6-backend-implementation-plan.md` (sections 2 to 5) and the native task numbers. The original plan is not in the workspace (phase-status §8.1). **No owner acceptance is recorded in this matrix.**

| Increment | Scope (tasks) | Implementation | Test evidence (executed, final run) | Integration | Security status | Limitations | Deferred |
|---|---|---|---|---|---|---|---|
| **I2** Evidence model and identity | 7.1, 7.2, 7.3 | `modules/evidence/models.py`, `contract.py`, `identity.py`; `core/git_objects.py` | `test_evidence_model` (404), `test_evidence_identity` (48), `test_git_objects` (21) | Used by I3 to I6 | No separate I2 review in the final pass. Validation is tested by the model tests. **Not independently reviewed here** | `evidence_id` derivation is recorded as O12 (phase-status §17); the design data-model list still names fields the code does not use (phase-status §10.3) | None for MVP | None |
| **I3** Git history and evidence retrieval | 2.1 to 2.4, 3.1 to 3.4, 4.1, 4.2, 5.1 to 5.4, 6.1 to 6.3 | `repository/paths.py`, `repository/registry.py`; `core/git_runner.py`; `modules/git_history/history.py`, `objects.py`, `blame.py`; `modules/symbol_resolution/resolver.py`, `validation.py` Repository tests: `test_repository_containment` (13), `test_repository_paths` (26), `test_repository_registry` (79), `test_repository_target_path` (57). Also `test_core_git_runner` (38), `test_git_history` (13), `test_git_blame` (28), `test_symbol_resolution` (42) | Used by `investigate()` and `blame_range`. HTTP and MCP tests | The I3 and I4 security review recorded in phase-status (task 2.4). Final review in 17.6: no critical or high | Windows-only containment. Output and timeout limits are proposed (OD-5). Limits are not owner-approved | Task 16.1 configuration not implemented |
| **I4** GitHub integration | 9.1, 9.2, 9.3 | `modules/github/client.py` | `test_github_client` (37), `test_mcp_github_success` (6), `test_mcp_number_input` (33) | Through `get_pr`, `get_issue`, and HTTP | Token handling and redaction tested. Not in the final review. **Not independently reviewed here** | One owner-authorized live read-only request (phase-status §25). Token variable name E-D15 is open (`SEAN_GITHUB_TOKEN` in use). OD-13 and OD-14 open | PR and issue association (G-M) not implemented |
| **I5** Investigation and explanation | 8.x (partly), 11, 12, 13. Task 10 (cache) and Task 14 (AI) excluded | `modules/investigation/classification.py`, `ranking.py`, `result.py`, `orchestrator.py`; `modules/explanation/templates.py` | `test_investigation_*` (8, 16, 18, 12), `test_explanation_templates` (42), `test_explanation_integration` (6) | Through `investigate()` in both HTTP and MCP | Covered by the final review (17.6). Orchestrator error handling reviewed (finding informational) | Association not implemented. Ranking weights (E-D5) are defaults. Cache (Task 10) not implemented | **Task 10 cache: deferred** (D06, D07 open). **Task 14 optional AI: deferred** by owner (E-D13 §9). **G-M association: not approved** |
| **I6** API, system integration, MCP | 15.1, 15.2, 17.1 to 17.4. 17.5 `mcp.json` not changed | `api/app.py`, `main.py`; `modules/mcp/tools.py`, `server.py`, `__main__.py`; `core/diagnostics.py` | `test_api_investigations` (12), `test_http_e2e` (11, real uvicorn), `test_mcp_contract` (32), `test_mcp_tools` (36), `test_mcp_server` (4), `test_core_diagnostics` (9) | HTTP real process; MCP stdio probe (17.4) | Final review (17.6). MCP tools use shared logic only (AST test) | Kiro client not exercised (17.4). MCP-10 (Hypothesis) not run. Live Category C 500 not observed. One MCP xfail remains (17.2). Task 16.1 values unapproved | Tasks 18 and 19 (golden repository and baseline tests) are outside the I0 to I6 mapping. Phase-status §1 lists testing in Phase 4. The owner has not recorded where they belong (plan B-15) |

**Acceptance status for every increment: NOT ACCEPTED.** I0 is VERIFIED. I1 is ACCEPTED (phase-status §7). I2 to I6 are implemented and tested, and each is awaiting owner acceptance. Passing tests are evidence. They are not acceptance.

### 17.6 Security review of the final code

Two review-only passes, both by the security-auditor sub-agent:

- **First pass** (before the final fixes): no critical or high. Ten findings, eight of them low or informational. Fixed in the final code: stderr overflow was not enforced (LOW); cleanup skipped `job.close()` on exception (LOW); pipes closed only on success (LOW); the containment-failure path had no test (LOW); the `field` label was wrong for line errors (INFO).
- **Second pass** (final code, read only): no critical or high. Fixes A to E confirmed. Startup order confirmed: the POSIX refusal and the job-creation refusal both precede `Popen`, `CREATE_SUSPENDED` is set only with a job, and `_resume_threads` runs only after a successful assignment. One further LOW was fixed: a decode or parse error in Git output escaped as a raw exception, and it now returns `GIT_FAILED` with no text.

**Remaining findings (all LOW or INFORMATIONAL, none critical or high):**

| Finding | Status | Reason it is acceptable |
|---|---|---|
| `TerminateJobObject` return value ignored | Accepted residual | Kill-on-close on job close is the backstop, and the job is always closed |
| `process.kill()` raising `OSError` in cleanup would propagate | Accepted residual | Rare. The job is still closed, because of the nested `finally` |
| `Popen` process handle released by garbage collection, not explicitly | Accepted residual, **unverified** | A handle leak would not expose data, and it is bounded by the process lifetime |
| Closing a pipe that a reader thread still uses could block on the buffer lock | Accepted residual, **unverified** | The job kill delivers EOF first. Not observed on this machine |
| Dead guard around `job.assign` | Accepted, informational | The raise before it makes the guard unreachable. No behavior change |
| `executable` parameter on `run_git` | Informational | Production never passes it. Only tests do |
| `retrieve_history` has no containment check of its own | Informational | Only `investigate()` and `blame_range` call it, and both check containment first. Git reads from the object store, not the working tree |

**Verified only by reading, not executed in the security review:** Windows ctypes binding details, and the behavior of `BufferedReader.close()` on a blocked reader. The test suite exercises the real Windows calls on this machine (see 17.7), but it does not test the blocked-reader close case.

### 17.7 Test evidence

Final run, clean Python 3.14.10 venv (`C:\Users\User\AppData\Local\Temp\sean-3140-e3be415f`), from `backend`:

`pytest tests -q -rfxXs --tb=short -p no:cacheprovider`

- **1054 passed, 0 failed, 0 skipped, 1 xfailed** (348.22 s), exit 0.
- Xfail: `tests/unit/test_mcp_contract.py::test_mcp_08_result_limit_adds_result_limit_reached` (17.2).
- `pip check`: "No broken requirements found." (exit 0, earlier run in the same venv).
- Warnings-as-errors import of `app.main`, `app.api.app`, `app.modules.mcp.server`, and `app.modules.mcp.__main__`: `IMPORT_OK`, exit 0.

The clean venv was installed only from `backend/requirements-dev.txt`. Python 3.14.10 was installed from the official winget package and confirmed with `sys.version`.

### 17.8 Dependency advisory review

The advisory check was not repeated in this pass. Section 16.3 records the review of 2026-11-12. It found no matching advisory for the pinned set in the GitHub Advisory Database. The repeat is required before any release.

### 17.9 Exit criteria, reconciled against this report

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Python 3.14.10 | **Met** | 17.7 |
| 2 | Clean dependency installation | **Met** | 17.7. Pins without hashes |
| 3 | Advisory review | **Met for 2026-11-12**, single source | 16.3 |
| 4 | Full suite | **Met** | 1054 passed, 1 xfailed, the xfail is listed |
| 5 | HTTP integration | **Met** | `test_http_e2e` (11 real-process tests) |
| 6 | MCP STDIO | **Met** with the production launch shape. Kiro client **not** exercised | 17.4 |
| 7 | Process containment on Windows | **Met** by the real Win32 tests. Limits in 15.5 | 17.6, 17.7 |
| 8 | Evidence integrity and epistemic distinctions | **Met** by existing tests. INFERRED is not reachable for the current question (section 5) | |
| 9 | Security review: no unresolved critical or high | **Met** | 17.6 |
| 10 | Native Spec governance | **NOT MET** | 17.1: design and tasks do not match OD-16. The approved text is missing for the diff |
| 11 | Deferrals documented | **Met** | 17.5 and section 16.7 |
| 12 | Limitations documented | **Met** | 17.5, 17.6, 15.5, 15.6 |
| 13 | No mandatory owner decision unresolved | **NOT MET** | 17.9a to 17.9d below |

**Owner decisions still blocking closure (the minimum set):**

- **(a) Native Spec approval.** Provide the OD-16 approved copies of `design.md` and `tasks.md`, so the diff in 17.1 can be checked. Or approve the modification list in 17.1 by hash. This is the only item that decides criterion 10. Until it is settled, both files are not approved.
- **(b) RESULT_LIMIT code name.** Approve a code name for the truncation limitation, or decline the row. This decides the single remaining xfail.
- **(c) OD-5 limit values.** Approve or revise the proposed values in 15.6. The MCP blame span (500) and the core span (2000) apply to different layers. The owner decides whether one value covers both. This blocks Task 16.1, and it affects the acceptance of I3, I5, and I6.
- **(d) Owner acceptance of I2 to I6.** This is a separate owner decision. It is not recorded here. The acceptance record (17.10) is ready for the owner to complete.

### 17.10 Owner acceptance record

Prepared as a draft in `docs/development/phase-3-owner-acceptance-record.md`. It is unsigned, and every decision field is empty. Phase 3 stays IN_PROGRESS, and Phase 4 stays NOT_STARTED, until the owner completes that record.

### 17.11 Phase 4

Not active. Phase 4 starts only after the owner confirms acceptance of Phase 3. No Phase 4 work was done in this pass.

### 17.12 Hashes of files changed in this pass

Recorded in phase-status §41.6, which also records the hash of this file. This file cannot record its own hash.

## 18. Phase 3 closure under the owner's final decisions (2026-11-12)

**Verdict: Phase 3 — MVP Implementation is CLOSED, and Phase 4 is READY TO START.** I2, I3, I4, I5, and I6 are accepted under the owner's written instruction of 2026-11-12. Phase 4 has not started. The decision log, evidence, and hashes are in phase-status section 42. Sections 1 to 17 are kept as history.

### 18.1 Increment acceptance

| Increment | Disposition | Basis |
|---|---|---|
| I0 | VERIFIED (not re-accepted by this record) | phase-status section 4 |
| I1 | ACCEPTED (2026-11-10) | phase-status section 7 |
| I2 | **ACCEPTED** (owner instruction 2026-11-12) | Scoped approval for Tasks 7.1 and 7.3 (phase-status section 9.2). Task 7.2 by later owner authorization (section 15). Unit tests: `test_evidence_model.py` 404, `test_evidence_identity.py` 48, `test_git_objects.py` 21 |
| I3 | **ACCEPTED** (owner instruction 2026-11-12) | Implementation directive (phase-status section 25). OD-5 values approved in this instruction (section 18.3). SHA-256 end-to-end Git integration deferred and not claimed |
| I4 | **ACCEPTED** (owner instruction 2026-11-12) | OD-7, OD-8 (with the `retryable` verification, section 18.4), and OD-14 recorded. Live rate-limit header semantics not claimed (residual, section 18.6) |
| I5 | **ACCEPTED** (owner instruction 2026-11-12) | I5/I6 directives (phase-status sections 28 and 30) authorize Task 8. Tasks 8.1 to 8.3, 11, 12, 13 implemented and tested. Cache, AI, and PR/Issue association deferred. Property tests and golden tests assigned to Phase 4 |
| I6 | **ACCEPTED** (owner instruction 2026-11-12), after the result-limit remediation below | STDIO production launch shape verified. Kiro client activation and `mcp.json` enablement are separate operational gates, not acceptance criteria |

### 18.2 MCP remediation (result limit)

Files changed:
- `backend/app/modules/mcp/tools.py`: `search_history` declares `RESULT_LIMIT_REACHED` (scope `results`) when matching evidence exists beyond the caller's `max_results`. The status is not changed. The new constant is `RESULT_LIMIT_REACHED`. The `McpToolError` class accepts an explicit `retryable` value.

Behavior verified:
- Exactly the requested count, with nothing further: `COMPLETE`, no declaration (`test_caller_limit_declared_only_when_evidence_exists_beyond_the_bound`).
- More evidence beyond the bound: `COMPLETE` with `RESULT_LIMIT_REACHED`. The evidence count is the requested maximum. The classification and evidence content are not changed.
- Internal scan truncation: `PARTIAL` with `COMMIT_SCAN_LIMIT_REACHED`, and no `RESULT_LIMIT_REACHED` (`test_internal_scan_truncation_stays_partial_and_is_not_a_result_limit`).
- The strict xfail `test_mcp_08_result_limit_adds_result_limit_reached` is replaced by a normal passing test. No xfail remains in the suite.

Test result: 1058 passed in the final full run (section 18.5). The MCP STDIO probe with the production launch shape shows `COMPLETE` with `RESULT_LIMIT_REACHED` and one evidence item.

### 18.3 OD-5 limits (approved values, owner decision 2026-11-12)

Approved values and their enforcement points:

| ID | Value | Enforced in | Tested by |
|---|---|---|---|
| R1 | 30 s | `core/git_runner.py` `run_git` | `test_timeout_kills_the_child`, descendant timeout tests |
| R2 | 16 MiB | `run_git` | `test_output_over_limit_is_rejected`, `test_output_overflow_terminates_a_descendant_in_the_job` |
| R3 | 64 KiB | `run_git` | `test_stderr_overflow_is_an_output_limit_error_not_a_timeout` (override) |
| R4 | 2000 commits | `git_history/history.py` | `test_commit_scan_limit_makes_the_result_partial` |
| R9 | 5 s | `github/client.py` | `test_stalled_response_fails_within_the_operation_timeout` |
| R11 | 1 MiB | `github/client.py` | `test_oversize_body_is_rejected` |
| R13 | 0 retries | `github/client.py` (single attempt) | `test_server_error_is_unavailable_and_not_retried` |
| R14 | Stop when rate-limited | `github/client.py` | `test_rate_limit_403_is_reported_and_stops_further_requests`, `test_429_is_rate_limited` |
| R16 | Sequential | `run_git` (one call path) | by design |
| V1 | 64 characters | registry pattern | registry tests (file level) |
| V2 | 1,024 characters | `repository/paths.py` | `test_repository_target_path.py` |
| V3 | 1 to 256 | `symbol_resolution/validation.py` | `test_symbol_resolution.py` |
| V4 | 2000 lines (core) | `validate_line_range` | `test_core_blame_span_boundary[1999|2000|2001]` |
| V5 | 500 lines (MCP) | `mcp/tools.py` `blame_range_tool` | `test_mcp_blame_span_boundary[499|500|501]` |
| V6 | 1-based, start ≤ end | `validate_line_range` | `test_symbol_resolution.py` |
| V7 | Positive decimal, no bound | `github/client.py` input validation | `test_mcp_number_input.py` |
| V8 | 40 or 64 lowercase hex | `core/git_objects.py` | `test_git_objects.py` |
| V9 | default 20, range 1 to 50 | `mcp/tools.py` `_bounded_max_results` | `test_max_results_is_validated`, MCP result-limit tests |
| — | Git reader join 5 s | `run_git` | indirect (process-tree tests) |
| — | Git child wait 10 s | `run_git` | indirect |

R18 (256 KiB) and R19 (4,096 characters) were approved at I1 and are not reopened. `core/limits.py` comments are corrected to state the approval basis. The values are unchanged.

R5–R8, R10, R17, D1, and D2 are not implemented and are not required for Phase 3 acceptance (section 18.6).

Separate limits: the MCP blame span (V5, 500) is checked before the core runs. The core safety limit (V4, 2000) is checked independently. Both are kept.

### 18.4 OD-7 and OD-8 (approved 2026-11-12)

- **OD-7.** The GitHub client does not follow HTTP redirects. Any 3xx response is a retrieval failure with `GITHUB_UNAVAILABLE` and `retryable: false`. A renamed repository is reported as a limitation: `PARTIAL` for an investigation, `FAILED` for a single record. No investigation path calls GitHub yet, because association is deferred (G-M), so the investigation-level `PARTIAL` rule is not exercised. It applies when association exists.
- **OD-8.** A response body over 1 MiB is rejected with `GITHUB_UNAVAILABLE` and `retryable: false`.

Implementation change made to satisfy the approval. Before this change, the MCP layer marked every `GITHUB_UNAVAILABLE` as retryable. `GitHubError` now carries a cause-specific `retryable` value. A redirect and an oversize body are non-retryable. Network failures and timeouts remain retryable (test `test_github_unavailable_is_structured_and_retryable`).

Verification: `test_oversize_body_is_rejected` asserts the code and `retryable is False`. `test_redirects_are_refused_and_the_target_is_never_requested` asserts `retryable is False`. `test_github_redirect_or_oversize_is_not_retryable_through_mcp` asserts the MCP body carries `retryable: false`.

Files changed: `backend/app/modules/github/client.py`, `backend/app/modules/mcp/tools.py`, `backend/tests/unit/test_github_client.py`, `backend/tests/unit/test_mcp_tools.py`.

Security basis: these changes narrow retryability for two causes and add a limitation to MCP output. They were verified by the tests in section 18.5. They were not separately reviewed by a security-auditor pass. The earlier review (section 17.6) covered the runner and containment code, which these changes do not touch.

### 18.5 Final verification (clean Python 3.14.10 environment)

- Environment: Python 3.14.10 (`C:\Users\User\AppData\Local\Programs\Python\Python314\python.exe`, verified with `sys.version`). Clean venv `C:\Users\User\AppData\Local\Temp\sean-3140-e3be415f`, built from `backend/requirements-dev.txt`. pip 26.2.2.
- Command: `pytest tests -q -rfxXs --tb=short -p no:cacheprovider` from `backend`.
- Result: **1058 passed, 0 failed, 0 skipped, 0 xfailed**, 298.59 s.
- `pip check`: "No broken requirements found."
- Imports with warnings as errors: `app.main`, `app.api.app`, `app.modules.mcp.server`, `app.modules.mcp.__main__`: `IMPORT_OK`.
- API: the HTTP end-to-end tests (11 real-process tests) and the ASGI tests are part of the suite, all passing.
- MCP STDIO with the production launch shape (`backend\.venv\Scripts\python.exe -P -m app.modules.mcp`, Python 3.14.10): server `sean` 0.1.0; four tools; `COMPLETE` with `RESULT_LIMIT_REACHED`; validation and containment errors; `blame_range` span 501 rejected with `field: line_end`; exit 0 after stdin closes; stderr empty; no listening sockets; repository unchanged; no git process left.
- Leak checks: the suite log contains no fake token value and no repository path. The probe output contains no repository path, no `C:\Users` path, and no token string.
- `mcp.json`: unchanged (SHA256 `02FB9811E5EBDBDF1E926BFC85D93C77D01D0D021ECD9DD5AB4C1358BB661EB2`).

Earlier counts: the xfail inventory went from 5 (section 16) to 1 (section 17) to 0 (this section). The count rose from 1055 collected to 1058 passed. The +3 are the new MCP tests. The former xfail is now a passing test.

### 18.6 Native Specs and remaining items

Native Spec regularization is recorded in phase-status section 42.4. Summary:
- `requirements.md`: one line changed (the stale status line). Restoring that line reproduces the OD-16 hash `51123AEA…` exactly. The change is proven and reversible.
- `design.md`: the third change (D3) is identified as the citation `Architecture §5` → `Architecture §2.7 and §7` inside the explanation bullet. It is documented with the addendum and the E-D13 record §9. The file is accepted as the implementation baseline by owner regularization. It is not equivalent to the OD-16 hash, which cannot be reconstructed.
- `tasks.md`: T1 and T2 (Task 14 deferral) and T3 (header) are retained with provenance. T4 (checkbox sentence) is corrected. The file is accepted as the Native Spec task baseline by owner regularization. It is not equivalent to the OD-16 hash.

Deferred and residual risks (not claimed as completed):
- R10 total GitHub request time: not implemented. Accepted residual by owner instruction. A slow provider can hold a request across several per-operation timeouts.
- R14 rate-limit semantics: the client detects `X-RateLimit-Remaining: 0`, a 403 with that header, and HTTP 429. It stops for the remainder of the client instance. It does not parse `X-RateLimit-Reset` or wait for the reset. Live provider header semantics were not verified beyond a single read-only request (phase-status section 25).
- R5–R8, D1, D2, R17: not implemented. Not required.
- Task 10 cache, Task 14 AI (Gemini), PR/Issue association (G-M): deferred.
- Property-based tests (Hypothesis, MCP-10), golden repository tests (Tasks 18 and 19), cross-repository portability, and language-specific semantic limits: assigned to Phase 4.
- SHA-256: the data model accepts full 64-character object names. End-to-end Git repository integration has not been verified. No SHA-256 integration claim is made.
- Kiro client activation and `mcp.json` enablement (MCP-18, C-D7): separate operational gate. Not performed.
- The MCP error body for a failed single-record call has `error`, `message`, and `retryable`, and no `retrieval_status` field. This follows the reading recorded in closure section 15.11 (FR-08 requires failure to be communicated, not a particular field). D02 §16.5 proposes the field and is not binding.
- `design.md` line 570 (E-D15) does not name `SEAN_GITHUB_TOKEN`. Traceability only. The name is recorded in phase-status section 42. No design amendment was made, to avoid a further baseline change.
- Protected documents `architecture-and-project-setup.md`, `spec-1-evidence-retrieval.md`, `d01`, `d02` and `backend/app/main.py` show as modified relative to Git HEAD `6e6c343`. Their SHA256 values match the recorded approved hashes, and this pass changed none of them. The modifications predate this pass.

### 18.7 Phase transition

- Phase 3 — MVP Implementation: **CLOSED** (owner instruction 2026-11-12, after I2 to I6 acceptance and closure checks).
- Phase 4 — Testing, Security and Verification: **READY TO START**. Not started. No Phase 4 work was performed in this pass.
- Phase 5 — Demo and Hackathon Preparation: NOT_STARTED.
- The phase table in phase-status section 1 is historical. Section 42.7 amends it by dated note.

## 18.8 R14 alignment (2026-11-12)

Owner decision: for the MVP, rate limiting ends GitHub requests for the lifetime of the client instance. Automatic resumption on the reset header is not required.

- **Decision record:** `docs/development/i3-i4-owner-decision-package.md` Part 16.1 records the behavior, its limitation, and the superseded wording.
- **Implementation:** unchanged in behavior. `backend/app/modules/github/client.py` documents the behavior accurately in its module docstring and at the exhaustion flag. The reset header is not parsed. No resumption exists.
- **Tests:** `backend/tests/unit/test_github_client.py` adds three tests:
  - `test_success_response_with_exhausted_header_blocks_later_requests`: a successful response reporting `X-RateLimit-Remaining: 0` blocks the next request on the same instance, with no network call.
  - `test_a_new_client_instance_is_not_blocked_by_an_earlier_rate_limit`: the block is scoped to the instance.
  - `test_ordinary_unavailable_is_retryable_and_does_not_block_later_requests`: a 503 is retryable and does not set the rate-limit state.
  - The existing `test_rate_limit_403_is_reported_and_stops_further_requests` now documents the instance lifetime. `test_unreachable_host_is_reported_as_unavailable` asserts `retryable is True`.
- **Results:** focused GitHub client tests 40 passed. Complete suite 1061 passed, 0 failed, 0 skipped, 0 xfailed (522.77 s), same clean Python 3.14.10 venv. `pip check` clean. Warnings-as-errors imports pass.
- **Closure status:** unchanged. Phase 3 remains CLOSED. I2 to I6 remain accepted. R14 is consistent across the decision record (Part 16.1), the implementation documentation, the tests, and this report (sections 18.3 and 18.6).
