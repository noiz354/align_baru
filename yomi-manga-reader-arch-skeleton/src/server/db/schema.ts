/**
 * Drizzle schema — DESCRIPTIVE SKELETON ONLY.
 *
 * Authority: DATA_MODEL.md (tables 1–19). This file exists to establish
 * the project structure and make the model findable; it contains NO real
 * Drizzle DDL in the architecture phase (prohibited: real migrations).
 *
 * Requirements: NFR-DATA-001/006, NFR-SEC-015.
 * Tasks: T-FOUND-005 (schema DDL implementation), T-FOUND-006 (migration),
 * INT-DB-001 (schema assertions).
 *
 * Implementation rules (normative for T-FOUND-005):
 * - 1:1 with DATA_MODEL.md: every table, FK, CHECK, unique, and index
 *   (including the partial `ix_manga_visible` / `ix_chapters_visible` and
 *   the pg_trgm GIN indexes on title/alias — DATA_MODEL §19).
 * - uuid v7 PKs; timestamptz UTC; citext emails; CHECK constraints for
 *   enums/states (text columns).
 * - `pg_trgm` extension enabled in the initial migration.
 * - App DB role gets NO DDL (T-SEC-005); audit table: app role has no
 *   UPDATE/DELETE (append-only, NFR-SEC-012).
 *
 * Table inventory (→ DATA_MODEL.md sections):
 *   users, sessions, manga, manga_alias, creator, genre, tag,
 *   manga_creator, manga_genre, manga_tag, chapter, chapter_page,
 *   library_entry, reading_progress, reading_history, bookmark,
 *   reader_preference, upload_job, reset_token, audit_event
 *
 * TODO(T-FOUND-005): replace this descriptive skeleton with the real
 * drizzle-orm/pg schema (the type-level mirror of DATA_MODEL.md).
 */

/**
 * Descriptive placeholder (NOT Drizzle DDL).
 *
 * Example of the intended shape (documentation only — not code):
 *
 *   export const manga = pgTable('manga', {
 *     id: uuid('id').primaryKey(),
 *     slug: text('slug').notNull().unique(),
 *     title: text('title').notNull(),
 *     ... // see DATA_MODEL.md §3 for the complete column set
 *   });
 *   // + unique slug, partial index ix_manga_visible, etc.
 */
export const SCHEMA_TABLES: readonly string[] = [
  'users', 'sessions', 'manga', 'manga_alias', 'creator', 'genre', 'tag',
  'manga_creator', 'manga_genre', 'manga_tag', 'chapter', 'chapter_page',
  'library_entry', 'reading_progress', 'reading_history', 'bookmark',
  'reader_preference', 'upload_job', 'reset_token', 'audit_event',
];
