# Sean — I5 and I6 Owner Acceptance Package

**Date:** 2026-11-10.
**Scope:** Increments I5 (Investigation and Explanation) and I6 (API, System Integration and MCP) of the Phase 3 plan. Plan source: `docs/development/i5-i6-backend-implementation-plan.md`. Native Spec tasks: `.kiro/specs/evidence-retrieval/tasks.md`.
**Status of this package:** technical readiness assessment for owner review. **No increment is marked OWNER_ACCEPTED.** Acceptance is the owner's decision.
**Verification commands and results** are recorded in section 8. All counts come from fresh runs on 2026-11-10.

## Status vocabulary

- **IMPLEMENTED:** code exists and the behavior is written.
- **UNIT_VERIFIED:** automated unit tests for the behavior ran and passed.
- **INTEGRATION_VERIFIED:** automated tests ran the real modules together over temporary repositories or a real process.
- **RUNTIME_VERIFIED:** a real process was started and observed (HTTP or STDIO).
- **ACCEPTANCE_READY:** technically ready for owner review, with the caveats listed.
- **OWNER_ACCEPTED:** the owner has accepted. **None of the increments below has this status.**
- **BLOCKED:** cannot advance without an owner decision or another task.
- **DEFERRED:** explicitly postponed by owner decision.

## A. Increment status

| Increment | Scope | Implementation | Test verification | Known limitations | Blockers | Acceptance status |
|---|---|---|---|---|---|---|
| I0 Initial MVP preparation | Environment and project setup | Complete | VERIFIED (phase-status §4) | — | — | Verified. Not an acceptance decision |
| I1 Repository registry and core paths | Tasks 1.1 to 1.3 | Complete | UNIT_VERIFIED, 83 tests (phase-status §7) | Full Git validation of a root deferred to task 3 (done in I3) | — | **OWNER_ACCEPTED** (phase-status §7) |
| I2 Evidence model and canonical identity | Tasks 7.1 to 7.3 | Complete | UNIT_VERIFIED. Owner decisions U-1 to U-4 applied (phase-status §17, §18) | Task 7.2 relies on open decisions D1, D4 to D8, D10, D11 as recorded in §18 | Owner acceptance pending | **NOT ACCEPTED** |
| I3 Git history and evidence retrieval | Tasks 2.1 to 2.4, 3.1 to 3.4, 4.1, 4.2, 5.1 to 5.4, 6.1 to 6.3 | Complete (owner directive, phase-status §25) | UNIT_VERIFIED. Security review by a sub-agent, findings fixed (phase-status §25) | Blame span in code is 2,000 lines, D02 proposes 500 (OD-5, unapproved) | OD-5 values unapproved | **NOT ACCEPTED** |
| I4 GitHub integration | Tasks 9.1 to 9.3 | Complete | UNIT_VERIFIED. One live read-only request to a public repository was recorded earlier in `i5-i6-backend-implementation-plan.md` (I3/I4 status table). None in this session | Token variable name not approved (E-D15) | E-D15 | **NOT ACCEPTED** |
| I5 Investigation and explanation | Tasks 8, 11, 12, 13, orchestration; Task 10 cache; Task 14 optional AI | Ranking, classification, result assembly, deterministic explanation, orchestration: IMPLEMENTED. Explanation improved in this session (sections B and E) | UNIT_VERIFIED and INTEGRATION_VERIFIED (sections B and 8) | Association (G-M) not approved, so the PR and issue criterion stays at zero. INFERRED is not reached (section F, finding F1). Cache (Task 10) not implemented | Association (G-M). Cache (D06, D07). Task 14 DEFERRED | **ACCEPTANCE_READY, with the caveats in section F.** Not accepted |
| I6 API, system integration and MCP | Task 15.2 (HTTP), Task 16.2 (diagnostics), Task 17 (MCP), Task 16.1 (configuration) | HTTP route, MCP tools and STDIO entry point: IMPLEMENTED. Registry path defect fixed (section C.6) | UNIT_VERIFIED. RUNTIME_VERIFIED over HTTP and STDIO (sections C and 8) | MCP contract differences G1 to G5 are proposal differences from D02 §16, not approved contract violations. Task 16.1 values unapproved (OD-5). MCP-10 needs Hypothesis (not installed). Kiro runtime (MCP-18) not run | Task 16.1 (OD-5). C-D7 for `mcp.json` enablement. D02 §12 runtime tests | **ACCEPTANCE_READY, with the caveats in section F.** Not accepted |

