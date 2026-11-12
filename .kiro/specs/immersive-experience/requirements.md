# Requirements Document

## Introduction

This document specifies the requirements for Sean's Phase 4 immersive frontend: the investigation interface, the Ouija experience, a fictional narrative interruption, an escape game, and a final technical report. The frontend presents backend results. It does not reconstruct history or invent evidence, and it keeps the frontend phase, the backend retrieval status, and the backend epistemic classification as separate values. The backend and its `POST /investigations` contract are not changed for any presentation effect.

## Authority and status

- Source of truth: #[[file:docs/specs/spec-1-evidence-retrieval.md]] (Version 2.4, Approved) and #[[file:docs/specs/spec-2-ouija-experience.md]] (Version 1.6, Approved).
- Phase 4 experience specification: #[[file:docs/specs/spec-3-immersive-experience.md]] (Version 1.0, owner-directed, 2026-11-12). Section 2 of that document records every conflict with an approved source and its resolution.
- Related Native Specs: #[[file:.kiro/specs/ouija-experience/requirements.md]] and #[[file:.kiro/specs/evidence-retrieval/design.md]] (canonical contract). This document extends them and does not replace them.
- Phase 3 is CLOSED. Nothing here reopens it.
- Requirement status: Native Spec for the Phase 4 owner directive of 2026-11-12. Task state is recorded in `.kiro/reports/phase-status.md`. A `[ ]` checkbox in `tasks.md` does not mean NOT_STARTED for this plan.
- Section references such as "§8.5" point to Spec 2 unless another document is named.

## Glossary

- **Phase:** the experience phase: `IDLE`, `INVESTIGATING`, `REVEALING`, `NARRATIVE_INTERRUPTION`, `ESCAPE_SEQUENCE`, `FINAL_REPORT`, `ERROR`, or `CANCELLED`. It is a frontend value only.
- **Retrieval status / Classification:** the backend values from Spec 1 §10. Stored unchanged.
- **Eligible result:** a valid result with presentation state `COMPLETED` or `PARTIAL` and at least one evidence item.
- **Narrative layer:** the fictional interruption and escape game. It is never part of an investigation result.
- **Fragment:** a game pickup that stands for one real evidence item.

## Requirements

### Requirement 1: Application shell and two-zone layout

**User Story:** As a user, I want the evidence and the Ouija board side by side, so that I can follow the story and the proof together.

#### Acceptance Criteria

1. THE SYSTEM SHALL render exactly two primary zones: Evidence & History on the left and the Ouija board on the right. (Spec 2 §4.1)
2. THE SYSTEM SHALL stack the zones vertically below 1024 px width and SHALL NOT overflow horizontally at 390 px. (Spec 2 §4.4)
3. THE SYSTEM SHALL render the narrative interruption and the escape game inside the right zone and SHALL keep the left zone visible. (Spec 3 §2, C-1)
4. THE SYSTEM SHALL NOT treat a header, status strip, or settings control as a primary zone.

### Requirement 2: Investigation setup

**User Story:** As a user, I want to specify what to investigate, so that I can start a real investigation.

#### Acceptance Criteria

1. THE SYSTEM SHALL accept a repository ID, a repository-relative target path, an optional symbol, an optional line range, and a question.
2. THE SYSTEM SHALL NOT offer a repository list, because the backend provides no listing endpoint.
3. THE SYSTEM SHALL give early client-side feedback for empty fields, a repository ID outside the registry pattern, a symbol over 256 characters, a partial or reversed line range, and path forms the backend rejects. THE SYSTEM SHALL treat the backend as authoritative.
4. WHEN the backend returns a `field` error, THE SYSTEM SHALL show the message at the matching input.
5. WHILE an investigation is running, THE SYSTEM SHALL prevent a second submission. (Spec 2 §6.3)

### Requirement 3: Backend contract and validation

**User Story:** As a user, I want only validated backend results to be shown, so that I am never given an invented answer.

#### Acceptance Criteria

1. THE SYSTEM SHALL send exactly `repository_id`, `target`, and `question` to `POST /investigations`, with no other field.
2. THE SYSTEM SHALL validate required fields, recognized values, and the Spec 2 §8.5 combination before any use of a `200` body. (Spec 2 §18.5)
3. IF validation fails, THEN THE SYSTEM SHALL show "The result could not be validated. No conclusion is shown." and SHALL NOT reveal, classify, or run the narrative layer.
4. THE SYSTEM SHALL show a non-200 `BackendError` as "request not accepted" with the backend message, and SHALL show `TARGET_AMBIGUOUS` candidates as choices.
5. THE SYSTEM SHALL show a network failure as a network failure and SHALL NOT describe it as missing evidence.
6. THE SYSTEM SHALL contain no fallback, sample, or generated evidence. (Spec 2 §9.2)
7. THE SYSTEM SHALL read no token or environment secret.

