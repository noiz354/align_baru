# MajelisHub Changes — Wave 2 (2026-09-28)

## Files changed

- `src/server/db/client.ts` — added PGlite branch (`pglite:///…`), `withScopedTransaction` bypass for PGlite, helper `isPGliteDb`
- `src/server/db/schema/events.ts` — expanded `kajian_events` with `description/status/startsAt/endsAt/visibility` if missing (uuid primaryKey defaultRandom fallback)
- `src/server/db/schema/index.ts` — barrel exports `events`
- `drizzle/0004_kajian_events.sql` — create `kajian_events` table, indexes
- `src/server/db/repositories/events.ts` — added `tenantPredicate` + `organizationScope` enforcement (first RLS layer) in `findEventById/listEvents/createEvent/updateEvent/deleteEvent`
- `src/app/dasbor/page.tsx` — rewrote with `Suspense` + `MajelisHubDashboard`
- `src/app/dasbor/majelishub-client.tsx` — NEW: org→mosque→event vertical (fetch `/api/majelishub/…` with `x-majelishub-user`, RLS demo selector, rate-limit/audit notes, add event form via `event.write`)
- `src/app/masjid/page.tsx` — NEW: public mosque directory (20, `listMosques` via org loop)
- `src/app/masjid/[slug]/page.tsx` — NEW: org/mosque detail with `notFound` for missing
- `src/app/kajian/page.tsx` — NEW: public event list (20, pglite branch)
- `src/app/kajian/[slug]/page.tsx` — NEW: event detail with org/mosque mapping, `notFound`
- `scripts/seed-wave2-majelishub.mjs` — rewrote for PGlite: `ensureTables` via `readdir drizzle/*.sql` + `pglite.exec`, `INSERT ... ON CONFLICT DO NOTHING` raw SQL for orgs/users/members/mosques/events, skips `majelishub_app` errors, audit entry via `computeHash` if missing

## Migrations

- `drizzle/0004_kajian_events` — applied via `pglite.exec` (idempotent)
- 0000-0003 already applied (users, orgs, members, mosques, audit, rate-limit)

## Seed

`scripts/seed-wave2-majelishub.mjs` — deterministic, rerunnable: 2 orgs + 3 users + 3 members + 2 mosques + 1 event + audit pos1.

## No changes to projects 1-5

Projects 1-5 locked at `mvp-wave2-baseline-cc80bac`.
