# EXPENSES

**Document ID:** DOC-EXPENSES
**Status:** Phase 0 (specification; **no expense logic implemented**)
**Related:** FR-EXPENSE-*, ADR-0027, `PRD.md` §9 (policy boundary), `docs/finance/EXPENSE-REVIEW.md`, `SECURITY.md`

---

## 1. Purpose and boundary

Operators pay for operating costs out of pocket or out of the cash box: a site fee, parking,
cleaning, transport, ice, packaging, small repairs. Today most of this is invisible. SiomayOps
makes it visible, reviewable, and auditable.

**Boundary (hard rule, restated):** the platform **records what operators report**. It does not
encourage, automate, hide, facilitate, or optimise unlawful payments, and it does not encode
assumptions about who received a payment or why. A payment demanded in the field is recorded
neutrally as `UNVERIFIED_FIELD_EXPENSE` (or another auditable category) with a description,
amount, time, location, optional evidence, an operator note, and a review status.

---

## 2. Categories

| Code | Meaning | Cash-box impact | Typical evidence |
| --- | --- | --- | --- |
| `LOCATION_FEE` | Fee for the selling spot, where the operator reports it as such | Usually yes | None / note |
| `PARKING` | Parking for the cart/vehicle | Yes | Optional photo |
| `CLEANING` | Cleaning contribution | Yes | Optional |
| `TRANSPORT` | Moving stock/stall | Sometimes | Optional |
| `FUEL` | Fuel for moving | Sometimes | Optional |
| `PACKAGING` | Bags, boxes, wraps bought en route | Yes | Optional |
| `ICE_WATER` | Ice, drinking water | Yes | Optional |
| `SMALL_REPAIR` | Tape, wheel, burner part | Yes | Photo useful |
| `SECURITY_FEE` | Reported fee described by the operator as security-related | Yes | Optional |
| `UNVERIFIED_FIELD_EXPENSE` | **A payment demanded in the field that the operator cannot attribute** | Usually yes | Optional; never required |
| `OTHER` | Anything else (note required) | Per operator | Optional |

Category is **configuration** (HQ can add/rename), and its label expresses *the operator's own
description*, not a legal characterisation.

---

## 3. Expense record

```ts
/**
 * Field expense submitted by an operator.
 *
 * Important:
 * The category records the operator's report.
 * It must not be interpreted as legal validation
 * of the payment.
 */
interface FieldExpense {
  id: string;

  operatorId: string;
  shiftId: string;
  locationId?: string;

  category: ExpenseCategory;
  amount: Money;

  description?: string;

  status: ExpenseReviewStatus;
}
```

Extended (Phase-0 contract shape, no implementation):

| Field | Purpose | Notes |
| --- | --- | --- |
| `incurredAt` | When it happened | Device time offline, validated for skew |
| `note` | Operator's own words | Bounded length; not a "who was paid" form |
| `evidenceObjectKey` | Optional photo/receipt | Pre-signed upload; access-controlled |
| `cashImpact` | Whether it reduced the cash box | Determines expected-cash maths |
| `clientExpenseId` | Offline idempotency | Unique per organization |
| `flaggedReason`, `reviewedBy`, `reviewedAt`, `reviewNote` | Review trail | Reasons mandatory for rejection |

---

## 4. Entry flow (operator)

```text
Catat biaya
  → pilih jenis (chips, 4 common first)
  → masukkan jumlah (numeric keypad, big)
  → (opsional) catatan 1 baris
  → (opsional) foto
  → SIMPAN   → muncul di daftar hari ini dengan status
```

Design rules:

1. ≤ 4 taps and 1 typed amount for the common case (DESIGN.md §4).
2. Nothing is required except category + amount. **No one is ever blocked for lacking
   evidence or for not knowing what the payment was for.**
3. The app never asks "who did you pay?" and never suggests an amount.
4. Offline: saved locally, shown as "tersimpan di HP", reduces expected cash on device with a
   clear pending marker.
5. The operator can always see the review status of their own submissions.

---

## 5. Review workflow

