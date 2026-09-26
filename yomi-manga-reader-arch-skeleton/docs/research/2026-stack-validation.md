# 2026 Stack Validation

Date: 2026-09-26
Author: Principal Architect (architecture phase)
Status: Validated — evidence gathered from official registries, vendor docs, and release trackers on 2026-09-26.

## Methodology

1. Enumerated the candidate stack from the project brief.
2. For every component, verified the **current stable line** (not the newest version number) against authoritative sources: npm registry metadata, official release pages, vendor release-status docs, and release-lifecycle trackers.
3. Compared alternatives only where the decision materially affects architecture (framework, ORM, storage protocol, image pipeline, validation, observability, testing).
4. Recorded a status for every package: **SELECTED** (installed/pinned at implementation start), **PLANNED** (documented, not installed during architecture phase), **OPTIONAL** (useful, not committed), **REJECTED** (considered, not selected — reason given).

Rule applied throughout: prefer the most recent **stable** line with a demonstrated production track record. A higher version number in beta/RC does not win over a stable line (applied to Drizzle, Vitest, Prisma, TypeScript).

---

## Selection Summary

| Component | Status | Selected | Verified as of 2026-09-26 | Evidence |
|---|---|---|---|---|
| Node.js runtime | SELECTED | **24 "Krypton" (Active LTS)** | 24.x active LTS since 2025-10-28; maintenance starts 2026-10-20; EOL 2028-04-30 | [1][2] |
| TypeScript | SELECTED | **6.0.x** (strict) | 6.0 GA 2026-03-23, last JS-based compiler; 7.0 (Go native) stable 2026-08 but programmatic API unstable until 7.1 | [3][4] |
| Framework | SELECTED | **Next.js 16.x (App Router)** | 16.0 stable Oct 2025; latest 16.3.6 (2026-09-22); Turbopack default | [5][6] |
| UI library | SELECTED | **React 19.x** | 19.3.0 (2026-09-09); stable since Dec 2024; React Compiler available | [7] |
| Styling | SELECTED | **Tailwind CSS 4.x** | 4.3.3 (2026-07-16); v4 stable since Jan 2025 | [8][9] |
| Database | SELECTED | **PostgreSQL 18.x** | 18.6 (2026-08-11); 18.0 released 2025-09-22; supported to 2030-11-14 | [10][11] |
| Data access | SELECTED | **Drizzle ORM 0.45.x** + drizzle-kit + `postgres` driver 3.4.x | 0.45.2 is the stable line; 1.0 still in beta (Sep 2026); team now at PlanetScale | [12][13] |
| Object storage | SELECTED | **S3 protocol** via `@aws-sdk/client-s3` 3.1141.0 | Works with AWS S3, Cloudflare R2, MinIO; 3 days cadence, very active | [14] |
| Image processing | SELECTED | **sharp 0.35.x** | 0.35.4 (2026-08-26); libvips-based; ~71.7M weekly downloads | [15] |
| Validation | SELECTED | **Zod 4.x** | v4 stable; Standard Schema compliant | [16][17] |
| Password hashing | SELECTED | **argon2 0.45.x** (Argon2id) | 0.45.1 published 2026-07; Argon2id recommended for Node in 2026 | [18][19] |
| Observability | SELECTED | **OpenTelemetry JS**: `@opentelemetry/api` 1.9.1 (stable API) + SDK modules 2.11.0 (stable) | `@opentelemetry/sdk-node` 0.222.0 is still marked experimental — we use discrete SDK modules instead | [20][21] |
| Unit/integration tests | SELECTED | **Vitest 4.1.x** | 4.1.11 (Aug 2026) stable; 5.0 in beta — not selected | [22] |
| E2E tests | SELECTED | **Playwright 1.62.x** | 1.62.1 (Jul 2026) stable; ~6-week release cadence | [23] |
| Containers | SELECTED | **Docker** (image + compose) | Stable tooling; no version churn concern | — |
| CI/CD | SELECTED | **GitHub Actions** | Stable; standard workflows | — |

---

## Component Detail & Alternatives

