# SALES

**Document ID:** DOC-SALES
**Status:** Phase 0 (specification; **no sale logic implemented**)
**Related:** FR-SALE-*, ADR-0010, ADR-0006, ADR-0013, `PAYMENTS.md`, `PRICING.md`, `OFFLINE.md`

---

## 1. Conceptual transaction

```text
Sale
 ├── Items            (menu item, quantity)
 ├── Price Snapshot   (unit price that was effective at sale time)
 ├── Location         (selling point at that moment)
 ├── Operator         (accountable person)
 ├── Shift            (accountability container)
 ├── Payment          (cash or digital; may be pending verification)
 ├── Loyalty          (optional: identified customer, earn/redeem references)
 └── Timestamp        (occurredAt on device + acceptedAt on server; businessDay)
```

**Critical requirement (FR-SALE-006/007, ADR-0010):** a transaction must preserve the price
that was effective when the sale occurred. The platform must never recompute old sales using
current prices.

---

## 2. Sale lifecycle

```text
DRAFT ──complete──► COMPLETED ──(audited reversal)──► VOIDED
   │                    │
   └──discard──► DISCARDED
                        └──(audited correction)──► CORRECTED (new sale references original)
```

| State | Meaning | Money effect | Mutability |
| --- | --- | --- | --- |
| DRAFT | Being built on the device (may be offline) | None | Fully editable, local |
| COMPLETED | Durable, snapshots fixed, totals frozen | Counts toward shift totals | Immutable |
| VOIDED | Reversed with reason and actor | Reversal recorded; original retained | Immutable |
| CORRECTED | Superseded by a linked corrected sale | Both visible; net effect computed | Immutable |
| DISCARDED | Never happened (abandoned before payment) | None | Local only, then pruned |

---

## 3. Price snapshot (the heart of the design)

```ts
/**
 * A completed sale must preserve a historical price snapshot.
 * Updating current menu prices MUST NOT alter previous sales.
 */
interface SaleItem {
  menuItemId: string;
  quantity: number;

  unitPriceSnapshot: Money;   // resolved at acceptance, immutable forever
  lineTotal: Money;           // unitPriceSnapshot × quantity (integer math)

  pricePolicyId?: string;     // provenance: which policy produced the snapshot
  priceSource?: "ORG" | "AREA" | "LOCATION" | "OVERRIDE";
  overrideId?: string;        // when a temporary override applied
}
```

Rules:

1. The snapshot is resolved **server-side at acceptance**; a device-supplied price is accepted
   only if it matches, otherwise `409 STALE_DATA` (API §5).
2. Totals are computed only from snapshots — never from the current catalog.
3. Snapshots never change. A price correction affects **future** sales only.
4. Historical recomputation must reproduce the stored total exactly (test-enforced).

---

## 4. Fast operator POS (design contract)

```text
Select Items   →   Quantity   →   Total   →   Select Payment   →   Complete
```

| Constraint | Value | Source |
| --- | --- | --- |
| 1-item cash sale | ≤ 4 taps, 0 typing | DESIGN.md §4 |
| 3-item mixed cash sale | ≤ 6 taps, ≤ 1 typed amount | DESIGN.md §4 |
| Median completion | ≤ 12 s | NFR-PERF-002 |
| Repeating last sale | 1 tap | FR-SALE-009 |
| Menu discovery | Tap grid, not search (until > 16 items) | MENU.md §5 |

### Deliberately excluded from the operator POS

- table/seat management, split bills (unless a wholesale use case appears), tips accounting,
  printer integrations, multi-terminal sync, modifiers matrices, order-ahead.
  These belong to restaurant POS products; they would slow the 90% case (`PRD.md` §3).

---

## 5. Payment coupling

| Payment situation | Sale behaviour |
| --- | --- |
| Cash exact | Completes immediately; change = 0 |
| Cash overpaid | Completes immediately; change computed and returned |
| Cash underpaid | Not allowed (blocked client-side; would be a partial payment, which is out of scope) |
| Digital, verified (gateway) | Completes with payment `PAID` only on verified evidence |
| Digital, static QR (no gateway) | Completes with payment `PENDING_VERIFICATION` and an explicit unresolved marker visible to operator and HQ |
| Digital, offline | Sale may be recorded with an **unresolved** payment flag; the client must not claim success (NFR-OFFLINE-002) |
| Mixed payment (cash + digital) | Out of scope for MVP; modelled later as multiple payment attempts per sale |

