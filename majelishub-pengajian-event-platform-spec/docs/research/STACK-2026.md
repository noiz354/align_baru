# STACK-2026 — Technology Validation for MajelisHub

- **Status:** Approved for Phase 0 (specification + skeleton)
- **Date:** 2026-09-26
- **Owners:** Principal Architect (systems), SRE, Security Engineer
- **Related:** `ARCHITECTURE.md`, `docs/adr/*`, `DEPLOYMENT.md`

## Purpose

MajelisHub is operated by small, often volunteer-run organisations (mosques, kajian
communities). The stack must therefore optimise for **operational simplicity,
long-term support windows, and boring reliability** — not novelty. This document
records the 2026 technology validation performed before freezing the architecture.

## Selection criteria (weighted, in order)

| # | Criterion | What it means here |
|---|---|---|
| 1 | Operational simplicity | ≤ 3 stateful services in production; one deployable app process + one worker |
| 2 | Support window | LTS or ≥ 2 years of upstream support remaining at selection date |
| 3 | Production evidence | Widely deployed, public post-mortems/issues, active security releases |
| 4 | Maintenance activity | Commits/releases within the last 60 days, or a stable project with a paid maintainer |
| 5 | Security posture | Documented disclosure process, security advisories, no unpatched criticals |
| 6 | Team skill fit | TypeScript end-to-end; one language, one type system, one test runner family |
| 7 | Reversibility | Boring interfaces and adapters so a choice can be reversed without rewriting the domain |

> Explicit non-criterion: "newest". A newer release that shortens the operations story
> is preferred; a newer release that only adds capability we do not need is not.

## Classification legend

- **SELECTED** — part of the frozen Phase 0 architecture; versions pinned in `package.json`.
- **PLANNED** — committed for a specific future vertical slice; not installed now.
- **OPTIONAL** — safe to add later without architectural change; decision deferred.
- **REJECTED** — evaluated and excluded, with a recorded reason (see ADRs).

> Phase 0 installs **only** what the skeleton needs (TypeScript types and the test/route
> shells). PLANAND/OPTIONAL items must **not** be added to `package.json` prematurely.

---

## 1. Web framework — Next.js 16 (App Router)

- **Classification: SELECTED**
- **Version line:** 16.3.x (LTS line; 16.0.0 released 2025-10-22, patch stream active at 16.3.5+ in Sept 2026; LTS support to 2027-10-21)
- **Why:** single framework for participant (mobile web/PWA), organizer console and public archive; React Server Components reduce client JS on information-first pages; Server Actions remove most hand-written CRUD endpoints; `proxy.ts` (Node.js runtime) runs on the server, so authorization checks can touch the database.
- **Operational notes:** `next build` output mode `standalone` produces one container image. Turbopack is default for dev and stable for production builds. Node.js ≥ 20.9 required.
- **Security notes:** Next.js had critical advisories in the 16.x line patched during 2026 (e.g. 16.2.6, 16.3.3). **Patch cadence is an operational requirement**, not an option — see `OPERATIONS.md` §Patching. Never use `middleware.ts` (deprecated); use `proxy.ts`.
- **Rejected alternative:** Remix/React Router framework mode — good, but smaller ecosystem of auth/UI building blocks and no Server Actions equivalent we would not hand-roll.

## 2. React + TypeScript

