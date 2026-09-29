/**
 * The reader itself — every fetch, the page image, and the two navigation
 * controls that exist.
 *
 * Data sources, in the order it asks for them:
 *   GET  /api/v1/manga/{slug}/chapters   resolve the chapter number to an id
 *   GET  /api/v1/chapters/{id}/pages     the page list
 *   GET  /api/chapters/{id}/progress     restore position (401 when anonymous)
 *   POST /api/chapters/{id}/progress     save position (401 when anonymous)
 *   GET  /media/{assetKey}.jpeg          the image
 *
 * What exists: real page images with an honest "image missing" state; next and
 * previous PAGE disabled at the bounds; and previous/next CHAPTER as real links,
 * from the `prevChapter`/`nextChapter` the same page-list response already carried
 * and the client used to drop.
 *
 * What does not, and is not pretending to:
 * - `readingDirection` is fetched and shown as TEXT but never applied to layout.
 *   Harmless for a single page, and still a lie in the response.
 * - The save `fetch` has no `.catch`, so a 401 discards the position silently.
 *   That is invisible in development because a seeded account can sign in; in
 *   production no account can be created at all.
 * - The save goes through `queries/reader-state.ts:248`, which overwrites
 *   `completed` with `false`. Reading past the end of a finished chapter
 *   silently un-finishes it. This is the worst bug in the product: no error, and
 *   the reader's own record is wrong. → F-006-S1 (fixed: the route now writes
 *   through `ReaderProgressRepository`)
 * - A `Debug` panel and a "reload or restart to verify" line are rendered to
 *   readers. Recorded, not fixed here — it is a separate slice from navigation
 *   and folding it in would make this commit about two things.
 *
 * Requirements: FR-READER-011, FR-READER-012, FR-READER-014, FR-READER-015,
 * FR-READER-016 (chapter neighbours), NFR-PERF-014
 * Tasks: T-READER-001, T-READER-014, T-READER-016 (chapter neighbours),
 * T-UPLOAD-004 (image-missing state); gaps F-005 (route guard, deferred)
 */
'use client';
import { useEffect, useState } from 'react';
import type { ChapterPagesResponse, PageAsset } from '../../../../../shared/contracts/chapter';
import { clampRequestedPage } from '../../../../../features/reader/deep-link';

/** `Response.json()` is typed `any`; reading it as `unknown` keeps that out of the call sites. */
async function readJson(res: Response): Promise<unknown> {
  const raw: unknown = await res.json();
  return raw;
}

type ChapterListItem = { id: string; number: string | number; title: string };

/**
 * The chapters endpoint has been served under several envelope keys over time, so the reader
 * accepts any of them. Each is checked rather than trusted, and an unrecognised shape yields
 * no chapters instead of an arbitrary object.
 */
function readChapterList(raw: unknown): ChapterListItem[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const record = raw as Record<string, unknown>;
  const candidate = [record['chapters'], record['items'], record['data']].find(Array.isArray);
  if (!Array.isArray(candidate)) return [];
  return candidate.filter(
    (entry): entry is ChapterListItem =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as ChapterListItem).id === 'string',
  );
}

/** The stored page number, or undefined when the response carries no usable progress. */
function readProgressPageNumber(raw: unknown): number | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const progress = (raw as Record<string, unknown>)['progress'];
  if (typeof progress !== 'object' || progress === null) return undefined;
  const pageNumber = (progress as Record<string, unknown>)['pageNumber'];
  return typeof pageNumber === 'number' ? pageNumber : undefined;
}

/**
 * A chapter neighbour, as delivered. Both fields are needed to build the href, and
 * `title` is shown when the chapter has one.
 */
type ChapterNeighbour = { slug: string; number: number; title: string | null };

/**
 * Reads a neighbour out of an untrusted response.
 *
 * `prevChapter`/`nextChapter` are `null` at the ends of a manga, and a response
 * that omits them entirely must not crash the reader — so an unusable value
 * becomes `null` (no neighbour) rather than a link that goes nowhere.
 */
function readNeighbour(raw: unknown): ChapterNeighbour | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const slug = record['slug'];
  const number = record['number'];
  if (typeof slug !== 'string' || slug === '') return null;
  if (typeof number !== 'number' || !Number.isFinite(number)) return null;
  const title = record['title'];
  return { slug, number, title: typeof title === 'string' ? title : null };
}

