# MajelisHub — Audit (2026-09-28)

**MVP readiness:** `SKELETON_ONLY` · **Production readiness:** `NOT_READY`

## 1. Runtime

**Exact commands used:**

```bash
cd majelishub-pengajian-event-platform-spec
npm install --legacy-peer-deps  # 233 pkgs, Next 16.3.6, EBADENGINE Node22 vs >=24 <25

# Boot BEFORE fix (demonstrates the blocking wiring bug):
DATABASE_URL=postgres://majelishub:majelishub@localhost:5432/majelishub_dev \
PORT=3102 npm run dev -- --port 3102 --hostname 0.0.0.0
# → unhandledRejection: Error: You cannot use different slug names for the same dynamic path ('slug' !== 'eventId').
#    at src/app/api/v1/events/[eventId] vs src/app/api/v1/events/[slug]
# → ⚠ Failed to reload dynamic routes + ERR_CONNECTION_REFUSED (no LISTEN on 3102)

# Allowed minor fix (boot wiring, no new feature):
cp src/app/api/v1/events/\[slug\]/route.ts src/app/api/v1/events/\[eventId\]/route.ts
rm -rf src/app/api/v1/events/\[slug\]  # removes conflict, merges GET /api/v1/events/[eventId]

# Boot AFTER fix:
DATABASE_URL=postgres://majelishub:majelishub@localhost:5432/majelishub_dev \
APP_URL=http://localhost:3102 PORT=3102 npm run dev -- --port 3102 --hostname 0.0.0.0
# → ▲ Next.js 16.3.6 (Turbopack) - Local: http://localhost:3102 - Ready in 381ms

# Verification:
curl -s http://localhost:3102/ | head # → <html lang="id"><main id="konten"><!--$--><!--/$--></main> (shell, 8.8KB)
curl -s http://localhost:3102/kajian | head
npm run typecheck  # tsc --noEmit → PASS
npm run docs:lint  # node ops/docs-lint.mjs → 0 findings
npm run test       # vitest run → 125 passed / 281 todo (PGlite in-process, @electric-sql/pglite 0.5.8)
```

**URL:** `http://localhost:3102` (shell layout `src/app/layout.tsx` with `tokens.css` + `base.css`, `skip-link`).

**Personas (spec):** admin (org OWNER), organizer, attendee (registrant), `ustadz`, `mosque` owner.

**Auth:** `better-auth 1.6.33` + `@better-auth/drizzle-adapter` with `DATABASE_URL` PG, durable rate-limit (`src/server/http/rate-limit.ts`).

## 2. Seed Data

**What was seeded for this audit:** *Nothing product* — only the 10 foundation migrations are applied in `drizzle/` (4 SQL files):

* `0000_identity_and_tenancy.sql`, `0001_row_level_security.sql` (TenantScope + RLS policies + session vars), `0002_audit_events.sql` (hash-chained `audit_events` + SELECT/INSERT-only grants + anti-mutation trigger + `requirePermission` buffer), `0003_auth_rate_limit_counters.sql`.

**What the 10 delivered tasks actually create (no product rows):**

* `T-OBS-002`/`T-SEC-004`: logging interface + privacy allow-list + metric catalog + `majelishub/no-token-logging` lint.
* `T-SEC-007`: `audit_events` table.
* `T-ORG-001`: `user`, `session` in PG + `getSession()` round-trip (`src/app/api/auth/[...all]/route.ts`).
* `T-SEC-001`: `TenantScope`, `deriveScope`, scope-first repos, RLS session vars.
* `T-SEC-002`: `requirePermission` choke point + `public-routes.ts`.
* `T-DOCS-001`/`T-DOCS-003`/`T-ARCH-002/003`: docs lint + VS-0 gates.

**Required seed for this audit’s visual spec (per `SEED_DATA.md`, not yet exist):**

