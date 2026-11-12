# I3 and I4 readiness closure report

Status: decision-closure and documentation record. NOT an authorization. No implementation was started. I3 and I4 are not authorized. No task checkbox was changed. No approved source document (Spec 1, Spec 2, Architecture, Playbook, Operating Guide) was changed. No dependency was installed. `.kiro/settings/mcp.json` was not changed. I2 is not accepted; the unit-level verification of Tasks 7.1 to 7.3 is not owner acceptance.

Date of record: 2026-11-11.

Revision (final closure pass): the owner decision package (`docs/development/i3-i4-owner-decision-package.md`) is the authoritative source for approval status. Its Part 10.1 is the only OD-5 checklist. Its Part 11 is the only authorization map. Where this report differs from those parts, the package governs. Corrections in this revision: cache wording (Part 1), OD-5 pointer (Part 3.5), OD-15 status (Part 4), Task 3.2 to 3.4 dependencies (Parts 6, 10.1, 10.3), Task 2.2 and 2.3 start order (Part 10.1), Task 4 dependencies (Part 5.2), and I3 foundation grouping (Part 10.5).

Status vocabulary used in this report:
- `VERIFIED`: a check was executed and its result observed.
- `IMPLEMENTED`: code exists. No claim about verification.
- `ACCEPTED`: explicit owner acceptance. Not recorded for I2, I3, or I4.
- `APPROVED`: an explicit owner decision recorded in the workspace.
- `AIP`: accepted in principle by the owner. Exact wording awaits approval.
- `RECOMMENDED`: proposed by this report. Not approved.
- `OPEN`: no decision yet.

---

## 1. Executive decision summary

**Cache semantics (accepted in principle as owner rules in the review request; document wording awaits approval under OD-1 to OD-4).** A cached record whose integrity state is `NOT_PERFORMED` is never treated as currently verified. It can be displayed with its cache state. It never supports a verified association. An unresolved required external reference makes the investigation `PARTIAL`. Displaying cached historical evidence alone does not. Cache age alone does not prove invalidity. No new verification state is introduced.

**Task 16.1 (not closed).** Only a subset of the limits is needed to close the Git and GitHub workstreams. Most of the remaining values are proposals with no approved source. The owner must approve the values row by row (Part 3). Task 16.1 is a prerequisite only for the tasks that enforce those values (Part 8). It is not a blanket prerequisite.

**Dependency findings that need owner approval before authorization:**
1. Task 3's header says `depends on 1 and 16.1`. Under the literal reading, Tasks 3.2, 3.3, and 3.4 wait for Task 16.1 even though they do not use any limit value. Proposed header change in Part 5.
2. Task 9's header says `depends on 1, 7`, but Task 9.1 needs timeouts and size bounds from Task 16.1. Proposed header change in Part 5.
3. Task 5.x depends on Task 4, and 4.1 is blocked by an undecided symbol-resolution method.
4. Evidence-producing tasks (5.1, 5.3, 5.4, 6.1, 6.3, 9.2, 10.1, 10.2) require owner acceptance of I2. Unit verification of I2 is not sufficient.
5. Task 9.1 retrieves records without producing evidence. Whether it may start before I2 acceptance is an owner decision (OD-10).

**Readiness verdicts (Part 9).** I3 and I4 are not ready for full authorization. Partial starts exist, listed in Part 7. I3 and I4 can be authorized together only as separate task groups, because they have no explicit dependency on each other. Both depend on the same common gates.

---

## 2. Cache semantics decision table

### 2.1 Sources used

- Spec 1 §14 (approved): "Cache behavior must not silently convert stale data into verified current data." "Cache invalidation rules must be explicit." "Cache unavailability must not make core local Git retrieval unusable." "Avoid repeated external API requests when cached metadata is valid." The term "valid" has no definition in the approved text.
- Native Requirement 17.1 to 17.4: SQLite is the cache. Entries keep repository and source identity. Invalidation rules are explicit, and stale data is never converted into verified current data. Git retrieval keeps working when the cache is unavailable.
- Owner decision D6 (I2 brief): cache age is derived from `retrieved_at`. A cache-served record must not claim fresh verification. A cache-served record carries `NOT_PERFORMED`. This is enforced by the I2 model (`IntegrityRecord`, test `test_cache_served_record_cannot_claim_verification`).
- D06 (Spec 1 §24 pending, Phase 3): cache invalidation behavior is not decided.
- D02 §16.7 (proposed): a stale cached record served after a failed live request yields `PARTIAL`, with `STALE_CACHE_SERVED`.
- Native Task 10.2: "Flag stale entries served after a failed live request."

### 2.2 Decision table

