/**
 * The members' contract schemas — the one place the three personal lists are
 * parsed.
 *
 * Responsibility: `LibraryEntry` (`GET /api/library`), `Bookmark`
 * (`GET /api/bookmarks`) and `HistoryEntry` (`GET /api/history`), exactly as
 * `src/shared/contracts/library.ts` declares them. Nothing here reads, fetches
 * or decides anything: shapes only, so a page, a server read and a client island
 * can share ONE definition of each contract instead of three that drift.
 *
 * Requirements: FR-LIBRARY-003/008/009/010, NFR-SEC-010/016, NFR-SEC-007
 * (script-safe rendered text), THREAT T-11 (an asset key is a capability),
 * THREAT T-04 (no DTO in this lane carries a `userId`).
 * Tasks: T-LIB-003 (`/library`), T-LIB-005 (`/history`), T-LIB-007 (the routes
 * whose payloads these are), T-LIB-008 (`/bookmarks`).
 * Spec: shared/contracts/library.ts, API_CONTRACT §2.3/§2.4,
 * discover/catalog-schema.ts (the same arrangement for the catalog lane).
 *
 * ── Why this is a module and not a page ─────────────────────────────────────
 * Every list here is paginated by an opaque cursor, so each page needs a client
 * island that appends page 2 — and that island has to validate the page it
 * appends exactly as strictly as the server did. The server reads live in
 * `_members/member-api.ts` (which is `server-only`), so the schemas cannot live
 * with them; keeping them in a pure module is what lets both sides share one
 * definition. Same reason, same split, as the catalog lane.
 *
 * ── The rules that are ENFORCED here, and why each one is not optional ─────
 *   - `coverUrl` must be app-relative `/media/{assetKey}.{variant}` (shape:
 *     `MEDIA_URL_PATTERN`, shared). Anything else becomes `null` so a tile
 *     draws its placeholder instead of fetching an origin the API chose
 *     (THREAT T-11: the key is a capability).
 *   - `chapter: null` is a REAL state, not a missing field: the FK is
 *     `ON DELETE SET NULL`, so the row is retained with the jump disabled
 *     (DATA_MODEL §13/§14, NFR-DATA-005). Every chapter field is therefore
 *     nullable, and the pages say the state in words.
 *   - `pageNumber: null` means the chapter's first page, which is a real
 *     position (shared/contracts/library.ts) — not "unknown".
 *   - `unavailable: true` means the title went unpublished or soft-deleted and
 *     the private entry is RETAINED (EC-ADM-02). The manga block is still
 *     complete, so a tile can show the cover and the title; it just cannot be
 *     opened.
 *
 * ── The rule this file used to copy — now imported ─────────────────────────
 * The `/media/{key}.{variant}` cover rule lived here AND in
 * `discover/catalog-schema.ts` as two copies of one regex. The one home
 * exists now: `MEDIA_URL_PATTERN` in `shared/storage-keys.ts` (T-CATALOG-010,
 * SQ-LIB-5), imported by both lanes. A third copy is a decision, not an
 * accident.
 *
 * Nothing here imports server or feature code: it is shapes only.
 */
import { z } from 'zod';
import type { ChapterId, MangaId, MangaSlug } from '../../shared/types';
import { MEDIA_URL_PATTERN } from '../../shared/storage-keys';

/**
 * The wire carries a string; the domain type is branded (shared/types/ids.ts).
 * The cast is sound by construction — a `BRAND` is a `declare`d symbol with no
 * runtime representation, so a branded id IS its string at runtime — and doing it
 * here rather than at each call site means a `ChapterId` can never be passed
 * where a `MangaId` belongs anywhere downstream of the wire.
 */
const mangaId = (value: string): MangaId => value as MangaId;
const mangaSlug = (value: string): MangaSlug => value as MangaSlug;
const chapterId = (value: string): ChapterId => value as ChapterId;

/** Every timestamp in this lane is ISO-8601 UTC (NFR-DATA-006). */
const isoDate = z.string().min(1);