Phase 3 remains **IN_PROGRESS**. Phase 4 must not start until the owner accepts.

## B. Requirements traceability

These mappings show where each requirement area is implemented and tested. A mapping is evidence of coverage, not acceptance.

| Requirement area (native Spec, or Spec 1 section) | Implementation | Test files | Status |
|---|---|---|---|
| Repository registry and selection (Req 1) | `backend/app/modules/repository/registry.py`, `paths.py` | `test_repository_registry.py`, `test_repository_paths.py`, `test_repository_containment.py`, `test_repository_target_path.py` | UNIT_VERIFIED. Registry loaded from the approved path in both entry points (section C.6) |
| Git history retrieval (Req 3, 4) | `backend/app/modules/git_history/history.py`, `blame.py`, `objects.py` | `test_git_history.py`, `test_git_blame.py`, `test_git_objects.py` | UNIT_VERIFIED. Shallow clone covered |
| Symbol resolution (Req 4.6, 5) | `backend/app/modules/symbol_resolution/resolver.py`, `validation.py` | `test_symbol_resolution.py` | UNIT_VERIFIED |
| GitHub retrieval and identity (Req 5, 16) | `backend/app/modules/github/client.py` | `test_github_client.py`, `test_mcp_github_success.py` | UNIT_VERIFIED. Success path through MCP now covered (section C.3) |
| Evidence model and identity (Req 4, 7) | `backend/app/modules/evidence/models.py`, `identity.py`, `contract.py` | `test_evidence_model.py`, `test_evidence_identity.py` | UNIT_VERIFIED (I2) |
| Ranking (Req 6) | `backend/app/modules/investigation/ranking.py` | `test_investigation_ranking.py` | UNIT_VERIFIED. Weights are configuration, not calibrated (D05) |
| Classification (Req 8, 9) | `backend/app/modules/investigation/classification.py` | `test_investigation_classification.py` | UNIT_VERIFIED. INFERRED not reached end to end (section F, F1) |
| Result assembly and invariants (Req 9, 12) | `backend/app/modules/investigation/result.py`, `orchestrator.py` | `test_investigation_result.py`, `test_investigation_orchestrator.py` | UNIT_VERIFIED and INTEGRATION_VERIFIED |
| Deterministic explanation (Req 10, Spec 1 §11.1) | `backend/app/modules/explanation/templates.py` | `test_explanation_templates.py`, `test_explanation_integration.py` | UNIT_VERIFIED and INTEGRATION_VERIFIED |
| Optional AI (Req 11, Spec 1 §11.2 to §11.3) | Not implemented. Task 14 DEFERRED | None | DEFERRED (E-D13 record §9) |
| Failure semantics (Req 12) | `orchestrator._failed` | `test_explanation_integration.py::test_failed_retrieval_produces_no_explanation`, `test_api_investigations.py` | INTEGRATION_VERIFIED |
| HTTP API and status mapping (Req 9, design C.11) | `backend/app/api/app.py` | `test_api_investigations.py` (ASGI), `backend/tests/integration/test_http_e2e.py` (real process) | UNIT_VERIFIED and RUNTIME_VERIFIED |
| MCP tools (Req 13, D02 §16) | `backend/app/modules/mcp/tools.py`, `server.py`, `__main__.py` | `test_mcp_tools.py`, `test_mcp_server.py`, `test_mcp_contract.py`, `test_mcp_number_input.py`, `test_mcp_github_success.py` | UNIT_VERIFIED and RUNTIME_VERIFIED (STDIO) |
| Subprocess safety (Req 15) | `backend/app/core/git_runner.py` | `test_core_git_runner.py` | UNIT_VERIFIED. Process-tree termination added and tested (section D.1) |
| Configuration (Req 18) | `backend/app/core/limits.py` (proposed values). No loader | None for a loader | BLOCKED (Task 16.1, OD-5) |
| Diagnostics and redaction (Req 19, 20) | `backend/app/core/diagnostics.py` | `test_core_diagnostics.py`, `test_api_investigations.py`, `test_http_e2e.py` | UNIT_VERIFIED and RUNTIME_VERIFIED |

