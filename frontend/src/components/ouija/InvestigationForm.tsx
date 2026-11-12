/**
 * Investigation setup (Spec 3 section 5, Scene A).
 *
 * The user types a registered repository ID, a repository-relative path, an optional symbol and line range, and a question.
 * No repository list is offered, because the backend has no listing endpoint. Client-side checks give early feedback, and
 * the backend remains authoritative: a backend `field` error is shown at the matching input.
 */

import { useEffect, useId, useState, type FormEvent } from "react";
import {
  EMPTY_FORM,
  MAX_QUESTION_LENGTH,
  buildRequest,
  fieldForBackendField,
  hasErrors,
  validateForm,
  type FieldName,
  type FormErrors,
  type FormValues,
} from "../../features/investigation/formModel";
import type { InvestigationRequest } from "../../types/contract";

export interface InvestigationFormProps {
  onSubmit(request: InvestigationRequest): void;
  /** True while a request is running. The submit control is disabled so a second submission cannot happen. */
  busy: boolean;
  initial?: Partial<FormValues>;
  /** A `field` name from a backend error (for example "target.path"), and its message. */
  backendField?: { field: string | null; message: string } | null;
  /** Ambiguity candidates from the backend. Choosing one fills the symbol field. */
  candidates?: string[];
}

export function InvestigationForm({ onSubmit, busy, initial, backendField, candidates = [] }: InvestigationFormProps) {
  const [values, setValues] = useState<FormValues>({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const base = useId();
  const id = (name: string): string => `${base}-${name}`;

  // A restored or edited request refills the form.
  useEffect(() => {
    if (initial) setValues((current) => ({ ...current, ...initial }));
  }, [initial]);

  const backendMapped = backendField ? fieldForBackendField(backendField.field) : null;

  function change(name: FieldName, value: string): void {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (submitted) setErrors(validateForm(next));
      return next;
    });
  }

  function handleSubmit(event: FormEvent): void {
    event.preventDefault();
    if (busy) return;
    const found = validateForm(values);
    setSubmitted(true);
    setErrors(found);
    if (hasErrors(found)) return;
    onSubmit(buildRequest(values));
  }

  function errorFor(name: FieldName): string | undefined {
    return errors[name] ?? (backendMapped === name ? backendField?.message : undefined);
  }

  function input(name: FieldName, label: string, props: { placeholder?: string; inputMode?: "numeric"; hint?: string; autoComplete?: string }) {
    const message = errorFor(name);
    const describedBy = [props.hint ? id(`${name}-hint`) : null, message ? id(`${name}-error`) : null].filter(Boolean).join(" ") || undefined;
    return (
      <div className="field">
        <label htmlFor={id(name)}>{label}</label>
        <input
          id={id(name)}
          className="input"
          type="text"
          value={values[name]}
          onChange={(event) => change(name, event.target.value)}
          placeholder={props.placeholder}
          inputMode={props.inputMode}
          autoComplete={props.autoComplete ?? "off"}
          spellCheck={false}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          disabled={busy}
        />
        {props.hint ? (
          <span id={id(`${name}-hint`)} className="muted" style={{ fontSize: "0.82rem" }}>
            {props.hint}
          </span>
        ) : null}
        {message ? (
          <p id={id(`${name}-error`)} className="field-error" role="alert">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  const questionMessage = errorFor("question");

  return (
    <form className="form-grid" onSubmit={handleSubmit} noValidate aria-label="Investigation request">
      <div className="row cols-two">
        {input("repositoryId", "Repository", { placeholder: "sample", hint: "The identifier of a repository registered with the backend." })}
        {input("path", "File path", { placeholder: "src/billing.py", hint: "Relative to the repository root." })}
      </div>
      <div className="row cols-two">
        {input("symbol", "Symbol (optional)", { placeholder: "charge", hint: "A function, class, or method such as Billing.charge." })}
        <div className="row cols-two">
          {input("lineStart", "From line", { inputMode: "numeric", placeholder: "1" })}
          {input("lineEnd", "To line", { inputMode: "numeric", placeholder: "40" })}
        </div>
      </div>

      {candidates.length > 0 ? (
        <div className="notice notice-warn" role="group" aria-label="Choose one definition">
          <h3>More than one definition matches</h3>
          <p style={{ margin: "0.2rem 0 0.5rem" }}>Choose one, then ask again. Sean does not pick for you.</p>
          <div className="button-row">
            {candidates.map((candidate) => (
              <button
                key={candidate}
                type="button"
                className="btn btn-small"
                onClick={() => change("symbol", candidate)}
                aria-pressed={values.symbol === candidate}
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor={id("question")}>Your question</label>
        <textarea
          id={id("question")}
          className="input"
          rows={3}
          value={values.question}
          onChange={(event) => change("question", event.target.value)}
          placeholder="Why does this function validate its amount?"
          maxLength={MAX_QUESTION_LENGTH + 50}
          aria-invalid={questionMessage ? true : undefined}
          aria-describedby={questionMessage ? id("question-error") : undefined}
          disabled={busy}
        />
        {questionMessage ? (
          <p id={id("question-error")} className="field-error" role="alert">
            {questionMessage}
          </p>
        ) : null}
      </div>

      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Summoningâ€¦" : "Summon"}
        </button>
      </div>
    </form>
  );
}
