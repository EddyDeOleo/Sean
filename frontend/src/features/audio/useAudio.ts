/**
 * Owns the one AudioController of the page. Nothing is created until the user turns sound on (autoplay rules and
 * Spec 2 section 14.1). The controller is disposed when the app unmounts, so no sound outlives it.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { AudioController, type AudioSnapshot, type ContextFactory } from "./AudioController";

export function useAudio(factory?: ContextFactory): { controller: AudioController; snapshot: AudioSnapshot } {
  const ref = useRef<AudioController | null>(null);
  if (ref.current === null) ref.current = new AudioController(factory);
  const controller = ref.current;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  // `disable` releases every node and closes the context, and can be undone. React StrictMode runs this cleanup once in
  // development and then reuses the same controller, so a permanent `dispose` would break it.
  useEffect(() => () => controller.disable(), [controller]);
  return { controller, snapshot };
}
