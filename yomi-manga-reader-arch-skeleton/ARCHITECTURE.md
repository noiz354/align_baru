# ARCHITECTURE — Yomi Manga & Comic Reader

Date: 2026-09-26 · Status: Authoritative for the implementation phase. This document, `docs/architecture/*`, and the ADRs are the source of truth. If code and docs disagree, docs win until amended by an ADR.

## 1. Design Principles

1. **Modular monolith.** One deployable Next.js application with strict internal module boundaries. No microservices, no Kafka, no Redis, no Elasticsearch, no GraphQL, no Kubernetes (ADR-001, ADR-009). Scale path is documented, not built.
2. **Ports and adapters.** Domain features depend on interfaces (ports) defined in `shared/contracts`; infrastructure implementations live in `server/`. No feature may import from `server/`.
3. **SQL-first data access.** Drizzle ORM generates inspectable SQL; hot paths have named indexes; no string-built SQL (NFR-SEC-015).
4. **Contracts over handlers.** API shapes, error taxonomy, and domain entities are defined in `API_CONTRACT.md`, `DATA_MODEL.md`, and `src/shared/contracts/` before any handler exists.
5. **Traceable work.** Every skeleton file and task references requirement IDs (FR-*/NFR-*) and task IDs (T-*). No untraceable code.
6. **Bounded resources by design.** The reader's image window, residency cap, upload caps, and rate limits are explicit constants (PERFORMANCE.md, SECURITY.md), not emergent behavior.

## 2. System Context

```
                        ┌────────────────────────────────────────────┐
                        │                 Internet                   │
                        └──────────────┬─────────────────────────────┘
                                       │ HTTPS
                        ┌──────────────▼─────────────────────────────┐
                        │   Edge / Reverse Proxy (Caddy or Caddy+TLS) │
                        │   TLS termination, static fallback, rate    │
                        │   limiting backstop, security headers       │
                        └──────────────┬─────────────────────────────┘
                                       │
   ┌───────────────────────────────────▼────────────────────────────────────────┐
   │                          Next.js 16 application (Node 24)                   │
   │  (modular monolith — single deployable, stateless)                          │
   │                                                                            │
   │  ┌───────────────────────────────┐   ┌──────────────────────────────────┐  │
   │  │  Web layer (src/app)          │   │  API layer (route handlers,      │  │
   │  │  Server Components, RSC pages │   │  /api/v1/*, /media/*)            │  │
   │  └──────────────┬────────────────   └───────────────┬──────────────────┘  │
   │                 │                                    │                     │
   │  ┌──────────────▼────────────────────────────────────▼──────────────────┐  │
   │  │  Domain features (src/features):                                     │  │
   │  │  auth · catalog · manga · chapters · reader · progress ·             │  │
   │  │  library · search · admin · uploads                                  │  │
   │  └──────────────┬────────────────────────────────────────────────────────┘  │
   │                 │ ports (src/shared/contracts)                              │
   │  ┌──────────────▼────────────────────────────────────────────────────────┐  │
   │  │  Infrastructure (src/server):                                         │  │
   │  │  db (Drizzle repos) · storage (S3) · media (sharp) · auth (sessions)  │  │
   │  │  telemetry (OTel + pino) · composition (wiring)                       │  │
   │  └───────┬──────────────────────┬───────────────────────────┬────────────┘  │
   └────────────────────────────────┼───────────────────────────┼────────────────┘
              │                      │                           │
     ┌────────▼────────┐   ┌─────────▼─────────┐      ┌──────────▼──────────┐
     │  PostgreSQL 18  │   │ S3-compatible     │      │ Telemetry collector │
     │  (compose/VM)   │   │ object storage    │      │ (OTLP endpoint:      │
     │                 │   │ (R2 / S3 / MinIO) │      │  vendor or local)    │
     └─────────────────┘   └───────────────────┘      └─────────────────────┘
```

Details: `docs/architecture/system-context.md`.

## 3. Module Map & Boundaries

Authoritative boundary spec: `docs/architecture/module-boundaries.md`. Dependency rules: `docs/architecture/dependency-rules.md`. Data flow: `docs/architecture/data-flow.md`.

