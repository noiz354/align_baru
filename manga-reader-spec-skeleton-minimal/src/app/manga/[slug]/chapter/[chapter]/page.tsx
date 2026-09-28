import React from "react";
import { notFound } from "next/navigation";
import { db } from "@/server/db/store";
import { ReaderView } from "@/features/reader/ReaderView";
import type { ChapterManifest } from "@/features/chapters/contracts";

interface PageProps {
  params: Promise<{
    slug: string;
    chapter: string;
  }>;
  searchParams?: Promise<{
    page?: string;
  }>;
}

export default async function ChapterReaderPage(props: PageProps) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const initialPage = searchParams?.page ? parseInt(searchParams.page, 10) : 1;

  const manga = db.getMangaBySlug(params.slug);
  if (!manga) return notFound();
  const chapterNumber = parseInt(params.chapter, 10);
  const chapters = db.getPublishedChaptersByMangaId(manga.id);
  const chapter = chapters.find((c) => c.chapterNumber === chapterNumber);
  if (!chapter) return notFound();
  const pages = db.getChapterPages(chapter.id);

  const idx = chapters.findIndex((c) => c.id === chapter.id);
  const manifest: ChapterManifest = {
    chapterId: chapter.id,
    mangaId: manga.id,
    title: chapter.title ?? `Chapter ${chapter.chapterNumber}`,
    chapterNumber: chapter.chapterNumber,
    readingDirection: manga.readingDirection,
    publicationRevision: chapter.publicationRevision,
    nextChapterId: idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1].id : null,
    prevChapterId: idx > 0 ? chapters[idx - 1].id : null,
    pages: pages.map((p) => ({
      id: p.id,
      chapterId: p.chapterId,
      pageNumber: p.pageNumber,
      assetKey: p.assetKey,
      width: p.width,
      height: p.height,
    })),
  };

  return (
    <ReaderView
      manifest={manifest}
      initialPage={Number.isFinite(initialPage) ? initialPage : 1}
      chapterId={chapter.id}
      userId="usr-guest-001"
    />
  );
}
