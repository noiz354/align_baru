# ADR-001: Application Framework

Status: Accepted
Date: 2026-09-26

## Context

Yomi needs: server-rendered catalog/detail pages (SEO-irrelevant but fast-first-byte and progressive), a heavily interactive client reader, a JSON API (route handlers), server-side session auth, and file upload handling. The project is a greenfield, single-team (agent-crew) build, targeted at a 2026 stable ecosystem.

## Decision Drivers

1. Stable, maintained, production-proven (per 2026-stack-validation.md — Next.js 16 stable since Oct 2025, 16.3.x current; 15.x EOL Oct 2026).
2. One framework covering SSR pages + client components + API + middleware (fewer integration surfaces).
3. Strong TypeScript story end-to-end.
4. File-based routing that matches the planned route map (1:N with the route skeleton in `src/app`).
5. Ecosystem/hiring depth and long-term maintenance (Vercel-backed, ~11 months of 16.x production track record).
6. No lock-in that prevents self-hosted Docker deployment (must run on plain Node 24, not Vercel-only).

## Options Considered

### Option A — Next.js 16 (App Router) + React 19

App Router with React Server Components, route handlers, middleware, Turbopack. Self-hosts on Node 24. 16.x stable since Oct 2025; current 16.3.6 (2026-09-22).

### Option B — Next.js 15.x

Same capabilities, mature — but its LTS security support ends October 2026, i.e., one month into our build. Starting on a line that is already leaving support violates the stability rule.

### Option C — React Router v7 (Remix lineage) on Node

Excellent full-stack TS framework. Chosen against because: (a) its deployment ergonomics for Docker + custom middleware + streaming SSR are younger in the 2026 ecosystem than Next 16's; (b) App Router's server actions/streaming + file routes map 1:1 to our planned architecture without extra design work; (c) the 2026 hiring/ecosystem center of gravity for this exact feature set (RSC data pages + interactive client reader + API) is Next.

### Option D — SvelteKit / Nuxt

Viable, stable, but smaller 2026 ecosystem for the React-centric reader libraries we may reach for (virtualized lists, gesture handling) and weaker fit with the mandated React candidate.

## Decision

**Next.js 16.3.x (App Router, Turbopack) + React 19.3, Node 24 LTS, TypeScript 6.0 strict.** Server Components for all data pages; Client Components only for the reader and interactive islands; Route Handlers for `/api/v1/*` and `/media/*`; Next middleware for session presence checks (authoritative checks always re-run in the handler/service — middleware is not the security boundary).

## Consequences

### Positive
- One dependency graph for pages, API, and auth; type-safe route params.
- Streaming SSR gives fast TTFB for catalog/detail (NFR-PERF-001/004) while the reader shell hydrates independently.
- File-based routes make the planned route map (`/manga/[slug]/chapter/[chapter]` etc.) literal and auditable.
- Largest 2026 ecosystem for reader-side React libraries if needed.

### Negative
- Framework surface area is large; agents must respect the RSC/client boundary (enforced by convention + lint in VS-0).
- Self-hosting means we own Node process ops (documented in DEPLOYMENT.md).
- Next 16 is ~11 months old at start — patch-level surprises possible (mitigation: pin minor, patch-upgrade in CI).

## Risks

- **R1:** Breaking patch in 16.4/17 during build. → Mitigation: pin `16.3.x`; upgrade only with a full milestone verification pass.
- **R2:** RSC boundary misuse causes data leaks to client bundles. → Mitigation: ESLint boundary rules (VS-0), code review checklist in AGENTS.md, bundle-size gate (NFR-PERF-007).
- **R3:** Node 24 → 26 LTS transition (Oct 2026) mid-build. → Mitigation: Node minor bumps are non-breaking by LTS contract; revisit at VS-11.

## Mitigations

See risks; additionally: lockfile committed (NFR-SEC-013); `engines` + `.nvmrc` pin Node 24; CI matrix includes Node 24.

## Revisit When

- Next.js 17 is stable AND 16.x reaches EOL (expected ~2027) — then a planned upgrade slice.
- If self-hosted Turbopack build performance becomes a pain point (measure in VS-4/VS-11).
- If a concrete feature cannot be expressed in App Router without hacks (raise a new ADR).

## References

- docs/research/2026-stack-validation.md (framework section, refs [5][6][7])
- PRD.md §5 (scope), ARCHITECTURE.md §3 (module map)
