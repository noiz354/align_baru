# ADR-0006: Money representation: integer minor units

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Finance
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Floating-point arithmetic produces rounding drift invisible until reconciliation fails. IDR has no circulating minor unit, but percentage discounts, allocations and future multi-currency needs require an explicit representation.

## Decision

Represent money as a `Money` value object carrying an integer amount in minor units plus an ISO currency code. For IDR the minor unit is 1 rupiah. Arithmetic is integer-only; percentage computations round half-up once, at the final step, and allocation preserves totals exactly.

## Consequences

Positive: exact arithmetic, deterministic totals, snapshot-able values, currency-aware by construction. Negative: every boundary (provider decimal strings, CSV imports, UI input) must convert deliberately; developers must not treat money as `number`.`

## Alternatives considered

Float/number arithmetic (rejected: drift); decimal.js or similar arbitrary precision (rejected: unnecessary for a zero-decimal currency and adds a dependency); storing formatted strings (rejected: locale coupling).

## Compliance impact

Supports defensible financial records: totals recomputable from snapshots must equal stored totals exactly.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
