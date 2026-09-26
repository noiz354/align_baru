# EVENTS — Conceptual Domain Events

**Document ID:** DOC-EVENTS
**Status:** Phase 0 (vocabulary and expectations only — **no bus, no Kafka, no implementation**)
**Related:** `ARCHITECTURE.md` §7, `OFFLINE.md`, `OBSERVABILITY.md`, `docs/adr/ADR-0018-pg-boss-jobs.md`

---

## 1. What "event" means here

SiomayOps uses **three distinct things** that people casually call "events". Conflating them
causes real bugs, so they are named separately:

| Kind | Purpose | Durability | Delivery expectation |
| --- | --- | --- | --- |
| **Audit event** | Compliance record of a state change (who/what/when/before/after/reason). | Append-only, permanent (per `RETENTION.md`). | Synchronous with the transaction. Must never be lost. |
| **Domain event** | In-process signal that something happened, used to trigger side effects (notifications, metrics, read-model updates). | Stored in an **outbox table** in the same transaction. | At-least-once, idempotent consumers, ordered per aggregate. |
| **Operational alert** | A user-facing, actionable condition (`OperationalAlert` row). | Mutable, resolvable, has an owner. | Delivered to the UI; may be ignored/dismissed by humans. |

**No message broker exists in Phase 0 or Phase 1.** Delivery is Postgres outbox → pg-boss job →
idempotent handler. A bus is only justified if an *external independent consumer* appears
(e.g. a corporate accounting system) — that would be a new ADR.

---

## 2. Event catalogue (conceptual)

Format: `EventName` — emitter → expected reactions (all future work; nothing is implemented).

### 2.1 Shift & location

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `ShiftStarted` | Operator successfully opens a shift. | Stock snapshot expected-record created; dashboards "active operators" ++; alert `SHIFT_NOT_STARTED` cleared for that operator; metric counter. |
| `ShiftPaused` / `ShiftResumed` | Break, restock, weather. | Timeline entry; handle-time not counted against selling time in metrics. |
| `LocationSelected` | First location of a shift. | Location history row opens; HQ location board update; if outside usual area, advisory note. |
| `LocationChanged` | Operator moves mid-shift. | Close previous interval; new interval; HQ "Location Changes" card; travel time excluded from selling-time metrics; move-reason analytics. |
| `LocationStatusReported` | Crowded / unavailable / requested-to-move / weather / stopping. | Ops timeline; possible `STALL_LOCATION_UNKNOWN` or crowding advisory; supervisor notification. |
| `ShiftClosingStarted` | Closing workflow begins. | Lock new sales (queued ones may still be accepted); prompt counts. |
| `ShiftClosed` | Server accepts a closing. | Expected cash stored; variance computed; metrics updated; `SETTLEMENT` expectations created; `SHIFT_NOT_CLOSED` cleared. |
| `ShiftReopened` | HQ Finance reopens with reason. | Supersedes previous closing (never deletes); notification to operator and supervisor; audit. |
| `HandoverRecorded` | Mid-day operator change. | Accountability boundary recorded; metrics attribute intervals correctly. |

### 2.2 Menu, pricing, availability

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `MenuPublished` | Menu version published for scope. | Device cache invalidation hint; `PRICE_NOT_ACKNOWLEDGED` baseline update. |
| `PricePublished` | A price policy/override becomes active. | Notify affected operators; acknowledgement tracking starts; HQ "unacknowledged" count. |
| `PriceAcknowledged` | Operator confirms new prices. | Clear `PRICE_NOT_ACKNOWLEDGED`; compliance metric. |
| `PriceOverridden` | Local override granted/used. | Audit; margin visibility for HQ; expiry timer created. |
| `PriceOverrideExpired` | Override validity ends. | Affect next sale resolution only; never retrospective. |

### 2.3 Sales, payments, cash

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `SaleDrafted` | Operator starts a sale locally. | (Local only; used for offline analytics and abandoned-sale insight.) |
| `SaleCreated` | Sale persisted (server or queued). | Stock consumption intent (later slice); loyalty earn eligibility (later slice); daily totals. |
| `SaleCompleted` | Sale is durable and totals computed from snapshots. | Payment linkage; HQ sales cards; per-operator metrics. |
| `SaleVoided` / `SaleCorrected` | Audited reversal/correction. | Closing impact recalculation; audit; supervisor notification if material. |
| `PaymentStarted` | Payment record created (cash or digital). | Payment pending age timer starts (digital only). |
| `PaymentCompleted` (PAID) | 🔒 verified evidence or authorised manual reconciliation. | Sale's payment resolved; digital totals; settlement expectation; clear pending alert. |
| `PaymentFailed` / `PaymentExpired` | 🔒 verified failure or TTL expiry. | Alert `PAYMENT_PENDING_TOO_LONG`/failed marker; operator prompt to re-attempt; reconciliation queue. |
| `PaymentCallbackRejected` | Signature/replay/amount check fails. | Security log; alert; **never** a state change. |
| `PaymentReconciliationRequired` | Duplicate/ambiguous/amount mismatch detected. | HQ Finance queue entry; sale remains visibly unresolved. |
| `PaymentManuallyReconciled` | 🔒 HQ Finance resolution. | Audit with reason; totals corrected forward, never rewritten. |
| `CashVarianceDetected` | Closing reveals a difference beyond tolerance. | Alert; reason requirement; review queue; never an automatic accusation. |

