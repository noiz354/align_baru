// HomeOps — empty, all-clear, and onboarding states (T-PLAT-002, DESIGN.md §9,
// docs/design/INTERACTION-PATTERNS.md §8).
//
// Contract: one sentence plus at most one action; never a blank screen and never a manufactured task.

export type EmptyStateProps = {
  readonly title: string;
  /** Why this is empty / what it means, in plain household language. */
  readonly body?: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
};

export function EmptyState({ title, body, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6 text-center shadow-[var(--shadow-1)]">
      <p className="text-lg font-semibold text-text">{title}</p>
      {body ? <p className="mt-1 text-sm text-text-muted">{body}</p> : null}
      {actionLabel && actionHref ? (
        <a
          href={actionHref}
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-fg"
        >
          {actionLabel}
        </a>
      ) : null}
    </div>
  );
}
