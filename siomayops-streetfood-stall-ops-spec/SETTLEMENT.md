# SETTLEMENT

**Document ID:** DOC-SETTLEMENT
**Status:** Phase 0 (specification; **no settlement or accounting logic implemented**)
**Related:** FR-SETTLE-*, FR-CASH-*, `PAYMENTS.md`, `docs/finance/*`, `RETENTION.md`

---

## 1. Purpose

Settlement answers one question per shift: **does the money we expect match the money that
actually exists / actually arrived?** It does not attempt to be an accounting system
(`PRD.md` §3): no ledger, no chart of accounts, no accruals.

```text
CASH SIDE                                DIGITAL SIDE
Opening Cash                             Digital Sales (expected)
 + Cash Sales                             − Refunds
 − Recorded Cash Expenses                 = Expected Settlement
 = Expected Cash                                ↓ compare with
      ↓ compare with                     Actual Provider Settlement Received
Actual Closing Cash                            ↓
      ↓                                  Variance (+ reason, if any)
Variance (+ reason, if any)
```

---

## 2. Shift-level settlement (operator-facing)

| Step | Operator sees | System does |
| --- | --- | --- |
| 1 | "Uang di kotak seharusnya Rp X" (expected cash) | Computes: opening + cash sales − cash expenses |
| 2 | Count input (denominations/single number) | Stores counted cash |
| 3 | "Selisih Rp Y" (if any) with neutral wording | Computes difference; asks for reason if out of tolerance |
| 4 | Digital summary: "Digital terverifikasi Rp A · Menunggu verifikasi Rp B" | Separates verified vs unverified explicitly |
| 5 | Submit | Creates `ShiftClosing` (immutable once accepted) |

**Tolerance:** configurable per organization (pilot suggestion: Rp 5,000 or 2% of cash sales,
whichever is larger). Out of tolerance ⇒ reason required (including `UNKNOWN` — an honest
"I don't know" is a valid answer, and it is recorded as such rather than invented).

**Forbidden:** auto-writing-off differences; blocking a closing solely because a difference
exists; language that describes the operator as a suspect.

---

## 3. Closing model

```ts
interface ShiftClosingSummary {
  shiftId: string;
  businessDay: string;

  grossSalesMinor: number;          // all COMPLETED sales, net of voids
  cashSalesMinor: number;
  digitalVerifiedMinor: number;     // PAID
  digitalUnverifiedMinor: number;   // PENDING_VERIFICATION etc. — NEVER merged

  recordedExpensesMinor: number;    // sum of submitted expenses (cash impact separated)
  cashExpensesMinor: number;        // subset that reduced the cash box

  openingCashMinor: number;
  expectedCashMinor: number;        // opening + cashSales − cashExpenses
  countedCashMinor: number;
  cashVarianceMinor: number;        // counted − expected

  digitalExpectedMinor: number;     // expected provider settlement
  digitalReceivedMinor?: number;    // filled in during reconciliation (may be later than closing)

  stockVariances: Array<{ stockItemId: string; expected: number; counted: number; reason?: string }>;

  status: ShiftClosingStatus;       // SUBMITTED | PENDING_SYNC | REVIEW_REQUIRED | ACCEPTED | LOCKED
  reason?: string;
  notes?: string;
}
```

Derived values are **stored at closing time** rather than recomputed later, because a closing
is an assertion about a specific moment (`DATA_MODEL.md` §4).

---

## 4. Digital settlement matching

| Step | Who | What |
| --- | --- | --- |
| Expectation created | System (at closing) | Amount expected from provider for that business day/period |
| Settlement observed | HQ Finance (manual in MVP) | Provider/bank statement line(s) |
| Match | Finance | Full / partial / unmatched / over-settled |
| Variance handling | Finance | Reason + note + audit; forward corrections only |
| Fee note | Finance (optional) | If provider deducts fees, they are recorded as an explicit cost line, never netted silently into sales |

MVP reality: with **static QRIS** there is no API settlement feed, so matching is manual and the
platform's job is to make it *fast and honest*: expected amount per day, one line per deposit,
keyboard-friendly entry, and a visible queue of anything unmatched.

---

## 5. Daily closing (area / HQ level)

```text
Per shift closings accepted
        ↓
Area daily roll-up (all shifts, all stalls)
        ↓
Variance review (cash + digital + stock)
        ↓
Area sign-off (Supervisor / HQ Ops)
        ↓
Daily close → LOCKED (audited; later changes are corrections)
```

Rules:

1. A day cannot be closed while shifts are silently open; open shifts must either be closed or
   explicitly marked `CLOSING_EXCEPTION` with a reason and an owner.
2. Locked days are immutable; corrections are new, audited records referencing the locked day.
3. Roll-ups store `computedAt` and the list of included shifts so a reviewer can reproduce them.

---

## 6. Reconciliation of cash across levels

| Level | What is reconciled | Frequency | Owner |
| --- | --- | --- | --- |
| Shift | Cash box: expected vs counted | Every shift | Operator → reviewed by HQ Finance |
| Day / area | Sum of shift closings vs deposits handed to HQ | Daily | Finance |
| Week | Variance trend, recurring locations/operators-related patterns | Weekly | Finance + Ops |
| Month | Distribution health, tolerance calibration | Monthly | Owner + Finance |

**Pattern visibility without blame:** recurring variance at a *location* may indicate theft,
measurement issues, float handling, or expense misreporting. The system surfaces the pattern;
humans investigate. No automated accusation (NFR-UX-006, FR-PERF-004).

---

## 7. Failure and edge behaviour

| Case | Behaviour |
| --- | --- |
| Closing submitted offline | `PENDING_SYNC`, editable, explicitly not "closed" in HQ until accepted |
| Sales arrive after closing accepted | "Late sale" exception with HQ visibility; the closing is not silently recomputed; a correction record adjusts forward |
| Digital payment verified after closing | Payment moves to PAID; the day's digital numbers are corrected forward via an audited adjustment view — sales totals are never rewritten |
| Expense submitted after closing | Routed to next business day's reporting, or attached to the shift with an audited late-attachment flag (policy per organization) |
| Duplicate settlement line | Flagged; single match allowed; second requires explicit note |
| Amount differs by small rounding | Configurable micro-tolerance with automatic note; still visible in the queue |
| Operator quits mid-shift | Open shift handled through a documented `CLOSING_EXCEPTION` path with supervisor action; no data is fabricated to "close" it |

---

## 8. Non-goals (explicit)

- No general ledger, journal entries, or double-entry bookkeeping.
- No tax computation or filing.
- No payroll or commission calculation.
- No automated write-off of variances, ever.
- No "AI reconciliation" that hides its reasoning from Finance.
