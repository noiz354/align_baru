/**
 * INT-CHAP-001 — `GET /api/v1/manga/{slug}/chapters`, at BOTH levels, against
 * a REAL PostgreSQL 18.
 * Canonical plan: TEST_STRATEGY.md §3 (INT-CHAP-001, T-CATALOG-007).
 *
 * Two levels on purpose, because T-CATALOG-007's "Security" row asks for
 * something stronger than a service unit test:
 *
 * 1. THE SERVICE over real rows — ordering, the decimal `number`, the
 *    `reading_order` tiebreak, the empty list, the 1000-cap.
 * 2. THE HTTP BOUNDARY through the real route handler — the draft-leakage
 *    proof, the 409 cap path, the 404, and the response headers. A leak that a
 *    service test cannot see (a handler that forwards the flag, a guard that
 *    trusts the query string) is only visible here.
 *
 * Nothing is mocked: the handler is the product one, wired to the real service
 * over port implementations backed by the real schema.
 *
 * Requirements: FR-CATALOG-007, FR-CHAPTER-002/004, NFR-PERF-004.
 * Task: T-CATALOG-007. Errors: T-FOUND-009 (AppError / toRouteError).
 *
 * DSN: `DATABASE_URL`; SKIPS without it. `beforeAll` recreates the `public`
 * schema — throwaway database, own port (vitest runs integration in ONE fork).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChapterListHandler } from '../../src/app/api/v1/manga/[slug]/chapters/route';
import { CHAPTER_LIST_HARD_CAP, createCatalogService } from '../../src/features/catalog';
import type { ApiV1Deps } from '../../src/app/api/v1/_deps';
import type { ChapterRepository } from '../../src/features/chapters';
import type { MangaRepository } from '../../src/features/manga';
import type { CallerContext, ChapterSummary, MangaDetail } from '../../src/shared/contracts';
import type { MangaId, MangaSlug } from '../../src/shared/types';
import { asSlug, mangaIdFor, openCatalogDatabase, silentLogger } from './support/pg-catalog-ports';
import type { OpenDatabase, PgCatalogHarness } from './support/pg-catalog-ports';
import { createPgCatalogHarness } from './support/pg-catalog-ports';

const DATABASE_URL = process.env['DATABASE_URL'];
const describeDb = DATABASE_URL ? describe : describe.skip;

const DECIMAL_SLUG = asSlug('cat-manga-decimal-draft');
const ORDER_SLUG = asSlug('cat-manga-order-probe');
const EMPTY_SLUG = asSlug('cat-manga-no-chapters');
const CAP_SLUG = asSlug('cat-manga-cap');
const HIDDEN_SLUG = asSlug('cat-manga-soft-deleted');

const ANON: CallerContext = null;
const READER: CallerContext = { userId: 'reader-1' as never, role: 'reader' };
const ADMIN: CallerContext = { userId: 'admin-1' as never, role: 'admin' };

describeDb('INT-CHAP-001 (T-CATALOG-007) chapter list — service, on real PG', () => {
  let open: OpenDatabase;
  let harness: PgCatalogHarness;

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'chapter_list_it');
    harness = await createPgCatalogHarness(open);
  });

  afterAll(async () => {
    await open?.close();
  });

  /* ── 1. order ──────────────────────────────────────────────────────────── */

  it('orders by reading_order, with the number displayed (behavior 1)', async () => {
    const items = await harness.service.chapterList(ORDER_SLUG, ANON);
    // The fixture deliberately gives chapter number 1 a reading_order of 20 and
    // chapter number 2 a reading_order of 10, so a `number`-ordered list and a
    // `reading_order`-ordered list are different and this can only pass one way.
    expect(items?.map((item) => item.number)).toEqual([2, 1]);
  });

  it('orders a decimal number between its neighbours, not after them', async () => {
    const items = await harness.service.chapterList(DECIMAL_SLUG, ANON);
    // published chapters are 1, 10.5 and 11; 2 is a draft.
    expect(items?.map((item) => item.number)).toEqual([1, 10.5, 11]);
  });

  it('reads a numeric(8,2) number back as an exact JS number (FR-CHAPTER-004)', async () => {
    const items = await harness.service.chapterList(DECIMAL_SLUG, ANON);
    const special = items?.find((item) => item.number === 10.5);
    expect(special).toBeDefined();
    // 10.50 must not become 10.499999… (ADR-003 R2).
    expect(special?.number).toBe(10.5);
  });

  it('returns an empty list — not null — for a manga with no chapters', async () => {
    const items = await harness.service.chapterList(EMPTY_SLUG, ANON);
    expect(items).toEqual([]);
  });

  it('resolves null for a hidden manga, so the route can answer 404', async () => {
    await expect(harness.service.chapterList(HIDDEN_SLUG, ANON)).resolves.toBeNull();
  });

  /* ── 3. the 1000-cap ───────────────────────────────────────────────────── */

  it('raises CHAPTER_LIST_TOO_LARGE at 1001 rows', async () => {
    await expect(harness.service.chapterList(CAP_SLUG, ANON)).rejects.toMatchObject({
      code: 'CHAPTER_LIST_TOO_LARGE',
    });
    expect(CHAPTER_LIST_HARD_CAP).toBe(1000);
  });

  it('the cap is not a fiction: the fixture really has more than 1000 chapters', async () => {
    // Read the port directly, bypassing the service's cap, so the count is a
    // fact about rows and not about the assertion above.
    const rows = await harness.chapters.listByManga(mangaIdFor(CAP_SLUG) as MangaId, ANON);
    expect(rows.length).toBe(1001);
    expect(rows.length).toBeGreaterThan(CHAPTER_LIST_HARD_CAP);
  });
});

