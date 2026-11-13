/**
 * Small labels used across the report. Each one states its meaning in text, so nothing depends on color alone.
 * Backend values (retrieval status, classification) are shown exactly as returned.
 */

import type { RecommendationStatus } from "../../types/advisor";

type Tone = "documented" | "inferred" | "partial" | "insufficient" | "neutral" | "danger";

const CLASSIFICATION_TONE: Record<string, Tone> = {
  DOCUMENTED: "documented",
  INFERRED: "inferred",
  PARTIAL_EVIDENCE: "partial",
  INSUFFICIENT_EVIDENCE: "insufficient",
};

export function ClassificationBadge({ value, testId }: { value: string | null; testId?: string }) {
  const tone = value ? CLASSIFICATION_TONE[value] ?? "neutral" : "neutral";
  return (
    <span className="sx-badge" data-tone={tone} data-testid={testId} title="Epistemic classification: what the evidence supports">
      {value ?? "NOT CLASSIFIED"}
    </span>
  );
}

export function RetrievalBadge({ value, testId }: { value: string; testId?: string }) {
  const tone: Tone = value === "COMPLETE" ? "documented" : value === "PARTIAL" ? "partial" : value === "FAILED" ? "danger" : "insufficient";
  return (
    <span className="sx-badge" data-tone={tone} data-testid={testId} title="Retrieval status: how complete the search was">
      {value}
    </span>
  );
}

const STATUS_TONE: Record<RecommendationStatus, Tone> = {
  ADOPT_NOW: "documented",
  CONSIDER: "inferred",
  NOT_RECOMMENDED: "neutral",
  INSUFFICIENT_EVIDENCE: "insufficient",
};

export function StatusBadge({ value }: { value: RecommendationStatus }) {
  return (
    <span className="sx-badge" data-tone={STATUS_TONE[value]} data-status={value}>
      {value.replace(/_/g, " ")}
    </span>
  );
}

export function PlainBadge({ children, tone = "neutral", title }: { children: string; tone?: Tone; title?: string }) {
  return (
    <span className="sx-badge" data-tone={tone} title={title}>
      {children}
    </span>
  );
}
