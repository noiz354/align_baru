# ARCHITECTURE — SiomayOps

**Document ID:** DOC-ARCHITECTURE
**Status:** Phase 0 (design; skeleton code only — see `ADR-0036`)
**Companions:** `docs/architecture/{CONTEXT,MODULES,DATAFLOW,FINAL-REVIEW}.md`, `docs/adr/INDEX.md`, `DATA_MODEL.md`, `API.md`, `OFFLINE.md`, `OBSERVABILITY.md`, `DEPLOYMENT.md`

---

## 1. Architectural goals and constraints

| # | Goal | Constraint it implies |
| --- | --- | --- |
| G1 | A dropped connection never stops a sale | Offline-first client, client-generated IDs, idempotent server, per-record sync results |
| G2 | Money is never wrong or invented | Integer minor units, price snapshots, atomic write paths, payment states gated on verified evidence |
| G3 | The system is operable by a very small team | One deployable, one database, no broker, no service mesh, reversible migrations |
| G4 | Every money decision is explainable later | Append-only audit, immutable closings, correlation IDs, reconstructible records |
| G5 | Cheap phones stay usable | Small payloads, bounded assets, no client-heavy charting, no third-party scripts |
| G6 | Privacy by construction | Explicit location reports, scoped repositories, minimised telemetry, retention jobs |
| G7 | Change is safe | Layered modules with machine-checked dependencies, contract tests, feature flags |

Non-goals: horizontal scale-out before the pilot proves demand; real-time push for every surface;
multi-region; and any component whose operational cost exceeds its value at 5–20 stalls.

## 2. C4 Level 1 — System context

```text
                    ┌───────────────────────────────────────────────┐
                    │                   SiomayOps                   │
   Operator ───────▶│  PWA: shift, location, sales, expenses,       │
   (penjual)        │  stock, closing, requests                    │
                    │                                               │
   Supervisor ─────▶│  approvals, incidents, team status            │
   HQ Ops ─────────▶│  coverage, sales, cash, verification, alerts  │
   HQ Finance ─────▶│  verification, variance, settlement review    │
   Owner/Auditor ──▶│  aggregates, audit reconstruction, exports    │
                    └───────┬───────────────────────────┬───────────┘
                            │                           │
                  Payment provider (PJSP)        Object storage (S3 API)
                  callbacks + status queries     evidence photos, exports
                            │
                    Customer (no app)
                    pays cash or QRIS; optional consented loyalty
```

Explicitly outside the boundary: payroll, general ledger/accounting, delivery logistics, HR,
training systems, consumer marketplace, and any surveillance capability.

## 3. C4 Level 2 — Containers

```text
┌─────────────────────────── Operator device (Android, installed PWA) ───────────────────────────┐
│ Next.js client bundle · IndexedDB outbox (encrypted) · local draft state · sync engine         │
│ No provider secrets. No continuous location. Digital payment creation requires connectivity.   │
└───────────────┬───────────────────────────────────────────────────────────────────────────────┘
                │ HTTPS JSON /api/v1 (online)        HTTPS batch /api/v1/sync (replay)
┌───────────────▼───────────────────────────────────────────────────────────────────────────────┐
│ Web container (Next.js 16 App Router)                                                         │
│  Route handlers · server actions (HQ only) · authorization gate · Zod validation · SSE stream  │
└───────┬───────────────────────────┬──────────────────────────┬────────────────────────────────┘
        │                           │                          │
┌───────▼─────────┐   ┌─────────────▼───────────┐   ┌──────────▼──────────────┐
│ PostgreSQL 18   │   │ Worker container        │   │ Object storage (S3 API)  │
│ system of record│   │ (same image, different  │   │ evidence, exports,       │
│ outbox + pg-boss│   │  entrypoint): jobs,     │   │ lifecycle-managed        │
│ read models     │   │  sweeps, read models,   │   └─────────────────────────┘
└─────────────────┘   │  retention, notifications│
                      └──────────┬──────────────┘
                                 │
                    ┌────────────▼─────────────┐
                    │ Payment provider adapter │  (interface only in Phase 0)
                    └──────────────────────────┘
```

