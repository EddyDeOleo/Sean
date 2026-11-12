# Sean — E-D13 Addendum: Privacy Classification, Free Tier Verification, Payload, and Design Alignment

**Gate:** E-D13 (`.kiro/specs/evidence-retrieval/design.md` line 567; native Task 14, `tasks.md` lines 207 to 211).
**Parent record:** `docs/development/e-d13-optional-ai-provider-decision-record.md` (owner decisions AI-2 and AI-4 recorded in its section 0).
**Addendum date:** 2026-11-10.
**Method:** Public Google documentation read with the web tools (`web_fetch`, selective mode, and search). No Gemini API call was made. No dependency was installed. No source code, test, configuration, approved specification, or approved baseline was changed.

## Status

| Item | Status on 2026-11-10 |
|---|---|
| AI-2 provider (Google Gemini API) | **APPROVED** (owner). Preserved. |
| AI-4 model (`gemini-3.6-flash`) | **APPROVED** (owner). Preserved. Documentation-level checks below. Account-level checks still open. |
| AI-3 privacy policy | **OPEN.** Proposed classification matrix ready for owner decision. Not decided here. |
| AI-10 payload | **PROPOSED, REDESIGNED.** Compliant payload defined. It offers little value (section 4.4). Recommendation: do not implement the provider on this basis. |
| Free Tier eligibility for `gemini-3.6-flash` | **VERIFIED at documentation level** (pricing table). **NOT VERIFIED** for the owner's account, numeric per-project limits, and regional availability. The gate stays OPEN for account-level eligibility. |
| Design alignment | **PROPOSED.** Exact replacement text in section 5. No approved document edited. |
| Gemini implementation | **BLOCKED.** Not authorized. |
| Native Task 14 | **BLOCKED.** Unchanged. |
| I5 and I6 | Partially implemented. **Not accepted.** |

Status labels used here:

- **VERIFIED FACT:** stated in an official source read on the verification date, cited with its URL.
- **PROPOSAL:** a recommendation for owner review. It has no approval.
- **OWNER DECISION:** recorded in the parent record. This addendum does not add to it.
- **NOT VERIFIED:** could not be confirmed from the sources read. Each such item stays a blocker where it matters.

## 1. Governing constraints applied

These are approved requirements, cited so the analysis cannot drift from them.

- The deterministic explanation is authoritative. AI may improve wording only (Spec 1 §11.2; Requirement 11.1 and 11.2).
- AI must not add facts, source references, causal relationships, classifications, retrieval statuses, or remove limitations (Requirement 11.2; Spec 1 §11.2).
- Insufficient evidence abstains regardless of AI (Spec 1 §11.3). A failed retrieval produces no explanation (Requirement 12).
- AI failure returns the deterministic explanation (Requirement 11.3). AI absence is never a retrieval failure (Requirement 11.4).
- Core retrieval needs no AI configuration or credentials (native `requirements.md`, configuration requirement, criterion 2).
- The MCP output carries no conclusion or explanation (Requirement 13.6).
- Architecture §2.1: free tiers may be optional conveniences but must never become critical runtime dependencies.

## 2. Verified Free Tier facts (documentation research only)

Verification date for every row: **2026-11-10**. Pages were read through the Google AI Studio documentation host. Redirects from `ai.google.dev` to `aistudio.google.com` were followed after the tool's origin-approval step.

### 2.1 Exact identifier, availability, lifecycle

