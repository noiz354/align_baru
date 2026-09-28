# Yomi Wave3 FAILURE_CASES

**Requirement:** at least 3 negative paths, do not upgrade readiness on happy-path only.

## 1. Unauthenticated progress mutation → rejected

- **Request:** `POST /api/chapters/594f4d49-5934-7d71-a7da-82b78bb08c1a/progress {"pageNumber":5}` with no `cookie: session_token` (also `GET /progress` without cookie)
- **Expected:** `401 {error:{code:"AUTH_REQUIRED",message:"Authentication required"}}`
- **Observed:** `curl -s -X POST .../progress -d '{"pageNumber":5}'` → `401` with `AUTH_REQUIRED` (see RUNTIME_PROOF). Same for `GET` without cookie → `401`.
- **Why it matters:** product APIs no longer depend on hard-coded `demoUserId()`. Guard is `getSessionUser` →401, not 200 with demo progress.

## 2. Malformed progress page → rejected

- **Request A:** `POST /api/chapters/.../progress {"pageNumber":0}` or `{"pageNumber":"foo"}` or `{"pageNumber":-1}` with valid A session
  - **Expected:** `422 {error:{code:"READER_INVALID_PAGE"}}`
  - **Observed:** `curl -s -b A-cookie -X POST ... -d '{"pageNumber":0}'` → `422 READER_INVALID_PAGE` (integer ≥1 check)
- **Request B:** `POST ... {"pageNumber":9999}` where `chapter.pageCount=6`
  - **Expected:** `422 READER_INVALID_PAGE "Page out of range 1..6"` (not clamped silently)
  - **Observed:** `curl -s -b B-cookie -X POST ... -d '{"pageNumber":9999}'` → `422 READER_INVALID_PAGE Page out of range 1..6` (explicit range check before upsert)
- **Request C:** `POST /api/library {"mangaId":"not-a-uuid"}` → either 404 `MANGA_NOT_FOUND` or 422, not 500. Verified `POST /api/library {"slug":"nonexistent"}` → `404 MANGA_NOT_FOUND`.

## 3. User B cannot read/write User A private state

- **Library isolation:** `GET /api/library` with B's session_token (`d9c9...`) → `200 {items:[],count:0}` while A's cookie (`2fb9...`) → `count:1` (`3213...`). Verified `SELECT count(*) FROM library_entry WHERE user_id='d9c9...' →0` vs `2fb9... →1`.
- **Bookmark isolation:** `GET /api/bookmarks` B → `0` while A → `1` (`555bae...`). B's `POST /api/bookmarks {"chapterId":...,"pageNumber":2}` for same chapter/page as A's existing bookmark creates B's own row `16b0...` (different userId), not conflict; A's bookmark still `555bae...`. `DELETE /api/bookmarks/<a's id>` with B's cookie would affect 0 rows (where `userId=B`), not delete A's row (guarded by `where userId=B`).
- **Progress isolation:** `GET /api/chapters/594f4d49-5934.../progress` with B's cookie before B's own write → `{"progress":null}` while A's → `{"progress":{"pageNumber":4}}`. After `POST /progress {"pageNumber":2}` with B, `GET` B → `2`, A still `4` (separate PK `(userId,chapterId)`). Verified `SELECT page_number FROM reading_progress WHERE user_id='d9c9...' →2` vs `2fb9... →4`. No `WHERE userId = attacker-supplied` — user comes from session only (THREAT T-04).
- **Session invalidation:** after `POST /api/auth/logout` for A, `GET /library` with old A cookie → `401 AUTH_REQUIRED` (session deleted, not reusable).

**Coverage:** 3+ paths exercised, all via real DB + real cookie session, no demo fallback.
