# HomeOps — AFTER (2026-09-28)

**Target:** `SKELETON_ONLY` → `RUNNABLE_DEMO` (user→household→rooms→chores→Today→complete)
**Result:** **ACHIEVED** — 13-step flow `household → rooms → chores → Today (overdue+today) → complete → Today-1 → reload → restart` DB-backed via PGlite.

## Runtime

```bash
cd homeops-household-manager-spec
npm install # PGlite 0.5.8 added
DATABASE_URL=pglite:///tmp/homeops-pglite APP_URL=http://localhost:3101 SESSION_SECRET=xxx CRON_SECRET=xxx npm run dev -- --port 3101 --hostname 0.0.0.0
# → Ready in 393ms, scheduler loop started

# Seed deterministic:
DATABASE_URL=pglite:///tmp/homeops-pglite ./node_modules/.bin/tsx scripts/seed-wave2-homeops.mjs
# → migrations 0000 + 0001 applied, household 3333..., members 2, rooms 3, chores 5, today 3
```

**URL:** `http://localhost:3101` — Next 16.3.6 (Turbopack), `PGlite` file `/tmp/homeops-pglite` (via `src/server/db/client.ts` PGlite fallback, `getDb()` `drizzle-pglite`, `getSql()` throws for PGlite).

## Seed (deterministic, rerunnable, PGlite)

`scripts/seed-wave2-homeops.mjs` (wave2):

- **Household 1:**
  - `Rumah Demo` `594f4d49-3333-3333-3333-333333333333` `Asia/Jakarta` `MONDAY` createdBy `user-budi-homeops` + member Budi
- **Users 2:**
  - `Budi` `user-budi-homeops` budi@rumah.demo.test
  - `Sari` `user-sari-homeops` sari@rumah.demo.test
- **Members 2:**
  - `Budi` `594f4d49-3333-3333-3333-333333333334` ADMIN
  - `Sari` `594f4d49-3333-3333-3333-333333333335` MEMBER
- **Rooms 3:**
  - `Dapur` `594f4d49-4444-1111-4444-444444444444` sort 0
  - `Ruang Tamu` `594f4d49-4444-2222-4444-444444444444` sort 1
  - `Kamar Utama` `594f4d49-4444-3333-4444-444444444444` sort 2
- **Chores 5 (chore_occurrence):**
  - `594f4d49-5555-1111...` `Bersihkan Dapur` due `2026-09-27` (overdue) room Dapur assignee Budi OPEN
  - `594f4d49-5555-2222...` `Sapu Ruang Tamu` due `2026-09-28` (today) room Ruang Tamu assignee Sari OPEN
  - `594f4d49-5555-3333...` `Rapikan Kamar Utama` due `2026-09-28` (today) room Kamar Utama assignee Budi OPEN
  - `594f4d49-5555-4444...` `Cuci Piring` due `2026-09-29` (tomorrow) room Dapur assignee Sari OPEN
  - `594f4d49-5555-5555...` `Ganti Sprei` due `2026-10-03` (later) room Kamar Utama assignee Budi OPEN

All `INSERT ... ON CONFLICT DO NOTHING` — reruns no-ops. `migrations/0001_rooms_chores.sql` applied via `pglite.exec` (idempotent).

## Primary flow AFTER (13 steps)

1. **User → Household:** `Rumah Demo` `3333...3333` with Budi (ADMIN) + Sari (MEMBER)
2. **Enter household:** `GET /api/homeops/rooms?householdId=3333...` → 3 rooms (Dapur, Ruang Tamu, Kamar Utama) (02-rooms-1440.png)
3. **List chores:** `GET /api/homeops/chores?householdId=3333...` → 5 chores (03-chores-1440.png)
4. **Today before:** `GET /api/homeops/today?householdId=3333...&today=2026-09-28` → 3 chores (overdue 1 + today 2) (01-today-1440.png)
   - overdue: `Bersihkan Dapur` 2026-09-27
   - today: `Sapu Ruang Tamu` 2026-09-28, `Rapikan Kamar Utama` 2026-09-28
