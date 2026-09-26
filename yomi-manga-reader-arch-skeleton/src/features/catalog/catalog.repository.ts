/**
 * Catalog query types (re-exported for the service + web layer).
 * The query types live with the catalog service's contract; the repository
 * ports themselves are owned by features/manga and features/chapters
 * (dependency-rules.md §2: catalog uses those ports, not its own copy).
 */
import type { MangaStatus } from '../../shared/contracts';

export interface CatalogQuery {
  cursor?: string;
  limit?: number; // default 24, ≤ 48
  genres?: string[]; // ≤ 5 slugs
  status?: MangaStatus;
  sort?: 'title_asc' | 'updated_desc' | 'added_desc'; // default updated_desc
}

export type { CallerContext } from '../../shared/contracts';