| Module | Layer | Responsibility | Depends on (allowed) |
|---|---|---|---|
| `features/auth` | domain | Registration, sign-in/out, sessions, roles, reset, account deletion | shared contracts; ports (UserRepository, SessionRepository, PasswordHasher, MailPort*) |
| `features/catalog` | domain | Catalog queries: listing, filters, sorts, detail, chapter listing, resume | ports (MangaRepository, ChapterRepository, ProgressReader), shared |
| `features/manga` | domain | Manga aggregate rules: identity, slug, aliases, metadata, soft-delete | shared |
| `features/chapters` | domain | Chapter aggregate rules: numbering, order, publish state, page list access | shared |
| `features/reader` | domain | Reader state machine, page-index invariants, windowing contract, mode/direction rules, completion | shared; ports (ProgressReader/Writer, ChapterPageSource) |
| `features/progress` | domain | Progress + history domain rules: idempotent save, restore, merge, history append | ports (ProgressRepository, HistoryRepository) |
| `features/library` | domain | Library, bookmarks, read-status derivation | ports (LibraryRepository, BookmarkRepository, ProgressReader) |
| `features/search` | domain | Search rules: parsing, ranking, pagination | port (SearchRepository) |
| `features/admin` | domain | Admin operations: content CRUD, publish, users, audit, stats | ports (Manga/Chapter/User/Audit/Stats repositories), auth port |
| `features/uploads` | domain | Upload job state machine, validation orchestration, page metadata commit | ports (ObjectStoragePort, ImageProcessorPort, ArchivePort, UploadJobRepository, ChapterRepository) |
| `server/db` | infra | Drizzle schema, connection, repository implementations, migrations | shared contracts; implements feature ports |
| `server/auth` | infra | Session store implementation, cookie issuance, middleware guard | shared; implements auth ports |
| `server/storage` | infra | S3 adapter (R2/S3/MinIO), multipart, lifecycle | shared; implements ObjectStoragePort |
| `server/media` | infra | sharp normalization pipeline, page delivery (variants, headers) | shared; implements ImageProcessorPort |
| `server/telemetry` | infra | OTel init, pino logger, beacons, alert hooks | shared; implements TelemetryPort |
| `server/composition.ts` | infra | Wires ports → implementations per environment | all of server + shared |
| `shared/*` | shared | Contracts, types, validation schemas, minimal UI primitives | (leaf: depends on nothing internal) |
| `src/app/*` | web | Routes, RSC pages, route handlers, middleware, error boundary | features (services), shared; NEVER server internals directly except composition |

\* MailPort is a planned port (password reset email, FR-AUTH-004); provider integration is a later task.

## 4. Request Lifecycles

### 4.1 Public read (catalog → reader)

1. Browser requests `/manga/[slug]` (RSC page).
2. Page calls `features/catalog` service → `MangaRepository` port → `server/db` → PostgreSQL.
3. Server component streams rendered HTML with cover `assetKey` → `<img src="/media/{assetKey}">`.
4. Reader page loads `GET /api/v1/chapters/{id}/pages` → chapter service → page list (ordered, with variant URLs).
5. Client reader (Client Component) owns `ReaderState`; loads images inside the bounded window; images stream from `GET /media/{assetKey}` → `server/media` → storage.
6. Progress: authenticated → `POST /api/v1/progress` → progress service → repository (idempotent upsert).

### 4.2 Upload (admin)

1. Admin UI posts multipart (or presigned parts) to `POST /api/v1/admin/uploads` → `features/uploads` service.
2. Job row created (state=queued). Staging file written via storage port (temp prefix).
3. Validation phase (`prepareChapterUpload`): container check, caps (NFR-SEC-007), entry inspection (NFR-SEC-008) — rejects with typed `UPLOAD_*` errors.
4. Processing: stream-extract → per page: decode/normalize/encode (sharp) → store variants → collect metadata.
5. Commit: pages + asset metadata inserted, chapter state → ready (single transaction). Job → ready.
6. Failure at any phase: job → failed with reason; staging purged after 24 h (NFR-DATA-005).

### 4.3 Auth

