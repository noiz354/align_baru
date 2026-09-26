# ADR Index

All architecture decision records for Yomi. Status values: Proposed → Accepted → (Superseded by ADR-xxx).

| ADR | Title | Status | Date | Key consequence |
|---|---|---|---|---|
| [ADR-001](docs/adr/ADR-001-application-framework.md) | Application framework: Next.js 16 (App Router) + React 19 | Accepted | 2026-09-26 | Single full-stack framework; RSC for data pages, client components for reader |
| [ADR-002](docs/adr/ADR-002-database.md) | Database: PostgreSQL 18 | Accepted | 2026-09-26 | Single relational store; 5-year support horizon; FTS/trigram search |
| [ADR-003](docs/adr/ADR-003-data-access.md) | Data access: Drizzle ORM 0.45 + drizzle-kit | Accepted | 2026-09-26 | SQL-first ORM; inspectable SQL; explicit migration files |
| [ADR-004](docs/adr/ADR-004-object-storage.md) | Object storage: S3 protocol behind a port | Accepted | 2026-09-26 | R2/S3/MinIO interchangeable; app never sees vendor APIs |
| [ADR-005](docs/adr/ADR-005-image-pipeline.md) | Image pipeline: sharp normalization → AVIF/WebP/JPEG ladder | Accepted | 2026-09-26 | Multi-format variants per page; immutable versioned assets |
| [ADR-006](docs/adr/ADR-006-authentication.md) | Authentication: DB-backed sessions + Argon2id | Accepted | 2026-09-26 | Server-side revocation; cookie sessions; no JWT |
| [ADR-007](docs/adr/ADR-007-reader-architecture.md) | Reader: client-side DOM reader with bounded window | Accepted | 2026-09-26 | No canvas/tiling in v1; memory-bounded; SSR shell + API |
| [ADR-008](docs/adr/ADR-008-observability.md) | Observability: OpenTelemetry (stable packages) + pino | Accepted | 2026-09-26 | Vendor-neutral OTLP export; structured logs; RED metrics |
| [ADR-009](docs/adr/ADR-009-deployment-model.md) | Deployment: single-VM Docker Compose | Accepted | 2026-09-26 | No Kubernetes at this scale; stateless app + PG + storage |

## Process

- Any implementation that would contradict an Accepted ADR must stop and raise a new ADR.
- An ADR is superseded only by a new ADR that references it.
- "Revisit When" conditions are checked at each vertical-slice exit review (ROADMAP.md).
