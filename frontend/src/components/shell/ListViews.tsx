/** Saved reports, repositories and settings screens. */

import { useState } from "react";
import type { RepositoryListItem } from "../../types/advisor";
import type { SnapshotSummary } from "../../features/report/reportSnapshot";
import type { MotionPreference, Settings } from "../../features/experience/settingsStore";
import { ClassificationBadge, PlainBadge, RetrievalBadge } from "../report/badges";

export function SavedReportsView(props: {
  items: SnapshotSummary[] | null;
  unavailable: boolean;
  onOpen(id: string): void;
  onRemove(id: string): void;
}) {
  const { items } = props;
  return (
    <div className="sx-page" data-testid="saved-reports">
      <h1 className="sx-h1">Saved reports</h1>
      <p className="sx-lede">Reports are saved in this browser only. Opening one shows the snapshot as it was captured. Nothing is re-checked.</p>
      {props.unavailable ? (
        <div className="sx-notice" data-tone="warn" role="alert" data-testid="storage-unavailable">
          <h3>Saved reports are not available in this browser</h3>
          <p>The browser blocked its local storage, for example in a private window. Reports still work, but they are not kept.</p>
        </div>
      ) : null}
      {items === null && !props.unavailable ? <p className="sx-muted">Loading…</p> : null}
      {items !== null && items.length === 0 && !props.unavailable ? (
        <div className="sx-empty" data-testid="no-saved">No saved reports yet. A report is saved when an analysis finishes.</div>
      ) : null}
      {items !== null && items.length > 0 ? (
        <table className="sx-table">
          <thead>
            <tr><th scope="col">Request</th><th scope="col">Repository</th><th scope="col">Result</th><th scope="col">Captured</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-testid="saved-row">
                <td><bdi>{item.title}</bdi></td>
                <td className="sx-mono">{item.repository_id}</td>
                <td>
                  <span className="sx-meta" style={{ margin: 0 }}>
                    {item.retrievalStatus ? <RetrievalBadge value={item.retrievalStatus} /> : <PlainBadge>REVIEW</PlainBadge>}
                    {item.classification ? <ClassificationBadge value={item.classification} /> : null}
                    {item.actionable > 0 ? <PlainBadge tone="inferred">{`${item.actionable} TO ADOPT`}</PlainBadge> : null}
                  </span>
                </td>
                <td className="sx-mono">{item.createdAt.slice(0, 19).replace("T", " ")}Z</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="sx-btn sx-btn-small" onClick={() => props.onOpen(item.id)}>Open</button>{" "}
                  <button type="button" className="sx-btn sx-btn-small sx-btn-quiet sx-btn-danger" onClick={() => props.onRemove(item.id)} aria-label={`Delete saved report: ${item.title}`}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function RepositoriesView(props: { repositories: RepositoryListItem[] | null; problem: string | null; onUse(id: string): void }) {
  const { repositories } = props;
  return (
    <div className="sx-page" data-testid="repositories">
      <h1 className="sx-h1">Repositories</h1>
      <p className="sx-lede">These are the repositories registered with the backend. Sean reads only these, and only their committed history. It never changes them.</p>
      {props.problem ? <div className="sx-notice" data-tone="danger" role="alert"><h3>The list could not be loaded</h3><p>{props.problem}</p></div> : null}
      {repositories === null && !props.problem ? <p className="sx-muted">Loading…</p> : null}
      {repositories !== null && repositories.length === 0 ? <div className="sx-empty">No repositories are registered. Add one to the registry file and restart the backend.</div> : null}
      {repositories !== null && repositories.length > 0 ? (
        <table className="sx-table">
          <thead><tr><th scope="col">Identifier</th><th scope="col">Status</th><th scope="col">GitHub</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
          <tbody>
            {repositories.map((r) => (
              <tr key={r.repository_id} data-testid="repository-row">
                <td className="sx-mono">{r.repository_id}</td>
                <td>{r.available ? <PlainBadge tone="documented">AVAILABLE</PlainBadge> : <PlainBadge tone="danger">UNAVAILABLE</PlainBadge>}</td>
                <td>{r.github ? <span className="sx-mono">{r.github.owner}/{r.github.name}</span> : <span className="sx-faint">not set</span>}</td>
                <td><button type="button" className="sx-btn sx-btn-small" disabled={!r.available} onClick={() => props.onUse(r.repository_id)}>Use</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export function SettingsView(props: {
  motion: MotionPreference;
  onMotion(value: MotionPreference): void;
  experience: boolean;
  onExperience(value: boolean): void;
  skipGameplay: boolean;
  onSkipGameplay(value: boolean): void;
  sound: {
    enabled: boolean;
    failed: boolean;
    muted: boolean;
    volume: number;
    ambient: number;
    effects: number;
    onToggle(): void;
    onMuted(value: boolean): void;
    onVolume(value: number): void;
    onAmbient(value: number): void;
    onEffects(value: number): void;
  };
  intensity: Settings["intensity"];
  onIntensity(value: Settings["intensity"]): void;
  quality: Settings["quality"];
  onQuality(value: Settings["quality"]): void;
  jumpscare: boolean;
  onJumpscare(value: boolean): void;
  reducedEffective: boolean;
  onClearReports(): Promise<boolean>;
}) {
  const [cleared, setCleared] = useState<"idle" | "done" | "failed">("idle");
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="sx-page" data-testid="settings">
      <h1 className="sx-h1">Settings</h1>
      <p className="sx-lede">Preferences are stored in this browser.</p>
      <section className="sx-card" aria-labelledby="motion-heading">
        <h2 className="sx-h2" id="motion-heading">Motion</h2>
        <label className="sx-label" htmlFor="motion-select">Animation</label>
        <select id="motion-select" className="sx-select" style={{ maxWidth: "20rem" }} value={props.motion} onChange={(event) => props.onMotion(event.target.value as MotionPreference)} data-testid="motion">
          <option value="system">Follow my system setting</option>
          <option value="reduced">Reduce motion</option>
          <option value="full">Allow full motion</option>
        </select>
        <p className="sx-faint" data-testid="motion-status" style={{ marginBottom: 0 }}>
          {props.reducedEffective ? "Motion is reduced." : "Motion is on."}
        </p>
      </section>
      <section className="sx-card" aria-labelledby="experience-heading">
        <h2 className="sx-h2" id="experience-heading">Experience</h2>
        <p className="sx-muted" style={{ marginTop: 0 }}>
          After an analysis, Sean can show a short fictional interlude before the report. It is never part of the report and cannot change it. You can always skip it.
        </p>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.4rem 0" }}>
          <input type="checkbox" checked={props.experience} onChange={(event) => props.onExperience(event.target.checked)} data-testid="experience-toggle" />
          <span>Show the interlude after an analysis</span>
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.4rem 0" }}>
          <input type="checkbox" checked={props.skipGameplay} disabled={!props.experience} onChange={(event) => props.onSkipGameplay(event.target.checked)} data-testid="skip-gameplay-toggle" />
          <span>Skip the game (the Ouija still plays)</span>
        </label>
        <div style={{ display: "grid", gap: "0.4rem", margin: "0.6rem 0" }}>
          <label className="sx-label" htmlFor="intensity-select">Horror intensity</label>
          <select id="intensity-select" className="sx-select" style={{ maxWidth: "20rem" }} value={props.intensity} disabled={!props.experience || props.skipGameplay} onChange={(event) => props.onIntensity(event.target.value as Settings["intensity"])} data-testid="intensity">
            <option value="low">Gentle: a slower, less alert creature</option>
            <option value="normal">Normal</option>
            <option value="high">Intense: a faster, more alert creature</option>
          </select>
          <label className="sx-label" htmlFor="quality-select">Graphics quality</label>
          <select id="quality-select" className="sx-select" style={{ maxWidth: "20rem" }} value={props.quality} disabled={!props.experience || props.skipGameplay} onChange={(event) => props.onQuality(event.target.value as Settings["quality"])} data-testid="quality">
            <option value="low">Low (best performance)</option>
            <option value="medium">Medium</option>
            <option value="high">High (shadows, sharper image)</option>
          </select>
        </div>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.4rem 0" }}>
          <input type="checkbox" checked={props.jumpscare} disabled={!props.experience || props.skipGameplay} onChange={(event) => props.onJumpscare(event.target.checked)} data-testid="jumpscare-toggle" />
          <span>Show the scare when you are caught</span>
        </label>
      </section>
      <section className="sx-card" aria-labelledby="sound-heading">
        <h2 className="sx-h2" id="sound-heading">Sound</h2>
        <p className="sx-muted" style={{ marginTop: 0 }}>
          Sound belongs to the interlude only. It is off whenever you open Sean and starts only when you turn it on here or on the game's first screen.
        </p>
        <p>
          <button type="button" className="sx-btn" onClick={props.sound.onToggle} aria-pressed={props.sound.enabled} data-testid="sound-toggle">
            {props.sound.enabled ? "Turn sound off" : "Turn sound on"}
          </button>
        </p>
        <p role="status" className="sx-faint" data-testid="sound-status">
          {props.sound.failed ? "Sound could not start in this browser." : props.sound.enabled ? (props.sound.muted ? "Sound is on but muted." : "Sound is on.") : "Sound is off."}
        </p>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center", margin: "0.4rem 0" }}>
          <input type="checkbox" checked={props.sound.muted} onChange={(event) => props.sound.onMuted(event.target.checked)} data-testid="mute" />
          <span>Mute</span>
        </label>
        {([["Master volume", "volume", props.sound.volume, props.sound.onVolume], ["Ambient", "ambient", props.sound.ambient, props.sound.onAmbient], ["Effects", "effects", props.sound.effects, props.sound.onEffects]] as const).map(([label, id, value, onChange]) => (
          <div key={id} style={{ display: "grid", gap: "0.2rem", maxWidth: "20rem", margin: "0.4rem 0" }}>
            <label className="sx-label" htmlFor={`${id}-range`}>{label}: {Math.round(value * 100)}%</label>
            <input id={`${id}-range`} type="range" min={0} max={1} step={0.05} value={value} aria-valuetext={`${Math.round(value * 100)} percent`} onChange={(event) => onChange(Number(event.target.value))} data-testid={`${id}-range`} />
          </div>
        ))}
      </section>
      <section className="sx-card" aria-labelledby="data-heading">
        <h2 className="sx-h2" id="data-heading">Saved reports</h2>
        <p className="sx-muted" style={{ marginTop: 0 }}>Remove every report saved in this browser. This cannot be undone.</p>
        {confirming ? (
          <p>
            <button type="button" className="sx-btn sx-btn-danger" onClick={async () => { setCleared((await props.onClearReports()) ? "done" : "failed"); setConfirming(false); }}>Delete all saved reports</button>{" "}
            <button type="button" className="sx-btn sx-btn-quiet" onClick={() => setConfirming(false)}>Keep them</button>
          </p>
        ) : (
          <button type="button" className="sx-btn" onClick={() => { setConfirming(true); setCleared("idle"); }}>Delete saved reports…</button>
        )}
        <p role="status" className="sx-faint" data-testid="clear-status">
          {cleared === "done" ? "Saved reports were deleted." : cleared === "failed" ? "Saved reports could not be deleted in this browser." : ""}
        </p>
      </section>
    </div>
  );
}
