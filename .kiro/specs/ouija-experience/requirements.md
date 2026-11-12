# Requirements Document

## Introduction

This document specifies the requirements for Sean's Ouija Experience, the frontend that presents an investigation. The interface has two primary zones: Evidence & History on the left and the Ouija Board on the right. Narrow screens stack the zones vertically. The frontend presents backend results. It does not reconstruct history or invent evidence, and it keeps the frontend lifecycle state, the backend retrieval status, and the backend epistemic classification as three separate values.

The requirements cover layout, question and target input, invocation, lifecycle states, the deterministic presentation mapping, planchette motion and phrase reveal, the presentation of supported, partial, insufficient, failed, and cancelled outcomes, evidence inspection, reduced motion, sound, accessibility, animation technology, backend authority and contract validation, recovery, failure isolation, visual identity, automated tests, and scope.

This document is derived from the approved Spec 2 and does not replace it. The authority, status, and conventions follow in the next section.

## Authority and status

- Source of truth: #[[file:docs/specs/spec-2-ouija-experience.md]] (Version 1.6, Status Approved).
- Architecture: #[[file:docs/architecture/architecture-and-project-setup.md]] §6 (Frontend State, Investigation and Reveal, Animation and Audio) and §5 (Frontend Organization).
- Evidence contract: #[[file:.kiro/specs/evidence-retrieval/requirements.md]] (native Spec 1 derivative). Backend result fields and status semantics come from Spec 1 and are not restated here.
- This document is derived from Spec 2. It does not replace or amend Spec 2. If it conflicts with Spec 2, Spec 2 wins, and the conflict must be reported.
- Requirement status: draft for human review. Implementation tasks in `tasks.md` are pending approval.
- Section references such as "§8.5" point to Spec 2 unless another document is named.

## Glossary

- **Retrieval status:** `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, or `FAILED`, from the backend (Spec 2 §8.3).
- **Epistemic classification:** `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, or `INSUFFICIENT_EVIDENCE`, from the backend (Spec 2 §8.4).
- **Frontend lifecycle state:** the experience state, such as `IDLE` or `REVEALING` (Spec 2 §8.2). It is owned by the frontend and never overwrites a backend value.
- **Presentation state:** the state derived from the backend values by the rules in Spec 2 §8.5.
- **Neutral status phrase:** the text `INSUFFICIENT EVIDENCE`. It is a system status, not a historical conclusion (Spec 2 §6.5, §7.4).

## Requirements

### Requirement 1: Two-zone desktop layout

**User Story:** As a user, I want the investigation and the evidence side by side, so that I can follow both without switching screens.

#### Acceptance Criteria

1. THE SYSTEM SHALL present exactly two primary zones on desktop: Evidence & History on the left and Ouija Board on the right. (Spec 2 §4.1, §21.1)
2. THE SYSTEM SHALL NOT present a third primary investigation panel or a separate right-side evidence panel. (Spec 2 §4.1)
3. WHEN the viewport is narrow, THE SYSTEM SHALL stack the two zones vertically. (Spec 2 §4.4, Architecture §6.3)
4. THE SYSTEM SHALL NOT treat a header, navigation strip, or status indicator as a primary zone. (Architecture §6.1)

### Requirement 2: Stable presentation

**User Story:** As a user, I want the layout to stay still while results appear, so that I do not lose my place.

#### Acceptance Criteria

1. THE SYSTEM SHALL show the Evidence & History zone from the start of the experience. (Spec 2 §4.5)
2. WHILE the Evidence & History content is concealed, THE SYSTEM SHALL keep its dimensions so that no layout shift occurs during reveal. (Spec 2 §4.5, §2.4, Architecture §6.3)
3. THE SYSTEM SHALL keep the Ouija board as the primary interaction surface during the whole investigation. (Spec 2 §6.1, Architecture §6.1)

### Requirement 3: Ouija board contents

**User Story:** As a user, I want the board to show the investigation's question, status, and result in one place, so that I can read the whole investigation without searching the screen.

#### Acceptance Criteria

