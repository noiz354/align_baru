# Minimal Wave3 READINESS

**Wave2:** `MVP_PARTIAL` (df0e396) — Discover→manga→chapter→reader→progress durable via `data/db.json`, default `usr-guest-001` page5, but no auth, no isolation.

**Wave3:** `MVP_PARTIAL` (no promotion)

**Reason:** auth/session + user-owned progress now real and durable, but core PRD still has remaining admin/upload boundary not built (per scope decision).

- `login`/`logout` via `sessions` table (scrypt hash, 30d expiry, HttpOnly `session_token`, `SameSite=Lax`, dummy verify timing)
- `reading_progress` per `(userId,chapterId)` key `${userId}:${chapterId}` scoped by `getSessionUser(req)` not client `userId`; `data/db.json` file durable
- User A `page 9` (`usr-reader-a:ch-001` `prog-1790572118625`) survives logout/login and restart (old cookie still valid, new login restores 9); User B initially `404` (no progress) then independent `page 1` (`usr-reader-b:ch-001` `prog-1790572123471`), does not mutate A's 9; restart preserves both via file
- 3 negative paths verified (unauth 401, invalid page 400/422, cross-user isolation ignored `userId` param)
- ReaderView durable load/save (GET on mount restores saved page, PUT debounced) now uses session scope

**Not MVP_READY yet:** project's own MVP definition (PRD § Administration and media FR-ADMIN-001..004, FR-UPLOAD-001..004) still requires role-protected catalog editing, chapter ordering, bounded quarantined upload/processing, publication audit, storage credentials never leaked — none of which is part of this narrow wave3. Per wave3 objective "Do not build a large admin/upload system unless the minimal PRD explicitly requires that for MVP" — minimal's core user-facing reader flow is now complete, but hardening to MVP_READY would require at minimum library/history separation and admin boundary or explicit product decision to defer it. For this milestone we honestly document that boundary rather than claim MVP_READY on a reader-only slice.

**If promotion were evaluated:** `MVP_PARTIAL → MVP_READY` would require either (a) proving lib/history are out-of-scope for minimal and reader isolation alone satisfies MVP, or (b) implementing them. With current evidence we keep `MVP_PARTIAL` and record blocker.

**Blocker:** `FR-ADMIN-001/FR-UPLOAD-001` + storage adapter (`FS → MinIO → S3`) still demo/file only (`data/db.json` not PostgreSQL+Drizzle, no migration, no object Storage abstraction for chapter pages). Library/history/bookmarks beyond progress not yet user-owned (yomi has them, minimal does not). Not built in this wave.

**Evidence:** `MVP_AUDIT/wave3/manga-reader-spec-skeleton-minimal/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md,screenshots/reader-desktop-1440x1000.png,screenshots/reader-mobile-390x844.png}` + `data/db.json` durable.

**Implementation commit:** `f6abdf2 feat(minimal-reader): add authenticated user-owned progress`
