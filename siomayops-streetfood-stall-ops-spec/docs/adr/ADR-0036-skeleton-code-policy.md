# ADR-0036: Skeleton code policy and NotImplemented convention

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Process
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

The value of this phase is a design that can be built without renegotiating decisions mid-coding. Premature implementation would bake in untested assumptions and half-written code would hide the shape of the design; equally, documentation that drifts from code is worse than none.

## Decision

Phase 0 delivers specification, architecture, ADRs, workflows, domain models, API contracts, repository layout, interfaces, DTOs, ports, route shells, component shells and TODO tests only. No business logic: every function that would contain logic throws `new Error("Not implemented: T-XXX-XXX")` naming the task in `TASKS.md`. No fake data, no simulated calculations, no provider calls, no authentication implementation, no production dashboards, no email/WhatsApp sending, no migrations applied. Documentation is code: every requirement, task and decision carries a stable ID, stubs and tests cite those IDs, and CI checks that cited IDs exist and that every ADR file is indexed. TypeScript runs in strict mode with branded money types so a `number` cannot be passed where money is expected. The first future implementation task is `T-SHIFT-001` and is explicitly not started in this phase.

## Consequences

Positive: decisions are visible and cheap to change now; the first coding task can start immediately against a complete contract; reviewers challenge design rather than reverse-engineer code; traceability is verifiable. Negative: the repository contains many stubs, so discipline is required not to "fill in" behaviour casually.

Deliberate exclusion: a separate documentation-as-code ADR was folded into this one because it is the same phase-governance decision.

## Alternatives considered

Partial implementation "for realism" (rejected: hides design gaps); prototype-first (rejected: locks in accidental complexity); docs in a wiki (rejected: drifts, poor review, harder traceability); skip docs and start coding (rejected: guarantees rework).

## Compliance impact

Prevents premature collection or processing of personal data by construction and keeps the design reviewable before any real records exist.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
