/**
 * Experience settings (Spec 3 section 14). Stored in localStorage and validated on load.
 *
 * Sound is on by default (Spec 4 section 17.6). It starts with the first gesture in the page, which browsers require. The
 * on or off choice, the volume and the mute persist. A stored value that is missing, unparsable, or out of range falls back to the default.
 */

import { DEFAULT_VOLUME } from "../audio/AudioController";

export type MotionPreference = "system" | "reduced" | "full";

export interface Settings {
  volume: number;
  muted: boolean;
  motion: MotionPreference;
  /** Whether the surprise experience (the Ouija, the interruption and the game) runs after an analysis. When false the report opens at once. */
  horror: boolean;
  lastRepositoryId: string;
  sidebarCollapsed: boolean;
  /** Skip the game: the Ouija and the interruption still play, then the report opens. */
  skipGameplay: boolean;
  /** Level of the ambient bed and of the sound effects, each 0 to 1, before the master volume. */
  ambient: number;
  effects: number;
  /** How aggressive the monster is. */
  intensity: "low" | "normal" | "high";
  /** Whether being caught shows the brief scare. Off: a plain "you were caught" screen. */
  jumpscare: boolean;
  /** Graphics quality of the game. */
  quality: "low" | "medium" | "high";
  /** Whether sound is wanted. It starts with the first click or key press in the page, because browsers require a gesture. */
  soundOn: boolean;
}

export const SETTINGS_KEY = "sean.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  volume: DEFAULT_VOLUME,
  muted: false,
  motion: "system",
  horror: true,
  lastRepositoryId: "",
  sidebarCollapsed: false,
  skipGameplay: false,
  ambient: 1,
  effects: 1,
  intensity: "normal",
  jumpscare: true,
  quality: "medium",
  soundOn: true,
};

const unit = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : 1);

const REPOSITORY_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function parseSettings(raw: string | null): Settings {
  if (raw === null) return { ...DEFAULT_SETTINGS };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ...DEFAULT_SETTINGS };
  const record = value as Record<string, unknown>;
  const volume = typeof record.volume === "number" && Number.isFinite(record.volume) && record.volume >= 0 && record.volume <= 1 ? record.volume : DEFAULT_SETTINGS.volume;
  const motion: MotionPreference = record.motion === "reduced" || record.motion === "full" || record.motion === "system" ? record.motion : DEFAULT_SETTINGS.motion;
  return {
    volume,
    muted: record.muted === true,
    motion,
    horror: record.horror === false ? false : true,
    lastRepositoryId: typeof record.lastRepositoryId === "string" && REPOSITORY_ID.test(record.lastRepositoryId) ? record.lastRepositoryId : "",
    sidebarCollapsed: record.sidebarCollapsed === true,
    skipGameplay: record.skipGameplay === true,
    ambient: unit(record.ambient),
    effects: unit(record.effects),
    intensity: record.intensity === "low" || record.intensity === "high" ? record.intensity : "normal",
    jumpscare: record.jumpscare === false ? false : true,
    quality: record.quality === "low" || record.quality === "high" ? record.quality : "medium",
    soundOn: record.soundOn === false ? false : true,
  };
}

export function loadSettings(storage: Pick<Storage, "getItem"> | undefined = safeLocalStorage()): Settings {
  try {
    return parseSettings(storage ? storage.getItem(SETTINGS_KEY) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings, storage: Pick<Storage, "setItem"> | undefined = safeLocalStorage()): void {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be full or blocked. Settings then last for this page only.
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

/** Resolve the effective reduced-motion value from the preference and the system query. */
export function resolveReducedMotion(preference: MotionPreference, systemPrefersReduced: boolean): boolean {
  if (preference === "reduced") return true;
  if (preference === "full") return false;
  return systemPrefersReduced;
}
