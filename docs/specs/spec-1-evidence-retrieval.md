# Sean — Spec 1: Evidence Retrieval

**Document ID:** SEAN-SPEC-01  
**Version:** 2.3  
**Status:** Approved  
**Document type:** Functional and Technical Specification  
**Previous version:** 2.2  
**Filename:** `spec-1-evidence-retrieval.md`  
**Product:** Sean

---

## 1. Purpose

This specification defines how Sean retrieves, evaluates, ranks, and structures historical technical evidence from a Git repository and its associated development records.

Sean helps engineers understand why code, mechanisms, and technical decisions exist by reconstructing the available historical record.

The system must distinguish verifiable facts from reasonable inferences and insufficient evidence. It must never present speculation as documented historical intent.

Evidence retrieval and classification must work independently of any AI provider. An optional AI component may improve the readability of an explanation, but it must not be required for the core investigation.

## 2. Product Requirements

Sean must:

- Investigate the historical context of a selected symbol, code region, file, or technical mechanism.
- Retrieve relevant Git history, including changes that are no longer present in the current code.
- Identify relevant commits and, when available, associated pull requests, issues, and documentation.
- Preserve source provenance so that users can inspect the underlying evidence.
- Rank evidence deterministically.
- Distinguish documented facts, inferences, partial evidence, and insufficient evidence.
- Communicate retrieval failures and limitations explicitly.
- Produce a useful structured result without requiring an AI service.
- Never fabricate commits, source references, metadata, causal relationships, or historical intent.

## 3. Architectural and Product Constraints

The implementation must follow these constraints.

### 3.1 Zero-cost Development

- The MVP must not require paid infrastructure or paid AI APIs.
- Core functionality must remain usable without external AI services.
- Optional integrations must not become mandatory dependencies.
- Free-tier limits must not be treated as permanent guarantees.

### 3.2 Local-first Execution

- The MVP must run locally on Windows.
- Repository investigation must work against local Git repositories.
- Public GitHub metadata may be retrieved through the GitHub REST API, subject to its availability and rate limits.
- No paid cloud hosting is required.

### 3.3 Modular Monolith

- Use one backend application with clearly bounded internal modules.
- Do not introduce microservices.
- Avoid unnecessary abstraction layers and duplicated responsibilities.
- Keep MCP integration inside the same project and reuse the backend's internal logic.
- Internal responsibilities do not automatically justify separate packages or modules.

### 3.4 Minimal Runtime

- Normal development should require no more than two persistent application processes: frontend and backend.
- Do not introduce infrastructure for hypothetical future requirements.
- SQLite is sufficient for MVP persistence.

### 3.5 Provider Independence

- Evidence retrieval, ranking, and classification must not depend on an AI provider.
- An optional AI provider or local model may be evaluated separately.
- The application must retain useful functionality when AI is unavailable, disabled, or misconfigured.

## 4. Functional Requirements

### FR-01 — Repository Context

Sean must identify the repository under investigation and maintain a stable repository namespace for its evidence.

### FR-02 — Target Resolution

Sean must resolve the requested target to the most relevant available symbol, file, path, or code region.

### FR-03 — Historical Retrieval

Sean must search historical repository changes, including relevant deleted, renamed, moved, copied, reverted, and replaced code where the available Git history permits.

### FR-04 — External References

Sean must identify and validate relevant GitHub pull request and issue references when available.

### FR-05 — Evidence Provenance

Every returned evidence item must retain enough source information for the user to inspect and verify it.

### FR-06 — Deterministic Ranking

Evidence ranking must be reproducible for the same repository state, query, and configuration.

### FR-07 — Epistemic Classification

Sean must distinguish documented evidence, inference, partial evidence, and insufficient evidence.

### FR-08 — Retrieval Status

Sean must communicate whether retrieval completed, was partial, was insufficient, or failed.

### FR-09 — No-AI Explanation

Sean must generate a structured, deterministic explanation from retrieved evidence without requiring an AI provider.

### FR-10 — MCP Access

Sean must expose the approved investigation capabilities through MCP without duplicating backend business logic.

## 5. Symbol and Code Context Resolution

The initial target-resolution process must:

1. Normalize the repository-relative path.
2. Identify the requested symbol or code region.
3. Resolve the target against the current repository state.
4. Identify relevant definitions, references, and surrounding context where practical.
5. Preserve ambiguity when multiple candidates match.
6. Avoid silently selecting an unrelated symbol.

