# ROADMAP.md — Vertical Slices

Date: 2026-09-26 · Execution model: slices are the unit of delivery. A slice starts only after the previous slice's exit criteria are met. Within a slice, tasks run in dependency order (TASKS.md "Depends on"). **No slice is executed in the current phase.**

Slice convention: requirements covered · tasks · architectural dependencies · user-visible result · automated verification · manual verification · exit criteria.

---

## VS-0 — Foundation
- **Requirements:** NFR-OPS-001/002, NFR-SEC-013, NFR-OBS-001/004 (foundation), NFR-DATA-001/006, NFR-A11Y-004 (shells)
- **Tasks:** T-FOUND-001…012
- **Skills:** `test-driven-development`, `docker-expert`, `verification-before-completion`
- **Architectural dependencies:** none (first slice); research doc version registry is the input.
- **User-visible result:** nothing product-visible; a dev environment that boots (`/healthz`), a styled-but-empty shell, and a working seed harness (dev only).
- **Automated verification:** typecheck, lint (boundary rules), unit green, build green, CI pipeline running with all gates (audit, gitleaks, bundle budget stub), compose up smoke.
- **Manual verification:** fresh clone → `npm ci` → compose up → /healthz; native modules (sharp, argon2) verified in the image.
- **Exit criteria:** all T-FOUND green; boundary lint proven to catch violations; env validation redacted-failure demoed; seed harness refuses prod.

## VS-1 — Catalog
- **Requirements:** FR-CATALOG-001…008, FR-CHAPTER-001/004, FR-MEDIA-001/003, NFR-PERF-001/004/007/008/013, NFR-A11Y-004/005
- **Tasks:** T-CATALOG-001…010 (⚠ **documented exception, slice-scoped:** T-CATALOG-010 declares `Depends on: T-UPLOAD-006 (storage writes)`, which is a VS-7 task, yet this slice's exit criteria name "covers served with correct caching" and INT-MEDIA-001 — so VS-1 cannot exit without it. VS-1 therefore lands only the **delivery half**: the `ObjectStoragePort` S3 adapter in `server/storage` (put/get/exists/delete/head/presign) and the `/media/[assetKey]` route in `server/media` + `src/app/media`. Precedent: VS-4's pull-forward below. **Still owned by VS-7, untouched:** T-UPLOAD-005 (variant writes), T-UPLOAD-006 (job orchestration), T-UPLOAD-008 (presign *use* in the multipart flow), T-UPLOAD-011 (cover-variant generation, WebP+JPEG ≤ 1200 px). The adapter is the same transport VS-7 will call — nothing was implemented twice.)
- **Skills:** `typescript-advanced-types`, `backend-caching`, `supabase-postgres-best-practices`, `accessibility`
- **Architectural dependencies:** VS-0 (schema, env, CI). Media delivery depends on storage port (MinIO in dev) — pages for seeded manga use synthetic assets (T-FOUND-012), so the reader isn't needed yet.
- **User-visible result:** browseable, filterable, sortable catalog; manga detail pages; chapter lists; covers served with correct caching. (Content is seeded — real ingestion arrives in VS-7.)
- **Automated verification:** INT-CAT-001, INT-CHAP-001, INT-MEDIA-001, E2E-CATALOG-001/002, a11y axe on catalog routes, bundle budget, lab harness baseline (LCP/CLS/requests).
- **Manual verification:** J-1 (anonymous browse) on desktop + phone; keyboard-only catalog pass.
- **Exit criteria:** J-1 green; LCP ≤ 2.5 s lab; ≤ 30 requests/page; empty-catalog state correct; no feature code outside catalog modules.

