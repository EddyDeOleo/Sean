# Sean — Architecture & Project Setup

**Document ID:** SEAN-ARCH-001  
**Version:** 1.3  
**Status:** Approved  
**Supersedes:** Version 1.2  
**Project:** Sean  
**Tagline:** Summon the reasoning behind the code.

---

## 1. Purpose

This document defines Sean's implementation architecture, local development environment, technology choices, project organization, and Kiro engineering workflow.

It is the architectural reference for implementation and project initialization.

It does not replace the approved product specifications, engineering playbook, or operating guide.

The architecture must preserve the following principles:

- Zero-cost development.
- Local-first execution.
- Modular monolith.
- Minimal runtime processes.
- No speculative infrastructure.
- Provider-independent evidence retrieval.
- Incremental complexity.
- Human approval at defined engineering gates.
- Effective and deliberate use of Kiro's native capabilities.

## 2. Architectural Principles

### 2.1 Zero-Cost Development

The MVP must be developable and runnable without mandatory paid services, subscriptions, cloud infrastructure, or paid AI APIs.

Free tiers may be used as optional conveniences but must never become critical runtime dependencies.

The primary functionality must continue working when external free-tier quotas are exhausted or unavailable.

Kiro credits are a development-tool resource, not a runtime dependency or a requirement for Sean's users. Credit efficiency must not compromise security, testing, or implementation quality.

### 2.2 Local-First

The MVP must run locally on Windows.

Repository inspection, evidence retrieval, ranking, classification, and the primary user experience must not depend on a hosted backend.

### 2.3 Modular Monolith

Sean uses one backend application with internally separated modules and one frontend application.

Modules represent meaningful capabilities and responsibilities, not arbitrary architectural layers.

The HTTP API and MCP interface must reuse the same application logic.

### 2.4 Minimal Runtime

Normal development uses no more than two persistent processes:

1. Python backend.
2. Frontend development server.

An MCP STDIO entry point may be launched independently by its host when needed. It must reuse the same backend modules and must not become a separately maintained service.

### 2.5 No Speculative Infrastructure

Do not introduce:

- Microservices.
- Kubernetes.
- Redis.
- Distributed queues.
- Cloud databases.
- Mandatory Docker.
- Additional backend services.
- Infrastructure without a demonstrated requirement.

### 2.6 Evidence Retrieval Independence

Evidence collection, ranking, and classification must work without an AI provider.

Any future AI-assisted explanation layer must remain optional, replaceable, and independent from the evidence retrieval mechanism.

The backend must produce a deterministic, evidence-grounded explanation when no AI provider is configured or available.

An optional AI provider may improve wording but must not invent facts, establish unsupported causal relationships, upgrade an epistemic classification, or conceal uncertainty.

### 2.7 Incremental Complexity

Implement the simplest design that satisfies approved requirements.

Introduce additional dependencies, modules, abstractions, agents, automation, and infrastructure only when a concrete need justifies them.

Do not create interfaces, factories, managers, providers, repositories, or wrappers merely to anticipate hypothetical future requirements.

## 3. Approved Product Constraints

The implementation must preserve these product principles:

- Evidence must be traceable to its original source.
- A commit proves that a change occurred, not necessarily why it occurred.
- Historical correlation must not be presented as causation.
- Documented facts, inferences, partial evidence, and insufficient evidence must remain distinct.
- Retrieval completeness and epistemic classification are separate dimensions.
- Sean must be able to abstain when evidence is insufficient.
- Repository content is untrusted input.
- Repository inspection is read-only in the MVP.
- Historical examples used during design are not verified evidence unless independently validated.
- The interface must never fabricate historical details to improve its presentation.
- A retrieval failure must not be presented as proof that historical evidence does not exist.
- An AI-generated explanation must never be treated as stronger evidence than its underlying sources.

The four epistemic classifications are:

- `DOCUMENTED`
- `INFERRED`
- `PARTIAL_EVIDENCE`
- `INSUFFICIENT_EVIDENCE`

Retrieval status is an independent dimension:

- `COMPLETE`
- `PARTIAL`
- `INSUFFICIENT`
- `FAILED`

These values must not be merged into a single status field.

## 4. Technology Stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | React + TypeScript + Vite | Local web interface |
| Styling | Tailwind CSS + native CSS where necessary | Visual system, layout, and specialized Ouija interactions |
| Backend | Python + FastAPI | Application API |
| Validation | Pydantic | Typed request and response contracts |
| Version history | Git CLI | Repository history retrieval |
| External metadata | GitHub REST API | Pull request and issue metadata |
| Persistence | SQLite | Local metadata and cache |
| MCP | Official Python MCP SDK | MCP integration |
| Backend testing | pytest + Hypothesis | Unit, integration, and property-based testing |
| Frontend testing | Vitest | Component and logic tests |
| E2E testing | Playwright | Browser-level verification |
| Python environment | venv + pip | Backend development |
| Frontend packages | npm | Frontend dependency management |

