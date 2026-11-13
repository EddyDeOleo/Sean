/**
 * Preparing, reviewing and exporting Kiro files for one recommendation (Spec 4 section 7; Requirement 5).
 *
 * Sean never writes to a repository. The user reviews each file, downloads or copies it, saves it in the repository, commits
 * it, and then asks Sean to check. The lifecycle is shown in four separate states that are never merged:
 *   PREPARED   the file was generated for review
 *   EXPORTED   the user downloaded or copied it
 *   VERIFIED   the committed file at that path is byte-identical to the prepared one (checked by Sean on request)
 * "Applied" is never claimed from an export. Uncommitted files are invisible to Sean, and the panel says so.
 */

import { createContext, useCallback, useContext, useState } from "react";
import type { PreviewResponse, Recommendation } from "../../types/advisor";
import type { ArtifactRecord } from "../../features/report/reportSnapshot";
import type { CallOutcome, PreviewBody } from "../../services/advisorClient";
import { PlainBadge } from "./badges";

export interface Exporter {
  download(filename: string, text: string): void;
  copy(text: string): Promise<boolean>;
}

export const browserExporter: Exporter = {
  download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  },
};

export interface ArtifactContextValue {
  repositoryId: string;
  preview(body: PreviewBody): Promise<CallOutcome<PreviewResponse>>;
  records: ArtifactRecord[];
  record(entry: ArtifactRecord): void;
  exporter: Exporter;
}

export const ArtifactContext = createContext<ArtifactContextValue | null>(null);

const STATE_LABEL: Record<string, string> = {
  RECOMMENDED: "RECOMMENDED",
  PREPARED: "FILES PREPARED",
  EXPORTED: "EXPORTED",
};

/** The furthest lifecycle state recorded for a capability. Verification is checked on request and shown inside the panel. */
export function lifecycleOf(records: ArtifactRecord[], capability: string): keyof typeof STATE_LABEL {
  const mine = records.filter((r) => r.capability === capability);
  if (mine.some((r) => r.state === "ARTIFACT_EXPORTED")) return "EXPORTED";
  if (mine.length > 0) return "PREPARED";
  return "RECOMMENDED";
}

export function LifecycleBadge({ records, capability }: { records: ArtifactRecord[]; capability: string }) {
  const state = lifecycleOf(records, capability);
  if (state === "RECOMMENDED") return null;
  return <PlainBadge tone="inferred" title="Where this recommendation is in the adoption steps">{STATE_LABEL[state] as string}</PlainBadge>;
}

type Load = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; response: PreviewResponse };

