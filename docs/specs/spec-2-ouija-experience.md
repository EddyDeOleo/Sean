# Sean — Spec 2: Ouija Experience & Interaction

**Version:** 1.6  
**Status:** Approved  
**Document Type:** Product Experience and UX Specification  
**Project:** Sean  
**Supersedes:** Spec 2 v1.5  
**Language:** English

---

## 1. Purpose

This specification defines the user experience, interaction model, visual design, and frontend behavior of Sean.

Sean reconstructs the technical history of a software repository and explains why specific code, mechanisms, and architectural decisions exist, using verifiable historical evidence.

The interface must make that investigation understandable and engaging without compromising evidence integrity.

The Ouija board is the central interaction metaphor. It is not a decorative theme placed around a generic chatbot.

The experience should communicate the idea of summoning the technical history of a repository while making it clear that every conclusion must be supported by evidence.

**Core product tagline:**

"Summon the reasoning behind the code."

**Experience principle:**

The experience may be mysterious. The evidence must remain factual.

---

## 2. Experience Principles

The experience MUST follow these principles:

### 2.1 Evidence Before Presentation

The interface MUST display conclusions based on backend evidence.

Animations, visual effects, sounds, and optional AI-generated wording MUST NOT introduce facts or imply certainty that the backend result does not support.

### 2.2 Explicit Uncertainty

The interface MUST distinguish:

- Documented historical facts.
- Reasonable technical inferences.
- Partial evidence.
- Insufficient evidence.
- Retrieval failures.

Uncertainty MUST be visible and understandable.

### 2.3 Human Inspection

Users MUST be able to inspect the sources supporting a conclusion.

The interface MUST provide access to the relevant commits, pull requests, issues, documentation, and code history when those sources are available.

### 2.4 Stable Layout

The primary interface layout MUST remain stable throughout the investigation.

Revealing evidence MUST NOT cause major layout shifts or move the primary interaction surface unexpectedly.

### 2.5 Progressive Revelation

The experience SHOULD reveal the investigation progressively.

The user should understand that the board is responding to an actual retrieval process, not generating arbitrary theatrical output.

### 2.6 Accessibility

The experience MUST remain usable without animation or sound.

Motion reduction, keyboard interaction, readable contrast, and clear status communication are mandatory considerations.

---

## 3. Primary User Journey

The main interaction follows three stages.

### 3.1 Invocation

The user enters a technical question about the repository.

Examples:

- "Why does this service use Redis?"
- "Why was this function introduced?"
- "What problem was this workaround designed to solve?"
- "Why was this API structured this way?"
- "Who introduced this behavior and what evidence explains it?"

The user initiates the investigation through the Ouija board interface.

### 3.2 Investigation and Revelation

The backend retrieves and evaluates historical evidence.

The board communicates the investigation through a cinematic planchette movement.

The movement MUST be driven by actual application state and backend progress or results. It MUST NOT be random or imply that the application has discovered information that it has not retrieved.

The planchette MUST settle before the final phrase is revealed.

### 3.3 Evidence Emergence

After the board settles, the left Evidence & History zone presents the evidence supporting the result.

The user can inspect the conclusion, source cards, historical sequence, and technical explanation.

The user MUST be able to distinguish the conclusion from its supporting evidence.

---

## 4. Main Interface Layout

### 4.1 Two Primary Zones

The desktop interface MUST contain exactly two primary zones:

1. **Evidence & History — LEFT**
2. **Ouija Board — RIGHT**

The Ouija board is the primary interaction surface.

The Evidence & History zone is the primary source-inspection and explanation surface.

There MUST NOT be a third primary investigation panel or a separate right-side evidence panel.

### 4.2 Left Zone: Evidence & History

The left zone contains:

- Evidence cards.
- Source references.
- Introducing commits.
- Relevant pull requests.
- Related issues.
- Documentation references.
- Code history and blame information.
- Selected source details.
- Technical explanations.
- Historical sequences and timelines.

The zone MUST support inspection of the evidence behind the conclusion.

Selecting an evidence card MUST display its corresponding source details within the left zone.

This interaction MUST NOT create a third primary zone.

### 4.3 Right Zone: Ouija Board

The right zone contains:

- The question or investigation prompt.
- The Ouija board.
- The planchette.
- Invocation and investigation feedback.
- The revealed conclusion or neutral investigation status.
- Epistemic classification.
- Relevant interaction controls.