Tailwind CSS is the primary styling system. Native CSS is permitted for global styles, specialized animations, browser-specific behavior, and cases where it is simpler or more appropriate.

Do not introduce another styling framework without explicit approval.

Exact supported versions, dependency pins, and Windows compatibility must be verified before project initialization.

No AI provider is mandatory.

No Docker installation is required.

No cloud hosting is required.

## 5. High-Level Architecture

Sean has two principal user-facing areas:

- Evidence and historical information on the left.
- The Ouija board on the right.

The Ouija board is the primary interaction surface. The evidence area provides the supporting historical material and technical explanation.

```text
┌──────────────────────────────────────────────────────────────────────┐
│ SEAN                         REPOSITORY                 CONNECTION   │
├────────────────────────────────────┬─────────────────────────────────┤
│                                    │                                 │
│          EVIDENCE & HISTORY        │           OUIJA BOARD            │
│                                    │                                 │
│  Evidence cards                    │  User question                   │
│  Introducing commit               │  Invocation control              │
│  Pull request                     │  Ouija board                     │
│  Issue                             │  Planchette                      │
│  Documentation                    │  Revealed conclusion             │
│  Code history                     │  Epistemic classification        │
│  Selected source details           │                                 │
│  Technical explanation             │                                 │
│                                    │                                 │
└────────────────────────────────────┴─────────────────────────────────┘
```

The diagram is conceptual. Exact proportions, spacing, typography, and responsive behavior belong to Spec 2.

### 5.1 Frontend and Backend Relationship

```text
┌────────────────────────────────────────────────────────────┐
│                      Sean Frontend                         │
│                                                            │
│     Evidence & History             Ouija Board              │
│                                                            │
│                React + TypeScript + Vite                   │
└─────────────────────────────┬──────────────────────────────┘
                              │ HTTP API
┌─────────────────────────────▼──────────────────────────────┐
│                      Sean Backend                          │
│                        FastAPI                             │
│                                                            │
│  API                                                       │
│   ├── Repository                                            │
│   ├── Symbol Resolution                                     │
│   ├── Git History                                           │
│   ├── GitHub                                                │
│   ├── Evidence                                              │
│   ├── Investigation                                         │
│   ├── Explanation                                           │
│   ├── Persistence and Cache                                 │
│   └── MCP adapters                                          │
│                                                            │
│              Shared application logic                      │
└───────────────┬──────────────────────────┬─────────────────┘
                │                          │
           Local Git Repo             GitHub REST API
                │
              SQLite
```

The MCP adapter exposes selected backend capabilities through MCP.

It must call the same application logic used by the HTTP API.

No duplicate business logic is permitted between the HTTP and MCP interfaces.

## 6. Frontend Layout and Responsibilities

### 6.1 Two-Zone Desktop Composition

The desktop reference layout consists of exactly two principal zones.

**Left zone — Evidence and History**

Contains:

- Evidence cards.
- Source references.
- Introducing commits.
- Relevant follow-up commits.
- Pull requests.
- Issues.
- Documentation references.
- Code history and blame ranges.
- Selected source details.
- Technical explanation and historical sequence.

**Right zone — Ouija Board**

Contains:

- Repository context where appropriate.
- Investigation question.
- Invocation control.
- Ouija board.
- Planchette.
- Movement and reveal states.
- Final conclusion when supported by evidence.
- Epistemic classification and investigation status.

The board must retain visual priority within the interaction experience.

The evidence area must remain readable and useful without competing with the board.

A header, navigation strip, or status indicator does not constitute a third primary content zone.

### 6.2 Evidence and Explanation Relationship

The left area is not merely a list of links.

It must support technical investigation by presenting source material and its relationship to the reconstructed explanation.

Selecting an evidence card must allow the user to inspect its corresponding source details within the left area.

The explanation must distinguish:

- Directly documented information.
- Sean's interpretation or inference.
- Missing information.
- Retrieval limitations.

The interface must not duplicate entire evidence descriptions unnecessarily.

Source-faithful technical text and code must be rendered as actual selectable and readable application content, not as generated images.

### 6.3 Responsive Behavior

The two-zone layout is the desktop reference.

On narrower screens:

- Stack the two zones vertically rather than forcing two narrow columns.
- Preserve the Ouija board as the primary interaction surface.
- Keep evidence and historical information accessible.
- Preserve selected evidence when changing layouts.
- Avoid major layout shifts during the reveal sequence.
- Maintain readable source content and technical explanations.