- **Classification: SELECTED**
- **React 19.2 stable** (bundled with Next.js 16.x). `use`, `useActionState`, transitions are stable.
- **TypeScript 5.9+** in `strict` mode, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` — the skeleton relies on the type system to express invariants.
- **Why:** Compile-time domain modelling (branded IDs, discriminated unions for state machines) is the cheapest possible substitute for runtime validation of business rules.

## 3. Runtime — Node.js 24 LTS

- **Classification: SELECTED**
- **Status:** Node 24 "Krypton" is Active LTS (maintenance phase from 2026-10-20, EOL 2028-04-30). Node 22 is Maintenance LTS (EOL 2027-04-30). Node 26 is *Current*, not LTS — not selected.
- **Why:** required by Next.js 16; the only runtime we must support for app + worker.
- **Note:** Node 24 enters Maintenance LTS on 2026-10-20. Plan the Node 26 LTS evaluation (LTS from 2026-10-28) for Q1 2027, tracked in `ROADMAP.md` (VS-15+ / maintenance).

## 4. Database — PostgreSQL 18

- **Classification: SELECTED**
- **Status:** 18.6 latest minor (Aug 2026); supported to Nov 2030 (5-year window).
- **Why:** system of record for events, registrations, attendance, transcript revisions; JSONB for provider payloads; `SELECT … FOR UPDATE SKIP LOCKED` enables a job queue without Redis (ADR-0010); partial unique indexes express attendance invariants (ADR-0025); `pg_trgm` + `tsvector` cover search without a search engine (ADR-0014).
- **Rejected:** PostgreSQL 16/17 (no reason to trade 2 years of support); any NoSQL store (the domain is relational and invite-only; multi-tenant scoping must be enforced by constraints).
- **Sequel note:** the window for PostgreSQL 14 ends 2026-11-12 — no deployment target may start on 14.

## 5. Data access — Drizzle ORM + `pg` driver

- **Classification: SELECTED**
- **Version line:** Drizzle ORM 0.4x (`drizzle-orm`, `drizzle-kit`); typed SQL-first schema in TypeScript.
- **Why:** no codegen step, SQL-shaped output we can read in `EXPLAIN`, first-class partial unique indexes / `ON CONFLICT` needed for idempotent check-in and attendance, small bundle, `pglite`/`node-postgres` compatible, no binary engine to ship into a container.
- **Rejected — Prisma 7:** substantially narrowed the gap in 2026 (Rust engine removed, ≈1.6 MB client) and has better Studio tooling, but it is a second schema language, a codegen step in CI, and nested-write ergonomics we do not need; our idempotency logic is SQL-shaped.
- **Rejected — Kysely:** excellent type safety, but fewer batteries (no schema/migration toolkit of the same maturity) for a small team.
- **Migrations:** `drizzle-kit generate` → reviewed SQL files. **No migrations are generated in Phase 0** (hard limit).

## 6. Authentication & authorization — Better Auth

- **Classification: SELECTED** (see ADR-0005)
- **Status:** Better Auth 1.6.x (May 2026), active development. Auth.js/NextAuth has been in **security-patch-only maintenance since Sept 2025** under the Better Auth team and its own docs redirect new projects to Better Auth — so Auth.js is **REJECTED for greenfield**, not because it is broken (existing apps are safe).
- **Why:** users live in *our* Postgres; organization plugin with roles/members maps directly onto our multi-tenant organizer model; passkey/MFA/session-revocation plugins available without a per-MAU bill; no vendor lock-in on identity data.
- **Operational warnings recorded:** Better Auth's default rate limiter is in-memory and resets on deploy — a durable store must be configured before production (`SECURITY.md` §Rate limiting).
- **Rejected — Clerk / Supabase Auth:** Clerk (reasonable product, per-MAU economics + identity lock-in, US-only data residency); Supabase Auth (only justified if we also adopt Supabase Postgres — we do not).

## 7. QR generation — server-side renderer, opaque token payload

- **Classification: SELECTED (generation) — PLANNED (integration)**
- **Selected approach:** the QR image encodes **only** an opaque check-in token URL/string (`MAJ-<opaque>`); generation uses a small, dependency-light QR renderer (e.g. `qrcode` / `@nuintun/qrcode` class) at render time on the server. No PII in the payload (ADR-0006).
- **Rejected:** encoding a JWT with participant claims (leaks PII on screenshot, larger QR, revocable only by rotation); encoding the raw database id (guessable/IDOR bait).

## 8. QR scanning (browser) — layered strategy

- **Classification: SELECTED (layered)** — see ADR-0026
- **L1: `BarcodeDetector` (W3C Shape Detection API)** where available (Chromium/Edge; Safari 17+; **not Firefox**). Zero bundle cost, fastest.
- **L2: `zxing-wasm`** as the universal fallback (≈2 MB WASM, works in Firefox/Safari, supports `rawBytes` and is maintained as part of the ZXing project). Load lazily only when L1 is missing/fails.
- **Rejected:** `html5-qrcode` (embedded ZXing-JS, larger and slower, bundles its own UI we would re-style for accessibility); `jsQR` (dormant, QR-only, no camera handling); commercial SDKs (Scandit/Dynamsoft — cost and vendor lock-in are not justified for a flat, printed/taped QR at a mosque entrance).
- **Hard constraint:** camera requires a secure context. Production must be HTTPS; LAN-only HTTP deployments are explicitly unsupported (`CHECKIN.md`).

## 9. Browser audio capture — MediaRecorder + Web Audio API + AudioWorklet

- **Classification: SELECTED (capture) — PLANNED (implementation, VS-7)**
- **Why MediaRecorder:** universally available since 2021; `start(timeslice)` emits `dataavailable` chunks suitable for incremental upload; Opus-in-WebM is now supported across Chrome, Firefox **and Safari 18.4+**, so one container/codec choice can be made for all three.
- **Why Web Audio `AnalyserNode` for metering:** needed for input-level and recording-health UI (`AUDIO.md` §Health).
- **Why AudioWorklet is *evaluated but not selected* as the primary path:** raw Float32 capture is the only way to guarantee gapless, seekable, container-free audio and to survive encoder stalls, but it forces us to implement our own Opus encoder (WASM) or upload PCM (≈115 MB/hour at 16 kHz mono 16-bit) — significant client complexity in Phase 1. ADR-0008 records this with a **revisit trigger** (if MediaRecorder chunk-gap telemetry exceeds the SLO in `PERFORMANCE.md`).
- **Known limitation recorded:** MediaRecorder output cannot be seekable (no SeekHead/Cues) because data is produced progressively — playback seeking for a 2-hour recording must be handled by **server-side remux into a seekable container** during processing, which is exactly what `AUDIO.md` specifies.
- **Explicitly rejected in Phase 1:** recording audio in the *server* from a browser WebSocket stream (brittle, unbounded server session state, worse failure modes than chunked upload).

## 10. Audio processing — ffmpeg (containerised) + loudness/level analysis

- **Classification: SELECTED (processing tool) — PLANNED (VS-8)**
- **Why:** `ffmpeg` is the only credible, proven tool for protocol/format normalisation, remuxing Opus/WebM into a seekable container, loudnorm-based level normalisation, and deriving a 16 kHz mono transcription derivative.
- **Deployment note:** run ffmpeg as a **separate worker process/container image** from the Next.js app (large binary, CPU-bound) — see ADR-0020. Pin the ffmpeg version in the image; never `latest`.
- **Rejected:** `lame`/`sox` (narrower), browser-side transcoding via WebCodecs (encoder availability is inconsistent; moves CPU cost onto a volunteer's phone), cloud media-transcode services (cost + upload egress + data residency for voice recordings).

## 11. Object storage — S3-compatible API, provider-agnostic

- **Classification: SELECTED (interface) — PLANNED (deployment)**
- **Interface:** AWS S3 API via `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`. Buckets private; browsers upload/download through short-lived presigned URLs.
- **Self-hosted dev/small deployments:** MinIO (single binary, high S3 fidelity; AGPL-3.0 — commercial licence required if we ever offer storage *as a service*, which we do not).
- **Managed production:** Cloudflare R2 or Backblaze B2 (predictable pricing, no/free egress — important because a 2-hour Opus recording is streamed repeatedly).
- **Recorded gaps:** R2 does not support object tagging, object lock or S3 event notifications; versioning support varies by provider. Therefore the application must **not** depend on provider-side tagging/versioning; lifecycle is managed by our own `audio_assets`/retention tables (`RETENTION.md`).
- **Rejected:** local filesystem storage as the primary store (no resumable multipart, no lifecycle, backup story degrades to "do not lose this VM").

## 12. Speech-to-text — provider-port with self-hosted default

- **Classification:** port SELECTED; provider PLANNED (VS-9); hosted vendor OPTIONAL
- **Port design:** `TranscriptionProvider` interface (submit job → poll/webhook → receive segments). No vendor SDK types leak into the domain (ADR-0011).
- **Baseline (self-hosted, default for cost/sovereignty):** Whisper `large-v3` / `large-v3-turbo` served by `faster-whisper` on a GPU worker, or on CPU for low volume. Whisper stays the strongest *open* multilingual option (99+ languages) and is MIT-licensed.
- **Cheap hosted option:** Groq-hosted Whisper Large v3 Turbo (~$0.04/hr in 2026) — considered for cost, but **not** a code-switching solution (no code-switch handling documented).
- **Accuracy reality check (recorded because this product publishes religious content):** published 2026 WER figures range ~5% (best hosted English) to ~15% for Whisper large-v3 on hard real-world audio, and every provider degrades on **code-switching, proper nouns and domain vocabulary**. Indonesian + Arabic Qur'anic recitation with Islamic terminology is precisely the difficult case. **Conclusion: transcription is a *drafting aid*, never an authority** (ADR-0012, `docs/product/CONTENT-INTEGRITY.md`).
- **Rejected as MVP default:** OpenAI `gpt-4o-transcribe` / Deepgram Nova-3 / AssemblyAI Universal-3 as the *only* path (per-minute cost at 2h/event scale, voice data leaving our boundary, and no code-switching guarantee). They remain OPTIONAL hosted adapters behind the same port.

## 13. Background processing — pg-boss (Postgres-backed queue)

- **Classification: SELECTED — PLANNED (installed at VS-7/VS-9)**
- **Why:** jobs live in Postgres with ACID semantics; **transactional enqueue** (write the audio asset row and enqueue processing in one transaction — no lost-job window); `SKIP LOCKED` concurrency; dead-letter queue; cron/`sendOnce` deduplication; zero new infrastructure for a volunteer-run org.
- **Throughput reality:** roughly 1–5K jobs/sec, bounded by Postgres writes — orders of magnitude above "a few hundred kajian events per month".
- **Rejected — BullMQ/Redis:** richer features (flows, rate limiting, Bull Board UI) but requires Redis. **We do not need Redis in MVP** (see `docs/architecture/FINAL-REVIEW.md`): no cache tier is required (Postgres buffers, Next.js route caching, low traffic), session state lives in the database, and rate limiting can be Postgres-backed at our volume. BullMQ remains the documented upgrade path **only if** job volume or rate-limit needs measurably exceed pg-boss (ADR-0010).
- **Rejected:** Inngest/QStash/cloud schedulers (first-class operations but third-party dependency for a self-hostable product); Kafka (no).

## 14. Search — PostgreSQL `tsvector` + `pg_trgm`

- **Classification: SELECTED (PLANNED at VS-10)**
- **Why:** transcript and event search over a few million rows; Indonesian (`indonesian` text search config exists in Postgres) plus trigram similarity for names and Arabic transliteration variants ("Ustadz", "Ustad", "Ustadh").
- **Rejected:** Elasticsearch/Meilisearch/Typesense (another stateful service to run and back up; no need at this volume); vector search (OPTIONAL, only if a reviewer-assist feature is ever justified).

## 15. Observability — OpenTelemetry (traces + metrics) + OTLP

- **Classification: SELECTED (interface) — PLANNED (VS-14)**
- **Status in JS SDK:** traces **stable**, metrics **stable**, logs **development** (experimental packages). OpenTelemetry graduated as a CNCF project in May 2026.
- **Decision:** instrument against `@opentelemetry/api` (vendor-neutral), export traces+metrics over OTLP to a collector. **Do not** adopt the experimental JS logs SDK as the source of truth: emit structured JSON logs to stdout (12-factor) and let the collector/shipper handle them. This avoids betting on a signal that may break between minor versions.
- **Hard rule:** no audio bytes, no transcript text, no participant PII in spans/metrics/log attributes. Attribute allow-list is in `OBSERVABILITY.md`.
- **Rejected:** vendor-specific APM SDKs as the primary instrumentation (lock-in; contradicts self-hosting), and "logs only" (we cannot debug check-in latency or upload stalls without spans).

## 16. Testing — Vitest 4 + Playwright + Testing Library

- **Classification: SELECTED (Vitest, Playwright) — PLANNED (Vitest browser mode coverage)**
- **Vitest 4:** stable; Jest-compatible API; native TS/ESM; browser mode **stable** since v4 with `@vitest/browser-playwright`; visual assertions via `toMatchScreenshot`.
- **Playwright:** the browser layer for the two workflows that dominate risk — **QR check-in at a busy entrance** and **a 2-hour recording session** (needs real MediaRecorder, real device permissions, fake devices via Chromium flags, and trace/video evidence on failure).
- **Layers:** jsdom-ish/Node unit tests → Postgres-backed integration tests → real-browser component tests → a thin Playwright E2E set over the money paths. See `TESTING.md`.
- **Rejected:** Jest (slower cold start, worse ESM/TS story, no unified browser mode); Cypress (Playwright overtook it; worse parallelism and mobile-emulation story).
- **Phase 0 note (historical):** only `describe.todo()` skeletons existed and no test runner was
  installed. Vitest 4 is installed as of VS-1 (see §Installation record).
- **Integration database in environments without a container runtime — PGlite (dev-only).**
  `@electric-sql/pglite` 0.5.8 embeds a real PostgreSQL 18 (WASM) in the test process. Classification:
  **SELECTED as a development/CI convenience, never a runtime dependency.** It is used by
  `tests/support/db.ts` when `INTEGRATION_DATABASE_URL` is not set; when that variable is set the same
  suite runs against a real PostgreSQL server (the service container in `ops/docker-compose.test.yml`,
  owned by `T-TEST-001`). It is *not* a mock: constraints, row-level security, transactions and
  `current_setting()` behave identically, which is what makes the `T-SEC-001` isolation proof valid
  (`TESTING.md` §1.3 forbids mocking the database for constraint behaviour). It never ships to
  production and never appears in `dependencies`.

## 17. Containerisation & CI/CD

- **Classification: SELECTED (Docker/Compose + GitHub Actions) — PLANNED (CD to production)**
- **Containerisation:** multi-stage Dockerfile, Next.js `standalone` output, distroless/alpine-slim Node 24 base, non-root user, read-only root filesystem where possible, separate image for the media/ffmpeg worker.
- **Local dev:** `docker compose` for Postgres + MinIO + OTLP collector only (the app runs on the host for fast HMR). Compose is a **developer convenience**, not a production topology.
- **CI (GitHub Actions):** typecheck → lint → unit → integration (Postgres service container) → build → Playwright smoke (chromium) → container image → SBOM/`npm audit --omit=dev` gate. Advisories in this ecosystem arrive monthly (Next.js patched criticals twice in 2026); a **monthly dependency review is a scheduled operational task**, not an ad-hoc cleanup.
- **Rejected:** Kubernetes for v1 (a volunteer-run org cannot operate it; a single beefy VM + managed Postgres is the correct target); serverless-only hosting (long-running recorder/worker flows and large uploads fit containers better); Vercel as a hard requirement (Build Adapters + standalone output keep hosting portable — but Vercel is an acceptable OPTIONAL target for the web tier only).

## 18. Explicitly out of scope for the stack

| Capability | Classification | Reason |
|---|---|---|
| Kafka / NATS / RabbitMQ | REJECTED | Events are domain facts persisted in Postgres (outbox); no cross-service streaming need |
| Redis | REJECTED for MVP | See §13; documented trigger for re-evaluation |
| Microservices / service mesh | REJECTED | One team, one deployable, one database (ADR-0002) |
| Mobile native apps | REJECTED | PWA-first; the mosque entrance is a browser use case (ADR-0027) |
| WhatsApp/SMS/Telegram delivery | OPTIONAL (post-MVP) | Channel adapter port exists; no third-party messaging dependency in MVP (`NOTIFICATIONS.md`) |
| Payment/donation | REJECTED (out of product scope) | Not part of the kajian lifecycle; would expand PCI/regulatory surface |
| Vector database / RAG assistant | OPTIONAL | Only if transcript search proves insufficient; never as an authority on religious content |
| Kubernetes, Terraform, service mesh, Kafka UI | REJECTED | Operational cost exceeds the entire product benefit |

## 19. Version pinning policy

1. Runtime and framework lines are pinned to a **major.minor** with an exact lockfile.
2. New *major* upgrades require an ADR amendment + a vertical-slice-scoped migration task in `TASKS.md`.
3. Security patches (same major) are applied continuously; `OPERATIONS.md` §Patching defines the SLA by severity.
4. No `latest` tags anywhere — Docker images, CI actions and ffmpeg are pinned by digest/version.
5. A dependency may only be added if it removes more code than it adds, or removes an operational risk we cannot otherwise cover.

## 20. Installation record (VS-1, 2026-09-27)

The Phase 0 freeze was lifted and the SELECTED toolchain was installed, exactly as §Classification
legend prescribes ("Installation happens when VS-1 starts"). Pinned versions (`package.json`,
`--save-exact`), all inside the version lines this document selects:

| Package | Version | Classification basis |
|---|---|---|
| `next` | 16.3.6 | §1 SELECTED (16.3.x line) |
| `react`, `react-dom` | 19.3.0 | §2 SELECTED (React 19.x; the 19.2 line advanced to 19.3 — same major, §19.3) |
| `zod` | 4.6.5 | validation schemas (`src/shared/validation/**`) |
| `drizzle-orm` | 0.45.3 | §5 SELECTED (0.4x line) |
| `drizzle-kit` | 0.31.11 | §5 SELECTED (migrations as reviewed SQL) |
| `pg` | 8.23.0 | §5 SELECTED (`pg` driver) |
| `better-auth` | 1.6.33 | §6 SELECTED (1.6.x line), ADR-0005 |
| `typescript` | 5.9.3 | §2 SELECTED (5.9+, strict) |
| `eslint` + `typescript-eslint` | 9.39.5 / 8.70.1 | §16, `T-ARCH-002/003` (flat config) |
| `vitest` | 4.1.11 | §16 SELECTED (Vitest 4) |
| `@playwright/test` | 1.63.0 | §16 SELECTED (browser download skipped here; `T-TEST-001`) |
| `@electric-sql/pglite` | 0.5.8 | §16 dev-only integration harness (above) |
| `@better-auth/memory-adapter` | 1.6.33 | dev-only: identity store for the `T-ORG-001` round-trip test (below) |
| `@types/node`, `@types/react`, `@types/react-dom`, `@types/pg` | 24.19.0 / 19.3.0 / 19.3.0 / 8.23.1 | types for the above |

Not installed, deliberately: any provider SDK, Redis/BullMQ, Elasticsearch, vector stores, Kubernetes
tooling — all REJECTED or PLANNED for a later slice (§13, §14, §18).

**Dev-only addition, 2026-09-27: `@better-auth/memory-adapter` 1.6.33** (a `devDependency`, never in
`dependencies`). Classification: **test double for the identity store only.**
`tests/integration/identity/auth-round-trip.test.ts` proves the sign-up → cookie → `getSession()` round
trip through the production `createAuth` configuration, but injects this adapter instead of the `pg`
pool. Reason, recorded because it constrains `T-ORG-001`: `@better-auth/drizzle-adapter` (a transitive
dependency of `better-auth`, deliberately *not* installed) resolves Better Auth's mapped field names
against Drizzle table **properties**, while the production `pg` pool adapter needs the real snake_case
**column** names; with the mappings the pool requires, the Drizzle adapter emits `DEFAULT` for `users.id`
and the insert fails the not-null constraint. Running the identity store on PostgreSQL through Drizzle is
a recorded follow-up for `T-ORG-001`; production remains `database: getPool()`, and session/user rows in
PostgreSQL are covered by `tests/integration/security/session-revocation.test.ts` and `session-scope.test.ts`.

Runtime note for this environment: the sandbox default is Node 22 (Maintenance LTS) while `engines` and
§3 target Node 24 Active LTS. As of 2026-09-27 the whole verification set — `tsc --noEmit`, `eslint`,
`vitest run`, `ops/docs-lint.mjs` and `next build` — was executed on **Node.js v24.21.0** (installed from
the npm `node@24.21.0` package, because direct downloads from `nodejs.org` are blocked by this
environment's network egress) with npm 11.20.0. Node 22 also passes everything except that `engines`
warns; the deployment target is Node 24 (ADR-0020).

## 21. Sources consulted (validation trail)

Official and primary sources (accessed 2026-09-26):

- Next.js releases/changelog and Node.js releases page (`nodejs.org/en/about/previous-releases`) — LTS vs Current, Node 24 Active LTS / Node 26 Current.
- PostgreSQL versioning policy and release notes (`postgresql.org/docs/18/release.html`) — 18.6, support to Nov 2030; 14 EOL Nov 2026.
- OpenTelemetry language status page (`opentelemetry.io/docs/languages/`) — JS traces/metrics stable, logs development; CNCF graduation May 2026.
- MediaRecorder / Web Audio MDN references and cross-browser recording notes (Safari 18.4 Opus-in-WebM support; progressive output is not seekable).
- W3C Shape Detection API / `BarcodeDetector` support notes (Chromium/Edge; Safari 17+; Firefox absent).
- vendor docs: Better Auth (v1.6, org/rate-limit plugins), Drizzle vs Prisma 2026 comparisons, pg-boss vs BullMQ (SKIP LOCKED, throughput/ACID trade-offs), MinIO/R2/B2 S3-compatibility gaps (tagging/versioning/notifications), STT providers' 2026 published pricing and WER ranges.
- Indonesian **UU PDP** (Law 27/2022; penalties up to 2% of annual revenue; breach notification within 72 hours; PDP Agency targeted for 2026) — drives `PRIVACY.md` and `RETENTION.md`.

> A secondary-source-only claim in this document is a signal, not proof. Any claim that
> changes a decision must be re-verified against official documentation at the time the
> decision is implemented (see `AGENTS.md` §Research).
