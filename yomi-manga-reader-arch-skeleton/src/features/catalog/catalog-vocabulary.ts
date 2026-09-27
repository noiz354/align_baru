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
 * Tasks: T-CATALOG-002 (port + endpoint), T-CATALOG-004 (consumer),
 * T-CATALOG-012 (the read; it also carries the derived slug — see GenreFacet).
 * Implementation: `server/db/repositories/vocabulary.repository.ts`
 * (T-CATALOG-012), registered by the composition root. It was written ONLY in
 * the test harness for a while, which left this public endpoint answering 500
 * in production while its integration tests were green — so the harness now
 * imports the product factory rather than keeping a second copy.
 */
export interface CatalogVocabularyQuery {
  /**
   * Restrict to vocabulary rows linked to at least one VISIBLE manga. Default
   * `true` (a control that can only ever return 0 results is not a filter).
   */
  readonly onlyUsed?: boolean;
}

/**
 * One genre as the FILTER control needs it: the row plus the slug the request
 * vocabulary uses.
 *
 * Why the slug travels in the response when `Genre` (the shape inside
 * `MangaDetail`) does not carry it:
 *
 * - API_CONTRACT §2.1 gives the catalog filter a csv of **slugs**, and
 *   `T-CATALOG-004`'s control has to put one on the wire. A response of
 *   `{ id, name }` therefore leaves the client with a choice: send `id` (which
 *   the filter does not accept) or re-derive the slug itself.
 * - Re-deriving is what broke. The rule already exists twice — TypeScript
 *   (`normaliseGenreSlug`) and SQL (`genreSlugSql`) — and the discover page
 *   added a third expectation of it in `facetsSchema`, which then FAILED to
 *   parse a perfectly correct `200` and rendered "the genre list could not be
 *   loaded". A third copy of a rule is a third chance to disagree.
 * - The server already computes the slug (it has to, to filter). Emitting it
 *   costs one selected column and makes the round trip exact.
 *
 * So: the derivation has ONE definition, the server applies it, and the client
 * sends back what it was given.
 *
 * The detail page needs no slug — it renders `name` only — which is why
 * `MangaDetail.genres` stays `Genre[]`.
 *
 * Requirements: FR-CATALOG-002, API_CONTRACT §2.1.
 * Tasks: T-CATALOG-012 (the read), T-CATALOG-004 (the consumer).
 */
export interface GenreFacet {
  readonly id: string;
  readonly name: string;
  /** The name-derived slug the catalog filter accepts (`genreSlugSql`). */
  readonly slug: string;
}

/** One tag, with the same reasoning as {@link GenreFacet}. */
export interface TagFacet {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface CatalogFacets {
  readonly genres: GenreFacet[];
  readonly tags: TagFacet[];
}

export interface CatalogVocabularyPort {
  /**
   * The whole genre and tag vocabulary in one read each (two bounded queries
   * total — the tables are controlled-vocabulary sized, DATA_MODEL §6/§7, and
   * both are covered by their own unique-name index).
   */
  listVocabulary(query: CatalogVocabularyQuery): Promise<CatalogFacets>;
}
