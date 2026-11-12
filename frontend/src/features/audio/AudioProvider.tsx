/**
 * React binding for the audio controller (Spec 3 section 10).
 *
 * The provider creates one controller per mount and disposes it on unmount. Under React StrictMode an effect runs, is
 * cleaned up, and runs again, so the controller is created inside the effect and a fresh one replaces a disposed one. State
 * is read with useSyncExternalStore, so components re-render only when the controller publishes a change.
 *
 * Moods and cues follow the experience state. The success cues are played only when the experience allows a success
 * presentation (an eligible result). A FAILED, invalid, rejected, network, cancelled, or insufficient-evidence outcome
 * never plays a success cue, because allowsSuccessPresentation is false for each of them.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AudioController, SUCCESS_CUES, type AudioSnapshot, type ContextFactory, type Cue, type Mood } from "./AudioController";
import { allowsSuccessPresentation, type ExperienceState } from "../experience/experienceMachine";

export interface AudioApi {
  snapshot: AudioSnapshot;
  enable(): Promise<boolean>;
  disable(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  /** Play a cue. A success cue is dropped unless the experience allows a success presentation. */
  cue(cue: Cue, state: Pick<ExperienceState, "phase" | "result">): void;
  setMood(mood: Mood): void;
}

const IDLE_SNAPSHOT: AudioSnapshot = {
  enabled: false,
  muted: false,
  volume: 0.35,
  mood: "silent",
  failed: false,
  activeBeds: 0,
  activeCues: 0,
};

const AudioContextValue = createContext<AudioApi | null>(null);

export interface AudioProviderProps {
  children: ReactNode;
  factory?: ContextFactory;
  initialVolume?: number;
  initialMuted?: boolean;
  onChange?: (settings: { volume: number; muted: boolean }) => void;
  /** Test seam: receives the live controller. */
  onController?: (controller: AudioController | null) => void;
}

export function AudioProvider({ children, factory, initialVolume, initialMuted, onChange, onController }: AudioProviderProps): ReactNode {
  const [controller, setController] = useState<AudioController | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialRef = useRef({ volume: initialVolume, muted: initialMuted });

  useEffect(() => {
    const created = new AudioController(factory);
    if (initialRef.current.volume !== undefined) created.setVolume(initialRef.current.volume);
    if (initialRef.current.muted !== undefined) created.setMuted(initialRef.current.muted);
    setController(created);
    onController?.(created);
    return () => {
      created.dispose();
      setController((current) => (current === created ? null : current));
      onController?.(null);
    };
  }, [factory, onController]);

  const subscribe = useMemo(() => controller?.subscribe ?? (() => () => undefined), [controller]);
  const getSnapshot = useMemo(() => controller?.getSnapshot ?? (() => IDLE_SNAPSHOT), [controller]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => IDLE_SNAPSHOT);

  // Report persisted settings (volume and muted only; "enabled" is never persisted).
  const lastReported = useRef<string>("");
  useEffect(() => {
    const key = `${snapshot.volume}|${snapshot.muted}`;
    if (key === lastReported.current) return;
    lastReported.current = key;
    onChangeRef.current?.({ volume: snapshot.volume, muted: snapshot.muted });
  }, [snapshot.volume, snapshot.muted]);

  const api = useMemo<AudioApi>(
    () => ({
      snapshot,
      enable: async () => (controller ? controller.enable() : false),
      disable: () => controller?.disable(),
      setMuted: (muted) => controller?.setMuted(muted),
      setVolume: (volume) => controller?.setVolume(volume),
      setMood: (mood) => controller?.setMood(mood),
      cue: (cue, state) => {
        if (!controller) return;
        if (SUCCESS_CUES.has(cue) && !allowsSuccessPresentation(state)) return;
        controller.cue(cue);
      },
    }),
    [controller, snapshot],
  );

  return <AudioContextValue.Provider value={api}>{children}</AudioContextValue.Provider>;
}

export function useAudio(): AudioApi {
  const api = useContext(AudioContextValue);
  if (api === null) throw new Error("useAudio must be used inside AudioProvider");
  return api;
}

/** The ambient mood for an experience state. A pure function, so the sound follows the state and nothing else. */
export function moodFor(state: Pick<ExperienceState, "phase" | "stage" | "settled" | "result">): Mood {
  switch (state.phase) {
    case "IDLE":
      return "idle";
    case "INVESTIGATING":
      return "search";
    case "REVEALING":
      return allowsSuccessPresentation(state) ? "reveal" : "idle";
    case "NARRATIVE_INTERRUPTION":
      return "tension";
    case "ESCAPE_SEQUENCE":
      return "escape";
    case "FINAL_REPORT":
      return "report";
    case "ERROR":
    case "CANCELLED":
      return "idle";
  }
}
