# I3 and I4 owner decision package

Status: decision package for owner review. NOT an approval. No decision in this document is APPROVED until the owner replies in Part 10. No implementation was started. I3 and I4 are not authorized. I2 is not accepted. No task checkbox, approved source document (Spec 1, Spec 2, Architecture, Playbook, Operating Guide), native Spec file, D02, D03, dependency, or `.kiro/settings/mcp.json` was changed by this package.

Date of record: 2026-11-10.

Revision history:
- Initial package: OD-1 to OD-20 matrix, cache cases, limits, authorization map.
- Consistency pass: Group A dependencies, parse-failure outcome, transport review, OD-5 reconciliation.
- Final closure pass (this revision): one OD-5 checklist (Part 10.1), corrected Group C and authorization map (Part 11), a bounded transport contract (Part 6A), and the OD-15 status for G-1 and G-2.

Source of the decisions: `docs/development/i3-i4-readiness-closure-report.md` (Part 4 lists OD-1 to OD-20). That report is the only source for the OD numbers. This package adds no new OD numbers and renumbers nothing.

Status vocabulary:
- `OPEN`: no decision.
- `ACCEPTED IN PRINCIPLE` (AIP): the owner accepted the direction. The exact value or wording is not approved.
- `APPROVED`: the owner approved the exact rule or value, or an existing source already sets it.
- `EXCLUDED`: outside the current I3 and I4 scope.
- `VERIFIED`: a check was executed and its result was observed. Nothing in this package is verified.
- `IMPLEMENTED`, `ACCEPTED`: as defined in the Playbook. Nothing in this package is implemented or accepted.

Reading of "complete" in dependencies: where a task header says "depends on N", this package reads N as VERIFIED. The Playbook prohibits starting a task while the previous task has unverified critical behavior. Owner may correct this reading in Part 10.2.

---

## Part 1. Summary for the owner

| ID | Title | Status | Recommendation |
|---|---|---|---|
| OD-1 | Interim cache policy | OPEN | Git evidence is always live. Only GitHub records may be cached. No Git caching before D06. |
| OD-2 | Required reference resolved only from cache | OPEN | `PARTIAL`. |
| OD-3 | `NOT_PERFORMED` record supporting a classification | OPEN | No. |
| OD-4 | Cache fallback after failed live request | OPEN | `STALE_CACHE_SERVED` with the failure code, status `PARTIAL`. |
| OD-5 | Numeric limit values | OPEN (AIP rows need exact approval) | Approve each row in the checklist, Part 10.1. |
| OD-6 | `repository_id` length | OPEN | 64. Correct D02 §16.6. |
| OD-7 | GitHub redirects | OPEN | Refuse all redirects. |
| OD-8 | Oversize GitHub response code | OPEN | `GITHUB_UNAVAILABLE`, not retryable. |
| OD-9 | Native task header amendments (Tasks 3, 9, 16.1) | OPEN | Approve the text in Part 5. |
| OD-10 | Task 9.1 before I2 acceptance | OPEN | Allowed, because 9.1 produces no evidence. 9.2 and later still require acceptance. |
| OD-11 | Symbol-resolution method for Task 4.1 | OPEN | Python `ast` at `HEAD`, including the parse-failure outcome in Part 6. |
| OD-12 | GitHub author field | OPEN | Display name when non-empty, otherwise an unavailable marker. Never login or email. |
| OD-13 | GitHub API version pin and `merge_commit_sha` | OPEN | Pin `2022-11-28`. Live check needs network authorization. |
| OD-14 | HTTP client, token variable, test strategy | OPEN | `urllib` with the transport contract in Part 6A. Owner names the token variable. |
| OD-15 | Git-side decisions G-1, G-2, G-3 | OPEN, BLOCKED for G-1 and G-2 | G-1 and G-2 original alternatives are not in the workspace. Owner must supply them. G-3 recommendation only. |
| OD-16 | Native Spec approval for I3 and I4 scope | APPROVED (owner, recorded 2026-11-10; Part 15) | Covers Requirements 2, 3, 14 and the design baseline at the hashes in Part 15. Does not approve OD-9 header amendments. |
| OD-17 | D02 wording corrections | OPEN | Correct the listed defects and confirm the status rule in Part 9. |
| OD-18 | Git option set and SHA-256 check | OPEN (not a decision) | Run at implementation time in temporary directories, after authorization. |
| OD-19 | Hypothesis installation | OPEN | Enumeration until installation is separately authorized. |
| OD-20 | Golden categories outside I3 and I4 | OPEN | Record only. Task 18 stays outside I3 and I4. |

Decisions that must be answered together:
- Cache group: OD-1 to OD-4.
- Limits group: OD-5 (checklist) and OD-6.
- GitHub client group: OD-7, OD-8, OD-10, OD-13, OD-14.
- Native Spec group: OD-9 and OD-16.
- Git and symbol group: OD-11, OD-15, OD-18.
- Standalone: OD-12, OD-17, OD-19, OD-20.

---

## Part 2. Decision matrix OD-1 to OD-20

Owner response fields are blank. The owner fills them in Part 10.

### OD-1. Interim cache policy

- **Status:** OPEN.
- **Problem:** Spec 1 §14 allows caching only where invalidation can be handled safely. D06 (cache invalidation) is open. No rule says which data may be cached before D06 closes.
- **Authoritative references:** Spec 1 §14 (approved); Native Requirement 17.1 to 17.4; Native Tasks 10.1 and 10.2; D06 (open).
- **Recommended decision:** Git-derived evidence is always retrieved live. Only GitHub records may be cached. No Git caching until D06 is decided.
- **Exact normative rule (proposed):** "Until D06 is approved, the cache stores GitHub pull request and issue records only. Git-derived evidence is never read from the cache."
- **Rationale:** Local Git reads are fast and always reflect the current repository. The invalidation risk sits with GitHub data, which changes after the fact.
- **Consequences:** Tasks 10.1 and 10.2 stay held.
- **Dependencies:** D06, D07 (blocker B15). Feeds OD-2 to OD-4.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-2. Required reference resolved only from cache

- **Status:** OPEN.
- **Problem:** A valid explicit GitHub reference may be resolvable only from a cached record whose identity was not validated in the current operation.
- **Authoritative references:** Spec 1 §7 ("Validate external references before associating"; "Distinguish unavailable metadata from nonexistent records"); Spec 1 §14; the owner rule "inability to verify identity produces PARTIAL" recorded in the readiness report.
- **Recommended decision:** Status `PARTIAL`, code `REFERENCE_NOT_VERIFIED_CACHED`.
- **Exact normative rule (proposed):** "When a required external resolution depends on a cached record that was not validated in the current operation, the investigation status is PARTIAL. The cached record is not used as a verified association endpoint."
- **Rationale:** The reference is valid, but its current identity is unverified. `COMPLETE` would overstate the result. `FAILED` would imply the investigation could not run.
- **Consequences:** The result shows what was retrieved, with the limitation. Classification is unaffected.
- **Dependencies:** OD-1, OD-3, OD-4.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-3. `NOT_PERFORMED` record supporting `DOCUMENTED` or `INFERRED`

- **Status:** OPEN.
- **Problem:** A cache-served record carries `source_verification = NOT_PERFORMED` (enforced by the I2 model). Spec 1 is silent on whether such a record may by itself support a classification.
- **Authoritative references:** I2 model (`IntegrityRecord`, `_cache_claims_no_fresh_verification`); Spec 1 §10; D6 (I2 brief).
- **Recommended decision:** No. A `NOT_PERFORMED` record cannot support `DOCUMENTED` or `INFERRED` on its own.
- **Exact normative rule (proposed):** "A record whose source verification is NOT_PERFORMED may be displayed with its cache state. It is not counted as support for DOCUMENTED or INFERRED. If no other supporting evidence exists, the classification follows the existing rules (PARTIAL_EVIDENCE or INSUFFICIENT_EVIDENCE)."
- **Rationale:** `DOCUMENTED` asserts that a verified source states the fact now. A record not checked in this operation cannot make that assertion. Showing it as a labelled historical record is a different act, and is allowed.
- **Consequences:** Some results move to `PARTIAL_EVIDENCE` when only cached GitHub evidence exists.
- **Dependencies:** OD-1, D6, Spec 1 §10. Affects OD-2 and OD-4.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-4. Cache fallback after failed live request

