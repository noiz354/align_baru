// HomeOps — the single place status colours, shapes, and words are defined (T-ROOM-010, T-A11Y-002,
// docs/design/DESIGN-SYSTEM.md §3, NFR-A11Y-003).
//
// Every status renders as WORD + SHAPE + COLOUR; a shape is never the only signal, and the accessible
// name includes the word and — when supplied — the reason. Features must not render their own chips.

import { statusWord } from '../strings/en';

export type StatusTone =
  'neutral' | 'success' | 'attention' | 'warning' | 'critical' | 'in-progress' | 'unknown';

export type StatusBadgeProps = {
  /** A status value from src/shared/types.ts (never a free-form string). */
  readonly status: string;
  readonly tone?: StatusTone;
  /** One short sentence of evidence, e.g. 'Deep clean is 2 days overdue' (T-2: never blame). */
  readonly reason?: string;
  readonly size?: 'sm' | 'md';
};

/**
 * Shape vocabulary (DESIGN-SYSTEM.md §3). Inline SVG with `aria-hidden`: the word carries the
 * meaning, the shape reinforces it for people who scan by form.
 */
const SHAPES: Record<StatusTone, string> = {
  success: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', // ● filled circle
  attention: 'M12 3 22 20H2z', // ▲ triangle
  warning: 'M4 4h16v16H4z', // ■ square
  critical: 'M12 2 22 12 12 22 2 12z', // ◆ diamond
  unknown: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z', // ○ hollow circle
  'in-progress': 'M3 10h18v4H3z', // ▬ bar
  neutral: 'M3 10h18v4H3z',
};

/** Status value → tone. The mapping is fixed by DESIGN-SYSTEM.md §3 and is not configurable. */
export const TONE_BY_STATUS: Readonly<Record<string, StatusTone>> = {
  CLEAN: 'success',
  DONE: 'success',
  EMPTY: 'success',
  AVAILABLE: 'success',
  FULL_STOCK: 'success',
  RESOLVED: 'success',
  NEEDS_ATTENTION: 'attention',
  LOW: 'attention',
  ALMOST_FULL: 'attention',
  ACKNOWLEDGED: 'attention',
  SCHEDULED: 'attention',
  DIRTY: 'warning',
  FULL: 'warning',
  CRITICAL: 'warning',
  SNOOZED: 'warning',
  SKIPPED: 'warning',
  COLLECTION_REQUIRED: 'critical',
  UNAVAILABLE: 'critical',
  URGENT: 'critical',
  SAFETY: 'critical',
  CLEANING: 'in-progress',
  IN_PROGRESS: 'in-progress',
  UNKNOWN: 'unknown',
  CANCELLED: 'neutral',
  ARCHIVED: 'neutral',
  PAUSED: 'neutral',
  EXPIRED: 'neutral',
};

const TONE_CLASS: Record<StatusTone, string> = {
  success: 'text-success border-success',
  attention: 'text-attention border-attention',
  warning: 'text-warning border-warning',
  critical: 'text-critical border-critical',
  unknown: 'text-neutral border-neutral',
  'in-progress': 'text-primary border-primary',
  neutral: 'text-text-muted border-border',
};

export function StatusBadge({ status, tone, reason, size = 'md' }: StatusBadgeProps) {
  const resolvedTone = tone ?? TONE_BY_STATUS[status] ?? 'neutral';
  const word = statusWord(status);
  const accessibleName = reason ? `${word}. ${reason}` : word;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border bg-surface font-medium ${padding} ${TONE_CLASS[resolvedTone]}`}
      // The word and the reason are the accessible name; the shape is decorative (NFR-A11Y-003).
      aria-label={accessibleName}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'}
        fill="currentColor"
      >
        <path d={SHAPES[resolvedTone]} />
      </svg>
      <span>{word}</span>
      {reason ? <span className="text-text-muted font-normal">· {reason}</span> : null}
    </span>
  );
}
