# Minimal Wave3 IMPLEMENTATION

**Narrow fix:** replace demo `userId` param with real session auth; make `progress` per `(userId,chapterId)` owned by `session_token` owner, not client-supplied id.

## Changed files

- `src/server/db/schema.ts` — added `passwordHash?: string` to `UserRecord` and new `SessionRecord {id, userId, token, expiresAt}`. Keeps existing `MangaRecord/ChapterRecord/ProgressRecord` (§3,9).

- `src/server/db/store.ts` — added `sessions: Map<token, SessionRecord>` + `hashPassword(password)` via `scryptSync("minimal-static-salt-wave3", salt, 64).toString("hex")` (demo-safe minimal, no new dep) + `verifyPassword` with `timingSafeEqual`. Added `ensureAuthSeed()` called at load: seeds `usr-reader-a` `reader.a@example.test` `PasswordA123!` and `usr-reader-b` `reader.b@example.test` `PasswordB123!` (hashed, guest `usr-guest-001` hash backfilled). Added `findUserByEmail`, `verifyUserPassword`, `createSession(token=randomUUID, expiresAt+30d)`, `getSessionByToken` (checks `expiresAt>now`), `deleteSession`, `getUserById`. Persist `sessions` to `data/db.json` via `load/persist` (same file as progress, durable across restart).

- `src/server/auth/guard.ts` — new: `parseCookies(req)` from `cookie` header, `getSessionUser(req)` parses `session_token`, looks up via `db.getSessionByToken`, returns `{id,email,name,role}` or null, `requireUser(req)` throws `AUTH_REQUIRED` 401.

- `src/app/api/auth/login/route.ts` — new: `POST {email,password}` validates both present else `400 VALIDATION_FAILED`, `db.findUserByEmail` else dummy hash for timing, `db.verifyUserPassword` else `401 AUTH_FAILED`, else `db.createSession(user.id)` and `Set-Cookie: session_token=<uuid>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` + `{user:{id,email,name,role}, sessionToken}`.

- `src/app/api/auth/logout/route.ts` — new: parses cookie, `db.deleteSession(token)`, clears cookie `Max-Age=0`.

- `src/app/api/v1/progress/route.ts` — enforce auth: `getSessionUser(req)` → `401 AUTH_REQUIRED` if null (both GET and PUT). `GET ?chapterId` ignores any `userId` param, `db.getProgress(user.id, chapterId)` scoped by session user, `404` if none. `PUT {chapterId,pageNumber}` ignores any `userId` in body, validates `chapterId` string and `pageNumber` integer else `400 VALIDATION_FAILED`, `pageNumber<1` → `422`, `db.getChapter(chapterId)` → `404` if unknown, `pageNumber>chapter.pageCount` → `422 VALIDATION_FAILED "Page out of range 1..N"`, then `db.saveProgress(user.id, chapterId, pageNumber)` key `${userId}:${chapterId}` (LWW `updatedAt`, version++).

- `src/app/discover/page.tsx` — switched to `db.getPublishedMangaList()` + `db.getPublishedChaptersByMangaId()` (no hard-coded list) so reader manifest aligns with seeded manga.

- `src/app/manga/[slug]/chapter/[chapter]/page.tsx` — resolve `manga` by slug, resolve `chapter` by `chapterNumber`, build `ChapterManifest` from `db.getChapterPages`, pass `chapterId` to `ReaderView`.

- `src/features/reader/ReaderView.tsx` — added durable load/save: `GET /api/v1/progress?chapterId=` on mount (adopts saved page), `PUT /api/v1/progress` debounced 300ms on `currentPage` change, still sends `userId` param for backwards compat but server ignores (isolation proof).

## Reused architecture

- `data/db.json` file-backed (sessions+progress durable, no new DB)
- No new auth library: built-in `crypto.scryptSync` + `randomUUID` + cookie parsing (same `HttpOnly; SameSite=Lax` as yomi/homeops ADR-006)
- Existing `Manga/Chapter/Progress` schema (§3,9) unchanged except `UserRecord.passwordHash` + `SessionRecord`

## Seeded users

- `reader.a@example.test` `usr-reader-a` `PasswordA123!` (Reader A)
- `reader.b@example.test` `usr-reader-b` `PasswordB123!` (Reader B)
- `usr-guest-001` `guest@example.test` `guest` still present but APIs no longer trust its id from client

Implementation commit: `0fd4b3b feat(minimal-reader): add authenticated user-owned progress`.
