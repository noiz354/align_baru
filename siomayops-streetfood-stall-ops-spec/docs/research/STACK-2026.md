# STACK-2026 — Technology Validation for SiomayOps

**Document ID:** DOC-RESEARCH-STACK-2026
**Status:** VALIDATED (research complete, selection frozen for Phase 0)
**Research window:** 2026-09
**Owner:** Principal Architect
**Related ADRs:** ADR-0002 … ADR-0024

---

## 0. Purpose and method

SiomayOps must be operable by **one small team** while serving a distributed street-food
stall network in Jakarta (and later other Indonesian cities) with:

- operators on **low-end Android phones**
- **unreliable mobile data** (3G/4G spots, dead zones under flyovers, market congestion)
- HQ staff on laptops
- ordinary commodity hardware, **no dedicated SRE department**

This document validates, for each required capability area, which technology is
**STABLE / MAINTAINED / PRODUCTION-PROVEN / SECURE / OPERATIONALLY SIMPLE** in 2026,
and records explicit **REJECTED** options with reasons so the decisions are reviewable later.

### Classification legend

| Class | Meaning |
| --- | --- |
| **SELECTED** | Chosen. Appears in dependency manifests and the architecture. |
| **PLANNED** | Chosen for a later vertical slice, not installed in Phase 0. |
| **OPTIONAL** | Permitted but not required; must be justified per deployment before adoption. |
| **REJECTED** | Evaluated and deliberately not adopted (with rationale). Skeleton code must not import it. |

### Evaluation criteria (in priority order)

1. Operational simplicity (fewest moving parts, one database, one deploy unit if possible)
2. Production track record + release cadence + security response
3. Fit for low-bandwidth, interrupted-network mobile use
4. Type safety / contract safety across client and server
5. Exit cost if the vendor disappears
6. Cost predictability at 10 → 2,000 stalls
7. Ecosystem maturity for hiring and long-term maintenance

> Note on "newest is not best": every selection below prefers the **oldest technology that
> still solves the problem with acceptable risk**. Where a newer tool was materially simpler,
> it is recorded as such explicitly.

---

## 1. Capability matrix (summary)