| Item | Finding | Status | Source |
|---|---|---|---|
| Model code | `gemini-3.6-flash` | **VERIFIED FACT** | [Gemini 3.6 Flash model page](https://aistudio.google.com/docs/models/gemini-3.6-flash), "Model code" row |
| Version | Listed as "Stable: `gemini-3.6-flash`." Latest update July 2026 | **VERIFIED FACT** | Same page, "Versions" and "Latest update" rows |
| Lifecycle note | "previous-generation Flash model that remains available for production use." The page points to `gemini-3.8-flash` as Google's newest Flash model | **VERIFIED FACT**. Not approved as a substitute (AI-4) | Same page, callout |
| Pricing page status | Listed as "Our previous generation Flash model." Pricing page footer: "Discounts and model availability are subject to change." | **VERIFIED FACT** | [Gemini API pricing](https://aistudio.google.com/docs/pricing), `gemini-3.6-flash` section and footer |
| Supported operations | The model page lists Batch API, Flex inference, and Priority inference as supported, and lists code execution, computer use, and URL context. Generate Content is not named as a row on the page read | **PARTIALLY VERIFIED.** The Generate Content operation was not confirmed from the page read | Same page, "Capabilities" and "Consumption options" rows |

### 2.2 Free Tier eligibility

| Item | Finding | Status | Source |
|---|---|---|---|
| Free Tier price for `gemini-3.6-flash` | Input price, output price (including thinking tokens), and context caching: "Free of charge" in the Free Tier column | **VERIFIED FACT** (documentation table). Applies to the model's Free Tier, subject to change | [Gemini API pricing](https://aistudio.google.com/docs/pricing), `gemini-3.6-flash` table, Standard tab |
| Free Tier data use in the same table | "Used to improve our products: Yes" for the Free Tier column | **VERIFIED FACT** | Same table, last row |
| New account default | "New accounts begin on the Free Tier, which allows access to certain models in the Gemini API and AI Studio, up to the models' free tier rate limits." | **VERIFIED FACT** | [Billing](https://aistudio.google.com/docs/billing), "About billing and tiers" |
| Projects needing verification | Free usage qualification: "Active project or free trial; some projects need verification" | **VERIFIED FACT** that some projects need verification. **NOT VERIFIED** whether the owner's project does | [Rate limits](https://aistudio.google.com/docs/rate-limits), "Usage tiers" table |
| Account-level eligibility | Depends on the owner's AI Studio project. Not checked | **NOT VERIFIED** | Requires owner check in AI Studio |
| Regional availability | The terms say access is only "within an available region." The available-regions page was not read | **NOT VERIFIED** | [Terms](https://aistudio.google.com/docs/terms), "Use Restrictions" |

**Eligibility conclusion.** Google's pricing documentation lists `gemini-3.6-flash` on the Free Tier. This is a documentation-level finding. Account-level eligibility, quota, and region remain NOT VERIFIED. The eligibility gate therefore stays OPEN for implementation, and it is an owner check before any use.

### 2.3 Request limits and quota dimensions

| Item | Finding | Status | Source |
|---|---|---|---|
| Limit dimensions | Requests per minute (RPM), tokens per minute (TPM), requests per day (RPD). Some models also have images per minute (IPM) or tokens per day (TPD) | **VERIFIED FACT** | [Rate limits](https://aistudio.google.com/docs/rate-limits), opening section |
| Scope | Rate limits are applied per project, not per API key | **VERIFIED FACT** | Same page |
| RPD reset | RPD quotas reset at midnight Pacific time | **VERIFIED FACT** | Same page |
| Per-model Free Tier numbers for `gemini-3.6-flash` | Not in the documentation read. The per-model table lives on the AI Studio rate-limit page, which requires sign-in. The redirect to a sign-in page was not followed | **NOT VERIFIED** | [AI Studio rate limit](https://aistudio.google.com/rate-limit) (sign-in required) |
| Default limits for the batch and priority features | Batch API has its own limits. The batch table lists `Gemini 3.6 Flash` for Tier 1 at 3,000,000 enqueued tokens. This is not the Free Tier interactive quota | **VERIFIED FACT** that the batch table exists. Not relevant to the Sean interactive use case | [Rate limits](https://aistudio.google.com/docs/rate-limits), "Batch API rate limits" |
| Specified limits are not guaranteed | "Specified rate limits are not guaranteed and actual capacity may vary." | **VERIFIED FACT** | [Rate limits](https://aistudio.google.com/docs/rate-limits), final section |

### 2.4 Rate-limit and quota-exhaustion behavior

| Item | Finding | Status | Source |
|---|---|---|---|
| Exceeding any limit | "Exceeding any of them will trigger a rate limit error." Example: 21 requests in a minute against a 20 RPM limit is an error, even when TPM is not exceeded | **VERIFIED FACT**. The HTTP status and error body for this case were not stated in the page read | [Rate limits](https://aistudio.google.com/docs/rate-limits), opening section |
| Spend-based limits | Free Tier: "N/A." Paid tiers have spend limits per 10 minutes. Exceeding a spend limit returns "429 RESOURCE_EXHAUSTED" | **VERIFIED FACT** that the 429 status applies to spend limits. Applies to paid tiers only, per the table | [Rate limits](https://aistudio.google.com/docs/rate-limits), "Spend-based rate limits" |
| Recommended handling | Wait and retry after a short period; reduce expensive requests; request an increase | **VERIFIED FACT** (for spend limits). The Sean design (AI-11: no automatic retry) is a PROPOSAL and is compatible with it | Same page |
| Free Tier exhaustion behavior | Whether a Free Tier RPM, TPM, or RPD error uses the same 429 code is not stated in the page read | **NOT VERIFIED** | — |

### 2.5 Data use, retention, and human review (Free Tier)

| Item | Finding | Status | Source |
|---|---|---|---|
| Unpaid Services definition | "Any Services that are offered free of charge like direct interactions with Google AI Studio or unpaid quota in Gemini API are unpaid Services." | **VERIFIED FACT** | [Terms, "Unpaid Services"](https://aistudio.google.com/docs/terms) |
| Use of submitted content | "Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products and services and machine learning technologies." | **VERIFIED FACT** | Same section |
| Human review | "human reviewers may read, annotate, and process your API input and output." Google says it disconnects this data from the Google Account, API key, and Cloud project before reviewers see or annotate it | **VERIFIED FACT** | Same section |
| Owner warning in the terms | "Do not submit sensitive, confidential, or personal information to the Unpaid Services." | **VERIFIED FACT** | Same section |
| Licence grant | The Submission of Content licence extends to prompts, system instructions, cached content, and files, and to generated responses | **VERIFIED FACT** | Same section |
| EEA, Switzerland, UK | The paid-service data terms apply to all services, including unpaid ones, for users in those places | **VERIFIED FACT** | Same section |
| Logging by default | Logs are retained for a default maximum of 55 days. The retention window can be set to 7, 14, 28, or 55 days. Default logging is on for Generate Content API calls in projects created on or after October 26, 2026. The owner can turn logging on or off in AI Studio | **VERIFIED FACT** for the stated default and options | [Logs policy](https://aistudio.google.com/docs/logs-policy), "Data that can be shared" and "How we use your data" |
| Logging availability conflict | The same page says "logging is only available for billing-enabled projects." It also says default logging is on for Generate Content calls in projects created on or after October 26, 2026. These statements conflict for a Free Tier project. | **CONFLICT. UNRESOLVED.** Owner must check the logging setting on the actual project | Same page |
| Datasets shared with Google | "Processed in accordance with ... Unpaid Services." The dataset "may be used to develop and improve Google products" | **VERIFIED FACT** | Same page, "How we use your data" |

**Implication for AI-3.** Any content sent on the Free Tier can be retained, may be used to improve Google products, may be read by human reviewers, and may be kept in logs for up to 55 days under default settings. Logging control must be checked and set on the project before any use. Anonymization does not remove these conditions.

### 2.6 Billing and charges

| Item | Finding | Status | Source |
|---|---|---|---|
| Free to paid transition | "To transition from the Free tier to a paid tier, you must first set up billing in AI Studio." | **VERIFIED FACT** | [Rate limits](https://aistudio.google.com/docs/rate-limits), "How to upgrade to the next tier" |
| Paid status of a billing-linked project | "Your access to Gemini API is a 'Paid Service' only when accessing the API through a Cloud Project associated with an active billing account." Google AI Studio access counts as paid when the account has a Cloud Project with an active billing account, even if offered free | **VERIFIED FACT** | [Terms, "Paid Services"](https://aistudio.google.com/docs/terms) |
| Prepay and balance | Upgrading to Paid Tier means linking a billing account and prepaying a minimum of $5. "The Gemini API will only serve requests if you have a positive Prepay credit balance." | **VERIFIED FACT** | [Billing](https://aistudio.google.com/docs/billing), "Set up billing" and "Verify billing status" |
| Tiers determined per billing account | "Tiers, rate limits, and billing account caps are all determined at the billing account level." | **VERIFIED FACT** | [Billing](https://aistudio.google.com/docs/billing), "About billing and tiers" |
| Paid price for `gemini-3.6-flash` | Standard tier: input $0.75 and output $3.75 per 1M tokens through December 31, 2026. Input $1.50 and output $7.50 from January 1, 2027. Context caching changes too | **VERIFIED FACT**. Prices subject to change | [Gemini API pricing](https://aistudio.google.com/docs/pricing), `gemini-3.6-flash` table |
| Could a billing-enabled project incur charges while the application intends the Free Tier? | Yes, according to the documentation. Linking billing makes the project's Gemini API access a paid service served against a prepaid balance. Free Tier pricing is documented for the free tier, not for a billing-linked project. Whether a billing-linked project can still use Free Tier pricing for this model was not stated in the pages read | **VERIFIED FACT** that linking billing moves access to paid. **CONFIRMED RISK**: a project with billing linked must be treated as paid | Terms, Billing, Rate limits (as above) |
| Automatic upgrade | Tiers upgrade automatically on spend and account age. Free to Tier 1 requires an active linked billing account | **VERIFIED FACT** | Rate limits, "Usage tiers" |

**Implication.** The Free Tier project must have no billing account linked. Any billing link changes the data terms and the charging model. Sean must not store or use a key from a billing-linked project under the Free Tier decision.

### 2.7 Production restrictions

| Item | Finding | Status | Source |
|---|---|---|---|
| Professional use | "Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use." | **VERIFIED FACT** | [Terms, "Use Restrictions"](https://aistudio.google.com/docs/terms) |
| EEA, Switzerland, UK end users | "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom." | **VERIFIED FACT**. Applies if Sean were offered to users there | Same section |
| Age restriction | Users must be 18 or older. Services may not be part of an application directed toward or likely accessed by individuals under 18 | **VERIFIED FACT** | Same section |
| Prohibited use | Compliance with the Prohibited Use Policy is required. The terms prohibit clinical or medical-advice use | **VERIFIED FACT** | Same section |
| Available regions | Access only "within an available region." The region list was not read | **NOT VERIFIED** | Same section |

### 2.8 Summary of the Free Tier gate

- **Verified:** the model exists, is stable, and is on the Free Tier price table. Free Tier data use is documented, and it is unpaid.
- **Not verified:** account-level eligibility, per-model numeric limits, the exact error body for quota exhaustion, the owner's logging setting, and the owner's region.
- **Gate result:** account-level Free Tier eligibility stays **OPEN**. Implementation remains BLOCKED for other reasons (section 6).

## 3. AI-3 privacy classification matrix (proposal for owner decision)

### 3.1 Categories

- **ALLOWED:** may be sent. Still subject to the data-use conditions in section 2.5.
- **ALLOWED_ONLY_AFTER_TRANSFORMATION:** may be sent only in the transformed form stated. The original value is never sent.
- **PROHIBITED:** must never be sent to Gemini.
- **REQUIRES_SEPARATE_OWNER_APPROVAL:** not decided here. A separate owner decision is needed before any use.

### 3.2 Principles applied

1. A field is not safe because it is structured. A repository name in a JSON object is still a repository name.
2. A field is not safe because it is anonymized. Hashing a commit hash does not remove the identifier, because the hash can be recomputed from the same input by anyone holding it. Replacing a name with a placeholder that is stable across calls still identifies the same entity.
3. Sean cannot tell from the registry whether a repository is public. The registry stores `repository_id`, `root`, and optional `github` identity (`backend/app/modules/repository/registry.py`, `RegistryEntry`). It has no visibility field. Every repository is therefore treated as private for this matrix.
4. Minimization comes first. A field that is not necessary for a useful explanation is not sent, even if it is ALLOWED.

### 3.3 Matrix

Each row is evaluated on its own. "Reveals" asks whether the field identifies a private repository, a developer, an organization, or a project.

| # | Field | Category | Informational value | Privacy risk | Transformation required | Reveals private repository, developer, organization, or project? | Necessary for a useful explanation? |
|---|---|---|---|---|---|---|---|
| 1 | Evidence classification (`DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, `INSUFFICIENT_EVIDENCE`) | ALLOWED | High. It sets what the wording may say | Low. Enum with 4 values | None | No | Yes |
| 2 | Retrieval status (`COMPLETE`, `PARTIAL`, `INSUFFICIENT`; `FAILED` never reaches AI) | ALLOWED | High. Governs whether to say "partial" | Low. Enum | None | No | Yes |
| 3 | Evidence type (`GIT_COMMIT`, `GIT_BLAME`, `CODE_HISTORY`, `DOCUMENTATION`) as enum | ALLOWED | Medium | Low. Enum | None | No | Marginal |
| 4 | Counts per evidence type, commit count, co-changed document count | ALLOWED | Medium. Gives "2 commits" wording | Low. Integers only. Small counts in a small repository could hint at its size | Integers only. Round or bucket for counts above a threshold is a PROPOSAL, not a rule | Not by itself | Yes |
| 5 | Generic limitation codes (`SHALLOW_CLONE`, `SYMBOL_HISTORY_FILE_LEVEL`, `NO_HISTORY_RETRIEVED`) | ALLOWED | Medium. Needed to keep limitations | Low. Enum | Send the code, not any message text | No | Yes |
| 6 | Limitation message text | ALLOWED_ONLY_AFTER_TRANSFORMATION | Same as code | Low if fixed text from code. High if a message embeds a path, symbol, or commit | Replace with the fixed template text from code. Never send a message built from request or repository values. Check each message at implementation | Only if it embeds values | Only as the code |
| 7 | Generic explanation structure (fact, inference, unknown headings and skeleton) | ALLOWED | Low. The deterministic engine already produces it | Low. Contains no repository values | None | No | Marginal |
| 8 | Deterministic explanation text as produced today | **PROHIBITED** | High as wording. Contains values | High. The live output of a valid request in the 2026-11-10 HTTP check included the file path and symbol ("changed src/a.py (symbol target)"). That output was observed directly and is not recorded in phase-status §32 | Only as a slot template with values removed (section 4). The raw text is never sent | Yes, through its path and symbol | — |
| 9 | Commit hashes (full or abbreviated) | **PROHIBITED** | Low for wording | High. Identifies a specific commit. Public commits can be found by hash | None. A hash of a hash is still an identifier | Yes, identifies a commit in a repository | No |
| 10 | Repository identifier (`repository_id`) | **PROHIBITED** | Low | High. Owner-chosen name, often descriptive | None | Yes | No |
| 11 | Repository name, owner, GitHub identity (`github.owner`, `github.name`) | REQUIRES_SEPARATE_OWNER_APPROVAL | Low | High. Identifies an organization or project. Visibility unknown | Not available for sending under this matrix | Yes | No |
| 12 | File paths | **PROHIBITED** (ALLOWED_ONLY_AFTER_TRANSFORMATION to file extension is a possible option) | Medium to high. Shows project layout | High | Option to send only the extension (for example `.py`), if the owner approves that transformation | Yes | Partly. The explanation names the path today |
| 13 | Symbol names | **PROHIBITED** | High to the user. Reveals code and domain | High. Function and class names in private code describe its logic | Option: send only a count of candidate definitions (already counted by the resolver) | Yes | No, if counts are used |
| 14 | Author names (`author.name`) | **PROHIBITED** | Low for wording | High. Personal data. Names developers | Option: send the count of distinct authors only | Yes, identifies a developer | No |
| 15 | Timestamps (commit, author, committer, event) | **PROHIBITED** as exact values. ALLOWED_ONLY_AFTER_TRANSFORMATION to coarse counts (for example "within 2 years") | Medium | Medium to high. Work patterns and dates | Only coarse, rounded spans. The owner must approve the transformation | Partly | No |
| 16 | Evidence IDs (`ev1_` identifiers) | **PROHIBITED** | None to the wording | High. Derived from namespace, source type, and source identifier (D02 §16.5 evidence field table). Encodes a commit hash or path | None | Yes | No |
| 17 | Source URLs (commit, PR, issue) | **PROHIBITED** | Low | High. Include the owner, repository, and hash or number | None | Yes | No |
| 18 | Commit messages | **PROHIBITED** | Medium | High. Free text, untrusted, may contain private information, and may contain instructions that could influence the model | None | Yes | No |
| 19 | Pull request or issue metadata (number, title, body, author, dates, state) | **PROHIBITED** | Low to medium | High. Free text and third-party personal data | None | Yes | No. The current investigation does not produce PR or issue evidence (G-M association not approved) |
| 20 | Source excerpts and code | **PROHIBITED** | High to the user. Not needed for wording | Very high | None | Yes | No |
| 21 | Raw tool responses (MCP or HTTP JSON) | **PROHIBITED** | None | Very high. Contains every value above | None | Yes | No |
| 22 | User question text (`question`) | **PROHIBITED** | Low | High. Free text from the user, may name private code, and is untrusted | None | Possibly | No |
| 23 | Investigation ID (UUID v4) | ALLOWED (not necessary) | None to the wording | Low. Random identifier, but it links the request to a stored record | Not sent | No | No |
| 24 | Ranking scores and weights | ALLOWED (not necessary) | None to the wording | Low | Not sent | No | No |
| 25 | Retrieval limitation text generated from repository data | **PROHIBITED** | Low | High | None | Yes | No |

**Result.** The only fields that are both ALLOWED and necessary are: evidence classification (1), retrieval status (2), evidence type enum (3), integer counts (4), limitation codes (5), and the generic explanation skeleton (7). The integer counts (4) are the only data that carries repository information, and it is minimal.

**Sensitive-payload check.** If the payload contains only fields 1, 2, 3, 4, 5, and 7, it contains no repository name, path, symbol, commit, author, time, message, or excerpt. Under the Free Tier terms it would still be submitted content that Google may use and human reviewers may read (section 2.5). The owner must decide whether even that payload is acceptable under AI-3.

## 4. AI-10 — Reconciled payload proposal

### 4.1 Proposed minimal request payload

The payload is built from fields 1, 2, 3, 4, 5, and 7 only. Values that identify the repository are never placed in it. The explanation text is produced locally from a slot template, and the slot values stay on the local machine.

```json
{
  "task": "wording_only",
  "classification": "PARTIAL_EVIDENCE",
  "retrieval_status": "PARTIAL",
  "counts": { "commits": 2, "co_changed_documents": 0 },
  "limitation_codes": ["SYMBOL_HISTORY_FILE_LEVEL"],
  "template": "{SENTENCE_FACT} {SENTENCE_LIMITATIONS} {SENTENCE_UNKNOWN}"
}
```

- `template` holds the fixed sentences from code, with slot tokens such as `{SENTENCE_FACT}`. It contains no values.
- Slot values (paths, symbols, commit IDs, author names, dates, messages, excerpts, and URLs) are never in the payload. The local code fills them after validation.
- The fixed sentence text for each classification and limitation is part of the approved wording. Implementation must confirm it contains no request values.

### 4.2 Proposed expected response

```json
{ "explanation_text": "string with each slot token exactly once" }
```

- Exactly one key. Any other key is rejected.
- The string must contain every slot token from the template exactly once, and no other token that looks like a slot.
- The response is wording only. It is not a classification, a status, a citation, or a list of facts.

### 4.3 Explicit list of fields that must never be transmitted

Never transmit, in any form (raw, hashed, truncated, encoded, or summarized):

- Source code, diffs, file excerpts, and code blocks.
- Commit messages and any part of them.
- Commit hashes, abbreviated or full, and any string that encodes one (including evidence IDs).
- Repository identifiers, names, owners, and GitHub identities.
- File paths, file names, and directory names.
- Symbol names and identifiers.
- Author names, emails, and any personal data.
- Exact timestamps.
- Source URLs.
- Pull request or issue numbers, titles, bodies, authors, and states.
- Raw tool or HTTP responses.
- User question text.
- Credentials, tokens, keys, and environment values.
- Any unredacted error text from the provider or from Sean.

### 4.4 Validation rules that prevent introduced facts, entities, or conclusions

The deterministic explanation is authoritative. The rules below apply to the response, before any local slot filling.

| Rule | Check | Rejects |
|---|---|---|
| V1 Schema | Valid JSON; exactly one key; string type; length at or below a configured bound (E-D14, unapproved) | Extra keys, wrong types, overlong output |
| V2 Slots | Every slot token appears exactly once; no unknown token; no braces other than slot tokens | Dropped, duplicated, or invented slots |
| V3 Classification and status words | Each classification or status word used in the template appears unchanged. No other classification or status word appears | Changed or added classifications and statuses |
| V4 Numbers | Every digit sequence matches a value in `counts` or in the template text. No new digits | Invented counts, dates, versions, or identifiers |
| V5 Entities | No URL, no `http`, no `www`, no e-mail pattern, no hexadecimal run of 7 or more characters, no path separator (`/` or `\`) | Leaked or invented identifiers and paths |
| V6 Markup | No backticks, asterisks, hashes at line start, square brackets with parentheses, or angle brackets | Injected formatting and links |
| V7 Causal and intent terms | Denylist: "because", "due to", "caused", "so that", "in order to", "intended", "decided", "chose", "to fix", "to avoid", "reason", "motivated", "wanted", "why", "purpose". Each is rejected unless it appears in the fixed template | Causal claims and claimed intent (Spec 1 §11.2; Requirement 11.2) |
| V8 Limitation sentences | Each fixed limitation sentence from the template appears verbatim | Removed limitations |
| V9 Abstention | If classification is `INSUFFICIENT_EVIDENCE` or status is `FAILED`, no request is sent | Any explanation of insufficient evidence |
| V10 Fallback | Any failed rule returns the deterministic explanation. Only the rule number and category are logged, never the output | Silent acceptance of unvalidated output |

**Limit of the validator.** These rules catch leaked identifiers, invented numbers, missing slots, causal vocabulary, and removed limitations. They do not establish that a free-text rewording is semantically faithful. A reworded sentence can imply a wrong relationship without using any blocked word. The validator reduces risk. It cannot make free rewording safe.

### 4.5 Value assessment and recommendation

**What Gemini would see.** Enumerations, counts, and fixed generic sentences that the deterministic engine already writes. Its useful output would be rephrasing of those sentences.

**What that gives the user.** Little. The deterministic text already says what the evidence establishes, what can be inferred, and what remains unknown. A rewording of fixed sentences adds readability at best.

**What it costs.** One external call per investigation. A data-use relationship with Google for every call, under Free Tier terms (section 2.5). An EEA and UK restriction if the tool were ever offered there (section 2.7). A configuration and key surface (AI-6, AI-7). A validator that cannot check semantic faithfulness (section 4.4).

**Conclusion.** No compliant payload was found that offers meaningful value. The provider does not meet the bar of benefit against privacy and integrity risk. **PROPOSAL: do not implement the Gemini provider on this basis.** If better wording is the goal, improving the deterministic templates in `explanation/templates.py` directly is a lower-risk alternative. It needs no external call, no key, and no validator. That alternative needs its own owner decision.

## 5. Design alignment proposal

### 5.1 Statements now outdated because AI-2 and AI-4 are approved

| # | Location | Current text (summary) | Why outdated | Action |
|---|---|---|---|---|
| D1 | `design.md` line 129 (Explanation design, bullet 2) | "Optional AI is not designed yet. No provider is selected…" | A provider and a model are approved (2026-11-10) | Replace (text in 5.2) |
| D2 | `design.md` line 129, citation "Architecture §5" | Cites §5 for the rule against interfaces without a need | Architecture §5 is "High-Level Architecture." The rule is in §2.7 and §7 (verified 2026-11-10) | Correct the citation as part of D1 |
| D3 | `design.md` line 567 (E-D13 row) | "Optional AI provider." Open | Provider and model approved. Other items open | Replace (text in 5.2) |
| D4 | `design.md` line 570 (E-D15 row) | Covers the GitHub token and the data location | Does not cover the proposed AI key (AI-6). Incomplete, not wrong | Amend only if AI-6 is approved |
| D5 | `tasks.md` line 207 (Task 14 header) | "(depends on 13, and on a provider decision)" | The provider decision is recorded. Other dependencies (data policy, configuration, output contract) are not | Replace (text in 5.2) |
| D6 | `tasks.md` line 208 (subtask 14.1) | "Do not start until a provider is selected and approved (E-D13)…" | Provider is approved. The condition is partly met | Replace (text in 5.2) |
| D7 | I5/I6 plan, §4.1 (Task 14 row) and open-decision register item B-6 | "E-D13 provider … open" | Provider and model approved | Record in a later plan revision. Not edited here |
| D8 | `tasks.md` line 7 (file status) | "NOT APPROVED. No task may start." | Conflicts with OD-16 approval of the file's hash (phase-status §23). The statement may be stale, or the approval may be incomplete. The owner must decide | **Flag only.** Not changed |

### 5.2 Exact proposed replacement text

These are proposals. None is applied. Each needs owner authorization because the files are at approved baselines (OD-16 hashes for `design.md` and `tasks.md`).

**D1 and D2: `design.md` line 129, replacement for the second bullet under "Explanation design":**

> - Optional AI wording. The owner approved Google Gemini API, Free Tier, and model `gemini-3.6-flash` on 2026-11-10 (E-D13 record, AI-2 and AI-4). The data policy (AI-3), payload (AI-10), client (AI-5), key name (AI-6), configuration (AI-7), output contract (AI-8), and validation rules (AI-9) remain open. The deterministic explanation is authoritative. AI may replace only the explanation body, after validation. No provider call is made when evidence is insufficient or retrieval has failed. No provider interface is added without a concrete requirement (Architecture §2.7 and §7). The provider receives no repository identifiers, paths, symbols, commit data, author data, or excerpts (E-D13 addendum, section 4).

**D3: `design.md` line 567, replacement E-D13 row:**

> | E-D13 | Optional AI provider. Provider (Google Gemini API, Free Tier) and model (`gemini-3.6-flash`) approved by the owner on 2026-11-10 (E-D13 record, AI-2 and AI-4). Open: data policy (AI-3), payload (AI-10, redesign proposed), client (AI-5), key name (AI-6), configuration (AI-7), output contract (AI-8), validation (AI-9). | Requirement 11 | Spec 1 §11.2, §24; E-D13 record and addendum |

**D4 (only if AI-6 is approved), `design.md` line 570, E-D15 row:** append "and the optional AI key variable (proposed `SEAN_GEMINI_API_KEY`, AI-6, not approved)."

**D5: `tasks.md` line 207, replacement Task 14 header (checkbox unchanged, `[ ]`):**

> - [ ] 14. Optional AI wording (depends on 13, and on the E-D13 data-policy, payload, client, key, configuration, and output-contract decisions)

**D6: `tasks.md` line 208, replacement subtask 14.1:**

> - [ ] 14.1 Do not start until the E-D13 decisions AI-3, AI-5, AI-6, AI-7, AI-8, AI-9, and AI-10 are recorded as approved. The provider (AI-2) and model (AI-4) are approved on 2026-11-10. A provider is an external service and a dependency choice, so it still needs owner approval (Operating Guide §9). Verify the model identifier and Free Tier eligibility on the implementation date.

Subtask 14.2 (line 209) is unchanged.

### 5.3 Items that remain correct and need no change

- Spec 1 §24 says the optional AI provider is "deliberately not fixed by this specification." This is still true of the approved Spec 1. The owner's approval lives in the E-D13 record, not in Spec 1. **No Spec 1 change is proposed.** Changing Spec 1 would need a separate approval.
- Spec 1 §15 says a free or local provider "may be evaluated separately." It does not forbid a remote free-tier provider. No change proposed.
- Requirement 11 (criteria 1 to 4). No change.
- Architecture §2.1 (free tiers optional, never critical). The Free Tier selection is compatible. No change.
- Architecture §19 (dependency policy). Applies to AI-5 if an SDK is chosen. No change now.
- D01. No change until an SDK is chosen (A4 in the parent record).
- Requirement 13.6 and the MCP exclusion (AI-13). No change.

### 5.4 Affected sections, summarized

- `design.md`: Explanation design (line 129, D1 and D2); E-D13 row (line 567, D3); E-D15 row (line 570, D4, conditional).
- `tasks.md`: Task 14 header (line 207, D5); subtask 14.1 (line 208, D6); file status (line 7, D8, flagged only).
- I5/I6 implementation plan: §4.1 Task 14 row and register item B-6 (D7, later revision).
- No change to Requirement 11, Spec 1, Spec 2, Architecture, Operating Guide, Playbook, D01, D02, or the API contract.

## 6. Gate assessment

| Gate | Required outcome | Assessment | Can be decided now? | Depends on |
|---|---|---|---|---|
| AI-2 | APPROVED. Preserve | Approved 2026-11-10 by owner (provider only) | Preserved | — |
| AI-4 | APPROVED. Preserve | Approved 2026-11-10. Documentation check passed. Identifier, availability, Free Tier eligibility for the account, and region still to be checked on the implementation date | Preserved. Account checks are an owner task | Owner check in AI Studio |
| AI-3 | Proposed privacy policy ready for owner decision | Matrix in section 3 is ready. Free Tier data terms are verified (section 2.5). Logging conflict unresolved | **Yes, as a decision for the owner.** Not decided here | Logging check on the project; owner decision on fields 1 to 5 and 7 |
| AI-5 | Transport proposal | Direct HTTPS with standard-library `urllib`, following the GitHub client pattern. The Gemini REST endpoint, request schema, and authentication header were not verified in this addendum | Partly. Architecture §19 review and endpoint verification are required | Endpoint verification on implementation date; owner choice |
| AI-6 | API key handling proposal | Environment variable `SEAN_GEMINI_API_KEY` (proposed). Key must come from a project with no billing account (section 2.6). Never in URL, log, error, or repository. Register for redaction in the same way as `SEAN_GITHUB_TOKEN` (`main.py` line 19; `mcp/__main__.py` line 22). Requires an E-D15 amendment | **Owner decision** | E-D15 amendment; owner approval |
| AI-7 | Configuration dependency and resolution | No configuration loader exists. Task 16.1 is blocked by O-G1 and OD-5 (tasks.md line 218) | **No.** Depends on Task 16.1 | Task 16.1 verification and owner approval of values |
| AI-8 | Response contract compatibility | Compatible with the existing `explanation` field if the replacement is the body only. A new field would change the C.4 contract and needs a separate amendment. Recommended: no change | Yes, as a decision | Owner approval |
| AI-9 | Output validation | Rules V1 to V10 (section 4.4). The validator cannot check semantic faithfulness | **Owner decision** on rules and the phrase list | Owner approval; decision on whether to proceed at all |
| AI-10 | Privacy-compliant minimal payload | Defined (section 4.1 to 4.3). Compliant payload has little value (section 4.5). Recommendation: do not implement | **Yes, as a decision.** Recommendation is not to implement | AI-3 decision |
| AI-11 | Request limits and fallback | One request, no automatic retry, fallback to deterministic text. Free Tier per-model limits not verified (section 2.3). Timeout values from E-D14 and OD-5 (unapproved) | Partly. The fallback design can be approved now. Values cannot | E-D14 and OD-5 (Task 16.1) |
| AI-12 | Diagnostics and secret redaction | Log category and latency only. Never log payload, output, key, or Free Tier data. Logging setting on the project must be checked (section 2.5) | Yes, as a rule. The project logging check is an owner task | Owner check of the logging setting |
| AI-13 | MCP exclusion | Keep AI wording out of MCP (Requirement 13.6). No change | **Yes.** Recommend keep excluded | — |
| AI-14 | UI scope | No approved requirement for an AI label. No UI change proposed | **Yes.** Recommend no UI change | — |
| AI-15 | Live API authorization boundary | Each live call needs explicit owner authorization. Use synthetic data only. The Free Tier data terms make any live call a disclosure to Google (section 2.5) | **Yes, as a rule.** Live calls remain unauthorized | Owner authorization for each call window |

**Decisions that can be made now:** AI-3 as a policy decision, AI-8, AI-10 (recommendation not to implement), AI-13, AI-14, AI-15 as a rule, and the AI-11 fallback design.

**Decisions that depend on other tasks:** AI-7 (Task 16.1), AI-11 numeric values (E-D14 and OD-5), AI-5 endpoint verification, AI-6 (requires an E-D15 amendment), and AI-9 validation rules (depends on whether the owner proceeds at all).

**No additional decision is marked APPROVED by this addendum.**

## 7. Sources and verification

Verification date for every source: **2026-11-10.**

| # | Source | Used for | Read mode | Limitations |
|---|---|---|---|---|
| S1 | [Gemini API pricing](https://aistudio.google.com/docs/pricing) (reached from ai.google.dev/gemini-api/docs/pricing via redirect) | Free Tier price, paid price, data-use row, 3.6 status | Selective, search phrase `gemini-3.6-flash` | Prices and availability subject to change. Other tabs not read |
| S2 | [Gemini 3.6 Flash model page](https://aistudio.google.com/docs/models/gemini-3.6-flash) | Model code, stability, lifecycle note, capabilities | Selective, search phrase `gemini-3.6-flash` | Free Tier eligibility not stated on the page |
| S3 | [Rate limits](https://aistudio.google.com/docs/rate-limits) (reached from ai.google.dev/gemini-api/docs/rate-limits) | Limit dimensions, scope, RPD reset, error on exceed, spend limits, tiers, upgrade path | Selective, phrases `Free Tier`, `3.6`, `429` | Per-model numeric limits not in this page |
| S4 | [AI Studio rate limit](https://aistudio.google.com/rate-limit) | Per-model numeric limits | **Not read.** Sign-in required. The redirect to a sign-in page was not followed | Cannot be verified from these sources |
| S5 | [Billing](https://aistudio.google.com/docs/billing) (reached from ai.google.dev/gemini-api/docs/billing) | Tiers, default Free Tier, billing link, prepay, balance, paid data-use footnote | Selective, phrases `billing account`, `not used to improve` | Second phrase had no match. The first phrase's results were used |
| S6 | [Terms (Gemini API Additional Terms)](https://aistudio.google.com/docs/terms) | Unpaid and Paid Services, data use, human review, EEA rule, use restrictions | Selective, phrases `Unpaid Services`, `Paid Services` | Truncated at the grounding section in this read |
| S7 | [Logs policy](https://aistudio.google.com/docs/logs-policy) | Default logging, retention, datasets, billing-enabled statement | Selective, phrase `days` | The statement about billing-enabled projects conflicts with the default-logging statement (section 2.5) |
| S8 | [Gemini 3.5 Flash model page](https://aistudio.google.com/docs/models/gemini-3.5-flash) | Deprecation (used in the parent record) | Read in part (parent record) | Not re-read in this addendum |
| S9 | Search snippets: Vertex AI Gemini 3 guide, Gemini API billing page on ai.google.dev | Background only | Snippets | Not cited for any approved decision |

Origin handling: every redirect to a new origin was reported by the tool and followed only to `aistudio.google.com` (Google's own documentation host, already used in the parent record). The sign-in redirect was not followed.

## 8. Unresolved questions

| ID | Question | Why it matters | Who decides |
|---|---|---|---|
| Q1 | Is any useful explanation possible under AI-3 with fields 1 to 5 and 7 only? | Determines whether the provider has value | Owner |
| Q2 | Is the Free Tier data-use condition acceptable for even the minimal payload? | Free Tier content may be used to improve products and reviewed by humans. Even counts and enums are submitted content under the terms | Owner |
| Q3 | Is logging on or off for the owner's project, and what retention is set? | The logs policy conflicts on whether logging applies to Free Tier projects. Default retention is 55 days | Owner, by checking AI Studio |
| Q4 | Does the owner's project need verification, and is it in an available region? | Account-level Free Tier access depends on both (sections 2.2 and 2.7) | Owner, by checking AI Studio |
| Q5 | What are the current Free Tier numeric limits for `gemini-3.6-flash` on the owner's project? | Needed for AI-11 values and for the fallback design. Not in the documentation read | Owner, by checking the sign-in page |
| Q6 | Does the Gemini Developer API return a 429 for RPM, TPM, and RPD exhaustion, or a different code? | Needed for the fallback rule. Only spend-limit 429 is documented in the pages read | Requires a documentation source that was not read, or an owner-authorized test. A test calls the API and needs separate authorization |
| Q7 | Which REST endpoint, request schema, and authentication header does the Gemini Developer API use? | Needed for AI-5 and AI-6. Not verified in this addendum | Requires documentation reading on the implementation date |
| Q8 | Should the tasks.md file-status header ("NOT APPROVED. No task may start.") be corrected, given the OD-16 approval of its hash? | Task 14 cannot start under the file's own header | Owner |
| Q9 | Should the design's citation "Architecture §5" be corrected to §2.7 and §7? | Stale citation (D2) | Owner, by approving the amendment |
| Q10 | Should the project keep the proposed deterministic-template improvement as the alternative to a provider? | Section 4.5 recommends it | Owner |
| Q11 | Is the owner's stated prior testing, which informed AI-2, to be recorded with its date and scope? | Context for the approval. Not verified | Owner |

## 9. Explicit implementation blockers

Each blocker must be cleared before any Gemini work can start. Clearing one does not clear the others.

1. **Task 14 header and status.** Task 14 is blocked by its own header ("depends on 13, and on a provider decision") and by the file status "NOT APPROVED. No task may start" (tasks.md line 7). Q8 must be resolved.
2. **AI-3 privacy policy.** Not decided. Q1, Q2, and Q3 must be answered by the owner.
3. **Free Tier account checks.** Account eligibility, region, verification, numeric limits, and logging setting are NOT VERIFIED (Q3, Q4, Q5).
4. **AI-6 key name and E-D15 amendment.** The key name is proposed, not approved. E-D15 does not cover it.
5. **AI-7 configuration.** Blocked by Task 16.1, which is blocked by O-G1 and OD-5.
6. **AI-5 transport.** Endpoint, schema, and authentication were not verified (Q7). The SDK or HTTP choice needs an Architecture §19 review.
7. **AI-9 validation rules.** Not approved. The owner must decide whether to proceed, given the limit in section 4.4.
8. **AI-11 numeric limits.** Depend on E-D14 and OD-5. Per-model numbers are not verified (Q5, Q6).
9. **Design and task amendments.** D1 to D6 need owner authorization. The approved baselines must not change without it.
10. **Owner recommendation on value.** Section 4.5 recommends not implementing the provider on the compliant payload. The owner must decide between proceeding and not proceeding.
11. **Live API calls.** Require explicit authorization (AI-15). None is authorized.
12. **Phase and increment gates.** I5 and I6 are not accepted. Task 14 is an I5 optional item. Phase 3 is in progress. The Spec 1 §25 and Architecture §25 implementation gates were not re-verified in this addendum.

**Blocked, not authorized:** Gemini implementation, Task 14, API calls, dependencies, prompts, clients, configuration, and environment variables.
