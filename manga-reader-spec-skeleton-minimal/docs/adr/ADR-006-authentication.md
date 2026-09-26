# ADR-006: Authentication

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Use mature managed identity or well-maintained auth library selected at implementation start; application owns authorization/session policy contract; no custom crypto/password/session primitives.

### Option B
Custom auth

### Option C
External OAuth-only

## Decision
Avoid rolling security-sensitive primitives; managed service may offer mature lifecycle but vendor/data residency constraints; OAuth-only excludes basic account options and still needs policy. Provider/library remains open pending region, account recovery, MFA and cost decision. Mitigate adapter boundary, threat review, session tests. Revisit business requirements/provider landscape. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

## Consequences

### Positive
Clear default and migration boundary; avoids premature distribution and provider dependence where possible.

### Negative
Selected choice still requires operational expertise, periodic upgrades, and compatibility testing; some provider/library decisions remain open.

## Risks
Ecosystem changes or poor workload fit.

## Mitigations
 adapter boundary, threat review, session tests.

## Revisit When
business requirements/provider landscape.

## References
https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
