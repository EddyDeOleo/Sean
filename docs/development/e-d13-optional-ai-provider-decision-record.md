# Sean — E-D13 Optional AI Provider Decision Record

**Gate:** E-D13 (`.kiro/specs/evidence-retrieval/design.md`, Open decisions table, line 567: "Optional AI provider." Sources: Requirement 11, Spec 1 §11.2 and §24).
**Related native task:** Task 14 "Optional AI wording" (`.kiro/specs/evidence-retrieval/tasks.md`, lines 207 to 211). Subtask 14.1 is a provider-approval gate. Subtask 14.2 is the implementation.
**Record date:** 2026-11-10. Last update: owner decisions AI-2 and AI-4 recorded (section 0).
**Method:** Review of approved sources and the implementation as recorded in phase-status §29 to §35. Public documentation from Google was read with the web tools. No Gemini API call was made. No dependency was installed. No source code, test, configuration, or approved document was changed.

## Status

| Item | Status |
|---|---|
| E-D13 overall | **OPEN.** AI-2 (provider) and AI-4 (model) are APPROVED. AI-3 (privacy and data use) and all other items remain OPEN, PROPOSED, or BLOCKED. |
| Provider | **APPROVED (AI-2).** Google Gemini API, Free Tier. Owner decision, 2026-11-10 (section 0). |
| Model | **APPROVED (AI-4).** `gemini-3.6-flash`. Owner decision, 2026-11-10. Pre-implementation verification still required (section 5). |
| Privacy and data use | **OPEN (AI-3).** Restrictions in force (section 0). |
| Gemini implementation | **BLOCKED.** See section 6. Implementation is not authorized. |
| Native Task 14 (optional AI wording) | **BLOCKED.** Unchanged. No subtask is started, and no checkbox changed. |
| Deterministic explanation (`explanation/templates.py`) | Implemented and unit-verified. It is the mandatory path and is not affected by this record. |
| I5 | Partially implemented. **Not accepted.** |
| I6 | Partially implemented. **Not accepted.** |
| Gemini API calls | **None made.** |

Status vocabulary used in this record:

- **APPROVED:** the owner approved the exact value or rule, and the approval is recorded with a reference.
- **PROPOSED:** a direction for owner review. It has no approval.
- **OPEN:** no decision yet.
- **BLOCKED:** work cannot start until the listed conditions are met.

A proposal in this record is not an approval. Only an explicit owner approval changes a status to APPROVED.

## 0. Owner decisions recorded 2026-11-10

These are owner decisions. They were given in an explicit owner instruction, not inferred from a proposal.

**AI-2, Provider: APPROVED.** Google Gemini API is the selected optional AI provider. The basis is the owner's prior practical testing of Gemini. This record does not verify that testing. The approval covers provider selection only. It does not approve implementation, the data sent, the client, the key name, or the configuration.

**Usage tier: Free Tier.** Google's terms call this tier "Unpaid Services." The category covers services offered free of charge, including the unpaid quota in the Gemini API ([Google AI Studio terms, "Unpaid Services"](https://aistudio.google.com/docs/terms), fetched 2026-11-10). No paid plan, billing account, or billing authorization is approved. No automatic fallback to a paid tier is permitted.

