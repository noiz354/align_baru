// HomeOps — skeleton (specification phase). Presentation shell only.

/**
 * The single place status colours, shapes, and words are defined
 * (docs/design/DESIGN-SYSTEM.md §3, NFR-A11Y-003, NFR-MAINT-004).
 *
 * Contract (implemented in T-ROOM-010 / T-A11Y-002):
 *  - every status renders as WORD + SHAPE + COLOUR; a shape is never the only signal;
 *  - the accessible name includes the word and, when provided, the reason;
 *  - features must not render their own chips; a test asserts no feature bypasses this primitive.
 */

export type StatusTone = 'neutral' | 'success' | 'attention' | 'warning' | 'critical' | 'in-progress' | 'unknown';

export type StatusBadgeProps = {
  /** A status value from src/shared/types.ts (never a free-form string). */
  readonly status: string;
  readonly tone?: StatusTone;
  /** One short sentence of evidence, e.g. 'Deep clean is 2 days overdue'. */
  readonly reason?: string;
  readonly size?: 'sm' | 'md';
};

export function StatusBadge(_props: StatusBadgeProps) {
  // Component shells return null in this phase; no production UI is built (AGENTS.md §1).
  return null;
}
