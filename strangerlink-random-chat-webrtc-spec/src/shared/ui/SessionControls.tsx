/**
 * Session controls component shell.
 *
 * Requirements:
 * - FR-REPORT-001 (report reachable)
 * - FR-BLOCK-001 (block reachable)
 * - FR-CHAT-009 (leave in one action)
 * - NFR-A11Y-002, NFR-A11Y-003
 *
 * See:
 * - DESIGN.md §8, §14
 * - ACCESSIBILITY.md §10
 *
 * COMPONENT SHELL ONLY.
 */

export interface SessionControlsProps {
  onSkip: () => void;
  onReport: () => void;
  onBlock: () => void;
  onLeave: () => void;
}

/**
 * TODO(T-SESSION-END-013): implement the session controls.
 *
 * When implemented it must:
 * - render Skip, Report, Block, and Leave ALWAYS VISIBLE — never in a menu,
 *   never hidden, never removed
 * - make Report and Block reachable by keyboard WITHOUT traversing the
 *   message list first
 * - meet the critical touch target size (>= 56px)
 * - keep Skip and Report visible even when video controls auto-hide
 *   (DESIGN.md §8)
 */
export function SessionControls(_props: SessionControlsProps): React.JSX.Element {
  throw new Error('Not implemented: T-SESSION-END-013 (SessionControls shell)');
}
