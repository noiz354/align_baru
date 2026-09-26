# ADR-003: Data Access

Status: Accepted
Date: 2026-09-26

## Context

TypeScript-strict modular monolith over PostgreSQL 18. The data layer must: keep SQL inspectable (performance + security review), provide strong types from schema to repository, manage migrations explicitly (expand/contract, NFR-OPS-004), and live behind repository ports so features never touch SQL (dependency rule: features → ports only).

## Decision Drivers

1. Stable line (2026 rule: stable beats newer).
2. SQL-first / inspectable generated SQL.
3. TypeScript-native types (no separate codegen ceremony into `node_modules`).
4. First-class migrations (drizzle-kit) with explicit migration files under version control.
5. Lightweight runtime (Next.js server + future worker).

## Options Considered

### Option A — Drizzle ORM 0.45.x (stable line) + drizzle-kit + `postgres` driver 3.4.x

SQL-first query builder/ORM: schema-as-code, generated types, migrations, readable SQL. 0.45.2 is the stable line (1.0 in beta — excluded by the stability rule). 18+ months of production use; team now at PlanetScale (continuity signal).

### Option B — Prisma 7.10 (stable; 8.0 in RC, GA ~Oct 2026)

Rust-free TS client since 7.0, fast, mature. Rejected because: (a) an in-flight major (8 RC) lands ~2 weeks after our build start — adopting now forces a mid-project migration decision; (b) generated-client workflow adds a build step and a larger runtime footprint than Drizzle for the same feature set; (c) Drizzle's inline `.sql` escape hatch keeps raw SQL first-class, which we want for the search query. Prisma 7 remains the documented fallback if Drizzle shows defects (see Risks).

### Option C — Kysely 0.27 (pure query builder)

Excellent types, no ORM. Rejected: no migration tooling in-project — we would add pg-mig/umzug, a second toolchain, for a capability drizzle-kit gives free.

### Option D — Knex / Objection.js

Mature, but the typing model is weaker in strict mode and the DX is pre-modern for a greenfield TS project.

### Option E — Raw SQL + `postgres` driver

Maximum control. Rejected as default: more room for parameterization mistakes (NFR-SEC-015), slower to write correct queries, no schema/type layer to keep DATA_MODEL.md and code in sync. Retained as an allowed escape hatch inside Drizzle (`` db.sql`...` `` templates).

## Decision

**Drizzle ORM 0.45.x** (explicit pin), **drizzle-kit** for migrations (explicit files in `drizzle/`, expand/contract discipline), **`postgres` (3.4.x)** driver via `drizzle-orm/pg`. Schema lives in `src/server/db/schema.ts` (descriptive skeleton now; real DDL at T-FOUND-005/006). Repositories implement feature ports in `src/server/db/repositories/*`.

## Consequences

### Positive
- Every query is inspectable SQL — performance (NFR-PERF-014) and injection-safety (NFR-SEC-015) review is line-by-line possible.
- Schema → types flow keeps DATA_MODEL.md and code honest; typecheck catches model drift.
- Migrations are explicit files; no runtime schema push in production.
- Small runtime; works identically in the app and a future media worker.

### Negative
- 0.x line: minor bumps can include breaking changes (npm semver for 0.x). → explicit pin + upgrade slices.
- No built-in "relations" sugar comparable to Prisma's nested reads — we write joins explicitly (fine: our queries are simple and hot).
- Drizzle team's PlanetScale relationship could shift priorities (low impact: core is community-maintained and the SQL layer is boring-stable).

## Risks

- **R1:** 0.45.x minor bump breaks a query helper. → Pin exactly; upgrade in a dedicated task with full test run (NFR-SEC-013).
- **R2:** A Drizzle defect in a niche case (e.g., `numeric` handling for chapter numbers). → Escape hatch to `.sql` template; affected path unit-tested against real PG in integration tests.
- **R3:** Team drifts toward "ORM-ism" (query sprawl in features). → Dependency rule: only `server/db` may import drizzle (enforced by ESLint boundary rule, T-FOUND-011); features see ports only.

## Mitigations

Explicit version pin; migration review checklist in CONTRIBUTING.md; EXPLAIN-gated CI (T-PERF-004); repository ports keep features decoupled (ADR-001 module map).

## Revisit When

- Drizzle 1.0 GA has shipped ≥ 1 stable patch and the upgrade is clean → adopt (one-line ADR amendment).
- Prisma 8 GA lands and a concrete Drizzle blocker appears mid-build → re-open comparison (new ADR).
- If raw-SQL escape hatches exceed ~10% of queries → revisit tooling.

## References

- docs/research/2026-stack-validation.md (data access section, refs [12][13] + Prisma release status)
- DATA_MODEL.md, ARCHITECTURE.md §3, ADR-002
