# PERSISTENCE REALITY

Classification: `REAL_DATABASE` · `IN_MEMORY` · `LOCAL_FILE` · `MOCK` · `HARDCODED` · `EXTERNAL` ·
`NOT_IMPLEMENTED`.

The question asked of every core workflow: **create → read → update → restart the process → read
again.** A workflow that fails the restart step is not a product.

| Project | Business state | Survives restart? | Class |
|---|---|---|---|
| siomayops | every shift, sale, payment, stock movement, audit row | **YES** — via `data/db.json` (see §1) | `LOCAL_FILE` |
| homeops | 17 tables | yes **if** `0001` were registered — it is not | `REAL_DATABASE` (broken deploy) |
| majelishub | organizations, memberships, mosques, events, registrations, attendance, audit | **YES** | `REAL_DATABASE` |
| strangerlink | queue, sessions, messages | no (by design, correct) | `IN_MEMORY` |
| strangerlink | bans, reports, moderation cases, safety events | **no (wrong)** | `IN_MEMORY` |
| manga | catalog, chapters, pages, progress | yes, single machine | `LOCAL_FILE` |
| manga | users, sessions | **no** | `IN_MEMORY` |
| parking | sessions, slots, shifts, incidents, outbox, photo metadata | **YES** | `REAL_DATABASE` (SQLite) |
| parking | audit ledger | **YES** | `LOCAL_FILE` (hash-chained jsonl) |
| rsi | memory, audit, baselines | no, deliberately — `runs/` is regenerable | correct |

## Restart survival, measured

| Project | Test performed | Result |
|---|---|---|
| siomayops | create an incident, restart `npm start`, query `/api/v1/incidents` | record is gone; only the in-process store ever held it |
| homeops | `npm run db:migrate` then `GET /api/homeops/today` | `500` — the tables the endpoint needs were never created |
| majelishub | seed two orgs on real PG 18.4, restart the production server, read `/kajian` | both orgs' events still returned (the leak of GAP-P0-MAJ-02, but state genuinely persists) |
| strangerlink | restart the realtime server | queue, bans, reports all empty |
| manga | restart | catalog survives; every user is logged out |
| parking | `python3 demo.py` writes `parking.db` + `audit_ledger.jsonl` (11 audited actions) | survives; the `pglite`-style claims in other projects are not comparable |
| rsi | `runs/` is git-ignored and regenerable | correct by design |

## Per-project detail

### siomayops — `LOCAL_FILE`, file-backed and atomic (corrected)

**Correction.** An earlier draft of this audit recorded siomayops as `IN_MEMORY` with no persistence
and stated that nothing survives a restart. That is **wrong**. `src/server/db/memory-store.ts` is
file-backed:

```
line   5: * Persistence: file-backed via data/db.json (survives restart), atomic write.
line 484: fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
line 485: fs.renameSync(tmp, DB_PATH);          // atomic replace
```

`persistStore()` is wired into every mutating path — `Map.set`, `Map.delete`, `Map.clear`, and
`auditEvents.push` are wrapped at module load (lines 537–560).

**Verified on a production build** (`NODE_ENV=production`, `next start`, commit `8ebc15f`):

```
POST /api/v1/incidents (no cookie)  → 201  id 8f6c49d8-…
  disk: data/db.json  incidents: 1  auditEvents: 1
kill -9 the process
next start, same data dir, empty process memory
GET /api/v1/audit?limit=5
  audit.queried       | entity: search                                | 16:24:40
  incident.submitted  | entity: 8f6c49d8-9de4-402a-88d8-af592f587fa7   | 15:53:07   ← pre-restart
```

The record and its audit entry **survived a hard kill**. This is `LOCAL_FILE`, not `IN_MEMORY`.

**What remains true, and what this does not fix.** `data/db.json` is a single JSON document rewritten
in full on every mutation: it does not scale, does not support concurrent writers safely beyond
single-process, and cannot express a real transaction. `withTransaction` is still
`return fn({})`. And `GET /api/v1/incidents` returns an empty body — the record persists, but the
list route does not read it back, so the pilot cannot actually see its own surviving data. The
unauthenticated-write finding (GAP-P0-SIO-01) is **unaffected**: it is about identity, not storage.

