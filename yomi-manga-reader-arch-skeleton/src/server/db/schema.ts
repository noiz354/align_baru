/**
 * Drizzle schema — the executable, 1:1 mirror of DATA_MODEL.md §1–19.
 *
 * Authority: DATA_MODEL.md is authoritative; this file is its type-level and
 * DDL-level mirror, and T-FOUND-006 turns it into SQL. Every table, foreign
 * key, CHECK constraint, uniqueness rule and index named in DATA_MODEL §1–19
 * appears here under the same name, so `INT-DB-001` can assert the two against
 * each other mechanically instead of by review.
 *
 * Requirements: NFR-DATA-001 (integrity/constraints), NFR-DATA-002
 * (soft delete), NFR-DATA-003 (server-stamped LWW progress), NFR-DATA-006
 * (timestamptz UTC), NFR-SEC-012 (append-only audit), NFR-SEC-015
 * (parameterized queries only), NFR-PERF-014 (every hot query has an index).
 * Tasks: T-FOUND-005 (this DDL), T-FOUND-006 (migration), INT-DB-001
 * (schema assertions against a fresh PostgreSQL), T-SEC-005 (role privileges
 * — grants are NOT created here; see `MIGRATION-ROLE-NOTE` below).
 *
 * ── Driver decision (T-FOUND-005: "driver decision documented") ────────────
 * `postgres` (postgres.js) 3.4 is the driver, chosen over `node-postgres`:
 * 1. ADR-003 fixes the Drizzle dialect to `drizzle-orm/postgres-js`; `pg` would
 *    need a second Drizzle dialect for identical SQL.
 * 2. It is ESM-first, and this package is `"type": "module"` on Node 24 — `pg`
 *    is CJS and drags a CJS interop edge into every bundler (Next.js 16,
 *    standalone output, DEPLOYMENT.md §2).
 * 3. Its connection pool is driver-side (`max`, `idle_timeout`,
 *    `connect_timeout`), so DEPLOYMENT.md §1's "app pool 10" is a driver
 *    option rather than a second pool object to keep in sync.
 * 4. Parameterization is structural: every value interpolated into a tagged
 *    template becomes a bind parameter. NFR-SEC-015 is then a property of the
 *    API surface, not of reviewer vigilance — the escape hatches (`sql.unsafe`,
 *    `sql.raw`, string-concatenated SQL) are banned in `client.ts` by comment
 *    and in review by ADR-003.
 * 5. Same-version support cadence as the ORM (both maintained by the same
 *    ecosystem; research registry rows [12][13] in
 *    docs/research/2026-stack-validation.md).
 * Recorded: connection lifecycle in `client.ts`, migration runner in
 * `migrations.ts`, boundary rule D2 (only this module may import
 * drizzle/the driver) is enforced by ESLint `no-restricted-imports`.
 *
 * ── Documented readings of DATA_MODEL.md (spec-questions, not silent picks) ─
 * 1. §10 `chapter_page` contradicts itself: its field block says "PK: `id
 *    uuid`" but its index row says "PK `(chapter_id, page_number)`", and `id`
 *    appears in no column list. The index row plus the §21 "page_number is
 *    contiguous 1..N" invariant make the composite key the real intent, so
 *    there is no surrogate `id` column. (DATA_MODEL.md:140 vs :144)
 * 2. Uniqueness is expressed as a NAMED unique INDEX (`ix_{table}_{columns}`,
 *    DATA_MODEL line 11) rather than an inline UNIQUE constraint, so that the
 *    name is identical whether a reader looks at the model or at `pg_indexes`.
 *    Names the model does not spell out are marked "(named here)" in
 *    `INT-DB-001` and listed in the T-FOUND-005 report.
 * 3. `created_at`/`updated_at` are `NOT NULL DEFAULT now()`: DATA_MODEL line 7
 *    mandates the columns; the DEFAULT is the server stamp NFR-DATA-003
 *    assumes and is required for any writer that omits them (seed harness,
 *    ops scripts, raw SQL).
 * 4. §7 Tag "unique (lower-cased)" is implemented as a unique index over
 *    `lower(name)`, so uniqueness is case-insensitive whatever case is stored.
 * 5. §8 join tables get `created_at` (DATA_MODEL line 7 applies to every table
 *    with a lifecycle) and a reverse index named by the `ix_{table}_{columns}`
 *    convention; the model's inline example `ix_mangagenre_genre` is spelled
 *    with the table name, so it reads `ix_manga_genre_genre_id`.
 * 6. §15 `reader_preference` states no NOT NULL on any column. A preference
 *    row is 0..1 per user, so "the row exists" already means "these answers
 *    exist"; NULL default_mode would make the reader's default unanswerable.
 *    Those five columns are therefore NOT NULL with the documented defaults.
 * 7. §16 `upload_job` omits NULL markers on `staging_key`, `started_at` and
 *    `finished_at`, but the state machine it defines starts at `queued`, where
 *    none of the three exists yet. They are nullable; `source_name` is NOT
 *    NULL (the client supplies it with the request).
 * 8. §14 `bookmark.page_number` gets no `>= 1` CHECK even though §10 and §12
 *    give their page columns one — the model is followed literally; logged as
 *    a spec-question for a DATA_MODEL amendment.
 *
 * MIGRATION-ROLE-NOTE: the app DB role holds DML only and the `audit_event`
 * role holds no UPDATE/DELETE (DATA_MODEL §18, T-SEC-005). Those privileges
 * are deliberately NOT created here: the initial migration runs as a separate
 * DDL-capable maintenance role (see `migrations.ts`), and the role split is
 * T-SEC-005's task, so this schema only defines the objects.
 *
 * Table inventory (→ DATA_MODEL.md sections):
 *   users(§1), sessions(§2), manga(§3), manga_alias(§4), creator(§5),
 *   genre(§6), tag(§7), manga_creator/manga_genre/manga_tag(§8), chapter(§9),
 *   chapter_page(§10), library_entry(§11), reading_progress(§12),
 *   reading_history(§13), bookmark(§14), reader_preference(§15),
 *   upload_job(§16), reset_token(§17), audit_event(§18)
 */
