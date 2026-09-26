# PRICING

**Document ID:** DOC-PRICING
**Status:** Phase 0 (specification; **no resolution algorithm implemented**)
**Related:** FR-PRICE-*, ADR-0008, ADR-0009, ADR-0010, ADR-0006, `MENU.md`, `SALES.md`

---

## 1. Why pricing is location-aware

Siomay pricing varies by location because costs and willingness to pay vary by location:
a spot near an office tower at 17:00 is not the same market as a market lane at 09:00.
HQ sets the intent; areas and locations adapt; the platform keeps all of it auditable and
never rewrites the past.

---

## 2. Resolution hierarchy

```text
HQ Base Price                (organization-wide default per menu item)
      ↓
Area Price                   (override for an area)
      ↓
Selling Location Price       (override for a specific mangkal point)
      ↓
Temporary Override           (time-boxed: event, promotion, special package)
      ↓
Effective Price              (what the operator is charged at sale time)
```

### Deterministic resolution rules (ADR-0008)

Given `(menuItemId, sellingLocationId, at: instant)`:

1. Collect all **active** policies where `effectiveFrom ≤ at < effectiveUntil` (open-ended if
   no end).
2. Filter to policies whose scope matches: `ORG`, the item's `AREA`, or the `LOCATION`.
3. Order candidates by **specificity**: `LOCATION` > `AREA` > `ORG`.
4. Within equal specificity, choose the **most recent `effectiveFrom`**.
5. If two candidates tie exactly, the resolution **fails loudly** (`PRICE_RESOLUTION_AMBIGUOUS`)
   and blocks the sale rather than guessing.
6. If no policy exists at any level, the item is **not sellable** at that location (there is no
   implicit zero price).
7. Temporary overrides are modelled as `LOCATION`-scope policies with an expiry; they never
   bypass rules 1–5.

**Every resolution returns provenance**: the policy id(s) used, so the sale can store
`price_policy_id` alongside the snapshot (`INV-01`).

---

## 3. Price policy model

```ts
/**
 * Defines the price of an item under a particular operational scope.
 *
 * Resolution follows: HQ → Area → Location → Temporary Override.
 *
 * TODO(T-PRICE-012): Implement deterministic price resolution.
 */
interface PricePolicy {
  id: string;
  menuItemId: string;

  scope: PriceScope;          // "ORG" | "AREA" | "LOCATION"
  scopeRefId: string;         // areaId or sellingLocationId when scoped

  amount: Money;              // integer minor units + currency

  effectiveFrom: Date;
  effectiveUntil?: Date;

  reason: string;             // required, human explanation
  createdBy: string;
  approvedBy?: string;        // required when HQ policy requires approval
  version: number;            // optimistic concurrency for concurrent HQ edits
}
```

### Price change workflow

```text
HQ Creates Price Policy
      ↓
Applies to Area / Location
      ↓
Operator Receives Update (in-app + optional notification)
      ↓
Operator Confirms  (acknowledgement bound to a price digest)
      ↓
New Price Becomes Effective
```

Every change records: **old price, new price, effective date, scope, reason, created by,
approved by (if required)** — FR-PRICE-003.

Operational rules:

1. **Future-dated is the default.** A change takes effect at `effectiveFrom`; it does not
   retroactively apply to sales already recorded.
2. **No silent historical rewrites.** A past sale's snapshot is frozen (ADR-0010).
3. **Acknowledgement is digest-bound** (API §4): an operator is only credited with
   acknowledging the price set they actually saw.
4. **Unacknowledged price changes surface as alerts** (`PRICE_NOT_ACKNOWLEDGED`) with a
   per-operator list for HQ.
5. **Sale-time mismatch is honest**: if a device holds a stale price, the server returns
   `409 STALE_DATA` with the new effective price and the operator is asked to confirm
   (FR-PRICE-010, NFR-OFFLINE-010).

---

## 4. Local price override — decision (ADR-0009)

**Question:** may an operator override a price?

**Decision:** **Yes, with explicit, bounded, audited authority.** Three available modes, chosen
per organisation and per location, all auditable:

| Mode | Who can override | Conditions | Risk control |
| --- | --- | --- | --- |
| `HQ_ONLY` | Nobody in the field | Default for high-margin or controlled items | Zero field discretion |
| `SUPERVISOR_APPROVED` | Operator requests, supervisor approves | Reason required; approval window (e.g. 30 min); works offline as **request** and takes effect only when approved | Server-verified approval; no unapproved override ever applies |
| `OPERATOR_ALLOWED` | Operator with `CERTIFIED` training state, within bounds | Allowed reasons only; bounded % or absolute cap; automatic expiry (end of shift or ≤ 24 h); counted per operator per day | Bounds + expiry + audit + HQ daily digest |

