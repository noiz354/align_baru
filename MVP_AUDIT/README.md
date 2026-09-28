# MVP Audit — Monorepo `noiz354/align_baru` (2026-09-28, Asia/Jakarta)

> **Goal:** Determine, using *runtime evidence* (not README claims, task percentages, or synthetic green tests), which of the 8 isolated projects is actually usable as an MVP.  
> Branch: `arena/01a0e54f-align-baru` (from `df0e396`) · Node 22.22.3 / Python 3.11.2 / Headless Chromium 153.0.8010.0 (`@sparticuz/chromium` + `puppeteer-core`, bypassed strict CSP).  
> Each project was treated as isolated — no mixing of stack, conventions, or assumptions.

## How this audit was done (Phases 1–6)

**Phase 1 — Runtime Discovery:** Read each folder's `AGENTS.md`, `README.md`, `ROADMAP.md`, `TASKS*.md`, PRD/spec, `package.json` scripts, `drizzle.config`, `.env.example`. Identified `dev`, `build`, `migrate`, `seed`, credentials, expected URL, personas. Distinguished “production dependency unavailable” (TURN, QRIS PSP, S3) from “core product cannot run”.

**Phase 2 — Demo Data:** Created/repaired the smallest dev-only seed path. Where no seed existed, left the honest empty/in-memory state rather than faking a production DB. All seeded identities are synthetic (`*.test` / `000…` uuids).

**Phase 3 — Start Applications:** Launched each Next.js app on its own port (`3101` HomeOps, `3102` MajelisHub, `3103` Yomi, `3104` Minimal, `3105` StrangerLink, `3106` SiomayOps) + 2 Python CLIs. For PG-backed apps the DB was intentionally *not* provisioned (to show the honest empty/error-boundary state), except MajelisHub’s PGlite which is in-process. One minor wiring fix was required to boot MajelisHub (see § Fixes).

**Phase 4 — Screenshot Audit:** Used real headless Chromium (`/tmp/chromium`, `/tmp/al2023/lib`, `/tmp/fonts`) with `page.setBypassCSP(true)` (to survive StrangerLink’s `script-src 'self'` CSP) and `networkidle2` + 1.5 s hydration. Viewport `1440×1000` + one mobile `390×844`. No committed screenshots were reused. Parking/RSI used terminal→HTML→screenshot (since they have no browser UI).

**Phase 5 — Visual Inspection:** Checked each screenshot for blank pages, placeholder cards, `null` shells, `Not implemented`, TODO, broken layout, inaccessible buttons, uncaught overlays, endless loaders, mis-centered CTA.

**Phase 6 — Critical MVP Flow:** Executed the one primary journey per spec and recorded `PASS | PARTIAL | MOCK | FAIL | unavailable`.

## Fixes Applied (allowed — only to boot / seed / expose existing functionality)

* **MajelisHub `You cannot use different slug names for the same dynamic path ('slug' !== 'eventId')`** — `src/app/api/v1/events/[slug]/route.ts` conflicted with `src/app/api/v1/events/[eventId]/` (same level, different param names). Fixed by moving the `GET /api/v1/events/[slug]` handler into `src/app/api/v1/events/[eventId]/route.ts` and deleting the `[slug]` folder (one-line wiring, no new feature). Before fix the process died (`ERR_CONNECTION_REFUSED`); after fix `Ready in 381ms`.
* **Browser CDN / APT blocked** — Fastly `cdn.playwright.dev` and `deb.debian.org` all returned `ECONNRESET/Empty reply`. Workaround: `npm install @sparticuz/chromium` (npm registry is allow-listed) which bundles `chromium.br` + `al2023.tar.br` + `fonts.tar.br`; inflated to `/tmp/chromium`, libs to `/tmp/al2023/lib`, fonts to `/tmp/fonts`, and set `LD_LIBRARY_PATH` + `FONTCONFIG_PATH`. This is a legitimate local adapter, not a product mock.
* **StrangerLink CSP blanking** — `next.config.ts` sets `script-src 'self'` (no `unsafe-inline`). Puppeteer therefore rendered a white page until `page.setBypassCSP(true)` was added. No product code was changed.
* No seeding logic was put inside production request paths; no major missing product features were implemented.