| Case | Display | May support a verified association | Investigation status | Reason and code | Effect on classification or relationship basis |
|---|---|---|---|---|---|
| **A.** Cached historical evidence shown as supporting information. No external reference must be resolved and no current identity verification is needed. | Yes. Shown with `served_from_cache = true`, `source_verification = NOT_PERFORMED`, and the original `retrieved_at`. | No association is needed. Not applicable. | Unchanged by this display. `COMPLETE` if every other planned operation completed. `PARTIAL` only if another operation did not complete. | No code. The integrity flags carry the state. Display alone is not an incomplete operation (owner rule). | None caused by the cache state. Classification is computed from the evidence rules, and cache state does not upgrade or downgrade it. |
| **B.** An investigation must resolve an external PR or Issue reference. Only a cached record is available, and its identity has not been validated for the current operation. | Only as labelled supporting material. It must not be presented as the resolution of the reference. | No. A cached record cannot carry `RECORD_RETRIEVED_LIVE`. | `PARTIAL`. The required resolution is incomplete. | `REFERENCE_NOT_VERIFIED_CACHED` (proposed; governing list pending). Owner rule: an inability to verify identity produces `PARTIAL`. | No change. The unresolved reference does not create or change any classification, and an association is never a classification input. |
| **C.** A live lookup fails. Cached evidence is shown as a fallback. | Yes, labelled as fallback, with the original `retrieved_at`. | No. The record is `NOT_PERFORMED`. | `PARTIAL`. The live operation failed. | The failure code, one of `GITHUB_UNAVAILABLE` or `GITHUB_RATE_LIMITED`, or `GITHUB_NOT_FOUND_OR_INACCESSIBLE` for a 404. Plus `STALE_CACHE_SERVED` (existing code). | Not upgraded by the fallback. Whether a `NOT_PERFORMED` record can support `DOCUMENTED` or `INFERRED` on its own is an open owner decision (OD-3). Recommended: it cannot. |
| **D.** A live lookup succeeds and validates the external record identity. | Yes, as a live record (`served_from_cache = false`, `VALIDATED_RECORD_IDENTITY`). | Yes, if the other association conditions hold (C.4 check `RECORD_RETRIEVED_LIVE` is satisfied). | Unchanged by this case. `COMPLETE` if every other planned operation completed. | None. | None. Association never changes classification. |
| **E.** A cached record has a prior integrity record, but its verification state is `NOT_PERFORMED`. | Yes, labelled. The cached state is shown as `NOT_PERFORMED`. | Never. | Follows the case in which it is used. If a required resolution depends on it, `PARTIAL` (case B). If it is display-only, unchanged (case A). | As case A or case B. | As case A or case B. |

### 2.3 Rules that follow from the table

- **R-C1.** A cache-served record never appears with `VALIDATED_RECORD_IDENTITY`. When a record is served from cache, its stored validation is not reinstated as current. The I2 model enforces this (`served_from_cache` requires `NOT_PERFORMED`).
- **R-C2.** The stored `retrieved_at` is shown. The age in presentation is derived from it. The age is never stored as a separate field (owner D6).
- **R-C3.** Cache age alone does not make a record invalid. No automatic invalidation is performed by age. D06 governs freshness and invalidation. Until D06 is decided, the only cache-related status trigger is case C (a failed live request).
- **R-C4.** A display-only cache use never changes the status. A required resolution that depends on an unverified cache record does change the status (`PARTIAL`).
- **R-C5.** The three conditions are kept distinct:
  - *retrieval failure*: a live operation failed, timed out, or was rate limited. Status effect per tool (Part 2.4).
  - *identity-validation failure*: the returned or cached record does not validate. The record is not used. Status effect per tool.
  - *display-only fallback*: a cached record is shown with its state. It has no status effect by itself.

### 2.4 Status effect per tool

| Condition | Investigation (reference inside an investigation) | Single-record tools (`get_pr`, `get_issue`) |
|---|---|---|
| Live failure (network, timeout, 5xx) | `PARTIAL` | `FAILED` (D02 §16.7; no evidence returned) |
| Rate limited | `PARTIAL` | `FAILED` |
| Not found or inaccessible | `PARTIAL` | `FAILED`. Not proof of absence (Requirement 5.4). |
| Identity mismatch | `PARTIAL`. Record not used. | `FAILED`. Record not used. |
| Identity unverifiable | `PARTIAL` | `FAILED` |
| Cache fallback after failed live request | `PARTIAL` with `STALE_CACHE_SERVED` | `PARTIAL` with `STALE_CACHE_SERVED`, as D02 §16.7 states. Recommended to confirm (OD-4). |

The single-record tool rows follow D02 §16.7, which is proposed text, and are consistent with Requirement 9.2 ("a FAILED retrieval is not presented as a successful historical conclusion").

### 2.5 Decisions required (cache)

- **OD-1 (interim cache policy).** Recommended: Git-derived evidence is always retrieved live. Only GitHub records (Spec 1 §14 list) may be cached. No Git-derived caching until D06 is decided. Reason: Spec 1 §14 allows caching only "where invalidation can be handled safely", and D06 is open.
- **OD-2.** Confirm case B: a required reference resolved only from cache is `PARTIAL`. Recommended: yes. The owner rule "inability to verify identity produces PARTIAL" supports it.
- **OD-3.** Whether a `NOT_PERFORMED` record can support `DOCUMENTED` or `INFERRED` by itself. The approved sources are silent. Recommended: no. Classification must rest on evidence whose verification was performed in the current retrieval, or on local Git evidence. The trade-off is that some results become `PARTIAL_EVIDENCE` when only cached evidence exists.
- **OD-4.** Confirm the code for case C: `STALE_CACHE_SERVED` together with the failure code. Recommended: yes.

