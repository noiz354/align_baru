import { NextResponse } from "next/server";
import { db } from "@/server/db/store";
import type { ChapterManifest } from "@/features/chapters/contracts";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const chapter = db.getChapter(id);

  if (!chapter) {
    return NextResponse.json(
      { code: "CHAPTER_NOT_FOUND", message: "Chapter not found or unpublished." },
      { status: 404 }
    );
  }

  const manga = Array.from(db.manga.values()).find((m) => m.id === chapter.mangaId);
  const pages = db.getChapterPages(chapter.id);

  const manifest: ChapterManifest = {
    chapterId: chapter.id,
    mangaId: chapter.mangaId,
    title: chapter.title,
    chapterNumber: chapter.chapterNumber,
    readingDirection: manga?.readingDirection ?? "rtl",
    publicationRevision: chapter.publicationRevision,
    pages: pages.map((p) => ({
      id: p.id,
      chapterId: p.chapterId,
      pageNumber: p.pageNumber,
      assetKey: p.assetKey,
      width: p.width,
      height: p.height,
    })),
  };

  return NextResponse.json(manifest);
}