import { sql } from 'drizzle-orm';
import { isPgliteDsn } from './dialect';
import {
  bigint,
  bigserial,
  boolean,
  check,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  citextColumn,
  createdAt,
  deletedAt,
  exactNumeric,
  timestamptz,
  updatedAt,
  uuidReference,
  uuidV7PrimaryKey,
} from './columns';

/* ── §1 User ─────────────────────────────────────────────────────────────── */

/**
 * Account for readers and admins (DATA_MODEL §1).
 *
 * email is `citext` so uniqueness and comparison are case-insensitive
 * (AUTH lookup by email must not depend on how the reader typed it).
 * role/status are text + CHECK, not enums (DATA_MODEL line 9: migration-friendly).
 */
export const users = pgTable(
  'users',
  {
    id: uuidV7PrimaryKey(),
    email: citextColumn('email').notNull(),
    displayName: text('display_name').notNull().default(''),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('reader'),
    status: text('status').notNull().default('active'),
    lastLoginAt: timestamptz('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // FR-AUTH: login lookup by email; admin listing by role; status sweeps.
    uniqueIndex('ix_users_email').on(t.email),
    index('ix_users_role').on(t.role),
    index('ix_users_status').on(t.status),
    check('users_role', sql`${t.role} in ('reader', 'admin')`),
    check('users_status', sql`${t.status} in ('active', 'disabled')`),
  ],
);

/* ── §2 Session ──────────────────────────────────────────────────────────── */

/**
 * Server-side session (DATA_MODEL §2, ADR-006). `session_token` is the value
 * the cookie carries; `ix_sessions_expires_at` is the sweep index
 * (RUNBOOK expiry sweep, T-AUTH-009).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuidV7PrimaryKey(),
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull(),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    createdAt: createdAt(),
    expiresAt: timestamptz('expires_at').notNull(),
    absoluteExpiresAt: timestamptz('absolute_expires_at').notNull(),
    lastSeenAt: timestamptz('last_seen_at'),
  },
  (t) => [
    uniqueIndex('ix_sessions_token').on(t.sessionToken),
    index('ix_sessions_user_id').on(t.userId),
    index('ix_sessions_expires_at').on(t.expiresAt),
  ],
);

/* ── §3 Manga ────────────────────────────────────────────────────────────── */

/**
 * A title in the collection (DATA_MODEL §3).
 *
 * `published` + `deleted_at` are the two visibility axes (FR-CHAPTER-002,
 * FR-ADMIN-003); `ix_manga_visible` is the catalog hot path (NFR-PERF-014) and
 * the trigram index serves FR-SEARCH-001 prefix+contains search (§19).
 */
export const manga = pgTable(
  'manga',
  {
    id: uuidV7PrimaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    synopsis: text('synopsis').notNull().default(''),
    status: text('status').notNull().default('ongoing'),
    readingDirection: text('reading_direction').notNull().default('rtl'),
    published: boolean('published').notNull().default(false),
    // Asset KEY, never a path or public URL (FR-MEDIA-003, FR-UPLOAD-010).
    coverAssetKey: text('cover_asset_key'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => {
    // §19 pg_trgm: title search covers prefix AND contains with one mechanism. The PGlite
    // fallback has no `pg_trgm`, so it gets a plain btree. One helper decides the dialect
    // for the driver, the migrator and these indexes alike.
    const titleTrgm = isPgliteDsn(process.env['DATABASE_URL'])
      ? index('ix_manga_title_trgm').on(t.title)
      : index('ix_manga_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`);

    return [
      // URL identity; slugs are immutable after publish (DATA_MODEL §21.5).
      uniqueIndex('ix_manga_slug').on(t.slug),
      index('ix_manga_title').on(t.title),
      index('ix_manga_updated_at').on(t.updatedAt),
      index('ix_manga_created_at').on(t.createdAt),
      index('ix_manga_visible')
        .on(t.updatedAt)
        .where(sql`${t.deletedAt} is null and ${t.published} = true`),
      titleTrgm,
      check('manga_status', sql`${t.status} in ('ongoing', 'completed', 'hiatus')`),
      check('manga_reading_direction', sql`${t.readingDirection} in ('rtl', 'ltr')`),
    ];
  },
);

/* ── §4 MangaAlias ───────────────────────────────────────────────────────── */

/** Alternate titles for search (DATA_MODEL §4, FR-SEARCH-001). */
export const mangaAlias = pgTable(
  'manga_alias',
  {
    id: uuidV7PrimaryKey(),
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    createdAt: createdAt(),
  },
  (t) => {
    // §19: the alias half of title+alias search. PGlite fallback → btree, same reason as
    // the title index above.
    const aliasTrgm = isPgliteDsn(process.env['DATABASE_URL'])
      ? index('ix_manga_alias_alias').on(t.alias)
      : index('ix_manga_alias_alias').using('gin', sql`${t.alias} gin_trgm_ops`);

    return [uniqueIndex('ix_manga_alias_manga_id_alias').on(t.mangaId, t.alias), aliasTrgm];
  },
);

/* ── §5 Creator ──────────────────────────────────────────────────────────── */

/** Author/artist entity (DATA_MODEL §5, FR-SEARCH-002). Deletion is guarded. */
export const creator = pgTable(
  'creator',
  {
    id: uuidV7PrimaryKey(),
    name: text('name').notNull(),
    roleDefault: text('role_default').notNull().default('author'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('ix_creators_name').on(t.name),
    check('creator_role_default', sql`${t.roleDefault} in ('author', 'artist', 'other')`),
  ],
);

/* ── §6 Genre ────────────────────────────────────────────────────────────── */

/** Controlled vocabulary for catalog filtering (DATA_MODEL §6, FR-CATALOG-002). */
export const genre = pgTable(
  'genre',
  {
    id: uuidV7PrimaryKey(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ix_genres_name').on(t.name)],
);

/* ── §7 Tag ──────────────────────────────────────────────────────────────── */

/**
 * Freeform tags for search (DATA_MODEL §7, FR-SEARCH-003).
 *
 * "(lower-cased)" is implemented as a unique index over `lower(name)`, so
 * "Action" and "action" cannot both exist regardless of stored case.
 */
export const tag = pgTable(
  'tag',
  {
    id: uuidV7PrimaryKey(),
    name: text('name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('ix_tags_name').on(sql`lower(${t.name})`)],
);

/* ── §8 Join tables ──────────────────────────────────────────────────────── */

/** M:N manga↔creator with the per-link role (DATA_MODEL §8). */
export const mangaCreator = pgTable(
  'manga_creator',
  {
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    creatorId: uuidReference('creator_id')
      .notNull()
      .references(() => creator.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.mangaId, t.creatorId] }),
    // reverse lookup: "manga of creator" (author page, FR-CATALOG)
    index('ix_manga_creator_creator_id').on(t.creatorId),
    check('manga_creator_role', sql`${t.role} in ('author', 'artist', 'other')`),
  ],
);

/** M:N manga↔genre (DATA_MODEL §8); reverse index is the catalog filter path. */
export const mangaGenre = pgTable(
  'manga_genre',
  {
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    genreId: uuidReference('genre_id')
      .notNull()
      .references(() => genre.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.mangaId, t.genreId] }),
    index('ix_manga_genre_genre_id').on(t.genreId),
  ],
);

/** M:N manga↔tag (DATA_MODEL §8). */
export const mangaTag = pgTable(
  'manga_tag',
  {
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    tagId: uuidReference('tag_id')
      .notNull()
      .references(() => tag.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.mangaId, t.tagId] }), index('ix_manga_tag_tag_id').on(t.tagId)],
);

/* ── §9 Chapter ──────────────────────────────────────────────────────────── */

/**
 * A unit of reading content (DATA_MODEL §9).
 *
 * - `number numeric(8,2)` so special chapters ("10.5") are representable
 *   (T-FOUND-005 edge case); it is read back as a string, never a float.
 * - `reading_order` is the explicit sort tiebreaker (FR-CHAPTER-004) and
 *   `ix_chapters_manga_order` is the chapter-list hot path (NFR-PERF-014).
 * - `page_count` is denormalized for the chapter list; the upload commit is
 *   the only writer (FR-UPLOAD-006).
 */
export const chapter = pgTable(
  'chapter',
  {
    id: uuidV7PrimaryKey(),
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    number: exactNumeric('number', 8, 2).notNull(),
    title: text('title'),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('draft'),
    publishedAt: timestamptz('published_at'),
    pageCount: integer('page_count').notNull().default(0),
    readingOrder: integer('reading_order').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    // FR-CHAPTER-001: no duplicate numbers per manga.
    uniqueIndex('ix_chapters_number').on(t.mangaId, t.number),
    uniqueIndex('ix_chapters_manga_order').on(t.mangaId, t.readingOrder),
    index('ix_chapters_visible')
      .on(t.readingOrder)
      .where(sql`${t.deletedAt} is null and ${t.status} = 'published'`),
    check('chapter_status', sql`${t.status} in ('draft', 'published')`),
  ],
);

/* ── §10 ChapterPage ─────────────────────────────────────────────────────── */

/**
 * One page of a chapter — the reader's atom (DATA_MODEL §10).
 *
 * No surrogate `id`: the model lists no `id` column and states the composite
 * PK in its index row (see reading #1 in the file header). `asset_key` is
 * unguessable and is a KEY, never the physical path (FR-MEDIA-003).
 * `byte_size_*` columns are the NFR-PERF-009 verification record.
 */
export const chapterPage = pgTable(
  'chapter_page',
  {
    chapterId: uuidReference('chapter_id')
      .notNull()
      .references(() => chapter.id, { onDelete: 'cascade' }),
    // 1-based (DATA_MODEL §10, §21.2).
    pageNumber: integer('page_number').notNull(),
    assetKey: text('asset_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    byteSizeAvif: bigint('byte_size_avif', { mode: 'number' }),
    byteSizeWebp: bigint('byte_size_webp', { mode: 'number' }),
    byteSizeJpeg: bigint('byte_size_jpeg', { mode: 'number' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.chapterId, t.pageNumber] }),
    // media delivery lookup (page-delivery port, FR-MEDIA-003).
    uniqueIndex('ix_pages_asset_key').on(t.assetKey),
    check('chapter_page_page_number', sql`${t.pageNumber} >= 1`),
  ],
);

/* ── §11 LibraryEntry ────────────────────────────────────────────────────── */

/** "In my library" membership (DATA_MODEL §11, FR-LIBRARY-*). */
export const libraryEntry = pgTable(
  'library_entry',
  {
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mangaId: uuidReference('manga_id')
      .notNull()
      .references(() => manga.id, { onDelete: 'cascade' }),
    addedAt: timestamptz('added_at').notNull().defaultNow(),
    // Denormalized for the continue-reading sort (FR-LIBRARY-004).
    lastReadAt: timestamptz('last_read_at'),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.mangaId] }),
    index('ix_library_user_lastread').on(t.userId, t.lastReadAt),
  ],
);

