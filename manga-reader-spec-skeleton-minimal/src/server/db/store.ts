import type {
  MangaRecord,
  ChapterRecord,
  ChapterPageRecord,
  ProgressRecord,
  LibraryEntryRecord,
  BookmarkRecord,
  ReaderPreferenceRecord,
  UserRecord,
} from "./schema";

/**
 * In-memory unified repository store preserving invariants from DATA_MODEL.md.
 * Enables zero-dependency runtime execution while strictly respecting architecture boundaries.
 */
class MemoryDatabase {
  users: Map<string, UserRecord> = new Map();
  manga: Map<string, MangaRecord> = new Map();
  chapters: Map<string, ChapterRecord> = new Map();
  pages: Map<string, ChapterPageRecord[]> = new Map();
  progress: Map<string, ProgressRecord> = new Map();
  library: Map<string, LibraryEntryRecord> = new Map();
  bookmarks: Map<string, BookmarkRecord> = new Map();
  preferences: Map<string, ReaderPreferenceRecord> = new Map();

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    const defaultUser: UserRecord = {
      id: "usr-guest-001",
      email: "reader@domain.local",
      name: "Standard Reader",
      role: "reader",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(defaultUser.id, defaultUser);

    const defaultManga: MangaRecord = {
      id: "manga-sample-01",
      slug: "sample-manga",
      title: "The Licensed Adventure",
      description: "An authorized manga publication demonstrating strict reader architecture.",
      status: "PUBLISHED",
      readingDirection: "rtl",
      author: "Spec Creator",
      artist: "Spec Illustrator",
      coverAssetKey: "asset://covers/sample-manga.webp",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.manga.set(defaultManga.id, defaultManga);

    const ch1: ChapterRecord = {
      id: "ch-001",
      mangaId: defaultManga.id,
      chapterNumber: 1,
      title: "Chapter 1: The Beginning",
      status: "PUBLISHED",
      publicationRevision: "rev-1",
      pageCount: 12,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.chapters.set(ch1.id, ch1);

    const ch1Pages: ChapterPageRecord[] = Array.from({ length: 12 }, (_, i) => {
      const pageNum = i + 1;
      return {
        id: `pg-ch1-${pageNum}`,
        chapterId: ch1.id,
        pageNumber: pageNum,
        assetKey: `asset://manga-sample-01/ch-001/p-${pageNum}`,
        width: 1200,
        height: 1800,
        createdAt: new Date().toISOString(),
      };
    });
    this.pages.set(ch1.id, ch1Pages);
  }

  // --- Manga Queries ---
  getPublishedMangaList(): MangaRecord[] {
    return Array.from(this.manga.values()).filter((m) => m.status === "PUBLISHED");
  }

  getMangaBySlug(slug: string): MangaRecord | null {
    const found = Array.from(this.manga.values()).find((m) => m.slug === slug);
    return found && found.status === "PUBLISHED" ? found : null;
  }

  // --- Chapter Queries ---
  getPublishedChaptersByMangaId(mangaId: string): ChapterRecord[] {
    return Array.from(this.chapters.values())
      .filter((c) => c.mangaId === mangaId && c.status === "PUBLISHED")
      .sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  getChapter(chapterId: string): ChapterRecord | null {
    const c = this.chapters.get(chapterId);
    return c && c.status === "PUBLISHED" ? c : null;
  }

  getChapterPages(chapterId: string): ChapterPageRecord[] {
    return this.pages.get(chapterId) ?? [];
  }

  // --- Progress Operations (FR-READER-014) ---
  saveProgress(userId: string, chapterId: string, pageNumber: number): ProgressRecord {
    const key = `${userId}:${chapterId}`;
    const existing = this.progress.get(key);
    const newVersion = existing ? existing.version + 1 : 1;
    const rec: ProgressRecord = {
      id: existing ? existing.id : `prog-${Date.now()}`,
      userId,
      chapterId,
      pageNumber,
      version: newVersion,
      updatedAt: new Date().toISOString(),
    };
    this.progress.set(key, rec);
    return rec;
  }

  getProgress(userId: string, chapterId: string): ProgressRecord | null {
    return this.progress.get(`${userId}:${chapterId}`) ?? null;
  }

  // --- Preferences Operations ---
  getPreferences(userId: string): ReaderPreferenceRecord {
    return (
      this.preferences.get(userId) ?? {
        userId,
        mode: "single",
        tapZonesEnabled: true,
        theme: "dark",
        updatedAt: new Date().toISOString(),
      }
    );
  }

  savePreferences(pref: ReaderPreferenceRecord): void {
    this.preferences.set(pref.userId, { ...pref, updatedAt: new Date().toISOString() });
  }
}

export const db = new MemoryDatabase();