**AI-4, Model: APPROVED: `gemini-3.6-flash`.**
- Verified against Google's model page on 2026-11-10 ([Gemini 3.6 Flash](https://aistudio.google.com/docs/models/gemini-3.6-flash), selective fetch). The page lists the model code as `gemini-3.6-flash`, marks the version as stable, and describes the model as a previous-generation Flash model that remains available for production use.
- The same page names `gemini-3.8-flash` as Google's newer Flash model. `gemini-3.8-flash` is **not** approved, and no substitution is permitted.
- **Excluded:** `gemini-3.5-flash`, because it is deprecated and routed to `gemini-3.6-flash` ([Gemini 3.5 Flash page](https://aistudio.google.com/docs/models/gemini-3.5-flash), fetched 2026-11-10).
- **Before implementation,** the owner-approved model must still be verified for: the exact API model identifier, current availability, lifecycle status, and Free Tier eligibility. The model page read on 2026-11-10 does not state Free Tier eligibility for this model. Its pricing section was not read.
- **If any check fails, or the status has changed,** stop and request owner direction. Do not select a replacement independently.

**AI-3, Privacy and data use: remains OPEN.** Selecting the Free Tier is not approval to send confidential repository content. The following restrictions apply:

- Do not send source code, diffs, file excerpts, commit messages, private repository metadata, credentials, or other confidential information.
- Only minimal, structured, non-sensitive, appropriately anonymized information may be considered.
- Anonymization does not by itself guarantee privacy.
- Any expansion of the permitted data categories requires a separate owner decision.

**Free Tier data-use terms, as documented by Google (2026-11-10):** under Unpaid Services, Google uses submitted content and generated responses to provide, improve, and develop products and machine-learning technologies. Human reviewers may read, annotate, and process input and output. Google states that it disconnects this data from the user's account, API key, and Cloud project before reviewers see it. Google advises not to submit sensitive, confidential, or personal information to unpaid services. The clause that the EEA, Swiss, and UK paid-service data terms apply to all services, including unpaid ones, is recorded in section 3.

**Not changed by this record:**
- AI-1, AI-5, AI-6, AI-8 to AI-15: status unchanged (PROPOSED).
- AI-7: BLOCKED (Task 16.1).
- Task 14: BLOCKED.
- I5 and I6: not accepted.
- No approval of any other decision is implied.

**Contradictions and open references (recorded, not resolved):**

- **C1, AI-10 versus AI-3.** AI-10 (PROPOSED) would send "verified structured fields." Those fields may include commit hashes, file paths, author names, and dates. AI-3 excludes private repository metadata. AI-10 must be revised before any use. This record does not revise it.
- **C2, design text versus this record.** `design.md` line 567 (E-D13) and line 130 ("Optional AI is not designed yet. No provider is selected") still state that no provider is chosen. This record now records AI-2 as approved. Amendments A1 and A2 are not authorized, and neither was made.
- **C3, Free Tier eligibility.** The model page read does not establish whether `gemini-3.6-flash` is available on the Free Tier. This must be verified before implementation.
- **C4, owner testing.** The owner's prior testing is recorded as the owner's statement. This record does not verify it.
- **C5, usefulness under AI-3.** The owner should confirm whether any content Sean would send, after applying AI-3, still gives a useful explanation. This record does not resolve that question.

## 1. Governing principles

These principles are already approved requirements. This record restates them and changes none of them.

1. The deterministic explanation is mandatory and works without any AI provider (Spec 1 §11.1; Requirement 11; Playbook §6).
2. AI is optional. It may improve wording only (Spec 1 §11.2; Requirement 11.1).
3. AI must not create, modify, or fabricate evidence. It must not change classification, retrieval status, or the conclusion. It must not invent identifiers, commit details, dates, people, URLs, or causal claims. It must not remove limitations (Spec 1 §11.2; Requirement 11.2).
4. Insufficient evidence produces abstention regardless of provider availability (Spec 1 §11.3).
5. A provider failure never turns a successful investigation into a failed one. The absence of AI is never reported as a retrieval failure (Spec 1 §11.3; Requirement 11.4).
6. Sean works with no AI key, no network connection, and no provider. Core retrieval needs no AI configuration or credentials (Spec 1 §11.1, §22, §23.10; native `requirements.md`, configuration requirement, criterion 2).
7. No paid external service is a mandatory runtime dependency (Architecture §2.1; Operating Guide §9; Playbook §6).
8. AI-generated text is never stronger evidence than its sources (Architecture §3).
9. No Gemini request is made when evidence is insufficient or retrieval has failed (owner instruction, 2026-11-10; Spec 1 §11.3).
10. No paid API usage, billing activation, or automatic paid-tier fallback is permitted (owner instruction, 2026-11-10; Architecture §2.1).

## 2. Decision matrix

Status and approval reference show what is actually recorded. Rows AI-2 and AI-4 carry the owner decisions in section 0.

| ID | Decision | Direction | Status | Approval reference | Gate before approval or implementation |
|---|---|---|---|---|---|
| AI-1 | Timing | Defer Gemini implementation until I5 and I6 are accepted | **PROPOSED** | None | I5 and I6 acceptance (owner). Not yet met: both are partial and not accepted (phase-status §30 to §32). |
| AI-2 | Provider | Google Gemini API as the optional provider, Free Tier | **APPROVED** | Owner decision, 2026-11-10 (section 0) | Approval covers provider selection only. Implementation remains blocked (section 6). |
| AI-3 | Account tier and data use | Free Tier selected. Confidential repository content is not to be sent. Permitted data is limited to minimal, structured, non-sensitive, appropriately anonymized information | **OPEN. PRIVACY GATE** | None | Section 3 prerequisites P1 to P3. Any expansion of permitted data needs a separate owner decision. Until the gate is closed, the provider stays disabled. |
| AI-4 | Model | `gemini-3.6-flash` | **APPROVED** | Owner decision, 2026-11-10 (section 0) | Pre-implementation verification of the exact API identifier, availability, lifecycle, and Free Tier eligibility (section 5). `gemini-3.5-flash` is excluded. |
| AI-5 | Client | Prefer direct HTTPS with Python standard-library `urllib`. Avoid a new SDK dependency unless a concrete requirement justifies it | **PROPOSED** | None | Architecture §19 (documented reason, license, maintenance, security, Windows, transitive impact). The GitHub client already uses this pattern (`backend/app/modules/github/client.py`, `_build_opener`). D01 must be amended if an SDK is chosen. |
| AI-6 | API key | Environment variable `SEAN_GEMINI_API_KEY` | **PROPOSED** | None | E-D15 currently covers only the GitHub token and the data location (design.md line 570). Adding an AI key needs an E-D15 amendment. |
| AI-7 | Configuration | Reuse the approved configuration approach once Task 16.1 is resolved. Do not invent a second configuration system | **BLOCKED** | None | Task 16.1 is blocked by O-G1 and OD-5 (tasks.md line 218). No configuration loader exists. |
| AI-8 | Output contract | Preserve the C.4 response contract. AI may replace only the explanation body, and only after validation | **PROPOSED** | None | Changing the C.4 shape requires a separate amendment. The shape is part of the canonical contract (native `design.md`, C.4; C-D1 and C-D4 are closed owner decisions). |
| AI-9 | Validation | Reject the entire AI response if it adds unsupported facts, identifiers, or causal claims, or removes limitations | **PROPOSED** | None | Owner approval of the exact rules and the causal-phrase list. |
| AI-10 | Data sent | Initially, verified structured fields only. No source code, diffs, raw excerpts, or commit messages | **PROPOSED. REVISION REQUIRED (C1).** | None | Must be reconciled with AI-3, which excludes private repository metadata. The field list needs owner approval. |
| AI-11 | Failure handling | One request, no automatic retry. On any provider failure, keep the deterministic wording | **PROPOSED** | None | Timeout values come from configuration (E-D14, OD-5). They are not approved. |
| AI-12 | Diagnostics | Record only operational metadata: provider status category and latency. Never log prompts, responses, keys, or private repository content | **PROPOSED** | None | Spec 1 §20; Architecture §18 (no secrets, tokens, or unnecessary repository content in logs). |
| AI-13 | MCP | Keep AI-generated wording out of MCP tools initially | **PROPOSED** | None | Requirement 13.6 (MCP output carries no conclusion or explanation). D02 §16.5 and §16.8. |
| AI-14 | UI | Add no AI label or UI behavior until a concrete requirement exists | **PROPOSED** | None | Spec 2 §2.1 forbids added facts. No labelling requirement exists. |
| AI-15 | Live verification | Each real Gemini call needs separate explicit owner authorization. Use synthetic or public data only | **PROPOSED** | None | Playbook §3; Architecture §18. Tests use fakes and no network. |

## 3. Privacy and external-service prerequisites

These prerequisites govern AI-3 and any remote use. AI-3 is OPEN, so the provider stays disabled until the gate is closed with recorded evidence.

| ID | Prerequisite | Status on 2026-11-10 | Evidence and gap |
|---|---|---|---|
| P1 | Current Google terms for the exact account tier are verified | **PARTIALLY VERIFIED** | Unpaid-service terms read from [Google AI Studio terms, "Unpaid Services"](https://aistudio.google.com/docs/terms), fetched 2026-11-10. The paid-service clause was truncated in the retrieved text. The full clause must be read before it is relied on. |
| P2 | Retention, use, and human review are verified for that tier | **PARTIALLY VERIFIED** | Same source. Under unpaid services, Google may use submitted content and responses to improve products. Human reviewers may read, annotate, and process input and output. The source also advises against submitting sensitive, confidential, or personal information to unpaid services. The same page says that for users in the EEA, Switzerland, or the UK, the paid-service data terms apply to all services, including unpaid ones. The grounding data-retention clause does not apply, because Sean does not use grounding with Google Search. |
| P3 | Private repository content is not sent under terms that allow product improvement or human review | **REQUIRED. NOT MET.** | The Free Tier, which the owner selected, falls under those terms. The constraint is not satisfied by any setting Sean controls. Under AI-3, confidential content is excluded. |
| P4 | The paid tier's data terms are judged suitable for private content | **NOT APPLICABLE TO THE SELECTED TIER. Not met if the tier changes.** | The owner selected the Free Tier, and no paid plan is authorized. This prerequisite becomes relevant again only if a paid tier is proposed. The paid tier needs an active billing account, and its data-use clause is incomplete in this record (P1). |
| P5 | Official source references and verification dates are recorded | **MET for this record only** | Sources and dates are in section 9. Any approval must re-verify them on the approval date. |
| P6 | Current model availability and lifecycle on the approval date | **PARTIALLY MET.** | `gemini-3.6-flash` was checked on 2026-11-10 (section 5). Re-verification is required before implementation. |
| P7 | Cost and billing terms verified | **NOT APPLICABLE TO THE SELECTED TIER.** Free-tier quotas and limits must still be verified. | A billing-page search snippet says moving to the paid tier requires a billing account and a prepayment of at least $5 in credit ([Gemini API billing](https://ai.google.dev/gemini-api/docs/billing), search snippet, not fully read). The owner has not authorized billing. Free-tier quotas and limits change and must be verified on the approval date. |

**The Free Tier selection does not resolve AI-3.** The owner's selection of the Free Tier concerns the tier. It does not authorize sending any content that AI-3 excludes. If P1 to P3 cannot be closed, AI-3 stays OPEN and the provider stays disabled.

## 4. Proposed minimal architecture

This is a proposed design. It is not approved, and nothing is implemented.

```text
investigate()
    |
    +--> deterministic explain()
    |       +--> authoritative conclusion
    |       +--> evidence classification
    |       +--> limitations and abstention
    |
    +--> optional Gemini wording improvement
    |       +--> only if explicitly enabled (AI-7, blocked)
    |       +--> only if the key is configured (AI-6)
    |       +--> only if evidence is sufficient and retrieval did not fail
    |       +--> verified structured fields only (AI-10, revision required)
    |       +--> one HTTPS request, no retry (AI-11)
    |       +--> strict output validation (AI-9)
    |       +--> reject invalid or unsupported output
    |
    +--> final explanation
            +--> validated AI wording, if accepted
            +--> otherwise deterministic wording
```

**Failure behavior (proposed; Spec 1 §11.3 and Requirement 11.3 apply):**

| Case | Behavior | Evidence and classification |
|---|---|---|
| Provider not configured or disabled | No network call. Deterministic wording | Unchanged |
| Timeout or provider unavailable | Deterministic wording. Diagnostic records the category only | Unchanged. Not a retrieval failure |
| Rate limit | No retry. Deterministic wording | Unchanged |
| Malformed or unparseable response | Deterministic wording | Unchanged |
| Output adds unsupported content | Reject the whole output. Deterministic wording | Unchanged |
| Insufficient evidence | AI is not called | Abstention preserved |
| FAILED retrieval | AI is not called. No explanation | Unchanged |

**Constraints (proposed):**

- No provider abstraction, factory, manager, or wrapper without a demonstrated requirement (Architecture §2.7, §7).
- No new service, database, or cache.
- No required SDK dependency.
- No network call when AI is disabled or the key is absent.
- No automatic retry.
- No change to the deterministic conclusion or classification.
- No change to the MCP contract.
- No change to the C.4 response shape without a separately approved amendment.

## 5. Model and dependency selection

**Approved model (AI-4):** `gemini-3.6-flash`. The owner approved it on 2026-11-10.

**Excluded:** `gemini-3.5-flash` is deprecated and routed to `gemini-3.6-flash` ([source](https://aistudio.google.com/docs/models/gemini-3.5-flash), fetched 2026-11-10). It must not be selected.

**Not approved:** `gemini-3.8-flash`, which the 3.6 page names as newer. Using it requires a separate owner decision. No model other than `gemini-3.6-flash` is approved.

**Verification required before implementation:**

1. The exact API model identifier, confirmed against Google's current official model documentation on the implementation date.
2. Current availability and lifecycle status. The 3.6 page read on 2026-11-10 marks the model stable.
3. Free Tier eligibility for this model. The page read does not state it, and its pricing section was not read.
4. The supported API operations.
5. The verification date and source, recorded in this section.

**If any check fails, or the status has changed,** stop and request owner direction. Do not select a replacement independently.

**Client (AI-5, proposed):** reassess direct HTTPS against the official SDK at implementation time. One search snippet says Gemini 3 features require the Gen AI SDK for Python 1.51.0 or later ([Vertex AI Gemini 3 guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3), search snippet, not verified in full). That note concerns the Vertex AI documentation and must be checked for the Gemini Developer API before it is relied on. If a dependency is proposed, follow D01 and the rules in Architecture §19 and Operating Guide §9.

## 6. Implementation authorization boundary

Gemini implementation stays **BLOCKED** until all of these conditions are met:

1. I5 is accepted by the owner. **Not met.**
2. I6 is accepted by the owner. **Not met.**
3. The provider decision (AI-2) is approved. **MET, 2026-11-10.**
4. The privacy gate (AI-3, prerequisites P1 to P3) is closed with recorded evidence. **Not met.**
5. The exact model ID (AI-4) is approved. **MET, 2026-11-10 (`gemini-3.6-flash`).** Verification on the implementation date is still required (section 5). **Not yet met.**
6. The API-key name (AI-6) and the configuration mechanism (AI-7) are approved. **Not met.**
7. The output contract (AI-8) and the validation rules (AI-9) are approved. **Not met.**
8. The dependency and security reviews are complete (Architecture §19; Playbook §8; Operating Guide §9). **Not met.**
9. Every required document amendment has owner approval (section 8). **Not met.**

Live verification (AI-15) needs a separate explicit owner authorization. It is not covered by the approval of implementation.

This record does not authorize Task 14. Task 14 remains blocked (tasks.md, Task 14 header and subtask 14.1).

## 7. Traceability

| Item | Location | Current state | Change needed |
|---|---|---|---|
| Requirement 11 (optional AI) | `.kiro/specs/evidence-retrieval/requirements.md`, lines 147 to 157 | Approved baseline (OD-16 hash) | None |
| Spec 1 §11 (no-AI and optional AI) | `docs/specs/spec-1-evidence-retrieval.md`, §11.1 to §11.3 | Approved | None |
| Spec 1 §15 (free or local provider may be evaluated) | Same file, §15 | Approved | None. AI-2 is an owner decision on the provider. It does not amend §15 |
| Spec 1 §22 (configuration includes optional AI) | Same file, §22 | Approved | None |
| Spec 1 §24 (provider deliberately not fixed) | Same file, §24 | Approved | None. The owner's approval of AI-2 is recorded in this decision record, not in Spec 1 |
| Architecture §2.1, §2.6, §2.7, §7, §18, §19 | `docs/architecture/architecture-and-project-setup.md` | Approved | None |
| Operating Guide §9 | `docs/development/kiro-operating-guide.md`, lines 386 to 405 | Approved | None |
| Playbook §3, §6, §8 | `docs/development/kiro-engineering-playbook.md` | Approved | None |
| E-D13 row | `.kiro/specs/evidence-retrieval/design.md`, line 567 | OPEN in the design. AI-2 approved in this record (contradiction C2) | Close after the amendment is authorized (A2 in section 8) |
| Explanation design bullet | Same file, line 130 | States that no provider is selected (contradiction C2) | Amend after the amendment is authorized (A1 in section 8) |
| E-D15 (environment names) | Same file, line 570 | Covers the GitHub token and the data location | Amend if AI-6 is approved (A3 in section 8) |
| Task 14 | `.kiro/specs/evidence-retrieval/tasks.md`, lines 207 to 211 | BLOCKED | None now |
| Task 16.1 (configuration) | Same file, line 218 | BLOCKED (O-G1, OD-5) | None now |
| I5 Task 14 entry | `docs/development/i5-i6-backend-implementation-plan.md`, §4.1, line 155 | "Optional for MVP." Planning artifact | None now |
| Phase-status §30 Gemini premise | `.kiro/reports/phase-status.md`, §30 | Recorded as unsupported. Accurate. The owner's later decision in section 0 of this record is a new owner decision, not a correction of §30 | None. Cross-referenced in phase-status §34 and §35 |

The project's five phases and the I0 to I6 increment structure are unchanged. No I7 is created. Phase 3 remains in progress.

## 8. Document amendments required (not made)

No amendment was made by this record. Each needs owner authorization.

| ID | Document and location | Reason | Trigger |
|---|---|---|---|
| A1 | `design.md`, "Explanation design", line 130 | It says no provider is selected. A design section must follow the provider decision | AI-2 approved (done). AI-8 approved. Amendment not yet authorized |
| A2 | `design.md`, E-D13 row, line 567 | Close the open item | AI-2 approved (done). Amendment not yet authorized |
| A3 | `design.md`, E-D15 row, line 570 | Add the AI key name to the environment-variable decision | AI-6 approved |
| A4 | `docs/development/d01-dependency-decision-record.md` | Record any new dependency and its review | AI-5 chooses an SDK |
| A5 | `design.md`, C.4 contract | Only if AI-8 changes the response shape | AI-8 changed. Currently not proposed |
| A6 | `tasks.md`, Task 14 wording | Only if the subtask scope changes | Owner decision on scope |

The approved baselines are protected. The native Spec files are at OD-16 baseline hashes. Any change needs owner approval and a new baseline.

## 9. Sources and verification

Verification date for all external sources: **2026-11-10.**

| Source | Used for | Verification level |
|---|---|---|
| [Google AI Studio Additional Terms, "Unpaid Services" and "Paid Services"](https://aistudio.google.com/docs/terms) (reached through the redirect from ai.google.dev/gemini-api/terms) | Unpaid-service data use and human review; the advice against sending confidential data; EEA, Swiss, and UK rule | Read in part. The paid-service data clause was truncated. Must be read in full before use |
| [Gemini 3.6 Flash model page](https://aistudio.google.com/docs/models/gemini-3.6-flash) | Model code `gemini-3.6-flash`; stable; newer `gemini-3.8-flash` named | Read in part (selective fetch). Free Tier eligibility and pricing not read. Must be re-verified on the implementation date |
| [Gemini 3.5 Flash model page](https://aistudio.google.com/docs/models/gemini-3.5-flash) (reached through the redirect from ai.google.dev) | Deprecation and routing to `gemini-3.6-flash` | Read in part (selective fetch). Used to exclude `gemini-3.5-flash` |
| [Gemini API billing](https://ai.google.dev/gemini-api/docs/billing) | Billing account and prepayment requirement for the paid tier | Search snippet only. Not read in full |
| [Vertex AI, Gemini 3 guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/get-started-with-gemini-3) | Gen AI SDK version note | Search snippet only. Vertex AI documentation, not the Gemini Developer API |

Provider terms, prices, quotas, and model lifecycles change. Each approval must re-verify them on the approval date and record the new date and source.

## 10. Owner decisions still required

Items 2 and 4 were approved on 2026-11-10 (section 0). The remaining items are not approved.

1. **AI-1:** Defer Gemini implementation until I5 and I6 are accepted, or authorize earlier work. Recommendation in the proposal: defer.
2. **AI-2:** **APPROVED 2026-11-10** (Gemini API, Free Tier, provider selection only).
3. **AI-3:** Close the privacy gate, or confirm the permitted data categories. Resolve contradiction C1 with AI-10. Confirm whether any content still useful to Sean remains permitted (C5).
4. **AI-4:** **APPROVED 2026-11-10** (`gemini-3.6-flash`). Verify the identifier, availability, lifecycle, and Free Tier eligibility before implementation (section 5). Stop and request direction if any check fails.
5. **AI-5:** Choose direct HTTPS or an SDK. An SDK needs a dependency record under D01.
6. **AI-6:** Approve the API-key variable name. The proposed name is `SEAN_GEMINI_API_KEY`.
7. **AI-7:** Approve the configuration mechanism. This is blocked until Task 16.1 is resolved.
8. **AI-8:** Approve the output contract, including whether the C.4 shape is unchanged.
9. **AI-9:** Approve the validation rules and the causal-phrase list.
10. **AI-10:** Approve the exact field list sent to the provider. Revise it so it complies with AI-3 (C1).
11. **AI-11:** Approve the timeout, retry, and rate-limit values.
12. **AI-12, AI-13, AI-14:** Approve the diagnostics rule, the MCP exclusion, and the UI rule.
13. **AI-15:** Approve the authorization boundary for any live call.
14. **Section 8:** Authorize any document amendment needed (A1 to A6), including the amendments that resolve contradiction C2.
15. **Section 6:** Confirm the implementation authorization conditions.

**Before Task 14 can start,** items 3, 5 to 11, 14, and 15 must be decided, item 1 must be decided, and every section 6 condition must be met. Task 14 remains blocked until then.


## 9. Status amendment, 2026-11-10: Gemini deferred by owner decision

This amendment is appended. Sections 0 to 8 are unchanged, and the owner decisions AI-2 and AI-4 in section 0 remain in force.

**Owner decision (recorded from the owner's execution instruction of 2026-11-10):**

- **Gemini is deferred. The deterministic explanation engine is the only active explanation engine for the MVP.**
- Task 14 (optional AI wording) is **DEFERRED**.
- No Gemini API client, SDK, prompt, configuration, or environment variable is required for current MVP completion.
- No private repository content may be sent to Gemini Free Tier under any circumstances.
- Reconsideration requires a demonstrably useful privacy-compliant payload, approved payload and validation rules (AI-9, AI-10), and a separate owner authorization.
- Any live Gemini API test requires separate explicit owner authorization.

**Status after this amendment:**

| Item | Status |
|---|---|
| AI-2 (Google Gemini API) | APPROVED. Preserved. |
| AI-4 (`gemini-3.6-flash`) | APPROVED. Preserved. |
| AI-3 (privacy and data use) | OPEN. Unchanged. |
| AI-1, AI-5 to AI-15 | Unchanged from section 2. |
| Gemini implementation | DEFERRED (owner decision, 2026-11-10). Not authorized. |
| Task 14 | DEFERRED (owner decision, 2026-11-10). Checkbox unchanged (`[ ]`). |

**Documents amended under this owner instruction** (these were the outdated statements listed in the E-D13 addendum, section 5):

- `design.md`, Explanation design, second bullet (previously "Optional AI is not designed yet…" and a citation to "Architecture §5"). Now states the deferral and cites Architecture §2.7 and §7.
- `design.md`, E-D13 row in the open-decisions table. Now records the deferral and the open items for reconsideration.
- `tasks.md`, Task 14 header and subtask 14.1. Now records the deferral. Checkboxes unchanged.

These are edits to approved baselines (OD-16 hashes). The baseline hashes no longer match the OD-16 approval record. The owner must review and re-approve the amended files. This amendment does not claim that approval.

**Not changed:** `tasks.md` line 7 ("NOT APPROVED. No task may start."). It conflicts with the OD-16 approval of the file hash (phase-status §23). This conflict is recorded in phase-status §37 as an owner decision, not resolved here.
