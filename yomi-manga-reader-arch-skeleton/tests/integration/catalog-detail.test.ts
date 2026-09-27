/**
 * INT-CAT-002 (T-CATALOG-011) — `GET /api/v1/manga/{slug}` on real PostgreSQL 18.
 *
 * The part of the detail endpoint that only a real database can answer: the
 * 404-shaped cases. `bySlug` is the visibility gate, so "unknown", "unpublished"
 * and "soft-deleted" must all be indistinguishable from outside (API_CONTRACT §1
 * no-existence-leak) — and that is a claim about a query, not about a mock.
 *
 * It also pins the identity rule at the HTTP boundary (THREAT T-04): the caller
 * comes from `resolveCaller` and from nothing else, so a `?role=admin` on the
 * query string must not buy a draft title.
 *
 * Requirements: FR-CATALOG-006, FR-CATALOG-008, NFR-SEC-015, NFR-PERF-004.
 * Tasks: T-CATALOG-011 (endpoint), T-CATALOG-001 (the read), T-CATALOG-006 (page).
 * DSN: `DATABASE_URL`; SKIPS without it. Throwaway database, own port.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMangaDetailHandler } from '../../src/app/api/v1/manga/[slug]/route';
import type { ApiV1Deps } from '../../src/app/api/v1/_deps';
import {
  CALLERS,
  HIDDEN_SLUGS,
  VISIBLE_SLUGS,
  asSlug,
  createPgCatalogHarness,
  openCatalogDatabase,
  silentLogger,
} from './support/pg-catalog-ports';
import type { OpenDatabase, PgCatalogHarness } from './support/pg-catalog-ports';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

/** The contract's slug ceiling, restated so the test fails if the two drift. */
const SLUG_MAX = 190;

describeDb('INT-CAT-002 (T-CATALOG-011) GET /api/v1/manga/{slug}', () => {
  let open: OpenDatabase;
  let harness: PgCatalogHarness;

  const call = async (slug: string, query = ''): Promise<Response> => {
    const deps: ApiV1Deps = {
      catalog: harness.service,
      resolveCaller: async () => null,
      logger: silentLogger(),
    };
    const path = `/api/v1/manga/${encodeURIComponent(slug)}${query}`;
    return createMangaDetailHandler(deps)(
      new Request(`http://yomi.test${path}`),
      { params: Promise.resolve({ slug }) },
    );
  };

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'catalog_detail_it');
    harness = await createPgCatalogHarness(open);
  });

  afterAll(async () => {
    await open?.close();
  });

  /* ── 200 shape ─────────────────────────────────────────────────────────── */

  it('answers 200 for a published manga, with the contract cache headers', async () => {
    const response = await call(VISIBLE_SLUGS[0] as string);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'private, max-age=60, stale-while-revalidate=60',
    );
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('x-request-id')).toEqual(expect.any(String));
  });

  it('returns the MangaDetail field set, camelCased', async () => {
    const body = (await (await call(VISIBLE_SLUGS[0] as string)).json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(
      [
        'aliases',
        'chapterCount',
        'coverUrl',
        'createdAt',
        'creators',
        'firstChapter',
        'genres',
        'id',
        'latestChapter',
        'readingDirection',
        'slug',
        'status',
        'synopsis',
        'tags',
        'title',
      ].sort(),
    );
    expect(body['aliases']).toEqual(expect.any(Array));
    expect(body['synopsis']).toEqual(expect.any(String));
    expect(body['readingDirection']).toMatch(/^(ltr|rtl|vertical)$/);
    expect(typeof body['chapterCount']).toBe('number');
  });

  it('arrives with numbers as JSON numbers, not numeric(8,2) strings', async () => {
    const body = (await (await call(VISIBLE_SLUGS[0] as string)).json()) as {
      firstChapter: { number: unknown } | null;
      latestChapter: { number: unknown } | null;
      chapterCount: unknown;
    };

    expect(typeof body.chapterCount).toBe('number');
    if (body.firstChapter !== null) expect(typeof body.firstChapter.number).toBe('number');
    if (body.latestChapter !== null) expect(typeof body.latestChapter.number).toBe('number');
  });

  it('echoes back the slug that was asked for', async () => {
    const slug = VISIBLE_SLUGS[0] as string;
    const body = (await (await call(slug)).json()) as { slug: string };

    expect(body.slug).toBe(slug);
  });

  /* ── 404: the three invisibility cases are one answer (API_CONTRACT §1) ─── */

  it('answers MANGA_NOT_FOUND 404 for an unpublished or soft-deleted slug', async () => {
    expect(HIDDEN_SLUGS.length).toBeGreaterThan(1);

    for (const slug of HIDDEN_SLUGS) {
      const response = await call(slug);
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error: { code: string } };
      expect(body.error.code).toBe('MANGA_NOT_FOUND');
    }
  });

  it('answers the SAME 404 for a slug that was never in the database', async () => {
    const response = await call('no-such-manga-anywhere');
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(404);
    // Identical to the hidden-title answer: existence is not observable.
    expect(body.error.code).toBe('MANGA_NOT_FOUND');
  });

  it('leaks nothing about a hidden title beyond the 404 code', async () => {
    const body = (await (await call(HIDDEN_SLUGS[0] as string)).json()) as {
      error: Record<string, unknown>;
    };

    expect(Object.keys(body.error).sort()).toEqual(['code', 'message', 'requestId']);
  });

  /* ── edge validation at the edge ────────────────────────────────────────── */

  it('rejects an over-long slug with 422, not 404 and not 500', async () => {
    const response = await call('s'.repeat(SLUG_MAX + 1));
    const body = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_BAD_QUERY');
  });

  it('accepts a slug of exactly the ceiling length (200-or-404, never 422)', async () => {
    const response = await call('s'.repeat(SLUG_MAX));

    expect(response.status).not.toBe(422);
  });

  it('accepts a non-latin slug as a lookup miss rather than a validation error', async () => {
    const response = await call('，一开始就');

    expect(response.status).toBe(404);
  });

  /* ── identity (THREAT T-04) ────────────────────────────────────────────── */

  it('ignores a role claimed in the query string', async () => {
    // `?role=admin` is not an identity source. The anonymous caller must get the
    // published-only answer, so this must NOT reach a draft title.
    const anonymous = await call(HIDDEN_SLUGS[0] as string, '?role=admin');
    expect(anonymous.status).toBe(404);
  });

  it('reads the caller from the session resolver, not from the URL', async () => {
    const slug = VISIBLE_SLUGS[0] as string;
    const deps: ApiV1Deps = {
      catalog: harness.service,
      resolveCaller: async () => CALLERS.reader,
      logger: silentLogger(),
    };
    const response = await createMangaDetailHandler(deps)(
      new Request(`http://yomi.test/api/v1/manga/${asSlug(slug) as string}?role=admin`),
      { params: Promise.resolve({ slug }) },
    );

    expect(response.status).toBe(200);
  });

  it('is idempotent — the same request twice gives the same answer', async () => {
    const slug = VISIBLE_SLUGS[0] as string;
    const [first, second] = [await call(slug), await call(slug)];

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
  });

  /* ── the read stays a single statement (NFR-PERF-004/014) ──────────────── */

  it('answers from ONE database statement, not one per field', async () => {
    open.probe.reset();
    const response = await call(VISIBLE_SLUGS[0] as string);

    expect(response.status).toBe(200);
    // The harness probe counts statements the repository issues; a detail page
    // that fanned out per genre/tag/creator would show up here.
    expect(open.probe.statements.length).toBeLessThanOrEqual(2);
  });
});