export function ReaderClient({
  slug,
  chapterNumber,
  requestedPage,
}: {
  slug: string;
  chapterNumber: number;
  /**
   * `?page=N`, already reduced to a positive integer or `null` by the server shell.
   *
   * RAW on purpose: this shell cannot clamp, because `page_count` is not known
   * until the page list arrives. The clamp happens below, in the client, which is
   * where the count is known — and it belongs here rather than in the repository,
   * which returns stored position raw on purpose (EC-RDR-10).
   */
  requestedPage: number | null;
}) {
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [mangaTitle, setMangaTitle] = useState(slug);
  const [readingDirection, setReadingDirection] = useState('ltr');
  const [pages, setPages] = useState<PageAsset[]>([]);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A page image that 404s or fails to decode. The reader used to render a broken-image
  // icon with no explanation, which reads as a product fault rather than a missing object.
  // Keyed by page number so moving off the failed page and back re-attempts the fetch.
  const [imageFailed, setImageFailed] = useState<number | null>(null);
  // Chapter neighbours, straight from the page-list response (FR-READER-016). They
  // used to be fetched and thrown away: the chapters list above is requested ONLY
  // to resolve the current chapter's id, and the `prevChapter`/`nextChapter` the
  // same response already carries were dropped on the floor.
  const [prevChapter, setPrevChapter] = useState<ChapterNeighbour | null>(null);
  const [nextChapter, setNextChapter] = useState<ChapterNeighbour | null>(null);
  /**
   * Whether the reader advances past the last page (`autoNextChapter`,
   * F-013-S2).
   *
   * Read from `/api/preferences` alongside everything else this island fetches
   * — the page does no server fetching (PGlite-in-RSC), so the preference
   * arrives the same way the pages do. Starts `true`, the documented default:
   * an anonymous reader (401) and a reader who never opened settings get the
   * same answer, which is what "default" means. A failed read also falls back
   * to `true` rather than disabling navigation — a preferences outage must not
   * trap a reader on the last page of a chapter.
   */
  const [autoNext, setAutoNext] = useState(true);

  // The reader's own preferences, fetched independently of the chapter load:
  // they do not depend on it, must not delay it, and must not fail it. A
  // separate effect with no dependencies runs once on mount; anything it
  // cannot read falls back to the documented defaults (see the state above).
  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      try {
        const res = await fetch('/api/preferences', { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const data = (await readJson(res)) as { autoNextChapter?: unknown };
        if (cancelled) return;
        if (typeof data?.autoNextChapter === 'boolean') setAutoNext(data.autoNextChapter);
      } catch {
        // Deliberately nothing: defaults stand. See the state comment.
      }
    }
    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, []);

  // Resolve chapterId via manga chapters list, then fetch pages + progress
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fetch chapters list for this manga
        const chRes = await fetch(`/api/v1/manga/${slug}/chapters`);
        if (!chRes.ok) throw new Error(`chapters ${chRes.status}`);
        const chData = await readJson(chRes);
        const chapters = readChapterList(chData);
        // Find by number
        const target = chapters.find((c) => String(c.number) === String(chapterNumber));
        if (!target) throw new Error(`Chapter ${chapterNumber} not found for ${slug}`);
        if (cancelled) return;
        setChapterId(target.id);
        // Fetch pages
        const pRes = await fetch(`/api/v1/chapters/${target.id}/pages`);
        if (!pRes.ok) throw new Error(`pages ${pRes.status}`);
        const pData = await readJson(pRes);
        if (typeof pData !== 'object' || pData === null)
          throw new Error('pages response was not an object');
        const parsed = pData as unknown as ChapterPagesResponse;
        if (cancelled) return;
        setPages(parsed.pages);
        setMangaTitle(parsed.chapter.mangaTitle);
        setReadingDirection(parsed.chapter.readingDirection);
        setPrevChapter(readNeighbour((parsed as { prevChapter?: unknown }).prevChapter));
        setNextChapter(readNeighbour((parsed as { nextChapter?: unknown }).nextChapter));
        // A deep link BEATS saved progress. Someone who followed a link to page 12
        // asked for page 12; silently substituting their last position would make
        // the link lie, and a shared link would be unusable. Progress is only the
        // starting point when there is no deep link.
        if (requestedPage !== null) {
          setPage(clampRequestedPage(requestedPage, parsed.pages.length));
        } else {
          const progRes = await fetch(`/api/chapters/${target.id}/progress`);
          if (progRes.ok) {
            const prog = await readJson(progRes);
            const pn = readProgressPageNumber(prog);
            if (pn !== undefined && Number.isInteger(pn) && pn >= 1 && pn <= parsed.pages.length) {
              setPage(pn);
            }
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, chapterNumber, requestedPage]);

  // Save progress on page change
  useEffect(() => {
    if (!chapterId) return;
    const t = setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          await fetch(`/api/chapters/${chapterId}/progress`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ pageNumber: page }),
          });
        } finally {
          setSaving(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [page, chapterId]);

  if (loading) return <div style={{ padding: 24 }}>Loading reader…</div>;
  if (error)
    return (
      <div style={{ padding: 24 }}>
        <h2>Reader error</h2>
        <pre>{error}</pre>
      </div>
    );

  // Binding the first page and testing the binding is what proves it exists:
  // `pages.length === 0` does not narrow `pages[0]` under noUncheckedIndexedAccess.
  const firstPage = pages[0];
  if (!firstPage) return <div style={{ padding: 24 }}>No pages</div>;

  const current = pages.find((p) => p.pageNumber === page) ?? firstPage;
  const maxPage = pages.length;
  const prev = () => setPage((p) => Math.max(1, p - 1));
  const next = () => setPage((p) => Math.min(maxPage, p + 1));

  // A neighbour is a different URL, not different state, so these are plain
  // `<a href>` further down rather than a router push. Two chapters must never
  // share one address, or the reader's own Back button lies.
  const hrefFor = (n: ChapterNeighbour) => `/manga/${n.slug}/chapter/${n.number}`;
  const labelFor = (n: ChapterNeighbour) => `Chapter ${n.number}${n.title ? `: ${n.title}` : ''}`;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <p style={{ color: '#666' }}>
        {mangaTitle} • {readingDirection === 'rtl' ? 'Right to left' : 'Left to right'} •{' '}
        {pages.length} pages • Progress: page {page} {saving ? '• saving…' : ''}
      </p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button
          onClick={prev}
          disabled={page <= 1}
          aria-label="Previous page"
          style={{ padding: '8px 16px' }}
        >
          Prev
        </button>
        <span aria-live="polite">
          Page {page} / {maxPage} {saving ? '• saving...' : ''}
        </span>
        {page >= maxPage && autoNext && nextChapter !== null ? (
          // `autoNextChapter` consumed (F-013-S2): on the last page, Next
          // becomes the next chapter instead of a dead end. A real link, not a
          // button that navigates — keyboard and screen-reader users get the
          // same affordance as the chapter links below, and a nested
          // interactive inside a button would be invalid HTML either way. When
          // the preference is off (or there is no next chapter), the button
          // below stays disabled at the end, exactly as before.
          <a
            href={`${hrefFor(nextChapter)}?page=1`}
            aria-label={`Next chapter: ${labelFor(nextChapter)}`}
            style={{ padding: '8px 16px' }}
          >
            Next chapter →
          </a>
        ) : (
          <button
            onClick={next}
            disabled={page >= maxPage}
            aria-label="Next page"
            style={{ padding: '8px 16px' }}
          >
            Next
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>
          {chapterId?.slice(0, 8)} • {slug} ch{chapterNumber}
        </span>
      </div>
      <div
        style={{
          border: '1px solid #ddd',
          background: '#fafafa',
          minHeight: 720,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageFailed === page ? (
          // The honest state: the object is missing, the page row is not. Says which,
          // says it is not the reader's fault, and offers the one action that can
          // help. Task: T-UPLOAD-004 (until the upload pipeline can write objects).
          <div role="status" style={{ padding: 24, textAlign: 'center', color: '#555' }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>This page image could not be loaded</h2>
            <p style={{ margin: '0 0 12px' }}>
              Page {page} of {maxPage} is in the chapter, but its image is not in storage.
            </p>
            <p style={{ margin: '0 0 16px', fontSize: 13 }}>
              The other pages are unaffected — try the next one, or the thumbnails below.
            </p>
            <button onClick={() => setImageFailed(null)} style={{ padding: '8px 16px' }}>
              Try again
            </button>
          </div>
        ) : (
          // JPEG is the universally supported variant; AVIF/WebP delivery is T-UPLOAD-* scope.
          <img
            src={current.urlJpeg}
            alt={`Page ${page}`}
            width={current.width}
            height={current.height}
            style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
            loading="eager"
            onError={() => setImageFailed(page)}
          />
        )}
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pages.map((p) => (
          <button
            key={p.pageNumber}
            onClick={() => setPage(p.pageNumber)}
            aria-current={p.pageNumber === page ? 'page' : undefined}
            style={{
              width: 40,
              height: 40,
              background: p.pageNumber === page ? '#0f766e' : '#e5e7eb',
              color: p.pageNumber === page ? 'white' : 'black',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            {p.pageNumber}
          </button>
        ))}
      </div>
      {/* Chapter navigation (FR-READER-016). Rendered only when a neighbour
          exists, so the absence of one is a real absence and not a dead control.
          Both are real links, so they are keyboard- and middle-click-navigable and
          can be opened in a new tab — a <button> with a router push would offer
          none of that. */}
      <nav
        aria-label="Chapter navigation"
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'stretch',
          justifyContent: 'space-between',
        }}
      >
        {prevChapter ? (
          <a
            href={hrefFor(prevChapter)}
            aria-label={`Previous chapter: ${labelFor(prevChapter)}`}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: 4,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            ← Previous chapter ({prevChapter.number})
          </a>
        ) : (
          <span style={{ color: '#888', padding: '8px 16px' }}>No previous chapter</span>
        )}
        {nextChapter ? (
          <a
            href={hrefFor(nextChapter)}
            aria-label={`Next chapter: ${labelFor(nextChapter)}`}
            style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: 4,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            Next chapter ({nextChapter.number}) →
          </a>
        ) : (
          <span style={{ marginLeft: 'auto', color: '#888', padding: '8px 16px' }}>
            No next chapter
          </span>
        )}
      </nav>
      <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
        Progress persists via /api/chapters/{chapterId}/progress — reload or restart to verify.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: 12,
          background: '#f0fdfa',
          border: '1px solid #ccfbf1',
          fontSize: 12,
        }}
      >
        <strong>Debug</strong>: chapterId {chapterId} • slug {slug} • ch{chapterNumber} • page{' '}
        {page}/{maxPage} • {readingDirection}
      </div>
    </div>
  );
}
