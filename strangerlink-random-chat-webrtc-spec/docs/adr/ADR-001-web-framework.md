# ADR-001 — Web Framework

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Architecture
- **Related:** [ADR-003](ADR-003-realtime-transport.md), [ADR-015](ADR-015-observability.md)

## Context

StrangerLink is a web-only, mobile-first product. The user funnel is: landing → age gate
→ mode selection → queue → chat. Most of the funnel is server-rendered content with
strict authorization gates; the chat surface is a long-lived interactive client that
talks to a separate realtime service.

We need a framework that:

- gives a clean, enforceable server/client boundary, because **moderation, ban
  enforcement, and rate limiting must be server-side** (NFR-SEC-001);
- renders the entry funnel fast on mid-range Android over 4G (NFR-PERF-001);
- supports route-level code splitting so the chat bundle does not bloat the landing page;
- is maintainable by a small team with a large hiring pool;
- has a credible, actively patched security posture.

## Problem

Which web framework should the application be built on?

## Decision Drivers

1. **Security boundary quality.** Authorization must be enforceable server-side and must
   not be bypassable by a framework feature.
2. **Mobile first-load performance.** JS budget is a hard constraint.
3. **Team size and hiring.** One small team must build and maintain this.
4. **Ecosystem for realtime + WebRTC.** Examples, libraries, and debugging tools.
5. **Maintenance and patch cadence.** We are running a product where an auth bypass is a
   safety incident, not just a security incident.
6. **Long-term viability.** We are not going to rewrite in two years.

## Options Considered

### Option A — Next.js (App Router)

Current stable 16.x. Turbopack default for dev and build. Cache Components. Async-only
request APIs. React 19. Requires Node.js 20+.

**Strengths:** Server Components and Server Actions give a real server-side execution
boundary. Route-level code splitting is automatic. `instrumentation.js` is stable and
integrates with OpenTelemetry. Enormous ecosystem and hiring pool.

**Weaknesses:** The May 2026 coordinated security release fixed **13 advisories**,
several of them **High-severity authorization bypasses** via middleware/proxy
(App Router segment-prefetch URL bypass, Pages Router i18n default-locale path bypass,
dynamic route parameter injection). Caching semantics are subtle and easy to get wrong.

### Option B — Remix / React Router 7

Excellent data-loading model, nested routes, progressive enhancement.

**Weaknesses:** Smaller ecosystem for WebRTC/signaling examples. Smaller hiring pool for
this team's location. No meaningful advantage over Option A for our use case.

### Option C — SvelteKit

Very good performance characteristics, small runtime, pleasant DX.

**Weaknesses:** Smallest ecosystem of the three for realtime and WebRTC. Fewer
Trust & Safety-relevant libraries and patterns. Team familiarity is lower.

### Option D — Vite + React SPA (no SSR framework)

Maximum control, smallest conceptual surface.

**Weaknesses:** Loses server-side rendering for the entry funnel, which is where our
first-load performance budget is spent. Forces us to hand-build a server-side
authorization boundary for route data. More bespoke infrastructure to operate.

## Decision

**Adopt Next.js 16 (App Router) with React 19 and Tailwind CSS v4.**

Two binding constraints come with this decision:

1. **Authorization must never live in middleware alone.** The May 2026 advisory class
   demonstrated that middleware/proxy-based authorization can be bypassed via
   segment-prefetch and locale-path tricks. Therefore **every route handler, server
   action, and server component that reads safety-critical state re-checks
   authorization server-side**. Middleware may be used for coarse redirects and
   telemetry, never as the sole authorization gate. This is recorded as NFR-SEC-001.
2. **Async request APIs are mandatory.** `cookies()`, `headers()`, and `params` are
   async in Next 16. Code that assumes sync access will not compile.

## Consequences

**Positive**

- The entry funnel can be server-rendered with minimal JS, protecting the JS budget.
- Server Components give us a natural place for ban checks that a client cannot skip.
- Automatic route-level splitting keeps the chat bundle off the landing page.
- `instrumentation.js` gives a stable OpenTelemetry hook without custom server plumbing.

**Negative**

- We carry the responsibility of not relying on middleware for authorization.
- Caching semantics require discipline; we will default to **no caching** on any route
  that touches session, ban, or report state, and will assert this in review.
- Turbopack is the default bundler; any build tooling assumptions must be validated
  against it in CI.
- React Server Components add a mental-model cost for contributors new to the pattern.

## Risks

| Risk | Severity | Likelihood |
| --- | --- | --- |
| A future Next.js advisory reintroduces an auth-bypass class we rely on | High | Medium |
| A contributor caches a safety-sensitive route | High | Medium |
| RSC/client boundary confusion leads to moderation logic leaking into a client bundle | High | Medium |
| Turbopack incompatibility with a future dependency | Low | Low |

## Mitigations

- **MR-1:** Security-sensitive route handlers and server actions each carry an explicit
  authorization test in `tests/unit` and `tests/integration`; CI fails without it.
- **MR-2:** A lint/review rule: any route touching session, ban, report, or moderation
  state must be explicitly non-cached and must state so in a comment.
- **MR-3:** `server-only` package guard on `src/server/**` so importing moderation or
  ban logic into a client bundle is a build error, not a runtime leak.
- **MR-4:** Dependabot plus a documented triage SLA in [CONTRIBUTING.md](../CONTRIBUTING.md);
  framework security releases are treated as safety incidents and patched within 72 hours.
- **MR-5:** Pin exact framework versions; upgrade deliberately behind a codemod, never
  opportunistically.

## Revisit Conditions

- Next.js ships a **stable, documented server-side authorization primitive** that is not
  middleware-based — at that point consolidate authorization and close MR-1.
- The team's first-load budget cannot be met with the App Router on target devices.
- A competing framework gains a materially better realtime/WebRTC ecosystem.
- Next.js enters a maintenance posture without a clear successor line.

## References

- Next.js releases — https://nextjs.org/blog
- Next.js May 2026 security release (13 advisories incl. middleware/proxy bypass) —
  https://vercel.com/changelog/next-js-may-2026-security-release
- Next.js 15 async request APIs — https://nextjs.org/blog/next-15
- [docs/research/STACK-2026.md](../research/STACK-2026.md)
- [SECURITY.md](../SECURITY.md)
