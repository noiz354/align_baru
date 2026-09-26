# PERFORMANCE.md

Date: 2026-09-26 · Status: Authoritative budgets. All budgets are **measurable**: each maps to a test or a CI/field measurement named below. Requirement refs: NFR-PERF-001…015.

## 1. Reference Environment

- **Lab (CI gates):** 4 vCPU / 8 GB Node 24 app; PostgreSQL 18 on the same host; MinIO local; Chromium; simulated network per test.
- **Field matrix (manual verification per slice exit):**
  - Phone: mid-range (e.g., 4 GB RAM, 2023-generation SoC), Android 14 + iOS 17, 4G.
  - Laptop: 8 GB RAM, Chrome/Edge.
  - Desktop: 16 GB, Chrome + Firefox.

## 2. Core Web Vitals & Page Budgets (NFR-PERF-001/002/003/007/008)

| Metric | Budget | Verification |
|---|---|---|
| LCP | ≤ 2.5 s p75 (lab, 4G-fast) on `/`, `/discover`, `/manga/[slug]`, reader open | Lab perf harness (T-PERF-005); Lighthouse ≥ 90 (M-5) |
| INP | ≤ 200 ms p75 for reader interactions (page turn, zoom, mode switch) | Playwright perf assertions (T-READER-027) |
| CLS | ≤ 0.1 on all pages; **0.0 on reader mode switch** (reserved slots) | E2E CLS assertion (E2E-READER-017) |
| Initial reader JS | ≤ 250 KB gzipped | Bundle budget in CI (T-PERF-003) |
| Whole-page JS | ≤ 400 KB gzipped | CI budget |
| Requests/catalog or detail page | ≤ 30 | Request-count assertion in E2E (T-CATALOG-003) |
| Reader in-flight image requests | ≤ window + 2 (see §3) | Reader window unit tests (T-READER-031) + E2E network trace (T-READER-027) |

## 3. Reader Windowing Architecture (NFR-PERF-011/012/015, ADR-007)

**Design (no algorithm implemented in this phase):**

- `calculateReaderWindow(currentPage, totalPages, mode)` → `{ start, end }` — pure function, hard caps:
  - vertical: `start = max(1, current − 3)`, `end = min(M, current + 3)` (±3, total ≤ 7 resident slots)
  - single: `start = max(1, current − 1)`, `end = min(M, current + 2)`
  - double: pair-based, `±1 spread` (3 spreads = ≤ 6 pages)
  - **Hard ceiling: window never exceeds 12 pages** regardless of inputs (defensive invariant; also guards the 500-page case).
- **Residency cap:** decoded images ≤ 12 (NFR-PERF-010). Eviction at 2× load distance (hysteresis) to avoid reload flicker on back-scroll.
- **Progressive loading:** pages inside the window load at network priority (high: current, low: rest); on slow connections only the active page is high-priority (NFR-PERF-015).
- **Rapid navigation:** window recomputes are idempotent and cheap (O(1)); in-flight requests outside the new window are cancelled (fetch abort).

**Large-chapter matrix (NFR-PERF-012)** — all measured at VS-4 exit (T-PERF-005/007):

| Pages | First visible page | Steady-state scroll jank (lab phone profile) | Decoded residency | Heap growth/30 min |
|---|---|---|---|---|
| 50 | ≤ 1.5 s broadband / ≤ 4 s 4G | no dropped frames > 50 ms | ≤ 12 | ≤ 150 MB |
| 100 | same | same | ≤ 12 | ≤ 150 MB |
| 200 | same | same | ≤ 12 | ≤ 150 MB |
| 500 | same | same | ≤ 12 | ≤ 150 MB (no monotonic growth) |

The 500-page case is the **defining acceptance case** (AC-READER): it must not behave differently from 50 pages at the memory level because windowing is position-relative, not chapter-size-relative.

## 4. Image Delivery (NFR-PERF-009/013, ADR-005)

- **Size:** delivered page ≤ 1 MB hard, ≤ 500 KB typical (AVIF q≈30 for 2560 px manga pages typically lands 150–400 KB); max dimension 2560 px. Per-variant byte sizes are recorded at ingest (DATA_MODEL §10) and asserted against budget in T-PERF-001.
- **Formats:** AVIF primary → WebP → JPEG via `<picture>` (FR-MEDIA-002).
- **Cache:** `Cache-Control: public, max-age=31536000, immutable` + ETag on `/media/*`; keys are content-versioned (re-ingest = new key) so immutable is safe (NFR-PERF-013).
- **Streaming:** app proxies media as a stream (no full-file buffering in Node; ADR-004); range support optional (browsers rarely need it for < 1 MB images).
- **Expected traffic per 500-page chapter (broadband, one read-through):** ≈ window-churn ≈ 500 × 1 variant × ~300 KB ≈ 150 MB total (unavoidable at source quality; the browser disk cache absorbs revisits).

## 5. API Latency Budgets (NFR-PERF-004/005/006, NFR-PERF-014)

