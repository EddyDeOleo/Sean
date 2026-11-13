# Sean — Spec 4: Engineering Intelligence, Kiro Repository Advisor, and 3D Survival Horror

**Spec ID:** SEAN-SPEC-04
**Version:** 1.0
**Date:** 2026-11-12
**Status:** Owner-directed implementation specification. Authorized by the "Master Product and Autonomous Implementation Directive" and the owner's choices of 2026-11-12 (section 2). It extends Spec 2 and Spec 3. It does not edit Spec 1, Spec 2, or the architecture document. It is not itself an approved baseline document, and Phase 4 is not ACCEPTED.

## 1. Purpose and authority

Sean answers three questions: what happened in a repository, what Kiro capabilities would improve it, and how to adopt them. The Advisor is a core capability. The Ouija and the 3D game are a hidden, temporary interlude between "analysis finished" and "report shown". They never change the report.

Authority order when documents disagree: Spec 1, then Spec 2, then the architecture, then this spec, then Spec 3. Where this spec departs from Spec 2 or Spec 3, section 2 records the departure and the owner decision behind it. Nothing is changed silently.

## 2. Owner decisions and recorded departures

| ID | Decision (owner, 2026-11-12) | Effect |
|---|---|---|
| O-1 | Leave Spec 1 and Spec 2 text untouched. Record departures in a new spec. | This document. |
| O-2 | Backend changes allowed only as new, additive, read-only modules. No existing Phase 3 file changes. Local registered repositories only. No cloning. | Section 4. |
| O-3 | Gemini behind an environment variable. Deterministic path is the working version. | Section 8. |
| O-4 | Remove the 2D escape game. Replace it with the 3D game. | Section 10. |
| O-5 | Stage order: plan and specs; backend profile and Advisor; product UI, sidebar and report persistence; artifact preview and export; Ouija change; Three.js game; audio; independent reviews and screenshots. | Section 12. |
| O-6 | Three.js approved as a new dependency, subject to the install-time checks in section 11. | Section 11. |

Departures from approved text:

| ID | Source | Departure | Reason |
|---|---|---|---|
| X-1 | Spec 2 §4.1 (two primary zones) | The main application gets a collapsible sidebar. Evidence & History and the Ouija board remain the two content zones of the investigation view. The sidebar is navigation, not a third content zone. | Directive §4.3. |
| X-2 | Spec 2 (board lives in the right zone), Spec 3 §2 | During the Ouija and the 3D game, the scene is a full-viewport overlay. Navigation, form and report are hidden. | Directive §9.2 and §10.3. |
| X-3 | Spec 3 §8 (2D escape game) | Removed. Replaced by section 10. | O-4. |
| X-4 | Spec 2 (structured form) | One natural-language input replaces the long form. The structured fields remain available under "Advanced target". | Directive §4.2. |
| X-5 | Spec 3 §4 (state machine) | Analysis, Advisor, game and report state become independent reducers (section 9.2). | Directive §13.1. |
| X-6 | E-D13 (Gemini deferred, no private content to the Free Tier) | Gemini may be used for intent interpretation only, and only the user's typed sentence and registered repository IDs may be sent (section 8). | Directive §14 with E-D13 privacy rule preserved. |

Not departures: Phase 3 stays CLOSED. Classifications `DOCUMENTED`, `INFERRED`, `PARTIAL_EVIDENCE`, `INSUFFICIENT_EVIDENCE` keep their meaning. Story content never alters evidence.

## 3. Product hierarchy

Real repository analysis, then engineering intelligence, then the Advisor, then recommendations, then the premium UI, then the Ouija, then the 3D game, then the unified report. Sean opens as a professional product. The horror is not visible on startup or in ordinary navigation.

## 4. Backend architecture (additive)

### 4.1 Rule: no Phase 3 file changes

New code lives in new files only. The 71 protected files are re-hashed at the end of every stage. The Phase 3 backend suite (1061 tests) must still pass unchanged.

| New path | Purpose |
|---|---|
| `backend/app/modules/repository_profile/` | Read-only repository scan and observations. |
| `backend/app/modules/advisor/` | Kiro capability catalog, signal rules, recommendation contract, roadmap, artifact templates. |
| `backend/app/modules/intent/` | Deterministic request interpretation. Optional Gemini adapter. |
| `backend/app/api/advisor_routes.py` | Router for the new endpoints. |
| `backend/app/main_advisor.py` | New entry point. Builds the Phase 3 app with `create_app(registry)` and includes the new router. Start with `uvicorn app.main_advisor:app`. |

