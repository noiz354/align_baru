import type { ChapterManifest } from "./contracts";

export const SAMPLE_CHAPTER_MANIFEST: ChapterManifest = {
  chapterId: "ch-001",
  mangaId: "manga-sample",
  title: "Chapter 1: The Beginning",
  chapterNumber: 1,
  readingDirection: "rtl",
  publicationRevision: "rev-2026-09-27-01",
  nextChapterId: "ch-002",
  prevChapterId: null,
  pages: Array.from({ length: 12 }, (_, i) => {
    const pageNum = i + 1;
    return {
      id: `p-${pageNum}`,
      chapterId: "ch-001",
      pageNumber: pageNum,
      assetKey: `asset://manga-sample/ch-001/p-${pageNum}`,
      width: 1200,
      height: 1800,
    };
  }),
};
