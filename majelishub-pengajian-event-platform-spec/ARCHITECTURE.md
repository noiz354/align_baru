# ARCHITECTURE — MajelisHub

- Status: **Authoritative** (Phase 0 frozen). Changes require an ADR.
- Read with: `docs/adr/` (why), `DOMAIN.md` (what), `docs/architecture/*` (detail),
  `docs/research/STACK-2026.md` (technology validation), `DEPLOYMENT.md` (how it runs).

---

## 1. Architecture principles

| # | Principle | Consequence for every decision |
|---|---|---|
| A1 | **One deployable, one database, one team** | Modular monolith. A new module is a folder and a schema, not a service. (`ADR-0002`) |
| A2 | **Operationally simple beats technically elegant** | Every new stateful component must justify itself (see §9). Redis, Kafka, and search engines are absent by decision, not by omission. |
| A3 | **The database is the source of truth for invariants** | Uniqueness, capacity, idempotency and attendance integrity are enforced by constraints and transactions, not only by application code. |
| A4 | **Contracts before implementations** | Types, ports and DTOs are written first; implementations fill them. Phase 0 is entirely contracts. |
| A5 | **Failures are designed, not discovered** | Every external boundary (camera, mic, storage, provider, network) has a specified degraded mode (`docs/architecture/FAILURE-MODEL.md`). |
| A6 | **Provenance is a first-class attribute** | Machine output vs human-reviewed text; raw vs processed audio; who did what, when, and why (audit). |
| A7 | **Privacy by construction** | Collect less; keep secrets hashed; never log content; retention is a scheduled job, not an intention. |
| A8 | **The entrance is the hardest path** | Performance and reliability budgets are set by the check-in queue, not by the dashboard. |
| A9 | **Reversibility over optimality** | Ports and adapters so storage, STT, auth implementation and hosting can change without touching the domain. |
| A10 | **Documentation is code** | Docs are reviewed in the same PR as the change; skeleton code that contradicts docs is a defect. |

## 2. System context

```
        ┌───────────────────────────── Participant (mobile browser / PWA) ────────────────────────┐
        │  discover · register · show QR · listen · read transcript · feedback                    │
        └───────────────┬────────────────────────────────────────────────────────────────────────┘
                        │  HTTPS
┌───────────────────────▼────────────────────────────────────────────────────────────────────────┐
│ MajelisHub (single Next.js 16 application, Node 24)                                            │
│                                                                                                │
│  Participant surfaces        Organizer console            Reviewer/admin surfaces               │
│  (RSC + Server Actions,      (role-scoped, server-        (queues, editors, audit)              │
│   cacheable, no auth)         enforced authorization)                                           │
└──────┬─────────────────────┬─────────────────────────┬───────────────────────┬─────────────────┘
       │                     │                         │                       │
       │ SQL (pg)            │ S3 API (presigned)      │ provider port         │ outbox
┌──────▼──────┐   ┌──────────▼───────────┐   ┌─────────▼───────────┐   ┌───────▼──────────┐
│ PostgreSQL  │   │ Object storage       │   │ STT provider        │   │ Notifications    │
│ 18          │   │ (MinIO / R2 / B2)    │   │ (self-hosted        │   │ (in-app + email) │
│ system of   │   │ raw · normalized ·   │   │  Whisper worker OR  │   │ adapter port     │
│ record      │   │ derivative · exports │   │  hosted API)        │   └──────────────────┘
└──────┬──────┘   └──────────▲───────────┘   └─────────▲───────────┘
       │                     │                         │
       │ SKIP LOCKED jobs    │ chunks / reads          │ jobs
┌──────▼─────────────────────┴─────────────────────────┴─────────────────────────────────────────┐
│ Worker process (same codebase, separate container)                                             │
│  pg-boss consumers:  audio.assemble · audio.process · transcription.request ·                   │
│                      transcription.poll · transcript.index · notifications.dispatch ·           │
│                      retention.run · attendance.finalize                                        │
│  tools: ffmpeg (pinned)                                                                         │
└──────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                               │ OTLP (traces, metrics) + stdout JSON logs
                                     ┌─────────▼──────────┐
                                     │ Collector + backend │
                                     └────────────────────┘
```

