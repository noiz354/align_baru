# STATE MACHINE

**Document ID:** DOC-STATE-MACHINE
**Status:** Phase 0 — specification only (**no implementation**)
**Related:** `DOMAIN.md`, `EVENTS.md`, `OFFLINE.md`, `TASKS.md`

---

## 0. Conventions

- States are `UPPER_SNAKE_CASE`; events are `PascalCase` past tense.
- Every transition lists: **from → to**, **trigger**, **guards**, **side effects**,
  **who may trigger**, and **forbidden moves**.
- Illegal transitions must fail loudly (`InvalidTransition`), never silently no-op.
- Offline-originated transitions are marked **[OFFLINE-OK]**; they are queued client-side and
  become authoritative only when accepted by the server (`OFFLINE.md`).
- Evidence rule: any transition marked 🔒 requires verified evidence (server-side proof) —
  never a client assertion.

---

## 1. Operator Shift

```text
PLANNED ──start──► OPEN ──activate──► ACTIVE ⇄ PAUSED
   │                 │                  │
   │                 └────cancel────────┴──► CANCELLED
   │                                      │
   └──────────────► (skipped)             └──close──► CLOSING ──accept──► CLOSED
                                                        │
                                                   reopen (audited)
```

| From | To | Trigger | Guards | Side effects | Who |
| --- | --- | --- | --- | --- | --- |
| (none) | PLANNED | ShiftPlanned | operator active, not suspended, assignment exists | assignment link, planned window | HQ Ops / Supervisor |
| PLANNED | OPEN | ShiftStarted [OFFLINE-OK] | no other active shift for operator; stall free; location selected; starting stock confirmed; price set acknowledged | stock snapshot (START), opening cash, location report #1, alert SHIFT_NOT_STARTED cleared | Operator |
| (none) | OPEN | ShiftStarted (ad-hoc) | same guards | same | Operator |
| OPEN | ACTIVE | SellingStarted | prices acknowledged, menu cached | status ACTIVE, POS enabled | Operator |
| ACTIVE | PAUSED | ShiftPaused [OFFLINE-OK] | — | reason recorded (break/restock/weather) | Operator |
| PAUSED | ACTIVE | ShiftResumed [OFFLINE-OK] | still same stall | — | Operator |
| ACTIVE/PAUSED | CLOSING | ShiftClosingStarted | — | lock new sales (allow queued ones), prompt stock + cash count | Operator |
| CLOSING | CLOSED | ShiftClosed 🔒 | closing accepted by server; cash variance has reason if out of tolerance; stock variance has reason or UNKNOWN | expected cash computed, variance stored, audit, metrics updated | Operator (server-accepted) |
| CLOSING | ACTIVE | ClosingCancelled | user backs out before submit | unlock | Operator |
| PLANNED | CANCELLED | ShiftCancelled | reason required | audit | HQ / Supervisor |
| CLOSED | CLOSING | ShiftReopened 🔒 | HQ Finance permission + reason + audit | closing becomes superseded, not deleted | HQ Finance |

**Forbidden:** starting a shift without a stall; two ACTIVE shifts for one operator;
closing with an unexplained out-of-tolerance variance; deleting a closed shift;
operator self-reopening a closed shift; sales in CLOSED state.

**Offline note:** a shift may be started, paused, and closed while offline. `CLOSING → CLOSED`
becomes `PENDING_SYNC` locally and **remains editable** until the server accepts it; if the
server rejects, the operator sees a specific, plain-language reason.

---

## 2. Operator operational status

```text
OFF_DUTY ──ready──► READY ──start──► ON_SHIFT ──sell──► SELLING
   ▲                  ▲                  │  ▲            │
   │                  │                  │  └──break─────┤
   │                  │                  ▼               ▼
   │                  └──shift end── CLOSING            ON_BREAK
   │                                                     │
   └─────────────────────────────────────────────────────┘
MOVING  (entered by a location-change workflow, returns to SELLING)
SUSPENDED (set by HQ; blocks starting shifts and recording sales)
```

| Status | Meaning | Allowed to sell | Set by |
| --- | --- | --- | --- |
| OFF_DUTY | Not working | No | System (shift ended) |
| READY | Logged in, no active shift | No | System |
| ON_SHIFT | Active shift, pre-selling | No | System |
| SELLING | Actively selling | Yes | System |
| ON_BREAK | Paused inside an active shift | No | Operator |
| MOVING | In transit to a new selling point | No (queue allowed) | System during move |
| CLOSING | Closing workflow | No | System |
| SUSPENDED | Blocked by HQ | No | HQ Ops (reason required, audited) |

