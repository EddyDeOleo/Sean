# Sean I5 and I6 backend implementation plan (reconciled)

Status: planning and reconciliation artifact. It is not an approval. It authorizes no implementation, no dependency installation, no network access, no configuration change, no Native Spec change, no decision-record change, and no task checkbox change.

Recorded: 2026-11-10 (session date). This revision replaces the earlier draft of the same date. Corrections are listed in section 13.

Scope: the remaining backend increments I5 and I6, the verified state of I0 to I4, the decisions and amendments that block them, and the execution order. Frontend work is excluded (section 10).

---

## 0. Labels used in this document

Each claim carries one of these labels:

- **[OWNER-APPROVED]**: the owner approved it in a recorded decision.
- **[OWNER-DIRECTION]**: an owner statement recorded in the repository, but not a formal approval.
- **[OWNER-PROVIDED]**: stated by the owner in a request. Not found in the repository.
- **[NATIVE-APPROVED]**: approved document text (Spec 1 or Spec 2 at the recorded version, or the native Spec at the OD-16 hashes).
- **[IMPLEMENTED]**: code exists in the repository.
- **[UNIT-VERIFIED]**: tests exist and were run, with results recorded in the repository or in the session output.
- **[ACCEPTED]**: explicit owner acceptance in the repository. None exists for I2 or any I3/I4 task.
- **[RECOMMENDATION]**: a proposal by this plan or a prior report. Not approved.
- **[OPEN]**: no decision yet.
- **[BLOCKER]**: a technical or decision dependency that prevents correct completion.

---

## 1. Sources read and the reading record

### 1.1 How the reading was done

The full reading of the listed documents was done by five read-only delegated readers, each reading its documents to end of file. Their reports were checked against the points below. The reading covers every listed document.

The line counts reported by the readers and by my own counting method differ by about 40% for the same files, while the SHA-256 hashes match. Line counts are therefore not used as identifiers here. The hashes are the identifiers.

### 1.2 Documents, hashes, and status

| Document | SHA-256 (first 16) | Status recorded in the document | Reading |
|---|---|---|---|
| `docs/specs/spec-1-evidence-retrieval.md` | 71FEF399A02C35EC | Version 2.4, Approved | Read to end (delegated reader 1) |
| `docs/specs/spec-2-ouija-experience.md` | EF7971157A0CE169 | Version 1.6, Approved | Read to end (delegated reader 1) |
| `docs/architecture/architecture-and-project-setup.md` | 3AB618886BBE2F70 | Version 1.4, Approved | Read to end (delegated reader 2) |
| `docs/development/kiro-engineering-playbook.md` | 594262B51B44DF2F | Version 1.0, Approved | Read to end (delegated reader 2) |
| `docs/development/kiro-operating-guide.md` | 144C31653E58294D | Version 1.0, Approved | Read to end (delegated reader 2) |
| `docs/development/d01-dependency-decision-record.md` | 053E3E373EA2D076 | "APPROVED WITH CONDITIONS (documentation closure only)" | Read to end (delegated reader 3) |
| `docs/development/d02-mcp-integration-decision-record.md` | 62561C74471D6144 | "D02 overall: IN PROGRESS" | Read to end (delegated reader 3) |
| `docs/development/d03-golden-repository-and-baseline-decision-record.md` | 12AA12BC302F1D5C | "APPROVED (repository and commit)" | Read to end (delegated reader 3) |
| `.kiro/specs/evidence-retrieval/requirements.md` | 51123AEA8E150B30 | "draft for human review" in the body; baseline approved by OD-16 at this hash | Read to end (delegated reader 4) |
| `.kiro/specs/evidence-retrieval/design.md` | EBDB3BFDC9A11F07 | No status line; open decisions "not treated as settled"; baseline approved by OD-16 at this hash | Read to end (delegated reader 4) |
| `.kiro/specs/evidence-retrieval/tasks.md` | B286FD21ECF90C12 | "NOT APPROVED. No task may start." (line 7); baseline approved by OD-16 at this hash | Read to end (delegated reader 4) |
| `.kiro/specs/ouija-experience/requirements.md` | 7D0549C89C8DAD3E | "draft for human review" | Read to end (delegated reader 4) |
| `.kiro/specs/ouija-experience/design.md` | 0749FB3F188EBE69 | No status line | Read to end (delegated reader 4) |
| `.kiro/specs/ouija-experience/tasks.md` | 61B993FEF03660CE | "NOT APPROVED. No task may start." | Read to end (delegated reader 4) |
| `docs/development/i3-i4-owner-decision-package.md` | EA479E39EEDA6563 | Decision package. Part 15 records OD-16 approval. Part 2 header of OD-16 still reads "OPEN" (see section 13). | Read to end (delegated reader 5) |
| `docs/development/i3-i4-readiness-closure-report.md` | C8B48FA829B57D75 | Readiness report. OD-16 row reads APPROVED. | Read to end (delegated reader 5) |
| `.kiro/reports/phase-status.md` | 4610CE8D7797CEAC | Status and authorization history, §1 to §26 | Read to end (delegated reader 5) |
| `docs/development/i5-i6-backend-implementation-plan.md` | (this file; prior revision 5302575B4EC2D709) | Planning artifact | Read to end (delegated reader 5) |
| `.kiro/settings/mcp.json` | 02FB9811E5EBDBDF | Exists. Launch entry `app.modules.mcp`. Not changed. | Read only (this session) |

