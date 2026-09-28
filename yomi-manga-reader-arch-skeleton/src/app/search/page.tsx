/**
 * Search (`/search`).
 *
 * Requirements: FR-SEARCH-001…005, NFR-A11Y-002. Tasks: T-SEARCH-004 (UI), T-SEARCH-006 (states).
 * Data: T-SEARCH-001 (`GET /api/v1/search`). Ranking: T-SEARCH-003.
 *
 * ── Why there is no search box yet ─────────────────────────────────────────
 * A search box is a promise that typing in it does something. T-SEARCH-004 depends on
 * T-SEARCH-001, and T-SEARCH-001 is not implemented: `src/app/api/search/route.ts:9` throws
 * `Not implemented: T-SEARCH-003`, and `src/features/search/search.service.ts:39` throws
 * `Not implemented: T-SEARCH-001`. The trigram indexes the search depends on are now in place
 * (migration 0001, DATA_MODEL §19), so the database half is real — but a debounce, a URL sync
 * and an arrow-navigable results list over a route that always throws would be a keyboard-
 * navigable error page, which is worse than a page that admits it is not there.
 *
 * T-SEARCH-006's states are the same problem: "no results for 'x'", "the catalog is empty" and
 * "rate limited" are three distinct claims about a real response, and none of them can be true
 * until one arrives.
 *
 * The design intent is recorded here so it is not lost: debounced 300 ms query box with Enter
 * forcing an immediate search, `?q=` URL sync, ranked results with a kind badge and a
 * match-field hint, and distinct states for empty query, no results, rate limited and empty
 * catalog — per ACCESSIBILITY.md §5, with `main` never blank.
 */
import type { Metadata } from 'next';
import { NotYetBuilt } from '../../shared/ui/StateRegion';

export const metadata: Metadata = {
  title: 'Search',
};

export default function SearchPage() {
  return (
    <>
      <h1>Search</h1>
      <NotYetBuilt
        headingId="search-not-built"
        task="T-SEARCH-001"
        intent="offer a debounced search box across titles and aliases with ranked results, a URL you can share, and distinct messages for no results, an empty catalog and rate limiting"
        actions={[{ href: '/discover', label: 'Browse the catalog', primary: true }]}
      />
    </>
  );
}