* 1 organization, 2 mosque locations (if model permits), admin/organizer/attendee users, upcoming kajian + completed event, registrations, attendance/check-in records.
* Would need `T-ORG-002` (organizations+members) → `T-MOSQUE-001` (mosque create/edit) → `T-EVENT-003` etc. No `seed` script exists today; PGlite tests use factories.

**Demo accounts to reserve (when wired):** `admin@majelishub.test` OWNER, `organizer@majelishub.test`, `attendee@majelishub.test`.

## 3. Screens Inspected

All via headless Chromium (same bundle as HomeOps) with `setBypassCSP(true)` where needed. `majelishub` has no strict CSP like StrangerLink, but the shell is still empty.

| File | Route | Purpose | Visible evidence | Visual issues |
|---|---|---|---|---|
| `screenshots/majelishub/01-home.png` (8.8 KB) | `GET /` | Organization dashboard (should show upcoming kajian) | Shell: `lang="id"`, `skip-link` `Lewati ke konten`, `<main id="konten">` empty, `<title>MajelisHub</title>`, `Arsip kajian masjid…`, includes `src_app_styles_127cmbm.css` but no content. `src/app/page.tsx` is a shell: `TODO T-ARCH-001` | Blank main, no dashboard, no event list, no CTA |
| `screenshots/majelishub/02-kajian.png` (8.8 KB) | `GET /kajian` | Event list (`/kajian`, docs/product/EVENTS.md) | Same shell, `page.tsx` is `ROUTE SHELL - /kajian` with contract `T-EVENT-003` but `return null` or placeholder | Empty, placeholder card absent, shell UI |
| `screenshots/majelishub/03-masjid.png` (8.8 KB) | `GET /masjid` | Mosque list | Same shell | Empty |
| `screenshots/majelishub/04-kajian-detail.png` (8.8 KB) | `GET /kajian/test-slug` | Event detail (`/kajian/[slug]/page.tsx`) | Same shell | — |
| `screenshots/majelishub/05-masjid-detail.png` (8.8 KB) | `GET /masjid/test` | Mosque detail (`/masjid/[slug]/page.tsx`) | Same shell | — |

**Visual inspection summary:** No product screen renders content. Every `src/app/**/page.tsx` checked is `ROUTE SHELL` with `throw new Error("Not implemented: T-…")` or `return null` and a `TODO(T-…)` marker. The layout is the only thing that paints (`tokens.css` + `base.css`). No “Not implemented” error overlay is visible because the shell returns empty, not a throw in rendering.

## 4. Primary Flow

**Spec journey (README → `docs/product/EVENTS.md` + `REGISTRATION.md` + `CHECKIN.md`):** *organizer creates/publishes or views event → attendee registration exists → attendee can be checked in → attendance state updates*

| Step | Expected | Actual | Verdict |
|---|---|---|---|
| 1. Organizer views/creates event at `/kajian` or `/kajian-baru` | List or `T-EVENT-003` form (calendar, ustadz, masjid, capacity) | `/kajian` is empty shell; `/kajian-baru/page.tsx` is `ROUTE SHELL` with `Not implemented`. No form. `GET /api/v1/events` throws `Not implemented: T-EVENT-003`. | **FAIL — documentation-only** |
| 2. Attendee registration exists (`/daftar/[eventId]`) | `T-EVENT-003` registration row, QR | `src/app/daftar/[eventId]/page.tsx` is shell; no `POST /api/v1/events/[eventId]/registrations`. No attendee view. | **FAIL — unavailable** |
| 3. Attendee can be checked in (`/kajian/[slug]/check-in`) | QR validation (`/api/v1/checkin/validate`), manual/walk-in, context/summary | `src/app/kajian/[slug]/check-in/page.tsx` is shell; `POST /api/v1/checkin/validate` throws. No QR UI. | **FAIL — unavailable** |
| 4. Attendance state updates (`/kajian/[slug]/kehadiran`, `/api/v1/events/[eventId]/attendance`) | Attendee count, corrections, exports | No rows; `attendance` table is not migrated beyond identity. | **FAIL — unavailable** |
| 5. Audio/transcript follow-up (`/rekaman`, `/transkrip`) | Recording session, transcription review | `T-AUDIO-*` / `T-TRANSCRIPTION-*` are post-VS-1, not implemented. | **MOCK — synthetic adapter only (no provider)** |

