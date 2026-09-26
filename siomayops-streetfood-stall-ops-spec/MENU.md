# MENU

**Document ID:** DOC-MENU
**Status:** Phase 0 (catalog is configuration — **nothing hard-coded**)
**Related:** FR-MENU-*, ADR-0025, `PRICING.md`, `INVENTORY.md`, `SALES.md`

---

## 1. Principle: the menu is data

Menu items differ by region, season, and operator skill. The application must ship **zero**
siomay-specific knowledge in code (ADR-0025). Everything below is configuration.

Example catalog (illustrative, *not* code):

```text
Siomay          (item, sold by portion)
Batagor         (item, fried variant)
Tahu            (item)
Kentang         (item)
Telur           (item)
Pare            (item, bitter gourd)
Saus Kacang     (component / add-on)
Sambal          (add-on)
Jeruk Limau     (add-on)
Extra Saus      (add-on)
Minuman         (category with sub-items)
Paket Hemat     (package: 5 siomay + tahu + drink)
```

---

## 2. Menu item model

```ts
interface MenuItem {
  menuItemId: string;
  organizationId: string;

  name: string;
  categoryId: string;

  portionNote?: string;        // "5 pcs", "1 porsi", "1 gelas" — operator-visible
  basePriceRef?: string;       // reference only; effective price comes from PricePolicy
  active: boolean;

  isComponent: boolean;        // sauces, add-ons
  isPackage: boolean;          // combos
  components?: Array<{ menuItemId: string; quantity: number }>;

  stockItemId?: string;        // 1:1 link when the item maps to one stock item
  stockQuantityPerSale?: number; // e.g. 1 portion consumes 1 siomay portion

  sortOrder: number;           // operator grid ordering — matters for speed
  colorToken?: string;         // visual grouping in the POS grid
  synonyms?: string[];         // local names per area (search + recognition)
}
```

### Availability

```ts
interface MenuAvailability {
  menuItemId: string;
  scope: "ORG" | "AREA" | "LOCATION";
  scopeRefId?: string;
  available: boolean;
  reason?: string;             // "tidak dijual di lokasi ini", "musiman"
  effectiveFrom?: Date;
  effectiveUntil?: Date;
  timeWindows?: Array<{ startLocalTime: string; endLocalTime: string }>;
}
```

Rules:

1. **Location-specific availability is first-class** (FR-MENU-003): a stall near a school may
   not sell the expensive package; a market stall may not sell drinks if a neighbour does.
2. Unavailable items are hidden from the POS grid by default, with a "lihat semua" option for
   transparency.
3. Time-window availability is **advisory in the POS** (soft warning) and strict in reporting.
4. Availability changes are audited and visible in the HQ menu view.

---

## 3. Packages and components

```text
Paket Hemat (price 25.000)
 ├── Siomay ×5
 ├── Tahu ×1
 └── Minuman ×1
```

Rules:

1. The package has its own price policy; component prices are never summed to derive it.
2. Component stock relationships still apply (selling a package consumes its components).
3. A package can be composed with items that are individually sellable.
4. Editing a package changes future sales only; historical sales retain their snapshot
   structure (package identity + component list at sale time is stored as line metadata).

---

## 4. Menu ↔ stock relationship

| Relationship | Model | Consequence |
| --- | --- | --- |
| 1:1 discrete | `stockItemId` + `stockQuantityPerSale` | Sale decrements stock (later slice, idempotent) |
| Approximate (sauce by volume) | `stockItemId` with measurement unit | Stock updated by periodic count, not per sale |
| None | no link | Item sold, no stock effect tracked (e.g. service fee) |

Stock effects are **planned, not implemented** (Phase 0) and are always derived from
append-only movements (`INVENTORY.md`), never from a mutable counter.

---

## 5. Operator POS grid design rules

The menu is an interface, not just a list:

1. **Order matters**: `sortOrder` is set for speed — best sellers top-left.
2. **2–3 columns** on a 360 px screen; each tile ≥ 88 px tall with name + price + portion.
3. **Colour tokens group categories** (protein / fried / drinks / add-ons) — colour is
   secondary; names are always primary (NFR-ACCESS-004).
4. **Search appears only past a threshold** (e.g. > 16 active items); the pilot menu is
   tap-first.
5. **Recently sold / frequent items** get a "sering" strip at the top (local, per operator).
6. **No images by default** (data cost, NFR-PERF-005); optional small cached thumbnails if a
   deployment chooses them.
7. **Unavailable items** are hidden; the operator can reveal them and sees the reason.
8. **Price is on the tile** — never require a tap to discover price.

---

## 6. Offline behaviour

| Need | Behaviour |
| --- | --- |
| Menu list | Cached on device with `lastSyncedAt`; available offline (FR-MENU-007) |
| Prices | Cached with freshness marker; stale ⇒ confirm-before-sell path |
| Availability | Cached; a change made online while the device is offline is applied at sync |
| New item added by HQ | Appears after sync; the device does not need to know about items it cannot sell yet |
| Package composition change | Applied at sync; historical sales keep old composition |

---

## 7. Configuration governance

| Action | Permission | Audit |
| --- | --- | --- |
| Create/edit item | HQ Ops (with Finance notification for price-bearing changes) | ✅ |
| Change category/sort | HQ Ops | ✅ (sampled) |
| Change availability for a location | HQ Ops / Supervisor (in area) | ✅ |
| Retire item | HQ Ops; blocked if active policies exist without replacement | ✅ |
| Mass update (CSV) | HQ Ops + Finance review | ✅ full import log with row-level results |

**No hard-coded fallback menu.** If configuration is missing, the POS shows an explicit
"menu belum diatur untuk lokasi ini" state — never a developer's default list.
