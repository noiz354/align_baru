/**
 * UNIT-CAT-008 — `CatalogService.detail` (T-CATALOG-011, T-CATALOG-006).
 *
 * The detail read is the one the detail PAGE depends on and the one the
 * endpoint did not have: `API_CONTRACT.md` §2.1 lists
 * `GET /api/v1/manga/{slug}` and maps it to the Detail page, but no route and no
 * service method existed, so `readMangaDetail` in the UI always fell through to
 * its "unavailable" branch. These tests pin the four properties that make the
 * response trustworthy:
 *
 *  1. ONE repository call — the aliases/genres/tags/creators/first/latest rows
 *     all arrive with the `bySlug` read (T-CATALOG-001), so a second read here
 *     would be the N+1 NFR-PERF-004/014 forbids;
 *  2. `numeric(8,2)` reaches a repository as a STRING (ADR-003 R2) and the DTOs
 *     say `number`, so both chapter numbers are coerced exactly once, here;
 *  3. `null` in ⇒ `null` out — a slug that is unknown, unpublished or
 *     soft-deleted is a real answer (API_CONTRACT §1 no-existence-leak), not an
 *     error and not an empty object;
 *  4. the caller reaches the repository UNCHANGED — visibility is the
 *     repository's rule, and the service never widens it.
 *
 * Requirements: FR-CATALOG-006, NFR-PERF-004, NFR-SEC-015.
 * Tasks: T-CATALOG-011 (service half), T-CATALOG-006 (the page that reads it).
 */
import { describe, expect, it, vi } from 'vitest';

import { createCatalogService } from '../../src/features/catalog';
import type { CatalogServiceDeps } from '../../src/features/catalog';
import type { CallerContext, MangaDetail } from '../../src/shared/contracts';
import type { MangaSlug } from '../../src/shared/types';

/** A detail row as Drizzle hands it over: chapter numbers still strings. */
function detailRow(): MangaDetail {
  return {
    id: 'manga-1',
    slug: 'some-slug',
    title: 'Some Title',
    status: 'ongoing',
    coverUrl: '/media/cover.webp',
    latestChapter: { number: '12.00', title: 'Chapter 12', publishedAt: '2026-01-02T00:00:00.000Z' },
    firstChapter: { id: 'chapter-1', number: '1.00' },
    aliases: ['Judge', 'Yudge'],
    synopsis: 'Plain text. Never markup.',
    readingDirection: 'rtl',
    chapterCount: 12,
    creators: [{ id: 'c1', name: 'Author', role: 'author' }],
    genres: [{ id: 'g1', name: 'Action' }],
    tags: [{ id: 't1', name: 'long-running' }],
    createdAt: '2026-01-01T00:00:00.000Z',
  } as unknown as MangaDetail;
}

/** A `MangaRepository` whose only used method is `bySlug`. */
function repositoryDouble(answer: MangaDetail | null): {
  bySlug: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
} {
  return { bySlug: vi.fn(async () => answer), list: vi.fn(async () => ({ items: [], nextCursor: null })) };
}

function serviceWith(answer: MangaDetail | null): {
  service: ReturnType<typeof createCatalogService>;
  bySlug: ReturnType<typeof vi.fn>;
} {
  const manga = repositoryDouble(answer);
  const deps = {
    manga,
    chapters: { listByManga: vi.fn(async () => []) },
  } as unknown as CatalogServiceDeps;
  return { service: createCatalogService(deps), bySlug: manga.bySlug };
}

const SLUG = 'some-slug' as MangaSlug;
const ANONYMOUS: CallerContext = null;
const READER: CallerContext = { userId: 'user-2' as never, role: 'reader' };

describe('UNIT-CAT-008 — CatalogService.detail', () => {
  it('resolves the detail with exactly ONE repository read (no N+1)', async () => {
    const { service, bySlug } = serviceWith(detailRow());

    await service.detail(SLUG, ANONYMOUS);

    expect(bySlug).toHaveBeenCalledTimes(1);
  });

  it('coerces first/latest chapter numbers from string to number', async () => {
    const { service } = serviceWith(detailRow());

    const detail = await service.detail(SLUG, ANONYMOUS);

    expect(detail?.firstChapter).toEqual({ id: 'chapter-1', number: 1 });
    expect(detail?.latestChapter?.number).toBe(12);
  });

  it('leaves every other detail field exactly as the repository returned it', async () => {
    const { service } = serviceWith(detailRow());

    const detail = await service.detail(SLUG, ANONYMOUS);

    expect(detail).toMatchObject({
      slug: 'some-slug',
      title: 'Some Title',
      status: 'ongoing',
      coverUrl: '/media/cover.webp',
      aliases: ['Judge', 'Yudge'],
      synopsis: 'Plain text. Never markup.',
      readingDirection: 'rtl',
      chapterCount: 12,
    });
    expect(detail?.genres).toEqual([{ id: 'g1', name: 'Action' }]);
    expect(detail?.creators).toEqual([{ id: 'c1', name: 'Author', role: 'author' }]);
  });

  it('passes `null` through — unknown, unpublished or soft-deleted is a 404 answer', async () => {
    const { service, bySlug } = serviceWith(null);

    await expect(service.detail(SLUG, ANONYMOUS)).resolves.toBeNull();
    expect(bySlug).toHaveBeenCalledTimes(1);
  });

  it('hands the caller to the repository unchanged, so visibility stays its rule', async () => {
    const { service, bySlug } = serviceWith(detailRow());
    const caller: CallerContext = READER;

    await service.detail(SLUG, caller);

    expect(bySlug).toHaveBeenCalledWith(SLUG, caller);
  });

  it('omits `continueReading` — the field is absent for every caller of this read', async () => {
    const { service } = serviceWith(detailRow());

    const detail = await service.detail(SLUG, READER);

    // The contract type has it optional and it is an authenticated field
    // (FR-CATALOG-008); the detail page's Zod schema does not parse it yet, so
    // emitting it here would be a field nothing reads.
    expect(detail).not.toHaveProperty('continueReading');
  });

  it('keeps a chapter-less manga a 200-shaped value with null chapters', async () => {
    const row = detailRow();
    const { service } = serviceWith({
      ...row,
      firstChapter: null,
      latestChapter: null,
      chapterCount: 0,
    });

    const detail = await service.detail(SLUG, ANONYMOUS);

    expect(detail).not.toBeNull();
    expect(detail?.firstChapter).toBeNull();
    expect(detail?.latestChapter).toBeNull();
    expect(detail?.chapterCount).toBe(0);
  });
});