## VS-2 — Minimal Reader
- **Requirements:** FR-READER-001/002/004/005/006/011/012/014/016/017/019/022/023/024 (minimal set), FR-CHAPTER-002/003, NFR-PERF-002/003/006/011, NFR-A11Y-002/003/005/006
- **Tasks:** T-READER-001…016, T-READER-019…023, T-READER-029…033 (core state, vertical + single modes, RTL/LTR, keyboard, windowing, progress save/restore, completion, final page, error states)
- **Skills:** `typescript-advanced-types`, `test-driven-development`, `accessibility`
- **Architectural dependencies:** VS-1 (chapter/page APIs, media delivery); seed manga (30-page + 500-page synthetic) from VS-0.
- **User-visible result:** a readable reader: vertical + single-page modes, RTL/LTR, keyboard, position indicator, progress saved/restored (anonymous local; server sync arrives with VS-5), chapter completion + next-chapter.
- **Automated verification:** UNIT-READER-001…010, 004/005 (window), 002/003 (index/final), E2E-READER-001/002/005/006/008, INT-PROG-001/002 (anon path local-only), a11y axe on reader.
- **Manual verification:** J-1 reading pass (vertical RTL), J-3 start (slow connection spot check), keyboard-only 30-page read.
- **Exit criteria:** 30-page chapter readable end-to-end both directions; deep-link fuzz green; progress survives reload; no wrap-around; INP ≤ 200 ms lab.

## VS-3 — Reader Navigation (full input matrix)
- **Requirements:** FR-READER-003/007/008/009/010/013/015/018/020/021 (modes × inputs complete)
- **Tasks:** T-READER-006 (double-page completion if not done in VS-2 — sequencing note: pairing unit tests land in VS-2, UI in VS-3), T-READER-009, T-READER-010, T-READER-011, T-READER-012, T-READER-013, T-READER-020, T-READER-030
- **Skills:** `accessibility`, `userflow`, `core-web-vitals`
- **Architectural dependencies:** VS-2 state core.
- **User-visible result:** double-page mode, tap zones, swipe (with cancel), zoom (pinch/wheel/double-tap/keys), fullscreen, responsive polish, mode/direction switching with position preservation.
- **Automated verification:** UNIT-READER-006/007/008/009, E2E-READER-003/004, E2E-READER-017 (a11y pass part 1), CLS assertions on mode switches.
- **Manual verification:** J-6 (power reader desktop journey), touch journey on a real device, 10× mode-switch stress.
- **Exit criteria:** full input matrix works in both directions on 4 breakpoints; zero CLS on switches; zoom bounds hold; cancel semantics verified.

## VS-4 — Reader Performance
- **Requirements:** NFR-PERF-009/010/011/012/015, FR-READER-018 (failure polish), M-6
- **Tasks:** T-READER-026, T-READER-027 (a11y completion), T-PERF-005/006/007, T-PERF-003 (gate tightening), T-UPLOAD-004/005/006/012 (media pipeline pieces needed for *delivery tuning* — note: upload UI/intake remain VS-7; this slice pulls the normalization+storage+job-repo core forward because the performance matrix needs real multi-format assets; documented exception, slice-scoped)
- **Skills:** `performance-optimization`, `core-web-vitals`, `web-quality-audit`
- **Architectural dependencies:** VS-2/VS-3 reader; ADR-005 pipeline.
- **User-visible result:** the 500-page case that defines the product: smooth on phones, bounded memory, progressive on 3G, format ladder live (AVIF primary).
- **Automated verification:** E2E-READER-007 (500-page matrix × 3 viewports + CDP residency/heap), T-PERF-005 lab harness full run, T-PERF-006 slow-net report, T-PERF-007 memory reports, INT-UP-001 (delivery legs for variants), bundle gate.
- **Manual verification:** real mid-range phone, 500-page chapter, 15 min; slow-connection phone test; M-6 (no monotonic heap).
- **Exit criteria:** PERFORMANCE.md §3 matrix green on all 4 chapter sizes × 3 viewports; residency ≤ 12 asserted; 3G usability criteria met; reports archived.

