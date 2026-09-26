# ADR-011: Resource Inventory — Three Quantity Modes, No Invented Precision

## Status
Accepted

## Date
2026-09-26

## Context
Households track consumables with wildly different measurement realities. Nobody weighs drinking water in litres remaining; nobody says toilet paper is "62%"; everyone can say "enough for a few days" or "last roll". Meanwhile some things *are* countable (12 eggs, 4 rolls, 2 kg rice). Any inventory model that forces one representation produces either false precision or unusable vagueness, and any model that demands constant updating is abandoned within a week (DP-3). The dangerous failure is silent depletion: running out of something the household needed.

## Problem
How do we model consumable levels so that (a) members can update in one or two taps, (b) the app knows when to raise a restock need, (c) nothing is displayed with precision that does not exist, and (d) no barcode/scanner/stock-algorithm complexity creeps in?

## Decision Drivers
- Update cost must be near-zero (FR-RES-004) or the data dies.
- Least-significant representation wins: approximate when approximate, exact when exact (DP-9).
- Threshold behaviour must be configurable but defaulted (FR-RES-005, FR-SET-006).
- Alert noise must stay low: many low items must not become many alerts (FR-RES-009).
- A restock action must close the loop (FR-RES-008) and feed shopping (FR-SHOP-001..003).

## Options Considered
1. **Three explicit quantity modes**: `EXACT` (count/measure), `APPROXIMATE` (ordinal level), `AVAILABLE_UNAVAILABLE` (binary) — each with its own threshold semantics.
2. **Numeric quantity only** (with unit) — precise for consumables nobody measures; guarantees stale or fake data.
3. **Ordinal levels only** (`FULL/ENOUGH/LOW/CRITICAL/EMPTY`) for everything — uniform and cheap, but cannot express "we have 2 rolls left, buy 6".
4. **Full inventory with recipes/consumption rates and forecasting** — needs consumption telemetry the household will never supply; produces confident nonsense ("you'll run out Thursday 4 p.m.").
5. **Manual shopping list only, no resource entities** — no thresholds, no alerting, no history; loses G-3 entirely.

## Decision
Adopt **(1)**: one resource entity with an explicit quantity mode and mode-appropriate level semantics.

| Mode | Level representation | Low trigger | Critical trigger | Display |
| --- | --- | --- | --- | --- |
| `EXACT` | integer quantity + unit (e.g. 2 rolls) | `quantity ≤ lowThreshold` (e.g. 3) | `quantity ≤ criticalThreshold` (e.g. 1) | "2 rolls" |
| `APPROXIMATE` | one of `FULL`, `ENOUGH`, `LOW`, `CRITICAL`, `EMPTY` | level ∈ {`LOW`,`CRITICAL`,`EMPTY`} | level ∈ {`CRITICAL`,`EMPTY`} | "Low", "Enough" |
| `AVAILABLE_UNAVAILABLE` | `AVAILABLE` \| `UNAVAILABLE` | n/a | level = `UNAVAILABLE` → `CRITICAL` | "Available" / "None" |

Rules:
- **One mode per resource**, set at creation, changeable only with an explicit conversion step (mode change resets the level; it is a recorded activity).
- **Quick update actions** are mode-specific: `EXACT` → "used one" / "−1" / "+1" / set value; `APPROXIMATE` → level chips; binary → toggle. No slider, no free-text number typing required.
- **Thresholds have sane defaults** per mode (e.g. `EXACT` low = 25% of target or 3 units, whichever is larger; `APPROXIMATE` low = `LOW`) and are overridable per resource (FR-RES-005, FR-SET-006).
- **Restock** sets the level (to target for `EXACT`, `FULL` for approximate, `AVAILABLE` for binary), records actor/time, and auto-resolves the corresponding alert (FR-RES-008).
- **Alert grouping is mandatory** (FR-RES-009): all low/critical resources in a household collapse into a single `RESOURCE_LOW`/`RESOURCE_CRITICAL` shopping alert whose body lists the items; individual `CRITICAL` items may additionally appear in the dashboard's attention strip but never as separate notifications within the same window.
- **Shopping list is derived, not duplicated** (FR-SHOP-001..003): items needing purchase appear from low resources plus manual additions; "bought" updates the linked resource level.
- **No forecasting, no consumption rates, no automatic decrement.** Digital tracking of depletion is a non-goal; history is for insight ("we buy rice every 3 weeks"), not for prediction.
- **Perishables are out of scope for v1**: no expiry dates, no batch tracking. (Mentioned here so it is not accidentally added; adding it would need its own ADR.)

## Consequences

### Positive
- Updating a resource is genuinely fast, so the data stays true — the only real prerequisite for the feature to work.
- Display never overstates knowledge: "Low" instead of "18%".
- Threshold behaviour is uniform and configurable, so households tune noise once.
- The same entity feeds the dashboard, the low-supplies card, shopping and history, with no duplication.
- Grouped alerts keep the promise of low alert fatigue even with 15 tracked consumables.

### Negative
- Three modes mean three code paths for updates, thresholds, and display; UI must switch representations without confusing members.
- `EXACT` resources need the household to agree on a unit; ambiguous units (e.g. "1 bottle") degrade to approximate in practice.
- Approximate levels are subjective; two members may disagree on "LOW" (accepted — approximate is the point).
- Mode changes are disruptive and require explicit confirmation.

## Risks
| Risk | Impact |
| --- | --- |
| Levels updated rarely, so alerts fire late | Supply still runs out (the core failure) |
| Threshold defaults wrong for a household | Noise or silence |
| Grouping hides an urgent individual item | A critical item missed |
| Mode confusion ("is 2 low or is Low lower?") | Misuse, wrong data |
| Resource list grows into dozens of dead entries | Clutter, no attention |

## Mitigations
- Quick actions are always one tap from the dashboard and from the resource list; the dashboard's "Low supplies" card offers "Used one" / "Restocked" directly.
- Defaults are documented with rationale and reviewable in settings; onboarding seeds sensible thresholds by category (docs/product/RESOURCES.md#defaults).
- Critical items are always individually listed in the alert body and in the attention strip; only *notifications* are grouped (ADR-008).
- Display always shows the mode implicitly through wording ("Low", "2 rolls", "None") — members see the representation, not the mode name.
- Retention/archival rules for unused resources are documented (archive, never delete history) and surfaced quarterly in settings.

## Revisit Conditions
- Households ask for expiry tracking or consumption forecasting (would require a new ADR and a real data source).
- Approximate levels prove insufficient and `EXACT` usage grows (meaning the household genuinely counts).
- Alert noise from resources persists after grouping, indicating thresholds need household-level tuning rather than per-resource.

## References
- PRD.md — FR-RES-001..012, FR-SHOP-001..004, FR-SET-006
- docs/product/RESOURCES.md
- docs/domain/INVARIANTS.md — I-RESOURCE-*
- src/domain/resources/thresholds.ts (skeleton)
- ADR-008 (alert grouping), ADR-009 (delivery)
- TASKS.md — T-RES-001..020