export function ArtifactPanel({ rec }: { rec: Recommendation }) {
  const context = useContext(ArtifactContext);
  const [load, setLoad] = useState<Load>({ kind: "idle" });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, string>>({});
  const note = useCallback((key: string, text: string) => setNotes((current) => ({ ...current, [key]: text })), []);
  if (context === null || rec.configuration_strategy === "NONE" || (rec.recommendation_status !== "ADOPT_NOW" && rec.recommendation_status !== "CONSIDER")) return null;
  const files = rec.configuration_strategy === "GENERATE_FILE";

  async function prepare() {
    if (context === null) return;
    setLoad({ kind: "loading" });
    const outcome = await context.preview({ repository_id: context.repositoryId, capabilities: [rec.capability] });
    if (outcome.kind !== "ok") {
      setLoad({
        kind: "error",
        message:
          outcome.kind === "rejected" ? outcome.error.message : outcome.kind === "network" ? "The backend could not be reached." : outcome.kind === "invalid" ? "The response could not be validated, so nothing is shown." : "Stopped.",
      });
      return;
    }
    setLoad({ kind: "ready", response: outcome.value });
    const now = new Date().toISOString();
    for (const bundle of outcome.value.bundles) {
      for (const file of bundle.files) {
        if (file.validation.ok) context.record({ capability: rec.capability, path: file.path, state: "ARTIFACT_GENERATED", at: now, content_sha256: file.content_sha256 });
      }
    }
  }

  function exported(path: string, sha: string) {
    context?.record({ capability: rec.capability, path, state: "ARTIFACT_EXPORTED", at: new Date().toISOString(), content_sha256: sha });
  }

  async function check(path: string, sha: string) {
    if (context === null) return;
    setChecks((current) => ({ ...current, [path]: "Checking the committed files…" }));
    const outcome = await context.preview({ repository_id: context.repositoryId, capabilities: [], verify: [{ path, content_sha256: sha }] });
    const result = outcome.kind === "ok" ? outcome.value.verification.find((v) => v.path === path)?.status : undefined;
    setChecks((current) => ({
      ...current,
      [path]:
        result === "IDENTICAL"
          ? "VERIFIED: the committed file is byte-identical to the prepared one."
          : result === "DIFFERENT"
            ? "A file exists at this path in the committed history, but it differs from the prepared one."
            : result === "ABSENT"
              ? "Not found in the committed history yet. Sean reads committed files only, so save it, commit it, and check again."
              : "The check could not be completed.",
    }));
  }

  return (
    <div className="sx-artifacts" data-testid="artifact-panel" data-capability={rec.capability}>
      <h4>{files ? "Prepare files" : "Instructions"}</h4>
      <p className="sx-faint" style={{ margin: "0.2rem 0 0.5rem", fontSize: "0.88rem" }}>
        Sean never changes your repository. {files ? "It prepares files for you to review, save and commit yourself." : "This cannot be a repository file, so Sean shows what to do."}
      </p>
      {load.kind === "idle" || load.kind === "error" ? (
        <button type="button" className="sx-btn sx-btn-small" onClick={() => void prepare()} data-testid="prepare">
          {files ? "Prepare files for review" : "Show instructions"}
        </button>
      ) : null}
      {load.kind === "loading" ? <p role="status" className="sx-faint">Preparing…</p> : null}
      {load.kind === "error" ? <p className="sx-field-error" role="alert" data-testid="prepare-error">{load.message}</p> : null}

      {load.kind === "ready" ? (
        <>
          {load.response.skipped.map((s) => <p key={s.capability} className="sx-notice" data-testid="skipped">{s.reason}</p>)}
          {load.response.bundles.flatMap((b) => b.files).map((file) => {
            const key = file.path;
            const record = context.records.find((r) => r.path === file.path && r.capability === rec.capability);
            return (
              <section key={key} className="sx-card" style={{ marginTop: "0.6rem" }} aria-label={`Prepared file ${file.path}`} data-testid="artifact-file" data-status={file.status}>
                <div className="sx-meta" style={{ margin: 0 }}>
                  <span className="sx-mono"><bdi>{file.path}</bdi></span>
                  <PlainBadge tone={file.status === "NEW" ? "documented" : file.status === "VERIFIED" ? "documented" : "partial"}>{file.status === "NEW" ? "NEW FILE" : file.status}</PlainBadge>
                  <PlainBadge tone={file.validation.ok ? "documented" : "danger"}>{file.validation.ok ? "FORMAT VALID" : "INVALID"}</PlainBadge>
                  {record?.state === "ARTIFACT_EXPORTED" ? <PlainBadge tone="inferred">EXPORTED</PlainBadge> : <PlainBadge>PREPARED</PlainBadge>}
                </div>
                {!file.validation.ok ? (
                  <ul className="sx-list" data-testid="validation-problems">{file.validation.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                ) : null}
                {file.status === "CONFLICT" ? (
                  <div className="sx-notice" data-tone="warn" role="note" data-testid="conflict">
                    <h3>A file already exists at this path</h3>
                    <p>Sean will not suggest overwriting it. Review the differences and merge by hand{file.alternative_path ? <>, or save this version as <span className="sx-mono">{file.alternative_path}</span> instead</> : null}.</p>
                    {file.diff ? <pre className="sx-excerpt" aria-label="Differences from the committed file">{file.diff}</pre> : <p className="sx-faint">The committed file is not text or is too large to compare.</p>}
                  </div>
                ) : null}
                <pre className="sx-excerpt" tabIndex={0} aria-label={`Content of ${file.path}`}>{file.content}</pre>
                <div className="sx-request-row">
                  <button type="button" className="sx-btn sx-btn-small" disabled={!file.validation.ok} onClick={() => { context.exporter.download(file.path.split("/").pop() ?? "file.txt", file.content); exported(file.path, file.content_sha256); note(key, `Downloaded. Save it as ${file.path} in your repository, then commit it.`); }}>
                    Download
                  </button>
                  <button type="button" className="sx-btn sx-btn-small" disabled={!file.validation.ok} onClick={async () => { const ok = await context.exporter.copy(file.content); if (ok) exported(file.path, file.content_sha256); note(key, ok ? `Copied. Save it as ${file.path} in your repository, then commit it.` : "Copying was blocked by the browser. Use Download."); }}>
                    Copy
                  </button>
                  {record?.state === "ARTIFACT_EXPORTED" ? (
                    <button type="button" className="sx-btn sx-btn-small sx-btn-quiet" onClick={() => void check(file.path, file.content_sha256)} data-testid="check-committed">
                      Check if it is committed
                    </button>
                  ) : null}
                </div>
                <p role="status" className="sx-faint" style={{ margin: "0.4rem 0 0" }} data-testid="artifact-note">{checks[key] ?? notes[key] ?? ""}</p>
              </section>
            );
          })}
          {load.response.instructions.map((instruction) => (
            <section key={instruction.capability} className="sx-card" style={{ marginTop: "0.6rem" }} aria-label={instruction.title} data-testid="instructions">
              <p className="sx-meta" style={{ margin: 0 }}><PlainBadge tone="partial">NOT A REPOSITORY FILE</PlainBadge></p>
              <ol className="sx-list" style={{ listStyle: "decimal" }}>{instruction.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              {instruction.snippet ? (
                <>
                  <pre className="sx-excerpt" tabIndex={0} aria-label={`${instruction.title} (${instruction.snippet_language ?? "text"})`}>{instruction.snippet}</pre>
                  <div className="sx-request-row">
                    <button type="button" className="sx-btn sx-btn-small" onClick={async () => note(instruction.capability, (await context.exporter.copy(instruction.snippet ?? "")) ? "Copied." : "Copying was blocked by the browser.")}>Copy</button>
                  </div>
                  <p role="status" className="sx-faint" data-testid="artifact-note">{notes[instruction.capability] ?? ""}</p>
                </>
              ) : null}
            </section>
          ))}
          {load.response.bundles.length === 0 && load.response.instructions.length === 0 && load.response.skipped.length === 0 ? <p className="sx-faint">Nothing was prepared.</p> : null}
          <p className="sx-faint" style={{ fontSize: "0.86rem" }}>Prepared from the committed tree at commit {load.response.head.slice(0, 8)}.</p>
        </>
      ) : null}
    </div>
  );
}
