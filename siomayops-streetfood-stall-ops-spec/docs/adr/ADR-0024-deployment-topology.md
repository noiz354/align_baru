# ADR-0024: Deployment topology: containers, single region

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-19
- **Area:** Operations
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

The pilot needs a reproducible, reversible deployment that one or two engineers can operate, without a platform team. Traffic is modest (thousands of stalls at most) and latency requirements are regional.

## Decision

Ship immutable container images (web + worker from the same build) to a managed container runtime or a small VM cluster, fronted by a managed edge with TLS and rate limiting. Use managed PostgreSQL with PITR and S3-compatible storage. Deploy via GitHub Actions with explicit migration steps, rolling replacement, health checks and rollback by image tag. Kubernetes is explicitly not used.

## Consequences

Positive: minimal moving parts, predictable costs, rapid rollback, one place for secrets. Negative: vertical scaling first; multi-region later would require a new ADR and a different topology.

## Alternatives considered

Kubernetes (rejected: operational cost exceeds benefit at this scale); serverless-only (rejected: cold starts, connection pooling complexity for a stateful Postgres workload); PaaS with vendor-managed build (rejected: less control over migrations and image immutability).

## Compliance impact

Single-region hosting with documented cross-border considerations (PRIVACY.md §7); access to production is audited and time-boxed.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