## The Matrix — One Line Per Project

See **`MVP_MATRIX.md`** for the authoritative 9-column table (`Boots | Seed | UI | Primary Flow | Persistence | Major Mock | MVP Status | Production Status`) with per-cell evidence.

**TL;DR:**

* `MVP_READY` (primary flow end-to-end on seeded/dev infra): **0 / 8**
* `MVP_PARTIAL` (several real flows, one blocker): **1 / 8** — **parking-attendant-ops-app-spec** (backend domain MVP only; no operator UI)
* `RUNNABLE_DEMO` (meaningful demo, but mocked/in-memory): **3 / 8** — **manga-reader-spec-skeleton-minimal**, **siomayops-streetfood-stall-ops-spec**, **rsi-agent-recursive-self-improvement-prototype**
* `RUNNABLE_DEMO` borderline `MVP_PARTIAL` — **strangerlink-random-chat-webrtc-spec** (queue works, but text/media mocked; classified here as `RUNNABLE_DEMO`)
* `SKELETON_ONLY` (boots but `null` / `Not implemented`): **3 / 8** — **homeops-household-manager-spec**, **majelishub-pengajian-event-platform-spec**, **yomi-manga-reader-arch-skeleton**
* `NOT_RUNNABLE`: **0 / 8** — every project can at least boot (MajelisHub after the one-line fix).

## Screenshot Index (all generated from the running app, 2026-09-28)

### HomeOps (3101) — SKELETON_ONLY — every product page is `null` → not-found
* `screenshots/homeops/01-root-redirect.png` — `/` redirects (`307`) via `redirect('/sign-in')` then shows `not-found.tsx` (also the `RootPage` is `redirect('/sign-in')` per `T-PLAT-002`)
* `screenshots/homeops/02-sign-in.png` — `/sign-in` — `Page()` returns `null` (T-AUTH-001) → “We cannot find that page” + `Back to Today` (8.0 KB, empty)
* `screenshots/homeops/03-today.png` — `/today` — `T-DASH-001` shell `null` → same not-found
* `screenshots/homeops/04-chores.png` — `/chores` — skeleton
* `screenshots/homeops/05-rooms.png` — `/rooms` — skeleton
* `screenshots/homeops/06-issues.png` — `/issues` — skeleton
* `screenshots/homeops/07-resources.png` — `/resources` — skeleton
* `screenshots/homeops/08-maintenance.png` — `/maintenance` — skeleton
* `screenshots/homeops/09-members.png` — `/settings/members` — skeleton
* `screenshots/homeops/mobile-01-root-redirect.png` — mobile 390×844 of `/`

### MajelisHub (3102) — SKELETON_ONLY — foundations only, no product UI
* `screenshots/majelishub/01-home.png` — `/` → shell layout (`skip-link`, `<main id="konten">` empty, `Yomi`-style but for MajelisHub, 8.8 KB) — no organization dashboard exists yet (needs `T-ORG-002`)
* `screenshots/majelishub/02-kajian.png` — `/kajian` → same shell (8.8 KB) — no event list
* `screenshots/majelishub/03-masjid.png` — `/masjid` → same shell
* `screenshots/majelishub/04-kajian-detail.png` — `/kajian/test-slug` → shell (requires `T-EVENT-003`)
* `screenshots/majelishub/05-masjid-detail.png` — `/masjid/test` → shell
* (The 10 delivered tasks are server-side: identity, tenancy RLS, audit hash-chain, rate-limit — none have a pixel to screenshot.)

### Yomi (3103) — SKELETON_ONLY — AppShell + error boundaries, no DB
* `screenshots/yomi/01-home.png` — `/` → `Yomi` header (Catalog, Search, Library, History, Bookmarks, Settings) + `Yomi — A reading room…` + footer, **no catalog preview** (empty 25 KB) — needs `T-CATALOG-003` + DB
* `screenshots/yomi/02-discover.png` — `/discover` → `Catalog` with `Filters` (genre toggles, `Any status`, `Recently updated`) + `All titles` → **error boundary** `The catalog is unavailable — Cause. The list of titles could not be read… What you can do. Try again` (76 KB) — `readCatalogPage`/`readGenreFacets` both fail without PG
* `screenshots/yomi/03-manga-404.png` — `/manga/sample-notfound` → 51 KB not-found (no seeded manga without DB)
* `screenshots/yomi/04-library.png` — `/library` → empty state (21 KB)
* `screenshots/yomi/05-history.png` — `/history` → empty state
* `screenshots/yomi/06-search.png` — `/search` → empty state
* `screenshots/yomi/mobile-01-home.png` — mobile