**Actors outside the system boundary:** browsers (untrusted), volunteers' phones (untrusted),
object storage (trusted-but-fallible), STT provider (third party, optional), email provider
(third party), prayer-time source (optional, deployment-configured).

## 3. Technology stack (frozen)

| Layer | Selection | ADR |
|---|---|---|
| Web framework | Next.js 16 (App Router, Turbopack, `proxy.ts`) | 0002 |
| UI | React 19.2 + TypeScript 5.9 strict | 0002 |
| Runtime | Node.js 24 LTS | 0020 |
| Database | PostgreSQL 18 | 0003 |
| Data access | Drizzle ORM + `pg` | 0004 |
| Auth | Better Auth (organization plugin) | 0005 |
| QR generation | Server-side renderer, opaque token payload | 0006 |
| QR scanning | `BarcodeDetector` → `zxing-wasm` fallback | 0026 |
| Audio capture | MediaRecorder (timeslice) + Web Audio analyser | 0008, 0022 |
| Audio processing | ffmpeg in a worker container | 0009, 0020 |
| Object storage | S3 API (MinIO dev, R2/B2 prod) | 0013 |
| STT | `TranscriptionProvider` port; self-hosted Whisper default | 0011, 0012 |
| Jobs | pg-boss (Postgres, SKIP LOCKED) | 0010 |
| Search | Postgres `tsvector` + `pg_trgm` | 0014 |
| Observability | OpenTelemetry (traces+metrics) + stdout JSON logs | 0019 |
| Testing | Vitest 4 + Playwright | 0021 |
| Delivery | Docker multi-stage; Compose for dev; GitHub Actions | 0020 |

Rationale, alternatives and rejected options: `docs/research/STACK-2026.md`.

## 4. Module boundaries

Modules are **vertical slices of the codebase** (`src/features/<module>`), each owning its
routes, UI, service ports, DTOs and job handlers. Domain rules live in `src/domain/<entity>`
and are shared by modules but owned by exactly one.

| Module | Owns | Does **not** own |
|---|---|---|
| `identity` | principals, sessions, memberships, roles, invitations | organization data itself |
| `organizations` | tenant record, settings, member→role assignments, mosque scoping | who a person is in other tenants |
| `mosques` | mosques, venues, facilities, entrances, geolocation, contact visibility | events, speakers |
| `speakers` | speaker profiles, verification state, affiliations, listing visibility | their events (events point at speakers) |
| `programs` | recurring programs, recurrence rules, event generation proposals | individual event state |
| `events` | kajian events, policies (registration/attendance/recording/transcription), publication, cancellation | registrations, attendance |
| `registration` | registrations, capacity, waitlist, invitation acceptance, contact tokens | attendance facts |
| `checkin` | tokens, scanner session, validation, walk-in creation at the entrance | attendance storage (delegates to attendance) |
| `attendance` | attendance records, summaries, corrections, windows, exports | registration state |
| `recording` | recording sessions, chunk ingestion, recovery, assembly orchestration | audio processing (delegates to `audio`) |
| `audio` | audio assets, processing/normalisation, derivatives, playback authorisation | provider-specific transcription |
| `transcription` | transcription jobs, provider adapter, raw output, segments, revisions, approval/publish state | publication visibility rules (events/content) |
| `content` | archive pages, chapters, materials, search index, moderation of published content | transcripts themselves |
| `feedback` | feedback submissions, aggregates, visibility rules | speaker scoring (forbidden) |
| `notifications` | notification intents, outbox dispatch, channels, preferences, dedupe | business triggers (other modules emit intents) |
| `analytics` | dashboards, derived counters, operational alerts | raw personal data |
| `moderation` | reports, decisions, appeals, takedown | content ownership |
| `audit` | append-only audit events, query surface | business rules |

### 4.1 Why these boundaries are the way they are (justification)

1. **`checkin` is separate from `attendance`.** Check-in is a *high-frequency, latency-critical
   validation and admission* concern with its own performance budget, offline questions and
   token security model. Attendance is a *record integrity* concern (`FR-ATTEND-001`).
   Merging them would let entrance-performance trade-offs leak into attendance semantics —
   exactly the failure that produces duplicate or missing attendance.
