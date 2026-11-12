/**
 * A collected fragment (Spec 3 section 8). It shows only fields of the real evidence item it stands for.
 *
 * There is no author field here and none is read: the game never shows or implies anything about a person.
 */

import type { Clue } from "../experience/clues";
import { NOT_AVAILABLE, SOURCE_TYPE_LABEL, formatLineRange } from "../../components/evidence/format";

export function EvidenceClue({ clue }: { clue: Clue }) {
  return (
    <li data-testid="clue" data-evidence-id={clue.evidenceId}>
      <strong>
        <bdi>{clue.label}</bdi>
      </strong>
      <br />
      <span className="muted">
        {SOURCE_TYPE_LABEL[clue.sourceType]}
        {clue.shortHash ? <span className="mono"> · {clue.shortHash}</span> : null}
        {" · "}
        {clue.timestamp ?? NOT_AVAILABLE}
        {clue.filePath ? (
          <>
            {" · "}
            <span className="mono">{clue.filePath}</span>
            {clue.lineRange ? <> · {formatLineRange(clue.lineRange)}</> : null}
          </>
        ) : null}
      </span>
    </li>
  );
}
