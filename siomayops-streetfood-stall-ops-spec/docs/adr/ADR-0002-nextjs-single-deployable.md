# ADR-0002: Next.js 16 App Router as the single deployable

- **Status:** Accepted
- **Date:** 2026-09-26
- **Slice:** VS-0
- **Area:** Architecture
- **Supersedes:** —
- **Superseded by:** —
- **Related:** `ARCHITECTURE.md`, `docs/research/STACK-2026.md`, `ADR.md`

## Context

We need PWA capabilities for operators, an HQ web console, HTTP APIs, and background job entry points, all maintained by a small team on a constrained budget.

## Decision

Use Next.js 16 (App Router, React 19.2, Turbopack as the default bundler) as the single application framework, serving the operator PWA, the HQ console, and versioned JSON route handlers under `/api/v1`. The worker runs the same image with a different entrypoint (ADR-0018).

## Consequences

Positive: one artifact, one build, shared TypeScript types between client and server, framework-documented PWA and offline patterns, excellent ecosystem support. Negative: App Router caching semantics require discipline (we keep `no-store` defaults for operational data and enable opt-in Cache Components only after an ADR); Turbopack service-worker integration has known friction (handled in VS-16). Version pinning is mandatory.

## Alternatives considered

Remix/React Router 7 (rejected: smaller deployment-doc ecosystem for our hosts); SvelteKit (rejected: hiring/TS-first ecosystem); separate SPA + API service (rejected: two deploys, duplicated types, more ops).

## Compliance impact

Supports server-authoritative price and payment decisions inside the same artifact that serves the UI, reducing the chance of bypassed checks.

## Implementation status

**NOT IMPLEMENTED.** Phase 0 is specification and skeleton only. Any function
implementing this decision must currently throw
`new Error("Not implemented: T-XXX-XXX")` referencing the relevant task in `TASKS.md`.
