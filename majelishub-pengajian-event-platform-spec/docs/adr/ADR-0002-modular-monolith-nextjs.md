# ADR-0002 — Modular monolith on Next.js 16 App Router

- Status: Accepted · Date: 2026-09-26 · Deciders: Principal Architect, SRE
- Requirements affected: NFR-OPS-001, NFR-OPS-005, NFR-PERF-001/003 · Related: ADR-0020, `ARCHITECTURE.md` §4

## Context

The product spans participant mobile web, an organizer console, an entrance scanner, a
recording console, a transcript editor and an admin surface — plus asynchronous jobs. The
operating organization is often a single volunteer. Deployment targets range from a single
VPS for one mosque to a managed host for a regional community.

The three candidate shapes:

1. **Server-rendered monolith** (Next.js App Router + server actions): one deployable, one
   language, one auth model, one type system.
2. **SPA + separate API service**: two deployables, two deploy pipelines, duplicated auth and
   validation logic, CORS surface.
3. **Microservices**: separate services for events, check-in, media, transcription.

## Decision

Build one **modular monolith**: a single Next.js 16 application (App Router, React Server
Components, Server Actions, route handlers in `src/app/api/**`) plus a **single worker process**
running the same codebase for background jobs. Module boundaries are enforced by directory
structure, publication rules and dependency linting — not by network calls.

## Alternatives considered

- **SPA + API service.** *Gains:* independent scaling of API and UI, team separation.
  *Costs:* two deploys, duplicated authorization, an API contract to version, and a CORS/CSRF
  surface for every participant action. *Rejected:* our traffic is low and bursty; the
  entrance needs predictable latency, not independent scaling.
- **Microservices (events service, check-in service, media service, transcription worker).**
  *Gains:* independent failure domains and scaling. *Costs:* distributed transactions across
  the check-in → attendance boundary (the exact path where correctness matters most), N
  deploy pipelines, service discovery, distributed tracing as a prerequisite rather than a
  benefit, and an operational skill floor a volunteer team cannot meet. *Rejected:* the
  product has one team-of-one and a shared database; the complexity buys nothing.
- **Serverless functions per route.** *Costs:* long-lived recording sessions, background
  workers and large uploads fit poorly; cold starts hurt the entrance. *Rejected* (the web
  tier could still be hosted on a serverless Next.js platform, ADR-0020).

## Consequences

**Positive:** one repository to test and ship; transactions can span check-in → attendance
inside the database; Server Actions remove most hand-written endpoints; RSC keeps participant
pages light (`NFR-MOB-003`); extraction of a module later is possible because ports exist.

**Negative:** the web and worker processes share a codebase, so a bad import can couple them
(enforced by boundary rules); scaling is coarse (scale the whole app, not one module); a
runaway CPU task (ffmpeg) must be isolated by process, not by design accident.

**Neutral:** module boundaries are a social contract plus lint rules; they will erode if
reviewers do not enforce them.

## Enforcement

- `ARCHITECTURE.md` §5 dependency rules, enforced in Phase 1 by an ESLint
  `no-restricted-imports`/boundary rule (`T-ARCH-002`).
- A feature may import another feature only via its `index.ts` public surface.
- No module may reach into another module's tables; cross-module effects go through service
  calls or domain events.
- ffmpeg and all media processing run only in the worker process.

## Revisit trigger

Extract a service when **all** hold: a module's resource profile materially differs (e.g.
GPU-bound transcription), it has an independent scaling requirement measured in production,
and the team has ≥ 3 engineers with operational capacity. Until then, a new module is a
folder.