2. **`recording` is separate from `audio`.** `recording` owns the *live, lossy, unreliable*
   session (chunks in flight, browser state, recovery). `audio` owns the *durable artefact*
   (assembly, processing, storage, playback). Their failure modes and lifetimes are opposite;
   the split is what makes "a 2-hour recording survives a crash" a design property rather than
   a hope.
3. **`transcription` is separate from `content`.** Transcription is an asynchronous,
   fallible, provider-dependent pipeline with a human-review gate. Content is curation and
   publication. Separating them keeps the *mandatory review gate* (`ADR-0012`) enforceable in
   one module instead of scattered across UI code.
4. **`programs` is separate from `events`.** The Program/Event distinction
   (`docs/product/PROGRAMS.md`) is a core domain concept: programs recur, events happen.
   Merging them creates the classic "recurring event row that is edited into a lie" bug.
5. **`mosques` owns venues.** A venue has no meaning without a mosque (composition, not
   association), and capacity/entrance information is a mosque-facility concern.
6. **`identity` is separate from `organizations`.** A person may organize at two mosques and
   speak at a third. Identity is global; roles are tenant-scoped. Conflating them is the most
   common multi-tenant modelling mistake.
7. **`notifications` is a service, not a feature of others.** Otherwise every module grows its
   own email path, and deduplication/opt-out becomes impossible. Modules emit *intents*;
   `notifications` decides delivery.
8. **`audit` is append-only and separate from `analytics`.** Analytics may be recomputed and
   deleted; audit must not be.
9. **`moderation` is separate from `content`.** Moderation acts *on* content owned by others,
   with different roles, and must remain possible even if the content module changes shape.
10. **`analytics` never owns data.** It reads through module ports and derives counters; if a
    number is wrong it can be recomputed, never "fixed".

## 5. Layers and dependency rules

```
src/app/**            routes, layouts, server actions (thin: parse → authorize → call service → render)
   │ may import ↓
src/features/<mod>/**  feature UI, hooks, service implementations, DTO mappers, job handlers
   │ may import ↓
src/domain/<entity>/** pure domain: types, state machines, invariants, policy functions (no I/O)
   │ may import ↓
src/shared/**          contracts, types, validation, time, ui primitives
src/server/**          adapters: db, storage, media, transcription, jobs, auth, telemetry
```

**Rules (enforced by review and, later, by an ESLint boundary rule):**

- `domain` imports nothing from `features`, `server` or `app`. It has no I/O, no `Date.now()`
  (a `Clock` port is injected), no random without an injected source in testable paths.
- A feature may import another feature **only** through its published port/API surface
  (`src/features/<mod>/index.ts`), never by reaching into its internals.
- `server/*` adapters implement ports declared by features/domain; adapters never contain
  business rules.
- `shared/contracts` contains wire types only — no database types, no ORM types.
- No module may import the Drizzle schema directly except `src/server/db` and repository
  adapters. Feature code speaks in domain types.
- Cross-module writes happen through service calls or domain events (outbox), never by
  updating another module's tables directly.
- Client components may not import `src/server/**`.

## 6. Tenancy and isolation

- Model: **shared schema, organization-scoped rows**, `organization_id` on every scoped
  aggregate (`ADR-0003`, `ADR-0017`).
- Enforcement layers (defence in depth, all required):
  1. **Authorization guard** at the route/action boundary resolves actor → memberships →
     permitted scopes (organization + optional mosque subset).
  2. **Repository scope object**: every scoped query is built with a `TenantScope` parameter;
     repositories cannot be called without one (type-level requirement).
  3. **Row-level security (P1)** in Postgres as a backstop for the application's session
     (`SET LOCAL app.organization_id`), catching any forgotten predicate.
  4. **Tests**: an isolation suite attempts cross-org access on every scoped endpoint
     (`docs/testing/STRATEGY.md` §Isolation).
- Public read paths (event pages, mosque pages, published archive) are explicitly
  organization-agnostic **by policy**, and use dedicated *public projections* that never
  expose contact data, registration counts that reveal individuals, or unlisted speakers.

## 7. Data flow of the critical paths

### 7.1 Check-in (target p95 ≤ 300 ms server-side)