**Forbidden:** SUSPENDED → any selling state without an explicit unsuspension by HQ.

---

## 3. Stall

```text
AVAILABLE ──assign──► ASSIGNED ──deploy──► IN_USE
     ▲                    │                   │
     │                    │                   ├──return──► AVAILABLE
     │                    │                   │
     └──repair done──── MAINTENANCE ◄─────────┘
                            │
                        RETIRED (terminal, audited)
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| AVAILABLE | ASSIGNED | StallAssigned | no other active assignment |
| ASSIGNED | IN_USE | ShiftStarted | operator + location confirmed |
| IN_USE | AVAILABLE | ShiftClosed | no open shift |
| any | MAINTENANCE | StallMaintenanceStarted | reason required; no ACTIVE shift |
| MAINTENANCE | AVAILABLE | StallMaintenanceCompleted | note required |
| any (no active shift) | RETIRED | StallRetired | HQ permission, reason, audit |
| IN_USE | IN_USE | OperatorHandover | handover record required |

**Forbidden:** retiring a stall with an active shift; two simultaneous IN_USE shifts (except
an explicit, recorded handover overlap window ≤ configured minutes).

---

## 4. Selling Location assignment (per shift)

```text
(none) ──select──► OCCUPIED ──move──► OCCUPIED (new location, previous closed)
                       │
                       ├──crowded──► status CROWDED (advisory)
                       ├──unavailable──► status TEMPORARILY_UNAVAILABLE (advisory)
                       └──shift end──► RELEASED
```

| From | To | Trigger | Guards | Side effects |
| --- | --- | --- | --- | --- |
| (none) | OCCUPIED | LocationSelected [OFFLINE-OK] | shift ACTIVE/OPEN, location status not RESTRICTED/INACTIVE | LocationReport row with `arrivedAt` |
| OCCUPIED | OCCUPIED (new) | LocationChanged [OFFLINE-OK] | reason required from controlled list | previous report gets `departedAt`, new report created |
| OCCUPIED | RELEASED | ShiftClosed | — | `departedAt` set |
| (status only) | CROWDED / TEMPORARILY_UNAVAILABLE | LocationStatusReported | operator has active shift or HQ role | advisory status + HQ timeline entry |

**Forbidden:** reporting a location outside an active shift; continuous background updates;
back-dating a report to appear earlier than it was made; silently editing a past report.

**Note:** the same selling point may be OCCUPIED by multiple stalls; the system shows crowding
rather than blocking, and never asserts official permission to sell anywhere.

---

## 5. Sale

```text
DRAFT ──complete──► COMPLETED ──(audited)──► VOIDED
   │                    │
   └──abandon──► DISCARDED
                        └──corrected──► CORRECTED (new sale referencing original)
```

| From | To | Trigger | Guards | Side effects |
| --- | --- | --- | --- | --- |
| (none) | DRAFT | SaleDrafted | shift ACTIVE | local-only until completed |
| DRAFT | COMPLETED | SaleCompleted [OFFLINE-OK] | ≥1 item, qty > 0, snapshot present, payment resolved (cash or pending digital allowed per policy) | totals computed from snapshots, audit, stock consumption (later slice), loyalty earn (later slice) |
| DRAFT | DISCARDED | SaleDiscarded | — | no financial effect |
| COMPLETED | VOIDED | SaleVoided 🔒 | permission + reason required; same business day or approved later; payment state considered | original retained; reversal recorded; cash impact flagged to closing |
| COMPLETED | CORRECTED | SaleCorrected 🔒 | permission + reason | new sale + link; original retained immutable |

**Forbidden:** editing a COMPLETED sale's items/prices in place; deleting a sale; completing a
sale with a client-side claim of digital payment success (🔒 evidence rule); completing a sale
outside an active shift.

---

## 6. Expense

```text
SUBMITTED ──flag──► REVIEW_REQUIRED ──review──► REVIEWED
     │                    │                        │
     │                    ├──escalate──► ESCALATED │
     │                    └──reject────► REJECTED  │
     └────────────────────┴────────────────────────┘
     (any) ──operator correction before review──► new revision (audited, original kept)
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| (none) | SUBMITTED | ExpenseSubmitted [OFFLINE-OK] | amount > 0, category from configured list, shift exists |
| SUBMITTED | REVIEW_REQUIRED | ExpenseFlagged | HQ role + reason; or configured rule (threshold/pattern) |
| SUBMITTED/REVIEW_REQUIRED | REVIEWED | ExpenseReviewed | reviewer permission + note |
| SUBMITTED/REVIEW_REQUIRED | REJECTED | ExpenseRejected | reviewer permission + **reason required**, operator notified neutrally |
| REVIEW_REQUIRED | ESCALATED | ExpenseEscalated | suspected coercion/pattern; routes to human process (`RUNBOOK.md`) |
| ESCALATED | REVIEWED/REJECTED | EscalationResolved | documented outcome |

