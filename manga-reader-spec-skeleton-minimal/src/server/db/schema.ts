/**
 * Schema definitions for Manga Reader domain models.
 * Conforms to DATA_MODEL.md and ARCHITECTURE.md.
 * Invariants: Opaque IDs, UTC timestamps, 1-based page numbers.
 */

export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  role: "reader" | "editor" | "admin";
  createdAt: string;
  updatedAt: string;
}

export interface MangaRecord {
  id: string;
  slug: string;
  title: string;
  description?: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  readingDirection: "rtl" | "ltr";
  author?: string;
  artist?: string;
  coverAssetKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterRecord {
  id: string;
  mangaId: string;
  chapterNumber: number;
  title?: string;
  status: "DRAFT" | "PROCESSING" | "READY" | "PUBLISHED" | "ARCHIVED";
  publicationRevision: string;
  pageCount: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterPageRecord {
  id: string;
  chapterId: string;
  pageNumber: number; // 1-based ordinal
  assetKey: string;   // Opaque internal key
  width: number;
  height: number;
  createdAt: string;
}

export interface ProgressRecord {
  id: string;
  userId: string;
  chapterId: string;
  pageNumber: number;
  version: number;
  updatedAt: string;
}

export interface LibraryEntryRecord {
  id: string;
  userId: string;
  mangaId: string;
  status: "reading" | "completed" | "on_hold" | "dropped";
  updatedAt: string;
}

export interface BookmarkRecord {
  id: string;
  userId: string;
  chapterId: string;
  pageNumber: number;
  createdAt: string;
}

export interface ReaderPreferenceRecord {
  userId: string;
  mode: "single" | "double" | "vertical";
  directionOverride?: "rtl" | "ltr";
  tapZonesEnabled: boolean;
  theme: "dark" | "light" | "system";
  updatedAt: string;
}