### 2.6 Gap check and contradiction check

- **Gap G-C1.** Spec 1 §14 says "when cached metadata is valid" but does not define "valid". This requires D06. No decision is made here.
- **Gap G-C2.** The approved sources do not say whether `NOT_PERFORMED` records may count toward classification (OD-3).
- **Gap G-C3.** The approved text does not state a status for a cache fallback. D02 §16.7 (proposed) gives `PARTIAL`. Confirm (OD-4).
- **Contradiction check.** D02 §16.7 says a cached item "carries its age". That conflicts with owner D6 (derive age from `retrieved_at`; no separate field). This is a wording correction to D02, not a reopening of I2. No I2 decision is reopened.

---

## 3. Task 16.1 numeric limit table

### 3.1 Categories

- **I**: input-validation limit (rejects a request before any operation).
- **R**: retrieval limit (bounds an external or Git operation).
- **P**: processing limit (bounds a scan, a candidate set, or a budget).
- **D**: display limit (presentation only; never changes retrieval status).

### 3.2 Table

Status: `APPROVED`, `AIP`, `OPEN`, or `NONE` (no limit; an approved absence).

| ID | Parameter | Proposed value | Cat. | Source or proposal | Status | Affected tasks | Behavior when reached |
|---|---|---|---|---|---|---|---|
| V1 | `repository_id` length | 64 (registry pattern `^[a-z0-9][a-z0-9_-]{0,63}$`) | I | Implemented in `registry.py` (I1, accepted). D02 §16.6 says 128. Conflict. | OPEN (recommend 64) | 1 (done), 15.2, 17.2 | `INVALID_INPUT`, `field: repository_id`. Longer values cannot be registered (registry rejects them). |
| V2 | Repository-relative target path length | 1,024 characters | I | Recommended. Engineering rationale: below the Windows long-path limit and keeps path handling bounded. No approved source. | OPEN | 2.1, 2.3, 4.1, 5.1, 6.1 | `INVALID_INPUT`, `field: target.path` |
| V3 | Symbol length | 1 to 256 characters, no control characters or newlines | I | Native design (`target.symbol`, line 171) and D02 §16.6 (proposed). | OPEN | 2.3, 4.1 | `INVALID_INPUT`, `field: target.symbol` |
| V4 | Line span for a target search | 2,000 lines | I | D02 §16.6 (proposed). | OPEN | 4.1, 5.1 | `INVALID_INPUT`, `field: target.line_end` |
| V5 | Blame span | 500 lines | I | D02 §16.6 (proposed). | OPEN | 6.1 | `INVALID_INPUT`, `field: line_end` |
| V6 | Line numbers | 1-based integers, `start <= end`, end within the file | I | Native Requirement and D02 §16.6 rules, not a numeric limit | NONE | 4.1, 6.1 | Input rejected |
| V7 | PR and issue number | Positive decimal string. No upper bound. Zero rejected. | I | D9 (APPROVED, recorded). MCP input shape AIP (matrix row 22). | APPROVED (no bound) | 9.1, 17.2 | Not a limit. A non-decimal or zero value is rejected. |
| V8 | Commit or revision name | Full 40 or 64 lowercase hex. Shared validator. | I | DEC-14 and I2 (`core/git_objects.py`) | APPROVED | 6.2 | Rejected before any Git call. Not a limit. |
| V9 | `max_results` | Default 20, range 1 to 50 | I | D02 §16.6 (proposed) | OPEN | Output tasks (15.2, 17.2), not I3 or I4 | `INVALID_INPUT` outside range |
| V10 | `question` length | Not set (DEC-10 says "from configuration") | I | No value in any source | OPEN | 15.2, Ouija 4.1, not I3 or I4 | Rejected |
| V11 | HTTP request body size | Not set | I | No value in any source | OPEN | 15.2, not I3 or I4 | Rejected |
| R1 | Git call timeout | 30 seconds per call | R | Spec 1 §13 and Native Requirement 15.2 require a timeout. No number. Engineering default, to be calibrated in Task 18. | OPEN | 3.1, 4.1, 5.1, 5.4, 6.1 | Process terminated. `GIT_TIMEOUT`, `retryable: true`. |
| R2 | Git stdout bound per call | 16 MiB | R | Native Requirement 15.2 requires bounded output. No number. | OPEN | 3.1, 5.1, 5.4, 6.1 | Process terminated. `OUTPUT_LIMIT_EXCEEDED`. |
| R3 | Git stderr bound per call | 64 KiB | R | Engineering default. Bounds diagnostics without exposing content (Requirement 19.2). | OPEN | 3.1 | Truncated. Never logged with environment values. |
| R4 | Commits scanned per investigation | 2,000 | P | Owner approval in principle (matrix row 28). | AIP | 5.1 | Scan stops. `COMMIT_SCAN_LIMIT_REACHED`. `PARTIAL`. |
| R5 | Bytes scanned per commit message | 64 KiB | P | Owner approval in principle (row 29). | AIP | 5.1 | `MESSAGE_WINDOW_LIMIT_REACHED`. `PARTIAL`. |
| R6 | Candidates per commit message | 10 | P | Owner approval in principle (row 30). | AIP | 5.1 | `CANDIDATE_LIMIT_REACHED`. `PARTIAL`. |
| R7 | Candidates per investigation | 200 | P | Owner approval in principle (row 31). | AIP | 5.1 | `CANDIDATE_LIMIT_REACHED`. `PARTIAL`. |
| R8 | GitHub requests per investigation | 10 | P | Owner approval in principle (row 32). Enforced by the integration step, not by Task 9.1 itself. | AIP | Integration (CP-IN), not 9.1 | `REQUEST_BUDGET_REACHED`. `PARTIAL`. |
| R9 | GitHub connect timeout | 5 seconds | R | Requirement 16.1 requires timeouts. No number. Engineering default. | OPEN | 9.1 | `GITHUB_UNAVAILABLE`, `retryable: true` |
| R10 | GitHub total request timeout | 15 seconds | R | As R9 | OPEN | 9.1 | `GITHUB_UNAVAILABLE`, `retryable: true` |
| R11 | GitHub response size bound | 1 MiB per response | R | Requirement 16.1 requires size bounds. No number. Calibrate on recorded fixtures. | OPEN | 9.1 | Rejected oversize body. Code mapping: `GITHUB_UNAVAILABLE` recommended (OD-8). D02 MCP-13 lists the case but names no code. |
| R12 | GitHub redirects | Refuse all redirects | R | Requirement 16 and design: no redirects to other hosts. Refusing same-host redirects too is stricter. | OPEN | 9.1 | Redirect treated as a failure. `GITHUB_UNAVAILABLE`. |
| R13 | GitHub automatic retries | 0 | R | Requirement 16.2 respects rate limits. Engineering default. | OPEN | 9.1, 9.3 | Single attempt. |
| R14 | Rate-limit handling | No request while the reported limit is exhausted | R | Requirement 16.2. Header names not verified in this round. | OPEN (method) | 9.1, 9.3 | `GITHUB_RATE_LIMITED`. `PARTIAL` (investigation) or `FAILED` (single record). |
| R15 | Per-investigation wall-clock deadline | None | NONE | C.8 and C-D3 (closed, owner): no overall deadline. Each operation is bounded by its own timeout. | APPROVED (absence) | All | Not applicable |
| R16 | Concurrent subprocesses | One at a time | R | No approved value. Sequential design. | OPEN | 3.1, 5.1, 9.1 | Not applicable while sequential |
| R17 | Cache size and invalidation | Not set | P | D06 open. | OPEN | 10.1, 10.2 | Held |
| R18 | Registry file size | 256 KiB | I | `registry.py` `MAX_REGISTRY_BYTES`. I1 accepted. | APPROVED (existing) | 1 (done) | Rejected at load |
| R19 | Registry root path length | 4,096 characters | I | `registry.py` `MAX_ROOT_LENGTH`. I1 accepted. | APPROVED (existing) | 1 (done) | Rejected at load |
| D1 | `matched_text` display | 256 code points | D | Owner approval in principle (row 26). | AIP | Association output (Task 8 workflow) | Display cut. `TEXT_TRUNCATED`. No status effect. |
| D2 | Context window | 80 characters each side | D | Owner approval in principle (row 33) | AIP | Association output | Display cut. `TEXT_TRUNCATED`. No status effect. |

