/**
 * features/admin — AdminService: curator operations orchestration.
 *
 * Responsibility: manga/chapter CRUD orchestration, publish orchestration,
 * user management (with the last-admin guard), stats assembly. Every
 * mutation emits an audit event (FR-ADMIN-007) BEFORE returning.
 *
 * Requirements: FR-ADMIN-001…008, NFR-SEC-012, THREAT T-07.
 * Tasks: T-ADMIN-001…008.
 *
 * Rules:
 * - Role re-check is the WEB guard's job (requireAdmin); this service
 *   assumes an admin caller (defense in depth: guards at both layers).
 * - No duplicated domain rules: manga/chapter semantics are delegated to
 *   the manga/chapters features (D9: public surface only).
 * - Audit: append-only via the AuditSink port; before/after summaries
 *   capped 2 KB/field, no secrets, no full synopsys (EC-ADM-06).
 * - Publish requires ≥ 1 page (409 CHAPTER_NOT_READY) — the single rule
 *   (DATA_MODEL §21.3) enforced here, not per-call-site.
 * - Last-admin guard (EC-ADM-04) for demote/disable.
 * - Slug immutable after first publish (EC-ADM-07).
 */
import type { Caller } from '../../shared/contracts';

export interface AdminService {
  // Manga (T-ADMIN-002/003)
  createManga(caller: Caller, input: {
    title: string; slug?: string; synopsis?: string;
    status: 'ongoing' | 'completed' | 'hiatus'; readingDirection: 'rtl' | 'ltr';
    genreNames: string[]; tagNames: string[];
    creators: Array<{ name: string; role: 'author' | 'artist' | 'other' }>;
  }): Promise<string>; // ⇒ MANGA_SLUG_TAKEN on conflict

  updateManga(caller: Caller, mangaId: string, patch: Record<string, unknown>): Promise<void>;
  deleteManga(caller: Caller, mangaId: string): Promise<void>; // soft
  restoreManga(caller: Caller, mangaId: string): Promise<void>;
  publishManga(caller: Caller, mangaId: string, publish: boolean): Promise<{ affected: number }>;
  setCover(caller: Caller, mangaId: string, image: Uint8Array, format: string): Promise<void>;

  // Chapters (T-ADMIN-004/005)
  createChapter(caller: Caller, mangaId: string, input: {
    number: number; title?: string | null; notes?: string;
  }): Promise<string>; // ⇒ CHAPTER_DUPLICATE_NUMBER

  updateChapter(caller: Caller, chapterId: string, patch: Record<string, unknown>): Promise<void>;
  deleteChapter(caller: Caller, chapterId: string): Promise<void>; // soft
  publishChapters(caller: Caller, mangaId: string, chapterIds: string[], publish: boolean): Promise<{ affected: number; skipped: number }>;

  // Users (T-ADMIN-006)
  listUsers(query: { cursor?: string; limit?: number; emailContains?: string }): Promise<unknown[]>;
  updateUser(caller: Caller, userId: string, patch: { role?: 'reader' | 'admin'; status?: 'active' | 'disabled' }): Promise<void>;
  // ⇒ ADMIN_LAST_ADMIN (guard), audit 'user.update'

  // Read-only (not audited — documented)
  stats(caller: Caller): Promise<Record<string, unknown>>; // FR-ADMIN-008
  auditLog(query: { cursor?: string; targetKind?: string; targetId?: string }): Promise<unknown>;
}

/**
 * TODO(T-ADMIN-001): factory (wired with manga/chapter/user repos,
 * AuditSink, and the auth guard context).
 */
export function createAdminService(deps: {
  manga: import('../manga').MangaRepository;
  chapters: import('../chapters').ChapterRepository;
  users: import('../auth').UserRepository;
  audit: import('../../shared/contracts').AuditSink;
}): AdminService {
  throw new Error('Not implemented: T-ADMIN-001 (admin service wiring)');
}
