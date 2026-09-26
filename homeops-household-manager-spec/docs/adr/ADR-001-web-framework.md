# ADR-001: Web Framework — Next.js App Router

## Status
Accepted

## Date
2026-09-26

## Context
HomeOps is a mobile-first, installable web application for 2–10 household members, maintained by one developer. It needs server-rendered, fast-first-paint screens (kitchen use, flaky mobile networks), server-side authorization at every boundary (household isolation is non-negotiable), a small set of mutations (complete chore, mark trash full, restock, report issue), and it must eventually support a service worker and Web Push. The 2026 ecosystem offers React-based full-stack frameworks (Next.js App Router), meta-frameworks with their own data layer (Remix/React Router v7, TanStack Start), Rails-style server-rendered options, and a pure SPA + separate API split.

## Problem
Which framework gives server-enforced authorization, streaming server rendering, progressive enhancement and a single deployable artifact — without importing an enterprise-scale architecture or experimental APIs into a household app?

## Decision Drivers
- Server-side rendering with streaming for a ≤2 s first paint on mid-range phones (FR-DASH-007, NFR-PERF-001).
- Server Actions / route handlers for mutations that never expose domain rules to the client (NFR-SEC-001).
- Mature, stable, widely deployed in 2026; security patches available quickly.
- An installable PWA path without fighting the bundler.
- One artifact to build and ship (NFR-MAINT-001).
- Ability for a coding agent to work incrementally with strong typing (AGENTS.md).

## Options Considered
1. **Next.js 16 App Router (React 19.2, Turbopack, Node runtime)** — production-mature App Router; Server Components + Server Actions; official PWA/Web Push stories; single deployable.
2. **Remix / React Router v7 framework mode** — excellent web-fundamentals model, smaller ecosystem for PWA push and image handling, fewer 2026 production references at our scale.
3. **TanStack Start** — promising, but the least battle-tested of the three at router/framework level in 2026.
4. **SvelteKit / Nuxt** — strong frameworks, but the team-of-one value comes from the React/TypeScript hiring and tooling pool, plus React's Server Component maturity for our read-heavy dashboard.
5. **SPA (Vite + React) with a separate Node API** — two artifacts, client-side authz risk, no streaming, more glue.
6. **Rails/Django-style monolith** — server-rendered maturity, but a second language/toolchain beside TypeScript and a weaker fit for interactive mobile UI.

## Decision
Adopt **Next.js 16.x (App Router, React 19.2, Node.js runtime, Turbopack builds)**, deployed as a Node server (see ADR-016). Server Components render read surfaces; Server Actions handle mutations; route handlers are limited to health checks, scheduler triggers and push subscription endpoints. Cache Components (`use cache`) and explicit `revalidateTag` are used only where a documented staleness rule exists.

Reserve `proxy.ts` for cross-cutting request concerns (security headers, correlation IDs) and forbid authorization decisions there — authorization belongs to the feature boundary (SECURITY.md#principles).

## Consequences

### Positive
- Server-enforced authz and tenant scoping at the request boundary; the client never receives another household's data.
- Streaming + skeletons match DESIGN.md §10 loading states without manual orchestration.
- One artifact, one process: the same process can host the scheduler (ADR-013).
- Progressive enhancement: core actions work as form posts before JS hydration.
- App Router is the mainstream 2026 default: abundant documentation, agent familiarity, patch cadence.
- TypeScript end-to-end reduces contract drift for future implementing agents.

### Negative
- App Router caching semantics are a known footgun; mistakes produce stale dashboards.
- Server/client boundary discipline is a continuous code-review burden (`"use client"` leaks, serialization constraints).
- Framework-level breaking changes arrive roughly yearly (Next 12–18 month major cadence), forcing upgrade work.
- Next.js security advisories are frequent enough that patching must be part of normal operations (16.2.6 batched 13 fixes).

## Risks
| Risk | Impact |
| --- | --- |
| Implicit caching shows stale chores/trash state | Members act on wrong information |
| Server Action misuse exposes internal fields | Data leakage across surfaces |
| Turbopack plugin incompatibility | Build breakage on upgrade |
| Framework major upgrade mid-development | Schedule risk |

## Mitigations
- No implicit caching relied upon: mutations call `revalidateTag` explicitly for the paths they affect; every volatile surface renders its freshness (DESIGN §11 E-6).
- Server Action inputs are validated with Zod at the boundary; outputs are explicit DTOs from `features/*/dto` (API.md).
- Only bundler-agnostic tooling is adopted (Serwist over `next-pwa`, no webpack-only plugins) — see docs/research/STACK-2026.md#9.
- Pin exact versions in the lockfile at VS-0; patch within 7 days for security releases (RUNBOOK.md#dependency-security-patch).
- Keep domain logic framework-free so a framework change would not touch `src/domain/**`.

## Revisit Conditions
- A framework upgrade requires rewriting domain-adjacent code (would indicate boundary leakage).
- Dashboard staleness bugs persist after explicit cache-tag discipline.
- Requirement changes make a non-React or a server-only rendering model clearly cheaper (e.g. dropping interactive mobile flows — unlikely).

## References
- PRD.md — FR-DASH-007, NFR-SEC-001, NFR-PERF-001, NFR-MAINT-001
- DESIGN.md — §6 responsive, §10 loading, §11 errors
- ARCHITECTURE.md — §4 layering, §7 request lifecycle
- docs/research/STACK-2026.md#2
- TASKS.md — T-PLAT-001, T-PLAT-002