The board MUST remain the central visual focus.

### 4.4 Responsive Layout

On wide screens, the two primary zones MUST appear side by side:

- Evidence & History on the left.
- Ouija Board on the right.

On narrow screens, the two zones MUST stack vertically.

The board and evidence content MUST remain accessible and readable.

Responsive behavior MUST NOT introduce an additional primary zone or remove essential evidence information.

### 4.5 Stable Presentation

The Evidence & History zone MUST be visible from the beginning of the experience.

Its content MAY remain concealed, collapsed, or in an initial empty state until the investigation reaches the appropriate reveal stage.

The interface MUST preserve the layout dimensions sufficiently to avoid disruptive layout shifts during evidence presentation.

---

## 5. Visual Identity

### 5.1 Overall Direction

The visual identity is a premium reinterpretation of a classic Ouija board.

It MUST feel distinctive, polished, immersive, and comfortable to use.

The experience MUST NOT resemble a cheap horror-game interface.

### 5.2 Visual References

The design direction combines:

- Classic Ouija board visual language.
- Aged wood.
- Ivory lettering.
- Antique gold details.
- Restrained amber illumination.
- Dark charcoal surfaces.
- Refined typography.
- Subtle atmospheric effects.

### 5.3 Color and Contrast

The interface SHOULD use:

- Charcoal and deep neutral backgrounds.
- Aged wood tones.
- Ivory or warm white text.
- Antique gold accents.
- Restrained amber highlights.

The overall interface MUST NOT be excessively dark.

Text, evidence metadata, controls, and status indicators MUST remain comfortably readable.

### 5.4 Typography

Typography MUST prioritize readability.

Decorative typography MAY be used for the board itself, but technical explanations, source metadata, code, and evidence MUST use highly readable typefaces.

### 5.5 Visual Restraint

Avoid:

- Excessive glow.
- Unnecessary particle effects.
- Constant movement.
- Excessive visual noise.
- Illegible decorative text.
- Horror imagery that competes with the technical purpose.

The interface should feel atmospheric without making technical investigation difficult.

---

## 6. Ouija Board Interaction Model

### 6.1 Board as Primary Interaction Surface

The board MUST be the main visual representation of the investigation.

It MUST communicate the current interaction state clearly.

### 6.2 User Input

The user MUST be able to enter a question in natural language.

The question MUST be associated with the active repository context.

The interface SHOULD provide clear feedback when a question is empty, ambiguous, or cannot be submitted.

### 6.3 Invocation

The user initiates the investigation through an explicit action.

The application MUST prevent accidental repeated submissions while an investigation is already running, unless the implementation explicitly supports concurrent investigations.

### 6.4 Planchette Movement

The planchette MUST use deliberate cinematic movement.

The required movement stages are:

1. Wake.
2. Search.
3. Reveal preparation.
4. Settle.
5. Return or remain in its appropriate final state.

Movement MUST be driven by application state.

It MUST NOT use random positions or arbitrary letters to simulate historical discovery.

### 6.5 Phrase Revelation

The planchette MUST settle before the final phrase appears.

The complete phrase MUST be revealed as a whole.

The interface MUST NOT use letter-by-letter revelation as the primary result mechanism.

A successful investigation may reveal its supported conclusion.

An insufficient-evidence result may reveal the neutral system phrase:

`INSUFFICIENT EVIDENCE`

That phrase communicates the system's epistemic state. It MUST NOT be presented as a historical conclusion.

A failed or cancelled investigation MUST NOT perform a successful conclusion reveal.

### 6.6 Motion Controls

Users MUST be able to skip or reduce nonessential animation.

The application MUST respect reduced-motion preferences.

Skipping animation MUST NOT skip retrieval, alter the result, or bypass evidence validation.

---

## 7. Planchette and Revelation Behavior

### 7.1 State-Driven Movement

The planchette animation MUST correspond to the application lifecycle.

The visual state MUST NOT independently determine or modify backend investigation status.

### 7.2 Successful Conclusion

For a supported conclusion, the planchette may perform the cinematic reveal.

The complete conclusion MUST become visible only after the planchette settles.

The conclusion MUST remain consistent with the backend result.

### 7.3 Partial Conclusion

For a partial result, the planchette MAY reveal the narrow conclusion supported by the available evidence.

