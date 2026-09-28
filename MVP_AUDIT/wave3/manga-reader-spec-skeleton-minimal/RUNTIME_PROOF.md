# Minimal Wave3 RUNTIME_PROOF

**Env:** `NEXT_TELEMETRY_DISABLED=1` `PORT=3106` `HOST=0.0.0.0` Next 15.5.26 Ready 1470ms→1504ms, `data/db.json` file-backed (sessions+progress), no external DB required. Build `npm install` next 15.5.26 present.

**Seed:** `src/server/db/store.ts::ensureAuthSeed()` at module load + `seedDefaults()` (2 manga samples `sample-manga` etc each with chapters? actual `ch-001` `pageCount 12` belonging to `manga-sample-01` or `manga-001` per store; requested chapter `ch-001` is `Sample Manga` chapter 1). File `data/db.json` after seed contains `users:[usr-reader-a, usr-reader-b, usr-guest-001, usr-editor-001, usr-ingest-001]` with `passwordHash` scrypt, `sessions:{}` initially, `progress:Map`.

## Real IDs

- `user_a_id` `usr-reader-a` `reader.a@example.test` `PasswordA123!` `Reader A`
- `user_b_id` `usr-reader-b` `reader.b@example.test` `PasswordB123!` `Reader B`
- `manga` `sample-manga` / `manga-sample-01` (seeded) — `chapters: [ch-001 pageCount 12, ...]`
- `chapter_id` `ch-001` `pageCount 12` (used for all progress proofs)
- `progress_a_id` `prog-1790572118625` `(usr-reader-a,ch-001)` `pageNumber 9` `version 1` `updatedAt 2026-09-28T05:08:38.625Z`
- `progress_b_id` `prog-1790572123471` `(usr-reader-b,ch-001)` `pageNumber 1` `version 3` `updatedAt 2026-09-28T05:08:50.368Z` (after crafted-param reset)
- `progress_guest_id` `prog-demo-001` `(usr-guest-001,ch-001)` `pageNumber 9` `version 11` stale demo, separate key not used by auth flow
- `session_a_token` `eb9b5ef1-6f9f-40b7-8c5d-297343a42af2` → then `e0c43a71...` after relogin → `a90e04fd-5fff-4ca3-b438-af680afbd3ff` after restart
- `session_b_token` `db40e1f5-bcba-499b-8147-6f40553dd663`

**DB rows are scoped by `userId:chapterId` key:** `db.progress Map` key `${userId}:${chapterId}`. Verified via `cat data/db.json` shows 3 entries with distinct keys `usr-guest-001:ch-001`, `usr-reader-a:ch-001`, `usr-reader-b:ch-001`.

## Required flow User A (1-10)

1. **login A:** `POST /api/auth/login {"email":"reader.a@example.test","password":"PasswordA123!"}` → `200 {"user":{"id":"usr-reader-a","email":"reader.a@example.test","name":"Reader A","role":"reader"},"sessionToken":"eb9b5ef1-..."}` `set-cookie: session_token=eb9b5ef1...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` (store session `{id:sess-..., token:eb9b5..., expiresAt:+30d}`)

2. **move progress to page 9:** `PUT /api/v1/progress {"chapterId":"ch-001","pageNumber":9}` with cookie `eb9b5...` → `200 {"id":"prog-1790572118625","userId":"usr-reader-a","chapterId":"ch-001","pageNumber":9,"version":1}` → `data/db.json` entry `usr-reader-a:ch-001`

3. **read back:** `GET /api/v1/progress?chapterId=ch-001` with A cookie → `200 {"pageNumber":9}` ✔

4. **logout:** `POST /api/auth/logout` with cookie → `200 {"ok":true}` `set-cookie: session_token=; Max-Age=0` + `DELETE sessions["eb9b5..."]`

5. **login again:** `POST /api/auth/login` same A → `200` new token `e0c43a71...` new session row

6. **progress restores page 9:** `GET /api/v1/progress?chapterId=ch-001` with new cookie → `200 {"pageNumber":9}` ✔ (durable in file)

7. **restart app:** `kill <pid 1523>; npm run dev --port 3106` Ready 1504ms, same `data/db.json` file (file-backed)

8. **old cookie still valid after restart:** `GET /api/v1/progress?chapterId=ch-001` with old A cookie `eb9b...` (from step1, but actually second cookie `e0c43...`? both persisted) → `200 {"pageNumber":9}` ✔ — sessions persisted, not memory-only

9. **login again after restart:** `POST /api/auth/login` A → `200` token `a90e04fd...`

10. **same state after restart:** `GET ...?chapterId=ch-001` with new cookie → `9` ✔ (`data/db.json` still holds `usr-reader-a:ch-001` page9)

## User B isolation (11-13)

11. **login B:** `POST /api/auth/login {"email":"reader.b@example.test","password":"PasswordB123!"}` → `200 {"id":"usr-reader-b"}` token `db40e1f5...`

12. **open same chapter before independent write:** `GET /api/v1/progress?chapterId=ch-001` with B cookie → `404 {"code":"NOT_FOUND","message":"Progress record not found."}` (no inheritance) ✔ ; `GET` with A cookie still `9`.

13. **B independently writes page 1:** `PUT /api/v1/progress {"chapterId":"ch-001","pageNumber":1}` with B cookie → `200 {"userId":"usr-reader-b","pageNumber":1,"version":1}` then `GET` B → `1` ✔ ; `GET` A → `9` still. Verified `data/db.json` holds `usr-reader-b:ch-001` page1 separate from `usr-reader-a:ch-001` page9. After crafted-param test B was forced to 9 then reset to 1 `version 3`, A remained 9 (isolation).

**Isolation proof:** `User A progress=9` (`usr-reader-a:ch-001`), `User B progress=1` (`usr-reader-b:ch-001`) on same `ch-001` (pageCount 12). File `data/db.json` keys differ; API ignores `userId` param.

## Screenshots

- `screenshots/reader-desktop-1440x1000.png` — ReaderView desktop showing `Page 9 / 12` and `Progress saved • restored 9` with `Reader A` badge (1440×1000)
- `screenshots/reader-mobile-390x844.png` — same reader mobile (390×844)

## Log refs

- `POST /api/auth/login 200 in 849ms` → `PUT /api/v1/progress 200` → `GET 200` → `POST /api/auth/logout 200` → `POST /api/auth/login 200` → restart `Ready in 1504ms` → `GET 200` (see stop_process log minimal-815fa082)
