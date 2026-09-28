# Yomi Wave3 IMPLEMENTATION

**Narrow fix:** replace hard-coded `demoUserId()` with real session auth; add per-user library/bookmark APIs.

## Changed files

- `src/server/auth/guard.ts` — new: `getSessionUser(request)` parses `cookie: session_token`, looks up `sessions.session_token` via `createDb`, checks `expiresAt`/`absoluteExpiresAt` > now, checks `users.status='active'`, returns `{id,email,role}`. `requireUser` throws `AUTH_REQUIRED` 401.
- `src/app/api/auth/login/route.ts` — real: JSON `{email,password}` → `users` by email (case-insensitive citext), dummy argon2 verify on unknown (timing uniformity), `disabled` →403, `argon2.verify(passwordHash,password)` →401 on fail, else `sessions` insert `{id:uuid, userId, sessionToken:crypto.randomUUID(), expiresAt: +30d, absoluteExpiresAt: +30d}`, `users.lastLoginAt` touched, `Set-Cookie: session_token=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`.
- `src/app/api/auth/logout/route.ts` — real: parses cookie, deletes `sessions` where token, clears cookie `Max-Age=0`.
- `src/app/api/chapters/[chapterId]/progress/route.ts` — enforce auth: `getSessionUser` →401 if null, validate `pageNumber` integer ≥1 else 422 `READER_INVALID_PAGE`, verify chapter exists else 404, validate `pageNumber <= pageCount` else 422 (failure path), then `reading_progress` upsert scoped by `(userId,chapterId)` with `user.id` from session (not hard-coded), LWW `updatedAt`.
- `src/app/api/library/route.ts` — new: `GET` → `requireUser` → `library_entry` where `userId` (scoped), `POST {mangaId|slug}` → `requireUser` → resolve slug→mangaId, verify manga exists else 404, `library_entry` insert `(userId,mangaId)` `onConflictDoNothing` (idempotent).
- `src/app/api/library/[mangaId]/route.ts` — new: `DELETE` scoped `where userId and mangaId`.
- `src/app/api/bookmarks/route.ts` — new: `GET` scoped, `POST {chapterId,pageNumber,note}` validates chapter exists else 404, validates pageNumber 1..pageCount else 422, inserts `bookmark` `(id:uuid, userId, chapterId, pageNumber, note)` with unique `ix_bookmarks_user_chapter_page` →409 `LIBRARY_BOOKMARK_EXISTS` on duplicate.
- `scripts/seed-wave3-yomi.mjs` — deterministic `reader.a@example.test` `594f4d49-2fb9-7e63-ca9a-7082a0b54f29` / `reader.b@example.test` `594f4d49-d9c9-78ea-2748-914ee067d1a3` with `PasswordA123!`/`PasswordB123!` via `argon2.hash(argon2id)`, `onConflictDoNothing`.

## Reused architecture

- `users`, `sessions`, `library_entry`, `bookmark`, `reading_progress`, `chapter`, `manga` tables (DATA_MODEL §1,2,11,12,14, §3,9)
- `argon2` 0.45.1 already dependency (no new auth system)
- `createDb`/`closeDb` via `loadEnv` + PGlite detection (`src/server/db/client.ts` Wave2)
- No second auth: existing `sessions` table + same cookie flags as ADR-006 (HttpOnly, SameSite=Lax, Path=/)

## Seeded users

- `reader.a@example.test` `594f4d49-2fb9-7e63-ca9a-7082a0b54f29` `PasswordA123!`
- `reader.b@example.test` `594f4d49-d9c9-78ea-2748-914ee067d1a3` `PasswordB123!`
- `reader.demo@example.test` still exists but product APIs no longer use it
