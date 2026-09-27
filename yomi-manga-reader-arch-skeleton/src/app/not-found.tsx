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
        There is nothing at this address. It may have moved, or the link that brought you here may
        be out of date.
      </p>
      <p>
        <UiLink href="/discover">Go to the catalog</UiLink> to browse what is here, or{' '}
        <UiLink href="/">Go to the home page</UiLink> to start over.
      </p>
      {/* TODO(T-CATALOG-006, T-READER-028): a manga or chapter that is
          unpublished, deleted or unavailable reuses this page — the wording
          must not distinguish those cases from an unknown route. */}
    </FocusRegion>
  );
}