- **Status:** OPEN.
- **Problem:** A live GitHub request fails, and a cached record for the same reference exists. The status and code for the fallback are not decided.
- **Authoritative references:** D02 §16.7 (proposed); Native Task 10.2 ("Flag stale entries served after a failed live request"); Spec 1 §14.
- **Recommended decision:** Status `PARTIAL`, with `STALE_CACHE_SERVED` and the failure code (`GITHUB_UNAVAILABLE`, `GITHUB_RATE_LIMITED`, or `GITHUB_NOT_FOUND_OR_INACCESSIBLE`).
- **Exact normative rule (proposed):** "A cached record served after a failed live request carries served_from_cache = true, source_verification = NOT_PERFORMED, its original retrieved_at, and the code STALE_CACHE_SERVED. The investigation status is PARTIAL. Age is derived from retrieved_at for display and is never stored. Cache age alone does not make a record invalid."
- **Rationale:** The fallback shows the historical state without claiming it is current. Owner decision D6 requires derived age. Time-based invalidation is rejected because D06 is open.
- **Consequences:** Single-record tools need their own answer (F-4 in Part 9).
- **Dependencies:** OD-1, OD-3, OD-17 (D02 cache-age wording).
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-5. Numeric limit values

- **Status:** OPEN. Rows marked AIP in Part 3 become APPROVED only after the owner approves the exact value in the checklist.
- **Problem:** Tasks 2.3, 3.1, 4.1, 4.2, 5.1, 5.4, 6.1, and 9.1 need values that no approved source sets. Several values are only proposed.
- **Authoritative references:** Spec 1 §13 and Native Requirements 15.2, 16.1, 20.2 (timeouts and bounded output, no numbers); D02 §16.6 (proposed values); owner approval in principle for the candidate and display limits.
- **Recommended decision:** Approve the rows in the checklist in Part 10.1, one row at a time.
- **Exact normative rule (proposed):** "The approved values are the configured limits for Task 16.1. Each limit has one code. A limit reached never changes classification. A limit reached on an internal operation sets status PARTIAL. A limit reached on requested scope after the scope completes keeps status COMPLETE and sets RESULT_LIMIT_REACHED."
- **Rationale:** Bounded retrieval satisfies Requirements 15.2 and 20.2. Each value is stated once, so no task invents its own.
- **Consequences:** Limit-enforcing tasks cannot be verified until their rows are approved and tested (Part 10.1, column "needed for verification").
- **Dependencies:** OD-6, OD-7, OD-8, OD-13, OD-14.
- **Owner response:** Use the checklist in Part 10.1. Do not reply here.

### OD-6. `repository_id` length

- **Status:** OPEN.
- **Problem:** The implemented registry pattern limits `repository_id` to 64 characters (`^[a-z0-9][a-z0-9_-]{0,63}$`, accepted in I1). D02 §16.6 says at most 128. The sources disagree.
- **Authoritative references:** `backend/app/modules/repository/registry.py` (I1, accepted); D02 §16.6 (proposed).
- **Recommended decision:** 64. Correct D02 §16.6 to match the accepted registry.
- **Exact normative rule (proposed):** "`repository_id` is 1 to 64 characters matching `^[a-z0-9][a-z0-9_-]{0,63}$`. D02 §16.6 is corrected to 64."
- **Rationale:** Changing the accepted registry would reopen I1.
- **Consequences:** D02 is corrected (OD-17). No I3 or I4 task uses this value directly.
- **Dependencies:** OD-17.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-7. GitHub redirects

- **Status:** OPEN.
- **Problem:** Requirement 16 and the design forbid cross-host redirects. They do not say whether same-host redirects may be followed. A followed redirect could send the token to another location.
- **Authoritative references:** Native Requirement 16 and design (cross-host rule); Native Requirement 5.x; Spec 1 §7.
- **Recommended decision:** Refuse all redirects.
- **Exact normative rule (proposed):** "The GitHub client does not follow HTTP redirects. A 3xx response is a retrieval failure with code GITHUB_UNAVAILABLE and retryable false."
- **Rationale:** No approved source requires following same-host redirects. Refusing all of them removes the risk of sending the token elsewhere. A renamed repository is reported as a limitation.
- **Consequences:** A renamed repository produces `PARTIAL` (investigation) or `FAILED` (single record).
- **Dependencies:** OD-14, checklist row R12.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-8. Oversize GitHub response

- **Status:** OPEN.
- **Problem:** D02 MCP-13 lists an oversize response as a case but names no code.
- **Authoritative references:** D02 §16.11 (MCP-13, proposed); Native Requirement 16.1 (size bounds); checklist row R11.
- **Recommended decision:** `GITHUB_UNAVAILABLE`, retryable false. No new code.
- **Exact normative rule (proposed):** "A GitHub response larger than the configured bound is rejected. The result is GITHUB_UNAVAILABLE with retryable false."
- **Rationale:** A new code would widen the code list for one case. `GITHUB_UNAVAILABLE` already means the metadata could not be retrieved, and it is accurate.
- **Consequences:** The owner may still choose a new code. That adds one entry to the code list (B12).
- **Dependencies:** R11, OD-17.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-9. Native task header amendments

- **Status:** OPEN. The exact text is in Part 5.
- **Problem:** The header of Task 3 (`depends on 1 and 16.1`) blocks Tasks 3.2 to 3.4, which use no limit value. The header of Task 9 does not list Task 16.1, although Task 9.1 enforces its bounds. Task 16.1 says Task 3 cannot start until it is verified.
- **Authoritative references:** `.kiro/specs/evidence-retrieval/tasks.md`; readiness report Part 5.1.
- **Recommended decision:** Approve the replacement text in Part 5.
- **Exact normative rule (proposed):** The header lines in Part 5 replace the current lines in `tasks.md` once OD-16 is approved.
- **Rationale:** Scopes each prerequisite to the tasks that use the value. No requirement is removed.
- **Consequences:** Tasks 3.2 to 3.4 are no longer blocked by Task 16.1 directly. They still wait for Task 3.1 to be verified (Part 11).
- **Dependencies:** OD-16, OD-5.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-10. Task 9.1 before I2 acceptance

- **Status:** OPEN.
- **Problem:** Task 9.1 retrieves GitHub records. Whether it may start before I2 acceptance depends on whether it creates evidence items.
- **Authoritative references:** Readiness report Part 7; I2 model (`EvidenceItem`, `IntegrityRecord`).
- **Recommended decision:** Task 9.1 may start before I2 acceptance. It returns retrieval results and creates no evidence item. Tasks 9.2 and later require I2 acceptance.
- **Exact normative rule (proposed):** "Task 9.1 may be implemented and unit tested before I2 acceptance. It produces no EvidenceItem. Tasks 9.2 and 9.3 require I2 owner acceptance before they are verified."
- **Rationale:** 9.1 only moves data from GitHub to the client. The evidence shape is set by 9.2.
- **Consequences:** Retrieval output is not evidence until 9.2 is accepted.
- **Dependencies:** OD-16, OD-13, OD-14, checklist rows R9 to R14.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-11. Symbol-resolution method for Task 4.1

- **Status:** OPEN.
- **Problem:** Task 4.1 must identify a symbol and resolve it against the current repository state. The method is not chosen. No parser package is approved (D01 §2).
- **Authoritative references:** Spec 1 §5; Architecture §19 (Dependency Policy); D01 §2.
- **Recommended decision:** Python standard library `ast` for `.py` files, applied to the content at `HEAD`. Other languages return a limitation. Parse failures have their own outcome (Part 6).
- **Exact normative rule (proposed):** Part 6.
- **Rationale:** `ast` is part of the platform, adds no dependency, and gives exact definitions. Resolving at `HEAD` makes results reproducible.
- **Consequences:** Only Python symbols are resolved. A parser package would need a separate dependency decision.
- **Dependencies:** Checklist rows V2, V3, V4, R1, R2; OD-18.
- **Owner response:** APPROVE / REJECT / MODIFY (including the parse-failure outcome and Python-only scope): ________

### OD-12. GitHub author field

- **Status:** OPEN.
- **Problem:** The I2 model (X4) stores a Git author as a name only, without email. A GitHub user object has a login and a name that may be empty. The field to use for GitHub records is not chosen.
- **Authoritative references:** I2 model X4; GitHub REST user object (field names from the official documentation; not verified against a live response).
- **Recommended decision:** Use the display name when it is non-empty. Otherwise, store an unavailable marker. Never store the login or an email as the author.
- **Exact normative rule (proposed):** "The author of a GitHub record is its display name when non-empty. When empty, the author is recorded as unavailable. The login and email are not stored as author values."
- **Rationale:** A display name is not an identity. Identity matching uses the repository identity and record number. Both sources then carry the same kind of value. An empty name is not evidence that the author does not exist.
- **Consequences:** Some records show "unavailable" even though the account exists. This is accurate.
- **Dependencies:** OD-14, I2 X4.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-13. GitHub API version pin and `merge_commit_sha`

