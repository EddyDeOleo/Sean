/**
 * The two-zone layout (Spec 2 section 4.1, requirement 1).
 *
 * Exactly two primary zones: Evidence & History (left) and the Ouija board (right). The left zone comes first in the DOM, so
 * the narrow, stacked order is evidence first and then the board. The header and settings are not zones.
 */

import type { ReactNode } from "react";

export function TwoZoneLayout({ evidence, board }: { evidence: ReactNode; board: ReactNode }) {
  return (
    <main className="zones" data-testid="zones">
      {evidence}
      {board}
    </main>
  );
}
