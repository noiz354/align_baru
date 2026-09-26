// HomeOps — skeleton (specification phase). Presentation shell only.
// Owning tasks: T-PLAT-002.

/**
 * Empty, all-clear, and onboarding states (docs/design/INTERACTION-PATTERNS.md §8).
 * Contract: one sentence plus at most one action; never a blank screen and never a
 * manufactured task. Copy rules: DESIGN.md §17 (T-1..T-7). Implemented with the pages.
 */

export type EmptyStateProps = {
  readonly title: string;
  /** Why this is empty / what it means, in plain household language. */
  readonly body?: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
};

export function EmptyState(_props: EmptyStateProps) {
  return null;
}