- **Status:** OPEN.
- **Problem:** The GitHub REST API has versions. One version removes `merge_commit_sha` from pull request responses. The version to pin is not chosen, and the field's behavior under the pinned version is not verified live.
- **Authoritative references (checked in this round, official GitHub documentation):**
  - Breaking-changes page, section "Version 2026-03-10": removes `merge_commit_sha` from pull request responses.
  - Breaking-changes page: no breaking changes listed for `2022-11-28`.
  - Versions page: `2022-11-28` is the default when the header is absent, and it is supported until 2028-03-10. End of support for `2026-03-10` is not yet scheduled.
  - Versions page: an unsupported version returns HTTP 410 Gone.
  - Issues page: the issues endpoint may return pull requests, identified by the `pull_request` key.
- **Assumption (not verified live):** `merge_commit_sha` is present under `2022-11-28`.
- **Recommended decision:** Pin `X-GitHub-Api-Version: 2022-11-28` on every request. Run a live check of `merge_commit_sha` and `merged` only after the owner authorizes network access.
- **Exact normative rule (proposed):** "All GitHub requests send `X-GitHub-Api-Version: 2022-11-28`. If `merge_commit_sha` is absent, the commit hash is recorded as unavailable. The record is recorded as not merged only when the `merged` field was retrieved and is false."
- **Rationale:** Pinning avoids silent changes to the response shape. A missing field never becomes a claim of absence (Spec 1 §7, Requirement 5.4).
- **Consequences:** The pin must be reviewed before 2028-03-10. The issue lookup must reject pull request objects identified by the `pull_request` key.
- **Dependencies:** OD-7, OD-14, OD-10, owner network authorization for the live check.
- **Owner response:** APPROVE / REJECT / MODIFY, and whether the live check is authorized: ________

### OD-14. HTTP client, token variable, test strategy

- **Status:** OPEN.
- **Problem:** Three implementation choices for Task 9 are open: the HTTP client, the environment variable name for the optional token, and the test strategy.
- **Authoritative references:** Architecture §19 (no dependency without reason); D01 §2 (no HTTP client approved); Architecture §3 (credentials optional, read from environment); Requirement 16.
- **Recommended decision:** Standard library `urllib` with the transport contract in Part 6A. The owner names the token variable (no name is recorded in the workspace). Tests use recorded fixtures and, where needed, a loopback server. Neither contacts GitHub.
- **Exact normative rule (proposed):** "The GitHub client uses `urllib.request` under the transport contract in Part 6A. The token is read only from the named environment variable and is sent only to the GitHub API host over HTTPS. The test suite does not contact GitHub."
- **Rationale:** `urllib` covers the need without a dependency. Its timeout and size limits have specific caveats (Part 6A), so they are stated as a contract rather than assumed.
- **Consequences:** Redirect and size handling are written by hand. A strict total time limit is not part of the MVP contract (Part 6A.4).
- **Dependencies:** OD-7, OD-8, OD-13, checklist rows R9 to R14, Part 10.2 inputs P-2 and P-3.
- **Owner response:** APPROVE / REJECT / MODIFY; token variable name: ________; P-2 and P-3 answers: ________

### OD-15. Git-side decisions G-1, G-2, G-3

- **Status:** OPEN. G-1 and G-2 are BLOCKED on owner input. G-3 is a recommendation only.
- **G-1 (rename path).** Which path is recorded for a history item after a rename. Original alternatives: NOT FOUND in the workspace. The search covered the whole workspace in this round, and the owner decision record (`.kiro/reports/phase-status.md` §19) lists G-1 as not approved without its options. No alternatives are reproduced here, and none are invented.
- **G-2 (whole-file revision).** Which revision is used when a whole-file item has no line range. Original alternatives: NOT FOUND in the workspace, with the same result.
- **G-3 (`GIT_COMMIT` timestamp).** Which Git date field is stored. Recommendation: `%at` (author date), because the record describes when the change was authored. This is a recommendation, not an approval. Git documentation confirms `%at` is the author date and `%ct` is the committer date.
- **Authoritative references:** Native Requirements 3 and 4.
- **Consequences:** No approval can be recorded for G-1 or G-2 until the owner supplies the alternatives in the reply. Tasks 5.1 and 6.x cannot be authorized until G-1 to G-3 are decided.
- **Dependencies:** OD-16, checklist row R4 to R7 (5.1), I2 acceptance for evidence items.
- **Owner response:** G-1 ____ (owner supplies alternatives) / G-2 ____ (owner supplies alternatives) / G-3 ____ (APPROVE / REJECT / MODIFY)

### OD-16. Native Spec approval for I3 and I4 scope

- **Status:** OPEN.
- **Problem:** The native Spec files for the evidence retrieval feature are NOT APPROVED. Requirements 2, 3, and 14 contain Spec 1 text that is not yet approved (D01 gap statement). No I3 or I4 task may start without approval.
- **Authoritative references:** Playbook process rules; D01 native requirement gap statement; readiness report B1 and B2.
- **Recommended decision:** Approve the scope and content in Part 5 and Part 6A.3, by file and hash.
- **Exact normative rule:** Owner approval in writing, naming each file and its SHA-256 at the time of approval.
- **Rationale:** Without approval, the implementation has no approved requirement to trace to.
- **Consequences:** Required before Tasks 2.x, 4.x, 5.x, and 18 (D01). The readiness report's statement that 2.1 can start after B1 alone is corrected here: B1 includes the Requirement 2, 3, and 14 text.
- **Dependencies:** OD-9.
- **Owner response:** APPROVE / REJECT / MODIFY (name the file hashes): ________

### OD-17. D02 wording corrections

- **Status:** OPEN.
- **Problem:** Four defects in D02 (proposed text, not approved).
- **Defects:**
  1. §16.6 says DEC-10 limits and timeouts are "in Section 16.6". §16.6 contains no timeouts and no byte limits.
  2. §16.6 gives `repository_id` at most 128 characters. The accepted registry allows 64 (OD-6).
  3. §16.7 says a cached item "carries its age". Owner decision D6 derives the age from `retrieved_at` and stores no age field (OD-4).
  4. §16.7 GitHub rows apply to single-record tools. Their scope for investigation references is not stated (F-4).
- **Authoritative references:** D02 §§16.6, 16.7; D6; Spec 1 §10.2.
- **Recommended decision:** Correct all four. Items 2 and 3 follow OD-6 and OD-4.
- **Exact normative rule:** Text edits only. No behavior change beyond what the owner approves.
- **Rationale:** D02 is the contract for MCP tools. Wrong text would be used as a source.
- **Consequences:** D02 edits need owner approval.
- **Dependencies:** OD-4, OD-6, F-3, F-4.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-18. Git option set and SHA-256 check

- **Status:** OPEN. This is an action that needs authorization, not a decision.
- **Problem:** The Git option set for Task 3.2 and the SHA-256 repository check for Tasks 3 and 6.1 can only be verified by running Git. That needs an explicit authorization scope.
- **Authoritative references:** Native Tasks 3.2 and 6.1; Spec 1 §13 and Native Requirements 15.1 to 15.6; Git 2.50.1 installed.
- **Recommended decision:** Authorize read-only Git commands inside temporary directories created for the test. Use argument arrays, a clean environment, and no hooks. No commands against the Sean repository or the Django repository without separate authorization.
- **Exact normative rule (proposed):** "Verification commands run inside a temporary directory, with a clean environment, with argument arrays, and with no hooks. Their output is recorded."
- **Rationale:** Verification needs real Git behavior. Temporary repositories keep the risk away from user repositories.
- **Consequences:** Tasks 3.2 and 6.1 cannot be verified until this authorization is given.
- **Dependencies:** OD-16, OD-11.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-19. Hypothesis installation

- **Status:** OPEN.
- **Problem:** D01 §2 approves `hypothesis 6.170.15` for development and test only (MPL-2.0, not shipped). It is not installed.
- **Authoritative references:** D01 §2; Architecture §19.
- **Recommended decision:** Do not install until the owner authorizes it separately. Property-style tests use enumerated cases until then.
- **Exact normative rule (proposed):** "Hypothesis is installed only after a separate owner authorization."
- **Rationale:** D01 approves the package, but installation is a separate action with its own authorization.
- **Consequences:** Some property tests are written as enumerated tables.
- **Dependencies:** OD-16.
- **Owner response:** APPROVE / REJECT / MODIFY: ________

### OD-20. Golden categories outside I3 and I4

- **Status:** OPEN.
- **Problem:** Spec 1 §19 lists Golden categories. Native Requirement 22 names only G01 to G10 and does not cover all categories.
- **Authoritative references:** Spec 1 §19 (approved); Native Requirement 22; Native Task 18.
- **Recommended decision:** Record only. Task 18 stays outside I3 and I4.
- **Consequences:** Requirement 22 stays incomplete until a later change. This does not block I3 or I4.
- **Dependencies:** OD-16.
- **Owner response:** RECORD ONLY / REJECT / MODIFY: ________

