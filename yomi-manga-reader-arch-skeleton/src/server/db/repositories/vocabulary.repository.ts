/**
 * server/db/repositories — the `CatalogVocabularyPort` implementation
 * (T-CATALOG-012), the read behind `GET /api/v1/catalog/facets`.
 *
 * Why this file had to exist: `features/catalog/catalog-vocabulary.ts` declared
 * the port and T-CATALOG-002 built the endpoint, but the only working read lived
 * under `tests/integration/support/`. The composition root had nothing to
 * register, so `CatalogService.facets()` reported a missing port and a public
 * endpoint answered 500. A test-only implementation of a port is not a port.
 *
 * Authority: DATA_MODEL.md §6 (`genre`), §7 (`tag`), §8 (the join tables);
 * the `CatalogVocabularyPort` contract in `features/catalog/catalog-vocabulary.ts`
 * (its scope rules are binding); API_CONTRACT.md §2.1 (the facets response).
 *
 * Requirements: FR-CATALOG-002, FR-SEARCH-003, NFR-PERF-004/014,
 * NFR-SEC-015, NFR-DATA-001.
 * Tasks: T-CATALOG-012 (this file + the composition registration),
 * T-CATALOG-002 (the port and endpoint it serves), T-CATALOG-004 (the consumer).
 *
 * ── Visibility is REUSED, never restated ───────────────────────────────────
 * `onlyUsed` asks "is this vocabulary row reachable from a public catalog
 * result?", and the answer is the visibility rule. This module calls
 * {@link mangaVisibleWhere} — the SQL rendering of `features/manga`'s single
 * `isMangaVisible` definition — rather than writing `published = true AND
 * deleted_at IS NULL` a third time. A hidden title's private genre therefore
 * cannot widen the public vocabulary, and a new visibility axis added to
 * `MANGA_VISIBILITY_CLAUSES` reaches this read for free.
 *
 * ── Two reads, no counts ──────────────────────────────────────────────────
 * One bounded select per table. `genre`/`tag` are controlled-vocabulary sized
 * (DATA_MODEL §6/§7) and each carries its own unique-name index, so the scan is
 * an index range, not a table walk. NO counts: T-CATALOG-002 puts them out of
 * scope, and a per-genre count is a different aggregate over the join — not a
 * column added to this read.
 *
 * ── `IN (subquery)` and why it is not N+1 ─────────────────────────────────
 * `onlyUsed` uses a semi-join (`WHERE id IN (SELECT … FROM manga_genre JOIN
 * manga …)`), which PostgreSQL resolves as a hash or nested-loop semi-join over
 * two indexed reads. It is ONE statement per table, not one per genre: the
 * subquery is evaluated once per query, not once per row of the outer table.
 * That is the distinction NFR-PERF-014 asks about, and INT-CAT-003's statement
 * assertions (via the harness probe) are the proof rather than this comment.
 */
import { asc, eq, inArray } from 'drizzle-orm';

import type { CatalogFacets, CatalogVocabularyPort } from '../../../features/catalog';
import type { Genre, Tag } from '../../../shared/contracts';
import type { Db } from '../client';
import { genre, manga, mangaGenre, mangaTag, tag } from '../schema';
import { mangaVisibleWhere } from './manga.repository';

/** The distinct genre ids carried by at least one VISIBLE manga. */
function usedGenreIds(db: Db) {
  return db
    .select({ id: mangaGenre.genreId })
    .from(mangaGenre)
    .innerJoin(manga, eq(manga.id, mangaGenre.mangaId))
    .where(mangaVisibleWhere());
}

/** The distinct tag ids carried by at least one VISIBLE manga. */
function usedTagIds(db: Db) {
  return db
    .select({ id: mangaTag.tagId })
    .from(mangaTag)
    .innerJoin(manga, eq(manga.id, mangaTag.mangaId))
    .where(mangaVisibleWhere());
}

/**
 * Builds the vocabulary port over a live Drizzle handle.
 *
 * @param db the application pool from `createDb` (composed at the root; never
 *   constructed at import time)
 * @returns the port
 */
export function createGenreTagVocabularyPort(db: Db): CatalogVocabularyPort {
  return {
    /**
     * FR-CATALOG-002. `onlyUsed` defaults to `true` here as well as on the
     * port, so a caller that omits the flag gets the narrowing rather than the
     * whole table — the safe direction for a public endpoint.
     */
    async listVocabulary(query): Promise<CatalogFacets> {
      const onlyUsed = query.onlyUsed ?? true;
      const [genreRows, tagRows] = await Promise.all([
        db
          .select({ id: genre.id, name: genre.name })
          .from(genre)
          .where(onlyUsed ? inArray(genre.id, usedGenreIds(db)) : undefined)
          .orderBy(asc(genre.name)),
        db
          .select({ id: tag.id, name: tag.name })
          .from(tag)
          .where(onlyUsed ? inArray(tag.id, usedTagIds(db)) : undefined)
          .orderBy(asc(tag.name)),
      ]);
      return {
        genres: genreRows.map((row): Genre => ({ id: row.id, name: row.name })),
        tags: tagRows.map((row): Tag => ({ id: row.id, name: row.name })),
      };
    },
  };
}
