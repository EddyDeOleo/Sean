# Sean — Spec 3: Immersive Experience (Phase 4 Frontend)

**Document ID:** SEAN-SPEC-03
**Version:** 1.0
**Date:** 2026-11-12
**Status:** Owner-directed implementation specification. Authorized by the Phase 4 owner directive of 2026-11-12. It extends Spec 2 v1.6 and does not amend it. It is not itself an approved baseline document.
**Document type:** Frontend experience specification
**Product:** Sean

---

## 1. Purpose and authority

This document specifies the complete Phase 4 frontend of Sean: the investigation interface, the Ouija experience, a narrative interruption, an escape game, an evidence reveal, a final technical report, sound, and the accessibility controls around them.

Authority order, highest first:

1. Spec 1 v2.4 (Evidence Retrieval, Approved) and the Phase 3 closure records. Phase 3 is **CLOSED**, and nothing in this document reopens it.
2. Spec 2 v1.6 (Ouija Experience, Approved).
3. The Architecture and Project Setup document, the Engineering Playbook, and the Operating Guide.
4. This document.

Where this document conflicts with a higher source, the higher source wins and the conflict is recorded in section 2.

**Non-negotiable protections**

- The frontend adapts to the backend. The backend, its evidence model, identity, ranking, classification, retrieval, orchestration, and the `POST /investigations` contract are not changed for any presentation effect.
- The frontend never creates evidence, commits, authors, dates, file changes, or causal relationships.
- The frontend never upgrades, downgrades, or reinterprets a backend retrieval status or classification.
- A real error is never shown as a success and never hidden behind a cinematic effect.
- The narrative layer is fiction. It is labelled as fiction and is never part of an investigation result.

## 2. Relationship to approved specifications, and recorded conflicts

Spec 2 §20.3 requires explicit review for features outside the MVP. The Phase 4 directive of 2026-11-12 is that explicit owner authorization for the narrative interruption and the escape game. Spec 2 §20.2 does not exclude them.

| # | Approved text | Directive text | Resolution |
|---|---|---|---|
| C-1 | Spec 2 §4.1: exactly two primary zones, no third panel. | Interruption and game are immersive scenes. | The scenes render **inside the right (Ouija) zone**. The left Evidence & History zone stays visible and fully readable. No third zone exists. |
| C-2 | Spec 2 §5.3: the interface must not be excessively dark. | Deep blacks and charcoal. | The base interface is charcoal with ivory text and tested contrast. Only the scene stage inside the right zone darkens during the interruption and game. |
| C-3 | Spec 2 §14.1: sound is disabled by default. | Ambient sound. | Sound is **off by default** and is never persisted as on. Audio starts only after the user presses "Enable sound". |
| C-4 | Spec 2 §5.1: must not resemble a cheap horror-game interface. | Psychological horror. | Restrained treatment: no jump scares, no gore, no flashing above a safe rate, a labelled fiction layer, and an always-available skip. |
| C-5 | Spec 2 §5.5: avoid unnecessary particles. | Subtle particles. | A small fixed set of slow dust motes, hidden under reduced motion. |
| C-6 | Spec 2 §6.5: whole-phrase reveal, no letter-by-letter. | Cinematic text. | All text, including the narration, appears as whole lines. |
| C-7 | Spec 2 §3.3: evidence appears after the board settles. | Interruption about two seconds after the reveal. | Evidence appears at settle. The interruption starts 2000 ms after settle and only for eligible results (section 7). |
| C-8 | Native Ouija design lists `question` in the C.4 response. | Use the actual API. | The real response does not echo `question`. The frontend keeps the question client-side. |
| C-9 | Native Ouija design lists `target.resolution` as `RESOLVED` or `UNRESOLVED`. | Use the actual API. | The backend returns other labels (for example `NOT_IN_CURRENT_STATE`, `NOT_REQUESTED`). The frontend displays the returned label unchanged. |
| C-10 | Architecture: no speculative dependencies. | Component tests. | One dev dependency is added that D01 does not list: `jsdom` (MIT), the DOM environment for Vitest. See section 15. |

## 3. Frontend architecture

React, TypeScript, Vite, and Tailwind CSS, with native CSS for the board, planchette, glitch, and game. State is `useReducer`. There is no animation library, state library, or game engine.

