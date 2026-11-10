---
inclusion: always
---

# Engineering Standards

Authoritative sources: `docs/development/kiro-engineering-playbook.md` and `docs/development/kiro-operating-guide.md`. Consult the current approved versions (check each Version and Status header). If this file conflicts with them, they win. Stop and report the conflict.

## Process

- Specification-first. Implement only behavior in the approved specs and architecture. Kiro-generated specs and plans never override them.
- If documents conflict, stop the affected work and report. Never silently change an approved requirement.
- Work in small, reviewable tasks. Understand, plan, get approval when needed, implement, verify, review, report.
- Keep traceability: requirement, task, code, test, verification result.
- Human approval is required before: new architectural components or persistent processes, new external or paid services, paid dependencies, stack changes, scope expansion, security or permission changes, edits to approved specs, destructive operations, commits, and pushes.
- When requirements or safety are uncertain, stop and ask. Small, low-risk corrections within approved scope may proceed without separate approval.
- Do not start another task while the current one has unresolved failures or unverified critical behavior. Resolve or document them first.

## Task Status

Lifecycle statuses: `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `ACCEPTED`. This is the only task status system. Partial progress uses the appropriate status, with limitations and remaining work in the report.
- `IMPLEMENTED` is not `VERIFIED`. `VERIFIED` requires executed tests whose results were observed.
- `ACCEPTED` requires human approval.

## Testing and Verification

- Add tests for new behavior and regression tests for fixed defects.
- Use unit, integration, property-based (Hypothesis), and golden tests on the backend. Use Vitest for frontend logic and components, and Playwright for end-to-end flows.
- Run relevant tests first, then broader ones when shared behavior changes.
- Never claim a test, validation, or verification passed unless it was executed and its result observed. Report failures, skipped checks, and what was not run.
- When a test fails: identify the failure, decide whether the change or an existing issue caused it, find the root cause, fix the implementation, re-run, and report anything unresolved. Never remove a test only to make a suite pass.

## Code Quality

- Readable, explicit, typed, testable code that matches existing conventions.
- No dead code, unused dependencies, or unnecessary wrappers.
- No broad exception handling that hides failures.
- No silent fallbacks that change application semantics.
- No premature abstractions and no unnecessary complexity. Prefer the simplest solution that meets the approved requirement.
- No duplicated business rules, hidden side effects, or unexplained constants.

## Security, Dependencies, and Cost

- Review security implications for every task, as the Playbook Definition of Done requires. Keep the review proportional to the task's risk, but never omit it. Report any security concern before the task is considered complete. See `security.md`.
- Every new dependency needs a documented reason: license, maintenance, security, Windows support, and cost. No mandatory paid dependency.
- Be aware of Kiro credit cost, but never trade away security, testing, or quality for it. Use targeted context.

## Documentation, Git, and Environment

- Update documentation in the same task when architecture, setup, configuration, security, interfaces, or MCP tools change. This is part of the Definition of Done.
- Use Windows-compatible commands and paths. Windows is the primary development environment.
- Git discipline: inspect the working tree first when a repository exists, review the diff afterward, keep changes focused, preserve user changes. No commit, push, or destructive Git operation without explicit authorization.
- Kiro IDE is the primary environment. Kiro CLI is complementary. Both follow the same rules.
- All project artifacts are in English. Conversation with the owner may be in Spanish.

## Prohibited Without Explicit Approval (Playbook section 16)

- Implementing unapproved features, or changing approved architecture silently.
- Adding mandatory paid services, speculative infrastructure, or unnecessary abstraction layers.
- Replacing evidence with generated assumptions, or treating AI output as authoritative evidence.
- Hiding test failures, or claiming unverified results.
- Committing or pushing without authorization, or running destructive operations without authorization.
- Treating generated Kiro plans as permission to expand scope.
- Claiming that implementation or tests exist when they do not.
