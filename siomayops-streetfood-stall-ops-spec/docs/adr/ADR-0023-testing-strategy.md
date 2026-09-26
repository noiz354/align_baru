# ADR-0023: Testing strategy: Vitest 4 + Playwright, stub-first

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Quality
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Money bugs, offline sync bugs and authorization gaps are the expensive failures here; they do not appear in unit tests of rendering. The primary client is a real browser with a real IndexedDB and a real service worker.

## Decision

Use Vitest 4 as the unit and component runner, including Browser Mode (stable since Vitest 4) with the Playwright provider for real-DOM behaviour, visual regression and tap-size/contrast assertions. Use Playwright for e2e journeys on emulated 360×640 Android plus desktop HQ. Integration tests run against a real PostgreSQL. All payment tests use a fake provider adapter; production data is never used. Phase 0 ships TODO-only test skeletons.

## Consequences

Positive: high-confidence tests for the risky paths (offline, idempotency, authorization), fast feedback from Vite integration, trace viewer for failures. Negative: browser tests are slower and need CI capacity; flakiness must be actively managed.

## Alternatives considered

Jest (rejected: slower startup, no real-browser mode); Cypress (rejected: heavier and weaker in 2026 for our needs); jsdom-only component tests (rejected: cannot prove tap sizes, focus or real events).

## Compliance impact

Test data is synthetic; no personal data in test environments, satisfying privacy commitments.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