```text
frontend/src/
  app/              InvestigationView (composition root) and entry
  types/            contract types (from the real backend response)
  services/         investigationClient (fetch, abort, error mapping)
  features/
    investigation/  validateResponse, deriveUiState
    experience/     experienceMachine (reducer), useExperience, sessionStore, settingsStore, clues
    audio/          AudioController (Web Audio synthesis), AudioProvider
    escape/         escapeEngine (pure, seeded), EscapeSequence, EscapeEnvironment, EvidenceClue
  components/
    layout/         TwoZoneLayout
    ouija/          OuijaScene, Planchette, InvestigationForm, InvestigationProgress, StatusStrip, HorrorTransition
    evidence/       EvidencePanel, EvidenceCard, InvestigationReport
    settings/       ExperienceSettings
  styles/           index.css (Tailwind theme and component CSS)
```

Presentation code never imports evidence or investigation domain logic. The only coupling to the backend is `types/contract.ts`, `validateResponse`, and `investigationClient`.

## 4. Experience state machine

Three backend-derived dimensions stay separate (Spec 2 §8.1): the frontend lifecycle, the retrieval status, and the classification. The experience machine adds the scene phase.

Phases: `IDLE`, `INVESTIGATING` (stage `INVOKING` then `RETRIEVING`), `REVEALING` (`settled` flag), `NARRATIVE_INTERRUPTION`, `ESCAPE_SEQUENCE`, `FINAL_REPORT`, `ERROR`, `CANCELLED`.

| From | Event | To | Guard |
|---|---|---|---|
| IDLE, ERROR, CANCELLED, FINAL_REPORT | SUBMIT | INVESTIGATING | No request in flight |
| INVESTIGATING | REQUEST_STARTED | INVESTIGATING (RETRIEVING) | Current token |
| INVESTIGATING | RESULT, valid, status not `FAILED` | REVEALING | Current token |
| INVESTIGATING | RESULT, valid, status `FAILED` | ERROR (`RETRIEVAL_FAILED`) | Current token |
| INVESTIGATING | RESULT, invalid | ERROR (`INVALID_RESPONSE`) | Current token |
| INVESTIGATING | REJECTED (`BackendError`) | ERROR (`REQUEST_REJECTED` or `BACKEND_INTERNAL`) | Current token |
| INVESTIGATING | NETWORK_FAILURE | ERROR (`NETWORK`) | Current token |
| INVESTIGATING | CANCEL | CANCELLED | |
| REVEALING (not settled) | REVEAL_SETTLED | REVEALING (settled), or FINAL_REPORT when not eligible | |
| REVEALING (settled) | INTERRUPT | NARRATIVE_INTERRUPTION | Eligible |
| REVEALING, NARRATIVE_INTERRUPTION | SKIP_CINEMATIC | FINAL_REPORT | |
| NARRATIVE_INTERRUPTION | INTERRUPTION_DONE | ESCAPE_SEQUENCE | |
| ESCAPE_SEQUENCE | CLUE_COLLECTED | ESCAPE_SEQUENCE | Evidence id exists in the result |
| ESCAPE_SEQUENCE | ESCAPE_COMPLETED, SKIP_ESCAPE | FINAL_REPORT | |

Every other (state, event) pair is ignored. A response whose token is not the current token is discarded. Cancelling aborts the request and the late response is discarded.

## 5. User journey

**Scene A — Setup.** The user types a registered repository ID, a repository-relative target path, an optional symbol and line range, and a question. The backend offers no repository-listing endpoint, so no list is invented. Client-side checks give early feedback only. The backend is authoritative, and its `field` errors are shown at the matching input.

**Scene B — Invocation.** The board and planchette respond to the lifecycle: wake on invocation, a fixed deterministic search pattern while retrieving, and a settle when the result arrives. The progress panel shows a real elapsed-time counter and states that the backend reports no percentage.

**Scene C — Initial revelation.** When a valid result arrives, the planchette settles and the complete phrase appears, with the classification and the original retrieval status. Evidence cards appear in the left zone in returned order with a staggered transition, and any card can be inspected.

**Scene D — Interruption.** See section 7.

**Scene E — Escape game.** See section 8.

**Scene F — Final report.** See section 9.

## 6. Visual direction

