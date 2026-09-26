# ADR-009: Deployment model

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Stateless modular monolith on managed Node LTS runtime with managed PostgreSQL/private object storage/CDN; worker split only when resource isolation demands.

### Option B
Kubernetes + microservices

### Option C
Single VM + local disk

## Decision
Operationally simple and aligned with domain boundaries; Kubernetes adds overhead, VM disk weakens availability/durability. Risks managed provider coupling and workload limits; portable container, backups and explicit interfaces. Revisit scaling/team/isolation evidence. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

## Consequences

### Positive
Clear default and migration boundary; avoids premature distribution and provider dependence where possible.

### Negative
Selected choice still requires operational expertise, periodic upgrades, and compatibility testing; some provider/library decisions remain open.

## Risks
Ecosystem changes or poor workload fit.

## Mitigations
Use adapter boundaries, operational tests and version review.

## Revisit When
scaling/team/isolation evidence.

## References
https://nodejs.org/en/about/previous-releases ; DEPLOYMENT.md
