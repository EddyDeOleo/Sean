/**
 * Honest error states (Spec 3 section 13). Each kind has its own heading and its own wording, and none of them describes a
 * failure as missing evidence.
 */

import type { ExperienceError } from "../../features/experience/experienceMachine";

export interface ErrorPanelProps {
  error: ExperienceError;
  onRetry(): void;
}

export function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  switch (error.kind) {
    case "RETRIEVAL_FAILED":
      return (
        <section className="notice notice-danger" role="alert" aria-label="Retrieval failed">
          <h3>Retrieval failed</h3>
          <p style={{ margin: "0.2rem 0" }}>
            Sean could not complete the retrieval for this request. This says nothing about whether evidence exists. The cause
            is shown below as the backend reported it.
          </p>
          <p className="mono" style={{ margin: "0.2rem 0" }}>
            {error.code}: {error.message}
          </p>
          <p className="muted" style={{ margin: "0.2rem 0" }}>
            {error.retryable ? "The backend marks this failure as retryable." : "The backend does not mark this failure as retryable."}
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={onRetry}>
              Edit the request
            </button>
          </div>
        </section>
      );
    case "INVALID_RESPONSE":
      return (
        <section className="notice notice-danger" role="alert" aria-label="Result could not be validated">
          <h3>The result could not be validated</h3>
          <p style={{ margin: "0.2rem 0" }}>The result could not be validated. No conclusion is shown.</p>
          <p className="muted" style={{ margin: "0.2rem 0" }}>
            Diagnostic: <span className="mono">{error.reason}</span>
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={onRetry}>
              Edit the request
            </button>
          </div>
        </section>
      );
    case "REQUEST_REJECTED":
      return (
        <section className="notice notice-warn" role="alert" aria-label="Request not accepted">
          <h3>Request not accepted</h3>
          <p style={{ margin: "0.2rem 0" }}>{error.backend.message}</p>
          <p className="muted mono" style={{ margin: "0.2rem 0" }}>
            {error.backend.code} (HTTP {error.status})
          </p>
          <p className="muted" style={{ margin: "0.2rem 0" }}>
            No investigation ran, so there is no retrieval status. Change the request and ask again.
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={onRetry}>
              Edit the request
            </button>
          </div>
        </section>
      );
    case "BACKEND_INTERNAL":
      return (
        <section className="notice notice-danger" role="alert" aria-label="Backend internal error">
          <h3>The backend reported an internal error</h3>
          <p style={{ margin: "0.2rem 0" }}>{error.backend.message}</p>
          <p className="muted mono" style={{ margin: "0.2rem 0" }}>
            {error.backend.code} (HTTP {error.status})
          </p>
          <p className="muted" style={{ margin: "0.2rem 0" }}>No result is available for this request.</p>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={onRetry}>
              Try again
            </button>
          </div>
        </section>
      );
    case "NETWORK":
      return (
        <section className="notice notice-danger" role="alert" aria-label="Network failure">
          <h3>Could not reach the backend</h3>
          <p style={{ margin: "0.2rem 0" }}>
            The request did not complete. Check that the Sean backend is running. This is a connection problem. It says nothing
            about the repository or its history.
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-small" onClick={onRetry}>
              Try again
            </button>
          </div>
        </section>
      );
  }
}