`backend/app/main.py` and `backend/app/api/app.py` are not edited. The old entry point keeps working.

### 4.2 Endpoints

| Method and path | Result |
|---|---|
| `GET /repositories` | Registered repository IDs with availability and an optional GitHub identity. No filesystem paths. |
| `POST /repositories/{id}/profile` | Repository profile, observations, and Advisor output. Read-only. |
| `POST /interpret` | A structured plan for a natural-language request (section 8). |
| `POST /artifacts/preview` | Implemented (stage 4). For selected recommendations: generated file content, target path, scope, conflict status, and a diff against the committed file when one exists. Writes nothing. |

Error bodies reuse the Phase 3 `BackendError` shape. Messages are fixed strings and never echo input or paths.

### 4.3 Read-only guarantee

The scanner uses only `run_git` (Phase 3 guarded runner) with `ls-tree`, `cat-file`, `log` and `rev-parse`. It reads the committed tree at `HEAD`, not the working tree. It never executes repository content, never opens files by working-tree path, and never follows symlinks. File content is read only for a fixed allowlist of manifests (size-capped) and parsed with `json` and `tomllib`. Commit subjects and file contents are counted and matched against fixed expressions. They are never interpreted as instructions.

Limits (new, in the new modules, not in `limits.py`): tree entries 20 000, manifest bytes 64 KiB, commits scanned 500, paths per commit 200. Reaching a limit sets `truncated` and lowers confidence.

## 5. Repository profile

A profile is a list of typed **observations** plus derived summaries. An observation has an `observation_id`, a `kind`, an optional `path`, a `value`, a `classification` (`DOCUMENTED` for a directly observed fact, `INFERRED` for a pattern), a `source` (`GIT_TREE`, `GIT_BLOB`, `GIT_LOG`) and the `head` commit it was read at.

Observed signal groups: languages by extension; manifests and declared dependencies; frameworks (only those named in a manifest); test files and directories; CI configuration; documentation and contribution files; lint, format and editor configuration; existing Kiro configuration (steering, specs, hooks, agents, skills, `mcp.json`, `.kiroignore`, `AGENTS.md`); tracked sensitive-looking paths (path names only, never content); integration hints (HTTP or cloud client dependencies, OpenAPI files, compose files); commit-subject patterns (fix, feature, revert counts, conventional-commit share); files that recur in fix commits; distinct author count (a number, no names); shallow-clone flag.

The profile states what was not accessible: no pull requests, issues or CI results are read in this scope. The report lists those as limitations and never implies they were analyzed.

## 6. Kiro Repository Advisor

### 6.1 Capability catalog

The catalog is data in `advisor/catalog.py`, verified against kiro.dev documentation on 2026-11-12.

| Capability | Project path | Portable in repo | Notes |
|---|---|---|---|
| Steering | `.kiro/steering/*.md` | Yes | Front matter `inclusion`: `always`, `fileMatch` (+ `fileMatchPattern`), `manual`, `auto` (+ `name`, `description`). `AGENTS.md` is also read. |
| Specs | `.kiro/specs/<name>/requirements.md`, `design.md`, `tasks.md` | Yes | |
| Bugfix specs | `.kiro/specs/<name>/bugfix.md`, `design.md`, `tasks.md` | Yes | `bugfix.md` has current, expected and unchanged behavior. |
| Hooks | `.kiro/hooks/*.json` | Yes | `{"version":"v1","hooks":[{name, trigger, matcher?, action:{type:"command"\|"agent", ...}}]}`. |
| MCP | `.kiro/settings/mcp.json` | Yes, without credentials | Needs a real server. Sean never invents endpoints. |
| Custom agents | `.kiro/agents/<name>.md` or `.json` | Yes | Loaded only if the workspace is trusted. |
| Skills | `.kiro/skills/<name>/SKILL.md` | Yes | `name` must equal the folder name. |
| Sub-agents | Custom agents with `subagent` tool | Yes (agent files) | |
| Kiroignore | `.kiroignore` | Yes | Limits agent context. It is not a security boundary. |
| Permissions | User-level `permissions.yaml` | **No** | Never a repository file. Sean shows instructions only. |
| Powers | `~/.kiro/powers/` | **No** | User-level. |
| ACP, checkpoints and rewind, compaction, chat/IDE/CLI | None | **No** | Runtime or client capabilities. |