The interface MUST visibly communicate that the investigation or evidence is incomplete.

It MUST NOT imply that the partial conclusion is a complete historical explanation.

### 7.4 Insufficient Evidence

When the epistemic classification is `INSUFFICIENT_EVIDENCE`, the planchette MUST NOT reveal a historical conclusion.

It MAY reveal:

`INSUFFICIENT EVIDENCE`

This is a neutral system status, not an answer about the repository's history.

The interface MUST explain that the available evidence does not support a reliable historical conclusion.

### 7.5 Failed Investigation

A failed retrieval MUST NOT be presented as a successful revelation.

The interface MUST communicate the failure and provide a recovery action when possible.

### 7.6 Cancelled Investigation

A cancelled investigation MUST NOT be presented as a successful conclusion or as proof of insufficient historical evidence.

The interface MUST clearly communicate cancellation.

---

## 8. Application State Model

### 8.1 State Dimensions

The application MUST distinguish three concepts:

1. Frontend lifecycle state.
2. Backend retrieval status.
3. Backend epistemic classification.

These concepts MUST NOT be merged into a single status field.

### 8.2 Frontend Lifecycle States

The frontend lifecycle states are:

- `IDLE`
- `QUESTION_READY`
- `INVOKING`
- `RETRIEVING`
- `REVEALING`
- `PRESENTING_EVIDENCE`
- `COMPLETED`
- `PARTIAL`
- `INSUFFICIENT_EVIDENCE`
- `FAILED`
- `CANCELLED`

These states describe the user experience and application lifecycle.

They do not replace backend retrieval status or epistemic classification.

### 8.3 Backend Retrieval Status

The backend retrieval statuses are:

- `COMPLETE`
- `PARTIAL`
- `INSUFFICIENT`
- `FAILED`

Their meanings:

**COMPLETE**

All planned retrieval operations completed successfully. This does not mean that every possible historical source was discovered.

**PARTIAL**

Some planned retrieval operations could not be completed, or only part of the expected evidence was retrieved.

**INSUFFICIENT**

The retrieval process completed without enough retrieved information to satisfy the investigation's evidence requirements.

This does not prove that the repository contains no relevant historical evidence.

**FAILED**

The retrieval process could not produce a valid investigation result.

A failed retrieval MUST NOT be interpreted as proof that historical evidence is absent.

### 8.4 Epistemic Classification

The epistemic classifications are:

- `DOCUMENTED`
- `INFERRED`
- `PARTIAL_EVIDENCE`
- `INSUFFICIENT_EVIDENCE`

Their meanings:

**DOCUMENTED**

The conclusion is directly supported by explicit historical documentation or other direct evidence.

**INFERRED**

The conclusion is a reasoned interpretation supported by evidence, but the historical intent is not explicitly documented.

**PARTIAL_EVIDENCE**

Some elements of the conclusion are supported, but important parts remain unresolved.

**INSUFFICIENT_EVIDENCE**

The available evidence does not support a reliable historical conclusion.

A `FAILED` retrieval does not require an epistemic classification.

### 8.5 Deterministic UI-State Mapping

The frontend MUST derive its final presentation state using the following priority order:

| Priority | Backend condition | Frontend state |
|---|---|---|
| 1 | Retrieval status is `FAILED` | `FAILED` |
| 2 | Classification is `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` |
| 3 | Classification is `PARTIAL_EVIDENCE` | `PARTIAL` |
| 4 | Retrieval status is `PARTIAL` or `INSUFFICIENT`, with classification `DOCUMENTED` or `INFERRED` | `PARTIAL` |
| 5 | Retrieval status is `COMPLETE`, with classification `DOCUMENTED` or `INFERRED` | `COMPLETED` |

These rules are exhaustive for valid completed investigation results.

A cancellation is handled as the application lifecycle outcome `CANCELLED`, not as a retrieval status or epistemic classification.

Invalid combinations, missing required fields, or contradictory backend values MUST NOT produce a fabricated successful conclusion.

The frontend MUST display the original backend retrieval status and classification separately, even when it derives a different presentation state.

### 8.6 State Transitions

The normal lifecycle is:

`IDLE → QUESTION_READY → INVOKING → RETRIEVING`

After retrieval, the interface transitions to the appropriate reveal and presentation state.

Possible final states include:

- `COMPLETED`
- `PARTIAL`
- `INSUFFICIENT_EVIDENCE`
- `FAILED`
- `CANCELLED`