| # | Capability | Selection | Class | Primary alternative rejected |
| --- | --- | --- | --- | --- |
| 1 | Language | TypeScript 5.x (strict) | SELECTED | plain JS, ReScript |
| 2 | Web application framework | Next.js 16.x (App Router) + React 19.2 | SELECTED | Remix/React Router 7, SvelteKit, Astro |
| 3 | PWA / offline shell | Serwist (`@serwist/next`) service worker | PLANNED (VS-16) | next-pwa, hand-rolled Workbox, raw ServiceWorker API |
| 4 | Database | PostgreSQL 18.x | SELECTED | MySQL/MariaDB, MongoDB, SQLite-only |
| 5 | Data access | Drizzle ORM + node-postgres (`pg`) | SELECTED | Prisma 7, Kysely, TypeORM, raw SQL |
| 6 | Schema migration tooling | drizzle-kit generated SQL (reviewed by human) | SELECTED | auto `db push`, Prisma Migrate |
| 7 | Authentication | Better Auth (email+password, later passkeys) | PLANNED (VS-17) | Auth.js/NextAuth (maintenance-only), Clerk, Supabase Auth |
| 8 | Authorization | In-app RBAC + scope checks (no external engine) | SELECTED | Casbin, OPA/Rego, Cerbos |
| 9 | Geolocation | Manual selling-point report + optional tap-triggered one-shot sample under ADR-0039 | Page 10 implementation; one fix per explicit report, 14-day raw-sample limit | continuous/background GPS, `watchPosition` |
| 10 | Maps | MapLibre GL JS + raster/vector tiles from a paid provider | OPTIONAL | Mapbox GL JS, Google Maps, Leaflet |
| 11 | Payments (digital) | Provider-port only; **no gateway in Phase 0** | PLANNED (VS-6/17) | direct gateway integration now |
| 12 | QRIS | Merchant-presented **static QRIS** recorded as a payment *method*, dynamic QR via provider later | PLANNED | fake "payment complete" simulation |
| 13 | Object storage | S3-compatible API (`@aws-sdk/client-s3`) against R2/MinIO/S3 | PLANNED (VS-7) | GridFS, local disk on app container |
| 14 | Background jobs | pg-boss (Postgres-backed) | PLANNED (VS-10) | Redis + BullMQ, Temporal, Inngest |
| 15 | Realtime | SSE for HQ live views + polling fallback | OPTIONAL (VS-12) | WebSocket/Socket.IO, Kafka |
| 16 | Notifications | In-app inbox (SELECTED), Web Push (PLANNED), WhatsApp Cloud API (OPTIONAL) | mixed | SMS gateway, native push |
| 17 | Observability | OpenTelemetry SDK + Collector → Grafana stack (Prometheus/Tempo/Loki) | SELECTED | vendor agents, Datadog-as-a-start |
| 18 | Testing | Vitest 4 (+ Browser Mode) and Playwright | SELECTED | Jest, Cypress, WebdriverIO |
| 19 | Containers | Docker + Docker Compose; single-node orchestration | SELECTED | Kubernetes, Nomad, serverless-only |
| 20 | CI/CD | GitHub Actions | SELECTED | Jenkins, GitLab CI, Buildkite |
| 21 | Runtime | Node.js 24 LTS | SELECTED | Bun, Deno, Go/Rust rewrite |
| 22 | Validation | Zod 4 | SELECTED | Valibot, io-ts, Yup, ajv |
| 23 | Styling / UI | Tailwind CSS 4 + headless primitives (Radix-style) | SELECTED | MUI, Chakra, Bootstrap, custom CSS-in-JS |
| 24 | Client data layer | TanStack Query (server state) + React state for local queue | PLANNED (VS-3) | Redux Toolkit, SWR, Zustand-everything |
| 25 | IDs | UUID v7 (time-ordered) + human-readable business codes | SELECTED | serial integers, cuid2, ULID |
| 26 | Money | Integer minor units (IDR = no decimals) + `Money` value object | SELECTED | float, `decimal.js`, string math |
| 27 | Time | `TIMESTAMPTZ` in UTC + business-day computed in Asia/Jakarta | SELECTED | naive local timestamps |
| 28 | Error/crash reporting | OpenTelemetry error events + structured logs (no third-party SDK required) | SELECTED | Sentry (OPTIONAL) |

---

## 2. Detailed evaluations

### 2.1 Web application framework — **SELECTED: Next.js 16.x (App Router)**

| Candidate | 2026 state | Verdict |
| --- | --- | --- |
| **Next.js 16.x** | Current stable line since Oct 2025 (16.0); 16.2/16.3 shipped Mar–Jun 2026 with Turbopack as default bundler for dev **and** build, React 19.2, `proxy.ts` replacing `middleware.ts`, `next lint` removed in favour of direct ESLint 9. | **SELECTED** |
| Remix → React Router 7 | Stable, excellent progressive-enhancement story, smaller ecosystem of deployment docs for our target hosts. | REJECTED (agent familiarity, form/action ecosystem) |
| SvelteKit | Mature, smaller bundle; hiring pool for TypeScript-first fintech/ops devs in Indonesia is smaller. | REJECTED |
| Astro | Excellent for content; poor fit for authenticated, interactive operator app. | REJECTED |

Why Next.js App Router despite the added caching complexity that the community still
reports in 2026:

- **One deployable** — UI + route handlers + background entry points in one artifact.
  This is the dominant factor for a small team. No separate API service to deploy, version,
  secure, or monitor.
- **Server rendering + Server Actions** reduce the amount of bespoke API surface we must
  write for HQ screens, while the **operator PWA still uses explicit JSON route handlers**
  (see ADR-0013, ADR-0014) so the mobile client does not depend on Server Action semantics
  during offline replay.
- Stable, well-documented **PWA guidance** from the framework itself (manifest +
  service-worker integration points + offline fallback patterns).

Configuration guardrails we accept as consequences:

- Turbopack is default; the service-worker build step must be documented and tested
  (VS-16) — this is a known friction area.
