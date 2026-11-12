/**
 * The composition root (Spec 3 section 3).
 *
 * It wires the experience hook, the settings, the audio, and the two zones together and chooses which scene the right zone
 * shows. It holds no investigation logic: the reducer owns the phase, the validator owns the result, and each scene reads.
 *
 * The right zone shows, by phase:
 *   IDLE / ERROR / CANCELLED   the form (with the error or cancellation notice) above the resting board
 *   INVESTIGATING              the board searching, and the progress panel with a way to stop waiting
 *   REVEALING                  the board and the revealed phrase, with a skip control
 *   NARRATIVE_INTERRUPTION     the interruption scene below the status strip
 *   ESCAPE_SEQUENCE            the escape game below the status strip
 *   FINAL_REPORT               the board at rest on the result, and the form for a new question
 *
 * The left zone is always present. It shows the report whenever the board has settled on a result.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AudioProvider, moodFor, useAudio } from "../features/audio/AudioProvider";
import { TwoZoneLayout } from "../components/layout/TwoZoneLayout";
import { EvidencePanel } from "../components/evidence/EvidencePanel";
import { ErrorPanel } from "../components/ouija/ErrorPanel";
import { HorrorTransition } from "../components/ouija/HorrorTransition";
import { InvestigationForm } from "../components/ouija/InvestigationForm";
import { InvestigationProgress } from "../components/ouija/InvestigationProgress";
import { OuijaScene } from "../components/ouija/OuijaScene";
import { ExperienceSettings } from "../components/settings/ExperienceSettings";
import { useExperience } from "../features/experience/useExperience";
import { loadSettings, resolveReducedMotion, saveSettings, type MotionPreference, type Settings } from "../features/experience/settingsStore";
import { valuesFromRequest } from "../features/investigation/formModel";
import { EscapeSequence } from "../features/escape/EscapeSequence";
import type { SubmitFn } from "../services/investigationClient";
import type { ContextFactory } from "../features/audio/AudioController";

export interface InvestigationViewProps {
  /** Test seams. Production uses the defaults. */
  submit?: SubmitFn;
  audioFactory?: ContextFactory;
  restoreSession?: boolean;
  persistSession?: boolean;
  /** Overrides the system reduced-motion query. */
  systemPrefersReducedMotion?: boolean;
}

