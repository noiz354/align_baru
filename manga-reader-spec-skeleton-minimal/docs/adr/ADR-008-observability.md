# ADR-008: Observability

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
OpenTelemetry traces/metrics stable API; structured redacted logs; OTLP collector; avoid cardinality/sensitive data.

### Option B
Vendor-specific SDK everywhere

### Option C
Logs only

## Decision
Vendor-neutral context propagation/export with stable signal support; vendor SDK ties app; logs-only misses latency dependency chains. JS logs signal remains developing per official docs; do not rely on it. Risks overhead/leakage; sampling/redaction/review. Revisit backend based on ops needs. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

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
backend based on ops needs.

## References
https://opentelemetry.io/docs/languages/js/