1. THE SYSTEM SHALL show the investigation question, the invocation control, the board, the planchette, the revealed result or neutral status, the epistemic classification, and the relevant controls in the Ouija Board zone. (Spec 2 §4.3)
2. WHERE repository context applies, THE SYSTEM SHALL show it in the Ouija Board zone. (Architecture §6.1)

### Requirement 4: Question input

**User Story:** As a user, I want to ask a question in plain language about the repository I am investigating, so that I can express what I want to understand about the repository's history.

#### Acceptance Criteria

1. THE SYSTEM SHALL accept a natural-language question associated with the active repository context. (Spec 2 §6.2)
2. IF the question is empty, ambiguous, or cannot be submitted, THEN THE SYSTEM SHALL explain the problem in text beside the input. (Spec 2 §6.2)
3. THE SYSTEM SHALL keep the question available for editing after a failed or cancelled investigation. (Spec 2 §12.3)
4. THE SYSTEM SHALL send an explicit repository-relative `target.path` with every investigation request. THE SYSTEM SHALL NOT use the question as the target, and SHALL show the question as text only. (Spec 1 §5; canonical contract C.3 and C.10; owner decision C-D1)

### Requirement 5: Explicit invocation

**User Story:** As a user, I want an investigation to start only when I ask for it, and not twice by accident, so that I stay in control of when Sean searches and avoid duplicate runs.

#### Acceptance Criteria

1. WHEN the user activates the invocation control, THE SYSTEM SHALL start one investigation. (Spec 2 §6.3)
2. WHILE an investigation is running, THE SYSTEM SHALL prevent a second submission. (Spec 2 §6.3; this design applies the non-concurrent option, see design.md)

### Requirement 6: Lifecycle states and transitions

**User Story:** As a user, I want the board to show exactly where the investigation is, so that I always know its state.

#### Acceptance Criteria

1. THE SYSTEM SHALL use the frontend lifecycle states `IDLE`, `QUESTION_READY`, `INVOKING`, `RETRIEVING`, `REVEALING`, `PRESENTING_EVIDENCE`, `COMPLETED`, `PARTIAL`, `INSUFFICIENT_EVIDENCE`, `FAILED`, and `CANCELLED`. (Spec 2 §8.2)
2. THE SYSTEM SHALL follow the normal lifecycle `IDLE` to `QUESTION_READY` to `INVOKING` to `RETRIEVING`, then to a reveal or presentation state. (Spec 2 §8.6)
3. THE SYSTEM SHALL NOT make a transition that presents a successful result without a validated backend result. (Spec 2 §8.6)
4. WHEN the investigation is cancelled, THE SYSTEM SHALL move to `CANCELLED` and SHALL NOT convert the cancellation into a retrieval status or classification. (Spec 2 §8.7) Spec 2 §8.7 permits stopping or abandoning the investigation. The MVP uses client abandonment: the UI stops waiting and ignores any later response (canonical contract C.8).
5. WHEN a new investigation starts, THE SYSTEM SHALL apply only the response whose client-side request token is current. It SHALL discard responses for superseded or cancelled requests. (Spec 2 §8.7, §12.4; Evidence Retrieval design, canonical contract C.8)

### Requirement 7: Separate statuses and the deterministic mapping

**User Story:** As a user, I want the retrieval status and the classification shown separately, so that a partial search is never mistaken for a complete one.

#### Acceptance Criteria

1. THE SYSTEM SHALL keep frontend lifecycle state, backend retrieval status, and backend epistemic classification as three separate values. (Spec 2 §8.1, §17.4)
2. THE SYSTEM SHALL derive the presentation state from backend values using the priority order in Spec 2 §8.5, where the first matching row wins. (Spec 2 §8.5, §18.6)
3. THE SYSTEM SHALL display the original backend retrieval status and classification, separately from the derived presentation state. (Spec 2 §8.5)
4. THE SYSTEM SHALL NOT overwrite a backend status field with a derived value. (Spec 2 §17.4)
5. IF a backend response contains a missing, unrecognized, or contradictory combination, THEN THE SYSTEM SHALL NOT produce a successful conclusion. (Spec 2 §8.5, §18.5) The presentation shown in that case is the invalid-response handling in the canonical contract, C.7 (owner decision C-D8). It is a presentation state, not a backend status.