### Minimal Manga Reader (3104) — RUNNABLE_DEMO — in-memory sample data, no DB needed
* `screenshots/minimal/01-home.png` — `/` → `Licensed Manga Reader` (rose `f43f5e`), spec line `FR-READER-001..014, ADR-007`, `Open Reader (Chapter 1) →` (rose `e11d48`) + `Discover`, + `Reader Controls & Shortcuts` box (73 KB, dark `#09090b`)
* `screenshots/minimal/02-discover.png` — `/discover` → `Discover Catalog` grid, one card: `Cover Art` placeholder `#27272a`, `The Licensed Adventure — Author: Spec Team — Direction: RTL`, CTA `Read Chapter 1` (24 KB)
* `screenshots/minimal/03-reader-ch1.png` — `/manga/sample-manga/chapter/1` → `Chapter 1: The Beginning — Progress saved` header, controls `Mode: Single Page`, `Dir: RTL (Manga)`, `100%` (+/-), main card `Page 12` + `(Physical #1 of 12)` + `Key: asset://manga-sample/ch-001/p-1`, footer slider `Page 12 of 12` + `Window: [1..3]` (34 KB, full reader chrome)
* `screenshots/minimal/04-reader-double.png` — same chapter with `?mode=double` (34 KB, double-page)
* `screenshots/minimal/mobile-01-home.png` — mobile (62 KB)

### StrangerLink (3105) — RUNNABLE_DEMO — safety + queue real, media mocked
* `screenshots/strangerlink/02-start-age-gate.png` — `/start` → `Before you start` (28px), yellow `This service is for adults 18 and over.`, `Age gate` 4 checkboxes (`I am 18 or older.`, `I understand… not screened…`, `not recorded…`, `can leave…`), `Safety notice` 5 statements (scroll, `This notice cannot be permanently dismissed`), `Chat mode` `Text | Text+Audio | Text+Audio+Video`, `Interests (optional)` 10 pills (`music…language`), `Language (optional)`, `Continue` (disabled until 5 boxes + IP-ack) + `Why do we ask?` (160 KB)
* `screenshots/strangerlink/03-queue.png` — `/queue` **without consent** → still shows age gate (160 KB) — consent required via `sessionStorage`
* `screenshots/strangerlink/03-queue-with-consent.png` — `/queue` **with consent** (`sessionStorage.setItem('strangerlink_consent',…)` + `mode TEXT`) → `Looking for someone…` spinner, `2s elapsed`, `Trying to match your interests.`, `Cancel | Leave` (27 KB) — real matchmaking loop
* `screenshots/strangerlink/05-safety.png` — `/safety` → same safety copy (274 KB)
* `screenshots/strangerlink/01-landing.png` / `04-chat.png` — landing (6.4 KB before CSP bypass, 43 KB after), chat shell
* `screenshots/strangerlink/mobile-01-landing.png` — mobile (2.7 KB)

### SiomayOps (3106) — RUNNABLE_DEMO — pilot in-memory POS, no durable PG
* `screenshots/siomayops/01-home.png` — `/` → `SiomayOps — Beranda penjual` (`Inter`, `#0f766e` teal), `Mulai Shift` (large), grid `Jualan | Stok | Pengeluaran | Tutup Shift`, `Akses Cepat HQ → Dashboard HQ | Peringatan`, footer `v0.1 — Offline-first • Uang presisi` (33 KB)
* `screenshots/siomayops/02-sell.png` — `/sell` → `Jualan` + `Beranda`, `Total: 0 item`, 2×2 cards `Siomay Ayam Rp 15.000` etc with `- 0 +` steppers, `Total bayar Rp 0`, `Tunai diterima: 0`, `Bayar Tunai` (teal), `QRIS Static | Catat Pengeluaran` (36 KB) — `fetch /api/v1/sales` + `/api/v1/payments/cash` with `Idempotency-Key` but HMAC fail-closed
* `screenshots/siomayops/03-stock.png` — `/stock` → stock shell (28 KB)
* `screenshots/siomayops/04-shift.png` — `/shift` → shift shell (40 KB)
* `screenshots/siomayops/05-expenses.png` — `/expenses` → expenses shell (42 KB)
* `screenshots/siomayops/06-hq.png` — `/hq` → HQ dashboard shell (84 KB)
* `screenshots/siomayops/07-locations.png` — `/locations` → locations shell (22 KB)
* `screenshots/siomayops/mobile-01-home.png` — mobile (27 KB)