/* ── §12 ReadingProgress ─────────────────────────────────────────────────── */

/**
 * Latest position per user per chapter (DATA_MODEL §12, FR-READER-012/014).
 *
 * Upsert-only and idempotent: an update applies only when the SERVER-stamped
 * `updated_at` is newer (NFR-DATA-003 LWW), and `completed` is sticky
 * (FR-LIBRARY-007) — both are service rules, the row is the contract.
 */
export const readingProgress = pgTable(
  'reading_progress',
  {
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: uuidReference('chapter_id')
      .notNull()
      .references(() => chapter.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    // Vertical-mode offset within the page, 0..1 (FR-READER-012).
    scrollPosition: doublePrecision('scroll_position').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.chapterId] }),
    index('ix_progress_user_updated').on(t.userId, t.updatedAt),
    check('reading_progress_page_number', sql`${t.pageNumber} >= 1`),
  ],
);

/* ── §13 ReadingHistory ──────────────────────────────────────────────────── */

/**
 * Append-only-ish read log (DATA_MODEL §13, FR-READER-015, FR-LIBRARY-008).
 *
 * The chapter FK is SET NULL so the read count survives a chapter purge and
 * the UI can render "unavailable chapter" (EC-RDR-08, NFR-DATA-005).
 */
export const readingHistory = pgTable(
  'reading_history',
  {
    id: uuidV7PrimaryKey(),
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: uuidReference('chapter_id').references(() => chapter.id, {
      onDelete: 'set null',
    }),
    pageNumber: integer('page_number').notNull(),
    startedAt: timestamptz('started_at').notNull(),
    endedAt: timestamptz('ended_at'),
    durationMs: integer('duration_ms'),
    createdAt: createdAt(),
  },
  (t) => [index('ix_history_user_time').on(t.userId, t.startedAt)],
);