The interface MUST prevent invalid transitions from presenting a successful result.

### 8.7 Cancellation

Cancellation MUST be handled as an application lifecycle event.

It MUST stop or abandon the active user-facing investigation safely.

The interface MUST NOT convert cancellation into an epistemic classification.

---

## 9. Evidence & History Zone

### 9.1 Purpose

The left zone provides verifiable context for the conclusion.

It MUST allow users to inspect the actual historical material supporting the investigation.

### 9.2 Evidence Cards

Each evidence card SHOULD display the available relevant metadata:

- Source type.
- Source title or identifier.
- Author, when available.
- Date.
- Repository context.
- Relevance to the investigation.
- Evidence classification or role when applicable.

Metadata MUST be based on retrieved source information.

The interface MUST NOT invent missing authors, dates, source identifiers, or relationships.

### 9.3 Source Types

The interface SHOULD support the following source types when returned by the backend:

- Git commits.
- Git blame information.
- Pull requests.
- Issues.
- Repository documentation.
- Historical code references.

Unavailable source types MUST NOT be represented as successfully retrieved evidence.

### 9.4 Evidence Selection

Selecting a card MUST display its details in the left zone.

The selected source MUST be identifiable and traceable to the corresponding backend evidence record.

### 9.5 Historical Sequence

When the backend provides a meaningful historical sequence, the interface SHOULD display it chronologically.

A timeline MUST distinguish verified dates and events from inferred relationships.

Temporal proximity MUST NOT be represented as proof of causality.

### 9.6 Empty Evidence

If no evidence is available for presentation, the interface MUST explain why.

It MUST distinguish between:
- Insufficient retrieved evidence.
- Retrieval failure.
- A valid investigation result that contains no supporting source records.

These conditions MUST NOT be represented interchangeably.

---

## 10. Conclusion and Technical Explanation

### 10.1 Conclusion

The conclusion MUST be concise and understandable.

It MUST accurately reflect the backend investigation result.

It MUST NOT assert undocumented historical intent as fact.

### 10.2 Epistemic Classification Display

When applicable, the classification MUST be displayed near the conclusion.

For insufficient evidence, it MUST be displayed near the neutral system status.

For failed or cancelled investigations, no epistemic classification is required.

### 10.3 Technical Explanation

The interface SHOULD provide a technical explanation that connects the evidence to the conclusion.

The explanation MUST distinguish:

- Directly documented facts.
- Technical interpretations.
- Unresolved questions.

### 10.4 Source Attribution

Claims MUST remain traceable to their supporting evidence.

When a statement is based on multiple sources, the interface SHOULD identify the relevant supporting records.

### 10.5 Evidence Integrity

The frontend MUST NOT generate missing source content or alter source-faithful technical information.

Code excerpts, commit messages, and documentation excerpts MUST preserve their original content to the extent required for accurate inspection.

---

## 11. Retrieval and Evidence Status Presentation

### 11.1 Separate Statuses

The interface MUST communicate retrieval status and epistemic classification independently.

A single generic status label such as "Found" or "Not found" is insufficient.

### 11.2 Insufficient Retrieval

`INSUFFICIENT` retrieval status means that the retrieval process did not obtain enough information for the intended investigation.

It does not establish that the repository has no relevant history.

If a narrow fact is nevertheless supported and the classification is `DOCUMENTED` or `INFERRED`, the interface may display that limited result using the `PARTIAL` UI state.

### 11.3 Insufficient Evidence

`INSUFFICIENT_EVIDENCE` means the available evidence does not support a reliable historical conclusion.

The board MUST NOT reveal a historical answer in this state.

### 11.4 Retrieval Failure

`FAILED` means the retrieval operation could not produce a valid result.

It MUST NOT be described as an absence of historical evidence.

### 11.5 Partial Results

Partial results MUST identify their limitations.

The interface SHOULD make it clear which parts of the investigation are supported and which remain unresolved.

---

## 12. Error Handling and Recovery

### 12.1 Error Communication

Errors MUST be understandable and actionable.

The interface SHOULD avoid exposing internal stack traces or sensitive implementation details to the user.

### 12.2 Recovery Actions

Where appropriate, provide actions such as:

- Retry the investigation.
- Refine the question.
- Inspect the available evidence.
- Select a different repository context.