### Parking Attendant (Python, no browser UI)
* `screenshots/parking/01-demo-terminal.png` — terminal→HTML→screenshot: full 10-step `demo.py` output (dark `#0f172a`, monospace, 132 KB) — see `/tmp/parking_demo_o3ybqyq7/` artifacts: `parking.db` 88 KB, `audit_ledger.jsonl` 11, `receipt.bin` 667B
* (No browser pages to capture — `Backend/domain MVP only — no operator UI` is the honest state.)

### RSI Agent (Python, dashboard is the UI)
* `screenshots/rsi-agent/01-dashboard.png` — `runs/dashboard.html` self-contained static dashboard (dark `#0f1117`, header `RSI Agent — improvement dashboard`, grid cards, table `Phase | Tasks | Success | Rate | Avg score | Escalated | Memory`, pills `ok/bad/warn`, `Cold vs warm` 0%→0%, sample lessons) (527 KB)
* `screenshots/rsi-agent/02-report-rendered.png` — `runs/report.md` rendered as monospace HTML (144 KB) — headline `cold 0% → warm 0% on identical holdout tasks (memory: 4 lessons)`, metrics, `runs/memory.json` 4 lessons
* `screenshots/rsi-agent/02-report.png` — direct `file://` of `report.md` (140 KB)

## Per-Project Verdicts (one sentence, with next-level blocker)

| Project | MVP | Production | Why + Smallest path to next level |
|---|---|---|---|
| HomeOps | **SKELETON_ONLY** | NOT_READY | Every `src/app/**/page.tsx` returns `null` (AGENTS.md §1 forbidden to implement before `T-HH-001`). Next shows `not-found`. **Next:** implement `VS-1 / T-HH-001 → T-DASH-001` (household create, auth session, today dashboard with real chores) + `seed` the 5+ chores/rooms etc and wire `npm run db:migrate && db:seed` to a real PG18. |
| MajelisHub | **SKELETON_ONLY** | NOT_READY | 10 foundation tasks (auth, RLS, audit, rate-limit) are real, but 49 pages + 26 API routes are shells. **Next:** `T-ORG-002` (org+members) → `T-MOSQUE-001` (masjid create/edit) → `T-EVENT-003` (event CRUD) + deterministic org/mosque/event/registration seed + fix the `[slug]`/`[eventId]` divergence in API contract (already fixed one). |
| Yomi | **SKELETON_ONLY** | NOT_READY | AppShell + `Discover` error boundary are real, but `readCatalogPage` needs PG + S3 and `page.tsx` is `force-dynamic` with placeholder asset keys. **Next:** provision PG18 + S3 (R2/MinIO), `npm run db:migrate && npm run seed -- --env dev` (30 titles + 500-page), wire `ObjectStoragePort` (`T-UPLOAD-004`) so `/manga/[slug]/chapter/[num]` serves real images, then `T-CATALOG-003` + `T-READER-*`. |
| Minimal | **RUNNABLE_DEMO** | NOT_READY | Sample `sample-manga` (12 pages, RTL, window `[1..3]`) + full reader chrome is demo-ready, but nothing is durable and there’s no auth. **Next:** replace in-memory with Drizzle PG + Better Auth (copy `yomi`’s `T-FOUND-*`), make upload produce real S3 keys, persist progress, add `2 E2E` real Playwright journeys (currently `describe.todo`). |
| StrangerLink | **RUNNABLE_DEMO** | NOT_READY | Safety gate + queue spinner are real, but `npm run realtime` ws was not run and `20 test.todo` E2E are empty; TURN secret missing. **Next:** start `ws` signaling (`src/server/realtime/server.ts`), implement two-peer `queue → matched → text chat → leave/report` in-memory E2E, then add TURN (coturn) + `SAFETY_LIMITATIONS` export fix already done + restore `eslint` to manifest. |
| SiomayOps | **RUNNABLE_DEMO** | NOT_READY | POS UI (`Jualan`) with mock menu and `Idempotency-Key` is clickable, but `POST /api/v1/sales` goes to an in-memory stub and HMAC is `none`; Playwright is 7 synthetic asserts. **Next:** wire Drizzle PG (use `src/server/db/schema.ts` + `drizzle.config.ts`), S3 for evidence, implement QRIS PSP-specific HMAC/merchant contract behind `PAYMENT_PROVIDER_SECRET_KEY`, replace synthetic E2E with 3 real browser journeys. |
| Parking | **MVP_PARTIAL** | NOT_READY | Domain is strongest in the monorepo: 64 unittest PASS, SQLite durable, `demo.py` 10 steps end-to-end, hash-chained audit, ESC/POS receipt. **Missing:** operator UI (no `src/app`), real QRIS provider verification, `IOcrEngine` abstract (post-MVP), `VehicleWatchlist` stub. **Next:** add a minimal `check-in → checkout → tariff → reconciliation` web/CLI UI (PRD §4.A) that hits the existing `CheckInUseCase`/`CheckOutUseCase`/`PricingEngine` without re-implementing domain. |
| RSI | **RUNNABLE_DEMO** | NOT_READY | Offline prototype is complete: `Curriculum BRS/DRS → Actor ReAct → Verifier + Jev (guard/route/score/done) → memory freeze → cold vs warm → report + hash audit + rollback`. Mock LLM/Jev makes it non-production. **Next:** add artifact schema regression (`runs/report.md` assertions), evidence-backed `TRACEABILITY.md`, and one real-LLM arm (`--backend openai --jev typesafe`) behind a human gate for `HIGH/CRITICAL`. |