Cinematic psychological horror with an engineering-grade reading surface: charcoal and near-black, aged wood, bone and antique ivory text, antique gold detail, and a restrained dark-red accent that is used for borders and glows, and as text only in a lighter tint that meets contrast. Candlelight is a slow, low-amplitude gradient. Dust motes are few and slow. Display type uses a local serif stack. Technical text, hashes, paths, and code use a local monospace stack. No external fonts, images, or services are loaded.

Avoid: neon, jump scares, constant shake, strobing, and clutter over evidence.

## 7. Narrative interruption

**Eligibility.** The interruption runs only when all of these hold: the result is valid, the presentation state is `COMPLETED` or `PARTIAL`, at least one evidence item exists, and the "horror sequence" setting is on. It never runs for `FAILED`, an invalid response, a rejected request, a cancellation, or `INSUFFICIENT_EVIDENCE`.

**Timing.** The interruption starts 2000 ms after the board settles. It is a fixed beat sequence: a brief glitch (about 500 ms), the line "Wait... something is wrong.", a slow light flicker, the line "Something else is still in this repository.", then the escape game. Under reduced motion there is no glitch or flicker, and the lines are shown as static text with the same order.

**Honesty rules**

- A visible label states that the narrative layer is fiction and not a finding.
- The retrieval status, classification, and limitations strip stays visible above the scene. A partial result's limitation notice is never covered.
- The left zone stays visible.
- The text claims no error, no malicious actor, and no discovery.

## 8. Escape game

A turn-based grid game in a dark archive, played with the keyboard (arrows or WASD, space to wait), on-screen direction buttons, or touch. The layout is a seeded maze (11 by 9 tiles) generated from a hash of the `investigation_id`. The seed affects geometry only.

**Rules**

- The player starts at the entrance, carries a lantern (radius two), and must gather every fragment and then reach the exit door.
- Fragments are real evidence items: one per item in returned order, at most four. Collecting one shows only fields from that item: the commit subject or file path, the timestamp, the path and line range, and the short hash. **Author names are never shown in the game.**
- The exit is sealed until all fragments are collected.
- The presence is a fictional manifestation of forgotten technical history. It patrols, and it chases when the player is within six steps and not hidden. Hiding alcoves make the player unseen. The presence cannot enter them.
- Being caught returns the player to the entrance. Collected fragments are kept.
- **Completable by rule.** After two catches the presence moves at half speed. After four catches it goes dormant. The game cannot loop forever.
- A skip button is always available and goes straight to the final report.

**Accessibility.** The game is turn-based, so it has no timing pressure. A live region announces fragments, proximity (far, near, very near), catches, and the exit. All controls are buttons. Reduced motion removes tile transitions and flicker.

**Data rules.** The game reads the validated result and never writes to it. Collected evidence ids are recorded in the experience state for highlighting only.

## 9. Final report

The report is the Evidence & History zone in its expanded form. It is a technical artifact and is complete without any cinematic feature. It shows:

- The question, repository, and target as submitted and returned.
- The retrieval status and the classification, as two separate labelled values, plus the conclusion and the explanation exactly as returned.
- Limitations with their codes and scopes.
- Evidence grouped by relationship basis: relationships verified by Sean (`VERIFIED`) and inferred relationships (`INFERRED`), each with its own label. These labels describe the relationship of an item to the target. They are not the classification, and the report says so.
- Per item: source type, identifier, commit, file path and line range, timestamp, author as returned, title, excerpt, retrieval method, retrieval time, source verification, the `https` source link when present, and unavailable or verified-absent markers. A missing value shows "Not available". It is never filled in.
- A chronological view sorted by the returned timestamps, with a note that order is not causation.
- Source references as returned.

## 10. Audio

Sound is original synthesis with the Web Audio API. There are no audio files, no third-party assets, and no external service, so there is no license obligation.

- Off by default. The controller creates no `AudioContext` until the user presses "Enable sound" (a user gesture).
- Controls: enable, mute and unmute, and a volume slider. Volume and settings persist. The on state does not persist.
- A master gain with a compressor caps loudness. The default volume is low.
- Cues follow actual state. `FAILED`, invalid, cancelled, rejected, and `INSUFFICIENT_EVIDENCE` states never play a success cue.
- One ambient bed at a time, with mood transitions. One-shot cues are capped. All nodes are stopped and disconnected on completion, and `dispose()` closes the context.
- An audio failure never affects the investigation.

## 11. Accessibility and user control

