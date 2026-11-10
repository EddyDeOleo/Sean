---
inclusion: always
---

# Product

Authoritative sources: `docs/specs/spec-1-evidence-retrieval.md` and `docs/specs/spec-2-ouija-experience.md`. Consult the current approved version (check its Version and Status header) before relying on this file. If this file conflicts with them, the specs win. Stop and report the conflict.

## Identity

- Product: Sean.
- Tagline: "Summon the reasoning behind the code."
- Sean reconstructs the technical history of Git repositories and explains engineering decisions using verifiable evidence.
- Sean does not claim to read developers' minds. A commit proves that a change occurred, not necessarily why.

## Evidence Integrity

- Sources: Git commits, blame, pull requests, issues, documentation, code history.
- Distinguish documented facts, inferences, and insufficient evidence.
- Never present speculation as historical intent. Temporal proximity is not causation.
- Never fabricate commits, PRs, issues, documentation, metadata, causal relationships, or explanations.
- Abstain when evidence is insufficient, with or without an AI provider.

## Three Independent Dimensions

Never merge these into one status field. The UI displays the original backend values unchanged.

1. Frontend lifecycle state (Spec 2 section 8.2): `IDLE`, `QUESTION_READY`, `INVOKING`, `RETRIEVING`, `REVEALING`, `PRESENTING_EVIDENCE`, `COMPLETED`, `PARTIAL`, `INSUFFICIENT_EVIDENCE`, `FAILED`, `CANCELLED`.
2. Backend retrieval status: `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, `FAILED`.
3. Epistemic classification: `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, `INSUFFICIENT_EVIDENCE`.

Rules:
- `INSUFFICIENT` (retrieval status) is not `INSUFFICIENT_EVIDENCE` (classification).
- A complete retrieval can yield `INSUFFICIENT_EVIDENCE`.
- A failed retrieval does not prove that evidence is absent, and needs no classification or conclusion.
- Cancellation is the lifecycle outcome `CANCELLED`, not a retrieval status or classification.
- Ranking is a relevance mechanism. It does not decide classification.

## Final UI State Mapping (Spec 2 section 8.5)

First matching row wins:

| Priority | Backend condition | Frontend state |
|---|---|---|
| 1 | Retrieval status is `FAILED` | `FAILED` |
| 2 | Classification is `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` |
| 3 | Classification is `PARTIAL_EVIDENCE` | `PARTIAL` |
| 4 | Retrieval status is `PARTIAL` or `INSUFFICIENT`, with classification `DOCUMENTED` or `INFERRED` | `PARTIAL` |
| 5 | Retrieval status is `COMPLETE`, with classification `DOCUMENTED` or `INFERRED` | `COMPLETED` |

Invalid, missing, or contradictory backend values must never produce a successful conclusion.

## No-AI Fallback

- Retrieval, ranking, classification, and a structured explanation must work with no AI provider.
- Optional AI may only improve wording. It must not invent facts, add unsupported causality, upgrade a classification, or hide uncertainty.
- AI failure or absence is never a retrieval failure.

## Experience (Spec 2)

- Exactly two primary zones: Evidence & History on the LEFT, Ouija Board on the RIGHT. No third primary zone. Narrow screens stack them vertically.
- Evidence & History is visible from the beginning. Its content may stay concealed until the reveal, without layout shifts or invented findings.
- The planchette movement is cinematic and state-driven, never random. The complete phrase is revealed whole after the planchette settles. No letter-by-letter spelling.
- A partial result reveals only the narrow conclusion the evidence supports, with its limitations visible.
- Insufficient evidence may show only the neutral phrase `INSUFFICIENT EVIDENCE`, never a historical conclusion.
- Failed or cancelled investigations never perform a successful reveal.
- Skipping or reducing animation never skips retrieval, alters the result, or bypasses validation.
- Source text, code, commit messages, and documentation excerpts are real, selectable, source-faithful text. Never use generated images or fabricated content for them.
- The frontend never invents evidence and never upgrades or downgrades backend values.
- Sound is in the MVP and disabled by default, with mute and volume controls. Failure, cancellation, or insufficient evidence must never trigger a success sound.
- Reduced motion, keyboard access, readable contrast, and textual status feedback are mandatory.