```
Scanner (browser) --POST /api/checkin/validate {token, eventId, entranceId, idempotencyKey}-->
  proxy.ts: session + role + rate limit + device binding
    → checkin service: hash(token) → lookup registration (by token hash, event, org)
      → invariants: belongs to event? cancelled? window open? already attended?
        → attendance service: INSERT ... ON CONFLICT (event_id, registration_id) DO NOTHING
          → outbox: ParticipantCheckedIn
            → response: {result: CHECKED_IN | ALREADY | INVALID | WRONG_EVENT | ...}
```
No queue on this path. No storage call. No notification inside the transaction (outbox only).

### 7.2 Recording (2-hour session, unreliable network)

```
MediaRecorder.start(10_000) --ondataavailable--> client buffer (IndexedDB queue)
  → POST /api/recordings/{id}/chunks (multipart, sequence, sha256)  [retry with backoff]
    → verify session ownership + policy → store chunk (storage, key includes sequence)
      → upsert chunk row (unique per (session, sequence)) → ack {received: n, missing: [...]}
After stop → CompleteRecording → job audio.assemble (worker)
  → verify contiguity → concatenate → ffmpeg remux to seekable container
    → AudioAsset(RAW) + ffmpeg normalize → AudioAsset(NORMALIZED)
      → derive 16 kHz mono → AudioAsset(TRANSCRIPTION_DERIVATIVE)
        → outbox: AudioUploadCompleted / AudioProcessingCompleted
```
Full protocol: `docs/media/CHUNK-PROTOCOL.md`.

### 7.3 Transcription

```
RequestTranscription (organizer, policy-checked)
  → TranscriptionJob(QUEUED) + outbox TranscriptionRequested
    → worker: provider.submit(audio, languageHints) → provider job id
      → TranscriptionJob(PROCESSING) → poll/webhook → raw result stored as artifact
        → segmentation → Transcript(DRAFT, source=MACHINE) → REVIEW_REQUIRED
          → reviewer edits (revisions) → APPROVED → publish gate (policy) → PUBLISHED
```
Provider is never called from a request handler. Machine output can never skip
`REVIEW_REQUIRED` → `APPROVED` (enforced in the state machine **and** by a database check
constraint on `published_at` requiring a non-null `approved_by`).

## 8. Runtime topology

| Process | Purpose | Scaling |
|---|---|---|
| `web` | Next.js server (RSC, Server Actions, API route handlers, `proxy.ts`) | 1–2 instances behind a proxy; stateless |
| `worker` | pg-boss consumers + ffmpeg | 1 instance (2 for redundancy); CPU-bound work is concurrency-limited |
| `postgres` | System of record + job queue | Managed in production; single instance acceptable at target scale with tested backups |
| `storage` | S3-compatible object storage | Managed (R2/B2) recommended; MinIO for self-hosting |
| `collector` | OTLP receiver → backend | Optional; logs to stdout are always available as the fallback |

**No sticky sessions, no shared filesystem, no in-process cron.** Scheduled work is pg-boss
cron so it cannot run twice per instance.

## 9. Dependency rules for infrastructure

A new infrastructure component may only be introduced with an ADR that demonstrates all of:

1. A measured problem it solves that the current stack cannot (with numbers, not adjectives).
2. A documented operational cost: who backs it up, who upgrades it, what happens at 3 a.m.
3. A degradation story when it is unavailable.
4. A removal story (how we would revert).

Currently rejected on these grounds: Redis, Kafka, Elasticsearch, Kubernetes, a CDN-tier
application server, a separate notification microservice (`docs/architecture/FINAL-REVIEW.md` §4).

## 10. Cross-cutting concerns