### Requirement 8: State-driven planchette

**User Story:** As a user, I want the planchette to move because Sean is really working, not because it is decorative, so that the movement reflects the actual state of the investigation.

#### Acceptance Criteria

1. THE SYSTEM SHALL move the planchette through the stages wake, search, reveal preparation, settle, and a final resting state. (Spec 2 §6.4)
2. THE SYSTEM SHALL drive each planchette stage from the frontend lifecycle state. (Spec 2 §6.4, §7.1, Architecture §6.6)
3. THE SYSTEM SHALL NOT move the planchette randomly or spell letters to suggest discovery. (Spec 2 §6.4)
4. THE SYSTEM SHALL NOT let the planchette change the backend investigation status. (Spec 2 §7.1)
5. THE SYSTEM SHALL produce the same planchette state for the same lifecycle state. (Architecture §6.6)

### Requirement 9: Phrase reveal

**User Story:** As a user, I want the result to appear whole, after the board settles, so that the answer is read as a complete statement rather than spelled out.

#### Acceptance Criteria

1. THE SYSTEM SHALL reveal the complete phrase only after the planchette has settled. (Spec 2 §6.5, §7.2, §21.2)
2. THE SYSTEM SHALL NOT reveal the phrase letter by letter as its primary result mechanism. (Spec 2 §6.5, Architecture §6.5)
3. THE SYSTEM SHALL keep the displayed phrase identical to the backend conclusion or to the neutral status phrase. (Spec 2 §10.1)

### Requirement 10: Supported conclusion

**User Story:** As a user, I want a supported conclusion shown with its evidence, so that I can see what the conclusion rests on.

#### Acceptance Criteria

1. WHEN the presentation state is `COMPLETED`, THE SYSTEM SHALL reveal the conclusion supported by the backend result. (Spec 2 §7.2)
2. THE SYSTEM SHALL display the epistemic classification next to the conclusion. (Spec 2 §10.2)
3. THE SYSTEM SHALL NOT broaden or reword the conclusion beyond the backend text. (Spec 2 §13.4, §23)

### Requirement 11: Partial conclusion

**User Story:** As a user, I want a partial result to show only what the evidence supports, with its limitations visible, so that I do not mistake a narrow finding for a complete explanation.

#### Acceptance Criteria

1. WHEN the presentation state is `PARTIAL`, THE SYSTEM SHALL reveal only the narrow conclusion supported by the retrieved evidence. (Spec 2 §7.3, §13.1)
2. THE SYSTEM SHALL display the partial-coverage limitations visibly. (Spec 2 §7.3, §11.5)
3. THE SYSTEM SHALL NOT present a partial conclusion as a complete historical explanation. (Spec 2 §7.3)

### Requirement 12: Insufficient evidence

**User Story:** As a user, I want to know when Sean cannot answer, without a made-up answer, so that I am never given an unsupported historical conclusion.

#### Acceptance Criteria

1. WHEN the presentation state is `INSUFFICIENT_EVIDENCE`, THE SYSTEM SHALL NOT reveal a historical conclusion. (Spec 2 §7.4, §13.2)
2. WHEN the presentation state is `INSUFFICIENT_EVIDENCE`, THE SYSTEM SHALL MAY reveal the neutral phrase `INSUFFICIENT EVIDENCE`. (Spec 2 §7.4)
3. WHEN the presentation state is `INSUFFICIENT_EVIDENCE`, THE SYSTEM SHALL show the classification, the retrieval status, and a text explanation that the evidence does not support a reliable conclusion. (Spec 2 §13.2)
4. THE SYSTEM SHALL NOT present the neutral phrase as a historical answer. (Spec 2 §6.5, §21.4)

### Requirement 13: Failed and cancelled investigations