Hashes were recorded at the start of this reconciliation. The approved baseline hashes of the three native Spec files match the OD-16 record.

### 1.3 Documents that were not available

No listed document is missing. The original I0 to I6 plan is not in the repository (section 2).

---

## 2. Original I0 to I6 plan

### 2.1 Provenance

[OWNER-PROVIDED] The seven increment names and titles below are the owner-provided recovered plan. They were stated in the request for this reconciliation. They are historical context. The repository does not contain the plan file.

[OWNER-PROVIDED] The exact names:
- I0 — Initial MVP Preparation
- I1 — Repository Registry & Core Paths
- I2 — Evidence Model & Canonical Identity
- I3 — Git History & Evidence Retrieval
- I4 — GitHub Integration
- I5 — Investigation & Explanation
- I6 — API, System Integration & MCP

[NATIVE-APPROVED] `.kiro/reports/phase-status.md` §8.1 states that the plan is not in the workspace. This remains true.

### 2.2 Recorded scope against the owner-provided titles

| Increment | Recorded scope in the repository | Status | Note |
|---|---|---|---|
| I0 | Evidence task 0, Ouija task 0, Evidence task 15.1 (phase-status §4) | [UNIT-VERIFIED] at the documentation level. Not accepted. | Matches the title. |
| I1 | Evidence tasks 1.1 to 1.3 (phase-status §5, §7). §7.1 lists `backend/app/core/paths.py` among the I1 files. | [OWNER-APPROVED] accepted (phase-status §7) | The title "Core Paths" is partly covered by `core/paths.py` (local data location). Path containment (Task 2) is not in I1. |
| I2 | Evidence tasks 7.1, 7.2, 7.3 (see section 9.1 for the 7.2 history) | [UNIT-VERIFIED] for 7.1, 7.2, 7.3. [IMPLEMENTED]. **NOT ACCEPTED.** | Matches the title. |
| I3 | No scope recorded as an I3 label. Tasks 2.1 to 2.4, 3.1 to 3.4, 4.1, 4.2, 5.1 to 5.4, 6.1 to 6.3 were implemented under the owner directive in phase-status §25. | [IMPLEMENTED]; [UNIT-VERIFIED]. Not accepted. | The owner title "Git History & Evidence Retrieval" covers Tasks 5 and 6. Tasks 2, 3, and 4 (path containment, guarded runner, target resolution) are implemented under I3 work but are not named by the owner title. See section 13. |
| I4 | Evidence tasks 9.1 to 9.3 (phase-status §25) | [IMPLEMENTED]; [UNIT-VERIFIED]; one owner-authorized live read-only request. Not accepted. | Matches the title. |
| I5 | No recorded scope. Section 4 maps existing task IDs by function. | Not started. | Mapping is this plan's [RECOMMENDATION]. |
| I6 | No recorded scope. Section 5 maps existing task IDs by function. | Not started. | Mapping is this plan's [RECOMMENDATION]. |

---

## 3. Verified state of I0 to I4

Vocabulary: IMPLEMENTED means code exists. UNIT-VERIFIED means tests were run and their results observed. ACCEPTED means owner acceptance in the repository.

### 3.1 I0 and I1

| Item | Status | Basis |
|---|---|---|
| I0 (Evidence 0, Ouija 0, Evidence 15.1) | UNIT-VERIFIED (documentation confirmation). Not ACCEPTED. | phase-status §4.1 to §4.5 |
| I1 (Evidence 1.1 to 1.3) | ACCEPTED | phase-status §7 ("Owner decision: I1 ACCEPTED"). 83 tests passed (§7.1). |

### 3.2 I2 (Evidence Model & Canonical Identity)

| Task | Status | Basis and caveats |
|---|---|---|
| 7.1 evidence fields and source types | IMPLEMENTED; UNIT-VERIFIED (phase-status §18.7). Not ACCEPTED. | `backend/app/modules/evidence/models.py`, `contract.py`. |
| 7.2 canonical identity and `evidence_id` | IMPLEMENTED; UNIT-VERIFIED (§15.1, §18.7). Not ACCEPTED. | `backend/app/modules/evidence/identity.py` (`derive_evidence_id`, source-identifier builders), `backend/app/core/git_objects.py`. Authorization: see section 9.1. |
| 7.3 unavailable versus verified absent | UNIT-VERIFIED (§18.7). Not ACCEPTED. | Same model files. |

[ACCEPTED] None. I2 is NOT ACCEPTED. Successful unit tests do not change this.

### 3.3 I3 and I4 (implemented under the owner directive)

[OWNER-DIRECTION] The owner directive recorded in phase-status §25 authorized completion of the I3 and I4 scope. The verbatim request text is not in the repository. Only the summary in §25 and the authorization records in §23 and §24 are on disk.

