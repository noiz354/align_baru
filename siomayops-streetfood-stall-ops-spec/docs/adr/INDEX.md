# ADR Index (nested records)

**Document ID:** DOC-ADR-NESTED-INDEX  
**Status:** Phase 0  
**Canonical index:** `../../ADR.md`. If the two disagree, `ADR.md` wins and this file is corrected.

All decision records below are **Accepted**. ADRs are immutable once accepted: a change of mind
creates a new ADR that supersedes the old one rather than editing history.

| ADR | Title | Status | Slice | Area |
| --- | --- | --- | --- | --- |
| [0001](ADR-0001-modular-monolith.md) | Modular monolith over microservices | Accepted | VS-0 | Architecture |
| [0002](ADR-0002-nextjs-single-deployable.md) | Next.js 16 App Router as the single deployable | Accepted | VS-0 | Architecture |
| [0003](ADR-0003-postgresql-system-of-record.md) | PostgreSQL 18 as system of record | Accepted | VS-0 | Data |
| [0004](ADR-0004-drizzle-sql-first.md) | Drizzle ORM and SQL-first data access | Accepted | VS-0 | Data |
| [0005](ADR-0005-pwa-first-client.md) | PWA-first client (offline shell) | Accepted | VS-0 | Client |
| [0006](ADR-0006-money-representation.md) | Money representation: integer minor units | Accepted | VS-0 | Finance |
| [0007](ADR-0007-explicit-location-reporting.md) | Explicit operator location reporting; no continuous tracking | Accepted | VS-3 | Privacy/Location |
| [0008](ADR-0008-price-resolution-hierarchy.md) | Deterministic price resolution hierarchy | Accepted | VS-4 | Pricing |
| [0009](ADR-0009-operator-price-override.md) | Operator price override policy | Accepted | VS-4 | Pricing |
| [0010](ADR-0010-immutable-price-snapshot.md) | Immutable price snapshots on sales | Accepted | VS-5 | Sales |
| [0011](ADR-0011-payment-provider-port.md) | Payment provider abstraction boundary | Accepted | VS-6 | Payments |
| [0012](ADR-0012-qris-static-first.md) | QRIS MVP: static QR with honest pending states | Accepted | VS-6 | Payments |
| [0013](ADR-0013-idempotency-and-client-ids.md) | Idempotency keys and client-generated IDs | Accepted | VS-3 | Platform |
| [0014](ADR-0014-http-json-api.md) | HTTP JSON API (no GraphQL, no tRPC) | Accepted | VS-1 | API |
| [0015](ADR-0015-authentication.md) | Authentication via Better Auth (planned) | Accepted (deferred) | VS-17 | Security |
| [0016](ADR-0016-authorization-rbac-scope.md) | Authorization: in-app RBAC + scope resolution | Accepted | VS-1 | Security |
| [0017](ADR-0017-offline-outbox.md) | Offline strategy: outbox queue with server authority | Accepted | VS-3 | Offline |
| [0018](ADR-0018-pg-boss-jobs.md) | Background jobs with pg-boss (no Redis) | Accepted | VS-10 | Platform |
| [0019](ADR-0019-sse-realtime.md) | Realtime via SSE, polling by default | Accepted | VS-12 | Platform |
| [0020](ADR-0020-object-storage.md) | Object storage via S3-compatible API + signed URLs | Accepted | VS-7 | Platform |
| [0021](ADR-0021-notification-channels.md) | Notification channels: in-app first | Accepted | VS-12 | Platform |
| [0022](ADR-0022-observability-otel.md) | Observability with OpenTelemetry + Grafana stack | Accepted | VS-18 | Operations |
| [0023](ADR-0023-testing-strategy.md) | Testing strategy: Vitest 4 + Playwright, stub-first | Accepted | VS-0 | Quality |
| [0024](ADR-0024-deployment-topology.md) | Deployment topology: containers, single region | Accepted | VS-19 | Operations |
| [0025](ADR-0025-config-driven-catalog.md) | Configuration-driven catalog (no hard-coded items) | Accepted | VS-4 | Domain |
| [0026](ADR-0026-append-only-audit.md) | Append-only audit events with mandatory reasons | Accepted | VS-0 | Compliance |
| [0027](ADR-0027-expense-review-model.md) | Field expense categorisation and neutral review model | Accepted | VS-7 | Finance/Ethics |
| [0028](ADR-0028-loyalty-identification.md) | Loyalty identification and fraud-resistant redemption | Accepted | VS-11 | Loyalty |
| [0029](ADR-0029-recognition-scoring-philosophy.md) | Operator recognition scoring philosophy | Accepted | VS-15 | People |
| [0030](ADR-0030-stock-variance-policy.md) | Stock variance reasons and non-accusation policy | Accepted | VS-8 | Inventory |
| [0031](ADR-0031-multitenancy-scoping.md) | Multi-tenancy and organization scoping | Accepted | VS-1 | Architecture |
| [0032](ADR-0032-identifier-strategy.md) | Identifiers: UUIDv7 + human-readable business codes | Accepted | VS-0 | Data |
| [0033](ADR-0033-time-and-business-day.md) | Time storage and business-day semantics | Accepted | VS-0 | Data |
| [0034](ADR-0034-api-versioning-errors.md) | API versioning, error envelope, rate limits | Accepted | VS-1 | API |
| [0035](ADR-0035-module-boundaries.md) | Module boundaries and dependency direction | Accepted | VS-0 | Architecture |
| [0036](ADR-0036-skeleton-code-policy.md) | Skeleton code policy and NotImplemented convention | Accepted | VS-0 | Process |
| [0037](ADR-0037-retention-and-deletion.md) | Retention, deletion, and archival strategy | Accepted | VS-17 | Compliance |
| [0038](ADR-0038-feature-flags-slice-gating.md) | Feature flags and vertical-slice gating | Accepted | VS-0 | Process |
| [0039](ADR-0039-persisted-one-shot-gps-assist.md) | Persisted one-shot GPS assist for explicit shift location reports | Accepted | Page 10 / T-LOC-004 | Privacy/Location |

