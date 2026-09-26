/**
 * Safety exit control component shell.
 *
 * Requirements:
 * - NFR-SAFE-004 (exit always possible)
 * - G-3 (no dark patterns)
 *
 * See:
 * - DESIGN.md §17
 * - PRD.md §7.4
 *
 * COMPONENT SHELL ONLY.
 */

export interface SafetyExitProps {
  onExit: () => void;
  label?: string;
}

/**
 * TODO(T-SESSION-END-013): implement the safety exit control.
 *
 * When implemented it must:
 * - be reachable in ONE action from landing, age gate, mode selection,
 *   waiting, matched, connecting, and active
 * - never be intercepted by a confirmation modal
 * - never be styled as secondary or hidden below the fold
 * - be operable by keyboard alone
 */
export function SafetyExit(_props: SafetyExitProps): React.JSX.Element {
  throw new Error('Not implemented: T-SESSION-END-013 (SafetyExit shell)');
}
