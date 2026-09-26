/**
 * Catalog (`/discover`) route shell.
 *
 * Requirements: FR-CATALOG-001…005, NFR-PERF-001/008, NFR-A11Y-004.
 * Tasks: T-CATALOG-003 (grid), T-CATALOG-004 (genre filter),
 * T-CATALOG-005 (status/sorts).
 *
 * Behavior: SSR grid (LCP = first cover), URL-driven filter/sort state
 * (?genre=,?status=,?sort=), cursor pagination; a11y per
 * ACCESSIBILITY.md §2. No feature code in this phase.
 */
export default function DiscoverPage() {
  return (
    <main>
      {/* TODO(T-CATALOG-003): MangaCard grid (SSR) */}
      {/* TODO(T-CATALOG-004/005): filter + sort controls (URL-driven) */}
    </main>
  );
}