### 3.3 Limits that must not be imposed

- No maximum number of digits on PR and issue identifiers (D9, approved). Identifiers are preserved as strings.
- No overall investigation deadline (C-D3, approved).

### 3.4 Unresolved limits: consequence, recommendation, trade-off, owner decision

| ID | Consequence of leaving it open | Recommended value and basis | Trade-off | Owner decision |
|---|---|---|---|---|
| V1 | Two sources disagree (registry 64, D02 128). Implementation follows the registry. | 64 (implemented and accepted in I1). Correct D02. | Changing the accepted registry would reopen I1. | OD-6: confirm 64 and correct D02 §16.6. |
| V2 | Unbounded path input reaches Git and the filesystem. | 1,024 characters. | Some legitimate deep paths would be rejected. | OD-5 (row set). |
| V3 | Unbounded symbol text reaches symbol resolution. | 256 characters (D02, native design). | Long generated identifiers are rejected. | OD-5. |
| V4, V5 | Unbounded line spans cause large Git work. | 2,000 (search) and 500 (blame). | Large spans are rejected rather than paged. | OD-5. |
| R1 | A hung Git process blocks an investigation. | 30 seconds. Calibrate on Task 18. | Slow legitimate history may time out and report `PARTIAL`. | OD-5. |
| R2 | Large Git output exhausts memory (Requirement 20.2). | 16 MiB per call. | Very large outputs are truncated, and the result is `PARTIAL`. | OD-5. |
| R3 | Large stderr is logged or displayed. | 64 KiB. | Diagnostics are cut. | OD-5. |
| R9 to R10 | A hung GitHub request blocks an investigation. | 5 s connect, 15 s total. | Slow GitHub responses are reported as unavailable. | OD-5. |
| R11 | A large body exhausts memory. | 1 MiB, calibrated on fixtures. | A very large PR body is reported as unavailable. | OD-5 and OD-8. |
| R12 | Redirects could send the token or a request to another host. | Refuse all redirects. | Same-host renames cannot be followed. | OD-7. |
| R13 | Retries multiply requests and exhaust rate limits. | 0. | A transient failure is reported without retry. | OD-5. |
| R14 | Requests continue after the rate limit is reached. | Stop until reset. | None significant. | OD-5 (method confirmed by a live check, D-5). |

