# ADR-0001: Modular monolith over microservices

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Architecture
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

The system spans operators, shifts, sales, payments, expenses, stock, loyalty and recognition. A single team must operate it, and the transactional coupling between shift, sale, payment and cash closing is strong: a sale, its payment and its audit record must be written atomically. Microservices would distribute that coupling across network boundaries.

## Decision

Build a single deployable application (Next.js) organised as a strictly layered modular monolith: `domain/*` (pure), `features/*` (use cases), `server/*` (adapters), `app/*` (delivery). Module boundaries are enforced by lint rules and documented in ADR-0035. One PostgreSQL database, one object store, one worker process from the same image.

## Consequences

Positive: single deploy, single migration path, local transactions for money paths, cheap to operate, easy to reason about under time pressure. Negative: one codebase to keep tidy; scaling is vertical-first; a runaway module can affect the whole process (mitigated by worker/web separation and load shedding). Revisit trigger: multiple independent teams each needing separate release cadence, or a module whose load profile differs by an order of magnitude.

## Alternatives considered

Microservices per domain (rejected: distributed transactions and ops overhead with one team); serverless functions per endpoint (rejected: connection-pool and cold-start costs, harder local reasoning); a self-contained package monorepo (rejected: no deploy benefit at this stage).

## Compliance impact

Enables a complete audit trail per money path in a single transaction; simplifies reconciliation verification and reduces the risk of partial financial writes.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