| Native task | Module (verified to exist) | Status | Notes |
|---|---|---|---|
| 2.1 lexical path rules | `repository/paths.py` (`normalize_target_path`) | IMPLEMENTED; UNIT-VERIFIED | Length bound 1,024 is a proposed default (see section 8). |
| 2.2 containment on resolved paths | `repository/paths.py` (`resolve_contained_path`) | IMPLEMENTED; UNIT-VERIFIED (includes a Windows junction probe) | No production caller before I6. |
| 2.3 symbol and line validation | `symbol_resolution/validation.py` | IMPLEMENTED; UNIT-VERIFIED | Span 2,000 is a proposed default. |
| 2.4 security review | Review run by a security-auditor sub-agent; findings fixed and regression-tested | Review recorded in session. Not closed by the owner. | Not ACCEPTED. |
| 3.1 to 3.4 guarded runner | `core/git_runner.py` | IMPLEMENTED; UNIT-VERIFIED (control tests for `textconv` and `log.showSignature`) | Native header: "depends on 1 and 16.1". Task 16.1 is not verified. See section 13. |
| 4.1, 4.2 target resolution | `symbol_resolution/resolver.py` | IMPLEMENTED; UNIT-VERIFIED | Method is OD-11. Parse failure is a distinct outcome. |
| 5.1 to 5.4 history | `git_history/history.py` | IMPLEMENTED; UNIT-VERIFIED | Commit-scan limit 2,000 is a proposed default (R4, AIP). |
| 6.1 to 6.3 blame | `git_history/blame.py`, `objects.py` | IMPLEMENTED; UNIT-VERIFIED | Blame span is the general 2,000-line span in code. D02 proposes 500 (section 8). Discrepancy. |
| 9.1 to 9.3 GitHub | `github/client.py` | IMPLEMENTED; UNIT-VERIFIED (loopback seam and fixtures). One live read-only request to `octocat/Hello-World` pull 1 (200). | Native header: "depends on 1, 7". OD-9 amendment not approved. Timeouts and body limit are proposed defaults. |

[ACCEPTED] None of Tasks 2 to 6 or 9 is accepted.

Test totals: the repository records 582 passed (phase-status §18, line 912) and 651 passed after Task 2 (§24). The 794 total stated in the earlier draft of this plan is not recorded in phase-status. It was observed in session output only. Section 13 corrects the earlier draft.

---

## 4. I5 (Investigation & Explanation): exact task mapping

Each entry uses the native task text (verified in `.kiro/specs/evidence-retrieval/tasks.md`, which is at the OD-16 hash).

### 4.1 Native tasks in I5

| Task | Native title | Header dependency (verbatim) | Subtask requirement references | Wave | Status | Remaining work | Tests needed | Open decisions |
|---|---|---|---|---|---|---|---|---|
| 8 | Deterministic ranking | "(depends on 7)" | 6.1 to 6.5 | 3 | NOT STARTED. No ranking code (`evidence/` holds no ranking field, per X10). | 8.1 criteria and configurable weights; 8.2 tie-break and per-criterion awards; 8.3 missing metadata is no award | Unit tests; determinism test (Hypothesis not installed; enumerated cases) | E-D5 weight calibration (D05, Phase 4). G-K dependency on Task 9 (section 9.2). |
| 10 | SQLite cache | "(depends on 9)" | 17.1 to 17.4 | 4 | NOT STARTED. No cache module. | 10.1 store with repository and source identity; invalidation; 10.2 stale flag after a failed live request | Unit tests with a cache-unavailable case | E-D6 (D06) invalidation and E-D7 (D07) location. Both open. |
| 11 | Classification and retrieval status | "(depends on 5, 7, 8)" | 7.1 to 7.4, 8.1 to 8.3 | 6 | NOT STARTED | 11.1 four retrieval statuses and four classifications as separate fields; 11.2 classification rules | Unit; full combination matrix | None recorded. Blocked by Task 8. |
| 12 | Result assembly and consistency checks | "(depends on 11)" | 9.1 to 9.8, 12.1 to 12.3 | 7 | NOT STARTED | 12.1 every Spec 1 §10.3 field; 12.2 consistency rules, `INTERNAL_ERROR` as FAILED, never silent edit; 12.3 cancellation separate | Unit; consistency; no-AI path | None recorded. Blocked by 11. |
| 13 | Deterministic explanation | "(depends on 12)" | 10.1 to 10.3 | 8 | NOT STARTED. `explanation/` holds only `.gitkeep`. | 13.1 templates for fact, inference, unknown; 13.2 abstention with source references and limitations | Unit; determinism | None recorded. |
| 14 | Optional AI wording | "(depends on 13, and on a provider decision)" | 11.1 to 11.4 | 9 | NOT STARTED | 14.1 provider selection and approval; 14.2 accept verified fields only; fallback | Unit with fakes | E-D13 provider. Owner approval of any new dependency (Operating Guide §9). Optional for MVP. |

### 4.2 Association (G-O, G-M): no native task ID

[OWNER-APPROVED] phase-status §20.1 (G-O) approves association in the Evidence workflow, associated with Task 8, with four separate operations: candidate extraction (Git History), external resolution (GitHub), association (Evidence), and ranking. It also approves placement inside Task 8's workflow, with no new task ID.

[OWNER-APPROVED] G-N (bare `#NNN` is ambiguous, never looked up), G-P (`Fixes`, `Closes`, `Resolves` are textual context only). G-Q and G-R are excluded.

[OPEN] G-M (relationship vocabulary and result-level `associations` structure) is NOT APPROVED (phase-status §20.3). Option B is a recommendation only.

[BLOCKER] Association cannot be implemented as an approved contract. It needs an owner decision on G-M, and a native amendment and canonical contract change (design "Shared integration contract (canonical)" and section C.4). The I2 `RelationshipKind` must not change.

