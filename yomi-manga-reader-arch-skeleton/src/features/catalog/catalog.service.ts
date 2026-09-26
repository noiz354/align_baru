/**
 * features/catalog — CatalogService: query composition for the public
 * catalog (list, detail, chapter list, resume).
 *
 * Responsibility: combine manga/chapter/progress reads into the public
 * DTOs; cursor/filter/sort composition; the "continue reading" resolution
 * (FR-CATALOG-008, shared with the library home list).
 *
 * Requirements: FR-CATALOG-001…008, FR-CHAPTER-002, NFR-PERF-004.
 * Tasks: T-CATALOG-002 (list), T-CATALOG-006 (detail), T-CATALOG-007
 * (chapter list), T-CATALOG-009 (resume resolution).
 *
 * Rules:
 * - Catalog logic is PURE w.r.t. auth: it receives an optional
 *   `CallerContext` (data-flow.md §1) — the WEB layer applies guards;
 *   catalog never imports features/auth (DAG rule).
 * - `latestChapter`/`firstChapter` are computed in ONE query (no N+1,
 *   NFR-PERF-004/014).
 * - Hidden manga (unpublished/deleted) resolve as 404-shaped nulls
 *   (no existence leak — API_CONTRACT §1).
 */
import type { CallerContext, CatalogQuery } from './catalog.repository';
import type { MangaDetail, MangaSummary, ChapterSummary } from '../../shared/contracts';
import type { MangaSlug } from '../../shared/types';

export interface CatalogService {
  list(query: CatalogQuery): Promise<{ items: MangaSummary[]; nextCursor: string | null }>;

  detail(slug: MangaSlug, caller: CallerContext): Promise<MangaDetail | null>;

  chapterList(slug: MangaSlug, caller: CallerContext): Promise<ChapterSummary[] | null>;

  /**
   * Resume resolution (FR-CATALOG-008): given caller + manga →
   * last-read chapter + page/scroll, or null.
   * Rules (T-CATALOG-009):
   * - deepest STARTED position (not completed-only)
   * - completed manga → next UNREAD chapter (if any) else null
   * - progress on a deleted chapter → skip to previous valid
   * - anonymous caller → null (no error)
   * TODO(T-CATALOG-009).
   */
  resolveResume(mangaId: string, caller: CallerContext): Promise<{
    chapterId: string;
    chapterNumber: number;
    pageNumber: number;
    scrollOffset: number;
  } | null>;
}

/**
 * TODO(T-CATALOG-002): factory wired at the composition root with
 * MangaRepository, ChapterRepository, ProgressReader ports.
 */
export function createCatalogService(deps: {
  manga: import('../manga').MangaRepository;
  chapters: import('../chapters').ChapterRepository;
  progress: import('../progress').ProgressReader;
}): CatalogService {
  throw new Error('Not implemented: T-CATALOG-002 (catalog service wiring)');
}