The sale is never blocked by a pending payment, but **unresolved payments are surfaced**
in the shift closing (FR-SETTLE-002) and in the HQ payment exceptions queue.

---

## 6. Voids and corrections

| Action | Who | Requirements | Effects |
| --- | --- | --- | --- |
| Void | Supervisor / HQ (Finance or Ops in scope) | Reason (controlled list), same-business-day default; later voids escalate for approval | Original retained; reversal recorded; shift totals reflect net; audit event |
| Correct | Same as void | Reason + explicit field-level diff | New sale referencing the original; both retained; net effect computed |
| Edit in place | **Nobody, ever** | — | Forbidden by design |

Voiding is *not* the same as "the customer changed their mind before paying" — that is
`DISCARDED` at the device level and never reaches the books.

---

## 7. Data captured per sale

| Field | Why | Notes |
| --- | --- | --- |
| `saleId` | Identity | Server UUIDv7 |
| `clientSaleId` | Idempotency + reconciliation | Device-generated; unique per org forever |
| `shiftId`, `operatorId`, `stallId` | Accountability | Mandatory |
| `sellingLocationId` | Where | Mandatory (from the shift's current report) |
| `occurredAt` | Business fact time | Device clock, validated for skew |
| `acceptedAt` | Server time | Ordering truth for money |
| `businessDay` | Reporting | Derived server-side (ADR-0033) |
| `items[]` | What | With snapshots and provenance |
| `total` | How much | Integer minor units |
| `payment` | How paid | Method + status + provider refs |
| `adjustments[]` | Discounts/packages/rewards | Explicit lines, never price edits |
| `loyaltyRef` | Optional customer link | Opaque customer reference |
| `note` | Rare free text | Bounded length, no PII expectations |

---

## 8. Reporting and search

| Need | How |
| --- | --- |
| Shift totals | Sum of COMPLETED (net of voids) per shift |
| Operator totals | Aggregate per operator per business day |
| Location totals | Aggregate per selling point; used for baselines |
| Item mix | Aggregate by menu item (snapshots unchanged; catalog changes don't matter) |
| Margin proxy | Realized price (from snapshots) vs base policy at that time — **not** a profit figure |
| Audit search | By client id, sale id, time, operator, location, amount band |

**Never**: recomputing historical totals from current prices or current menu availability.

---

## 9. Concurrency cases specific to sales

| Case | Required behaviour |
| --- | --- |
| Same sale retried (network) | Idempotency key ⇒ single sale; identical response (marked replay) |
| Two devices, same `clientSaleId` | Same as above; second device reconciles to the canonical record |
| Price changed while sale is open | Server resolves at acceptance; mismatch ⇒ operator confirmation, never a silent price change |
| Operator closes shift while sales are pending sync | Closing submission reports the missing client IDs; server refuses to accept an incomplete closing as final |
| Sale recorded after closing started | Accepted only if `occurredAt` precedes the closing start; otherwise it becomes a "late sale" exception with HQ visibility |
| Duplicate loyaly earn on replay | Earn is idempotent by sale reference (later slice) |
| Void of an already-voided sale | Rejected with `INVALID_TRANSITION` |

---

## Implemented Transactions page slice

The `/transactions` UI lists persisted sales, supports server-side business-day/outlet/status filters, shows direct detail records, and creates online cash transactions from an authorized open shift. The page reads only via `/api/v1/transactions`; it does not use dashboard/demo records. The authoritative price is resolved at the server boundary and cash completion uses the established sale/payment features. Digital methods and sale correction/void controls are intentionally unavailable in this page until their provider/reversal invariants are ready. See `docs/integration/05-transactions-ground-truth.md` and `docs/integration/05-transactions-gap-report.md` for implementation truth and current gaps.
