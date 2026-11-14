/**
 * The application shell (Spec 4 sections 9.1 to 9.3).
 *
 * It owns navigation, the settings, the repository list and the saved-report store, and it composes the analysis hook with the
 * screens. It holds no investigation logic: the analysis machine owns the requests, the validators own the data, and the
 * report components only display a snapshot.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnalysisNotice } from "../components/request/AnalysisNotice";
import { AnalysisProgress } from "../components/request/AnalysisProgress";
import { RequestScreen } from "../components/request/RequestScreen";
import { ReportView } from "../components/report/ReportView";
import { SavedReportsView, SettingsView } from "../components/shell/ListViews";
import { RepositoriesView, type RepositoryActions, type RepositoryField, type RepositoryResult } from "../components/shell/RepositoriesView";
import { Sidebar, type View } from "../components/shell/Sidebar";
import { useAnalysis, type AnalysisDependencies } from "../features/analysis/useAnalysis";
import { loadSettings, resolveReducedMotion, saveSettings, type MotionPreference, type Settings } from "../features/experience/settingsStore";
import type { SnapshotSummary } from "../features/report/reportSnapshot";
import { ReportStore, createIndexedDbStorage, type SnapshotStorage } from "../features/report/reportStore";
import { browserExporter, type ArtifactContextValue, type Exporter } from "../components/report/ArtifactPanel";
import { InterludeOverlay } from "../components/interlude/InterludeOverlay";
import { isActive, isGamePhase } from "../features/interlude/interludeMachine";
import type { RenderGame } from "../features/interlude/gameApi";
import { useInterlude } from "../features/interlude/useInterlude";
import { useAudio } from "../features/audio/useAudio";
import type { ContextFactory } from "../features/audio/AudioController";
import { PresenceSounds, cueForPhase, moodForPhase, planForGameEvent, planForOuijaStep, type CuePlan } from "../features/audio/director";
import type { GameEvent, ThreatInfo } from "../features/game/world";
import { isInterludeEligible, type ArtifactRecord } from "../features/report/reportSnapshot";
import {
  createRepository as defaultCreateRepository, deleteRepository as defaultDeleteRepository, getCapabilities as defaultGetCapabilities,
  listRepositories as defaultListRepositories, previewArtifacts as defaultPreviewArtifacts, updateRepository as defaultUpdateRepository,
  type CallOutcome, type CapabilitiesFn, type CreateRepositoryFn, type DeleteRepositoryFn, type ListRepositoriesFn, type PreviewFn, type UpdateRepositoryFn,
} from "../services/advisorClient";
import type { RepositoryListItem } from "../types/advisor";
import type { InvestigationRequest } from "../types/contract";

export interface AppProps {
  /** Test seams. Production uses the defaults. */
  analysisDeps?: Partial<AnalysisDependencies>;
  listRepositories?: ListRepositoriesFn;
  createRepository?: CreateRepositoryFn;
  updateRepository?: UpdateRepositoryFn;
  deleteRepository?: DeleteRepositoryFn;
  getCapabilities?: CapabilitiesFn;
  previewArtifacts?: PreviewFn;
  exporter?: Exporter;
  /** The game to run after the interruption. Without one, the interlude ends after the Ouija. */
  renderGame?: RenderGame;
  storage?: SnapshotStorage;
  /** Test seam: the Web Audio context factory. */
  audioFactory?: ContextFactory;
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

