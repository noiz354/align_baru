'use client';

/**
 * FocusRegion — moves initial focus to its content, once, on mount.
 *
 * Requirements: NFR-A11Y-003 (initial focus on error/empty states).
 * Task: T-FOUND-003 (the not-found and error boundaries use it).
 *
 * WHY A CLIENT COMPONENT FOR FOUR LINES: focus cannot be moved from the
 * server. Both states this exists for — "the page you asked for is not here"
 * and "this page broke" — are exactly the states where a keyboard or screen
 * reader user must be told what happened without hunting for it
 * (ACCESSIBILITY.md §6: "error pages are focusable and announced"), and both
 * are rendered without any client JavaScript otherwise. The alternative —
 * leaving focus on the skip link at the top of the document — is the failure
 * mode this prevents.
 *
 * How it announces: the region is programmatically focusable (tabIndex -1,
 * so it is NOT a tab stop) and labelled by its own heading, so the
 * announcement is the heading and the sentence under it, not a bare
 * "region".
 *
 * `focusOnMount={false}` is the escape hatch for a state that must not steal
 * focus (e.g. an inline notice inside a page the user is already reading).
 */
import { useEffect, useRef, type ReactNode } from 'react';

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

  useEffect(() => {
    if (!focusOnMount) return;
    ref.current?.focus();
  }, [focusOnMount]);

  const classes = ['focus-region'];
  if (className) classes.push(className);

  return (
    <div ref={ref} tabIndex={-1} aria-labelledby={labelledBy} className={classes.join(' ')}>
      {children}
    </div>
  );
}

export default FocusRegion;
