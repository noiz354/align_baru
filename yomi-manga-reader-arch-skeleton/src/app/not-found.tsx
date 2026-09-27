/**
 * Not-found page (all 404s).
 *
 * Requirements: NFR-A11Y-003/004, API_CONTRACT (404 policy: no existence
 * leak for private data — THREAT T-04).
 * Task: T-FOUND-003.
 *
 * Contract: labeled state (never a blank `main`), human cause, next
 * action (home / catalog link), initial focus on the content. The SAME
 * page serves "manga not found" and "route not found" — private-data
 * 404s intentionally do not reveal existence.
 *
 * ── Why the copy is generic on purpose ───────────────────────────────────
 * THREAT T-04: a 404 that says "no such manga" and a 404 that says "you may
 * not see this manga" are the same sentence as far as an attacker is
 * concerned, so this page never names what was missing, whether it exists,
 * or who owns it. It states what happened in terms the reader can act on and
 * offers the two destinations that always exist. Access to the real cause
 * (MANGA_NOT_FOUND, AUTH_FORBIDDEN → 404) is logged server-side with a
 * request id; the UI gets the user-safe message only (API_CONTRACT §6).
 *
 * ── Why the shell is not repeated here ───────────────────────────────────
 * `not-found.tsx` renders INSIDE the root layout, so AppShell already
 * provides the landmarks, the skip link and the single `<main>`. This page
 * contributes content, not a frame — rendering a second `<main>` here would
 * break ACCESSIBILITY.md §2.
 *
 * Focus (NFR-A11Y-003): FocusRegion moves focus to this content on mount and
 * labels it with the heading, so the state is announced rather than hunted
 * for. The region is programmatically focusable, never a tab stop.
 *
 * Shape: cause, then what to do, then the actions — ACCESSIBILITY.md §6 ("a
 * human cause, what the user can do, a link home") in the order a reader
 * needs it, and the order the hi-fi error set uses (`_docs/hifi/
 * error-states.html`, not-found panel).
 *
 * The actions carry `.btn` even though they navigate. That is not a
 * button-in-disguise: the element is still a real `<a>`, so it is announced
 * as a link, middle-click and open-in-new-tab keep working, and it is the one
 * class that already guarantees the 44×44 px floor (NFR-A11Y-010,
 * `--target-min`) plus the two-band focus ring. Bare inline links here were
 * 19 px tall — a real violation, caught by
 * tests/e2e/shell-a11y.e2e.test.ts (NFR-A11Y-010).
 */
import { FocusRegion } from '../shared/ui/FocusRegion';
import { UiLink } from '../shared/ui/Link';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <FocusRegion labelledBy="not-found-title">
      <h1 id="not-found-title">Page not found</h1>
      <p>
        <strong>Cause.</strong> There is nothing at this address. The link that brought you here may
        be out of date, or the page may have moved.
      </p>
      <p>
        <strong>What you can do.</strong> Browse the catalog for something to read, or start over
        from the home page.
      </p>
      <p className="page-actions">
        <UiLink className="btn btn--primary" href="/discover">
          Go to the catalog
        </UiLink>{' '}
        <UiLink className="btn" href="/">
          Go to the home page
        </UiLink>
      </p>
      {/* TODO(T-CATALOG-006, T-READER-028): a manga or chapter that is
          unpublished, deleted or unavailable reuses this page — the wording
          must not distinguish those cases from an unknown route. */}
    </FocusRegion>
  );
}
