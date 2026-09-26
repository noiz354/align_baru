# STALLS

**Document ID:** DOC-STALLS
**Status:** Phase 0
**Related:** `FR-STALL-*`, `STATE_MACHINE.md` §3, `INVENTORY.md`, `LOCATIONS.md`

---

## 1. Concept

A **stall** is the physical vending asset. It persists across days, operators, and locations.

```text
Stall ──assigned to──► Operator (per shift, not permanently)
  │
  ├── sold at ──► SellingLocation (over time, many)
  ├── stocked with ──► StockItems (issued, consumed, returned)
  └── equipped with ──► Equipment (burner, steamer, cooler, signage, umbrella…)
```

A stall is *not* the operator and *not* the location — conflating these is the most common
modelling mistake in street-food operations, and it breaks attribution of cash, stock, and
performance. SiomayOps separates all three.

---

## 2. Stall types (configuration, not code)

| Code | Type | Notes |
| --- | --- | --- |
| `CART` | Robok / cart | Most common; pushed or parked |
| `PUSH_CART` | Gerobak dorong | Heavier, needs a parking-like spot |
| `MOTORCYCLE_SETUP` | Motor + box | Mobile by default; moves more often |
| `KIOSK_SMALL` | Small kiosk | Semi-fixed; may have utilities |
| `TEMPORARY_STAND` | Event/stand | Bazaar, event, market day |

Types are rows in a configurable catalog (`FR-STALL-002`) so a new city with a different
street format does not require a release.

---

## 3. Stall profile

```ts
interface Stall {
  stallId: string;
  stallCode: string;                 // human-readable, unique: STL-JKT-014
  organizationId: string;

  typeCode: string;                  // from configurable stall type catalog
  homeAreaId: string;                // owning area (accountability home)
  status: StallStatus;               // see §4

  assignedOperatorIds: string[];     // current assignments (usually 1)
  equipment: StallEquipmentItem[];   // name, quantity, condition, lastCheckedAt?
  capacityNotes?: string;            // e.g. max portions per load, cooler size

  signage: { name: string; brandColorsRef?: string };
  notes?: string;
}
```

Human-readable codes matter: HQ talks about "014" on the phone, and incident reports,
handovers, and stock issues all need a short handle that survives a broken screen.

---

## 4. Stall status life cycle

```text
AVAILABLE ──assign──► ASSIGNED ──deploy──► IN_USE ──return──► AVAILABLE
     ▲                                          │
     │                                          └──► MAINTENANCE ──► AVAILABLE
     └──────────────── RETIRED (terminal) ◄──────┴── (any state without active shift)
```

| Status | Meaning | Can start a shift? |
| --- | --- | --- |
| AVAILABLE | Ready for assignment | No (must be ASSIGNED) |
| ASSIGNED | Has a current operator assignment | Yes (with operator confirmed) |
| IN_USE | Currently deployed with an active shift | Yes (already) |
| MAINTENANCE | Out of service (reason recorded) | No |
| RETIRED | Permanently out of service (audited) | No |

Rules: MAINTENANCE requires a reason; RETIRED requires HQ permission and audit; a stall with
an active shift cannot enter MAINTENANCE or RETIRED until the shift is closed or handed over.

---

## 5. Equipment tracking

| Field | Purpose | Notes |
| --- | --- | --- |
| `name` / `typeCode` | What it is | e.g. `STEAMER`, `BURNER`, `COOLER`, `UMBRELLA`, `SIGNAGE` |
| `quantity` | How many | Integers only |
| `condition` | `GOOD` / `WORN` / `NEEDS_REPAIR` / `BROKEN` | Drives maintenance and incident links |
| `lastCheckedAt` | Last verification | Kept light — no equipment IoT, no checklists marathon |
| `replacementCostMinor?` | Optional | For future asset reporting, not accounting |

Equipment condition updates are a first-class source of **incidents** (equipment damage) and a
common reason for a stall's operational day to change shape (early closing, shared equipment).

---

## 6. Stall ↔ assignment ↔ shift relationships

```text
Stall 1─* OperatorAssignment (valid_from, valid_to, type)
Stall 1─* Shift (one per business day per stall in practice)
Stall 1─* StockMovement (issue/return)
Stall 1─* Incident
Stall 1─* LocationReport (via Shift)
```

### Invariants

| # | Invariant |
| --- | --- |
| ST-INV-01 | A stall has at most one ACTIVE shift at any instant (excluding an explicit, recorded handover overlap ≤ configured minutes). |
| ST-INV-02 | A stall's `homeAreaId` never changes silently; a change is an audited HQ action. |
| ST-INV-03 | A stall cannot be assigned to two PRIMARY operators simultaneously. |
| ST-INV-04 | Equipment condition changes are recorded with actor + timestamp. |
| ST-INV-05 | Historical shift attribution is never rewritten when a stall is reassigned or retired. |
| ST-INV-06 | A retired stall remains queryable forever for audit and financial history. |

---

## 7. Fleet-level (HQ) concerns

| Concern | HQ needs | Card / view |
| --- | --- | --- |
| Utilisation | Which stalls are deployed today vs idle vs in maintenance | Fleet utilisation (HK: `docs/design/PAGES.md` `/hq/stalls`) |
| Distribution | Stalls per area vs demand | Area assignment view |
| Condition | Equipment needing repair before it costs a selling day | Equipment watchlist |
| Performance by asset | Do some carts consistently underperform (location vs equipment vs operator)? | Stall performance comparison (context-aware) |
| Lifecycle | Ageing assets, replacement planning | Retirement queue (no depreciation accounting) |

**Important:** stall performance comparisons must warn about confounders (location traffic,
weather, operator experience) and must never be published as a ranking of operators
(see `PERFORMANCE.md` §5).

---

## 8. Data protection notes

- A stall is equipment, not a person: no personal data here beyond the operator link.
- Equipment photos (if ever captured) may incidentally show people; retention is short and
  access is restricted (`RETENTION.md`).
- Stall location history equals operator location history; the privacy stance of ADR-0007
  applies unchanged.