## C. Runtime evidence

All runtime checks use a disposable repository created under the system temporary directory. The user's registry and repositories were not used or changed. The HTTP and STDIO processes listen on loopback only, and the MCP STDIO process opens no listener.

### C.1 HTTP end-to-end (automated)

File: `backend/tests/integration/test_http_e2e.py` (7 tests). It starts `uvicorn app.main:app` on 127.0.0.1 with a temporary `LOCALAPPDATA` and a fake token, and it sends real requests.

Results (fresh run, 2026-11-10): 7 passed.

- Valid request: 200, `COMPLETE`, `DOCUMENTED`.
- Unregistered repository: 404 `REPOSITORY_NOT_FOUND`.
- Path traversal: 400 `INVALID_INPUT`, value not echoed.
- Unknown field: 400 with `field` naming the field only.
- Malformed JSON: 400 with no `field`.
- No response contains the repository path or the fake token.
- Graceful shutdown: CTRL_BREAK_EVENT produces "Shutting down", "Application shutdown complete", and "Finished server process". The fake token and repository path do not appear in the log.

### C.2 HTTP runtime (manual, earlier this session, recorded in phase-status §32)

Valid request 200. Unregistered 404. Traversal, unknown field, missing field, wrong type, absolute path, malformed JSON, and array body all returned 400 with sanitized bodies. Startup used the approved registry path after the fix in section C.6. The listener was bound to 127.0.0.1 only.

### C.3 MCP STDIO (automated, and manual)

- `backend/tests/unit/test_mcp_server.py::test_stdio_handshake_lists_the_four_tools_and_exits_when_stdin_closes`: initialize, `tools/list` returns exactly `search_history`, `blame_range`, `get_pr`, `get_issue`, and the process exits 0 after stdin closes. Passes.
- Manual run with the exact `mcp.json` launch shape (`-P -m app.modules.mcp`, PYTHONPATH set), recorded in phase-status §32.3: handshake, four tools, and a `tools/call search_history` returning `COMPLETE` with 4 evidence items and no classification field. Exit 0 after stdin closed, stderr empty.
- Successful `get_pr` and `get_issue` through the tools: `test_mcp_github_success.py`, using a canned opener. No network.

### C.4 Tool registration and execution

Four tools are registered and no others. Tests: `test_mcp_server.py::test_exactly_the_four_approved_tools_are_registered`, and the STDIO test above.

### C.5 Startup, shutdown, and the Uvicorn exit code 3

- Startup: verified (C.1, C.2, C.3).
- Graceful shutdown: verified by the shutdown log (C.1).
- Exit code 3 after CTRL_BREAK is **explained**, not left open. Uvicorn's `capture_signals` re-raises the captured signal after shutdown (uvicorn `server.py`, `capture_signals`, which handles `SIGBREAK` on Windows). A probe that re-raises `SIGBREAK` on this machine exits with code 3. The shutdown itself completed before the re-raise. The regression test asserts code 3 for this reason.

### C.6 Registry behavior

Both entry points now call `load_registry(default_registry_path())`. A regression test enforces it: `test_mcp_contract.py::test_entry_point_loads_the_approved_registry_path`. Before the fix, both entry points passed `None`, so no repository was registered. That defect is recorded in phase-status §33.

### C.7 Diagnostics and redaction

- The fake token does not appear in responses or logs (`test_http_e2e.py`, `test_api_investigations.py::test_token_is_redacted_in_the_real_logging_path`).
- Logs record only fields from the diagnostic allowlist.

## D. Security evidence

### D.1 Git subprocess safety

- Argument arrays, no shell, guard options, allowlisted subcommands, controlled environment, timeouts, bounded output: `test_core_git_runner.py` (UNIT_VERIFIED).
- **New in this session:** timed-out Git calls now terminate their process tree on Windows, through the system `taskkill.exe` by absolute path with an argument array and an integer PID. Before the change, a descendant holding the output pipe blocked the runner for 120 seconds in a reproduced experiment. After the change, it returns in about 1.5 seconds. Regression tests: `test_timeout_also_stops_a_descendant_that_holds_the_output_pipes` and `test_output_is_not_success_when_a_descendant_keeps_the_pipe_after_the_child_exits`.
- **Owner awareness required:** this adds one system-binary invocation to the Git runner. It is documented in `git_runner.py` (`_terminate_tree`). The owner should note it as a new subprocess use under Architecture §18 and Playbook §8.

