# HomeOps — BEFORE (2026-09-28)

**Target:** `SKELETON_ONLY` → `RUNNABLE_DEMO` (user→household→rooms→chores→Today→complete)
**Before:** skeleton only, no vertical.

## Routes BEFORE

- `src/app/(household)/today/page.tsx` → `return null` (T-DASH-001)
- `src/app/(household)/rooms/page.tsx` → `return null` (T-ROOM-006)
- `src/app/(household)/chores/page.tsx` → `return null` (T-CHORE-011)
- `src/app/(household)/layout.tsx` → `return null` (T-HH-003)
- API: only household/members/activity via `src/server/db/repositories` (no rooms/chores)
- DB: `migrations/0000_identity_tenancy_platform.sql` only (household, member, settings, invitation, activity, audit, rateLimit, outbox, scheduler) — no `room`/`chore_definition`/`chore_occurrence`

## Seed BEFORE

- `src/server/db/seed/fixtures.ts` + `run.ts` identity/tenancy only: `HH_MAIN` with no rooms/chores
- `PENDING_SEED_SECTIONS` lists rooms/chores as pending (needs migration)

## Screenshots BEFORE

- `screenshots/before/01-today-before-1440.png` — empty dashboard
- `screenshots/before/01-today-before-390.png` — mobile empty