Every entry carries `scope` (`REPOSITORY`, `USER`, `RUNTIME`), `supported_surfaces` and a `docs_url`. A capability with scope other than `REPOSITORY` can never produce a repository artifact.

### 6.2 Recommendation contract

Each recommendation has: `capability`, `title`, `summary`, `repository_signal`, `evidence_references` (observation IDs), `evidence_classification`, `reasoning`, `expected_benefit`, `priority` (`P1`..`P3`), `recommendation_status` (`ADOPT_NOW`, `CONSIDER`, `NOT_RECOMMENDED`, `INSUFFICIENT_EVIDENCE`), `implementation_effort` (`LOW`, `MEDIUM`, `HIGH`), `prerequisites`, `risks`, `adoption_scope`, `configuration_strategy`, `verification_method`, `confidence` (`HIGH`, `MEDIUM`, `LOW`), `limitations`.

Validation rules, enforced by Pydantic and by tests:

1. `ADOPT_NOW` and `CONSIDER` need at least one evidence reference. Each reference must exist in the profile.
2. `evidence_classification` is the weakest classification among the referenced observations. It is `PARTIAL_EVIDENCE` whenever the scan was incomplete (tree truncated, shallow clone, a manifest not read, paths skipped, history unreadable, or observations dropped), and `INSUFFICIENT_EVIDENCE` for an insufficient-evidence recommendation. A negative finding ("no hook tooling") from an incomplete scan is never `DOCUMENTED`.
3. `NOT_RECOMMENDED` and `INSUFFICIENT_EVIDENCE` explain why. They may cite no evidence when the reason is absence of a signal.
4. A capability whose scope is not `REPOSITORY` cannot have `configuration_strategy` of `GENERATE_FILE`.
5. Confidence is categorical, never a number. `HIGH`: every required signal is `DOCUMENTED` and the scan was complete. `MEDIUM`: at least one required signal is `INFERRED`, or a history-based signal covers only the latest 500 commits. `LOW`: the scan was incomplete, fewer than 10 commits were readable for a history-based rule, or the recommendation is `INSUFFICIENT_EVIDENCE`.
6. The output never contains a capability recommended without a matching rule that fired.

### 6.3 Rules (initial)

Each rule is a pure function of the profile. Thresholds are named constants with tests.

| Capability | `ADOPT_NOW` when | `CONSIDER` when | `NOT_RECOMMENDED` when |
|---|---|---|---|
| Steering | No steering and no `AGENTS.md`, and conventions exist (lint/format config, contribution guide) in 2 or more distinct forms | One convention source only | Steering already present (no gap can be shown) |
| Specs | No specs, and 40 or more source files in 3 or more top-level areas | Fewer source files or areas | Specs already present |
| Bugfix specs | 10 or more fix commits, at least 25% of commits, and at least one file recurring in 3 or more fix commits | 3 or more fix commits | Sufficient history and almost no fix commits |
| Hooks | Never automatic | Tests or lint tooling exist and no hooks | No verification tooling to automate, or hooks present |
| MCP | Never automatic | Integration hints exist and no `mcp.json` | No integration hints (adds complexity) |
| Custom agents | Never automatic | 2 or more distinct source areas, each with at least 10% of source files | Single area |
| Skills | Never automatic | A `scripts/` or runbook/how-to documentation set of 3 or more | No repeatable procedures observed |
| Sub-agents | Never automatic | 2 or more independent areas and tests exist | Single area or no tests |
| Kiroignore | Sensitive-looking paths tracked, or `.env*` present, and no `.kiroignore` | Large generated or dependency directories tracked and no `.kiroignore` | `.kiroignore` already present |
| Permissions | Never automatic | Sensitive paths exist (USER scope, instructions only) | No sensitive paths |
| Powers, ACP, checkpoints, compaction, chat/IDE/CLI | Never | Never | `INSUFFICIENT_EVIDENCE`: depends on the user's tools and client, not on repository content |