One image, two entrypoints (web, worker). One database for both operational data and job state.
No Redis, no Kafka, no separate search cluster (ADR-0001, ADR-0003, ADR-0018).

## 4. Layering and dependency rules (ADR-0035)

```text
src/app/*        delivery: routes, pages, layouts, route handlers       (may import features, shared, server)
src/features/*   use cases: orchestration, authorization calls, DTO mapping, ports  (may import domain, shared, server ports)
src/domain/*     pure domain: types, state machines, invariants, value objects       (imports NOTHING framework-specific)
src/server/*     adapters: db, auth, payments, jobs, notifications, storage, telemetry (imported by features only)
src/shared/*     contracts (Zod), types, money, time, ui primitives                  (imported by everyone)
```

Enforced by lint rules: `domain` may not import from `features`, `server`, `app` or any framework
package; `features` may not import another feature's internals (only its public `index.ts` ports);
`app` may not contain business logic; `server` may not be imported from client components.

## 5. Module map

| Module | Responsibility | Key ports / types |
| --- | --- | --- |
| `src/domain/shift` | Shift lifecycle, expected-cash arithmetic shape, handover rules | `Shift`, `ShiftStatus`, `ExpectedCashBreakdown`, `canStartShift()` |
| `src/domain/location` | Location report rules, windows, statuses, move reasons | `LocationReport`, `SellingLocation`, `LocationStatus`, `MoveReason` |
| `src/domain/sale` | Sale lifecycle, line snapshotting rules, totals | `Sale`, `SaleLine`, `SaleStatus`, `computeTotalFromSnapshots()` |
| `src/domain/payment` | Payment state machine, verification rules, evidence requirements | `Payment`, `PaymentStatus`, `PaymentMethod`, `canTransition()` |
| `src/domain/expense` | Expense categories, review states, cash-expense effects | `Expense`, `ExpenseCategory`, `ExpenseReviewState` |
| `src/domain/inventory` | Stock movement kinds, variance reasons, derived position rules | `StockMovement`, `MovementKind`, `VarianceReason`, `derivePosition()` |
| `src/domain/loyalty` | Reward instance rules, liability bounds, eligibility shapes | `LoyaltyAccount`, `RewardInstance`, `LoyaltyRules` |
| `src/features/*` | One use-case group each (operators, stalls, locations, shifts, menu, pricing, sales, payments, expenses, inventory, loyalty, performance, communications, incidents, hq, alerts, audit, sync, auth) | Ports + DTOs (see each folder's `index.ts`) |
| `src/server/db` | Drizzle schema, migrations, repositories (scope-mandatory) | `*Repository` interfaces + Drizzle implementations |
| `src/server/auth` | Session/auth adapter behind `AuthPort` | `AuthPort`, `SessionContext`, `authorize()` |
| `src/server/payments` | `PaymentProvider` port + adapter stubs, callback verification | `PaymentProvider`, `WebhookVerifier` |
| `src/server/jobs` | pg-boss wiring, job registry, cron definitions | `JobName`, `enqueue()`, workers |
| `src/server/notifications` | Channel adapters behind `NotificationChannel` | `NotificationChannel`, `NotificationPayload` |
| `src/server/telemetry` | OTel SDK setup, logger, metric instruments | `logger`, `tracer`, `metrics` |
| `src/server/storage` | S3-compatible presigned upload/download | `EvidenceStore` |
| `src/shared/contracts` | Zod schemas for every API contract in `API.md` | `createSaleRequestSchema`, … |
| `src/shared/money` | `Money` value object, rounding, allocation | `Money`, `moneyFromMinor()`, `allocate()` |

## 6. Canonical write paths

### 6.1 Record a cash sale (online)

```text
client (optimistic) → POST /api/v1/sales {Idempotency-Key}
  → validate (Zod) → authorize(actor, 'sale:create', {stallId, shiftId})
  → load shift (must be ACTIVE) → resolve priced lines (price policies + snapshots)
  → tx: insert sale + sale_lines + payment(cash, PAID_ALLOWED_FOR_CASH) + audit + outbox event
  → read model invalidation → 201 with authoritative record
```

Payment PAID for cash is legitimate: the cash is physically counted in the same transaction of
hand-over. For digital methods the same endpoint may only create PENDING/ PENDING_VERIFICATION.

### 6.2 Offline replay

```text
IndexedDB outbox (per-aggregate order) → POST /api/v1/sync {records[], Idempotency-Key}
  → per record: validate → dedupe by (organization_id, client_id) → authorize → apply or defer
  → per-record result {ACCEPTED | DUPLICATE | REJECTED(reason) | DEFERRED(retryAfter)}
  → client updates local status, keeps REJECTED visible to the operator
```

Rules: server time governs ordering and business day; price resolution happens at acceptance using
the snapshot rule; a rejected record is never silently dropped; a digital payment never arrives
as PAID (ADR-0033).

### 6.3 Payment verification

```text
provider callback → POST /api/v1/payments/webhook/{provider}
  → verify signature, reference match, amount match, replay guard
  → tx: update payment_attempt (PAID/FAILED) + payment evidence + audit + alert resolution
  → if no matching attempt: record rejection + security alert

static QRIS (no callback) → operator records PENDING_VERIFICATION
  → HQ Finance verifies with evidence → POST /api/v1/payments/{id}/reconciliations
  → tx: reconciliation record + state change to PAID + audit (reason mandatory)
```

### 6.4 Close a shift

```text
operator: stock count → cash count → variance keypad → reason (if beyond tolerance) → submit
  → (offline: stored as PENDING_SYNC, editable) → POST /api/v1/shifts/{id}/closing
  → server: compute expected cash from records; compare with counted
  → tx: closing + variance record(s) + alerts (if unresolved verifications) + audit
  → status SUBMITTED → (review) ACCEPTED | RETURNED_FOR_CORRECTION → ACCEPTED is immutable
```

## 7. Offline, identity and idempotency architecture

| Concern | Design |
| --- | --- |
| Identity | Client-generated UUIDv7 per record; unique alias `(organization_id, client_record_id)` |
| Ordering | Per-aggregate FIFO in the outbox (shift → sales → expenses → closing); batches preserve order |
| Replay safety | `Idempotency-Key` per request plus per-record client IDs; replay returns the original response marked as a replay |
| Conflict detection | Server compares client-reported state with current state (e.g. shift already closed, payment already verified, reward already redeemed) and returns a structured conflict |
| Conflict policy | Documented per aggregate in `OFFLINE.md`; unresolvable conflicts quarantine for human handling |
| Stale bands | `<5 min` current, `5–60 min` recent (labelled), `>60 min` stale (warned); blocking actions require fresh reads server-side |
| Local storage | IndexedDB, encrypted at rest, wiped on logout/revocation; quarantined if undecryptable |
| Server authority | Prices, permissions, payment states, shift acceptance, stock expectations, business day |

## 8. Read models and freshness

| Read model | Source | Refresh | Consumers |
| --- | --- | --- | --- |
| `coverage_today` | shifts, assignments, location reports | 60 s | HQ card 1 |
| `sales_today_by_stall` | sales, payments | 60 s | HQ card 2 |
| `cash_position_today` | shifts, sales, expenses, closings | 5 min | HQ card 3 |
| `verification_backlog` | payments, reconciliations | 60 s | HQ card 4, Finance queue |
| `stock_position_by_stall` | stock movements, counts | 10 min | HQ card 5 |
| `incident_board` | incidents | event-driven | HQ card 6 |
| `expense_review_queue` | expenses, flags | 5 min | HQ card 7 |
| `closing_completeness` | shifts, closings | 5 min | HQ card 8 |
| `location_usage` | location reports, locations | 15 min | HQ card 9 |
| `exceptions` | union of the above + alerts | 2 min | HQ card 10 |

Each row carries `organization_id`, `scope`, `computedAt`, `sourceWatermark`. Reads serve the stored
value plus freshness; the API never recomputes heavy aggregates inline (ADR-0035 §read models).

## 9. Transactional boundaries and concurrency

| Operation | Boundary | Guard |
| --- | --- | --- |
| Sale creation | one transaction: sale + lines + payment(cash) + audit + outbox | partial unique index on `(shift_id, client_sale_id)`; shift must be ACTIVE |
| Payment verification | one transaction: attempt state + evidence + audit | `WHERE status = 'PENDING'` guarded update; exactly-once semantics |
| Reward redemption | one transaction: reward instance + loyalty ledger entry | unique constraint on `(loyalty_account_id, reward_definition_id, period)` |
| Handover | one transaction: handover row + accountability transfer + snapshot | requires both confirmations; optimistic version check on shift |
| Closing acceptance | one transaction: closing + variance records + alerts | shift must be OPEN or PENDING_SYNC; closing immutable after acceptance |
| Stock movement | one transaction: movement + derived-position invalidation | append-only; no balance updates in place |
| Price policy publish | one transaction: policy + audit | no overlapping identical specificity allowed |

Cross-aggregate concurrency follows `STATE_MACHINE.md` §cross-machine table (e.g. a sale cannot be
created on a closing shift; an override cannot apply to a sale already recorded).

## 10. Failure model

| Failure | Detection | Behaviour |
| --- | --- | --- |
| Device offline | client network state | Queue locally; banner; digital payments blocked with a clear message |
| Device storage full/corrupt | write errors, checksum failure | Refuse to accept new records rather than silently losing; surface "storage penuh" guidance; quarantine undecryptable entries |
| Server unreachable | timeouts | Exponential backoff with jitter; never mark records as rejected locally |
| Database failover | connection errors, health check | Writes fail loudly and safely; clients retry idempotently |
| Job worker down | heartbeat + queue depth metric | Alerts; read models go stale and are labelled; operator flows unaffected |
| Provider unavailable | adapter errors, timeouts | Digital payment creation returns `DEPENDENCY_UNAVAILABLE`; cash continues; provider kill switch (ADR-0038) |
| Object storage down | upload failures | Expenses save without evidence (note marks evidence pending); no data loss |
| Clock skew | server comparison | Server time authoritative; device time flagged in support views |
| Partial batch failure | per-record results | Accepted records stay; the rest retry; nothing partially applied within a record |
| Duplicate callback | replay guard | Idempotent no-op with audit entry |
| Audit write failure | transaction failure | The whole operation fails — no money action exists without its audit row |

## 11. Security architecture (summary; detail in `SECURITY.md`, `THREAT_MODEL.md`)

- Authentication behind `AuthPort` (phone OTP for operators, password/passkey + TOTP for HQ roles;
  ADR-0015) with sessions in `httpOnly` cookies.
- A single `authorize(actor, action, subject, scope)` gate called by every use case; repository methods
  require scope (INV-14); denials audited (FR-AUDIT-005).
- Tenant/every-table `organization_id` (ADR-0031); unique constraints include it.
- Provider secrets only server-side; callbacks verified and replay-protected (NFR-SEC-005).
- Evidence via short-lived presigned URLs; no public buckets (ADR-0020).
- Device revocation, session revocation, remote wipe attempt, and encrypted local queue (ADR-0017).
- Input validation at the boundary with Zod; output shaped by explicit DTOs; no internal identifiers
  or stack traces leaked (NFR-SEC-012).

## 12. Observability architecture

Traces (OTel) for HTTP requests, sync batches, job executions, provider callbacks. Metrics for
business and technical SLIs (bounded labels, no PII). Structured JSON logs (Pino) with correlation
IDs. Alerts routed as operational alert objects in-app, with infrastructure alerts to the on-call
channel. Full catalogue and SLOs in `OBSERVABILITY.md`.

## 13. Deployment topology and environments

| Environment | Purpose | Data |
| --- | --- | --- |
| `local` | Development with Compose (PostgreSQL 18, optional MinIO) | Synthetic only |
| `preview` | Per-PR deploy for review | Synthetic only |
| `staging` | Release rehearsal, migration drills | Synthetic, prod-like volume |
| `production` | Pilot | Real (minimised, retained per `RETENTION.md`) |

One image; migrations run as an explicit release step with expand/contract compatibility; rollback is
image-tag based (ADR-0024, `DEPLOYMENT.md`).

## 14. Invariants and how they are enforced

**Domain invariants** live in `DOMAIN.md` §4 and are the canonical `INV-01…INV-15` register. Architecture
adds the *enforcement* constraints below (`ARC-*`), which are what make the domain invariants
machine-checkable in this codebase. A change that weakens an `ARC-*` check weakens the invariant it
enforces and must be reviewed as such.

| ID | Enforces | Constraint | Where |
| --- | --- | --- | --- |
| ARC-01 | INV-05 | Money is a branded type; a plain `number` cannot occupy a money position and no float arithmetic exists in a money path | `src/shared/money`, lint rule, T-FOUND-006 |
| ARC-02 | INV-06 | No client or offline path can move a payment to `PAID`; the only evidence sources are verified provider signals or a recorded reconciliation | transition guard + route tests |
| ARC-03 | INV-08/INV-09 | Completed sales and accepted closings are immutable; corrections are new records referencing the original | DB permissions/triggers + API tests |
| ARC-04 | INV-01/INV-08 | Totals recomputed from sale-line snapshots equal the stored totals, before and after any price change | property tests |
| ARC-05 | INV-07 | A reward instance is redeemable at most once, under concurrency | unique constraint + concurrent test |
| ARC-06 | INV-11 | No location record can exist for an inactive shift, and no geolocation API may be used outside the explicit report module | FK + `tools/check-stubs.mjs` |
| ARC-07 | INV-10 | Audit rows are append-only; UPDATE/DELETE are revoked; the audit row commits with the business change | DB permissions + transaction helper |
| ARC-08 | INV-14 | Every table carries `organization_id`; every unique constraint includes it | schema test |
| ARC-09 | INV-14 | Every repository method requires an explicit scope argument, so an unscoped query cannot be written | signatures + compile-time proof |
| ARC-10 | INV-15 | Every mutating endpoint is idempotent and returns the original response on replay | contract tests |
| ARC-11 | INV-13 | Stock positions are derived from append-only movements; no stored balance is authoritative | repository design + recompute test |
| ARC-12 | INV-02/INV-03/INV-04 | Records belong to exactly one shift; at most one active shift per operator and per stall (handover window excepted) | FKs + partial unique indexes |

Phase-0-only check (not an invariant of the running system): `ARC-P0` — every stub throws
`Not implemented: T-XXX-XXX` naming a real task, and no forbidden dependency or geolocation API
appears in `src/**`. Enforced by `tools/check-stubs.mjs` in CI.

## 15. Extension points (ports; interfaces only in this phase)

| Port | Purpose | Phase-0 stub |
| --- | --- | --- |
| `PaymentProvider` | Create/query/verify provider payments, refunds | `src/server/payments/provider.ts`, adapters absent |
| `WebhookVerifier` | Signature, reference, amount, replay checks | interface only |
| `NotificationChannel` | in-app, email, push, WhatsApp | in-app interface only |
| `EvidenceStore` | presigned upload/download, lifecycle | interface only |
| `AuthPort` | session resolution, OTP issuance, session revocation | interface + fake provider that cannot be enabled in production |
| `JobQueue` | enqueue and schedule (pg-boss) | interface only |
| `Clock` | injectable time (business day, server time) | interface + system implementation behind it (still a stub call site) |
| `IdGenerator` | UUIDv7 generation, business codes | interface only |

## 16. Deliberate non-decisions (deferred, with rationale)

| Not decided now | Why | Revisit trigger |
| --- | --- | --- |
| Full-text search across records | Not needed at pilot volume; Postgres `ILIKE`/trigram suffices | >1M records or search complaints |
| Event streaming to external systems | No consumer exists | A real integration requirement with an owner |
| Multi-region deployment | No user need | Latency or regulatory requirement appears |
| Offline-first read replicas | Server authority is sufficient | Read load exceeds primary capacity |
| Automated fraud detection | Ethically and legally premature; humans decide | Never without an ADR and legal review |
| Mobile native apps | PWA covers the field | A capability PWA genuinely cannot provide |

## 17. Architecture review triggers

Revisit this document when any of the following becomes true: a module is deployed or released
independently; p95 write latency exceeds budget for a week; sync failure rate exceeds 2% of records;
read models lag beyond their refresh window repeatedly; a second organisation onboards; an operator
device class appears that fails the performance budget; or a payment provider requires architecture
changes that conflict with ADR-0011/ADR-0012.
