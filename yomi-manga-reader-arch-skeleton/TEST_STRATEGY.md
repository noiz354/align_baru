# TEST_STRATEGY.md

Date: 2026-09-26 · Tools: Vitest 4.1 (unit/integration) + Playwright 1.62 (E2E) + real PostgreSQL & MinIO via Docker for integration (installed at VS-0, T-FOUND-001/010). This document specifies **planned** tests; skeleton files with `describe.todo` exist under `tests/`. No behavior tests pass yet by design.

## 1. Levels & Rules

| Level | Runs | Env | What it proves |
|---|---|---|---|
| Unit | every commit (CI) | Node, no I/O | Pure domain logic: invariants, state machines, windowing, validation, ranking, hashing parameters |
| Integration | every commit (CI) | Docker: PostgreSQL 18 + MinIO | Repositories, auth flow, upload pipeline, authorization, concurrency — against real services |
| E2E | milestone + GA gates | Full app (compose) + Chromium (also Firefox once per milestone) | User journeys, a11y (axe), performance assertions, visual smoke |

Rules:
1. **No fake product data in unit/integration tests as *system under test* behavior.** Fixtures (test titles/chapters) are data setup only, created through the same repositories the app uses — no hardcoding in features (see SKELETON rules). E2E seeds use the dev seed harness (T-FOUND-012) — the only sanctioned fixture path.
2. Every test file declares the task ID(s) it verifies in its header comment.
3. Every FR-*/NFR-* with a testable behavior has ≥ 1 planned test ID (traceability in docs/architecture/final-review.md).
4. Flaky tolerance: zero. A flaky test blocks the milestone and is quarantined with a task (AGENTS.md).

## 2. Unit Test Plan (Vitest) — planned IDs

### Reader (features/reader) — highest density
| ID | Task | What |
|---|---|---|
| UNIT-READER-001 | T-READER-003 | ReaderState reducer: every transition (mode, direction, zoom, page) preserves invariants |
| UNIT-READER-002 | T-READER-032 | Page index: negative, zero, > M, NaN, non-integer inputs → clamped/rejected (no negative page indexes) |
| UNIT-READER-003 | T-READER-033 | Final page: navigation from M stays at M; completion flag set; no wrap-around |
| UNIT-READER-004 | T-READER-031 | `calculateReaderWindow`: first page, last page, middle, chapter smaller than window, 500-page chapter, mode sizes, hard cap 12 |
| UNIT-READER-005 | T-READER-031 | Window recompute idempotency + rapid-navigation sequences (fuzz 1k random walks) |
| UNIT-READER-006 | T-READER-006 | Double-page pairing LTR: (1,2),(3,4)…; odd last page → single fallback |
| UNIT-READER-007 | T-READER-006 | Double-page pairing RTL: (M,M−1),(M−2,M−3)…; odd handling |
| UNIT-READER-008 | T-READER-030 | Mode switch position mapping (vertical↔single↔double) preserves page; direction switch reverses spread order without page change |
| UNIT-READER-009 | T-READER-011 | Zoom bounds (100–400%), reset, step |
| UNIT-READER-010 | T-READER-017 | Completion detection: last page ≥ 1 s, explicit mark, sticky-completion |

### Progress / library / auth / uploads
| ID | Task | What |
|---|---|---|
| UNIT-PROG-001 | T-READER-021 | Idempotency: identical update twice → 1 row, no changed |
| UNIT-PROG-002 | T-READER-021 | LWW: older server timestamp never overwrites newer |
| UNIT-PROG-003 | T-READER-023 | Merge on sign-in (FR-READER-013): local vs server — per-chapter latest wins |
| UNIT-AUTH-001 | T-AUTH-002 | Argon2id parameters present in produced hashes (m/t/p asserted) |
| UNIT-AUTH-002 | T-AUTH-004 | Password policy: min length, composition rules, reject list of common passwords |
| UNIT-AUTH-003 | T-AUTH-006 | Session expiry math: idle sliding (≤ 30 d), absolute (≤ 90 d) |
| UNIT-UP-001 | T-UPLOAD-014 | `prepareChapterUpload` validation table: 501 files, 110 MB file, 501 MB total, bad magic bytes, 0-byte file, disallowed extension → each typed code |
| UNIT-UP-002 | T-UPLOAD-003 | Path normalization: `..` entries, absolute, backslash, symlink flag → rejected codes |
| UNIT-SEARCH-001 | T-SEARCH-003 | Ranking weights: exact > prefix > contains > creator/tag; tie-breakers stable |
| UNIT-MANGA-001 | T-CATALOG-001 | Slug generation/uniqueness rules; alias normalization |
| UNIT-ERR-001 | T-FOUND-009 | Error contract: every code → {http, visible, logLevel, alert?} mapping is total |