**User Story:** As a user, I want failures and cancellations clearly labeled, so that I do not read them as answers.

#### Acceptance Criteria

1. WHEN the presentation state is `FAILED`, THE SYSTEM SHALL NOT perform a successful reveal. (Spec 2 §7.5, §21.4)
2. WHEN the presentation state is `FAILED`, THE SYSTEM SHALL state that the retrieval failed and SHALL NOT state that historical evidence is absent. (Spec 2 §7.5, §11.4, §13.3)
3. WHEN the presentation state is `CANCELLED`, THE SYSTEM SHALL state that the investigation was cancelled and SHALL NOT present it as a conclusion or as insufficient evidence. (Spec 2 §7.6)
4. WHEN a failure occurs during the animation, THE SYSTEM SHALL stop the success-oriented reveal and show the failure state. (Spec 2 §12.3)

### Requirement 14: Evidence cards and source inspection

**User Story:** As a user, I want to inspect each source behind the conclusion, so that I can verify the conclusion myself.

#### Acceptance Criteria

1. THE SYSTEM SHALL show an evidence card for each evidence record, with the metadata the backend supplies. (Spec 2 §9.2)
2. THE SYSTEM SHALL show only the source types the backend returned. (Spec 2 §9.3)
3. WHEN the user selects a card, THE SYSTEM SHALL show its details in the Evidence & History zone and SHALL NOT open a third zone. (Spec 2 §9.4, §4.2)
4. THE SYSTEM SHALL keep the selected evidence identifiable and traceable to its backend record. (Spec 2 §9.4)

### Requirement 15: Historical sequence

**User Story:** As a user, I want a timeline of events, with verified dates and inferred links clearly different, so that I can tell what is documented from what is inferred.

#### Acceptance Criteria

1. WHERE the backend provides a historical sequence, THE SYSTEM SHALL display it in chronological order. (Spec 2 §9.5)
2. THE SYSTEM SHALL distinguish verified dates and events from inferred relationships. (Spec 2 §9.5)
3. THE SYSTEM SHALL NOT present temporal proximity as causation. (Spec 2 §9.5)

### Requirement 16: Empty evidence states

**User Story:** As a user, I want to know why there is no evidence to show, so that I can tell an insufficient result from a failed retrieval.

#### Acceptance Criteria

1. IF no evidence is available, THEN THE SYSTEM SHALL state why, and SHALL distinguish insufficient retrieved evidence, retrieval failure, and a valid result with no supporting records. (Spec 2 §9.6)
2. THE SYSTEM SHALL NOT present these three conditions as the same message. (Spec 2 §9.6, §13.3)

### Requirement 17: Source-faithful content

**User Story:** As a user, I want code and text from the repository shown exactly as the source has it, so that I can read, select, and rely on the original source text.

#### Acceptance Criteria

1. THE SYSTEM SHALL render code excerpts, commit messages, and documentation excerpts as readable, selectable text. (Spec 2 §10.5, Architecture §6.2)
2. THE SYSTEM SHALL NOT generate images or fabricated content for source text. (Architecture §6.2)
3. THE SYSTEM SHALL NOT invent authors, dates, identifiers, or relationships that the backend did not return. (Spec 2 §9.2, §17.5)

### Requirement 18: Technical explanation

**User Story:** As a user, I want an explanation that separates documented facts from interpretation, so that I can judge how much of it the evidence supports.

#### Acceptance Criteria

1. THE SYSTEM SHALL display the technical explanation from the backend, with facts, interpretations, and unresolved questions distinguished. (Spec 2 §10.3)
2. THE SYSTEM SHALL keep every claim traceable to its supporting record where the backend provides one. (Spec 2 §10.4)

### Requirement 19: Reduced motion and skip

**User Story:** As a user who prefers less motion, I want to skip or reduce the animation without changing the result, so that motion preferences never affect what Sean finds.

#### Acceptance Criteria

