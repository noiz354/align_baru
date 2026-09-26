/**
 * Start page — age gate, safety notice, mode selection.
 *
 * Requirements:
 * - FR-ENTRY-001 … FR-ENTRY-010
 * - FR-MEDIA-003 (gesture required)
 *
 * See:
 * - docs/design/PAGES.md §1
 * - docs/safety/AGE-GATING.md
 *
 * ROUTE SHELL ONLY. This page is not implemented.
 *
 * It must NOT: pre-check a box, hide the disclaimer, or claim to verify age.
 */

export default function StartPage(): React.JSX.Element {
  // TODO(T-SESSION-002): two unchecked checkboxes, genuinely disabled Continue.
  // TODO(T-SESSION-002): scrollable safety notice, not dismissible-forever.
  // TODO(T-MATCH-031): optional interest picker from the closed vocabulary.
  throw new Error('Not implemented: T-SESSION-002 (start route shell)');
}
