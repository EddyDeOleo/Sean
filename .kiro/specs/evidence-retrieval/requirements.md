# Requirements Document

## Introduction

This document specifies the requirements for Sean's evidence retrieval capability. Sean reconstructs the technical history of a Git repository and explains engineering decisions from verifiable evidence. A commit proves that a change occurred, not necessarily why, so Sean separates documented facts, inferences, and insufficient evidence.

The requirements cover repository identification and selection, target resolution, historical retrieval, evidence provenance and ranking, epistemic classification and retrieval status, the investigation result, deterministic and optional AI-assisted explanation, MCP access, repository and subprocess security, network use and credentials, caching, configuration, observability, resource limits, local platform and cost constraints, the Golden test suite, and evidence of verification.

This document is derived from the approved Spec 1 and does not replace it. The authority, status, and conventions follow in the next section.

## Authority and status

- Source of truth: #[[file:docs/specs/spec-1-evidence-retrieval.md]] (SEAN-SPEC-01, Version 2.4, Status Approved).
- Architecture: #[[file:docs/architecture/architecture-and-project-setup.md]] (Version 1.4, Status Approved).
- Related decisions: #[[file:docs/development/d01-dependency-decision-record.md]] and #[[file:docs/development/d02-mcp-integration-decision-record.md]].
- This document is derived from Spec 1. It does not replace or amend Spec 1. If this document conflicts with Spec 1, Spec 1 wins, and the conflict must be reported before work continues.
- Requirement status: Native Spec requirements baseline. Approved for Requirements 2, 3, and 14 by OD-16 (2026-11-10, phase-status section 23), and for the Requirement 4 items cited by Tasks 7.1 and 7.3 by the scoped approval in phase-status section 9.2. Other requirements derive from Spec 1 v2.4 (Approved) and are implemented under the owner implementation directives recorded in phase-status. Task state is recorded in phase-status and the Phase 3 closure report, and the Phase 3 closure is recorded in phase-status section 42.
- Section references such as "§10.4" point to Spec 1 unless another document is named.

## Glossary

- **Retrieval status:** `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, or `FAILED` (Spec 1 §10.2). It describes how a retrieval went.
- **Epistemic classification:** `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, or `INSUFFICIENT_EVIDENCE` (Spec 1 §10.1). It describes what the evidence supports.
- **Investigation conclusion:** the explanation part of an investigation result, present only when the evidence supports it (Spec 1 §10.3).
- **Registered repository:** a local Git repository whose stable namespace (`repository_id`) and root are recorded in the local JSON configuration file outside the repository (see design.md, Repository registration and selection; owner decision E-D1, closed).

## Requirements

### Requirement 1: Repository identification

**User Story:** As an engineer, I want Sean to identify the repository under investigation, so that all evidence is tied to one stable repository identity.

#### Acceptance Criteria

1. WHEN a repository is selected for investigation, THE SYSTEM SHALL resolve it to a stable repository namespace. (Spec 1 FR-01, §8)
2. WHEN the same source identifier appears in two different repositories, THE SYSTEM SHALL treat the two evidence items as distinct. (Spec 1 §8)
3. IF the `repository_id` is not registered, THEN THE SYSTEM SHALL return `REPOSITORY_NOT_FOUND` and perform no retrieval. IF a registered root is unavailable at call time, THEN THE SYSTEM SHALL return `REPOSITORY_UNAVAILABLE`. (Spec 1 §22; design.md, Repository registration and selection)
4. THE SYSTEM SHALL accept only a `repository_id` from an external caller. It SHALL NOT accept a repository location, path, or URL from any HTTP or MCP caller. (Spec 1 §13, §22; D02 §16.0)
5. THE SYSTEM SHALL register repositories only through the local JSON configuration file `%LOCALAPPDATA%\Sean\config\repositories.json`, outside the repository. No HTTP route, MCP tool, or interface action SHALL register, change, or remove a repository. (Spec 1 §22; Architecture §8; design.md, owner decision E-D1)
6. WHEN a registered repository's root is checked, THE SYSTEM SHALL compare resolved paths, and SHALL resolve the root again at each call. (Spec 1 §13; design.md, Repository registration and selection)
7. THE SYSTEM SHALL record the GitHub owner and name explicitly in each registry entry that uses GitHub retrieval. It SHALL NOT derive them from a Git remote. (DEC-4; design.md, GitHub design)