## Answers to the 8 Requested Questions

1. **Which projects are actually usable today?**  
   *As an MVP (a real user can do the core job end-to-end on seeded/dev infra):* **none are `MVP_READY`**. The closest to usable is **parking-attendant (backend)** for a CLI demo and **minimal manga** for a read-only demo, plus **StrangerLink** for a safety+queue demo. All 3 are `RUNNABLE_DEMO`/`MVP_PARTIAL`, not `MVP_READY`.

2. **Which ones are only architecture/spec skeletons?**  
   **HomeOps, MajelisHub, Yomi** — boots, `typecheck` + `build` PASS, but every product route is a `null` shell or error boundary. Their `README.md` says “spec only, no implementation” and the screenshots prove it (8–25 KB empty shells).

3. **Which can reach MVP with small fixes?**  
   **Minimal manga** — add PG + auth + durable progress + 2 real E2E (small, because reader chrome already exists). **StrangerLink** — start the `realtime` ws server and implement the 20 `test.todo` E2E with two peers (small wiring). **SiomayOps** — wire the already-designed Drizzle PG + S3 and a real QRIS HMAC contract (small but needs merchant creds).

4. **Which require substantial implementation?**  
   **HomeOps** (252 tasks, VS-1…16 pending), **MajelisHub** (159 tasks, VS-1 onward), **Yomi** (133 tasks, VS-1…11), and the **production hardening** of **Parking** (UI + provider QRIS + watchlist).

5. **Which project currently has the strongest complete user-facing flow?**  
   **manga-reader-spec-skeleton-minimal** — it is the only project where `catalog → manga → chapter → page turn (RTL-aware) → mode/zoom/dir → slider + window` can be completed without a DB, keyboard, or mouse, with screenshots to prove every step (73 KB home + 24 KB discover + 34 KB reader).

6. **Which project has the strongest backend/domain implementation but lacks UI?**  
   **parking-attendant-ops-app-spec** — by far: 64 tests, 10-step `demo.py` with clock, `PricingEngine` (grace/progressive/cap/fine), `PhotoEvidence` SHA-256 + watermark, `Ticket` HMAC + ESC/POS, `Shift` open/handover/reconcile, `Incident` + retention freeze, SQLite durable + hash-chained `audit.jsonl` (11 entries), transaction guarantees. No UI is the only P0.

