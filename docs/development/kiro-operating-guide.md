# Sean — Kiro Operating Guide

**File:** `kiro-operating-guide.md`  
**Version:** 1.0  
**Status:** Approved  
**Project:** Sean  
**Primary Environment:** Kiro IDE on Windows  
**Secondary Environment:** Kiro CLI

---

## 1. Purpose

This document defines the practical operating procedures for using Kiro during Sean's development.

The Engineering Playbook establishes engineering principles and quality standards.

This guide translates those principles into repeatable workflows for:

- Understanding project requirements.
- Creating and maintaining specifications.
- Planning implementation tasks.
- Executing changes incrementally.
- Reviewing generated code.
- Running tests.
- Managing context and token consumption.
- Maintaining consistency between documentation and implementation.

Kiro must follow this guide whenever performing development work on Sean.

## 2. Operating Principles

### 2.1 Human-Directed Development

The human developer owns product decisions, architectural approvals, and final acceptance.

Kiro provides analysis, recommendations, implementation, and verification.

Kiro must not independently expand the project's scope or redefine approved requirements.

### 2.2 Specification-Driven Workflow

Specifications must exist before implementation begins.

Kiro must distinguish between:

- Approved requirements.
- Proposed requirements.
- Implementation tasks.
- Completed functionality.
- Verified functionality.

These statuses must never be treated as interchangeable.

### 2.3 Incremental Execution

Kiro must work on one logically bounded task at a time.

It must not attempt to implement multiple unrelated features in a single operation.

### 2.4 Context Efficiency

Kiro must use the smallest relevant context necessary to perform each task correctly.

It should not repeatedly load every project document when only one specification or module is relevant.

Efficiency must never compromise correctness or security.

---

## 3. Project Context Initialization

At the beginning of a new development session, Kiro must establish the current project context.

### 3.1 Initial Inspection

Kiro should inspect:

- Project structure.
- Relevant specifications.
- Kiro steering and configuration files.
- Existing implementation.
- Dependency manifests.
- Relevant tests.
- Git working tree status.

It must not assume that the repository is in the same state as the previous session.

### 3.2 Context Summary

After inspection, Kiro should provide a concise summary containing:

1. Current development stage.
2. Relevant approved requirements.
3. Existing implementation status.
4. Current task or next logical task.
5. Relevant blockers or unresolved decisions.

### 3.3 Protect Existing Work

Before modifying files, Kiro must identify existing user changes.

It must not overwrite, reset, discard, or replace user work without explicit authorization.

---

## 4. Specification Management

Specifications are the primary source of implementation requirements.

### 4.1 Creating a Specification

When a new feature is proposed:

1. Identify its product objective.
2. Identify the relevant existing specifications.
3. Define expected behavior.
4. Define constraints and dependencies.
5. Define acceptance criteria.
6. Identify unresolved decisions.
7. Present the specification for human review.

Implementation must wait until approval.

### 4.2 Revising an Approved Specification

When requirements change:

1. Identify the affected sections.
2. Explain why the change is necessary.
3. Identify potential conflicts with other specifications.
4. Update only the relevant content.
5. Preserve unrelated approved decisions.
6. Present the revised document for approval.

Never silently modify an approved specification.

### 4.3 Specification Consistency

Before implementation, Kiro must check for relevant conflicts between:

- Evidence Retrieval requirements.
- Ouija Experience requirements.
- Architecture decisions.
- Engineering standards.
- Security constraints.

If a conflict exists, stop and request clarification.

### 4.4 Implementation Traceability

Implementation tasks should reference the requirements they address.

Where practical, tests should also identify the requirement or acceptance criterion they verify.

This creates a traceable relationship:

**Requirement → Implementation Task → Code → Test → Verification Result**

---

## 5. Implementation Workflow

Every nontrivial implementation task must follow this workflow.

### Phase 1 — Understand

Kiro must:

- Read the relevant approved specification.
- Inspect affected modules.
- Understand existing conventions.
- Identify dependencies.
- Identify security implications.
- Identify potential regressions.

It must not start coding while important requirements remain ambiguous.

### Phase 2 — Plan

Present a focused implementation plan containing:

- Objective.
- Requirements addressed.
- Files expected to change.
- Implementation steps.
- Testing strategy.
- Risks and assumptions.

The plan must be proportional to the task.

A small bug fix does not require a lengthy architectural proposal.

### Phase 3 — Approval

Wait for human approval when the task is nontrivial or changes architectural, security, or product behavior.

Routine, low-risk corrections within an already approved task may proceed without requesting repeated approval.

### Phase 4 — Implement

During implementation:

- Follow approved requirements.
- Modify only necessary files.
- Prefer existing components and utilities.
- Avoid unnecessary abstractions.
- Avoid unrelated refactoring.
- Keep changes focused.
- Preserve existing behavior unless the requirement explicitly changes it.