Too-small or truncated scans produce `INSUFFICIENT_EVIDENCE` rather than a weak recommendation. Tests run the Advisor on repositories with different shapes and assert that the output differs accordingly.

### 6.4 Roadmap

`IMMEDIATE` (`ADOPT_NOW`, by priority), `NEAR_TERM` (`CONSIDER` with prerequisites met), `LONGER_TERM` (`CONSIDER` with unmet prerequisites), `NOT_RECOMMENDED` (with reasons). Order within a band: evidence strength, then effort, then dependency order.

## 7. Artifact lifecycle

Sean never writes to a repository. Backend repositories are read-only (security rule). Lifecycle states, each recorded separately:

`RECOMMENDED` → `ARTIFACT_GENERATED` (preview exists) → `ARTIFACT_EXPORTED` (user downloaded or copied it in the browser) → `APPLIED_DETECTED` (a later profile finds the file at `HEAD`) → `VERIFIED` (the committed file is byte-identical to the generated file and passes the format validator).

Only the states the system can observe are shown. "Applied" is never claimed from an export. A file that is uncommitted is not seen, and the UI says that Sean reads committed history.

Generation rules: templates are filled from profile observations (real paths, real commands detected in manifests). If the target path already exists at `HEAD`, the status is `CONFLICT`, the preview shows a diff, and the default action is a new file name. No secrets, no invented endpoints or credentials. MCP configs are not generated unless the user supplies a server definition. Permissions produce on-screen instructions only. Each artifact is validated for its format (JSON parses, front matter keys are valid, skill `name` equals its folder).

## 8. Intent interpretation and Gemini

`POST /interpret` takes the sentence and returns `{mode, repository_id, target?, question, unresolved?}`.

Deterministic parser: split the repository reference from the request at the first separator (an em dash, hyphen with spaces, or colon). A reference is a registered ID, or a GitHub URL that matches the optional GitHub identity of a registered repository. A URL that matches nothing returns a clear message: Sean analyzes registered local repositories and does not clone. A path in the sentence is accepted only if it exists in the committed tree. Modes: `INVESTIGATE` (target resolved), `ADVISE` (workflow or Kiro intent, or no target), `NEEDS_TARGET` (candidate paths offered by file-name match, never invented).

Gemini (optional): model `gemini-3.6-flash` (approved AI-4), key in `SEAN_GEMINI_API_KEY` read by the backend only and never sent to the browser. Only the user's own sentence may be sent (no repository IDs, no file content, no commit text, no evidence, no paths). Text typed by the user may be retained by the provider on the Free Tier, and the UI says so whenever the interpreter that answered was `gemini`. Output is parsed against a strict schema and then re-validated by the deterministic resolver. A path, repository or symbol that fails resolution is discarded. Without a key, or on any provider failure, the deterministic parser answers and the response says `interpreter: "deterministic"`. A mock is never reported as Gemini. Each live call needs the owner's explicit go-ahead; until then the adapter is covered by tests with an injected fake transport only.

No Gemini request is made for explanations, findings or recommendations. Those stay deterministic, because they are built from repository content that must not reach the Free Tier.

## 9. Frontend

### 9.1 Application shell
Premium, restrained, charcoal base. Collapsible sidebar: New Investigation, Recent Investigations, Saved Reports, Repositories, Settings. Hidden during the Ouija and the game. One input for the request, one primary action, the selected repository shown as context. Settings page: master, ambient and effects volume, horror intensity, jumpscare enable, reduced motion, skip gameplay, graphics quality. Stored locally; "sound on" is not persisted.

### 9.2 Independent state
Four reducers with separate ownership: `analysis` (interpret, investigate, profile, advisor requests), `report` (the immutable snapshot assembled from them), `experience` (Ouija and game phases), and `settings`. A game failure cannot change `report`. A failed Advisor does not discard a successful investigation. A report snapshot is saved to IndexedDB before the Ouija starts.

### 9.3 Persistence
IndexedDB, one object store of report snapshots keyed by ID, with a schema version. A snapshot is labelled `SAVED SNAPSHOT` and carries its capture time. Loading re-validates every part and discards a snapshot that fails validation. No backend database.

