'use client';

/**
 * FocusRegion — a boundary state that is focusable, and announced.
 *
 * Requirements: NFR-A11Y-003 (error/empty states are focusable and
 * announced), ACCESSIBILITY.md §4 (skip link), §6 (error states).
 * Task: T-FOUND-003 (the not-found and error boundaries use it).
 *
 * WHY A CLIENT COMPONENT FOR FOUR LINES: focus cannot be moved from the
 * server, and the announcement of a state that rendered without any client
 * JavaScript otherwise would be silent.
 *
 * ── The rule, and why it is two rules ─────────────────────────────────────
 * `focusOnMount` moves focus ONLY when this document had already hydrated when
 * the component rendered — i.e. an in-app transition, where the reader just
 * caused the state change and focus should follow it.
 *
 * On a HARD document load it deliberately does NOT move focus. The region sits
 * after the skip link, so focusing it made the bypass link unreachable by Tab,
 * which is the exact failure the skip link exists to prevent. The state is
 * still announced: the wrapper carries `role="status"` on that path, so a
 * screen reader reads the heading and the sentence under it. That satisfies
 * ACCESSIBILITY.md §6 ("focusable AND announced") without the focus steal —
 * "focusable" is `tabIndex={-1}`, i.e. it CAN take focus, which it still can.
 *
 * Two E2E specs previously asserted opposite things about the hard-load case;
 * the resolution and its `file:line` evidence are in
 * `docs/architecture/spec-questions.md` (SQ-A11Y-1).
 *
 * How the two cases are told apart is in ./hydration.
 */
import { useEffect, useRef, type ReactNode } from 'react';

import { hasHydrated } from './hydration';

export type FocusRegionProps = {
  children: ReactNode;
  /** Id of the heading that names this region. */
  labelledBy: string;
  /** Extra class for the wrapper (the boundary's own layout class). */
  className?: string;
  /** Set false for an inline notice; true for a whole-page state. */
  focusOnMount?: boolean;
};

export function FocusRegion({
  children,
  labelledBy,
  className,
  focusOnMount = true,
}: FocusRegionProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Read during RENDER, not in the effect: the wrapper's role has to match the
  // decision. On a hard load the layout's marker effect has not run yet at
  // either point, so this is `false` and stays `false`; on a soft navigation it
  // was set at the initial hydration, so it is `true` on the first render of
  // the new state. The flag only ever moves false → true once per document, so
  // a re-render cannot flip an already-painted region.
  const followsFocus = focusOnMount && hasHydrated();

  useEffect(() => {
    if (!followsFocus) return;
    ref.current?.focus();
  }, [followsFocus]);

  const classes = ['focus-region'];
  if (className) classes.push(className);

  // Both branches keep `tabIndex={-1}` and the label, so the region is
  // PROGRAMMATICALLY FOCUSABLE either way — ACCESSIBILITY.md §6's "focusable",
  // which is a different claim from "focused". Only the role and the focus move
  // differ. A live region that is also focusable is what lets a
  // skip-to-content affordance, or a future recovery action, send the reader
  // here deliberately.
  if (!followsFocus) {
    // Announced, not focused. `role="status"` is implicitly
    // `aria-live="polite"`, so this never interrupts whatever the reader is on.
    return (
      <div
        role="status"
        tabIndex={-1}
        aria-labelledby={labelledBy}
        className={classes.join(' ')}
      >
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} tabIndex={-1} aria-labelledby={labelledBy} className={classes.join(' ')}>
      {children}
    </div>
  );
}

export default FocusRegion;
