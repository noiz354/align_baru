/**
 * Search (`/search`) route shell.
 *
 * Requirements: FR-SEARCH-001…005, NFR-A11Y-002.
 * Tasks: T-SEARCH-004 (UI), T-SEARCH-006 (states).
 *
 * Behavior: debounced (300 ms) query box (Enter forces immediate), URL
 * sync (?q=), ranked results with kind/match hints, distinct states
 * (empty query / no results / rate-limited / empty catalog), a11y per
 * ACCESSIBILITY.md §5. No feature code in this phase.
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 2: features/search; handler
 * `src/app/api/v1/search/route.ts`.
 *
 * The input that arrives with T-SEARCH-004 is `type="search"` with a visible
 * label, so it is the FormField primitive's job, not this shell's.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search',
};

export default function SearchPage() {
  return (
    <>
      <h1>Search</h1>
      {/* TODO(T-SEARCH-004): search input + results list (labeled, keyboard) */}
      {/* TODO(T-SEARCH-006): distinct states — empty query, no results,
          rate-limited (SEARCH_QUERY_INVALID / RATE_LIMIT_*), empty catalog.
          Every state is informative and offers the next action; `main` is
          never blank (ACCESSIBILITY.md §6). */}
    </>
  );
}
