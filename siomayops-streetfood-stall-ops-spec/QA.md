# QA — Manual Quality Assurance

**Document ID:** DOC-QA
**Status:** Phase 0 (scenario catalogue; **nothing implemented to test**)
**Related:** `TESTING.md`, `DESIGN.md` §10, `docs/testing/*`, `ACCESSIBILITY.md`

---

## 1. Purpose

Automated tests prove invariants; **manual QA proves usability in the real environment**. This
document defines what humans must verify, in what conditions, with what evidence — because the
target environment (gloves, sunlight, noise, impatience, 3G) cannot be fully simulated.

---

## 2. QA roles and environments

| Role | Does what |
| --- | --- |
| QA engineer | Scenario execution, defect filing, regression re-verification |
| Field tester | Real stall conditions: outdoor, one hand, timed entry |
| Operator participant (pilot) | Authentic behaviour; observed, not instructed mid-task |
| Finance reviewer | Reconciliation, expense review, closing accuracy checks |
| Auditor reviewer | Traceability, immutability, export correctness |

Environments: **preview** (synthetic data, latest build) · **staging** (production-shaped, provider
sandboxes) · **field pilot** (1 area, 5–20 stalls, real conditions).

---

## 3. Scenario catalogue

### 3.1 Shift lifecycle

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| QA-S-01 | Start shift, usual location, usual stock | Login → Mulai Shift → confirm stall → confirm location → confirm stock | ≤ 4 taps; shift OPEN; HQ sees the stall within 60 s |
| QA-S-02 | Start shift with an unusual location | Choose "pindah" → recent list → confirm | Advisory note if outside area; no block |
| QA-S-03 | Pause and resume (restock) | Pause → resume | Time excluded from selling-time normalisation |
| QA-S-04 | Handover mid-day | Operator A closes handover with counts → Operator B accepts | Both attributed correctly; no duplicate shift |
| QA-S-05 | Operator tries to start a second shift | Attempt start while ACTIVE | Blocked with clear reason |
| QA-S-06 | Suspended operator tries to start | Login → attempt | Blocked; reason visible; audit recorded |

### 3.2 Selling (speed is the test)

| ID | Scenario | Measure | Expected |
| --- | --- | --- | --- |
| QA-T-01 | 1-item cash sale, exact money | Stopwatch, 10 repetitions | Median ≤ 12 s, ≤ 4 taps |
| QA-T-02 | 3-item sale with change | Stopwatch, 10 reps | Median ≤ 20 s, change correct |
| QA-T-03 | Repeat last sale | 1 tap flow | Same items/prices as last sale (prices re-resolved) |
| QA-T-04 | QRIS static QR sale | Flow | Recorded as "Menunggu verifikasi"; UI never says "berhasil" |
| QA-T-05 | Digital payment attempt while offline | Airplane mode | Refused with plain explanation; no false success |
| QA-T-06 | Price changed at HQ mid-day | HQ changes → operator sells | Operator sees new price; confirmation step; sale uses new price |
| QA-T-07 | Stale price (> 24 h cache) | Device offline 2 days → sell | Amber marker, confirm-before-sell, no silent stale snapshot |
| QA-T-08 | Underpayment attempt | Enter cash < total | Blocked with clear message |
| QA-T-09 | Void a sale (supervisor) | Reason required | Reversal recorded; original retained; totals net correctly |

### 3.3 Offline & resilience

| ID | Scenario | Steps | Expected |
| --- | --- | --- | --- |
| QA-O-01 | Full shift offline | Airplane mode: start, sell 20, expense, closing | All queued; closing PENDING_SYNC, editable |
| QA-O-02 | Reconnect after 20 offline sales | Disable airplane mode | All sync; zero duplicates; totals match |
| QA-O-03 | Kill the app mid-shift | Force-close during selling | Reopen → shift intact; queued records intact |
| QA-O-04 | Battery death | Drain/kill device | Nothing lost (records already persisted) |
| QA-O-05 | Corrupted queue simulation | Inject a malformed entry (test build) | Entry quarantined; export offered; no silent loss |
| QA-O-06 | Price hard-stale block | Cache > hard limit | Sale of unpriced item blocked with actionable message |
| QA-O-07 | Two devices, same operator | Sell on both, then sync | All sales present; no duplicates; totals correct |
| QA-O-08 | Move + closing while offline | Move, then close, then sync | Order preserved; HQ sees move then closing |

### 3.4 Expenses

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-E-01 | Record an ordinary parking fee | ≤ 4 taps; appears in shift totals; reduces expected cash |
| QA-E-02 | Record `UNVERIFIED_FIELD_EXPENSE` | Neutral wording; no recipient/purpose fields exist; recorded |
| QA-E-03 | HQ flags an expense | Operator sees "sedang diperiksa" — no accusation language |
| QA-E-04 | HQ rejects with reason | Operator sees the reason; record remains visible |
| QA-E-05 | Offline expense then sync | Single record; totals consistent |
| QA-E-06 | Photo evidence | Optional; uploads when online; access restricted |