### Requirement 2: Target resolution

**User Story:** As an engineer, I want Sean to resolve my target to the code it refers to, so that the investigation starts from a correct context.

#### Acceptance Criteria

1. WHEN a target is given, THE SYSTEM SHALL normalize its repository-relative path before resolution. (Spec 1 §5)
2. WHEN several candidates match a target, THE SYSTEM SHALL report the ambiguity with its candidates and SHALL NOT select one silently. (Spec 1 §5)
3. WHEN a target does not exist in the current repository state, THE SYSTEM SHALL continue the historical search, because a current location is not the historical location. (Spec 1 §5)
4. THE SYSTEM SHALL validate symbol and file inputs before using them. (Spec 1 §13)

### Requirement 3: Historical retrieval

**User Story:** As an engineer, I want Sean to search the repository's history, including code that no longer exists, so that I can see how a behavior came to be.

#### Acceptance Criteria

1. WHEN history is retrieved, THE SYSTEM SHALL include relevant deleted, renamed, moved, copied, reverted, and replaced changes where the Git history permits. (Spec 1 FR-03, §6)
2. WHEN history is incomplete because of a shallow clone, missing branches, unavailable objects, or a history boundary, THE SYSTEM SHALL report that limitation explicitly. (Spec 1 §6)
3. WHEN a Git heuristic is used for rename or copy detection, THE SYSTEM SHALL record that the detection is heuristic. (Spec 1 §6)
4. THE SYSTEM SHALL NOT infer that a commit caused a behavior because the commit occurred near the time the behavior appeared. (Spec 1 §6, §2)

### Requirement 4: Evidence provenance and identity

**User Story:** As an engineer, I want every evidence item to show where it came from, so that I can verify it myself.

#### Acceptance Criteria

1. THE SYSTEM SHALL give every evidence item the fields that apply to its source, including source type, source identifier, URL when available, file path or code region, author, timestamp, excerpt, retrieval method, integrity metadata, and limitations. (Spec 1 §8)
2. THE SYSTEM SHALL distinguish the source types Git commit, Git blame, pull request, issue, documentation, and code history. (Spec 1 §8)
3. WHEN metadata cannot be retrieved, THE SYSTEM SHALL mark it unavailable and SHALL NOT replace it with a default value. (Spec 1 §8)
4. THE SYSTEM SHALL keep unavailable metadata distinct from verified absence. (Spec 1 §8)
5. THE SYSTEM SHALL derive evidence identifiers from the repository namespace and source-specific identifiers, and SHALL NOT derive them from titles, descriptions, or mutable content. (Spec 1 §8)
6. WHERE repository documentation relates to the target's history, THE SYSTEM SHALL return it as `DOCUMENTATION` evidence with its commit and path. Where no documentation evidence is found, THE SYSTEM SHALL NOT claim any. (Spec 1 §2, §8; Spec 2 §9.3)

### Requirement 5: External references

**User Story:** As an engineer, I want pull requests and issues linked to evidence only when they are validated, so that a linked reference can be trusted.

#### Acceptance Criteria

1. WHEN a pull request or issue reference is associated with evidence, THE SYSTEM SHALL validate it against the repository identity first. (Spec 1 FR-04, §7)
2. THE SYSTEM SHALL preserve the source URL and source identifier of each validated reference. (Spec 1 §7)
3. THE SYSTEM SHALL NOT treat a commit reference and a pull request reference as establishing the same fact. (Spec 1 §7)
4. WHEN a private record cannot be accessed, THE SYSTEM SHALL NOT report that the record does not exist. (Spec 1 §7)