Recovery actions MUST NOT imply that a failed operation produced a valid historical conclusion.

### 12.3 Failure During Animation

If an investigation fails during an animation:

- Stop the success-oriented reveal.
- Display the failure state.
- Preserve the user's question.
- Offer a recovery action when possible.

### 12.4 Cancellation Feedback

The interface MUST promptly communicate cancellation.

It MUST NOT leave the board indefinitely in an apparent successful reveal or active search state.

---

## 13. Partial and Insufficient Investigation Experiences

### 13.1 Partial Investigation

A partial investigation may contain useful evidence.

The interface MUST present only conclusions supported by the retrieved evidence.

The interface MUST visibly communicate the limitations of the result.

### 13.2 Insufficient Evidence Experience

When classification is `INSUFFICIENT_EVIDENCE`:

- The board MUST NOT reveal a historical conclusion.
- The neutral status phrase MAY be displayed.
- The classification MUST be visible.
- The retrieval status MUST remain visible.
- The explanation MUST state that the available evidence is insufficient for a reliable conclusion.

### 13.3 No False Negative

The interface MUST NOT communicate that no historical explanation exists merely because retrieval was incomplete or insufficient.

The user should understand the difference between:

- No evidence retrieved.
- Insufficient evidence to conclude.
- Retrieval failure.
- A supported but limited conclusion.

### 13.4 Partial Conclusion Boundaries

A partial conclusion MUST remain within the boundaries of its evidence.

The interface MUST NOT broaden its wording through presentation effects, generated summaries, or animation.

---

## 14. Sound Design

### 14.1 MVP Requirement

Sound is included in the MVP.

Sound MUST be disabled by default.

### 14.2 Sound Controls

The user MUST be able to:

- Enable sound.
- Disable sound.
- Adjust volume.

The sound controls MUST remain accessible during the experience.

### 14.3 Sound Design

Sound SHOULD be subtle and atmospheric.

It MAY include restrained effects for:

- Invocation.
- Planchette movement.
- Reveal completion.
- Evidence presentation.

Sound MUST NOT distract from technical content or make the interface uncomfortable.

### 14.4 State Accuracy

Sound MUST reflect actual interface states.

The application MUST NOT play success-oriented sounds for failed or cancelled investigations.

Insufficient evidence MUST NOT sound like a successful historical conclusion.

### 14.5 Asset Requirements

Sound assets MUST be original or appropriately licensed for the project.

The project MUST NOT depend on unlicensed commercial audio.

### 14.6 Accessibility

All sound MUST be optional.

The experience MUST remain fully functional without audio.

---

## 15. Animation and Motion

### 15.1 Purpose

Animation exists to communicate interaction and state transitions.

It MUST NOT replace textual feedback or evidence.

### 15.2 Default Implementation

CSS transitions, CSS animations, and browser-native APIs SHOULD be used by default.

A third-party animation library MUST NOT be added without a concrete technical justification and review.

### 15.3 Performance

Animations MUST remain lightweight.

They MUST NOT interfere with:

- Evidence inspection.
- Keyboard navigation.
- Input responsiveness.
- Application state transitions.

### 15.4 Reduced Motion

The application MUST respect the user's reduced-motion preference.

The experience MUST remain understandable when animations are reduced or disabled.

### 15.5 Skip Behavior

Users MUST be able to skip nonessential reveal animations.

Skipping animation MUST NOT alter the investigation result or backend evidence.

---

## 16. Accessibility and Usability

### 16.1 Keyboard Support

All essential controls MUST be keyboard accessible.

### 16.2 Readability

Technical explanations, evidence metadata, and status indicators MUST remain readable at normal display sizes.

### 16.3 Contrast

Text and interactive controls MUST maintain sufficient contrast against their backgrounds.

Decorative effects MUST NOT obscure essential information.

### 16.4 Motion and Sound

Reduced motion and disabled sound MUST be supported.

Neither feature may be required to understand the investigation result.

### 16.5 Semantic Feedback

The application MUST communicate state changes through accessible textual feedback.

Color, animation, or sound alone MUST NOT communicate a critical state.

### 16.6 Focus Management

Focus MUST remain predictable when the investigation begins, completes, fails, or is cancelled.

The interface MUST NOT unexpectedly move keyboard focus during an animation.

---

## 17. Frontend Architecture and Responsibilities

### 17.1 Frontend Scope