### D.2 Path validation

Containment, reserved names, traversal, and absolute paths: `test_repository_containment.py`, `test_repository_paths.py`, `test_repository_target_path.py`. API traversal returns 400 without echoing the value (`test_http_e2e.py`).

### D.3 Input validation

- HTTP: Pydantic models with `extra="forbid"`, field-name-only errors (`test_api_investigations.py`, `test_http_e2e.py`).
- MCP: positive-decimal `number` (DEC-15), `max_results` range, line-span limits (`test_mcp_tools.py`, `test_mcp_number_input.py`).

### D.4 Token handling

The GitHub token is read from `SEAN_GITHUB_TOKEN` only, sent only to `api.github.com` over HTTPS, registered for redaction, and absent from output. Tests: `test_github_client.py`, `test_mcp_github_success.py` (the canned opener asserts the host is `api.github.com`, and socket use fails the test), `test_http_e2e.py`.

### D.5 Error sanitization

Errors carry codes and fixed messages. Stderr from Git is discarded. Category C failures return `INTERNAL_ERROR` with no rule name (`test_api_investigations.py::test_category_c_violation_is_500_without_rule_name`).

### D.6 Untrusted repository content

- Commit messages, author names, and blame content do not reach the explanation. Only the path and symbol carry repository-derived text.
- New in this session: explanation text replaces control and format characters (Unicode categories Cc and Cf, including right-to-left overrides) with spaces, and collapses whitespace (`templates.py::_single_line`). Tests: `test_bidirectional_and_control_characters_in_untrusted_names_are_replaced`, `test_line_breaks_in_untrusted_scope_values_cannot_break_the_layout`.

### D.7 Repository integrity after read-only operations

MCP-05 snapshot test: a hash of every file and directory, including `.git`, is identical before and after each tool call (`test_mcp_contract.py`, six cases). Passes.

### D.8 Independent security review (this session)

A review-only security-auditor sub-agent reviewed this session's changes. It did not modify files. Findings and dispositions:

| Finding | Severity | Disposition |
|---|---|---|
| Runner could return partial output as success when a descendant held the pipe after the child exited 0 | Medium | **Fixed.** Raises `GIT_TIMEOUT`. Regression test added |
| Explanation asserted a symbol-level change, but history is file-level | Medium | **Fixed.** Conclusions name only the path. Tests updated |
| Test called `taskkill`, `tasklist`, and `git` by bare name and killed a PID without confirming it | Medium | **Fixed for the new test.** Absolute System32 paths, and kill only after `tasklist` confirms the process is alive |
| HTTP test left the child running after a failure | Low | **Fixed.** `try/finally` cleanup |
| HTTP test child inherited the full environment | Low | **Fixed.** Minimal inherited environment |
| HTTP test pipe not drained | Low | **Fixed.** Output to a log file |
| Canned opener did not check the token's destination | Low | **Fixed.** Host assertion and socket guard |
| Bidirectional and control characters in explanation text | Low | **Fixed** (D.6) |
| A descendant whose parent has already exited is not killed by `taskkill /T`; its pipe handles remain | Low | **Not fixed.** Needs a Windows job object. Recorded as a limitation (section F) |
| `_terminate_tree` does not wrap `process.kill()` | Informational | Recorded. Not reached in tests |
| Port probe race in the HTTP test | Informational | Recorded. Test-only |
| Pre-existing `git` called by bare name in `test/unit/conftest.py` and other test helpers | Low, pre-existing | **Not changed in this session.** Recorded (section F) |

The reviewer confirmed these as clean: the `taskkill` argument list (integer PID, no shell), the absolute `System32` path, error and output leakage, the child environment allowlist, network reachability in the MCP success tests, and loopback binding.

### D.9 Not reviewed by the sub-agent

