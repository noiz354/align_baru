# Product Spec — Resources & Supplies

> Requirements: FR-RES-001..012, FR-SHOP-001..004 · ADR: ADR-011 (quantity modes — the decision that makes this usable without counting) · Design: docs/design/PAGES.md §5, INTERACTION-PATTERNS §3 · Tasks: T-RES-001..020, T-SHOP-001..004

## Purpose

Know what's running low **without anyone counting anything**. The failure mode this replaces is the "we're out of toilet paper at 9 pm" discovery.

## The mode decision (ADR-011)

Households will not maintain inventory numbers, and forcing them to is why inventory apps get abandoned. So a resource declares *how* it is tracked, and each mode has its own honest semantics:

| Mode | Level shape | Use for | Low rule | Critical rule |
| --- | --- | --- | --- | --- |
| `EXACT` | integer quantity + unit (rolls, kg, bottles) | A few items where a number is genuinely useful (toilet paper, water bottles) | `level ≤ max(25% of target, 3)` | `level ≤ 1` |
| `APPROXIMATE` | `FULL \| ENOUGH \| LOW \| CRITICAL \| EMPTY` | Most things (soap, detergent, rice) | level is `LOW` or worse | level is `CRITICAL` or `EMPTY` |
| `AVAILABLE_UNAVAILABLE` | `AVAILABLE \| UNAVAILABLE` | Binary things (batteries, light bulbs, pet food) | not applicable (informational) | `UNAVAILABLE` is always CRITICAL |

**Rules that follow from the decision:**

- A mode change requires explicit confirmation and **resets the level** — a number cannot be reinterpreted as a word (I-RES-003). Repeating the same mode is a no-op.
- Thresholds are only meaningful for `EXACT` (and are derived defaults, adjustable within sane bounds). Approximate modes are their own thresholds; binary mode has none.
- The UI never shows a quantity the household did not enter; no "estimated remaining" invented by the app.
- No forecasting, no consumption rates, no expiry dates, no purchase prices (ADR-011 explicitly rejects these — they are inventory-app features, not household relief).

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| Name | yes | Unique case-insensitively; 1–60 chars |
| Category | no | Suggested list (Bathroom, Kitchen, Cleaning, Pets, Baby, Pantry, Other) |
| Room | no | Where it lives ("under the sink") |
| Mode + level | yes | Per the table above; new resources start at FULL/target/AVAILABLE |
| Target (EXACT only) | optional | Default "how much we like to keep" |
| Thresholds | optional | Defaults from the table; shown in words ("tells us when 3 or fewer left") |
| Notes / brand | optional | Free text; never enters notifications |

Soft cap: 120 resources.

## Level updates (the highest-frequency action in the app)

- **EXACT:** `[Used one]` (−1, clamped at 0) plus a small stepper for corrections, plus `[Restocked]`.
- **APPROXIMATE:** four chips `[Full] [Enough] [Low] [Empty]`.
- **Binary:** `[Available] [None]`.
- Every update is idempotent (`clientRequestId`), optimistic with undo for 8 seconds, and writes a level-history row.

## Crossing events (not level events)

Alerts fire on **crossings**, not on every update: entering the low zone emits exactly one event; re-crossing the same direction on the same day does not emit another (I-RES-004). Ascending transitions (restock) resolve the contribution.

Consequences members feel: marking "used one" ten times in a day never generates ten notifications, and a household that tops an item up in the morning and uses it again in the evening is not nagged twice.

## Grouping (ADR-008)

Low supplies are grouped into **one** alert per household per window:

- `RESOURCE_LOW` — one row listing items ("Low: soap, detergent"), refreshed as items are added or restocked, never duplicated.
- `RESOURCE_CRITICAL` — separate alert, higher priority; **CRITICAL and EMPTY items are always named individually**, never folded into "and 3 more".
- Restocking an item removes it from the group; the group resolves only when its list empties (T-RES-006, T-RES-018).

## Restock

One tap sets the level to target (EXACT) or FULL/AVAILABLE. Effects: resolves the item's alert contribution, records actor/time, writes activity, and removes the matching derived shopping entry. Restocking is never "completed" by assumption: nothing auto-increases without a person saying so.

## Shopping list

- **Derived items** appear automatically from LOW/CRITICAL resources, with quantity hints when known ("toilet paper — 2 left, target 12").
- **Manual items** coexist (leeks, a birthday card) and may optionally link to a resource.
- **Marking bought** on a linked item restocks that resource; on an unlinked item it just disappears (with undo).
- **Ordering:** critical first, then alphabetical within category; the list copies as plain text for sharing into any chat app (no integrations needed, PRD NG-6).

## Dashboard interaction

The `Low supplies` card shows CRITICAL first, then LOW, with the same grouped count as the alert, and the actions `Restock` / `Used one` / `Open list`. When nothing is low it is hidden, and the all-clear copy may mention "everything's stocked".

## Edge cases

1. **Two members restock at once:** idempotent; one row, one history entry.
2. **Item unmarked then re-marked low the same day:** no second notification (crossing rule), but the alert re-opens if it was resolved — visible in-app, silent on the phone.
3. **Resource archived while low:** its alert contribution resolves; the shopping entry disappears; adding it back does not resurrect history.
4. **Target lowered below current level:** no crossing fires downwards unless the level actually crosses the new threshold in a later update (avoids instant alert storms after a settings change).
5. **Approximate item at `LOW` when the household raises nothing:** it stays until restocked; the group holds one row, not a reminder per day.
6. **A manual shopping item duplicates a derived one:** the UI offers to merge (linked) rather than showing two rows.
7. **Nothing to buy:** "Nothing to buy." — never an empty page with a plus button begging for data.

## Anti-goals

No barcodes, no receipt scanning, no price tracking, no budgets, no expiry tracking, no "smart reorder" integrations, no quantity estimation from photos. HomeOps tells you *that* you are low and *who* is shopping — nothing more.
