# ADR-002: Database

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
PostgreSQL supported stable major as system of record.

### Option B
MySQL

### Option C
Document database

## Decision
Relational joins, transactions, constraints and mature operations match ownership and ordered catalog data. MySQL is mature but no specific advantage outweighs PG fit. Document DB weakens relational integrity. Risks operational provider dependency; mitigate portable SQL and backups. Revisit if workload is demonstrably non-relational or provider constraints. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

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
if workload is demonstrably non-relational or provider constraints.

## References
https://www.postgresql.org/docs/ ; https://www.postgresql.org/support/versioning/