/* ── §14 Bookmark ────────────────────────────────────────────────────────── */

/** Saved position (DATA_MODEL §14, FR-LIBRARY-009). `page_number NULL` = chapter start. */
export const bookmark = pgTable(
  'bookmark',
  {
    id: uuidV7PrimaryKey(),
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chapterId: uuidReference('chapter_id').references(() => chapter.id, {
      onDelete: 'set null',
    }),
    pageNumber: integer('page_number'),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
  },
  (t) => [
    // one bookmark per page (NULLs stay distinct: many "chapter start" marks)
    uniqueIndex('ix_bookmarks_user_chapter_page').on(t.userId, t.chapterId, t.pageNumber),
    index('ix_bookmarks_user').on(t.userId, t.createdAt),
    check('bookmark_note_len', sql`char_length(${t.note}) <= 280`),
  ],
);

/* ── §15 ReaderPreference ────────────────────────────────────────────────── */

/**
 * Per-user reader defaults (DATA_MODEL §15, FR-READER-021). 0..1 per user, so
 * the PK is the user FK; see reading #6 in the file header for the NOT NULL
 * decision on the five preference columns.
 */
export const readerPreference = pgTable(
  'reader_preference',
  {
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    defaultMode: text('default_mode').notNull().default('vertical'),
    directionOverride: text('direction_override').notNull().default('none'),
    zoomDefault: exactNumeric('zoom_default', 4, 2).notNull().default('1.00'),
    autoNextChapter: boolean('auto_next_chapter').notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId] }),
    check(
      'reader_preference_default_mode',
      sql`${t.defaultMode} in ('vertical', 'single', 'double')`,
    ),
    check(
      'reader_preference_direction_override',
      sql`${t.directionOverride} in ('none', 'rtl', 'ltr')`,
    ),
  ],
);