/* ── the HTTP boundary ───────────────────────────────────────────────────── */

describeDb('INT-CHAP-001 (T-CATALOG-007) chapter list — the HTTP boundary', () => {
  let open: OpenDatabase;
  let harness: PgCatalogHarness;

  const call = async (
    slug: MangaSlug,
    query: string,
    caller: CallerContext = ANON,
  ): Promise<Response> => {
    const deps: ApiV1Deps = {
      catalog: harness.service,
      resolveCaller: async () => caller,
      logger: silentLogger(),
    };
    const handler = createChapterListHandler(deps);
    return handler(new Request(`http://yomi.test/api/v1/manga/${slug}/chapters${query}`), {
      params: Promise.resolve({ slug }),
    });
  };

  beforeAll(async () => {
    open = await openCatalogDatabase(DATABASE_URL as string, 'chapter_list_it');
    harness = await createPgCatalogHarness(open);
  });

  afterAll(async () => {
    await open?.close();
  });

  /* ── THE DRAFT-LEAKAGE PROOF (T-CATALOG-007 "Security") ────────────────── */

  it('DRAFT LEAKAGE: an anonymous caller never sees a draft', async () => {
    const response = await call(DECIMAL_SLUG, '', ANON);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ number: number; publishedAt: string | null }>;
    };
    // The fixture's chapter 2 is a draft. It must be absent …
    expect(body.items.map((item) => item.number)).not.toContain(2);
    // … and the proof that this is a FILTER and not a rename: every row
    // returned is a published one.
    expect(body.items.every((item) => item.publishedAt !== null)).toBe(true);
  });

  it('DRAFT LEAKAGE: a reader never sees a draft, even with includeDrafts=true', async () => {
    const response = await call(DECIMAL_SLUG, '?includeDrafts=true', READER);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: Array<{ number: number; publishedAt: string | null }>;
    };
    expect(body.items.map((item) => item.number)).not.toContain(2);
    expect(body.items.every((item) => item.publishedAt !== null)).toBe(true);
  });

  it('DRAFT LEAKAGE: the raw response text does not contain the draft chapter', async () => {
    const response = await call(DECIMAL_SLUG, '?includeDrafts=true&includeDrafts=1', READER);
    const text = await response.text();
    // The draft's title is "2.00 (draft)". A leak in a header, a field, or a
    // differently-cased flag would still put it in the body.
    expect(text).not.toContain('(draft)');
    expect(text).not.toContain('"number":2');
  });

  it('DRAFT LEAKAGE: an admin sees the draft ONLY with the flag', async () => {
    const withoutFlag = await call(DECIMAL_SLUG, '', ADMIN);
    const withoutBody = (await withoutFlag.json()) as { items: Array<{ number: number }> };
    expect(withoutBody.items.map((item) => item.number)).toEqual([1, 10.5, 11]);

    const withFlag = await call(DECIMAL_SLUG, '?includeDrafts=true', ADMIN);
    const withBody = (await withFlag.json()) as { items: Array<{ number: number }> };
    expect(withBody.items.map((item) => item.number).sort((a, b) => a - b)).toEqual([
      1, 2, 10.5, 11,
    ]);
  });

  it('DRAFT LEAKAGE: includeDrafts is a no-op for every non-admin role', async () => {
    for (const flag of [
      '',
      '?includeDrafts=true',
      '?includeDrafts=false',
      '?includeDrafts=1&x=2',
    ]) {
      const anon = (await (await call(DECIMAL_SLUG, flag, ANON)).json()) as { items: unknown[] };
      const reader = (await (await call(DECIMAL_SLUG, flag, READER)).json()) as {
        items: unknown[];
      };
      expect(anon.items).toHaveLength(3);
      expect(reader.items).toHaveLength(3);
    }
  });

  /* ── 3. the 1000-cap 409 ───────────────────────────────────────────────── */

  it('answers 409 CHAPTER_LIST_TOO_LARGE for a manga over the cap', async () => {
    const response = await call(CAP_SLUG, '');
    expect(response.status).toBe(409);
    const body = (await response.json()) as {
      error: { code: string; message: string; requestId: string };
    };
    expect(body.error.code).toBe('CHAPTER_LIST_TOO_LARGE');
    // §6: a data problem, so the message is user-safe copy — never a count of
    // rows read, a table name, or a stack.
    expect(body.error.message).toBe('Chapter list too large to display.');
    expect(typeof body.error.requestId).toBe('string');
    expect(body.error.requestId.length).toBeGreaterThan(0);
  });

  it('does not return a truncated list instead of the 409', async () => {
    const response = await call(CAP_SLUG, '');
    expect(response.status).toBe(409);
    // A 1000-row body with a 409 status would be a silent data loss for a
    // client that only checks `items`.
    expect(await response.text()).not.toContain('"items"');
  });

  /* ── 404 + empty list ──────────────────────────────────────────────────── */

  it('answers 404 MANGA_NOT_FOUND for a hidden manga', async () => {
    const response = await call(HIDDEN_SLUG, '');
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('MANGA_NOT_FOUND');
  });

  it('answers 404 for a slug that never existed', async () => {
    const response = await call(asSlug('no-such-manga-anywhere'), '');
    expect(response.status).toBe(404);
  });

  it('answers 200 with an empty list for a manga with no chapters', async () => {
    const response = await call(EMPTY_SLUG, '');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
  });

  /* ── headers (API_CONTRACT §1) ─────────────────────────────────────────── */

  it('sets the catalog Cache-Control and echoes x-request-id', async () => {
    const deps: ApiV1Deps = {
      catalog: harness.service,
      resolveCaller: async () => ANON,
      logger: silentLogger(),
    };
    const handler = createChapterListHandler(deps);
    const request = new Request(`http://yomi.test/api/v1/manga/${DECIMAL_SLUG}/chapters`, {
      headers: { 'x-request-id': 'req-abc-123' },
    });
    const response = await handler(request, { params: Promise.resolve({ slug: DECIMAL_SLUG }) });
    expect(response.headers.get('cache-control')).toBe(
      'private, max-age=60, stale-while-revalidate=60',
    );
    expect(response.headers.get('x-request-id')).toBe('req-abc-123');
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it('generates a request id when the client sends none', async () => {
    const response = await call(DECIMAL_SLUG, '');
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores a forged x-request-id rather than echoing it into a log line', async () => {
    const deps: ApiV1Deps = {
      catalog: harness.service,
      resolveCaller: async () => ANON,
      logger: silentLogger(),
    };
    const handler = createChapterListHandler(deps);
    const response = await handler(
      new Request(`http://yomi.test/api/v1/manga/${DECIMAL_SLUG}/chapters`, {
        headers: { 'x-request-id': 'a'.repeat(400) },
      }),
      { params: Promise.resolve({ slug: DECIMAL_SLUG }) },
    );
    expect(response.headers.get('x-request-id')).not.toBe('a'.repeat(400));
  });

  /* ── the 200 shape ─────────────────────────────────────────────────────── */

  it('returns exactly the ChapterSummary fields and no cursor', async () => {
    const response = await call(DECIMAL_SLUG, '');
    const body = (await response.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['items']);
    const first = (body['items'] as Array<Record<string, unknown>>)[0];
    expect(Object.keys(first ?? {}).sort()).toEqual([
      'id',
      'number',
      'pageCount',
      'publishedAt',
      'title',
    ]);
  });

  /* ── the service is not bypassed ───────────────────────────────────────── */

  it('routes every request through the service (no repository in the handler)', async () => {
    const calls: string[] = [];
    // Only the read half of each port is exercised here, so the doubles are
    // declared as the two narrowed shapes the harness already exposes and are
    // widened once, explicitly, at the injection point.
    const wrapped = createCatalogService({
      manga: {
        ...harness.manga,
        bySlug: async (slug: MangaSlug, caller: CallerContext): Promise<MangaDetail | null> => {
          calls.push('bySlug');
          return harness.manga.bySlug(slug, caller);
        },
      } as unknown as MangaRepository,
      chapters: {
        listByManga: async (mangaId: MangaId, caller: CallerContext): Promise<ChapterSummary[]> => {
          calls.push('listByManga');
          return harness.chapters.listByManga(mangaId, caller);
        },
      } as unknown as ChapterRepository,
      progress: { latestForManga: async () => null },
    });
    const deps: ApiV1Deps = {
      catalog: wrapped,
      resolveCaller: async () => READER,
      logger: silentLogger(),
    };
    const response = await createChapterListHandler(deps)(
      new Request(`http://yomi.test/api/v1/manga/${DECIMAL_SLUG}/chapters`),
      { params: Promise.resolve({ slug: DECIMAL_SLUG }) },
    );
    expect(response.status).toBe(200);
    expect(calls).toEqual(['bySlug', 'listByManga']);
  });
});