### Requirement 6: Deterministic ranking

**User Story:** As an engineer, I want the same question on the same repository state to produce the same ordering, so that results are reproducible.

#### Acceptance Criteria

1. WHEN the same repository state, query, and configuration are given, THE SYSTEM SHALL produce the same ranking. (Spec 1 FR-06, §9)
2. WHEN two evidence items have equal scores, THE SYSTEM SHALL break the tie with a deterministic rule. (Spec 1 §9)
3. WHEN metadata is missing, THE SYSTEM SHALL NOT count the absence as positive evidence. (Spec 1 §9)
4. THE SYSTEM SHALL retain, for each ranked item, enough information to explain its score. (Spec 1 §9)
5. THE SYSTEM SHALL NOT use ranking to decide epistemic classification. (Spec 1 §9, §10)

### Requirement 7: Epistemic classification

**User Story:** As an engineer, I want to know whether the evidence documents a fact or only supports an interpretation, so that I do not mistake speculation for history.

#### Acceptance Criteria

1. THE SYSTEM SHALL support the classifications `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, and `INSUFFICIENT_EVIDENCE`. (Spec 1 §10.1)
2. THE SYSTEM SHALL describe classification as what the evidence supports, not as whether the retrieval executed successfully. (Spec 1 §10.1)
3. WHEN a result is classified `DOCUMENTED` or `INFERRED`, THE SYSTEM SHALL include supporting evidence for it. (Spec 1 §10.4)
4. THE SYSTEM SHALL NEVER present speculation as historical intent. (Spec 1 §2)

### Requirement 8: Retrieval status

**User Story:** As an engineer, I want to know whether Sean finished its retrieval, so that I can tell an incomplete search from a complete one.

#### Acceptance Criteria

1. THE SYSTEM SHALL support the retrieval statuses `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, and `FAILED`. (Spec 1 §10.2)
2. THE SYSTEM SHALL represent `COMPLETE` as meaning that the planned operations finished, and SHALL NOT claim that every historical source was found. (Spec 1 §10.2)
3. THE SYSTEM SHALL keep retrieval status and epistemic classification as separate fields in every result. (Spec 1 §10.2, FR-08)

### Requirement 9: Investigation result structure and consistency

**User Story:** As an engineer, I want a result whose parts agree with one another, so that a contradictory result cannot look like an answer.

#### Acceptance Criteria

1. THE SYSTEM SHALL return an investigation result containing the fields listed in Spec 1 §10.3, including identifier, target, repository identity, retrieval status, classification when classified, conclusion when supported, limitations, and source references. (Spec 1 §10.3)
2. IF a retrieval status is `FAILED`, THEN THE SYSTEM SHALL NOT present it as a successful historical conclusion, and SHALL NOT assign an epistemic classification to it. (Spec 1 §10.4)
3. WHEN a result is classified `PARTIAL_EVIDENCE`, THE SYSTEM SHALL identify the supported portion and the limitations. (Spec 1 §10.4)
4. WHEN a retrieval status is `PARTIAL` or `INSUFFICIENT`, THE SYSTEM SHALL expose the coverage limitations. (Spec 1 §10.4)
5. IF the backend detects an invalid or contradictory result, THEN THE SYSTEM SHALL return a safe structured error or an unresolved result, and SHALL NOT change the classification silently. (Spec 1 §10.4)
6. THE SYSTEM SHALL NOT represent a cancelled investigation as a completed historical result. (Spec 1 §10)
7. THE SYSTEM SHALL return the HTTP investigation result in the shape defined by the canonical contract in design.md (section "Shared integration contract (canonical)"). The Ouija Experience spec consumes that shape and does not define it. (Spec 1 §10.3; Spec 2 §18.1)
8. THE SYSTEM SHALL classify every failure as a category A investigation result, a category B request-level error, or a category C invalid internal result, as defined in design.md (C.5). It SHALL NOT represent one failure in two shapes. (Spec 1 §10.4; Spec 2 §18.7)

### Requirement 10: Deterministic explanation