When resolution is ambiguous, Sean must report the ambiguity and retain the candidate context rather than presenting an unsupported match as certain.

The implementation must account for:

- Symbol name.
- File path.
- Code region or line range.
- Relevant surrounding code.
- Language and repository context when available.

The target-resolution strategy must not assume that a symbol's current location is its historical location.

## 6. Git Historical Retrieval

Git is the primary source of repository history.

Sean must investigate relevant historical changes using available Git metadata and content.

The implementation must consider:

- Commit history.
- Commit messages.
- File history.
- Added and removed lines.
- Renames and moves.
- Deleted files and symbols.
- Reverted changes.
- Replacements and refactoring.
- Blame information.
- Relevant parent and descendant commits.

Git operations such as `-S`, `-G`, `--follow`, `-L`, and blame may support retrieval, but none must be treated as a complete historical reconstruction mechanism.

Known limitations must be handled explicitly:

- Rename detection is heuristic.
- Copy detection is not guaranteed.
- Line-based history may not preserve symbol identity.
- A commit message may describe a change without documenting its underlying motivation.
- A commit establishes a recorded change and its metadata, not necessarily the author's intention.
- Temporal proximity does not prove causality.
- Available history may be incomplete because of shallow clones, missing branches, unavailable objects, or repository history boundaries.

Sean must not infer that a commit caused a behavior merely because the commit occurred near the time the behavior appeared.

Git retrieval must be read-only. The implementation must not execute repository-provided scripts, hooks, or arbitrary commands as part of historical investigation.

## 7. GitHub Pull Requests and Issues

When GitHub metadata is available, Sean may retrieve:

- Pull request title and number.
- Pull request description.
- Author and timestamps.
- Merge status and merge commit.
- Associated issue references.
- Issue title and description.
- Relevant comments and discussion metadata when accessible.

Requirements:

- Validate external references before associating them with evidence.
- Preserve the source URL and source identifier.
- Distinguish unavailable metadata from nonexistent records.
- Respect GitHub API rate limits.
- Cache suitable responses to reduce unnecessary requests.
- Do not assume that a commit reference and a pull request reference establish the same fact.
- Do not assume that a pull request description fully explains the historical motivation.
- Do not treat an inaccessible private record as proof that the record does not exist.

Private repository access is not mandatory for the MVP.

## 8. Evidence Data Model

Each evidence item must use a consistent structure.

The model must support, as applicable:

- Stable evidence identifier.
- Repository namespace.
- Source type.
- Source identifier.
- Source URL, when available.
- Commit hash or external record identifier.
- File path.
- Line range or code region.
- Author.
- Timestamp.
- Title or summary.
- Retrieved content or relevant excerpt.
- Retrieval method.
- Integrity and availability metadata.
- Relationship to the investigated target.
- Ranking information.
- Limitations or uncertainty notes.

Source types must distinguish at least:

- Git commit.
- Git blame.
- Pull request.
- Issue.
- Documentation.
- Code history.

Evidence identity must remain stable within its repository namespace. The same source identifier in two different repositories must not be treated as the same evidence item.

The identity strategy must use source-specific identifiers and repository identity. It must not depend solely on display titles, descriptions, or mutable content.

The data model must not imply that every source type provides the same level of integrity or historical certainty.

Unavailable metadata must remain distinguishable from verified absence. Missing information must not be replaced with fabricated defaults.

## 9. Evidence Ranking

Sean must rank evidence using deterministic criteria.

The initial proposed weights are:

| Criterion | Initial weight |
|---|---:|
| Exact symbol or path match | 25 |
| Relevant code region | 20 |
| Historical role | 20 |
| Commit message relevance | 15 |
| Pull request or issue relevance | 10 |
| Repository context | 5 |
| Temporal relevance | 5 |
| **Total** | **100** |

These weights are initial design values, not validated performance results.

Requirements:

- The same inputs and configuration must produce the same ranking.
- Tie-breaking must be deterministic.
- Missing metadata must not be treated as positive evidence.
- Ranking must not convert relevance into proof of causality or intent.
- Ranking criteria and weights must remain configurable without introducing unnecessary abstraction.
- Calibration must use the Golden Test Suite before the weights are considered validated.
- The ranking result must retain enough information to explain why an item received its score.

Ranking is a relevance mechanism. It must not independently determine epistemic classification.

## 10. Investigation Result and Classification

The investigation result must distinguish retrieval status from epistemic classification.