### Override reasons (controlled list)

`EVENT` · `LOCATION_FEE` · `PROMOTION` · `TEMPORARY_POLICY` · `SPECIAL_PACKAGE` · `OTHER`
(`OTHER` requires a note).

### Override record

```ts
interface PriceOverride {
  id: string;
  menuItemId: string;
  sellingLocationId: string;
  shiftId: string;

  basePolicyId: string;
  baseAmount: Money;

  overrideAmount: Money;
  reason: PriceOverrideReason;
  note?: string;

  authorizedBy: "OPERATOR" | "SUPERVISOR" | "HQ";
  approverId?: string;

  effectiveFrom: Date;
  effectiveUntil: Date;      // never open-ended

  status: "REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdBy: string;
}
```

### What overrides must never do

1. Change the price of an already-recorded sale (the snapshot wins).
2. Silence the price-change audit trail.
3. Be applied without a bounded validity window.
4. Be used as a hidden channel for discounts that never reach HQ reporting — every override is
   visible in daily margin reporting.
5. Reduce price below a configured floor where one exists (floor breach ⇒ supervisor approval
   or refusal).

---

## 5. Discounts, packages, and promotions

| Mechanism | Model | Rule |
| --- | --- | --- |
| Discount | Sale-level `SaleAdjustment` (amount or percent, with reason) | Never implemented by editing unit prices |
| Package/combo | Menu item of type `PACKAGE` with components | Components keep their own stock relationships; price comes from the package item's policy |
| Promotion | Temporary `LOCATION`/`AREA` policy or package price, always expiring | Same audit rules as any price |
| Loyalty reward | Sale adjustment (discount/free item) with redemption reference | Never a price override (FR-LOYALTY-004) |

Rationale (FR-PRICE-012): keeping adjustments separate from unit prices preserves margin
analytics and makes reconciliation honest.

---

## 6. Display rules for operators

1. The POS shows **one price per item** — the effective one. Operators are not shown the
   policy hierarchy; that is HQ's model.
2. If an item is unavailable at this location, it is hidden (or shown greyed with the reason
   "tidak dijual di sini") rather than silently showing a wrong price.
3. Price freshness dot: fresh (synced < 24 h), amber (cached > 24 h), red (stale/unverified —
   confirm before selling).
4. When the server returns a price different from the device cache, the operator sees a plain
   message: *"Harga berubah: Siomay Rp 10.000 → Rp 11.000. Setuju?"* with a single confirm.
5. Prices are shown in `Rp 10.000` format, no decimals, no abbreviations in the field UI.

---

## 7. Money and rounding rules (see ADR-0006)

- All amounts are integer minor units. For IDR, minor unit = 1 rupiah (no circulating sen),
  so stored values are whole rupiah.
- Percent discounts: computed with **half-up rounding to the nearest rupiah**, applied once at
  the adjustment line, never per item mid-calculation.
- Package prices: the package price is authoritative; component prices are informational and
  never summed to derive the package price (prevents drift).
- Currency: IDR for MVP; every money value carries an explicit currency code so a future
  multi-currency operation is a data change, not a rewrite.
- No tax handling in Phase 0; if ever required, it is a new ADR (tax is policy, not arithmetic).

---

## 8. HQ pricing surfaces (planned)

| Surface | Purpose |
| --- | --- |
| Price policy list (filter by item/area/location/status) | See what is in force and what is coming |
| Price change draft → review → publish | Approval flow with diff (old → new) |
| Acknowledgement tracker | Who has not confirmed a change |
| Override ledger | All overrides with reasons and approvers |
| Margin view by location | Base price vs actual realized price per location (uses snapshots, not current prices) |
| Price history per item | Full temporal history; exportable for audit |

---

## 9. Edge cases and failure modes

| Case | Handling |
| --- | --- |
| Price change published while a sale is open on a device | Server resolves at acceptance; mismatch ⇒ `STALE_DATA` and operator confirmation |
| Two HQ users edit the same policy | Optimistic concurrency (`version`); second edit rejected with a diff |
| Override expires mid-shift | Subsequent sales use the base policy; the operator is notified at expiry |
| Location becomes RESTRICTED with an active policy | Policy remains for history; new shifts at that location are discouraged; existing shift continues (business reality wins over a status flag) |
| Item unavailable at location but operator needs to sell it | Operator cannot invent a price; HQ must publish a policy or grant an override |
| Policy deleted by mistake | Deletion is soft (`INACTIVE` with reason); policy history is never destroyed |
| Ambiguous resolution (two equal-specificity policies) | Fail loudly, block sale, alert HQ — never guess |
