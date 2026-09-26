/**
 * Search DTOs (API_CONTRACT §2.2).
 * Requirements: FR-SEARCH-001…004. Tasks: T-SEARCH-001/003/004.
 */

export interface SearchHit {
  /** What matched (client renders a hint: "title" vs "tag"…). */
  kind: 'manga' | 'creator' | 'tag';
  id: string;
  /** For manga hits: the detail-page slug (creator/tag: null — v1 has no creator/tag browse pages). */
  slug: string | null;
  title: string;
  matchField: 'title' | 'alias' | 'creator' | 'tag';
  /** Deterministic band (T-SEARCH-003). */
  band: 'exact' | 'prefix' | 'contains' | 'related';
}
