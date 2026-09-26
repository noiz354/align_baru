# ADR — Architecture Decision Record index

MajelisHub records every decision that constrains implementation. Decisions are **immutable
in substance**: to change one, add a new ADR that supersedes it, and mark the old one.

- Individual records live in `docs/adr/ADR-XXXX-*.md`.
- Format: Context → Decision → Alternatives considered → Consequences (positive/negative) →
  Enforcement → Revisit trigger.
- Status values: `Accepted` · `Accepted (amended by ADR-XXXX)` · `Superseded by ADR-XXXX` ·
  `Proposed` · `Rejected`.

## Index

| ADR | Title | Status | Area | Related requirements |
|---|---|---|---|---|
| [0001](docs/adr/ADR-0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | Process | — |
| [0002](docs/adr/ADR-0002-modular-monolith-nextjs.md) | Modular monolith on Next.js 16 App Router | Accepted | Architecture | NFR-OPS-001/005 |
| [0003](docs/adr/ADR-0003-postgresql-as-system-of-record.md) | PostgreSQL 18 as the single system of record | Accepted | Data | FR-ORG-003, NFR-SEC-003 |
| [0004](docs/adr/ADR-0004-drizzle-orm.md) | Drizzle ORM over Prisma | Accepted | Data | — |
| [0005](docs/adr/ADR-0005-better-auth.md) | Better Auth for identity and sessions | Accepted | Security | NFR-SEC-001/011 |
| [0006](docs/adr/ADR-0006-opaque-checkin-tokens.md) | Opaque, hashed check-in tokens (no PII in QR) | Accepted | Security | FR-CHECKIN-011, NFR-SEC-004/005 |
| [0007](docs/adr/ADR-0007-offline-checkin-deferred.md) | Offline check-in deferred; design constraints fixed | Accepted | Attendance | FR-CHECKIN-016 |
| [0008](docs/adr/ADR-0008-chunked-recording.md) | Chunked recording with incremental upload | Accepted | Media | FR-AUDIO-005…009, NFR-REL-001 |
| [0009](docs/adr/ADR-0009-opus-speech-audio-profile.md) | Opus speech audio profile; ffmpeg normalisation | Accepted | Media | FR-AUDIO-010/012 |
| [0010](docs/adr/ADR-0010-pg-boss-over-redis.md) | pg-boss (Postgres) instead of Redis/BullMQ | Accepted | Operations | NFR-REL-004 |
| [0011](docs/adr/ADR-0011-transcription-provider-port.md) | Transcription behind a provider port | Accepted | AI | FR-TRANSCRIPT-003 |
| [0012](docs/adr/ADR-0012-mandatory-human-review.md) | Mandatory human review before transcript publication | Accepted | Content integrity | FR-TRANSCRIPT-006/010, NFR-ETH-002 |
| [0013](docs/adr/ADR-0013-s3-compatible-private-storage.md) | S3-compatible private object storage with presigned access | Accepted | Media | FR-AUDIO-011, NFR-SEC-009 |
| [0014](docs/adr/ADR-0014-postgres-search.md) | PostgreSQL full-text + trigram search | Accepted | Content | FR-CONTENT-004 |
| [0015](docs/adr/ADR-0015-outbox-notifications.md) | Outbox-driven notifications with channel adapters | Accepted | Notifications | FR-NOTIF-006/007 |
| [0016](docs/adr/ADR-0016-feedback-anonymity-policy.md) | Feedback anonymity and visibility policy | Accepted | Privacy | FR-FEEDBACK-003/004 |
| [0017](docs/adr/ADR-0017-shared-schema-tenancy.md) | Shared-schema multi-tenancy with layered enforcement | Accepted | Security | FR-ORG-003, NFR-SEC-003 |
| [0018](docs/adr/ADR-0018-time-and-timezone.md) | UTC storage, venue-timezone display, prayer-relative times | Accepted | Domain | FR-EVENT-003, NFR-I18N-002/004 |
| [0019](docs/adr/ADR-0019-observability.md) | OpenTelemetry traces/metrics + stdout logs; no content in telemetry | Accepted | Operations | NFR-OBS-001…008 |
| [0020](docs/adr/ADR-0020-deployment-topology.md) | Container topology: web + worker + managed Postgres/storage | Accepted | Operations | NFR-OPS-002/003 |
| [0021](docs/adr/ADR-0021-testing-stack.md) | Vitest 4 + Playwright; contract-first test skeletons | Accepted | Testing | TESTING.md |
| [0022](docs/adr/ADR-0022-recording-client-architecture.md) | Recording client architecture (MediaRecorder + analyser + IndexedDB queue) | Accepted | Media | FR-AUDIO-002…008 |
| [0023](docs/adr/ADR-0023-transcript-revision-model.md) | Append-only transcript revisions; immutable published snapshots | Accepted | Content | FR-TRANSCRIPT-009/012 |
| [0024](docs/adr/ADR-0024-no-speaker-ranking.md) | No ranking, popularity or authority scoring of speakers | Accepted | Product ethics | FR-SPEAKER-007, FR-FEEDBACK-005, NFR-ETH-001 |
| [0025](docs/adr/ADR-0025-attendance-integrity.md) | Attendance integrity by database constraint + idempotency | Accepted | Attendance | FR-ATTEND-001, FR-CHECKIN-004, NFR-REL-003 |
| [0026](docs/adr/ADR-0026-qr-scanning-strategy.md) | Layered QR scanning (BarcodeDetector → zxing-wasm) | Accepted | Check-in | FR-CHECKIN-001/003 |
| [0027](docs/adr/ADR-0027-pwa-first-no-native-app.md) | PWA-first; no native applications | Accepted | Product/platform | NFR-MOB-001…006 |

## Decision domains at a glance

- **Architecture shape:** 0002, 0017, 0020
- **Data:** 0003, 0004, 0014, 0018, 0023, 0025
- **Security & privacy:** 0005, 0006, 0013, 0016, 0017, 0019
- **Media & AI:** 0008, 0009, 0011, 0012, 0022, 0026
- **Operations & quality:** 0007, 0010, 0019, 0020, 0021
- **Product ethics:** 0012, 0024, 0027

## Adding an ADR

1. Copy the template in `docs/adr/README.md`.
2. Number sequentially; never reuse a number.
3. Add the row to this index and to the relevant documents' "See also" sections.
4. Update `docs/TRACEABILITY.md` if the ADR constrains a requirement.