**Forbidden:** deleting an expense; auto-rejecting without human review; marking an
`UNVERIFIED_FIELD_EXPENSE` as "lawful" or "unlawful" — the model records reports, not verdicts;
any state machine path that produces a recommendation of whom or how much to pay.

---

## 7. Stock transfer (warehouse ⇄ operator)

```text
REQUESTED ──approve──► ISSUED ──in transit──► RECEIVED ──discrepancy?──► RECONCILED
     │                    │                       │
     └──cancel──► CANCELLED└──cancel (before dispatch)──► CANCELLED
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| (none) | REQUESTED | RestockRequested [OFFLINE-OK] | operator has active shift or upcoming shift |
| REQUESTED | ISSUED | StockIssued | warehouse operator confirms quantities |
| ISSUED | RECEIVED | StockReceived [OFFLINE-OK] | operator confirms counted quantities |
| RECEIVED | RECONCILED | TransferReconciled | discrepancy explained with reason |
| RECEIVED | RECONCILED (with discrepancy) | DiscrepancyRecorded | reason required; no accusation; visible to HQ |
| REQUESTED/ISSUED | CANCELLED | TransferCancelled | reason required; audit |

**Forbidden:** receiving more than issued without a discrepancy record; deleting a transfer;
silently adjusting quantities.

---

## 8. Stock item position (derived, not a state machine — recorded for clarity)

Position is **derived** from movements. The only "state" worth naming is the alert band:

```text
OK ──below warn threshold──► LOW ──below critical──► CRITICAL ──restock──► OK
```

Alerts are advisory: they never block selling, and STOCK_CRITICAL for one item never prevents
a sale of other items.

---

## 9. Payment

```text
PENDING ──authorized──► AUTHORIZED ──captured/verified──► PAID
   │                        │                              │
   ├──expire──► EXPIRED     ├──fail──► FAILED              ├──refund──► REFUNDED
   └──cancel──► CANCELLED   └──cancel──► CANCELLED          │
                                                            └──(dispute, later slice)
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| (none) | PENDING | PaymentStarted [OFFLINE-OK] | sale exists; amount matches sale total |
| PENDING | AUTHORIZED | ProviderAuthorized 🔒 | verified provider response |
| PENDING | EXPIRED | PaymentExpired | age beyond configured TTL, no verified evidence; sweep job |
| PENDING | FAILED | ProviderFailed 🔒 | verified failure |
| PENDING | CANCELLED | PaymentCancelled | operator/HQ, reason; only when no verified success exists |
| AUTHORIZED | PAID | PaymentVerified 🔒 | verified callback or authorised manual reconciliation; amount + currency match; not already PAID |
| PENDING | PAID | PaymentVerifiedManually 🔒 | HQ Finance permission + evidence note + audit (used for static QRIS receipts) |
| PAID | REFUNDED | RefundIssued 🔒 | HQ Finance permission; refund reference recorded |
| any non-PAID | — | (client assertion) | **always rejected** |

**Critical guards:**

1. No transition to `PAID` is reachable from client code or from an unverified webhook.
2. Duplicate callbacks are idempotent: same provider reference ⇒ same transition, no
   double-counting, no second audit event claiming a new payment.
3. Amount/currency mismatch ⇒ `REVIEW_REQUIRED` (manual), never `PAID`.
4. `PENDING` beyond TTL ⇒ `EXPIRED` and an alert, never silently dropped; the sale remains
   visible with an unresolved payment marker.

---

