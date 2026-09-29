/**
 * Search (`/search`).
 *
 * Requirements: FR-SEARCH-001…005, NFR-A11Y-002. Tasks: T-SEARCH-004 (UI),
 * T-SEARCH-006 (states), T-READER-001 (deep link — the `?q=` contract below).
 *
 * ── What this page is ─────────────────────────────────────────────────────
 * A server shell that reads `?q=` and renders page 1 for it, plus the client
 * island that takes over for typing and paging. `NotYetBuilt` is gone: the box
 * searches, the states are honest, and the URL is shareable.
 *
 * ── The `?q=` contract (F-012-S2) ──────────────────────────────────────────
 * The query is IN the URL, so a search is a link: pasting `/search?q=naruto`
 * shows the same first page to anyone, with or without JavaScript. The island
 * keeps it there with `router.push` as the reader types (debounced) and submits
 * (immediate) — each completed query is a history entry, so Back moves through
 * searches (F-012-S2). Clearing the box `replace`s the bare `/search`, so no
 * meaningless `?q=` is ever left behind. The cursor is deliberately NOT in the
 * URL (see `search-box.tsx` and `catalog-results.tsx` for why an opaque token
 * is not shareable state).
 *
 * ── A new query mounts a fresh island ───────────────────────────────────────
 * `key={initialQuery}`: state (items, cursor, error) cannot survive a change of
 * query, so there is no effect that resets and no stale window where page 2 of
 * one search is offered for another. Correct by construction, the catalog's own
 * rule.
 */
import type { Metadata } from 'next';
import { readSearchPage } from './search-data';
import { SearchBox } from './search-box';

/** `searchParams` is a promise in Next 16, and `q` may arrive as an array. */
type SearchParams = {
  q?: string | string[];
};

export const metadata: Metadata = {
  title: 'Search',
};

function readInitialQuery(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return '';
  return (raw ?? '').slice(0, 120);
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const initialQuery = readInitialQuery((await searchParams).q);
  const initial = initialQuery.trim() === '' ? null : await readSearchPage(initialQuery);

  return (
    <>
      <h1>Search</h1>
      <SearchBox
        key={initialQuery}
        initialQuery={initialQuery}
        initialItems={initial !== null && initial.ok ? initial.items : []}
        initialCursor={initial !== null && initial.ok ? initial.nextCursor : null}
        initialFailed={initial !== null && !initial.ok}
        initialFailedCode={initial !== null && !initial.ok ? initial.code : null}
      />
    </>
  );
}
