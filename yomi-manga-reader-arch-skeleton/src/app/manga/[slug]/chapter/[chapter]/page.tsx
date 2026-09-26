/**
 * Manga reader route shell (`/manga/[slug]/chapter/[chapter]`).
 *
 * Requirements: FR-READER-001…011 (route existence), FR-READER-023
 * (deep-link validation), NFR-PERF-003/006 (reserved slots, SSR first page).
 * Tasks: T-READER-001 (SSR shell), T-READER-003 (client mount),
 * T-READER-029 (restore), T-READER-028 (unavailable states).
 *
 * This component intentionally contains no reader implementation.
 *
 * Contract (ADR-007, reader-behavior.md §2):
 * - SSR emits: chapter heading, the first (or restored) page as
 *   `<picture>` (AVIF→WebP→JPEG), and the reserved reader container —
 *   so page 1 paints before hydration and mode switches never shift layout.
 * - `?page=N` validated/clamped at SSR (T-READER-032); invalid ⇒ clamped
 *   + one inline notice; the client store takes over from ReaderState.
 * - Unpublished/deleted ⇒ 404 page; draft-with-pages/failed ⇒ "unavailable"
 *   state (CHAPTER_NOT_READY mapping) — never a blank.
 */
export default function ReaderPage(/* { params, searchParams } */) {
  return (
    <main>
      {/* TODO(T-READER-001): SSR reader shell (first page <picture> +
          reserved container + chapter heading) */}
      {/* TODO(T-READER-003): client reader mount (ReaderState store) */}
    </main>
  );
}