Responsive behavior must be verified at representative desktop, tablet, and mobile widths.

### 6.4 Frontend State

Use native React state and `useReducer` initially.

Do not introduce Redux, Zustand, or XState unless measured complexity demonstrates a need.

Investigation state, selected evidence, and animation state must have clear ownership.

The frontend must not independently invent investigation outcomes or reinterpret backend classifications.

The UI must represent retrieval status and epistemic classification as separate values.

### 6.5 Investigation and Reveal Behavior

The Ouija experience must follow the approved interaction model in Spec 2:

1. Invocation begins after the user submits an investigation question.
2. The planchette movement reflects actual investigation progress and frontend state.
3. The reveal is cinematic and deliberate, not a random or simulated search.
4. The complete supported phrase is revealed after the planchette settles; the MVP does not use letter-by-letter spelling.
5. Evidence becomes visible in the left zone after the reveal sequence reaches the appropriate state.

If evidence is insufficient to support a historical conclusion, the board must not simulate an answer about developer intent.

It may display a neutral system-status phrase such as `INSUFFICIENT EVIDENCE`. This phrase communicates the investigation result, not a historical conclusion.

If retrieval fails, the UI must communicate a retrieval failure rather than implying that no historical evidence exists.

A partial retrieval must be visibly distinguished from a complete investigation.

Detailed state transitions, animation timing, sound behavior, accessibility, and interaction acceptance criteria are defined in Spec 2.

### 6.6 Animation and Audio

Use CSS and browser-native APIs for the MVP animation system.

Do not add a dedicated animation library unless a concrete implementation requirement demonstrates that native capabilities are insufficient and the dependency is approved.

The planchette movement must be state-driven and deterministic for a given UI state.

Respect reduced-motion preferences and provide an option to skip the animation.

Audio is included in the MVP interaction experience but must be disabled by default.

Provide mute and volume controls. Use original or appropriately licensed assets. Do not introduce a paid audio service or remote runtime dependency.

## 7. Backend Module Boundaries

The backend retains the `backend/app/` organization.

Proposed modules:

| Module | Responsibility |
|---|---|
| `api` | FastAPI routes, HTTP transport, and request/response handling |
| `core` | Shared configuration, logging, common application utilities, and foundational concerns |
| `repository` | Local repository discovery, identity, validation, and safe path handling |
| `symbol_resolution` | Symbol identification, source context, and relevant code-region resolution |
| `git_history` | Git commands, commits, blame, diffs, renames, deletions, moves, and historical retrieval |
| `github` | External pull request and issue metadata retrieval and reference validation |
| `evidence` | Evidence models, normalization, identity, integrity, deduplication, ranking, and evidence-related validation |
| `investigation` | Retrieval orchestration, retrieval status, epistemic classification, and investigation result assembly |
| `explanation` | Deterministic explanation synthesis from verified evidence and optional AI-assisted wording |
| `mcp` | MCP tool definitions, transport entry point, and adapters that reuse application logic |

SQLite persistence and caching should remain simple internal responsibilities of the relevant modules or a cohesive persistence component when implementation demonstrates the need.

Do not create a separate persistence framework or additional abstraction layer solely to mirror a conventional architecture pattern.

These module boundaries are logical responsibilities, not a mandate to create additional abstraction layers.

A module may contain a small number of cohesive files.

The implementation must remain aligned with the responsibilities defined in Spec 1. If an implementation detail appears to conflict with an approved functional requirement, resolve the conflict before implementation rather than silently changing the requirement.

Do not introduce interfaces, factories, managers, adapters, or wrappers without a concrete requirement.

## 8. Local Data and Repository Locations

Sean's application data must not be stored inside the source repository by default.

Default Windows data root:

`%LOCALAPPDATA%\Sean\`

The implementation may create dedicated subdirectories for:

- SQLite database.
- Cache.
- Application logs.
- Temporary investigation data.

The exact directory layout must be documented when persistence is implemented.

Repository working trees remain in user-selected locations.

Sean must not silently copy, modify, or relocate repositories.

## 9. Git Integration

Git CLI is the primary source for local repository history.

Requirements:

- Invoke Git using safe subprocess argument lists.
- Never interpolate untrusted user or repository content into shell commands.
- Avoid shell execution where direct process invocation is possible.
- Apply timeouts and bounded output.
- Validate repository roots and paths.
- Apply symlink-aware path validation.
- Treat commit messages, paths, diffs, and source content as untrusted.
- Do not execute repository scripts, hooks, or build commands.
- Do not modify repository files, refs, index, or working tree in the MVP.

Git history retrieval must account for renames, deletions, moves, copied code, reverts, and replacements within the limitations documented in Spec 1.

The implementation must not imply that Git history can always establish the original developer's intent.

## 10. GitHub Integration

Use the public GitHub REST API for pull request and issue metadata.

Requirements:

- Public repositories must work without authentication when API limits permit.
- An optional user-provided token may improve rate limits.
- A token must not be required for the primary local Git workflow.
- Never commit tokens or secrets.
- Do not expose tokens in logs, error messages, or agent context.
- Cache metadata with explicit freshness and failure states.
- Validate PR and issue references against the expected repository.
- Distinguish unavailable metadata from nonexistent references and API failures.

The core evidence retrieval workflow must remain useful when GitHub is unavailable.

## 11. Persistence

SQLite is sufficient for the MVP.

Persist only data with a clear product or performance purpose, such as:

- Repository metadata.
- External metadata cache.
- Investigation records where needed.
- Evidence references and retrieval metadata where needed.

Avoid duplicating Git history in SQLite unless a measured performance requirement justifies indexing it.

The cache must be rebuildable.

Cache corruption or deletion must not destroy source repositories or make evidence permanently inaccessible.

## 12. MCP Integration

MCP is an integration interface, not a reason to create another backend service.

The Python MCP entry point must:

- Reuse backend application and domain modules.
- Expose only documented, read-only tools in the MVP.
- Validate all inputs.
- Return structured outputs with explicit retrieval status.
- Avoid duplicating retrieval or ranking logic.
- Use STDIO for local host integration where supported.

The HTTP API and MCP interface must call the same application logic.

### 12.1 Two Separate MCP Purposes

The project has two distinct MCP concerns:

**A. Sean as an MCP provider**

Sean may expose its own repository investigation capabilities as MCP tools for compatible clients.

**B. Kiro as an MCP client**

Kiro may connect to external MCP servers to extend its engineering workflow.

These purposes must not be conflated.

Sean's MCP server is a product integration.

External MCP servers are optional engineering tools.

Neither justifies a separate persistent backend service.

### 12.2 MCP Configuration Gate

Do not configure Sean's MCP entry point in Kiro until:

1. The entry point exists.
2. Tool contracts are implemented.
3. Input validation is verified.
4. Security behavior is tested.
5. Read-only behavior is confirmed.
6. Windows host compatibility is verified.

Do not create an empty MCP configuration merely to reserve a future integration.

## 13. Kiro Engineering Strategy

Kiro is the primary engineering environment for Sean.

Kiro IDE is the main workspace. Kiro CLI is a complementary interface for suitable terminal-based workflows.

Kiro capabilities are part of the engineering process, not runtime dependencies of Sean.

The strategy is to use native capabilities deliberately, with human review, least privilege, and controlled context.

The installed environment identified for this project is:

- Kiro IDE: `1.4.121`
- Kiro Agent: `0.66.89`
- VS Code base: `1.131.0`

These version identifiers do not, by themselves, prove that every capability or configuration described below is supported identically by the IDE and CLI. Exact behavior must be verified before relying on it.

### 13.1 Capability Adoption Matrix

| Kiro capability | Intended use in Sean | Adoption |
|---|---|---|
| Feature Specs | Requirements, design, and implementation tasks | Essential |
| Bugfix Specs | Root-cause analysis and regression prevention | Essential |
| Chat | Exploration and small, bounded changes | Essential |
| Steering | Persistent product, architecture, and engineering constraints | Essential |
| Hooks | Repeatable checks and event-driven safeguards | Gradual |
| MCP | Connect Kiro to external tools and expose Sean capabilities | Yes, with separate purposes |
| Permissions | Restrict agent access and sensitive operations | Essential |
| Custom agents | Focused review, testing, and security roles | Gradual |
| Agent Skills | Reusable engineering procedures | Yes |
| Powers | On-demand specialized knowledge and tools | Evaluate by need |
| Sub-agents | Independent analysis and bounded parallel reviews | Selective |
| Checkpoints and rewind | Recover or branch agent work | Use where supported |
| Kiroignore | Exclude secrets and sensitive local content from agent context | Essential |
| Compaction | Preserve productive long-session context | Use native capability |
| ACP integrations | Use Kiro through other editors or clients | Not required for MVP |

### 13.2 Feature Specs

Use Kiro Feature Specs for significant product capabilities.

Expected lifecycle:

1. Create or update a Kiro spec from approved product documentation.
2. Generate requirements.
3. Review requirements with the human owner.
4. Generate design.
5. Review design and architecture impact.
6. Generate implementation tasks.
7. Approve the task plan.
8. Implement incrementally.
9. Run required tests and verification.
10. Review the resulting changes.
11. Mark complete only when evidence supports completion.

Kiro-generated requirements, designs, and tasks do not automatically override approved product documents.

The approved documents in `docs/specs/` remain the product source of truth.

Kiro-native specifications in `.kiro/specs/` are derived implementation plans.

### 13.3 Bugfix Specs

Use Bugfix Specs for defects requiring root-cause analysis or regression prevention.

Expected lifecycle:

1. Reproduce and document the observed failure.
2. Identify the root cause.
3. Distinguish confirmed facts from hypotheses.
4. Define the smallest safe correction.
5. Add regression coverage.
6. Implement the fix.
7. Run targeted and relevant broader tests.
8. Review the diff and evidence.
9. Record remaining risks.

Do not create a full Feature Spec for every minor typo or trivial correction.

### 13.4 Chat

Use Chat for:

- Architecture exploration.
- Clarifying requirements.
- Small, low-risk changes within approved scope.
- Reviewing code or test output.
- Understanding Kiro behavior.

Chat must not become an excuse to bypass specification and approval gates for substantial work.

### 13.5 Steering

The current project Steering files are:

- `.kiro/steering/product.md`: purpose, product principles, evidence integrity, and epistemic boundaries.
- `.kiro/steering/architecture.md`: approved stack, architecture, module boundaries, and technical constraints.
- `.kiro/steering/engineering-standards.md`: testing, code quality, documentation, and engineering workflow.
- `.kiro/steering/security.md`: trust boundaries, secrets, subprocess safety, path validation, and security requirements.

Keep Steering concise and non-duplicative.

Use appropriate inclusion settings so that essential project constraints are available consistently without loading lengthy reference material unnecessarily.

Link to detailed documentation rather than copying entire specifications into every session.

Steering must reflect the actual approval status and version of each authoritative document. Do not describe a draft as approved.

### 13.6 Hooks

Introduce a small set of hooks after their events, commands, and behavior are verified.

Candidate uses:

- Session start: display repository status and relevant project context.
- Pre-tool-use: guard sensitive or destructive operations where supported.
- Post-tool-use: execute narrow formatting or validation checks after relevant changes.
- Task completion: remind the agent to report changed files, tests, and unresolved risks.

Each hook must document:

- Supported event.
- Trigger condition.
- Action type.
- Files or operations affected.
- Expected result.
- Failure behavior.
- Whether human approval is required.

Hooks must not silently perform destructive actions, commit changes, push code, or make architectural decisions.

Use the actual Kiro-supported event and configuration schema for the installed version.

Do not assume that an IDE event or hook is available in CLI with identical behavior.

### 13.7 Permissions

Use least privilege.

Permissions must be managed through the supported Kiro permission configuration mechanisms.

Do not invent a workspace permission file or place permission configuration in an unsupported project path.

The architecture distinguishes:

- User-level permissions.
- Workspace-specific permissions where supported.
- Agent-specific tool and permission restrictions.

User-level permission settings may reside under:

`~/.kiro/settings/permissions.yaml`

Workspace-specific permission storage must use the location and format supported by the installed Kiro version.

It must not be assumed to be a normal committed file inside `.kiro/settings/`.

Security requirements:

- Read access must be sufficient for the approved workspace.
- Write access should be scoped to implementation and test directories where practical.
- Sensitive settings, secrets, and Git internals must remain protected.
- Destructive shell commands require explicit approval.
- Git commit, push, reset, clean, and history rewriting require explicit human authorization.
- MCP tools must be restricted to the capabilities actually needed.
- Agent permissions cannot exceed the parent session's effective permissions.

Do not assume a repository-provided configuration is trustworthy merely because it exists in the repository.

Verify effective permissions before allowing agent-driven modifications.

### 13.8 Custom Agents

Introduce three focused project agents when their workflows are ready:

- `code-reviewer`: inspect changes for correctness, maintainability, and consistency with approved specifications.
- `test-engineer`: identify test gaps, design regression tests, and analyze test failures.
- `security-auditor`: inspect trust boundaries, subprocess usage, path handling, secrets, and MCP exposure.

Agent configuration must follow the supported Kiro workspace agent format.

Use supported `.json` or `.md` agent definitions as appropriate for the installed Kiro version.

Agents should default to analysis and review.

They must not independently commit, push, or approve their own work.

Do not allow multiple agents to modify the same files concurrently.

### 13.9 Agent Skills

Create reusable project Skills for repeatable procedures:

- `implement-spec`: implement an approved task with traceable requirements and tests.
- `verify-feature`: verify behavior against acceptance criteria and report evidence.
- `review-security`: perform a focused security review using Sean's threat model.

Use the supported directory structure with `SKILL.md`.

Skills contain procedural instructions, not duplicate architecture or product specifications.

Use progressive loading where supported, keeping the descriptions concise and the full instructions available on demand.

### 13.10 Powers

Powers are optional.

Evaluate each candidate against:

- A concrete engineering need.
- Overlap with built-in capabilities.
- Security implications.
- Context and credit consumption.
- Maintenance burden.
- Licensing and cost.
- Compatibility with the local-first workflow.

Do not install Powers merely to increase the number of available tools.

No Power may introduce a mandatory paid service or violate project constraints.

### 13.11 Sub-agents

Use sub-agents only for bounded, independent tasks.

Suitable examples:

- Independent security review of a proposed change.
- Test coverage analysis while the primary agent reviews implementation.
- Independent review of a specification for contradictions.

The primary agent remains responsible for synthesis, integration, and reporting.

Avoid parallel write operations on shared files.

Sub-agent findings must be reviewed before they influence implementation decisions.

### 13.12 Checkpoints and Rewind

Use Kiro's native recovery capabilities when available.

Distinguish:

- IDE checkpoints for recovering agent-driven changes.
- CLI rewind for conversation recovery or branching.
- CLI checkpoint functionality where supported by the installed version.

These capabilities are not substitutes for Git, backups, or human review.

Verify the actual recovery scope before relying on a checkpoint.

Changes made through external tools, terminal operations, or manual edits may not be covered by agent checkpoints.

Git remains the authoritative source-control mechanism.

### 13.13 Kiroignore

Maintain `.kiroignore` at the project root to exclude sensitive and irrelevant files from Kiro's agent context where supported.

At minimum, review exclusions for:

- `.env` and secret-bearing files.
- Local databases and caches.
- Logs and temporary data.
- Virtual environments.
- Package artifacts.
- Credentials and private keys.
- Generated files.
- User repository contents outside the Sean workspace.

Kiroignore complements, but does not replace, filesystem permissions and secret management.

Verify that the IDE's agent ignore-file setting is enabled and that the installed CLI version honors the intended exclusions.

Do not assume identical behavior across all Kiro clients.

Do not bypass Kiro's built-in protections or permission denials to create or modify an ignore file.

### 13.14 Compaction

Use Kiro's native context compaction for long sessions.

Before a major phase transition, preserve a concise durable summary containing:

- Current approved specifications and versions.
- Decisions and unresolved questions.
- Implemented and verified work.
- Current task and next action.
- Relevant test results.
- Known risks.
- Next authorized step.

Do not rely on conversational memory as the only record of project state.

### 13.15 ACP Integrations

ACP integrations are not required for the MVP because Kiro IDE and CLI are the selected development surfaces.

Reconsider ACP only if the workflow later requires another editor, client, or custom agent interface.

ACP and MCP are distinct protocols and must not be conflated.

## 14. Kiro Project Configuration Layout

The current project-level configuration uses the following paths:

```text
.kiro/
├── steering/
│   ├── product.md
│   ├── architecture.md
│   ├── engineering-standards.md
│   └── security.md
├── specs/
├── agents/
├── skills/
│   ├── implement-spec/
│   │   └── SKILL.md
│   ├── verify-feature/
│   │   └── SKILL.md
│   └── review-security/
│       └── SKILL.md
└── hooks/
```

Additional project-level file:

```text
.kiroignore
```

The tree describes the intended organization. It does not authorize creating empty directories or placeholder configurations.

MCP configuration must be added only when a concrete server integration is ready and its configuration schema has been verified.

Permission settings must use the supported user-level, workspace-specific, or agent-specific mechanisms. Do not add an invented `permissions.yaml` under `.kiro/settings/`.

The exact file extensions, event schemas, permission formats, and configuration locations must be checked against the installed Kiro IDE and CLI versions before authoring configuration.

Do not commit machine-specific credentials, user-level settings, or secrets.

## 15. Project Structure

The repository root is named exactly `Sean`.

The following is the intended organization, aligned with the existing scaffold and the approved module boundaries:

```text
Sean/
├── .kiro/
│   ├── steering/
│   ├── specs/
│   ├── agents/
│   ├── skills/
│   └── hooks/
├── docs/
│   ├── specs/
│   ├── architecture/
│   └── development/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── modules/
│   │   │   ├── repository/
│   │   │   ├── symbol_resolution/
│   │   │   ├── git_history/
│   │   │   ├── github/
│   │   │   ├── evidence/
│   │   │   ├── investigation/
│   │   │   ├── explanation/
│   │   │   └── mcp/
│   │   └── main.py
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── property/
│       └── golden/
├── frontend/
│   ├── public/
│   └── src/
│       ├── app/
│       ├── components/
│       │   ├── ouija/
│       │   ├── evidence/
│       │   └── layout/
│       ├── features/
│       ├── hooks/
│       ├── services/
│       ├── styles/
│       └── types/
├── scripts/
├── .gitignore
├── .kiroignore
└── README.md
```

This is a target organization, not an instruction to create all directories immediately.

The current scaffold may contain additional organizational placeholders. Do not migrate or rename established directories solely to match a conventional package layout.

Create feature-specific frontend files within `features/` when their implementation begins. Keep shared visual components in `components/` and shared hooks, services, styles, and types in their existing locations.

Audio-specific code may be organized within an appropriate feature when audio implementation begins. Do not create an empty audio directory in advance.

Create files and directories when their implementation phase begins.

Do not create empty feature modules, test suites, agents, hooks, or Skills before their purpose and contents are defined.

Use `.gitkeep` only when an intentionally empty directory must be preserved. Remove redundant placeholders when a directory receives real content.

The actual dependency manifests and package metadata must be created and verified as part of their corresponding implementation tasks.

## 16. Local Windows Development

The following commands are proposed for the selected `backend/app/` layout. They remain subject to validation against the actual package metadata and installed dependencies.

### 16.1 Backend Environment

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
```

