# HQ Dashboard

**Document ID:** DOC-PRODUCT-HQ-DASHBOARD
**Status:** Phase 0 specification (no dashboard is implemented; read-model functions throw `Not implemented: T-HQ-002`)
**Related:** `HQ.md`, `DESIGN.md` §10, `docs/design/PAGES.md` §3, `SETTLEMENT.md`, `PAYMENTS.md`,
`INVENTORY.md`, `INCIDENTS.md`, `TASKS.md` (T-HQ-001/002/003), `docs/security/PERMISSIONS.md`

---

## 1. Purpose and shape

The dashboard answers, in under a minute and at the start of the day and at closing time:

1. **Is the network selling?** (coverage, active stalls, gaps)
2. **Does the money add up?** (cash position, variance, unresolved items)
3. **What is waiting on a human?** (verification backlog, expense review, incidents, unfinished closings)
4. **What changed versus normal?** (exceptions first)

Design stance: **exceptions first, aggregates second, charts last.** Every figure is a stored read
model with `computedAt`; nothing is computed inline on the page (ARCHITECTURE.md §8). A figure that is
stale is visibly dimmed and labelled, never silently presented as current (FR-HQ-008).

## 2. The ten cards

| # | Card | Question | Value shape | Freshness | Drill-down | Task |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Coverage today | Who is selling, where, and who is not? | active shifts, shifts without a location report, idle stalls | ≤60 s | shift list → operator, stall, location report | T-HQ-001 |
| 2 | Sales today | How much, by method, with verification split | gross by method, **verified digital** and **unverified digital** as separate lines | ≤60 s | sale list → lines, price snapshots | T-HQ-002 |
| 3 | Cash position | Expected vs counted, variance, unresolved | expected cash, counted cash, variance amount, unresolved count | ≤5 min | closing list → shift → cash arithmetic | T-HQ-002 |
| 4 | Verification backlog | What is waiting, how old, how much | pending count, unverified amount, oldest age | ≤60 s | payment queue (evidence + provider reference) | T-HQ-002 |
| 5 | Stock status | What was issued, used, wasted, and where it differs | issues, consumption, waste, variance count by reason | ≤10 min | stall stock → movements | T-HQ-002 |
| 6 | Incidents | What needs attention now | open by severity, age vs SLA, owner | event-driven | incident detail → actions | T-ALERT-001 |
| 7 | Expense review | What is queued, flagged, overdue | queue size, flagged patterns (as record counts), median age | ≤5 min | expense queue | T-EXP-002/003 |
| 8 | Unfinished closings | Which shifts have not closed | count and value by area; cause categories | ≤5 min | shift list | T-HQ-002 |
| 9 | Location coverage | Which selling points are used, dormant, restricted | used today, dormant > N days, restricted with reason | ≤15 min | location detail → history | T-LOC-002/003 |
| 10 | Exceptions first | Everything that needs a decision now | merged, deduplicated list ordered by consequence | ≤2 min | direct to the record | T-HQ-003 |

## 3. Card rules

1. **Freshness is part of the value.** Each card renders `computedAt`, the band
   (`current` < 5 min, `recent` 5–60 min, `stale` > 60 min) and a manual refresh affordance.
2. **No merged digital truth.** Verified and unverified digital amounts are never summed into one
   "digital revenue" figure — that is how the product stays honest about money (FR-PAYMENT-010).
3. **Every number is drillable** within the viewer's scope, down to the record that produced it
   (FR-HQ-009). A figure that cannot be explained is a defect.
4. **Scoped by area/region** with the filter applied server-side (FR-HQ-013).
5. **Exports are audited** (`export.created`), carry the freshness of the moment they were generated,
   and never include another area's data (FR-HQ-010).
6. **No surveillance artefacts.** No live map of individual operators, no "last seen", no per-person
   activity timeline. Location appears only as shift-bounded reports (card 1), at the granularity of
   selling points.