- **Cache Components / Partial Prefetching: NOT enabled in Phase 0** (opt-in, still being
  shaken out). We adopt explicit, boring caching (`no-store` by default for operational
  data), then revisit.
- `middleware.ts` → `proxy.ts`: we use **no** request-rewriting middleware except a
  minimal security-header/tenant-resolution proxy handler.

**Risk:** framework churn between minor versions. **Mitigation:** pin exact versions,
upgrade on a monthly cadence with the full Playwright suite as the regression gate.

### 2.2 PWA / offline shell — **PLANNED: Serwist**

| Candidate | State 2026 | Verdict |
| --- | --- | --- |
| **Serwist** (`@serwist/next`) | Actively maintained Workbox successor; the pattern recommended by Next.js docs for service-worker offline caching; supports Turbopack with an extra build step. | **PLANNED (VS-16)** |
| `next-pwa` | Unmaintained; peer-dependency churn. | REJECTED |
| Raw Workbox + custom build script | Workable, more glue code to own. | OPTIONAL fallback |
| Hand-written ServiceWorker without libraries | Most control, most risk of subtle cache bugs. | OPTIONAL for a minimal scope only |

**Scope constraint:** the service worker exists to (a) serve an app shell offline,
(b) provide an **offline page**, and (c) *not* be the source of truth for anything
financial. Outbound mutations use our own **outbox queue in IndexedDB** with client-generated
IDs and server-side idempotency, not Background Sync as a reliability guarantee
(Background Sync support across the Android browsers we expect is inconsistent).
See `OFFLINE.md`.

**Battery/data constraint:** no background sync loops, no periodic sync, no wake locks.

### 2.3 Database — **SELECTED: PostgreSQL 18.x**

PostgreSQL 18 has been stable since Sept 2025 (18.6 by Aug 2026), supported to ~2030,
with page checksums on by default in new clusters and the new asynchronous I/O subsystem.

Why Postgres is non-negotiable here:

- The domain is **relational and auditable** (shifts → sales → payments → expenses → stock
  movements → settlements). Constraints, foreign keys and transactions are not optional
  for cash accountability.
- It gives us a **job queue** (pg-boss), **full-text search** for menu/location lookups,
  `jsonb` for raw webhook payloads, and row-level security if we ever need it — all in one
  service. Every component we *don't* run is a component our one small team doesn't operate.
- Mature managed offerings in-region make operational simplicity achievable without a DBA.

| Rejected | Reason |
| --- | --- |
| MongoDB | Weak multi-row transactional story for money; schema flexibility is a liability for auditable ledgers. |
| MySQL/MariaDB | Viable, but jsonb, partial indexes, `SKIP LOCKED`, and extensibility favour Postgres. |
| SQLite-only (per-stall local) | Attractive edge story, but HQ visibility and audit require central authority. Local SQLite inside the PWA is a *cache*, not a system of record. |
| Distributed/NewSQL (Cockroach, TiDB) | Operational cost far exceeds need at our scale. |

**Scale honesty check:** 2,000 stalls × ~30 sales/day ≈ 60k sales/day ≈ 1.5k inserts/min at
peak regional concentration — comfortably inside single-primary Postgres.

### 2.4 Data access — **SELECTED: Drizzle ORM 1.x on `pg`**

| Candidate | 2026 state | Verdict |
| --- | --- | --- |
| **Drizzle ORM** | v1 stable; SQL-shaped TypeScript schema, no codegen step, ~7–50 kB runtime, first-class Postgres types (arrays, jsonb, custom types), readable generated SQL, `drizzle-kit` emits plain SQL migration files. | **SELECTED** |
| Prisma 7 | Rust-free client since v7, much smaller, excellent Studio; still a DSL + generate step and a heavier abstraction over SQL. Fine choice, not our choice. | REJECTED for greenfield (kept as documented alternative) |
| Kysely | Great type-safe query builder, fewer batteries (no schema/migration workflow of its own). | OPTIONAL |
| TypeORM | Effectively legacy in the TS ecosystem by 2026. | REJECTED |
| Hand-written SQL strings everywhere | No type safety at the boundary where money lives. | REJECTED |