Install the backend dependencies using the package metadata created for the project. Do not assume an editable-install command or a `dev` extra exists until it has been defined.

### 16.2 Frontend Environment

```powershell
cd frontend
npm install
```

### 16.3 Run Backend

From the `backend/` directory, the intended development entry point is:

```powershell
python -m uvicorn app.main:app --reload
```

This command assumes the FastAPI application is exposed as `app` from `backend/app/main.py` and that the package/import configuration has been verified.

### 16.4 Run Frontend

```powershell
cd frontend
npm run dev
```

These commands are proposed until package metadata, dependencies, ports, and supported runtime versions have been created and tested on the target Windows environment.

## 17. Testing Strategy

### 17.1 Backend

- pytest for unit and integration tests.
- Hypothesis for property-based tests.
- Golden tests using a pinned public repository and commit.
- Security tests for path containment, symlink handling, subprocess invocation, bounded output, untrusted content, and MCP input validation.
- Tests for retrieval status and epistemic classification as independent dimensions.
- Tests for deterministic explanation behavior when no AI provider is available.

### 17.2 Frontend

- Vitest for UI logic and component behavior.
- Playwright for end-to-end workflows.
- Accessibility and reduced-motion verification.
- Responsive layout checks.
- Deterministic animation-state tests.
- Investigation state transition tests.
- Evidence selection and source-detail consistency tests.
- Tests for insufficient evidence, partial retrieval, and retrieval failure presentation.
- Tests confirming that the UI does not fabricate conclusions.

