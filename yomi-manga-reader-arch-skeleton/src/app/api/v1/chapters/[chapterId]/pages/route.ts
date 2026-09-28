/**
 * GET /api/v1/chapters/{chapterId}/pages — chapter pages for reader.
 * Minimal wave2 implementation: public read, uses DB directly, no auth.
 */
import { loadEnv } from '../../../../../../shared/validation/env';
import { createDb, closeDb } from '../../../../../../server/db/client';
import { findChapterById, findMangaById, listChapterPages } from '../../../../../../server/db/queries/reader-state';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ chapterId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { chapterId } = await context.params;
  const env = loadEnv();
  const db = await createDb(env);
  try {
    const chapter = await findChapterById(db, chapterId);
    if (!chapter) {
      return Response.json({ error: { code: 'CHAPTER_NOT_FOUND', message: 'Chapter not found' } }, { status: 404 });
    }
    // A chapter of an unpublished or deleted manga is not readable, so visibility is
    // resolved through the parent row rather than assumed from the chapter existing.
    const manga = await findMangaById(db, chapter.mangaId);
    if (!manga || !manga.published || manga.deletedAt) {
      return Response.json({ error: { code: 'MANGA_NOT_FOUND', message: 'Manga not found' } }, { status: 404 });
    }
    if (chapter.status !== 'published') {
      return Response.json({ error: { code: 'CHAPTER_NOT_READY', message: 'Chapter not ready' } }, { status: 409 });
    }
    const pages = await listChapterPages(db, chapterId);
    const pageAssets = pages.map(p => ({
      pageNumber: p.pageNumber,
      urlAvif: `/media/${p.assetKey}.avif`,
      urlWebp: `/media/${p.assetKey}.webp`,
      urlJpeg: `/media/${p.assetKey}.jpeg`,
      width: p.width,
      height: p.height,
    }));
    return Response.json({
      chapter: {
        id: chapter.id,
        mangaId: chapter.mangaId,
        mangaSlug: manga.slug,
        mangaTitle: manga.title,
        number: Number(chapter.number),
        title: chapter.title,
        readingDirection: manga.readingDirection,
        pageCount: chapter.pageCount,
      },
      pages: pageAssets,
    }, { status: 200, headers: { 'cache-control': 'private, max-age=60' } });
  } finally {
    await closeDb(db);
  }
}