- Skip the cinematic sequence, skip the escape game, mute, volume, reduced motion (follow the system, force reduced, or force full), and a switch for the whole horror sequence.
- `prefers-reduced-motion` is respected. Nothing flashes more than three times per second.
- All interactive elements are native controls with accessible names and a visible focus ring.
- Status changes are announced in live regions.
- Contrast for text pairs is checked by an automated test against the declared palette.
- Layout: two zones side by side at 1024 px and above, stacked below. No horizontal overflow at 390 px.
- The technical report remains reachable when every cinematic feature is off.

## 12. Backend integration

Endpoint: `POST /investigations` only, through a same-origin path (`/api`) that the Vite dev server proxies to the backend. The backend is not changed and has no CORS configuration.

- The request is exactly `repository_id`, `target {path, symbol?, line_start?, line_end?}`, and `question`. No other field is sent.
- A `200` body is validated before any use. A body that fails validation is an invalid response, shown as "The result could not be validated. No conclusion is shown."
- A non-200 body is a `BackendError` (`code`, `message`, `retryable`, `field?`, `candidates?`). It is shown as "request not accepted" with the backend message. `TARGET_AMBIGUOUS` offers its candidates as choices that fill the symbol field. The user then submits again.
- A network failure is shown as such and is never described as missing evidence.
- There is no frontend timeout. The backend bounds each operation (C-D3). The user can abandon the request.
- No fallback or sample evidence exists in the application.

## 13. Errors and partial evidence

| Situation | Shown |
|---|---|
| Retrieval status `FAILED` | Failure state with the backend error code. No reveal, no interruption, no success sound. Not described as absence of evidence. |
| Invalid response | "The result could not be validated. No conclusion is shown." |
| Rejected request (`BackendError`) | "Request not accepted" with the backend message. The form stays editable. |
| Network failure | A network message and a retry action. |
| Cancelled | Cancellation message. Never a conclusion and never "insufficient evidence". |
| `PARTIAL` retrieval or `PARTIAL_EVIDENCE` | Distinct "partial" label with limitations visible. The conclusion is shown only as returned. |
| `INSUFFICIENT_EVIDENCE` | Only the neutral phrase `INSUFFICIENT EVIDENCE` on the board, the explanation, and the classification. No interruption. |

## 14. Persistence

- **Settings** (`localStorage`): volume, motion preference, horror-sequence switch, and the last repository ID. Values are validated on load. Sound on is never stored.
- **Session result** (`sessionStorage`): the last validated result, request, and question, so a refresh restores the final report without a cinematic. The stored value is validated again on load, and a value that fails validation is discarded. The restored report states that it was restored from this browser session. A refresh during a request loses that request, and the application starts idle.

## 15. Dependencies

Runtime: `react`, `react-dom`. Development: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `@tailwindcss/vite`, `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `vitest`, `@playwright/test` (all approved in D01), and `jsdom` (not listed in D01). The reasons for `jsdom`: Vitest needs a DOM environment to test components, `jsdom` 29.1.1 supports the installed Node 24.13.0, it is MIT licensed, and it is free. Browser binaries are not downloaded. End-to-end tests use the Microsoft Edge installation that is already on the machine. A fresh advisory check on 2026-11-12 found no advisory for the exact set.

## 16. Security

React escapes all text, and no raw HTML is rendered. A `source_url` becomes a link only when it parses as `https`. Links use `rel="noopener noreferrer"`. Untrusted text is isolated for bidirectional rendering. The frontend holds no token and reads no environment secret. Stored values are parsed defensively.

## 17. Testing and acceptance

Automated, deterministic tests cover: form validation; real-contract fixtures generated from the backend; every status and classification combination; reducer transitions and stale tokens; the interruption timing (1999 ms and 2000 ms); skip behavior; escape-game solvability for every layout and fragment count; evidence preservation and no duplicate API calls across scenes; report accuracy against sentinel values; audio mute, volume, and lifecycle with a fake context; reduced motion; keyboard operation; contrast; and responsive layout and a complete journey against the real backend in a real browser.

Acceptance is the list in section 13 of the Phase 4 directive, evidenced by executed test results.

## 18. Deferred

Property-based tests, golden repository tests, and cross-repository portability testing remain Phase 4 verification work after this implementation. They are not duplicated here. Kiro client activation of the MCP server is unrelated to this frontend. Phase 5 (demo and presentation) is not started.