### 17.3 Kiro Configuration Verification

Kiro configuration must also be tested operationally.

Verification must include:

- Steering files load as intended.
- Feature Specs and Bugfix Specs can be created and used.
- Agent definitions load correctly.
- Skills are discovered and their instructions load on demand.
- Hooks trigger only on intended events.
- Permissions restrict prohibited actions.
- Kiroignore exclusions are honored by the IDE and supported CLI workflows.
- MCP connections expose only intended tools.
- Checkpoint and rewind behavior is understood for the installed client.

A configuration file existing in the repository is not proof that Kiro recognizes or enforces it.

Do not claim a configuration is active until it has been tested in the corresponding Kiro client.

## 18. Security Baseline

- Read-only repository inspection.
- No execution of repository-controlled scripts or hooks.
- Safe subprocess invocation.
- Strict path containment.
- Symlink-aware path validation.
- Bounded process output and timeouts.
- No secrets in source control, logs, or agent context.
- Untrusted repository content must not become agent instructions.
- Validate external metadata against repository identity.
- Restrict MCP tools to explicit contracts and required capabilities.
- Require approval for destructive or irreversible operations.
- Apply least privilege to Kiro agents and tools.
- Verify effective permissions before agent-driven modifications.

Security controls must be enforced by the application and operating environment, not merely described in prompts.

