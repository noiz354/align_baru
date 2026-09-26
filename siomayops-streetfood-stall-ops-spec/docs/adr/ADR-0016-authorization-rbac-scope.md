# ADR-0016: Authorization: in-app RBAC + scope resolution

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-1
- **Area:** Security
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Eight-to-nine roles combine with geographic and ownership scopes (org/region/area/stall/self). A mis-scoped read exposes another operator's cash records; a mis-scoped write could corrupt reconciliation.

## Decision

Implement a single `authorize(actor, action, subject, scope)` gate used by every use case, plus repository methods that require an explicit scope parameter (INV-14). Roles are coarse capability sets; scope is a separate, mandatory check. Denials are audited. Field-level masking handles sensitive attributes (phone numbers, evidence).

## Consequences

Positive: one place to review, unit/integration testable per route and role, no external policy engine to operate. Negative: complex policies (e.g. tenant-custom rules) would require code changes; acceptable at our scale. Revisit trigger: >25 roles or tenant-specific policy needs.

## Alternatives considered

Casbin (rejected: extra configuration language); OPA/Rego (rejected: sidecar policy engine and language); Cerbos (rejected: another service to run); per-route ad-hoc checks (rejected: unverifiable).

## Compliance impact

Supports least privilege and segregation of duties evidence for audits; denial auditing supports intrusion detection.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
