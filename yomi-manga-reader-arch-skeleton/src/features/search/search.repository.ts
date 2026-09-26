/**
 * SearchRepository port (features/search owns the rules; server/db
 * implements the trigram query against DATA_MODEL §19).
 *
 * Requirements: FR-SEARCH-001…004, NFR-PERF-005/014.
 * Tasks: T-SEARCH-001 (query), T-SEARCH-002 (indexes/EXPLAIN),
 * T-PERF-004 (the query joins the EXPLAIN gate list).
 *
 * Implementation constraints (the EXPLAIN gate will check these):
 * - GIN trigram indexes on manga.title + manga_alias.alias (pg_trgm)
 *   — no seq scan at 10k rows (T-SEARCH-002).
 * - One composed query (per-field weighted UNION) — no N+1 fan-out.
 * - Visibility filter (published ∧ ¬deleted) IN the query (EC-SE-03).
 * - p95 ≤ 400 ms at 10k titles (T-SEARCH-005 load test).
 */
export interface SearchRepository {
  /**
   * Raw ranked rows (before SearchService shaping): field, weight-band,
   * target id/slug/title. `q` is parameterized — the trigram operators
   * (% / similarity) and the prefix path (LIKE 'q%') are the ONLY
   * query shapes (no dynamic SQL, NFR-SEC-015).
   */
  searchRaw(input: {
    q: string;
    limit: number;
    cursor: string | null;
  }): Promise<{
    rows: Array<{
      kind: 'manga' | 'creator' | 'tag';
      id: string;
      slug: string | null;
      title: string;
      matchField: 'title' | 'alias' | 'creator' | 'tag';
      /** Integer score band (T-SEARCH-003 weights). */
      band: 'exact' | 'prefix' | 'contains' | 'related';
      score: number;
    }>;
    nextCursor: string | null;
  }>;
}
