"""Central retrieval limits (Task 16.1 mechanism; Requirements 15, 16, 20).

Approval state of each value (owner decisions of 2026-11-12, phase-status section 42): approved values are R1 to R4, R9,
R11, R13, R14, R16, V1 to V9, and the two Git lifecycle constants, with R18 and R19 approved at I1. Each comment below
states the basis. Changing a value changes behavior and is an owner decision. The decision package records the history:
docs/development/i3-i4-owner-decision-package.md (Part 10.1). Values not listed in the approved set, R5 to R8, R10, R17,
D1, and D2, are not implemented and are not enforced by this module.

Modules import these names. No module defines its own copy.
"""

from __future__ import annotations

# OD-5 row R1: Git call timeout.
GIT_TIMEOUT_SECONDS = 30.0
# OD-5 row R2: Git stdout bound per call.
GIT_STDOUT_LIMIT_BYTES = 16 * 1024 * 1024
# OD-5 row R3: Git stderr bound per call.
GIT_STDERR_LIMIT_BYTES = 64 * 1024
# OD-5 row R4: commits read per investigation (approved 2026-11-12).
COMMIT_SCAN_LIMIT = 2000
# OD-5 row V3. The 1 to 256 character range also appears in the approved design baseline.
MAX_SYMBOL_LENGTH = 256
# OD-5 row V4: line span for a target search.
MAX_LINE_SPAN = 2000
# OD-5 row V2: repository-relative path length. C.3a takes this value from configuration.
MAX_TARGET_PATH_LENGTH = 1024
# OD-5 row R9: GitHub per-operation socket timeout (not a total deadline).
OPERATION_TIMEOUT_SECONDS = 5.0
# OD-5 row R11: GitHub response body bound.
BODY_LIMIT_BYTES = 1024 * 1024

# MCP interface bounds (OD-5 V5 and V9, approved 2026-11-12). The MCP blame span is a public input limit, checked before
# the core runs. MAX_LINE_SPAN (2000) is the core safety limit, checked independently. The two are separate layers.
MCP_BLAME_SPAN_LINES = 500
MCP_MAX_RESULTS_DEFAULT = 20
MCP_MAX_RESULTS_LIMIT = 50

# Local registry file bounds (R18 and R19, approved at I1). Not reopened.
MAX_REGISTRY_BYTES = 256 * 1024
MAX_ROOT_LENGTH = 4096

# Git process lifecycle (approved 2026-11-12). How long a reader thread may run after its child has exited before the pipe
# is treated as held by a descendant.
GIT_READER_JOIN_SECONDS = 5.0
# Upper bound on waiting for the Git child to exit after it was stopped (approved 2026-11-12).
GIT_CHILD_WAIT_SECONDS = 10.0
