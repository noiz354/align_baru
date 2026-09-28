# DATA MODEL

The eight projects have eight independent schemas. This document records only what is **measured**,
plus the one cross-project rule that keeps being violated.

## Measured state, per project

| Project | Store | Tenant column | RLS | Tables | Transactions |
|---|---|---|---|---:|---|
| siomayops | `LOCAL_FILE` — `memory-store.ts` persists to `data/db.json` (atomic tmp+rename); survives a hard kill, verified | `organizationId` on every stored row | none | 0 (a drizzle schema exists, unused) | none — `withTransaction` is `fn({})` |
| homeops | PostgreSQL via `scripts/migrate.ts` | `household_id` on 6+ tables | **0 tables** | 14 applied / **17 defined** (`0001` unregistered) | drizzle-orm |
| majelishub | PostgreSQL, 6 reviewed migrations | `organization_id` | **4 tables**; `event_registrations` and `event_attendance` unprotected | 13 | real, with `SET LOCAL ROLE` + RLS session variables |
| strangerlink | process `Map`s | none (no database) | n/a | 0 | n/a |
| manga | `Map` hydrated from a JSON file | `userId` in `progress` records | none | 0 (one JSON file) | none |
| parking | SQLite + a hash-chained jsonl ledger | `zone_id` / shift-scoped | n/a (single-tenant device) | several | real — every mutation also writes an outbox row in the same transaction |
| rsi | `runs/`, `audit.jsonl`, `baseline-*.json` | n/a | n/a | n/a | n/a |

## The cross-project rule

> **A table that carries a tenant column and holds tenant content must have row-level security
> enabled in the same migration that creates it, and a test must fail if one does not.**

Stated in `majelishub/drizzle/0001_row_level_security.sql`. Enforced in **zero** of the four
projects that have a database: majelishub has two unprotected tables from `drizzle/0005`, and homeops
has none protected at all.

Adopted by `F-003` (homeops). Follow-up for majelishub is `F-012-S3`.

## Enforcement pattern (proven — copy it, do not invent one)

Verified on real PostgreSQL 18.4:

```sql
ALTER TABLE "kajian_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kajian_events" FORCE ROW LEVEL SECURITY;      -- without this the owner bypasses it
CREATE POLICY "kajian_events_tenant_isolation" ON "kajian_events"
  AS PERMISSIVE FOR ALL TO majelishub_app
  USING      ("organization_id"::text = current_setting('app.organization_id', true)
              OR current_setting('app.scope', true) = 'PLATFORM')
  WITH CHECK ("organization_id"::text = current_setting('app.organization_id', true)
              OR current_setting('app.scope', true) = 'PLATFORM');
```

```ts
// application side, per transaction, always with SET LOCAL (transaction-scoped)
SELECT set_config('app.organization_id', scope.organizationId, true);
SET LOCAL ROLE majelishub_app;   // non-superuser, NOBYPASSRLS
```

Measured outcomes: no scope variable → **zero rows**; Org A scope → Org A's rows only.

**`FORCE ROW LEVEL SECURITY` is not optional.** Without it the table owner bypasses the policy, which
is the exact failure this rule exists to prevent — and is what a dev connection would do.

## Public projections are the deliberate exception

A public read (majelishub's `/kajian`, `/masjid`) must run **outside** a tenant scope, and therefore
cannot rely on RLS. It must rely on an explicit `WHERE` clause in a single auditable module —
`src/features/content/public-projections.ts` — filtering to published rows only.

This asymmetry is a real trap and must be stated at every public-projection call site, because
"RLS protects this table" is not true for a public read. It is also why the public pages currently
leak: they are neither a public projection nor a scoped read.

## Tokens and capabilities

| Property | Rule | Measured |
|---|---|---|
| Storage | hash only, never plaintext | correct in majelishub (`token_hash`, `sha256`) |
| Return | exactly once, in one field, to the entitled party | **broken**: `accessToken` and `qrPayload` both carry the raw token; a duplicate registration returns another attendee's `shortCode` |
| Payload | no personal data, no entity ids, no URL parameters | opaque 64-hex today; the raw token in the QR payload defeats the intent |
| Lookup cost | rate limited per identity | **absent** on both public routes; short codes are ~730M combinations and are accepted as credentials |

## Money

| Rule | Where it is already correct |
|---|---|
| Integer minor units, no float | siomayops, parking |
| A payment is `PAID` only on verified provider evidence | siomayops (HMAC + `timingSafeEqual`), parking (refuses to close on QRIS) |
| Expected cash is never adjusted to the counted amount | siomayops, parking |
| A variance requires a reason and is never auto-corrected | siomayops, parking |
| The audit entry is written in the same transaction as the change | majelishub, parking. **Not** siomayops — its audit is in memory, so it is lost with the state it describes. |

## Audit

Two working implementations, worth copying:

- **majelishub** — `sha256` over a canonical payload including `prev_hash`, `(organization_id,
  chain_position)` unique, per-organization `pg_advisory_xact_lock` so concurrent writers queue
  rather than collide, `SELECT … FOR UPDATE` on the head, and a fail-closed throw so the caller's
  transaction rolls back. **Known gap:** `chain_position` type differs between drivers (`F-007`).
- **parking** — append-only `audit_ledger.jsonl`, plate masking on historical rows, photo retention
  frozen while an incident is open.

siomayops emits audit events with `actorKind` and `requestId` and a real `audit.queried` entry, which
is good shape — but the store is a `Map`, so none of it is a durable trail.

## Data that must be lost, and data that must not

| Class | Examples | May be in memory? |
|---|---|---|
| Ephemeral | queue position, active session presence, message buffer, draft UI state | yes |
| Safety | bans, reports, moderation decisions, safety events | **no** — strangerlink gets this wrong |
| Business | shifts, sales, payments, stock, rooms, chores, registrations, attendance, audit | **no** |
| Identity | users, sessions, memberships | **no** — manga gets this wrong |

## Seeding

> **A seed script may insert rows. It may never create schema.**

`homeops/scripts/seed-wave2-homeops.mjs` creates `room`, `chore_definition` and `chore_occurrence`
with raw `CREATE TABLE`. That is why `GAP-P0-HOM-03` was invisible: the app works on the seeded
PGlite file and returns `500` on a properly migrated PostgreSQL. `F-004` deletes the path and adds a
test that asserts the absence.