### 4.3 Requirements that I5 implements and that have no task

- Investigation orchestration. The native Spec has no task with this name. Task 12 is the closest owner. [BLOCKER] A native amendment is needed to name it.
- Evidence collection and coordination across Git and GitHub. No task names it. Same blocker.
- Provenance and limitations in every output: Requirement 4 and Requirement 9 cover it, and Tasks 12 and 13 implement it.

---

## 5. I6 (API, System Integration & MCP): exact task mapping

### 5.1 Native tasks in I6

| Task | Native title | Header dependency (verbatim) | Subtask requirement references | Wave | Status | Remaining work | Tests needed | Open decisions |
|---|---|---|---|---|---|---|---|---|
| 15 | HTTP investigation endpoint | none at the header; dependencies sit on subtasks | 9.1, 9.8, 13.2 | 0 (15.1), 9 (15.2) | 15.1 VERIFIED as a documentation confirmation (I0). 15.2 NOT STARTED. | 15.2: `POST /investigations` in `api`, status mapping per design C.11 (200, 400, 404, 409, 503, 500), category A, B, C separation, call only the investigation and explanation functions | Route tests; each C.11 status; category B never returned as a result | FastAPI installation authorization (section 7). C-D5 decided (UUID v4). |
| 16 | Configuration and observability | "(depends on 1)" | 18.1 to 18.4, 19.1, 19.2, 20.1 to 20.4 | 2 | 16.1 NOT STARTED. 16.2 NOT STARTED. No configuration module exists (`core/` holds `git_objects.py`, `git_runner.py`, `paths.py`). | 16.1: configuration areas; numeric values from configuration; the owner gate states values must be approved before verification. 16.2: diagnostic fields; no tokens in logs. | Config defaults; rejection outside range; values reach call sites; redaction | O-G1 and OD-5 values (section 8). E-D14 values chosen at 16.1. |
| 17 | MCP adapter | "(depends on 6, 9, 12, and owner approval of this task)" | 13.1 to 13.7 | 8 | NOT STARTED. `backend/app/modules/mcp/` holds only `.gitkeep`. `mcp 2.3.0` installed. | 17.1 prerequisites (approved contract 15.1 and owner approval of task 17); 17.2 four thin adapters (`search_history`, `blame_range`, `get_pr`, `get_issue`); 17.3 STDIO entry `app.modules.mcp`; 17.4 tests MCP-01 to MCP-18; 17.5 validate or correct `mcp.json` | D02 §16.11 MCP-01 to MCP-18 | Owner approval of task 17. C-D7 and D02 closure for enablement. MCP-10 needs Hypothesis (OD-19). |

Subtask-level notes:
- 17.1 names the approved contract (15.1). The header of Task 17 does not list 15.1. See section 13.
- 17.2 names "the same functions as `api`". The api layer is not built. The shared functions are the Task 12 functions and the I3/I4 functions. Requirement 13.2 requires shared logic.
- 17.5 is the only sanctioned edit point for `mcp.json`, and only after the module exists (Requirement 13.7; DEC-13).

### 5.2 Startup and integration

- Registry startup invocation was deferred from I1 to Task 15.2 (phase-status §7.2). It is part of I6, not a separate task.
- MCP STDIO runtime behavior is not verified (D02 runtime tests T3, T7b, T10, T12). D02 status is IN PROGRESS.

### 5.3 Current MCP decision state

- [OWNER-APPROVED] D01 §4: "`mcp==2.3.0` (v2 stable line)" selected, design closed (Phase 2 owner decision).
- [OWNER-APPROVED] D02 DEC-11: closed for design. DEC-13: closed (owner; keep `mcp.json` unchanged). DEC-14: closed (owner; SHA-1 and SHA-256 only).
- [OPEN] D02 DEC-5, DEC-6, DEC-7, DEC-8, DEC-9, DEC-10 remain open (per the D02 decision log).
- [CONFLICT] D01 §2 row `mcp` reads "Not selected. See Section 4." (section 13).

---

## 6. Dependency graph (native headers, verified)

```
Done (I0, I1, I2 implemented, I3/I4 implemented)
  15.1 (done) ------------------------------------------------------------> 15.2, Ouija 1, Ouija 7
  1 (accepted) --> 16 (header) --> 16.2 (ready; header of 16 is "depends on 1")
  1, 7 --> 9 (header "depends on 1, 7")                                    [IMPLEMENTED]
  7 --> 8 (header "depends on 7")                                          [NOT STARTED]
  9 --> 10 (header)                                                        [NOT STARTED; D06 held]
  5, 7, 8 --> 11 (header)                                                  [NOT STARTED]
  11 --> 12 (header) --> 13 (header) --> 14 (header + provider decision)   [NOT STARTED]
  12, 13.1, 13.2, 15.1 --> 15.2                                            [NOT STARTED]
  6, 9, 12, owner approval --> 17 (header)                                  [NOT STARTED]
  16.1 values --> verification of 3.1, 4.2, 5.1, 5.4, 6.1, 9.1 and 16.1   [BLOCKER]
Association (G-M not approved): between 9.2 and 8.x ranking               [BLOCKER]
Golden tests 18 and acceptance 19: outside I0 to I6 as recorded           [BLOCKER]
```