**User Story:** As an engineer, I want a useful explanation without any AI service, so that Sean works offline and without paid services.

#### Acceptance Criteria

1. THE SYSTEM SHALL generate a structured explanation from verified evidence fields without an AI provider. (Spec 1 FR-09, §11.1)
2. WHEN evidence is insufficient, THE SYSTEM SHALL abstain from a conclusion. (Spec 1 §11.1, §23.13)
3. THE SYSTEM SHALL include source references and relevant limitations in every explanation. (Spec 1 §11.1)

### Requirement 11: Optional AI assistance

**User Story:** As an engineer, I want an optional AI component to improve wording only, so that AI never changes the facts.

#### Acceptance Criteria

1. WHERE an AI provider is configured, THE SYSTEM SHALL use it only to improve the wording of the deterministic result. (Spec 1 §11.2)
2. THE SYSTEM SHALL NOT allow optional AI to add facts, source references, causal relationships, classifications, retrieval statuses, or removed limitations. (Spec 1 §11.2)
3. IF the AI provider is unavailable, disabled, or returns an invalid response, THEN THE SYSTEM SHALL return the deterministic explanation. (Spec 1 §11.3, §23.11)
4. THE SYSTEM SHALL NOT report the absence of AI as a retrieval failure. (Spec 1 §11.3)

### Requirement 12: Failure semantics

**User Story:** As an engineer, I want a failed search to be distinguishable from an empty history, so that I do not conclude that no evidence exists.

#### Acceptance Criteria

1. WHEN retrieval fails, THE SYSTEM SHALL report the failure separately from any classification. (Spec 1 §10.3)
2. THE SYSTEM SHALL NOT represent a failed retrieval as proof that historical evidence does not exist. (Spec 1 §23.14)
3. WHEN evidence is insufficient, THE SYSTEM SHALL make an explicit abstention and SHALL NOT produce a fabricated explanation. (Spec 1 §23.13)

### Requirement 13: MCP access

**User Story:** As a Kiro user, I want Sean's investigation capabilities exposed through MCP, so that Kiro can use them, without a second implementation.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose the four tools `search_history`, `blame_range`, `get_pr`, and `get_issue`. (Spec 1 §12, FR-10)
2. THE SYSTEM SHALL implement each MCP tool by calling the same application logic that the HTTP API calls. (Spec 1 §12, §16; Architecture §5)
3. THE SYSTEM SHALL NOT expose any tool that modifies the repository, commits, pushes, or rewrites history. (Spec 1 §12, §13)
4. WHEN an MCP tool receives input, THE SYSTEM SHALL validate it and return explicit structured errors. (Spec 1 §12)
5. THE SYSTEM SHALL keep its MCP transport subject to compatibility verification with the installed Kiro version before configuration is enabled. (Spec 1 §12; Architecture §12.2; D02)
6. THE SYSTEM SHALL return from each MCP retrieval tool the evidence records and a retrieval status only. It SHALL NOT return an epistemic classification or an investigation conclusion from any MCP tool. (Spec 1 §10, §12; design.md, Separation of evidence retrieval and classification)
7. THE SYSTEM SHALL keep `.kiro/settings/mcp.json` unchanged during Phase 2. The owner decided, and accepted the documented deviation from Architecture §12.2, to keep it until the MCP module is implemented. Its launch entry names `app.modules.mcp`, which does not exist. The production MCP server is not functional, and nothing in Phase 2 may start or test that module. Validating or correcting the file is MCP implementation task 17.5. Runtime enablement in Kiro waits for D02 closure and Architecture §12.2. The conventional MCP approach remains in force, and Kiro Powers are not part of Sean. (design.md, DEC-13; D02 §12.2)
8. WHEN `blame_range` receives a `revision`, THE SYSTEM SHALL accept only a full object name of 40 (SHA-1) or 64 (SHA-256) lowercase hexadecimal characters. WHEN `revision` is omitted, THE SYSTEM SHALL use HEAD. THE SYSTEM SHALL reject branch names, tags, abbreviated SHAs, and expressions before any Git call. (DEC-14; D02 §16.6)