export function App(props: AppProps) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const persist = useCallback((patch: Partial<Settings>): void => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  const systemReduced = useSystemReducedMotion(props.systemPrefersReducedMotion);
  const reduced = resolveReducedMotion(settings.motion, systemReduced);
  useEffect(() => {
    document.documentElement.setAttribute("data-motion", settings.motion);
    return () => document.documentElement.removeAttribute("data-motion");
  }, [settings.motion]);

  const store = useMemo(() => new ReportStore(props.storage ?? createIndexedDbStorage()), [props.storage]);
  const [saved, setSaved] = useState<SnapshotSummary[] | null>(null);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [openNote, setOpenNote] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [gameNote, setGameNote] = useState<string | null>(null);
  const refreshSaved = useCallback(async (): Promise<void> => {
    const listed = await store.list();
    if (listed.ok) {
      setSaved(listed.items);
      setStorageUnavailable(false);
    } else {
      setSaved([]);
      setStorageUnavailable(true);
    }
  }, [store]);
  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const [repositories, setRepositories] = useState<RepositoryListItem[] | null>(null);
  const [repositoriesProblem, setRepositoriesProblem] = useState<string | null>(null);
  const listRepositories = props.listRepositories ?? defaultListRepositories;
  useEffect(() => {
    const controller = new AbortController();
    void listRepositories({ signal: controller.signal }).then((outcome) => {
      if (outcome.kind === "ok") setRepositories(outcome.value);
      else if (outcome.kind === "aborted") return;
      else {
        setRepositories([]);
        setRepositoriesProblem(outcome.kind === "network" ? "The backend could not be reached, so the repository list is unavailable." : "The repository list could not be loaded.");
      }
    });
    return () => controller.abort();
  }, [listRepositories]);

  const createRepositoryFn = props.createRepository ?? defaultCreateRepository;
  const updateRepositoryFn = props.updateRepository ?? defaultUpdateRepository;
  const deleteRepositoryFn = props.deleteRepository ?? defaultDeleteRepository;
  /** Reload the list after a change, so the page, the request screen and the selection all see the same registry. */
  const refreshRepositories = useCallback(async (): Promise<void> => {
    const outcome = await listRepositories();
    if (outcome.kind === "ok") {
      setRepositories(outcome.value);
      setRepositoriesProblem(null);
    }
  }, [listRepositories]);
  const repositoryActions: RepositoryActions = useMemo(() => {
    const finish = async <T,>(outcome: CallOutcome<T>): Promise<RepositoryResult> => {
      const result = repositoryResult(outcome);
      // The registry changed even if the answer was odd, so look again.
      if (result.ok || outcome.kind === "invalid") await refreshRepositories();
      return result;
    };
    return {
      create: async (input) => finish(await createRepositoryFn(input)),
      update: async (id, body) => finish(await updateRepositoryFn(id, body)),
      remove: async (id) => finish(await deleteRepositoryFn(id)),
    };
  }, [createRepositoryFn, updateRepositoryFn, deleteRepositoryFn, refreshRepositories]);

  const [aiAvailable, setAiAvailable] = useState(false);
  const getCapabilities = props.getCapabilities ?? defaultGetCapabilities;
  useEffect(() => {
    const controller = new AbortController();
    void getCapabilities({ signal: controller.signal }).then((outcome) => {
      setAiAvailable(outcome.kind === "ok" && outcome.value.ai_interpreter.available);
    });
    return () => controller.abort();
  }, [getCapabilities]);

  // Sound: nothing exists until the user turns it on (a gesture in this page). Levels and mute persist; "on" never does.
  const { controller: audio, snapshot: audioState } = useAudio(props.audioFactory);
  useEffect(() => {
    audio.setVolume(settings.volume);
    audio.setMuted(settings.muted);
    audio.setAmbientVolume(settings.ambient);
    audio.setEffectsVolume(settings.effects);
  }, [audio, settings.volume, settings.muted, settings.ambient, settings.effects]);
  // Sound is on by default. Browsers only let it start after a gesture, so it starts with the first click or key press in Sean.
  useEffect(() => {
    if (!settings.soundOn || audioState.enabled) return;
    const start = (): void => void audio.enable();
    document.addEventListener("pointerdown", start);
    document.addEventListener("keydown", start);
    return () => {
      document.removeEventListener("pointerdown", start);
      document.removeEventListener("keydown", start);
    };
  }, [audio, settings.soundOn, audioState.enabled]);
  const lastThreat = useRef<ThreatInfo | null>(null);
  const presence = useRef(new PresenceSounds());
  const presenceClock = useRef(0);
  const playAll = useCallback((plans: CuePlan[]): void => {
    for (const plan of plans) audio.cue(plan.cue, plan.options);
  }, [audio]);
  // Intense sound (the scream and the heavy impact) follows the same setting as the intense picture.
  useEffect(() => {
    audio.setIntenseAllowed(settings.jumpscare);
  }, [audio, settings.jumpscare]);
  const toggleSound = useCallback((): void => {
    const next = !settings.soundOn;
    persist({ soundOn: next });
    if (next) void audio.enable();
    else audio.disable();
  }, [audio, persist, settings.soundOn]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const currentSnapshotId = useRef<string | null>(null);
  const interlude = useInterlude({ reducedMotion: reduced, gameAllowed: settings.horror && !settings.skipGameplay && props.renderGame !== undefined });
  const beginInterlude = interlude.begin;
  const standalone = interlude.state.standalone;
  const phaseRef = useRef(interlude.state.phase);
  phaseRef.current = interlude.state.phase;
  const standaloneCount = useRef(0);
  const beginGame = interlude.beginGame;
  const renderGameAvailable = props.renderGame !== undefined;
  // The game on its own. It needs nothing from the backend or from any report, and it ignores the interlude settings: the user asked for it.
  // The demo: the game with no investigation behind it. It is offered only in Settings. The game after an analysis is the surprise.
  const startDemo = useCallback((): void => {
    if (!renderGameAvailable) return;
    standaloneCount.current += 1;
    setGameNote(null);
    beginGame(`standalone-${standaloneCount.current}`);
  }, [beginGame, renderGameAvailable]);
  const [finishedInterludes, setFinishedInterludes] = useState<ReadonlySet<string>>(new Set());

  // The sound follows the interlude's phase and the planchette's steps. Leaving the interlude silences everything.
  const phaseNow = interlude.state.phase;
  const boardStep = interlude.state.step;
  const boardSettled = interlude.state.boardSettled;
  useEffect(() => {
    audio.setMood(moodForPhase(phaseNow));
    const cue = cueForPhase(phaseNow);
    if (cue) audio.cue(cue);
    if (phaseNow === "OFF" || phaseNow === "REPORT_AVAILABLE" || phaseNow === "GAME_INITIALIZATION") {
      audio.setTension(0);
      lastThreat.current = null;
      presence.current.reset();
      presenceClock.current = 0;
    }
  }, [audio, phaseNow]);
  useEffect(() => {
    if (phaseNow === "OUIJA_ACTIVE") playAll(planForOuijaStep(boardStep, boardSettled));
  }, [playAll, phaseNow, boardStep, boardSettled]);
  const onGameEvent = useCallback(
    (event: GameEvent): void => playAll(planForGameEvent(event, lastThreat.current, { jumpscare: settingsRef.current.jumpscare })),
    [playAll],
  );
  const onThreat = useCallback((info: ThreatInfo): void => {
    lastThreat.current = info;
    presenceClock.current += 0.1;
    audio.setTension(info.level);
    playAll(presence.current.update(info, 0.1, presenceClock.current));
  }, [audio, playAll]);

  const analysis = useAnalysis({
    deps: props.analysisDeps,
    onSnapshot: (snapshot) => {
      setSaveNote(null);
      setGameNote(null);
      // The report is saved first. The interlude starts only after the save has finished or failed, or after three seconds.
      const saved = store.save(snapshot).then((result) => {
        if (!result.ok) setSaveNote("This report could not be saved in this browser. It stays on screen until you leave it.");
        void refreshSaved();
      });
      const waited = Promise.race([saved, new Promise<void>((resolve) => window.setTimeout(resolve, 3000))]);
      void waited.then(() => {
        // The user may have started something else during the wait; then there is nothing to interrupt.
        if (currentSnapshotId.current !== snapshot.id) return;
        // A game is already running (the user went to play while waiting): the report simply waits behind it.
        if (isActive(phaseRef.current)) {
          setFinishedInterludes((current) => new Set(current).add(snapshot.id));
          return;
        }
        if (settingsRef.current.horror && isInterludeEligible(snapshot)) beginInterlude(snapshot.id);
      });
    },
  });
  const { state } = analysis;
  currentSnapshotId.current = state.snapshot?.id ?? null;

  const [artifactRecords, setArtifactRecords] = useState<ArtifactRecord[]>([]);
  const snapshotId = state.snapshot?.id ?? null;
  // The interlude ended (for any reason): the report for that snapshot may be shown.
  const interludeSnapshot = interlude.state.snapshotId;
  const interludePhase = interlude.state.phase;
  const interludeEnd = interlude.state.endedBy;
  useEffect(() => {
    if (interludePhase === "REPORT_AVAILABLE" && interludeEnd === "GAME_FAILED") {
      setGameNote(standalone
        ? "The game could not run in this browser. It needs WebGL and a keyboard."
        : "The game could not run in this browser (it needs WebGL and a keyboard), so your report opened instead. Nothing in the report is affected.");
    }
  }, [interludePhase, interludeEnd, standalone]);
  useEffect(() => {
    if (interludePhase === "REPORT_AVAILABLE" && interludeSnapshot) setFinishedInterludes((current) => new Set(current).add(interludeSnapshot));
  }, [interludePhase, interludeSnapshot]);
  useEffect(() => {
    setArtifactRecords(state.snapshot ? [...state.snapshot.artifacts] : []);
    // Only a different snapshot resets the records.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotId]);
  const previewFn = props.previewArtifacts ?? defaultPreviewArtifacts;
  const artifactContext: ArtifactContextValue | null = state.snapshot
    ? {
        repositoryId: state.snapshot.input.repository_id,
        preview: previewFn,
        records: artifactRecords,
        exporter: props.exporter ?? browserExporter,
        record: (entry) => {
          setArtifactRecords((current) => {
            const previous = current.find((r) => r.capability === entry.capability && r.path === entry.path);
            if (previous && previous.state === "ARTIFACT_EXPORTED" && entry.state === "ARTIFACT_GENERATED" && previous.content_sha256 === entry.content_sha256) return current;
            return [...current.filter((r) => r !== previous), entry];
          });
          void store.recordArtifact(state.snapshot!.id, entry);
        },
      }
    : null;

  const [view, setView] = useState<View>("new");
  const [menuOpen, setMenuOpen] = useState(false);
  // The interlude belongs to one snapshot. If the user has moved on to something else, it must not hold the screen.
  const interludeMatches = standalone || (state.snapshot !== null && state.snapshot.id === interlude.state.snapshotId);
  const interludeActive = isActive(interlude.state.phase) && interludeMatches;
  const skipInterlude = interlude.skip;
  const strayInterlude = isActive(interlude.state.phase) && !interludeMatches;
  useEffect(() => {
    if (strayInterlude) skipInterlude();
  }, [strayInterlude, skipInterlude]);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, [view, state.phase === "READY", interludeActive]);

  const selectedRepository = repositories?.some((r) => r.repository_id === settings.lastRepositoryId && r.available) ? settings.lastRepositoryId : "";
  const selectRepository = (id: string): void => persist({ lastRepositoryId: id });

  function navigate(next: View): void {
    setMenuOpen(false);
    setOpenNote(null);
    setGameNote(null);
    if (next === "new") {
      analysis.reset();
      setOpenedId(null);
    }
    setView(next);
  }

  async function openSaved(id: string): Promise<void> {
    setMenuOpen(false);
    const snapshot = await store.load(id);
    if (snapshot === null) {
      setOpenNote("That report could not be opened. It was missing or no longer valid, so it was removed.");
      void refreshSaved();
      return;
    }
    setOpenNote(null);
    setGameNote(null);
    setOpenedId(snapshot.id);
    analysis.open(snapshot);
    setView("new");
  }

  const submitText = (text: string, allowAi: boolean): void => {
    setGameNote(null);
    setOpenedId(null);
    analysis.submit(text, selectedRepository || null, allowAi);
  };
  const submitStructured = (request: InvestigationRequest): void => {
    setGameNote(null);
    setOpenedId(null);
    persist({ lastRepositoryId: request.repository_id });
    analysis.submitPlan(
      {
        mode: "INVESTIGATE", interpreter: "deterministic", repository_id: request.repository_id, target_path: request.target.path,
        symbol: request.target.symbol ?? null, question: request.question, candidates: [], message: null, ai_status: "NOT_REQUESTED",
      },
      `${request.repository_id} — ${request.question}`,
    );
  };


  // A fresh, eligible snapshot is held back until its interlude has ended, so the report does not flash before the surprise.
  const holdReport =
    state.phase === "READY" && state.snapshot !== null && state.snapshot.id !== openedId && settings.horror &&
    isInterludeEligible(state.snapshot) && !finishedInterludes.has(state.snapshot.id);

  let content: React.ReactNode;
  if (view === "reports") {
    content = (
      <SavedReportsView
        items={saved}
        unavailable={storageUnavailable}
        onOpen={(id) => void openSaved(id)}
        onRemove={(id) => void store.remove(id).then(refreshSaved)}
      />
    );
  } else if (view === "repositories") {
    content = (
      <RepositoriesView
        repositories={repositories}
        problem={repositoriesProblem}
        selectedId={selectedRepository}
        actions={repositoryActions}
        onUse={(id) => {
          selectRepository(id);
          navigate("new");
        }}
      />
    );
  } else if (view === "settings") {
    content = (
      <SettingsView
        motion={settings.motion}
        onMotion={(motion: MotionPreference) => persist({ motion })}
        experience={settings.horror}
        onExperience={(horror) => persist({ horror })}
        skipGameplay={settings.skipGameplay}
        onSkipGameplay={(skipGameplay) => persist({ skipGameplay })}
        onPlayDemo={renderGameAvailable ? startDemo : undefined}
        sound={{
          enabled: audioState.enabled,
          wanted: settings.soundOn,
          failed: audioState.failed,
          muted: settings.muted,
          volume: settings.volume,
          ambient: settings.ambient,
          effects: settings.effects,
          onToggle: toggleSound,
          onMuted: (muted) => persist({ muted }),
          onVolume: (volume) => persist({ volume }),
          onAmbient: (ambient) => persist({ ambient }),
          onEffects: (effects) => persist({ effects }),
        }}
        intensity={settings.intensity}
        onIntensity={(intensity) => persist({ intensity })}
        quality={settings.quality}
        onQuality={(quality) => persist({ quality })}
        jumpscare={settings.jumpscare}
        onJumpscare={(jumpscare) => persist({ jumpscare })}
        reducedEffective={reduced}
        onClearReports={async () => {
          const ok = await store.clear();
          await refreshSaved();
          return ok;
        }}
      />
    );
  } else if (state.phase === "INTERPRETING" || state.phase === "ANALYZING") {
    content = <AnalysisProgress state={state} onCancel={analysis.cancel} />;
  } else if (holdReport || (interludeActive && !standalone)) {
    content = (
      <div className="sx-page" data-testid="preparing">
        <h1 className="sx-h1">Your report is ready</h1>
        <p className="sx-lede" role="status">Preparing it now.</p>
      </div>
    );
  } else if (state.phase === "READY" && state.snapshot) {
    content = (
      <>
        {gameNote ? <div className="sx-notice" role="status" data-testid="game-note"><h3>The game did not start</h3><p>{gameNote}</p></div> : null}
        {saveNote ? <div className="sx-notice" data-tone="warn" role="alert" data-testid="save-note"><h3>Not saved</h3><p>{saveNote}</p></div> : null}
        {artifactContext ? <ReportView snapshot={state.snapshot} origin={state.snapshot.id === openedId ? "saved" : "fresh"} onNew={() => navigate("new")} artifacts={artifactContext} /> : null}
      </>
    );
  } else {
    const rejected = state.error && state.error.kind === "REQUEST_REJECTED" ? state.error.backend : null;
    content = (
      <RequestScreen
        repositories={repositories}
        repositoriesProblem={repositoriesProblem}
        selectedRepository={selectedRepository}
        onSelectRepository={selectRepository}
        onSubmitText={submitText}
        aiAvailable={aiAvailable}
        onSubmitStructured={submitStructured}
        candidates={state.phase === "NEEDS_TARGET" ? state.plan?.candidates ?? [] : []}
        onChooseCandidate={(path) => {
          if (state.plan) analysis.submitPlan({ ...state.plan, mode: "INVESTIGATE", target_path: path, candidates: [], message: null }, state.text);
        }}
        symbolCandidates={rejected?.candidates ?? []}
        onChooseSymbol={(symbol) => {
          if (state.plan) analysis.submitPlan({ ...state.plan, symbol }, state.text);
        }}
        initialText={state.text}
        notice={
          <>
            {gameNote && view === "new" && state.phase !== "READY" ? <div className="sx-notice" role="status" data-testid="game-note"><h3>The game did not start</h3><p>{gameNote}</p></div> : null}
            {openNote ? <div className="sx-notice" data-tone="warn" role="alert" data-testid="open-note"><h3>Report not opened</h3><p>{openNote}</p></div> : null}
            {state.phase === "NEEDS_TARGET" && state.plan?.message ? <div className="sx-notice" role="status" data-testid="needs-target"><h3>One more detail</h3><p>{state.plan.message}</p></div> : null}
            {state.phase === "CANCELLED" ? (
              <div className="sx-notice" role="status" data-testid="cancelled"><h3>Stopped</h3><p>You stopped waiting. Nothing was concluded, and this says nothing about whether evidence exists.</p></div>
            ) : null}
            {state.error ? <AnalysisNotice error={state.error} onDismiss={analysis.reset} onRetry={state.text ? () => submitText(state.text, false) : undefined} /> : null}
          </>
        }
      />
    );
  }

  const game =
    props.renderGame && interludeActive && isGamePhase(interlude.state.phase)
      ? props.renderGame({
          // The demo has no report. A game after an analysis uses that analysis.
          snapshot: standalone ? null : state.snapshot ?? null,
          phase: interlude.state.phase as "GAME_INITIALIZATION" | "GAME_ACTIVE" | "PLAYER_CAUGHT",
          attempt: interlude.state.attempts,
          reducedMotion: reduced,
          standalone,
          intensity: settings.intensity,
          jumpscare: settings.jumpscare,
          quality: settings.quality,
          onEvent: onGameEvent,
          onThreat,
          sound: { enabled: settings.soundOn, onToggle: toggleSound },
          scare: { enabled: settings.jumpscare, onToggle: () => persist({ jumpscare: !settings.jumpscare }) },
          onReady: interlude.gameReady,
          onFailed: interlude.gameFailed,
          onCaught: interlude.caught,
          onEscaped: interlude.escaped,
          onQuit: interlude.quit,
          onRetry: interlude.retry,
          onGiveUp: interlude.giveUp,
        })
      : null;

  return (
    <>
    <div className="sx-shell" data-collapsed={settings.sidebarCollapsed} data-open={menuOpen} data-view={view} data-phase={state.phase} data-interlude={interludeActive} inert={interludeActive}>
      <a className="visually-hidden" href="#main">Skip to the main content</a>
      <Sidebar
        view={view}
        collapsed={settings.sidebarCollapsed}
        recent={saved ?? []}
        activeId={state.snapshot?.id ?? null}
        onNavigate={navigate}
        onToggle={() => persist({ sidebarCollapsed: !settings.sidebarCollapsed })}
        onOpenRecent={(id) => void openSaved(id)}
      />
      {menuOpen ? <div className="sx-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" /> : null}
      <main className="sx-main" id="main" ref={mainRef} tabIndex={-1}>
        <button type="button" className="sx-btn sx-menu-button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} aria-controls="app-sidebar">Menu</button>
        <div className="visually-hidden" role="status" aria-live="polite" data-testid="phase-announcer">
          {announce(state.phase)}
        </div>
        {content}
      </main>
    </div>
    {interludeActive ? (
      <InterludeOverlay state={interlude.state} question={state.snapshot?.input.question ?? ""} standalone={standalone} reducedMotion={reduced} onSkip={interlude.skip}>
        {game}
      </InterludeOverlay>
    ) : null}
    </>
  );
}

const REPOSITORY_FIELDS: Record<string, RepositoryField | undefined> = {
  INVALID_REPOSITORY_ID: "repository_id", DUPLICATE_ID: "repository_id", INVALID_DISPLAY_NAME: "display_name",
  PATH_NOT_FOUND: "path", NOT_A_GIT_REPOSITORY: "path", DUPLICATE_PATH: "path",
};

/** Turn a call outcome into what the Repositories page shows. A failure never looks like success. */
function repositoryResult<T>(outcome: CallOutcome<T>): RepositoryResult {
  switch (outcome.kind) {
    case "ok":
      return { ok: true };
    case "rejected": {
      const field = REPOSITORY_FIELDS[outcome.error.code] ?? (outcome.error.field === "path" || outcome.error.field === "display_name" || outcome.error.field === "repository_id" ? outcome.error.field : null);
      return { ok: false, code: outcome.error.code, message: outcome.error.message, field };
    }
    case "network":
      return { ok: false, code: "NETWORK", message: "The backend could not be reached, so nothing was changed. Check that it is running, then try again.", field: null };
    case "invalid":
      return { ok: false, code: "INVALID_RESPONSE", message: "The backend answered in an unexpected way. The list was reloaded; check whether the change was made.", field: null };
    case "aborted":
      return { ok: false, code: "ABORTED", message: "The request was stopped.", field: null };
  }
}

function announce(phase: string): string {
  switch (phase) {
    case "INTERPRETING": return "Reading your request.";
    case "ANALYZING": return "Analyzing the repository.";
    case "READY": return "The report is ready.";
    case "NEEDS_TARGET": return "Sean needs a file to continue.";
    case "CANCELLED": return "Stopped waiting.";
    case "ERROR": return "The analysis did not produce a result.";
    default: return "";
  }
}