The reviewer did not read `paths.py`, `validation.py`, `history.py`, `blame.py`, `tools.py`, `registry.py`, or the config module. The explanation's protection against untrusted path characters relies on the new `_single_line` layer. Whether the upstream path normalizer already rejects these characters was not verified in this session.

## E. Deterministic explanation examples

All examples are real output from `run_examples.py` in the system temporary directory. Repository state, commit identifiers, and paths are from disposable repositories. Only the first 12 characters of each source identifier are shown.

### E.1 DOCUMENTED (symbol, two commits)

Repository: `src/a.py` with `def target()` changed in two commits.
Request: `investigate(path="src/a.py", symbol="target")`.

- Retrieval: `COMPLETE`. Classification: `DOCUMENTED`. Target resolution: `RESOLVED`.
- Supporting evidence: two `GIT_COMMIT` records (`f57b58916395`, `3cf56a291519`) and two `GIT_BLAME` records for `src/a.py`. The commit records have verified structural relations.
- Explanation (verbatim):

> Verified repository history records 2 commit(s) that changed src/a.py. These records establish that the changes occurred. They do not state why. Blame attributes 2 line range(s) in the target to verified commits. The symbol target is not separated from the file history. Commit relevance to the symbol is not established. Unknown: why these changes were made, and whether history outside the retrieved scope affects this answer. Limitations: Rename and copy detection is heuristic, so some history may be attributed to a different path. Symbol history is tracked at file level, so commits that changed other parts of the file are included. Pull request and issue evidence is not included, because the association step is not implemented. Evidence that would help: the diff of each listed commit, to see what each change did.

### E.2 INSUFFICIENT_EVIDENCE (path with no history)

Request: `investigate(path="src/never.py")`.

- Retrieval: `INSUFFICIENT`. Classification: `INSUFFICIENT_EVIDENCE`. Conclusion: none (abstention). Evidence: none.
- Explanation (verbatim):

> The available evidence about src/never.py does not support a reliable conclusion. No historical conclusion is stated. Unknown: whether src/never.py has a documented change history, and why these changes were made. Limitations: Rename and copy detection is heuristic, so some history may be attributed to a different path. Pull request and issue evidence is not included, because the association step is not implemented. No commit history was retrieved for the target. Evidence that would help: complete history for the target, from a full clone or a broader retrieval.

### E.3 PARTIAL_EVIDENCE (shallow clone)

Repository: a shallow clone (`--depth 1`) of the repository in E.1. Request: `investigate(path="src/a.py")`.

- Retrieval: `PARTIAL`. Classification: `PARTIAL_EVIDENCE`. Evidence: one `GIT_COMMIT` record.
- Explanation (verbatim):

> Verified repository history records 1 change(s) to src/a.py. Retrieval was incomplete, so the supported portion is limited to these records. Unknown: why these changes were made, and the history that the incomplete retrieval did not cover. Limitations: Rename and copy detection is heuristic, so some history may be attributed to a different path. The repository is a shallow clone, so older history may be missing. Pull request and issue evidence is not included, because the association step is not implemented. Evidence that would help: the complete history for the target, from a full clone.

### E.4 Co-changed documentation (the INFERRED case, not reached)

Repository: `src/a.py` and `docs/notes.md` changed in the same two commits. Request: `investigate(path="src/a.py")`.

- Retrieval: `COMPLETE`. Classification: **`DOCUMENTED`**, not `INFERRED`. The INFERRED branch is not reached (finding F1, section F).
- Explanation (verbatim):

> Verified repository history records 2 commit(s) that changed src/a.py. These records establish that the changes occurred. They do not state why. Documentation changed in 2 of these commits. That co-change does not establish a content relation or intent. Unknown: why these changes were made, and whether history outside the retrieved scope affects this answer. Limitations: Rename and copy detection is heuristic, so some history may be attributed to a different path. Pull request and issue evidence is not included, because the association step is not implemented. Evidence that would help: the diff of each listed commit, to see what each change did.

### E.5 FAILED (simulated Git timeout)

Retrieval: `FAILED`. Classification: none. Conclusion: none. **Explanation: none.** Evidence: empty. Error code `GIT_TIMEOUT`, retryable.

### E.6 TARGET_AMBIGUOUS