### 3.5 Owner decision required (values)

- OD-5. Approve the values in Part 3.2, row by row. The authoritative checklist is Part 10.1 of the owner decision package. Under its transport contract (package Part 6A), R9 is a per-operation timeout and R10 is not enforced as a total limit. AIP rows (R4 to R8, D1, D2) become APPROVED only after explicit approval of the exact values.
- Approval of the values does not verify Task 16.1. The R16 (sequential execution) row is not an approved source assumption and stays OPEN in the owner package checklist. Verification requires the configuration to be implemented and tested (Part 8).

---

## 4. Explicit owner decisions still required

| ID | Decision | Affects | Recommended | Status |
|---|---|---|---|---|
| OD-1 | Interim cache policy: Git evidence always live; only GitHub records cached; no Git caching before D06 | 10, 2.x to 9.x | Yes | OPEN |
| OD-2 | A required reference resolved only from cache gives `PARTIAL` | 5.x, 9.x, integration | Yes | OPEN |
| OD-3 | `NOT_PERFORMED` records cannot support `DOCUMENTED` or `INFERRED` on their own | Classification | Yes | OPEN |
| OD-4 | Cache fallback after a failed live request: `STALE_CACHE_SERVED` with the failure code, `PARTIAL` | 9.3, 10.2 | Yes | OPEN |
| OD-5 | Numeric limit values (Part 3.2) | 2.3, 3.1, 4.1, 5.1, 5.4, 6.1, 9.1 | Per row | OPEN (AIP rows awaiting exact approval) |
| OD-6 | `repository_id` length 64; correct D02 §16.6 | 1, 15.2, 17.2 | 64 | OPEN |
| OD-7 | Refuse all GitHub redirects | 9.1 | Yes | OPEN |
| OD-8 | Oversize GitHub response maps to `GITHUB_UNAVAILABLE` | 9.1, 9.3 | Yes | OPEN |
| OD-9 | Native task header amendments (Part 5) | 3, 9, 16.1 | Yes | OPEN |
| OD-10 | Task 9.1 may start before I2 acceptance, because it produces no evidence. Tasks 9.2 and later still require acceptance. | 9.1 | Yes | OPEN |
| OD-11 | Symbol-resolution method for Task 4.1 (text search of the tree, or a parser). No parser dependency is approved. | 4.1, 4.2 | Decide before 4.1 | OPEN |
| OD-12 | GitHub `author` field: login or a display name. The I2 model says name only (X4). | 9.2 | Decide before 9.2 | OPEN |
| OD-13 | D-5: pin `X-GitHub-Api-Version` (recommended `2022-11-28`); live check of `merge_commit_sha` (requires network authorization) | 9.1, 9.2 | Decide and authorize the check | OPEN |
| OD-14 | D-6 `urllib` (recommended); D-7 token variable name; D-10 fixture-based tests | 9.1 to 9.3 | Per recommendation | OPEN |
| OD-15 | G-1 (rename path), G-2 (whole-file revision), G-3 (GIT_COMMIT timestamp, author date) | 5.1, 6.x | G-1 and G-2 original alternatives are not in the workspace (owner input blocker). G-3 recommended `%at`, not approved. | OPEN (G-1, G-2 BLOCKED) |
| OD-16 | Native Spec approval for the I3 and I4 task IDs | All I3 and I4 tasks | Approved by owner 2026-11-10 for the three native Spec hashes recorded in the owner package Part 15. Header amendments (OD-9) remain OPEN. | APPROVED |
| OD-17 | D02 wording corrections: §16.6 claims DEC-10 limits and timeouts, but contains none; §16.7 cache-age wording; §16.7 GitHub rows apply to single-record tools | Documentation | Correct | OPEN |
| OD-18 | Verification of the Git option set (Task 3.2) and the SHA-256 repository check (Tasks 3, 6.1). Authorization to run Git in temporary directories at implementation time. | 3.2, 6.1 | Authorize at implementation | OPEN |
| OD-19 | Hypothesis (not installed). Property tests by enumeration unless installation is separately authorized. | Tests | Enumeration | OPEN |
| OD-20 | Confirm that Task 18 (Golden categories) remains outside I3 and I4. Native Requirement 22 names G01 to G10 but not the categories listed in Spec 1 §19. | 18 | Outside scope; record only | OPEN |