Decision drivers: we want **SQL we can read in a code review** for pricing resolution,
settlement reconciliation and stock movements, and we want **no codegen in CI**.
Drizzle's lack of N+1 protection is accepted and addressed by repository-port discipline
plus explicit integration tests.

**Migration policy:** `drizzle-kit generate` produces SQL; a human reviews every migration;
migrations are applied by an explicit, single-instance deploy step (not by app boot).
No `drizzle-kit push` against any shared environment, ever (see `OPERATIONS.md`).

### 2.5 Authentication — **PLANNED: Better Auth**

| Candidate | 2026 state | Verdict |
| --- | --- | --- |
| **Better Auth** | Actively developed (v1.6 line, 2026); typed sessions; email OTP + password + passkeys + 2FA plugins; users live in **our** Postgres; official migration path from Auth.js. | **PLANNED (VS-17)** |
| Auth.js / NextAuth | Since Sept 2025 maintained by the Better Auth team in **security-patch-only** mode. Safe to run, not where new capability lands. | REJECTED for greenfield |
| Clerk | Excellent DX, hosted user store, per-MAU pricing; conflicts with data-residency preference and adds a hard dependency for a cash business with thin margins. | REJECTED |
| Supabase Auth | Good if we were on Supabase; we are not. | REJECTED |
| Keycloak | Powerful, heavyweight for 8 roles and ~a few thousand users. | REJECTED |
| Roll-your-own JWT/session | Highest risk of subtle authz bugs — and this system holds cash data. | REJECTED |

**Phase-0 stance:** no real authentication is implemented. The `AuthPort` + `SessionContext`
interfaces are fixed so that a fake in-memory session provider can be swapped for the real
one without touching feature code. **Phone-number + OTP** is the planned primary credential
for operators (they reliably have phones and phone numbers; they do not reliably remember
passwords) with passkey/second-factor for HQ finance roles.

### 2.6 Authorization — **SELECTED: in-app RBAC + scope resolution**

Roles — canonical codes in `docs/security/PERMISSIONS.md` §2: `OWNER`, `HQ_OPS`, `HQ_FINANCE`,
`MENU_PRICING_ADMIN`, `AREA_SUPERVISOR`, `OPERATOR`, `STOCK_WAREHOUSE_OPERATOR`, `AUDITOR`,
`PLATFORM_ADMIN`.

> **Role mapping.** Nine role codes are canonical and machine-checked. Job titles used elsewhere in
> this document (e.g. "HQ Owner", "Stall Operator", "Stock/Warehouse Operator") are organisational
> vocabulary mapped onto those codes; the customer is **not** a role — customers have no account and
> only an optional consented loyalty record exists (`FR-CUST-001`). A job title without its own code
> is a *scope* or a *persona*, never a new role.

Evaluated and rejected: Casbin (extra config language), OPA/Rego (a whole policy engine and
sidecar for 9 roles), Cerbos (fine, but a service we would have to operate).
**Decision:** a single `authorize(action, subject, scope)` function in `src/server/auth`,
a permission matrix table, and integration tests per role per route. Boring, auditable,
unit-testable. Revisit only if roles exceed ~25 or tenants require custom policies.

### 2.7 Geolocation and maps

- **REJECTED as a product default: continuous/background geolocation tracking.**
  It is a privacy hazard for workers, drains battery on low-end phones, and is unnecessary
  for the product's question — *where is the stall selling right now?* See ADR-0007 and
  `PRIVACY.md`.
- **PLANNED:** explicit operator check-in/update ("I am selling at <selling point>"), with a
  **one-shot** "use my current position to confirm this pin" button as a convenience only,
  always producing an explicit, timestamped, operator-attributable `LocationReport`.
- **Maps:** **OPTIONAL — MapLibre GL JS** (BSD-3, community-governed, works with any vector
  tiles) with a paid tile provider; **Leaflet** acceptable as a lighter option for a
  marker-only HQ map (42 kB gzip, no WebGL requirement — important for cheap office
  laptops). **REJECTED: Mapbox GL JS and Google Maps** for the operator surface (vendor
  token, usage-based billing, heavier runtime, licensing terms we don't want in the
  critical path).
