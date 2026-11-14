/**
 * The Repositories page: see, add, edit, select and remove the repositories Sean may read.
 *
 * Registering a repository only records its name, identifier and folder in Sean's own registry. It never changes the
 * repository. Removing one only removes that record, and never touches the folder. The backend validates every field again,
 * so the checks here are for fast, specific feedback and are never the only protection.
 */

import { useEffect, useId, useRef, useState } from "react";
import type { RepositoryListItem } from "../../types/advisor";
import type { EditableRepository, RepositoryInput } from "../../services/advisorClient";
import { PlainBadge } from "../report/badges";

export type RepositoryField = "repository_id" | "display_name" | "path";
export type RepositoryResult = { ok: true } | { ok: false; code: string; message: string; field: RepositoryField | null };

export interface RepositoryActions {
  create(input: RepositoryInput): Promise<RepositoryResult>;
  update(id: string, body: EditableRepository): Promise<RepositoryResult>;
  remove(id: string): Promise<RepositoryResult>;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_NAME = 80;
const WINDOWS_PATH = /^[A-Za-z]:[\\/]/;

/** An identifier suggested from a name: lower case letters, digits, dashes and underscores. */
export function suggestIdentifier(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^[^a-z0-9]+/, "").replace(/-+/g, "-").replace(/-$/, "");
  return slug.slice(0, 64).replace(/[-_]+$/, "");
}

/** A path pasted from Explorer ("Copy as path") has quotes around it. Remove them. */
export function cleanPath(value: string): string {
  return value.trim().replace(/^"(.*)"$/, "$1").trim();
}

interface Draft {
  display_name: string;
  repository_id: string;
  path: string;
}
type Errors = Partial<Record<RepositoryField | "form", string>>;

export function validateDraft(draft: Draft, editing: boolean): Errors {
  const errors: Errors = {};
  const name = draft.display_name.trim();
  if (name === "") errors.display_name = "Give the repository a name you will recognise.";
  else if (name.length > MAX_NAME) errors.display_name = `Use at most ${MAX_NAME} characters.`;
  // eslint-disable-next-line no-control-regex
  else if (/[\u0000-\u001f\u007f]/.test(name)) errors.display_name = "Remove the control characters from the name.";
  if (!editing) {
    if (draft.repository_id === "") errors.repository_id = "Enter an identifier.";
    else if (!ID_PATTERN.test(draft.repository_id)) {
      errors.repository_id = "Use lower case letters, digits, dashes and underscores, starting with a letter or digit (at most 64 characters).";
    }
  }
  const path = cleanPath(draft.path);
  if (path === "") errors.path = "Enter the folder of the repository.";
  else if (!WINDOWS_PATH.test(path)) errors.path = "Enter the full path, starting with a drive letter, for example C:\\Users\\you\\source\\repos\\project.";
  return errors;
}

interface FormProps {
  mode: "add" | "edit";
  initial: Draft;
  busy: boolean;
  formError: string | null;
  serverErrors: Errors;
  onSubmit(draft: Draft): void;
  onCancel(): void;
}

