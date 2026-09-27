# Yomi — Self-Hosted Manga & Comic Reader

A greenfield manga/comic reader web application for **legally owned, licensed, or authorized** content: a browsable catalog, a fast multi-mode reader, per-user libraries, and an admin panel with a secure upload pipeline.

> **Repository status (2026-09-27): VS-0 foundation implemented; VS-1…VS-11 product work pending.**
> T-FOUND-001…012 established tooling, route shells, UI primitives, initial database migration, health endpoint, logging, error contract, compose, CI configuration and seed harness. Product routes/services remain shells; database-backed integration has not been verified in this sandbox. Follow `TASKS.md` in `ROADMAP.md` order and read `AGENTS.md` before coding. Workflows inside this folder are not discovered by GitHub Actions in the monorepo; root workflow provides only smoke checks.

## Product in one paragraph

Curators (admins) upload chapters as archives or image sets; the pipeline validates, normalizes, and stores multi-format page images in S3-compatible object storage. Readers browse the catalog, read chapters in vertical / single-page / double-page modes with RTL or LTR direction, and — when authenticated — track progress, history, library entries, and bookmarks. The reader is engineered for 500-page chapters, slow connections, and memory-constrained devices.

## Documents

| Document | Purpose |
|---|---|
| [`PRD.md`](PRD.md) | Product requirements with stable IDs (FR-*, NFR-*) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture, module map, data flow |
| [`ADR.md`](ADR.md) | Index of all architecture decision records |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Conceptual data model (pre-migration) |
| [`API_CONTRACT.md`](API_CONTRACT.md) | Planned API operations + error taxonomy |
| [`SECURITY.md`](SECURITY.md) | Security architecture & controls |
| [`THREAT_MODEL.md`](THREAT_MODEL.md) | Threat register with mitigations & verification |
| [`PERFORMANCE.md`](PERFORMANCE.md) | Measurable performance budgets |
| [`ACCESSIBILITY.md`](ACCESSIBILITY.md) | WCAG 2.1 AA commitments |
| [`TEST_STRATEGY.md`](TEST_STRATEGY.md) | Test levels, planned test IDs |
| [`OBSERVABILITY.md`](OBSERVABILITY.md) | Traces, metrics, logs, alerts |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Topology, env, secrets, backups, rollback |
| [`RUNBOOK.md`](RUNBOOK.md) | Operational procedures |
| [`ROADMAP.md`](ROADMAP.md) | Vertical slices VS-0 … VS-11 |
| [`TASKS.md`](TASKS.md) | All implementation tasks (source of work) |
| [`AGENTS.md`](AGENTS.md) | How coding agents must work in this repo |
| [`SKILLS.md`](SKILLS.md) | Which agent skills apply to which task family, and which installed skills deliberately do not |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Human/agent contribution conventions |
| [`docs/architecture/`](docs/architecture/) | System context, module boundaries, dependency rules, data flow, final review + traceability |
| [`docs/product/`](docs/product/) | Reader behavior spec, admin workflow, user journeys, edge cases |
| [`docs/adr/`](docs/adr/) | ADR-001 … ADR-009 |
| [`docs/research/2026-stack-validation.md`](docs/research/2026-stack-validation.md) | Stack validation evidence & package status registry |

## Validated 2026 stack (summary)

| Concern | Selection | Why (one line) |
|---|---|---|
| Runtime | Node.js 24 LTS (Active) | Current LTS; 26 is not LTS until Oct 2026 |
| Language | TypeScript 6.0 (strict) | 7.0 has unstable programmatic API |
| Framework | Next.js 16.3 (App Router, Turbopack) | Stable since Oct 2025; 15.x EOLs Oct 2026 |
| UI | React 19.3 | Stable, compiler-ready |
| Styling | Tailwind CSS 4.3 | CSS-first, 2024+ browser baseline |
| Database | PostgreSQL 18.6 | Supported to Nov 2030 |
| Data access | Drizzle ORM 0.45 + drizzle-kit | SQL-first, inspectable, stable line |
| Object storage | S3 protocol (`@aws-sdk/client-s3`) | R2/S3/MinIO all work behind one port |
| Images | sharp 0.35 (libvips) | AVIF/WebP/JPEG at batch speed |
| Validation | Zod 4 | Stable, Standard Schema |
| Passwords | argon2 (Argon2id) | 2026 recommended |
| Observability | OpenTelemetry API 1.9 + SDK 2.11 + pino | Vendor-neutral |
| Tests | Vitest 4.1 + Playwright 1.62 | Stable lines |
| Ops | Docker + GitHub Actions | Compose on a single VM |

Full evidence and rejected alternatives: `docs/research/2026-stack-validation.md`.

## Architecture at a glance

```
Browser
   │
   ▼
Next.js 16 application (modular monolith, Node 24)
   ├── Catalog / Search / Manga / Chapters   (domain features)
   ├── Reader / Progress / Library           (domain features)
   ├── Auth / Admin / Uploads                (domain features)
   ├── server/db        — Drizzle repositories (PostgreSQL 18)
   ├── server/storage   — S3 adapter (R2/S3/MinIO)
   ├── server/media     — sharp normalization + page delivery
   └── server/telemetry — OpenTelemetry + pino
```

Modular monolith by explicit decision (no Kubernetes, Kafka, Redis, Elasticsearch, GraphQL, or microservices). See `ARCHITECTURE.md` and ADR-001/009.

## Repository skeleton

```
src/
├── app/            # Route skeletons (planned route map, no feature code)
├── features/       # Domain modules: auth, catalog, manga, chapters, reader,
│                   # progress, library, search, admin, uploads (ports + skeletons)
├── server/         # Infrastructure: db, auth, storage, media, telemetry, composition
└── shared/         # contracts, types, validation, ui (cross-module)
tests/
├── unit/           # describe.todo skeletons
├── integration/    # planned against real PostgreSQL (Docker)
└── e2e/            # planned Playwright flows
```

Skeleton rule: files communicate responsibility, contracts, requirement IDs (FR-*/NFR-*), and task IDs (T-*). Functions that must not exist yet throw `Not implemented: T-…`. **Do not mistake skeletons for implementations.**

## What is NOT here yet (by design)

No migrations, no real repositories, no auth, no image processing, no uploads, no search, no production UI, no cache/storage behavior, no fake product data. The first implementation work begins at **VS-0 / T-FOUND-001** (see `ROADMAP.md`).

## Local development (planned, not yet available)

During VS-0, `docker compose up` will provide: app (Next.js dev), `postgres:18`, `minio`, and a dev seed harness. Until then there is nothing to run — this is the architecture phase.