```text
SUBMITTED ──flag (manual or rule)──► REVIEW_REQUIRED ──► REVIEWED
     │                                    ├──► REJECTED (reason required)
     │                                    └──► ESCALATED (suspected coercion/pattern)
     └──(operator correction before review)──► new revision, original preserved
```

| State | Meaning | Operator-visible wording |
| --- | --- | --- |
| `SUBMITTED` | Recorded, no action needed | "Tercatat" |
| `REVIEW_REQUIRED` | HQ needs to look at it | "Sedang diperiksa HQ" |
| `REVIEWED` | Checked, accepted for reporting | "Sudah diperiksa" |
| `REJECTED` | Not accepted for reporting; **reason required**; record retained | "Ditolak — alasan: …" |
| `ESCALATED` | Routed to a human process (e.g. suspected coercion) | "Diteruskan ke tim terkait" |

Rules:

1. **No deletion.** Rejected expenses stay visible with their reason.
2. **No automated verdicts.** Rules may *route* to review; only humans may accept, reject, or
   escalate.
3. **No accusation language** in either direction.
4. Rejections do not retroactively alter a locked closing; they create an explained adjustment
   forward.
5. Every review action is audited (who/what/when/previous/new/reason).

---

## 6. Flagging rules (patterns, not personalities)

| Rule (configuration, not code) | Example | Purpose |
| --- | --- | --- |
| Amount threshold | Single expense > Rp 100,000 | Catch data errors and outliers |
| Frequency per shift | > 5 expenses in one shift | Detect entry mistakes/stress |
| Same amount + category repeats | 5× `UNVERIFIED_FIELD_EXPENSE` of Rp 20,000 same location, same week | Protective: surfacing a recurring demand at a location |
| First-time category | Operator uses `SMALL_REPAIR` for the first time | Coaching, not suspicion |
| New location spike | Aggregate expenses at a location rise sharply week-over-week | Management attention |

**Rule design principles:** thresholds are visible to HQ, documented, and tunable; rules produce
*review items*, never verdicts; aggregate views are preferred over individual naming; a rule
that fires constantly is a broken rule.

---

## 7. Analytics that are allowed (and their framing)

| Analysis | Allowed? | Framing |
| --- | --- | --- |
| Expense per shift by area | ✅ | Cost of operating in an area |
| Expense by category trend | ✅ | Management insight |
| Recurring payment pattern at a location | ✅ (aggregated) | "This spot generates recurring reported costs — is that expected?" |
| Operator-vs-operator expense comparison | ⚠️ Only with context | Different locations/shifts; never a "suspicion score" |
| Naming individuals as suspects | ❌ | Forbidden |
| Suggesting amounts or recipients | ❌ | Forbidden |
| Predicting which payments are "legit" | ❌ | Forbidden |

---

## 8. Privacy, safety, and evidence handling

| Concern | Rule |
| --- | --- |
| Operator safety | The app never requires an operator to identify or confront anyone; "I don't know" is a valid answer everywhere |
| Evidence photos | Optional, access-controlled, short retention, and never mandatory as a condition of reporting |
| Third parties in photos | Avoid requiring faces/plates; guidance in-app; retention minimises exposure |
| Operator notes | Treated as personal data; visible to operator, HQ roles in scope, and auditors |
| Coercion indicators | Routed to a documented human process (`RUNBOOK.md`); the platform does not investigate people itself |
| Cross-border | Evidence storage stays in the chosen region per `PRIVACY.md` |

---

## 9. Shift and settlement integration

```text
Cash expenses  → reduce expected cash at closing
Non-cash expenses → reported but do not change the cash box maths
Review status  → does not change the arithmetic (the money was still spent);
                 it changes whether the expense is recognised in management reporting
```

Important nuance: a `REJECTED` expense is still a real outflow of cash from the box unless the
money was returned. Rejecting means "not recognised for reporting", not "did not happen".
Where an expense is rejected but the cash is unaccounted, the difference appears as cash
variance — which is exactly the honest outcome, and why rejection requires a reason.