function RepositoryForm({ mode, initial, busy, formError, serverErrors, onSubmit, onCancel }: FormProps) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [identifierTouched, setIdentifierTouched] = useState(mode === "edit");
  const [tried, setTried] = useState(false);
  const base = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);
  const local = tried ? validateDraft(draft, mode === "edit") : {};
  const errors: Errors = { ...serverErrors, ...local };
  const field = (key: RepositoryField): { id: string; "aria-invalid": boolean; "aria-describedby": string } => ({
    id: `${base}-${key}`,
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": `${base}-${key}-hint ${errors[key] ? `${base}-${key}-error` : ""}`.trim(),
  });
  const error = (key: RepositoryField) =>
    errors[key] ? <p className="sx-field-error" id={`${base}-${key}-error`} role="alert" data-testid={`error-${key}`}>{errors[key]}</p> : null;

  return (
    <form
      className="sx-card"
      aria-label={mode === "add" ? "Add a repository" : "Edit repository"}
      data-testid={mode === "add" ? "repository-form" : "repository-edit-form"}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setTried(true);
        if (Object.keys(validateDraft(draft, mode === "edit")).length > 0) return;
        onSubmit({ ...draft, display_name: draft.display_name.trim(), path: cleanPath(draft.path) });
      }}
    >
      <h2 className="sx-h2" style={{ marginTop: 0 }}>{mode === "add" ? "Add a repository" : `Edit ${initial.repository_id}`}</h2>
      <div className="sx-form-grid">
        <div>
          <label className="sx-field-label" htmlFor={`${base}-display_name`}>Name</label>
          <input
            {...field("display_name")}
            ref={nameRef}
            className="sx-input"
            value={draft.display_name}
            maxLength={MAX_NAME + 20}
            autoComplete="off"
            onChange={(event) => {
              const display_name = event.target.value;
              setDraft((d) => ({ ...d, display_name, repository_id: identifierTouched ? d.repository_id : suggestIdentifier(display_name) }));
            }}
            data-testid="field-display-name"
          />
          <p className="sx-field-hint" id={`${base}-display_name-hint`}>The name shown in Sean. It can be changed later.</p>
          {error("display_name")}
        </div>
        <div>
          <label className="sx-field-label" htmlFor={`${base}-repository_id`}>Identifier</label>
          <input
            {...field("repository_id")}
            className="sx-input sx-mono"
            value={draft.repository_id}
            readOnly={mode === "edit"}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setIdentifierTouched(true);
              setDraft((d) => ({ ...d, repository_id: event.target.value }));
            }}
            data-testid="field-repository-id"
          />
          <p className="sx-field-hint" id={`${base}-repository_id-hint`}>
            {mode === "edit"
              ? "The identifier cannot change, because saved reports refer to it."
              : "A short unique name for typing in requests, such as billing-api. Suggested from the name."}
          </p>
          {error("repository_id")}
        </div>
        <div>
          <label className="sx-field-label" htmlFor={`${base}-path`}>Folder on this computer</label>
          <input
            {...field("path")}
            className="sx-input sx-mono"
            value={draft.path}
            autoComplete="off"
            spellCheck={false}
            placeholder="C:\Users\you\source\repos\project"
            onChange={(event) => setDraft((d) => ({ ...d, path: event.target.value }))}
            data-testid="field-path"
          />
          <p className="sx-field-hint" id={`${base}-path-hint`}>
            The folder that contains the repository&rsquo;s <span className="sx-mono">.git</span>. In File Explorer, hold Shift, right-click the folder and choose
            &ldquo;Copy as path&rdquo;, then paste it here. Sean reads only its committed history and never changes it.
          </p>
          {error("path")}
        </div>
        {formError ? <p className="sx-field-error" role="alert" data-testid="repository-form-error">{formError}</p> : null}
        <div className="sx-request-row" style={{ marginTop: 0 }}>
          <button type="submit" className="sx-btn sx-btn-primary" disabled={busy} data-testid="repository-submit">
            {busy ? "Checking…" : mode === "add" ? "Add repository" : "Save changes"}
          </button>
          <button type="button" className="sx-btn sx-btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </form>
  );
}

export interface RepositoriesViewProps {
  repositories: RepositoryListItem[] | null;
  problem: string | null;
  selectedId: string;
  onUse(id: string): void;
  actions: RepositoryActions;
}

type Mode = { kind: "idle" } | { kind: "add" } | { kind: "edit"; id: string } | { kind: "remove"; id: string };