### Requirement 14: Repository access and path security

**User Story:** As a user, I want Sean to read only the repository I selected, so that a crafted input cannot reach other files.

#### Acceptance Criteria

1. THE SYSTEM SHALL keep repository investigation read-only, and SHALL NOT modify tracked files, refs, the index, the working tree, or repository configuration. (Spec 1 §13)
2. THE SYSTEM SHALL normalize every path and constrain it to the selected repository. (Spec 1 §13)
3. THE SYSTEM SHALL check path containment on resolved filesystem paths, including symbolic links and Windows junctions, and SHALL NOT rely on string-prefix comparison. (Spec 1 §13, §23.17)
4. THE SYSTEM SHALL reject traversal outside the repository. (Spec 1 §13)
5. THE SYSTEM SHALL treat repository content as untrusted input. (Spec 1 §13)
6. THE SYSTEM SHALL reject a path that fails the lexical rules in design.md (C.3a) or that resolves outside the registered root, as a request-level error. It SHALL NOT use such a path for retrieval and SHALL NOT present a conclusion for it. (Spec 1 §13, §23.17)
7. THE SYSTEM SHALL NOT disclose whether a rejected path exists outside the repository. (Spec 1 §13)

### Requirement 15: Safe subprocess execution

**User Story:** As a user, I want Git commands to run safely, so that a repository cannot run code on my machine.

#### Acceptance Criteria

1. THE SYSTEM SHALL invoke subprocesses with argument arrays and SHALL NOT use a shell. (Spec 1 §13)
2. THE SYSTEM SHALL apply a timeout and a bounded output size to every external process. (Spec 1 §13, §23.19)
3. THE SYSTEM SHALL NOT execute repository-provided scripts, Git hooks, or arbitrary build or test commands. (Spec 1 §13, §23.18)
4. THE SYSTEM SHALL disable or avoid Git options that can run external programs when retrieval does not need them. (Spec 1 §13)
5. THE SYSTEM SHALL set an explicit working directory and a controlled environment for Git subprocesses. (Spec 1 §13)
6. IF a subprocess fails, THEN THE SYSTEM SHALL report the error without exposing environment values. (Spec 1 §13)

### Requirement 16: Network use and credentials

**User Story:** As a user, I want public repositories to work without a token, and I want any token I supply to stay private, so that credentials are never required and never exposed.

#### Acceptance Criteria

1. THE SYSTEM SHALL apply timeouts, request limits, and response-size bounds to every GitHub API request. (Spec 1 §13)
2. THE SYSTEM SHALL respect GitHub rate limits and report rate-limit failures as retrieval limitations. (Spec 1 §7, §13)
3. THE SYSTEM SHALL NOT require a GitHub token for public repositories. (Spec 1 §13)
4. IF a token is configured, THEN THE SYSTEM SHALL use it only for its intended API access and SHALL NOT log, return, or store it in evidence. (Spec 1 §13)
5. THE SYSTEM SHALL NOT require network access for local Git retrieval. (Spec 1 §3.2)

### Requirement 17: Caching and persistence

**User Story:** As a user, I want cached data to speed up repeated work without ever presenting stale data as current, so that repeated work is faster without losing the distinction between cached and current data.

#### Acceptance Criteria

1. THE SYSTEM SHALL use SQLite as its MVP persistence and cache. (Spec 1 §14)
2. THE SYSTEM SHALL retain the repository and source identity with every cache entry. (Spec 1 §14)
3. THE SYSTEM SHALL define cache invalidation rules explicitly and SHALL NOT convert stale data into verified current data. (Spec 1 §14)
4. WHEN the cache is unavailable or corrupted, THE SYSTEM SHALL keep core local Git retrieval working. (Spec 1 §14; Architecture §14)

### Requirement 18: Configuration

**User Story:** As a maintainer, I want all runtime settings in one configuration area, so that behavior is predictable and secrets stay out of the repository.