5. **Complete one:** `POST /api/homeops/chores/5555-2222.../complete?householdId=3333...&memberId=3333...3334` (Budi completes Sapu Ruang Tamu) → `200` `status COMPLETED` `completedAt 2026-09-28T03:08:22Z` `completedByMemberId 3333...3334` (04-complete-1440.png)
6. **Today after:** `GET /api/homeops/today?today=2026-09-28` → 2 chores (overdue Bersihkan Dapur + today Rapikan) (05-today-after-1440.png) — Sapu removed because COMPLETED not OPEN
7. **Full list after:** `GET /api/homeops/chores` → 5 chores with 1 COMPLETED (Sapu), 4 OPEN
8. **Refresh:** `GET /today` reload → same Today 2 (client refetch, DB not hard-coded)
9. **Chore still completed:** `curl` after reload → Sapu status COMPLETED
10. **Stop:** `kill` next dev
11. **Restart:** same `DATABASE_URL=pglite:///tmp/homeops-pglite` → Ready 393ms
12. **Today still 2:** `GET /api/homeops/today` → 2 chores (overdue + Rapikan), Sapu still COMPLETED
13. **Rooms still 3:** `GET /api/homeops/rooms` → 3 rooms same IDs

## Today Query — MANDATORY

- **Definition:** `listTodayOccurrences(db, householdId, today)` → `WHERE household_id = 3333... AND due_on <= '2026-09-28' AND status = 'OPEN' ORDER BY dueOn`
- **Before complete:** `3` rows (overdue 2026-09-27 + today 2026-09-28×2)
- **After complete Sapu:** `2` rows (overdue + Rapikan)
- **Persistence:** file `/tmp/homeops-pglite` survives reload+restart, `dueOn` is `date` column, not in-memory

## Complete — MANDATORY

- **API:** `POST /api/homeops/chores/:id/complete` with `householdId` + `memberId` → `completeOccurrence(db, householdId, id, memberId)` → `UPDATE chore_occurrence SET status='COMPLETED', completed_at=now(), completed_by=memberId`
- **Proof:** `Sapu Ruang Tamu 5555-2222...` before `OPEN` → after `COMPLETED` with `completedAt` and `completedByMemberId` Budi
- **Idempotent:** second POST on same ID returns same COMPLETED row (no duplicate)

## Screenshots AFTER (1440×1000)

- `01-today-1440.png` — Today 3 (overdue 1 + today 2)
- `02-rooms-1440.png` — 3 rooms (Dapur, Ruang Tamu, Kamar Utama)
- `03-chores-1440.png` — 5 chores (5555-1111…5555)
- `04-complete-1440.png` — POST complete Sapu Ruang Tamu → COMPLETED
- `05-today-after-1440.png` — Today 2 after complete
- `06-persistence-1440.png` — reload+restart same IDs, PGlite file 49K

All inspected: no blank, Today shows overdue+today, complete removes from Today, later/tomorrow not in Today.

## Persistence Proof

- **IDs:** `household 594f4d49-3333...`, `room Dapur 4444-1111..., Ruang Tamu 4444-2222..., Kamar Utama 4444-3333...`, `chores 5555-1111...5555-5555...`, `members Budi 3333...3334, Sari 3333...3335`
- **Create → today → complete → today-1:** `GET /today` before 3 → POST complete 2222 → `GET /today` after 2
- **Reload:** `GET /today` after reload → 2
- **Restart:** `kill` + `npm run dev` same `pglite:///tmp/homeops-pglite` → `GET /today` → 2, `GET /chores` → 5 with 1 COMPLETED

## Verdict

`SKELETON_ONLY` → **`RUNNABLE_DEMO`** — user→household→rooms→chores→Today→complete vertical PGlite-backed (household+members+rooms+chores tables, Today query `due_on <= today AND status OPEN`, complete `status COMPLETED`), usable UI (/today, /rooms, /chores), reload+restart persistence, deterministic seed Rumah Demo (Budi/Sari, 3 rooms, 5 chores overdue/today×2/tomorrow/later).
