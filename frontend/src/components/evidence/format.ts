/**
 * Formatting helpers for evidence. They display what the backend returned and never create a value.
 */

import type { EvidenceItem } from "../../types/contract";

export const NOT_AVAILABLE = "Not available";

/** A source link is rendered only for an https URL. Anything else is shown as plain text (Spec 3 section 16). */
export function safeHttpsUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Show a timestamp exactly as the backend returned it (UTC, whole seconds). It is deliberately not reformatted: converting
 * to the local zone could move a date across midnight and show a day the source never recorded.
 */
export function formatTimestamp(value: string | null): string {
  return value === null || value === "" ? NOT_AVAILABLE : value;
}

export function formatLineRange(range: { start: number; end: number } | null): string {
  if (range === null) return NOT_AVAILABLE;
  return range.start === range.end ? `line ${range.start}` : `lines ${range.start}–${range.end}`;
}

export function shortHash(hash: string | null): string {
  return hash === null ? NOT_AVAILABLE : hash.slice(0, 12);
}

export const SOURCE_TYPE_LABEL: Record<EvidenceItem["source_type"], string> = {
  GIT_COMMIT: "Commit",
  GIT_BLAME: "Blame",
  CODE_HISTORY: "Code history",
  DOCUMENTATION: "Documentation",
  PULL_REQUEST: "Pull request",
  ISSUE: "Issue",
};

export const RELATIONSHIP_LABEL: Record<string, string> = {
  TOUCHES_TARGET_PATH: "Changed this file",
  CHANGES_TARGET_LINES: "Changed these lines",
  BLAMES_TARGET_LINES: "Blame for these lines",
  DOCUMENTS_TARGET_PATH: "Documents this file",
  MENTIONS_TARGET: "Mentions the target",
  SEMANTICALLY_RELATES_TO_TARGET: "Related by inference",
};

export const VERIFICATION_LABEL: Record<EvidenceItem["integrity"]["source_verification"], string> = {
  VERIFIED_IN_REPOSITORY: "Verified in the repository",
  VALIDATED_RECORD_IDENTITY: "Record identity validated",
  NOT_PERFORMED: "Verification not performed",
};

/** Sort by returned timestamp ascending for the chronological view. Items without a timestamp go last, in returned order. */
export function chronological(items: EvidenceItem[]): EvidenceItem[] {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    const ta = a.item.timestamp === null ? Number.NaN : Date.parse(a.item.timestamp);
    const tb = b.item.timestamp === null ? Number.NaN : Date.parse(b.item.timestamp);
    const aValid = !Number.isNaN(ta);
    const bValid = !Number.isNaN(tb);
    if (aValid && bValid && ta !== tb) return ta - tb;
    if (aValid !== bValid) return aValid ? -1 : 1;
    return a.index - b.index;
  });
  return indexed.map(({ item }) => item);
}
