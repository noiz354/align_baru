/**
 * Chapter & page contracts (the reader's data surface).
 *
 * Authority: DATA_MODEL.md §9–10, API_CONTRACT.md §2.1 (pages op).
 * Requirements: FR-CHAPTER-001…004, FR-READER-019/020, FR-MEDIA-002/003,
 * NFR-PERF-004/008/009.
 * Tasks: T-CATALOG-001 (repo), T-READER-002 (page API), T-CATALOG-010 (media).
 *
 * Invariants:
 * - `pageNumber` is 1-based and contiguous 1..N at "ready" state
 *   (DATA_MODEL §21.2) — the reader and progress APIs depend on this.
 * - Page lists are returned in ascending pageNumber; the READER applies
 *   direction (RTL reads the same list reversed — reader-behavior.md §4).
 * - `assetKey` values are unguessable and layout-free (FR-MEDIA-003);
 *   variant URLs are app-relative `/media/{assetKey}` paths.
 */
import type { AssetKey, ChapterId, MangaSlug } from '../types';

export type ChapterStatus = 'draft' | 'published';

/** Chapter list row (FR-CATALOG-007). */
export interface ChapterSummary {
  id: ChapterId;
  number: number; // numeric(8,2): 10.5 is legal
  title: string | null;
  pageCount: number; // denormalized (NFR-PERF-014)
  publishedAt: string | null; // null for drafts
}

/**
 * One page as delivered to the reader (PageAsset, API_CONTRACT §2.1).
 * The three variant URLs are the `<picture>` ladder (FR-MEDIA-002):
 * AVIF primary → WebP fallback → JPEG final fallback.
 *
 * NOTE: `assetKey` itself is server-internal (used by the media route);
 * client DTOs expose the variant URLs only — the raw key never needs to
 * reach the browser beyond the URL path.
 */
export interface PageAsset {
  pageNumber: number; // 1-based
  urlAvif: string; // /media/{key}
  urlWebp: string;
  urlJpeg: string;
  width: number;
  height: number;
}

/**
 * Page list response (T-READER-002): one call, no per-page APIs
 * (NFR-PERF-008). `prevChapter`/`nextChapter` support FR-READER-016
 * (neighbor slugs + titles, published-only for non-admins).
 */
export interface ChapterPagesResponse {
  chapter: {
    id: ChapterId;
    mangaSlug: MangaSlug;
    mangaTitle: string;
    number: number;
    title: string | null;
    readingDirection: 'rtl' | 'ltr';
    pageCount: number;
  };
  pages: PageAsset[];
  prevChapter: { slug: MangaSlug; number: number; title: string | null } | null;
  nextChapter: { slug: MangaSlug; number: number; title: string | null } | null;
}

/**
 * Storage-backed page record (server-side view, DATA_MODEL §10).
 * `assetKey` invariants: 128-bit random, never filename-derived,
 * never logged (NFR-OBS-006).
 */
export interface ChapterPageRecord {
  id: string;
  chapterId: ChapterId;
  pageNumber: number;
  assetKey: AssetKey;
  width: number;
  height: number;
  byteSizeAvif: number | null;
  byteSizeWebp: number | null;
  byteSizeJpeg: number | null;
}