---

## Part 3. Numeric limits inventory

Categories: I = input validation, R = retrieval bound, P = processing bound, D = display only. Status: `APPROVED` (set by an accepted or approved source), `AIP` (accepted in principle; exact value not approved), `OPEN` (no approved source), `NONE` (no limit by decision), `EXCLUDED` (outside I3 and I4). The checklist with approval columns is Part 10.1, which is the only authoritative checklist.

A limit that is reached never changes classification. Display limits never change retrieval status.

| Row | Parameter | Value | Unit | Cat. | Tasks that use it | Behavior when reached | Status |
|---|---|---|---|---|---|---|---|
| V1 | `repository_id` length | 64 | characters | I | None in I3 or I4 (decided under OD-6) | `INVALID_INPUT` | OPEN (OD-6); EXCLUDED from checklist |
| V2 | Repository-relative target path | 1,024 | characters | I | 2.3, 4.1, 5.1, 6.1 | `INVALID_INPUT` | OPEN |
| V3 | Symbol text | 1 to 256, no control characters or newlines | characters | I | 2.3, 4.1 | `INVALID_INPUT` | OPEN |
| V4 | Line span for target search | 2,000 | lines | I | 4.1, 5.1 | `INVALID_INPUT` | OPEN |
| V5 | Blame span | 500 | lines | I | 6.1 | `INVALID_INPUT` | OPEN |
| V6 | Line numbers | 1-based, start ≤ end, end within file | — | I | 4.1, 6.1 | Input rejected | NONE (rule) |
| V7 | PR and issue number | Positive decimal string, no upper digit bound | digits | I | 9.1 | Non-decimal or zero rejected | APPROVED (D9, no bound) |
| V8 | Commit or revision name | 40 or 64 lowercase hex | characters | I | 6.2 | Rejected before Git call | APPROVED (DEC-14) |
| V9 | `max_results` | default 20, range 1 to 50 | results | I | None in I3 or I4 | `INVALID_INPUT` | EXCLUDED (Tasks 15.2, 17.2) |
| R1 | Git call timeout | 30 | seconds per call | R | 3.1, 4.1, 4.2, 5.1, 5.4, 6.1 | Process terminated. `GIT_TIMEOUT`. | OPEN |
| R2 | Git stdout bound per call | 16 | MiB | R | 3.1, 4.1, 5.1, 5.4, 6.1 | Process terminated. `OUTPUT_LIMIT_EXCEEDED`. | OPEN |
| R3 | Git stderr bound per call | 64 | KiB | R | 3.1 | Truncated. Never logged with environment values. | OPEN |
| R4 | Commits scanned per investigation | 2,000 | commits | P | 5.1 | `COMMIT_SCAN_LIMIT_REACHED`. `PARTIAL`. | AIP |
| R5 | Bytes scanned per commit message | 64 | KiB | P | 5.1 | `MESSAGE_WINDOW_LIMIT_REACHED`. `PARTIAL`. | AIP |
| R6 | Candidates per commit message | 10 | candidates | P | 5.1 | `CANDIDATE_LIMIT_REACHED`. `PARTIAL`. | AIP |
| R7 | Candidates per investigation | 200 | candidates | P | 5.1 | `CANDIDATE_LIMIT_REACHED`. `PARTIAL`. | AIP |
| R8 | GitHub requests per investigation | 10 | requests | P | None in I3 or I4 (integration step) | `REQUEST_BUDGET_REACHED`. | AIP; EXCLUDED from checklist |
| R9 | GitHub per-operation timeout (connect and each socket operation) | 5 | seconds | R | 9.1 | `GITHUB_UNAVAILABLE`, retryable true | OPEN (definition per Part 6A) |
| R10 | GitHub total request time | 15 | seconds | R | 9.1 | Not enforced under the MVP contract (Part 6A.4) | OPEN (owner MODIFY required) |
| R11 | GitHub response size | 1 | MiB | R | 9.1 | Rejected. `GITHUB_UNAVAILABLE`, retryable false (OD-8). | OPEN |
| R12 | GitHub redirects | Refuse all | — | R | 9.1 | Redirect is a failure (OD-7). | Decided under OD-7 |
| R13 | GitHub automatic retries | 0 | retries | R | 9.1, 9.3 | Single attempt | OPEN |
| R14 | Rate-limit handling | No request while reported limit is exhausted | — | R | 9.1, 9.3 | `GITHUB_RATE_LIMITED` | OPEN (method; header names need OD-13 check or documented source) |
| R15 | Overall investigation deadline | None | — | — | All | Not applicable | APPROVED (C-D3) |
| R16 | Git subprocesses run one at a time | Sequential | — | R | 5.1 | Not applicable while sequential | OPEN (not an approved source assumption) |
| R17 | Cache size and invalidation | Not set | — | P | 10.1, 10.2 (held) | Held | EXCLUDED |
| R18 | Registry file size | 256 | KiB | I | Task 1 (done) | Rejected at load | APPROVED (I1) |
| R19 | Registry root path length | 4,096 | characters | I | Task 1 (done) | Rejected at load | APPROVED (I1) |
| D1 | `matched_text` display | 256 | code points | D | Task 8 workflow only | Display cut. `TEXT_TRUNCATED`. | AIP; EXCLUDED from checklist |
| D2 | Context window | 80 | characters each side | D | Task 8 workflow only | Display cut. `TEXT_TRUNCATED`. | AIP; EXCLUDED from checklist |

Limits that must not be imposed:
- No maximum digit count for PR and issue numbers (D9, approved). Numbers stay strings.
- No integer JSON `number` type for PR and issue numbers.
- No overall investigation deadline (C-D3).

---

## Part 4. Cache cases A to E

| Case | Displayed? | Association allowed? | Investigation status | Code | Classification effect |
|---|---|---|---|---|---|
| A. Cached historical record shown as supporting information. No required resolution. | Yes, labelled as cached, with `retrieved_at` and `NOT_PERFORMED`. | Not applicable. | Unchanged by cache state. `COMPLETE` if all planned operations completed. | None | None caused by the cache. OD-3 applies if the record would be the only support. |
| B. Required external reference resolvable only from an unvalidated cached record. | Only as labelled supporting material. | No. | `PARTIAL` | `REFERENCE_NOT_VERIFIED_CACHED` (OD-2) | None. |
| C. Live request fails. Cached record shown as fallback. | Yes, labelled as fallback. | No. | `PARTIAL` | Failure code plus `STALE_CACHE_SERVED` (OD-4) | Not upgraded by the fallback. OD-3 applies. |
| D. Live request succeeds and validates identity. | Yes, as live. | Yes, when the other association rules hold. | Unchanged by this case. | None | None |
| E. Cached record whose stored state is `NOT_PERFORMED`. | Yes, labelled. | Never. | Follows case A or B. | As A or B | As A or B |

Why OD-3 matters:
- A historical record can be shown with a label that says it is cached and not checked now. That is a statement about the record.
- A classification of `DOCUMENTED` or `INFERRED` is a statement about the fact. It asserts that a source supports the fact now. A record not checked in this operation cannot make that assertion.

Cache rules that follow (all depend on OD-1 to OD-4):
- R-C1: a cache-served record never shows `VALIDATED_RECORD_IDENTITY`.
- R-C2: age is derived from `retrieved_at` and never stored.
- R-C3: age alone does not invalidate a record. D06 governs invalidation.
- R-C4: display-only cache use does not change status. A required resolution from an unverified cache record does (`PARTIAL`).
- R-C5: retrieval failure, identity-validation failure, and display-only fallback stay separate.

---

## Part 5. OD-9 header replacement text and OD-16 approval content

Each replacement needs OD-16 approval before it is applied to `.kiro/specs/evidence-retrieval/tasks.md`.

### Task 3

- **Current:** `(depends on 1 and 16.1)`
- **Proposed:** `(depends on 1). Task 3.1 also depends on 16.1 for the timeout and byte-limit values. Tasks 3.2, 3.3, and 3.4 do not depend on 16.1 directly. They depend on Task 3.1 being verified.`
- **Reason:** Tasks 3.2 to 3.4 use no limit value. The current header blocks them unnecessarily.
- **Unblocked:** 3.2, 3.3, 3.4 from the direct Task 16.1 block only. They still wait for 3.1 to be verified.
- **Still blocked:** 3.1 verification until R1 to R3 are approved and tested.
- **Native Spec approval needed:** Yes.

### Task 9

- **Current:** `(depends on 1, 7)`
- **Proposed:** `(depends on 1, 7, and 16.1 for the timeout, size, redirect, and retry values in 9.1)`
- **Reason:** Task 9.1 enforces bounds that Task 16.1 defines.
- **Newly blocked:** 9.1 verification until R9 to R14 are approved and tested.
- **Native Spec approval needed:** Yes.