### 3.5 Stock

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-K-01 | Start/end counts, no variance | Fast path (≤ 8 taps for 3 items) |
| QA-K-02 | Variance within tolerance | Recorded without ceremony |
| QA-K-03 | Variance beyond tolerance | Reason prompt; `UNKNOWN` accepted |
| QA-K-04 | Duplicate stock report | Single effect |
| QA-K-05 | Restock request offline | Queued with urgency; warehouse sees it after sync |

### 3.6 Closing & settlement

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-C-01 | Clean closing, exact cash | Variance 0; accepted; immutable afterward |
| QA-C-02 | Closing with variance beyond tolerance | Reason required; neutral wording; HQ queue entry |
| QA-C-03 | Closing submitted offline | PENDING_SYNC; editable; HQ shows partial |
| QA-C-04 | Late sale found after closing | Exception surfaced; no silent rewrite |
| QA-C-05 | HQ Finance reopens a closing | Reason required; supersede (not delete); audit |
| QA-C-06 | Digital pending at closing | Shown as unverified; not merged into verified totals |

### 3.7 HQ & finance

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-H-01 | Dashboard cards | All ten cards show with freshness; stale data labelled |
| QA-H-02 | Drill-down | Every number leads to records within 2 clicks |
| QA-H-03 | Expense review queue | Flag/review/reject with reasons; audit entries |
| QA-H-04 | Payment exceptions | Pending-too-long visible; manual reconciliation with evidence |
| QA-H-05 | Unclosed shifts | Ageing visible; contact path obvious |
| QA-H-06 | Export | Permission + audit; masked fields where applicable |
| QA-H-07 | Recognition review | Factor breakdown visible; override requires reason |
| QA-H-08 | Data staleness | Card shows unsynced count and as-of time |

### 3.8 Security & permissions

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-X-01 | Operator B opens Operator A's shift URL | Denied with clear message; audit of denial |
| QA-X-02 | Operator tries HQ route | Denied |
| QA-X-03 | Finance tries to start a shift | Denied |
| QA-X-04 | Forged payment success request | Rejected; security event logged |
| QA-X-05 | Webhook with bad signature | Rejected; alert; no state change |
| QA-X-06 | Session revocation | Revoked device signed out immediately |
| QA-X-07 | Export without permission | Denied |

### 3.9 Accessibility & field usability

| ID | Scenario | Expected |
| --- | --- | --- |
| QA-A-01 | Outdoor sunlight test | Text legible; sunlight mode effective |
| QA-A-02 | Gloves test | All critical actions achievable |
| QA-A-03 | One-hand test | Entire sale flow with thumb only |
| QA-A-04 | Text zoom 130% | No broken layouts; no clipped money totals |
| QA-A-05 | Screen-reader pass on key screens | Money fields and buttons labelled |
| QA-A-06 | 360 px device | No horizontal scroll; tiles usable |
| QA-A-07 | Colour-blind simulation | Statuses readable without colour |

---

## 4. Exit criteria for a vertical slice (QA gate)

A slice can leave QA when:

1. All its scenarios pass on **preview** and **staging**.
2. Field scenarios (speed, gloves, sunlight) pass in a real environment for user-facing slices.
3. No open **money-integrity** defect of any severity.
4. All discovered defects are either fixed, or filed with an explicit acceptance and owner.
5. The relevant `docs/TRACEABILITY.md` rows have a test reference (automated or this catalogue).

---

## 5. Defect severity (this product)

| Severity | Definition | Examples |
| --- | --- | --- |
| **S1 Money integrity** | Wrong money state, double count, or lost financial record | Duplicate sale counted; payment PAID without evidence; closing lost |
| **S2 Data/Privacy** | Exposure or destruction of data; unauthorized access | Cross-operator read; PII in logs; deleted record |
| **S3 Operational blocker** | An operator cannot work | Cannot start shift; sale cannot be recorded |
| **S4 Major usability** | Workaround needed; significant time cost | Sale takes > 25 s; closing requires > 15 taps |
| **S5 Minor** | Cosmetic, inconvenient | Misaligned tile; confusing label |

Rules: S1/S2 stop the line; S3 within the day; S4 before slice exit; S5 batched.

---

## 6. QA evidence requirements

| Evidence | For |
| --- | --- |
| Screenshots/video of flows (no real PII) | Any UI scenario |
| Stopwatch logs (median/p90) | Speed scenarios |
| Network captures (offline tests) | Sync scenarios |
| Audit record screenshots | Money-affecting scenarios |
| Signed-off checklist per slice | Slice exit |

**No production data may be used in QA evidence.** Synthetic data only.