1. `POST /api/v1/auth/login` → verify Argon2id hash → create session row (256-bit ID) → HttpOnly cookie.
2. Middleware guard (server/auth) resolves session for protected routes/APIs; admin guard checks role.
3. Sign-out deletes session row; cookie cleared.

## 5. Key Architectural Decisions (summary)

| ADR | Decision | One-line rationale |
|---|---|---|
| ADR-001 | Next.js 16 (App Router) + React 19 | Full-stack stable framework, 2026 production standard |
| ADR-002 | PostgreSQL 18 (compose; managed optional) | 5-year support, relational fit, FTS/trigram search |
| ADR-003 | Drizzle ORM 0.45 + drizzle-kit | SQL-first, inspectable, stable line; Prisma 7 is a viable alternative |
| ADR-004 | S3 protocol via `@aws-sdk/client-s3` behind a port | R2/S3/MinIO interchangeable; zero egress on R2 |
| ADR-005 | sharp 0.35 normalization → AVIF/WebP/JPEG | libvips performance; format ladder for devices |
| ADR-006 | DB-backed sessions + Argon2id | Stateless-ish app, server-side revocation, no JWT pitfalls |
| ADR-007 | Client-side DOM reader + bounded window | No canvas/tiling complexity; memory-bounded; SSR shell |
| ADR-008 | OpenTelemetry (API 1.9 + SDK 2.11) + pino | Vendor-neutral telemetry; stable packages only |
| ADR-009 | Single-VM Docker Compose deployment | Match operational scale; scale path documented |

## 6. Data & Caching Strategy

- **Database:** single PostgreSQL 18 instance (primary + daily logical backup). Read scaling later via a read replica (expand/contract, no code change beyond connection string).
- **Objects:** S3-compatible bucket; page variants under `pages/{chapterId}/{pageKey}.{ext}`; covers under `covers/{mangaId}.{ext}`; staging under `staging/{jobId}/` with 24 h lifecycle.
- **Browser caching:** immutable versioned asset keys (`Cache-Control: public, max-age=31536000, immutable`); API responses `Cache-Control: private, max-age=60`; HTML `no-store` (NFR-PERF-013). No server-side application cache in v1 (deliberate — see PERFORMANCE.md §7).
- **Client reader cache:** bounded window + residency cap in memory; nothing persisted offline (NO-6).

## 7. Cross-Cutting Concerns

- **Configuration:** typed env validated at boot (Zod); fail fast (NFR-OPS-002). Skeleton: `src/shared/validation/env.ts`.
- **Errors:** single error taxonomy (`API_CONTRACT.md` §6, `src/shared/contracts/errors.ts`); every error has: code, user-visible?, log level, alert?, HTTP mapping.
- **Observability:** every request gets a request ID + W3C trace context; DB/storage operations are spans (OBSERVABILITY.md).
- **Security:** controls per boundary in SECURITY.md; threat register in THREAT_MODEL.md; rate limits at the edge + in-app (two layers).
- **Accessibility:** contract in ACCESSIBILITY.md; axe-core runs in the E2E suite; reader keyboard map in docs/product/reader-behavior.md §9.

## 8. Scaling Path (documented, not built)

1. Read replica for catalog/search reads when p95 DB time trends > 15 ms (NFR-PERF-014).
2. Move page/media delivery to a CDN in front of storage (R2 already egress-free; S3 add CloudFront) — no app change (asset URLs stay app-relative until then).
3. Second app instance behind the reverse proxy (app is stateless; sessions live in PG) — no code change.
4. Extract `server/media` upload processing into a separate worker container (same image, different entrypoint) — port boundaries already make this cheap.
5. Only beyond ~10× scale: consider read-model search service or object-storage tiering. Still no Kafka/Redis/K8s without an ADR.

## 9. What the Skeleton Establishes (this phase)

- Route map (`src/app/**` shells) — no feature code.
- Contracts (`src/shared/contracts/**`) — types, ports, error taxonomy.
- High-risk algorithm placeholders with invariants documented (`reader-window.ts`, `page-index.ts`, `prepare-chapter-upload.ts`, …).
- Test skeletons with `describe.todo` bound to task IDs.
- **Zero implemented behavior.** Every function that must not exist yet throws `Not implemented: T-*`.
