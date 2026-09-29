/**
 * The search response shape, as the page reads it (T-SEARCH-001, F-012-S1).
 *
 * This is the page's OWN parse of the API's answer — not an import of the
 * contract — for the same reason `catalog-schema.ts` re-states the catalog
 * shapes: the page must be able to reject a body that grew a field or lost one,
 * rather than rendering whatever arrived. Zod `.strip()` (the default) drops
 * what it does not know, so a future `totalHint` will not break this parse and
 * will not leak into the island either.
 *
 * Requirements: FR-SEARCH-001…004. Tasks: T-SEARCH-001, T-SEARCH-004.
 */
import { z } from 'zod';

export const searchHitSchema = z.object({
  kind: z.enum(['manga', 'creator', 'tag']),
  id: z.string().min(1),
  slug: z.string().min(1).nullable(),
  title: z.string().min(1),
  matchField: z.enum(['title', 'alias', 'creator', 'tag']),
  band: z.enum(['exact', 'prefix', 'contains', 'related']),
});

export const searchResponseSchema = z.object({
  items: z.array(searchHitSchema),
  nextCursor: z.string().nullable(),
});

export type SearchHitView = z.infer<typeof searchHitSchema>;
