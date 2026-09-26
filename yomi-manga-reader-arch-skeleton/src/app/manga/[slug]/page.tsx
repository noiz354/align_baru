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
 */
export default function MangaDetailPage(/* { params } */) {
  return (
    <main>
      {/* TODO(T-CATALOG-006): detail layout (title, aliases, creators,
          genres/tags, synopsis-as-text, cover, Read/Continue actions) */}
      {/* TODO(T-CATALOG-008): chapter list (ol semantics) */}
    </main>
  );
}