## 19. Dependency Policy

Every new dependency must have a documented reason.

Evaluate:

- License.
- Maintenance and release activity.
- Security posture.
- Platform compatibility, especially Windows.
- Transitive dependency impact.
- Local execution and cost.
- Whether native platform capabilities already solve the problem.

Avoid dependencies that only wrap a trivial operation.

Pin or constrain versions appropriately once compatibility has been verified.

Do not add a dependency solely to satisfy a hypothetical future requirement.

## 20. Observability

Use structured application logs with appropriate redaction.

Logs must not expose:

- Tokens.
- Credentials.
- Full environment variables.
- Private repository content unnecessarily.
- Sensitive local paths beyond operational requirements.

Expose clear error categories and retrieval statuses to the UI without leaking internal stack traces.

Kiro task reports must distinguish:

- Implemented.
- Tested.
- Verified.
- Not verified.
- Blocked.
- Accepted.

An agent's assertion is not proof of successful execution.

## 21. Performance and Resource Constraints

The MVP must remain usable on a normal developer workstation.

- Bound Git history scans.
- Cache external metadata.
- Avoid full repository indexing by default.
- Use incremental retrieval where practical.
- Avoid background workers or queues until measurements justify them.
- Make long operations cancellable where supported.
- Report partial retrieval rather than silently truncating results.
- Avoid excessive frontend rendering during animation.
- Avoid unnecessary dependencies and persistent processes.