Repository with two `run` methods in two classes. Request: `investigate(path="src/a.py", symbol="run")`. Result: request error `TARGET_AMBIGUOUS` with candidates `A.run` and `B.run`. No choice is made.

### E.7 Expected behaviour that the examples show

- DOCUMENTED states the verified fact and denies that history states the reason.
- INSUFFICIENT abstains and gives no conclusion.
- PARTIAL states the verified portion and the incomplete retrieval.
- FAILED gives no explanation.
- The symbol conclusion names only the path. The file-level limit is stated once.

## F. Remaining limitations

These limitations are carried forward. None is hidden.

**Findings from this session:**

- **F1. INFERRED is not reached end to end.** Documentation co-change always appears together with verified commits for the target, and any verified commit classifies as DOCUMENTED (`classification.py`, `classify`). The INFERRED branch exists and is unit-tested, but no realistic repository produces it. **Classification-design question: owner decision required.** The change is not made here.
- **F2. Association is not implemented.** G-M is not approved. The PR and issue criterion stays at zero, and every explanation says so.
- **F3. Cache (Task 10) is not implemented.** D06 and D07 are open.
- **F4. Task 14 (optional AI) is DEFERRED** by owner decision (E-D13 record §9).
- **F5. Descendant processes that outlive their parent are not terminated.** `taskkill /T` reaches only descendants linked to a live parent. Completing this needs a Windows job object. Recorded as a known limitation.
- **F6. Contract differences G1 to G5** (MCP error envelope, path-escape code, no-history code, result-limit code, and the MCP absence of the target-resolution code). These are differences from the proposed D02 §16, not approved-contract violations. They stay as strict expected failures in `test_mcp_contract.py`.
- **F7. `retrieved_at` precision.** The orchestrator accepts a `retrieved_at` that is not truncated to whole seconds only through direct calls, which then fail inside the integrity model with a raw validation error. The HTTP path generates a whole-second timestamp, so the production route is unaffected. Not fixed in this session.
- **F8. `ai_available` in the diagnostic log is hard-coded to `False`** (`api/app.py`). It does not reflect a real provider check. Not fixed; the provider is deferred.
- **F9. Pre-existing bare `git` calls in test helpers** (`tests/unit/conftest.py`, `test_core_git_runner.py::_git`). Test-only. Not changed.

**Items still open from earlier phases:**

- Task 16.1 numeric limits (OD-5) are unapproved. Several limits are hard-coded as proposed values in `core/limits.py`.
- MCP-10 (determinism, Hypothesis) is not executed. Hypothesis is not installed and is not authorized.
- MCP-18 (Kiro runtime compatibility) is not executed. It depends on C-D7 and the D02 §12 tests (T3, T7b, T10, T12).
- `.kiro/settings/mcp.json` enablement is not authorized (C-D7).
- Live Category C (500) response on a running server is not observed (only the ASGI test).
- Golden-repository tests (Task 18) are not part of this authorization.
- Ranking weights are configuration and are not calibrated (D05).
- The `tasks.md` header ("NOT APPROVED. No task may start.") conflicts with the OD-16 approval of the file's hash. See section 7.

## G. Acceptance recommendation

**I5: technically ready for owner review with the caveats F1, F2, F3, and F4.** I5 is not accepted. Acceptance should be decided with F1 in view, because the INFERRED classification is part of the approved classification vocabulary and is currently unreachable from real repositories.

**I6: technically ready for owner review with the caveats F5, F6, F7, F8, and the open items in section F.** I6 is not accepted. The MCP contract differences in F6 are proposal differences, not approved-contract violations, but the owner should decide whether D02 §16 is amended or the implementation changed before MCP is enabled.

**Phase 3 is not complete.** Phase 4 must not start until the owner accepts I5 and I6, and until the owner decisions in section 7 are recorded.

## 7. Governance and documentation issues

Each issue is classified as IMPLEMENTATION DEFECT, DOCUMENTATION DEFECT, GOVERNANCE DEFECT, OWNER DECISION REQUIRED, ACCEPTED DEFERRAL, or HISTORICAL RECORD ONLY.

