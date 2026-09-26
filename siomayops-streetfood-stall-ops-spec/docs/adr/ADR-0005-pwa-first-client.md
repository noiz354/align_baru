# ADR-0005: PWA-first client (offline shell)

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Client
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

Operators use cheap Android phones. Store submission cycles, app-store policies, and two native codebases are disproportionate for a single small team, while a PWA installs from the browser and works offline with a service worker.

## Decision

Ship an installable PWA (manifest + service worker via Serwist in VS-16) with an offline app shell, an offline fallback page, and an outbox-based sync (ADR-0017). No native apps in the first 24 months.

## Consequences

Positive: one codebase, instant updates, no store review, works on the phones operators already own. Negative: service-worker cache pitfalls require discipline (never force-reload mid-shift); push notification reliability varies by OEM (in-app alerts are primary).

## Alternatives considered

Native Android app (rejected: cost, store friction, duplicate logic); React Native (rejected: same duplication plus new toolchain); web-only without offline (rejected: violates NFR-OFFLINE-001).

## Compliance impact

Enables offline reporting without collecting extra data; cache purge on logout protects shared devices.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