Approved decisions relied upon (not reopened):
- D9 (identifier semantics), approved.
- DEC-14 (revision rule), approved; DEC-14 wording updated for I2.
- C-D3 (no overall deadline), approved.
- C-D9 (no backend interruption in the MVP), approved.
- I2 canonical identity, line range, timestamp, integrity, and cache-served `NOT_PERFORMED` decisions, owner decisions recorded in the I2 brief. I2 remains not accepted.

---

## 5. Updated I3 and I4 dependency graph (with proposed header changes)

### 5.1 Proposed native task header changes (NOT APPROVED; `.kiro/specs/evidence-retrieval/tasks.md`)

| Task | Current header | Proposed header | Reason |
|---|---|---|---|
| 3 | `(depends on 1 and 16.1)` | `(depends on 1). Task 3.1 also depends on 16.1 for the timeout and byte-limit values. Tasks 3.2, 3.3, and 3.4 do not depend on 16.1.` | 3.2 to 3.4 use no limit value. The literal header blocks them. |
| 9 | `(depends on 1, 7)` | `(depends on 1, 7, and 16.1 for the timeout, size, redirect, and retry values in 9.1)` | 9.1 enforces bounds that Task 16.1 defines. |
| 16.1 | "Task 3 cannot start until this task is verified." | "Tasks 3.1, 5.1, 9.1 and any task that enforces a value in Task 16.1 cannot be verified until this task is verified." | Scope the prerequisite to the tasks that enforce values. |

Changes to task text in 5.1, 9.1, and 4.1 follow the decisions above. They are not repeated here.

### 5.2 Task-level dependency graph (explicit, plus analysis edges marked)

```
Gates (common):
  G-NS  Native Spec approval for the task IDs
  G-I2  I2 owner acceptance (evidence-producing tasks only)
  G-16  Task 16.1 values approved and implementation verified (limit-enforcing tasks only)

I3 (Git history)
  1 (accepted)
    -> 2.1 -> 2.2 -> 2.3 -> 2.4 (review before 2 closes)
  16.1 (values, limit-enforcing rows only)
    -> 3.1 (timeouts, bounds) -> 3.2 -> 3.4 ; 3.3 (independent of values)
  Tasks 2 (2.1 to 2.4) and 3 (3.1 to 3.4), all VERIFIED -> 4.1 -> 4.2                       (4.1: method decision OD-11)
  3 + 4 -> 5.x                                (explicit group dependency)
     5.2 before 5.1 (limitations); 5.4 parallel with 5.1
     5.1 -> 5.3
     5.1 + 7 (I2) -> evidence items           (G-I2)
  5 -> 6.1 -> 6.3                             (6.1 also needs 3; G-I2 for GIT_BLAME items)
  5 -> 6.2                                    (explicit group dependency; no values needed)

I4 (GitHub)
  1 (accepted) + 7 (I2 implemented) -> 9.1    (retrieval; OD-10 for start before G-I2)
  16.1 (R9 to R13) -> 9.1                     (values; G-16 for closure)
  D-5, D-6, D-7 decided -> 9.1
  9.1 -> 9.2                                  (G-I2 and OD-12)
  9.1 -> 9.3                                  (outcome mapping; code approval)
  9 -> 10.1 -> 10.2                           (held: D06, D07, OD-1 to OD-4)

Integration (outside I3 and I4)
  5.1 candidates + 9.2 records -> association and ranking (Task 8, separate authorization)
```

### 5.3 Edge classification

- Explicit edges come from the task text. Analysis edges are marked and are not spec text.
- No explicit edge runs between any I3 task and any I4 task.
- Shared prerequisites are G-NS, G-16 (for the values used by both), and G-I2 (for evidence-producing tasks).

---

## 6. Tasks that can proceed after Native Spec approval

These tasks have no further gate, other than the stated items.

| Task | Gate beyond G-NS | Notes |
|---|---|---|
| 2.1 | None | Path rules. The I2 predicate remains a subset and keeps its behavior. |
| 2.2 | None (after 2.1) | Containment. Windows junction behavior to be verified (external fact). |
| 3.2 | Task 3.1 VERIFIED (requires R1 to R3 approved). OD-18 for Git verification. | Option set. Verification against Git 2.50.1. Header amendment in Part 5.1. |
| 3.3 | Task 3.1 VERIFIED | `-` rejection |
| 3.4 | Task 3.1 VERIFIED | Environment and secrets. |
| 9.1 | G-16 for R9 to R13 before verification. D-5, D-6, and D-7 decided. | Retrieval client. Starts before G-I2 under OD-10. |
| 9.3 | Code approval for the GitHub outcome mapping (D02 §16.5 proposed) | After 9.1 |

Note on 3.1: its mechanism can be written against parameters. The task cannot be verified until its values are closed (Part 8).

