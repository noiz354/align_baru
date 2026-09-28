# HomeOps — Audit (2026-09-28)

**MVP readiness:** `SKELETON_ONLY` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd homeops-household-manager-spec
npm install --legacy-peer-deps   # 226 pkgs, Next 16.3.6, warns EBADENGINE Node 22 vs >=24 but boots

# Boot (no PG provisioned — intentional to show honest shell state):
DATABASE_URL=postgres://homeops:homeops@localhost:5432/homeops_dev \
SESSION_SECRET=test-secret-32-bytes-long-xxxxxx \
CRON_SECRET=test-cron-secret \
APP_URL=http://localhost:3101 PORT=3101 \
npm run dev -- --port 3101 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack) - Local: http://localhost:3101 - Ready in 667ms - Running next.config.ts 134ms

# Verification (without PG):
curl -s -L http://localhost:3101/ -w "CODE:%{http_code}\n" # → 307 redirect via RootPage, then not-found
curl -s http://localhost:3101/sign-in | head   # → contains "We cannot find that page" not-found.tsx
npm run typecheck  # tsc --noEmit → PASS (when PG not needed)
npm run lint       # eslint . → PASS
npm run test:unit  # vitest unit — some pass, product tests are todo skeletons
```

**Other commands that *would* be used with PG (not run in this audit, documented for reproducibility):**

```bash
npm run db:generate   # drizzle-kit generate → migrations/0000_identity_tenancy_platform.sql
npm run db:migrate    # tsx scripts/migrate.ts — refuses prod-named DB unless --i-know-this-is-production
DATABASE_URL=postgres://homeops:homeops@localhost:5432/homeops_dev npm run db:seed  # tsx scripts/seed.ts — refuses unless DB name contains dev|test|local
npm run scheduler:tick # tsx scripts/tick.ts
npm run verify:docs   # node scripts/verify-docs.mjs
```

**URL:** `http://localhost:3101` (Next `standalone` output per `next.config.ts`, `proxy.ts` does CSP nonce).

**Personas (spec):** household member (OWNER/ADMIN/MEMBER/HELPER), `Sari` OWNER, `Budi` ADMIN, `Dita` MEMBER, `Andi` HELPER (away 2026-01-05..12).

## 2. Seed Data

**What was seeded for this audit:** *Nothing beyond the filesystem* — no PG was provisioned, so `seedDevelopmentData({})` was not invoked. The screenshots therefore show the **honest empty state** (not fake data).

**What the harness *would* seed if PG were up (`src/server/db/seed/fixtures.ts` + `run.ts`):**

* `seedId(n)` = `00000000-0000-4000-8000-00000000xxxx` (deterministic), `SEED_INSTANT` = `2026-01-05T00:00:00.000Z`, `SEED_EMAIL_DOMAIN` = `homeops.test`.
* **Households (5):**

| Id | Name | Tz | Owner | Members |
|---|---|---|---|---|
| `…0001` | HH_MAIN | Asia/Jakarta | Sari 101 | Budi 102 ADMIN, Dita 103 MEMBER, Andi 104 HELPER away 01-05→12 |
| `…0002` | HH_CONTROL | America/New_York | Nora 201 | Felix 202, Maya 203, Jonas 204 |
| `…0003` | HH_WIDTH | Europe/Berlin | Leni 301 | Tomas 302 |
| `…0004` | HH_WIDTH_SOUTH | Pacific/Auckland | Hana 311 | Wiremu 312 |
| `…0005` | HH_EMPTY | Asia/Jakarta | Rani 401 | — (onboarding) |

* **Users:** `seed-user-hh-main-sari` etc at `…@homeops.test`, `emailVerified: true`.
* **Settings:** per `defaultSettings()`: `maintenanceLeadDays 7`, `snoozeMaxHours 24`, `infoExpiryDays 14`, `dailyCapCeiling 10`, `roomOverrideMaxHours 168`.
* **Not seeded yet (throws):** any `PENDING_SEED_SECTIONS` — `chores`, `rooms`, `resources`, `maintenance`, `issues`, `alerts`, `activity` etc: `seedDevelopmentData({sections: ["chores"]})` throws `Not implemented: T-xxx — the "chores" fixture section needs …`. So the required visual-audit rows (5+ chores overdue/today/upcoming, issue, maintenance, low-stock, activity) **do not exist**.

**Accounts for QA (when auth is wired, `T-ORG-001`):** `Sari` OWNER, `Budi` ADMIN, `Dita` MEMBER, `Andi` HELPER/away — session via `getSession()` + cookie, not password in seed.

## 3. Screens Inspected

