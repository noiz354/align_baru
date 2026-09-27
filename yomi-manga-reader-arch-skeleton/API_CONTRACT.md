# API_CONTRACT.md

Date: 2026-09-26 · Status: Authoritative planned contract. **No handlers exist.** Route handlers are implemented per task (VS-1 onward). This document defines *what* each operation is; `src/shared/contracts/` defines *shapes*.

## 1. Conventions

- **Base:** `/api/v1`. JSON only (`Content-Type: application/json`). Media delivery is separate: `/media/{assetKey}`.
- **Auth:** cookie session (ADR-006). Authenticated ops return 401 `AUTH_REQUIRED` when unauthenticated.
- **Authorization failure policy:** private ops with *other users' ids* → **404** (no existence leak); role failures → **403** `AUTH_FORBIDDEN`.
- **Input identity rule (IDOR control, THREAT T-04):** the acting user is ALWAYS derived from the verified session — never from body/query. Ids of *target* resources are allowed in paths; `userId` never appears in any client-supplied input.
- **Validation:** Zod at the edge; validation failure → 422 `VALIDATION_*` with a `details[]` (path + message). No server internals in bodies.
- **Pagination (list endpoints):** cursor-based. Query: `cursor` (opaque), `limit` (default per op, hard-capped). Response: `{ items: [...], nextCursor: string | null }`.
- **Timestamps:** ISO-8601 UTC.
- **Rate limits** (NFR-SEC-005/006): 429 `RATE_LIMIT_*` with `Retry-After` header.
- **Errors:** §6 taxonomy. All error bodies: `{ error: { code, message, details?, requestId } }`. `message` is user-visible-safe; `details` is data (never stack traces, never storage paths — NFR-SEC-010).
- **Request id:** `x-request-id` echoed in every response.
- **Caching:** catalog/detail APIs: `Cache-Control: private, max-age=60, stale-while-revalidate=60`; private data (library/progress/history/bookmarks): `no-store`; media: immutable (PERFORMANCE.md §4).

## 2. Operations

Format per operation:

| Field | Value |
|---|---|
| Operation | METHOD path |
| Requirement | FR/NFR ids |
| Purpose | … |
| Caller | … |
| Auth / Authz | … |
| Input | … |
| Output | … |
| Failures | code → HTTP |
| Validation | … |
| Rate limit | … |
| Idempotency | … |

### 2.1 Catalog & Content (public)

**GET /api/v1/catalog**
| Field | Value |
|---|---|
| Requirement | FR-CATALOG-001…005, NFR-PERF-004 |
| Purpose | Paginated, filterable, sortable list of published manga |
| Caller | Catalog page (RSC), search-independent |
| Auth / Authz | none / public |
| Input | `cursor?`, `limit?` (≤ 48), `genre?` (csv slugs, ≤ 5), `status?` (ongoing/completed/hiatus), `sort?` (title_asc, updated_desc, added_desc) |
| Output | `{ items: MangaSummary[], nextCursor }` — MangaSummary: id, slug, title, status, coverUrl, latestChapter {number,title,publishedAt} |
| Failures | VALIDATION_BAD_QUERY → 422 |
| Validation | enum/whitelist for sort/status; genre slugs must exist (ignored if not — no error) |
| Rate limit | generic 300/min/IP |
| Idempotency | pure read; safe retries |

**GET /api/v1/catalog/facets**
| Field | Value |
|---|---|
| Requirement | FR-CATALOG-002, FR-SEARCH-003 |
| Purpose | The public genre/tag vocabulary behind the catalog filter controls |
| Caller | Catalog page (RSC) — T-CATALOG-004's controls |
| Auth / Authz | none / public |
| Input | none |
| Output | `{ genres: [{ id, name, slug }], tags: [{ id, name, slug }] }`, each list ordered by name. **No counts** (T-CATALOG-002 scope) |
| Failures | INTERNAL_ERROR → 500 |
| Validation | none; the response is the vocabulary, so there is nothing to validate |
| Rate limit | generic 300/min/IP |
| Idempotency | pure read; safe retries |