/**
 * `chapter.number` is `numeric(8,2)`, so a special chapter "10.5" is legal and
 * must survive the round trip (ADR-003 R2; the same note in
 * `discover/catalog-schema.ts`). Coerced rather than asserted, because a driver
 * may hand over the string form.
 */
const chapterNumber = z.coerce.number();

/** A whole-number field that is a COUNT or a PAGE, never a measurement. */
const wholeNumber = z.coerce.number().int();

/** See the header: an off-shape URL degrades to the placeholder, never to a fetch. */
const coverUrlSchema = z
  .string()
  .transform((value) => (MEDIA_URL_PATTERN.test(value) ? value : null))
  .nullable();

/**
 * `MangaSummary` as the shelf carries it (shared/contracts/manga.ts). A
 * library entry's manga block is complete even when the title is unavailable —
 * that is what makes "still on your shelf, cannot be opened" renderable.
 */
const mangaSummary = z.object({
  id: z.string().min(1).transform(mangaId),
  slug: z.string().min(1).transform(mangaSlug),
  title: z.string().min(1),
  status: z.enum(['ongoing', 'completed', 'hiatus']),
  coverUrl: coverUrlSchema,
  latestChapter: z
    .object({
      number: chapterNumber,
      title: z.string().nullable(),
      publishedAt: isoDate,
    })
    .nullable(),
});

/** One page of anything: items, plus the opaque token for the next one. */
function page<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().min(1).nullable() });
}

/* ── /api/library ──────────────────────────────────────────────────────────── */

/** `LibraryEntry` (FR-LIBRARY-003/004/006). */
export const libraryEntrySchema = z.object({
  manga: mangaSummary,
  addedAt: isoDate,
  /**
   * `null` is the ABSENCE of a progress row: a title added and never opened, a
   * real state the page names rather than a gap it papers over.
   */
  lastRead: z
    .object({
      chapterNumber,
      pageNumber: wholeNumber,
      at: isoDate,
    })
    .nullable(),
  /** Published − completed, computed in one statement (T-LIB-002, no N+1). */
  unreadChapterCount: wholeNumber.nonnegative(),
  /** EC-ADM-02: unpublished or soft-deleted, entry retained, reading 404s. */
  unavailable: z.boolean(),
});

export const libraryPageSchema = page(libraryEntrySchema);

/* ── /api/bookmarks ────────────────────────────────────────────────────────── */

/**
 * The chapter a mark points at. `null` is the deleted-chapter case, so it is the
 * whole of the `bookmark.chapter_id ON DELETE SET NULL` rule: the row is kept,
 * the jump is not offered, and the page says why in words (NFR-DATA-005).
 */
const chapterRef = z.object({
  id: z.string().min(1).transform(chapterId),
  number: chapterNumber,
  mangaSlug: z.string().min(1).transform(mangaSlug),
  mangaTitle: z.string(),
});

/** `Bookmark` (FR-LIBRARY-009/010). */
export const bookmarkSchema = z.object({
  id: z.string().min(1),
  chapter: chapterRef.nullable(),
  /**
   * Deliberately `int()` and NOT `positive()`. DATA_MODEL §14 gives
   * `bookmark.page_number` no `>= 1` CHECK, and schema.ts records that as a live
   * spec-question — the model is followed literally. A bound invented HERE would
   * reject a whole list because of one row the spec permits, and the reader
   * would see "your bookmarks are unavailable" instead of their bookmarks.
   */
  pageNumber: z.number().int().nullable(),
  /** Plain text, ≤ 280 characters (NFR-SEC-016). Rendered as a text node. */
  note: z.string(),
  createdAt: isoDate,
});

export const bookmarkPageSchema = page(bookmarkSchema);

/* ── /api/history ──────────────────────────────────────────────────────────── */

/** `HistoryEntry` (FR-LIBRARY-008, FR-READER-015). */
export const historyEntrySchema = z.object({
  chapter: chapterRef.nullable(),
  deepestPage: wholeNumber,
  startedAt: isoDate,
  /** `null` is an OPEN session (tab never closed cleanly), not a missing field. */
  endedAt: isoDate.nullable(),
  durationMs: z.number().nullable(),
});

export const historyPageSchema = page(historyEntrySchema);
