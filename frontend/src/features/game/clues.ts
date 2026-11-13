/**
 * The clues the player collects (Spec 4 section 11.3).
 *
 * A clue is a real record of the saved report, with the classification the report gave it, or a plainly labelled
 * atmosphere item. Atmosphere items exist only so the game has enough objects to find; they carry no information about the
 * repository and say so. Nothing here is invented evidence: labels are copied from the report's findings.
 */

import { deriveFindings } from "../report/findings";
import type { ReportSnapshot } from "../report/reportSnapshot";

export type ClueClassification = "DOCUMENTED" | "INFERRED" | "PARTIAL_EVIDENCE";

export interface ClueRecord {
  id: string;
  kind: "EVIDENCE" | "ATMOSPHERE";
  /** Present only for evidence clues. */
  classification: ClueClassification | null;
  label: string;
  detail: string | null;
}

export const MIN_CLUES = 3;
export const MAX_CLUES = 5;
const MAX_LABEL = 90;

const ATMOSPHERE_LABEL = "A torn archive tag. Part of the fiction, not evidence.";

function clip(value: string): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return cleaned.length > MAX_LABEL ? `${cleaned.slice(0, MAX_LABEL)}…` : cleaned;
}

export function buildClues(snapshot: ReportSnapshot): ClueRecord[] {
  const clues: ClueRecord[] = [];
  for (const finding of deriveFindings(snapshot)) {
    if (finding.classification === "INSUFFICIENT_EVIDENCE") continue;
    for (const item of finding.evidence) {
      if (clues.length >= MAX_CLUES) break;
      const label = clip(item.label);
      if (label === "") continue;
      clues.push({ id: `${finding.id}:${clues.length}`, kind: "EVIDENCE", classification: finding.classification, label, detail: item.detail });
    }
  }
  for (let n = 0; clues.length < MIN_CLUES; n += 1) {
    clues.push({ id: `atmosphere:${n}`, kind: "ATMOSPHERE", classification: null, label: ATMOSPHERE_LABEL, detail: null });
  }
  return clues;
}
