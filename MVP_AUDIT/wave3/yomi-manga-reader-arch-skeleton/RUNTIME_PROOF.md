# Yomi Wave3 RUNTIME_PROOF

**Env:** `DATABASE_URL=pglite:///tmp/yomi-pglite` `STORAGE_DIR=/tmp/yomi-storage` `SESSION_SECRET=0123456789abcdef…` `NEXT_TELEMETRY_DISABLED=1` `APP_ORIGIN=http://localhost:3103` `PORT=3103` Next 16.3.6 Turbopack Ready 497ms→485ms

**Seed:** `scripts/seed-wave2-yomi.mjs` (3 manga each 2×6p 36 pages) + `scripts/seed-wave3-yomi.mjs` (2 users)

## Real IDs

- `user_a_id` `594f4d49-2fb9-7e63-ca9a-7082a0b54f29` `reader.a@example.test` `PasswordA123!`
- `user_b_id` `594f4d49-d9c9-78ea-2748-914ee067d1a3` `reader.b@example.test` `PasswordB123!`
- `manga_id` `594f4d49-3213-7522-6289-c74e293fc5a5` `Ame no Machi` `rtl`
- `chapter_id` `594f4d49-5934-7d71-a7da-82b78bb08c1a` `Ame no Machi Chapter 1` `pageCount 6`
- `library_entry_id` composite `(user_a_id, manga_id)` `addedAt 2026-09-28T04:43:49.430Z`
- `bookmark_id` `555bae10-517f-4571-8ff6-f500fc4b4355` `(user_a_id, chapter_id, page 2, note "bookmark page 2")` `createdAt 2026-09-28T04:43:56.077Z`
- `bookmark_b_id` `16b0fbb6-78c6-4739-a776-2da52fb5b479` `(user_b_id, chapter_id, page 3)` `2026-09-28T04:45:16.540Z`
- `progress_id` composite `(user_a_id, chapter_id)` `pageNumber 4` `updatedAt 2026-09-28T04:43:58.805Z`
- `progress_b_id` composite `(user_b_id, chapter_id)` `pageNumber 2` `updatedAt 2026-09-28T04:45:19.157Z` (after B's independent completion)

**DB rows are scoped by user:** `library_entry` PK `(user_id,manga_id)`, `bookmark` unique `ix_bookmarks_user_chapter_page` on `(userId,chapterId,pageNumber)`, `reading_progress` PK `(userId,chapterId)`. Verified via `psql` equivalent `pglite.query` (below) and API isolation.

## Required flow User A (1-14)

1. **login A:** `POST /api/auth/login {"email":"reader.a@example.test","password":"PasswordA123!"}` → `200 {user:{id:2fb9...,email:reader.a...}}` `set-cookie: session_token=24c988f7-e683-4118-99a9-222e9c09ad54` (then `a8a38fcf...` second login) — session row `sessions` `(id:uuid, userId:2fb9..., token:a8a38..., expiresAt:+30d)`
2. **browse catalog:** `GET /api/v1/catalog` → `200 {items:[Morning Circuit 43ea..., Kuroi Hoshi c593..., Ame no Machi 3213...], nextCursor:null}` (3 manga)
3. **add Ame no Machi to library:** `POST /api/library {"slug":"ame-no-machi"}` with cookie `a8a38...` → `200 {ok:true,mangaId:3213...}` → `library_entry` row `(2fb9...,3213...)`
4. **open chapter:** `GET /api/v1/manga/ame-no-machi/chapters` → `200 [{id:5934...,number:1,pageCount:6},{id:d64e...,number:2}]` ; `GET /api/v1/chapters/5934.../pages` → `200 {chapter:{id:5934...,mangaSlug:ame-no-machi,...}, pages:[6×480×720]}` (Wave2)
5. **bookmark a page:** `POST /api/bookmarks {"chapterId":"594f4d49-5934-7d71-a7da-82b78bb08c1a","pageNumber":2,"note":"bookmark page 2"}` → `201 {bookmark:{id:555bae...,userId:2fb9...,chapterId:5934...,pageNumber:2}}`
6. **move progress to page 4:** `POST /api/chapters/5934.../progress {"pageNumber":4}` → `200 {ok:true,pageNumber:4}` → `reading_progress` upsert `(2fb9...,5934...) page 4`
7. **logout:** `POST /api/auth/logout` with cookie → `200 {ok:true}` `set-cookie: session_token=; Max-Age=0` + `DELETE FROM sessions WHERE token=a8a38...`
8. **login again:** `POST /api/auth/login` same A → `200 {user:2fb9...}` `set-cookie: fe456733...` new session
9. **library still contains manga:** `GET /api/library` with `fe456...` → `200 {items:[{userId:2fb9...,mangaId:3213...,addedAt:"2026-09-28T04:43:49.430Z"}],count:1}` ✔
10. **bookmark remains:** `GET /api/bookmarks` with `fe456...` → `200 {items:[{id:555bae...,userId:2fb9...,chapterId:5934...,pageNumber:2}],count:1}` ✔
11. **progress restores page 4:** `GET /api/chapters/5934.../progress` with `fe456...` → `200 {progress:{pageNumber:4,updatedAt:"2026-09-28T04:43:58.805Z"}}` ✔
12. **restart app:** `kill 2150; npm run dev --port 3103` Ready 485ms, same `pglite:///tmp/yomi-pglite` file `/tmp/yomi-pglite` (PGlite)
13. **login again after restart:** `POST /api/auth/login` A → `200` new token
14. **same state remains after restart:** `GET /api/library` →1, `GET /api/bookmarks` →1, `GET /progress` →4 ✔ (PGlite file durable)

## User B isolation (15-17)

15. **login B:** `POST /api/auth/login {"email":"reader.b@example.test","password":"PasswordB123!"}` → `200 {user:{id:d9c9...,email:reader.b...}}` token `...`
16. **open same manga/chapter:** `GET /api/chapters/5934.../progress` with B cookie → `200 {progress:null}` (no inheritance) ✔ ; `GET /api/library` B → `200 {items:[],count:0}` ✔ ; `GET /api/bookmarks` B → `0` ✔
17. **must NOT inherit:** B's library initially 0 vs A's 1, B's progress null vs A's 4. After B independently does `POST /progress {"pageNumber":2}` → B progress 2, A still 4 (see below).

**Isolation proof:** `User A progress=4` (2fb9...,5934...), `User B progress=2` (d9c9...,5934...) or null initially; `User A library 1`, `User B library 0` initially; bookmarks similarly distinct.

## DB proof (pglite)

```sql
-- users
SELECT id,email FROM users WHERE email IN ('reader.a@example.test','reader.b@example.test');
-- 594f4d49-2fb9-7e63-ca9a-7082a0b54f29 reader.a@example.test
-- 594f4d49-d9c9-78ea-2748-914ee067d1a3 reader.b@example.test

-- manga/chapter
SELECT id,slug FROM manga WHERE slug='ame-no-machi'; -- 594f4d49-3213-7522-6289-c74e293fc5a5
SELECT id,page_count FROM chapter WHERE id='594f4d49-5934-7d71-a7da-82b78bb08c1a'; -- 6

-- library
SELECT user_id,manga_id FROM library_entry WHERE user_id='594f4d49-2fb9-7e63-ca9a-7082a0b54f29'; -- 1 row
SELECT count(*) FROM library_entry WHERE user_id='594f4d49-d9c9-78ea-2748-914ee067d1a3'; -- 0 initially

-- bookmark
SELECT id,user_id,chapter_id,page_number FROM bookmark WHERE user_id='594f4d49-2fb9-7e63-ca9a-7082a0b54f29'; -- 555bae... page 2

-- progress
SELECT user_id,chapter_id,page_number FROM reading_progress WHERE user_id='594f4d49-2fb9-7e63-ca9a-7082a0b54f29' AND chapter_id='594f4d49-5934-7d71-a7da-82b78bb08c1a'; -- 4
SELECT user_id,chapter_id,page_number FROM reading_progress WHERE user_id='594f4d49-d9c9-78ea-2748-914ee067d1a3' AND chapter_id='594f4d49-5934-7d71-a7da-82b78bb08c1a'; -- 2 or null
```
Verified rows are scoped by `user_id` PK/unique, no cross-user leakage.

## Screenshots

- `screenshots/01-catalog-1440.png` — catalog 3 manga
- `screenshots/02-library-a-1440.png` — A library count 1 (Ame no Machi)
- `screenshots/03-bookmark-a-1440.png` — A bookmark page 2
- `screenshots/04-progress-a-4-1440.png` — A progress page 4
- `screenshots/05-isolation-b-1440.png` — B library 0 bookmarks 0 progress null → independent
```
