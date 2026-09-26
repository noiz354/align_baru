# Product Spec — Maintenance & Assets

> Requirements: FR-MNT-001..011 · ADR: ADR-012 (maintenance model — deliberately not a CMMS) · Design: docs/design/PAGES.md §6 · Tasks: T-MNT-001..016

## Purpose

Remember the things that quietly break if forgotten — the air-con filter, the water pump, the smoke alarm battery — without turning a home into a maintenance department.

## Scope boundary (ADR-012)

| In scope | Out of scope |
| --- | --- |
| Assets (things in the home that need care) | Work orders, WO numbers, dispatch |
| Plans with a frequency and a lead time | SLA/response-time tracking |
| Service records (who/when/what, cost **note**) | Cost centres, budgets, spend analytics |
| Vendor **notes** (a phone number, a name in free text) | Vendor management, contracts, ratings |
| Due/overdue reminders with priority | Predictive failure models, MTBF, sensor feeds |
| Linking an issue to a plan or record | Parts inventory, procurement, BOM |

If a household ever needs a work-order system, that is a signal this product is wrong for them — not a feature request.

## Assets

Name, category (`APPLIANCE | HVAC | PLUMBING | ELECTRICAL | SAFETY | VEHICLE | OUTDOOR | OTHER`), optional room or free-text location, optional install date, optional notes, optional warranty note (free text, no reminders). Archiving keeps history and hides the asset from pickers.

## Plans

A plan is a rule: *this thing needs this service, this often, with this much warning*.

| Field | Notes |
| --- | --- |
| Name | "Air-con service", "Water filter change" |
| Asset | optional — household-level plans are legitimate (pest control, gutter cleaning) |
| Frequency | every N days/weeks/months/years, or months-of-year set (e.g. "April and October") |
| Lead time | 0–90 days (default 7) — how early the household wants to know |
| Assignee | optional; drives alert recipient |
| Vendor note | free text ("Pak Andi, 0812-…"); never shown in notifications |
| Estimated cost note | free text or a number; never totalled, never reported |
| Paused | seasonal plans (AC in winter) |

## Records (the truth)

A service record has three required inputs at most — **when**, **who** (a member, or "someone came" with a vendor note), and **what happened** (a short note). Optional: cost note, photo, link to an issue.

Recording a service:

1. creates the record (backdating allowed),
2. recomputes `nextServiceAt` **immediately** and shows the new date in the confirmation ("Next service: 12 March 2027"),
3. resolves any open due/overdue alert for the plan with reason `SERVICE_RECORDED`,
4. writes an activity entry.

`nextServiceAt` is derived and recomputable; it is never edited by hand and never advanced by an alert or a snooze (I-MNT-001). A nightly consistency job recomputes it from records and frequency, which both detects drift and lets a mis-keyed date be corrected by fixing the record rather than the schedule.

## Scheduling math

Frequency evaluation is **date-based** (`YYYY-MM-DD`, household timezone for "today"): DST never moves a service date, and monthly clamping follows the same rules as chores (the 31st stays the 31st and clamps only when the month is short — RECURRENCE.md §Month clamping). Months-of-year plans produce one date per selected month.

## Alerts

| Condition | Type | Priority | Recipient |
| --- | --- | --- | --- |
| `today ≥ nextServiceAt − leadTime` | `MAINTENANCE_DUE` | ATTENTION (informational, not alarming) | Assignee → role fallback → OWNER |
| `today > nextServiceAt` | `MAINTENANCE_OVERDUE` | IMPORTANT, escalating once per cooldown | same |
| Plan paused | — | Open alerts resolve with `PAUSED` | — |

Exactly one alert per plan (dedupe key `MAINTENANCE_DUE:plan:<id>`), refreshed rather than recreated. Overdue is a **priority change on the same alert**, never a second one. Quiet hours apply normally: a filter change is not an emergency (a SAFETY-severity issue is handled by the issue path, not here).

## Pausing

Pausing resolves open alerts with reason `PAUSED` and stops evaluation. Resuming recomputes the next date **from the last record**, not from the pause date — otherwise a paused AC would come back "overdue" the moment it resumed, which is both wrong and annoying.

## History

Each plan/asset shows its records newest-first with who and when. History is append-only: a wrong record is corrected by adding a corrected record plus a note, not by silently editing the past (the same principle as chores).

## Issue linkage

An issue ("the AC leaks") can link to a plan or a record; the link is a reference in both directions, and linking never creates a record automatically. Resolution flow: fix → record the service → resolve the issue (or the reverse; both orders are legal, and the UI suggests record-then-resolve).

## Edge cases

1. **Service done by a vendor while the member is away:** "someone came" path with actor = external; the member records it later, backdated, and the recomputation handles the rest.
2. **Two records for one service entered twice:** idempotent via `clientRequestId`; otherwise both exist and the later one is flagged as a duplicate candidate for the member to correct.
3. **Plan created after the last service was long ago:** the first `nextServiceAt` derives from the plan's start date; if that is already past, it is immediately overdue — visible, not hidden. The UI warns at creation.
4. **Household-level plan with no asset:** allowed; records attach to the plan (I-MNT-003).
5. **Seasonal plan paused for six months:** no alerts, no drift in history, resume recomputes from the last record.
6. **Cost note written as "Rp 450.000" or "about 500k":** both stored as free text; never parsed, never summed, never shown in a report.

## Deliberately absent

Maintenance schedules imported from manuals, manufacturer integrations, IoT/sensor data, warranty expiry tracking with reminders, spend dashboards, technician marketplaces, SLA timers, and a parts list. Household-oriented means: one screen, three inputs to record reality, and reminders that arrive early enough to be convenient rather than late enough to be expensive.