## VS-5 — Authentication + Library
- **Requirements:** FR-AUTH-001…010, FR-LIBRARY-001…010, FR-READER-013 (server sync + merge), NFR-SEC-001…005, NFR-A11Y (forms)
- **Tasks:** T-AUTH-001…013, T-LIB-001…009, T-READER-023 (API side), T-READER-024, T-READER-025
- **Skills:** `security-and-hardening`, `backend-idempotency`, `backend-transactional-outbox`, `accessibility`
- **Architectural dependencies:** VS-2 (progress domain exists locally; server sync added), VS-1 (catalog for the UI context).
- **User-visible result:** register/sign-in/sign-out; library with continue-reading on home; history; bookmarks; read-status; server-side progress + merge on sign-in; password reset (mail capture in dev; live SMTP at VS-9).
- **Automated verification:** INT-AUTH-001…004, INT-LIB-001, INT-PROG-001/002 (server legs), E2E-AUTH-001/004, E2E-LIB-001, E2E-READER-019 (IDOR), a11y on forms.
- **Manual verification:** J-2 (returning member), J-1 with sign-in (merge), form keyboard/SR pass.
- **Exit criteria:** J-2 green; IDOR suite green (feeds security gate); session flags verified; merge behavior per spec.

## VS-6 — Admin
- **Requirements:** FR-ADMIN-001…008, FR-AUTH-008/009 (enforcement), NFR-SEC-012
- **Tasks:** T-ADMIN-001…008
- **Skills:** `frontend-ui-engineering`, `security-and-hardening`, `accessibility`
- **Architectural dependencies:** VS-5 (auth/roles), VS-1 (catalog repos), VS-4 (media pipeline for covers).
- **User-visible result:** admin panel: manga CRUD, chapter CRUD, publish control, user management, audit log, stats; first-admin onboarding.
- **Automated verification:** INT-ADMIN-001/002, E2E-ADMIN-001 (curator loop legs), E2E-ADMIN-002 (access), a11y on admin.
- **Manual verification:** J-4 minus upload (create manga + publish seeded chapter); audit spot-check.
- **Exit criteria:** curator can manage the whole catalog surface; audit rows for every mutation; 403s correct for non-admins (matrix green).

## VS-7 — Secure Upload Pipeline
- **Requirements:** FR-UPLOAD-001…011, NFR-SEC-006/007/008, FR-MEDIA-002 (ladder complete)
- **Tasks:** T-UPLOAD-001/002/003/007/008/009/010/011/013/014/015 (remaining intake/UI/reingest/security — normalization/storage/job core already landed in VS-4 per the exception) — plus **T-UPLOAD-006, still VS-7**: the VS-1 exception for T-CATALOG-010 pulled in the *storage transport + delivery route* only, so job orchestration, variant writes, the multipart presign flow, and cover-variant generation remain in this slice
- **Skills:** `backend-idempotency`, `backend-resilience-patterns`, `security-and-hardening`
- **Architectural dependencies:** VS-6 (admin surface), VS-4 (pipeline core).
- **User-visible result:** the full curator loop closes: ZIP or image-set upload → validated → normalized → published → readable; failure reasons visible; re-ingest; multipart for big files.
- **Automated verification:** INT-UP-001/002 (complete), T-UPLOAD-015 attack-fixture suite (green = T-08/09/10 verified), E2E-ADMIN-001 (full J-4 with real upload), a11y.
- **Manual verification:** J-4 + J-5 end-to-end with real and corrupt archives; watch a job live; re-ingest a chapter.
- **Exit criteria:** J-4/J-5 green; all 14 attack fixtures rejected with zero side effects; upload p50 ≤ 3 min (200 pages) recorded.

## VS-8 — Search
- **Requirements:** FR-SEARCH-001…005, NFR-PERF-005, NFR-SEC-006
- **Tasks:** T-SEARCH-001…006
- **Skills:** `supabase-postgres-best-practices`, `backend-caching`
- **Architectural dependencies:** VS-1 (catalog data), trigram indexes (initial migration).
- **User-visible result:** debounced search over titles/aliases/creators/tags with ranked, paginated results and honest empty states.
- **Automated verification:** INT-SEARCH-001 (behavior + 10k load), injection fuzz, rate-limit tests, E2E-SEARCH-001, a11y.
- **Manual verification:** search journey keyboard-only; empty-catalog search.
- **Exit criteria:** ≤ 400 ms p95 at 10k titles; ranking deterministic; injection suite green.

