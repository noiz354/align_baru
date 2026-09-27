/**
 * E2E tests — catalog (Playwright). PLACEHOLDERS that are still real.
 *
 * Canonical plan: TEST_STRATEGY.md §4 (E2E-CATALOG-*).
 *
 * ── E2E-CATALOG-001 is NOT here, and that is deliberate ───────────────────
 * Its TEST_STRATEGY row reads: "J-1 — land → catalog (cards render, LCP
 * assert) → genre filter → sort → detail page (all FR-CATALOG-006 fields) →
 * chapter list order; unknown slug → 404 page (no existence leak); draft
 * manga invisible to anonymous."
 *
 * Every clause of that row is now a real, passing test in
 * `catalog-journey.e2e.spec.ts`:
 *   - page 1 server-rendered, cards with cover/title/status/latest label (83, 97)
 *   - the first cover is the LCP element (115)
 *   - a title with no cover requests nothing (139); a cover that 404s falls
 *     back to the placeholder (165)
 *   - genre filter: one genre, two genres, shareable URL, the six-genre cap,
 *     20+ genres in a scroll region (232–330)
 *   - status and sort: labelled control, the three sorts, sorting really
 *     reorders, a sort change resets the cursor (331–384)
 *   - detail page fields, chapter list order and the Latest badge
 *   - unknown slug → 404 AND unpublished/deleted → 404, asserted as
 *     INDISTINGUISHABLE (486, 498); a malformed slug is a 404, not a crash (504)
 *   - a draft chapter is labelled in words (590)
 *
 * A `describe.todo` next to a spec that already asserts all of it is a second
 * source of truth that can only drift, and DoD §3.3 forbids a task's
 * `describe.todo` remaining while its planned tests exist. So the row is
 * satisfied by that file and the placeholder is gone.
 *
 * ── E2E-CATALOG-002 keeps ONE clause, because the rest is covered ────────
 * Its row: "Pagination: page 1 → 2 → back; cursor stable with a concurrent
 * admin insert (two contexts)."
 *
 *   COVERED in `catalog-journey.e2e.spec.ts`: "load more appends the next page
 *   and the announced count follows" (198), "page 1 is never dropped: loading
 *   more appends rather than replaces" (211), and "the cursor is not in the
 *   URL, so a reload returns to page 1" (220).
 *
 *   NOT COVERED anywhere: the two-context case. No spec in `tests/e2e/` opens
 *   a second browser context, because doing it honestly needs an INSERT between
 *   two page loads — and the E2E harness is a read-only fixture API
 *   (`tests/e2e/support/catalog-harness.ts`), so there is no admin path to call
 *   from a test. The keyset guarantee it would assert (a row inserted between
 *   two page requests must not shift the anchor) is a REPOSITORY property and
 *   is proven there instead: INT-CAT-001's cursor/keyset cases in
 *   `tests/integration/catalog-list.test.ts` run against real PostgreSQL, and
 *   `catalog.manga.repository.test.ts` EXPLAINs the keyset comparison.
 *
 *   So this placeholder is scoped to the one thing that genuinely cannot run
 *   until the harness can write. Task: T-CATALOG-003 (E2E-CATALOG-002).
 */
import { describe } from 'vitest';

describe.todo(
  'E2E-CATALOG-002 cursor stability across a concurrent admin insert (two browser contexts) — blocked on the E2E harness being able to INSERT, see this file header',
);
