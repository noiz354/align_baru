import type {
  MangaRecord,
  ChapterRecord,
  ChapterPageRecord,
  ProgressRecord,
  LibraryEntryRecord,
  BookmarkRecord,
  ReaderPreferenceRecord,
  UserRecord,
  SessionRecord,
} from "./schema";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/**
 * File-backed unified repository store preserving invariants from DATA_MODEL.md.
 * Enables durable progress while strictly respecting architecture boundaries.
 * Persistence: ./data/db.json (JSON, file-backed, survives restart). No Postgres required for minimal.
 * Wave3: adds user-owned progress with authenticated sessions (reader.a/b).
 */
function hashPassword(password: string): string {
  // deterministic scrypt for demo (salt is static for seeded users, but per-user random would be better)
  return crypto.scryptSync(password, "minimal-static-salt-wave3", 64).toString("hex");
}
function verifyPassword(password: string, hash?: string): boolean {
  if (!hash) return false;
  const h = hashPassword(password);
  // timingSafeEqual
  const a = Buffer.from(h, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

class MemoryDatabase {
  users: Map<string, UserRecord> = new Map();
  manga: Map<string, MangaRecord> = new Map();
  chapters: Map<string, ChapterRecord> = new Map();
  pages: Map<string, ChapterPageRecord[]> = new Map();
  progress: Map<string, ProgressRecord> = new Map();
  library: Map<string, LibraryEntryRecord> = new Map();
  bookmarks: Map<string, BookmarkRecord> = new Map();
  preferences: Map<string, ReaderPreferenceRecord> = new Map();
  sessions: Map<string, SessionRecord> = new Map();

  private dbPath: string;

  constructor() {
    // data/db.json relative to project root (process.cwd() in Next dev/build)
    this.dbPath = path.join(process.cwd(), "data", "db.json");
    if (!this.loadFromFile()) {
      this.seedDefaults();
      this.persist();
    } else {
      // ensure seed data exists even after load (idempotent)
      this.ensureSeed();
      this.ensureAuthSeed();
      this.persist();
    }
  }

  private loadFromFile(): boolean {
    try {
      if (!fs.existsSync(this.dbPath)) return false;
      const raw = fs.readFileSync(this.dbPath, "utf-8");
      if (!raw) return false;
      const data = JSON.parse(raw);
      // data is { users: [...], manga: [...], chapters: [...], pages: {...}, progress: [...], ... }
      this.users = new Map(data.users || []);
      this.manga = new Map(data.manga || []);
      this.chapters = new Map(data.chapters || []);
      // pages stored as { [chapterId]: ChapterPageRecord[] }
      this.pages = new Map(Object.entries(data.pages || {}));
      this.progress = new Map(data.progress || []);
      this.library = new Map(data.library || []);
      this.bookmarks = new Map(data.bookmarks || []);
      this.preferences = new Map(data.preferences || []);
      this.sessions = new Map(data.sessions || []);
      // migrate old users without passwordHash
      for (const [id, u] of this.users) {
        if (!(u as any).passwordHash && u.email === "reader@domain.local") {
          (u as any).passwordHash = hashPassword("guest123");
          this.users.set(id, u as UserRecord);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  private persist() {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = {
        users: Array.from(this.users.entries()),
        manga: Array.from(this.manga.entries()),
        chapters: Array.from(this.chapters.entries()),
        pages: Object.fromEntries(this.pages.entries()),
        progress: Array.from(this.progress.entries()),
        library: Array.from(this.library.entries()),
        bookmarks: Array.from(this.bookmarks.entries()),
        preferences: Array.from(this.preferences.entries()),
        sessions: Array.from(this.sessions.entries()),
      };
      // atomic write via temp file
      const tmp = this.dbPath + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmp, this.dbPath);
    } catch {
      // ignore persist errors in dev (fallback to memory)
    }
  }

  private ensureSeed() {
    // if any of the 3 manga missing, seed them
    const needed = ["manga-sample-01", "manga-sample-02", "manga-sample-03"];
    const hasAll = needed.every((id) => this.manga.has(id));
    if (hasAll && this.chapters.has("ch-002")) return;
    // re-seed missing parts without wiping progress
    const existingIds = new Set(this.manga.keys());
    if (!existingIds.has("manga-sample-01")) {
      this.seedDefaults(); // will add all 3 fresh
    } else {
      // add missing manga 2 & 3
      const m2: MangaRecord = {
        id: "manga-sample-02",
        slug: "sample-manga-2",
        title: "The Licensed Adventure II",
        description: "Second authorized volume — same strict reader architecture.",
        status: "PUBLISHED",
        readingDirection: "rtl",
        author: "Spec Creator",
        artist: "Spec Illustrator",
        coverAssetKey: "asset://covers/sample-manga-2.webp",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const m3: MangaRecord = {
        id: "manga-sample-03",
        slug: "sample-manga-3",
        title: "The Licensed Adventure III",
        description: "Third authorized volume — vertical & double modes.",
        status: "PUBLISHED",
        readingDirection: "ltr",
        author: "Spec Creator",
        artist: "Spec Illustrator",
        coverAssetKey: "asset://covers/sample-manga-3.webp",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!this.manga.has(m2.id)) this.manga.set(m2.id, m2);
      if (!this.manga.has(m3.id)) this.manga.set(m3.id, m3);
      // chapters for 2 & 3
      const extra: ChapterRecord[] = [
        { id: "ch-002", mangaId: m2.id, chapterNumber: 1, title: "Chapter 1: Shadows", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 12, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "ch-003", mangaId: m2.id, chapterNumber: 2, title: "Chapter 2: Light", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 8, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "ch-004", mangaId: m3.id, chapterNumber: 1, title: "Chapter 1: Origin", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 10, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "ch-005", mangaId: m3.id, chapterNumber: 2, title: "Chapter 2: Return", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 14, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
      for (const ch of extra) {
        if (!this.chapters.has(ch.id)) {
          this.chapters.set(ch.id, ch);
          const pgs: ChapterPageRecord[] = Array.from({ length: ch.pageCount }, (_, i) => ({
            id: `pg-${ch.id}-${i + 1}`,
            chapterId: ch.id,
            pageNumber: i + 1,
            assetKey: `asset://manga-${ch.mangaId}/${ch.id}/p-${i + 1}`,
            width: 1200,
            height: 1800,
            createdAt: new Date().toISOString(),
          }));
          this.pages.set(ch.id, pgs);
        }
      }
    }
  }

  private ensureAuthSeed() {
    // ensure reader.a and reader.b exist with password hashes
    const needed = [
      { id: "usr-reader-a", email: "reader.a@example.test", name: "Reader A", password: "PasswordA123!" },
      { id: "usr-reader-b", email: "reader.b@example.test", name: "Reader B", password: "PasswordB123!" },
    ];
    for (const u of needed) {
      const existing = Array.from(this.users.values()).find((x) => x.email.toLowerCase() === u.email.toLowerCase());
      if (!existing) {
        const rec: UserRecord = {
          id: u.id,
          email: u.email,
          name: u.name,
          role: "reader",
          passwordHash: hashPassword(u.password),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.users.set(rec.id, rec);
      } else if (!existing.passwordHash) {
        existing.passwordHash = hashPassword(u.password);
        this.users.set(existing.id, existing);
      }
    }
  }

  private seedDefaults() {
    const defaultUser: UserRecord = {
      id: "usr-guest-001",
      email: "reader@domain.local",
      name: "Standard Reader",
      role: "reader",
      passwordHash: hashPassword("guest123"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(defaultUser.id, defaultUser);
    // wave3 seeded readers
    this.ensureAuthSeed();

    const manga01: MangaRecord = {
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
    const manga02: MangaRecord = {
      id: "manga-sample-02",
      slug: "sample-manga-2",
      title: "The Licensed Adventure II",
      description: "Second authorized volume — same strict reader architecture.",
      status: "PUBLISHED",
      readingDirection: "rtl",
      author: "Spec Creator",
      artist: "Spec Illustrator",
      coverAssetKey: "asset://covers/sample-manga-2.webp",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const manga03: MangaRecord = {
      id: "manga-sample-03",
      slug: "sample-manga-3",
      title: "The Licensed Adventure III",
      description: "Third authorized volume — vertical & double modes.",
      status: "PUBLISHED",
      readingDirection: "ltr",
      author: "Spec Creator",
      artist: "Spec Illustrator",
      coverAssetKey: "asset://covers/sample-manga-3.webp",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.manga.set(manga01.id, manga01);
    this.manga.set(manga02.id, manga02);
    this.manga.set(manga03.id, manga03);

    const chapters: ChapterRecord[] = [
      { id: "ch-001", mangaId: manga01.id, chapterNumber: 1, title: "Chapter 1: The Beginning", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 12, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ch-002", mangaId: manga02.id, chapterNumber: 1, title: "Chapter 1: Shadows", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 12, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ch-003", mangaId: manga02.id, chapterNumber: 2, title: "Chapter 2: Light", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 8, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ch-004", mangaId: manga03.id, chapterNumber: 1, title: "Chapter 1: Origin", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 10, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: "ch-005", mangaId: manga03.id, chapterNumber: 2, title: "Chapter 2: Return", status: "PUBLISHED", publicationRevision: "rev-1", pageCount: 14, publishedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    for (const ch of chapters) {
      this.chapters.set(ch.id, ch);
      const pgs: ChapterPageRecord[] = Array.from({ length: ch.pageCount }, (_, i) => ({
        id: `pg-${ch.id}-${i + 1}`,
        chapterId: ch.id,
        pageNumber: i + 1,
        assetKey: `asset://manga-${ch.mangaId}/${ch.id}/p-${i + 1}`,
        width: 1200,
        height: 1800,
        createdAt: new Date().toISOString(),
      }));
      this.pages.set(ch.id, pgs);
    }

    // seed a progress record for demo: guest at ch-001 page 5
    const demoProg: ProgressRecord = {
      id: "prog-demo-001",
      userId: defaultUser.id,
      chapterId: "ch-001",
      pageNumber: 5,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    this.progress.set(`${defaultUser.id}:ch-001`, demoProg);
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

  // --- Auth helpers ---
  findUserByEmail(email: string): UserRecord | null {
    const lower = email.toLowerCase();
    for (const u of this.users.values()) if (u.email.toLowerCase() === lower) return u;
    return null;
  }
  verifyUserPassword(user: UserRecord, password: string): boolean {
    return verifyPassword(password, user.passwordHash);
  }
  createSession(userId: string): SessionRecord {
    const token = crypto.randomUUID();
    const rec: SessionRecord = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.sessions.set(token, rec);
    this.persist();
    return rec;
  }
  getSessionByToken(token: string): SessionRecord | null {
    const s = this.sessions.get(token) ?? null;
    if (!s) return null;
    if (new Date(s.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      this.persist();
      return null;
    }
    return s;
  }
  deleteSession(token: string): void {
    this.sessions.delete(token);
    this.persist();
  }
  getUserById(id: string): UserRecord | null {
    return this.users.get(id) ?? null;
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
    this.persist();
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
    this.persist();
  }
}

export const db = new MemoryDatabase();
export { hashPassword };
