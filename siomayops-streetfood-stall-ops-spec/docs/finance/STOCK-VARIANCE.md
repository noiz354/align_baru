# Stock Variance Review

**Document ID:** DOC-FINANCE-STOCK-VARIANCE
**Status:** Phase 0 specification (no variance logic is implemented; `computeStockVariance` throws `Not implemented: T-STOCK-002`)
**Related:** `INVENTORY.md`, `PRD.md` §9, ADR-0030, `docs/security/PERMISSIONS.md`, `TASKS.md` (T-STOCK-001..004)

---

## 1. Stance

Counts and reported sales will never match exactly. Portions vary, siomay is sold in pieces that are
also eaten by staff and sampled, weather kills a batch, a lid spills, someone counts quickly at 22:00.
A system that treats variance as theft guarantees dishonest reporting: operators will fudge counts
instead of telling the truth, and the numbers become useless — while the honest operator pays for it.

Therefore: **variance is information, not an accusation.** The system records a neutral difference and
a reason (including the explicit `UNKNOWN`), and any interpretation is a human decision with a
recorded conclusion (ADR-0030, NFR-UX-006).

## 2. What is compared

```text
expected ending = opening count + received (issues/transfers in) − sold (from recorded sales)
                  − recorded waste/damage/sample/staff meal − transfers out
counted ending  = the operator's count at closing (or an explicit UNCOUNTED)
difference      = counted − expected        ← neutral; positive or negative both possible
```

- Stock position is always **derived** from movements (INV-13); there is no authoritative stored balance.
- A sale consumes stock; an unrecorded sale therefore shows as a negative difference, which is exactly
  the signal HQ wants — surfaced as a question, not a verdict.
- `UNCOUNTED` items are excluded and shown as a gap to be completed (FR-STOCK-012).

## 3. Reason codes (configuration, extensible)

| Code | Typical meaning | Evidence |
| --- | --- | --- |
| `PORTION_DIFFERENCE` | Pieces per portion differed slightly from the plan | note |
| `SPOILAGE` | A batch spoiled (heat, delay, power) | optional photo |
| `WASTE` | Discarded during preparation | optional photo |
| `SAMPLE` | Given as a sample/taste | note |
| `STAFF_MEAL` | Eaten by the team (explicitly allowed and disclosed) | note |
| `SPILLAGE` | Dropped or spilled | note |
| `COUNTING_ERROR` | Count was wrong (including the earlier count) | note |
| `UNRECORDED_ISSUE` | Stock arrived without a recorded issue (warehouse/admin side) | note + supervisor follow-up |
| `STOCK_OUT_SUBSTITUTION` | Used a substitute item that maps to another stock line | note |
| `UNKNOWN` | The operator does not know why it differs | none required — always available |

`UNKNOWN` is a first-class, respected answer. It is the honest answer when the operator truly does not
know, and it is better data than a fabricated reason.

## 4. Thresholds and escalation

| Level | Trigger (configuration per organisation/area) | Response |
| --- | --- | --- |
| Informational | Within tolerance | Recorded, reported in aggregates, no follow-up |
| Explanation required | Beyond tolerance | Closing cannot be accepted without a reason; still neutral |
| Review | Beyond review threshold or repeated pattern | Supervisor reviews with the operator, records a conclusion |
| Escalation | Beyond escalation threshold, or evidence of a systematic issue at a location | **Two-person** review (supervisor + HQ Ops or Finance), documented conclusion, decision about process/location — never about a person's character |

Escalation rules that bind the design:

1. No automatic consequence: no status change, no pay effect, no schedule penalty, no notification to
   the operator that implies guilt (FR-STOCK-007, FR-PERF-009).
2. Two humans, one recorded conclusion: escalation requires two reviewers on the record (FR-STOCK-008).
3. Look outward before inward: check warehouse issue records, stall equipment, portioning consistency,
   heat and closures at that location before drawing conclusions about a person.
4. Coaching is the default follow-up; process fixes (portion scoops, pre-counted bags, better issue
   records) are preferred over individual measures.

## 5. Wording rules

| Never | Always instead |
| --- | --- |
| "Stok hilang" / "kehilangan" | "Selisih stok" |
| "Tidak sesuai, jelaskan kenapa" (interrogative) | "Ada selisih 12 porsi. Pilih alasan atau tulis catatan." |
| "Operator X selalu kurang" | "Selisih berulang di lokasi Y pada hari pasar" |
| "Kecurigaan" | "Perlu pemeriksaan" (a task, not a judgement) |

## 6. Reporting

| Report | Content | Audience |
| --- | --- | --- |
| Daily variance ledger | Items, expected, counted, difference, reason mix | HQ Ops/Finance |
| Reason mix trend | Share per reason including `UNKNOWN` over time | Ops (data quality) |
| Location variance view | Variance clustered by selling point and market day | Ops (location problem hypothesis) |
| Warehouse issue quality | `UNRECORDED_ISSUE` frequency | Warehouse supervisor |
| Coaching queue | Specific records for a supervisory conversation | Supervisor (own area only) |

## 7. Interval counting and physical checks

Mid-shift counts are supported (FR-STOCK-006) and are the recommended way to catch a
portioning problem early. Surprise audits are **not** a product feature: a spot check is entered as an
ordinary count by whoever performs it, with their name on the record. The product never schedules
covert checks, never uses camera evidence of people, and never asks another operator to police a
colleague.

## 8. Test and QA anchors

`tests/unit/stock-variance.test.ts` and `tests/integration/stock-derivation.test.ts` (derivation
order-independence, idempotent movements, UNCOUNTED handling, no status change from variance), plus QA
scenarios QA-K-01..QA-K-06 in `QA.md`.
