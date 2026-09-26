/**
 * Manga domain contracts (catalog surface).
 *
 * Authority: DATA_MODEL.md §3–8, API_CONTRACT.md §2.1.
 * Requirements: FR-CATALOG-001…006, FR-SEARCH-001/002/003, FR-ADMIN-001.
 * Tasks: T-CATALOG-001 (repository), T-CATALOG-002/006 (services/pages).
 *
 * Rules:
 * - DTOs are the only manga shapes crossing module boundaries (data-flow.md §7).
 * - `synopsis` is PLAIN TEXT (never HTML — NFR-SEC-016, THREAT T-01).
 * - Visibility rule `published && !deleted` lives in features/manga (single
 *   function, unit-tested) — NOT re-implemented per query site.
 */
import type { MangaId, MangaSlug } from '../types';

export type MangaStatus = 'ongoing' | 'completed' | 'hiatus';
/** Reading direction of the title (FR-READER-004/005). */
export type ReadingDirection = 'rtl' | 'ltr';
export type CreatorRole = 'author' | 'artist' | 'other';

export interface Genre {
  id: string;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Creator {
  id: string;
  name: string;
  role: CreatorRole;
}

/**
 * Catalog card shape (FR-CATALOG-005).
 * Invariants:
 * - `coverUrl` is app-relative `/media/{assetKey}` — never a storage URL.
 * - `latestChapter` is null for manga with no published chapters.
 */
export interface MangaSummary {
  id: MangaId;
  slug: MangaSlug;
  title: string;
  status: MangaStatus;
  coverUrl: string | null;
  latestChapter: {
    number: number;
    title: string | null;
    publishedAt: string; // ISO-8601 UTC
  } | null;
}

/**
 * Full detail shape (FR-CATALOG-006) — everything the detail page renders.
 * `continueReading` is present only for authenticated callers with progress
 * (FR-CATALOG-008); absent for anonymous callers (not null — optional).
 */
export interface MangaDetail extends MangaSummary {
  aliases: string[];
  synopsis: string;
  readingDirection: ReadingDirection;
  chapterCount: number;
  firstChapter: { id: string; number: number } | null;
  creators: Creator[];
  genres: Genre[];
  tags: Tag[];
  createdAt: string;
  continueReading?: {
    chapterId: string;
    chapterNumber: number;
    pageNumber: number;
  };
}
