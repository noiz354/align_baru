# Yomi Wave3 READINESS

**Wave2:** `RUNNABLE_DEMO` (797b2c8) — hard-coded `reader.demo@example.test`, 1 manga, progress works but not per-user.

**Wave3:** `MVP_PARTIAL`

**Reason:** auth/session + user isolation + library/bookmark/progress all real and durable:

- `login`/`logout` via `sessions` table (argon2 verify, 30d expiry, HttpOnly cookie, lastLoginAt, disabled check, uniform dummy verify, constant-time via argon2)
- `reading_progress` per `(userId,chapterId)` scoped by `getSessionUser`, not `demoUserId`; `library_entry` per `(userId,mangaId)`; `bookmark` per `(userId,chapterId,pageNumber)` unique; restart durable via `pglite:///tmp/yomi-pglite` file
- User A library 1 bookmark 1 progress 4 survive logout/login and restart; User B initially library 0 bookmarks 0 progress null, then independent progress 2 does not mutate A's 4
- 3 negative paths verified (unauth 401, malformed 422, cross-user isolation 0 vs 1)

**Not MVP_READY yet:** project's own MVP definition still requires additional slices (search, admin upload, reader preferences, history, etc.) per PRD/ROADMAP. Wave3 deliberately implements only the one important boundary (authenticated owned state) as per Wave3 objective.

**Promotion:** `RUNNABLE_DEMO → MVP_PARTIAL` via `feat(yomi): add authenticated reader-owned state` (`b4ebebe`).