### 2.4 Expenses

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `ExpenseSubmitted` | Operator records an expense (online or from queue). | Shift totals; review queue if rules match; cash expectation impact if cash. |
| `ExpenseFlagged` | HQ flags for review (manual or rule-based). | Operator informed neutrally; review SLA timer. |
| `ExpenseReviewed` | Review completed with note. | Operator notified; audit. |
| `ExpenseRejected` | Rejected with reason. | Operator notified with reason; record retained. |
| `ExpenseEscalated` | Suspected coercion/pattern. | Human escalation path (`RUNBOOK.md`); **no** automated naming of parties. |
| `UnusualExpensePattern` | Aggregated pattern across shifts/locations. | Informational review item for HQ Ops/Finance; operator-protective framing; aggregated only. |

### 2.5 Inventory

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `StockIssued` | Warehouse issues stock to an operator. | Transfer state; in-transit expectation. |
| `StockReceived` | Operator confirms receipt. | Position update via movements; discrepancy detection. |
| `StockAdjusted` | Manual adjustment with reason. | Audit; variance reporting; never silently. |
| `StockLow` / `StockCritical` | Threshold crossed. | Alert `STOCK_LOW`/`STOCK_CRITICAL`; restock suggestion (a prompt, not an order). |
| `StockVarianceDetected` | Expected vs counted differ at closing. | Reason prompt; HQ visibility; pattern analytics per item/location. |

### 2.6 Loyalty

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `LoyaltyCustomerIdentified` | Customer identified (phone/QR/device token). | Account resolved/created with consent check. |
| `LoyaltyEarned` | (Later slice) sale qualifies for earning. | Balance update (algorithm deferred); audit. |
| `RewardIssued` | Campaign/visit threshold yields a reward instance. | Single-use entitlement created; customer notified (if consented). |
| `RewardRedeemed` | 🔒 verified single-use redemption. | Sale adjustment applied; instance marked used; unique constraint prevents repeats. |
| `RewardExpired` | Validity passed. | Cleanup; no balance effect if never used. |

### 2.7 Incidents, communication, recognition, audit

| Event | Emitted when | Expected reactions |
| --- | --- | --- |
| `IncidentReported` | Operator/HQ files an incident. | Severity routing; owner assignment; alert `INCIDENT_OPEN`; P1 escalation. |
| `IncidentAcknowledged` / `IncidentResolved` / `IncidentClosed` | Lifecycle moves. | SLA/ageing metrics; trend analytics. |
| `MessagePosted` | Operational message sent (any direction). | Thread delivery; urgent messages require acknowledgement; timeline entry. |
| `OperationalAlertRaised` | Rule/job produces an alert. | Route by severity and role; dedupe/rate-limit; assign owner. |
| `OperatorRecognitionCalculated` | Period computation completes. | Provisional result, auditable factor breakdown, review window opens. |
| `OperatorRecognitionApproved` | Human approval of the provisional result. | Publication; operator sees own breakdown; dispute window opens. |
| `OperatorRecognitionOverridden` | Result changed with reason. | Audit; notification; methodology review insight. |
| `AuditEventRecorded` | Any audited state change. | Append-only storage; export eligibility; integrity monitoring (gaps, unexpected mutations). |

---

## 3. Event envelope (conceptual contract)

```ts
interface DomainEventEnvelope<T> {
  eventId: string;              // UUIDv7
  eventName: string;            // e.g. "ShiftClosed"
  eventVersion: number;         // schema version, additive-only
  organizationId: string;       // tenant scope — never optional
  occurredAt: Date;             // UTC instant of the business fact
  recordedAt: Date;             // when our system stored it
  businessDay: string;          // YYYY-MM-DD in Asia/Jakarta
  actor: { id: string; role: string; type: "operator"|"hq"|"system"|"provider" };
  aggregate: { type: string; id: string; version?: number };
  correlationId: string;        // request/job trace
  causationId?: string;         // the event/command that caused this
  payload: T;                   // event-specific, additive-only schema
}
```

**Rules:**
1. Events carry **IDs, not objects** for external aggregates.
2. Events never carry customer PII payloads beyond opaque IDs; notifications resolve PII at
   delivery time using scoped lookups.
3. Money in events is `{ amountMinor: number, currency: "IDR" }`.
4. Adding fields is allowed; changing meaning or removing fields requires a new version.
5. Consumers are **idempotent** and keyed by `(eventName, aggregate.id, version/sequence)`.
6. Events are **not** the system of record — the tables are. Events can be replayed from the
   outbox to rebuild read models, and reproduction must be possible from stored facts.

---

## 4. Delivery semantics and ordering

| Aspect | Decision |
| --- | --- |
| Delivery | At-least-once via outbox + pg-boss; every consumer idempotent. |
| Ordering | Guaranteed per aggregate (per shift, per payment, per stock item). No global order. |
| Failure | Retries with exponential backoff; then dead-letter with alert and runbook link. |
| Poison messages | Isolated, never blocking the queue head; visible in HQ health view. |
| Replay | Read-model rebuild jobs can be re-run for a business day or date range safely. |
| Latency budget | Non-critical consumers ≤ 5 min p95; alerting paths ≤ 60 s p95. |
| Retention | Outbox rows pruned after successful handling and the retention window in `RETENTION.md`. |

---

## 5. Anti-patterns we forbid (recorded so future contributors do not reintroduce them)

1. **Event-driven money state.** Payment status lives in the `Payment` row, not in an event
   stream. Events announce; they do not decide.
2. **Events as the audit trail.** Audit has its own append-only table with reasons; an event
   log is not an audit log.
3. **Fire-and-forget side effects.** If a consumer must run, it runs transactionally via the
   outbox.
4. **Kafka-style speculation.** No broker until an external consumer exists.
5. **Notifications as state.** A notification failure must never change money state
   (`FR-NOTIF-007`).
6. **Cross-tenant events.** Every event is tenant-scoped; there is no "global" event.