export function RepositoriesView({ repositories, problem, selectedId, onUse, actions }: RepositoriesViewProps) {
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [serverErrors, setServerErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  /** Where keyboard focus goes after a form or a confirmation closes, so it is never left on nothing. */
  const [focusAfter, setFocusAfter] = useState<string | null>(null);
  useEffect(() => {
    if (focusAfter === null) return;
    const target = focusAfter === "add" ? addButton.current : document.querySelector<HTMLElement>(`[data-repository-id="${focusAfter}"] button`);
    (target ?? addButton.current)?.focus();
    setFocusAfter(null);
  }, [focusAfter, mode]);
  useEffect(() => {
    if (mode.kind === "remove") keepButton.current?.focus();
  }, [mode]);

  const close = (): void => {
    setMode({ kind: "idle" });
    setServerErrors({});
    setFormError(null);
  };

  async function run(task: () => Promise<RepositoryResult>, done: string): Promise<void> {
    setBusy(true);
    setServerErrors({});
    setFormError(null);
    const result = await task();
    setBusy(false);
    if (result.ok) {
      const next = mode.kind === "edit" || mode.kind === "remove" ? (mode.kind === "edit" ? mode.id : "add") : "add";
      close();
      setStatus(done);
      setFocusAfter(next);
      return;
    }
    if (result.field) setServerErrors({ [result.field]: result.message });
    else setFormError(result.message);
  }

  const editing = mode.kind === "edit" ? repositories?.find((r) => r.repository_id === mode.id) ?? null : null;

  return (
    <div className="sx-page" data-testid="repositories">
      <h1 className="sx-h1">Repositories</h1>
      <p className="sx-lede">
        These are the repositories Sean may read, and only their committed history. Adding, editing or removing one changes only this list. Sean never changes a repository or its folder.
      </p>
      <div role="status" aria-live="polite" className="sx-faint" data-testid="repositories-status" style={{ minHeight: "1.4em" }}>{status}</div>
      {problem ? <div className="sx-notice" data-tone="danger" role="alert"><h3>The list could not be loaded</h3><p>{problem}</p></div> : null}

      {mode.kind === "add" ? (
        <RepositoryForm
          mode="add"
          initial={{ display_name: "", repository_id: "", path: "" }}
          busy={busy}
          formError={formError}
          serverErrors={serverErrors}
          onCancel={() => {
            close();
            setFocusAfter("add");
          }}
          onSubmit={(draft) => void run(() => actions.create({ repository_id: draft.repository_id, display_name: draft.display_name, path: draft.path }), `Added ${draft.display_name}. You can use it for an investigation now.`)}
        />
      ) : (
        <p>
          <button type="button" className="sx-btn sx-btn-primary" ref={addButton} onClick={() => { setStatus(""); setMode({ kind: "add" }); }} data-testid="add-repository">
            Add repository
          </button>
        </p>
      )}

      {repositories === null && !problem ? <p className="sx-muted">Loading…</p> : null}
      {repositories !== null && repositories.length === 0 ? (
        <div className="sx-empty" data-testid="no-repositories">No repositories are registered yet. Choose &ldquo;Add repository&rdquo; to register the first one.</div>
      ) : null}

      {repositories !== null && repositories.length > 0 ? (
        <ul className="sx-repo-list" aria-label="Registered repositories">
          {repositories.map((r) => {
            const selected = r.repository_id === selectedId;
            if (editing && editing.repository_id === r.repository_id) {
              return (
                <li key={r.repository_id}>
                  <RepositoryForm
                    mode="edit"
                    initial={{ display_name: r.display_name, repository_id: r.repository_id, path: r.path }}
                    busy={busy}
                    formError={formError}
                    serverErrors={serverErrors}
                    onCancel={() => { close(); setFocusAfter(r.repository_id); }}
                    onSubmit={(draft) => void run(() => actions.update(r.repository_id, { display_name: draft.display_name, path: draft.path }), `Saved ${draft.display_name}.`)}
                  />
                </li>
              );
            }
            const removing = mode.kind === "remove" && mode.id === r.repository_id;
            return (
              <li key={r.repository_id} className="sx-repo" data-testid="repository-row" data-repository-id={r.repository_id} data-selected={selected}>
                <div className="sx-repo-head">
                  <h2 className="sx-repo-name"><bdi>{r.display_name}</bdi></h2>
                  <span className="sx-mono sx-faint">{r.repository_id}</span>
                  {r.available ? <PlainBadge tone="documented">AVAILABLE</PlainBadge> : <PlainBadge tone="danger">UNAVAILABLE</PlainBadge>}
                  {selected ? <PlainBadge tone="inferred">SELECTED</PlainBadge> : null}
                  {r.github ? <span className="sx-mono sx-faint">{r.github.owner}/{r.github.name}</span> : null}
                </div>
                <p className="sx-repo-path sx-mono" data-testid="repository-path"><bdi>{r.path}</bdi></p>
                {!r.available ? <p className="sx-field-hint">Sean cannot read this folder now. It may have moved. Edit the folder, or remove the registration.</p> : null}
                {removing ? (
                  <div className="sx-confirm" role="alertdialog" aria-label={`Remove ${r.display_name}`} data-testid="remove-confirm">
                    <p style={{ marginTop: 0 }}>
                      Remove <strong><bdi>{r.display_name}</bdi></strong> from Sean? Only its registration is removed. The folder, its files and its history are not touched, and reports already saved stay saved.
                    </p>
                    {formError ? <p className="sx-field-error" role="alert">{formError}</p> : null}
                    <div className="sx-request-row" style={{ marginTop: 0 }}>
                      <button type="button" className="sx-btn sx-btn-danger" disabled={busy} data-testid="confirm-remove"
                        onClick={() => void run(() => actions.remove(r.repository_id), `Removed ${r.display_name} from Sean. Its folder was not touched.`)}>
                        {busy ? "Removing…" : "Remove from Sean"}
                      </button>
                      <button type="button" className="sx-btn sx-btn-quiet" disabled={busy} onClick={() => { const id = mode.kind === "remove" ? mode.id : "add"; close(); setFocusAfter(id); }} ref={keepButton} data-testid="keep-repository">Keep it</button>
                    </div>
                  </div>
                ) : (
                  <div className="sx-repo-actions">
                    <button type="button" className="sx-btn sx-btn-small" disabled={!r.available} onClick={() => onUse(r.repository_id)} aria-label={`Use ${r.display_name} for an investigation`} data-testid="use-repository">Use</button>
                    <button type="button" className="sx-btn sx-btn-small sx-btn-quiet" onClick={() => { setStatus(""); setServerErrors({}); setFormError(null); setMode({ kind: "edit", id: r.repository_id }); }} aria-label={`Edit ${r.display_name}`} data-testid="edit-repository">Edit</button>
                    <button type="button" className="sx-btn sx-btn-small sx-btn-quiet sx-btn-danger" onClick={() => { setStatus(""); setFormError(null); setMode({ kind: "remove", id: r.repository_id }); }} aria-label={`Remove ${r.display_name}`} data-testid="remove-repository">Remove</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
