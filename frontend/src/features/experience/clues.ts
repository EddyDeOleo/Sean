/**
 * Escape-game fragments built from real evidence (Spec 3 section 8).
 *
 * A fragment names one evidence item of the validated result and carries a subset of that item's own fields. It is built
 * from the first MAX_FRAGMENTS items in returned order. Nothing here creates a value: a missing field stays missing.
 * There is deliberately no author field, so the game cannot show or imply anything about a person.
 */

import { MAX_FRAGMENTS } from "../escape/escapeEngine";
import type { EvidenceItem, InvestigationResult } from "../../types/contract";

export interface Clue {
  evidenceId: string;
  sourceType: EvidenceItem["source_type"];
  /** The item's own title, or its file path, or its source type and identifier. Never invented. */
  label: string;
  filePath: string | null;
  lineRange: { start: number; end: number } | null;
  timestamp: string | null;
  /** Abbreviated commit hash for display, taken from the item's own commit_hash. */
  shortHash: string | null;
}

function labelFor(item: EvidenceItem): string {
  if (item.title && item.title.trim() !== "") return item.title;
  if (item.file_path) return item.file_path;
  return `${item.source_type} ${item.source_id}`;
}

export function buildClues(result: InvestigationResult): Clue[] {
  return result.evidence.slice(0, MAX_FRAGMENTS).map((item) => ({
    evidenceId: item.evidence_id,
    sourceType: item.source_type,
    label: labelFor(item),
    filePath: item.file_path,
    lineRange: item.line_range,
    timestamp: item.timestamp,
    shortHash: item.commit_hash ? item.commit_hash.slice(0, 8) : null,
  }));
}