All screenshots are `1440×1000` (plus one mobile `390×844`) via headless Chromium with `setBypassCSP(true)`. Background is `antialiased`, `globals.css` tokens.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/homeops/01-root-redirect.png` (8.0 KB) | `GET /` | Root should redirect to `/sign-in` (T-PLAT-002) then routing for authed vs onboarding vs anonymous | HTML shows `NEXT_REDIRECT;replace;/sign-in;307;` then `not-found.tsx` fallback (“We cannot find that page” + `Back to Today`), not a product page | Blank, no household context, no dashboard |
| `screenshots/homeops/02-sign-in.png` (8.0 KB) | `GET /sign-in` | Sign-in (email+pwd, generic failure copy per SECURITY.md §4) | `src/app/(auth)/sign-in/page.tsx` returns `null` (spec-phase skeleton). Rendered output is `not-found.tsx` (“We cannot find that page” + `It may have been moved…` + teal `Back to Today`). No form, no inputs, no recovery link | Placeholder, shell UI, no CTA, no feedback |
| `screenshots/homeops/03-today.png` (8.0 KB) | `GET /today` | Today/dashboard (fixed section order DP-6, hides empty, all-clear state) | Same `null` → not-found. `T-DASH-001` comment says “Returns null by design: no production UI exists in this phase (AGENTS.md §1)”. No `What needs attention?`, no trash, no chore | Empty, not-found, no attention strip |
| `screenshots/homeops/04-chores.png` (8.0 KB) | `GET /chores` | Chore list (5+ chores, overdue/today/upcoming states) | Same not-found, no list | Fake data absent (honest), but no real list |
| `screenshots/homeops/05-rooms.png` (8.0 KB) | `GET /rooms` | Rooms (status in words, no numeric cleanliness scores) | Same not-found | — |
| `screenshots/homeops/06-issues.png` (8.0 KB) | `GET /issues` | Issues | Same not-found | — |
| `screenshots/homeops/07-resources.png` (8.0 KB) | `GET /resources` | Resources (low-stock) | Same not-found | — |
| `screenshots/homeops/08-maintenance.png` (8.0 KB) | `GET /maintenance` | Maintenance | Same not-found | — |
| `screenshots/homeops/09-members.png` (8.0 KB) | `GET /settings/members` | Members | Same not-found | — |
| `screenshots/homeops/mobile-01-root-redirect.png` (4.3 KB) | `GET /` mobile 390×844 | Mobile layout | Same not-found, centered `max-w-md` flex column | — |

**Visual inspection summary:** No route renders product UI. `src/app/(household)/today/page.tsx` literally `export default function Page() { return null; }` plus contract comment `Owning task: T-DASH-001. Returns null by design`. `not-found.tsx` is not product — it is `mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center` with `h1 We cannot find that page`. No “Not implemented” overlay is visible because `null` is rendered, not a throw. `curl` HTML for `/sign-in` contains both the layout and the not-found bundle; no `<form>` tag appears.

## 4. Primary Flow

**Spec journey (PRD → DASHBOARD.md → T-DASH-001 + T-CHORE-*):** *household member logs in → sees today's work → opens a chore → completes it → dashboard updates*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Logs in at `/sign-in` | Form with email+password, `POST` to Better Auth, sets `getSession()` cookie | No form; `Page` returns `null`; Next shows not-found. No `POST`. `Better Auth` is `1.7.6` but no UI wires it. | **FAIL — button has no handler (no button exists)** |
| 2. Sees today's work at `/today` | Dashboard with fixed order: trash state, low supplies, overdue, today, upcoming; one-tap actions with undo | Same `null` → not-found. No `Attention strip`, no `Today` header. | **FAIL — page is empty** |
| 3. Opens a chore at `/chores/[id]` | Chore detail with recurrence, skip/snooze | No chore rows exist; `/chores` is 404 so no link to click. `src/domain/chores/recurrence.ts` throws `Not implemented: T-CHORE-021`. | **FAIL — no data, no handler** |
| 4. Completes it (one-tap) | `PATCH` completes chore, event emitted (EVENTS.md), dashboard revalidates | No Server Action exists; no `createRepositories` path for chores (that slice is `PENDING`). | **FAIL — unavailable** |
| 5. Dashboard updates | `Today` count decrements, chore moves to completed, `activity` appears | No update; dashboard is not-found. `src/domain/activity/services.ts` not implemented. | **FAIL — unavailable** |

**Overall flow:** **FAIL** at step 1. No product state is persisted, no UI control performs a real action.

## 5. Blocking Issues

**P0 — prevents MVP flow:**

* **Every product `Page` returns `null`** — `src/app/(household)/today/page.tsx`, `chores/page.tsx`, `rooms/page.tsx`, `issues/page.tsx`, `resources/page.tsx`, `maintenance/page.tsx`, `activity/page.tsx`, etc. These are **spec-phase skeletons** by `AGENTS.md §1` (“Forbid filling in a `throw` with `return []` — fake is worse than none”). The 252 tasks are the source of truth; `VS-1 / T-HH-001` (Create household) is the first that would make a page real. Until `VS-0` platform (`T-PLAT-001..005`) lands, no page can load household data (`ARCHITECTURE.md §8: no layout may fetch household data`).
* **No authentication UI** — `T-AUTH-001` owns `/sign-in`; the file is `return null`. `better-auth` is installed but the `sign-up → cookie → getSession()` round-trip (`T-ORG-001` style) is not wired for HomeOps.
* **No product seed** — `PENDING_SEED_SECTIONS` for chores, rooms, resources etc throw. So even if UI existed, there would be no `5+ chores` (overdue/today/upcoming) to exercise.

**P1 — serious but workaround exists:**

* **Requires PG18 + `DATABASE_URL` containing `dev/test`** — `scripts/seed.ts` and `scripts/migrate.ts` both refuse a prod-named DB. The audit intentionally ran without PG to show the shell state, but a local PG (`embedded-postgres` via npm, Docker) would be needed to verify `typecheck` + `test:integration` (which are `15 passed on PG18` in prior audit).

**P2 — polish / production concern:**

* **PWA / web-push / photo storage** (`ATTACHMENT_STORAGE_DRIVER`) — `proposed ADR-017` post-`VS-11`, not needed for MVP.
* **Observability** (`OTEL_EXPORTER_OTLP_ENDPOINT`) — optional, `LOG_LEVEL=info` default is no-op.

## 6. MVP Verdict

**`SKELETON_ONLY`**

**Why:** The application **boots reproducibly** (`Ready in 667ms`, `typecheck` PASS) and exposes an honest shell, but **most primary functionality is placeholders, stubs, or `null`**. Runtime evidence shows every product route hits `not-found.tsx` (8.0 KB empty screenshots), not a single form or list. This is **intentional** per `AGENTS.md §0` (“This repository is in DOCUMENTATION + ARCHITECTURE + SKELETON mode. Every function that would contain real logic throws `Not implemented: <TASK-ID>`; every page and component shell returns `null`; … That is intentional and audited”) and `README.md` (“Status: architecture and specification complete — implementation has not started. … Every function … throws `Not implemented`”). No synthetic test can hide it — the browser sees `null`.

## 7. Smallest Path to MVP

Do **not** implement the whole 252-task roadmap. To reach **`RUNNABLE_DEMO`** (today dashboard is viewable on dev seed):

1. **Land `VS-0` platform:** `T-PLAT-001` (`package.json` already done), `T-PLAT-002` (root `layout.tsx` done), `T-PLAT-003` (migrations), `T-PLAT-018` (seed guard done). Prove with `DATABASE_URL=postgres://homeops:homeops@localhost:5432/homeops_dev npm run db:migrate && npm run db:seed` → `seed: users +N, households +M, members +K` and `describeSeededHouseholds()` → `HH_MAIN — 4 member(s)`.
2. **Implement `VS-1 / T-HH-001` (Create household) + `T-AUTH-001` (sign-in) + `T-DASH-001` (today dashboard) in `ROADMAP.md` order** — make `src/app/(auth)/sign-in/page.tsx` a real form that calls Better Auth, and `src/app/(household)/today/page.tsx` read via `createRepositories({db, householdId, clock, ids, actor})` (not null). Keep `shared/types` and `ARCHITECTURE.md §4.1` boundaries (only `src/server/db` touches the driver).
3. **Unblock the seed for visual QA:** add the `256/252` product fixtures to `fixtures.ts` **via that slice’s migration** (the harness already supports `sections` but throws until the migration lands). Seed at least `5+ chores` (overdue/today/upcoming), 2 rooms, issue, maintenance, low-stock, recent activity so `dashboard` has the fixed-order sections to screenshot.

After those three, `/today` would no longer be `not-found` and the `member logs in → sees today's work → completes chore` loop would be `PARTIAL` (needs `T-CHORE-021` recurrence). That is the next level.

**Not needed for next level:** `VS-5` recurrence algorithms, `VS-9` alerts, `VS-10` notifications, `VS-13` PWA sync, `VS-11` uploads, HA, backup strategy, production QRIS/turn, observability completeness.