- **Hard rule:** the map is a *rendering* concern in HQ screens. The operator app must never
  require a map, WebGL, or tiles to start a shift and record a sale.

### 2.8 Payments and QRIS — **PLANNED: provider port, no gateway in Phase 0**

Validated 2026 facts that shape the design:

- QRIS is governed by Bank Indonesia and ASPI; a merchant accepts it **through a licensed
  provider/PJSP**, not by integrating with BI directly. Settlement lands in the merchant's
  bank account; the QR itself is interoperable across wallets and bank apps.
- Dynamic QR (per-transaction amount) is generated by the **provider's API**; static QR
  (merchant-presented, amount entered by the customer) requires **no per-transaction API
  call** and no callback — the operator confirms receipt manually.
- Provider APIs expose: create/query/refund QRIS, decode QR content, and (Snap-style)
  signed requests; callbacks are **signed requests** that must be verified and de-duplicated.
- Provider callback payloads carry a partner/merchant reference and the transaction amount
  in minor-unit-with-decimals string form (`"10000.00"`), currency `IDR`.

Design consequences (encoded in `PAYMENTS.md`, ADR-0011, ADR-0012):

| Decision | Rationale |
| --- | --- |
| `PaymentProvider` port with `createPayment`, `getStatus`, `verifyCallback`, `refund` | Gateway-agnostic; lets us start with zero gateway and add one provider later. |
| Cash is a first-class method with its own fast-entry flow | Reality of street selling; cannot be an afterthought. |
| MVP digital flow = **static QRIS + operator-recorded payment** marked `PENDING_VERIFICATION` | Works with zero API integration on day one, honest about verification state. No fake success. |
| Dynamic QRIS + signed callbacks = later slice, behind the same port | Requires merchant onboarding (KYC), provider credentials, and reconciliation design first. |
| Never trust client-side "success" | Only a verified provider callback or an explicit human confirmation moves money states. |
| Idempotency keys + provider reference uniqueness constraints | Duplicate callbacks and duplicate device retries are expected, not exceptional. |

**REJECTED:** simulating payments, "optimistic" digital success while offline, storing raw
card data (out of scope — no cards), any wallet/VA integration in Phase 0.

### 2.9 Object storage — **PLANNED: S3-compatible**

Evidence, receipts, incident photos, and exported reports need object storage.

- **SELECTED interface:** the **S3 API** (`@aws-sdk/client-s3`), which lets us use
  Cloudflare R2 (zero egress fees, S3-compatible core API), MinIO (self-hosted, AGPL —
  licence care needed if offered as a service), Backblaze B2, or AWS S3 without code change.
- **Access pattern:** clients upload via **pre-signed PUT URLs** with content-type/length
  limits and a random object key; downloads via short-lived pre-signed GET URLs. Object keys
  are never user-guessable (IDOR defence).
- **REJECTED:** storing photos in Postgres (bytea/GridFS) — bloats the database that must
  stay fast and cheap to back up; local disk on the app container — lost on redeploy.

### 2.10 Background jobs — **PLANNED: pg-boss**

| Candidate | 2026 state | Verdict |
| --- | --- | --- |
| **pg-boss** | Maintained; Postgres-backed queue using `SELECT … FOR UPDATE SKIP LOCKED`; cron, retries with backoff, dead-letter, throttling; adapters for Drizzle/Kysely/Prisma; **transactional enqueue** in the same transaction as the business write. | **PLANNED (VS-10)** |
| BullMQ + Redis | Higher throughput and a nice dashboard, but adds Redis as a second stateful service to run, back up, secure and reason about. | REJECTED (see ADR-0018) |
| Temporal | Excellent durability semantics; a whole server + worker deployment model for a team of one or two. | REJECTED |
| Inngest / hosted workflow | Great DX, external dependency in the critical path of closing shifts. | OPTIONAL |
| Cron in the app process | No visibility, no retries, no dead-letter. | REJECTED |

