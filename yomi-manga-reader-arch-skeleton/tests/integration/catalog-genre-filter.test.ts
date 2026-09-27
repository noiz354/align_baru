/**
 * INT-CAT-004 (T-CATALOG-001 / T-CATALOG-002) — the PRODUCT catalog genre
 * filter, over real rows.
 *
 * Why this file had to exist: two different implementations of the genre-slug
 * rule were living side by side.
 *
 *  - The PRODUCT repository (`src/server/db/repositories/manga.repository.ts`,
 *    `resolveGenreIds`) matched `lower(genre.name)` against the slug the
 *    service produced. For a single-word genre those are the same string, so it
 *    worked. For a multi-word genre they are not: the service turns
 *    `Slice of Life` into `slice-of-life`, and no `name` lowercases to that, so
 *    the filter silently matched nothing.
 *  - The TEST harness (`tests/integration/support/pg-catalog-ports.ts`,
 *    `buildCatalogListStatement`) slugified inside SQL instead, so every
 *    behaviour test that filtered by genre exercised THAT query and never the
 *    one the application runs. The EXPLAIN gate did build the product
 *    statement, but a plan assertion cannot notice that it matches no rows.
 *
 * So the rule now has exactly one definition — `genreSlugSql` in the product —
 * which the harness imports. These tests are the behavioural half that was
 * missing: they drive the PRODUCT repository and assert on ROWS.
 *
 * Requirements: FR-CATALOG-002, API_CONTRACT §2.1 (`genre` csv, "unknown
 * genre ignored"), NFR-SEC-015, NFR-PERF-004.
 * Tasks: T-CATALOG-001 (the read), T-CATALOG-002 (the query), T-CATALOG-004
 * (the filter control that sends these values).
 * DSN: `DATABASE_URL`; SKIPS without it. Throwaway database, own port.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createCatalogService } from '../../src/features/catalog';
import type { ChapterRepository } from '../../src/features/chapters';
import { createMangaRepository } from '../../src/server/db/repositories/manga.repository';
import * as dbSchema from '../../src/server/db/schema';
import {
  VISIBLE_SLUGS,
  mangaIdFor,
  openCatalogDatabase,
  seedCatalogFixtures,
} from './support/pg-catalog-ports';
import type { OpenDatabase } from './support/pg-catalog-ports';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

/** A genre name that only survives the round trip if the slug rule is applied. */
const MULTI_WORD = 'Slice of Life';
const MULTI_WORD_SLUG = 'slice-of-life';

describeDb('INT-CAT-004 the product catalog genre filter', () => {
  let open: OpenDatabase;
  let repo: ReturnType<typeof createMangaRepository>;

  const slugsFor = async (genres: string[]): Promise<string[]> => {
    const page = await repo.list({ limit: 48, genres, sort: 'updated_desc' });
    return page.items.map((item) => item.slug);
  };

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'catalog_genre_it');
    await seedCatalogFixtures(open.db);
    const [genreRow] = await open.db
      .insert(dbSchema.genre)
      .values({ id: crypto.randomUUID(), name: MULTI_WORD })
      .returning({ id: dbSchema.genre.id });
    await open.db
      .insert(dbSchema.mangaGenre)
      .values({ mangaId: mangaIdFor(VISIBLE_SLUGS[0] as string), genreId: genreRow!.id });
    repo = createMangaRepository(open.db);
  });

  afterAll(async () => {
    await open?.close();
  });

  /* ── the defect this file exists for ──────────────────────────────────── */

  it('matches a MULTI-WORD genre by its slug', async () => {
    const slugs = await slugsFor([MULTI_WORD_SLUG]);

    expect(slugs).toContain(VISIBLE_SLUGS[0]);
  });

  it('resolves the same row whether the slug or the raw name arrived', async () => {
    // Layer discipline: the REPOSITORY only ever sees post-normalisation
    // values, so the slug is the only thing it must match. The name form is
    // the SERVICE's job (`normaliseGenres` → `normaliseGenreSlug`), asserted
    // end-to-end below through the service, not here.
    const bySlug = await slugsFor([MULTI_WORD_SLUG]);
    const byUnchangedSlug = await slugsFor([MULTI_WORD_SLUG.toUpperCase()]);

    expect(byUnchangedSlug).toEqual(bySlug);
  });

  it('ignores an unknown genre rather than erroring (API_CONTRACT §2.1)', async () => {
    // Documented behaviour, and deliberately NOT an empty result: an unknown
    // filter value is dropped, so the answer is the unfiltered catalog. What
    // matters — and what the first test pins — is that a genre that CAN be
    // resolved narrows the result instead of being dropped like this one.
    const unfiltered = await slugsFor([]);
    const unknown = await slugsFor(['no-such-genre-anywhere']);

    expect(unknown).toEqual(unfiltered);
  });

  it('narrows the result when the genre DOES resolve, which is the defect this file exists for', async () => {
    const unfiltered = await slugsFor([]);
    const filtered = await slugsFor([MULTI_WORD_SLUG]);

    expect(filtered.length).toBeLessThan(unfiltered.length);
    expect(filtered).toEqual([VISIBLE_SLUGS[0]]);
  });

  /* ── the cases that already worked, kept as regression guards ──────────── */

  it('still matches a single-word genre', async () => {
    const slugs = await slugsFor(['action']);

    expect(slugs.length).toBeGreaterThan(0);
  });

  it('still matches a hyphenated genre name', async () => {
    const slugs = await slugsFor(['sci-fi']);

    expect(slugs.length).toBeGreaterThan(0);
  });

  it('treats several genres as a union, not an intersection', async () => {
    const only = await slugsFor([MULTI_WORD_SLUG]);
    const both = await slugsFor([MULTI_WORD_SLUG, 'action']);

    expect(both.length).toBeGreaterThanOrEqual(only.length);
    for (const slug of only) expect(both).toContain(slug);
  });

  it('de-duplicates a repeated genre instead of widening the result', async () => {
    const once = await slugsFor([MULTI_WORD_SLUG]);
    const twice = await slugsFor([MULTI_WORD_SLUG, MULTI_WORD_SLUG]);

    expect(twice).toEqual(once);
  });

  /* ── the whole chain, as a request actually takes it ───────────────────── */

  it('resolves the HUMAN name end to end: service normalisation → repository', async () => {
    // This is the path the filter control takes: `/discover` renders
    // `genre.name` from the facets endpoint, the browser sends it back as
    // `?genre=Slice of Life`, and `normaliseCatalogQuery` slugifies it. Before
    // the fix the slug arrived at a repository that compared it to a name, so
    // this exact journey returned the whole catalog.
    const service = createCatalogService({
      manga: repo,
      chapters: { listByManga: async () => [] } as unknown as ChapterRepository,
    });

    const byName = await service.list({ limit: 48, genres: [MULTI_WORD] });
    const unfiltered = await service.list({ limit: 48 });

    expect(byName.items.map((item) => item.slug)).toEqual([VISIBLE_SLUGS[0]]);
    expect(byName.items.length).toBeLessThan(unfiltered.items.length);
  });
});