/* ── §16 UploadJob ───────────────────────────────────────────────────────── */

/**
 * One ingestion attempt (DATA_MODEL §16, FR-UPLOAD-007).
 *
 * manga/chapter/created_by are SET NULL so the audit trail of a failed job
 * survives the deletion of what it was ingesting; `state` is the job state
 * machine (docs/product/admin-workflow.md §6) with the only queue index
 * (`ix_uploads_state`).
 */
export const uploadJob = pgTable(
  'upload_job',
  {
    id: uuidV7PrimaryKey(),
    mangaId: uuidReference('manga_id').references(() => manga.id, { onDelete: 'set null' }),
    chapterId: uuidReference('chapter_id').references(() => chapter.id, {
      onDelete: 'set null',
    }),
    createdBy: uuidReference('created_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    state: text('state').notNull().default('queued'),
    inputKind: text('input_kind'),
    // Temp storage prefix, purged 24 h after the job ends (NFR-DATA-005).
    stagingKey: text('staging_key'),
    sourceName: text('source_name').notNull(),
    fileCount: integer('file_count'),
    byteSize: bigint('byte_size', { mode: 'number' }),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: timestamptz('started_at'),
    finishedAt: timestamptz('finished_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_uploads_state').on(t.state, t.createdAt),
    index('ix_uploads_chapter').on(t.chapterId, t.createdAt),
    check(
      'upload_job_state',
      sql`${t.state} in ('queued', 'validating', 'processing', 'ready', 'failed')`,
    ),
    check('upload_job_input_kind', sql`${t.inputKind} in ('zip', 'images')`),
  ],
);

/* ── §17 ResetToken ──────────────────────────────────────────────────────── */

/**
 * Single-use password reset (DATA_MODEL §17, FR-AUTH-004).
 * Only the SHA-256 `token_hash` is stored, never the raw token.
 */
export const resetToken = pgTable(
  'reset_token',
  {
    id: uuidV7PrimaryKey(),
    userId: uuidReference('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('ix_resettokens_hash').on(t.tokenHash),
    index('ix_resettokens_user').on(t.userId),
  ],
);

/* ── §18 AuditEvent ──────────────────────────────────────────────────────── */

/**
 * Immutable admin-action log (DATA_MODEL §18, FR-ADMIN-007, NFR-SEC-012).
 *
 * `id` is the model's one bigserial PK (append-only, monotonically sortable);
 * everything else is text + JSONB. There is deliberately no UPDATE/DELETE path
 * in application code and none in SQL — immutability is enforced by the DB
 * role (T-SEC-005), not by this table. A deleted user leaves `actor_id NULL`
 * and keeps `actor_email` as provenance (DATA_MODEL §1 deletion policy).
 */
export const auditEvent = pgTable(
  'audit_event',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuidReference('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    // Summarized snapshots — no secrets, email is the only PII (NFR-OBS-006).
    before: jsonb('before'),
    after: jsonb('after'),
    ip: inet('ip'),
    createdAt: createdAt(),
  },
  (t) => [
    index('ix_audit_target').on(t.targetKind, t.targetId, t.createdAt),
    index('ix_audit_actor').on(t.actorId, t.createdAt),
    index('ix_audit_created').on(t.createdAt),
  ],
);

/* ── inventory ───────────────────────────────────────────────────────────── */

/**
 * The table inventory, for callers that need the list without introspecting
 * the module namespace (INT-DB-001 asserts it against the live catalog).
 */
export const SCHEMA_TABLES = [
  'users',
  'sessions',
  'manga',
  'manga_alias',
  'creator',
  'genre',
  'tag',
  'manga_creator',
  'manga_genre',
  'manga_tag',
  'chapter',
  'chapter_page',
  'library_entry',
  'reading_progress',
  'reading_history',
  'bookmark',
  'reader_preference',
  'upload_job',
  'reset_token',
  'audit_event',
] as const;

/** One name of {@link SCHEMA_TABLES}. */
export type SchemaTableName = (typeof SCHEMA_TABLES)[number];