Notes:
- `slug` is the name-derived slug the catalog filter accepts (lowercase, runs of
  non-alphanumerics collapsed to `-`, no leading/trailing `-`). The filter's
  vocabulary is slugs (see the catalog row's `genre?` input), so the server
  emits the slug it already derives rather than leaving every client to repeat
  the rule — see `docs/architecture/spec-questions.md` SQ-CAT-2. `MangaDetail`'s
  `genres[]` does NOT carry a slug: the detail page renders `name` only.
- The vocabulary is narrowed to genres/tags carried by at least one VISIBLE
  manga (`published ∧ ¬deleted`); a control that could only ever return zero
  results is not a filter.
- A genre whose name is entirely non-latin has a degenerate slug and cannot be
  filtered. Both the request edge and the query drop it, so the behaviour is
  "not filterable", not "silently unfiltered".

**GET /api/v1/manga/{slug}**
| Field | Value |
|---|---|
| Requirement | FR-CATALOG-006, FR-CATALOG-008 |
| Purpose | Full manga detail |
| Caller | Detail page (RSC) |
| Auth / Authz | none (authenticated: adds `continueReading` if progress exists — same shape, field omitted for anon) |
| Input | path `slug` |
| Output | MangaDetail: all summary fields + aliases, creators[], genres[], tags[], synopsis, readingDirection, chapterCount, firstChapter?, latestChapter? |
| Failures | MANGA_NOT_FOUND → 404 (also for soft-deleted/unpublished) |
| Validation | slug format ≤ 190 chars |
| Rate limit | generic |
| Idempotency | pure read |

**GET /api/v1/manga/{slug}/chapters**
| Field | Value |
|---|---|
| Requirement | FR-CATALOG-007, FR-CHAPTER-004 |
| Purpose | Chapter list in reading order |
| Caller | Chapter list (RSC) |
| Auth / Authz | public (published only); admin caller receives drafts too (flag `includeDrafts` honored only for admin role) |
| Input | path `slug`, `includeDrafts?` (admin-only effect) |
| Output | `{ items: ChapterSummary[] }` — id, number, title?, pageCount, publishedAt; **no** cursor (≤ 500 chapters per manga realistic; hard cap 1000 → 409 `CHAPTER_LIST_TOO_LARGE`, ops alert) |
| Failures | MANGA_NOT_FOUND → 404; CHAPTER_LIST_TOO_LARGE → 409 |
| Validation | slug format |
| Rate limit | generic |
| Idempotency | pure read |

**GET /api/v1/chapters/{chapterId}/pages**
| Field | Value |
|---|---|
| Requirement | FR-CHAPTER-003, FR-READER-019/020, NFR-PERF-004/008 |
| Purpose | Ordered page list for the reader (single call, no per-page APIs) |
| Caller | Reader client |
| Auth / Authz | public if chapter+manga published; admin for drafts; else 404 |
| Input | path `chapterId` (uuid) |
| Output | `{ chapter: { id, mangaSlug, mangaTitle, number, title?, readingDirection, pageCount }, pages: PageAsset[] }` — PageAsset: pageNumber (1-based), urlAvif, urlWebp, urlJpeg (each `/media/{assetKey}`), width, height |
| Failures | CHAPTER_NOT_FOUND → 404; CHAPTER_NOT_READY → 409 (draft with pages / failed job: "unavailable" state, EC-RDR-08); MANGA_NOT_FOUND → 404 |
| Validation | uuid format |
| Rate limit | generic |
| Idempotency | pure read |

**GET /media/{assetKey}**
| Field | Value |
|---|---|
| Requirement | FR-MEDIA-001…003, NFR-PERF-009/013 |
| Purpose | Stream one page/cover variant |
| Caller | Browser `<img>`/`<picture>` |
| Auth / Authz | public (key is the capability; unguessable 128-bit — THREAT T-11); draft keys 404 for non-admins |
| Input | path `assetKey` |
| Output | image bytes; `Content-Type` (image/avif|webp|jpeg), `Content-Length`, `ETag`, `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` |
| Failures | MEDIA_NOT_FOUND → 404 (any unknown/draft key); STORAGE_ERROR → 502 (no passthrough detail); INTERNAL_* → 500 |
| Validation | key format (22–64 base64url chars) — malformed → 404, not 422 |
| Rate limit | generic; enumeration is cheap by design (single indexed lookup, THREAT T-11) |
| Idempotency | pure read; immutable per key |

### 2.2 Search (public)

**GET /api/v1/search**
| Field | Value |
|---|---|
| Requirement | FR-SEARCH-001…004, NFR-PERF-005, NFR-SEC-006 |
| Purpose | Ranked title/alias/creator/tag search |
| Caller | Search page (debounced client) |
| Auth / Authz | none / public |
| Input | `q` (1–120 chars, required), `cursor?`, `limit?` (≤ 48) |
| Output | `{ items: SearchHit[], nextCursor, totalHint? }` — SearchHit: kind (manga/creator/tag), id, slug?, title, matchField (title/alias/creator/tag), score-band (exact/prefix/contains/related) |
| Failures | VALIDATION_BAD_QUERY → 422 (empty/overlong); RATE_LIMIT_SEARCH → 429 |
| Validation | `q` trimmed; SQL/HTML fragments are inert (parameterized, NFR-SEC-015); ≤ 120 chars |
| Rate limit | 30/min/IP |
| Idempotency | pure read |

### 2.3 Progress & History (authenticated)

**POST /api/v1/progress**
| Field | Value |
|---|---|
| Requirement | FR-READER-012/014, NFR-DATA-003, THREAT T-18 |
| Purpose | Persist latest position (idempotent upsert, server-stamped LWW) |
| Caller | Reader client (debounced) |
| Auth / Authz | authenticated; **always the session user** (IDOR-impossible by design) |
| Input | `{ chapterId: uuid, pageNumber: int ≥ 1, scrollPosition?: 0..1, completed?: boolean }` |
| Output | 204 (no body) |
| Failures | AUTH_REQUIRED → 401; CHAPTER_NOT_FOUND → 404 (chapter must be public-or-admin-visible, else 404); READER_INVALID_PAGE → 422 (page > pageCount or ≤ 0); VALIDATION_* → 422 |
| Validation | Zod; page checked against stored pageCount (not just range) |
| Rate limit | 60/min/account (progress chatter is high; generous but capped) |
| Idempotency | **idempotent** (NFR-DATA-003): identical repeat = no-op; older server timestamp never overwrites newer; `completed` is sticky (cannot be unset here — explicit unmark op in chapter list) |

**GET /api/v1/progress?chapterId={uuid}**
| Field | Value |
|---|---|
| Requirement | FR-READER-012, FR-CATALOG-008 |
| Purpose | Fetch session user's position for a chapter (restore on open) |
| Auth / Authz | authenticated; session user only |
| Input | query `chapterId` |
| Output | `{ chapterId, pageNumber, scrollPosition, completed, updatedAt }` or 404 if none |
| Failures | AUTH_REQUIRED → 401; VALIDATION_* → 422 |
| Validation | uuid |
| Rate limit | generic |
| Idempotency | pure read |

**POST /api/v1/progress/merge** (VS-5, FR-READER-013)
| Field | Value |
|---|---|
| Requirement | FR-READER-013 |
| Purpose | On sign-in: merge anonymous local progress (client payload) into the account — per chapter, latest timestamp wins |
| Auth / Authz | authenticated; session user |
| Input | `{ entries: [{ chapterId, pageNumber, completed?, updatedAtClient (ISO) }] }` ≤ 200 entries |
| Output | 204 |
| Failures | AUTH_REQUIRED → 401; VALIDATION_* → 422 (oversize, bad uuids, page>count entries dropped with a summary) |
| Validation | per-entry validation; invalid entries dropped, not fatal |
| Rate limit | 10/account/hour |
| Idempotency | idempotent (same LWW rule) |

**GET /api/v1/history**
| Field | Value |
|---|---|
| Requirement | FR-READER-015, FR-LIBRARY-008 |
| Purpose | Session user's reading history, newest first |
| Auth / Authz | authenticated; session user |
| Input | `cursor?`, `limit?` (≤ 50) |
| Output | `{ items: HistoryEntry[], nextCursor }` — chapter {id, number, mangaSlug, mangaTitle}, deepestPage, startedAt, endedAt? |
| Failures | AUTH_REQUIRED → 401 |
| Validation | cursor/limit |
| Rate limit | generic |
| Idempotency | pure read |

### 2.4 Library & Bookmarks (authenticated)

**POST /api/v1/library/{mangaId}** — add. Requirement FR-LIBRARY-001. Authenticated, session user. Output 204. Failures: AUTH_REQUIRED 401; MANGA_NOT_FOUND 404; idempotent (re-add = no-op, resets nothing).

**DELETE /api/v1/library/{mangaId}** — remove. FR-LIBRARY-002. Output 204. 404 if not in library (idempotent-ish: 204 on already-absent to keep client logic simple — documented choice).

**GET /api/v1/library** — FR-LIBRARY-003/004/006. `cursor?`, `limit?` (≤ 48), `sort?` (last_read_desc default, added_desc, title_asc). Output items: manga summary + lastRead {chapterNumber, page, at?} + unreadChapterCount. 401 if anon.

**POST /api/v1/bookmarks** — FR-LIBRARY-009. Input `{ chapterId, pageNumber?, note? (≤ 280) }`. Output 201 + Bookmark. Failures: 401/404/422 (duplicate page → 409 `LIBRARY_BOOKMARK_EXISTS`).

**GET /api/v1/bookmarks** — FR-LIBRARY-010. Cursor list, newest first, chapter resolved (deleted chapter → `chapter: null`, item retained — DATA_MODEL §14).

**DELETE /api/v1/bookmarks/{id}** — 204; 404 if not owned.

**PATCH /api/v1/chapters/{chapterId}/read-status** — FR-LIBRARY-007. Input `{ read: boolean }`. Sets/clears `completed` for the session user. 204. 404 chapter/401.

### 2.5 Auth (public/authenticated)

**POST /api/v1/auth/register**
| Field | Value |
|---|---|
| Requirement | FR-AUTH-001, NFR-SEC-005 |
| Purpose | Create account (role always `reader`) |
| Auth / Authz | none |
| Input | `{ email, password, displayName? }` — email RFC-valid ≤ 254; password ≥ 10, ≤ 128, not in common list |
| Output | 201 + auto-login (session cookie set) |
| Failures | VALIDATION_* → 422; AUTH_EMAIL_TAKEN → 409 (enumeration-accepted for email-only signup; documented); RATE_LIMIT_REGISTER → 429 |
| Validation | Zod; `role` field in input is **ignored** (T-07) |
| Rate limit | 5/h/IP |
| Idempotency | not idempotent (409 on repeat) |

**POST /api/v1/auth/login**
| Field | Value |
|---|---|
| Requirement | FR-AUTH-002, NFR-SEC-002/003/005, THREAT T-03/T-05 |
| Purpose | Sign in; rotate session |
| Input | `{ email, password }` |
| Output | 204 + Set-Cookie (new session; old sessions for the user remain until expiry — documented: multi-device) |
| Failures | AUTH_INVALID_CREDENTIALS → 401 (uniform: unknown email == wrong password; uniform timing); AUTH_DISABLED → 403 (distinct — disabled accounts are a small admin class, leak acceptable & documented); RATE_LIMIT_LOGIN → 429 |
| Rate limit | 10/min/IP and 5/min/account |
| Idempotency | not idempotent (new session each success) |

**POST /api/v1/auth/logout** — FR-AUTH-003, NFR-SEC-003. Authenticated. Revokes current session, clears cookie. 204. Idempotent (repeat → 204).

**POST /api/v1/auth/password-reset/request** — FR-AUTH-004, NFR-SEC-005. Input `{ email }`. **Always 204** (no existence signal). Token: 256-bit, 60 min, single-use, replaces any active token for the user. Mail via MailPort (VS-9). Rate: 3/h/IP.

**POST /api/v1/auth/password-reset/confirm** — FR-AUTH-004. Input `{ token, newPassword }`. Validates policy like register. On success: password updated, all user sessions revoked (forced re-login — documented), token consumed. Failures: AUTH_INVALID_CREDENTIALS → 401 (covers expired/used/unknown token — uniform), VALIDATION_* → 422. Rate 3/h/IP.

**DELETE /api/v1/account** — FR-AUTH-005, NFR-DATA-005. Authenticated. Cascades private data (DATA_MODEL §1); audit provenance retained. 204. Idempotent (repeat → 404 AUTH_REQUIRED-ish `AUTH_ACCOUNT_GONE` — documented).

### 2.6 Reader Preferences (authenticated)

**GET /api/v1/preferences** / **PUT /api/v1/preferences** — FR-READER-021. Input/Output: `{ defaultMode: vertical|single|double, directionOverride: none|rtl|ltr, zoomDefault: 1.0–4.0, autoNextChapter: boolean }`. PUT upserts (idempotent). 401 if anon. Validation: enums + ranges.

### 2.7 Admin (all require role=admin; else 403 `AUTH_FORBIDDEN`; unauthenticated → 401)

**POST /api/v1/admin/manga** — FR-ADMIN-001. Input: `{ title, slug?, synopsis?, status, readingDirection, genreSlugs[], tagNames[], creators: [{name, role}] }`. Slug auto-generated from title if absent (uniqueness-checked). Output 201 MangaDetail. Failures: VALIDATION_* 422; MANGA_SLUG_TAKEN 409. Audit: `manga.create`.

**PATCH /api/v1/admin/manga/{id}** — FR-ADMIN-002. Partial metadata update; slug immutable after first publish (EC-ADM-07). 200 + updated. Audit `manga.update` (before/after summary).

**DELETE /api/v1/admin/manga/{id}** — FR-ADMIN-003. Soft-delete. 204. Repeat → 204 (idempotent). Restore: `POST /api/v1/admin/manga/{id}/restore` → 200. Audit both.

**POST /api/v1/admin/manga/{id}/chapters** — FR-ADMIN-004. Input `{ number, title?, notes? }`. 201. Failures: CHAPTER_DUPLICATE_NUMBER 409. Audit.

**PATCH /api/v1/admin/chapters/{id}** — metadata (number/title/notes). 200. Audit.

**DELETE /api/v1/admin/chapters/{id}** — soft-delete. 204. Idempotent. Audit. (Hard delete: out of API in v1 — ops procedure only, RUNBOOK.)

**POST /api/v1/admin/manga/{id}/publish** / **.../unpublish** — FR-ADMIN-005. Body `{ }` or `{ chapterIds: uuid[] }` for chapter-level. 200 `{ affected }`. Publishing a chapter with 0 pages → 409 `CHAPTER_NOT_READY`. Audit.

**GET /api/v1/admin/users** — FR-ADMIN-006. Cursor list: id, email, displayName, role, status, lastLoginAt, createdAt. Audit? read — no audit (reads are not audited; documented).

**PATCH /api/v1/admin/users/{id}** — FR-ADMIN-006/009. Input `{ role?: reader|admin, status?: active|disabled }`. Guards: last-admin (409 `ADMIN_LAST_ADMIN`); disabling self with other admins OK. 200. Audit `user.update`.

**GET /api/v1/admin/audit** — FR-ADMIN-007. Cursor list, filterable `targetKind?`, `targetId?`. Read-only. Audit: reads not audited.

**GET /api/v1/admin/stats** — FR-ADMIN-008. Output: counts (manga, chapters, pages, users, libraryEntries) + upload {ready24h, failed24h, p50DurationMs, p95DurationMs}. 200.

**POST /api/v1/admin/uploads** — FR-UPLOAD-001/006/007/011, NFR-SEC-006/007/008, THREAT T-08…T-10.
| Field | Value |
|---|---|
| Purpose | Intake a chapter upload (ZIP or image set) → job |
| Caller | Admin upload UI |
| Auth / Authz | admin |
| Input | multipart/form-data: `chapterId` (form field) + `file` (single ZIP) **or** `files[]` (≤ 500 images). Caps: 500 MB total, 100 MB/file, 500 files (NFR-SEC-007) |
| Output | 202 + `{ jobId, state: "queued" }` |
| Failures | VALIDATION_* 422 (caps/missing fields); UPLOAD_BAD_CONTAINER 415 (non-ZIP where ZIP expected); CHAPTER_NOT_FOUND 404; CHAPTER_HAS_PAGES 409 (re-ingest must use reingest op); RATE_LIMIT_UPLOAD 429 |
| Validation | full §6 contract (SECURITY.md §6) runs server-side; MIME via magic bytes |
| Rate limit | 2 jobs/h/account |
| Idempotency | not idempotent (each call = new job); client sends `Idempotency-Key` (client uuid, 24 h TTL) → same key returns the original job (documented) |

**GET /api/v1/admin/uploads/{jobId}** — FR-UPLOAD-007. Output: job {state, inputKind, fileCount?, byteSize?, errorCode?, errorMessage?, startedAt, finishedAt, chapterId}. 404 if not owned by an admin account (all admin jobs visible to any admin — documented, single small class).

**POST /api/v1/admin/chapters/{id}/reingest** — FR-UPLOAD-009. Same multipart intake as uploads but targets an existing chapter with pages; old asset set GC-queued after commit. Same failures + `CHAPTER_NOT_READY` not applicable. Idempotency-Key honored.

**POST /api/v1/admin/manga/{id}/cover** — FR-ADMIN-002 (+ FR-UPLOAD-010 auto path is internal, not an API). multipart single image (≤ 10 MB). Normalized by the same media pipeline (WebP+JPEG, max 1200 px). 200 + coverUrl.

### 2.8 Telemetry (public, hardened)

**POST /api/v1/telemetry/beacon** — NFR-OBS-007.
| Field | Value |
|---|---|
| Purpose | Client-side signals (reader image failures, session summary) |
| Auth / Authz | none (anonymous allowed) — schema-whitelisted, no PII |
| Input | `{ events: [{ type: "page_load_error" \| "session_summary", t: ISO, chapterId?: uuid, cause?: "network" \| "decode" \| "http_status", httpStatus?: int, mode?: string, pagesRead?: int, durationMs?: int }] }` ≤ 100 events, ≤ 16 KB body |
| Output | 204 |
| Failures | VALIDATION_* 422 (dropped silently on client — no retry storm); RATE_LIMIT_BEACON 429 (client drops) |
| Rate limit | 60/min/IP, 16 KB |
| Idempotency | at-most-once acceptable (metrics only); duplicate tolerance documented |

### 2.9 System (unauthenticated)

**GET /healthz** — NFR-OBS-004. Process liveness. 200 `{ ok: true }`. No cache. **GET /readyz** — DB + storage canary. 200 `{ ok: true }` or 503 `{ ok: false, missing: ["db"|"storage"] }`. No app detail beyond that.

## 3. DTO Index (defined in src/shared/contracts)

MangaSummary, MangaDetail, ChapterSummary, PageAsset, PageListResponse, SearchHit, LibraryEntry, HistoryEntry, Bookmark, ReaderProgress, ReaderPreference, UploadJob, UserSummary, AuditEventDto, StatsDto, ErrorBody, CursorPage<T>.

## 4. Versioning & Compatibility

- v1 is the only version in scope. Breaking changes → `/api/v2` (new ADR). Non-breaking additions: new optional fields, new endpoints, new enum values documented as "clients must ignore unknown".
- Client (same app) is versioned with the server — no external API consumers in v1; contract stability is for *our* future selves and for the E2E suite.

## 5. Route → Module Map (implementation placement)

| Routes | Web file (planned) | Feature service |
|---|---|---|
| /api/v1/catalog, /manga/{slug}, /chapters pages | `src/app/api/v1/...` route handlers | features/catalog, features/chapters |
| /api/v1/search | `src/app/api/v1/search/route.ts` | features/search |
| /api/v1/progress* | `src/app/api/v1/progress/...` | features/progress |
| /api/v1/library*, /bookmarks*, read-status | `src/app/api/v1/...` | features/library, features/progress |
| /api/v1/auth* | `src/app/api/v1/auth/...` | features/auth |
| /api/v1/preferences | `src/app/api/v1/preferences/route.ts` | features/reader (prefs) |
| /api/v1/admin/* | `src/app/api/v1/admin/...` | features/admin, features/uploads |
| /media/{assetKey} | `src/app/media/[assetKey]/route.ts` | server/media (via composition) |
| /api/v1/telemetry/beacon | `src/app/api/v1/telemetry/beacon/route.ts` | server/telemetry |

## 6. Error Taxonomy (normative — full mapping in `src/shared/contracts/errors.ts`)

Legend: V = user-visible message; L = logged level (always ≥ warn on 5xx); A = alert.

| Code | HTTP | V | L | A | When |
|---|---|---|---|---|---|
| AUTH_REQUIRED | 401 | "Sign in to continue." | info | — | unauthenticated on private op |
| AUTH_INVALID_CREDENTIALS | 401 | "Invalid email or password." | warn | spike rule | login/reset-confirm failure |
| AUTH_EMAIL_TAKEN | 409 | "An account with this email exists." | info | — | register conflict |
| AUTH_DISABLED | 403 | "Account disabled. Contact the operator." | warn | — | login as disabled |
| AUTH_FORBIDDEN | 403 | "You don't have permission." | warn | — | role failure (admin ops by non-admin) |
| AUTH_ACCOUNT_GONE | 404 | "Account no longer exists." | info | — | repeat deletion |
| CATALOG_PAGE_INVALID | 422 | "Invalid pagination." | info | — | bad cursor/limit |
| MANGA_NOT_FOUND | 404 | "Manga not found." | info | — | unknown/deleted/unpublished |
| MANGA_SLUG_TAKEN | 409 | "Slug already in use." | info | — | admin create |
| CHAPTER_NOT_FOUND | 404 | "Chapter not found." | info | — | unknown/deleted |
| CHAPTER_NOT_READY | 409 | "This chapter isn't available yet." | warn | — | draft/no pages; publish attempt |
| CHAPTER_DUPLICATE_NUMBER | 409 | "A chapter with this number exists." | info | — | admin create |
| CHAPTER_LIST_TOO_LARGE | 409 | "Chapter list too large to display." | error | yes | > 1000 chapters (data problem) |
| READER_INVALID_PAGE | 422 | "Page is out of range for this chapter." | info | — | progress write / deep link |
| LIBRARY_BOOKMARK_EXISTS | 409 | "You already bookmarked this page." | info | — | duplicate bookmark |
| SEARCH_QUERY_INVALID | 422 | "Search query is empty or too long." | info | — | bad q |
| UPLOAD_BAD_CONTAINER | 415 | "Only ZIP archives are accepted." | warn | — | intake type |
| UPLOAD_TOO_LARGE | 413 | "Upload exceeds the size limit." | warn | — | caps (NFR-SEC-007) |
| UPLOAD_TOO_MANY_FILES | 413 | "Too many files." | warn | — | caps |
| UPLOAD_BAD_MIME | 415 | "One or more files are not supported images." | warn | — | magic-byte mismatch |
| UPLOAD_PATH_TRAVERSAL | 415 | "Archive contains unsafe paths." | error | yes | Zip Slip (T-08) |
| UPLOAD_SYMLINK | 415 | "Archive contains unsafe links." | error | yes | symlink entry |
| UPLOAD_DECOMPRESSION_BOMB | 413 | "Archive expands beyond the safe limit." | error | yes | bomb (T-09) |
| UPLOAD_IMAGE_DECODE | 422 | "Some images could not be read." | warn | > 5% rule | decode failure |
| UPLOAD_DIMENSIONS_EXCEEDED | 422 | "Image dimensions exceed the limit." | warn | — | > 10k px |
| STORAGE_ERROR | 502 | "Storage is temporarily unavailable." | error | yes | storage ops failure (no passthrough) |
| VALIDATION_* | 422 | per-field message | info | — | Zod failures (details[]) |
| RATE_LIMIT_LOGIN / _REGISTER / _RESET / _SEARCH / _UPLOAD / _BEACON / _GENERIC | 429 | "Too many requests. Try again soon." | warn (spike → error) | spike rules | limits (NFR-SEC-005/006) |
| ADMIN_LAST_ADMIN | 409 | "Another admin is required." | warn | — | last-admin guard |
| INTERNAL_* | 500 | "Something went wrong." (no detail) | error | yes | unhandled |

Rules: 5xx never include stack/storage detail (NFR-SEC-010); `requestId` always present for support; unknown codes are a contract violation (CI check against this table — UNIT-ERR-001).
