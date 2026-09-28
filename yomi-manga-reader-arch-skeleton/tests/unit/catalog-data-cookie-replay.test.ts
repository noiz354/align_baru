/**
 * The cookie replay on the catalog lane's loopback reads (F-009-S1).
 *
 * The defect
 * ----------
 * `readMangaDetail` does not read the database. It makes a real HTTP request to
 * this app's own origin, and a React Server Component's `fetch` does NOT forward
 * the browser's cookies. So every read in `discover/catalog-data.ts` reached
 * `/api/v1` as an ANONYMOUS request no matter who was browsing.
 *
 * For the public catalog that was invisible. For `GET /api/v1/manga/{slug}` it
 * was not: `CatalogService.detail` omits `continueReading` for a null caller
 * (FR-CATALOG-008), so "Continue Ch. 2 · p. 7" never appeared for a reader who
 * was signed in and mid-chapter. `_members/member-api.ts` already documents the
 * replay as "not optional" and does it, and calls this module "the same
 * arrangement for the catalog lane" — which was true of the origin
 * reconstruction and not of the cookie.
 *
 * Why an integration test could not have caught it
 * -----------------------------------------------
 * The one that DID pass, `caller-resolver.test.ts`, calls the route handler
 * directly with a `Request` it builds itself, so the cookie is present by
 * construction. The page is the only place the replay matters, and the page is
 * the one thing an integration test on the route cannot reach. The browser check
 * is what found this, and it is why this file exists: it pins the header so the
 * next person cannot delete the line and leave the suite green.
 *
 * What is NOT covered: that the button renders. This asserts the header on the
 * wire. The rendering is browser work.
 *
 * Requirements: FR-CATALOG-008, API_CONTRACT §1, NFR-SEC-002
 * Tasks: T-CATALOG-009, T-LIB-007 (the members' lane's own copy of this rule)
 *
 * No DSN required: `fetch` is stubbed, so nothing connects anywhere.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The cookie the fake incoming request carries; swapped per test. */
let incomingCookie: string | null = 'session_token=abc';

/** Every URL `catalog-data` asked for, and the headers it sent with it. */
const calls: Array<{ url: string; headers: Record<string, string> }> = [];

// `next/headers` re-exports `server-only`, whose whole job is to throw when a
// Server Component module is pulled into the client bundle. In a plain unit test
// there is no bundle to be in, so the guard is noise: it fires on the REAL module
// and says nothing about the code under test.
vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  // The real `headers()` throws outside a request scope. This returns the
  // caller's own headers, which is what a Server Component sees.
  headers: async () => ({
    get: (name: string): string | null => {
      if (name === 'host') return 'yomi.test';
      if (name === 'cookie') return incomingCookie;
      return null;
    },
  }),
}));

/** The manga detail body `readMangaDetail` will parse. */
const detailBody = {
  id: 'm-1',
  slug: 'resume-a',
  title: 'Resume a',
  status: 'ongoing',
  coverUrl: null,
  latestChapter: null,
  chapterCount: 3,
  readingDirection: 'ltr',
  aliases: [],
  synopsis: 'A synopsis.',
  firstChapter: { id: 'c-1', number: 1 },
  creators: [],
  genres: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  // The field under test: present only for a caller with a position.
  continueReading: { chapterId: 'c-2', chapterNumber: 2, pageNumber: 7 },
};

describe('the catalog lane replays the caller cookie (INT-CALLER-002, F-009-S1)', () => {
  beforeEach(() => {
    calls.length = 0;
    incomingCookie = 'session_token=abc';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
        calls.push({ url: String(input), headers: init?.headers ?? {} });
        return new Response(JSON.stringify(detailBody), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /** Fresh module per call: `readMangaDetail` is wrapped in React `cache()`. */
  const readDetail = async (): Promise<unknown> => {
    const mod = await import('../../src/app/discover/catalog-data');
    return mod.readMangaDetail('resume-a');
  };

  it('forwards the caller cookie to the loopback read', async () => {
    const result = (await readDetail()) as { ok: boolean; data?: unknown };

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    // The one line that decides whether the API can see the reader at all.
    expect(calls[0]?.headers['cookie']).toBe('session_token=abc');
  });

  it('still sends accept, and still asks for no-store', async () => {
    await readDetail();
    // A read that dropped `accept` would work by luck; one that dropped the
    // cookie is the defect this slice is about. Both belong here.
    expect(calls[0]?.headers['accept']).toBe('application/json');
  });

  it('sends no cookie header at all when the caller has none', async () => {
    // An anonymous request must look anonymous. Sending `cookie: ''` would have
    // the guard hunting for a session named "" — a real request for nothing.
    incomingCookie = null;
    await readDetail();
    expect('cookie' in (calls[0]?.headers ?? {})).toBe(false);
  });

  it('does not send a cookie header for an empty cookie', async () => {
    incomingCookie = '';
    await readDetail();
    expect('cookie' in (calls[0]?.headers ?? {})).toBe(false);
  });

  it('replays the cookie on the CHAPTER LIST too, not only on the detail', async () => {
    // Both reads go through the same `readJson`, and the chapter list is how the
    // detail page gets its rows. Replaying on one and not the other would be a
    // difference nobody would notice until the read/unread markers (T-LIB-006)
    // need the same session.
    incomingCookie = 'session_token=xyz';
    const mod = await import('../../src/app/discover/catalog-data');
    await mod.readChapterList('resume-a');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers['cookie']).toBe('session_token=xyz');
  });

  it('still resolves a detail for an anonymous caller', async () => {
    // The replay is additive. An anonymous reader must keep getting the detail
    // with `continueReading` absent — not a 401, not an unavailable state.
    incomingCookie = null;
    const result = (await readDetail()) as { ok: boolean; data?: Record<string, unknown> };

    expect(result.ok).toBe(true);
    expect(result.data?.['slug']).toBe('resume-a');
  });
});