**Total ADRs:** 39

## Reading order for a new contributor

1. `ADR-0001`, `ADR-0002`, `ADR-0003` — the shape of the system.
2. `ADR-0006`, `ADR-0008`, `ADR-0009`, `ADR-0010` — money and pricing.
3. `ADR-0011`, `ADR-0012`, `ADR-0033` — payments and the honesty rule.
4. `ADR-0017`, `ADR-0036` — offline behaviour and the Phase-0 policy (why this repository is stubs).
5. `ADR-0007`, `ADR-0026`, `ADR-0027`, `ADR-0029`, `ADR-0030`, `ADR-0037` — privacy, audit, ethics, retention.
6. Everything else by slice when you start the corresponding task in `TASKS.md`.

## Records that constrain the first implementation slices

| Slice | Binding ADRs |
| --- | --- |
| VS-1 (foundation, authz, API shell) | 0001–0004, 0014, 0016, 0031, 0032, 0034, 0035, 0036, 0038 |
| VS-3 (shift start, offline) | 0007, 0013, 0017, 0033 |
| VS-4 (menu, pricing) | 0008, 0009, 0025 |
| VS-5 (sales) | 0006, 0010 |
| VS-6 (payments) | 0011, 0012, 0033 |
| VS-7 (expenses) | 0020, 0027 |
| VS-8 (stock) | 0030 |
| VS-11 (loyalty) | 0028 |
| VS-15 (recognition) | 0029 |
| VS-17/VS-18 (retention, observability) | 0022, 0037 |

## Missing-record check (Phase 0 gate)

Every area named in `ADR.md` §"Areas that require an ADR before any implementation" is covered: money
representation (0006) · price resolution (0008) · price override authority (0009) · payment provider
boundary (0011) · idempotency (0013) · offline authority (0017) · authentication (0015) · authorization
model (0016) · audit model (0026) · expense categorisation (0027) · loyalty redemption (0028) · recognition
scoring (0029) · retention (0037).

## Implementation status

**NOT IMPLEMENTED.** All 38 ADRs are Phase-0 design decisions. No record in this folder has
implementation behind it. See `docs/architecture/FINAL-REVIEW.md` for the pre-implementation review and
`TASKS.md` for the first future task (`T-SHIFT-001`).