| # | Issue | Classification | Disposition |
|---|---|---|---|
| G-1 | `tasks.md` header "NOT APPROVED. No task may start." conflicts with the OD-16 approval of the file's hash (phase-status §23) | GOVERNANCE DEFECT. OWNER DECISION REQUIRED | **Not resolved here.** The header is part of the approved baseline text. The owner must decide whether the header is stale and whether the file needs re-approval. The OD-16 record is preserved |
| G-2 | `design.md` line 129 said optional AI is not designed and cited "Architecture §5" for the no-interface rule | DOCUMENTATION DEFECT | **Fixed** under owner authorization. The bullet now states the deferral and cites Architecture §2.7 and §7. Approved baseline hash changed (see E-D13 record §9 and phase-status §37) |
| G-3 | `design.md` E-D13 row said "Optional AI provider" without status | DOCUMENTATION DEFECT | **Fixed** under owner authorization. Records the deferral and open items |
| G-4 | `tasks.md` Task 14 header and subtask 14.1 implied a pending provider decision | DOCUMENTATION DEFECT | **Fixed** under owner authorization. Records DEFERRED. Checkboxes unchanged (`[ ]`) |
| G-5 | E-D13 decision record status | ACCEPTED DEFERRAL | Section 9 appended. AI-2 and AI-4 remain APPROVED. AI-3 remains OPEN. Gemini and Task 14 DEFERRED |
| G-6 | Native design and task files are at OD-16 hashes. Edits in G-2 to G-4 change those hashes | GOVERNANCE DEFECT. OWNER DECISION REQUIRED | The OD-16 approval record is preserved. **The owner must re-review and re-approve the amended files** |
| G-7 | D02 §16 status | HISTORICAL RECORD ONLY (corrected in phase-status §33). The §12 status snapshot line (`MCP implementation: NOT STARTED`) is an earlier revision | No further change. Current D02 status is PARTIAL and PROPOSED (except DEC-15) |
| G-8 | DEC-15 references | Consistent. D02 §19.2 DEC-15 and phase-status §33 | No change |
| G-9 | D01 dependency reproducibility (no lock file, no `requirements.txt`) | ACCEPTED DEFERRAL (D01 lock step pending) | No change. Requires separate authorization |
| G-10 | AI-3 and AI-10 conflict | ACCEPTED DEFERRAL. The conflict is moot while Gemini is deferred. Recorded in the E-D13 addendum | No change. Revisit on reconsideration |
| G-11 | Task 16.1 numeric limits and configuration (OD-5, O-G1) | OWNER DECISION REQUIRED | Not approved. Task 16.1 BLOCKED |
| G-12 | Task 10 cache (D06, D07, E-D6, E-D7) | OWNER DECISION REQUIRED | Not implemented. The owner must decide whether the MVP needs the cache for I5 |
| G-13 | API and MCP contract (G1 to G5) | OWNER DECISION REQUIRED | Strict expected failures. No change without authorization |
| G-14 | INFERRED reachability (F1) | OWNER DECISION REQUIRED | Not changed |
| G-15 | phase-status §1 phase table shows Phase 3 at "I0 only" | DOCUMENTATION DEFECT (historical table, superseded by later sections) | Dated amendment appended in phase-status §37. §1 not rewritten |
| G-16 | Test counts and historical results in phase-status | HISTORICAL RECORD ONLY. Each checkpoint records the count of its own run | This package uses fresh counts (section 8) |
| G-17 | Native Task 14 deferral versus I5 plan (`i5-i6-backend-implementation-plan.md` §4.1 lists Task 14 as optional and open) | DOCUMENTATION DEFECT (plan text is stale) | Recorded here. Plan not edited. Plan revision needs a separate authorization |

## 8. Verification (fresh runs, 2026-11-10)

Commands run from `backend` with the project venv (`.venv\Scripts\python.exe`), `-p no:cacheprovider`, and `PYTHONDONTWRITEBYTECODE=1` where noted.

