# ADR-0010: Immutable price snapshots on sales

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-5
- **Area:** Sales
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Prices change over time. If a sale's amount were derived from the current catalog, historical totals would silently change, destroying trust, reporting, and dispute resolution.

## Decision

Each sale line stores the unit price snapshot resolved at server acceptance (integer minor units, currency, and the originating policy id). Totals derive only from snapshots. Corrections create new records; historical recomputation must reproduce stored totals exactly (test-enforced, INV-01/INV-08).

## Consequences

Positive: history is stable and defensible; margin analysis by realized price becomes possible. Negative: storage overhead per line; catalog changes require care in reporting joins.

## Alternatives considered

Recompute totals from current prices (rejected: rewrites history); store only the total without line snapshots (rejected: no per-item analysis or dispute detail).

## Compliance impact

Directly supports audit and tax/commercial record expectations: recorded amounts never change.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
