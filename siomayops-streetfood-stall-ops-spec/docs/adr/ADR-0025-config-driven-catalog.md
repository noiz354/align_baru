# ADR-0025: Configuration-driven catalog (no hard-coded items)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-4
- **Area:** Domain
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `DOMAIN.md`, `DATA_MODEL.md`, `docs/research/STACK-2026.md`

## Context

Menu items, variants, packages, stock categories and expense categories differ per area, per season and per supplier, and they change without a release. If any of these were code constants, every menu change would need a deploy, and a hard-coded fallback list would silently sell items that a location does not offer.

## Decision

The catalog is configuration data: items, variants, components, unit definitions, stock categories and expense categories are rows managed through HQ admin flows. Code contains no item names, no category lists and no hard-coded fallback. Clients render only what the server returns; if the catalog is unavailable the UI shows an explicit empty/error state rather than a guessed menu. Seed data exists only in development with an explicit `isDemoData` marker and is refused in production. Every catalog change is versioned and validated (a change that would invalidate historical references is rejected; retiring an item archives it).

## Consequences

Positive: menu and pricing operations are business tasks, not release tasks; new areas onboard without code. Negative: HQ must publish a usable catalog before a location can sell, and the admin surface needs validation and preview affordances.

Assessment gap to close before VS-4: which catalog fields can change mid-shift (price is versioned by snapshot; item availability is per-location and may change during a shift).

## Alternatives considered

Hard-coded item constants (rejected: deploy-coupled, silent divergence); code-generated menu from a spreadsheet at build time (rejected: same coupling with extra steps); a separate catalog microservice (rejected: no justification at this scale).

## Compliance impact

Supports accurate pricing and receipt records; historical sales remain interpretable after catalog changes.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