## VS-9 — Security Hardening
- **Requirements:** NFR-SEC-004/011/013/014/016, THREAT_MODEL (all rows verified), M-4
- **Tasks:** T-SEC-001…007, T-AUTH-009 (live SMTP mail provider wiring), T-OBS-003 (redaction hardening — if not complete), T-READER-027 (SR manual pass if pending)
- **Skills:** `security-and-hardening`, `backend-contract-testing`, `backend-structured-logging`
- **Architectural dependencies:** all prior slices (verification surface).
- **User-visible result:** none direct (headers, audits, gates); users feel fewer weird failures (uniform errors, CSP stability).
- **Automated verification:** threat verification report 100% rows closed/accepted; ZAP baseline (no high); header matrix; DB-role restriction tests; bundle/secret scans; gitleaks clean.
- **Manual verification:** full threat-model walk-through with a second pair of eyes; keyboard + SR re-pass on reader (ACCESSIBILITY §7 cadence).
- **Exit criteria:** M-4 gate: zero open high/critical threats; all verification artifacts archived; CSP stable (no violations over a week of dev use).

## VS-10 — Observability
- **Requirements:** NFR-OBS-001…007, FR-ADMIN-008 (live data), OBSERVABILITY.md (full conventions)
- **Tasks:** T-OBS-001…007
- **Skills:** `observability-and-instrumentation`, `backend-structured-logging`
- **Architectural dependencies:** all (instrumentation surface).
- **User-visible result:** admin stats dashboard goes live-data; operators get dashboards + alerts.
- **Automated verification:** INT-OBS (trace/metric shapes), chaos tests (PG/storage down), beacon tests, dashboard provisioning test, alert rule load.
- **Manual verification:** walk all 4 dashboards; induce an image-failure and watch `yomi_reader_page_load_errors_total`; kill PG and watch readyz + alert.
- **Exit criteria:** every OBSERVABILITY.md convention implemented + verified; span budget holds on reader path; no PII in any captured signal (redaction tests + spot audit).

## VS-11 — Production Deployment
- **Requirements:** NFR-OPS-001…006, NFR-DATA-004/005, DEPLOYMENT.md + RUNBOOK.md (full)
- **Tasks:** T-PROD-001…007
- **Skills:** `docker-expert`, `backend-resilience-patterns`, `observability-and-instrumentation`
- **Architectural dependencies:** all slices complete (feature-frozen window recommended).
- **User-visible result:** a live production instance (self-hosted) with backups, rollback, monitoring, and a finished runbook.
- **Automated verification:** image build CI; compose config validation; pre-prod smoke suite (R2/PG equivalence); load smoke (100 readers + 10 searches + 1 upload).
- **Manual verification:** first real deploy (DEPLOYMENT §7 checklist); backup + restore drill (timed); rollback drill (timed ≤ 15 min); RUNBOOK walk-through.
- **Exit criteria:** all drills within targets; smoke suite green in pre-prod + prod; evidence archive complete; M-1…M-6 measurement instruments live (field data collection begins).

---

## Sequencing Notes

1. **Reader before auth (VS-2 before VS-5)** is deliberate: the reader is the product core and is fully usable anonymously (FR-CHAPTER-003); personalization layers on top. Anonymous progress (local) works from VS-2; server sync + merge from VS-5.
2. **Reader before uploads (VS-2/3/4 before VS-7)** is resolved by the dev seed harness (T-FOUND-012) with synthetic pages: the reader develops and performance-verifies against real-shaped assets before ingestion exists. The loop closes in VS-7 (J-4).
3. **Media pipeline core in VS-4** (noted exception): normalization + storage + job-repo pieces pull forward because the 500-page performance matrix needs the real format ladder. Intake, UI, re-ingest, and the attack suite stay in VS-7.
4. **Search last-but-one (VS-8):** it needs the trigram indexes (migration from VS-0) but only meaningful data volume to tune against; 10k-title load fixtures (T-FOUND-012 flag) make it testable earlier if the team prefers — re-sequencing requires only a slice-swap (no dependency violation: search depends on nothing but catalog + indexes).
5. **Hardening after features (VS-9):** verification tasks consume the surfaces they verify; moving them earlier would verify nothing.
6. **Dependency conflicts:** if a "Depends on" in TASKS.md points outside a slice, that's a sequencing bug — fix by moving the task, not by relaxing the dependency.
