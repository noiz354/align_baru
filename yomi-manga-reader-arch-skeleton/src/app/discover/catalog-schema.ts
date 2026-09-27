/**
 * The catalog contract schemas — the one place the API's shapes are parsed.
 *
 * Requirements: FR-CATALOG-001…007, NFR-SEC-010/016, NFR-SEC-007 (script-safe
 * rendered text), THREAT T-11 (an asset key is a capability).
 * Tasks: T-CATALOG-003/004/006/008.
 * Spec: API_CONTRACT §2.1, shared/contracts/{manga,chapter}.ts.
 *
 * ── Why the schemas live apart from the reads ─────────────────────────────
 * Two callers need them and they run in different places: the Server Component
 * validates everything it renders, and the client island validates the one page
 * it appends after a "load more". The reads themselves are `server-only`, so the
 * schemas cannot live with them. Keeping them in a pure module is what lets the
 * page and the island share ONE definition of the contract instead of two that
 * drift.
 *
 * Nothing here imports server or feature code: it is shapes only.
 */
import { z } from 'zod';
import type { ChapterId, MangaId, MangaSlug } from '../../shared/types';

/**
 * The wire is a string; the domain type is branded (shared/types/ids.ts). This
 * is the ONE place that difference is reconciled, and the cast is sound by
 * construction: `BRAND` is a `declare`d symbol with no runtime representation,
 * so a branded id IS its string at runtime. Doing it here rather than at each
 * call site means a `ChapterId` can never be passed where a `MangaId` belongs
 * anywhere downstream of the boundary.
 */
const mangaId = (value: string): MangaId => value as MangaId;
const mangaSlug = (value: string): MangaSlug => value as MangaSlug;
const chapterId = (value: string): ChapterId => value as ChapterId;

/** API_CONTRACT §2.1 `status?`. */
export const statusSchema = z.enum(['ongoing', 'completed', 'hiatus']);

/** FR-READER-004/005 `reading_direction`. */
export const directionSchema = z.enum(['rtl', 'ltr']);

/**
 * `coverUrl` is app-relative `/media/{assetKey}` — an invariant stated in
 * shared/contracts/manga.ts, and THREAT T-11 makes the key a capability. A value
 * that is not of that form is transformed to `null`, so the card renders the
 * placeholder instead of fetching an origin the API chose. Dropping the field is
 * the safe failure: a wrong image is a worse defect than a missing one.
 */
const coverUrlSchema = z
  .string()
  .transform((value) => (/^\/media\/[A-Za-z0-9_-]{6,64}$/.test(value) ? value : null))
  .nullable();

/** `numeric(8,2)` arrives as a number, but a driver may hand over a string. */
const chapterNumber = z.coerce.number();

export const mangaSummarySchema = z.object({
  id: z.string().min(1).transform(mangaId),
  slug: z.string().min(1).transform(mangaSlug),
  title: z.string().min(1),
  status: statusSchema,
  coverUrl: coverUrlSchema,
  latestChapter: z
    .object({
      number: chapterNumber,
      title: z.string().nullable(),
      publishedAt: z.string().min(1),
    })
    .nullable(),
});

export const mangaDetailSchema = mangaSummarySchema.extend({
  aliases: z.array(z.string()),
  // Plain text, never markup (NFR-SEC-016, THREAT T-01). The page renders it as
  // a text node, so this stays a string all the way to the DOM.
  synopsis: z.string(),
  readingDirection: directionSchema,
  chapterCount: z.coerce.number().int().nonnegative(),
  firstChapter: z.object({ id: z.string().min(1), number: chapterNumber }).nullable(),
  creators: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.enum(['author', 'artist', 'other']),
    }),
  ),
  genres: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  tags: z.array(z.object({ id: z.string().min(1), name: z.string().min(1) })),
  createdAt: z.string().min(1),
  // FR-CATALOG-008 / T-CATALOG-009 has NOT landed, so `continueReading` is not
  // in the contract yet and is not parsed here. When it does, it is OPTIONAL:
  // absent for anonymous callers, never null (shared/contracts/manga.ts).
});

export const chapterSummarySchema = z.object({
  id: z.string().min(1).transform(chapterId),
  number: chapterNumber,
  title: z.string().nullable(),
  pageCount: z.coerce.number().int().nonnegative(),
  /** null for a draft (shared/contracts/chapter.ts) — which is how the UI knows
   *  to label one, since `status` itself is not in the list payload. */
  publishedAt: z.string().nullable(),
});

export const catalogPageSchema = z.object({
  items: z.array(mangaSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const chapterListSchema = z.object({
  items: z.array(chapterSummarySchema),
});

/**
 * `GET /api/v1/catalog/facets` (T-CATALOG-004).
 *
 * SPEC-QUESTION, recorded rather than guessed (AGENTS.md §6): this operation is
 * named in TASKS.md ("a small addition, same contract file") but has NO row in
 * API_CONTRACT §2.1, and DATA_MODEL §6 gives Genre an `id` plus a unique `name`
 * with no `slug` column — while the catalog operation filters by slug. The
 * reading implemented here: the facets response carries a `slug` per genre
 * derived server-side from that unique name, and the UI treats the slug as
 * OPAQUE. It never derives, normalises or guesses one, so when the contract row
 * lands the fix is confined to this schema. `items` is accepted as a synonym
 * for `genres` so a differently-spelled handler degrades to a working filter
 * instead of a silently empty one.
 */
export const facetsSchema = z.union([
  z.object({
    genres: z.array(z.object({ slug: z.string().min(1), name: z.string().min(1) })),
  }),
  z.object({
    items: z.array(z.object({ slug: z.string().min(1), name: z.string().min(1) })),
  }),
]);

/** One genre as the filter needs it. */
export interface GenreFacet {
  readonly slug: string;
  readonly name: string;
}

/** The facets payload, whichever spelling arrived. */
export function facetsFrom(parsed: z.infer<typeof facetsSchema>): GenreFacet[] {
  return 'genres' in parsed ? parsed.genres : parsed.items;
}