### 10.1 Epistemic Classification

Sean must support these final classifications:

- `DOCUMENTED`: available evidence directly documents the relevant fact or rationale.
- `INFERRED`: the explanation is a reasoned interpretation supported by evidence, but not directly documented.
- `PARTIAL_EVIDENCE`: some relevant evidence exists, but it does not support a sufficiently complete explanation.
- `INSUFFICIENT_EVIDENCE`: available evidence does not support a reliable explanation.

The classification describes what the evidence supports. It does not describe whether the retrieval process executed successfully.

### 10.2 Retrieval Status

Sean must support:

- `COMPLETE`: the planned retrieval operations completed successfully.
- `PARTIAL`: some retrieval operations could not be completed or returned incomplete results.
- `INSUFFICIENT`: retrieval completed, but the available material or coverage was insufficient for the planned investigation.
- `FAILED`: a blocking error prevented a meaningful investigation result.

The meanings must remain distinct:

- `INSUFFICIENT` is a retrieval status.
- `INSUFFICIENT_EVIDENCE` is an epistemic classification.
- A technically complete retrieval can produce `INSUFFICIENT_EVIDENCE`.
- A partial retrieval can still contain evidence that supports a narrow documented fact.
- A failed retrieval does not establish that historical evidence is absent.

Retrieval status and epistemic classification must not be conflated.

### 10.3 Result Structure

The final investigation result must include:

- Investigation identifier.
- Investigated target.
- Repository identity.
- Retrieval status.
- Epistemic classification, when a historical result has been classified.
- Conclusion, when one is supported.
- Concise explanation or neutral insufficiency/failure status.
- Supporting evidence.
- Relevant historical sequence, when available.
- Explicit limitations and uncertainty.
- Source references.
- Optional recommendations for further inspection.

A result must not hide missing evidence behind confident language.

A technical retrieval failure may have no epistemic classification and no historical conclusion. The result must communicate the technical failure separately.

### 10.4 Result Consistency Rules

The backend must validate the semantic consistency of its result before returning it.

At minimum:

- `FAILED` must not be represented as a successful historical conclusion.
- A failed investigation must not receive an invented epistemic classification.
- `INSUFFICIENT_EVIDENCE` must not contain an unsupported historical conclusion.
- `PARTIAL_EVIDENCE` must identify the supported portion and the relevant limitations.
- `DOCUMENTED` and `INFERRED` must have supporting evidence.
- A retrieval status of `PARTIAL` or `INSUFFICIENT` must expose the relevant coverage limitations.
- A retrieval status of `COMPLETE` means the planned operations completed; it does not claim that every possible historical source was discovered.

If the backend detects an invalid or contradictory result, it must return a safe structured error or unresolved result rather than silently changing the classification.

Cancellation is an application lifecycle outcome, not a retrieval status or epistemic classification. A cancelled investigation must not be represented as a completed historical result.

## 11. Deterministic Explanation and Optional AI

### 11.1 Mandatory No-AI Behavior

The core product must generate a useful explanation without an AI provider.

The backend must:

1. Collect and normalize evidence.
2. Rank evidence deterministically.
3. Determine retrieval status.
4. Apply the epistemic classification rules.
5. Build a structured explanation from verified evidence fields.
6. Include source references and relevant limitations.
7. Abstain from unsupported conclusions.

The deterministic explanation may use templates and rule-based synthesis. It must communicate what the evidence establishes, what can reasonably be inferred, and what remains unknown.

This behavior must work when:

- No AI provider is configured.
- AI functionality is disabled.
- The provider is unavailable.
- The provider returns an error.
- The provider returns an invalid or unsupported response.

AI unavailability must not cause evidence retrieval to fail.

### 11.2 Optional AI Behavior

An optional AI component may improve the readability, organization, or natural-language presentation of the deterministic result.

It must not:

- Invent facts, commits, authors, dates, or source references.
- Introduce unsupported causal relationships.
- Present an inference as documented intent.
- Upgrade the epistemic classification without new evidence.
- Remove relevant uncertainty or limitations.
- Override retrieval status.
- Replace source provenance with generated citations.

The structured evidence and backend classification remain authoritative.

### 11.3 Failure and Fallback

If optional AI processing fails, Sean must return the deterministic explanation.

If evidence is insufficient, Sean must abstain regardless of whether AI is available.

The absence of AI must never be represented as a retrieval failure.

## 12. MCP Integration