### Requirement 4: Experience state machine

**User Story:** As a user, I want a predictable flow, so that scenes never overlap or repeat.

#### Acceptance Criteria

1. THE SYSTEM SHALL implement the transitions in Spec 3 §4 as a pure reducer and SHALL ignore every other (phase, event) pair.
2. THE SYSTEM SHALL apply a response only when its request token is current and SHALL discard stale responses.
3. THE SYSTEM SHALL issue exactly one API call per submission, regardless of scene transitions or re-renders.
4. WHEN the user cancels, THE SYSTEM SHALL abort the request, enter `CANCELLED`, and SHALL NOT reveal or classify. (Spec 2 §8.7)

### Requirement 5: Separate statuses and deterministic mapping

**User Story:** As a user, I want status and classification shown separately, so that a partial search is never read as a full one.

#### Acceptance Criteria

1. THE SYSTEM SHALL derive the presentation state with the Spec 2 §8.5 priority table.
2. THE SYSTEM SHALL show the original retrieval status and classification as two labelled values, never merged and never edited. (Spec 2 §17.4)
3. THE SYSTEM SHALL keep `INSUFFICIENT` (a retrieval status) distinct from `INSUFFICIENT_EVIDENCE` (a classification).

### Requirement 6: Ouija scene and planchette

**User Story:** As a user, I want a cinematic board that reflects what Sean is doing, so that the investigation feels alive without implying discovery.

#### Acceptance Criteria

1. THE SYSTEM SHALL move the planchette through `REST`, `WAKE`, `SEARCH`, `REVEAL_PREP`, and `SETTLED` as a pure function of the phase. (Spec 2 §6.4)
2. THE SYSTEM SHALL use a fixed search path with no randomness and no letters chosen to suggest findings.
3. THE SYSTEM SHALL reveal the complete phrase as a whole line after the planchette settles. (Spec 2 §6.5)
4. THE SYSTEM SHALL show the neutral phrase `INSUFFICIENT EVIDENCE` and no conclusion when the classification is `INSUFFICIENT_EVIDENCE`.
5. THE SYSTEM SHALL perform no success reveal for `FAILED`, invalid, rejected, network, or cancelled outcomes.
6. THE SYSTEM SHALL show an elapsed-time indicator while retrieving and SHALL NOT claim a percentage, because the backend reports none. (Spec 1 design C.9)

### Requirement 7: Evidence presentation and progressive introduction

**User Story:** As a user, I want evidence to appear with some drama but remain inspectable, so that I can verify it.

#### Acceptance Criteria

1. THE SYSTEM SHALL reserve the left zone's dimensions from the first render. (Spec 2 §4.5)
2. THE SYSTEM SHALL introduce evidence cards in returned order with a staggered transition and SHALL show them immediately under reduced motion.
3. THE SYSTEM SHALL show missing values as "Not available" and SHALL NOT fill them in. (Spec 2 §9.2)

### Requirement 8: Narrative interruption

**User Story:** As a user, I want a surprising turn after a successful result, so that the experience is memorable, without being misled.

#### Acceptance Criteria

1. WHEN the board has settled on an eligible result and the horror sequence is on, THE SYSTEM SHALL start the interruption 2000 ms later.
2. THE SYSTEM SHALL NOT start the interruption for `FAILED`, invalid, rejected, network, cancelled, or `INSUFFICIENT_EVIDENCE` outcomes.
3. THE SYSTEM SHALL show the lines "Wait... something is wrong." and "Something else is still in this repository." as whole lines.
4. THE SYSTEM SHALL label the narrative layer as fiction and SHALL NOT claim a backend error, a malicious actor, or a discovery.
5. THE SYSTEM SHALL keep the retrieval status, classification, and limitation notice visible during the interruption.
6. THE SYSTEM SHALL flash no more than three times per second and SHALL replace the glitch and flicker with static text under reduced motion.

### Requirement 9: Escape game

