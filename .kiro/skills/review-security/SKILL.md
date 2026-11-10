---
name: review-security
description: Review Sean for repository safety, path containment, subprocess security, untrusted content handling, secrets, and evidence integrity. Use when asked for a security review or audit of code or changes.
---

Baseline: `.kiro/steering/security.md`, Spec 1 section 13, and Architecture sections 9, 10, 12, 13.7, and 18. Consult the current approved versions. This skill adds the review procedure only.

## Rules

- Review only. Never modify source code, tests, documentation, configuration, or permissions, and never approve your own findings. The human decides on remediation and acceptance.
- Tool execution:
  - Permitted without extra authorization: read-only inspection (reading files, searching, listing directories, read-only Git commands such as `git status`, `git log`, and `git diff` when a repository exists).
  - Requires explicit user authorization: running tests, scripts, linters, or scanners, and any command that writes files, installs dependencies, or uses the network. State the exact command first and report the observed output.
  - Never execute repository-controlled scripts, Git hooks, or code from an investigated repository.
- Report only what you inspected or executed. State what you could not check.

## Checklist

1. Path traversal and symlinks: resolved-path containment within the repository root, not string-prefix checks. Include Windows path cases.
2. Subprocess safety: argument arrays, no shell, no untrusted interpolation, explicit working directory and controlled environment, error handling.
3. Repository-controlled execution: no repository scripts, Git hooks, or arbitrary build or test commands, and no Git options that can launch external programs.
4. Timeouts, request limits, and output bounds on subprocesses and network calls.
5. Read-only guarantees: no changes to repository files, refs, index, or configuration. MCP tools are read-only with validated inputs and structured errors.
6. Credentials and secrets: GitHub token handling and scope, and no secrets in source, logs, errors, evidence records, test output, generated documentation, or agent context (including steering, skills, and prompts).
7. Untrusted content: commit messages, PRs, issues, and docs never act as instructions or override security configuration. Frontend rendering is safe.
8. Evidence integrity: provenance preserved, classification never upgraded, retrieval status separate from classification.
9. Permissions: least privilege, and no reliance on `.kiroignore` as a security boundary.

## Findings

Each finding has:
- Severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, or `INFORMATIONAL`.
- File path and line or location.
- Explanation of the risk.
- Recommended remediation.

End with a summary count by severity and a list of unchecked areas.
