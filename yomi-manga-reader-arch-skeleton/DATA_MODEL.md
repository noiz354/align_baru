# DATA_MODEL — Conceptual Data Model

Date: 2026-09-26 · Status: Authoritative conceptual model. **No migrations exist yet.** Migration generation is task T-FOUND-006 (VS-0) and must implement this document. The descriptive schema skeleton is `src/server/db/schema.ts`.

Conventions:
- IDs: `uuid` v7 (time-ordered) PKs unless noted.
- Timestamps: `timestamptz`, UTC (NFR-DATA-006). Every table with lifecycle has `created_at`; mutable rows add `updated_at`.
- Soft-delete: `deleted_at timestamptz NULL` on catalog content (NFR-DATA-002).
- Enum-ish values: `text` + `CHECK` constraint (simple, migration-friendly) — e.g., `status IN ('ongoing','completed','hiatus')`.
- All FKs explicit; ON DELETE behavior stated per table.
- Index names: `ix_{table}_{columns}`.

## Entity Relationship (summary)

```
User ──< Session
User ──< LibraryEntry >── Manga
User ──< ReadingProgress >── Chapter
User ──< ReadingHistory  >── Chapter
User ──< Bookmark        >── Chapter
User ──  ReaderPreference (0..1)
Manga ──< MangaAlias, MangaCreator >── Creator, MangaGenre >── Genre, MangaTag >── Tag
Manga ──< Chapter ──< ChapterPage
Manga ──  cover asset (assetKey ref)
Chapter ──  status/pages via ChapterPage
UploadJob ──< Manga? Chapter?  (1:1 per attempt to a chapter)
AuditEvent (user, action, target, before/after JSONB)
ResetToken ── User
```

---

## 1. User

- **Purpose:** Account for readers and admins.
- **Ownership:** features/auth.
- **Cardinality:** 1 per person.
- **PK:** `id uuid`.
- **FK:** —.
- **Uniqueness:** `email` unique (citext, case-insensitive).
- **Columns (conceptual):** `id`, `email citext NOT NULL`, `display_name text NOT NULL DEFAULT ''`, `password_hash text NOT NULL` (Argon2id string), `role text NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','admin'))`, `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled'))`, `last_login_at timestamptz NULL`, `created_at`, `updated_at`.
- **Indexes:** `ix_users_email` (unique), `ix_users_role` (admin lookup), `ix_users_status`.
- **Lifecycle:** created (register) → active/disabled (admin) → deleted (self-serve, FR-AUTH-005).
- **Deletion policy:** hard delete with cascade: sessions, progress, history, library, bookmarks, preferences; reset tokens; audit rows referencing the user are kept with `actor_id NULL, actor_email '<deleted>'` (audit immutability, NFR-SEC-012). Last-admin guard: cannot disable/demote the final active admin (docs/product/edge-cases.md EC-ADM-04).

## 2. Session

- **Purpose:** Server-side session (ADR-006).
- **Ownership:** features/auth (domain), server/auth (store).
- **Cardinality:** 1:N with User.
- **PK:** `id uuid`.
- **FK:** `user_id → users.id` (ON DELETE CASCADE).
- **Uniqueness:** `session_token` (256-bit random, base64url) unique — this is what the cookie carries.
- **Columns:** `id`, `user_id`, `session_token text NOT NULL`, `user_agent text NULL`, `ip inet NULL`, `created_at`, `expires_at timestamptz NOT NULL` (idle), `absolute_expires_at timestamptz NOT NULL`, `last_seen_at timestamptz`.
- **Indexes:** `ix_sessions_token` (unique), `ix_sessions_user_id`, `ix_sessions_expires_at` (expiry sweep).
- **Lifecycle:** created on login → sliding idle extension (max 30 d) → revoked on logout/expiry sweep.
- **Deletion policy:** hard delete on logout/expiry/user delete.

## 3. Manga

- **Purpose:** A title in the collection.
- **Ownership:** features/manga (rules); admin features write.
- **Cardinality:** 1:N with chapters; M:N with genres/tags/creators.
- **PK:** `id uuid`.
- **FK:** —.
- **Uniqueness:** `slug` unique (URL identity).
- **Columns:** `id`, `slug text NOT NULL`, `title text NOT NULL`, `synopsis text NOT NULL DEFAULT ''`, `status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','completed','hiatus'))`, `reading_direction text NOT NULL DEFAULT 'rtl' CHECK (reading_direction IN ('rtl','ltr'))` (FR-READER-004/005), `published boolean NOT NULL DEFAULT false` (FR-CHAPTER-002 visibility), `cover_asset_key text NULL` (FR-CATALOG-005; FR-UPLOAD-010), `created_at`, `updated_at`, `deleted_at timestamptz NULL` (FR-ADMIN-003).
- **Indexes:** `ix_manga_slug` (unique), `ix_manga_title`, `ix_manga_updated_at` (sort), `ix_manga_created_at` (sort), partial index `ix_manga_visible ON (updated_at) WHERE deleted_at IS NULL AND published = true` (catalog hot path, NFR-PERF-014).
- **Lifecycle:** created (admin) → draft → published → (unpublished) → soft-deleted → (restored or permanently purged by ops policy).
- **Deletion policy:** soft-delete (hidden + non-readable, chapters cascade-hidden). Hard purge only via ops procedure after retention (NFR-DATA-005); orphaned assets become GC candidates.