## 22. Cost and Context Efficiency

Kiro usage must be deliberate.

- Keep Steering concise.
- Load Skills on demand.
- Avoid loading entire repositories when a bounded file set is sufficient.
- Use targeted searches and inspections.
- Avoid repeating completed analysis without a reason.
- Use sub-agents only for independent tasks.
- Avoid parallel modifications to shared files.
- Use checkpoints before meaningful agent-driven changes where available.
- Prefer focused test execution during iteration and broader verification at appropriate gates.
- Preserve durable task summaries before long-session context limits are reached.
- Prefer manually prepared and reviewed documentation updates when they avoid unnecessary agent-driven rewrites.

Do not sacrifice security, testing, or code quality to reduce credit consumption.

## 23. License

MIT is the selected license.

The root `LICENSE` file must be created only after confirming the actual copyright holder and appropriate year.

Do not leave placeholders or invent an individual or organization as the copyright owner.

## 24. Architectural Decisions

| ID | Decision | Direction | Status |
|---|---|---|---|
| A01 | Architecture | Local-first modular monolith | Selected |
| A02 | Backend | Python + FastAPI | Selected |
| A03 | Frontend | React + TypeScript + Vite | Selected |
| A04 | Persistence | SQLite | Selected |
| A05 | Repository inspection | Git CLI | Selected |
| A06 | External metadata | GitHub REST API | Selected |
| A07 | MCP transport | Local STDIO, subject to host verification | Selected in principle |
| A08 | AI dependency | No mandatory provider; deterministic fallback required | Selected |
| A09 | Frontend state | Native React state and useReducer | Selected |
| A10 | Animation | CSS and browser-native APIs by default | Selected |
| A11 | Local data | `%LOCALAPPDATA%\Sean\` | Selected |
| A12 | Kiro workflow | Specs, Steering, Permissions, Kiroignore, Skills, selective Agents and Hooks | Selected |
| A13 | License | MIT; attribution pending | Selected |
| A14 | Documentation | README maintained as project documentation evolves | Selected |
| A15 | Desktop layout | Evidence and history left; Ouija board right | Selected |
| A16 | Kiro permissions | Supported user, workspace, and agent permission mechanisms | Selected in principle |
| A17 | Kiro agents | Three focused review agents | Selected in principle |
| A18 | Kiro Skills | Three reusable engineering procedures | Selected in principle |
| A19 | Kiro hooks | Small, verified automation set | Selected in principle |
| A20 | Kiro Powers | Evaluate only when a concrete need exists | Selected |
| A21 | Styling | Tailwind CSS with native CSS where necessary | Selected |
| A22 | Backend organization | Retain `backend/app/` and define cohesive module responsibilities | Selected |
| A23 | Frontend organization | Retain `frontend/src/` and organize implementation by features | Selected |
| A24 | MCP configuration | Defer until a functional server and verified contract exist | Selected |
| A25 | Empty directories | Do not create speculative empty directories or placeholders | Selected |
| A26 | Insufficient evidence UI | Show a neutral investigation status, not a simulated historical conclusion | Selected |

## 25. Implementation Gate

Implementation must not begin until:

1. This architecture document has been reviewed and approved.
2. Spec 1 is consolidated and approved.
3. Spec 2 is updated to match the approved two-zone layout and interaction behavior.
4. The engineering playbook and operating guide are available as project references.
5. The cross-document consistency review is complete.
6. Windows runtime versions and dependency compatibility are verified.
7. Kiro IDE and CLI versions are identified.
8. Kiro configuration formats and supported capabilities are verified against those versions.
9. The demo repository and pinned baseline are selected before Golden test implementation.
10. The MIT copyright holder is confirmed before creating the license file.

Approval of this architecture does not mean its commands, dependencies, or Kiro configurations have already been executed or experimentally verified.

No project initialization or implementation beyond the already authorized documentation and scaffold work is authorized by this document until the required approval gates have been completed.

---

**End of document.**

