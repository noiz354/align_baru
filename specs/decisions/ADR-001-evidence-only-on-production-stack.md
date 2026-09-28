# ADR-001 — Completion evidence is produced only on the production stack

**Status:** Accepted · **Date:** 2026-09-28 · **Supersedes:** none

## Context

Three separate "verified" claims in this repository were produced against PGlite:

- majelishub's entire RLS evidence. `withScopedTransaction` returns a bare transaction when
  `isPglite`, and `scripts/pglite-migrate.mjs` skips `ENABLE RLS` and `CREATE POLICY` outright. The
  demo database has **no row-level security at all**.
- homeops' entire wave-2/wave-3 evidence, on a database whose domain tables were created by a seed
  script rather than by the migration runner. The deploy path returns `500`.
- majelishub's audit-chain assertions, where PGlite returns `chain_position` as a number and
  `node-postgres` returns a string. The divergence was live and undetected.

A fourth pattern compounds it: a `500` in the audit-chain write was the only thing preventing the
`x-majelishub-user` bypass from becoming a silent unauthorized write. A defect was masking a defect.

## Decision

1. PGlite is acceptable for **test speed** in unit and near-unit scope. It is not acceptable as the
   source of any claim about persistence, row-level security, or driver behaviour.
2. Any claim of "verified against PostgreSQL" must name the server, the version, and the command, and
   must be reproducible from the commit.
3. A PGlite run that skips a property (RLS, a transaction, a constraint) must **skip visibly** with a
   reason, never pass quietly.
4. The integration tier in CI runs against a real PostgreSQL service, not PGlite.

## Consequences

- `F-007` adds a `postgres:18` service job for majelishub and a harness that reports its engine.
- homeops' integration tier must stop skipping (`F-019`); until it does, no homeops claim about
  persistence is admissible.
- Existing `MVP_AUDIT` evidence produced on PGlite is archived, not cited. See
  `AUDIT_2026-09-28/DOCUMENTATION_RECONCILIATION.md`.
- Local `npm test` stays fast, because the default remains PGlite. Only the evidence tier moves.

## Alternatives rejected

- **Ban PGlite entirely.** Rejected: it is a genuinely good hermetic harness and removing it would
  make the unit tier slow for no security benefit.
- **Require Docker for local dev.** Rejected: `embedded-postgres` gives a real PostgreSQL 18 in
  seconds, as this audit did, with no container runtime.
