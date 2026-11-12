/**
 * The narrative interruption (Spec 3 section 7, Scene D).
 *
 * A fixed beat sequence on a timer: a brief glitch, "Wait... something is wrong.", a pause with the lights dimming,
 * "Something else is still in this repository.", then the handoff to the escape game. Every line appears whole.
 *
 * Honesty rules, enforced by the content of this component:
 * - It says in plain words that this is fiction and not a finding of the investigation.
 * - It never claims an error, a malicious actor, or a discovery.
 * - It sits below the status strip and the partial notice, which stay visible. It cannot cover a limitation.
 * - Under reduced motion there is no glitch and no dimming. The same lines show as static text in the same order.
 *
 * The sequence is skippable at any moment. Skipping is handled by the parent (SKIP_CINEMATIC).
 */

import { useEffect, useState } from "react";

export const BEAT_MS = {
  /** The glitch burst. */
  glitch: 600,
  /** First line stays before the dimming begins. */
  firstLine: 1500,
  /** The dimming and the pause before the second line. */
  dim: 1800,
  /** Second line stays before the handoff. */
  secondLine: 2200,
} as const;

export const FIRST_LINE = "Wait... something is wrong.";
export const SECOND_LINE = "Something else is still in this repository.";
export const FICTION_NOTICE =
  "What follows is fiction. It is part of the experience and is not a finding of the investigation. Sean found no error and no person in this repository's history.";

type Beat = "glitch" | "first" | "dim" | "second" | "done";

export interface HorrorTransitionProps {
  reducedMotion: boolean;
  onDone(): void;
  onSkip(): void;
  onCue?(cue: "glitch" | "whisper"): void;
}

export function HorrorTransition({ reducedMotion, onDone, onSkip, onCue }: HorrorTransitionProps) {
  const [beat, setBeat] = useState<Beat>(reducedMotion ? "first" : "glitch");

  useEffect(() => {
    const handles: number[] = [];
    const at = (ms: number, next: Beat): void => {
      handles.push(window.setTimeout(() => setBeat(next), ms));
    };
    if (reducedMotion) {
      // Static text, same order, no glitch and no dimming.
      at(BEAT_MS.firstLine, "second");
      at(BEAT_MS.firstLine + BEAT_MS.secondLine, "done");
    } else {
      onCue?.("glitch");
      at(BEAT_MS.glitch, "first");
      at(BEAT_MS.glitch + BEAT_MS.firstLine, "dim");
      at(BEAT_MS.glitch + BEAT_MS.firstLine + BEAT_MS.dim, "second");
      at(BEAT_MS.glitch + BEAT_MS.firstLine + BEAT_MS.dim + BEAT_MS.secondLine, "done");
    }
    return () => handles.forEach((handle) => window.clearTimeout(handle));
    // The sequence is started once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    if (beat === "second") onCue?.("whisper");
    if (beat === "done") onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  const showFirst = beat === "first" || beat === "dim" || beat === "second" || beat === "done";
  const showSecond = beat === "second" || beat === "done";

  return (
    <section
      className={`scene ${beat === "glitch" ? "glitch-once" : ""} ${beat === "dim" ? "dim-slow" : ""}`}
      aria-label="Narrative interruption"
      data-beat={beat}
      data-testid="interruption"
    >
      <p className="notice notice-fiction" role="note" data-testid="fiction-notice" style={{ marginTop: 0 }}>
        {FICTION_NOTICE}
      </p>
      <div className="glitch-target" aria-live="assertive" aria-atomic="false">
        {beat === "glitch" ? <p className="scene-line" aria-hidden="true">…</p> : null}
        {showFirst ? (
          <p className="scene-line arrive" data-testid="line-one">
            {FIRST_LINE}
          </p>
        ) : null}
        {showSecond ? (
          <p className="scene-line whisper arrive" data-testid="line-two">
            {SECOND_LINE}
          </p>
        ) : null}
      </div>
      <div className="button-row" style={{ marginTop: "0.8rem" }}>
        <button type="button" className="btn btn-quiet btn-small" onClick={onSkip}>
          Skip to the report
        </button>
      </div>
    </section>
  );
}
