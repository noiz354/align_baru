/** Chapter manifest contract; requirement FR-READER-001, FR-READER-013; ADR-007; T-READER-001. */
export interface ChapterPage {
  id: string;
  chapterId: string;
  /** One-based ordinal; unique within chapter. */
  pageNumber: number;
  /** Opaque asset reference only; MUST NOT be a physical path or credential. */
  assetKey: string;
  width: number;
  height: number;
}

export interface ChapterManifest {
  chapterId: string;
  mangaId: string;
  title?: string;
  chapterNumber?: number;
  readingDirection: "rtl" | "ltr";
  pages: readonly ChapterPage[];
  publicationRevision: string;
  nextChapterId?: string | null;
  prevChapterId?: string | null;
}