MCP is an integration interface, not a separate backend architecture.

The MVP must expose these conceptual tools:

### `search_history`

Search relevant repository history for a target and return ranked evidence with provenance.

### `blame_range`

Retrieve blame information for a repository path and line range.

### `get_pr`

Retrieve validated pull request metadata when available.

### `get_issue`

Retrieve validated issue metadata when available.

The exact schemas, required fields, validation rules, error behavior, and transport configuration must be defined and tested during implementation.

Requirements:

- MCP handlers must reuse internal backend modules.
- MCP must not duplicate Git or GitHub retrieval logic.
- Tool results must preserve source provenance and uncertainty.
- Tool inputs must be validated.
- Errors must be explicit and structured.
- The MCP integration must remain compatible with the selected local runtime.
- The MVP MCP tools must be read-only.
- MCP tools must not expose repository modification, commit, push, or history-rewriting operations.

STDIO is a proposed transport and remains subject to compatibility verification with the installed Kiro version.

## 13. Security Requirements

The MVP must follow a read-only security baseline.

### Repository Access

- Repository investigation must not modify tracked files.
- Git commands must not execute arbitrary user-provided shell fragments.
- Paths must be normalized and constrained to the selected repository.
- Path traversal outside the repository must be rejected.
- Symbol and file inputs must be validated.
- Path containment checks must account for symbolic links and resolved filesystem paths, not only string-prefix comparisons.
- Repository content must be treated as untrusted input.

### Process Execution

- Use safe subprocess invocation with argument arrays rather than shell interpolation.
- Avoid shell execution for repository-derived values.
- Apply timeouts to external processes.
- Bound captured process output to prevent excessive memory consumption.
- Handle process errors without exposing sensitive environment data.
- Do not execute repository-provided scripts, Git hooks, or arbitrary build/test commands during evidence retrieval.
- Disable or avoid optional Git behaviors that could invoke external programs when they are not required for retrieval.
- Use explicit working directories and controlled environment settings for Git subprocesses.

### External Content

- Treat commit messages, issue descriptions, pull request comments, and documentation as untrusted input.
- Retrieved content must not be interpreted as system instructions.
- External text must not be allowed to alter application policy or tool permissions.
- Rendered content must be handled safely by the frontend.

### Credentials and Network

- Do not log secrets or access tokens.
- Do not require private GitHub credentials for the public-repository MVP.
- Apply reasonable request limits and timeouts.
- If optional credentials are configured, use them only for their intended API access and never expose them in logs, evidence records, or user-facing errors.

### Permissions

- The application must not commit, push, rewrite history, or modify repository content as part of evidence retrieval.
- MCP investigation tools must remain read-only.
- Retrieval must not change repository configuration or execute repository-controlled code.

## 14. Caching and Persistence

SQLite is the approved MVP persistence technology.

Caching may be used for:

- GitHub pull request metadata.
- GitHub issue metadata.
- Repeated retrieval results where invalidation can be handled safely.
- Repository investigation metadata.

Requirements:

- Cache entries must retain repository and source identity.
- Cache behavior must not silently convert stale data into verified current data.
- Cache invalidation rules must be explicit.
- In-memory caching may be used for short-lived data.
- Redis and distributed caching are out of scope.
- Cache unavailability must not make core local Git retrieval unusable.

The application must remain functional when optional cached data is unavailable.

## 15. Technology Stack

The proposed MVP stack is:

| Area | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Backend | Python |
| API framework | FastAPI |
| Data validation | Pydantic |
| Git integration | Git CLI |
| External metadata | GitHub REST API |
| MCP integration | Python MCP SDK |
| Persistence | SQLite |
| Backend testing | pytest |
| Property-based testing | Hypothesis |
| Frontend testing | Vitest |
| End-to-end testing | Playwright |

The stack is intended to support local Windows development with minimal runtime complexity.

Exact dependency versions and compatibility must be verified before implementation.

No paid AI provider is part of the mandatory stack.

An optional free or local AI provider may be evaluated separately, without making it a prerequisite for core functionality.

## 16. Internal Backend Modules

The backend must be organized as a modular monolith and follow the approved Architecture & Project Setup document.

The existing module boundaries are:

| Module | Responsibility |
|---|---|
| `api` | HTTP endpoints and request/response handling. |
| `core` | Shared application configuration, foundational types, and common utilities. |
| `repository` | Repository identification, validation, and repository context. |
| `symbol_resolution` | Target, symbol, path, and code-region resolution. |
| `git_history` | Read-only Git history, diff, blame, and historical retrieval. |
| `github` | GitHub API access and external record validation. |
| `evidence` | Evidence normalization, provenance, identity, and ranking. |
| `investigation` | Investigation orchestration, retrieval status, and epistemic classification. |
| `explanation` | Deterministic explanation synthesis and optional presentation enhancement. |
| `mcp` | MCP tool definitions and handlers that reuse internal capabilities. |

These boundaries align with the approved project architecture. They do not require each responsibility within a module to become its own package, service, or abstraction layer.

The following responsibilities must remain clear:

- Evidence ranking belongs to the evidence capability.
- Retrieval status and epistemic classification belong to investigation orchestration.
- Deterministic explanation synthesis belongs to the explanation capability.
- MCP handlers delegate to the same internal capabilities used by the API.
- Persistence and caching remain implementation concerns of the existing backend modules unless a demonstrated need justifies a separate boundary.

Modules should be introduced only where they improve clarity, testability, or maintainability.

## 17. Windows and Local Development

The MVP must support local development on Windows.

Requirements:

- Git must be available locally.
- The backend must run in a supported Python environment.
- The frontend must run through the Vite development server.
- Local persistence must use SQLite.
- Configuration must not require paid cloud services.
- Setup instructions must be reproducible.
- Repository path validation and subprocess behavior must be tested on Windows.

The normal development workflow should require only the frontend and backend persistent processes.

Docker is not mandatory.

Dependency versions, Windows-specific behavior, path handling, and process execution must be validated on the actual development environment.

## 18. Testing Strategy

Testing must cover unit, integration, property-based, and end-to-end behavior.

### Backend

Use pytest for:

- Git retrieval.
- Target resolution.
- GitHub metadata validation.
- Evidence normalization.
- Evidence identity.
- Ranking.
- Classification.
- Deterministic explanation synthesis.
- Retrieval status handling.
- Security boundaries.
- MCP tool behavior.

Use Hypothesis for property-based testing of important invariants, including:

- Stable evidence identity.
- Deterministic ranking.
- Path containment, including symbolic-link cases.
- Input normalization.
- Classification consistency.
- Separation of retrieval status and epistemic classification.
- Handling of missing metadata.
- Safe behavior with malformed or untrusted source content.
- Bounded handling of subprocess output.

### Frontend

Use Vitest for:

- Component behavior.
- State transitions.
- Result rendering.
- Evidence presentation.
- Retrieval and classification status display.
- Handling of missing conclusions and non-applicable classifications.

### End-to-end

Use Playwright for:

- Repository investigation flow.
- Evidence presentation.
- No-AI operation.
- Partial and insufficient evidence states.
- Error handling.
- Cancellation behavior.
- MCP-independent user experience.

Tests must not be reported as passing unless they have actually been executed successfully.

## 19. Golden Test Suite

A concrete Golden Test Suite is mandatory before evidence ranking and historical retrieval are considered validated.

The initial suite must contain cases G01–G10.

The candidate repository is `django/django`.

The exact baseline commit must be pinned before the suite is implemented.

Each test case must define:

- Repository and pinned baseline.
- Target symbol, path, or code region.
- Investigation question.
- Expected historical evidence.
- Expected source references.
- Expected retrieval status.
- Expected epistemic classification, when applicable.
- Expected conclusion or expected abstention.
- Expected limitations.
- Deterministic pass/fail criteria.

The suite must include representative historical situations such as:

- Introduction of a symbol or mechanism.
- Subsequent modification.
- Deletion.
- Rename or move.
- Revert.
- Replacement or refactoring.
- Relevant pull request or issue reference.
- Ambiguous historical context.
- Partial retrieval.
- Insufficient evidence requiring abstention.

These are required coverage categories, not claims that the tests have already been implemented or verified.

No Golden Test Suite result may be reported as validated until the tests have been built and executed against the pinned baseline.

## 20. Observability

The application must provide enough diagnostic information to understand retrieval behavior.

At minimum, record:

- Investigation identifier.
- Repository identity.
- Target-resolution outcome.
- Retrieval operations attempted.
- Retrieval status.
- Evidence count.
- Ranking outcome.
- Classification, when applicable.
- Optional provider availability and failure state.
- Execution duration.
- Relevant error categories.

Logs must not expose credentials, tokens, or unnecessary sensitive repository content.

