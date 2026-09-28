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