### 9.4 Unified report
Sections: repository overview, engineering history, technical findings, Kiro Repository Advisor, implementation roadmap, evidence and transparency. Facts, documented statements, inferences, recommendations, generated artifacts, user actions and verified results are visibly different. The story never edits it.

## 10. Ouija and 3D game

The Ouija appears only after the report snapshot is saved and only for a successful analysis. Failed, invalid, rejected or cancelled analysis never triggers it. Sequence: fade, board, autonomous planchette, settle, 2000 ms, "Wait... something is wrong.", interruption, game. Fictional lines are labelled fiction and never mixed into the report. Reduced motion produces static text. Skip is always available.

The game is first person and fills the viewport (Fullscreen API where permitted, otherwise a fixed full-viewport layer). Engine: plain Three.js with an own fixed-step loop. Game rules are pure TypeScript modules with no Three.js import, so they are unit-testable: level map and collision, objectives, flashlight and noise, monster state machine, capture and recovery. Three.js only renders state. Assets are procedural (geometry and canvas textures), so there are no third-party art assets to license.

Monster states: `DORMANT`, `INVESTIGATING`, `SEARCHING`, `PURSUING`, `ATTACKING`, `RECOVERING`. Transitions depend on line-of-sight, noise and distance, with a tested transition table. The monster is fictional and never named after or attributed to a developer.

Evidence-inspired content uses only real report data: archive records for verified commits, a distinct treatment for documented and inferred items. When evidence is insufficient the room uses atmosphere only and states no history.

Outcomes `ESCAPED`, `CAUGHT`, `SKIPPED`, `QUIT` all lead to the report. Retry is offered after capture. Leaving the game disposes the renderer, geometry, textures, listeners, the animation loop, pointer lock and the audio graph. There is no WebGL fallback game: if WebGL is unavailable the user is told and the report opens directly.

The 2D game is removed in the stage that adds the 3D game, so the application keeps working until the replacement exists.

## 11. Dependencies

Backend: none planned. (`httpx2` is already pinned for the optional Gemini transport; this is reassessed at that stage.) Frontend: `three` (MIT) and `@types/three`. Install-time checks: exact version, license, Windows support, npm advisories, `npm audit`, bundle size, and a documented reason. If any check fails the dependency is not added and the owner is told. A decision record is added at `docs/development/d04-phase-4-dependency-decision-record.md` when the dependency is installed.

## 12. Staging and acceptance

Each stage ends with: tests executed and observed, the Phase 3 hash check, the backend suite when backend code changed, a security note, and a status line in `phase-status.md`. A stage does not start while the previous stage has unresolved failures.

| Stage | Content | Exit evidence |
|---|---|---|
| 1 | Plan and specs (this document, Native Spec) | Documents written, conflicts recorded. |
| 2 | Profile, Advisor, interpret, preview-contract skeleton, tests | New backend tests pass, 1061 old tests pass, 71 hashes match. |
| 3 | Shell, sidebar, natural-language input, settings, unified report, IndexedDB | Vitest and Playwright pass, screenshots inspected. |
| 4 | Artifact preview, diff, export, lifecycle | Format validators pass, no overwrite, no secrets. |
| 5 | Ouija change and flow integration | Appears only after success, skip works. |
| 6 | Three.js game, 2D game removal | Pure-logic tests, WebGL render in Edge, cleanup test. |
| 7 | Audio | Controller tests, fake-context lifecycle, manifest. |
| 8 | Independent reviews and screenshots | Reviewer reports, fixes, screenshots of the listed views. |

Acceptance and the completion report follow directive §20 and §21. Phase 4 is submitted for owner review and is not marked ACCEPTED.

## 13. Security

Repository content is untrusted data. No repository script, hook or command is executed. Paths are validated and contained. The `.env` file is never read by agents (the permission rule already denies it). Provider keys stay server-side. Generated artifacts carry no secrets and do not widen agent permissions. The new endpoints are read-only and bounded. A security-auditor review covers the new modules and the frontend in stage 8, with earlier checks per stage.