Observability must remain lightweight and local for the MVP.

## 21. Performance and Resource Constraints

The MVP must avoid unnecessary resource consumption.

Requirements:

- Limit the scope of Git history searches where appropriate.
- Apply timeouts to potentially expensive operations.
- Bound subprocess output.
- Avoid repeated external API requests when cached metadata is valid.
- Avoid loading entire repositories into memory unnecessarily.
- Return partial results when safe and useful, while clearly identifying incomplete retrieval.
- Keep the normal local runtime lightweight.

Performance targets must be measured against representative repositories before they are treated as validated acceptance thresholds.

## 22. Configuration

Configuration must support:

- Local repository selection.
- Git executable availability.
- GitHub API access where applicable.
- SQLite data location.
- Cache behavior.
- Retrieval limits and timeouts.
- Optional AI provider configuration.
- Optional AI enablement or disablement.
- MCP runtime configuration.

Core retrieval must work without AI configuration or credentials.

Secrets must be provided through appropriate local configuration mechanisms and must not be committed to the repository.

Configuration must not permit repository content to override application security settings or execute arbitrary commands.

## 23. Acceptance Criteria

The MVP is acceptable when the following conditions are met:

1. Sean can investigate a target in a supported local Git repository.
2. Target resolution identifies relevant code context or reports ambiguity.
3. Historical retrieval can find relevant changes beyond the current file contents where the available history permits.
4. GitHub references are validated before being associated with evidence.
5. Evidence items preserve source provenance.
6. Evidence identity is scoped to repository identity.
7. Evidence ranking is deterministic.
8. Retrieval status and epistemic classification are represented separately.
9. The system distinguishes `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, and `INSUFFICIENT_EVIDENCE`.
10. A deterministic explanation is available without an AI provider.
11. Optional AI failure does not prevent the deterministic result from being returned.
12. Optional AI cannot introduce unsupported facts or override backend classification.
13. Insufficient evidence results in an explicit abstention rather than a fabricated explanation.
14. A failed retrieval is not represented as proof that historical evidence does not exist.
15. MCP tools reuse backend logic and preserve evidence provenance.
16. Repository access remains read-only.
17. Path containment, including symbolic-link handling, and safe subprocess behavior are tested.
18. Repository-provided scripts and hooks are not executed during evidence retrieval.
19. Subprocess execution uses timeouts and bounded output.
20. The Golden Test Suite is implemented against a pinned repository baseline and executed.
21. The MVP runs locally on Windows without mandatory paid services or infrastructure.

Acceptance must be based on executed tests and observable behavior, not documentation alone.

## 24. Architectural Decisions and Validation Register

The following items remain open for validation. They must not be treated as completed decisions merely because they appear in this specification.

| ID | Decision or validation | Status |
|---|---|---|
| D01 | Confirm final technology stack and compatible dependency versions | Pending validation |
| D02 | Verify MCP transport and STDIO compatibility with installed Kiro | Pending validation |
| D03 | Pin the Django repository baseline for Golden Tests | Pending |
| D04 | Confirm historical Git retrieval behavior against Golden Tests | Pending |
| D05 | Calibrate evidence-ranking weights | Pending |
| D06 | Finalize cache invalidation behavior | Pending |
| D07 | Confirm local deployment and data locations on Windows | Pending validation |
| D08 | Validate GitHub API behavior and rate-limit handling | Pending validation |

The no-AI deterministic explanation is a mandatory product requirement, not an optional future enhancement.

The exact optional AI provider is deliberately not fixed by this specification.

The module boundaries in Section 16 follow Architecture & Project Setup. Any material change to those boundaries must be reviewed against that document before implementation.

## 25. Implementation Gate

Implementation may begin only when:

- This specification has human approval.
- Spec 2 is approved.
- Architecture and project setup are approved.
- Kiro engineering and operating documents are approved.
- Required Kiro configuration formats and capabilities have been verified against the installed version.
- The Golden Test repository and baseline strategy are defined.
- Windows dependency compatibility has been checked.
- The implementation plan is consistent with the approved architecture.

Implementation must proceed incrementally.

No microservices, paid infrastructure, mandatory AI dependency, or unnecessary architectural layers may be introduced without an explicit review and approval.

---

**Final principle:** Sean may reconstruct what the available evidence supports. It must clearly distinguish what is documented, what is inferred, and what remains unknown. Its explanation must remain useful even when no AI provider is available.