/**
 * Manga detail (`/manga/[slug]`) route shell.
 *
 * Requirements: FR-CATALOG-006/008, FR-CHAPTER-002, NFR-SEC-016 (synopsis
 * as plain text), NFR-A11Y-004.
 * Tasks: T-CATALOG-006 (detail page), T-CATALOG-008 (chapter list),
 * T-CATALOG-009 (continue-reading entry).
 *
 * Behavior: all detail fields (FR-CATALOG-006); "Read" primary action →
 * chapter 1 or resume (FR-CATALOG-008); unpublished/deleted → 404 page
 * (not a blank); chapter list with read indicators (VS-5+).
 * The `[slug]` param is validated in the page task (T-FOUND-003 rule:
 * malformed params never crash the layout).
 *
 * Task: T-FOUND-003. API_CONTRACT §5 row 1: features/catalog assembles the
 * detail view, features/chapters the chapter list; handlers
 * `src/app/api/v1/catalog` and the chapter-list route.
 *
 * The heading is the surface name, not the manga title, because the title is
 * data this phase has none of (no repository, no fixture — AGENTS.md §4.3).
 * ACCESSIBILITY.md §2 still requires exactly one `h1` per page, so the
 * shell carries it and T-CATALOG-006 replaces it with the real title.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Manga',
};

export default function MangaDetailPage(/* { params } */) {
  return (
    <>
      <h1>Manga</h1>
      {/* TODO(T-CATALOG-006): detail layout (title, aliases, creators,
          genres/tags, synopsis-as-text, cover, Read/Continue actions) */}
      {/* TODO(T-CATALOG-008): chapter list (ol semantics) */}
      {/* TODO(T-CATALOG-009): resume entry once progress is readable */}
    </>
  );
}