Dependency gaps between headers and the design (native Spec amendment candidates, section 7):
- Task 11 header omits Task 9. The design lists `investigation` as depending on `github`. Classification of PR and issue evidence may need Task 9 complete.
- Task 17 header omits 15.1. Subtask 17.1 requires 15.1.
- Task 18 header says "D04 is an outcome, not a blocker." The design's rule says open decisions must be decided before the related task starts. This is a conflict in the approved tasks document.
- Tasks 8, 9, 10, 16 carry open-decision IDs (E-D5, E-D8, E-D6, E-D15) that their headers do not gate on.

---

## 7. Blockers and open owner decisions

Class codes: 1 blocks all of I5 or I6; 2 blocks one task; 3 can be isolated; 4 requires an explicit owner decision; 5 already resolved by a recorded decision.

| ID | Item | Affects | Class | Verified state |
|---|---|---|---|---|
| B-1 | I2 owner acceptance | Acceptance of I2 and its tasks | 4 (acceptance) | NOT ACCEPTED. Does not block implementation under the directive. |
| B-2 | Task 8 dependency on Task 9 | Task 8 closure; 11, 12, 13 | 4 + native amendment | G-K direction (phase-status §19.1, line 985) says Task 8 must depend on Task 9 "wherever pull request or issue relevance contributes to ranking." The approved header says "(depends on 7)." Task 8 dependency is not in the OD-9 amendment. |
| B-3 | Association contract (G-M) and canonical contract change | Association step; result field; C.4 | 1 for association; 4 | G-M NOT APPROVED. Option B recommended, not approved. Canonical contract is shared with Ouija (Requirement 24.3). |
| B-4 | Task 8 authorization | 8.x | 4 | No authorization beyond G-O and G-K direction. |
| B-5 | Task 16.1 numeric values (O-G1, OD-5) | 16.1 verification and every limit-enforcing task | 1 for I6 configuration; 4 | NOT APPROVED. Several proposed values are hard-coded in code (section 8). |
| B-6 | AI provider (E-D13) and dependency approval | 14.1, 14.2 | 2 | Open. Task 14 is optional for the MVP. |
| B-7 | Cache invalidation (E-D6 / D06), location (E-D7 / D07) | 10.1, 10.2 | 2 | Open (design Open decisions). |
| B-8 | D-5 to D-10 | I4 transport and tests | 4 | Used in code under the owner directive (API pin 2022-11-28, `urllib`, token from `SEAN_GITHUB_TOKEN`, fixture tests). Not recorded in the decision package as approved. OD-13 and OD-14 remain OPEN in the package, and Part 15 does not approve them. D-8 and D-9 are listed as not approved in phase-status §19 and §20; their text is not in the files read. |
| B-9 | Token variable name (E-D15, OD-14) | 9.1 | 4 | The package says no name is recorded. Design E-D15 is open. Code uses `SEAN_GITHUB_TOKEN`, per the owner directive, which is not an approval record. |
| B-10 | MCP runtime compatibility (D02 T3, T7b, T10, T12) | 17.3 verification; enablement | 4 and 3 | Not verified. D02 IN PROGRESS. |
| B-11 | FastAPI not installed | 15.2 and the HTTP runtime | 1 for 15.2; 4 | D01 §2 approves `fastapi` at `>=0.162.2,<0.163`. Not in `backend/.venv` (`pip list` shows no `fastapi`; `starlette 1.10.0` is present). D01 says installation requires separate authorization. Selection is not installation. |
| B-12 | Hypothesis not installed | Property tests (MCP-10, Property 5 and others) | 2 | OD-19. Enumerated tests only. |
| B-13 | Owner approval of Task 17 | 17.x | 4 | Required by the task header. |
| B-14 | MCP enablement in Kiro | 17.5 | 4 | C-D7; Architecture §12.2 gate; DEC-13. |
| B-15 | Tasks 18 and 19 have no owner increment | Spec 1 §23 criterion 20; Phase 4 | 4 | Phase-status §1 places "Testing, Security and Verification" in Phase 4. Owner decides whether 18 and 19 belong to I6 or Phase 4. |
| B-16 | Native amendments: name investigation orchestration; Task 11 and Task 17 header gaps | 11, 12, 17 | 4 + native amendment | Section 6 lists the gaps. |
| B-17 | Owner-plan titles versus implemented scope (I1 "Core Paths", I3 Tasks 2 to 4) | Increment reporting | 4 | Owner confirms the placement. |
| B-18 | G-1 and G-2 original alternatives | 5.1, 6.1 implementation choices | 4 | Not in the repository (OD-15). G-3 recommended `%at`, used in code, not approved. G-4 text not located. |
| B-19 | Ranking weights (E-D5, D05) | 8.1 values | 3 | Defaults can be configured. Calibration is Phase 4. |
| B-20 | Spec 1 traceability gaps (D04, D05, D06, D08; FR-10) | Phase 4 items | 3 | Listed in Spec 1 §24. |
| B-21 | Document review | Acceptance of this plan | Resolved | Section 1 records the reading. The reading was done by delegated readers. The line-count discrepancy is recorded and does not change the hash-based identification. |
| B-22 | Owner approval scope of OD-16 | I5 and I6 requirements | 4 | OD-16 approves the three hashes. The package records the approved scope as Requirements 2, 3, 14 and the design baseline (package Part 15.1). The I5 and I6 requirements are in the same file at the same hash. The owner should confirm this reading. |
| B-23 | D01 internal conflict: `mcp` "Not selected" (row, §2) versus "Selected: mcp==2.3.0" (§4) | MCP dependency record | 3 | Document correction. Not a technical blocker. |
| B-24 | Blame span: code uses the general 2,000-line span; D02 proposes 500 | 6.1 verification and 17.2 `blame_range` | 2 | Code (`blame.py` via `validate_line_range`) does not implement the 500-line bound. Needs an owner-approved value (OD-5 row V5) and a code change before 6.1 can be considered verified against D02. |
| B-25 | `repository_id` length: registry 64 (accepted I1) versus D02 128 | 15.2 and 17.2 input validation | 4 | OD-6 open. Registry accepts 64. |

