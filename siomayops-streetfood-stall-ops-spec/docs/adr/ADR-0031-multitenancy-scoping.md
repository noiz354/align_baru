# ADR-0031: Multi-tenancy and organization scoping

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-1
- **Area:** Architecture
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

The pilot is one organisation, but the domain model already has one obvious tenant boundary (`organization`) that is expensive to retrofit into every table, index and query after data exists. Retrofitting tenancy later typically leaks a cross-tenant read somewhere before it is fixed.

## Decision

Every table carries `organization_id`, every unique constraint includes it, and every repository method requires an explicit scope argument (INV-14) so an unscoped query cannot be written by accident. Authorization resolves scope before data access; a query without scope fails to compile or fails a test. The pilot runs as a single organisation, but nothing in the schema or code assumes only one.

## Consequences

Positive: no migration cliff later, and a structural defence against cross-tenant reads. Negative: slightly noisier queries and slightly larger indexes; scope plumbing must be respected in read models too.

Data residency and per-organisation retention settings become expressible when a second organisation onboards.

## Alternatives considered

Row-level security policies at the database level as the primary mechanism (rejected for now: harder to reason about with connection pooling and migrations; kept as a defence-in-depth option); separate schema per tenant (rejected: migration and connection complexity); no tenancy concept (rejected: retrofit risk).

## Compliance impact

Prevents cross-tenant exposure of personal and financial data, which is the highest-impact privacy failure mode for this product.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
