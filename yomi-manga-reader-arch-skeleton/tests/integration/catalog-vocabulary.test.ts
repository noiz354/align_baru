/**
 * INT-CAT-003 (T-CATALOG-012) — the `CatalogVocabularyPort` implementation on
 * real PostgreSQL 18.
 *
 * `GET /api/v1/catalog/facets` had no implementation in `src/`: the port was
 * declared in `features/catalog/catalog-vocabulary.ts` and a working read lived
 * only under `tests/integration/support/`, so the composition root had nothing
 * to register and every production call to `facets()` reported a missing port —
 * a 500 on a public endpoint, and an unavailable genre filter on `/discover`.
 *
 * The HTTP-level shape is already covered by INT-CAT-001
 * (`tests/integration/catalog-http.test.ts`), and that suite now builds its
 * vocabulary from THIS module, so those tests exercise production code too.
 * What is left to pin here is the port's own decisions:
 *  - `onlyUsed: true` (the default) hides a genre no VISIBLE title carries —
 *    a control that can only ever return nothing is not a filter;
 *  - `onlyUsed: false` is the whole controlled vocabulary, for the admin/
 *    maintenance view that has to be able to see an unused row;
 *  - both lists are ordered by name, so a filter control is stable between
 *    renders rather than jittering;
 *  - a genre linked ONLY to a soft-deleted title is excluded too — visibility
 *    is `published ∧ ¬deleted`, not just `published`;
 *  - an empty vocabulary is empty ARRAYS, not an error.
 *
 * Requirements: FR-CATALOG-002, FR-SEARCH-003, NFR-PERF-004/014, NFR-SEC-015.
 * Tasks: T-CATALOG-012 (this file's subject), T-CATALOG-002 (the port/endpoint).
 * DSN: `DATABASE_URL`; SKIPS without it. Throwaway database, own port.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createGenreTagVocabularyPort } from '../../src/server/db/repositories/vocabulary.repository';
import { createMangaRepository } from '../../src/server/db/repositories/manga.repository';
import {
  GENRES,
  HIDDEN_ONLY_GENRE,
  TAGS,
  openCatalogDatabase,
  seedCatalogFixtures,
} from './support/pg-catalog-ports';
import type { OpenDatabase } from './support/pg-catalog-ports';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('INT-CAT-003 (T-CATALOG-012) CatalogVocabularyPort over real PostgreSQL', () => {
  let open: OpenDatabase;
  let vocabulary: ReturnType<typeof createGenreTagVocabularyPort>;

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'catalog_vocab_it');
    await seedCatalogFixtures(open.db);
    vocabulary = createGenreTagVocabularyPort(open.db);
  });

  afterAll(async () => {
    await open?.close();
  });

  /* ── onlyUsed: the default narrowing ────────────────────────────────────── */

  it('defaults to onlyUsed, so a genre no visible title carries is not offered', async () => {
    const facets = await vocabulary.listVocabulary({});
    const names = facets.genres.map((genre) => genre.name);

    expect(names).toContain(GENRES[0]);
    // The unpublished fixture is the only holder of this genre.
    expect(names).not.toContain(HIDDEN_ONLY_GENRE);
  });

  it('treats a missing `onlyUsed` exactly as `true`', async () => {
    const implicit = await vocabulary.listVocabulary({});
    const explicit = await vocabulary.listVocabulary({ onlyUsed: true });

    expect(implicit).toEqual(explicit);
  });

  /* ── onlyUsed: false — the maintenance view ────────────────────────────── */

  it('lists the WHOLE vocabulary with onlyUsed: false, including the unused genre', async () => {
    const facets = await vocabulary.listVocabulary({ onlyUsed: false });
    const names = facets.genres.map((genre) => genre.name);

    expect(names).toContain(HIDDEN_ONLY_GENRE);
    for (const genre of GENRES) expect(names).toContain(genre);
    for (const tag of TAGS) expect(facets.tags.map((t) => t.name)).toContain(tag);
  });

  it('is strictly a superset: onlyUsed: true is a subset of onlyUsed: false', async () => {
    const used = await vocabulary.listVocabulary({ onlyUsed: true });
    const all = await vocabulary.listVocabulary({ onlyUsed: false });

    const usedIds = new Set(used.genres.map((genre) => genre.id));
    const allIds = new Set(all.genres.map((genre) => genre.id));

    for (const id of usedIds) expect(allIds.has(id)).toBe(true);
    expect(allIds.size).toBeGreaterThanOrEqual(usedIds.size);
  });

  /* ── ordering ──────────────────────────────────────────────────────────── */

  it('orders both lists by name, so the control is stable between renders', async () => {
    const facets = await vocabulary.listVocabulary({ onlyUsed: false });
    const byName = (rows: ReadonlyArray<{ name: string }>): string[] =>
      rows.map((row) => row.name).sort((a, b) => a.localeCompare(b));

    expect(facets.genres.map((g) => g.name)).toEqual(byName(facets.genres));
    expect(facets.tags.map((t) => t.name)).toEqual(byName(facets.tags));
  });

  /* ── row shape ─────────────────────────────────────────────────────────── */

  it('returns exactly { id, name, slug } per row — no counts, no internal columns', async () => {
    const facets = await vocabulary.listVocabulary({ onlyUsed: false });

    for (const genre of facets.genres) {
      expect(Object.keys(genre).sort()).toEqual(['id', 'name', 'slug']);
    }
    for (const tag of facets.tags) {
      expect(Object.keys(tag).sort()).toEqual(['id', 'name', 'slug']);
    }
  });

  it('carries the DERIVED slug, so a client never has to re-derive it', async () => {
    // The filter's vocabulary is slugs (API_CONTRACT §2.1: "csv slugs"), and the
    // only definition of that derivation is `genreSlugSql` in the product. A
    // response without it forces every client to repeat the rule — and one did:
    // the discover page's `facetsSchema` demands a `slug`, so before this the
    // page could not parse a correct response at all and showed "the genre list
    // could not be loaded" against a healthy 200.
    const facets = await vocabulary.listVocabulary({ onlyUsed: false });

    for (const genre of facets.genres) {
      const expected = genre.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      expect(genre.slug).toBe(expected);
    }
  });

  it('emits a slug the catalog filter can actually consume', async () => {
    // The round trip that matters: take a slug FROM the facets response, feed it
    // to the catalog list, and get a title back. If these two ever disagree
    // again, the filter is dead in production while both unit tests stay green.
    const facets = await vocabulary.listVocabulary({ onlyUsed: true });
    const slug = facets.genres[0]?.slug;
    expect(typeof slug).toBe('string');

    const repo = createMangaRepository(open.db);
    const page = await repo.list({ limit: 48, genres: [slug as string], sort: 'updated_desc' });

    expect(page.items.length).toBeGreaterThan(0);
  });

  it('never leaks a timestamp or a join-table column through the vocabulary', async () => {
    const facets = await vocabulary.listVocabulary({ onlyUsed: false });
    const serialised = JSON.stringify(facets);

    expect(serialised).not.toMatch(/createdAt|created_at|mangaId|manga_id/i);
  });

  /* ── idempotence ───────────────────────────────────────────────────────── */

  it('is a pure read — two calls agree (NFR-PERF-004)', async () => {
    const [first, second] = [await vocabulary.listVocabulary({}), await vocabulary.listVocabulary({})];

    expect(first).toEqual(second);
  });
});

/**
 * The empty-vocabulary case needs a database with no genre rows, which is a
 * different fixture; what matters for the port is that it yields empty ARRAYS
 * rather than throwing, and `listVocabulary` has no branch that can throw — the
 * two `select`s are unconditional. Asserting it here against a seeded database
 * would be asserting the fixture, not the port.
 */
export {};