## 3. Integration Test Plan (Vitest + Docker PG/MinIO)

| ID | Task | What |
|---|---|---|
| INT-AUTH-001 | T-AUTH-004/005/006 | Register → login (cookie set, flags correct) → protected call OK → logout → call 401; second login rotates token |
| INT-AUTH-002 | T-AUTH-009 | Reset flow: request → token single-use → expiry (clock control) → old token invalid |
| INT-AUTH-003 | T-AUTH-010 | Rate limits: 11th login/min/IP → 429 RATE_LIMIT_*; per-account limit |
| INT-AUTH-004 | T-AUTH-011 | Account deletion cascade: zero residual rows (progress/history/library/bookmarks/sessions/prefs/tokens) |
| INT-PROG-001 | T-READER-021/022 | Concurrency: 2 sessions × 50 interleaved progress writes → final = latest server stamp; no constraint violations |
| INT-PROG-002 | T-READER-015 | History: session boundary (5-min idle) creates new rows; deepest page tracked |
| INT-CAT-001 | T-CATALOG-002/010 | Cursor pagination stability with concurrent inserts; filters/sorts correct; soft-deleted excluded |
| INT-CHAP-001 | T-CATALOG-007 | Chapter order: number with decimals (10.5), tiebreak by reading_order, drafts excluded for non-admin |
| INT-LIB-001 | T-LIB-001…003 | Add/remove/list; last_read_at updates on progress write; unread count |
| INT-UP-001 | T-UPLOAD-002/003/004/005/006/007/014/015 | **The upload suite:** (a) valid 30-page ZIP → ready, variants exist in MinIO, metadata correct, chapter publishable; (b) every attack fixture (Zip Slip, symlink, bomb 500 MB, 501 files, 110 MB file, spoofed MIME, 9999×9999 px) → failed with typed code, **zero side effects** (no files outside staging); (c) job state transitions logged; (d) re-ingest replaces asset set, old keys GC-queued |
| INT-UP-002 | T-UPLOAD-008 | Multipart: 3 parts → assembled → pipeline runs |
| INT-ADMIN-001 | T-ADMIN-001…005 | CRUD + publish visibility: unpublished chapter 404 to reader, 200 to admin; soft-delete hides everywhere |
| INT-ADMIN-002 | T-ADMIN-007 | Audit: every admin mutation appends an event with before/after; audit table not updatable by app role |
| INT-SEARCH-001 | T-SEARCH-001 | Trigram search: prefix/contains/alias/creator/tag; 10k-title load fixture ≤ 400 ms p95 (NFR-PERF-005) |
| INT-MEDIA-001 | T-CATALOG-010 | Media delivery: variant content-type, immutable headers, 404 on unknown key, no storage error passthrough |
| INT-OBS-001 | T-OBS-001/004 | Trace contains HTTP→DB span for a catalog call; `/readyz` fails with PG down and with storage down |

## 4. E2E Test Plan (Playwright)