## 4. MangaAlias

- **Purpose:** Alternate titles for search (FR-SEARCH-001).
- **Ownership:** features/manga.
- **Cardinality:** N:1 with Manga.
- **PK:** `id uuid`.
- **FK:** `manga_id → manga.id` (CASCADE).
- **Uniqueness:** `(manga_id, alias)` unique.
- **Columns:** `manga_id`, `alias text NOT NULL`, `created_at`.
- **Indexes:** `ix_manga_alias_alias` (trigram, see §Search support).
- **Lifecycle/deletion:** with manga.

## 5. Creator

- **Purpose:** Author/artist entity (searchable, FR-SEARCH-002).
- **Ownership:** features/manga.
- **Cardinality:** M:N with Manga.
- **PK:** `id uuid`.
- **Uniqueness:** `name` unique.
- **Columns:** `name text NOT NULL`, `role_default text NOT NULL DEFAULT 'author' CHECK (role_default IN ('author','artist','other'))`, `created_at`.
- **Indexes:** `ix_creators_name` (unique).
- **Deletion:** guarded — only removable when no manga references it (admin UI enforces).

## 6. Genre

- **Purpose:** Controlled vocabulary for catalog filtering (FR-CATALOG-002).
- **Ownership:** features/manga (admin manages).
- **Cardinality:** M:N with Manga.
- **PK:** `id uuid`. **Uniqueness:** `name` unique.
- **Columns:** `name text NOT NULL`, `created_at`.
- **Indexes:** `ix_genres_name` (unique).
- **Deletion:** guarded when in use.

## 7. Tag

- **Purpose:** Freeform tags for search (FR-SEARCH-003).
- **Ownership:** features/manga.
- **PK:** `id uuid`. **Uniqueness:** `name` unique (lower-cased).
- **Columns:** `name text NOT NULL`, `created_at`.
- **Deletion:** guarded when in use.

## 8. Join tables: MangaCreator / MangaGenre / MangaTag

- **Purpose:** M:N links.
- **Ownership:** features/manga.
- **PK:** composite `(manga_id, x_id)`.
- **FK:** both, ON DELETE CASCADE.
- **Indexes:** PK covers manga-side; add reverse index `ix_mangagenre_genre` etc. for "manga of genre" queries (catalog filter hot path).
- **MangaCreator extra:** `role text CHECK (role IN ('author','artist','other')) NOT NULL`.

## 9. Chapter

- **Purpose:** A unit of reading content.
- **Ownership:** features/chapters (rules); admin + uploads write.
- **Cardinality:** N:1 with Manga; 1:N with pages.
- **PK:** `id uuid`.
- **FK:** `manga_id → manga.id` (CASCADE).
- **Uniqueness:** `(manga_id, number)` unique (FR-CHAPTER-001).
- **Columns:** `id`, `manga_id`, `number numeric(8,2) NOT NULL` (supports 10.5), `title text NULL`, `notes text NOT NULL DEFAULT ''`, `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published'))` (FR-CHAPTER-002), `published_at timestamptz NULL`, `page_count integer NOT NULL DEFAULT 0` (denormalized, NFR-PERF-014), `reading_order integer NOT NULL` (explicit tiebreaker, FR-CHAPTER-004), `created_at`, `updated_at`, `deleted_at timestamptz NULL`.
- **Indexes:** `ix_chapters_manga_order UNIQUE (manga_id, reading_order)` (chapter list hot path), `ix_chapters_number` (unique with manga), partial `ix_chapters_visible ON (reading_order) WHERE deleted_at IS NULL AND status='published'`.
- **Lifecycle:** draft → (pages ready via upload) → published → unpublished → soft-deleted.
- **Deletion policy:** soft-delete hides from readers and catalog counts; hard delete only by admin with confirmation (FR-ADMIN-004), pages become GC candidates, progress/history rows referencing it are orphaned-preserved (display as "unavailable chapter" per edge case EC-RDR-08).

## 10. ChapterPage