### Node.js — SELECTED 24.x (Active LTS)

Evidence:
- Node 24 "Krypton" first release 2025-05-06, Active LTS from 2025-10-28, maintenance from 2026-10-20, EOL 2028-04-30 [1][2].
- Node 22 is in Maintenance LTS (EOL 2027-04-30); Node 26 is Current, not LTS until 2026-10-28 [2].

Decision: pin Node 24 LTS for development and production. Node 26 is REJECTED for now — it is Current and only enters LTS in October 2026; adopting a non-LTS runtime violates the stability requirement. Revisit at 26's LTS transition (see ADR-001 "Revisit When").

Notes:
- Sandbox/toolchain in this workspace runs Node 20 for typechecking only; `.nvmrc` and CI pin the project to 24.
- Native Temporal API is available in Node 26; we do **not** depend on it (dates handled in UTC ISO strings / `date-fns`-free plain code).

### TypeScript — SELECTED 6.0.x

Evidence:
- TypeScript 6.0 shipped 2026-03-23 as the last JavaScript-based compiler, a deliberate bridge release [3].
- TypeScript 7.0 (native Go compiler, 8–12× faster) went stable ~2026-08 but **lacks a stable programmatic API** (expected in 7.1); some tooling (linters, formatters, test runners) may not yet fully support it [4].

Decision: TypeScript 6.0.x with `strict: true` and additional hardening flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). REJECTED 7.0: newer but with an unstable programmatic API — exactly the "highest version number" trap this document must avoid. Migration to 7.x is a one-line devDependency bump once 7.1 lands and ecosystem tools are verified.

### Framework — SELECTED Next.js 16.x (App Router)

Evidence:
- Next.js 16 stable shipped October 2025 (Turbopack default, requires Node 20+); stable line advanced to 16.3.6 on 2026-09-22 [5][6].
- Next.js 15.x LTS security support ends October 2026 — new projects on 15.x would start on a dying line [6].

Alternatives:
- **Next.js 15.x** — mature but entering EOL next month; no reason to start there.
- **React Router (v7) / Remix lineage** — viable, but App Router + route handlers + server actions + streaming SSR + file-based routes gives us the full web-app surface (SSR catalog pages, streaming reader shell, route handlers for API) in one framework with the largest 2026 ecosystem.
- **SvelteKit / Nuxt** — rejected: smaller hiring ecosystem for this feature set, weaker 2026 track record for server-side data APIs of this shape.

Decision: Next.js 16.x, App Router, React Server Components for data pages, Client Components for the reader, Route Handlers for the API. Node 24 runtime.

### React — SELECTED 19.x

Evidence: React 19.3.0 (2026-09-09); stable since Dec 2024; React 19's compiler/JSX transform and server components are production-proven [7].

### Styling — SELECTED Tailwind CSS 4.x

Evidence: 4.3.3 current (2026-07-16); v4 stable since January 2025 with a Rust-based engine, CSS-first config, cascade layers [8][9]. Browser baseline Safari 16.4+/Chrome 111+/Firefox 128+ matches our target (2024+ browsers) [9].

REJECTED: Tailwind 3.4 (supported only to 2027-02-28, zero reason to start on it [8]).

### Database — SELECTED PostgreSQL 18.x

Evidence: PostgreSQL 18.6 released 2026-08-11; 18.0 initial release 2025-09-22; each major supported 5 years → 18.x supported to 2030-11-14 [10][11].

Alternatives:
- **PostgreSQL 17.x** (17.11, 2026-08) — fully supported to 2029, the "most conservative" pick. Rejected only by a small margin: 18 has ~12 months of production track record across the industry, and we want modern defaults (e.g., `ALTER SYSTEM` improvements, faster `VACUUM`, improved logical replication) without losing the 5-year support window. If any ecosystem component (Drizzle, drivers) shows incompatibility, fall back to 17 — documented as the contingency in ADR-002.
- **MySQL/MariaDB, SQLite, CockroachDB** — rejected: single-writer relational workloads with JSONB-friendly metadata, FTS/trigram search, and 5-year support make PostgreSQL the strongest default; SQLite rejected for multi-writer admin + concurrent reader progress; CockroachDB rejected as over-complex for this scale (ADR-002).

