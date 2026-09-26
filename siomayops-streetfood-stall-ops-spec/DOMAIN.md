# DOMAIN — Vocabulary, Aggregates, Invariants

**Document ID:** DOC-DOMAIN
**Status:** Phase 0
**Related:** `DATA_MODEL.md`, `STATE_MACHINE.md`, `EVENTS.md`, `GLOSSARY.md`

---

## 1. Ubiquitous language (bilingual by design)

The system speaks **two dialects on purpose**: operators speak plainly; the domain model and
HQ use precise terms. Mapping both directions is part of the design (`DESIGN.md` §7).

| Domain term | Operator phrase (ID) | Meaning |
| --- | --- | --- |
| Organization | Perusahaan | The business entity that owns everything (multi-tenant root). |
| Region | Wilayah | Top-level geographic grouping (e.g. Jakarta, Bandung). |
| Area | Area | Operational grouping with a supervisor; owns selling points. |
| Selling point (mangkal) | Lokasi jualan / mangkal | A place where a stall may sell: name, address, pin, landmark, windows, notes, status. |
| Food stall | Gerobak / stan | The physical vending asset (cart, push cart, motorbike setup, kiosk, stand). |
| Operator | Penjual / abang / mas | The person who runs a stall and is accountable for its cash and stock. |
| Shift | Shift | A bounded working session of one operator on one stall. |
| Handover | Serah terima | Transfer of an active stall between operators mid-day. |
| Assignment | Penugasan | Planned pairing of operator ↔ stall ↔ area for a day or period. |
| Menu item | Menu | A sellable or component item (configurable; never hard-coded). |
| Price policy | Harga | A scoped price rule for an item (HQ / area / location / temporary). |
| Price snapshot | Harga saat transaksi | The resolved unit price stored immutably on a sale line. |
| Sale | Penjualan | A completed transaction with items, snapshots and a payment. |
| Payment | Pembayaran | Money movement for a sale: CASH, QRIS, BANK_TRANSFER, E_WALLET, other approved. |
| Field expense | Uang keluar di lapangan | An operational cost reported by an operator. |
| Unverified field expense | Biaya tak terduga di lapangan | Neutrally recorded report of a payment demanded in the field; no claim about recipient or purpose. |
| Cash count | Hitung uang | Operator's physical count of the cash box at closing. |
| Closing | Setoran / tutup hari | End-of-shift reconciliation submission: sales, expenses, cash, stock. |
| Settlement | Pencairan | Provider → bank outcome for digital payments, matched against expected amounts. |
| Stock issue | Kirim barang | Warehouse/kitchen → operator transfer of stock. |
| Stock movement | Pergerakan stok | An append-only record of stock changing hands or state. |
| Stock variance | Selisih stok | Expected ending stock vs counted ending stock. |
| Loyalty account | Kartu pelanggan | Optional customer identity (phone, QR token, or anonymous device token). |
| Reward | Hadiah | A single-use, server-issued redemption entitlement. |
| Incident | Kejadian | Reported operational problem with a lifecycle and severity. |
| Alert | Peringatan | An actionable system notification about a condition needing action. |
| Recognition | Penghargaan | Periodic, multi-factor, normalised acknowledgement of operators. |
| Audit event | Jejak audit | Append-only record of a critical state change: who/what/when/before/after/reason. |

Terms we deliberately **avoid** in the field UI: debit, credit, ledger, journal, accrual,
reconciliation, depreciation, amortisation, variance adjustment.

---

## 2. Aggregate map

```text
Organization (tenant root)
 ├── Region ── Area ── SellingPoint
 ├── Operator ── Assignment
 ├── Stall ── StallEquipment
 ├── MenuItem ── MenuCategory
 ├── PricePolicy ── PriceOverride ── PriceAcknowledgement
 └── (tenant-scoped everything below)

Shift  ◄── operator, stall, sellingLocation, businessDay
 ├── StockSnapshot (start / end)
 ├── Sale
 │     ├── SaleItem (snapshot price)
 │     ├── Payment ── PaymentAttempt ── PaymentCallback
 │     └── LoyaltyTransaction (earn/redeem reference)
 ├── Expense
 ├── Incident
 ├── Message (threaded by shift/stall/area)
 ├── Handover
 └── ShiftClosing ── SettlementMatch

LoyaltyAccount ── LoyaltyTransaction ── Reward ── RewardRedemption
StockItem ── StockMovement ── StockTransfer
OperatorMetric ── RecognitionPeriod ── RecognitionResult
AuditEvent (append-only, references any aggregate)
```

---

## 3. Aggregate boundaries and consistency rules

