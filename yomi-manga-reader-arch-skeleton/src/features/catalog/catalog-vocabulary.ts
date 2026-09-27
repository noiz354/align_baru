/**
 * The catalog VOCABULARY port (T-CATALOG-002, `GET /api/v1/catalog/facets`).
 *
 * The catalog filter UI needs the genre and tag vocabularies to render its
 * controls, and T-CATALOG-004 (the catalog page) consumes this endpoint rather
 * than importing a repository. No existing port exposes the vocabulary:
 * `MangaRepository` lists and resolves titles, `SearchRepository` ranks hits —
 * neither returns a vocabulary. So the port is declared HERE, in the feature
 * that owns the consumer (dependency-rules.md §2: a feature owns its own ports;
 * the DAG stays acyclic because nothing imports this but the web layer).
 *
 * ── Deliberately NO counts (task scope) ───────────────────────────────────
 * T-CATALOG-002's task text puts counts out of scope, and this port therefore
 * has no `count` anywhere in it. That is also the cheaper read: a count per
 * genre means an aggregate over the whole `manga_genre` join on a public
 * endpoint, which is a different query and a different index. If a future task
 * wants counts, it adds them here with its own NFR-PERF-014 index note — it
 * does not grow this read.
 *
 * ── Visibility (EC-SE-03 analogue) ────────────────────────────────────────
 * The vocabulary is the FILTER's vocabulary, so it must list genres that can
 * actually produce results. `onlyUsed` narrows it to genres/tags currently
 * linked to at least one visible manga (`published ∧ ¬deleted`); the rule
 * itself lives in features/manga and is reused by the implementation, never
 * re-derived per query site.
 *
 * Requirements: FR-CATALOG-002, FR-SEARCH-003, NFR-PERF-004/014.
 * Tasks: T-CATALOG-002 (port + endpoint), T-CATALOG-004 (consumer).
 * Implementation: server/db (NOT yet written — T-CATALOG-001's lane owns
 * `server/db/repositories/**` and did not include a vocabulary read; until it
 * lands, the composition root has nothing to register here. Recorded as a
 * follow-up, not worked around in product code).
 */
import type { Genre, Tag } from '../../shared/contracts';

export interface CatalogVocabularyQuery {
  /**
   * Restrict to vocabulary rows linked to at least one VISIBLE manga. Default
   * `true` (a control that can only ever return 0 results is not a filter).
   */
  readonly onlyUsed?: boolean;
}

export interface CatalogFacets {
  readonly genres: Genre[];
  readonly tags: Tag[];
}

export interface CatalogVocabularyPort {
  /**
   * The whole genre and tag vocabulary in one read each (two bounded queries
   * total — the tables are controlled-vocabulary sized, DATA_MODEL §6/§7, and
   * both are covered by their own unique-name index).
   */
  listVocabulary(query: CatalogVocabularyQuery): Promise<CatalogFacets>;
}
