/**
 * The chapter reader's server shell.
 *
 * It renders almost nothing itself: `params` resolve the slug and chapter number
 * and hand them to `ReaderClient`, which owns every fetch. That split is
 * deliberate — a reader's position is client state that must survive hydration,
 * and a server component would re-render it away.
 *
 * KNOWN GAPS, all scheduled, none of them "working as intended":
 * - No `?page=N` deep link. `params` is the only thing read here, so page state
 *   initialises to 1. This also means the `/bookmarks` jump link — which builds
 *   the contract-correct `?page=N` href (EC-RDR-06) — lands on page 1. → F-007-S2
 * - No previous/next chapter. The neighbours already exist in
 *   `ChapterRepository.pageList`; nothing surfaces them. → F-007-S1
 * - No route protection, because `middleware.ts`'s matcher is an unreachable
 *   dummy (T-AUTH-007). Reading is anonymous by design, so this page is
 *   correct; it is the `/admin` tree that becomes a P0 exposure. → F-005
 *
 * The progress save the reader triggers is the P0: it routes through
 * `queries/reader-state.ts:248`, which plain-overwrites `completed` and so erases
 * a finished chapter on every page change. → F-006-S1
 *
 * Requirements: FR-READER-011, FR-READER-012, FR-READER-014
 * Tasks: T-READER-001, T-READER-014; gaps F-006-S1, F-007-S1, F-007-S2
 */
import type { Metadata } from 'next';
import { ReaderClient } from './reader-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reader' };

type Params = Promise<{ slug: string; chapter: string }>;

export default async function ReaderPage({ params }: { params: Params }) {
  const { slug, chapter: chapterParam } = await params;
  const chapterNumber = Number(chapterParam);
  if (!Number.isFinite(chapterNumber)) {
    return <div style={{ padding: 24 }}><h1>Invalid chapter</h1></div>;
  }
  // All data fetching is done client-side via /api to avoid PGlite in RSC (wasm fs issue)
  // Server just renders the shell with slug/chapter.
  return (
    <div style={{ padding: 16 }}>
      <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}><a href="/discover">Catalog</a> / <a href={`/manga/${slug}`}>{slug}</a> / Chapter {chapterNumber}</nav>
      <h1>{slug} — Chapter {chapterNumber}</h1>
      <ReaderClient slug={slug} chapterNumber={chapterNumber} />
    </div>
  );
}