#### Acceptance Criteria

1. THE SYSTEM SHALL support configuration for local repository selection, Git availability, GitHub access, SQLite data location, cache behavior, retrieval limits and timeouts, optional AI, and MCP runtime. (Spec 1 §22)
2. THE SYSTEM SHALL perform core retrieval without AI configuration or credentials. (Spec 1 §22, §23.10)
3. THE SYSTEM SHALL NOT allow repository content to override security settings or execute commands. (Spec 1 §22)
4. THE SYSTEM SHALL NOT store secrets in the repository. (Spec 1 §22)

### Requirement 19: Observability

**User Story:** As a maintainer, I want enough diagnostic information to understand a retrieval, without leaking sensitive data, so that I can diagnose a retrieval without exposing credentials or repository content.

#### Acceptance Criteria

1. THE SYSTEM SHALL record the investigation identifier, repository identity, retrieval operations attempted, retrieval status, evidence count, ranking outcome, classification, AI availability, duration, and error categories. (Spec 1 §20)
2. THE SYSTEM SHALL NOT log credentials, tokens, or unnecessary sensitive repository content. (Spec 1 §20)

### Requirement 20: Performance and resource limits

**User Story:** As a user on a normal workstation, I want retrieval to stay within bounded time and memory, so that Sean stays responsive and predictable on my machine.

#### Acceptance Criteria

1. THE SYSTEM SHALL limit history search scope where appropriate and apply timeouts to expensive operations. (Spec 1 §21)
2. THE SYSTEM SHALL NOT load entire repositories into memory unnecessarily. (Spec 1 §21)
3. WHERE a result is partial but safe and useful, THE SYSTEM SHALL return it and identify the incomplete part. (Spec 1 §21)
4. THE SYSTEM SHALL NOT treat any performance target as validated until it is measured against representative repositories. (Spec 1 §21)

### Requirement 21: Local platform and cost constraints

**User Story:** As a developer, I want Sean to run locally on Windows at no cost, so that it depends on no paid service.

#### Acceptance Criteria

1. THE SYSTEM SHALL run locally on Windows without a mandatory paid service, paid AI API, or cloud infrastructure. (Spec 1 §3.1, §3.2, §23.21)
2. THE SYSTEM SHALL keep the runtime to at most the backend and frontend development processes, and SHALL NOT add microservices. (Spec 1 §3.3, §3.4)

### Requirement 22: Golden test suite

**User Story:** As a maintainer, I want the historical behavior checked against a pinned public repository, so that retrieval claims are verifiable.

#### Acceptance Criteria

1. THE SYSTEM SHALL implement the Golden Test cases G01 to G10 against the baseline commit recorded in D03 (`docs/development/d03-golden-repository-and-baseline-decision-record.md`). The repository is `django/django`, and the owner approved the baseline commit `9e7cc2b628fe8fd3895986af9b7fc9525034c1b0` (Django 5.2 tag `5.2`). Golden cases are selected under D04. (Spec 1 §19, §23.20)
2. THE SYSTEM SHALL NOT report Golden Test results as validated until the tests have been built and executed against the pinned baseline. (Spec 1 §19)
3. Each Golden Test case SHALL define its repository and baseline, target, question, expected evidence, source references, retrieval status, classification, expected conclusion or abstention, limitations, and pass or fail criteria. (Spec 1 §19)

### Requirement 23: Evidence of verification

**User Story:** As a reviewer, I want every claim of success backed by an executed result, so that no unverified behavior is reported as working.

#### Acceptance Criteria

1. THE SYSTEM SHALL NOT report a test as passing unless it was executed and its result observed. (Spec 1 §18)
2. WHEN acceptance is assessed, THE SYSTEM SHALL base it on executed tests and observable behavior, not on documentation alone. (Spec 1 §23)
3. THE SYSTEM SHALL cover path containment, symbolic-link handling, subprocess safety, and status-classification separation with automated tests. (Spec 1 §18, §23.17)