Controls added after the stage 2 review (all in new files):
- A local-only guard (`app/api/local_guard.py`, included by `app.main_advisor`): the Host must be `127.0.0.1`, `localhost` or `[::1]`, and a request that carries an Origin must come from a localhost origin. This stops a web page in the browser from calling the API and defeats DNS rebinding. It also covers the Phase 3 route when served through `app.main_advisor`.
- At most 4 profile or interpret requests run at once. More get `429 BUSY`. Profiles are cached per repository and HEAD, so repeated requests do not start new Git processes.
- Absence is never reported as proof. A scan with a limit hit, an unreadable history, or a skipped manifest yields `PARTIAL_EVIDENCE` and `LOW` confidence for every recommendation.
- Repository-controlled strings that are echoed (paths, area names) are bounded, and the Gemini adapter refuses redirects so the key header cannot be forwarded.

Resolved by owner authorization (2026-11-13, "solve all the M's"): the Phase 3 Git runner `app/core/git_runner.py` was amended in two places. `GIT_NO_LAZY_FETCH=1` is added to the controlled environment, and `-c protocol.allow=never` is added to the guard options. Reproduction before the fix: in a partial clone whose `.git/config` names an upload-pack command, `git cat-file` ran that command. After the fix it fails with a Git error, and the scanner reports `MANIFEST_NOT_READ` instead. Either protection alone blocks it (mutation-checked), and removing both makes the tests fail. This is the only Phase 3 file changed in Phase 4. The full backend suite passes (1254 tests).

Consent for the AI interpreter (review M1): `POST /interpret` accepts `allow_ai`, a strict boolean that defaults to false. The sentence is sent to the provider only when it is true. `GET /capabilities` tells the interface whether an AI interpreter exists, and never returns a key. The interface shows an unchecked "Let Gemini help read this request" box only when one exists, explains what is sent and that the free tier may keep it, and clears the box after each request. The provider exchange has a total deadline of 15 seconds in addition to the per-operation timeout.

## 14. Implementation notes for stages 4 to 8 (recorded departures and facts)
These record how stages 4 to 8 were implemented, including where the implementation differs from the text above.
- **Variable time step (departure from section 10).** The game loop uses `requestAnimationFrame` with a time step clamped to 0.1 s, not a fixed step. The rules are deterministic for a given sequence of steps (tested), but results differ between frame rates. A fixed step was not needed for the level size and is not implemented.
- **Save wait (departure from sections 9.2 and 10).** The interlude starts after the snapshot save finishes or fails, or after 3 s, whichever comes first. If the save has failed, the report says so ("Not saved"). The interlude never starts for a snapshot the user has already left.
- **Game text.** Clue text comes only from the report's findings, with the classification the report gave it. When the evidence is insufficient the clues are atmosphere items that say "not evidence". The pause menu, the caught screen and the first screen all offer a way to the report. A game that cannot start (no WebGL, touch-only device, lost graphics context) opens the report and shows a note on it.
- **Threat.** It wakes 8 s after the first clue, not at once. It hears sprinting from 7 tiles and walking from 3.2 tiles, sees within a view cone (shorter when the flashlight is off), pursues slower than the player sprints, loses the trail after 5 s without sight, then recovers and searches. Intensity (low, normal, high) scales its speed and sight.
- **Keyboard turning** is 3.6 rad/s. Mouse look uses pointer lock when granted.
- **Artifacts.** Names and paths copied from a repository into generated files must be plain identifiers (letters, digits and `. _ / @ + -`), so repository text cannot become instructions in an always-included steering file. Text that looks like a secret is never sent to the browser, whether it is generated or already committed.
- **Sound.** Procedural Web Audio, no assets (`docs/development/audio-asset-manifest.md`). Off until the user turns it on in this page. Ambient, effects and master levels persist.
- **Known limits.** A repository with more than 20 000 tracked paths may be reported as having a file "absent" or "NEW" when it exists beyond that limit. The scene is hand-authored and small (one archive level). Browser coverage is Microsoft Edge only. The audio output was verified through the Web Audio graph and fake contexts and a clean browser run; whether it sounds good was not judged. Gemini was not reached (HTTP 503 from the provider at the last attempt); the deterministic reader is the tested path.
## 15. Deferred and known limits

Pull requests, issues and CI results are not analyzed in this scope. Only locally registered repositories are supported; there is no cloning. Gemini is not exercised against the live service until the owner authorizes a call. Browser coverage is Microsoft Edge only. Gameplay feel and horror quality are subjective and are judged through screenshots, a recording, and the owner's play.