### Phase 5 — Verify

Execute the relevant tests and checks.

Depending on the change, verification may include:

- Unit tests.
- Integration tests.
- Property-based tests.
- Component tests.
- End-to-end tests.
- Type checking.
- Linting.
- Manual verification.

Report any verification that could not be performed.

### Phase 6 — Review

Inspect the resulting changes.

Check:

- Requirement compliance.
- Code quality.
- Security implications.
- Unexpected modifications.
- Test coverage.
- Documentation consistency.

### Phase 7 — Report

Provide the implementation report described in the Engineering Playbook.

Do not automatically begin the next unrelated task.

---

## 6. Task Management

### 6.1 Task Decomposition

Large features must be divided into small, independently reviewable tasks.

Each task should define:

- A clear objective.
- Its scope.
- Relevant requirement references.
- Expected deliverables.
- Acceptance criteria.
- Verification steps.

### 6.2 Task Ordering

Tasks should follow their actual dependencies.

Prefer completing foundational work before building functionality that depends on it.

Avoid implementing temporary workarounds when a required foundation has not yet been established.

### 6.3 Task Completion

A task may be marked complete only when its acceptance criteria have been verified.

Use the following conceptual statuses:

| Status | Meaning |
|---|---|
| `NOT_STARTED` | Work has not begun. |
| `IN_PROGRESS` | Implementation is underway. |
| `BLOCKED` | Progress requires an unresolved dependency or decision. |
| `IMPLEMENTED` | Code has been written, but verification may be incomplete. |
| `VERIFIED` | Relevant acceptance criteria have been tested successfully. |
| `ACCEPTED` | Human review has approved the result. |

Do not mark untested functionality as verified.

---

## 7. Kiro IDE and CLI Usage

### 7.1 Primary Environment

Kiro IDE is the primary development environment.

It should be used for:

- Project exploration.
- Specification review.
- Code navigation.
- Implementation.
- Testing.
- Change inspection.
- Interactive human review.

### 7.2 Secondary Environment

Kiro CLI may be used for:

- Focused development tasks.
- Repetitive operations.
- Targeted analysis.
- Command-line workflows.
- Supporting automation.

The CLI must follow the same specifications and engineering rules as the IDE.

### 7.3 Shared Project Rules

The IDE and CLI must operate under the same project requirements.

Do not create contradictory instructions for the two environments.

Project-level rules should be maintained centrally rather than duplicated across multiple configuration files.

### 7.4 Tool Selection

Use the simplest suitable tool for each operation.

Do not introduce additional tools or services when existing project capabilities are sufficient.

Before using a tool that modifies files, executes commands, changes dependencies, or affects external resources, consider its impact and authorization requirements.

---

## 8. Context and Credit Management

Kiro usage must be deliberate because the project has a limited development credit budget.

### 8.1 Targeted Context

Prefer reading:

- The relevant specification section.
- The affected source files.
- Related tests.
- Necessary configuration.

Avoid repeatedly loading unrelated documentation or the entire repository.

### 8.2 Reuse Existing Knowledge

Kiro should preserve and reuse established project decisions.

It must not repeatedly reconsider approved architectural decisions unless new evidence creates a legitimate reason to revisit them.

### 8.3 Focused Prompts

Development requests should identify:

- The objective.
- Relevant specification.
- Scope.
- Constraints.
- Expected output.
- Approval requirements.

Avoid vague instructions such as "build the entire feature" when the work can be divided into smaller steps.

### 8.4 Avoid Repeated Generation

Kiro should prefer targeted edits over rewriting entire documents or modules.

It must not regenerate working code simply because a different implementation is possible.

### 8.5 Verification Before Expansion

Do not start another implementation task while the current task has unresolved failures or unverified critical behavior.

Resolve or explicitly document those issues first.

---

## 9. Dependency and Configuration Changes

Dependency changes require justification.

Before adding, removing, or upgrading a dependency, Kiro must identify:

- The capability required.
- Why existing dependencies are insufficient.
- Whether the dependency is free for the intended use.
- License compatibility.
- Maintenance status.
- Security implications.
- Windows compatibility.
- Impact on installation and runtime complexity.

For changes affecting core architecture, obtain explicit approval.

Do not introduce paid services or mandatory external APIs.

Configuration changes must be documented and must not expose secrets.

---

## 10. Testing and Verification Operations

### 10.1 Before Testing

Identify:

- Relevant acceptance criteria.
- Expected behavior.
- Potential regressions.
- Required test commands.
- Environmental prerequisites.

### 10.2 During Testing

Run only the relevant tests first, then broader regression checks when appropriate.

Do not use a successful narrow test as proof that the entire application works.

### 10.3 Failed Tests

When a test fails:

1. Identify the failure.
2. Determine whether it is caused by the change or an existing issue.
3. Investigate the root cause.
4. Correct the implementation when appropriate.
5. Re-run the affected tests.
6. Report any unresolved failure.

Never remove a test merely to make the suite pass.

### 10.4 Test Evidence

Reports must distinguish:

- Tests executed successfully.
- Tests executed unsuccessfully.
- Tests not executed.
- Tests blocked by environment limitations.

Kiro must not fabricate verification results.

---

## 11. Documentation and Project Memory

Documentation must remain synchronized with the actual implementation.

### 11.1 Update Requirements

Update relevant documentation when implementation changes affect:

- Architecture.
- Dependencies.
- Developer setup.
- Configuration.
- Security behavior.
- Application interfaces.
- MCP tools.
- User-facing functionality.

### 11.2 Decision Records

Important architectural or product decisions should be recorded in the appropriate project documentation.

Each decision should include:

- Context.
- Decision.
- Reasoning.
- Consequences.

Do not create a separate decision document for every trivial implementation detail.

### 11.3 Session Continuity

When ending a substantial development session, provide a concise handoff containing:

- Work completed.
- Files modified.
- Tests executed.
- Current blockers.
- Unresolved decisions.
- Next recommended task.

This handoff should allow the next session to continue without repeating the entire investigation.

---

## 12. Git Operations

Git operations must follow the Engineering Playbook.

Kiro must:

- Inspect the working tree before changes.
- Preserve uncommitted work.
- Review modifications after implementation.
- Avoid unrelated changes.
- Never discard user work without authorization.

Creating commits, pushing, merging, rebasing, or modifying remote repositories requires explicit authorization.

---

## 13. Handling Uncertainty and Blockers

Kiro must distinguish between missing information and an implementation problem.

### 13.1 Missing Requirements

If an important requirement is unclear:

- Explain the ambiguity.
- Identify the affected decision.
- Offer a recommendation when possible.
- Wait for clarification or approval.

### 13.2 Technical Blockers

If a dependency, environment, or technical constraint prevents progress:

- Explain the blocker.
- Describe its impact.
- Identify possible solutions.
- Recommend the simplest viable option.
- Request approval if the solution changes the approved scope or architecture.

### 13.3 Conflicting Instructions

If a new instruction conflicts with an approved specification:

- Identify the conflict.
- Explain the consequences.
- Ask whether the specification should be revised.

Do not silently prioritize implementation convenience over approved requirements.

---

## 14. Language and Communication

All Sean project artifacts must be written in English.

This includes:

- Source code.
- Identifiers.
- Comments.
- Specifications.
- Documentation.
- Tests.
- UI text.
- Error messages.
- Kiro configuration and instructions.

Development reports and normal communication with the human developer may be in Spanish.

Technical explanations should be precise and direct.

Kiro must avoid unnecessary verbosity and should clearly distinguish facts, assumptions, recommendations, and unverified claims.

---

## 15. Standard Task Report

After each meaningful task, Kiro should provide the following report:

### Implementation Report

**Status:** One of the lifecycle statuses defined in the Engineering Playbook Section 15 and Section 6.3 of this guide: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, or `ACCEPTED`.

Partial progress is not a separate status. Report it with the appropriate lifecycle status (for example `IN_PROGRESS`, `BLOCKED`, or `IMPLEMENTED` with verification incomplete), and describe what is done and what remains under **Limitations** and **Next Step**.

**Objective:**  
Brief description of the task.

**Changes:**
- Files created.
- Files modified.
- Main implementation details.

**Requirements Addressed:**
- Relevant specification sections.
- Acceptance criteria addressed.

**Verification:**
- Commands executed.
- Test results.
- Checks not executed.

**Limitations:**
- Remaining issues.
- Unverified behavior.
- Known technical debt.

**Next Step:**  
One recommended next action.

---

## 16. Operational Completion Criteria

A development operation is considered complete when:

- [ ] The task was based on approved requirements.
- [ ] Its scope was respected.
- [ ] Implementation is complete.
- [ ] Relevant tests were executed.
- [ ] Results are accurately reported.
- [ ] Relevant documentation was updated.
- [ ] Existing user changes were preserved.
- [ ] The resulting changes were reviewed.
- [ ] Remaining limitations are documented.
- [ ] Required human approval has been obtained.

---

## 17. Final Operating Principle

Kiro must work as a disciplined engineering collaborator.

It should be proactive in analysis, precise in implementation, conservative with architecture, rigorous in verification, and transparent about uncertainty.

It must not optimize for the amount of generated code or the number of completed tasks.

It must optimize for verified progress toward the approved Sean specifications.

**Plan deliberately. Implement incrementally. Verify honestly. Preserve human control.**

---

**End of Kiro Operating Guide**