## 10. Loyalty reward instance

```text
ISSUED ──redeem (single-use, server-verified)──► REDEEMED
   │
   ├──expire──► EXPIRED
   └──cancel──► CANCELLED (campaign withdrawn, HQ)
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| (none) | ISSUED | RewardIssued | account eligible per campaign (algorithm deferred) |
| ISSUED | REDEEMED | RewardRedeemed 🔒 | server-verified; reward not already redeemed; sale reference recorded; unique constraint on reward instance |
| ISSUED | EXPIRED | RewardExpired | expiry passed |
| ISSUED | CANCELLED | RewardCancelled | HQ reason |

**Forbidden:** redeeming without a sale reference; redeeming the same instance twice
(concurrent devices included); offline redemption of a reward type flagged
`requires_online_verification` (policy per ADR-0028).

---

## 11. Incident

```text
OPEN ──ack──► ACKNOWLEDGED ──investigate──► INVESTIGATING ──resolve──► RESOLVED ──close──► CLOSED
  │                                                                       │
  └──(safety escalation)──► ESCALATED ────────────────────────────────────┘
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| (none) | OPEN | IncidentReported [OFFLINE-OK] | category + description required |
| OPEN | ACKNOWLEDGED | IncidentAcknowledged | HQ/Supervisor role; owner assigned for P1 |
| ACKNOWLEDGED | INVESTIGATING | IncidentInvestigationStarted | investigator assigned |
| INVESTIGATING | RESOLVED | IncidentResolved | resolution note required |
| RESOLVED | CLOSED | IncidentClosed | closure note; no reopen without reason |
| any open state | ESCALATED | IncidentEscalated | safety categories auto-escalate (P1) |
| CLOSED | OPEN | IncidentReopened 🔒 | reason required; audit |

**Forbidden:** deleting an incident; closing a P1 safety incident without a documented
outcome; exposing incident details to operators other than the reporter and responders.

---

## 12. Daily closing (per business day, per area)

```text
NOT_STARTED ──collect──► COLLECTING ──all shifts closed──► READY ──review──► SUBMITTED
      │                        │                              │                 │
      │                        └──shifts missing──────────────┘                 │
      │                                        REVIEW_REQUIRED ◄───variance─────┘
      └──────────────────────────────────────────► LOCKED (audited, later period)
```

| From | To | Trigger | Guards |
| --- | --- | --- | --- |
| NOT_STARTED | COLLECTING | DayRollupStarted | business day closed by clock |
| COLLECTING | READY | AllShiftsClosed | every shift CLOSED or explicitly `CLOSING_EXCEPTION` (open shift with a documented reason) |
| READY | SUBMITTED | DayClosingSubmitted | area sign-off by Supervisor/HQ Ops |
| READY/SUBMITTED | REVIEW_REQUIRED | VarianceDetected | cash/digital variance beyond tolerance or missing settlement |
| REVIEW_REQUIRED | SUBMITTED | VarianceReviewed | reason + reviewer recorded |
| SUBMITTED | LOCKED | PeriodLocked | retention/lock policy; further changes only as audited corrections |

**Forbidden:** marking a day closed while shifts are silently open (must be exceptions with
reasons); rewriting a locked day; closing a day without a reviewer for variances.

---

## 13. Cross-machine rules (concurrency guards)

| Situation | Required behaviour |
| --- | --- |
| Same cash sale submitted twice (retry) | Idempotency key ⇒ single sale; second response is the original. |
| Two devices submit the same `client_sale_id` | Same as above; the loser receives the winner's record. |
| Payment callback delivered twice | Single `PAID` transition; callback rows recorded uniquely; no double total. |
| Reward redeemed from two devices concurrently | Exactly one succeeds; other gets a clear "already used" message. |
| Price changed while a sale is open | Sale uses the snapshot resolved at server acceptance; operator is warned if the price changed. |
| Operator closes shift while sync pending | Closing queued as PENDING_SYNC; server reconciles in order; conflicts surface to HQ. |
| Stock movement arrives twice | Idempotent by `client_movement_id`; position unchanged. |
| Expense submitted twice after reconnect | Idempotent by `client_expense_id`. |
| Two HQ users edit the same price | Optimistic version check; second edit is rejected with a diff and requires re-submission. |
| Location changes during closing | Closing captures the location at closing time; a later report requires reopening the location step (audited). |