| Check | Command | Result |
|---|---|---|
| Full backend suite | `python -m pytest tests -q -rfxXs --tb=short -p no:cacheprovider` | **1024 passed, 0 failed, 0 skipped, 6 xfailed** (strict, see F6). Duration 257 s |
| Dependency consistency | `python -m pip check` | No broken requirements found |
| HTTP application import, warnings as errors | `python -W error -c "import app.main"` | Exit 0 |
| MCP and explanation module import, warnings as errors | `python -W error -c "import app.modules.mcp.server, app.modules.mcp.tools, app.modules.explanation.templates, app.core.git_runner"` | Exit 0 |
| Focused: explanation, orchestrator, Git runner, MCP GitHub success, HTTP end-to-end | `python -m pytest tests/unit/test_core_git_runner.py tests/unit/test_explanation_templates.py tests/unit/test_explanation_integration.py tests/unit/test_mcp_github_success.py tests/unit/test_investigation_orchestrator.py tests/integration/test_http_e2e.py -q` | 104 passed |
| Focused: Git, MCP, API, explanation, HTTP | Earlier run in this session covering the same suites plus Git history and blame | 231 passed, 6 xfailed (before the security-review fixes) |
| Disposable examples | `run_examples.py` in the system temporary directory | Current output used in section E |

**Counts are not carried over from earlier checkpoints.** The full-suite result above is a fresh run. Earlier checkpoints recorded 914 (phase-status §31) and 972 (phase-status §33), each for its own run.

## 9. Files changed in this session

Hashes are recorded in the session report and in phase-status §37. Approved documents not listed here are unchanged (section 10 below).

Code:
- `backend/app/core/git_runner.py`: process-tree termination on timeout and overflow; output not returned when a reader is still alive.
- `backend/app/modules/explanation/templates.py`: rewritten wording; fixed limitation sentences; symbol conclusions name only the path; control and format characters replaced; co-change and blame sentences used.
- `backend/app/modules/investigation/orchestrator.py`: limitation messages come from `limitation_sentence`.

Tests:
- `backend/tests/unit/test_explanation_templates.py`: extended.
- `backend/tests/unit/test_explanation_integration.py`: new.
- `backend/tests/unit/test_mcp_github_success.py`: new.
- `backend/tests/unit/test_core_git_runner.py`: new process-tree and descendant tests.
- `backend/tests/integration/test_http_e2e.py`: new.

Documentation:
- `.kiro/specs/evidence-retrieval/design.md`: three text edits (owner-authorized; approved baseline).
- `.kiro/specs/evidence-retrieval/tasks.md`: two text edits in Task 14 (owner-authorized; approved baseline). Checkboxes unchanged.
- `docs/development/e-d13-optional-ai-provider-decision-record.md`: §9 appended.
- `docs/development/i5-i6-owner-acceptance-package.md`: new (this file).
- `.kiro/reports/phase-status.md`: §37 appended.

## 10. Protected documents

Not changed in this session: architecture, Spec 1, Spec 2, D01, D02, `requirements.md`, `.kiro/settings/mcp.json`, and the OD-16 baselines for `requirements.md`. Verified by SHA256 in the session report.

## 11. Owner decisions required before acceptance

1. **F1, INFERRED reachability.** Decide whether documentation co-change alone should ever classify as INFERRED when verified commits exist for the target, or whether the current behavior is correct. Options: keep the current behavior and document it; or change the classification rule through an approved amendment. Tasks affected: I5 classification acceptance.
2. **G-1, the `tasks.md` header.** Decide whether the header is stale. Options: correct the header through an amendment and re-approve; or keep the header and treat the OD-16 approval as the operative record. Tasks affected: all native tasks.
3. **G-6, re-approval of amended design and task files.** Decide whether the three design edits and two task edits are approved as amended.
4. **G-12, cache.** Decide whether Task 10 (cache) is required for I5 acceptance, or deferred with its D06 and D07 decisions.
5. **G-13, MCP contract differences G1 to G5.** Decide whether D02 §16 is amended to match the implementation, or the implementation is changed to match D02. Tasks affected: MCP acceptance and any MCP enablement.
6. **G-11, configuration and limits (OD-5).** Decide the numeric values for Task 16.1.
7. **Association (G-M).** Decide whether PR and issue association is needed for I5. If it is, a separate approval is required.
8. **New subprocess use (section D.1).** Confirm that the system `taskkill.exe` invocation in the Git runner is accepted.

Each item above needs an explicit owner decision. Kiro has not recorded any of them as approved.

---

*This package records verification results and open decisions. It does not accept I5 or I6. The owner's acceptance decision is recorded separately.*
