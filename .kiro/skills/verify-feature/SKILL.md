---
name: verify-feature
description: Verify a Sean implementation against approved requirements and acceptance criteria. Use when asked to verify, validate, or check a completed feature or spec task.
---

Follow the steering files and `docs/development/kiro-engineering-playbook.md` and `kiro-operating-guide.md` (section 10). This skill adds the verification procedure only.

## Rules

- Do not modify application source code, test files, documentation, or configuration unless the user explicitly authorizes it for this task. Report problems and gaps instead of fixing them. Recommend missing tests rather than writing them.
- Never edit an approved specification during verification.
- Run tests and checks only when authorized. Otherwise list the commands to run.
- Running tests may create ordinary artifacts such as `.pytest_cache`, `.hypothesis`, or `test-results`. Report any you notice. Do not treat them as source changes.
- Never claim verification without evidence. Every claim must be backed by the exact command executed and the observed output.

## Procedure

1. Identify the task, the approved requirements, and the acceptance criteria under verification (Spec 1 section 23, Spec 2 section 21, or the task's own criteria).
2. Inspect the implementation and its tests. Note criteria with no test.
3. Choose appropriate checks: unit, integration, property-based, golden, Vitest, Playwright, type checks, lint. Use Windows-compatible commands.
4. Run them, if authorized. Record each exact command and its observed output.
5. Where relevant, check behavior with no AI provider, that retrieval status and epistemic classification stay separate, and that failures and insufficient evidence are not shown as successful conclusions.
6. Golden Test results are not validated until the tests have been built and executed against the pinned baseline. Report them as unvalidated otherwise.
7. Note security concerns for every task, proportional to risk. Defer detailed review to the `review-security` skill.

## Check Result Categories

These describe individual checks. They are not task lifecycle statuses.
- `PASSED`: executed, and the observed result met the criterion.
- `FAILED`: executed, and the observed result did not meet the criterion.
- `NOT_RUN`: not executed. State why.
- `BLOCKED_BY_ENVIRONMENT`: could not execute because of an environment limitation (missing tool, permission, platform). State the limitation.

## Report

- Criteria table: criterion, exact command, observed output, result category.
- Failures, skipped checks, and limitations. Do not hide or soften failures.
- Task lifecycle status, using the project statuses:
  - `IMPLEMENTED`: code exists, verification incomplete or absent.
  - `VERIFIED`: relevant criteria passed in checks you executed.
  - `BLOCKED`: progress needs an unresolved dependency or decision.
  - `ACCEPTED`: human approval only. Never assign this yourself.
