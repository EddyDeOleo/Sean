# Requirements Document

## Introduction

Engineering Intelligence, Kiro Repository Advisor, and 3D Survival Horror (Native Spec).

Source: `docs/specs/spec-4-engineering-intelligence.md` (SEAN-SPEC-04 v1.0). That document is the authority. This file lists testable requirements and their stage. Task state is recorded in `.kiro/reports/phase-status.md`.

## Glossary

- **Advisor**: the Kiro Repository Advisor. A deterministic component that turns profile observations into capability recommendations.
- **Capability**: a Kiro feature listed in the Advisor catalog (steering, specs, hooks, MCP, and others), with a scope.
- **Scope**: `REPOSITORY`, `USER`, or `RUNTIME`. Only a `REPOSITORY` capability can produce a repository artifact.
- **Observation**: a typed fact read from the committed tree at `HEAD`, with a classification, a source, and the commit it was read at.
- **Profile**: the observations and summaries for one registered repository at one `HEAD` commit.
- **Classification**: the epistemic label of a claim: `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, or `INSUFFICIENT_EVIDENCE`.
- **Retrieval status**: the backend outcome of a retrieval: `COMPLETE`, `PARTIAL`, `INSUFFICIENT`, or `FAILED`. It is separate from classification.
- **Snapshot**: an immutable copy of a report, saved to IndexedDB before the interlude starts and labelled `SAVED SNAPSHOT`.
- **Interlude**: the Ouija sequence and the 3D game shown between a successful analysis and the report.
- **Demo**: the 3D game started from Settings. It has no backend call and no report.
- **Planchette**: the pointer that moves across the Ouija board.
- **Registry**: the list of registered local repositories, stored in `%LOCALAPPDATA%\Sean\config\repositories.json`.
- **HEAD**: the committed tree that the profile scanner reads. The working tree is not read.

## Requirements

### Requirement 1: Read-only repository profile (stage 2)

**User Story:** As an engineer, I want Sean to read a repository's committed state without changing it, so that the profile reflects what is committed.

#### Acceptance Criteria

1.1 WHEN a registered repository ID is profiled, THE backend SHALL read only the committed tree at `HEAD` through the guarded Git runner.
1.2 THE profile SHALL list typed observations, each with a classification of `DOCUMENTED` or `INFERRED`, a source, and the `HEAD` commit.
1.3 IF a scan limit is reached or the repository is shallow, THEN THE profile SHALL set `truncated` or `shallow` and lower confidence.
1.4 THE profile SHALL NOT contain filesystem paths outside the repository, file contents beyond parsed manifest fields, or author names.
1.5 THE profile SHALL NOT read pull requests, issues or CI results, and SHALL state that in its limitations.
1.6 NO Phase 3 file SHALL change.

### Requirement 2: Kiro Repository Advisor (stage 2)

**User Story:** As an engineer, I want Kiro capability recommendations backed by my repository's evidence, so that I adopt only the Kiro features the repository needs.

#### Acceptance Criteria

2.1 THE Advisor SHALL derive every recommendation from a fired rule and from observations that exist in the profile.
2.2 EVERY recommendation SHALL satisfy the contract in Spec 4 §6.2, enforced by validation.
2.3 THE Advisor SHALL return `NOT_RECOMMENDED` or `INSUFFICIENT_EVIDENCE` with a reason where no signal supports a capability.
2.4 THE Advisor SHALL NOT produce a repository artifact for a capability whose scope is not `REPOSITORY`.
2.5 FOR repositories of different shape THE Advisor output SHALL differ accordingly (verified by tests).
2.6 THE roadmap SHALL be ordered `IMMEDIATE`, `NEAR_TERM`, `LONGER_TERM`, with not-recommended items listed separately.

### Requirement 3: Interpretation (stage 2)

**User Story:** As a user, I want to ask for an investigation in plain language, so that I do not have to fill in a long form.

#### Acceptance Criteria

3.1 THE deterministic interpreter SHALL resolve a repository reference and an optional target path that exists in the committed tree.
3.2 AN unresolved GitHub URL SHALL produce a clear message and no cloning.
3.3 THE Gemini adapter SHALL send only the sentence and registered IDs, SHALL be disabled without `SEAN_GEMINI_API_KEY`, and SHALL have its output re-validated deterministically.
3.4 THE response SHALL state which interpreter answered.

### Requirement 4: Application shell and report (stage 3)

**User Story:** As a user, I want a professional interface and a clear report, so that I can read facts, inferences and recommendations separately.

#### Acceptance Criteria

4.1 THE application SHALL open as a professional product with a collapsible sidebar and one natural-language input.
4.2 THE sidebar SHALL be hidden during the Ouija and the game.
4.3 THE settings page SHALL provide the controls in Spec 4 §9.1 and persist them locally.
4.4 THE unified report SHALL present facts, inferences, recommendations, artifacts and verified results distinctly.
4.5 REPORT snapshots SHALL be stored in IndexedDB before the Ouija starts, labelled as saved snapshots, and re-validated on load.
4.6 AN Advisor failure SHALL NOT discard a successful investigation.

### Requirement 5: Artifacts (stage 4)

**User Story:** As an engineer, I want to preview generated Kiro files before using them, so that I can review them without Sean changing my repository.

#### Acceptance Criteria

5.1 THE system SHALL generate previews only for `REPOSITORY`-scope capabilities.
5.2 IF the target path exists at `HEAD`, THEN THE preview SHALL show `CONFLICT` and a diff, and SHALL NOT propose an overwrite as the default.
5.3 GENERATED files SHALL pass their format validator and SHALL contain no secrets.
5.4 THE UI SHALL show the lifecycle states separately and SHALL NOT claim "applied" from an export.

### Requirement 6: Ouija flow (stage 5)

**User Story:** As a user, I want the interlude to appear only after a successful analysis, so that it never hides or alters a failure.

#### Acceptance Criteria

6.1 THE Ouija SHALL appear only after a successful analysis and a saved snapshot.
6.2 FAILED, INVALID, REJECTED and CANCELLED outcomes SHALL NOT trigger it.
6.3 THE interruption line SHALL appear about 2000 ms after the board settles.
6.4 SKIP SHALL go to the report, and reduced motion SHALL use static text.

### Requirement 7: 3D game (stage 6)

**User Story:** As a player, I want a first-person survival game that runs independently of the analysis, so that playing it never changes the report.

#### Acceptance Criteria

7.1 THE game SHALL fill the viewport and hide all application chrome.
7.2 THE game SHALL provide WASD movement, mouse look with pointer lock, a flashlight, collision, interactions, objectives, pause, retry and skip.
7.3 THE monster SHALL implement the six states with a tested transition table, detection by sight and noise, pursuit and capture.
7.4 CAPTURE SHALL trigger a jumpscare only when enabled, and SHALL offer retry or continue.
7.5 EVERY outcome SHALL lead to an unchanged report.
7.6 LEAVING THE GAME SHALL release the renderer, textures, listeners, loop, pointer lock and audio.
7.7 THE 2D game SHALL be removed.

### Requirement 8: Audio (stage 7)

**User Story:** As a player, I want sound that reacts to the game state and starts only after I interact with the page, so that audio never plays without my action.

#### Acceptance Criteria

8.1 AUDIO SHALL start only after a user gesture, with master, ambient and effects volume and mute.
8.2 AUDIO SHALL react to state and proximity, and SHALL be disposed on exit.
8.3 AN asset and license manifest SHALL exist. Procedural audio is acceptable.

### Requirement 9: Verification (stage 8)

**User Story:** As the owner, I want independent reviews and screenshots of each view, so that the work can be checked before acceptance.

#### Acceptance Criteria

9.1 INDEPENDENT reviews of architecture, evidence integrity, security, Advisor quality, artifacts, gameplay and accessibility SHALL be run in separate contexts, with findings and fixes recorded.
9.2 SCREENSHOTS of the views listed in directive §18.7 SHALL be captured and inspected.
9.3 THE completion report SHALL list unverified items explicitly and SHALL confirm Phase 3 is CLOSED.
