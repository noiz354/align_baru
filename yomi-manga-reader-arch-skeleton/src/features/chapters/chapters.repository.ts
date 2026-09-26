/**
 * ChapterRepository port (features/chapters owns the aggregate rules;
 * server/db implements against DATA_MODEL §9–10).
 *
 * Requirements: FR-CHAPTER-001…004, FR-CATALOG-007, FR-READER-016,
 * NFR-PERF-004/014.
 * Tasks: T-CATALOG-001 (implementation), INT-CHAP-001.
 *
 * Invariants:
 * - Order is `reading_order` (explicit tiebreaker, FR-CHAPTER-004);
 *   `(manga_id, reading_order)` is the UNIQUE hot-path index
 *   (NFR-PERF-014, T-PERF-004 EXPLAIN gate).
 * - Page lists are ascending pageNumber, PK range scan, ONE query
 *   (no N+1; 500-page list ≈ 60 KB, T-READER-002 budget).
 * - Draft visibility: published chapters public (manga must also be
 *   visible); drafts admin-only (FR-CHAPTER-002).
 * - Contiguity: at "ready", pages are exactly 1..N (DATA_MODEL §21.2) —
 *   the commit path enforces it; reads assume it and alert on violation
 *   (500 + ops alert, T-READER-002).
 */
import type { CallerContext, ChapterPageRecord, ChapterPagesResponse, ChapterSummary } from '../../shared/contracts';
import type { ChapterId, MangaId } from '../../shared/types';

export interface ChapterRepository {
  /** Ordered list for a manga (visibility-aware: caller decides drafts). */
  listByManga(mangaId: MangaId, caller: CallerContext): Promise<ChapterSummary[]>;

  byId(id: ChapterId, caller: CallerContext): Promise<ChapterSummary | null>;

  /** Page list (ordered) + prev/next published neighbors (FR-READER-016). */
  pageList(id: ChapterId, caller: CallerContext): Promise<ChapterPagesResponse | null>;

  /** Raw page records (server-side: commit verification, media GC). */
  pageRecords(chapterId: ChapterId): Promise<ChapterPageRecord[]>;

  create(input: {
    mangaId: MangaId;
    number: number; // numeric(8,2)
    title: string | null;
    notes: string;
  }): Promise<ChapterId>;

  update(id: ChapterId, patch: Partial<{ number: number; title: string | null; notes: string }>): Promise<void>;

  softDelete(id: ChapterId): Promise<void>;
  setPublished(id: ChapterId, published: boolean): Promise<void>;

  /**
   * The atomic commit used by the upload pipeline (FR-UPLOAD-006):
   * insert the full 1..N page set + update chapter.page_count in ONE
   * transaction. Re-ingest variant replaces the set (old rows deleted,
   * old asset keys returned for GC queuing — T-UPLOAD-009).
   *
   * Edge cases (T-UPLOAD-007): contiguity assertion; manga-deleted race
   * (typed failure); concurrent commit (advisory lock — T-UPLOAD-006).
   */
  commitPages(input: {
    chapterId: ChapterId;
    pages: Array<{ pageNumber: number; assetKey: string; width: number; height: number; byteSizeAvif: number | null; byteSizeWebp: number | null; byteSizeJpeg: number | null }>;
    replace: boolean;
  }): Promise<{ replacedAssetKeys: string[] }>;

  countByManga(mangaId: MangaId): Promise<number>;
  countAll(): Promise<number>; // stats
  countPages(): Promise<number>; // stats
}
