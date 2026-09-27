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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 1: the catalog surface is served
 * by features/catalog (and features/chapters for the chapter counts it
 * assembles); its handler is `src/app/api/v1/catalog`.
 *
 * Landmarks: ACCESSIBILITY.md §2 puts filters in an `aside` and the grid in
 * the page's single `main` (AppShell's). The filter `aside` arrives with
 * T-CATALOG-004; until then this page is the h1 plus the two TODOs.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Catalog',
};

export default function DiscoverPage() {
  return (
    <>
      <h1>Catalog</h1>
      {/* TODO(T-CATALOG-003): MangaCard grid (SSR) */}
      {/* TODO(T-CATALOG-004/005): filter + sort controls (URL-driven) */}
    </>
  );
}
