# STACK-2026 — Production Stack Validation

> Status: **COMPLETE** · Research date: **2026-09-26** · Owner: Principal Architect
> Scope: greenfield stack selection for HomeOps (household operations PWA).
> Selection bias, in priority order: **stable → actively maintained → production-proven → operationally simple**.
> Anything that requires a second stateful service to be "correct" is guilty until proven innocent (see ARCHITECTURE.md#simplicity-budget).

## 0. How to read this document

Every candidate is classified as exactly one of:

| Class | Meaning | May be installed in this phase? |
| --- | --- | --- |
| **SELECTED** | Committed. Architecture, ADRs and skeletons assume it. | No (installation deferred to VS-0 / the slice that needs it) |
| **PLANNED** | Committed to the roadmap, version/API not yet pinned. | No |
| **OPTIONAL** | Allowed behind an interface. Never assumed by core domain code. | No |
| **REJECTED** | Explicitly not used. Reason recorded so it is not re-litigated. | No |
| **DEFERRED** | Decision postponed with a named trigger. | No |

**This phase installs nothing.** `package.json` lists intended ranges for transparency; the lockfile is created in VS-0. See TASKS.md `T-PLAT-001`.

## 1. Runtime & language

| Candidate | Class | Version line at 2026-09-26 | Evidence / notes |
| --- | --- | --- | --- |
| **Node.js** | **SELECTED** | **24.x LTS ("Krypton")** — pin `>=24.11.0` | Node 24 entered Active LTS 2025-10-28, maintenance from 2026-10-20, EOL 2028-04-30. Node 22 is Maintenance LTS (EOL 2027-04-30) — do not start here. Node 26 (Current since 2026-05-05) becomes LTS **2026-10-28**; from Node 27 the release model changes to one major/year, every release becoming LTS. Action: stay on 24 now, evaluate 26 after 2026-10-28 LTS promotion (trigger recorded in ADR-016). |
| **TypeScript** | **SELECTED** | **6.0.x** (last JS-based compiler; GA 2026-03-23) | 6.0 defaults are already the defaults we want: `strict: true`, `target: es2025`, `moduleResolution: bundler\|nodenext`, `types: []` (explicit `@types/node`). ES5/ES3 targets, `moduleResolution: classic`, `downlevelIteration`, `--noImplicitUseStrict` are **removed** — a greenfield project is unaffected. |
| **TypeScript 7 (tsgo, Go compiler)** | **PLANNED** | 7.0 shipped 2026-07; ~10× faster type-check | Not adopted at VS-0: 7.0 does not yet ship the programmatic compiler API used by framework/template tooling, and migration is gated on the 6.0 deprecation clean-up (`--stableTypeOrdering`). Revisit condition: Next.js + ESLint + Drizzle toolchain confirm 7.x support, and our `tsc --noEmit` becomes a CI bottleneck. |
| **tsx / node --experimental-strip-types** | **OPTIONAL** | — | Scripts only (seeds, one-off ops). Node 24 type-stripping is stable enough for throwaway scripts; prefer plain `.mjs` for anything CI-critical. |

## 2. Application framework & UI

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **Next.js (App Router)** | **SELECTED** | **16.3.x** | 16.x is the active stable line (16.0 2025-10; 16.2 2026-03; 16.2.6 2026-05-07 shipped a coordinated batch of 13 security advisories — **pin ≥ 16.2.6**). Turbopack is default and stable for dev **and** build; `middleware.ts` → `proxy.ts`; Cache Components with `use cache`; Server Actions with progressive enhancement. App Router is production-mature in 2026; its residual costs are caching semantics and server/client boundary discipline — both addressed by ADR-001 and PERFORMANCE.md. |
| **React** | **SELECTED** | **19.2.x** (≥ 19.2.4) | Server Components and Server Actions stable since 19.0; 19.2 adds `<Activity>`, `useEffectEvent`, PPR. Security note: `react-server-dom-*` DoS/source-exposure advisories (patched in 19.0.4 / 19.1.5 / 19.2.4) — floor is 19.2.4. `<ViewTransition>` and Fragment refs remain Canary-only: **do not use**. |
| **Tailwind CSS** | **SELECTED** | **4.2.x** | v4 is a Rust-engine rewrite with CSS-first config (`@theme`), container queries and logical properties in core; 4.2 (2026-02-18) added the webpack plugin, new palettes, and large recompile speedups. Consequence for us: **design tokens live in CSS**, not in a JS config — DESIGN-SYSTEM.md therefore specifies tokens as CSS custom properties. Browser floor: Safari 16.4+, Chrome 111+, Firefox 128+ — acceptable for a household PWA in 2026. |
| **shadcn/ui or other component kits** | **REJECTED (for now)** | — | A household app needs ~15 primitives, not a design system dependency. Re-creating 15 primitives is cheaper than owning a kit's upgrade path. Revisit only if a11y-complete primitives become a schedule risk (see ACCESSIBILITY.md). |
| **Client state library (Redux/Zustand/Jotai)** | **REJECTED** | — | Server Components + Server Actions + URL state cover the interaction model (DESIGN.md#interaction-patterns). Introducing global client state now would be an abstraction without a proven need. |

## 3. Data

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **PostgreSQL** | **SELECTED** | **18.x** (18.1 → 18.3 by Feb 2026) | 18 (2025-09) delivers AIO (up to ~3× read improvements), `uuidv7()` for timestamp-ordered keys, virtual generated columns, skip scan on multicolumn B-tree, SCRAM/OAuth auth, page checksums on by default, and `pg_upgrade` that keeps planner statistics. For a small app the headline wins are operational: predictable keys, better `EXPLAIN`, smooth upgrades. |
| **Drizzle ORM** | **SELECTED** | pin exact at VS-0 (0.4x stable line; 1.0 was still in beta per Sept-2026 sources; one source reports a stable v1 — **therefore: verify and pin, do not float**) | TypeScript-defined schema, no codegen step, SQL-transparent, ~tens-of-kB runtime, first-class raw SQL. Fits the "one developer, read the query" constraint. Escape hatch: every repository port is defined in `src/domain/**/ports.ts`, so the query layer is replaceable (ADR-003). |
| **Prisma** | **REJECTED** | 7.x | Excellent migration tooling, but heavier runtime/engine and a codegen step in CI. Its main advantage (schema DSL + Studio) is not worth the operational weight for one maintainer. See ADR-003 for the full comparison. |
| **postgres.js** (`postgres`) | **SELECTED** | 3.4.x | Simple tagged-template driver, built-in pooling, good Node throughput, official Drizzle adapter (`drizzle-orm/postgres-js`). |
| `pg` (node-postgres) | **OPTIONAL** | 8.x | Battle-tested and still the widest ecosystem default; benchmark differences vs postgres.js are small at our scale. Kept as the sanctioned fallback if a managed provider or tooling forces it. |
| **Kysely** | **OPTIONAL** | — | Considered as a "no-ORM" query builder. Rejected as the primary choice only because Drizzle already gives typed schema + migrations; keep as a known escape hatch for complex reporting queries (e.g. dashboard aggregation) if Drizzle's SQL composition becomes awkward. |
| **Redis** | **REJECTED (default)** | — | HomeOps has no caching, rate-limit or queueing requirement that Postgres cannot serve at this scale. Revisit condition is in ADR-013 and PERFORMANCE.md. |
| **SQLite / libSQL** | **REJECTED** | — | Would simplify hosting further, but loses real concurrency, `LISTEN/NOTIFY`, and the ability to run the scheduler as a second process safely. Postgres 18 on one small managed instance is the simpler *correct* choice. |

## 4. Validation & contracts

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **Zod** | **SELECTED** | **4.x** (4.6 current) | Zod 4 is stable with a large parsing speed-up, smaller core, first-class JSON Schema conversion, `z.email()`/`z.url()` built-ins and a pipe API. Used at three boundaries only: server action input, route handler input, and environment config. |
| Valibot / ArkType | **OPTIONAL** | — | Both are viable and smaller; no forcing function to switch. Interfaces (`src/shared/validation`) are thin so swapping is a bounded change. |
| tRPC / oRPC | **REJECTED** | — | The app is one Next.js deployment using Server Actions + a handful of route handlers. A separate RPC layer adds a contract surface nobody consumes (no mobile client, no public API). |

## 5. Auth & security

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **Better Auth** | **SELECTED** | pin exact at VS-0 | Database-backed sessions (immediate revocation), typed session object, first-party Next.js App Router support, built-in rate limiting and secure-cookie defaults, no vendor dependency, self-hosted. Fits household tenancy where "remove a member → sessions must die now" is a real requirement (ADR-004). |
| Auth.js / NextAuth v5 | **OPTIONAL** | 5.x | Fine if the stack later needs OAuth-first or edge-only session validation; rejected as default because JWT sessions cannot be revoked without extra infrastructure — which is exactly the household-offboarding case. |
| Clerk / WorkOS / Auth0 | **REJECTED** | — | Managed identity is a third party holding household member PII for a 3–10 person app; violates the "household privacy, minimal data leaving the instance" stance in PRIVACY.md. |
| Custom password/session code | **REJECTED** | — | Rolling our own session crypto is the classic own-goal. |
| **Web Push (VAPID)** | **PLANNED** | — | Standard Web Push; Apple supports it for home-screen-installed PWAs on iOS 16.4+. Delivery implementation is VS-10. |
| Email (transactional) | **OPTIONAL** | — | Only for invitations and account recovery (VS-10 at the earliest). Provider chosen at implementation time; abstracted behind `src/server/notifications/email.ts`. |
| WhatsApp / Telegram / SMS | **OPTIONAL (post-v1)** | — | Documented as future channels in NOTIFICATIONS.md; no integration in scope. |

## 6. Background processing

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **In-process scheduler** (single Node process, `setInterval`-free, cron-expression driven, DB-claim-based locking) | **SELECTED (VS-9)** | — | HomeOps' scheduled work is: materialise due chores, evaluate alerts, evaluate maintenance due, retention sweep. Frequency: minutes. Volume: hundreds of rows. A long-running Next.js server (ADR-016) can host this **only** with a DB-level lock so that multiple instances cannot double-run jobs. |
| **pg-boss** | **PLANNED** | 10.x line | Chosen queue shape *if/when* durability, retries and deduplication become necessary (notification delivery is the first candidate). Postgres-backed, no Redis, transactional enqueue. Not installed in VS-0. |
| BullMQ + Redis | **REJECTED (default)** | — | Adds a second stateful service for throughput we will never need (ARCHITECTURE.md#simplicity-budget). |
| Vercel Cron / external cron | **OPTIONAL** | — | Becomes relevant only if deployment moves to a serverless host, which ADR-016 currently rejects. |
| Inngest / Trigger.dev | **REJECTED (for now)** | — | Excellent DX, but a vendor in the critical path of a self-hosted household app. Revisit only if the scheduler outgrows pg-boss. |

## 7. Testing

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **Vitest** | **SELECTED** | 4.1.x | v4 is the current stable line; Browser Mode (Playwright provider) reached **stable** in v4 and is configured via `test.browser.instances`. Used for unit + integration + component tests. |
| **Playwright** | **SELECTED** | 1.62.x | Multi-browser E2E, trace viewer, first-class TS, official a11y tooling path via `@axe-core/playwright`. Owns the 10–20 critical journeys, not the unit layer. |
| **@testing-library/react** | **SELECTED** | 16.x | Component-level assertions in Browser Mode. Note: `@testing-library/jest-dom` 7.0 (2026-07) now requires a `@testing-library/dom` peer and Node ≥ 22 — satisfied by Node 24. |
| Jest | **REJECTED** | — | Slower, ESM friction, and Vitest has won the ecosystem for new React/Vite/Next projects. |
| Cypress | **REJECTED** | — | Playwright is faster, multi-browser, and already in the Vitest browser path. |
| `axe-core` | **PLANNED** | — | Automated a11y assertions in E2E and component tests (VS-0 wires the harness, ACCESSIBILITY.md defines the bar). |

## 8. Observability

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **OpenTelemetry JS** | **PLANNED** | stable SDK **2.x** (2.9.0, 2026-07) | Traces and metrics are **stable** in JS; the **logs** signal is still *Development* in JS. Therefore: OTel for traces/metrics, structured JSON logs to stdout via our own thin logger — we do **not** depend on the experimental logs SDK (OBSERVABILITY.md). |
| OTLP collector + backend | **OPTIONAL** | — | Any OTLP-compatible backend. Self-hosting a collector is deferred; VS-15 may export to a hosted free tier or skip export entirely and keep stdout + `/api/health`. |
| Pino / Winston | **OPTIONAL** | — | Only if `console`-based structured logging proves insufficient. A ~60-line logger in `src/server/telemetry` is enough at this scale. |
| Sentry / hosted APM | **OPTIONAL** | — | Revisit if error triage becomes painful; must respect PRIVACY.md redaction rules. |
| Product analytics (PostHog/GA) | **REJECTED** | — | Household routines are sensitive (PRIVACY.md) and the product decision (DESIGN.md) does not need funnel analytics. |

## 9. Delivery & infrastructure

| Candidate | Class | Version line | Evidence / notes |
| --- | --- | --- | --- |
| **Docker** | **SELECTED** | multi-stage, `node:24-bookworm-slim`, Next standalone output | Single artifact, reproducible, host-agnostic; run migrations as an explicit pre-deploy step, never on boot-on-every-replica. |
| **GitHub Actions** | **SELECTED** | checkout@v4, setup-node@v4, upload-artifact@v4, docker/build-push-action@v6 | CI: typecheck → lint → unit/integration → build → E2E (Playwright with `--with-deps`) → docs verification. Free for a public repo; the whole pipeline is cacheable. |
| **docker compose (dev + small prod)** | **SELECTED** | — | `web` + `postgres` + optional `caddy`. No orchestration system. |
| Kubernetes / Terraform | **REJECTED** | — | Wildly disproportionate. A household app runs on one box (or one small PaaS service) with a nightly `pg_dump`. |
| Vercel (as primary host) | **REJECTED (default)** | — | Excellent DX, but serverless exec model conflicts with an in-process scheduler and long-lived DB pooling, and it centralises household data with a third party. Revisit condition in ADR-016. |
| **PWA** | **SELECTED** | manifest + service worker | Installability and offline shell are cheap wins for a "while standing in the kitchen" app. |
| `next-pwa` (@ducanh2912) | **REJECTED** | last release 2024, webpack-only | Incompatible with Next 16 Turbopack default; unmaintained. |
| **Serwist** (`@serwist/next`) | **PLANNED** | current | Maintained Workbox fork, App Router support, bundler-agnostic (works without forcing `next build --webpack`). Adoption is VS-13. |
| Workbox (raw) | **OPTIONAL** | — | Only if Serwist's Next integration lags behind a future Next major. |

## 10. Explicit non-goals (dead ends already ruled out)

- **Microservices / service mesh / event bus**: a household has 3–10 users and one database. ADR-013 and ARCHITECTURE.md forbid the event bus until a real second consumer exists.
- **Native mobile apps**: the PWA covers installability and push on iOS 16.4+ and Android.
- **Multi-region / read replicas**: latency budget is met by a single region near the household (PERFORMANCE.md).
- **ML/LLM features**: not required by any FR; adding one would import privacy surface (PRIVACY.md) with no requirement behind it.

## 11. Consequences for this phase

1. Skeleton code may reference `next`, `react`, `zod`, `drizzle-orm`, `postgres` **by type and contract only**; no runtime wiring is installed.
2. Design tokens must be expressed as CSS custom properties (Tailwind v4 CSS-first), documented in `docs/design/DESIGN-SYSTEM.md`.
3. Any place where an experimental API would have been convenient (`ViewTransition`, OTel logs SDK, `next-pwa`) is explicitly *not* used.
4. Pinning discipline: `package.json` ranges are indicative; **VS-0 (`T-PLAT-001`) produces the lockfile and records exact versions in DECISIONS.md**. Version ambiguity found during research (Drizzle 0.4x-vs-1.0; Better Auth line) is resolved by pinning at VS-0, not by guessing here.

## 12. References

- Node.js release schedule & "Evolving the Node.js Release Schedule" — <https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule>
- Node.js 24 LTS status (NodeSource, 2025-10-31) — <https://nodesource.com/blog/nodejs-24-becomes-lts>
- Next.js 16 / 16.2.6 security batch (MakerKit, 2026) — <https://makerkit.dev/blog/tutorials/nextjs-16>
- React 19.2 status and RSC advisories (Scrimba, 2026) — <https://scrimba.com/articles/react-19-whats-new-for-developers/>
- Tailwind CSS v4.0 and 4.2 (InfoQ, 2026-04) — <https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/>
- PostgreSQL 18 release notes — <https://www.postgresql.org/about/news/postgresql-18-released-3142/>
- TypeScript 6.0 / 7.0 timeline — <https://codersera.com/blog/typescript-6-0-whats-new-breaking-changes-2026/>
- Zod 4 — <https://zod.dev/>
- Drizzle vs Prisma (2026) — <https://anotherwrapper.com/blog/drizzle-vs-prisma>
- postgres.js vs pg (2026) — <https://www.pkgpulse.com/guides/pg-vs-postgres-js-vs-neon-serverless-postgresql-drivers-2026>
- Better Auth vs NextAuth (LogRocket, 2026-04) — <https://blog.logrocket.com/best-auth-library-nextjs-2026/>
- OpenTelemetry JS status & version matrix — <https://github.com/open-telemetry/opentelemetry-js>
- Vitest 4 Browser Mode stable — <https://qaskills.sh/blog/vitest-browser-mode-complete-guide>
- PWA / Web Push state on iOS (2026) — <https://javascript.ac/en/blog/service-workers-pwa-guide>
- Serwist replacing next-pwa under Turbopack — <https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/>
- pg-boss vs BullMQ vs cron decision matrix (2026) — <https://nextjs-from-zero.vercel.app/articles/4004730>