`src/server/db/memory-store.ts` holds every aggregate; 44 modules import it. `drizzle` and `pg` are
declared dependencies and `src/server/db/schema.ts` defines real `pgTable` statements that nothing
executes.

The transaction helper is the clearest statement of the real state:

```ts
// src/server/db/repository.ts:21
export async function withTransaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
  // In-memory: no real transaction, but we ensure atomicity via synchronous operations
  // For Postgres, this would be a real transaction. Here we just execute.
  return fn({});
}
```

Money, stock and audit state that must not be lost are all held here.
`IMPLEMENTATION_STATUS.md` §"Modules Completed" does not list this.

**Needed:** a real database, real transactions, migrations applied on deploy, and a boot-time
schema-version check.

### homeops — `REAL_DATABASE`, but the deploy path creates half of it

17 tables exist across two SQL files. `migrations/meta/_journal.json` registers only `0000`; drizzle
therefore applies 14 of them. `room`, `chore_definition`, `chore_occurrence` are missing after a
nominal `npm run db:migrate` (exit 0, "applied"). Adding `0001` by hand makes the routes work — which
is precisely why the PGlite-based wave-2/3 evidence never showed the problem: the seed script creates
those tables with raw SQL.

Also absent: **any** RLS. `select relname from pg_class where relrowsecurity` → `[]`.

### majelishub — `REAL_DATABASE`, the only one that survives correctly

Six reviewed SQL migrations, an explicit `db:migrate` runner that refuses a changed checksum and never
runs at boot, `schema_migrations` bookkeeping, and RLS policies on `organizations`,
`organization_members`, `mosques`, `kajian_events`. Verified against real PostgreSQL 18.4: state
persists across a production-server restart.

Two defects, both in §4 of the per-project audit:
- `event_registrations` and `event_attendance` (`drizzle/0005_registrations.sql`) have no RLS and no
  policy, contradicting the rule written into `drizzle/0001`.
- The dev/demo path (`pglite://`) bypasses RLS entirely — `withScopedTransaction` returns a bare
  transaction, and `scripts/pglite-migrate.mjs` explicitly skips `ENABLE RLS` and `CREATE POLICY`. All
  RLS evidence in `MVP_AUDIT` was produced on that path.

### strangerlink — in-memory, and the split is mostly right

`src/server/db/in-memory.ts` is honest in its own comment about ephemeral vs. safety records. The
ephemeral half (queue, active sessions, message buffers) genuinely does not need durability, and
restating that is correct. The safety half — `banStore`, `reportStore`, `moderationStore`,
`safetyEventStore` — does, and a restart silently un-bans everyone.

Consequence: a single-process deployment is coherent; a restart is a safety incident. Multi-process
would additionally need shared state (ADR-003 acknowledges this and does not claim otherwise).

### manga — `LOCAL_FILE` + `IN_MEMORY`

`src/server/db/store.ts` holds `Map`s hydrated from a JSON file at boot, and `sessions` are in memory,
so every user is signed out on deploy. `store.ts:18` describes this as *"durable progress"*; within one
machine it is, across devices it is not. `ARCHITECTURE.md` specifies PostgreSQL; none is present.

### parking — `REAL_DATABASE`, and it is proven

SQLite (`data/parking.db`) with every mutation also writing an `outbox_events` row in the same
transaction, plus a hash-chained `audit_ledger.jsonl`. The 66-test suite and the 10-step `demo.py`
exercise create → read → update → restart. This is the workspace's reference for durability.

### rsi — durable by choice

`runs/`, `audit.jsonl`, `baseline-*.json`. `runs/` is git-ignored and regenerable, which is the correct
call for a prototype whose output is a report, not a service.

## Rule for the follow-up work

A feature may not be marked usable unless **create → read → update → restart → read** was executed
against the real store for the production path — not PGlite, not a `Map`, not a seed script. The PGlite
path is acceptable for test speed but may never be the source of completion evidence, which is what
happened in majelishub and homeops.