1. WHILE the user's reduced-motion preference is set, THE SYSTEM SHALL reduce nonessential animation. (Spec 2 §6.6, §15.4)
2. THE SYSTEM SHALL provide a control that skips nonessential reveal animation. (Spec 2 §6.6, §15.5)
3. WHEN animation is skipped or reduced, THE SYSTEM SHALL NOT skip retrieval, alter the result, or bypass evidence validation. (Spec 2 §6.6, §15.5)
4. THE SYSTEM SHALL remain understandable when animation is reduced or disabled. (Spec 2 §15.4)

### Requirement 20: Sound

**User Story:** As a user, I want optional, subtle sound that never suggests a success I did not get, so that audio never misleads me about the outcome.

#### Acceptance Criteria

1. THE SYSTEM SHALL disable sound by default. (Spec 2 §14.1, Architecture §6.6)
2. THE SYSTEM SHALL provide controls to enable sound, disable sound, and adjust volume, and SHALL keep those controls accessible during the experience. (Spec 2 §14.2)
3. THE SYSTEM SHALL NOT play a success-oriented sound for `FAILED`, `CANCELLED`, or `INSUFFICIENT_EVIDENCE`. (Spec 2 §14.4, §21.5)
4. THE SYSTEM SHALL use only original or permissively licensed sound assets, record each asset's source and license in the repository before use, and SHALL NOT depend on unlicensed commercial audio or a remote audio service. (Spec 2 §14.5, §22.4, Architecture §6.6; owner decision O-D7)
5. THE SYSTEM SHALL keep the experience fully functional with sound disabled or unavailable. (Spec 2 §14.6, §19.5)

### Requirement 21: Accessibility

**User Story:** As a user who relies on the keyboard or a screen reader, I want every essential control and status to be usable, so that I can complete an investigation without relying on a mouse, color, animation, or sound alone.

#### Acceptance Criteria

1. THE SYSTEM SHALL make every essential control keyboard accessible. (Spec 2 §16.1)
2. THE SYSTEM SHALL communicate each state change through accessible text, and SHALL NOT rely on color, animation, or sound alone. (Spec 2 §16.5)
3. THE SYSTEM SHALL keep focus predictable when an investigation starts, completes, fails, or is cancelled, and SHALL NOT move focus during an animation. (Spec 2 §16.6)
4. THE SYSTEM SHALL keep text and interactive controls at sufficient contrast, and SHALL keep decorative effects from obscuring information. (Spec 2 §16.3)
5. THE SYSTEM SHALL keep technical text, metadata, and status indicators readable at normal display sizes. (Spec 2 §16.2)

### Requirement 22: Animation technology and performance

**User Story:** As a developer, I want the experience built with native browser capabilities, so that it stays light and dependency-free.

#### Acceptance Criteria

1. THE SYSTEM SHALL implement animation with CSS transitions, CSS animations, and browser-native APIs. (Spec 2 §15.2, §22.3)
2. THE SYSTEM SHALL NOT add a third-party animation library without a documented technical justification and approval. (Spec 2 §15.2, §22.3)
3. THE SYSTEM SHALL keep animations from interfering with evidence inspection, keyboard navigation, input responsiveness, or state transitions. (Spec 2 §15.3)
4. THE SYSTEM SHALL keep the interface responsive while retrieval runs. (Spec 2 §19.4)

### Requirement 23: Backend authority

**User Story:** As an engineer, I want the frontend to show the backend's results and never reconstruct history, so that every displayed result comes from verified backend evidence.

#### Acceptance Criteria

1. THE SYSTEM SHALL NOT reconstruct repository history in the frontend. (Spec 2 §17.2)
2. THE SYSTEM SHALL NOT invent investigation outcomes, evidence, or classifications. (Spec 2 §2.1, §17.5, Architecture §6.4)
3. THE SYSTEM SHALL NOT add a backend or persistent service for the experience. (Spec 2 §17.3, §22.1, §22.5)

### Requirement 24: Backend contract and validation

**User Story:** As a maintainer, I want the frontend to reject malformed backend responses safely, so that a malformed response never produces a false conclusion.

#### Acceptance Criteria