### Task 16.1

- **Current:** "Task 3 cannot start until this task is verified."
- **Proposed:** "Tasks 3.1, 4.2, 5.1, 5.4, 6.1, and 9.1, and any other task that enforces a value in Task 16.1, cannot be verified until this task is verified. Tasks that use no value in Task 16.1 are not blocked by this task."
- **Reason:** The current wording blocks all of Task 3, which is not needed.
- **Native Spec approval needed:** Yes.

### OD-16 approval content (by file)

Approval names each file and its SHA-256 at the time of approval. Any later edit invalidates that approval.

| File | SHA-256 (this round) | Sections that need approval |
|---|---|---|
| `.kiro/specs/evidence-retrieval/requirements.md` | `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7` | Requirements 2, 3, 14 (Spec 1 text, unapproved), and the requirements cited by Tasks 2 to 6, 9, and 16.1. Requirement 22 excluded (OD-20). |
| `.kiro/specs/evidence-retrieval/design.md` | `EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3` | Module table (github row), Git retrieval design, GitHub design, C.4 table, E-D8 (no cross-host redirects), E-D14 and DEC-10 (limits), C.8 (no deadline), and the parse-failure outcome (Part 6, if approved under OD-11). |
| `.kiro/specs/evidence-retrieval/tasks.md` | `B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8` | Headers of Tasks 3, 9, 16.1 (text above). Task 6 header stays as it is (it depends on 5). |

Excluded from this approval: Ouija spec files, Task 8, Tasks 10.x, 15.2, 16.2, 17.2, 18.

---

## Part 6. OD-11 symbol-resolution rule

Recommended method:
1. Normalize the target path using the approved path rules (Task 2.x). Reject traversal and symlink escape.
2. Read the file content at `HEAD` with `git show <HEAD>:<path>` (argument array, no shell, fixed environment). Do not read the working tree. Git output is bounded by R2. If R2 is exceeded, the result is `OUTPUT_LIMIT_EXCEEDED` (a Git limit), not a parse outcome.
3. If the path is not a `.py` file, return a limitation: "symbol resolution is not supported for this language." This is not a resolution result.
4. Parse with `ast.parse` on the bytes read from Git (so the source encoding declaration is honored).
5. Collect definitions (function, class, assignment target) whose name equals the requested symbol, with their line ranges. If a line range was requested, keep only definitions that overlap it.

Outcomes of step 5 (each distinct; none is a silent substitute for another):

| Outcome | Condition | Code | Effect |
|---|---|---|---|
| Resolved | Exactly one matching definition | None (success) | Region used for history retrieval |
| Ambiguous | Two or more matching definitions | `TARGET_AMBIGUOUS` with candidates | Request-level (C-D10). No choice made silently. |
| Not in current state | Parse succeeded, zero matching definitions | `TARGET_NOT_IN_CURRENT_STATE` | Request-level (C-D10). Historical search may follow (Task 4.2). |
| Parse failure | Parse of the `HEAD` content raises an error | `TARGET_PARSE_FAILED` | Request-level (proposed; see below) |
| Unsupported language | Step 3 | Limitation (no code) | Symbol not resolved; explicit limitation in the result |

Parse-failure rule (proposed; approval under OD-11):
- Parse failure covers: `SyntaxError`, `ValueError` (for example null bytes), `UnicodeDecodeError` raised while decoding the source, and `RecursionError` or `MemoryError` raised for very deep nesting.
- The outcome is `TARGET_PARSE_FAILED`. It is request-level, following C-D10: it never produces `PARTIAL` on its own, and it never produces zero matches.
- It never maps to `TARGET_NOT_IN_CURRENT_STATE` and never to `TARGET_AMBIGUOUS`. A file that cannot be parsed is not a file without the symbol.
- The message names the repository-relative path and the exception class name only. It does not include file content, a traceback, or the Git command line.
- No historical conclusion is drawn for the requested symbol. The result carries the limitation.
- Caveat: `ast` uses the Python version of the running interpreter (3.14 in this environment). A file valid under an older Python version can fail here. That case reports `TARGET_PARSE_FAILED`, and it is not treated as a repository error.
- The code `TARGET_PARSE_FAILED` is a new code. It needs approval as part of the D02 §16.5 code list (blocker B12).

Rejected alternatives:
- Text search. It matches uses as well as definitions and cannot represent ambiguity correctly.
- A third-party parser. It adds a dependency with license, maintenance, and Windows-installation costs. Architecture §19 requires a documented reason, which the standard library meets for Python.

Test criteria (for implementation review; not executed):
- A definition is found and its range is exact.
- Two definitions with the same name produce `TARGET_AMBIGUOUS`.
- A missing symbol produces `TARGET_NOT_IN_CURRENT_STATE`.
- A file with a syntax error produces `TARGET_PARSE_FAILED`, not zero matches.
- A non-Python file produces the language limitation.
- The working-tree version is not read.

Owner input: Python-only scope for the MVP, and the parse-failure outcome above.

---

## Part 6A. GitHub transport contract (OD-14, checklist rows R9 to R14)

This part replaces the earlier single statement that a per-read check bounds total time to one socket timeout. That statement was not demonstrated and is withdrawn.

### 6A.1 Facts used

From the Python documentation (`docs.python.org/3/library/urllib.request.html`, checked this round):
- `urlopen` accepts one `timeout` value. It applies to blocking operations, including the connection attempt. It works for HTTP and HTTPS.
- A timeout is raised as `TimeoutError` when the server does not respond within the timeout.
- Exceptions raised while reading or parsing a response are not wrapped in `URLError`. They propagate unchanged, including `http.client.HTTPException` subclasses and `OSError` subclasses.
- Non-200 responses go to the HTTP error handlers. `HTTPError` is raised if no handler handles them.
- A `*_proxy` environment variable installs a proxy handler automatically.

From knowledge, not verified in this session:
- DNS name resolution is not governed by the socket timeout.
- On Windows, `urllib` reads system proxy settings in addition to environment variables.
- `http.client` bounds header line length and header count, and reads header lines through the same socket.

### 6A.2 Selected timeout mechanism

One per-operation socket timeout `T` is passed to `urlopen` (the checklist value R9, 5 seconds). `T` applies to the connection attempt and to each individual socket operation. It is not a total time limit.

### 6A.3 Contract (MVP)

1. Scheme: HTTPS only. An `http://` URL is refused before any request is sent, and the token is not sent.
2. Redirects: a custom redirect handler returns no follow-up request for any 3xx response. The 3xx then reaches the default error handling and raises `HTTPError`, which maps to `GITHUB_UNAVAILABLE`. A global `install_opener` is not used. The opener is local to the client.
3. Body size: the body is read with `read1` in bounded chunks. The running total is checked before each append. Reading stops at R11 (1 MiB) and returns `GITHUB_UNAVAILABLE`, retryable false. `Content-Length` is not trusted. It can be absent or wrong.
4. Compression: no `Accept-Encoding` header is sent. This avoids decompressed-size growth that the contract does not bound.
5. Proxies: owner input P-3. Recommended: an explicit proxy policy in the client, so that the token is not sent through an environment or system proxy unless the owner chooses that.
6. Exceptions: only explicit classes are caught (`HTTPError`, `URLError`, `TimeoutError`, `ConnectionError` subclasses, `ssl.SSLError`, `http.client.HTTPException`). Each maps to a code: 404 to `GITHUB_NOT_FOUND_OR_INACCESSIBLE`, rate-limit responses to `GITHUB_RATE_LIMITED`, all others to `GITHUB_UNAVAILABLE`. No broad `except`.
7. Token: never placed in an exception message, log line, or result field.
8. Retries: none (R13 = 0).

### 6A.4 What the contract does not guarantee (residual limitations)

- Total time is not bounded. A server that keeps the connection alive by sending data slowly can extend one request beyond 15 seconds, and the contract does not stop it. A header line or a body read can span several socket operations, and the contract has no check between them.
- DNS resolution can exceed `T`.
- The per-operation timeout bounds each step, not the whole request.
- Consequence: R10 (15 seconds total) is not enforced. Under this contract, R10 must not be a verification prerequisite. The owner must modify R10 in the checklist (Part 10.1).

Whether a strict total limit is needed is a decision for the owner. Recommended: accept the residual, because C-D3 already removes an overall investigation deadline and the MVP runs one investigation at a time.

### 6A.5 Single alternative if a strict total limit is required

A worker thread performs the request. The caller waits on the thread with a join timeout of R10 (15 seconds). At the deadline, the caller returns `GITHUB_UNAVAILABLE`. Limit of this alternative: the worker is not stopped. It finishes under its per-operation timeout, so resources can be held beyond the caller's deadline. This bounds the caller's wait, not resource use. It is more complex than the contract in 6A.3 and needs its own review. It is recommended only if the owner rejects the residual in 6A.4.

