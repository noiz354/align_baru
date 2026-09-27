# TASKS.md — Implementation Work Plan

Date: 2026-09-26 · Audit 2026-09-27: **VS-0 T-FOUND-001…012 has implementation, but scratch-Postgres integration and E2E have not been verified here; VS-1…VS-11 remain pending.** The previous “every task NOT implemented” statement is stale. Execute in ROADMAP.md vertical-slice order; a task closes only after its DoD is verified, not merely because foundation code exists.

Conventions:
- Fields per task: Requirements / Goal / Depends on / Expected modules / Inputs / Expected behavior / Edge cases / Security / Testing / Manual QA / Definition of Done (→ AGENTS.md).
- A task may only be closed when its DoD holds (AGENTS.md §3), including tests named in TEST_STRATEGY.md.
- Requirement IDs → PRD.md; task ↔ requirement coverage audited in docs/architecture/final-review.md §Traceability.
- **Skills per task family:** see SKILLS.md §3. Load the family's skills before implementing; a task with no matching family uses the always-on pair.

---

# EPIC-01 — Foundation (VS-0)

## T-FOUND-001 — Project bootstrap & toolchain
- Requirements: NFR-OPS-001/002, NFR-SEC-013
- Goal: Make the skeleton buildable: package.json scripts, TypeScript 6.0 strict config (incl. `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), ESLint + boundary rules (features↛server, drizzle only in server/db, S3 SDK only in server/storage, OTel SDK only in server/telemetry), Prettier, Vitest 4.1 + Playwright 1.62 configs, `.nvmrc` (24), `engines`.
- Depends on: (none)
- Expected modules: repo root configs
- Inputs: research doc version registry
- Expected behavior: 1. `npm ci` clean from lockfile. 2. `typecheck`/`lint`/`test:unit` run and pass on the skeleton (todo tests are skipped-green). 3. Boundary lint fails on a deliberately wrong import (self-test).
- Edge cases: ESM vs CJS in Vitest/Playwright configs; Turbopack TS config quirks (verify with `next build` on skeleton).
- Security: lockfile committed; `npm audit` baseline recorded.
- Testing: self-test for boundary lint (INT level, CI).
- Manual QA: fresh clone → `npm ci && npm run typecheck && npm run lint && npm run test:unit` all green.
- DoD: AGENTS.md.

## T-FOUND-002 — Typed environment configuration
- Requirements: NFR-OPS-002, NFR-SEC-009
- Goal: Implement the env contract (skeleton exists: `src/shared/validation/env.ts`): Zod schema for every variable in DEPLOYMENT.md §3, redacted failure output, single `loadEnv()` used at boot.
- Depends on: T-FOUND-001
- Expected modules: shared/validation, server/composition
- Inputs: DEPLOYMENT.md §3 inventory
- Expected behavior: 1. Missing/invalid var → process refuses to start with a redacted message naming the variable (not its value). 2. Per-environment defaults only for non-secret items. 3. `APP_ORIGIN` parsed and frozen.
- Edge cases: empty vs unset; non-HTTPS origin in dev allowed, in prod rejected; extra unknown vars warned (not fatal).
- Security: no env values in logs/errors (redaction function, NFR-OBS-006).
- Testing: UNIT-ENV-* (per-variable table; redaction asserted on captured output).
- Manual QA: boot dev compose with one var removed → redacted, named failure.
- DoD: AGENTS.md.

## T-FOUND-003 — Route map & layout shells
- Requirements: FR-CATALOG-006 (route exists), FR-AUTH-002 (route exists), NFR-A11Y-004
- Goal: Materialize the full planned route map (skeletons exist in `src/app`): layouts (root, admin), not-found + error boundaries (a11y-compliant shells), metadata contract per route, and the route→feature mapping from API_CONTRACT.md §5 as comments.
- Depends on: T-FOUND-001
- Expected modules: src/app
- Inputs: README route skeleton section, API_CONTRACT.md §5
- Expected behavior: 1. All planned routes resolve (skeleton shell renders). 2. not-found/error are semantic, focusable, labeled (NFR-A11Y-003/004). 3. No feature code — shells only.
- Edge cases: `/manga/x/chapter/1?page=abc` must not crash layout (param validation happens in pages/tasks later).
- Security: error boundary leaks nothing (no stack in UI).
- Testing: E2E smoke: every route in the map returns a render (200/404 as planned).
- Manual QA: click through the nav skeleton in browser.
- DoD: AGENTS.md.

## T-FOUND-004 — Shared UI foundation
- Requirements: NFR-A11Y-006/007/008/010
- Goal: Theme tokens (light/dark, contrast ≥ 4.5:1), AppShell (landmarks, skip-link), and the primitive inventory list in `src/shared/ui` (button, link, form-field, dialog, list) as documented skeletons + token CI contrast check.
- Depends on: T-FOUND-001
- Expected modules: shared/ui
- Inputs: ACCESSIBILITY.md §2/§3.3
- Expected behavior: 1. Tokens are the only place colors are defined. 2. AppShell provides landmarks + skip link. 3. Contrasts verified by CI script.
- Edge cases: forced-colors mode (Windows) — tokens degrade sanely (verify manually at VS-9).
- Security: —.
- Testing: token contrast script (CI unit).
- Manual QA: both themes render in browser; screen-reader landmark test.
- DoD: AGENTS.md.

## T-FOUND-005 — Database connection & schema registry
- Requirements: NFR-DATA-001/006, NFR-SEC-015
- Goal: Drizzle 0.45 + `postgres` driver wired behind `server/db` (skeleton exists: `schema.ts`, `index.ts`): connection lifecycle, driver decision documented (postgres 3.4 vs pg — choose `postgres`), schema DDL implemented to match DATA_MODEL.md exactly (tables, FKs, CHECKs, indexes incl. partial + GIN trigram).
- Depends on: T-FOUND-001
- Expected modules: server/db
- Inputs: DATA_MODEL.md (authoritative)
- Expected behavior: 1. Connection pool (max 10) with clean shutdown. 2. Schema matches DATA_MODEL §1–19 1:1 (typecheck + diff review). 3. `pg_trgm` extension enabled in migrations.
- Edge cases: `numeric(8,2)` chapter numbers (10.5); citext availability; uuid v7 generation.
- Security: app DB role has no DDL (T-SEC-005 finalizes); parameterization by construction.
- Testing: INT-DB-001: schema assertions (table/index existence) against fresh PG.
- Manual QA: `drizzle-kit studio` shows the model.
- DoD: AGENTS.md.

## T-FOUND-006 — Initial migration
- Requirements: NFR-DATA-001, NFR-OPS-004
- Goal: First migration file(s) from the T-FOUND-005 schema via drizzle-kit; migration runner in the app boot sequence (DEPLOYMENT.md §4); expand/contract discipline documented in CONTRIBUTING.
- Depends on: T-FOUND-005
- Expected modules: drizzle/ (migrations dir), server/db
- Inputs: T-FOUND-005 schema
- Expected behavior: 1. Clean migrate on fresh DB. 2. Migrate is idempotent per revision. 3. Boot applies pending migrations before serving.
- Edge cases: concurrent boots (migrations take advisory lock).
- Security: migration files reviewed as code (NFR-SEC-013).
- Testing: INT: fresh-DB migrate + re-run (no-op).
- Manual QA: compose up from scratch boots and serves `/healthz`.
- DoD: AGENTS.md.

## T-FOUND-007 — Liveness endpoint
- Requirements: NFR-OBS-004
- Goal: `GET /healthz` (200 `{ok:true}`, no dependencies, no cache).
- Depends on: T-FOUND-003
- Expected modules: src/app (healthz route), server/telemetry (later)
- Inputs: OBSERVABILITY.md §6
- Expected behavior: constant < 10 ms; unauthenticated; works when DB is down (liveness ≠ readiness).
- Edge cases: —.
- Security: no info disclosure.
- Testing: unit (route) + INT with PG down (still 200).
- Manual QA: curl.
- DoD: AGENTS.md.

## T-FOUND-008 — Structured logging foundation
- Requirements: NFR-OBS-001/006
- Goal: pino root logger with the OBSERVABILITY.md §3 field contract, redaction function (emails, secret patterns, long paths), request-id injection, level config per env.
- Depends on: T-FOUND-002
- Expected modules: server/telemetry
- Inputs: OBSERVABILITY.md §3
- Expected behavior: 1. JSON to stdout. 2. Redaction unit-verified. 3. Child loggers per request carry requestId (+traceId later, T-OBS-001).
- Edge cases: non-serializable values; circular refs (safe stringify).
- Security: PII/secret redaction is the contract (NFR-OBS-006, T-13/T-14).
- Testing: UNIT-OBS-001 (redaction table) + log capture on a request (INT, T-OBS-003 completes).
- Manual QA: inspect JSON lines in dev.
- DoD: AGENTS.md.

## T-FOUND-009 — Error contract foundation
- Requirements: API_CONTRACT.md §6, NFR-SEC-010
- Goal: Implement `AppError` + the full code table (skeleton exists: `shared/contracts/errors.ts`): code → {http, visible message, logLevel, alert?} mapping as data (single source), mapping helper for route handlers, and the CI completeness check.
- Depends on: T-FOUND-001
- Expected modules: shared/contracts, (later) app route wrapper
- Inputs: API_CONTRACT.md §6
- Expected behavior: 1. Every code in the table is expressible and maps total. 2. Unknown codes are a compile-time error (exhaustive switch). 3. 5xx bodies never carry internals.
- Edge cases: codes with per-field details (VALIDATION_*).
- Security: message strings are user-visible-safe by construction (T-13).
- Testing: UNIT-ERR-001 (totality + mapping assertions).
- Manual QA: —.
- DoD: AGENTS.md.

## T-FOUND-010 — Local dev environment (compose)
- Requirements: NFR-OPS-001, ADR-005 R3, ADR-009
- Goal: `docker-compose.dev.yml`: app (dev), postgres:18.6 (pinned), minio + bucket init; Dockerfile (multi-stage skeleton → working for dev); verify sharp + argon2 native builds on the exact base image.
- Depends on: T-FOUND-001, T-FOUND-005
- Expected modules: docker/ (compose + Dockerfile), scripts
- Inputs: DEPLOYMENT.md §2/§8
- Expected behavior: 1. `docker compose up` from clone → app boots against PG + MinIO. 2. Native modules load in the image (smoke: sharp round-trip, argon2 hash) — recorded in CI. 3. Volumes: db, minio.
- Edge cases: port collisions (5432/9000/3000) documented; non-Linux docker (file watching).
- Security: dev creds are dev-only, in compose (documented: not for prod).
- Testing: CI job: build image + run smoke (INT-DB-001 environment proof).
- Manual QA: compose up → /healthz 200.
- DoD: AGENTS.md.

## T-FOUND-011 — CI pipeline
- Requirements: NFR-SEC-013, NFR-A11Y-001 (axe gate), CONTRIBUTING §4
- Goal: GitHub Actions: PR → typecheck, lint (boundary rules), unit, build; on main + tags → integration (compose PG/MinIO), E2E (compose app + seed), gitleaks, `npm audit --audit-level=high`, bundle budget (T-PERF-003 hook), a11y axe gate in E2E.
- Depends on: T-FOUND-001
- Expected modules: .github/workflows
- Inputs: CONTRIBUTING.md §4, TEST_STRATEGY.md §5
- Expected behavior: 1. All gates green on a clean PR. 2. A boundary violation / high vuln / bundle overflow fails CI. 3. Caching: npm + docker layers.
- Edge cases: Playwright browser cache on runners; compose ports in CI (ephemeral).
- Security: no secrets in logs; audit level documented.
- Testing: pipeline self-test (bad import PR fails).
- Manual QA: run pipeline on skeleton.
- DoD: AGENTS.md.

## T-FOUND-012 — Dev seed harness
- Requirements: TEST_STRATEGY.md §6 (only sanctioned fixture path)
- Goal: `scripts/seed.mjs` (tsx): creates deterministic dev/test data through the same repositories the app will use: N manga (with genres/creators/tags/aliases), chapters, **synthetic gradient pages** (30-page and 500-page test manga; 10k-title fixture optional flag), one admin user, one reader user. Explicit `--env dev|test` guard (refuses prod).
- Depends on: T-FOUND-005, T-UPLOAD-004 (page asset shape) — runs fully only after media pipeline exists; before that, seeds DB rows with placeholder asset keys and is re-run after (documented two-phase use)
- Expected modules: scripts/, server/db (reused), features (reused ports)
- Inputs: TEST_STRATEGY.md §6
- Expected behavior: 1. Idempotent (re-run safe, key-prefixed per run in test). 2. Synthetic images generated in-memory (no product content — TEST_STRATEGY rule). 3. Deterministic titles ("Seed Manga 0001"…).
- Edge cases: 500-page seed time budget (< 60 s with sharp, else chunked).
- Security: seeded passwords from env (dev), never in repo; refuse if `NODE_ENV=production`.
- Testing: unit: idempotency + guards; INT: seed → assert counts.
- Manual QA: dev: seed → catalog shows seeded titles.
- DoD: AGENTS.md.

---

# EPIC-02 — Catalog (VS-1)

## T-CATALOG-001 — Manga & chapter domain repositories
- Requirements: FR-CATALOG-001/005/006, FR-CHAPTER-001/004, NFR-DATA-001
- Goal: Implement ports (skeletons: `features/manga`, `features/chapters`): MangaRepository (bySlug, list with filter/sort/cursor, create/update/softDelete/restore, count), ChapterRepository (listByManga ordered, byId, create/update/softDelete, pageCount). server/db implementations against T-FOUND-005 schema.
- Depends on: T-FOUND-005/006
- Expected modules: features/manga, features/chapters, server/db/repositories
- Inputs: DATA_MODEL.md §3/§9, partial index list
- Expected behavior: 1. Catalog list uses `ix_manga_visible`; sorts are indexed. 2. Chapter order deterministic (`reading_order`). 3. Soft-deleted excluded by default, included for admin flag.
- Edge cases: cursor stability with concurrent inserts (keyset pagination); manga with 0 chapters.
- Security: parameterized only (NFR-SEC-015); no raw SQL except EXPLAIN-safe templates.
- Testing: INT-CAT-001, INT-CHAP-001.
- Manual QA: — (repo level).
- DoD: AGENTS.md.

## T-CATALOG-002 — Catalog list API + service
- Requirements: FR-CATALOG-001…004, NFR-PERF-004, NFR-SEC-015
- Goal: `GET /api/v1/catalog` per API_CONTRACT §2.1: catalog service (filter/sort/cursor composition, genre existence check), Zod query schema, route handler wiring.
- Depends on: T-CATALOG-001, T-FOUND-009
- Expected modules: features/catalog, src/app/api/v1/catalog
- Inputs: API_CONTRACT.md §2.1
- Expected behavior: 1. All 4 sorts + 2 filters per contract. 2. `latestChapter` computed in one query (latest published chapter join) — no N+1. 3. Cache headers per contract.
- Edge cases: 0 results (empty items, null cursor); combined filters yielding 0; unknown genre slug ignored (not error).
- Security: sort/status whitelists (T-02); no SQL in query params beyond bound values.
- Testing: INT-CAT-001 (behavior), UNIT-MANGA-001 (slug/alias rules used in seed), injection payload fuzz (T-SEARCH-005 reuses harness here).
- Manual QA: dev catalog with seed data.
- DoD: AGENTS.md.

## T-CATALOG-003 — Catalog page (SSR)
- Requirements: FR-CATALOG-001…005, NFR-PERF-001/007/008, NFR-A11Y-004
- Goal: `/discover` (+ `/` redirect/alias): Server Component grid of MangaCards (cover, title, status, latest chapter label), filter/sort controls, cursor "load more"/pagination; a11y structure; request budget ≤ 30.
- Depends on: T-CATALOG-002, T-FOUND-004
- Expected modules: src/app/discover, shared/ui
- Inputs: ACCESSIBILITY.md §2, PERFORMANCE.md §2
- Expected behavior: 1. First paint is SSR content (LCP = cover image of first card). 2. Controls keyboard-operable, labeled. 3. Card accessible name per contract.
- Edge cases: empty catalog (empty state with action, J-4 guidance for first admin); cover missing (placeholder, no layout shift, NFR-PERF-003).
- Security: no user data here (public).
- Testing: E2E-CATALOG-001 (journey), E2E-CATALOG-002 (pagination), a11y axe, request-count assertion.
- Manual QA: desktop + mobile viewports; keyboard.
- DoD: AGENTS.md.

## T-CATALOG-004 — Genre filter UI
- Requirements: FR-CATALOG-002, NFR-A11Y-002
- Goal: Multi-select genre filter (chips/checkbox list) on discover; genre vocabulary fetched from admin-managed list (public read API `GET /api/v1/catalog/facets` — small addition, same contract file).
- Depends on: T-CATALOG-003
- Expected modules: src/app/discover, features/catalog
- Inputs: API_CONTRACT §2.1 (facets op)
- Expected behavior: 1. URL-driven (shareable filter state, `?genre=action,drama`). 2. Keyboard: space/enter toggles, Esc clears. 3. Facets show counts? NO (out of scope — counts are a P2, not in PRD).
- Edge cases: selecting then deselecting restores URL cleanly; > 20 genres scrollable.
- Security: —.
- Testing: E2E-CATALOG-001 (filter step), axe.
- Manual QA: filter combos.
- DoD: AGENTS.md.

## T-CATALOG-005 — Status filter & sorts UI
- Requirements: FR-CATALOG-003/004
- Goal: Status select + sort select on discover (URL-driven).
- Depends on: T-CATALOG-003
- Expected modules: src/app/discover
- Inputs: API_CONTRACT §2.1
- Expected behavior: 1. Sorts per contract (title_asc, updated_desc, added_desc). 2. Labeled controls, announced changes (aria-live polite on result count).
- Edge cases: sort change resets cursor to page 1 (documented UX rule).
- Security: —.
- Testing: E2E-CATALOG-001 (sort step).
- Manual QA: —.
- DoD: AGENTS.md.

## T-CATALOG-006 — Manga detail page
- Requirements: FR-CATALOG-006/008, FR-CHAPTER-002
- Goal: `/manga/[slug]`: all detail fields, genre/tag/creator lists, synopsis (plain text — NFR-SEC-016), latest/first chapter links, chapter count, (authenticated) continue-reading entry; "Read" primary action → chapter 1 or resume.
- Depends on: T-CATALOG-002, T-FOUND-004
- Expected modules: src/app/manga/[slug], features/catalog
- Inputs: PRD §6.2, ACCESSIBILITY.md §4
- Expected behavior: 1. All fields present per FR-CATALOG-006. 2. Unpublished/deleted → 404 page (not a blank). 3. Continue-reading only when progress exists (FR-CATALOG-008).
- Edge cases: synopsis empty (hide section); aliases many (list, no overflow); single-chapter manga ("first=latest").
- Security: synopsis rendered as text only (T-01).
- Testing: E2E-CATALOG-001 (detail step), INT-CAT (404 cases).
- Manual QA: detail page on 3 viewports.
- DoD: AGENTS.md.

## T-CATALOG-007 — Chapter list API
- Requirements: FR-CATALOG-007, FR-CHAPTER-004
- Goal: `GET /api/v1/manga/{slug}/chapters` per contract (incl. admin drafts flag, 1000-cap 409).
- Depends on: T-CATALOG-001, T-FOUND-009
- Expected modules: features/catalog, src/app/api/v1
- Inputs: API_CONTRACT §2.1
- Expected behavior: 1. Ordered by `reading_order` (number displayed). 2. Drafts only for admin (flag). 3. Cap → 409 + ops alert.
- Edge cases: 0 chapters (empty list — detail page handles); 1000+ (409 path tested).
- Security: draft leakage test (non-admin never sees drafts — INT-CHAP-001).
- Testing: INT-CHAP-001.
- Manual QA: —.
- DoD: AGENTS.md.

## T-CATALOG-008 — Chapter list UI
- Requirements: FR-CATALOG-007, FR-READER-022 (context), NFR-A11Y-004
- Goal: Chapter list on detail page: ol of chapter links (number, title?, page count, date), read/unread indicator for authenticated users (icon + count, not color-only — ACCESSIBILITY.md §3.3).
- Depends on: T-CATALOG-007, T-LIB-006 (read status — VS-5; before VS-5 the indicator is absent, documented two-phase)
- Expected modules: src/app/manga/[slug]
- Inputs: ACCESSIBILITY.md §2/§3.3
- Expected behavior: 1. Real list semantics. 2. "Continue" badge on resume chapter (when present). 3. Long lists (200+): render all (no virtualization in v1; 1000 cap makes it fine) — verify no jank.
- Edge cases: draft chapters for admin (labeled "Draft").
- Security: —.
- Testing: E2E-CATALOG-001 (list step), axe.
- Manual QA: keyboard through 200-item list.
- DoD: AGENTS.md.

## T-CATALOG-009 — Continue-reading resolution
- Requirements: FR-CATALOG-008, FR-LIBRARY-005, FR-READER-012
- Goal: Resume resolution service: given user + manga → last-read chapter (by progress.updated_at) + page/scroll; used by detail page + home "continue reading" list (home list implemented with T-LIB-004, this task provides the service).
- Depends on: T-CATALOG-001, T-READER-022 (get progress)
- Expected modules: features/progress (service), features/catalog
- Inputs: DATA_MODEL §12, reader-behavior.md §12
- Expected behavior: 1. Returns deepest *started* position (not completed-only). 2. Completed manga → next unread chapter (if any) else null. 3. Anonymous → null (no error).
- Edge cases: progress on a deleted chapter (skip to previous valid); all chapters complete (null → detail shows "read" state).
- Security: session user only (IDOR-impossible).
- Testing: UNIT-PROG-003 sibling tests (resume logic), INT-PROG-001 reuse.
- Manual QA: read 2 chapters → detail shows correct resume.
- DoD: AGENTS.md.

## T-CATALOG-010 — Cover asset delivery
- Requirements: FR-CATALOG-005, FR-MEDIA-001, NFR-PERF-013
- Goal: Cover variant generation (WebP + JPEG, max 1200 px, from admin upload or auto — T-UPLOAD-011) + `/media/{assetKey}` route for covers/pages (streaming, content-type by stored format, immutable headers, 404 contract, no storage passthrough).
- Depends on: T-UPLOAD-006 (storage writes), T-FOUND-005
- Expected modules: server/media, src/app/media/[assetKey]
- Inputs: ADR-004/005, SECURITY.md §7, API_CONTRACT §2.1 media
- Expected behavior: 1. Stream (no full buffering). 2. ETag + immutable per contract. 3. Draft key → 404 for non-admin. 4. Unknown key → 404 (cheap).
- Edge cases: storage 502 → `STORAGE_ERROR` mapping, retry-friendly headers; very first key (cold cache).
- Security: THREAT T-11 verification (enumeration fuzz); NFR-SEC-010 (no paths in errors).
- Testing: INT-MEDIA-001, E2E-READER-022 (fuzz).
- Manual QA: view a page image; inspect headers.
- DoD: AGENTS.md.

## T-CATALOG-011 — Manga detail API
- Requirements: FR-CATALOG-006, FR-CATALOG-008, NFR-SEC-015, NFR-PERF-004
- Goal: `GET /api/v1/manga/{slug}` per contract, returning `MangaDetail` (summary fields + `aliases`, `creators`, `genres`, `tags`, `synopsis`, `readingDirection`, `chapterCount`, `firstChapter`, `latestChapter`). The detail page (T-CATALOG-006) is its caller.
- Depends on: T-CATALOG-001 (the `bySlug` detail read), T-CATALOG-002 (list API conventions)
- Expected modules: features/catalog, src/app/api/v1
- Inputs: API_CONTRACT §2.1 (`GET /api/v1/manga/{slug}` row), §1
- Expected behavior: 1. One `MangaRepository.bySlug` call — the same read the chapter-list endpoint uses, which is also the visibility gate. 2. Unknown, unpublished or soft-deleted slug → `MANGA_NOT_FOUND` 404; the three are deliberately indistinguishable (no existence leak, API_CONTRACT §1). 3. 200 with the contract's cache headers and `x-request-id`. 4. Slug bounded to ≤ 190 chars at the edge; no character-set rule (a non-latin slug is legitimate).
- Edge cases: manga with zero chapters (`firstChapter`/`latestChapter` null, `chapterCount` 0 — still 200); slug in range that matches nothing (404, not an error page); a slug that is exactly 190 chars (200-or-404, never 422).
- Security: identity comes from the verified session only, never the path or query (THREAT T-04); `synopsis` stays a plain-text string end to end (NFR-SEC-016, T-01) — the page renders it as a text node, never markup.
- Testing: INT-CAT-002 (200 shape, 404 for the three invisibility cases, 422 for an over-long slug), UNIT-CAT-008 (service: one read, number coercion, `null` passthrough).
- Manual QA: open a seeded detail page with the API reachable; confirm the page stops rendering its "unavailable" state.
- DoD: AGENTS.md.

---

# EPIC-03 — Reader (VS-2 minimal reader; VS-3 navigation; VS-4 performance)

## T-READER-001 — Reader route shell & layout
- Requirements: FR-READER-001…011 (route exists), NFR-A11Y-003/004
- Goal: `/manga/[slug]/chapter/[chapter]` route shell: SSR first page + metadata (chapter title, direction, page count) so the first image paints pre-hydration; client reader mounts into a reserved container (no CLS); loading/404/unavailable states per contract.
- Depends on: T-CATALOG-007, T-FOUND-003, T-FOUND-004
- Expected modules: src/app/manga/[slug]/chapter/[chapter]
- Inputs: ADR-007, reader-behavior.md §1–2
- Expected behavior: 1. SSR shell contains: first page `<img>` (correct format per `<picture>`), chapter heading, reader chrome placeholder. 2. `?page=N` deep link validated at SSR (clamp, FR-READER-023) — invalid → clamped + notice. 3. Unpublished/deleted chapter → 404; failed/draft-with-pages → "unavailable" state (409 mapping, EC-RDR-08).
- Edge cases: page=999 on 50-page chapter (clamp to 50); page=0/-3 (clamp to 1); non-numeric (clamp + notice); 500-page chapter (SSR still one page, rest client).
- Security: IDOR-impossible (public content); no storage paths in shell.
- Testing: E2E-READER-008 (deep link fuzz), E2E-READER-001 (open).
- Manual QA: open a seeded chapter on desktop + phone.
- DoD: AGENTS.md.

## T-READER-002 — Chapter page metadata API
- Requirements: FR-CHAPTER-003, FR-READER-019/020, NFR-PERF-004/008
- Goal: `GET /api/v1/chapters/{chapterId}/pages` per API_CONTRACT §2.1: ordered PageAsset list with variant URLs + dimensions, single query (PK range), 250 ms budget.
- Depends on: T-CATALOG-001, T-FOUND-009
- Expected modules: features/chapters (service), src/app/api/v1
- Inputs: API_CONTRACT §2.1, DATA_MODEL §10
- Expected behavior: 1. One query, ordered, no N+1. 2. Public only when published (else 404); admin sees drafts. 3. Response shape stable for 500 pages (~60 KB).
- Edge cases: 0-page chapter (draft) → CHAPTER_NOT_READY 409; chapter with gaps (shouldn't exist — service invariant check → 500 + alert if found, data bug).
- Security: public read by design (THREAT T-11 context); no keys outside URL fields.
- Testing: INT-CHAP-001 extension (page list), 500-page size/latency assertion.
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-003 — ReaderState store & reducer invariants
- Requirements: FR-READER-001…005/023, NFR-PERF-010/011, ADR-007
- Goal: The single client `ReaderState` + reducer (skeleton: `features/reader/reader-state.ts`): all transitions (page, mode, direction, zoom, fullscreen, window) go through it; invariants enforced centrally (index clamped 1..M; window ⊆ [1..M]; residency ≤ 12).
- Depends on: T-READER-032 (validation), T-READER-031 (window)
- Expected modules: features/reader
- Inputs: reader-behavior.md §10–11 (state + transitions), ADR-007
- Expected behavior: 1. Every transition preserves invariants (property-based unit tests). 2. Unknown actions no-op. 3. State is serializable (debug/restore). 4. No I/O inside the reducer (pure).
- Edge cases: transition on 1-page chapter; mode switch at page M; direction switch with zoomed state (zoom preserved — documented).
- Security: —.
- Testing: UNIT-READER-001 (reducer property tests, incl. fuzz).
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-004 — Vertical scroll mode
- Requirements: FR-READER-001, NFR-PERF-002/003, NFR-A11Y-007
- Goal: Vertical continuous scroll: pages stacked, scroll-driven position, smooth (reduced-motion aware), position = (page, scrollPosition 0..1) — the unit stored for progress.
- Depends on: T-READER-003, T-READER-002
- Expected modules: features/reader (mode impl), src/app reader client
- Inputs: reader-behavior.md §3
- Expected behavior: 1. Scroll position maps bijectively to (page, offset). 2. No layout shift (reserved slots, NFR-PERF-003). 3. Reduced motion: instant scroll. 4. RTL: page order top→bottom is *reversed* (last page on top) per FR-READER-004 — specified in reader-behavior.md §4 (implementation detail: reverse DOM order).
- Edge cases: sub-pixel offsets; scroll snap vs free (free scroll + soft snap, documented); very tall DOM (500 pages → DOM nodes only inside window, T-READER-019).
- Security: —.
- Testing: E2E-READER-001 (scroll + reload restore), UNIT-READER-001 (mapping).
- Manual QA: scroll a 50-page chapter; check jank feel.
- DoD: AGENTS.md.

## T-READER-005 — Single-page (paged) mode
- Requirements: FR-READER-002, FR-READER-022
- Goal: One page per view; explicit prev/next; page transitions; position = page index only.
- Depends on: T-READER-003, T-READER-002
- Expected modules: features/reader
- Inputs: reader-behavior.md §5
- Expected behavior: 1. Next/prev never out of range (T-READER-032). 2. Page indicator updates (aria-live, NFR-A11Y-009). 3. Double-tap/keys per map.
- Edge cases: 1-page chapter (no nav; completion on view); transition cancel semantics (T-READER-010).
- Security: —.
- Testing: E2E-READER-002, UNIT-READER-002/003.
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-006 — Double-page mode & pairing
- Requirements: FR-READER-003, FR-READER-004/005
- Goal: Spread view: LTR pairs (1,2),(3,4)…; RTL pairs (M,M−1),(M−2,M−3)…; odd-page fallback to single spread; pairing is a pure function (skeleton `features/reader/page-index.ts` area) — unit-first.
- Depends on: T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §6, UNIT-READER-006/007 spec
- Expected behavior: 1. Pairing correct both directions (property tests: inverse of forward = identity). 2. Position state remains *logical page*; spreads derived. 3. Small screens: degrade to single (FR-READER-011 rule: < 640 px portrait).
- Edge cases: odd total (last spread single); 2-page chapter (one spread); 1-page (single only).
- Security: —.
- Testing: UNIT-READER-006/007 (pairing), E2E-READER-003.
- Manual QA: LTR + RTL 31-page test manga, last spread.
- DoD: AGENTS.md.

## T-READER-007 — RTL / LTR direction support
- Requirements: FR-READER-004/005, FR-READER-007/008 (direction-aware)
- Goal: Direction as a first-class state: navigation semantics (which way is "next"), DOM order, tap-zone mapping, swipe direction all derive from it; user override (directionOverride, FR-READER-021) applied over manga default.
- Depends on: T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §4/§7
- Expected behavior: 1. Single source of truth (`readingDirection`) — no per-feature direction checks. 2. Override persisted (T-READER-018) and applied per-session. 3. `dir` attribute set on reader container (a11y + i18n correctness).
- Edge cases: override conflict with manga direction (override wins, indicator shows effective direction); mode switch preserves direction.
- Security: —.
- Testing: UNIT-READER-001 (direction transitions), E2E-READER-003 (RTL order).
- Manual QA: read RTL chapter end-to-end; confirm "next" always advances reading order.
- DoD: AGENTS.md.

## T-READER-008 — Keyboard navigation
- Requirements: FR-READER-006, NFR-A11Y-002/006
- Goal: Full keyboard map (ACCESSIBILITY.md §3.1) per mode; reader container focusable + initial focus; keys work with modifier edges (e.g., Space doesn't scroll the page behind in paged mode — preventDefault).
- Depends on: T-READER-003, T-FOUND-004
- Expected modules: features/reader
- Inputs: ACCESSIBILITY.md §3.1
- Expected behavior: 1. Every key in the map works in both directions and all modes (matrix test). 2. No key conflicts with browser zoom shortcuts (Ctrl+0/+/− respected). 3. Focus visible (NFR-A11Y-006).
- Edge cases: focus loss (browser tab switch) → refocus on visible; keys ignored while typing in a dialog (bookmark note).
- Security: —.
- Testing: E2E-READER-017 (keyboard journey), UNIT (key→action mapping table).
- Manual QA: keyboard-only full chapter on desktop.
- DoD: AGENTS.md.

## T-READER-009 — Tap/click zone navigation
- Requirements: FR-READER-007, NFR-A11Y-010
- Goal: Direction-aware thirds: left/center/right (LTR: prev/menu/next; RTL mirrored); center = toggle chrome (or scroll nudge in vertical); zones have keyboard-equivalent buttons (they exist — zones are enhancement, NFR-A11Y-002).
- Depends on: T-READER-003, T-READER-007
- Expected modules: features/reader
- Inputs: reader-behavior.md §7
- Expected behavior: 1. Zone map derives from direction + mode (single table, unit-tested). 2. Multi-touch (pinch) does not trigger zones. 3. Long-press ≠ tap (300 ms threshold, documented).
- Edge cases: tap during swipe (ignored); tap on chrome (chrome wins, zones disabled); double-tap = zoom (T-READER-011) not nav.
- Security: —.
- Testing: E2E-READER-002 (tap nav), UNIT (zone map table).
- Manual QA: touch emulation + real device spot check.
- DoD: AGENTS.md.

## T-READER-010 — Touch swipe navigation
- Requirements: FR-READER-008, NFR-PERF-002
- Goal: Swipe gestures in paged modes (and double-page): threshold-based commit, cancel on release mid-gesture, direction-aware (LTR: left-swipe = next; RTL: right-swipe = next), velocity not required for v1 (documented).
- Depends on: T-READER-003, T-READER-007
- Expected modules: features/reader
- Inputs: reader-behavior.md §7
- Expected behavior: 1. Commit ≥ 25% of page width or strong velocity; else cancel (no move). 2. Vertical drags don't navigate (scroll in vertical mode unaffected). 3. INP contribution ≤ budget (passive listeners where possible).
- Edge cases: swipe at first/last page (rubber feedback, no error state); rapid consecutive swipes (queue max 1 — documented); two-finger pan (no nav).
- Security: —.
- Testing: E2E-READER-002 (swipe + cancel), UNIT (threshold logic pure).
- Manual QA: real device.
- DoD: AGENTS.md.

## T-READER-011 — Zoom
- Requirements: FR-READER-009, NFR-A11Y-002
- Goal: Zoom 100–400%: pinch (touch), Ctrl+wheel (desktop), double-tap toggle (100↔200), `+/−/0` keys, reset; zoom is a transform on the page container (no re-layout of DOM order); zoom state in ReaderState.
- Depends on: T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §8
- Expected behavior: 1. Bounds enforced (1.0–4.0), steps 10% (keys) / continuous (pinch). 2. Panning within a zoomed page (two-finger / drag with zoom > 1). 3. Zoom reset via `0`, double-tap, or chrome button.
- Edge cases: zoom at chapter edge (pan clamps); zoom + mode switch (reset to 100% — documented); zoom in vertical mode (scroll + zoom interplay specified: zoom applies to full column, pan horizontal).
- Security: —.
- Testing: E2E-READER-004, UNIT-READER-009 (bounds).
- Manual QA: all 3 input methods, both viewports.
- DoD: AGENTS.md.

## T-READER-012 — Fullscreen
- Requirements: FR-READER-010
- Goal: Fullscreen API toggle (`F` key + chrome button); graceful degradation when unsupported (hide control, documented); Esc exits; exit restores prior chrome/zoom.
- Depends on: T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §8
- Expected behavior: 1. Request on reader container (not window) → chrome stays inside. 2. State synced with `fullscreenchange` (user Esc handled). 3. iOS Safari (no API) → pseudo-fullscreen (CSS) — documented equivalent.
- Edge cases: browser permission denied (fallback + notice); orientation change in fullscreen (reflow, no state loss).
- Security: Permissions-Policy doesn't block fullscreen (self) — verify header (T-SEC-001).
- Testing: E2E-READER-004, (iOS: manual at VS-9).
- Manual QA: desktop + phone.
- DoD: AGENTS.md.

## T-READER-013 — Responsive layout
- Requirements: FR-READER-011, NFR-A11Y-010
- Goal: Layout rules across breakpoints: mobile portrait (vertical default, full-width pages), mobile landscape, tablet, desktop (centered max-width, larger chrome); no horizontal overflow anywhere; chrome adapts (hamburger on small).
- Depends on: T-FOUND-004, T-READER-003
- Expected modules: src/app reader client, shared/ui
- Inputs: reader-behavior.md §2, ACCESSIBILITY.md §3.3
- Expected behavior: 1. Single layout system (no per-breakpoint re-implementations of navigation). 2. Touch targets ≥ 44 px in all breakpoints. 3. Mode availability per breakpoint (double auto-degrades < 640 px).
- Edge cases: 320 px viewport (narrowest supported); 2560 px display (max-width, centered); mid-read resize (state preserved, reflow clean).
- Security: —.
- Testing: E2E-READER-007 (matrix viewports), CLS assertion (NFR-PERF-003).
- Manual QA: 4 breakpoints, both themes.
- DoD: AGENTS.md.

## T-READER-014 — Position indicator
- Requirements: FR-READER-022, NFR-A11Y-009
- Goal: "Page N / M" text (always, not color-only) + thin progress bar (vertical mode: scroll progress; paged: N/M); live-region source of truth for announcements.
- Depends on: T-READER-003
- Expected modules: features/reader, shared/ui
- Inputs: ACCESSIBILITY.md §3.2
- Expected behavior: 1. Text updates on every page change (vertical: on page boundary). 2. Bar is decorative (aria-hidden) — text is the accessible channel. 3. No reflow (fixed slot, NFR-PERF-003).
- Edge cases: M=1 ("Page 1 of 1"); 3-digit pages (width stable).
- Security: —.
- Testing: E2E-READER-001 (indicator present/updates), axe.
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-015 — Next/previous chapter navigation
- Requirements: FR-READER-016
- Goal: From first page → "Previous chapter" (if exists); from last page → completion state + "Next chapter" CTA (T-READER-033); chrome buttons always available (prev/next chapter with target title, a11y-labeled); auto-advance on completion respects ReaderPreference.autoNextChapter (FR-READER-021).
- Depends on: T-CATALOG-007, T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §13
- Expected behavior: 1. Neighbor resolution via chapter list (cached in reader state, loaded with page metadata — one extra field in API response: prev/next chapter slugs+titles, documented addition to T-READER-002 shape). 2. Navigation preserves reading mode/direction; page resets to 1. 3. Auto-advance delay 1.5 s with visible "Continue" card (cancelable).
- Edge cases: first/last chapter of series (CTA → detail page); deleted neighbor (hide); draft neighbor (hide from non-admin).
- Security: —.
- Testing: E2E-READER-005, UNIT (neighbor resolution).
- Manual QA: chain 3 chapters.
- DoD: AGENTS.md.

## T-READER-016 — Chapter completion detection
- Requirements: FR-READER-017, FR-LIBRARY-007
- Goal: Completion rule: last page visible ≥ 1 s (any mode) or explicit "Mark as read" → sets progress.completed (sticky, NFR-DATA-003); triggers completion card + history session close (T-READER-025).
- Depends on: T-READER-003, T-READER-021
- Expected modules: features/reader, features/progress
- Inputs: reader-behavior.md §13, UNIT-READER-010 spec
- Expected behavior: 1. Detection is client-timed, write is server-authoritative (idempotent). 2. Explicit unmark via chapter list (PATCH read-status, T-LIB-006) — only path to unset. 3. Completion announced (live region).
- Edge cases: last page flashed < 1 s then leave (no completion — correct); 2 tabs (both detect, writes idempotent); completed then re-read from p5 (completed stays, documented).
- Security: —.
- Testing: UNIT-READER-010, E2E-READER-005, INT-PROG-001 (sticky).
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-017 — Failed image handling
- Requirements: FR-READER-018, NFR-OBS-007
- Goal: Per-image failure: placeholder (page number + "Failed to load") with Retry button + 1 automatic retry (backoff 500 ms); rest of chapter fully usable; beacon event emitted (type=page_load_error, cause); consecutive failures (≥ 3 distinct pages) → banner "Images may be temporarily unavailable" + link to status (no fake data).
- Depends on: T-READER-002, T-FOUND-008
- Expected modules: features/reader
- Inputs: reader-behavior.md §14, OBSERVABILITY.md §4 (beacon fields)
- Expected behavior: 1. Failure is per-image state (retry resets it). 2. Retry re-issues with cache-busting query (documented; immutable key + `?r=n`). 3. Beacon batched (≤ 100, flushed on unload).
- Edge cases: permanent 404 (key rotated after re-ingest mid-session — refresh page list, documented); all pages failing (banner + no infinite retry loop: max 2 retries total/page).
- Security: —.
- Testing: E2E-READER-006 (block + retry), UNIT (retry state machine), beacon payload test (T-OBS-007).
- Manual QA: dev: stop MinIO, read a chapter.
- DoD: AGENTS.md.

## T-READER-018 — Reader preferences
- Requirements: FR-READER-021, FR-READER-007 (direction override)
- Goal: `/settings` (reader section) + API (GET/PUT /api/v1/preferences): defaultMode, directionOverride, zoomDefault, autoNextChapter; reader applies on open (defaults) and live (mode/direction changes persist).
- Depends on: T-FOUND-003, T-READER-003
- Expected modules: src/app/settings, features/reader, src/app/api/v1/preferences
- Inputs: API_CONTRACT §2.6
- Expected behavior: 1. Anonymous: preferences stored device-local (localStorage, namespaced) — server prefs only post-login (documented duality, FR-READER-013 area). 2. PUT is idempotent upsert. 3. Live change in reader = immediate + persisted (debounced 500 ms).
- Edge cases: localStorage full/unavailable (private mode) → in-memory only + notice; corrupt stored JSON (reset to defaults, no crash).
- Security: no PII (preferences aren't private data); rate limit 60/h.
- Testing: UNIT (persistence duality), INT (upsert), E2E (settings → open reader reflects).
- Manual QA: change mode in reader → reopen → persists.
- DoD: AGENTS.md.

## T-READER-019 — Image eviction & memory bounding
- Requirements: NFR-PERF-010/011, ADR-007
- Goal: Residency enforcement: only window-interior pages hold `<img>` src; outside-window pages get placeholder slots (dimensions preserved — no CLS); eviction at 2× load distance (hysteresis); hard cap 12 decoded images (excess = drop farthest); browser disk cache absorbs revisits.
- Depends on: T-READER-031, T-READER-003
- Expected modules: features/reader
- Inputs: PERFORMANCE.md §3, ADR-007
- Expected behavior: 1. Invariant: decoded residency ≤ 12 at all times (assertable via CDP in E2E). 2. Back-scroll within hysteresis band = instant (no reload). 3. 500-page chapter behaves identically to 50-page at memory level.
- Edge cases: rapid forward then backward (hysteresis band holds both); mode switch (recompute window, drop excess); zoom out from 400% (decode memory drops — verify).
- Security: —.
- Testing: E2E-READER-007 (marathon + CDP residency/heap assertions), UNIT (eviction policy pure).
- Manual QA: devtools memory snapshot after 100 pages.
- DoD: AGENTS.md.

## T-READER-020 — Preload scheduling orchestration
- Requirements: NFR-PERF-008/011/015
- Goal: Turn the window (T-READER-031) into fetch orchestration: assign priorities (active page high; near medium; far low), cancel out-of-window in-flight (fetch abort), slow-network mode (throttle heuristic from RTT: only active+1 at high priority), respect document.hidden (pause non-critical loads).
- Depends on: T-READER-031, T-READER-019
- Expected modules: features/reader
- Inputs: PERFORMANCE.md §3/§4, reader-behavior.md §15
- Expected behavior: 1. In-flight ≤ window + 2 (measurable). 2. Tab hidden → non-urgent loads paused (data economy, NFR-PERF-015). 3. No fetch storms on rapid navigation (coalesce 100 ms).
- Edge cases: very slow connection (priority ladder degrades gracefully — 3G test); page list 500 (scheduler O(window), not O(pages)).
- Security: —.
- Testing: UNIT (scheduler pure, fuzz), E2E-READER-007 (in-flight count via network trace), T-PERF-006 (slow-net pass).
- Manual QA: throttled devtools, 500-page scroll.
- DoD: AGENTS.md.

## T-READER-021 — Persist reader progress (save)
- Requirements: FR-READER-014, NFR-DATA-003, THREAT T-18
- Goal: Progress save path (skeleton interface: `features/progress/reader-progress.repository.ts`): ProgressRepository.save (idempotent upsert, server-stamped LWW, sticky completed), progress service (validate page vs pageCount, debounce policy), called by reader (immediate on paged turn; 1 s debounce vertical; on visibilitychange + beforeunload).
- Depends on: T-READER-003, T-FOUND-005
- Expected modules: features/progress, server/db/repositories
- Inputs: DATA_MODEL §12, API_CONTRACT §2.3
- Expected behavior: 1. Identical repeat = no-op (DB rowcount 0). 2. Older timestamp never overwrites (server clock). 3. completed sticky on this path. 4. Anonymous → local-only (T-READER-024).
- Edge cases: 2 tabs racing (LWW safe, no corruption); invalid page (422, no write); deleted chapter mid-session (write 404 → reader enters unavailable state, local copy retained).
- Security: session user only (THREAT T-18); rate limit 60/min/account.
- Testing: UNIT-PROG-001/002, INT-PROG-001 (concurrency), E2E-READER-019 (IDOR).
- Manual QA: read → close → reopen (VS-5 once auth exists; pre-auth: anonymous path T-READER-024).
- DoD: AGENTS.md.

## T-READER-022 — Retrieve latest position (restore data)
- Requirements: FR-READER-012, FR-CATALOG-008
- Goal: ProgressRepository.get + service: fetch session user's position (or null); used by reader open (T-READER-029) and resume resolution (T-CATALOG-009); anonymous → local store read.
- Depends on: T-READER-021
- Expected modules: features/progress
- Inputs: DATA_MODEL §12
- Expected behavior: 1. Single indexed read (PK). 2. null when none (reader starts at page 1 or deep-link page). 3. Position for a completed chapter still returned (resume semantics: completed chapter → next unread per T-CATALOG-009 rules).
- Edge cases: progress newer than chapter's current page count (re-ingest shrank chapter — clamp, documented EC-RDR-10).
- Security: session user only.
- Testing: UNIT-PROG-003 sibling, INT-PROG-001.
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-023 — Progress API routes
- Requirements: API_CONTRACT §2.3, NFR-SEC-004
- Goal: POST /api/v1/progress, GET /api/v1/progress, POST /api/v1/progress/merge as specified (Zod, session identity, CSRF origin check on POST, 422/404/401 mappings, no-store headers).
- Depends on: T-READER-021/022, T-FOUND-009
- Expected modules: src/app/api/v1/progress
- Inputs: API_CONTRACT §2.3
- Expected behavior: 1. Exact contract behavior incl. failure table. 2. Merge endpoint: ≤ 200 entries, per-entry validation, drops invalid with summary in 204 (no body — summary only in log? NO: merge returns 200 + `{ applied, dropped }` — contract addendum, documented). 3. Rate limits per contract.
- Edge cases: POST with own userId in body (ignored — documented rule); merge from another device (latest wins per chapter).
- Security: THREAT T-04 (identity from session), T-18 (LWW), NFR-SEC-004 (origin check tested).
- Testing: INT-PROG-001/002, E2E-READER-019, CSRF test (T-AUTH-013 shared harness).
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-024 — Anonymous local progress + merge
- Requirements: FR-READER-013, NFR-A11Y-001 (notice a11y)
- Goal: Device-local progress store (namespaced localStorage; schema-versioned; quota-safe: cap 1,000 entries, LRU by updatedAt); on sign-in → merge call (T-READER-023 merge) with per-chapter latest-wins; user sees a "Saved your reading position" confirmation (live region).
- Depends on: T-READER-021/023
- Expected modules: features/progress (client), features/auth (sign-in hook point)
- Inputs: reader-behavior.md §12, API_CONTRACT §2.3
- Expected behavior: 1. Anonymous read/write works with zero server calls. 2. Merge is one-shot per sign-in (idempotent server-side regardless). 3. localStorage failure (quota/private mode) → in-memory + one-time notice (no crash loop).
- Edge cases: sign-in on device A after reading on B (B's later position wins — user sees jump to B; documented EC-RDR-11); 1,001st entry (LRU evicts oldest); app update changing schema (migrate-or-discard, documented).
- Security: local data only; no PII (chapter ids are public content ids).
- Testing: UNIT-PROG-003 (merge rules), E2E (anon read → sign in → merged state).
- Manual QA: anon read → register → position merged.
- DoD: AGENTS.md.

## T-READER-025 — Reading history recording
- Requirements: FR-READER-015, FR-LIBRARY-008
- Goal: History service: session detection (start on first page view; end on completion, 5-min tab-hidden, or unload), deepest-page tracking, HistoryRepository.append/upsert; history list API (GET /api/v1/history) per contract.
- Depends on: T-READER-021, T-FOUND-005
- Expected modules: features/progress, src/app/api/v1/history
- Inputs: DATA_MODEL §13, API_CONTRACT §2.3
- Expected behavior: 1. One row per contiguous session per chapter (re-entry within 5 min extends, deepest page updated). 2. Anonymous: no history (documented; privacy-by-default). 3. List API: newest first, cursor, chapter-resolved (deleted → null chapter, retained).
- Edge cases: instant bounce (view < 2 s → still recorded, documented — data for "opened"); tab crash (no ended_at → null, duration null); 5-min boundary (300 s rule, server- or client-stamped — server-stamped, documented).
- Security: session user only; no PII beyond ids.
- Testing: INT-PROG-002, E2E-LIB-001 (history step).
- Manual QA: 2 sessions same chapter → 2 rows, 1 session → 1 row.
- DoD: AGENTS.md.

## T-READER-026 — Large-chapter performance pass
- Requirements: NFR-PERF-010/011/012/015, ADR-007
- Goal: Profile + tune the 500-page case to the PERFORMANCE.md §3 matrix across the 3 reference viewports; tune window/hysteresis/priorities if gates fail; produce the measurement report (artifact) for VS-4 exit.
- Depends on: T-READER-019/020, T-PERF-005 (harness)
- Expected modules: features/reader (tuning), docs (report)
- Inputs: PERFORMANCE.md §3
- Expected behavior: 1. 50/100/200/500 all green in the matrix. 2. Report: residency curve, heap curve, in-flight curve, jank samples, per-viewport. 3. Any parameter change recorded with before/after numbers.
- Edge cases: low-RAM phone emulation (4 GB profile).
- Security: —.
- Testing: E2E-READER-007 (full matrix run), T-PERF-006/007.
- Manual QA: real mid-range phone, 500-page chapter, 15 min.
- DoD: AGENTS.md.

## T-READER-027 — Reader accessibility pass
- Requirements: NFR-A11Y-001…010 (reader scope), ACCESSIBILITY.md §3
- Goal: Close every reader a11y item: live regions (page changes, completion, mode change), focus initial/trap/restore, reduced-motion behavior, alt text, zone keyboard equivalents, contrast of chrome in both themes; axe green on all reader states.
- Depends on: T-READER-004…014 (all reader modes exist)
- Expected modules: features/reader
- Inputs: ACCESSIBILITY.md §3/§7
- Expected behavior: 1. Keyboard-only journey J-6 passes. 2. NVDA + VoiceOver manual pass recorded (read-aloud of page position, mode change, completion). 3. Reduced motion: no animated transitions (emulated test).
- Edge cases: live region spam in vertical (10-page cadence rule, §3.2); focus after mode dialog (restore).
- Security: —.
- Testing: E2E-READER-017 (automated: axe, focus, reduced-motion), manual SR pass (artifact).
- Manual QA: SR pass with a visually impaired participant if available (else NVDA+VoiceOver dual pass).
- DoD: AGENTS.md.

## T-READER-028 — Reader error & unavailable states
- Requirements: FR-READER-018 (chapter-level), API_CONTRACT (CHAPTER_NOT_READY), edge-cases EC-RDR-08
- Goal: Distinct, non-ugly states: chapter unavailable (draft/failed), chapter pages missing mid-read (data bug → refresh + report), manga deleted mid-session, network-down (global banner, not per-page).
- Depends on: T-READER-001, T-FOUND-009
- Expected modules: src/app reader client, shared/ui
- Inputs: docs/product/edge-cases.md
- Expected behavior: 1. Each state: cause text + next action (retry/back/to catalog). 2. Mid-session data bug: detect page-list mismatch (404 on active key after re-ingest) → auto page-list refresh once, then state. 3. No state is a blank main (NFR-A11Y-004 spirit).
- Edge cases: offline (navigator.onLine) → banner + queue nothing (NO-6: no offline reading).
- Security: —.
- Testing: E2E-READER-006 (offline portion), INT (unavailable chapter states).
- Manual QA: delete manga mid-read (dev).
- DoD: AGENTS.md.

## T-READER-029 — Progress restoration on open
- Requirements: FR-READER-012
- Goal: Open-chapter restore: SSR reads `?page` (validated) → client fetches progress (authenticated) / local (anon) → if restored position exists and is newer than deep link, restore it (page + scroll); announce "Restored your position" (live region) once.
- Depends on: T-READER-001, T-READER-022/024
- Expected modules: features/reader
- Inputs: reader-behavior.md §12
- Expected behavior: 1. Priority: deep-link page > saved? NO — saved wins (user intent), deep link is fallback (documented rule + EC-RDR-12). 2. Restore is silent unless from a different device (announcement). 3. Restore before first paint of images (no flicker to page 1).
- Edge cases: saved page > current pageCount (re-ingest — clamp + notice); tab restore (bfcache: revalidate on pageshow).
- Security: —.
- Testing: E2ER-READER-001 (reload restore), E2E (deep link vs saved conflict).
- Manual QA: reload at p47 → back at p47.
- DoD: AGENTS.md.

## T-READER-030 — Mode/direction switch transition rules
- Requirements: FR-READER-001…005 (interplay), NFR-PERF-003
- Goal: Transition table (pure, unit-first): mode switch (vertical↔single↔double) preserves logical page; direction switch preserves page, reverses spread order; window recomputed; zoom resets only on double↔others (documented); zero CLS (reserved slots).
- Depends on: T-READER-003, T-READER-006
- Expected modules: features/reader
- Inputs: reader-behavior.md §11 (transition table), UNIT-READER-008 spec
- Expected behavior: 1. Position identity across switches (property test: switch A→B→A = identity). 2. Window recompute is O(1). 3. DOM order changes without reflow flash.
- Edge cases: switch at page M (clamps to last valid spread); switch with zoom 300% (reset rule); rapid triple-switch (coalesce).
- Security: —.
- Testing: UNIT-READER-008, E2E-READER-003 (switch journey + CLS assert).
- Manual QA: switch modes mid-chapter 10×.
- DoD: AGENTS.md.

## T-READER-031 — Bounded preload window (calculateReaderWindow)
- Requirements: NFR-PERF-011, ADR-007, FR-READER-019/020
- Goal: Implement the pure `calculateReaderWindow(currentPage, totalPages, mode)` (skeleton exists: `features/reader/reader-window.ts`): mode-aware sizes (vertical ±3, single −1/+2, double ±1 spread), clamped to [1..M], hard cap 12, O(1).
- Depends on: T-FOUND-001
- Expected modules: features/reader
- Inputs: PERFORMANCE.md §3, UNIT-READER-004/005 spec
- Expected behavior: 1. Table + property tests all green (first/last/middle/tiny chapter/500-page/hard cap). 2. Fuzz (1k random walks) never violates invariants. 3. No allocation-heavy paths (pure, ≤ few ops).
- Edge cases: totalPages < window (return full range); totalPages = 0 (never called — precondition, assert).
- Security: —.
- Testing: UNIT-READER-004/005 (the canonical tests for this ADR).
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-032 — Page index validation (no negative / out-of-range)
- Requirements: FR-READER-023, THREAT T-18
- Goal: Implement `validatePageIndex(candidate, total)` + `clampPageIndex` (skeleton exists: `features/reader/page-index.ts`): parse (string from URL), range-check, clamp policy (with "clamped" flag for UI notice); used by SSR deep link, reducer, progress API (422 there).
- Depends on: T-FOUND-001
- Expected modules: features/reader
- Inputs: UNIT-READER-002 spec, API_CONTRACT (READER_INVALID_PAGE)
- Expected behavior: 1. Negative/zero/NaN/>total → clamped (reader) or 422 (API) — two export policies, both pure. 2. Non-integer strings: "12.7" → floor? NO → reject → clamp with notice (documented: pages are integers). 3. Unicode digits ("١٢") → reject (locale out of scope, documented).
- Edge cases: huge numbers (1e15, string overflow), empty string, whitespace, "+5".
- Security: T-18 (never store unvalidated); no prototype-pollution-style inputs (all values parsed to number | null).
- Testing: UNIT-READER-002 (full input table + fuzz).
- Manual QA: —.
- DoD: AGENTS.md.

## T-READER-033 — Final-page handling
- Requirements: FR-READER-024, FR-READER-016/017
- Goal: Chapter-end behavior: reaching M → completion card (next-chapter CTA / "series finished" / "you're all caught up"), auto-advance (T-READER-015), no scroll dead-end (vertical: card in flow; paged: card replaces next), no wrap-around ever.
- Depends on: T-READER-015/016, T-READER-003
- Expected modules: features/reader
- Inputs: reader-behavior.md §13, UNIT-READER-003 spec
- Expected behavior: 1. No wrap (End at M stays M; next from M = completion card). 2. Card states: next-chapter / finished / catch-up (no more chapters). 3. Vertical: card rendered as flow tail (visible without scroll if M in view).
- Edge cases: next chapter is draft (hidden → "catch up"); last chapter of series (finished state); completion card + reduced motion (no slide-in).
- Security: —.
- Testing: UNIT-READER-003, E2E-READER-005 (end journey).
- Manual QA: finish a 30-page test chapter.
- DoD: AGENTS.md.

---

# EPIC-04 — Authentication (VS-5)

## T-AUTH-001 — User domain & repository
- Requirements: FR-AUTH-001/007/009, NFR-DATA-001
- Goal: UserRepository (skeleton port in features/auth): byEmail, byId, create, updateRole, updateStatus, lastAdminGuard check, delete cascade list; server/db impl. citext email, role/status CHECKs.
- Depends on: T-FOUND-005
- Expected modules: features/auth, server/db/repositories
- Inputs: DATA_MODEL §1
- Expected behavior: 1. create is atomic (email unique → typed conflict). 2. lastAdminGuard: count active admins before demote/disable. 3. delete returns the list of child rows to cascade (service drives deletes explicitly, auditable).
- Edge cases: email case variants (Citext handles); disable then re-enable; deleting an admin who is last (guard).
- Security: parameterized; no user enumeration in repo (service decides responses).
- Testing: INT-AUTH-004 (cascade), UNIT (guard logic).
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-002 — Password hashing (Argon2id)
- Requirements: NFR-SEC-001, THREAT T-03
- Goal: PasswordHasher port (skeleton: `features/auth/password.ts`) ← argon2 impl: Argon2id m=65536 KiB, t=3, p=4; policy validator (≥ 10, ≤ 128, not in common-password list, no email substring); re-hash-on-login when stored params < current.
- Depends on: T-FOUND-001
- Expected modules: features/auth, server/auth (impl)
- Inputs: research doc (argon2 section), UNIT-AUTH-001/002 spec
- Expected behavior: 1. Hash string contains params; verify is constant-time (library). 2. Policy rejections are typed (VALIDATION_PASSWORD_*). 3. Re-hash path tested (old-params fixture).
- Edge cases: 128-char password (allowed); Unicode passwords (UTF-8 bytes, fine); empty (rejected).
- Security: the hash never leaves the server (NFR-SEC-001); params pinned in one constants module.
- Testing: UNIT-AUTH-001/002.
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-003 — Registration
- Requirements: FR-AUTH-001, NFR-SEC-005
- Goal: POST /api/v1/auth/register per contract: validate → create user (role reader) → auto-login (session, T-AUTH-006) → 201. `role` field in input ignored (T-07).
- Depends on: T-AUTH-001/002/006
- Expected modules: features/auth, src/app/api/v1/auth/register
- Inputs: API_CONTRACT §2.5
- Expected behavior: 1. Duplicate email → 409 AUTH_EMAIL_TAKEN. 2. Rate limit 5/h/IP. 3. Audit? no (no admin action). 4. AuditEvent not written; log info.
- Edge cases: email with dots/Unicode (idn normalized to lowercase ascii via citext + validation); displayName empty ("" allowed).
- Security: T-03 (rate), T-07 (role ignored), uniform timing (hash runs even on duplicate email — documented).
- Testing: INT-AUTH-001 (register leg), INT-AUTH-003 (rate).
- Manual QA: register in dev.
- DoD: AGENTS.md.

## T-AUTH-004 — Sign in (authenticate)
- Requirements: FR-AUTH-002, NFR-SEC-001/002/003/005, THREAT T-03/T-05
- Goal: POST /api/v1/auth/login (skeleton: `features/auth/auth.service.ts#authenticate`): uniform invalid-credentials (unknown email ⇒ dummy-verify to equalize timing), disabled ⇒ 403 distinct, success ⇒ session row + cookie (rotation), last_login_at updated.
- Depends on: T-AUTH-001/002/006
- Expected modules: features/auth, src/app/api/v1/auth/login
- Inputs: API_CONTRACT §2.5, ADR-006
- Expected behavior: 1. Dummy Argon2 verify on unknown email (timing uniformity, tested). 2. Cookie flags per contract (Secure in prod). 3. Auth failure counters (NFR-OBS-007). 4. Rate: 10/min/IP + 5/min/account.
- Edge cases: account disabled (403, documented); token rotation (new session, old session row deleted); concurrent logins (multi-device OK).
- Security: T-03/T-05; no user enumeration (except documented disabled case); uniform errors.
- Testing: INT-AUTH-001, INT-AUTH-003, UNIT-AUTH-003 (expiry math used), E2E-AUTH-001.
- Manual QA: login flow + devtools cookie inspection.
- DoD: AGENTS.md.

## T-AUTH-005 — Sign out & session revocation
- Requirements: FR-AUTH-003, NFR-SEC-003
- Goal: POST /api/v1/auth/logout: delete session row, clear cookie (Path=/, same attrs), 204 idempotent. Plus the revocation primitive used by: disable (immediate on next request), reset-confirm (all sessions), account deletion.
- Depends on: T-AUTH-006
- Expected modules: features/auth, src/app/api/v1/auth/logout
- Inputs: ADR-006, API_CONTRACT §2.5
- Expected behavior: 1. Revoked token → 401 on any subsequent request (no grace). 2. Cookie cleared with matching attributes. 3. Revocation of all user sessions (reset/disable path) is one query.
- Edge cases: logout already-logged-out (204); token deleted between check and use (race → 401, no 500).
- Security: T-05.
- Testing: INT-AUTH-001 (logout leg), INT (revocation race).
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-006 — Session management (cookies, expiry, store)
- Requirements: FR-AUTH-006, NFR-SEC-002/003, ADR-006
- Goal: SessionRepository + cookie helper (skeleton: `features/auth/session.ts`, impl `server/auth`): create (256-bit token), getByToken (indexed), slideIdle (max 30 d, updated ≤ hourly), absolute 90 d, sweep; cookie set/read helpers with env-driven Secure flag; middleware presence check (redirect UX) + authoritative handler guard.
- Depends on: T-AUTH-001
- Expected modules: features/auth, server/auth, src/middleware
- Inputs: ADR-006, DATA_MODEL §2
- Expected behavior: 1. Expiry math exact (UNIT-AUTH-003). 2. Token compare constant-time. 3. Middleware only redirects (never authorizes); handlers re-check (defense in depth). 4. Nightly sweep job (ops entrypoint, T-OBS-005 area).
- Edge cases: clock skew (server clock only); session at exact expiry boundary (<= semantics, tested); disabled user with live session (next request 403 AUTH_DISABLED).
- Security: T-05 (rotation), cookie flags (E2E assert), no session in logs.
- Testing: UNIT-AUTH-003, INT-AUTH-001, E2E-AUTH-004 (flags + fixation).
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-007 — Route protection guard
- Requirements: FR-AUTH-007, THREAT T-04
- Goal: Guard middleware for the handler layer: `requireUser` / `requireAdmin` (skeleton: features/auth + app wrapper): 401/403 typed, attaches caller identity to the request context (features read identity only from here).
- Depends on: T-AUTH-006
- Expected modules: src/app (guard wrapper), features/auth
- Inputs: API_CONTRACT §1 (auth conventions)
- Expected behavior: 1. Every private route uses the guard (lint/audit: no handler reads cookies directly outside the guard — boundary rule). 2. Identity object: {userId, role, status} — frozen. 3. Admin routes: guard + role.
- Edge cases: disabled mid-request (guard reads status at check time).
- Security: T-04 (the structural control); matrix-testable surface.
- Testing: T-SEC-003 matrix (this task provides the unit under test).
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-008 — Admin role enforcement
- Requirements: FR-AUTH-008/009
- Goal: requireAdmin enforcement + role-change API (PATCH /api/v1/admin/users) with last-admin guard + audit (FR-ADMIN-007 hook); disabled-account effect (sessions dead on next request).
- Depends on: T-AUTH-007, T-AUTH-001
- Expected modules: features/auth, features/admin (uses guard)
- Inputs: API_CONTRACT §2.7, THREAT T-07
- Expected behavior: 1. Non-admin → 403 on any /admin/* (all methods incl. GET). 2. Role change audited (before/after). 3. Last-admin: 409 ADMIN_LAST_ADMIN. 4. Disabling self allowed only if other admins exist.
- Edge cases: role forgery in register/login payloads (ignored — T-07); two admins, demote one (OK).
- Security: T-07 (dedicated threat row).
- Testing: T-SEC-003 matrix, UNIT (last-admin), INT-ADMIN-001 extension.
- Manual QA: —.
- DoD: AGENTS.md.

## T-AUTH-009 — Password reset flow
- Requirements: FR-AUTH-004, NFR-SEC-005
- Goal: request (always 204; token 256-bit, 60 min, single-use, replaces active) + confirm (new password policy; all sessions revoked; token consumed) + MailPort skeleton (interface now; SMTP provider impl at VS-9 — skeleton file exists, no working email in this phase's scope of *other* slices; the flow is testable with a mail capture port in dev).
- Depends on: T-AUTH-002/006
- Expected modules: features/auth, src/app/api/v1/auth/password-reset/*
- Inputs: API_CONTRACT §2.5, DATA_MODEL §17
- Expected behavior: 1. No existence signal (204 always, same timing shape). 2. Token hash stored (never raw). 3. Confirm: success ⇒ forced re-login. 4. Rate 3/h/IP both ops.
- Edge cases: double request (second replaces first — first token dead); use after expiry (401 uniform); confirm with old password still working (no — token path only).
- Security: T-03 (spray), token entropy, uniform errors.
- Testing: INT-AUTH-002 (full flow + expiry with clock control).
- Manual QA: dev: request → captured mail (port) → confirm.
- DoD: AGENTS.md.

## T-AUTH-010 — Auth rate limiting
- Requirements: NFR-SEC-005, THREAT T-03/T-15
- Goal: In-app limiter (fixed window, in-memory per instance + per-instance sufficiency at 1-VM scale; edge backstop in Caddy, DEPLOYMENT): login/register/reset per contract; 429 with Retry-After; counters observable (auth_failures + rate_limited reasons).
- Depends on: T-AUTH-003/004/009
- Expected modules: features/auth (limiter), src/app wrapper
- Inputs: NFR-SEC-005 values
- Expected behavior: 1. Limits per contract table. 2. 429 shape per contract. 3. Limits are per (endpoint, ip) and (endpoint, account) where specified — both must pass (whichever trips first).
- Edge cases: IP behind NAT (accepted risk, documented); counter reset window boundary; clock step (monotonic clock).
- Security: T-03/T-15.
- Testing: INT-AUTH-003 (all limits), UNIT (window math).
- Manual QA: hammer login in dev → 429 + Retry-After.
- DoD: AGENTS.md.

## T-AUTH-011 — Account deletion
- Requirements: FR-AUTH-005, NFR-DATA-005, THREAT T-17
- Goal: DELETE /api/v1/account: explicit cascade (sessions, progress, history, library, bookmarks, prefs, tokens — order per FK), audit provenance (`actor_email '<deleted>'`), 204; repeat → 404.
- Depends on: T-AUTH-001/006
- Expected modules: features/auth, server/db
- Inputs: DATA_MODEL §1, THREAT T-17
- Expected behavior: 1. Zero residual private rows (test asserts full sweep). 2. Audit rows retained with provenance. 3. Idempotent-ish second call → 404 AUTH_ACCOUNT_GONE.
- Edge cases: delete while a session is active elsewhere (all sessions die); delete mid-reader-session (next progress write 401 → client signs out gracefully, documented).
- Security: T-17; no PII in logs (redaction).
- Testing: INT-AUTH-004 (residual sweep), E2E-AUTH-001 extension.
- Manual QA: dev: delete account → verify via psql.
- DoD: AGENTS.md.

## T-AUTH-012 — Auth UI (signin / register)
- Requirements: FR-AUTH-001/002, NFR-A11Y-001/003/005
- Goal: `/auth/signin` + `/auth/register`: labeled forms, password reveal toggle, inline errors (aria-describedby + alert role), success redirect (back to intended page — `?next=` sanitized to same-origin paths only), a11y green.
- Depends on: T-AUTH-003/004, T-FOUND-004
- Expected modules: src/app/auth
- Inputs: ACCESSIBILITY.md §5
- Expected behavior: 1. `?next=` open-redirect check (same-origin, relative path only — documented rule). 2. Errors announced; focus to error summary. 3. No password logging ever (input never in error details).
- Edge cases: next=`//evil.com` (rejected → default home); next=`/admin` for non-admin (guard handles; no special UI).
- Security: open-redirect (T-02 adjacent, tested); XSS (values rendered as text).
- Testing: E2E-AUTH-001 (forms), E2E (open-redirect table), axe.
- Manual QA: both forms, both themes, SR pass.
- DoD: AGENTS.md.

## T-AUTH-013 — Auth hardening test suite
- Requirements: NFR-SEC-002/004/005, THREAT T-03/T-05/T-06
- Goal: The cross-cutting auth security suite: CSRF origin-check tests (all mutating endpoints, wrong/missing Origin ⇒ 403), fixation test (pre-set cookie invalidated by login), uniform-timing assertion (unknown vs wrong-password within band), cookie-flag assertions, session rotation assertions. Shared harness for later IDOR suites (T-SEC-003).
- Depends on: T-AUTH-004/005/006
- Expected modules: tests/integration
- Inputs: TEST_STRATEGY §3, THREAT_MODEL T-03/05/06
- Expected behavior: 1. All green = threat rows verified (T-SEC-007 consumes results). 2. Harness reusable: `asUser(ctx, user)`, `mutateExpectCsrf(...)`.
- Edge cases: —.
- Security: this IS the verification layer.
- Testing: INT-AUTH-002/003 consumers; E2E-AUTH-004.
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-05 — Library (VS-5)

## T-LIB-001 — Library add/remove
- Requirements: FR-LIBRARY-001/002, NFR-DATA-001
- Goal: LibraryRepository (add idempotent no-op, remove idempotent-204, list) + POST/DELETE /api/v1/library/{mangaId} per contract.
- Depends on: T-FOUND-005, T-AUTH-007
- Expected modules: features/library, src/app/api/v1/library
- Inputs: DATA_MODEL §11, API_CONTRACT §2.4
- Expected behavior: 1. Add on already-present = no-op (no error). 2. Remove on absent = 204 (documented). 3. Add requires manga exists + published-or-admin (else 404 — no adding deleted titles).
- Edge cases: add deleted manga (404); rapid add/remove (no unique violations).
- Security: IDOR-impossible (session user).
- Testing: INT-LIB-001.
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-002 — Library list API
- Requirements: FR-LIBRARY-003/004/006
- Goal: GET /api/v1/library: items with manga summary + lastRead + unreadChapterCount; sorts (last_read_desc default, added_desc, title_asc); cursor pagination; `last_read_at` denormalized update on progress write (event in progress service → library update, documented single-writer chain).
- Depends on: T-LIB-001, T-READER-021
- Expected modules: features/library, src/app/api/v1/library
- Inputs: DATA_MODEL §11, API_CONTRACT §2.4
- Expected behavior: 1. unread = published chapters − completed (one query, no N+1). 2. Sorts indexed. 3. Deleted manga excluded; hidden (unpublished) manga still listed for the owner (documented: library is private — you can see titles you added that went unpublished, reading 404s).
- Edge cases: 0 entries (empty state data); 1,000 entries (cursor fine).
- Security: session user only.
- Testing: INT-LIB-001 (list legs), INT-PROG (denormalization on progress write).
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-003 — Library UI
- Requirements: FR-LIBRARY-003/004, NFR-A11Y-004
- Goal: `/library`: grid/list of entries (cover, title, last read "Ch. 12 · p. 45", unread badge icon+count), sort control, empty state (→ catalog CTA).
- Depends on: T-LIB-002, T-FOUND-004
- Expected modules: src/app/library
- Inputs: ACCESSIBILITY.md §2
- Expected behavior: 1. Entry link → detail (with continue). 2. Badge not color-only. 3. Keyboard navigable grid.
- Edge cases: manga unpublished (entry stays, "unavailable" hint); huge library (load-more via cursor).
- Security: —.
- Testing: E2E-LIB-001, axe.
- Manual QA: 3 viewports.
- DoD: AGENTS.md.

## T-LIB-004 — Continue-reading home list
- Requirements: FR-LIBRARY-005, FR-CATALOG-008
- Goal: Home (`/`) "Continue reading" section (signed-in): last 20 by progress.updated_at, each → reader at saved position; anonymous home = catalog preview (J-1 path).
- Depends on: T-LIB-002, T-CATALOG-009
- Expected modules: src/app (home page), features/library
- Inputs: PRD J-2
- Expected behavior: 1. 20 cap (documented); completed manga excluded unless next-unread exists (T-CATALOG-009 rules). 2. Empty → hide section (anonymous default).
- Edge cases: all completed (section hidden); deleted chapter in latest progress (skips per T-CATALOG-009).
- Security: —.
- Testing: E2E-LIB-001 (continue step), E2E-CATALOG-001 (anon home).
- Manual QA: J-2 on phone.
- DoD: AGENTS.md.

## T-LIB-005 — History UI + API wiring
- Requirements: FR-LIBRARY-008, FR-READER-015
- Goal: `/history` page (newest-first list: manga title, chapter, deepest page, last read; cursor load-more) consuming GET /api/v1/history (T-READER-025 API).
- Depends on: T-READER-025
- Expected modules: src/app/history
- Inputs: ACCESSIBILITY.md §2
- Expected behavior: 1. Deleted chapters render "Unavailable chapter" (retained row, DATA_MODEL §13). 2. Empty state. 3. Time display local (UTC stored).
- Edge cases: 10k history rows (cursor, no client-side limit issues).
- Security: —.
- Testing: E2E-LIB-001 (history step).
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-006 — Read status & manual mark
- Requirements: FR-LIBRARY-007, FR-READER-017 (sticky interplay)
- Goal: PATCH /api/v1/chapters/{id}/read-status {read:boolean} (explicit set/unset — the only unset path), chapter-list indicator data (completed set per user, batch query for the list — no N+1), "Mark read" action on chapter list.
- Depends on: T-READER-016, T-CATALOG-008
- Expected modules: features/library, features/progress (state owner), src/app (chapter list action)
- Inputs: DATA_MODEL §12 (sticky rule), API_CONTRACT §2.4
- Expected behavior: 1. read=true sets completed (sticky thereafter). 2. read=false clears (explicit). 3. Indicator batch: one query for up to 1000 chapters' status.
- Edge cases: mark read a draft (admin OK, reader 404); mark read then progress write (completed stays — sticky honored by save path).
- Security: session user; IDOR-impossible.
- Testing: INT-LIB-001 (read-status legs), INT-PROG-001 (sticky vs progress).
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-007 — Bookmarks API
- Requirements: FR-LIBRARY-009, NFR-DATA-001
- Goal: POST/GET/DELETE bookmarks per contract: create (unique per user+chapter+page → 409 exists), list (newest first, chapter-resolved), delete (owned only → 404).
- Depends on: T-FOUND-005, T-AUTH-007
- Expected modules: features/library, src/app/api/v1/bookmarks
- Inputs: DATA_MODEL §14, API_CONTRACT §2.4
- Expected behavior: 1. page null = chapter start (valid). 2. Note ≤ 280, plain text (NFR-SEC-016). 3. Deleted chapter ⇒ `chapter: null` retained item.
- Edge cases: duplicate same page (409); two bookmarks different pages same chapter (OK); 1000 bookmarks (list fine).
- Security: ownership scoping (T-04).
- Testing: INT-LIB-001 (bookmark legs).
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-008 — Bookmarks UI
- Requirements: FR-LIBRARY-010
- Goal: `/bookmarks` page: list with manga/chapter/page/note, "Jump" → reader at saved page (`?page=` deep link), remove action (confirm dialog — focus trap, a11y).
- Depends on: T-LIB-007
- Expected modules: src/app/bookmarks
- Inputs: ACCESSIBILITY.md §2/§3
- Expected behavior: 1. Jump lands on the saved page (restore rules: deep link wins for bookmarks — documented exception to T-READER-029 priority, justified: explicit user intent). 2. Unavailable chapter entry renders + disables jump.
- Edge cases: bookmark on page beyond new pageCount (re-ingest — jump clamps to last, notice — EC-RDR-10).
- Security: —.
- Testing: E2E-LIB-001 (bookmark jump), E2E (dialog focus).
- Manual QA: —.
- DoD: AGENTS.md.

## T-LIB-009 — Library authorization test suite
- Requirements: THREAT T-04, FR-AUTH-007
- Goal: IDOR suite for all library/progress/history/bookmark endpoints: as reader A, attempt B's ids (path + query + body variants), disabled user, anonymous — expected 401/404/403 per contract; consumes the T-AUTH-013 harness.
- Depends on: T-AUTH-013, T-LIB-001…007
- Expected modules: tests/integration
- Inputs: THREAT_MODEL T-04, API_CONTRACT §1
- Expected behavior: 1. Matrix 100% green = T-04 verification (feeds T-SEC-007). 2. No existence leaks (404 not 403 for cross-user objects, per contract).
- Edge cases: —.
- Security: the verification layer.
- Testing: INT (this suite is the test).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-06 — Admin (VS-6)

## T-ADMIN-001 — Admin guard & layout
- Requirements: FR-AUTH-008, NFR-A11Y-004
- Goal: `/admin` layout: requireAdmin on all child routes (T-AUTH-008), admin nav (dashboard, manga, uploads, users, audit), empty-state onboarding for a fresh instance (J-4 step 1: "No manga yet — create one").
- Depends on: T-AUTH-008, T-FOUND-004
- Expected modules: src/app/admin
- Inputs: docs/product/admin-workflow.md §2
- Expected behavior: 1. Non-admin → 403 page (not redirect to login — authenticated users get a permission page). 2. Nav landmarks + keyboard. 3. All admin pages no-store.
- Edge cases: last admin disabling self (blocked per T-AUTH-008 — UI explains why).
- Security: guard re-check per page (SSR) + per API.
- Testing: E2E-ADMIN-002 (access legs), axe.
- Manual QA: log in as reader → /admin → 403.
- DoD: AGENTS.md.

## T-ADMIN-002 — Manga metadata CRUD
- Requirements: FR-ADMIN-001/002, FR-ADMIN-007
- Goal: Admin manga create/edit (list `manga/[id]`): all fields incl. genres (create-on-type), tags, creators (with role), cover upload (T-ADMIN-005 cover op), slug auto-gen (immutable after publish, EC-ADM-07); every mutation → audit event.
- Depends on: T-CATALOG-001 (repo), T-ADMIN-001
- Expected modules: src/app/admin/manga*, features/admin, src/app/api/v1/admin/manga*
- Inputs: API_CONTRACT §2.7, admin-workflow.md §3
- Expected behavior: 1. Create: unique slug check; aliases/creators/genres upserted (shared vocab). 2. Edit: partial; before/after summary in audit. 3. Validation: title required ≤ 200, synopsis ≤ 10k (plain text).
- Edge cases: rename after publish (allowed; slug not — documented); duplicate alias (normalized, no dup row); creator name shared across manga (vocab reused, counted references).
- Security: T-01 (values stored as text, rendered as text); audit (NFR-SEC-012).
- Testing: INT-ADMIN-001 (CRUD legs + audit assertions), E2E-ADMIN-001 (create leg).
- Manual QA: create a manga from scratch.
- DoD: AGENTS.md.

## T-ADMIN-003 — Manga soft-delete & restore
- Requirements: FR-ADMIN-003, NFR-DATA-002
- Goal: DELETE /admin/manga/{id} (soft) + POST restore; effect: hidden from catalog/search/detail/chapters-reading (404s everywhere public), library entries of users retained (private, reading 404 — documented); chapters cascade-hidden (no cascade-delete).
- Depends on: T-CATALOG-001, T-ADMIN-002
- Expected modules: features/admin, server/db
- Inputs: DATA_MODEL §3, edge-cases EC-ADM-02
- Expected behavior: 1. Soft-delete = one flag (transaction: manga + no others — chapters hidden via manga flag, single write). 2. Restore re-shows everything. 3. Both audited. 4. Public surfaces 404 (catalog partial index excludes deleted).
- Edge cases: delete a manga mid-reader-session (reader → unavailable state, T-READER-028); delete with active uploads (jobs continue, commit targets deleted manga → job fails `MANGA_DELETED` typed — documented).
- Security: audit; GC: hard purge = ops procedure only (RUNBOOK), never UI.
- Testing: INT-ADMIN-001 (delete/restore legs), E2E (hidden everywhere).
- Manual QA: delete → catalog/search/detail 404 → restore.
- DoD: AGENTS.md.

## T-ADMIN-004 — Chapter CRUD
- Requirements: FR-ADMIN-004, FR-ADMIN-007
- Goal: Admin chapter create/edit/soft-delete under a manga (`manga/[id]/chapters`): number (decimal), title, notes; duplicate number 409; soft-delete (hidden, progress/history orphan-preserved per DATA_MODEL); confirm dialog on delete (a11y).
- Depends on: T-CATALOG-001, T-ADMIN-002
- Expected modules: src/app/admin/manga/[id]/chapters, features/admin
- Inputs: DATA_MODEL §9, API_CONTRACT §2.7
- Expected behavior: 1. reading_order assigned on create (max+1), renumbering not in v1 (documented: manual reading_order edit is a P2, not in PRD). 2. Edit number → re-check uniqueness. 3. Delete: pages become GC-queued (T-UPLOAD-009 GC path), progress rows orphan-preserved (FK SET NULL on history).
- Edge cases: delete chapter mid-reader (unavailable state); delete chapter with progress for users (their resume skips it — T-CATALOG-009).
- Security: audit; confirm-before-destructive (UX control, not security).
- Testing: INT-ADMIN-001 (chapter legs), INT (orphan preservation).
- Manual QA: full chapter CRUD.
- DoD: AGENTS.md.

## T-ADMIN-005 — Publish management
- Requirements: FR-CHAPTER-002, FR-ADMIN-005
- Goal: Publish/unpublish manga + chapters (bulk): manga publish (all published chapters visible); chapter publish (requires ≥ 1 page → 409 CHAPTER_NOT_READY); unpublish hides immediately (no data change); UI: publish state toggles + "verify in reader" link (J-4 last step).
- Depends on: T-CATALOG-001, T-ADMIN-002/004
- Expected modules: features/admin, src/app/api/v1/admin/*
- Inputs: API_CONTRACT §2.7, admin-workflow.md §4
- Expected behavior: 1. Visibility = published(manga) ∧ published(chapter) (single rule in one function, unit-tested). 2. Unpublish during 60 s API cache window → readers see it up to 60 s (documented, NFR-PERF-013). 3. Publish is never a data mutation (pages untouched).
- Edge cases: publish 0-page chapter (409); unpublish a manga with active readers (their next nav 404s → unavailable state); republish (idempotent).
- Security: audit; visibility rule is the authz core for public content (T-11 context).
- Testing: UNIT (visibility rule), INT-ADMIN-001 (publish legs), E2E-ADMIN-001 (publish→read leg).
- Manual QA: J-4 full loop.
- DoD: AGENTS.md.

## T-ADMIN-006 — User management
- Requirements: FR-ADMIN-006, FR-AUTH-009
- Goal: `/admin/users`: list (cursor; email, name, role, status, last login, created), PATCH role/status with last-admin guard + audit; disable ⇒ sessions die on next request (verified in UI hint).
- Depends on: T-AUTH-001/008
- Expected modules: src/app/admin/users, features/admin
- Inputs: API_CONTRACT §2.7, THREAT T-07
- Expected behavior: 1. Guard + audit per contract. 2. Status change immediate effect (no waiting for expiry). 3. Search by email substring (admin QoL; parameterized).
- Edge cases: disable self with other admins (OK); demote last admin (409 with explanation).
- Security: T-07 (matrix-covered), audit.
- Testing: T-SEC-003 (role legs), INT-ADMIN-001, E2E-ADMIN-002.
- Manual QA: create test user, toggle role, verify access changes.
- DoD: AGENTS.md.

## T-ADMIN-007 — Audit log UI + sink
- Requirements: FR-ADMIN-007, NFR-SEC-012
- Goal: AuditSink port (append-only, called by every admin mutation — enforced by lint rule: admin service methods must call sink or be marked read-only) + `/admin/audit` (filter by target, cursor list, before/after JSON pretty-printed, timestamps local).
- Depends on: T-FOUND-005, T-ADMIN-002 (first writers)
- Expected modules: features/admin, server/db, src/app/admin/audit
- Inputs: DATA_MODEL §18
- Expected behavior: 1. Append-only: no update/delete code paths (DB role restriction verified in T-SEC-005). 2. before/after summarized (no secrets, no full synopsis dumps — cap 2 KB per field). 3. Reads not audited (documented).
- Edge cases: 100k events (cursor fine); deleted actor (provenance retained).
- Security: NFR-SEC-012; PII in audit = emails only (accepted, documented — admin class is trusted; NFR-OBS-006 applies to telemetry, audit is a separate trusted surface).
- Testing: INT-ADMIN-002 (append + role restriction).
- Manual QA: perform 5 mutations → see 5 events.
- DoD: AGENTS.md.

## T-ADMIN-008 — Stats dashboard
- Requirements: FR-ADMIN-008, NFR-OBS-003 (consumes metrics)
- Goal: `/admin` dashboard: counts (manga/chapters/pages/users/library entries) + upload health (24 h ready/failed, p50/p95 duration, top failure codes) from GET /api/v1/admin/stats.
- Depends on: T-UPLOAD-007 (job data), T-ADMIN-001
- Expected modules: src/app/admin, features/admin
- Inputs: API_CONTRACT §2.7 (stats op)
- Expected behavior: 1. Counts = one query each (cheap at scale). 2. Upload health from UploadJob (30 d window, indexed). 3. Refresh button + 5 min cache.
- Edge cases: fresh instance (zeroes, not errors).
- Security: admin only; no PII (counts only).
- Testing: INT-ADMIN-001 (stats leg), E2E-ADMIN-001 (dashboard leg).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-07 — Upload Pipeline (VS-7)

## T-UPLOAD-001 — Upload intake endpoint & staging
- Requirements: FR-UPLOAD-001/011, NFR-SEC-006/007
- Goal: POST /api/v1/admin/uploads: multipart intake (single ZIP or ≤ 500 image files), caps enforced at the boundary (500 MB/100 MB/500), staging write to `staging/{jobId}/` (streamed — never full-file in memory), job row created (queued), 202 + jobId; Idempotency-Key honored (24 h).
- Depends on: T-ADMIN-004, T-UPLOAD-007 (job repo)
- Expected modules: features/uploads, server/storage, src/app/api/v1/admin/uploads
- Inputs: API_CONTRACT §2.7, SECURITY.md §6
- Expected behavior: 1. Streaming multipart (memory bound). 2. Oversize → 413 UPLOAD_TOO_LARGE before staging completes (clean partial cleanup). 3. Job state machine started here (T-UPLOAD-003).
- Edge cases: 501st file (413); ZIP > 500 MB (413); network drop mid-upload (staging partial → 24 h purge, job marked failed `INTAKE_ABORTED` on next poll — documented).
- Security: T-15 (rate 2/h/account), caps (NFR-SEC-007).
- Testing: INT-UP-001 (intake legs), UNIT (caps table).
- Manual QA: upload a real 50 MB ZIP in dev.
- DoD: AGENTS.md.

## T-UPLOAD-002 — Archive container validation
- Requirements: FR-UPLOAD-002, THREAT T-08/T-09/T-10
- Goal: Container-level checks for ZIP: PK magic (real ZIP, not renamed), central directory parse with caps (entries ≤ 500, cumulative decompressed ≤ 500 MB streaming), no path-traversal/absolute/backslash/symlink/hardlink entries (skeleton: `prepareChapterUpload` validation core, T-UPLOAD-014); typed codes per table.
- Depends on: T-UPLOAD-001
- Expected modules: features/uploads (validation), shared/contracts (upload)
- Inputs: SECURITY.md §6, THREAT T-08/09/10, UNIT-UP-001/002 spec
- Expected behavior: 1. Each rejection = exact typed code + no side effects beyond job row (staging deleted). 2. Streaming (no full decompress to disk/memory). 3. Validation is pure w.r.t. storage (testable with fixture archives).
- Edge cases: nested ZIPs (treated as plain files → later decode failure `UPLOAD_IMAGE_DECODE` — documented, not recursive); ZIP with only directories (0 images → `UPLOAD_NO_IMAGES` 422); encrypted ZIP (unsupported → typed).
- Security: T-08/09/10 core defense (fixtures verified in T-UPLOAD-015).
- Testing: UNIT-UP-001/002 (pure validation table).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-003 — Safe extraction
- Requirements: FR-UPLOAD-003, NFR-SEC-008, THREAT T-08/T-09
- Goal: Streaming extractor: entries → staging files with canonicalized-destination check (prefix jail), symlink/absolute/`..` rejection, per-entry + total size caps (abort mid-stream on bomb), 30 s/page-style per-entry timeout + 15 min job watchdog.
- Depends on: T-UPLOAD-002
- Expected modules: features/uploads (extraction), server/storage
- Inputs: SECURITY.md §6 (step 3–4), THREAT T-08/09
- Expected behavior: 1. Zero writes outside `staging/{jobId}/` (test-asserted filesystem diff). 2. Bomb aborts mid-stream (10 MB → 500 MB fixture: aborts at cap, not after). 3. Watchdog kill leaves job `failed` + staging marked for purge.
- Edge cases: 2 GB single entry (per-file cap aborts at 100 MB); entry name encoding (UTF-8 flag; non-UTF8 names → reject `UPLOAD_BAD_ENTRY_NAME`).
- Security: T-08/09 (the fixture suite is the proof).
- Testing: INT-UP-001 (extraction legs + bomb), UNIT (canonicalization table).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-004 — Image normalization (sharp)
- Requirements: FR-UPLOAD-004, ADR-005, NFR-SEC-007
- Goal: Install sharp (PLANNED → SELECTED per registry); implement normalize in server/media: magic-byte decode validation → strip metadata → resize max 2560 downscale-only → emit {avif, webp, jpeg} buffers + measured dimensions/sizes; per-page timeout 30 s; concurrency ≤ 4 (job level, T-UPLOAD-006 owns scheduling).
- Depends on: T-UPLOAD-003
- Expected modules: server/media, features/uploads (pipeline step)
- Inputs: ADR-005 (pipeline contract), SECURITY.md §6 (step 5–6)
- Expected behavior: 1. Decode failure ⇒ page-level result (job fails if > 5% or first page — typed `UPLOAD_IMAGE_DECODE` with page list, capped). 2. Metadata fully stripped (test: EXIF GPS in fixture ⇒ absent in output). 3. Dimensions ≤ 10,000 pre-decode guard (header parse) + `limitInputPixels` post-guard.
- Edge cases: HEIC input (decode OK if libvips supports; else typed rejection — documented matrix); 1×1 px image (allowed, silly but valid); palette PNG (fine); CMYK JPEG (converted to sRGB — documented).
- Security: untrusted-input decode hardening (ADR-005 R2); no filename trust (bytes only).
- Testing: INT-UP-001 (normalization legs), UNIT (guard table), T-PERF-001 (size budgets).
- Manual QA: upload a scan-quality 4000 px page → variants ≤ 1 MB.
- DoD: AGENTS.md.

## T-UPLOAD-005 — Multi-format asset generation & storage
- Requirements: FR-UPLOAD-005, FR-UPLOAD-006, ADR-004/005
- Goal: Encode variants (quality params per ADR-005) + storage puts (variant per extension, asset keys = 128-bit random, layout per ADR-004) + metadata collection (dimensions, per-format byte sizes) → ready for commit (T-UPLOAD-007); GC queue for replaced assets (re-ingest).
- Depends on: T-UPLOAD-004
- Expected modules: server/media, server/storage, features/uploads
- Inputs: ADR-004 (layout), ADR-005 (encodes), DATA_MODEL §10
- Expected behavior: 1. Every page ⇒ 3 objects + metadata row data. 2. Asset key entropy (128-bit) — audited (T-11). 3. GC queue: old keys from re-ingest deleted after new set committed (eventual; logged).
- Edge cases: partial put failure (storage 502 mid-job) ⇒ job failed, staging + partial objects purged (no orphan "ready" state — commit is all-or-nothing).
- Security: T-11 (keys), T-13 (no paths in job errors).
- Testing: INT-UP-001 (variant existence + sizes), INT (failure ⇒ no orphans).
- Manual QA: inspect bucket layout for one job.
- DoD: AGENTS.md.

## T-UPLOAD-006 — Upload job orchestration (pipeline driver)
- Requirements: FR-UPLOAD-007, FR-UPLOAD-011
- Goal: The in-process job driver (skeleton: `features/uploads/upload-pipeline.ts`): consumes queued jobs (poll + in-request processing for small uploads), runs phases (validate → extract → normalize → store → commit) with state transitions (queued→validating→processing→ready/failed), per-phase duration metrics, watchdog (15 min), exactly-once commit handoff (T-UPLOAD-007).
- Depends on: T-UPLOAD-001…005, T-UPLOAD-007
- Expected modules: features/uploads, server/telemetry (spans)
- Inputs: admin-workflow.md §5/§6 (state machine), OBSERVABILITY.md §4
- Expected behavior: 1. State transitions only forward (enum + DB check constraint); failures terminal. 2. One job span with phase events. 3. Small upload (< 50 MB) may process inline (202 → ready in ~1 min); large ⇒ background poll (documented threshold). 4. App restart mid-job ⇒ job stays processing; watchdog (next boot's sweep) marks failed `ops.timeout` (RUNBOOK 3.1).
- Edge cases: two jobs same chapter concurrent (serialized per chapter — advisory lock on chapter id; documented); job queue depth (FIFO, cap 10 pending — overflow 429 documented).
- Security: audit on state→failed; no secrets in job messages.
- Testing: INT-UP-001 (full happy path), UNIT (state machine transitions), INT (restart behavior).
- Manual QA: admin UI watch a job live.
- DoD: AGENTS.md.

## T-UPLOAD-007 — Page metadata commit & job repository
- Requirements: FR-UPLOAD-006, NFR-DATA-001
- Goal: UploadJobRepository (skeleton: `features/uploads/upload.repository.ts`) + the commit transaction: insert ChapterPage set (numbered 1..N, asset keys, dims, sizes) + update chapter (page_count, state ready) + job→ready in ONE transaction; contiguity check (1..N no gaps); re-ingest: replace-in-transaction (old rows deleted, GC queued).
- Depends on: T-UPLOAD-005, T-FOUND-005
- Expected modules: features/uploads, server/db/repositories
- Inputs: DATA_MODEL §10/§16
- Expected behavior: 1. Atomic: no "ready chapter with missing pages" state (crash-mid-commit ⇒ transaction rolls back, job failed, staging purged). 2. Contiguity asserted (service invariant + constraint). 3. Job states queryable for UI + stats (T-ADMIN-008).
- Edge cases: concurrent commit same chapter (advisory lock — T-UPLOAD-006); commit after manga deleted (job fails `MANGA_DELETED`).
- Security: T-13 (no asset paths in errors — keys only).
- Testing: INT-UP-001 (commit legs incl. crash-simulation via connection drop), UNIT (contiguity).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-008 — Multipart/presigned large uploads
- Requirements: FR-UPLOAD-008
- Goal: For uploads > 100 MB: presigned part uploads (S3 presign via the storage port) — client uploads parts directly to storage, then POSTs completion (job intake with `stagingKey` reference instead of body); progress % from completed parts; resumable (re-PUT same part).
- Depends on: T-UPLOAD-001, T-UPLOAD-005 (port extension: presign)
- Expected modules: features/uploads, server/storage
- Inputs: API_CONTRACT §2.7 (uploads op — part 2), ADR-004
- Expected behavior: 1. Parts 16–100 MB; signed URLs server-internal lifetime 15 min. 2. Completion validates part ETags. 3. Abandoned part sets: 24 h lifecycle (same staging rule).
- Edge cases: part uploaded but completion never sent (lifecycle purge); part ETag mismatch (415 typed); network drop (resume from last part).
- Security: presigned URL scope (exact key, PUT only, expiry); no browser-visible bucket keys.
- Testing: INT-UP-002.
- Manual QA: 300 MB file in dev (MinIO).
- DoD: AGENTS.md.

## T-UPLOAD-009 — Chapter re-ingest (replace)
- Requirements: FR-UPLOAD-009
- Goal: POST /admin/chapters/{id}/reingest: same pipeline targeting an existing chapter; on commit: new asset keys, old asset set GC-queued; reader effect: in-flight readers see the new set (keys are random — old URLs 404 after commit; documented: refresh once per T-READER-028 logic).
- Depends on: T-UPLOAD-006/007
- Expected modules: features/uploads
- Inputs: API_CONTRACT §2.7, EC-UP-05
- Expected behavior: 1. Page count may change (readers' saved pages clamp on next open — EC-RDR-10). 2. Progress rows for the chapter retained (page clamped later, not now — documented). 3. Old objects deleted after 24 h (grace for in-flight).
- Edge cases: re-ingest with 0 valid pages (chapter stays with old pages? NO — reingest is replace-or-fail: failure keeps old set, typed job failure — documented rule); re-ingest a deleted chapter (404).
- Security: audit (`chapter.reingest`); GC is the only mutation of old assets (logged).
- Testing: INT-UP-001 (reingest leg), E2E (reader mid-reingest).
- Manual QA: replace a test chapter, verify reader.
- DoD: AGENTS.md.

## T-UPLOAD-010 — Upload UI
- Requirements: FR-UPLOAD-011, NFR-A11Y-001
- Goal: `/admin/uploads` + per-chapter upload panel: file picker (drag-drop + button, a11y), client-side pre-checks (size/count hints — advisory only, server authoritative), job list with live state (poll 3 s; states per machine), failure reason display (typed → human message + "try again"), link to result (chapter / reader preview).
- Depends on: T-UPLOAD-006/007, T-ADMIN-001
- Expected modules: src/app/admin/uploads, src/app/admin/manga/[id]/chapters
- Inputs: admin-workflow.md §5, ACCESSIBILITY.md §5
- Expected behavior: 1. State machine rendered exactly (no invented states). 2. Failure = message + cause code (visible to admin) + action. 3. Live updates without refresh; poll stops on terminal state.
- Edge cases: job fails while page open (state updates in place); browser closed mid-upload (job continues server-side; UI shows on return).
- Security: no file contents rendered (names truncated, sanitized display).
- Testing: E2E-ADMIN-001 (upload leg), axe.
- Manual QA: J-4/J-5 with real + corrupt files.
- DoD: AGENTS.md.

## T-UPLOAD-011 — Auto cover generation
- Requirements: FR-UPLOAD-010 (P2), FR-ADMIN-002
- Goal: If a manga has no cover and a chapter job commits: generate cover from page 1 (WebP 1200 px + JPEG) → set manga.cover_asset_key in the commit transaction (or follow-up, documented: same transaction for atomicity).
- Depends on: T-UPLOAD-005/007
- Expected modules: features/uploads, server/media
- Inputs: DATA_MODEL §3
- Expected behavior: 1. Only when cover is null (never overwrite admin-set cover). 2. Cover uses the same normalization path (max 1200). 3. Job for a chapter of a coverless manga triggers it once.
- Edge cases: first chapter's page 1 is a scan with logo (admin can overwrite later — documented); re-ingest doesn't change cover (page 1 may differ — documented, admin overrides).
- Security: —.
- Testing: INT-UP-001 (cover leg).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-012 — Upload limits configuration
- Requirements: NFR-SEC-006/007
- Goal: Central limits module (single source: caps, rate limits, timeouts) env-overridable per DEPLOYMENT.md §3 (UPLOAD_* vars); all pipeline code reads from it (no magic numbers); default table documented.
- Depends on: T-UPLOAD-001
- Expected modules: shared/validation (limits), features/uploads
- Inputs: NFR-SEC-007 values
- Expected behavior: 1. One module, typed, unit-tested (defaults match NFR). 2. Overrides validated (sane ranges — e.g., max files 1–2000). 3. Limit values appear in error messages (human: "limit is 500 files").
- Edge cases: —.
- Security: the caps ARE the control (T-09).
- Testing: UNIT (defaults table), INT (override honored).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-013 — Upload rate limiting & job queue health
- Requirements: NFR-SEC-006, THREAT T-15
- Goal: Upload intake limiter (2 jobs/h/account) + queue health (pending cap 10 → 429 with retry hint) + job-age metrics (oldest pending) feeding the stats dashboard + alert (queue age > 30 min).
- Depends on: T-UPLOAD-001/006
- Expected modules: features/uploads, server/telemetry
- Inputs: NFR-SEC-006, OBSERVABILITY.md §5
- Expected behavior: 1. Per-account window (not just IP — admin accounts are few). 2. Queue cap prevents unbounded staging growth (disk fill defense, ADR-009 R2). 3. Alert wired (threshold in OBSERVABILITY §5).
- Edge cases: 11th job/hour (429 + Retry-After computed); queue full (429 distinct code).
- Security: T-15.
- Testing: INT (limits + queue cap).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-014 — prepareChapterUpload (validation contract)
- Requirements: FR-UPLOAD-002, NFR-SEC-007/008, THREAT T-08/T-09/T-10
- Goal: The canonical pure validation function (skeleton exists: `features/uploads/prepare-chapter-upload.ts`): input inspection (container, entries, caps, names, sizes, MIME allow-list, dimension pre-checks) → PreparedChapterUpload (ordered image manifest + rejections) or typed error. This is the security-critical pure core — maximally unit-tested, zero I/O.
- Depends on: T-UPLOAD-002 (behavior spec)
- Expected modules: features/uploads
- Inputs: SECURITY.md §6, UNIT-UP-001/002, THREAT T-08/09/10
- Expected behavior: 1. Total function over the documented input table (every fixture → exact code). 2. Pure (same input ⇒ same output; test-asserted). 3. Documented invariants in the skeleton comments are the spec (preserve them).
- Edge cases: the full attack fixture set (below).
- Security: THE upload threat model's first line (fixtures verified in T-UPLOAD-015).
- Testing: UNIT-UP-001/002 (canonical).
- Manual QA: —.
- DoD: AGENTS.md.

## T-UPLOAD-015 — Upload security test suite (attack fixtures)
- Requirements: NFR-SEC-007/008, THREAT T-08/T-09/T-10, GA gate M-4
- Goal: Fixture-driven suite (fixtures generated in CI, not committed binaries): Zip Slip (`../../`), absolute path, backslash-absolute, symlink entry, hardlink entry, decompression bomb (10 MB → 500 MB), 501 files, 110 MB file, 501 MB total, 9999×9999 px image, spoofed `.jpg` (script bytes), spoofed `.png` (exe bytes), encrypted ZIP, nested ZIP, non-image-only archive. Each ⇒ exact typed code + **zero side effects** (filesystem diff + bucket diff + DB state asserted). Plus resource monitors (RSS delta, disk delta) on bomb cases.
- Depends on: T-UPLOAD-014, T-UPLOAD-003/004
- Expected modules: tests/integration (fixtures in tests/fixtures/generated)
- Inputs: THREAT_MODEL T-08/09/10 (verification column), TEST_STRATEGY INT-UP-001
- Expected behavior: 1. 100% of fixtures → correct typed code, no side effects. 2. Resource deltas bounded (asserted thresholds). 3. This suite green = T-08/09/10 verified (feeds T-SEC-007).
- Edge cases: fixture generation itself (deterministic, versioned).
- Security: the proof layer for the highest-risk surface.
- Testing: INT-UP-001 (this suite).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-08 — Search (VS-8)

## T-SEARCH-001 — Search service & API
- Requirements: FR-SEARCH-001/002/003/004, NFR-PERF-005
- Goal: `GET /api/v1/search` per contract: query parsing (trim, ≤ 120), multi-field search (title/alias via trigram; creator/tag via name match), ranking composition (weights per T-SEARCH-003), cursor pagination, `totalHint` (cheap estimate via pg count or omit — documented: omit, hint = null in v1).
- Depends on: T-SEARCH-002, T-CATALOG-001 (vocab queries)
- Expected modules: features/search, src/app/api/v1/search
- Inputs: API_CONTRACT §2.2, DATA_MODEL §19
- Expected behavior: 1. One composed query (UNION with per-field weights, parameterized). 2. ≤ 400 ms p95 at 10k titles (load-tested, T-SEARCH-005). 3. Empty q → 422; whitespace-only → 422.
- Edge cases: q with quotes/backslashes (inert — parameterized + trigram); 10k-title run (load fixture from T-FOUND-012 flag).
- Security: T-02 (injection fuzz reuses this endpoint); no SQL fragments from input.
- Testing: INT-SEARCH-001, injection fuzz (T-SEC-002 consumes).
- Manual QA: search seeded catalog.
- DoD: AGENTS.md.

## T-SEARCH-002 — Search indexes (trigram)
- Requirements: FR-SEARCH-001, NFR-PERF-005, NFR-PERF-014
- Goal: `pg_trgm` GIN indexes on `manga.title`, `manga_alias.alias` (created in the initial migration — coordinate with T-FOUND-006/005; this task verifies + tunes operator choices: `gin_trgm_ops`, similarity threshold), EXPLAIN verification (no seq scan at 10k rows).
- Depends on: T-FOUND-006, T-SEARCH-001 (query shape)
- Expected modules: server/db (migrations), drizzle/
- Inputs: DATA_MODEL §19, PERFORMANCE.md §8
- Expected behavior: 1. Prefix + contains + typo-adjacent (similarity) all index-assisted. 2. EXPLAIN plan stable (CI gate, T-PERF-004 list). 3. Index size acceptable (< 50 MB at 10k titles — recorded).
- Edge cases: very short q (1–2 chars → trigram can't; fallback: prefix-only `LIKE 'q%'` path, documented); Unicode titles (normalized? no — byte-exact, documented limitation for CJK: trigram weak for CJK → CJK titles get prefix fallback, documented EC-SE-01).
- Security: —.
- Testing: INT-SEARCH-001 (index used, plan check), T-PERF-004 (gate).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEARCH-003 — Ranking rules
- Requirements: FR-SEARCH-004
- Goal: Pure ranking function (unit-first): score bands exact > prefix > contains(trigram similarity) > creator/tag related; tie-break: title A-Z, then id; stable across equal scores (documented).
- Depends on: T-SEARCH-001
- Expected modules: features/search
- Inputs: UNIT-SEARCH-001 spec, API_CONTRACT (score-band field)
- Expected behavior: 1. Deterministic (same inputs ⇒ same order, tested). 2. Bands exposed in SearchHit (client can show "matches title" vs "matches tag"). 3. No floating-point instability (integer scores, documented scale).
- Edge cases: same title on 2 manga (alias collision — both listed, tie-break by title/id); query matching both title and tag (title band wins).
- Security: —.
- Testing: UNIT-SEARCH-001 (canonical).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEARCH-004 — Search UI
- Requirements: FR-SEARCH-005, NFR-A11Y-002
- Goal: `/search`: debounced (300 ms) search box, results list (kind badge, title, match-field hint), empty state ("No results for 'x' — try…"), keyboard (Enter forces immediate, Esc clears, results list arrow-navigable), URL sync (`?q=`).
- Depends on: T-SEARCH-001, T-FOUND-004
- Expected modules: src/app/search
- Inputs: ACCESSIBILITY.md §5, reader-independent a11y rules
- Expected behavior: 1. Debounce: last input wins; rapid typing never drops the final request. 2. Empty/short query (no q yet) → no request (saves rate budget). 3. a11y: results announced (role=status with count).
- Edge cases: paste of 120+ chars (truncated client-side to 120 + notice); search during offline (error banner, no crash); 10k results (cursor load-more).
- Security: —.
- Testing: E2E-SEARCH-001, axe.
- Manual QA: keyboard search journey.
- DoD: AGENTS.md.

## T-SEARCH-005 — Search rate limit, load & injection tests
- Requirements: NFR-SEC-006, NFR-PERF-005, THREAT T-02/T-15
- Goal: Search limiter (30/min/IP) + 10k-title load test (p95 ≤ 400 ms, harness recorded) + 50-payload injection suite (SQL fragments, deep quotes, Unicode tricks, 120-char max) asserting 4xx-or-valid and zero leakage.
- Depends on: T-SEARCH-001/002
- Expected modules: features/search (limiter), tests/integration
- Inputs: NFR-SEC-006, THREAT T-02, TEST_STRATEGY
- Expected behavior: 1. 429 + Retry-After at limit. 2. Load report artifact (VS-8 exit). 3. Injection: no 500s, no data leakage, no plan regressions.
- Edge cases: —.
- Security: T-02/T-15 verification (feeds T-SEC-007).
- Testing: INT-SEARCH-001 (extensions), T-PERF-004.
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEARCH-006 — Search empty-state & discovery integration
- Requirements: FR-SEARCH-005 (empty), FR-CATALOG-001 (handoff)
- Goal: Polish: zero-catalog search (message: "The catalog is empty — content is added by the curator"); failed search (rate-limited message distinct from empty results); results → detail handoff preserves context (back returns to results).
- Depends on: T-SEARCH-004
- Expected modules: src/app/search
- Inputs: edge-cases EC-SE-02
- Expected behavior: 1. Distinct states: empty query / no results / rate-limited / error (each a labeled state, never blank). 2. Browser back → results restored (URL-driven).
- Edge cases: —.
- Security: —.
- Testing: E2E-SEARCH-001 (state legs).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-09 — Security Hardening (VS-9)

## T-SEC-001 — Security headers & CSP tuning
- Requirements: NFR-SEC-0011 (NFR-SEC-011), THREAT T-01
- Goal: Enforce SECURITY.md §5 at the edge (Caddyfile in repo) AND in-app (belt): CSP (self-only; no inline eval; Next.js nonces audited and minimized), HSTS, nosniff, Referrer-Policy, Permissions-Policy (fullscreen allowed implicitly — verify it's not denied by mistake); header matrix test on every route class.
- Depends on: T-FOUND-003
- Expected modules: docker (Caddyfile), src/app (headers)
- Inputs: SECURITY.md §5, OBSERVABILITY (no)
- Expected behavior: 1. Header matrix green on: HTML pages, API JSON, media, healthz. 2. CSP violation reports (optional log sink, dev only). 3. Any inline script requires a documented exception list (empty in v1 target).
- Edge cases: Turbopack dev mode (headers relaxed in dev, asserted in dev-only test — prod strict).
- Security: T-01 backstop.
- Testing: INT (header matrix), E2E spot.
- Manual QA: devtools Security tab on 3 route classes.
- DoD: AGENTS.md.

## T-SEC-002 — Output encoding & injection sweep
- Requirements: NFR-SEC-016, THREAT T-01/T-02
- Goal: Static + runtime sweep: (a) no `dangerouslySetInnerHTML` without a review marker (lint rule); (b) no user strings into attributes via template tricks (ESLint + code review checklist); (c) render test: seeded malicious strings in every user/admin field (title, alias, synopsis, notes, creator, tag, bookmark note, chapter title) asserted literal in DOM on catalog/detail/reader/chapter-list/admin screens; (d) SQLi fuzz results archived.
- Depends on: T-FOUND-011 (lint), T-SEARCH-005
- Expected modules: lint config, tests
- Inputs: THREAT T-01/T-02, SECURITY.md §4
- Expected behavior: 1. Zero `dangerouslySetInnerHTML` (or zero exceptions). 2. All malicious seeds render as text. 3. Fuzz archive in the threat verification report.
- Edge cases: markdown? (no markdown rendering in v1 — plain text only, documented).
- Security: T-01/T-02 verification (feeds T-SEC-007).
- Testing: E2E (render sweep), static (lint).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEC-003 — Authorization matrix sweep (IDOR/privilege)
- Requirements: THREAT T-04/T-07, FR-AUTH-007/008
- Goal: The full matrix: every route (page + API) × {anonymous, reader, admin, disabled-reader, reader-with-other-ids, reader-with-admin-forgery-payloads} ⇒ expected status per API_CONTRACT; runs in CI; any regression fails the gate; consumes T-AUTH-013/T-LIB-009/T-UPLOAD harnesses.
- Depends on: T-AUTH-007/008, T-LIB-009
- Expected modules: tests/integration (matrix generator)
- Inputs: API_CONTRACT (auth columns), THREAT T-04/T-07
- Expected behavior: 1. 100% of (route × identity) cells match the contract. 2. Matrix is generated from the route list (new routes must declare expected statuses — compiler of the security policy). 3. Report artifact (feeds T-SEC-007 + RUNBOOK incident context).
- Edge cases: new route added without matrix entry ⇒ CI fails (policy completeness).
- Security: THE access-control verification (GA gate).
- Testing: INT (this suite).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEC-004 — Upload attack verification (consolidated)
- Requirements: THREAT T-08/T-09/T-10
- Goal: Run the T-UPLOAD-015 suite as the verification record + add two live checks: (a) staging prefix diff after each fixture (filesystem + bucket), (b) job error messages contain no paths (T-13). Output: verification report section (feeds T-SEC-007).
- Depends on: T-UPLOAD-015
- Expected modules: tests/integration (report)
- Inputs: THREAT T-08/09/10
- Expected behavior: 1. All fixtures: typed code + zero side effects + clean messages. 2. Report signed into the slice exit doc.
- Edge cases: —.
- Security: verification layer (GA gate M-4).
- Testing: INT-UP-001 (this suite).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEC-005 — Secrets, config & DB-privilege audit
- Requirements: NFR-SEC-009, THREAT T-12/T-13
- Goal: (a) gitleaks clean (CI) + manual review of git history; (b) DB role audit: app role has NO DDL, NO access to audit-table UPDATE/DELETE (test: attempt UPDATE on audit as app role ⇒ denied); maintenance role separate; (c) SSRF static check: no runtime-variable URLs in `fetch`/SDK calls outside env-configured endpoints (script, archived); (d) error-body leak sweep: every typed error's body scanned for path/secret patterns.
- Depends on: T-FOUND-011, T-OBS-003 (redaction)
- Expected modules: CI, scripts/audit
- Inputs: THREAT T-12/T-13, SECURITY.md §9
- Expected behavior: 1. All four checks green + archived report. 2. App role permissions encoded in a migration (testable, not just ops).
- Edge cases: —.
- Security: T-12/T-13 verification.
- Testing: INT (DB role attempts), static (URL scan), CI (gitleaks).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEC-006 — Supply chain & bundle scan
- Requirements: NFR-SEC-013, THREAT T-16
- Goal: CI: `npm audit --audit-level=high` blocking; lockfile-integrity check (no drift vs committed); bundle scan: client bundles scanned for SESSION_SECRET patterns + known-leak strings (regex set, documented); dependency review checklist in the PR template (new deps must cite registry entry).
- Depends on: T-FOUND-011
- Expected modules: CI, scripts/scan
- Inputs: SECURITY.md §10, THREAT T-16
- Expected behavior: 1. A high-severity advisory fails CI (tested with a pinned vulnerable fixture dep in a test-only job). 2. Bundle scan green on all routes' bundles. 3. PR template gate (docs).
- Edge cases: —.
- Security: T-13/T-16 verification.
- Testing: CI (this is the test).
- Manual QA: —.
- DoD: AGENTS.md.

## T-SEC-007 — Threat model verification pass (GA gate)
- Requirements: THREAT_MODEL.md (all rows), PRD M-4
- Goal: Consolidate all verification artifacts (T-AUTH-013, T-LIB-009, T-UPLOAD-015/004, T-SEC-002/003/004/005/006) into the final threat verification report: every THREAT row ⇒ status (verified / accepted residual + owner). Zero open high/critical = GA gate (M-4). Also: OWASP ZAP baseline scan on dev env (no high findings), report archived.
- Depends on: T-SEC-001…006, T-AUTH-013, T-LIB-009, T-UPLOAD-015
- Expected modules: docs (report), CI (ZAP job)
- Inputs: THREAT_MODEL.md coverage table
- Expected behavior: 1. Report: 18 threat rows × status. 2. Any residual is explicit (e.g., "enumeration of email on register" — accepted, documented in THREAT doc). 3. ZAP report archived.
- Edge cases: —.
- Security: the GA security gate.
- Testing: consolidated (this is the gate).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-10 — Observability (VS-10)

## T-OBS-001 — Tracing (OTel init + spans)
- Requirements: NFR-OBS-002, ADR-008
- Goal: `server/telemetry/otel.ts` (skeleton exists): init traces (W3C context), HTTP server spans (Next instrumentation or manual on route handlers), service spans (catalog.list, progress.save, uploads.processJob), DB spans (postgres instrumentation package), storage spans (manual around ObjectStoragePort calls); traceId in pino child (T-FOUND-008 integration); span budget ≤ 8 on reader path.
- Depends on: T-FOUND-008
- Expected modules: server/telemetry
- Inputs: OBSERVABILITY.md §2, ADR-008
- Expected behavior: 1. A catalog request trace: HTTP → service → DB (visible in collector). 2. Reader open: ≤ 8 spans. 3. OTLP export to env endpoint; off in dev by default.
- Edge cases: exporter down (spans dropped, app unaffected — tested); ESM/CJS init order (Next bootstrap hook — the classic pitfall, documented).
- Security: NFR-OBS-006 (attributes per OBSERVABILITY §2.3 — no user id).
- Testing: INT-OBS-001 (trace shape), UNIT (span budget assert).
- Manual QA: dev: local Tempo, open a chapter, inspect trace.
- DoD: AGENTS.md.

## T-OBS-002 — Metrics (OTel init + instruments)
- Requirements: NFR-OBS-003/007
- Goal: Metrics SDK init (OTLP HTTP push 30 s) + every instrument in OBSERVABILITY.md §4 (http, db, storage, process, auth, sessions, uploads, reader beacons, search, media) with exact names/labels; label cardinality review (route = template, never id).
- Depends on: T-OBS-001
- Expected modules: server/telemetry
- Inputs: OBSERVABILITY.md §4
- Expected behavior: 1. All metrics present in Prometheus after 1 minute of traffic. 2. Cardinality bounded (assert label sets in test). 3. Process metrics from the runtime (RSS, CPU).
- Edge cases: push failure (backpressure bounded, app unaffected).
- Security: no PII labels (NFR-OBS-006 — lint on label names, documented allow-list).
- Testing: INT-OBS (metric presence), UNIT (cardinality).
- Manual QA: Grafana panel per §7.
- DoD: AGENTS.md.

## T-OBS-003 — Log conventions completion + redaction tests
- Requirements: NFR-OBS-001/006, THREAT T-14
- Goal: Complete OBSERVABILITY §3: request-id injection on all responses (x-request-id echo), event logs (auth failures, job transitions, media failures) with the field contract; redaction function hardening (email, secret env values, long paths, filenames) + the log-capture test suite (assert no PII/secret in captured output for a scripted run: register + login + upload + media fetch).
- Depends on: T-FOUND-008
- Expected modules: server/telemetry
- Inputs: OBSERVABILITY.md §3, THREAT T-13/T-14
- Expected behavior: 1. Every log line has requestId on request paths. 2. Redaction table green (emails, SESSION_SECRET value, S3 keys, paths). 3. No per-image access logs (volume rule).
- Edge cases: non-serializable values (safe stringify tested).
- Security: T-14 verification.
- Testing: UNIT-OBS-001, INT (log capture).
- Manual QA: —.
- DoD: AGENTS.md.

## T-OBS-004 — Error reporting & readiness
- Requirements: NFR-OBS-004/005, OBSERVABILITY §5/§6
- Goal: `/readyz` (PG ping + storage canary, 503 with `missing[]`), canary object at boot, error taxonomy → log level/alert mapping wired (5xx = error + alert rule config), chaos mini-tests: PG down ⇒ readyz 503 + 5xx mapping clean; storage down ⇒ media 502 mapping, readyz 503.
- Depends on: T-FOUND-007, T-FOUND-009
- Expected modules: src/app/readyz, server/telemetry
- Inputs: OBSERVABILITY §5/§6, API_CONTRACT §2.9
- Expected behavior: 1. readyz < 10 ms typical; 503 body per contract. 2. Chaos tests green (compose service kill). 3. Alert rules exported (Prometheus rule file in repo, T-PROD-003 applies).
- Edge cases: canary key missing (boot recreates; race on 2 instances ⇒ idempotent PUT, documented).
- Security: readyz leaks nothing (no versions, no detail beyond missing[]).
- Testing: INT-OBS-001, INT (chaos), E2E-OBS-001.
- Manual QA: kill PG in dev → readyz 503 → restart → 200.
- DoD: AGENTS.md.

## T-OBS-005 — Nightly sweeps (sessions, staging, canary)
- Requirements: ADR-006 (sweep), NFR-DATA-005 (staging purge), OBSERVABILITY §6
- Goal: Ops entrypoint `scripts/maintenance.mjs` (cron on the host): expired-session sweep, staging > 24 h purge, canary re-verify, stale "processing" job marking (ops.timeout, RUNBOOK 3.1); idempotent, logged, alert on anomaly counts.
- Depends on: T-AUTH-006, T-UPLOAD-006
- Expected modules: scripts/, server (repos)
- Inputs: RUNBOOK §1/§3.1
- Expected behavior: 1. One command, safe to re-run. 2. Counts logged (swept N sessions, M staging objects). 3. Anomaly (0 jobs but high queue?) → log warn.
- Edge cases: clock skew (staging age uses storage timestamps, not local clock — documented).
- Security: maintenance runs with app role (sweeping) — staging purge needs storage key (host cron env, documented separation).
- Testing: INT (sweep legs on seeded stale rows).
- Manual QA: dev: run with stale fixtures.
- DoD: AGENTS.md.

## T-OBS-006 — Dashboards & alert rules
- Requirements: NFR-OBS-005, OBSERVABILITY §5/§7
- Goal: Grafana dashboards (4 per OBSERVABILITY §7) as JSON in repo (`observability/dashboards/`) + Prometheus alert rule file (OBSERVABILITY §5 table verbatim) + provisioning config; import test (fresh Grafana boots with dashboards + rules).
- Depends on: T-OBS-001/002
- Expected modules: observability/ (new dir), docker (collector compose)
- Inputs: OBSERVABILITY §5/§7
- Expected behavior: 1. `docker compose up collector` → dashboards present, rules loaded. 2. Alert annotations include runbook links (RUNBOOK §3 ids). 3. Dashboard variables (env, route) work.
- Edge cases: Grafana version drift (JSON compatibility — pinned grafana version in compose).
- Security: Grafana binds to the VM (not public) — compose network rule, documented.
- Testing: INT (collector boot + provision check).
- Manual QA: walk all 4 dashboards.
- DoD: AGENTS.md.

## T-OBS-007 — Client telemetry (beacon)
- Requirements: NFR-OBS-007, FR-READER-018 (failure signals)
- Goal: Beacon endpoint (POST /api/v1/telemetry/beacon) per contract (schema-whitelisted, ≤ 100 events, 16 KB, rate 60/min/IP, 204) + client beacon module (batch, flush on visibilitychange/unload, drop-on-429, no PII — chapterId is public content id, acceptable, documented) + reader failure/session events wired (T-READER-017/026 consumers) + metric ingestion (`yomi_reader_*`).
- Depends on: T-OBS-002, T-FOUND-009
- Expected modules: src/app/api/v1/telemetry/beacon, features/reader (client)
- Inputs: OBSERVABILITY §1/§4, API_CONTRACT §2.8
- Expected behavior: 1. Junk payloads (extra fields, huge, wrong types) → 422, dropped silently client-side. 2. Events appear in `yomi_reader_*` metrics. 3. Beacon failure never breaks reading (fire-and-forget).
- Edge cases: 101 events (422 — client splits next time); clock skew in t (accepted, no validation beyond presence).
- Security: NFR-OBS-006 (whitelist), T-15 (rate).
- Testing: UNIT (client batching), INT (endpoint), E2E (E2E-OBS-001 beacon leg).
- Manual QA: dev: cause image failures → see metric.
- DoD: AGENTS.md.

---

# EPIC-11 — Performance (VS-4 partial; VS-9/11 completion)

## T-PERF-001 — Image size & format tuning
- Requirements: NFR-PERF-009, ADR-005
- Goal: Encode the ADR-005 pipeline with measured quality params (AVIF q, WebP q, JPEG q) tuned against the size budget (≤ 1 MB hard, ≤ 500 KB typical) on a representative manga page set (synthetic gradients + 3 real-structure test scans, dev-only); per-variant byte sizes recorded at ingest (already in ChapterPage) + assertion test (budget violations fail INT); document final params.
- Depends on: T-UPLOAD-004/005
- Expected modules: server/media (params), tests (budget assert)
- Inputs: PERFORMANCE.md §4, ADR-005
- Expected behavior: 1. 2560 px page ⇒ AVIF ≤ 500 KB typical (recorded p95 on the set). 2. Hard 1 MB never exceeded (asserted). 3. Report: per-format size table (artifact).
- Edge cases: photo-like pages (worst case for AVIF — included in set).
- Security: —.
- Testing: INT (budget assert on every ingest job).
- Manual QA: —.
- DoD: AGENTS.md.

## T-PERF-002 — Cache header pass
- Requirements: NFR-PERF-013, FR-MEDIA-001
- Goal: Verify/enforce the full cache matrix: media immutable + ETag; API private 60 s SWR 60 s (catalog/detail/chapters); private data no-store; HTML no-store; healthz no-store; beacon no-store; 404s no-store (short max-age 5 s on 404 media to blunt enumeration probing, documented).
- Depends on: T-CATALOG-010, T-READER-002, all API tasks
- Expected modules: app route wrappers (shared cache helper)
- Inputs: PERFORMANCE.md §4/§7, API_CONTRACT §1
- Expected behavior: 1. One helper sets headers per contract class (no per-route drift). 2. Header matrix test green (reuses T-SEC-001 harness). 3. Re-ingest ⇒ new keys ⇒ immutable safe (no stale-variant bug: old key still serves old bytes — documented, GC handles).
- Edge cases: CDN-less 404 cache (5 s only, not immutable).
- Security: T-11 (404 cache short, documented).
- Testing: INT (header matrix), E2E (media revalidation spot).
- Manual QA: devtools network, reload patterns.
- DoD: AGENTS.md.

## T-PERF-003 — Bundle budget & CI gate
- Requirements: NFR-PERF-007
- Goal: CI script: build → measure gzip sizes: initial reader JS ≤ 250 KB, whole-page ≤ 400 KB (all pages); fail on overflow; per-route report in the PR comment (size deltas vs base).
- Depends on: T-FOUND-011
- Expected modules: scripts/perf-bundle.mjs, CI
- Inputs: PERFORMANCE.md §2
- Expected behavior: 1. Green at baseline; a deliberate 300 KB chunk fails CI (tested). 2. Report: per-route initial/total table. 3. RSC/client boundary violations show up as bloat (catches leaks early).
- Edge cases: Turbopack build output shape (parse the right manifest — versioned parsing, documented).
- Security: — (leak scanning is T-SEC-006's job).
- Testing: CI (self-test with fixture chunk).
- Manual QA: —.
- DoD: AGENTS.md.

## T-PERF-004 — Query index audit (EXPLAIN gate)
- Requirements: NFR-PERF-014
- Goal: CI job: for every hot query (list maintained in `tests/perf/queries.json` with expected index), run EXPLAIN ANALYZE on a seeded 10k-title DB, assert: index used (no seq scan > 10k rows), ≤ 20 ms p95 (100 runs median), plan stable (no nestloop explosion on joins). New hot queries must be added to the list (PR checklist).
- Depends on: T-FOUND-005/006, all repo tasks
- Expected modules: tests/perf, scripts
- Inputs: DATA_MODEL (index list), PERFORMANCE.md §5/§6
- Expected behavior: 1. Gate green on the full list. 2. A deliberately unindexed variant fails (tested with a dev-only drop-index step). 3. Report artifact per run (PR comment).
- Edge cases: PG version plan differences (plan assertions are operator-level, not byte-exact).
- Security: —.
- Testing: CI (this is the test).
- Manual QA: —.
- DoD: AGENTS.md.

## T-PERF-005 — Lab performance harness
- Requirements: NFR-PERF-001/004/006
- Goal: Reusable lab harness (Playwright + Lighthouse CI or CDP metrics): warm-cache + cold-cache runs of key routes (catalog p1, detail, chapter open, search), LCP/INP/CLS/TTFB capture, request-count capture, network-throttle presets (4G-fast, 4G-slow, 3G-equivalent); output: report JSON + human summary; wired to CI at milestone gates (VS-2, VS-4, VS-9, VS-11).
- Depends on: T-FOUND-011, T-CATALOG-003, T-READER-001
- Expected modules: tests/perf (harness), CI
- Inputs: PERFORMANCE.md §2/§10
- Expected behavior: 1. Deterministic-enough (3 runs, median; variance noted). 2. Fails the gate when a budget is breached (budgets in one config). 3. Artifacts archived per milestone (slice exit evidence).
- Edge cases: CI machine variance (budgets have 10% headroom in CI vs 0% in manual field checks, documented).
- Security: —.
- Testing: CI (harness self-run on skeleton routes).
- Manual QA: —.
- DoD: AGENTS.md.

## T-PERF-006 — Slow-network pass
- Requirements: NFR-PERF-015, NFR-PERF-006
- Goal: 3G-equivalent profile (lab + real phone if available): reader usability criteria (first page ≤ 10 s, subsequent pages progressive, no spinner > 10 s, failure retries work), priority ladder verification (T-READER-020 active-page-first), data-volume report per 20-page scroll (bytes + requests); report for VS-4 exit.
- Depends on: T-READER-020, T-PERF-005
- Expected modules: tests/perf (profiles)
- Inputs: PERFORMANCE.md §3/§4, reader-behavior.md §15
- Expected behavior: 1. Criteria green on 500-page chapter (the hard case). 2. Report: timeline screenshots + numbers. 3. Any parameter change (window/priority) recorded with rationale.
- Edge cases: tab hidden 60 s on 3G (resume: no storm — T-READER-020 pause rule).
- Security: —.
- Testing: E2E (throttled marathon), T-PERF-005 (preset).
- Manual QA: real phone on throttled data.
- DoD: AGENTS.md.

## T-PERF-007 — Memory profiling (reader + upload)
- Requirements: NFR-PERF-010, M-6
- Goal: (a) Reader: CDP heap snapshots during the 500-page marathon (E2E-READER-007 integration): residency ≤ 12 decoded, heap growth ≤ 150 MB/30 min, no monotonic growth (3 cycles: forward 100 → back 100 → forward, garbage between); (b) Upload: RSS curve during a 200-page job (≤ 2 GB container limit, peak recorded); both produce leak-signal reports (artifacts).
- Depends on: T-READER-019/026, T-UPLOAD-006
- Expected modules: tests/perf
- Inputs: PERFORMANCE.md §6, OBSERVABILITY §4 (rss metric)
- Expected behavior: 1. Reader: no cycle-over-cycle baseline climb (leak = fail + task). 2. Upload: peak RSS recorded ≤ 2 GB headroom (container 2 GB, alert 1.5 GB). 3. Reports archived.
- Edge cases: iOS not directly profilable in CI (manual at VS-9; documented gap).
- Security: —.
- Testing: E2E (marathon + CDP), INT (upload RSS monitor in T-UPLOAD-015 reuse).
- Manual QA: —.
- DoD: AGENTS.md.

---

# EPIC-12 — Production (VS-11)

## T-PROD-001 — Production Docker image
- Requirements: NFR-OPS-001, DEPLOYMENT.md §2
- Goal: Finalize the multi-stage Dockerfile (deps/build/runner, non-root, standalone output, healthcheck /healthz, layer cache); verify sharp + argon2 on the prod base; image size target < 500 MB (recorded); tag scheme (sha + latest, keep 5).
- Depends on: T-FOUND-010
- Expected modules: docker/
- Inputs: DEPLOYMENT.md §2, ADR-009
- Expected behavior: 1. Build from scratch on a clean machine (CI) succeeds. 2. Non-root verified (`id` in container). 3. Healthcheck passes after boot. 4. Size recorded (trend tracked in CI comment).
- Edge cases: alpine vs glibc for native modules (documented choice; alpine + sharp prebuilds or glibc-slim fallback — decided with evidence).
- Security: NFR-SEC-013 (pinned base, lockfile build, no shell curl | bash).
- Testing: CI (build + run + healthcheck), INT-DB-001 env proof.
- Manual QA: run image locally, open the app.
- DoD: AGENTS.md.

## T-PROD-002 — Production compose topology
- Requirements: NFR-OPS-001/003, DEPLOYMENT.md §1
- Goal: `docker-compose.prod.yml` (app, db, caddy, optional collector) + Caddyfile (TLS, headers, rate backstop, 128 MB body cap) + volume strategy (db persistent, staging tmpfs-sized or volume-limited) + network isolation (db/minio not published; caddy 443/80 only); `docker compose config` validation in CI.
- Depends on: T-PROD-001
- Expected modules: docker/
- Inputs: DEPLOYMENT.md §1/§3, ADR-009
- Expected behavior: 1. `up -d` on a clean VM (documented 5-step script) ⇒ site serving TLS. 2. No stateful service port exposed except via caddy. 3. Config validate green in CI.
- Edge cases: TLS renewal (Caddy autocert, documented); 80→443 redirect; HTTP/2 + H2 push off (default).
- Security: T-13 (no secrets in the file), ADR-009 (isolation).
- Testing: CI (config validate), smoke (compose up in a test VM/containerlab — recorded).
- Manual QA: bring-up on the actual target VM (the real first deploy).
- DoD: AGENTS.md.

## T-PROD-003 — Env & secrets provisioning
- Requirements: NFR-OPS-002/006, NFR-SEC-009, DEPLOYMENT.md §3
- Goal: Host-side env template (`.env.prod.example` with placeholders + comments, no real values) + secrets injection procedure (CI: secret store → build args only where needed (none at build time — runtime only, documented); VM: host env file outside repo, 0600) + alert rules file applied (T-OBS-006) + canary boot check (DEPLOYMENT §4).
- Depends on: T-PROD-002, T-OBS-006
- Expected modules: docker/ (example env), CI
- Inputs: DEPLOYMENT.md §3, SECURITY.md §9
- Expected behavior: 1. Deploy with zero repo edits (env only). 2. Missing secret ⇒ boot fails redacted (T-FOUND-002 contract). 3. Secrets rotation = env change + restart (RUNBOOK §6 verified once live).
- Edge cases: secret rotation mid-request (no crash; sessions invalid per RUNBOOK).
- Security: NFR-OPS-006 (repo scan: gitleaks on .env patterns — T-SEC-006 covers).
- Testing: INT (boot with missing var), manual (rotation drill once).
- Manual QA: —.
- DoD: AGENTS.md.

## T-PROD-004 — Backup & restore implementation
- Requirements: NFR-DATA-004, NFR-OPS-005, DEPLOYMENT.md §6
- Goal: Daily pg_dump cron (03:00 UTC, custom format, retention 30 d + 12 monthly, private destination) + backup health check (file exists + size + checksum, alert on failure) + storage versioning config (R2/S3) + staging lifecycle rule (24 h) + the restore drill script (RUNBOOK §4) + quarterly drill scheduling (calendar entry, documented).
- Depends on: T-PROD-002
- Expected modules: scripts/ (backup/restore), cron config (host), S3 config
- Inputs: DEPLOYMENT.md §6, RUNBOOK §4
- Expected behavior: 1. 30 consecutive backups exist (post-month check, documented). 2. Restore drill completes ≤ 4 h (first run timed + recorded). 3. Backup failure pages (alert rule exists, OBSERVABILITY §5 area).
- Edge cases: VM clock reset (cron drift — systemd timer preferred over cron, documented); disk full during backup (fails loudly, alert).
- Security: backups private + encrypted at rest (provider or volume encryption, documented choice).
- Testing: INT (backup script unit: rotation math), manual (first drill).
- Manual QA: the drill itself.
- DoD: AGENTS.md.

## T-PROD-005 — Rollback procedure & migration discipline
- Requirements: NFR-OPS-004, DEPLOYMENT.md §5
- Goal: Documented + tested rollback: tag retention (5), compose tag swap, forward-fix-migration procedure (RUNBOOK §5), and the migration discipline gate: every migration reviewed for backward-compatibility with the previous app image (PR checklist + a CI check: migrations run against a DB seeded by the previous migration set — "old-app vs new-schema" smoke).
- Depends on: T-PROD-002, T-FOUND-006
- Expected modules: CI (compat check), RUNBOOK
- Inputs: DEPLOYMENT.md §5, RUNBOOK §5
- Expected behavior: 1. Rollback executed in < 15 min (timed drill, recorded). 2. A deliberately bad migration is caught by the compat CI (fixture). 3. Forward-fix procedure dry-run documented.
- Edge cases: rollback when new migration added columns (old app ignores — expand/contract holds); rollback across 2 deploys (tags preserved).
- Security: —.
- Testing: CI (compat fixture), manual (timed drill).
- Manual QA: the drill.
- DoD: AGENTS.md.

## T-PROD-006 — Deployment validation (smoke suite)
- Requirements: DEPLOYMENT.md §7, NFR-OBS-004
- Goal: Post-deploy smoke: the DEPLOYMENT §7 checklist as an executable suite (readyz, seeded-title visibility, chapter open, progress POST, admin mutation + audit, telemetry arrival, header spot, disk check) — run manually with a command (`scripts/deploy-smoke.sh <origin> <env-creds>`) + a CI version against the pre-prod environment on every image push.
- Depends on: T-PROD-002/003, T-FOUND-012
- Expected modules: scripts/deploy-smoke.mjs, CI
- Inputs: DEPLOYMENT.md §7
- Expected behavior: 1. Smoke green = deploy approved (runbook step). 2. Failure ⇒ stop + rollback guidance printed (no half-states: smoke is read-mostly + one audited test mutation with cleanup). 3. Pre-prod CI runs it on every push (R2/PG provider equivalence — ADR-004 R1).
- Edge cases: smoke against an old deployment (version probe: /healthz reports app version string, mismatch warns — documented).
- Security: smoke creds from env (not args in logs); mutation is a throwaway admin object (cleaned up).
- Testing: CI (pre-prod run), manual (first prod deploy).
- Manual QA: the first real deploy.
- DoD: AGENTS.md.

## T-PROD-007 — Runbook finalization & load smoke
- Requirements: RUNBOOK.md (all), NFR-OPS-003, ADR-009
- Goal: Load smoke: 100 concurrent readers + 10 searches + 1 upload (lab, recorded: error rate, latencies, RSS) against production-like config; finalize RUNBOOK standing tasks with the live environment names/endpoints; archive all VS-11 artifacts (load report, smoke reports, backup drill, rollback drill) into `docs/ops/vs11-evidence/`.
- Depends on: T-PROD-004/005/006
- Expected modules: docs/ops, tests/perf (load preset)
- Inputs: PERFORMANCE.md §10, RUNBOOK.md
- Expected behavior: 1. Load smoke: 5xx < 0.1%, p95 within budgets, RSS stable (recorded). 2. RUNBOOK: every procedure references live names (no placeholders). 3. Evidence archive complete (VS-11 exit criteria).
- Edge cases: load-test artifact storage (local + report only, no data retention).
- Security: load credentials are test accounts (not real PII).
- Testing: tests/perf (load preset), manual (RUNBOOK review).
- Manual QA: full RUNBOOK walk-through with a second pair of eyes.
- DoD: AGENTS.md.

---

# Appendix A — Task Index & Count

| Epic | Range | Count |
|---|---|---|
| EPIC-01 Foundation | T-FOUND-001…012 | 12 |
| EPIC-02 Catalog | T-CATALOG-001…010 | 10 |
| EPIC-03 Reader | T-READER-001…033 | 33 |
| EPIC-04 Authentication | T-AUTH-001…013 | 13 |
| EPIC-05 Library | T-LIB-001…009 | 9 |
| EPIC-06 Admin | T-ADMIN-001…008 | 8 |
| EPIC-07 Uploads | T-UPLOAD-001…015 | 15 |
| EPIC-08 Search | T-SEARCH-001…006 | 6 |
| EPIC-09 Security | T-SEC-001…007 | 7 |
| EPIC-10 Observability | T-OBS-001…007 | 7 |
| EPIC-11 Performance | T-PERF-001…007 | 7 |
| EPIC-12 Production | T-PROD-001…007 | 7 |
| **Total** | | **134** |

# Appendix B — Cross-References

- Requirement → task coverage: docs/architecture/final-review.md §Traceability.
- Task → slice mapping: ROADMAP.md.
- Task → test IDs: TEST_STRATEGY.md (unit/integration/E2E tables).
- Task → docs: each task's Inputs line names its authoritative documents.
- First task to execute: **T-FOUND-001** (VS-0). See NEXT TASK in the completion report.
