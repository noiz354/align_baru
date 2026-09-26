# PRD — Yomi Manga & Comic Reader

Version: 1.0 (architecture phase) · Date: 2026-09-26 · Status: Approved for implementation planning

## 1. Problem Statement

Readers of manga and comics who legally own or are authorized to host their content lack a lightweight, self-hostable web app that:

1. Presents a clean catalog of their collection with search.
2. Offers a fast, comfortable reader for **very long chapters** (up to 500+ pages) across desktop, laptop, and phones — including vertical scrolling, paged modes, and both RTL (manga) and LTR (Western comic) direction.
3. Remembers where they left off (progress, history, library, bookmarks) once authenticated.
4. Lets a curator (admin) ingest chapters from archives with a **secure** upload pipeline.

Existing tools are either SaaS (content leaves the owner's control), heavy (CMS-grade, many moving parts), or built for only one reading mode/direction. Yomi is the deliberately small, well-specified alternative.

## 2. Objectives

- O-1: Ship a readable, searchable, browsable catalog of authorized content (VS-1).
- O-2: Ship a reader that stays smooth on a mid-range phone for a 500-page chapter (VS-2…VS-4).
- O-3: Ship authenticated personalization: library, history, progress sync, bookmarks (VS-5).
- O-4: Ship a secure admin panel + upload pipeline for content curation (VS-6/VS-7).
- O-5: Operate as a single self-hostable stack (VM + compose + PostgreSQL + S3-compatible storage) with documented runbook (VS-11).

## 3. Non-Objectives

- NO-1: No DRM, no paid subscriptions, no e-commerce, no payments.
- NO-2: No content discovery/licensing workflow — content is authorized **before** it is uploaded.
- NO-3: No native mobile apps (responsive web only; PWA-style offline is explicitly out).
- NO-4: No social features (comments, reviews, ratings, follows, sharing).
- NO-5: No multi-tenant / multi-organization support. Single instance, one collection.
- NO-6: No full offline reading (progress + settings may be local; content is not cached for offline).
- NO-7: No translation, no text layer / OCR.
- NO-8: No Kubernetes, service mesh, event brokers, or other large-scale infrastructure.
- NO-9: No user-facing theming/customization beyond light/dark.

## 4. Target Users & Personas

- **P1 "Curator" (admin)** — owns/holds rights to a small-to-medium collection (10–2,000 titles). Uploads chapters weekly. Needs: fast ingestion, clear failure reports, publish control, audit trail.
- **P2 "Commuter" (casual reader)** — reads on a phone over mobile data in short bursts. Needs: fast first page, resume-where-left-off, low data usage.
- **P3 "Marathon" (power reader)** — desktop, large chapters, double-page mode, keyboard-only. Needs: paged/double modes, zero jank, position precision.
- **P4 "Returner"** — comes back after weeks. Needs: continue-reading, history, bookmarks.

Jobs-to-be-done:
- JTBD-1 (reader): "When I sit down to read, show me my next unread chapter so I can start reading within a few taps."
- JTBD-2 (reader): "When I read a long chapter, keep the pages flowing without freezing my device."
- JTBD-3 (admin): "When I receive a new chapter as a ZIP, get it into the reader in one validated step, and tell me clearly if anything is wrong."
- JTBD-4 (reader): "When I lose my place, restore it exactly."

## 5. Product Scope

In scope: catalog, details, chapters, reader (3 modes × 2 directions × keyboard/mouse/touch/zoom/fullscreen), search, library, bookmarks, progress, history, reader preferences, email+password auth, admin (manga/chapter/user management, audit, stats), secure uploads + image processing, observability, production ops.

Explicitly out: see Non-Objectives.

## 6. Functional Requirements

Priority: P0 = must ship for product viability; P1 = expected in full release; P2 = nice-to-have (may be cut last).

### 6.1 Authentication (AUTH)

| ID | Priority | Requirement |
|---|---|---|
| FR-AUTH-001 | P0 | A new user can register with a unique email and a compliant password. |
| FR-AUTH-002 | P0 | An authenticated request can sign in with email + password and receive a session. |
| FR-AUTH-003 | P0 | A signed-in user can sign out; the session is immediately revoked. |
| FR-AUTH-004 | P1 | A user can request a password reset by email and set a new password with a single-use, expiring token. |
| FR-AUTH-005 | P1 | A user can delete their own account; private data (progress, library, bookmarks, history) is deleted per NFR-DATA-005. |
| FR-AUTH-006 | P0 | Sessions expire after 30 days of inactivity and 90 days absolute, whichever comes first. |
| FR-AUTH-007 | P0 | Routes and APIs that operate on private data require an authenticated user; anonymous access is rejected. |
| FR-AUTH-008 | P0 | Admin routes and APIs require the admin role; authenticated non-admins are rejected. |
| FR-AUTH-009 | P1 | An admin can grant/revoke the admin role on other users and can disable a user account (login blocked, session invalidated). |
| FR-AUTH-010 | P0 | Auth endpoints (register, login, reset request) are rate-limited per IP + per account. |

### 6.2 Catalog (CATALOG)

| ID | Priority | Requirement |
|---|---|---|
| FR-CATALOG-001 | P0 | The catalog lists published, non-deleted manga with cursor-based pagination (default 24/page). |
| FR-CATALOG-002 | P1 | The catalog can be filtered by genre (multi-select). |
| FR-CATALOG-003 | P1 | The catalog can be filtered by status: ongoing / completed / hiatus. |
| FR-CATALOG-004 | P1 | The catalog can be sorted by: title A–Z, most recently updated, most recently added. |
| FR-CATALOG-005 | P0 | Catalog cards show cover, title, status, and latest published chapter label; cards link to details. |
| FR-CATALOG-006 | P0 | The manga detail page shows title (+aliases), creators, genres, tags, synopsis, status, cover, chapter count, latest chapter, and (if readable) resume position. |
| FR-CATALOG-007 | P0 | The chapter list shows chapters in reading order with number, title, page count, and publish date; drafts are hidden from non-admins. |
| FR-CATALOG-008 | P0 | For authenticated users with progress, the catalog card / detail page shows a "Continue reading" entry to the last-read chapter at the saved page. |

### 6.3 Chapters (CHAPTER)

| ID | Priority | Requirement |
|---|---|---|
| FR-CHAPTER-001 | P0 | A chapter has: manga, numeric/decimal number, optional title, optional notes, status (draft/published), publish date, page list. |
| FR-CHAPTER-002 | P0 | Chapters are visible publicly only when published (and their manga is published); drafts are admin-only. |
| FR-CHAPTER-003 | P0 | Reading a published chapter requires no authentication; anonymous readers are supported. |
| FR-CHAPTER-004 | P0 | Chapter order within a manga is deterministic (by number, with an explicit sort tiebreaker) and stable across reads. |

### 6.4 Reader (READER)

| ID | Priority | Requirement |
|---|---|---|
| FR-READER-001 | P0 | Vertical scroll mode: continuous top-to-bottom page flow (or bottom-to-top for RTL chapters, per FR-READER-004). |
| FR-READER-002 | P0 | Single-page mode: one page per view, explicit next/previous. |
| FR-READER-003 | P1 | Double-page mode: paired spread view for LTR; single-page fallback for odd pages and small screens. |
| FR-READER-004 | P0 | RTL direction (manga): reading starts at the last page, spreads pair right-to-left, horizontal navigation reversed. |
| FR-READER-005 | P0 | LTR direction (Western comic): standard left-to-right paging and pairing. |
| FR-READER-006 | P0 | Keyboard navigation: arrows / PageUp-PageDown / Space (next) / Shift+Space (prev) / Home / End, per mode. |
| FR-READER-007 | P0 | Tap/click zones: left/center/right thirds navigate prev / scroll-or-menu / next (mode-aware). |
| FR-READER-008 | P0 | Touch swipe gestures navigate pages in paged modes with cancel semantics (release mid-swipe = no move). |
| FR-READER-009 | P1 | Zoom: pinch (touch), wheel+Ctrl (desktop), double-tap toggle, 100%–400% range, reset shortcut. |
| FR-READER-010 | P1 | Fullscreen toggle using the Fullscreen API, with graceful degradation. |
| FR-READER-011 | P0 | Responsive layout: mobile portrait, mobile landscape, tablet, desktop — no horizontal overflow, no unreadable text. |
| FR-READER-012 | P0 | Progress is restored on reload, tab restore, or re-entry (page + scroll offset in vertical mode). |
| FR-READER-013 | P1 | Anonymous readers store progress locally (device) and can sync/merge into their account on sign-in. |
| FR-READER-014 | P0 | Progress is persisted automatically on navigation and on scroll (vertical mode, debounced). |
| FR-READER-015 | P1 | Each read session appends reading history entries (chapter, deepest page, timestamps) for signed-in users. |
| FR-READER-016 | P0 | Next/previous chapter navigation from the reader (skip to next/prev chapter from first/last page). |
| FR-READER-017 | P0 | Chapter completion is detected (last page viewed for ≥ 1s or explicit "mark as read") and recorded. |
| FR-READER-018 | P0 | A failed page image shows a placeholder with a retry affordance; the rest of the chapter stays usable. |
| FR-READER-019 | P0 | Preloading is bounded: only a window of pages near the active page is loaded/queued (see PERFORMANCE.md §window). |
| FR-READER-020 | P0 | Resident image count is bounded; pages far from the active window are evicted/reclaimable (memory cap). |
| FR-READER-021 | P1 | Per-user reader preferences: default mode, default direction override, zoom default, auto-advance on completion (saved in ReaderPreference). |
| FR-READER-022 | P0 | Position indicator: "Page N / M" plus a thin progress bar for vertical mode. |
| FR-READER-023 | P0 | Page index invariants: navigation can never produce a negative or out-of-range index; input (deep links) is validated and clamped with feedback. |
| FR-READER-024 | P0 | Final-page behavior: completion state, next-chapter CTA (or "series finished" state), no dead-end scroll. |

### 6.5 Library (LIBRARY)

| ID | Priority | Requirement |
|---|---|---|
| FR-LIBRARY-001 | P0 | A signed-in user can add a manga to their library (from detail page). |
| FR-LIBRARY-002 | P0 | A signed-in user can remove a manga from their library. |
| FR-LIBRARY-003 | P0 | The library lists entries with cover, title, last-read chapter, unread-chapter count, and last-read date. |
| FR-LIBRARY-004 | P1 | Library sorting: last read (default), added date, title. |
| FR-LIBRARY-005 | P0 | A "continue reading" list (most recently read, capped 20) is available from the home page for signed-in users. |
| FR-LIBRARY-006 | P0 | Per-manga reading progress is derivable (last read chapter + page, completion state). |
| FR-LIBRARY-007 | P1 | Per-chapter read status: automatic on completion; manual "mark read/unread" from the chapter list. |
| FR-LIBRARY-008 | P1 | History view lists chapters read with deepest page and last-read timestamp, newest first, paginated. |
| FR-LIBRARY-009 | P1 | A user can bookmark a chapter (optionally a page + short note) and list/remove bookmarks. |
| FR-LIBRARY-010 | P1 | Bookmarks list view with jump-to-page support. |

### 6.6 Search (SEARCH)

| ID | Priority | Requirement |
|---|---|---|
| FR-SEARCH-001 | P0 | Search matches manga titles (and aliases) with prefix + contains behavior. |
| FR-SEARCH-002 | P1 | Search matches creator names. |
| FR-SEARCH-003 | P1 | Search matches tags/genres. |
| FR-SEARCH-004 | P0 | Results are ranked (exact title > prefix > contains > creator/tag), paginated, and return counts. |
| FR-SEARCH-005 | P0 | The search UI debounces input (≈300ms), handles empty results, and is keyboard-accessible. |

### 6.7 Uploads (UPLOAD)

| ID | Priority | Requirement |
|---|---|---|
| FR-UPLOAD-001 | P0 | An admin can upload a chapter as a ZIP archive or as a set of individual image files (multipart). |
| FR-UPLOAD-002 | P0 | Archives are validated before processing: container type, file count, per-file size, total size, image MIME/extension sanity, page dimensions (see NFR-SEC-007). |
| FR-UPLOAD-003 | P0 | Archive extraction is safe (Zip Slip, path traversal, symlink, decompression bomb protections) per NFR-SEC-008. |
| FR-UPLOAD-004 | P0 | Pages are normalized: decoded, EXIF/metadata stripped, resized to max dimension, re-encoded to delivery formats. |
| FR-UPLOAD-005 | P1 | Each page is stored in multiple delivery formats (AVIF primary, WebP fallback, JPEG final fallback) with dimensions recorded. |
| FR-UPLOAD-006 | P0 | Page metadata (order, dimensions, asset keys, format sizes) is persisted atomically with the chapter state transition to "ready". |
| FR-UPLOAD-007 | P0 | Upload jobs expose a state machine (queued → validating → processing → ready / failed) with a human-readable failure reason. |
| FR-UPLOAD-008 | P1 | Large uploads use multipart/presigned part uploads with resumable progress. |
| FR-UPLOAD-009 | P1 | A chapter's pages can be re-ingested (replaced) by an admin; old assets become garbage-collectable. |
| FR-UPLOAD-010 | P2 | If a manga has no cover, the first page of the first chapter is used to generate the cover. |
| FR-UPLOAD-011 | P0 | The upload UI shows per-job progress, success/failure state, and a link to the result. |

### 6.8 Admin (ADMIN)

| ID | Priority | Requirement |
|---|---|---|
| FR-ADMIN-001 | P0 | An admin can create a manga: title, aliases, synopsis, status, genres, tags, creators, reading direction. |
| FR-ADMIN-002 | P0 | An admin can edit manga metadata and cover. |
| FR-ADMIN-003 | P1 | An admin can soft-delete (and restore) a manga; deleted manga are hidden everywhere and non-readable. |
| FR-ADMIN-004 | P0 | An admin can create, edit, and delete chapters under a manga (deletion of a chapter with pages requires explicit confirmation; pages become garbage-collectable). |
| FR-ADMIN-005 | P0 | An admin can publish/unpublish a manga and individual chapters (publish state cascades visibility only, never data). |
| FR-ADMIN-006 | P1 | An admin can list users, change roles, and disable/enable accounts (FR-AUTH-009). |
| FR-ADMIN-007 | P1 | Admin actions on content and users are written to an immutable audit log (who, what, when, before/after summary). |
| FR-ADMIN-008 | P2 | A stats dashboard shows counts: manga, chapters, pages, users, uploads (success/fail rates, last 30 days). |

### 6.9 Media delivery (MEDIA)

| ID | Priority | Requirement |
|---|---|---|
| FR-MEDIA-001 | P0 | Page images are served through the app with correct Content-Type, Content-Length, ETag, and immutable cache headers. |
| FR-MEDIA-002 | P1 | Page assets expose format variants; the reader selects via `<picture>` (AVIF → WebP → JPEG) with correct source sizes. |
| FR-MEDIA-003 | P0 | Asset keys are unguessable (random), never encode bucket/path layout, and never appear in logs or error bodies. |

## 7. Non-Functional Requirements

### 7.1 Performance (PERF) — budgets in PERFORMANCE.md

| ID | Priority | Requirement |
|---|---|---|
| NFR-PERF-001 | P0 | LCP ≤ 2.5 s (p75, lab, 4G-fast) on catalog, detail, and reader-open pages. |
| NFR-PERF-002 | P0 | INP ≤ 200 ms (p75) for reader interactions (navigate, zoom, mode switch). |
| NFR-PERF-003 | P0 | CLS ≤ 0.1 on all pages (reserved image slots; no layout shift on mode switch). |
| NFR-PERF-004 | P0 | API TTFB ≤ 300 ms (p95) for catalog/detail/chapter-page APIs on reference hardware. |
| NFR-PERF-005 | P0 | Search API ≤ 400 ms (p95) for queries on ≤ 10k titles. |
| NFR-PERF-006 | P0 | Chapter open (first visible page) ≤ 1.5 s broadband / ≤ 4 s slow-4G. |
| NFR-PERF-007 | P0 | Initial reader JS ≤ 250 KB gzipped; whole-page JS ≤ 400 KB gzipped. |
| NFR-PERF-008 | P0 | Network budget: ≤ 30 requests per catalog/detail page; reader in-flight requests ≤ configured window + 2. |
| NFR-PERF-009 | P0 | Delivered page image ≤ 1 MB (typical ≤ 500 KB); max dimension 2560 px. |
| NFR-PERF-010 | P0 | Reader memory: decoded/resident images ≤ 12; JS heap growth ≤ 150 MB over 30 min continuous reading. |
| NFR-PERF-011 | P0 | Preload window is bounded and mode-aware (vertical: ~±3 pages; paged: +2 ahead); see PERFORMANCE.md §window. |
| NFR-PERF-012 | P0 | 50/100/200/500-page chapters all meet NFR-PERF-006/010 on the reference matrix (PERFORMANCE.md §5). |
| NFR-PERF-013 | P0 | Cache behavior: processed assets immutable (max-age=1y, versioned keys); API responses short-cache (60 s) with revalidation; HTML no-store. |
| NFR-PERF-014 | P1 | Hot-path DB queries ≤ 20 ms (p95); every hot query has an index and an EXPLAIN check in CI (PERFORMANCE.md §6). |
| NFR-PERF-015 | P1 | On a throttled 3G-equivalent connection the reader remains usable (pages appear progressively; no full-page spinners > 10 s). |

### 7.2 Security (SEC) — details in SECURITY.md / THREAT_MODEL.md

| ID | Priority | Requirement |
|---|---|---|
| NFR-SEC-001 | P0 | Passwords hashed with Argon2id (m=64 MiB, t=3, p=4); no plaintext or weak hashes ever stored. |
| NFR-SEC-002 | P0 | Session cookies: HttpOnly, Secure, SameSite=Lax, Path-scoped, 256-bit random IDs. |
| NFR-SEC-003 | P0 | Session expiry: 30 d idle / 90 d absolute (FR-AUTH-006); sign-out revokes server-side. |
| NFR-SEC-004 | P0 | CSRF defense: SameSite=Lax + Origin/Referer verification on all mutating requests. |
| NFR-SEC-005 | P0 | Auth rate limits: login ≤ 10/min/IP, ≤ 5/min/account; register ≤ 5/h/IP; reset ≤ 3/h/IP. |
| NFR-SEC-006 | P0 | API rate limits: search ≤ 30/min/IP; upload intake ≤ 2/h/account; generic ≤ 300/min/IP. |
| NFR-SEC-007 | P0 | Upload validation (server-side, authoritative): ZIP only for archives; ≤ 500 files; ≤ 100 MB per file; ≤ 500 MB total; images ≤ 10,000 px per side; rejected with typed UPLOAD_* errors. |
| NFR-SEC-008 | P0 | Archive extraction hardening: no path traversal (Zip Slip), no symlinks/hardlinks, no absolute paths, stream with size caps (decompression bomb), entry count caps. |
| NFR-SEC-009 | P0 | Secrets only via environment/secret store; `.env` never committed; secrets never in logs, responses, or client bundles. |
| NFR-SEC-010 | P0 | No physical storage paths, credentials, or internal keys in any client-visible response or error. |
| NFR-SEC-011 | P0 | Security headers: strict CSP (self + own origin), HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy (camera/geo denied). |
| NFR-SEC-012 | P1 | Admin actions produce audit events (immutable append-only table). |
| NFR-SEC-013 | P1 | Supply-chain policy: lockfile committed, `npm audit` in CI (blocking on high/critical), dependency review for new packages. |
| NFR-SEC-014 | P1 | PII minimization: email + display name only; deletion cascades private data (NFR-DATA-005); no PII in logs (NFR-OBS-006). |
| NFR-SEC-015 | P0 | All SQL via parameterized ORM/query-builder calls; no string-concatenated SQL in product code. |
| NFR-SEC-016 | P0 | Output encoding: all user/admin-authored strings rendered as text (no raw HTML); synopsis stored as plain text; strict CSP as backstop. |

### 7.3 Accessibility (A11Y) — details in ACCESSIBILITY.md

| ID | Priority | Requirement |
|---|---|---|
| NFR-A11Y-001 | P0 | Target WCAG 2.1 AA for all pages, including the reader. |
| NFR-A11Y-002 | P0 | Every reader function is fully keyboard-operable (FR-READER-006 + focus-visible controls for mode/direction/zoom/fullscreen). |
| NFR-A11Y-003 | P0 | Focus management: initial focus on route entry, trapped in dialogs, restored after dismissal; no focus loss on mode switch. |
| NFR-A11Y-004 | P0 | Semantic structure: landmarks (header/nav/main), one h1 per page, logical heading order, list semantics for chapter lists. |
| NFR-A11Y-005 | P0 | Alt text: page images "Page N of M"; covers "Cover: {title}"; buttons labeled. |
| NFR-A11Y-006 | P0 | Visible focus states on all interactive elements, including reader tap zones (keyboard equivalents). |
| NFR-A11Y-007 | P0 | Respect `prefers-reduced-motion`: disable auto-scroll animations, parallax, and heavy transitions. |
| NFR-A11Y-008 | P0 | Color contrast ≥ 4.5:1 for text, 3:1 for UI components, in light and dark themes. |
| NFR-A11Y-009 | P1 | Screen-reader announcements for page changes (polite live region: "Page 12 of 240") and chapter completion. |
| NFR-A11Y-010 | P0 | Touch targets ≥ 44×44 CSS px. |

### 7.4 Data (DATA)

| ID | Priority | Requirement |
|---|---|---|
| NFR-DATA-001 | P0 | Relational integrity via FKs, NOT NULL where meaningful, CHECK constraints for enums/state. |
| NFR-DATA-002 | P0 | Catalog content uses soft-delete (deleted_at); user-private data is hard-deleted on request. |
| NFR-DATA-003 | P0 | Progress writes are idempotent: repeated identical updates change nothing; out-of-order older updates do not overwrite newer ones (last-write-wins by server timestamp). |
| NFR-DATA-004 | P0 | Backups: PostgreSQL daily (RPO ≤ 24 h, RTO ≤ 4 h); object storage versioned/durable. |
| NFR-DATA-005 | P1 | Retention: history retained indefinitely but purgeable per user; audit log retained ≥ 1 year; failed upload staging purged after 24 h. |
| NFR-DATA-006 | P0 | All timestamps stored UTC `timestamptz`; display-localized at the edge. |

### 7.5 Observability (OBS) — details in OBSERVABILITY.md

| ID | Priority | Requirement |
|---|---|---|
| NFR-OBS-001 | P0 | Structured JSON logs (pino) with request ID, route, duration, status; no PII. |
| NFR-OBS-002 | P0 | Distributed traces: HTTP → service → DB → storage spans with W3C trace context. |
| NFR-OBS-003 | P0 | RED metrics for all HTTP operations + DB latency + storage latency + process (CPU/RSS). |
| NFR-OBS-004 | P0 | `/healthz` (liveness) and `/readyz` (DB + storage reachable) endpoints. |
| NFR-OBS-005 | P1 | Error taxonomy mapped to severity; alert thresholds defined (OBSERVABILITY.md §5). |
| NFR-OBS-006 | P0 | No PII (email, passwords, full page content) in logs/traces; user IDs pseudonymized where required. |
| NFR-OBS-007 | P1 | Domain telemetry: reader image load failures (client beacons), upload job duration/states, auth failure counters. |

### 7.6 Operations (OPS)

| ID | Priority | Requirement |
|---|---|---|
| NFR-OPS-001 | P0 | Entire stack runs from Docker images; compose file for local dev and single-VM production. |
| NFR-OPS-002 | P0 | All configuration via environment variables with startup validation (fail fast, typed). |
| NFR-OPS-003 | P0 | Deployment model: single VM, no Kubernetes; stateless app (horizontally scaleable later) + stateful PG + storage. |
| NFR-OPS-004 | P0 | Rollback to previous app image ≤ 15 minutes; schema changes are backward-compatible (expand/contract). |
| NFR-OPS-005 | P0 | Automated daily backups (NFR-DATA-004) with verified restore runbook. |
| NFR-OPS-006 | P0 | Zero secrets in repository; CI/CD uses environment-injected secrets only. |

## 8. User Journeys (summary — full detail in docs/product/user-journeys.md)

- J-1 First-time reader (anonymous): land → browse catalog → open title → start chapter → read (vertical, RTL) → close. (J-1)
- J-2 Returning member: land → "Continue reading" → reader restores page → next chapter on completion. (J-2)
- J-3 Slow connection: 4G/3G → first page fast, background preload within window, failed page retries. (J-3)
- J-4 Curator onboarding: register → granted admin → create manga → upload ZIP → job ready → publish → verify reader. (J-4)
- J-5 Curator failure handling: corrupt ZIP → typed failure reason → fix → re-upload (re-ingest). (J-5)
- J-6 Power reader: desktop → double-page LTR → keyboard-only → zoom → fullscreen → history/bookmark. (J-6)

## 9. Reader Behavior (summary — full spec in docs/product/reader-behavior.md)

Modes: vertical (default), single-page, double-page. Directions: RTL / LTR (per manga, user overridable). Navigation inputs: keyboard, tap zones, swipe, scroll (vertical). State: `ReaderState { chapterId, currentPage, totalPages, readingMode, readingDirection, zoom, fullscreen, loadedWindow, progressStatus }`. Progress: local-first, server-synced when authenticated; idempotent writes; restored on re-entry. Completion → next-chapter CTA. Large chapters: bounded window (NFR-PERF-011), bounded residency (NFR-PERF-010), progressive loading (NFR-PERF-015). Full behavior matrix, edge cases, and state transitions: docs/product/reader-behavior.md.

## 10. Admin Behavior (summary — full spec in docs/product/admin-workflow.md)

Curator loop: create manga → create chapter → upload (ZIP or images) → pipeline validates/normalizes/stores → job ready → publish → verify in reader. Every state transition is visible in the admin UI; failures carry typed reasons; every admin mutation is audit-logged (FR-ADMIN-007). Publish is a visibility flag, never a data mutation.

## 11. Accessibility Requirements

See NFR-A11Y-* above and ACCESSIBILITY.md for the full AA mapping, the reader-specific contract (keyboard map, live regions, reduced motion), and the verification plan (axe-core in E2E + manual assistive-tech pass per milestone).

## 12. Performance Expectations

See NFR-PERF-* above and PERFORMANCE.md for budgets, the reference device matrix, the large-chapter matrix (50/100/200/500 pages), the windowing architecture, and the cache model.

## 13. Security Requirements

See NFR-SEC-* above, SECURITY.md (controls by boundary), and THREAT_MODEL.md (per-threat register with verification strategy).

## 14. Acceptance Criteria (per major area)

- AC-CATALOG: A seeded catalog of ≥ 50 titles renders paginated, filterable, sortable lists; detail page shows all FR-CATALOG-006 fields; chapter list order matches DATA_MODEL ordering rule. Verified by E2E-CATALOG-* tests.
- AC-READER: A 500-page seeded chapter meets NFR-PERF-006/010/012 in the reference matrix; all FR-READER-001…024 behaviors pass their unit/E2E tests including FR-READER-023 invariant fuzzing; progress survives reload/tab-restore (FR-READER-012).
- AC-AUTH: Full register → login → protected access → logout cycle; rate limits observable in tests; Argon2id parameters asserted on stored hashes; session expiry verified with time-travel tests.
- AC-LIBRARY: Add/remove/continue/history/bookmark flows pass E2E-LIBRARY-*; IDOR attempts (other users' IDs) return 404/403 per API contract.
- AC-ADMIN: Curator loop J-4/J-5 passes E2E-ADMIN-*; audit log contains every mutation; soft-delete hides everywhere; role enforcement verified for every admin route (authorization matrix test).
- AC-UPLOAD: A valid 200-page ZIP lands in the reader with multi-format assets and correct metadata; each attack fixture in the upload threat suite (Zip Slip, symlink, bomb, 501 files, 110 MB file, 9,999×9,999 px) is rejected with the typed error.
- AC-SEARCH: Title/alias/creator/tag queries return ranked, paginated results within NFR-PERF-005; empty-query and wildcard-input cases handled.
- AC-OBS: Traces show HTTP→DB→storage spans for a chapter-open and an upload job; `/readyz` fails when PG or storage is down; error taxonomy exercised by chaos tests.

## 15. Edge Cases (summary — full list in docs/product/edge-cases.md)

Anonymous progress + late sign-in merge; last page / first page of chapter; single-page chapters; odd-page double-page spreads; mode/direction switch mid-chapter (position preservation); deleted chapter mid-session (graceful "unavailable" state); concurrent progress from two tabs (last-write-wins, no corruption); zero-page (failed) chapter (reader refuses with clear state); search on empty catalog; upload of a chapter for a deleted manga; admin disabling their own account (last-admin guard); clock skew on progress timestamps; huge title lists (cursor pagination stability with concurrent inserts).

## 16. Success Metrics

- M-1: 90% of weekly active readers use continue-reading within 5 min of session start.
- M-2: p95 chapter-open ≤ 1.5 s (broadband) sustained (field via telemetry).
- M-3: ≥ 99% of uploaded chapters reach "ready" without admin intervention (upload pipeline health).
- M-4: 0 critical/high security findings open at GA (threat-model verification gate).
- M-5: Lighthouse (lab, Moto G profile): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95 on catalog/detail/reader.
- M-6: Reader memory: no monotonic heap growth over 30-min marathon sessions (PERF-010).

## 17. Out-of-Scope Confirmations (for implementation agents)

Anything not covered by an FR-*/NFR-* ID above is out of scope for the current roadmap. New behavior requires a requirement ID + task before code.