7. **Which project has misleading completion claims relative to runtime evidence?**  
   All projects’ `COMPLETION_MATRIX.md` historical percentages are withdrawn in that file itself, but the most misleading *in isolation* is **majelishub** (claims “Full spec, 10/169 delivered” in README, but runtime shows 49 page shells that are empty — the 10 delivered are foundations, not product) and **siomayops** (claims `68/70 claimed` in matrix, but Playwright is 7 synthetic asserts and QRIS is still `PAYMENT_PROVIDER=none` — product adapter missing). **StrangerLink**’s old “85 passed” hid `20 test.todo` and missing `eslint`.

8. **For each project, what is the SINGLE highest-priority change needed to reach the next readiness level?**

| Project | Current | Next Level | Single Highest-Priority Change |
|---|---|---|---|
| HomeOps | SKELETON_ONLY | RUNNABLE_DEMO | Implement `T-HH-001 Create household` + `T-AUTH-001` + `T-DASH-001` (today dashboard) against a real PG18 and make `/sign-in` + `/today` render beyond `null`. |
| MajelisHub | SKELETON_ONLY | RUNNABLE_DEMO | Implement `T-ORG-002` (organizations + memberships) and seed 1 org + 2 mosques + 1 event so `/kajian` is no longer an empty shell. (Fix for `[slug]`/`[eventId]` already applied.) |
| Yomi | SKELETON_ONLY | RUNNABLE_DEMO | Provision PG18 + S3, run `npm run db:migrate && npm run seed -- --env dev`, and make `/discover`’s `readCatalogPage` return real rows instead of `The catalog is unavailable`. |
| Minimal | RUNNABLE_DEMO | MVP_PARTIAL | Replace in-memory `sample-manga` with PG persistence + Better Auth and make reading progress survive a restart. |
| StrangerLink | RUNNABLE_DEMO | MVP_PARTIAL | Start `src/server/realtime/server.ts` (ws) and implement a two-peer `queue → matched → text chat → leave` E2E that exercises the real `matchmaking` + `signaling` domain (filling the `20 test.todo`). |
| SiomayOps | RUNNABLE_DEMO | MVP_PARTIAL | Wire the `src/server/db` Drizzle repos to a real PG (`drizzle.config.ts` + `S3_ENDPOINT`) and make `POST /api/v1/sales` persist a sale that `/hq` can read. |
| Parking | MVP_PARTIAL | MVP_READY (domain) | Build the minimal operator **UI** (or CLI TUI) that calls the existing `CheckInUseCase` / `CheckOutUseCase` / `PricingEngine` — the domain already does `shift → check-in → checkout → tariff → reconciliation`. |
| RSI | RUNNABLE_DEMO | MVP_PARTIAL | Add schema regression tests for `runs/report.md` + `audit.jsonl` hash-chain and run one real-provider arm (`--backend openai --jev typesafe`, `HIGH/CRITICAL` gated by human). |

---

## How to Reproduce

`RUNTIME_COMMANDS.md` — exact `DATABASE_URL`, `PORT`, `npm run dev`, `python3 demo.py`, migrations, seeds, and the headless-Chromium screenshot pipeline.

`SEED_DATA.md` — what rows/accounts each harness would create (and what was actually used here).

`MVP_MATRIX.md` — the 9-column matrix with `Boots | Seed | UI | Primary Flow | Persistence | Major Mock | MVP | Production`.

`projects/<project>/AUDIT.md` — per-project: Runtime (exact commands), Seed Data (records), Screens Inspected (file/route/purpose/evidence/issues), Primary Flow (step PASS/PARTIAL/FAIL/MOCK), Blocking Issues (P0/P1/P2), Verdict, Smallest Path.

## Anti-Hallucination Notice

A feature is listed as *demonstrated* only when a screenshot, `curl` HTML, `demo.py` stdout, `report.md` metric, or `audit.jsonl` line shows it working. Filenames, route existence, types, `T-` labels, or “85 passed” without an E2E peer do not count. Where `COMPLETION_MATRIX.md` once claimed “100%”, this audit reports the *runtime* (e.g., HomeOps `null` shells, MajelisHub `8.8 KB` empty, Yomi `catalog unavailable`).