| Concern | Approach | Document |
|---|---|---|
| Time | Store UTC (`timestamptz`), display in venue IANA timezone; prayer-relative times are a distinct type | `ADR-0018`, `GLOSSARY.md` §Time |
| IDs | ULID/UUIDv7 strings for public ids; opaque tokens are separate 128-bit secrets, stored hashed | `ADR-0006`, `DATA_MODEL.md` |
| Idempotency | Client-supplied `Idempotency-Key` for mutations; DB uniqueness as the backstop | `API.md` §Idempotency |
| Concurrency | Optimistic concurrency (`version` column) + DB constraints; explicit catalogue | `docs/architecture/CONCURRENCY.md` |
| Transactions | One aggregate per transaction; outbox row in the same transaction as the state change | `EVENTS.md` |
| Errors | Domain error taxonomy mapped to HTTP codes once, in `src/shared/contracts/errors.ts` | `API.md` §Errors |
| Validation | `zod` schemas in `shared/validation` shared by client and server; server always revalidates | `API.md` §Validation |
| i18n | Message catalogues keyed by ID; no inline user-visible strings | `NFR-I18N-*` |
| Feature policy | Recording/transcription/publication policy is evaluated in one policy module, not in UI branches | `docs/product/CONTENT-INTEGRITY.md` §Policy |
| Audit | Append-only `audit_events`, written in the same transaction as the action | `SECURITY.md` §Audit |
| Retention | Declarative policy table + `retention.run` job + deletion evidence | `RETENTION.md` |

## 11. Extension points (designed, not built)

| Extension | Mechanism | Trigger to build |
|---|---|---|
| New notification channel (WhatsApp/SMS/Telegram) | `NotificationChannel` adapter | Deployment has a funded, consented channel |
| Hosted STT provider | `TranscriptionProvider` adapter | Self-hosted accuracy/cost is inadequate at real volume |
| Second storage backend | `ObjectStorage` adapter | Provider migration or multi-region |
| Multi-region read replicas | Postgres read replica + public projections | Read load or geographic latency becomes measurable |
| Offline check-in | `docs/attendance/OFFLINE-EVALUATION.md` design | A real deployment has a documented recurring connectivity failure |
| Redis/BullMQ | Job throughput exceeds pg-boss comfort | > ~100 sustained jobs/s or a need for job flows/rate limiting |

## 12. Phase-0 skeleton mapping

| Architecture concept | Skeleton location | Status |
|---|---|---|
| Module boundaries | `src/features/<module>/` | folders + ports + DTOs, no logic |
| Domain model & state machines | `src/domain/<entity>/` | types + transition tables (data only) |
| Adapters | `src/server/{auth,db,storage,media,transcription,jobs,telemetry}/` | interfaces + `NotImplemented` |
| Wire contracts | `src/shared/contracts/` | request/response types, error taxonomy |
| Validation | `src/shared/validation/` | schemas declared, not wired |
| Routes | `src/app/**` | shells returning nothing |
| Components | `src/shared/ui/`, `src/features/*/ui/` | shells returning `null` |
| Tests | `tests/{unit,integration,browser,e2e}/` | `describe.todo()` only |

Nothing in the skeleton may be interpreted as behaviour; see `AGENTS.md` §Never fake.

## 13. Architecture risks (tracked, with owners)

| # | Risk | Impact | Mitigation | Owner |
|---|---|---|---|---|
| R1 | MediaRecorder chunk gaps or encoder stalls in a real 2-hour session | Lost audio | Telemetry on chunk cadence; AudioWorklet/PCM escape hatch designed (`ADR-0008` §Revisit trigger) | Media architect |
| R2 | Browser/OS suspending a backgrounded tab mid-recording | Truncated recording | Screen-lock warning + visibility API handling + server-side gap reporting | Media architect |
| R3 | Transcription accuracy on code-switched Arabic/Indonesian | Content integrity | Mandatory human review, certainty flags, no auto-correction (`ADR-0012`) | AI architect |
| R4 | Volunteer error at the entrance (wrong event bound) | Wrong attendance | Device-to-event binding, context bar, alerting on anomaly | UX + SRE |
| R5 | Storage cost growth from retained audio | Operating cost | Explicit retention tiers and per-event cost model (`OPERATIONS.md`) | SRE |
| R6 | Small team maintaining an async pipeline + media + review UI | Delivery risk | Vertical slices, no new infra without ADR, heavy automation of QA | Architect |
| R7 | Multi-tenant leakage via a forgotten predicate | Trust-destroying incident | Type-level scope, RLS backstop, isolation test suite | Security |
| R8 | Speaker/organizer abuse of the archive for promotion | Product integrity | No ranking surfaces; moderation; policy constraints (`ADR-0024`) | Product |
