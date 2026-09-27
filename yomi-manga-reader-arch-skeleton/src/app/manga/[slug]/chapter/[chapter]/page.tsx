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
 *
 * Task: T-FOUND-003. API_CONTRACT §5 has no row for the reader PAGE (its
 * rows cover handlers, the chapter pages and `/media/{assetKey}`), so the
 * mapping is taken from the feature charters: features/reader owns the
 * reader state, features/chapters owns the page list, and
 * `src/app/media/[assetKey]/route.ts` (server/media, via composition)
 * serves the images — API_CONTRACT §5 row 8. Recorded as a spec-question
 * rather than invented silently.
 *
 * ── Why this shell reads neither `params` nor `searchParams` ────────────
 * TASKS.md T-FOUND-003 names `/manga/x/chapter/1?page=abc` as the edge
 * case: the layout must not crash on a nonsense query value. It cannot,
 * because nothing here parses them. `?page=N` is validated and clamped by
 * T-READER-032 (indices are always 1..M, UNIT-READER-002), and an
 * unparseable value is clamped with one inline notice there — not by a
 * `Number()` call in a layout that every reader route passes through. In
 * Next 16 both are promises; a shell that does not await them cannot throw
 * on either.
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  // TODO(T-READER-001): the title becomes the chapter (and its manga);
  // until the page has data, the surface name is honest.
  title: 'Reader',
};

export default function ReaderPage(/* { params, searchParams } */) {
  return (
    <>
      <h1>Chapter</h1>
      {/* TODO(T-READER-001): SSR reader shell (first page <picture> +
          reserved container + chapter heading) */}
      {/* TODO(T-READER-003): client reader mount (ReaderState store) */}
      {/* TODO(T-READER-029): restore the saved position on entry */}
      {/* TODO(T-READER-028): unavailable states (CHAPTER_NOT_READY) */}
    </>
  );
}
