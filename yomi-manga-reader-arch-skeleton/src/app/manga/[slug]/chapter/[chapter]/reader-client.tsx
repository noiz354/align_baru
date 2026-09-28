'use client';
import { useEffect, useState } from 'react';

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
      typeof entry === 'object' && entry !== null && typeof (entry as ChapterListItem).id === 'string',
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

interface PageAsset {
  pageNumber: number;
  urlAvif: string;
  urlWebp: string;
  urlJpeg: string;
  width: number;
  height: number;
}

interface ChapterPagesResponse {
  chapter: { id: string; mangaSlug: string; mangaTitle: string; number: number; title: string; readingDirection: string; pageCount: number };
  pages: PageAsset[];
}

export function ReaderClient({ slug, chapterNumber }: { slug: string; chapterNumber: number }) {
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [mangaTitle, setMangaTitle] = useState(slug);
  const [readingDirection, setReadingDirection] = useState('ltr');
  const [pages, setPages] = useState<PageAsset[]>([]);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        const target = chapters.find(c => String(c.number) === String(chapterNumber));
        if (!target) throw new Error(`Chapter ${chapterNumber} not found for ${slug}`);
        if (cancelled) return;
        setChapterId(target.id);
        // Fetch pages
        const pRes = await fetch(`/api/v1/chapters/${target.id}/pages`);
        if (!pRes.ok) throw new Error(`pages ${pRes.status}`);
        const pData = (await readJson(pRes)) as ChapterPagesResponse;
        if (cancelled) return;
        setPages(pData.pages);
        setMangaTitle(pData.chapter.mangaTitle);
        setReadingDirection(pData.chapter.readingDirection);
        // Fetch progress
        const progRes = await fetch(`/api/chapters/${target.id}/progress`);
        if (progRes.ok) {
          const prog = await readJson(progRes);
          const pn = readProgressPageNumber(prog);
          if (pn !== undefined && Number.isInteger(pn) && pn >= 1 && pn <= pData.pages.length) {
            setPage(pn);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [slug, chapterNumber]);

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
  if (error) return <div style={{ padding: 24 }}><h2>Reader error</h2><pre>{error}</pre></div>;

  // Binding the first page and testing the binding is what proves it exists:
  // `pages.length === 0` does not narrow `pages[0]` under noUncheckedIndexedAccess.
  const firstPage = pages[0];
  if (!firstPage) return <div style={{ padding: 24 }}>No pages</div>;

  const current = pages.find(p => p.pageNumber === page) ?? firstPage;
  const maxPage = pages.length;
  const prev = () => setPage(p => Math.max(1, p - 1));
  const next = () => setPage(p => Math.min(maxPage, p + 1));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <p style={{ color: '#666' }}>{mangaTitle} • {readingDirection === 'rtl' ? 'Right to left' : 'Left to right'} • {pages.length} pages • Progress: page {page} {saving ? '• saving…' : ''}</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <button onClick={prev} disabled={page <= 1} aria-label="Previous page" style={{ padding: '8px 16px' }}>Prev</button>
        <span aria-live="polite">Page {page} / {maxPage} {saving ? '• saving...' : ''}</span>
        <button onClick={next} disabled={page >= maxPage} aria-label="Next page" style={{ padding: '8px 16px' }}>Next</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#888' }}>{chapterId?.slice(0, 8)} • {slug} ch{chapterNumber}</span>
      </div>
      <div style={{ border: '1px solid #ddd', background: '#fafafa', minHeight: 720, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* JPEG is the universally supported variant; AVIF/WebP delivery is T-UPLOAD-* scope. */}
        <img
          src={current.urlJpeg}
          alt={`Page ${page}`}
          width={current.width}
          height={current.height}
          style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
          loading="eager"
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {pages.map(p => (
          <button
            key={p.pageNumber}
            onClick={() => setPage(p.pageNumber)}
            aria-current={p.pageNumber === page ? 'page' : undefined}
            style={{
              width: 40, height: 40,
              background: p.pageNumber === page ? '#0f766e' : '#e5e7eb',
              color: p.pageNumber === page ? 'white' : 'black',
              border: 'none', borderRadius: 4, cursor: 'pointer'
            }}
          >
            {p.pageNumber}
          </button>
        ))}
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>Progress persists via /api/chapters/{chapterId}/progress — reload or restart to verify.</p>
      <div style={{ marginTop: 24, padding: 12, background: '#f0fdfa', border: '1px solid #ccfbf1', fontSize: 12 }}>
        <strong>Debug</strong>: chapterId {chapterId} • slug {slug} • ch{chapterNumber} • page {page}/{maxPage} • {readingDirection}
      </div>
    </div>
  );
}
