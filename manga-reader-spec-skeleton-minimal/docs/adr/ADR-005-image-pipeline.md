# ADR-005: Image pipeline

Status: Accepted (provider/version caveats noted below)
Date: 2026-09-26

## Context
Greenfield authorized manga reader requires dependable production foundation with simple operations, security and bounded reader/media performance. This decision governs future implementation, not implementation now.

## Decision Drivers
Stable support; mature ecosystem; operational simplicity; clear module boundary; licensing/security; performance on mobile; testability; data integrity.

## Options Considered

### Option A
Sharp planned for isolated bounded decode/resize/format derivative pipeline; originals quarantined.

### Option B
ImageMagick

### Option C
Client-only original delivery

## Decision
Sharp/libvips supports constrained common transformations with efficient processing; ImageMagick broad format exposure/deployment weight; client-only fails bandwidth/consistent derivatives and exposes original formats. Risks native dependency and decoder exploits; isolate resources/allowlist formats, update frequently. Revisit benchmark or format/legal need. This is a constraint, not authorization to implement. Stack exact versions must be revalidated and pinned at kickoff.

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
benchmark or format/legal need.

## References
https://sharp.pixelplumbing.com/ ; https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
