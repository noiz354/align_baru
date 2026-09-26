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
 */
export default function SearchPage() {
  return (
    <main>
      {/* TODO(T-SEARCH-004): search input + results list (labeled, keyboard) */}
    </main>
  );
}