| Aggregate | Root | Consistency boundary | Rationale |
| --- | --- | --- | --- |
| **Shift** | `Shift` | Sales, expenses, handover and closing of one shift are transactional units. | All money of a shift must reconcile together; a shift is the unit of accountability. |
| **Sale** | `Sale` | Sale + items + its payments are written in one transaction. | A sale with a missing payment or a payment without a sale is corruption. |
| **Payment** | `Payment` | Payment state + attempts + verified callbacks. | State transitions must be serialised per payment to prevent double credit. |
| **SellingPoint** | `SellingPoint` | Location attributes and status. | Low-contention, rarely-changing reference data. |
| **Stall** | `Stall` | Stall attributes + equipment list. | Reference data; assignment references it. |
| **Operator** | `Operator` | Profile + operational status + assignment links. | Status changes must not race with shift start. |
| **PricePolicy** | `PricePolicy` | One rule + its validity window + approvals. | Resolution reads many; writes are rare and must be audited. |
| **StockItem** | `StockItem` (per stall/operator position) | Movements are append-only; position is derived. | Derived positions avoid double-decrement bugs; history is the truth. |
| **LoyaltyAccount** | `LoyaltyAccount` | Balance + transactions + redemptions. | Redemption must be serialised to prevent double-spend. |
| **RecognitionPeriod** | `RecognitionPeriod` | Period, weights, results, overrides. | Results must be reproducible from stored facts. |

**Cross-aggregate rule:** references by ID only. No aggregate mutates another aggregate's
internals; coordination happens in a use case (`features/*`) inside a single database
transaction where possible, or via an outbox event where not.

---

## 4. Core invariants (must hold at all times)

| # | Invariant | Enforcement (planned) |
| --- | --- | --- |
| INV-01 | A sale line always has a unit price snapshot; totals derive from snapshots. | Domain construction + DB NOT NULL + test. |
| INV-02 | Every sale, payment, expense and stock movement belongs to exactly one shift. | FK + NOT NULL + test. |
| INV-03 | An operator has at most one ACTIVE shift. | Partial unique index on (operator_id) where status in ('OPEN','ACTIVE','PAUSED','CLOSING'). |
| INV-04 | A stall has at most one ACTIVE shift (excluding an explicit handover overlap window). | Partial unique index + handover exception recorded. |
| INV-05 | Cash totals are integers in minor units; no float arithmetic anywhere in the money path. | `Money` value object + lint ban on `number` money fields. |
| INV-06 | A payment can be `PAID` only with a verified evidence reference. | State machine guard + DB constraint on evidence reference for digital methods. |
| INV-07 | A reward instance can be redeemed at most once. | Unique constraint on redemption per reward instance. |
| INV-08 | Price snapshots are immutable; corrections create new records. | Update triggers denied / append-only write policy + tests. |
| INV-09 | Closed shifts are immutable except through audited corrections. | Status guard + audit event requirement. |
| INV-10 | Every money-affecting mutation has an audit event with an actor and reason. | Use-case wrapper + integration test. |
| INV-11 | Location reports only exist for an active shift. | Guard in use case + FK to shift + test. |
| INV-12 | Expense review transitions are monotonic and recorded. | State machine + audit. |
| INV-13 | Stock position is derived from movements; no direct writes to a position column. | Repository design + tests. |
| INV-14 | Every record is tenant-scoped (`organization_id`) and every repository method requires a scope. | Signature-level requirement + lint rule. |
| INV-15 | Idempotency keys are unique per (organization, route, key). | DB unique record per key + replay handling. |

---

## 5. Domain concepts that are deliberately *not* modelled in Phase 0

| Concept | Why deferred |
| --- | --- |
| General ledger / chart of accounts | This is an operations system, not an accounting system (`PRD.md` non-goals). |
| Tax computation | Requires jurisdiction policy and legal review; out of scope. |
| Payroll / commissions | Not required for operational visibility; sensitive; separate concern. |
| Supplier procurement | Out of scope; stock issue is modelled, purchasing is not. |
| Route optimisation / dispatch | Humans know the street; product non-goal. |
| Customer ordering | Different product; see non-goals. |
| Machine-learned fraud scoring | Ethics + explainability; explicit non-goal (`PRD.md` §3, ADR-0029). |
| Permission status of a selling point ("legal?" / "licensed?") | The system must not assume or record official status unless explicitly verified; see FR-LOCATION-010. |

---

## 6. Language rules for implementers

1. Name things as the domain names them — `ShiftClosing`, not `EndOfDayReport`.
2. Money is `Money`, never `amount: number`.
3. Time is always two fields when it matters: `occurredAt` (UTC instant) and
   `businessDay` (date in Asia/Jakarta, computed explicitly).
4. Statuses are string unions with an explicit mapping to display text; never booleans.
   (`isClosed` is not a thing; `status === 'CLOSED'` is.)
5. IDs are opaque strings; never assume they are sequential or meaningful.
6. Every function that changes money or accountability has a **reason** parameter or an
   explicit "no reason required" justification in the ADR/product doc.
7. Never invent a person's intent in the data model. `UNVERIFIED_FIELD_EXPENSE` is a report,
   not a verdict.