**User Story:** As a user, I want a small interactive game inspired by the real history, so that I engage with the evidence in a different way.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a turn-based, keyboard, button, and touch operable game in which the player gathers fragments and reaches the exit.
2. THE SYSTEM SHALL create one fragment per evidence item, up to four, and SHALL show only fields of that item. THE SYSTEM SHALL NOT show author names in the game.
3. THE SYSTEM SHALL generate the layout from the investigation ID and SHALL guarantee that the exit is reachable and every fragment is reachable.
4. THE SYSTEM SHALL make the game completable: the presence slows after two catches and goes dormant after four.
5. THE SYSTEM SHALL provide a skip control at all times, and skipping SHALL go to the final report with the result unchanged.
6. THE SYSTEM SHALL present the presence as a fictional manifestation of forgotten technical history and SHALL NOT assign motives, crimes, or intent to any real author.
7. THE SYSTEM SHALL announce fragments, proximity, catches, and the exit in a live region.
8. THE SYSTEM SHALL NOT call the API from the game and SHALL NOT write to the result.

### Requirement 10: Final report

**User Story:** As an engineer, I want a complete technical report, so that I can use the findings.

#### Acceptance Criteria

1. THE SYSTEM SHALL show the question, repository, target, retrieval status, classification, conclusion, explanation, limitations, evidence, and source references exactly as returned.
2. THE SYSTEM SHALL group evidence by relationship basis (`VERIFIED` or `INFERRED`), each with a text label, and SHALL state that these labels are not the classification.
3. THE SYSTEM SHALL show per item the source type, identifier, commit, file path and line range, timestamp, author, title, excerpt, retrieval method and time, source verification, and unavailable markers, as returned.
4. THE SYSTEM SHALL render a source link only for an `https` URL.
5. THE SYSTEM SHALL show a chronological view with a note that order is not causation.
6. THE SYSTEM SHALL keep the report reachable with every cinematic feature off.

### Requirement 11: Audio

**User Story:** As a user, I want optional atmospheric sound under my control, so that it never intrudes.

#### Acceptance Criteria

1. THE SYSTEM SHALL keep sound off by default and SHALL create no audio context before an explicit user gesture. (Spec 2 §14.1)
2. THE SYSTEM SHALL provide enable, mute, and volume controls, persist volume, and never persist the on state.
3. THE SYSTEM SHALL synthesize all audio locally and SHALL load no audio file or external service.
4. THE SYSTEM SHALL play no success cue for `FAILED`, invalid, rejected, network, cancelled, or `INSUFFICIENT_EVIDENCE` outcomes. (Spec 2 §14.4)
5. THE SYSTEM SHALL play one ambient bed at a time and SHALL stop, disconnect, and close all audio resources on scene change and on unmount.
6. THE SYSTEM SHALL continue to work if audio fails.

### Requirement 12: Accessibility and user control

**User Story:** As a user with different needs, I want control over motion and sensory effects, so that I can use Sean comfortably.

#### Acceptance Criteria

1. THE SYSTEM SHALL respect `prefers-reduced-motion` and SHALL offer system, reduced, and full motion choices.
2. THE SYSTEM SHALL offer a switch that turns the whole horror sequence off.
3. THE SYSTEM SHALL make every control keyboard operable with a visible focus ring and an accessible name.
4. THE SYSTEM SHALL announce phase changes in live regions.
5. THE SYSTEM SHALL keep text contrast at or above 4.5:1 for body text in the declared palette.
6. THE SYSTEM SHALL let the user skip the cinematic sequence and the escape game at any time without losing the result.

### Requirement 13: Persistence and refresh

**User Story:** As a user, I want my result to survive a refresh, so that I do not repeat an investigation.

#### Acceptance Criteria

1. THE SYSTEM SHALL store the last validated result in `sessionStorage`, validate it again on load, and discard it if it fails.
2. WHEN a stored result is restored, THE SYSTEM SHALL open the final report without a cinematic and SHALL state that it was restored from this browser session.
3. THE SYSTEM SHALL store settings in `localStorage`, validate them on load, and ignore invalid values.

### Requirement 14: Scope and dependency discipline

**User Story:** As the owner, I want no speculative infrastructure, so that the architecture stays simple.

#### Acceptance Criteria

1. THE SYSTEM SHALL use React state with `useReducer`, CSS, and browser APIs only, with no animation library, state library, or game engine.
2. THE SYSTEM SHALL add no dependency beyond the approved set and `jsdom`, and SHALL add no service, database, or backend.
3. THE SYSTEM SHALL NOT change any file under `backend/` or any approved document.

### Requirement 15: Verification

**User Story:** As the owner, I want executed evidence, so that I can trust the result.

#### Acceptance Criteria

1. THE SYSTEM SHALL have automated tests for each acceptance criterion above, using deterministic fixtures generated from the real backend.
2. THE SYSTEM SHALL have a browser test of the complete journey against the real backend.
3. THE SYSTEM SHALL NOT report a result that was not executed.