| ID | Task | Journey/What |
|---|---|---|
| E2E-CATALOG-001 | T-CATALOG-003 | J-1: land → catalog (cards render, LCP assert) → genre filter → sort → detail page (all FR-CATALOG-006 fields) → chapter list order |
| E2E-CATALOG-002 | T-CATALOG-003 | Pagination: page 1 → 2 → back; cursor stable with a concurrent admin insert (two contexts) |
| E2E-READER-001 | T-READER-001/004/005 | Vertical RTL: scroll through 20 pages of a seeded 30-page chapter; progress restored after reload (FR-READER-012) |
| E2E-READER-002 | T-READER-002/008 | Single-page LTR: next/prev via keyboard; swipe gesture (touch emulation) with cancel |
| E2E-READER-003 | T-READER-006/007 | Double-page LTR odd page → single fallback; RTL pairing order correct (visual + DOM order) |
| E2E-READER-004 | T-READER-011/012 | Zoom pinch (touch) + wheel+Ctrl (desktop) + reset; fullscreen enter/exit |
| E2E-READER-005 | T-READER-016/019/024 | Chapter end: completion state, next-chapter CTA navigates, auto-advance respects preference |
| E2E-READER-006 | T-READER-018 | Failed image: block one image via Playwright route → placeholder + retry → success on retry; rest of chapter usable |
| E2E-READER-007 | T-READER-027 | 500-page marathon (lab phone profile): scroll 500 pages, assert residency ≤ 12 (CDP), heap delta, no > 50 ms jank samples, INP ≤ 200 ms |
| E2E-READER-008 | T-READER-023 | Deep-link fuzz: `/manga/x/chapter/1?page=999`, `?page=-3`, `?page=abc` → clamped with notice, no crash |
| E2E-READER-017 | T-READER-028 | A11y: axe pass on reader mid-state; keyboard-only full journey; focus initial/trap/restore; reduced-motion media emulation |
| E2E-READER-019 | T-SEC-003 | IDOR: signed-in as A, request progress/library APIs with B's ids → 404/403 |
| E2E-READER-022 | T-CATALOG-010 | Asset key enumeration: 1000 random keys → all 404 |
| E2E-AUTH-001 | T-AUTH-003/012 | Register → login → protected → logout; forms: labels, error announcement (axe) |
| E2E-AUTH-004 | T-AUTH-013 | Cookie flags (HttpOnly/Secure/SameSite) asserted; cross-origin CSRF POST rejected |
| E2E-LIB-001 | T-LIB-003/005/008 | J-2/J-4: continue-reading list → reader restores; history list; bookmarks add/jump/remove |
| E2E-ADMIN-001 | T-ADMIN-001…005 | J-4: curator loop end-to-end (create manga → chapter → upload 30-page ZIP → ready → publish → read) |
| E2E-ADMIN-002 | T-SEC-003 | J-5 + IDOR: reader calling admin endpoints → 403/404; failed upload shows typed reason |
| E2E-SEARCH-001 | T-SEARCH-004 | J-1 search: debounce, results, empty state, keyboard flow |
| E2E-OBS-001 | T-OBS-004/007 | Readiness: stop PG (sidecar test) → `/readyz` 503, app surfaces maintenance state; beacon endpoint accepts valid batch, rejects junk |

## 5. Non-Functional Gates (automated)

- **a11y:** axe-core on every E2E route — zero violations (any severity).
- **perf:** bundle budget (≤ 250 KB reader JS) in CI; 500-page matrix at VS-4; load smoke at VS-11.
- **security:** authorization matrix (INT + E2E-ADMIN-002/E2E-READER-019); upload attack suite (INT-UP-001); gitleaks + npm audit in CI.
- **a11y manual:** keyboard + screen-reader passes per slice exit (ACCESSIBILITY.md §7) — recorded in the slice exit report (ROADMAP).

## 6. Test Data

- **E2E/integration:** seed harness (T-FOUND-012) creates deterministic collections (e.g., a 30-page test manga, a 500-page test manga with generated grayscale pages, 10k-title fixture for search load). Generated images are synthetic (gradient pages) — this is test data, not product content (allowed: tests may use fixtures; the *app* never does).
- **Unit:** inline literals only.
- **Cleanup:** integration tests run on throwaway compose services per CI job; E2E seeds into a dedicated test DB/bucket.
