# Yomi — Data Model

**Status:** canonical. Describes the 20 tables, the invariants that protect a
reader's record, and where those invariants are currently violated.

Source of truth: `src/server/db/schema.ts` and `drizzle/*.sql`. Where this document
and a migration disagree, **the migration is wrong** and needs a spec-fix.

## 1. Tables (20)

| Group | Tables |
|---|---|
| Identity | `users`, `sessions`, `reset_token` |
| Catalogue | `manga`, `manga_alias`, `creator`, `genre`, `tag`, `manga_creator`, `manga_genre`, `manga_tag` |
| Content | `chapter`, `chapter_page` |
| Reader record | `library_entry`, `reading_progress`, `reading_history`, `bookmark`, `reader_preference` |
| Operations | `upload_job`, `audit_event` |

Two migrations: `0000_initial_schema.sql`, and
`0001_restore_citext_and_trigram.sql`. The second is **additive and repairs a real
production bug** — 0000 was generated against a PGlite DSN and froze out `citext`
and `pg_trgm`, so case-insensitive matching and trigram indexes were absent from
the initial schema.

## 2. Catalogue

`manga.slug` is the URL identity and the unique lookup key. `manga.title` and
`manga_alias.alias` carry GIN trigram indexes (`0001`) — the only landed half of
search.

Publication is a state machine, not a boolean: `manga.published` +
`manga.status` (`ongoing` / `completed` / …) and, per chapter, `chapter.status` +
`chapter.published_at`. **A chapter with no `published_at` is not readable.** The
media route enforces this per request, which is why the bucket can stay private.

`chapter.page_count` is denormalised. It is the clamp boundary for reading
(EC-RDR-10) and the reason a bookmark can be validated against a chapter without
counting its pages.

## 3. Reader record — the invariants

This is the part that must not be wrong ([PRODUCT.md §"a reader's record is never
silently wrong"](PRODUCT.md)).

### `reading_progress` — one row per (user, chapter)

PK `(user_id, chapter_id)`. Carries `page_number`, `scroll_position`, `completed`,
`updated_at`.

Three invariants, all owned by `ReaderProgressRepository.saveProgress`
(`progress.repository.ts:691`), all in **one** transaction and **one**
`INSERT … ON CONFLICT (user_id, chapter_id) DO UPDATE … WHERE`:

1. **LWW** — `updated_at <= now()` (`:478`). A stale write is rejected, not applied.
2. **Idempotence** — a no-op predicate (`:511-516`), so an identical repeat is a
   true rowcount 0 rather than a fresh timestamp.
3. **Sticky completion** — `completed = reading_progress.completed or
   excluded.completed` (`:547`). `false → true` only.

The guard is a `WHERE` on the conflict clause, **not** read-then-write. Two racing
tabs cannot both win. A rejected write (`RETURNING` empty) correctly skips the
`library_entry.last_read_at` touch (`:710-711`).

`getProgress` returns **raw**, deliberately (`:721-726`): a stored page past the
current `page_count` is the *service's* clamp to make. A repository that quietly
fixed it would report a page the reader never saw.

`mergeProgress` (`:754`) is the only place a client clock decides LWW, and it never
stores one — the stored stamp is always `now()` (SQ-RDR-1). `{applied, dropped}`
always sums to the payload length (SQ-RDR-2). **It has zero callers.**

### `library_entry` — the shelf

PK `(user_id, manga_id)`. `last_read_at` is **denormalised** from
`reading_progress` and maintained by `saveProgress` in the same transaction
(T-LIB-002). It exists so the default `last_read_desc` sort does not require a join
or a `max()` over progress.

`unreadChapterCount` is derived, not stored: published chapters for the manga minus
chapters the user has `completed = true`.

### `reading_history` — sessions

Contiguous session per `(user, chapter)`, coalesced within 5 minutes. Records
`started_at`, `ended_at` (null = still open), `duration_ms`, and the **deepest**
page reached — not the last page, so jumping back does not lower the record.

`chapter_id` is `ON DELETE SET NULL`: **the row is retained** when its chapter is
deleted, and the API renders it as `chapter: null`. A reader's history does not
disappear because an operator removed a title.

`id` is a **uuid**.

### `bookmark`

Unique index `(user_id, chapter_id, page_number)`. `page_number` is nullable, and
SQL treats `NULL` as distinct — so a "chapter start" mark is repeatable while a
specific page cannot be double-marked. `note` is capped at 280 characters and
**refused** when longer, never truncated (NFR-SEC-016).

### `reader_preference` — orphaned

`schema.ts:539`. PK `user_id`. `default_mode`, `direction_override`,
`zoom_default`, `auto_next_chapter`, plus 2 CHECK constraints. Live in
`0000_initial_schema.sql:169`, typed at `shared/contracts/reader.ts:104`.

**There is no port, no repository, no service, no route and no page read for it.**
A repo-wide grep returns the schema, the re-export, the migration, the type, docs,
and one test that asserts only that the table exists. `zoomDefault` and
`autoNextChapter` are cited in `docs/product/reader-behavior.md` as though live.
F-013 gives it an owner.

## 4. Integrity rules the app relies on

| Rule | Enforced by | Consequence if bypassed |
|---|---|---|
| Slug is the URL identity | `ix_manga_slug` | Broken links |
| Unpublished chapter is unreadable | `/media` authorisation | Draft leaks to anonymous |
| Page ≤ `page_count` | service clamp, not the DB | Reader lands on a blank page |
| Bookmark page ≤ chapter length | route check (restored in Batch 2) | Unopenable bookmark |
| Progress is user-scoped | every repository WHERE | **Cross-reader data leak (THREAT T-04)** |
| Deleting a chapter retains history | `ON DELETE SET NULL` | History vanishes |
| `completed` is sticky | `saveProgress` only | **Completion erased (F-006)** |

The last two rows of that table are the two silent ones. Neither raises an error.

## 5. Known data-model problems

| # | Problem | Severity | Fix |
|---|---|---|---|
| 1 | A second writer to `reading_progress` exists (`queries/reader-state.ts:248`, plain overwrite) and is the one the reader uses. `completed` is therefore **not** sticky in practice. | P0 | F-006 — route → repository, then delete the file |
| 2 | `last_read_at` is never written from the reader's save path, so `last_read_desc` stays NULL for anything read there. | P0 | F-006-S1 (same fix) |
| 3 | No "mark unread" operation exists at any layer. `library.service.ts:189-200` `setReadStatus(false)` reads the flag and writes it straight back — a self-documented guaranteed no-op (SQ-LIB-7) — **and has zero callers.** | P1 | F-008 — add `unsetCompleted` to the port and repository |
| 4 | `reader_preference` has no owner. | P1 | F-013 |
| 5 | `mergeProgress` implemented, never called. | P2 | Document as supported; expose for offline clients |
| 6 | No migration adds or removes anything for the features in the active track. | — | Confirmed: the active track is migration-free |

**No migration is required for any slice in the active execution track.** If a slice
proposes one, that is a signal the design changed — raise it, do not assume it.