function useSystemReducedMotion(override?: boolean): boolean {
  const [matches, setMatches] = useState(() => (override !== undefined ? override : typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false));
  useEffect(() => {
    if (override !== undefined) {
      setMatches(override);
      return;
    }
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent): void => setMatches(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, [override]);
  return matches;
}

export function InvestigationView(props: InvestigationViewProps) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const persist = useCallback((patch: Partial<Settings>): void => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return (
    <AudioProvider
      factory={props.audioFactory}
      initialVolume={settings.volume}
      initialMuted={settings.muted}
      onChange={({ volume, muted }) => {
        const current = settingsRef.current;
        if (current.volume !== volume || current.muted !== muted) persist({ volume, muted });
      }}
    >
      <Experience {...props} settings={settings} persist={persist} />
    </AudioProvider>
  );
}

function Experience({ settings, persist, submit, restoreSession, persistSession, systemPrefersReducedMotion }: InvestigationViewProps & { settings: Settings; persist(patch: Partial<Settings>): void }) {
  const systemReduced = useSystemReducedMotion(systemPrefersReducedMotion);
  const reduced = resolveReducedMotion(settings.motion, systemReduced);
  const experience = useExperience({ submit, reducedMotion: reduced, horror: settings.horror, restoreSession, persistSession });
  const { state } = experience;
  const audio = useAudio();

  // The motion preference reaches the stylesheet through one attribute on the root element.
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", settings.motion);
    return () => document.documentElement.removeAttribute("data-motion");
  }, [settings.motion]);

  // Sound follows the state. The audio controller ignores all of this until the user has enabled sound.
  const mood = moodFor(state);
  const { setMood } = audio;
  useEffect(() => {
    setMood(mood);
  }, [mood, setMood]);

  const lastPhase = useRef(state.phase);
  useEffect(() => {
    if (lastPhase.current === state.phase) return;
    lastPhase.current = state.phase;
    if (state.phase === "INVESTIGATING") audio.cue("wake", state);
    if (state.phase === "REVEALING") audio.cue("reveal", state);
    if (state.phase === "FINAL_REPORT" && !state.restored) audio.cue("report", state);
    // audio is intentionally not a dependency: its identity changes with every snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  const settledCue = useRef(false);
  useEffect(() => {
    if (state.phase === "REVEALING" && state.settled && !settledCue.current) {
      settledCue.current = true;
      audio.cue("settle", state);
      audio.cue("evidence", state);
    }
    if (state.phase === "INVESTIGATING") settledCue.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.settled]);

  // The form is refilled from the request that produced the shown state, so a restored or failed request can be edited.
  const initialValues = useMemo(() => (state.request ? valuesFromRequest(state.request) : { repositoryId: settings.lastRepositoryId }), [state.request, settings.lastRepositoryId]);

  const busy = state.phase === "INVESTIGATING";
  const result = state.result;
  const revealed = result !== null && (state.phase !== "REVEALING" || state.settled) && state.phase !== "ERROR" && state.phase !== "CANCELLED";

  const onSubmit = useCallback(
    (request: Parameters<typeof experience.submit>[0]): void => {
      persist({ lastRepositoryId: request.repository_id });
      experience.submit(request);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [experience.submit, persist],
  );

  const backendField =
    state.error && state.error.kind === "REQUEST_REJECTED" && state.error.backend.field
      ? { field: state.error.backend.field, message: state.error.backend.message }
      : null;
  const candidates = state.error && state.error.kind === "REQUEST_REJECTED" ? state.error.backend.candidates : [];

  const emptyReason = state.phase === "ERROR" ? "error" : state.phase === "CANCELLED" ? "cancelled" : state.phase === "INVESTIGATING" ? "investigating" : "none";

  const inScene = state.phase === "NARRATIVE_INTERRUPTION" || state.phase === "ESCAPE_SEQUENCE";
  const canShowForm = !inScene && state.phase !== "REVEALING";

  const board = (
    <section className="zone zone-board" aria-label="Ouija board" data-zone="board" data-phase={state.phase}>
      <h2 className="zone-heading">Ouija</h2>

      <OuijaScene state={state} onSettled={() => undefined}>
        {state.phase === "REVEALING" ? (
          <div className="button-row" style={{ marginTop: "0.6rem" }}>
            <button type="button" className="btn btn-quiet btn-small" onClick={experience.skipCinematic} data-testid="skip-cinematic">
              Skip to the report
            </button>
          </div>
        ) : null}

        {state.phase === "NARRATIVE_INTERRUPTION" ? (
          <HorrorTransition
            reducedMotion={reduced}
            onDone={experience.finishInterruption}
            onSkip={experience.skipCinematic}
            onCue={(cue) => audio.cue(cue, state)}
          />
        ) : null}

        {state.phase === "ESCAPE_SEQUENCE" && result ? (
          <EscapeSequence
            key={result.investigation_id}
            result={result}
            collected={state.collected}
            onClue={experience.collectClue}
            onEscaped={experience.completeEscape}
            onSkip={experience.skipEscape}
            onCue={(cue) => audio.cue(cue, state)}
          />
        ) : null}
      </OuijaScene>

      {busy ? <InvestigationProgress stage={state.stage} onCancel={experience.cancel} /> : null}

      {state.phase === "ERROR" && state.error ? <ErrorPanel error={state.error} onRetry={experience.reset} /> : null}
      {state.phase === "CANCELLED" ? (
        <section className="notice" role="status" aria-label="Investigation cancelled" data-testid="cancelled">
          <h3>Investigation cancelled</h3>
          <p style={{ margin: "0.2rem 0" }}>You stopped waiting. No conclusion was reached, and this says nothing about whether evidence exists.</p>
        </section>
      ) : null}

      {canShowForm ? (
        <div style={{ marginTop: "0.8rem" }}>
          <InvestigationForm onSubmit={onSubmit} busy={busy} initial={initialValues} backendField={backendField} candidates={candidates} />
        </div>
      ) : null}



      <div style={{ marginTop: "1rem" }}>
        <ExperienceSettings
          motion={settings.motion}
          onMotion={(motion: MotionPreference) => persist({ motion })}
          horror={settings.horror}
          onHorror={(horror) => persist({ horror })}
          reducedEffective={reduced}
        />
      </div>
    </section>
  );

  return (
    <div className="app" data-phase={state.phase}>
      <header className="app-header">
        <div>
          <h1 className="app-title">Sean</h1>
          <p className="app-tagline">Summon the reasoning behind the code.</p>
        </div>
        <p className="muted" style={{ margin: 0, maxWidth: "36rem", fontSize: "0.9rem" }}>
          Sean reconstructs a repository's history from verifiable evidence. A commit proves that a change occurred, not why.
        </p>
      </header>

      <div className="visually-hidden" role="status" aria-live="polite" data-testid="phase-announcer">
        {phaseAnnouncement(state.phase, state.error?.kind ?? null)}
      </div>

      <TwoZoneLayout
        evidence={
          <EvidencePanel
            result={revealed ? result : null}
            question={state.question}
            revealed={revealed}
            restored={state.restored}
            collected={state.collected}
            emptyReason={emptyReason}
          />
        }
        board={board}
      />
    </div>
  );
}

function phaseAnnouncement(phase: string, errorKind: string | null): string {
  switch (phase) {
    case "INVESTIGATING":
      return "Investigation started. Waiting for the backend.";
    case "REVEALING":
      return "The result has arrived.";
    case "NARRATIVE_INTERRUPTION":
      return "A fictional interruption has begun. You can skip it.";
    case "ESCAPE_SEQUENCE":
      return "A fictional escape game has begun. You can skip it.";
    case "FINAL_REPORT":
      return "The final report is ready.";
    case "CANCELLED":
      return "Investigation cancelled.";
    case "ERROR":
      return errorKind === "NETWORK" ? "The backend could not be reached." : "The request did not produce a valid result.";
    default:
      return "";
  }
}