The frontend is responsible for:

- User input.
- Ouija board presentation.
- Evidence and history presentation.
- Application lifecycle states.
- Animation and sound controls.
- Backend result visualization.
- User feedback and error presentation.

### 17.2 Backend Authority

The frontend MUST NOT independently reconstruct repository history.

It MUST consume backend investigation results and preserve their evidence and classification semantics.

### 17.3 Separation of Responsibilities

The Ouija board presentation, evidence cards, and layout components SHOULD be organized as separate frontend responsibilities within the existing frontend project.

They MUST NOT introduce another backend or persistent service.

### 17.4 State Consistency

The frontend MUST use a consistent representation of:

- Question.
- Investigation lifecycle.
- Retrieval status.
- Epistemic classification.
- Conclusion.
- Evidence records.
- Errors and cancellation.

The UI-derived state MUST NOT overwrite backend status fields.

### 17.5 No Independent Evidence Generation

The frontend MUST NOT invent evidence, commit history, source metadata, or historical relationships.

---

## 18. Backend–Frontend Contract Requirements

### 18.1 General Contract

The frontend MUST consume structured backend investigation results.

The contract MUST preserve the distinction between retrieval status and epistemic classification.

### 18.2 Required Result Information

A completed or partial investigation response SHOULD provide:

- Investigation identifier.
- Original question.
- Retrieval status.
- Epistemic classification, when applicable.
- Conclusion, when supported.
- Evidence records.
- Relevant technical explanation.
- Relevant source references.
- Limitations and unresolved information.

### 18.3 Optional Fields

A conclusion MAY be absent when the evidence does not support one.

An epistemic classification MAY be absent for failed or cancelled operations.

The frontend MUST NOT manufacture missing fields.

### 18.4 Evidence Records

Evidence records MUST contain sufficient information for the frontend to identify and present the source.

Source metadata MUST be based on backend retrieval.

### 18.5 Contract Validation

The frontend MUST validate required response fields and recognized status values.

Invalid or contradictory combinations MUST NOT result in a successful conclusion reveal.

### 18.6 State Mapping

The deterministic mapping defined in §8.5 is mandatory.

The frontend MUST preserve the original backend values and use the derived UI state only for presentation and interaction.

### 18.7 Error Contract

Backend errors MUST be represented in a form that the frontend can handle safely.

Internal exception details MUST NOT be exposed as user-facing content unless explicitly sanitized and appropriate.

---

## 19. Performance and Resource Constraints

### 19.1 Local-First Operation

The experience MUST support the local-first MVP architecture.

It MUST NOT require paid cloud services or a separate animation service.

### 19.2 Resource Usage

Animation, audio, and evidence rendering MUST remain lightweight.

The frontend MUST avoid unnecessary continuous processing.

### 19.3 Progressive Rendering

The interface SHOULD render its stable layout before the investigation result is available.

Evidence content SHOULD appear progressively when the backend makes it available.

### 19.4 Responsiveness

The application MUST remain responsive while retrieving evidence and presenting results.

Long-running retrieval MUST NOT block ordinary UI interaction.

### 19.5 Failure Isolation

Audio or animation failures MUST NOT prevent evidence retrieval or source inspection.

The application MUST remain usable if optional presentation features fail.

---

## 20. MVP Scope

### 20.1 Included in MVP

The MVP MUST include:

- Two-zone desktop layout.
- Evidence & History on the left.
- Ouija Board on the right.
- Responsive vertical stacking on narrow screens.
- Natural-language question input.
- Explicit investigation invocation.
- Cinematic planchette movement.
- Complete phrase reveal after the planchette settles.
- State-driven animation.
- Supported conclusion presentation.
- Neutral insufficient-evidence status.
- Partial result presentation.
- Failure and cancellation states.
- Visible retrieval status and epistemic classification.
- Evidence cards and source inspection.
- Technical explanation and historical sequence when available.
- Animation skip or reduced-motion behavior.
- Sound controls, with sound disabled by default.
- Accessible textual feedback.

### 20.2 Excluded from MVP

The following are not required for the initial MVP:

- Multiplayer or collaborative investigations.
- User-generated board themes.
- Advanced sound customization beyond basic volume and mute.
- Complex 3D physics.
- Real-time collaborative sessions.
- Separate animation services.
- Paid third-party visual or audio services.
- Independent AI-generated historical evidence.
- A separate frontend backend or microservice.

