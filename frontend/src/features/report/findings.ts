/**
 * Technical findings (Spec 4 section 8.3).
 *
 * A finding restates something that was observed, with the classification, the supporting evidence and the limits. It never
 * adds a claim: every sentence comes from the backend (the investigation conclusion or an observation's explanation), and
 * every supporting item is an evidence record or an observation of the snapshot. If the profile scan was incomplete, its
 * findings are PARTIAL_EVIDENCE, not stronger.
 */

import type { Observation } from "../../types/advisor";
import type { ReportSnapshot } from "./reportSnapshot";
import { formatTimestamp, shortHash } from "../../components/evidence/format";

export type FindingClassification = "DOCUMENTED" | "INFERRED" | "PARTIAL_EVIDENCE" | "INSUFFICIENT_EVIDENCE";

export interface Finding {
  id: string;
  title: string;
  explanation: string;
  classification: FindingClassification;
  evidence: { label: string; detail: string | null }[];
  limitations: string[];
}

const MAX_EVIDENCE_LINES = 5;

function profileClassification(base: "DOCUMENTED" | "INFERRED", incomplete: boolean): FindingClassification {
  return incomplete ? "PARTIAL_EVIDENCE" : base;
}

function observationEvidence(items: Observation[]): Finding["evidence"] {
  return items.slice(0, MAX_EVIDENCE_LINES).map((o) => ({
    label: o.path ?? o.value ?? o.kind,
    detail: o.count !== null ? `${o.count}` : null,
  }));
}

export function deriveFindings(snapshot: ReportSnapshot): Finding[] {
  const findings: Finding[] = [];

  const result = snapshot.investigation;
  if (result && result.epistemic_classification !== null) {
    const insufficient = result.epistemic_classification === "INSUFFICIENT_EVIDENCE";
    findings.push({
      id: `investigation-${result.investigation_id}`,
      title: `History of ${result.target.path}${result.target.symbol ? ` (${result.target.symbol})` : ""}`,
      explanation: insufficient
        ? "No conclusion. The available evidence does not support a reliable historical conclusion."
        : result.conclusion ?? "The backend returned no conclusion.",
      classification: result.epistemic_classification,
      evidence: result.evidence.slice(0, MAX_EVIDENCE_LINES).map((e) => ({
        label: e.title && e.title.trim() !== "" ? e.title : e.file_path ?? e.source_id,
        detail: [shortHash(e.commit_hash), formatTimestamp(e.timestamp)].filter((x) => x !== "Not available").join(" · ") || null,
      })),
      limitations: result.limitations.map((l) => l.message),
    });
  }

  const analysis = snapshot.analysis;
  if (analysis) {
    const { profile } = analysis;
    const incomplete = profile.truncated || profile.shallow || profile.limitations.some((l) => ["MANIFEST_NOT_READ", "UNREADABLE_PATHS_SKIPPED", "HISTORY_UNREADABLE", "OBSERVATIONS_CAPPED"].includes(l.code));
    const basis = `Read from the committed tree at ${profile.head.slice(0, 8)}. Uncommitted files are not seen.`;
    const incompleteNote = incomplete ? ["The scan was incomplete, so this finding may be missing related items."] : [];

    const recurrence = profile.observations.filter((o) => o.kind === "FIX_RECURRENCE");
    for (const o of recurrence.slice(0, 3)) {
      findings.push({
        id: o.observation_id,
        title: `Recurring fix-labelled changes in ${o.path ?? "a file"}`,
        explanation: o.explanation,
        classification: profileClassification("INFERRED", incomplete),
        evidence: observationEvidence([o]),
        limitations: ["Commit subjects label changes. They do not prove why a change was made.", basis, ...incompleteNote],
      });
    }

    const sensitive = profile.observations.filter((o) => o.kind === "SENSITIVE_PATH");
    if (sensitive.length > 0) {
      findings.push({
        id: "sensitive-paths",
        title: `${sensitive.length} committed path${sensitive.length === 1 ? "" : "s"} with a secret-bearing name`,
        explanation: "Only the file names were read, never their contents. Whether they hold real secrets was not checked.",
        classification: profileClassification("DOCUMENTED", incomplete),
        evidence: observationEvidence(sensitive),
        limitations: [basis, ...incompleteNote],
      });
    }

    const generated = profile.observations.filter((o) => o.kind === "GENERATED_TRACKED");
    if (generated.length > 0) {
      findings.push({
        id: "generated-tracked",
        title: "Generated or installed files are committed",
        explanation: generated.map((o) => o.explanation).join(" "),
        classification: profileClassification("DOCUMENTED", incomplete),
        evidence: observationEvidence(generated),
        limitations: [basis, ...incompleteNote],
      });
    }

    const { source_files: sources, test_files: tests } = profile.summary;
    if (sources + tests > 0) {
      findings.push({
        id: "test-layout",
        title: "Source and test layout",
        explanation: `${sources} source file${sources === 1 ? "" : "s"} and ${tests} test file${tests === 1 ? "" : "s"} are committed. File counts do not measure test coverage.`,
        classification: profileClassification("DOCUMENTED", incomplete),
        evidence: profile.summary.areas.slice(0, MAX_EVIDENCE_LINES).map((a) => ({ label: a.name, detail: `${a.source_files} source, ${a.test_files} test` })),
        limitations: [basis, ...incompleteNote],
      });
    }

    const kiro = profile.observations.filter((o) => o.kind === "KIRO_CONFIG");
    if (kiro.length > 0) {
      findings.push({
        id: "kiro-configuration",
        title: "Kiro configuration is already present",
        explanation: kiro.map((o) => o.explanation).join(" "),
        classification: profileClassification("DOCUMENTED", incomplete),
        evidence: observationEvidence(kiro),
        limitations: [basis, ...incompleteNote],
      });
    }
  }
  return findings;
}