1. THE SYSTEM SHALL consume the investigation result shape defined once in the canonical contract (`.kiro/specs/evidence-retrieval/design.md`, "Shared integration contract (canonical)"), which keeps retrieval status and classification distinct. (Spec 2 §18.1; Spec 1 §10.3)
2. THE SYSTEM SHALL validate required response fields, recognized status values, and the presence rules of the canonical contract before use. (Spec 2 §18.5)
3. THE SYSTEM SHALL NOT define, extend, or rename any contract field. A contract change is made in the canonical contract first. (Spec 2 §18.1)
4. THE SYSTEM SHALL represent backend errors in a form the frontend can show safely, and SHALL NOT display internal exception details. (Spec 2 §18.7, §12.1)
5. THE SYSTEM SHALL distinguish a request-level error (no result) from a backend retrieval status, and SHALL NOT present a request-level error as a retrieval failure. (Spec 2 §8.3, §18.7; design.md, category B)
6. THE SYSTEM SHALL treat missing optional fields as absent and SHALL NOT manufacture them. (Spec 2 §18.3)

### Requirement 25: Recovery actions

**User Story:** As a user, I want a sensible next step after an error, without being misled about the result, so that I can recover without mistaking a failed operation for an answer.

#### Acceptance Criteria

1. WHERE appropriate, THE SYSTEM SHALL offer recovery actions such as retry, refine the question, inspect available evidence, or select a different repository context. (Spec 2 §12.2)
2. THE SYSTEM SHALL NOT present a recovery action as if a failed operation had produced a valid conclusion. (Spec 2 §12.2)

### Requirement 26: Failure isolation

**User Story:** As a user, I want evidence and source inspection to keep working even if sound or animation fails, so that optional presentation features never block my investigation.

#### Acceptance Criteria

1. IF audio or animation fails, THEN THE SYSTEM SHALL NOT prevent retrieval or source inspection. (Spec 2 §19.5)
2. THE SYSTEM SHALL keep the application usable when an optional presentation feature fails. (Spec 2 §19.5)

### Requirement 27: Visual identity

**User Story:** As a user, I want a distinctive, readable, non-horror interface that feels like the Ouija metaphor, so that the interface is atmospheric without hurting readability.

#### Acceptance Criteria

1. THE SYSTEM SHALL use the visual direction in Spec 2 §5: aged wood, ivory lettering, antique gold accents, restrained amber light, and charcoal surfaces. (Spec 2 §5.1, §5.2)
2. THE SYSTEM SHALL avoid excessive glow, constant motion, unnecessary particles, and illegible decorative text. (Spec 2 §5.5)
3. THE SYSTEM SHALL keep technical text in highly readable typefaces. (Spec 2 §5.4)
4. Visual acceptance is established by review against Spec 2 §5 and §21.1, because these criteria are not directly testable. (Spec 2 §21)

### Requirement 28: Automated tests

**User Story:** As a reviewer, I want the behavior covered by executed tests, so that reported results are backed by observed evidence.

#### Acceptance Criteria

1. THE SYSTEM SHALL cover every valid combination of retrieval status and classification with tests of the derived presentation state. (Spec 2 §21.7)
2. THE SYSTEM SHALL cover preservation of backend values, no conclusion for insufficient evidence, narrow conclusions for partial results, failure and cancellation behavior, invalid-response handling, responsive layout, reduced motion, sound disabled by default, and evidence card selection. (Spec 2 §21.7)
3. THE SYSTEM SHALL NOT report any test as passing unless it was executed and its result observed. (Playbook §9)

### Requirement 29: Scope

**User Story:** As a maintainer, I want the MVP kept to what Spec 2 requires, so that unapproved features do not enter the product.

#### Acceptance Criteria

1. THE SYSTEM SHALL NOT include the features excluded by Spec 2 §20.2, including multiplayer, user themes, 3D physics, collaboration, and AI-generated historical evidence. (Spec 2 §20.2)
2. WHEN a feature is outside the MVP scope, THE SYSTEM SHALL require explicit review before implementation. (Spec 2 §20.3)