---

## 7. Tasks that additionally require I2 acceptance

Owner acceptance of I2 is required before these tasks are authorized, because they produce evidence items (`EvidenceItem` values) that the I2 model defines.

| Task | Reason |
|---|---|
| 5.1 | Creates `GIT_COMMIT` and history evidence items, and candidates feed the association workflow |
| 5.3 | Records heuristic method on evidence |
| 5.4 | Creates `DOCUMENTATION` evidence |
| 6.1 | Creates `GIT_BLAME` evidence |
| 6.3 | Uncommitted-line limitation on evidence |
| 9.2 | Creates `PULL_REQUEST` and `ISSUE` evidence |
| 10.1, 10.2 | Cache entries carry integrity records (held in any case) |

Not requiring I2 acceptance: 2.1 to 2.4, 3.1 to 3.4, 4.1, 4.2 (no evidence), 5.2 (detection and limitations; becomes evidence-dependent only when wired into results), 6.2 (rejection and existence checks), 9.1 (retrieval only, under OD-10), and 9.3 (outcome mapping, no evidence).

Note: I2 unit-level verification (582 tests passed) is not owner acceptance. Every gate above refers to owner acceptance.

---

## 8. Tasks that require Task 16.1 closure

Classification:
- **Class A.** Independent of Task 16.1. May be implemented and validated without any limit value.
- **Class B.** The mechanism is independent of the values. The task cannot be verified or closed until the values it enforces are approved and implemented.
- **Class C.** The observable behavior is defined by the values. Implementing that behavior requires the values to be closed first.
- **Class D.** Only consumes the configuration. Not part of the closure.

| Task | Class | Values it needs |
|---|---|---|
| 2.1 | A | None |
| 2.2 | A | None |
| 2.3 | C for length checks | V2, V3. Non-length checks are class A. |
| 2.4 | A | None |
| 3.1 | B | R1, R2, R3 (explicit header dependency on 16.1 is proposed to be scoped to 3.1) |
| 3.2 | A | None |
| 3.3 | A | None |
| 3.4 | A | None |
| 4.1 | C | V3 (symbol), V4 (line span), R1 (Git timeout). Also OD-11. |
| 4.2 | B | R1 |
| 5.1 | C | R4 to R7 (behavior), R5 (window), R1 and R2 (Git bounds), R16 (concurrency, sequential). Also G-1, G-2, G-3. |
| 5.2 | A | None (detection) |
| 5.3 | A | None |
| 5.4 | B | R1, R2 |
| 6.1 | C | V5 (blame span), R1, R2 |
| 6.2 | A | None (V8 is approved and not numeric) |
| 6.3 | A | None |
| 9.1 | B | R9 to R13. R14 method. |
| 9.2 | A | None (identity rules, D9) |
| 9.3 | A | None |
| 10.1, 10.2 | Held | R17 and D06, D07 |

Summary:
- **Cannot be implemented safely without limit closure:** 4.1 (for its line span and symbol behavior), 5.1 (processing behavior), 6.1 (blame span and Git bounds), 2.3 (length checks).
- **Can be implemented independently and validated later against the limits:** 2.1, 2.2, 2.4 (review), 3.1 (mechanism), 3.2, 3.3, 3.4, 4.2 (after 4.1), 5.2, 5.3, 5.4 (mechanism), 6.2, 6.3, 9.1 (mechanism), 9.2, 9.3.
- **Only consume configuration:** the API and MCP tasks (15.2, 17.2), which are outside I3 and I4, and Task 16.2 (diagnostic fields).

The limits are not a blanket prerequisite. Task 16.1 is closed by approving the rows it governs and implementing the configuration. Only tasks that enforce a value wait for that closure.

---

## 9. Remaining blockers and exact closure criteria

