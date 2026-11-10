---
name: implement-spec
description: Implement one approved Sean specification task incrementally while preserving architecture, security, and testing requirements. Use when asked to implement a spec task or feature from docs/specs.
---

Follow the steering files, `docs/development/kiro-engineering-playbook.md`, and `docs/development/kiro-operating-guide.md`. This skill adds the task procedure only.

## Gate Check (before any implementation beyond scaffold work)

Approved specifications are necessary but not sufficient. Check each item against the current authoritative documents (`docs/architecture/architecture-and-project-setup.md` section 25 and `docs/specs/spec-1-evidence-retrieval.md` section 25), and ask the human to confirm the status of any gate you cannot verify from the repository. Treat an unconfirmed gate as open.

Approved specifications (confirm each declares `Status: Approved`):
- Spec 1, Spec 2, Architecture, Playbook, and Operating Guide.

Implementation gates (all applicable ones must be closed):
- Cross-document consistency review completed and accepted.
- Windows runtime versions and dependency compatibility verified.
- Kiro IDE and CLI versions identified, and Kiro configuration formats and capabilities verified against them.
- Golden Test repository and baseline strategy defined, and the exact baseline pinned before Golden tests are implemented.
- Actual license copyright holder confirmed, before any `LICENSE` file is created.
- The implementation plan is consistent with the approved architecture.
- Any other gate stated in the authoritative documents.

While any gate is open:
- Permitted: documentation and Kiro configuration maintenance the human has authorized, read-only analysis and audits, and planning the human requests.
- Prohibited: application source code, dependency installation or changes, project initialization, Golden test implementation before its baseline is pinned, and a `LICENSE` file before the holder is confirmed.

If the check fails, stop, list the open gates, and ask the human. Never infer closure from approval of the specifications alone.

## Other Preconditions

Stop and ask the human if any of these fails:
- The task is clearly scoped and maps to specific requirements or acceptance criteria.
- The documents do not conflict on the point being implemented.

## Procedure

1. Working tree: if a Git repository exists, inspect `git status` and `git diff`, identify existing user changes, and preserve them. If none exists, report that fact. Do not initialize Git automatically.
2. Read only the relevant approved spec sections and the affected code.
3. Write a short plan: objective, requirement and acceptance-criterion references, files to change, steps, test strategy, risks. Keep it proportional to the task.
4. Get human approval before proceeding if the task is non-trivial or touches architecture, dependencies, security, product behavior, or scope. Dependencies need the justification required by Operating Guide section 9.
5. Implement in small steps. Change only what is required. Add no unapproved features, dependencies, modules, or abstractions.
6. Add or update tests that reference the requirement they cover. Run the relevant tests, then broader ones if shared behavior changed. Use Windows-compatible commands.
7. Review security implications for every task, proportional to risk. Use the `review-security` skill for changes touching paths, subprocesses, repository content, credentials, or MCP.
8. Update affected documentation.
9. Inspect the final diff (or file changes, if no repository exists) for unintended changes.
10. Do not commit or push without explicit human authorization.
11. Do not start the next task automatically.

## Completion Report

Use the Playbook section 15 and Operating Guide section 15 fields:
- Status: one lifecycle status (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `ACCEPTED`). Partial progress uses the appropriate status, with details under Limitations. Do not claim `VERIFIED` without executed passing tests. Never claim `ACCEPTED`. Only the human accepts.
- Objective.
- Changes: files created, files modified, main details.
- Requirements addressed: specification sections and acceptance criteria.
- Verification: exact commands, observed results, and checks not executed.
- Security considerations and documentation updated.
- Limitations: remaining issues, unverified behavior, known technical debt.
- Next Step: one recommended action.