Summary:
- Blocks all of I5: B-16 (orchestration naming), B-3 for the association step, B-2 for Task 8 closure.
- Blocks all of I6: B-11 (FastAPI for 15.2), B-5 (configuration values for 16.1 verification).
- Can be isolated: B-6, B-7, B-10, B-12, B-19, B-20, B-23.

---

## 8. Numeric values and their status

Status is by source. Code constants are not treated as approved values.

| Constant | Source file | Current value | Decision and status | Verification impact |
|---|---|---|---|---|
| `GIT_TIMEOUT_SECONDS` | `core/git_runner.py` | 30.0 | OD-5 R1: OPEN | Blocks verification of 3.1 (native header gate: Task 16.1). |
| `GIT_STDOUT_LIMIT_BYTES` | `core/git_runner.py` | 16 MiB | OD-5 R2: OPEN | Blocks 3.1, 4.1, 5.1, 5.4, 6.1 verification. |
| `GIT_STDERR_LIMIT_BYTES` | `core/git_runner.py` | 64 KiB | OD-5 R3: OPEN | Blocks 3.1 verification. |
| `COMMIT_SCAN_LIMIT` | `git_history/history.py` | 2,000 | OD-5 R4: AIP (exact value not approved) | Blocks 5.1 verification. |
| `LIMIT_*` processing codes (candidate, message window) | Not yet implemented in code | — | OD-5 R5 to R7: AIP | Task 5.1 processing limits are not implemented. |
| `MAX_LINE_SPAN` | `symbol_resolution/validation.py` | 2,000 | OD-5 V4: OPEN. Used by 4.1 and by blame. | Blocks 4.1, 5.1 verification. |
| `MAX_SYMBOL_LENGTH` | `symbol_resolution/validation.py` | 256 | Appears in the approved design baseline ("1 to 256 characters", design request contract). OD-5 V3 row is OPEN. | Treat as design-approved text, and confirm V3 with the owner. |
| `MAX_TARGET_PATH_LENGTH` | `repository/paths.py` | 1,024 | OD-5 V2: OPEN. C.3a says configuration sets the bound. | Blocks 2.3 length verification. |
| Blame span 500 (not implemented) | `git_history/blame.py` (uses `MAX_LINE_SPAN`, 2,000) | — | OD-5 V5 OPEN; D02 proposes 500 | Discrepancy B-24. |
| `OPERATION_TIMEOUT_SECONDS` | `github/client.py` | 5.0 | OD-5 R9: OPEN (defined as per-operation timeout under the transport contract) | Blocks 9.1 verification. |
| Total request time 15 s (R10) | Not implemented | — | OD-5 R10: OPEN. Recommended MODIFY (not enforced). | No code. |
| `BODY_LIMIT_BYTES` | `github/client.py` | 1 MiB | OD-5 R11: OPEN | Blocks 9.1 verification. |
| Retries = 0 (R13) | Implemented as absence of retry logic | — | OD-5 R13: OPEN | Blocks 9.1 and 9.3 verification. |
| Rate-limit stop (R14) | Implemented (client stops after exhaustion) | — | OD-5 R14: OPEN (method) | Blocks 9.1 and 9.3 verification. |
| Sequential Git subprocesses (R16) | Implemented by design (one at a time) | — | OD-5 R16: OPEN (not an approved source assumption) | Blocks 5.1 verification. |
| GitHub request budget (R8) | Not implemented | — | OD-5 R8: AIP | Integration step only. |
| Display limits (D1, D2) | Not implemented | — | OD-5 D1, D2: AIP | Task 8 workflow only. |
| `MAX_REGISTRY_BYTES` 256 KiB, `MAX_ROOT_LENGTH` 4,096 | `repository/registry.py` | — | OD-5 R18, R19: APPROVED (existing I1) | None. |
| Overall deadline | Not implemented | — | C-D3 / R15: APPROVED (none) | None. |
| `_READ_CHUNK` 64 KiB | `github/client.py` | 65,536 | Implementation chunk size, not a policy limit | None. |
| `max_results` default 20, range 1 to 50 | Not implemented | — | OD-5 V9: OPEN. Tasks 15.2, 17.2. | Blocks 15.2 and 17.2 verification. |

Owner action needed: approve or change each OPEN and AIP value in OD-5. Task 16.1 then moves the values into configuration. Until then, every value above is a proposed default.

---

## 9. Task 7.2 and I2 authorization (corrected)

### 9.1 History