### Data access — SELECTED Drizzle ORM 0.45.x

Evidence:
- Drizzle 0.45.2 is the stable line as of September 2026; 1.0 is in beta consolidating the package layout — per the "stable line wins" rule, we pin 0.45.x [12][13].
- The Drizzle team now works at PlanetScale, strengthening long-term continuity [13].
- 18+ months of production use before 1.0; widely used with Neon, Supabase, RDS [12].

Alternatives compared (this is a load-bearing decision — see ADR-003):
- **Prisma 7.10** (stable; 8.0 in RC with GA expected Oct 2026; Rust-free TS client since 7.0) [prisma-release-status]. Excellent, fully viable. Not selected because: (a) an in-flight major (8 RC) lands right after our build start, forcing a migration decision mid-project; (b) Prisma's generated-client model and heavier runtime footprint vs. our SQL-first modular monolith; (c) Drizzle's generated SQL is inspectable line-by-line, which aids the data-heavy, index-sensitive reader workload.
- **Kysely 0.27** — pure query builder, no migrations tooling; would require a separate migration layer (e.g., pg-mig). Viable, but Drizzle gives migrations + schema + types in one tool.
- **Knex / Objection** — mature but pre-TypeScript typing model; weaker inference.
- **Raw SQL** — maximum control, minimum safety; rejected as the default, retained as an escape hatch (Drizzle emits raw SQL via `.sql` templates when needed).

Decision: Drizzle ORM 0.45.x + drizzle-kit (migrations) + `postgres` (3.4.x) driver, pinned explicitly. REJECTED: Drizzle 1.0 (beta), Prisma 8 (RC). PLANNED: upgrade to Drizzle 1.x at GA after one release of stabilization.

### Object storage — SELECTED S3 protocol (`@aws-sdk/client-s3` 3.1141.0)

Evidence: `@aws-sdk/client-s3` 3.1141.0 (Sept 2026), ~7.1k dependent projects, released every few days, Apache-2.0 [14].

Decision: code against the **S3 API**, not a vendor:
- Production default: Cloudflare R2 (zero egress fees — the dominant cost for an image-serving reader) or AWS S3.
- Local dev / self-host: MinIO in Docker Compose.

The application depends only on the `ObjectStoragePort` interface (see `shared/contracts/storage.ts`); the SDK is an implementation detail behind it (ADR-004).

REJECTED: filesystem storage (no durability/backup story, breaks horizontal scale), GCS/Azure Blob (fine, but S3 protocol covers the widest option set including R2/MinIO).

### Image pipeline — SELECTED sharp 0.35.x

Evidence: sharp 0.35.4 (2026-08-26), libvips-based, 4–5× faster than ImageMagick settings, JPEG/PNG/WebP/GIF/AVIF/TIFF in+out, Node-API v9 (Node ≥ 20.9), ~71.7M weekly downloads, Apache-2.0 [15].

Alternatives:
- **libvips directly** — same engine, more glue code, no Node-native DX. Rejected.
- **jimp / @napi-rs/image** — pure-JS or newer native; jimp is an order of magnitude slower at 500-page batch normalization; @napi-rs/image is promising but has a shorter production record for AVIF/HEIC decode. Rejected.

Decision: sharp for decode → normalize (max dimension, strip metadata) → encode (AVIF primary, WebP fallback, JPEG final fallback). See ADR-005 for the full pipeline contract.

### Validation — SELECTED Zod 4.x

Evidence: Zod 4 is stable, ~14× faster parsing than v3 on benchmarks, Standard Schema compliant (interoperable with other validators), `zod/mini` for light contexts [16][17].

REJECTED: Zod 3 (legacy), Valibot (excellent, smaller ecosystem in 2026), ArkType (younger). Zod chosen for ecosystem ubiquity + Standard Schema conformance.

### Password hashing — SELECTED argon2 (Argon2id)

