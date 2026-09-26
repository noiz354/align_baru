# ADR-007: Reader architecture

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Client reader state machine with explicit chapter manifest, direction, mode, bounded virtualization/image window; server supplies authorized metadata/delivery refs; progress via separate port.

### Option B
Server-render every page individually

### Option C
Load complete chapter into DOM

## Decision
Client needed for continuous gestures/keyboard/zoom; SSR every page complicates navigation; eager all-pages harms mobile memory and slow connections. Risks browser memory variance and accessibility with virtualization; bounded resources, no-gesture controls, test 500 pages/mobile. Revisit when perf telemetry demonstrates a different model. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

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
when perf telemetry demonstrates a different model.

## References
PERFORMANCE.md ; docs/product/reader-behavior.md
