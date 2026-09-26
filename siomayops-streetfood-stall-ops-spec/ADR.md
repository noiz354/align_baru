# ADR — Architecture Decision Record Index

**Document ID:** DOC-ADR-INDEX
**Status:** Phase 0
**Format:** Context · Decision · Consequences · Alternatives · Compliance impact · Status

An ADR is required for decisions that are **expensive to reverse** or that constrain
money, privacy, security, or offline behaviour. ADRs are immutable once Accepted; changes
are new ADRs that supersede them.

| ADR | Title | Status | Slice | Area |
| --- | --- | --- | --- | --- |
| [0001](docs/adr/ADR-0001-modular-monolith.md) | Modular monolith over microservices | Accepted | VS-0 | Architecture |
| [0002](docs/adr/ADR-0002-nextjs-single-deployable.md) | Next.js 16 App Router as the single deployable | Accepted | VS-0 | Architecture |
| [0003](docs/adr/ADR-0003-postgresql-system-of-record.md) | PostgreSQL 18 as system of record | Accepted | VS-0 | Data |
| [0004](docs/adr/ADR-0004-drizzle-sql-first.md) | Drizzle ORM and SQL-first data access | Accepted | VS-0 | Data |
| [0005](docs/adr/ADR-0005-pwa-first-client.md) | PWA-first client (offline shell) | Accepted | VS-0 | Client |
| [0006](docs/adr/ADR-0006-money-representation.md) | Money representation: integer minor units | Accepted | VS-0 | Finance |
| [0007](docs/adr/ADR-0007-explicit-location-reporting.md) | Explicit operator location reporting; no continuous tracking | Accepted | VS-3 | Privacy/Location |
| [0008](docs/adr/ADR-0008-price-resolution-hierarchy.md) | Deterministic price resolution hierarchy | Accepted | VS-4 | Pricing |
| [0009](docs/adr/ADR-0009-operator-price-override.md) | Operator price override policy | Accepted | VS-4 | Pricing |
| [0010](docs/adr/ADR-0010-immutable-price-snapshot.md) | Immutable price snapshots on sales | Accepted | VS-5 | Sales |
| [0011](docs/adr/ADR-0011-payment-provider-port.md) | Payment provider abstraction boundary | Accepted | VS-6 | Payments |
| [0012](docs/adr/ADR-0012-qris-static-first.md) | QRIS MVP: static QR with honest pending states | Accepted | VS-6 | Payments |
| [0013](docs/adr/ADR-0013-idempotency-and-client-ids.md) | Idempotency keys and client-generated IDs | Accepted | VS-3 | Platform |
| [0014](docs/adr/ADR-0014-http-json-api.md) | HTTP JSON API (no GraphQL, no tRPC) | Accepted | VS-1 | API |
| [0015](docs/adr/ADR-0015-authentication.md) | Authentication via Better Auth (planned) | Accepted (deferred) | VS-17 | Security |
| [0016](docs/adr/ADR-0016-authorization-rbac-scope.md) | Authorization: in-app RBAC + scope resolution | Accepted | VS-1 | Security |
| [0017](docs/adr/ADR-0017-offline-outbox.md) | Offline strategy: outbox queue with server authority | Accepted | VS-16 | Offline |
| [0018](docs/adr/ADR-0018-pg-boss-jobs.md) | Background jobs with pg-boss (no Redis) | Accepted | VS-10 | Platform |
| [0019](docs/adr/ADR-0019-sse-realtime.md) | Realtime via SSE, polling by default | Accepted | VS-12 | Platform |
| [0020](docs/adr/ADR-0020-object-storage.md) | Object storage via S3-compatible API + signed URLs | Accepted | VS-7 | Platform |
| [0021](docs/adr/ADR-0021-notification-channels.md) | Notification channels: in-app first | Accepted | VS-12 | Platform |
| [0022](docs/adr/ADR-0022-observability-otel.md) | Observability with OpenTelemetry + Grafana stack | Accepted | VS-18 | Operations |
| [0023](docs/adr/ADR-0023-testing-strategy.md) | Testing strategy: Vitest 4 + Playwright, stub-first | Accepted | VS-0 | Quality |
| [0024](docs/adr/ADR-0024-deployment-topology.md) | Deployment topology: containers, single region | Accepted | VS-19 | Operations |
| [0025](docs/adr/ADR-0025-config-driven-catalog.md) | Configuration-driven catalog (no hard-coded items) | Accepted | VS-4 | Domain |
| [0026](docs/adr/ADR-0026-append-only-audit.md) | Append-only audit events with mandatory reasons | Accepted | VS-0 | Compliance |
| [0027](docs/adr/ADR-0027-expense-review-model.md) | Field expense categorisation and neutral review model | Accepted | VS-7 | Finance/Ethics |
| [0028](docs/adr/ADR-0028-loyalty-identification.md) | Loyalty identification and fraud-resistant redemption | Accepted | VS-11 | Loyalty |
| [0029](docs/adr/ADR-0029-recognition-scoring-philosophy.md) | Operator recognition scoring philosophy | Accepted | VS-15 | People |
| [0030](docs/adr/ADR-0030-stock-variance-policy.md) | Stock variance reasons and non-accusation policy | Accepted | VS-8 | Inventory |
| [0031](docs/adr/ADR-0031-multitenancy-scoping.md) | Multi-tenancy and organization scoping | Accepted | VS-1 | Architecture |
| [0032](docs/adr/ADR-0032-identifier-strategy.md) | Identifiers: UUIDv7 + human-readable business codes | Accepted | VS-0 | Data |
| [0033](docs/adr/ADR-0033-time-and-business-day.md) | Time storage and business-day semantics | Accepted | VS-0 | Data |
| [0034](docs/adr/ADR-0034-api-versioning-errors.md) | API versioning, error envelope, rate limits | Accepted | VS-1 | API |
| [0035](docs/adr/ADR-0035-module-boundaries.md) | Module boundaries and dependency direction | Accepted | VS-0 | Architecture |
| [0036](docs/adr/ADR-0036-skeleton-code-policy.md) | Skeleton code policy and NotImplemented convention | Accepted | VS-0 | Process |
| [0037](docs/adr/ADR-0037-retention-and-deletion.md) | Retention, deletion, and archival strategy | Accepted | VS-17 | Compliance |
| [0038](docs/adr/ADR-0038-feature-flags-slice-gating.md) | Feature flags and vertical-slice gating | Accepted | VS-0 | Process |

**Total ADRs:** 38 (all Accepted; none superseded).

Nested records live in `docs/adr/` (index: [`docs/adr/INDEX.md`](docs/adr/INDEX.md)) using the filenames
linked above; that index is a navigational duplicate and this file is canonical.

## Status definitions

| Status | Meaning |
| --- | --- |
| Proposed | Under discussion; must not be implemented. |
| **Accepted** | Binding. Implementation may follow in the designated slice. |
| Accepted (deferred) | Binding decision, implementation intentionally postponed to the named slice. |
| Superseded by ADR-XXXX | Historical only. |
| Rejected | Evaluated and not adopted; may be revisited only with new evidence. |

## Areas that require an ADR before any implementation

Money representation · price resolution · price override authority · payment provider
boundary · idempotency · offline authority · authentication · authorization model · audit
model · expense categorisation · loyalty redemption · recognition scoring · retention.