| # | Blocker | Affects | Closure criterion |
|---|---|---|---|
| B1 | Native Spec approval for I3 task IDs | 2.x to 6.x | Owner approves the requirements and design baseline for those IDs, and the header amendments in Part 5.1, in writing. |
| B2 | Native Spec approval for I4 task IDs | 9.x | Same, for 9.1 to 9.3. |
| B3 | Task 16.1 values (OD-5) | 2.3, 3.1, 4.1, 4.2, 5.1, 5.4, 6.1, 9.1 | Owner approves each row in Part 3.2 by value. Configuration keys exist in `core`. Tests verify defaults, rejection of values outside range, and that values reach the enforcing call sites. Task 16.1 is verified only after those tests are run and observed. |
| B4 | I2 owner acceptance (OD-10 for 9.1) | 5.1, 5.3, 5.4, 6.1, 6.3, 9.2, 10.x | Owner records explicit acceptance of I2, or explicitly accepts a narrower scope. |
| B5 | Symbol-resolution method (OD-11) | 4.1, 4.2 | Owner records the method. No parser dependency is added without approval. |
| B6 | GitHub API version pin and `merge_commit_sha` source (OD-13, D-5) | 9.1, 9.2 | Owner pins the version. A live check of the field under that version is executed with explicit network authorization, and its result is recorded. |
| B7 | HTTP client, token variable, test strategy (OD-14) | 9.1 to 9.3 | Owner decides. Standard library `urllib` is recommended, and it adds no dependency. |
| B8 | GitHub author field (OD-12) | 9.2 | Owner decides between login and a name. |
| B9 | G-1, G-2, G-3 (OD-15) | 5.1, 6.1 | Owner decides each. |
| B10 | Cache policy (OD-1 to OD-4) | 9.3, 10.x | Owner decides each. |
| B11 | Native task header amendments (OD-9) | 3, 9, 16.1 | Owner approves the wording in Part 5.1. |
| B12 | Code list approval (D02 §16.5) for outcome mapping | 9.3 | Owner approves the codes used by 9.3. |
| B13 | Git option set and SHA-256 check (OD-18) | 3.2, 6.1 | Verified during implementation, with authorization to run Git in temporary directories. Not a decision. |
| B14 | Security review of Task 2 (Playbook §8) | 2.4 | Review recorded before Task 2 closes |
| B15 | D06 and D07 (cache invalidation and location) | 10.x | Owner decides both. |
| B16 | Task 8 authorization | Association and ranking | Separate authorization after I3 and I4 |
| B17 | D02 wording corrections (OD-17) | Documentation | Owner approves the corrections |

Carried gaps outside I3 and I4 (not blockers here): Golden categories (OD-20); Spec 1 v2.4 traceability gaps (D04, D05, D06, D08 phases; FR-10 wording); `.kiro/specs/.gitkeep` (unresolved, unattributed).

Native requirement gaps flagged by D01 (Spec 1 §§5, 6, 13, 19). Requirements 2 (target resolution), 3 (retrieval scope), and 14 (untrusted content, path containment) now contain the Spec 1 text. They await approval. The Golden categories (Spec 1 §19) are not covered by Requirement 22, which remains outside I3 and I4.

---

## 10. Final readiness verdicts

### 10.1 I3 (Git history): NOT READY for full authorization

- **Partially startable after B1 (Native Spec approval, which includes the Requirement 2, 3, and 14 text):** 2.1, then 2.2 after 2.1 is VERIFIED. 2.3 for its non-length checks after 2.1 and 2.2 are VERIFIED.
- **Startable after B1 and the Part 5.1 amendment:** the 3.1 mechanism. 3.2, 3.3, and 3.4 start only after 3.1 is VERIFIED, which needs R1 to R3 approved.
- **Blocked:** 2.3 length checks (B3); 2.4 (review, after 2.1 to 2.3); 3.1 closure (B3); 4.1 (B5 and B3); 4.2 (after 4.1); 5.1 to 5.4 (B4, B3, B9, and 4 completed); 6.1 to 6.3 (B4, B3, and 5 completed).

### 10.2 I4 (GitHub): NOT READY for full authorization

- **Partially startable after B2:** 9.1 mechanism, after B3 values for R9 to R13 are approved (for verification), B6, and B7. Starts before I2 acceptance under OD-10.
- **Startable after 9.1:** 9.3 after code approval (B12).
- **Blocked:** 9.2 (B4 and B8, and 9.1); 9.1 closure (B3, B6, B7); 10.1 and 10.2 (held: B15, OD-1 to OD-4, B4).

### 10.3 Can I3 begin partially?

Yes, after B1 and the Part 5.1 amendment (or after B1 alone for 2.1 and 2.2). The first sub-groups are 2.1, 2.2, and the 3.1 mechanism. 3.2 to 3.4 follow after 3.1 is VERIFIED. Tasks 4.x and 5.x and 6.x must wait.

### 10.4 Can I4 begin partially?

Yes, after B2, B6, and B7, with 9.1 started under OD-10 before I2 acceptance. 9.2 onward waits for B4.

### 10.5 Can I3 and I4 be authorized together without violating dependencies?

Yes, provided the authorization is written as separate task groups:
- Group 1 (common): B1, B2, B3 for the values that the groups enforce, and B11.
- Group I3-foundation: 2.1 and 2.2 (no values); then 3.1, and 3.2 to 3.4 only after 3.1 is VERIFIED. Tasks 4.x onward wait for all of Tasks 2 and 3 to be VERIFIED (package Part 11, Group C). Group C is not independently executable.
- Group I4-retrieval: 9.1.
- Group evidence (after B4): 5.x, 6.x, 9.2, 9.3.

The two streams share no explicit dependency. Authorizing them together does not violate a dependency, because B1, B2, and the limit values are required by both and must be approved first.

---

## 11. Files and confirmation

- Created: `docs/development/i3-i4-readiness-closure-report.md` (this report).
- Modified: `.kiro/reports/phase-status.md` (factual progress entry and reference to this report, section 21).
- Not modified: approved specifications, Architecture, Playbook, Operating Guide, D01, D02, Native Spec files, task checkboxes, `.kiro/settings/mcp.json`, dependencies, implementation code.
- No implementation was started. I3 and I4 are not authorized. No checkbox was changed.