- phase-status §9.2 and §9.3 (2026-11-10): the owner authorized Tasks 7.1 and 7.3 only. Task 7.2 was excluded. §9.4 states: "Task 7.2 (evidence_id derivation): the evidence_id format remains unresolved."
- phase-status §10 and §12 (2026-11-11): Task 7.2 "was not started" and "was not implemented."
- phase-status §15 (2026-11-11): "Task 7.2 was included in I2 by the owner's latest authorization." Section 15.1 lists 7.2 as IMPLEMENTED. Section 15.2 records the owner decision O12 for the `evidence_id` derivation, and that decision resolves the open format item (phase-status line 58 to 59, "open until before Evidence 7.2").
- phase-status §18.7 (2026-11-11): Task 7.2 VERIFIED (unit level), with the Hypothesis caveat.

### 9.2 Corrected status

- Authorization: the later record in §15 includes Task 7.2. The verbatim owner text is not in the repository. The authorization is therefore recorded by reference, and the repository does not show its wording. This plan does not invent it.
- Implementation: [IMPLEMENTED] `identity.py`, `git_objects.py`.
- Verification: [UNIT-VERIFIED] at unit level. Property 5 uses enumerated tests, because Hypothesis is not installed.
- Acceptance: [NOT ACCEPTED]. Phase-status §15 and §18.7 both say I2 is NOT ACCEPTED.
- The earlier draft of this plan said 7.2 lacked authorization. That statement was wrong for the current record. It came from §9.4 and was superseded by §15.

### 9.3 I2 acceptance

I2 is not accepted. Owner acceptance is a separate decision. Successful unit tests, the §15 authorization, and downstream use by I3 and I4 do not accept I2.

---

## 10. Explicit exclusions

- Frontend work (Ouija tasks 0 to 14) belongs to Spec 2 — Ouija Experience. The Ouija file is NOT APPROVED. Its Task 1 depends on Evidence 15.1 only (already done), so frontend work can start on the contract without Task 15.2. Frontend implementation is not part of I5 or I6.
- Golden tests (18) and acceptance (19): outside the seven increments as recorded (B-15).
- No new increments and no I7.
- `mcp.json`: no change until the module exists and C-D7 is decided.
- No dependency installation without separate authorization (FastAPI, Hypothesis).
- No microservices, Redis, queues, cloud database, or mandatory Docker (Architecture §2.1 and Spec 1 §3).
- No change to the I2 contracts (`RelationshipKind`, applicability matrix, canonical contract) without an explicit owner decision.

---

## 11. Execution order (dependency-aware)

Each step lists its entry condition.

1. Owner decisions in one pass: B-2 (Task 8 dependency), B-3 and G-M (association), B-5 (16.1 values), B-6 (provider), B-7 (cache), B-13 (task 17 approval), B-15 (Golden placement), B-16 (native amendments), B-24 (blame span), B-25 (`repository_id` length).
2. Ready now, no new decision: 16.2 (diagnostics and redaction; header depends on 1).
3. Ready now, implementation only, no closure: 8.1 to 8.3 (criteria, tie-break, missing-metadata rule). Closure waits for Task 9's PR and issue evidence (B-2).
4. After step 1: association step (G-M approved), placed between 9.2 and ranking.
5. After 8 closes: 11.1, 11.2; then 12.1 to 12.3; then 13.1, 13.2. Integration tests over I3 and I4 outputs.
6. After step 1: 14 only if a provider is selected. Otherwise record 14 as not in the MVP path.
7. After step 1 and B-5: 16.1 configuration; move all OD-5 values there; then verify the limit-enforcing tasks (3.1, 4.1, 5.1, 5.4, 6.1, 9.1).
8. After FastAPI authorization and 12, 13: 15.2 HTTP endpoint and startup invocation.
9. After B-13, 6, 9, 12: 17.1, 17.2, 17.3, 17.4 (MCP-01 to MCP-18). MCP-10 waits on Hypothesis or an enumerated alternative.
10. 17.5 only after C-D7 and a verified module.
11. Audit (section 12).

Parallel work: 16.2 and 8.1 to 8.3 can proceed together. Everything else is sequential along the header graph.

Ready now without a new owner decision: 16.2; 8.1 to 8.3 (implementation only); 16.1 mechanism (moving constants into configuration, without approving values).

Blocked by owner decisions: 8 closure, association, 14, 10, 15.2 (installation), 16.1 verification, 17 (approval and enablement), 18 and 19 placement.

Blocked by technical dependencies: 11 (needs 8), 12 (needs 11), 13 (needs 12), 15.2 (needs 12 and 13), 17 (needs 6, 9, 12).

Requiring Native Spec amendments: 8 (dependency on 9), 11 (dependency on 9 if the design requires it), 17 (15.1 in the header), the investigation orchestration step, and the Task 18 header versus the open-decision rule.

---

## 12. Integration, tests, and definitions of done

### 12.1 Integration tests

- I5 end-to-end over a temporary Git repository with a loopback GitHub fixture: candidate extraction (I3), validated record retrieval (I4), association (after G-M), ranking, classification, assembly, deterministic explanation. Checks: every item traces to a commit or a validated record; ranking does not change classification; FAILED and PARTIAL do not produce a conclusion; abstention on insufficient evidence.
- Association: a bare `#NNN` does not trigger a GitHub request; `Fixes`, `Closes`, `Resolves` do not change classification; no commit-to-PR lookup.
- Consistency: contradiction produces `INTERNAL_ERROR` as FAILED and no silent edit (Requirement 9.8).
- No-AI determinism: identical output across runs.
- I6 HTTP: status mapping per C.11; category A, B, C separation; category B never returned as a result.
- I6 MCP: MCP-01 to MCP-18 as listed in D02 §16.11. MCP-05 (repository unchanged), MCP-06 (no repository-controlled execution), MCP-12 (untrusted content) run against real fixtures.
- Startup: registry load once; invalid entries reported.
- Error propagation: Git timeout, GitHub rate limit, and parse failure produce their codes at HTTP and MCP.
- Security: token never in responses or logs; containment rejects junction escapes at API input.