No custom socket transport is recommended. It would become a networking subsystem, which Architecture §19 and the Playbook discourage.

### 6A.6 Tests that would verify the contract (not executed; not authorized)

All tests use a loopback server on `127.0.0.1` or an injected test certificate authority. None contacts GitHub. Running them needs owner authorization under OD-14.
- A stalled connection fails within the per-operation timeout plus a stated margin.
- 301, 302, 307, and 308 responses are refused. No second request is sent to `Location`. The token is absent from any request to another location.
- A body above R11 is aborted with `GITHUB_UNAVAILABLE`, retryable false, including a body with a false `Content-Length`.
- An `http://` URL is refused before any request.
- Exception messages and log lines do not contain the token.
- Proxy environment variables follow the P-3 answer.
- Windows-specific behavior (system proxy, DNS) is tested on Windows, not inferred.

Any test that fails is a failure of the contract, not a reason to remove the test.

---

## Part 7. OD-12 author rule

Recommended rule:
- Store the GitHub display name when it is non-empty.
- When it is empty or missing, store the author as unavailable. Do not store the login.
- Never store an email address as an author value.
- Never use the author field for identity matching.

Why: the display name can change and can be empty. It is not an identity. Identity is the repository and number (D9). The Git author is also name only (I2 X4).

---

## Part 8. OD-13 GitHub version pin

Evidence status:

| Claim | Basis | Status |
|---|---|---|
| `2026-03-10` removes `merge_commit_sha` from PR responses | Official breaking-changes page | Documented (checked this round) |
| `2022-11-28` lists no breaking changes | Official breaking-changes page | Documented (checked this round) |
| `2022-11-28` is the default when the header is absent | Official API versions page | Documented (checked this round) |
| `2022-11-28` is supported until 2028-03-10 | Official API versions page | Documented (checked this round) |
| Unsupported versions return HTTP 410 Gone | Official API versions page | Documented (checked this round) |
| Issues endpoint may return PRs, identified by `pull_request` key | Official issues page | Documented (checked this round) |
| `merge_commit_sha` present under `2022-11-28` | Inference from the removal note | Assumption. Not live-verified. |
| `merged` field present and boolean | Not checked in this round | Assumption. Not live-verified. |

Recommendation: pin `2022-11-28`. Live check: one known merged and one known unmerged PR in a public repository, recorded under that version. Needs owner network authorization. Not performed.

Fallback: missing `merge_commit_sha` records the commit hash as unavailable. "Not merged" is recorded only when `merged` was retrieved and is false.

---

## Part 9. Cross-decision consistency review

| Check | Result | Action |
|---|---|---|
| Cache rules vs D06 integrity model | Consistent. Cache-served records are `NOT_PERFORMED`. D06 open. | None |
| Classification separate from association and retrieval status | Consistent with Spec 2 §8.5 mapping. Association never changes classification (G-M, G-P). | None |
| COMPLETE and PARTIAL per Spec 1 | **Conflict (F-3).** D02 §16.7 says reaching the result limit still counts as COMPLETE. Spec 1 §10.2 requires that planned operations completed. Reconciled rule: COMPLETE when all planned in-scope operations completed and at least one evidence item exists. Requested-scope limit reached after the scope completes keeps COMPLETE with `RESULT_LIMIT_REACHED`. Internal limit, failure, unresolved required reference, or incomplete history gives PARTIAL. | OD-17 |
| Numeric limits vs identifier rule | Consistent. No digit bound. Numbers stay strings. | Owner note (F-5) |
| Task dependencies vs data consumed | Consistent after OD-9 and Part 11. | Part 11 |
| I2 acceptance vs unit verification | Distinct. 582 unit tests verify I2 code. They are not owner acceptance. | None |
| D01 prerequisites not bypassed | **Finding (F-1).** Requirements 2, 3, 14 unapproved. | OD-16 |
| No silent approved-spec change | Confirmed. | None |
| GitHub lookup only for explicit validated references | Consistent with G-N and Spec 1 §7. | None |
| Bare `#NNN` ambiguous by default | Consistent with G-N. | None |
| Association does not imply causation | Consistent with G-P. | None |
| Parse failure distinct from absence | Part 6 rule. | OD-11 |
| Transport timeout meaning vs R10 | Part 6A. R10 not enforced under the contract. | Checklist row R10 |

Findings:
- **F-1 (Requirements gate).** Requirements 2, 3, 14 unapproved. Tasks 2.x, 4.x, 5.x, 18 depend on them.
- **F-2 (Registry vs D02).** Registry 64, D02 128. OD-6.
- **F-3 (Status rule).** D02 §16.7 and Spec 1 §10.2 conflict on the result-limit case. OD-17.
- **F-4 (Single-record tools).** D02 §16.7 GitHub rows for `get_pr` and `get_issue` give `FAILED`. The scope for investigation references is not stated. OD-17.
- **F-5 (Digit bound).** No digit bound on PR and issue numbers is a decision under D9. The risk is accepted. Owner note.
- **F-6 (Cache age wording).** D02 §16.7 vs D6. OD-4 and OD-17.
- **F-7 (Hypothesis).** Approved for dev and test only. OD-19.
- **F-8 (Transport total time).** The earlier claim that the per-read check bounds overshoot to one socket timeout was not demonstrated and is withdrawn. Part 6A.4 states the residual.

---

## Part 10. Owner approval section

Reply format: `OD-X APPROVE`, `OD-X REJECT`, or `OD-X MODIFY: <change>`. Dependent decisions must be answered together.

### 10.1 OD-5 authoritative checklist

This is the only limit checklist in the package. Every row needing approval for verification of an I3 or I4 task appears here. Rows outside I3 and I4 are listed separately with the reason.

Rows requested for approval (exact value needed for each):

| Row | Parameter and value | Needed for verification of | Status now | Owner response (exact value, or MODIFY text) |
|---|---|---|---|---|
| V2 | Path length: 1,024 characters | 2.3, 4.1 (input), 5.1, 6.1 | OPEN | ________ |
| V3 | Symbol length: 1 to 256 characters | 2.3, 4.1 | OPEN | ________ |
| V4 | Line span for search: 2,000 lines | 4.1, 5.1 | OPEN | ________ |
| V5 | Blame span: 500 lines | 6.1 | OPEN | ________ |
| R1 | Git call timeout: 30 s | 3.1; then 3.2 to 3.4 transitively; 4.1, 4.2, 5.1, 5.4, 6.1 | OPEN | ________ |
| R2 | Git stdout bound: 16 MiB | 3.1; 4.1 (reads content through Git); 5.1, 5.4, 6.1 | OPEN | ________ |
| R3 | Git stderr bound: 64 KiB | 3.1; then 3.2 to 3.4 transitively | OPEN | ________ |
| R4 | Commits scanned: 2,000 | 5.1 | AIP (exact approval needed) | ________ |
| R5 | Bytes per commit message: 64 KiB | 5.1 | AIP (exact approval needed) | ________ |
| R6 | Candidates per message: 10 | 5.1 | AIP (exact approval needed) | ________ |
| R7 | Candidates per investigation: 200 | 5.1 | AIP (exact approval needed) | ________ |
| R9 | GitHub per-operation timeout: 5 s (defined as in Part 6A.2) | 9.1 | OPEN | ________ |
| R10 | GitHub total request time: 15 s | Not enforced under the Part 6A contract. Recommended: MODIFY to "not a verification prerequisite; residual accepted" (Part 6A.4). Alternative: keep 15 s with the worker-thread design (6A.5). | OPEN | ________ |
| R11 | GitHub response size: 1 MiB | 9.1 | OPEN | ________ |
| R13 | GitHub retries: 0 | 9.1, 9.3 | OPEN | ________ |
| R14 | Rate-limit method: stop until reported reset | 9.1, 9.3. Header names need an OD-13 live check or a documented source before verification. | OPEN (method) | ________ |
| R16 | One Git subprocess at a time (sequential) | 5.1 only. Not an approved source assumption. If the owner does not approve it, 5.1 needs a separate concurrency rule before verification. | OPEN | ________ |

Decided under other decisions (not a numeric checklist item):
- R12 (no redirects): decided under OD-7.
- R2 for 4.1 and R1 for 4.2 are listed above.