Evidence: `argon2` npm 0.45.1 (2026-07-21), maintained, bundles TS types; Argon2id with m=64MB, t=3, p=4 is the 2026 Node recommendation [18][19].

Alternatives: bcrypt (weaker memory-hardness), `@node-rs/argon2` (Rust bindings — solid fallback if native build issues arise on a given platform; noted as OPTIONAL).

### Observability — SELECTED OpenTelemetry (stable API + stable SDK modules)

Evidence:
- `@opentelemetry/api` 1.9.1 — stable public API, ~5k dependent projects [20].
- `@opentelemetry/sdk-metrics` 2.11.0 (and sibling SDK 2.x modules) — stable [21].
- `@opentelemetry/sdk-node` 0.222.0 — explicitly "experimental… may include breaking changes" [20].

Decision: depend on `@opentelemetry/api` + discrete stable SDK modules (sdk-trace, sdk-metrics, resources, OTLP exporters). REJECTED: `@opentelemetry/sdk-node` (experimental), APM SaaS lock-in (Datadog/Honeycomb) as the *primary* design — OTel export format stays vendor-neutral; a SaaS backend is an OPTIONAL deploy choice (ADR-008).

### Testing — SELECTED Vitest 4.1.x + Playwright 1.62.x

Evidence:
- Vitest 4.1.11 stable (Aug 2026); 5.0.0 in beta (July 2026) with breaking config changes — not selected per stability rule [22].
- Playwright 1.62.1 stable (July 2026), ~6-week cadence, Trace Viewer, MCP server for browser automation [23].