| Operation | p95 budget (lab) | Notes / verification |
|---|---|---|
| `GET /api/v1/catalog` (page 1) | ≤ 300 ms | partial index `ix_manga_visible`; T-CATALOG-002 tests + T-PERF-004 EXPLAIN |
| `GET /api/v1/manga/:slug` | ≤ 300 ms | slug unique index |
| `GET /api/v1/manga/:slug/chapters` | ≤ 250 ms | `ix_chapters_manga_order` |
| `GET /api/v1/chapters/:id/pages` (500 pages) | ≤ 250 ms | PK range scan; response ≈ 60 KB |
| `GET /media/{assetKey}` TTFB | ≤ 100 ms | storage stream; T-PERF-002 |
| `GET /api/v1/search` (10k titles) | ≤ 400 ms | GIN trigram; T-SEARCH-005 |
| `POST /api/v1/progress` | ≤ 200 ms | upsert point write; T-READER-021 tests |
| `GET /api/v1/library` | ≤ 300 ms | `ix_library_user_lastread` |
| Chapter open (end-to-end, first page visible) | ≤ 1.5 s broadband / ≤ 4 s 4G | NFR-PERF-006; E2E (T-READER-027) |

**DB rule (NFR-PERF-014):** hot-path queries ≤ 20 ms p95; every hot query must (a) have a named index in DATA_MODEL.md, (b) pass an EXPLAIN check in CI (T-PERF-004) with no seq scan on tables > 10k rows.

## 6. Memory & Resource Budgets (NFR-PERF-010)

- **Browser (reader):** decoded images ≤ 12; JS heap growth ≤ 150 MB over 30 min continuous reading; no monotonic growth (leak signal → M-6). Verified by Playwright CDP heap snapshots during a scripted 500-page marathon (T-PERF-007).
- **Server (app):** upload processing peaks bounded: ≤ 4 concurrent decodes, per-image sharp memory (≈ 2560 px page ≈ 20–40 MB transient) → job peak ≈ 160–250 MB; app container limit 2 GB (DEPLOYMENT.md). Verified by the resource-monitor test in T-UPLOAD-015.
- **DB:** working set for catalog/chapter queries fits in OS cache at reference scale; no connection pool tuning beyond driver defaults (max 10) in v1.

## 7. Caching Model (NFR-PERF-013) — what we deliberately do NOT cache

- **No server-side application cache in v1.** Rationale: reference-scale reads are cheap indexed point/range queries; a cache adds invalidation risk (stale catalog after publish) with no measured need. Revisit trigger: catalog p95 > 150 ms at 5× reference scale (new ADR or config flag).
- **Browser cache:** immutable media (§4); API `private, max-age=60, stale-while-revalidate=60` for catalog/detail (publish latency tolerance: 60 s, documented); HTML `no-store` (SSR freshness).
- **Reader client cache:** in-memory window only; nothing persisted offline (NO-6).

## 8. Search Performance (NFR-PERF-005)

- GIN trigram on `manga.title` + `manga_alias.alias`; ranking by weight (exact > prefix > contains > creator/tag); limit-capped (page size 24); 10k-title budget ≤ 400 ms p95 (T-SEARCH-005 load test at VS-8 exit).

## 9. Upload Pipeline Performance (informational, not a reader budget)

- 200-page typical chapter: target wall-clock ≤ 3 min on the reference host (decode/encode ≈ 0.4–0.8 s/page with 4-way concurrency + sequential puts). 500-page: ≤ 7 min. Job watchdog kills at 15 min (NFR-SEC-008). Measured per job (NFR-OBS-007) — p50/p95 reported in the stats dashboard (FR-ADMIN-008).

## 10. Performance Verification Plan

| Gate | What | When |
|---|---|---|
| Bundle budget | CI fails if reader JS > 250 KB gzip | VS-0 onward (T-PERF-003) |
| EXPLAIN gate | hot queries no seq scan | VS-1 onward (T-PERF-004) |
| Lab perf harness | CWV + request counts on key routes | VS-2, re-run at VS-4/9/11 (T-PERF-005) |
| 500-page matrix | §3 table, 3 viewports | VS-4 exit (T-READER-027, T-PERF-005/007) |
| Slow-network pass | 3G-equivalent throttling, reader usable | VS-4 exit (T-PERF-006) |
| Load smoke | 100 concurrent readers + 10 searches + 1 upload | VS-11 (T-PROD-006) |

## 11. Skills

These skills are advisory execution aids. A skill never relaxes a budget, a matrix cell, or a gate in this document; on any conflict this document is authoritative and the difference is recorded as a `spec-question` (AGENTS.md §6, §8). Routing per task family is in SKILLS.md §3.

- **`core-web-vitals`** — the LCP / INP / CLS budgets in §2 and the CWV rows of the §10 verification plan; a budget is a gate, not a target.
- **`performance-optimization`** — windowing and residency (§3) and the 500-page acceptance case; the ≤ 12 residency cap and the hard window ceiling of 12 are inviolable.
- **`web-quality-audit`** — the bundle-budget and lab-harness rows of §10; audit findings are addressed or filed as a task, never left implicit.
- **`supabase-postgres-best-practices`, `postgresql-optimization`** — the p95 budgets in §5 and the DB rule under them: every hot query needs a named index in DATA_MODEL.md and an EXPLAIN check in CI (NFR-PERF-014).
