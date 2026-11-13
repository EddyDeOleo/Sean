/**
 * The main investigation screen (Spec 4 section 4.2): one sentence, one primary action, and the repository it applies to.
 *
 * The structured fields (file, symbol, lines) stay available under "Advanced target" for people who want exact control.
 * Nothing is sent until the form is valid. A request that needs a decision (which file, which definition) shows the choices
 * the backend and the committed tree actually offer; Sean never picks for the user.
 */

import { useId, useState } from "react";
import type { RepositoryListItem } from "../../types/advisor";
import type { InvestigationRequest } from "../../types/contract";
import { EMPTY_FORM, buildRequest, hasErrors, validateForm, type FieldName, type FormErrors, type FormValues } from "../../features/investigation/formModel";

export interface RequestScreenProps {
  repositories: RepositoryListItem[] | null;
  repositoriesProblem: string | null;
  selectedRepository: string;
  onSelectRepository(id: string): void;
  onSubmitText(text: string, allowAi: boolean): void;
  /** Whether the backend can use an AI provider to read a request. Without it there is nothing to consent to. */
  aiAvailable: boolean;
  onSubmitStructured(request: InvestigationRequest): void;
  /** Files offered when the request did not name one. */
  candidates: string[];
  onChooseCandidate(path: string): void;
  /** Definitions offered when a symbol was ambiguous. */
  symbolCandidates: string[];
  onChooseSymbol(symbol: string): void;
  notice?: React.ReactNode;
  initialText?: string;
}

const EXAMPLES = [
  "Analyze this repository and identify opportunities to improve its engineering workflow with Kiro.",
  "Which Kiro capabilities would help this repository?",
  "Why was the caching layer introduced?",
];

