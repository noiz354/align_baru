# ADR-002 — siomayops: money state moves out of process memory

**Status:** Proposed · **Date:** 2026-09-28 · **Blocked by:** `F-001`

## Context

siomayops declares `drizzle-orm` 0.44.3 and `pg` 8.13.0 as dependencies, and
`src/server/db/schema.ts` defines real `pgTable` statements. **Neither is executed by any runtime
path.** All state lives in `src/server/db/memory-store.ts`, imported by 44 modules, and the
transaction helper is:

```ts
export async function withTransaction<T>(fn) { return fn({}); }
```

`IMPLEMENTATION_STATUS.md` §"Modules Completed" does not record this. A shift, a sale, a payment, a
stock movement and the audit trail that describes them all disappear on restart.

The schema is already written, so this is an adapter gap rather than a design gap.

## Decision

Move money and safety state to PostgreSQL, using the schema that already exists, with migrations
applied on deploy and a boot-time schema-version check.

## Consequences

- Every repository function stops being a `Map` lookup and starts being a query. The 108 passing tests
  must keep passing; they currently exercise the domain logic, which does not change, so most survive
  with a real harness behind them.
- `withTransaction` becomes a real transaction. The `INV-*` rules about same-transaction audit
  finally hold.
- siomayops needs a lockfile before its deploy is reproducible at all.
- The `drizzle/` folder and the journal must exist, with every migration registered — the exact trap
  `F-004` documents in homeops.

## Alternatives rejected

- **Keep memory and add a write-ahead log.** Rejected: it re-implements a database badly, and the
  schema is already written.
- **Adopt the homeops journal mechanism.** Rejected: it is currently broken, which is `GAP-P0-HOM-03`.
  Use drizzle's migrator with a correct journal, and add the "unregistered file is a hard failure"
  assertion that `F-004` adds.

## Open question

`F-001-S2` may need a session table before this ADR is applicable. If sessions land in
`memory-store.ts` for one slice, record it as a stated limitation in that SPEC — do not let it become
silent.