Rows outside the I3 and I4 scope (not requested here, and no task in I3 or I4 needs them for verification):
- V1 (`repository_id`): decided under OD-6. Used by Tasks 1 (done), 15.2, 17.2.
- V6 (line number rule): a rule, not a numeric value. No approval needed.
- V7 (PR and issue number, no bound): APPROVED (D9). No approval needed.
- V8 (revision rule): APPROVED (DEC-14). No approval needed.
- V9 (`max_results`): Tasks 15.2 and 17.2 only.
- R8 (GitHub requests per investigation, 10): the integration step (Task 8 workflow). No I3 or I4 task requires it. It stays AIP and needs approval before integration is authorized.
- R15 (no overall deadline): APPROVED (C-D3). No approval needed.
- R17 (cache size): Tasks 10.1 and 10.2, held.
- R18 and R19 (registry limits): APPROVED (I1). No approval needed.
- D1 and D2 (display limits): Task 8 workflow only. AIP. Not requested here.

AIP values stay AIP until the owner writes an exact value in the response column above.

### 10.2 Grouped approval section

**Cache group (OD-1 to OD-4).** Decide together.
- OD-1 Git always live; only GitHub records cached before D06: ____
- OD-2 Required reference from unvalidated cache gives `PARTIAL`: ____
- OD-3 `NOT_PERFORMED` cannot support `DOCUMENTED` or `INFERRED`: ____
- OD-4 Fallback after failed live request: `PARTIAL` with `STALE_CACHE_SERVED` plus failure code: ____

**Limits group (OD-5 checklist in 10.1, OD-6).**
- OD-5: complete the checklist in 10.1.
- OD-6 `repository_id` 64 and D02 correction: ____

**GitHub client group (OD-7, OD-8, OD-10, OD-13, OD-14).** Decide together.
- OD-7 Refuse all redirects: ____
- OD-8 Oversize maps to `GITHUB_UNAVAILABLE`, not retryable: ____
- OD-10 Task 9.1 may start before I2 acceptance: ____
- OD-13 Pin `2022-11-28`; live check authorized (yes or no; public repository named): ____
- OD-14 `urllib` under Part 6A; token variable name: ____; P-2 answer (accept per-operation timeout and residual in 6A.4, or the worker-thread alternative in 6A.5): ____; P-3 answer (proxy policy): ____; loopback test authorization (yes or no): ____

**Native Spec group (OD-9, OD-16).** Decide together. File hashes in Part 5.
- OD-9 Header amendments for Tasks 3, 9, 16.1: ____
- OD-16 Native Spec approval for I3 and I4 scope, file by file, with hashes: ____

**Git and symbol group (OD-11, OD-15, OD-18).**
- OD-11 Python `ast` at `HEAD`; Python-only scope; parse-failure outcome `TARGET_PARSE_FAILED` as in Part 6 (approve, or MODIFY): ____
- OD-15 G-1: owner supplies the alternatives; approval recorded only after that: ____
- OD-15 G-2: owner supplies the alternatives; approval recorded only after that: ____
- OD-15 G-3: APPROVE `%at` / REJECT / MODIFY: ____
- OD-18 Git verification in temporary directories, read-only, at implementation time: ____

**Standalone decisions.**
- OD-12 Author = display name, else unavailable: ____
- OD-17 D02 corrections (four defects; F-3 and F-4 status rules): ____
- OD-19 Hypothesis stays uninstalled until separately authorized: ____
- OD-20 Record only; Task 18 outside I3 and I4: ____

### 10.3 Owner inputs that are not decisions

| Input | Maps to | Status |
|---|---|---|
| G-1 original alternatives | OD-15 | NOT in the workspace. Owner must supply. |
| G-2 original alternatives | OD-15 | NOT in the workspace. Owner must supply. |
| G-3 confirmation | OD-15 | Recommendation `%at` only. |
| P-2 timeout reading and residual | OD-14, R10 | Owner choice (Part 6A.4 or 6A.5). |
| P-3 proxy policy | OD-14 | Owner choice. |
| Token variable name | OD-14 | Owner must name it. |
| Live GitHub check authorization and public repository | OD-13 | Not performed. |
| Loopback and test authorization | OD-14, OD-18 | Tests not executed. |
| Symbol scope (Python-only) and parse-failure outcome | OD-11 | Owner to confirm. |
| Native Spec file hashes | OD-16 | Owner to approve the exact files in Part 5. |
| Readiness report Part 1 wording | Correction C4 | Owner to approve. |
| Windows proxy and DNS behavior | Knowledge, not verified | Must be tested on Windows before any claim. |

---

## Part 11. Implementation authorization map (corrected)

Blocker vocabulary:
- NS: Native Spec approval (OD-16, including the Part 5 header changes where listed).
- VER(x): task x is VERIFIED.
- I2: owner acceptance of I2.
- Rows: checklist rows from Part 10.1 that must be approved before verification.
- Other: other decisions.

### 11.1 Task map

| Task | Start blockers | Verification blockers | Status |
|---|---|---|---|
| 2.1 | NS (Requirements 2, 3, 14 included) | None | Executable after NS |
| 2.2 | NS; VER(2.1) | None | Executable after 2.1 verified |
| 2.3 | NS; VER(2.1); VER(2.2) | V2, V3 (length checks only) | Partly blocked |
| 2.4 | VER(2.1); VER(2.2); VER(2.3); security review record | V2, V3 transitively | Dependent. Not independent. |
| 3.1 | NS; OD-9 Task 3 header | R1, R2, R3 | Mechanism may be written after NS; verification blocked |
| 3.2 | VER(3.1); NS | R1, R2, R3 transitively; OD-18 (Git option set verification) | Blocked until 3.1 verified |
| 3.3 | VER(3.1); NS | R1, R2, R3 transitively | Blocked until 3.1 verified |
| 3.4 | VER(3.1); NS | R1, R2, R3 transitively | Blocked until 3.1 verified |
| 4.1 | NS; VER(2) (2.1 to 2.4); VER(3) (3.1 to 3.4); OD-11 | V2, V3, V4, R1, R2; OD-11 parse-failure outcome | Blocked. Inherits all of Task 2 and Task 3. |
| 4.2 | VER(4.1); NS | R1 transitively | Blocked until 4.1 verified |
| 5.1 | VER(3); VER(4); NS; I2; OD-15 (G-1, G-2, G-3 decided) | V2, V4, R1, R2, R4, R5, R6, R7, R16 | Blocked |
| 5.2 | VER(3); VER(4); NS | None direct. I2 needed when wired into results. | Dependent on Tasks 3 and 4 |
| 5.3 | VER(5.1); NS; I2 | None direct | Blocked |
| 5.4 | VER(5.1); NS; I2 | R1, R2 | Blocked |
| 6.1 | VER(5) (all of 5.x per header); VER(3); NS; I2; OD-15 | V2, V5, R1, R2; OD-18 (SHA-256 check) | Blocked. Inherits Tasks 3, 4, 5. |
| 6.2 | VER(5) (per header); NS | None direct | Dependent on Task 5 |
| 6.3 | VER(6.1); NS; I2 | None direct | Blocked |
| 9.1 | NS; OD-9 Task 9 header; OD-7, OD-8, OD-10, OD-13, OD-14 decided | R9, R10 (not enforced under 6A; see row R10), R11, R13, R14 | Start after decisions. Verification blocked. |
| 9.2 | VER(9.1); NS; I2; OD-12; OD-13 | None direct; transitively 9.1 rows | Blocked |
| 9.3 | VER(9.1); NS; B12 (code list approval) | R13, R14 | Blocked |

### 11.2 Groups (corrected)

The groups below follow the task graph. Group C inherits all of Task 3 and Task 2. The earlier grouping, which listed 4.1 and 4.2 as independently executable, is withdrawn.

- **Group A1 (I3 foundation, no values):** 2.1, 2.2. Needs NS only.
- **Group A2 (I3 runner):** 3.1 (mechanism, then verification), then 3.2, 3.3, 3.4. Needs NS and OD-9. Verification needs R1, R2, R3 approved. 3.2 also needs OD-18. 3.2 to 3.4 start only after 3.1 is VERIFIED.
- **Group C (I3 target resolution):** 2.3 (length checks need V2, V3), 2.4 (after 2.3), 4.1, 4.2. Needs everything in Group A1 and Group A2 to be VERIFIED first, plus V2 to V4, R1, R2, and OD-11. Group C cannot start until Group A2 is VERIFIED.
- **Group D (I3 history and blame):** 5.1 to 5.4 and 6.1 to 6.3. Needs Group C VERIFIED, I2 acceptance, OD-15 (G-1 and G-2 supplied by the owner, G-3 decided), and the rows listed in 11.1. 6.2 needs all of Task 5 VERIFIED per the Task 6 header.
- **Group B (I4 retrieval):** 9.1 only. Needs NS, OD-9 (Task 9), OD-7, OD-8, OD-10, OD-13, OD-14, and the 9.1 rows. Independent of Groups A, C, and D.
- **Group E (I4 evidence):** 9.2, 9.3. Needs Group B VERIFIED, I2 acceptance, OD-12, OD-13, and B12.

