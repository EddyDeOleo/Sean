/**
 * Experience settings (Spec 3 section 11, Spec 2 sections 6.6 and 14.2).
 *
 * Sound: off until the user presses "Enable sound". Then mute and volume. Motion: follow the system, force reduced, or force
 * full. The horror sequence switch turns the interruption and the escape game off entirely. The report never depends on any
 * of these.
 */

import { useId } from "react";
import { useAudio } from "../../features/audio/AudioProvider";
import type { MotionPreference } from "../../features/experience/settingsStore";

export interface ExperienceSettingsProps {
  motion: MotionPreference;
  onMotion(value: MotionPreference): void;
  horror: boolean;
  onHorror(value: boolean): void;
  /** Whether the current motion setting is effectively reduced, for the status text. */
  reducedEffective: boolean;
}

export function ExperienceSettings({ motion, onMotion, horror, onHorror, reducedEffective }: ExperienceSettingsProps) {
  const audio = useAudio();
  const base = useId();
  const { snapshot } = audio;
  const volumePercent = Math.round(snapshot.volume * 100);

  return (
    <fieldset className="settings" aria-label="Experience settings">
      <legend>Experience</legend>

      <div className="setting-row">
        {snapshot.enabled ? (
          <>
            <button
              type="button"
              className="btn btn-small"
              aria-pressed={snapshot.muted}
              onClick={() => audio.setMuted(!snapshot.muted)}
              data-testid="mute"
            >
              {snapshot.muted ? "Unmute" : "Mute"}
            </button>
            <label htmlFor={`${base}-volume`}>Volume</label>
            <input
              id={`${base}-volume`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={volumePercent}
              aria-valuetext={`${volumePercent} percent`}
              onChange={(event) => audio.setVolume(Number(event.target.value) / 100)}
              data-testid="volume"
            />
            <span className="muted" aria-hidden="true">
              {volumePercent}%
            </span>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => audio.disable()} data-testid="sound-off">
              Turn sound off
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-small" onClick={() => void audio.enable()} data-testid="enable-sound">
              Enable sound
            </button>
            <span className="muted" data-testid="sound-status">
              {snapshot.failed ? "Sound could not start in this browser. Everything works without it." : "Sound is off. It starts only when you enable it."}
            </span>
          </>
        )}
      </div>

      <div className="setting-row">
        <label htmlFor={`${base}-motion`}>Motion</label>
        <select
          id={`${base}-motion`}
          className="input"
          style={{ width: "auto" }}
          value={motion}
          onChange={(event) => onMotion(event.target.value as MotionPreference)}
          data-testid="motion"
        >
          <option value="system">Follow my system</option>
          <option value="reduced">Reduced motion</option>
          <option value="full">Full motion</option>
        </select>
        <span className="muted" data-testid="motion-status">
          {reducedEffective ? "Motion is reduced." : "Motion is on."}
        </span>
      </div>

      <div className="setting-row">
        <label>
          <input type="checkbox" checked={horror} onChange={(event) => onHorror(event.target.checked)} data-testid="horror-toggle" />{" "}
          Horror sequence (an interruption and a short game after a successful result)
        </label>
      </div>
    </fieldset>
  );
}