7. **Neutral variance language.** Cards say "Selisih" and never "Hilang"; a variance reason of
   `UNKNOWN` is displayed without any implication about a person (ADR-0030).

## 4. Role-based landing

| Role | Lands on | Sees first |
| --- | --- | --- |
| HQ Owner | Card 10 (exceptions) with headline cards 1–3 above | Anything blocking the day |
| HQ Ops | Card 1 (coverage) | Gaps, location reports, incidents |
| HQ Finance | Card 4 (verification) + card 3 (cash) | Money waiting on a decision |
| Menu/Pricing admin | Card 2 (sales, per item) + price change report | Missing prices, margin drift |
| Area supervisor | Card 1 filtered to their areas, card 6 | Team status, approvals, incidents |
| Auditor | Read-only drill-downs and audit search, no live cards | Reconstruction of records |

A Finance user must never land on a coverage view, and an Ops user must never land on a
reconciliation queue (HQ.md §2; enforced by default routes per role).

## 5. Daily rhythm the dashboard supports

| Time | What HQ does | Cards used |
| --- | --- | --- |
| 06:30 | Assignment and readiness check | 1, 8, 9 |
| 07:00–11:00 | Monitor active selling | 1, 6, 10 |
| 11:00–14:00 | Midday coverage, restock, escalations | 1, 5, 6 |
| 14:00–17:00 | Late selling, stock exhaustion, weather moves | 1, 5, 10 |
| 17:00–19:00 | Evening verification queue | 4, 2, 3 |
| 19:00–21:00 | Closing review, variance, expenses | 3, 7, 8 |
| Weekly | Margin per item and location, incidents, recognition review | 2, 5, 9 + `PERFORMANCE.md` |

## 6. Alert catalogue shown in the inbox and card 10

| Alert | Trigger | Severity | Owner | Resolution |
| --- | --- | --- | --- | --- |
| Shift active, no location report | Shift open > 30 min without a report | ATTENTION | Supervisor | Report arrives or supervisor contacts the operator |
| Closing missing after cut-off | No accepted closing by 21:00 local | ATTENTION | Ops | Closing submitted or reason recorded |
| Unverified digital payment old | `PENDING_VERIFICATION` older than the SLA window | ATTENTION | Finance | Verified, reconciled or rejected with reason |
| Cash variance beyond tolerance | Closing submitted beyond tolerance | ATTENTION | Supervisor | Review decision with reason |
| Unresolved verifications at closing | Closing accepted with open verifications | ATTENTION | Finance | Verification queue |
| Stock variance beyond threshold | Count differs beyond threshold | ATTENTION | Supervisor | Reason, two-person review if escalated |
| Shift longer than maximum | Shift duration > threshold | INFO | Supervisor | Contact or handover |
| Price not configured for a stall's item | Sell attempt blocked | BLOCKING (for that item) | Menu/Pricing | Publish policy with reason |
| Payment callback rejected | Signature/reference/amount/replay failure | SECURITY | Finance + Platform | Investigate; never apply the callback |
| Expense pattern flagged | Configured pattern matches records | INFO | Finance | Human review (no automatic consequence) |
| No closings for an entire area | Zero accepted closings by cut-off | BLOCKING | Ops | Escalate per `RUNBOOK.md` |

Alert wording rule: alerts describe **records and situations**, never people's motives
(FR-EXPENSE-012, NFR-UX-006).

## 7. Open questions specific to this surface

| # | Question | Owner | Needed by |
| --- | --- | --- | --- |
| HQ-OQ-1 | Exact verification SLA (hours) and the on-call owner for the evening queue | Finance | VS-6 |
| HQ-OQ-2 | Whether card 5 (stock) is relevant daily or only weekly in the pilot | Ops | VS-12 |
| HQ-OQ-3 | Which exports Finance needs as scheduled CSV rather than on-demand | Finance | VS-12 |
| HQ-OQ-4 | Which metrics may be shown per operator to supervisors (never public, never revenue-only) | People + Privacy | VS-15 |
