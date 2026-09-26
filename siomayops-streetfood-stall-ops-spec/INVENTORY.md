# INVENTORY

**Document ID:** DOC-INVENTORY
**Status:** Phase 0 (specification; **no stock deduction implemented**)
**Related:** FR-STOCK-*, ADR-0030, `docs/finance/STOCK-VARIANCE.md`, `MENU.md`, `STALLS.md`

---

## 1. Scope and philosophy

Inventory here is **operational stock**, not warehouse ERP. The goal is: know what a stall
should have, know what it actually has, and make the difference explainable without turning
operators into stock clerks.

```text
HQ / Kitchen
    ↓ Stock Issue
Operator / Stall
    ↓ Starting Stock (per shift)
Sales  → consumption
Waste / Damage / Sample / Staff meal
    ↓
Ending Stock (counted)
    ↓
Variance (expected vs actual) → reason
```

**Non-negotiable:** variance is a question, never an accusation (FR-STOCK-006, ADR-0030).

---

## 2. Stock item model

```ts
interface StockItem {
  stockItemId: string;
  organizationId: string;

  code: string;                      // stable, human-friendly: SIOMAY-PORSI
  name: string;                      // "Siomay (porsi)"
  category: StockCategory;           // SELLABLE | INGREDIENT | PACKAGING | CONSUMABLE | EQUIPMENT_CONSUMABLE
  unit: string;                      // porsi, pcs, pack, botol, tabung

  discrete: boolean;                 // true ⇒ integer quantities enforced
  lowThreshold?: number;             // STOCK_LOW band
  criticalThreshold?: number;        // STOCK_CRITICAL band

  active: boolean;
  notes?: string;
}
```

Example catalog (**configuration, never hard-coded**): siomay portions, batagor, tahu, kentang,
telur, pare, peanut sauce, chili, lime, packaging, plastic bags, tissue, drinks, gas.

### Categories

| Category | Meaning | Typical tracking |
| --- | --- | --- |
| `SELLABLE` | Sold as-is (portions, drinks) | Counted per shift |
| `INGREDIENT` | Consumed to produce (sauce, chili) | Periodic count |
| `PACKAGING` | Bags, boxes, tissues | Periodic count / per-sale estimate |
| `CONSUMABLE` | Gas, ice, water | Periodic count |
| `EQUIPMENT_CONSUMABLE` | Burner parts, cloths | On-replacement |

---

## 3. Movements (append-only ledger of goods)

```ts
interface StockMovement {
  id: string;
  stockItemId: string;

  stallId?: string;
  operatorId?: string;
  shiftId?: string;

  movementType:
    | "ISSUE"                 // HQ/kitchen → operator
    | "RETURN"                // operator → HQ/kitchen
    | "SALE_CONSUMPTION"      // implied by a sale (later slice)
    | "WASTE"                 // spoiled/unusable
    | "DAMAGE"                // broken/ruined
    | "SAMPLE"                // given away to attract customers
    | "STAFF_MEAL"            // consumed by staff (policy-visible)
    | "MANUAL_ADJUSTMENT"     // correction (reason required)
    | "MEASUREMENT_DIFFERENCE"// rounding/estimation mismatch
    | "UNKNOWN";              // honest "we don't know"

  quantity: number;           // signed by convention: +in, −out
  occurredAt: Date;
  reason?: string;
  actorId: string;
  clientMovementId: string;   // offline idempotency
}
```

Rules:

1. Movements are **immutable**; corrections are opposing movements with reasons.
2. Positions are **derived** (`SUM(movements)`), never a mutable counter (INV-13).
3. Every movement carries an actor; system-generated consumption carries the shift/operator.
4. `MANUAL_ADJUSTMENT` and `UNKNOWN` require a reason and appear in variance reporting.

---

## 4. Stock transfer (warehouse ⇄ operator)

```text
REQUESTED ──► ISSUED ──in transit──► RECEIVED ──► RECONCILED (discrepancy resolved)
     │            │                      │
     └──cancel────┴──cancel (pre-dispatch)┘
```

| Step | Actor | Data |
| --- | --- | --- |
| Request | Operator | Items, quantities, urgency, requested-for date |
| Issue | Warehouse operator | Actual quantities dispatched, batch/time |
| Receive | Operator | Counted quantities; discrepancy flag if different |
| Reconcile | Warehouse/HQ Ops | Reason for any difference; audit |

Discrepancies are normal (transport loss, miscount) and are **recorded, not punished**.

---

## 5. Shift stock snapshots and variance

| Phase | Captured | Notes |
| --- | --- | --- |
| `START` | Counted starting quantities (or confirmed issue quantities) | Confirming the issued amount in one tap is allowed when there's no reason to doubt it |
| `END` | Counted ending quantities | Prompts only for the items that matter most (discrete, high-value) |
| Expected end | Derived: start + issued − consumption − recorded waste/etc. | Computed by the system |
| Variance | Expected − counted | Prompt for a reason when beyond tolerance |

### Variance reasons (controlled list)

`WASTE` · `DAMAGED` · `FREE_SAMPLE` · `STAFF_MEAL` · `MANUAL_CORRECTION` ·
`MEASUREMENT_DIFFERENCE` · `UNKNOWN`

Rules:

1. `UNKNOWN` is always available and is a **first-class, acceptable answer** (DESIGN.md §6).
2. Reason is required only beyond tolerance; small variances are recorded without ceremony.
3. Variances are aggregated for HQ per item/location to find systemic issues (e.g. always the
   same sauce at the same spot).
4. The system never adjusts a count to match expectations; it records both numbers.

---

## 6. Alerts and thresholds

| Alert | Trigger | Actionability |
| --- | --- | --- |
| `STOCK_LOW` | Position ≤ low threshold | Show restock suggestion; notify warehouse |
| `STOCK_CRITICAL` | Position ≤ critical threshold | Escalate; coordinator may reroute stock |
| Repeated variance | Same item/location beyond tolerance N times | HQ Ops review item (aggregate) |
| Missing END count | Shift closed without counted items | HQ visibility; closing flagged as partial |

Alerts never block selling, never auto-order stock, and never message the operator in an
accusatory tone.

---

## 7. What we do NOT do

| Not done | Why |
| --- | --- |
| Real-time per-sale stock deduction (Phase 0) | Requires the sales domain to be stable first (VS-8 depends on VS-5/9) |
| Barcode/RFID/IoT weighing | Cost, complexity, and street conditions |
| Full warehouse ERP (bins, lots, expiry-driven FIFO) | Beyond operational need; revisit only if a central kitchen requires it |
| Precision claims on measured items (sauce by volume) | We track estimates honestly as estimates |
| Automated reordering | Humans decide; the system suggests |
| Treating variance as fraud | Explicitly forbidden (ADR-0030) |

---

## 8. Data protection and people

- Stock records belong to the business, not the person; operator linkage exists for
  accountability and must not be repurposed as a performance punishment (FR-PERF-004).
- Stock variance history is visible to the operator themself — transparency reduces disputes.
- Aggregated variance analytics are shared with HQ Ops; individual naming beyond the shift
  record requires a review process, not a dashboard drill-down.
