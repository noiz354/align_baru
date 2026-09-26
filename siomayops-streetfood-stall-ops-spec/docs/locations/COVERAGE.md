# Location Coverage and Location Operations

**Document ID:** DOC-LOCATIONS-COVERAGE
**Status:** Phase 0 specification (no coverage computation exists; `getCoverageCard` throws `Not implemented: T-HQ-001`)
**Related:** `LOCATIONS.md`, `HQ.md`, `docs/product/HQ-DASHBOARD.md` (card 9), ADR-0007, `PRIVACY.md`

---

## 1. What coverage means here

Coverage is a **planning** idea: on a given business day, which selling points had an operator
actually selling there, which were idle, and which need attention as *places*. It is never a measure
of a person's diligence: an operator standing at a crowded spot all day is not "more covered" than one
who was moved by rain, and a location without a report is a **gap in information**, not a suspicion
(FR-LOCATION-010).

## 2. Definitions

| Term | Definition | Source |
| --- | --- | --- |
| Planned selling point | A location expected to be used that day (from assignments and the previous week's pattern) | Assignments + location windows |
| Reported location | A selling point with at least one open location report during an active shift | `LocationReport` |
| Idle location | Planned, with no report, and no declared closure | Derived |
| Declared closure | A location marked temporarily unavailable with reason and optional expiry | Location status + reason |
| Dormant location | No reports for N days (configurable, default 14) | Derived |
| Coverage rate | Reported locations ÷ planned locations for the day, excluding declared closures | Derived |

## 3. Location statuses and who sets them

| Status | Set by | Requires | Effect |
| --- | --- | --- | --- |
| `AVAILABLE` | HQ Ops / supervisor | — | Can be planned and reported |
| `ACTIVE` | System (derived while a shift is reporting there) | An open report | Shown as active on the board |
| `CROWDED` | Operator report reason / supervisor | optional note | Informational; warns other operators planning to move there |
| `TEMPORARILY_UNAVAILABLE` | HQ Ops / supervisor | reason, optional expiry | Warns; never blocks a report |
| `RESTRICTED` | HQ Ops | reason, optional expiry | Warns; never blocks; **no legal claim is made** |
| `INACTIVE` | HQ Ops | reason | Not offered in the picker; history retained |

Rules: statuses are operational metadata; the product never asserts permission legality for a place,
and only an explicit, attributed HQ verification record (with verifier and timestamp) may exist
(FR-LOCATION-009). A location's dismissal from the list never deletes its history.

## 4. Location problems routed as *place* problems

| Signal | Interpretation | Route |
| --- | --- | --- |
| Repeated `PERMISSION_ISSUE_REPORTED` moves at one spot | A place-level friction | HQ Ops reviews the location, not the operator |
| Repeated `UNVERIFIED_FIELD_EXPENSE` clustered at one spot | Possible recurring demand at a place | HQ Finance + Ops review together (`docs/finance/EXPENSE-REVIEW.md`) |
| Coverage dip correlated with a status change | Planned change or mis-set status | HQ Ops corrects status with a reason |
| Multiple operators avoiding one spot | Needs a human conversation about the place | Supervisor, in person |
| New proposals rejected repeatedly | Picker list needs curation | HQ Ops curates with reasons |

## 5. Proposals (operator-reported new selling points)

An operator may propose a new selling point during a shift (FR-LOCATION-006). The proposal is
`PENDING_VERIFICATION`, is usable for that shift only, and cannot be reused by others until HQ reviews
it. Review outcomes: approved (becomes `AVAILABLE` with attributes), merged into an existing point
(history preserved), or rejected with a reason. A rejected proposal never invalidates the shift's
records: the shift keeps the place it recorded (EC-32).

## 6. Reporting and freshness

The coverage card shows: reported / planned locations, idle locations with days idle, declared closures
with reasons, dormant locations, restricted locations with expiry, and proposals pending review. It
carries `computedAt` (target ≤15 min) and dims when stale. Drill-down lists the shift-level reports —
never a movement trace, because no such data exists by design (ADR-0007).

## 7. What this document deliberately excludes

Live maps of operators, geofence alerts, "operator was 300 m away from the assigned spot" checks,
productivity-by-location metrics, and any inferred movement pattern. Coverage is a plan-versus-report
view, at location granularity, for planning and support.
