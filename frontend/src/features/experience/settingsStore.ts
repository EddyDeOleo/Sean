/**
 * Experience settings (Spec 3 section 14). Stored in localStorage and validated on load.
 *
 * Sound ON is never stored: sound starts only after an explicit gesture in the current page (Spec 2 section 14.1). Only the
 * volume and the muted flag persist. A stored value that is missing, unparsable, or out of range falls back to the default.
 */

import { DEFAULT_VOLUME } from "../audio/AudioController";

export type MotionPreference = "system" | "reduced" | "full";

export interface Settings {
  volume: number;
  muted: boolean;
  motion: MotionPreference;
  /** Whether the narrative interruption and escape game run. When false, the report follows the reveal directly. */
  horror: boolean;
  lastRepositoryId: string;
}

export const SETTINGS_KEY = "sean.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  volume: DEFAULT_VOLUME,
  muted: false,
  motion: "system",
  horror: true,
  lastRepositoryId: "",
};

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