- **Purpose:** One page of a chapter (the reader's atom).
- **Ownership:** features/uploads writes; features/chapters/reader read.
- **Cardinality:** N:1 with Chapter.
- **PK:** `id uuid`.
- **FK:** `chapter_id → chapters.id` (CASCADE).
- **Uniqueness:** `(chapter_id, page_number)` unique; `page_number` is 1-based.
- **Columns:** `chapter_id`, `page_number integer NOT NULL CHECK (page_number >= 1)`, `asset_key text NOT NULL` (unguessable; FR-MEDIA-003 — **never** the physical path), `width integer NOT NULL`, `height integer NOT NULL`, `byte_size_avif bigint NULL`, `byte_size_webp bigint NULL`, `byte_size_jpeg bigint NULL` (NFR-PERF-009 verification), `created_at`.
- **Indexes:** PK `(chapter_id, page_number)`; `ix_pages_asset_key` (media delivery lookup, unique).
- **Lifecycle:** created in the upload commit transaction (FR-UPLOAD-006); replaced on re-ingest (FR-UPLOAD-009) — old rows deleted, old assets GC-eligible.
- **Deletion:** with chapter; re-ingest replaces the set atomically.

## 11. LibraryEntry

- **Purpose:** "In my library" membership.
- **Ownership:** features/library.
- **Cardinality:** 1:1 (User, Manga).
- **PK:** `(user_id, manga_id)` composite.
- **FK:** both (CASCADE on user; CASCADE on manga hard-delete).
- **Columns:** `added_at`, `last_read_at timestamptz NULL` (denormalized for sorting, FR-LIBRARY-004).
- **Indexes:** PK; `ix_library_user_lastread (user_id, last_read_at DESC)` (continue-reading hot path).
- **Deletion:** hard delete on remove (FR-LIBRARY-002) or user delete.

## 12. ReadingProgress

- **Purpose:** Latest position per user per chapter (FR-READER-012/014).
- **Ownership:** features/progress.
- **Cardinality:** 1:1 (User, Chapter).
- **PK:** `(user_id, chapter_id)` composite.
- **FK:** both (CASCADE).
- **Columns:** `page_number integer NOT NULL CHECK (page_number >= 1)`, `scroll_position float8 NOT NULL DEFAULT 0` (vertical-mode offset within page, 0..1), `completed boolean NOT NULL DEFAULT false` (FR-READER-017), `updated_at` (server time — LWW basis, NFR-DATA-003).
- **Indexes:** PK; `ix_progress_user_updated (user_id, updated_at DESC)` (history/continue lists).
- **Lifecycle:** upsert-only, idempotent (NFR-DATA-003): an update is applied only if `updated_at >= stored.updated_at` (server-stamped); completion is sticky (cannot be unset by a page write — only by explicit unmark, FR-LIBRARY-007).
- **Deletion:** with user/chapter.

## 13. ReadingHistory

- **Purpose:** Append-only-ish read log (FR-READER-015, FR-LIBRARY-008).
- **Ownership:** features/progress.
- **Cardinality:** N:1 with User; N:1 with Chapter.
- **PK:** `id uuid` (high volume).
- **FK:** `user_id` (CASCADE), `chapter_id` (SET NULL → "unavailable chapter" rendering).
- **Columns:** `page_number integer NOT NULL` (deepest reached), `started_at timestamptz`, `ended_at timestamptz NULL`, `duration_ms integer NULL`.
- **Indexes:** `ix_history_user_time (user_id, started_at DESC)` (history list hot path).
- **Lifecycle:** one row per contiguous read session per chapter (opened → closed/completed/tab-hidden > 5 min); upsert on re-entry within the window.
- **Deletion:** with user; chapter FK SET NULL (retains count/value, NFR-DATA-005).

## 14. Bookmark

- **Purpose:** Saved position (FR-LIBRARY-009).
- **Ownership:** features/library.
- **Cardinality:** N:1 User; N:1 Chapter.
- **PK:** `id uuid`.
- **FK:** `user_id` (CASCADE), `chapter_id` (SET NULL).
- **Uniqueness:** `(user_id, chapter_id, page_number)` unique (one bookmark per page).
- **Columns:** `page_number integer NULL` (NULL = chapter start), `note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 280)`, `created_at`.
- **Indexes:** `ix_bookmarks_user (user_id, created_at DESC)`.
- **Deletion:** hard.

## 15. ReaderPreference

- **Purpose:** Per-user reader defaults (FR-READER-021).
- **Ownership:** features/reader (domain) / settings UI.
- **Cardinality:** 0..1 per User.
- **PK:** `user_id` (FK, CASCADE).
- **Columns:** `default_mode text CHECK (default_mode IN ('vertical','single','double')) DEFAULT 'vertical'`, `direction_override text CHECK (direction_override IN ('none','rtl','ltr')) DEFAULT 'none'`, `zoom_default numeric(4,2) DEFAULT 1.0`, `auto_next_chapter boolean DEFAULT true`, `updated_at`.
- **Indexes:** PK.
- **Deletion:** with user.

## 16. UploadJob

- **Purpose:** One ingestion attempt (FR-UPLOAD-007).
- **Ownership:** features/uploads.
- **Cardinality:** N:1 with Manga; N:1 with Chapter (a chapter may have many jobs over time — re-ingest).
- **PK:** `id uuid`.
- **FK:** `manga_id` (SET NULL), `chapter_id` (SET NULL), `created_by → users.id` (SET NULL, auditability).
- **Columns:** `state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','validating','processing','ready','failed'))`, `input_kind text CHECK (input_kind IN ('zip','images'))`, `staging_key text` (temp storage prefix; 24 h purge), `source_name text`, `file_count integer NULL`, `byte_size bigint NULL`, `error_code text NULL` (typed UPLOAD_*/STORAGE_*), `error_message text NULL`, `started_at`, `finished_at`, `created_at`.
- **Indexes:** `ix_uploads_state (state, created_at)` (ops queue), `ix_uploads_chapter (chapter_id, created_at DESC)`.
- **Lifecycle:** state machine in docs/product/admin-workflow.md §6; transitions only via features/uploads.
- **Deletion:** retained for audit (≥ 1 y, NFR-DATA-005); staging data purged 24 h after failure.

## 17. ResetToken

- **Purpose:** Single-use password reset (FR-AUTH-004).
- **Ownership:** features/auth.
- **Cardinality:** N:1 with User.
- **PK:** `id uuid`.
- **FK:** `user_id` (CASCADE).
- **Uniqueness:** `token_hash` unique (store SHA-256 of token, never raw).
- **Columns:** `token_hash text NOT NULL`, `expires_at timestamptz NOT NULL` (60 min), `used_at timestamptz NULL`, `created_at`.
- **Indexes:** `ix_resettokens_hash` (unique), `ix_resettokens_user`.
- **Lifecycle:** created on request (max 1 active per user; new request invalidates old) → used → purged after use/expiry (sweep task, T-AUTH-009).
- **Deletion:** hard.

## 18. AuditEvent

- **Purpose:** Immutable admin-action log (FR-ADMIN-007, NFR-SEC-012).
- **Ownership:** features/admin (writes via an `AuditSink` port); read-only for all.
- **Cardinality:** 1:N with User (actor), arbitrary target.
- **PK:** `id bigserial` (append-only, monotonically sortable).
- **FK:** `actor_id → users.id` (SET NULL).
- **Columns:** `actor_email text NULL` (post-deletion provenance), `action text NOT NULL` (e.g., `manga.create`, `manga.publish`, `user.role.change`, `chapter.delete`), `target_kind text NOT NULL` (manga/chapter/user/upload), `target_id text NOT NULL`, `before jsonb NULL`, `after jsonb NULL` (summarized, no secrets/PII beyond email, NFR-OBS-006), `ip inet NULL`, `created_at`.
- **Indexes:** `ix_audit_target (target_kind, target_id, created_at DESC)`, `ix_audit_actor (actor_id, created_at DESC)`, `ix_audit_created (created_at)`.
- **Lifecycle:** append-only; **no UPDATE/DELETE path in application code** (DB role permissions enforce; T-SEC-005 verifies).
- **Deletion:** none (retention ≥ 1 y, NFR-DATA-005).

## 19. Search Support (not tables)

- Title/alias search: PostgreSQL `pg_trgm` GIN trigram indexes on `manga.title` and `manga_alias.alias` (FR-SEARCH-001).
- Creator/tag: btree on names (small sets).
- FTS (`tsvector`) is OPTIONAL and REJECTED for v1 (title search is the 95% case; trigram covers prefix+contains with one mechanism). Revisit when synopsis search is requested (ADR-002 Revisit When).

## 20. Capacity & Growth Assumptions

- Reference scale: ≤ 2,000 manga, ≤ 50,000 chapters, ≤ 5,000,000 pages (≈ 3–5 TB objects).
- `chapter_page` rows dominate: indexed by PK; no partitioning needed at this scale. Partitioning is a documented scale option (ADR-002), not a v1 feature.
- History grows with reads; monthly rollover/archive is an ops option, not v1 (NFR-DATA-005).

## 21. Integrity Rules (NFR-DATA-001)

1. A page cannot exist without a chapter; a chapter without a manga (enforced by FKs).
2. `page_number` is contiguous 1..N within a chapter at "ready" state (checked in the upload commit; enforced by constraint + service invariant).
3. A published chapter must have ≥ 1 page or it is un-publishable (service rule, FR-CHAPTER-002).
4. `(manga_id, number)` uniqueness prevents accidental duplicate chapters (upload conflict → typed error, docs/product/edge-cases.md EC-UP-03).
5. Slugs are immutable after first publish (prevents broken deep links); rename = new slug + 301 at app level (edge case EC-ADM-07).