### 11.3 Concurrency

- Group A1 and Group B can be authorized concurrently. They share only NS.
- Group A2 and Group B can run concurrently after NS. Their verification rows are separate (R1 to R3 for Group A2, R9 to R14 for Group B).
- Group C and Group D are sequential after Group A2. They are not independent of I3 foundation.
- Group E is sequential after Group B and needs I2 acceptance.
- Task 8, Tasks 10.x, 15.2, 16.2, 17.2, and 18 are outside this map.
- No I3 task depends on any I4 task, and no I4 task depends on any I3 task.

I3 and I4 can be authorized in separate groups. Authorizing them together does not require the owner to order them. I2 acceptance gates Group D and Group E. NS gates all groups.

---

## Part 12. Findings beyond OD-1 to OD-20

| Finding | Maps to | Summary |
|---|---|---|
| F-1 | OD-16 | Requirements 2, 3, 14 unapproved. |
| F-2 | OD-6 | Registry 64 vs D02 128. |
| F-3 | OD-17 | D02 §16.7 vs Spec 1 §10.2 on result limit. |
| F-4 | OD-17 | D02 §16.7 GitHub rows: scope for investigation references. |
| F-5 | Owner note | No digit bound on PR and issue numbers. Accepted under D9. |
| F-6 | OD-4, OD-17 | D02 cache-age wording vs D6. |
| F-7 | OD-19 | Hypothesis approved for dev and test only. Not installed. |
| F-8 | Part 6A | Earlier overshoot claim withdrawn. Residual stated. |

---

## Part 13. Gaps in the source material

- G-1 and G-2 original alternatives: not in the workspace. Confirmed by the workspace search (whole workspace) and a read of the owner decision record section that covers G-1 to G-4 (`.kiro/reports/phase-status.md` §19). No approval can be recorded for them until the owner supplies the alternatives.
- G-3: recommendation only.
- GitHub `merged` field and `merge_commit_sha` under `2022-11-28`: not live-verified.
- GitHub user object fields (`login`, `name`): not verified against a live response.
- Windows proxy behavior and DNS timeout behavior: not verified.
- Spec 1 v2.4 traceability gaps (D04, D05, D06, D08 phases; FR-10 wording) remain open.
- `.kiro/specs/.gitkeep` is deleted, unresolved, and unattributed. Not restored, staged, or attributed by this package.
- Requirement 22 does not cover all Spec 1 §19 Golden categories (OD-20).

---

## Part 14. Files

- Created earlier: `docs/development/i3-i4-owner-decision-package.md` (this file). Revised in the final closure pass.
- Modified earlier: `.kiro/reports/phase-status.md` (section 22).
- Modified in the final closure pass: `docs/development/i3-i4-readiness-closure-report.md` (corrections listed in its revision note).
- Not modified: approved specs, Architecture, Playbook, Operating Guide, D01, D02, D03, native Spec files, task checkboxes, dependencies, `.kiro/settings/mcp.json`, implementation code.
- Not staged or committed.

I2 remains NOT ACCEPTED. I3 and I4 remain NOT AUTHORIZED. The package waits for the owner reply in Part 10.

---

## Part 15. Owner decision record (recorded 2026-11-10)

Recorded from the owner's explicit reply. The owner stated that the earlier "yes" is not approval of all proposed technical decisions. Only the decisions below are recorded as approved.

### 15.1 OD-16: APPROVED

The owner approves the exact Native Spec baseline identified by these SHA-256 hashes (verified again at recording time, all three matched):

| File | SHA-256 |
|---|---|
| `.kiro/specs/evidence-retrieval/requirements.md` | `51123AEA8E150B30A1CD2F25DD344D96F8812B99CA7B8AB67BFC7AD253161AB7` |
| `.kiro/specs/evidence-retrieval/design.md` | `EBDB3BFDC9A11F079C4E7AE613F60F97D3CC42AF4DB9E73622099E5826CAF3E3` |
| `.kiro/specs/evidence-retrieval/tasks.md` | `B286FD21ECF90C1291ED8F1BF02FE4B5708B943B5569512FB26B233561B99FB8` |

Scope: Requirements 2, 3, and 14 and the corresponding design baseline.

Not approved by this record: the proposed Task 3 and Task 9 header amendments (OD-9). The `tasks.md` file at the hash above still carries the original headers. Do not treat the amended text in Part 5 as part of the baseline.

### 15.2 Group A1: AUTHORIZED

The owner authorizes implementation and verification of Tasks 2.1 and 2.2 only.

Not started and not authorized by this record: Group A2 (Tasks 3.1 to 3.4) and Group B (Task 9.1).

### 15.3 Decisions that remain OPEN

OD-5 (limit values, including the R1 to R3 and R9 to R14 rows), OD-9 (header amendments), OD-13 (API version pin and live check), OD-14 (HTTP transport contract, token variable, proxy policy), and OD-18 (Git verification authorization) remain OPEN. No proposed value or policy in this package is approved by implication.

Also OPEN: OD-1 to OD-4, OD-6 to OD-8, OD-10 to OD-12, OD-15 (G-1 and G-2 original alternatives are not available; G-3 is a recommendation), OD-17, OD-19, and OD-20.

### 15.4 Status of other items

- I2: NOT ACCEPTED.
- I3 and I4: NOT AUTHORIZED beyond the authorizations in 15.2.

## Part 16. Owner responses recorded (2026-11-12)

Recorded from the owner's written instruction "Phase 3 — Final Owner Decisions, Remediation, Acceptance, and Closure" (2026-11-12). Full record: `.kiro/reports/phase-status.md` section 42 and `docs/development/phase-3-closure-report.md` section 18. Earlier parts are kept unchanged as history. Where this part and an earlier part differ, this part states the current decision.

| Item | Owner response (2026-11-12) |
|---|---|
| OD-5 (limits) | APPROVED for R1, R2, R3, R4, R9, R11, R13, R14, R16, V1 to V9, and the Git lifecycle constants (reader join 5 s, child wait 10 s). R18 and R19 remain APPROVED (I1). Deferred: R5 to R8, R10 (accepted residual), R17, D1, D2 |
| OD-7 (redirects) | APPROVED as recommended. 3xx is `GITHUB_UNAVAILABLE`, `retryable: false`. Renamed repository: `PARTIAL` for investigation, `FAILED` for single record |
| OD-8 (oversize response) | APPROVED as recommended. Body over 1 MiB is `GITHUB_UNAVAILABLE`, `retryable: false`. Verified by tests |
| OD-14 (token variable) | APPROVED: `SEAN_GITHUB_TOKEN` |
| Result-limit semantics | APPROVED. `RESULT_LIMIT_REACHED` (scope `results`) when matching evidence exists beyond `max_results`. Status and classification unchanged. Implemented in `mcp/tools.py` |
| Task 8 | Authorized under the I5/I6 implementation directives (phase-status sections 28 and 30). B-4 is superseded for implementation purposes |
| I2 | ACCEPTED |
| I3 | ACCEPTED |
| I4 | ACCEPTED, conditional on the OD-8 `retryable` verification and the OD-7 and OD-14 records (both satisfied) |
| I5 | ACCEPTED |
| I6 | ACCEPTED, after the result-limit remediation was verified |
| Phase 3 | CLOSED |
| Phase 4 | READY TO START. Not active |

### Part 16.1. R14 clarification (2026-11-12)

Owner decision (approved for the MVP): once GitHub rate limiting is detected, the client stops making further requests for the lifetime of that client instance. Automatic resumption based on the provider's reset header is not required.

What this means in the implementation:
- Rate limiting is detected by HTTP 429, by a 403 with `X-RateLimit-Remaining: 0`, or by a successful response with `X-RateLimit-Remaining: 0`.
- The client instance then makes no further network request. Later calls on that instance raise `GITHUB_RATE_LIMITED` without a request.
- The `X-RateLimit-Reset` header is not parsed. The client does not wait for a reset and does not resume automatically.
- A new client instance is not affected by an earlier instance's rate limit. The MCP `get_pr` and `get_issue` tools create a new client for each call (`backend/app/modules/mcp/tools.py`, `_github_record`), so a block applies to that call only. Investigations do not call GitHub yet (association is deferred).
- Ordinary `GITHUB_UNAVAILABLE` failures (network, timeout, server error) do not set the rate-limit state and remain retryable.

Limitation accepted for the MVP: an investigation that is rate-limited is not retried later. Its result reports the limitation.

This clarification supersedes the wording "stop until reported reset" in the R14 row of Part 10.1 and "No request while reported limit is exhausted" in Part 3. Those rows are kept as history. Live provider header semantics remain unverified beyond one read-only request.
