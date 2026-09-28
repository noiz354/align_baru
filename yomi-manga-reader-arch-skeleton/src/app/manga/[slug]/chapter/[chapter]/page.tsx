/**
 * The chapter reader's server shell.
 *
 * It renders almost nothing itself: `params` resolve the slug and chapter number
 * and hand them to `ReaderClient`, which owns every fetch. That split is
 * deliberate — a reader's position is client state that must survive hydration,
 * and a server component would re-render it away.
 *
 * It also reads `searchParams` for `?page=N` (EC-RDR-06) and hands the raw value
 * to the client. The RAW value, deliberately: this shell does not know
 * `page_count` — the chapter has not been loaded yet — so it cannot clamp. The
 * client clamps once the page list arrives, and the clamp belongs there rather
 * than in the repository, which returns raw position on purpose (EC-RDR-10).
 *
 * KNOWN GAPS, all scheduled, none of them "working as intended":
 * - No route protection, because `middleware.ts`'s matcher is an unreachable
 *   dummy (T-AUTH-007). Reading is anonymous by design, so this page is
 *   correct; it is the `/admin` tree that becomes a P0 exposure. → F-005
 *
 * Requirements: FR-READER-011, FR-READER-012, FR-READER-014, EC-RDR-06
 * Tasks: T-READER-001, T-READER-014; gaps F-005
 */
import type { Metadata } from 'next';
import { ReaderClient } from './reader-client';
import { readRequestedPage } from '../../../../../features/reader/deep-link';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reader' };

type Params = Promise<{ slug: string; chapter: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { slug, chapter: chapterParam } = await params;
  const query = await searchParams;
  const chapterNumber = Number(chapterParam);
  if (!Number.isFinite(chapterNumber)) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Invalid chapter</h1>
      </div>
    );
  }
  // All data fetching is done client-side via /api to avoid PGlite in RSC (wasm fs
  // issue). The server renders the shell and resolves the deep link.
  return (
    <div style={{ padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
        <a href="/discover">Catalog</a> / <a href={`/manga/${slug}`}>{slug}</a> / Chapter{' '}
        {chapterNumber}
      </nav>
      <h1>
        {slug} — Chapter {chapterNumber}
      </h1>
      <ReaderClient
        slug={slug}
        chapterNumber={chapterNumber}
        requestedPage={readRequestedPage(query['page'])}
      />
    </div>
  );
}