export function RequestScreen(props: RequestScreenProps) {
  const { repositories, selectedRepository } = props;
  const ids = { text: useId(), repo: useId(), ai: useId() };
  const [allowAi, setAllowAi] = useState(false);
  const [text, setText] = useState(props.initialText ?? "");
  const [error, setError] = useState<string | null>(null);
  const available = (repositories ?? []).filter((r) => r.available);

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const trimmed = text.trim();
    if (trimmed === "") {
      setError("Describe what you want to investigate.");
      return;
    }
    setError(null);
    props.onSubmitText(trimmed, props.aiAvailable && allowAi);
    // Consent is for this request only.
    setAllowAi(false);
  }

  function fillExample(example: string) {
    setText(selectedRepository ? `${selectedRepository} — ${example}` : example);
    setError(null);
  }

  return (
    <div className="sx-page">
      <h1 className="sx-h1">What would you like to understand?</h1>
      <p className="sx-lede">
        Ask about a repository's history, or ask how its engineering workflow could improve with Kiro. Sean reads the committed repository, shows its evidence, and keeps what it found apart from what it infers.
      </p>

      {props.notice}

      <div className="sx-request">
      <form onSubmit={submit} aria-label="New investigation" noValidate>
        <label className="sx-label" htmlFor={ids.text}>Your request</label>
        <textarea
          id={ids.text}
          className="sx-textarea"
          rows={3}
          value={text}
          maxLength={2000}
          placeholder="sean — Why does backend/app/main.py exist?"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) submit();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${ids.text}-error` : undefined}
        />
        {error ? <p className="sx-field-error" id={`${ids.text}-error`} role="alert">{error}</p> : null}
        <div className="sx-request-row">
          <label className="sx-label" htmlFor={ids.repo} style={{ margin: 0 }}>Repository</label>
          <select id={ids.repo} className="sx-select" value={selectedRepository} onChange={(event) => props.onSelectRepository(event.target.value)} disabled={repositories === null || available.length === 0}>
            <option value="">{repositories === null ? "Loading…" : available.length === 0 ? "None available" : "Choose in the request"}</option>
            {available.map((r) => (
              <option key={r.repository_id} value={r.repository_id}>{r.repository_id}</option>
            ))}
          </select>
          <span className="sx-spacer" />
          <button type="submit" className="sx-btn sx-btn-primary">Investigate</button>
        </div>
        {props.aiAvailable ? (
          <div style={{ marginTop: "0.75rem" }}>
            <label htmlFor={ids.ai} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <input id={ids.ai} type="checkbox" checked={allowAi} onChange={(event) => setAllowAi(event.target.checked)} data-testid="allow-ai" style={{ marginTop: "0.3rem" }} />
              <span>Let Gemini help read this request</span>
            </label>
            <p className="sx-faint" style={{ margin: "0.2rem 0 0 1.5rem", fontSize: "0.86rem" }} data-testid="ai-disclosure">
              Only used if Sean cannot tell which file you mean. It sends the sentence you typed, and nothing from the repository, to Google. On the free tier Google may keep it. This applies to this request only.
            </p>
          </div>
        ) : null}
        {props.repositoriesProblem ? <p className="sx-field-error" role="alert" data-testid="repositories-problem">{props.repositoriesProblem}</p> : null}
        {repositories !== null && repositories.length === 0 ? (
          <p className="sx-faint" style={{ marginBottom: 0 }} data-testid="no-repositories">
            No repositories are registered with the backend. Add one to the registry file and restart the backend.
          </p>
        ) : null}

      </form>

        <AdvancedTarget repositories={available} selectedRepository={selectedRepository} onSubmit={props.onSubmitStructured} />
      </div>

      {props.candidates.length > 0 ? (
        <div className="sx-notice" role="group" aria-label="Choose a file" data-testid="file-candidates" style={{ marginTop: "1rem" }}>
          <h3>Which file is this about?</h3>
          <p>Sean found these files by name. Choose one to continue. Sean does not guess.</p>
          <div className="sx-examples">
            {props.candidates.map((path) => (
              <button key={path} type="button" className="sx-chip sx-mono" onClick={() => props.onChooseCandidate(path)}>{path}</button>
            ))}
          </div>
        </div>
      ) : null}

      {props.symbolCandidates.length > 0 ? (
        <div className="sx-notice" data-tone="warn" role="group" aria-label="Choose one definition" data-testid="symbol-candidates" style={{ marginTop: "1rem" }}>
          <h3>More than one definition matches</h3>
          <p>Choose one, and Sean will ask again. It does not pick for you.</p>
          <div className="sx-examples">
            {props.symbolCandidates.map((symbol) => (
              <button key={symbol} type="button" className="sx-chip sx-mono" onClick={() => props.onChooseSymbol(symbol)}>{symbol}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sx-examples" aria-label="Example requests">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="sx-chip" onClick={() => fillExample(example)}>{example}</button>
        ))}
      </div>
    </div>
  );
}

function AdvancedTarget({ repositories, selectedRepository, onSubmit }: { repositories: RepositoryListItem[]; selectedRepository: string; onSubmit(request: InvestigationRequest): void }) {
  const prefix = useId();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const repository = values.repositoryId || selectedRepository;

  function change(name: FieldName, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  }
  function run() {
    const merged = { ...values, repositoryId: repository };
    const found = validateForm(merged);
    setErrors(found);
    if (!hasErrors(found)) onSubmit(buildRequest(merged));
  }
  const field = (name: FieldName, label: string, placeholder?: string) => (
    <div>
      <label className="sx-label" htmlFor={`${prefix}-${name}`}>{label}</label>
      <input
        id={`${prefix}-${name}`}
        className="sx-input"
        value={name === "repositoryId" ? repository : values[name]}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined}
        onChange={(event) => change(name, event.target.value)}
      />
      {errors[name] ? <p className="sx-field-error" id={`${prefix}-${name}-error`} role="alert">{errors[name]}</p> : null}
    </div>
  );
  return (
    <details className="sx-advanced">
      <summary>Advanced target</summary>
      <p className="sx-faint" style={{ margin: "0.6rem 0" }}>Name the exact file, and optionally a symbol or line range. This skips the sentence above.</p>
      <div className="sx-grid-2">
        {field("repositoryId", "Repository", repositories[0]?.repository_id ?? "sample")}
        {field("path", "File path", "src/billing.py")}
        {field("symbol", "Symbol (optional)", "charge")}
        <div className="sx-grid-2">
          {field("lineStart", "From line")}
          {field("lineEnd", "To line")}
        </div>
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <label className="sx-label" htmlFor={`${prefix}-question`}>Question</label>
        <textarea
          id={`${prefix}-question`}
          className="sx-textarea"
          rows={2}
          value={values.question}
          aria-invalid={errors.question ? true : undefined}
          onChange={(event) => change("question", event.target.value)}
        />
        {errors.question ? <p className="sx-field-error" role="alert">{errors.question}</p> : null}
      </div>
      <div className="sx-request-row">
        <button type="button" className="sx-btn" onClick={run}>Investigate this target</button>
      </div>
    </details>
  );
}
