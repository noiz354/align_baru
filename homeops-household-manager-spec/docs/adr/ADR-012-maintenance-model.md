# ADR-012: Maintenance — Lightweight Plans and Service Records, Not a CMMS

## Status
Accepted

## Date
2026-09-26

## Context
Household maintenance is real and mostly forgotten: water filters, AC servicing, water tank cleaning, refrigerator coils, washing machine cleaning, pest control, plumbing and electrical inspections. Consequences of neglect are expensive (broken appliances) or unhealthy (dirty tank). Unlike chores, maintenance attaches to **things** (assets), recurs on long intervals (3–12 months), often involves an external vendor, and produces a service record that is genuinely useful later ("when was the last AC service?"). There is a strong pull toward enterprise CMMS features (work orders, approvals, SLA timers, cost rollups, checklists, parts inventory). That pull is rejected by PRD NG-6 and by the product's whole stance (DP-7).

## Problem
What is the smallest model that makes household maintenance happen on time and answers "when was this last done, by whom, and when is it next due?" — without becoming a maintenance-management system?

## Decision Drivers
- Due/overdue reminder is the core value (G-4, FR-MNT-007).
- Service history must be durable and per-asset (FR-MNT-008).
- Long intervals mean date arithmetic must be robust (months/years) — ADR-007 semantics apply.
- Vendors and costs are free-text/notes-level information, not entities with billing (PRD NG-5, FR-MNT-010).
- Household members are the operators; there are no technicians, approvers, or ticket queues.
- Plans must be pauseable (seasonal AC) without losing history (FR-MNT-009).

## Options Considered
1. **Asset + maintenance plan + service record** (three small entities), with due computation reusing recurrence semantics.
2. **Model maintenance as recurring chores** — reuses existing machinery (tempting!), but chores are room-scoped routines assigned to people, while maintenance is asset-scoped, vendor-involving, and produces service records; collapsing them creates awkward chores ("AC service" in a room with a vendor name) and pollutes chore metrics.
3. **Calendar events only** — no history, no per-asset record, no vendor/cost notes.
4. **Full CMMS** (work orders, approvals, spare parts, cost accounting, SLA) — rejected: disproportionate, drives configuration burden, and is explicitly a product non-goal.
5. **External reminders only** (phone calendar) — loses household visibility; nobody can answer "when was the last service?".

## Decision
Adopt **(1)**, with a deliberately minimal field set:

| Entity | Role | Key properties |
| --- | --- | --- |
| `Asset` | A thing that needs care | name, category (`APPLIANCE`/`SYSTEM`/`VEHICLE`/`STRUCTURE`/`OTHER`), location (roomId? or free text), notes, installedAt?, archivedAt? |
| `MaintenancePlan` | Recurring expectation | assetId? (nullable for household-level plans), title, frequency (`EVERY_N_DAYS`/`WEEKS`/`MONTHS`/`YEARS`/`MONTHS_OF_YEAR`), leadTimeDays, assigneeId?, vendorNote?, estimatedCost?, isPaused, lastServiceAt?, nextServiceAt? |
| `MaintenanceRecord` | What actually happened | planId?, assetId?, completedById (or `EXTERNAL`), completedAt, vendorNote?, costNote?, notes?, followUpAt? |

Rules:
- **No work orders, no approvals, no checklists, no parts, no SLA, no cost rollups.** Cost is an optional free-text/amount note for the record only (FR-MNT-012).
- **`nextServiceAt` is derived** from the last record (or plan start) using the frequency, in household time, with month/year clamping (ADR-007 semantics). It is denormalised for querying and always recomputable.
- **Lead time** drives `MAINTENANCE_DUE` (default 7 days, household-configurable) and `MAINTENANCE_OVERDUE` when past due (FR-MNT-007).
- **Completing a service** records actor (or `EXTERNAL` when a vendor did it), date, optional cost note and notes, then recomputes `nextServiceAt` — the single most important interaction, optimised to ≤3 fields (FR-MNT-005).
- **Pausing** a plan stops due computation and alerting while keeping history; pausing records why and until when (optional) (FR-MNT-009).
- **Household-level plans** (no asset) are allowed for things like pest control, which have no single asset.
- **Assets are optional depth**: a household can run a plan without registering an asset up front; the asset can be attached later without breaking history.
- **Maintenance is distinct from chores** (ADR-006): a chore is never used to model a service, and maintenance never appears in chore counts or room status.
- **Linking optional**: a plan or record may reference an open issue that motivated it (FR-MNT-011) — the issue remains the problem record.

## Consequences

### Positive
- Answers the two questions that matter ("when was it last done?", "when is it due?") with minimal data entry.
- Service history accrues value over years — a genuine reason to keep using the app.
- Reuses recurrence semantics instead of inventing a second scheduling system (fewer bugs).
- Vendor/cost handled at note-level keeps the privacy and complexity surface small.
- Explicit "not a CMMS" boundary prevents feature creep into approvals and work queues.

### Negative
- No structured vendor entity means no vendor contact directory (accepted for v1; a vendor *directory* would need its own ADR).
- No cost tracking means the household cannot answer "what did we spend on maintenance?" (accepted; PRD NG-2).
- Derived `nextServiceAt` can drift if records are backdated; recomputation must be explicit.
- Two similar-but-different scheduling concepts (chores and maintenance) exist — justified by different ownership, but it is a documentation burden (addressed in OPERATIONS/GLOSSARY).

## Risks
| Risk | Impact |
| --- | --- |
| Maintenance ignored like chores were | Feature fails its purpose |
| Drift/duplication between stored and recomputed `nextServiceAt` | Wrong reminders |
| Backdated records producing confusing next dates | Distrust |
| Scope creep toward work orders/approvals | Product loses its lightness |
| Long intervals crossing DST/year boundaries | Off-by-one dates |

## Mitigations
- Dedicated dashboard card ("Upcoming maintenance") + `MAINTENANCE_DUE` alerts with lead time; overdue escalates (ADR-008).
- `nextServiceAt` is always recomputed from records on write; a nightly consistency check (job skeleton T-MNT-004) can reconcile (documented as a possible future guard).
- Backdating is allowed but the UI shows the computed next date immediately after saving (no surprise later).
- The "not a CMMS" boundary is stated in PRD NG-6, this ADR, and docs/product/MAINTENANCE.md; new requests are evaluated against it explicitly.
- Frequency math shares the tested date utilities (T-TIME-001..004) rather than a parallel implementation.

## Revisit Conditions
- Households request vendor management (repair-shop contacts, appointments) — would be a new bounded module, not an extension of maintenance.
- Cost tracking becomes a repeated request (conflicts with NG-2; requires a product decision, not just an ADR).
- Multi-step maintenance jobs (checklists, multi-visit) become necessary for a real household.

## References
- PRD.md — FR-MNT-001..012, NG-2, NG-6
- docs/product/MAINTENANCE.md
- docs/domain/INVARIANTS.md — I-MNT-*
- src/domain/maintenance/scheduling.ts (skeleton)
- ADR-006 (chores are not maintenance), ADR-007 (date semantics), ADR-008 (alerts)
- TASKS.md — T-MNT-001..016