Job classes we will eventually run: payment callback processing, stale-PENDING payment
sweeps, unclosed-shift alerts, daily closing roll-ups, recognition period computation,
notification dispatch, retention/archival jobs, export generation.

### 2.11 Realtime — **OPTIONAL: SSE**

- Requirement is **server → client** (HQ sees active stalls, new alerts, new incidents).
  Client → server is ordinary HTTP writes. That is textbook SSE.
- SSE is plain HTTP/1.1–HTTP/2, passes proxies/CDNs, auto-reconnects with `Last-Event-ID`
  (gap recovery), needs no upgrade handshake, and is trivially implemented in a Next.js
  route handler returning a `ReadableStream`.
- **REJECTED for Phase 0:** WebSockets/Socket.IO (bidirectional complexity we don't need),
  Kafka/Pulsar/NATS (infrastructure without a consumer that justifies it).
- **Default remains polling** (TanStack Query with a 30–60 s interval on HQ cards) until a
  slice proves SSE is worth it. Mobile operator screens never hold a long-lived stream.

### 2.12 Notifications

| Channel | Class | Notes |
| --- | --- | --- |
| In-app inbox (`Message`, `OperationalAlert`) | **SELECTED** | Works offline (queued read), zero external dependency, fully auditable, no per-message cost. |
| Web Push (VAPID) via service worker | **PLANNED (VS-12)** | Free; requires user permission; unreliable on some Android OEM battery savers — hence never the only channel for money-critical events. |
| WhatsApp Business **Cloud API** | **OPTIONAL** | Meta deprecated On-Premises (Oct 2025); Cloud API only; per-message/template pricing, pre-approved templates, 24 h service window, quality-rating throttling, Business Manager + WABA ownership. Good for HQ↔supervisor and customer receipts *once* volume justifies the cost and the compliance work. |
| SMS gateway | OPTIONAL | Fallback only; per-message cost; SIM-swap risk for OTP. |
| Email | OPTIONAL | No role for operators; useful for HQ report delivery and auditor invites. |
| Firebase Cloud Messaging | OPTIONAL | Only if a native wrapper ever appears. |

**Hard rule:** no money state depends on a notification being delivered.

### 2.13 Observability — **SELECTED: OpenTelemetry + Grafana stack**

- OpenTelemetry reached **CNCF Graduated** maturity (announced 2026-05); traces and metrics
  APIs are stable across major SDKs, **logs** are still maturing (JS logs API marked
  development as of Aug 2026) — so we emit **structured logs (Pino) → OTLP**, not the
  unstable logs API bridge, and treat trace/metric APIs as the stable instrumentation layer.
- Collector (pinned, e.g. `0.158.x` class) → Prometheus + Tempo + Loki + Grafana
  (`grafana/otel-lgtm` image is explicitly a *dev/demo* bundle; production uses separate
  services or a managed backend).
- **REJECTED as day-one:** vendor agents (Datadog/New Relic) — cost and lock-in before we
  know what we need. **OPTIONAL:** Sentry for front-end error grouping once the operator
  PWA is in real hands.
- Alerting philosophy: **operational alerts are domain objects** (`OperationalAlert` rows,
  mutable, actionable, assigned) while **infrastructure alerts** live in Prometheus
  Alertmanager. Do not confuse the two (see `NOTIFICATIONS.md`, `OBSERVABILITY.md`).

### 2.14 Testing — **SELECTED: Vitest 4 + Playwright**

- **Vitest 4**: Browser Mode is **stable** (since 4.0, Oct 2025) with Playwright as a
  provider; visual regression + Playwright trace support. Same API as unit tests.
- **Playwright**: E2E and cross-browser; trace viewer; device emulation is essential because
  the primary user is on a 360–412 px Android viewport.
- **REJECTED:** Jest (slower cold start, no native ESM, no real-browser mode),
  Cypress (heavier, weaker parallel story in 2026), WebdriverIO (no advantage here).
- Test taxonomy for this project (`TESTING.md`): unit (pure domain rules), integration
  (repository + Postgres, real transactions), browser (component + offline behaviour with
  real service worker and IndexedDB), e2e (operator journeys on emulated Android).

### 2.15 Containers and CI/CD — **SELECTED: Docker + GitHub Actions**

- **Docker** multi-stage builds (Next.js standalone output), **Docker Compose** for local
  dev and for a single-VM production topology. `node:24-alpine`-class base images, non-root
  user, read-only rootfs where practical.
- **REJECTED as day-one: Kubernetes.** For 1–2 web replicas, 1 worker, 1 managed Postgres,
  few background workers, K8s buys nothing and costs a cluster to operate. Revisit trigger:
  multi-region rollout or >5 services, which this architecture deliberately avoids.
- **CI/CD:** GitHub Actions — lint, typecheck, unit, integration (service container for
  Postgres), browser, e2e (against a preview deployment), migration dry-run, container
  build/publish, image scanning. Deploy = immutable image + explicit migration job +
  rolling replacement + health check + instant rollback to the previous tag.
- **REJECTED:** Jenkins (self-hosted maintenance), GitLab CI (fine, but the repo lives on
  GitHub), build-on-the-server deploys (no reproducibility, no rollback).

### 2.16 Runtime, IDs, money, time

- **Node.js 24 LTS** (Next.js 16 requires ≥20.9; 24 is the current LTS line and matches the
  container base). **REJECTED:** Bun/Deno as the *deployment* runtime in 2026 (great for
  scripts; the ecosystem risk for a cash-handling production app is not worth the
  ergonomics), Go/Rust rewrites (no measured need).
- **IDs:** UUID v7 in the database (time-ordered, index-friendly, non-enumerable) + separate
  short **business codes** for humans (`STL-JKT-014`, `SHF-20260926-0031`). **REJECTED:**
  auto-increment integers exposed to clients (enumerable → IDOR), client-visible ULIDs
  (fine, but v7 is standardised in Postgres tooling).
- **Money:** integer minor units. **IDR has no circulating minor unit**, so amounts are
  stored as **integer rupiah** in a `bigint`/`numeric(18,0)`; the `Money` value object still
  carries a currency code and a defined rounding policy so multi-currency is *possible*
  without a refactor. **REJECTED:** `number`/float arithmetic (rounding drift), and
  `decimal.js`-style arbitrary precision (unnecessary for a zero-decimal currency).
- **Time:** `TIMESTAMPTZ`, stored UTC, rendered in `Asia/Jakarta`; the **business day** is a
  first-class concept (`businessDay` column derived with an explicit, documented rule) —
  shift closing at 01:30 belongs to the previous business day. **REJECTED:** naive
  `timestamp` columns and "server local time" assumptions.

### 2.17 Schema validation and UI

- **Zod 4** (stable; ~3× faster parsing than v3, smaller tree-shaken bundle, pipe API) at
  every trust boundary: HTTP request bodies, offline queue replay, provider callbacks,
  CSV imports, and env config. One schema → TS type + runtime validation, no drift.
  **REJECTED:** hand-written validators (drift), Valibot (excellent but no compelling
  advantage here), ajv/JSON-Schema-as-primary (we want TS-first inference).
- **Tailwind CSS 4 + headless primitives** for the design system, with an explicitly
  **operator-scale** token set (64 px+ primary tap targets, 18–24 px body text, high
  contrast, numeric keypad layouts). **REJECTED:** MUI (heavy, Material look, hard to make
  "street fast"), Chakra, Bootstrap, CSS-in-JS runtime cost.


---

## 3. Explicit non-selections (recorded so they are not re-litigated silently)

| Not selected | Why it is *not* here | Revisit trigger |
| --- | --- | --- |
| Redis | No cache need proven; job queue is Postgres; sessions are DB/cookie. | p95 read latency degrades from query load, or >5k jobs/s |
| Kafka / event bus | No independent consumers; the audit trail is a database table. | External consumers (accounting, BI) need a feed |
| Microservices | One team, one domain, strong transactional coupling (shift ↔ sale ↔ payment ↔ cash). | Org grows separate teams with separate budgets/on-call |
| GraphQL | Over-fetching is not our problem; adds schema/runtime surface to secure. | Multiple independent clients (native app + web + partner API) |
| Native mobile apps | PWA install, no store review, one codebase, works on the phones operators already own. | Camera/hardware features the web cannot reach at acceptable quality |
| Kubernetes | Operational cost ≫ benefit at our scale. | Multi-region, >5 deployable services |
| Continuous GPS tracking | Privacy harm, battery drain, no product need. | Never for the operator app; possibly for a future delivery fleet with explicit, consented, shift-bounded tracking |
| ML/AI scoring of operators | Explains nothing to the operator, invites bias, undermines trust. | Never for recognition; possibly for *assistance* (anomaly hints) with human review |
| Blockchain | No trust-minimisation problem; a signed append-only table is sufficient. | — |

---

## 4. Version pinning policy (Phase 0)

1. **Exact versions** in `package.json` (no `^`) for the app; lockfile committed.
2. **One upgrade cadence**: dependency refresh monthly, security patches within 72 h,
   framework majors once per year after a Playwright green run on a preview deployment.
3. **No auto-upgrade bots in the critical path** (jobs update, humans merge).
4. **Repeatable images**: pinned base image digests; production never pulls `latest`.
5. **Every new dependency requires**: an ADR amendment or ADR, a maintenance check
   (release in last 12 months, >1 maintainer, security policy), and a licence check
   (no AGPL in the server path without legal review, no source-available licences).

---

## 5. Phase-0 (documentation + skeleton) dependency reality

Nothing in this document is installed. The skeleton in `src/` uses only **TypeScript
types, interfaces and `throw new Error("Not implemented: T-…")` stubs**. Concrete
libraries appear only as: (a) pinned versions in `package.json` for the dev toolchain
(typecheck, lint, test runner), and (b) comments or ports. This keeps the Phase-0
deliverable honest: **no business feature is implemented**, and no library choice can
accidentally become an implementation before its vertical slice and ADR are approved.

---

## 6. References consulted (2026)

- Next.js release/upgrade status and App Router production experience reports (16.x line, Turbopack default, `proxy.ts`, Cache Components opt-in).
- Next.js PWA guide (manifest, offline fallback, Serwist as the documented service-worker option) and Serwist/Turbopack integration write-ups.
- PostgreSQL 18.x lifecycle tables (18.6 current as of Aug 2026; support to ~2030).
- Drizzle vs Prisma 2026 comparisons (footprint, SQL transparency, codegen, Postgres feature access).
- Better Auth vs Auth.js/NextAuth/Clerk/Supabase Auth 2026 posture (Auth.js in security-patch-only maintenance since Sept 2025; Better Auth v1.6 line).
- QRIS ecosystem 2026: Bank Indonesia/ASPI governance, provider-mediated onboarding, dynamic QR create/query/refund/decode APIs, signed callbacks, static vs dynamic QR, merchant/settlement model.
- pg-boss vs BullMQ 2026 (transactional enqueue, `SKIP LOCKED`, ops footprint, throughput ceilings).
- MapLibre GL JS vs Mapbox GL JS vs Leaflet 2026 (licence, renderer cost, tile-source flexibility, mobile performance).
- Vitest 4 Browser Mode stable + Playwright trace/visual regression; Playwright as E2E standard.
- OpenTelemetry CNCF Graduated (2026) and signal-stability matrix (traces/metrics stable, logs maturing).
- S3-compatible object storage landscape 2026 (R2 zero egress, MinIO self-hosted AGPL caveat, presigned URL portability).
- SSE vs WebSockets 2026 (one-way push, auto-reconnect, proxy friendliness).
- WhatsApp Business Cloud API 2026 (On-Prem deprecated, template categories, per-message pricing, WABA ownership).
- Indonesia UU PDP 27/2022 fully enforceable since 17 Oct 2024 (administrative fines to 2% of annual revenue; breach notification 72 h; PDP Agency targeted 2026, implementing regulations pending) — see `PRIVACY.md` for the control mapping.