**Overall flow:** **FAIL** at step 1 — the foundation is real (tenancy, RLS, audit, rate-limit) but the product is `documentation-only`. This is the correct `PHASE 0` behavior per `README.md` (“VS-1 IN PROGRESS — ten tasks delivered”).

## 5. Blocking Issues

**P0 — prevents MVP flow:**

* **No organization/mosque/event domain** — `T-ORG-002`, `T-MOSQUE-001`, `T-EVENT-003` are not landed. `src/app/api/v1/events/[eventId]/route.ts` is a shell `throw`. Without `organizations` + `mosques` + `kajian` rows there is nothing to list at `/kajian`. `docs/TRACEABILITY.md` maps 179 P0/P1 requirements to tasks, but the code for the first product slice is absent.
* **Route param conflict (fixed)** — the `slug` vs `eventId` divergence at `src/app/api/v1/events` caused `You cannot use different slug names…` and made the app **not runnable** before the one-line fix. This is a wiring bug, not a missing feature, but it blocked any screenshot without the fix.

**P1 — serious but workaround exists:**

* **No product seed** — without `organizations` + `mosques` + `events` + `registrations` + `attendance` seed, the audit cannot show `upcoming vs completed` or `registration vs check-in`. PGlite tests have factories but no shared `seed` harness.

**P2 — polish / production concern:**

* **Real QR generation/scanning, audio capture, transcription provider, notification delivery, payments** — all `not-selected` per `AGENTS.md` (“Still prohibited everywhere: fake implementations, production UI, QR generation/scanning, audio capture”). These are post-MVP production adapters.

## 6. MVP Verdict

**`SKELETON_ONLY`**

**Why:** The app **boots reproducibly** after the one-line wiring fix (`Ready in 381ms`, `typecheck` PASS, `docs:lint` 0 findings) and the 10 foundation tasks are **real** (identity + RLS + hash-chained audit + rate-limit). However **most primary functionality is placeholders, stubs, or `Not implemented`** — every product page is a `ROUTE SHELL` (8.8 KB empty screenshots) and every product API throws `Not implemented: T-EVENT-003`. This matches the spec’s own freeze note: “Every function that is not part of those ten tasks still throws `Error(\"Not implemented: <TASK-ID>\")` … Still prohibited everywhere: fake implementations…”. A technically running app with unusable screens is not MVP-ready.

## 7. Smallest Path to MVP

To reach **`RUNNABLE_DEMO`** (organization dashboard + event list/detail are viewable):

1. **Implement `T-ORG-002` (organizations + memberships)** — creates `organizations` + `members` with `TenantScope`, proves `requirePermission` works beyond the public allow-list.
2. **Implement `T-MOSQUE-001` (mosque create/edit, `T-ORG-003` role switching/invite)** — inserts 2 mosques (slug `al-ikhlas`, `al-falah`) so `/masjid` is no longer empty.
3. **Implement `T-EVENT-003` (event CRUD list/detail)** — make `GET /api/v1/events` + `GET /api/v1/events/[eventId]` return real rows and `src/app/kajian/page.tsx` + `src/app/kajian/[slug]/page.tsx` render them (not `null`). Add a deterministic dev seed (1 upcoming `Kajian Subuh 2026-09-28`, 1 completed `Kajian Maghrib 2026-09-21`, 2 registrations, 1 attendance) via a new `ops/seed.mjs` (mirroring Yomi’s `INSERT … ON CONFLICT DO NOTHING`).

After those three, the primary flow `organizer views event → attendee registration exists` would be `PARTIAL` (check-in would still be stub). The slug conflict is already fixed; no other roadmap work is needed for the next level.