REJECTED: Jest (Vitest is faster, ESM-native, same API), Cypress (Playwright's cross-browser + trace viewer + open-source model is stronger).

### Containers / CI — SELECTED Docker + GitHub Actions

Both are stable, industry-standard, and required by the deployment model (single VM, compose-based). No version research needed beyond "current stable."

---

## Package Status Registry

Statuses: **SELECTED** = pinned at implementation start (VS-0). **PLANNED** = documented now, installed when its task starts. **OPTIONAL** = candidate, not committed. **REJECTED** = considered, documented reason.

| Package | Status | Version to pin | Notes |
|---|---|---|---|
| typescript | SELECTED | 6.0.x | strict + hardening flags; revisit at 7.1 |
| next | SELECTED | 16.3.x | App Router, Turbopack |
| react / react-dom | SELECTED | 19.3.x | |
| tailwindcss | SELECTED | 4.3.x | CSS-first config |
| drizzle-orm | SELECTED | 0.45.x | pin explicitly; 1.0 = PLANNED |
| drizzle-kit | SELECTED | 0.3x (matching line) | migrations |
| postgres | SELECTED | 3.4.x | driver (or `pg` — decided in T-FOUND-005) |
| @aws-sdk/client-s3 | SELECTED | 3.1141.x | behind ObjectStoragePort |
| sharp | PLANNED | 0.35.x | not installed in architecture phase; T-UPLOAD-006 |
| zod | SELECTED | 4.x | env + API + upload validation |
| argon2 | PLANNED | 0.45.x | T-AUTH-002; native build required |
| @opentelemetry/api | SELECTED | 1.9.x | stable API only |
| @opentelemetry/sdk-trace-node / sdk-metrics / resources / exporter-otlp-http | PLANNED | 2.11.x | T-OBS-001/002 |
| pino | PLANNED | 9.x | structured logs (stable, ubiquitous) — T-FOUND-008 |
| vitest | SELECTED | 4.1.x | 5.x REJECTED (beta) |
| @playwright/test | SELECTED | 1.62.x | E2E |
| eslint + typescript-eslint | SELECTED | 9.x / 8.x | |
| @node-rs/argon2 | OPTIONAL | — | fallback if argon2 native build fails |
| Prisma 7 | REJECTED | — | see ADR-003 |
| Drizzle 1.0 | REJECTED (for now) | — | beta; PLANNED at GA |
| Vitest 5.0 | REJECTED (for now) | — | beta |
| Prisma 8 | REJECTED | — | RC until ~Oct 2026 |
| TypeScript 7.0 | REJECTED (for now) | — | unstable programmatic API |
| Node 26 | REJECTED (for now) | — | not LTS until 2026-10-28 |
| @opentelemetry/sdk-node | REJECTED | — | marked experimental |
| Kafka / Redis / Elasticsearch / K8s | REJECTED | — | out of scope at this scale (ADR-009) |
| jimp / @napi-rs/image | REJECTED | — | see sharp section |
| Valibot / ArkType | REJECTED | — | see Zod section |

---

## References

- [1] InMotion Hosting — Node.js 26 released (May 2026): https://www.inmotionhosting.com/support/news/nodejs-v26-released/
- [2] PkgPulse — Node 22 vs 24 in 2026 (LTS table): https://www.pkgpulse.com/guides/nodejs-22-vs-nodejs-24-2026
- [3] CodersEra — TypeScript 6.0 (GA 2026-03-23): https://codersera.com/blog/typescript-6-0-whats-new-breaking-changes-2026/
- [4] InfoQ — Microsoft releases TypeScript 7.0 native Go compiler (Aug 2026): https://www.infoq.com/news/2026/08/typescript-7-released/
- [5] abhs.in — Next.js 16.2.7 stable timeline (16 stable Oct 2025): https://abhs.in/blog/nextjs-current-version-march-2026-stable-release-whats-new
- [6] VersionLog — Next.js release history (16.3.6, 2026-09-22): https://versionlog.com/nextjs/
- [7] VersionLog — React releases (19.3.0, 2026-09-09): https://versionlog.com/react/
- [8] VersionLog — Tailwind CSS releases (4.3.3): https://versionlog.com/tailwind-css/
- [9] DesignRevision — Tailwind 4 migration (browser baseline, v4 stable Jan 2025): https://designrevision.com/blog/tailwind-4-migration
- [10] VersionLog — PostgreSQL releases (18.6, 2026-08-11): https://versionlog.com/postgresql/
- [11] VersionLog — PostgreSQL 18 lifecycle (18.0: 2025-09-22, EOL 2030-11-14): https://versionlog.com/postgresql/18/
- [12] tech-insider — Drizzle ORM 2026 tutorial (0.44/0.45 stable line, production status): https://tech-insider.org/drizzle-orm-tutorial-typescript-postgres-2026/
- [13] MakerKit — Drizzle vs Prisma 2026 (Drizzle 0.45.2 stable, 1.0 beta; PlanetScale): https://makerkit.dev/blog/tutorials/drizzle-vs-prisma
- [14] npm — @aws-sdk/client-s3 3.1141.0: https://www.npmjs.com/package/@aws-sdk/client-s3
- [15] npm — sharp 0.35.4 (changelog, downloads): https://www.npmjs.com/package/sharp
- [16] baeseokjae — Zod v4 guide (perf, Standard Schema): https://baeseokjae.github.io/posts/zod-v4-schema-validation-typescript-guide-2026/
- [17] buildmvpfast — Zod v4 breaking changes & ecosystem: https://www.buildmvpfast.com/blog/zod-v4-migration-breaking-changes-2026
- [18] npm.io — argon2 0.45.1: https://npm.io/package/argon2
- [19] Kestrel Tools — Argon2 vs bcrypt 2026 (recommended params): https://blog.kestreltools.com/en/blog/argon2-vs-scrypt-vs-bcrypt-password-hashing-2026/
- [20] npm — @opentelemetry/sdk-node 0.222.0 (experimental notice): https://www.npmjs.com/package/@opentelemetry/sdk-node
- [21] npm — @opentelemetry/api 1.9.1 / sdk-metrics 2.11.0: https://www.npmjs.com/package/@opentelemetry/api
- [22] Releasebot — Vitest releases (4.1.11 stable; 5.0 beta): https://releasebot.io/updates/vitest
- [23] Playwright blog via aims-ai — v1.62 (July 2026): https://playwright.aims-ai.com/blog/playwright-whats-new-2026