### 20.3 Scope Discipline

New presentation features MUST NOT introduce unnecessary infrastructure or undermine evidence integrity.

Features outside the MVP require explicit review before implementation.

---

## 21. Acceptance Criteria

The experience is acceptable when all applicable criteria below are satisfied.

### 21.1 Layout

- Evidence & History appears on the left.
- Ouija Board appears on the right.
- Exactly two primary zones exist.
- No third primary investigation panel is introduced.
- Narrow screens stack the two zones vertically.
- The layout remains stable during result revelation.

### 21.2 Investigation

- Users can enter and submit a repository question.
- The board reflects actual investigation lifecycle states.
- Planchette movement is state-driven.
- The complete phrase appears only after the planchette settles.
- The interface does not simulate unsupported historical discovery.

### 21.3 Evidence

- Evidence cards are displayed in the left zone.
- Users can inspect source details.
- Source metadata is based on backend records.
- Technical explanations preserve the distinction between facts and inferences.
- The interface does not invent missing evidence.

### 21.4 Result Semantics

- Retrieval status and epistemic classification are displayed independently.
- The deterministic mapping in §8.5 is implemented.
- A partial retrieval can present a narrow supported fact.
- Insufficient evidence does not reveal a historical conclusion.
- A neutral `INSUFFICIENT EVIDENCE` phrase is not presented as a historical answer.
- A failed retrieval is not presented as proof of absent historical evidence.
- Failed and cancelled operations do not present successful conclusions.
- Invalid backend combinations do not produce fabricated conclusions.

### 21.5 Animation and Sound

- The planchette uses cinematic movement.
- The full phrase appears after the planchette settles.
- Animation can be skipped or reduced.
- Sound is disabled by default.
- Sound can be enabled, muted, and adjusted.
- Sound does not imply success for failure or insufficient-evidence states.
- Optional audio and animation failures do not break the investigation.

### 21.6 Accessibility

- Essential controls are keyboard accessible.
- Status changes are communicated textually.
- Reduced-motion preferences are respected.
- The interface remains usable without sound.
- Evidence and technical content remain readable.

### 21.7 Contract and Testing

Automated tests MUST verify:

- All valid combinations of retrieval status and classification.
- Correct derived UI states.
- Preservation of original backend values.
- No conclusion reveal for insufficient evidence.
- Narrow conclusions for supported partial results.
- Failure and cancellation behavior.
- Invalid response handling.
- Responsive layout behavior.
- Reduced-motion behavior.
- Sound disabled by default.
- Evidence card selection and source inspection.

---

## 22. Technical and Architectural Constraints

### 22.1 Architecture Alignment

This experience MUST follow the approved Sean Architecture & Project Setup document.

The frontend MUST remain part of the existing React and TypeScript application.

The Ouija board MUST NOT introduce a separate backend, service, or persistent process.

### 22.2 Styling

Tailwind CSS is the primary styling approach.

Native CSS MAY be used for global styles, specialized board effects, and animation details when necessary.

No additional styling framework is required.

### 22.3 Animation Technology

CSS transitions, CSS animations, and browser-native APIs are the default implementation approach.

A third-party animation library requires explicit technical justification and approval.

### 22.4 Audio Technology

Audio MUST use original or properly licensed assets.

Audio playback MUST remain optional and must not be a dependency for investigation functionality.

### 22.5 No Speculative Infrastructure

The experience MUST NOT introduce:

- Microservices.
- A separate animation backend.
- A dedicated audio service.
- Paid presentation APIs.
- Unnecessary state-management infrastructure.
- Additional persistent processes without an approved need.

### 22.6 Implementation Discipline

Implementation MUST follow the approved Kiro Engineering Playbook and Kiro Operating Guide.

No implementation may begin before the required documentation and approval gates are satisfied.

---

## 23. Final Product Principle

Sean should feel like an encounter with the technical history of a repository.

The Ouija board is the interaction metaphor. The evidence is the substance of the product.

The experience MUST be immersive without being misleading, atmospheric without sacrificing readability, and visually distinctive without obscuring technical information.

A supported conclusion may be revealed.

A partial conclusion must remain limited to its evidence.

Insufficient evidence must remain insufficient.

A failed investigation must remain a failure, not a fabricated answer.

**Final principle: The experience may be mysterious. The evidence must never be.**