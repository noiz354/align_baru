/**
 * features/search — SearchService: query parsing, ranking, assembly.
 *
 * Responsibility: the public search contract (FR-SEARCH-001…005) — parse
 * the query, compose the ranked multi-field search (title/alias trigram +
 * creator/tag names), paginate, and shape SearchHit rows.
 *
 * Requirements: FR-SEARCH-001…004, NFR-PERF-005, NFR-SEC-015.
 * Tasks: T-SEARCH-001 (service + API), T-SEARCH-003 (ranking),
 * T-SEARCH-005 (limits + load + injection).
 *
 * Rules:
 * - The query string is DATA, never SQL (parameterized through
 *   SearchRepository; T-02 injection fuzz is a gate).
 * - q: trimmed, 1..120 chars; empty/overlong ⇒ SEARCH_QUERY_INVALID (422).
 * - CJK: 1–2 char queries use the prefix path only (EC-SE-04); CJK titles
 *   also match by prefix (EC-SE-01).
 * - Ranking is a PURE function (T-SEARCH-003, UNIT-SEARCH-001):
 *   exact > prefix > contains(similarity) > creator/tag; tie-break
 *   title A–Z, then id (deterministic, integer scores — no float drift).
 * - Deleted/unpublished manga never match (EC-SE-03 — visibility rule).
 * - Rate limit 30/min/IP applied at the route (NFR-SEC-006), not here.
 */
import type { SearchHit } from '../../shared/contracts/search';

export interface SearchService {
  search(input: { q: string; cursor?: string; limit?: number }): Promise<{
    items: SearchHit[];
    nextCursor: string | null;
  }>;
}

/**
 * TODO(T-SEARCH-001): factory (wired with SearchRepository port).
 */
export function createSearchService(deps: {
  search: import('./search.repository').SearchRepository;
}): SearchService {
  throw new Error('Not implemented: T-SEARCH-001 (search service wiring)');
}
