/**
 * StateRegion — the one shape a page uses to say something instead of nothing.
 *
 * Requirements: NFR-A11Y-003 (a state is focusable and announced), NFR-SEC-010
 * (nothing about the internals reaches the reader), ACCESSIBILITY.md §6
 * ("never a blank main").
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * The shape — a heading, then "Cause.", then "What you can do.", then somewhere to go —
 * had been written out four times: `not-found.tsx`, `error.tsx`, `discover/catalog-unavailable.tsx`
 * and `manga/[slug]/detail-unavailable.tsx`. Four copies of one pattern means four
 * chances to state the same situation in four different ways, and the skeletons that
 * shipped alongside them simply rendered `<h1>` and left `main` empty, which is the one
 * outcome ACCESSIBILITY.md §6 forbids.
 *
 * So the pattern is written once, here, and a page that has nothing to show yet says so
 * through `<NotYetBuilt />` rather than rendering a blank region.
 *
 * ── Why the focus move is the announcement ────────────────────────────────
 * A region that appears where the reader expected content must be announced without being
 * hunted for, so focus lands on it. It is deliberately not `role="alert"`: announcing a whole
 * region assertively, on a page that is otherwise fine, interrupts rather than explains.
 *
 * ── Why a "not built" state is honest but still useful ────────────────────
 * An empty shelf and an unimplemented feature look identical on screen, and only one of them
 * is a bug. Saying "nothing here yet" when the grid was never written would send a reader
 * looking for a setting. So the state names what exists (the route, the task that owns the
 * behaviour) and offers a real destination instead of a dead end.
 */
import type { ReactNode } from 'react';
import { Button } from './Button';
import { classNames } from './classNames';
import { FocusRegion } from './FocusRegion';
import { UiLink } from './Link';

export type StateRegionAction = {
  href: string;
  label: string;
  /** `true` for the recommended action; rendered with the primary button class. */
  primary?: boolean;
};

export type StateRegionProps = {
  /** Id of the heading that names this region, so the announcement says where the reader is. */
  headingId: string;
  title: string;
  /**
   * Heading level. A whole-page state owns the h1; a state inside a page that already has one
   * (a panel beside the catalog grid) must not add a second h1 (ACCESSIBILITY.md §3).
   */
  headingLevel?: 1 | 2 | 3;
  /** What happened, in the reader's terms. Say nothing about upstream status codes or ids. */
  cause: ReactNode;
  /** The next action, when there is one. */
  remedy?: ReactNode;
  actions?: StateRegionAction[];
  /**
   * A retry that re-renders rather than navigates. `error.tsx` needs this: its recovery is
   * Next's `reset()`, which re-runs the segment in place, and a link to the same address would
   * be a different thing wearing the same label.
   */
  onRetry?: { label: string; onClick: () => void };
  /** Trailing detail — an operator reference id, for instance. */
  children?: ReactNode;
};

/** The shared shape. Presentational only: no fetching, no feature imports (boundary D8). */
export function StateRegion({
  headingId,
  title,
  headingLevel = 3,
  cause,
  remedy,
  actions = [],
  onRetry,
  children,
}: StateRegionProps) {
  const Heading = headingLevel === 1 ? 'h1' : headingLevel === 2 ? 'h2' : 'h3';
  return (
    <FocusRegion labelledBy={headingId} className="state-region">
      <Heading id={headingId}>{title}</Heading>
      <p>
        <strong>Cause.</strong> {cause}
      </p>
      {remedy ? (
        <p>
          <strong>What you can do.</strong> {remedy}
        </p>
      ) : null}
      {onRetry || actions.length > 0 ? (
        <p className="page-actions">
          {onRetry ? (
            <Button variant="primary" onClick={onRetry.onClick}>
              {onRetry.label}
            </Button>
          ) : null}
          {actions.map((action) => (
            <UiLink
              key={action.href}
              className={classNames('btn', action.primary && 'btn--primary')}
              href={action.href}
            >
              {action.label}
            </UiLink>
          ))}
        </p>
      ) : null}
      {children}
    </FocusRegion>
  );
}

export type NotYetBuiltProps = {
  /**
   * Id of the state's own heading, which names the region for the focus announcement. It is
   * not the page h1's id: the page keeps its own h1 for its own name, and the state sits under
   * it at h3 (ACCESSIBILITY.md §3 — one h1 per page, and the page's belongs to the page).
   */
  headingId: string;
  /** Override the heading level. Leave at 3 for a region inside a page that has an h1. */
  headingLevel?: 1 | 2 | 3;
  /** Task that owns the behaviour, e.g. `T-LIB-003`. Rendered verbatim so it can be looked up. */
  task: string;
  /** What the page will do when the task lands, in the reader's terms. */
  intent: string;
  /** Where to go instead. A shell with no exit is a dead end, so this is required. */
  actions: StateRegionAction[];
};

/**
 * The state for a route that is a deliberate shell: the frame, the nav and the heading are
 * real, and the feature is named but unbuilt. The task id is shown on purpose — it turns a
 * dead page into a pointer at the work, and it stops anyone reading the page later from
 * mistaking a placeholder for a finished-but-empty feature.
 */
export function NotYetBuilt({ headingId, headingLevel = 3, task, intent, actions }: NotYetBuiltProps) {
  return (
    <StateRegion
      headingId={headingId}
      headingLevel={headingLevel}
      title="This page is not built yet"
      cause={`The route exists so its address and navigation entry are stable, but the behaviour it promises has not been written. This is a placeholder, not an empty result: nothing is missing from your account.`}
      remedy={
        <>
          Once <code>{task}</code> lands, this page will {intent}.{' '}
          <span className="note">Tracked as {task} in TASKS.md.</span>
        </>
      }
      actions={actions}
    />
  );
}
