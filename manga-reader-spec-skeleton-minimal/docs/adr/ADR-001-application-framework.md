# ADR-001: Application framework

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Next.js stable App Router with React stable and strict TypeScript.

### Option B
Remix/React Router

### Option C
Pages Router / bespoke server

## Decision
Integrated routing, SSR, route segments and broad production adoption; use stable APIs only. Remix is credible and portable, but split conventions/services. Pages Router legacy direction; bespoke increases maintenance. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

## Consequences

### Positive
Clear default and migration boundary; avoids premature distribution and provider dependence where possible.

### Negative
Selected choice still requires operational expertise, periodic upgrades, and compatibility testing; some provider/library decisions remain open.

## Risks
 framework coupling/runtime surprises. Mitigate isolate domain services and pin compatible stable release.

## Mitigations
 isolate domain services and pin compatible stable release.

## Revisit When
if deployment/runtime constraints or framework stability change.

## References
https://nextjs.org/docs ; https://react.dev/versions
