'use client';

/**
 * "Has this document finished its first hydration?" — one flag, one answer.
 *
 * Requirements: NFR-A11Y-003 (error/empty states are focusable and announced),
 * ACCESSIBILITY.md §4 (skip link), §6 (error states offer a next action).
 * Tasks: T-FOUND-003 (the not-found/error boundaries), T-FOUND-004 (AppShell).
 *
 * ── Why a flag is needed at all ───────────────────────────────────────────
 * `FocusRegion` used to move focus on every mount. On a HARD document load
 * that put focus on the error content, which sits AFTER the skip link in the
 * DOM — so the first Tab key moved forward from the error body and never
 * reached the bypass link (WCAG 2.4.1). Two E2E specs asserted opposite things
 * about that page, which is how the contradiction stayed invisible: the
 * not-found spec wanted focus in the state, the route-map spec wanted the skip
 * link to be the first Tab stop on every route. See
 * `docs/architecture/spec-questions.md` SQ-A11Y-1 for the resolution.
 *
 * The resolution is per-case, because the two requirements are about different
 * moments:
 * - HARD load (`page.goto`, pasted URL, refresh): do NOT move focus. The
 *   reader has no in-app context to reorient and the bypass link is the first
 *   thing they should reach. The state is ANNOUNCED instead, via a
 *   `role="status"` region — which is what ACCESSIBILITY.md §6 asks for.
 * - IN-APP navigation (a client-side transition into an error state): DO move
 *   focus. The reader triggered the change, the bypass link has already done
 *   its job, and moving focus is how a state change is announced.
 *
 * ── How the flag distinguishes them ───────────────────────────────────────
 * `<HydrationBoundary />` lives in the ROOT LAYOUT, so it mounts once per
 * document and does NOT remount on a client-side navigation. React runs child
 * effects before parent effects, so on a hard load a `FocusRegion` deeper in
 * the tree sees `false` during both its render and its effect; on a soft
 * navigation the layout's effect has already run at the initial hydration, so
 * the same component sees `true`. One boolean, no router internals, no
 * framework-version coupling.
 */
import { useEffect } from 'react';

/** False during SSR and the first hydration; true for the rest of the document. */
let hydrated = false;

/** @returns whether this document has completed its first hydration. */
export function hasHydrated(): boolean {
  return hydrated;
}

/**
 * Marks the document as hydrated. Renders nothing.
 *
 * Must be mounted by the ROOT LAYOUT: the whole distinction rests on this
 * component not remounting when the route changes.
 */
export function HydrationBoundary(): null {
  useEffect(() => {
    hydrated = true;
  }, []);
  return null;
}

export default HydrationBoundary;