### 12.2 Definition of done for I5

1. Tasks 8.1 to 8.3, 11.1, 11.2, 12.1 to 12.3, 13.1, 13.2 are IMPLEMENTED and UNIT-VERIFIED by executed tests.
2. Task 8 closure is recorded only after the Task 9 dependency is satisfied and the native amendment is approved (B-2).
3. The association step exists only if G-M is approved, and it is verified against rules A1 to A9.
4. Result assembly enforces the consistency rules and returns `INTERNAL_ERROR` as FAILED on violation.
5. Explanation is deterministic and runs with no AI provider.
6. The integration tests in 12.1 pass.
7. A Playbook §15 report for each task lists changed files, commands, observed results, and open issues.
8. No acceptance is claimed without owner acceptance.

### 12.3 Definition of done for I6

1. Tasks 15.2, 16.1, 16.2, 17.1 to 17.4 are IMPLEMENTED and UNIT-VERIFIED.
2. 16.1 values are owner-approved, and configuration is the only source of limits.
3. Task 17.5 is completed under C-D7, or held by owner decision with `mcp.json` unchanged.
4. HTTP and MCP call the same application functions, with no duplicated retrieval or ranking logic.
5. Startup, diagnostics, and redaction tests pass.
6. FastAPI and any MCP-related packages are installed under authorization, and `pip check` is clean.
7. Test results are recorded from executed runs only.

### 12.4 Definition of done for the subsequent I0 to I6 audit

1. Each task has a recorded status (IMPLEMENTED, UNIT-VERIFIED, VERIFIED at a documented level, or ACCEPTED), and no status is claimed without its evidence.
2. The reading record in section 1 is kept current, with hashes.
3. The owner-provided I0 to I6 plan is confirmed against an owner record, or recorded as owner-provided only.
4. The OD-9 amendment, the Task 8 dependency (B-2), the association contract (B-3), and the placement records (B-16, B-17) are approved or explicitly held.
5. Protected files match their recorded hashes.
6. The full backend test suite runs and its count is recorded with its command.
7. `pip check` is clean for the installed set.
8. No frontend file, no `mcp.json` change, and no checkbox change occurred without owner authorization.

---

## 13. Corrections to the earlier draft of this plan

1. Task 7.2 authorization: the earlier draft said 7.2 was excluded and unauthorized. Phase-status §15 records its inclusion under a later owner authorization, and §18.7 records unit-level verification. The verbatim owner wording is not in the repository. Section 9 corrects the status. I2 remains NOT ACCEPTED.
2. "I3 scope: Groups A1, A2, C, D." The earlier draft implied these were owner-authorized. Phase-status §23 authorizes only Group A1. Groups A2, B, C, and D are covered by the §25 directive summary, which does not quote the owner's text. The plan now records this as [OWNER-DIRECTION].
3. "794 tests recorded in phase-status §25." This is wrong. Phase-status records 582 (§18) and 651 (§24). The 794 total was observed in session output only.
4. "SEAN_GITHUB_TOKEN set by owner directive" was presented as settled. It is not recorded as an approved decision. The package OD-14 says no name is recorded. Design E-D15 is open.
5. "Task 8 must wait for 9.2." The owner direction (phase-status line 985) says Task 9. The plan now records Task 9, with the qualifier "wherever pull request or issue relevance contributes."
6. "Task 16.2 depends on 1." The 16.2 subtask has no header. The top-level header of 16 says "(depends on 1)".
7. "Core Paths is not in I1." `core/paths.py` is listed among I1 files in phase-status §7.1. The I1 title is partly covered. Path containment (Task 2) is not in I1.
8. "Task 15.2 requires 12, 13.1, 13.2." Correct. Task 15 header has no dependency, and the subtask holds it.
9. The blame span is the general 2,000-line span in code, not the 500-line D02 proposal. Added as B-24.
10. The numeric table in section 8 is new. It lists every constant found in the implemented backend and its decision state.
11. The FastAPI state: `fastapi` is not installed. D01 §2 approves the selection. Installation requires separate authorization (D01 §1 and §4). Selection and installation are different acts and are stated separately in this plan.

---

## 14. Files and confirmations

- Modified: `docs/development/i5-i6-backend-implementation-plan.md` (this file, reconciled).
- Modified: `.kiro/reports/phase-status.md` (pointer section 27, appended; earlier sections unchanged).
- Not modified: approved specifications, native Spec requirements, design, task files, decision records (D01, D02, D03), decision package, readiness report, dependency files, `mcp.json`, task checkboxes, source code, tests.
- No network request, no installation, no implementation, no Native Spec change, and no checkbox change occurred in this step.
- I2 remains NOT ACCEPTED. I3 and I4 remain NOT AUTHORIZED beyond the recorded authorizations (phase-status §23 and the §25 directive).
