# HQ

**Document ID:** DOC-HQ
**Status:** Phase 0
**Related:** `docs/product/HQ-DASHBOARD.md`, `PERFORMANCE.md`, `SETTLEMENT.md`, `NOTIFICATIONS.md`, `docs/security/PERMISSIONS.md`

---

## 1. What HQ does in this system

HQ is not a compliance auditor watching people. HQ's job, in product terms, is to answer four
questions reliably and cheaply:

| # | Question | Surface | Cadence |
| --- | --- | --- | --- |
| Q1 | Is the network operating as planned right now? | Live operations board | Continuous, glancing |
| Q2 | Did the money land, and does it reconcile? | Finance queues + settlement | 2–3 times/day |
| Q3 | Where are the exceptions that need a human? | Alert inbox | Continuous, triaged |
| Q4 | What should change next week? | Trend/performance views | Weekly/monthly |

Everything in the HQ console exists to serve one of these four. Anything else is scope creep.


> **Role mapping.** Role names in this document are organisational vocabulary. The **canonical, machine-checked** role codes are the nine in `docs/security/PERMISSIONS.md` §2 (`OWNER`, `HQ_OPS`, `HQ_FINANCE`, `MENU_PRICING_ADMIN`, `AREA_SUPERVISOR`, `OPERATOR`, `STOCK_WAREHOUSE_OPERATOR`, `AUDITOR`, `PLATFORM_ADMIN`); where a job title here does not have its own code, it is a *scope* or a *persona*, not a new role.

---

## 2. HQ roles and their distinct jobs

| Role | Primary surfaces | Typical session | Not their job |
| --- | --- | --- | --- |
| HQ Owner | Dashboard headline cards, area trends, recognition review | 10 min morning, 10 min evening | Transaction-level review |
| HQ Finance | Expense review, payment exceptions, settlement matching, closing review, export | 20–40 min blocks | Live stall chasing |
| HQ Operations | Assignments, coverage, incidents, communications, price rollout | Continuous | Cash reconciliation |
| Platform Administrator | Tenants, roles, integrations, jobs, health | Occasional | Business decisions |

Each role has a distinct **default landing view**; a Finance user should never start at a
stall-coverage map, and an Ops user should never start at a reconciliation queue.

---

## 3. HQ daily operating rhythm (planned, no automation in Phase 0)

```text
06:30  Assignment check        → planned vs available operators/stalls
07:00  Morning readiness       → unstarted shifts, unacknowledged prices, stock alerts
08:00–11:00  Monitor           → active stalls, location changes, incidents, alerts
11:00–14:00  Midday            → coverage gaps, restock requests, escalations
14:00–17:00  Late selling      → stock exhaustion, weather disruptions, moves
17:00–19:00  Closing wave      → unclosed shifts, variance queue, expense review
19:00–20:00  Day close         → daily roll-up, settlement expectations, exception notes
Weekly                         → area review, location performance, recognition prep
Monthly                        → recognition approval, methodology review, retention jobs
```

The system's job is to make each step a **30-second glance** when nothing is wrong, and to
make the exceptions impossible to miss when something is.

---

## 4. HQ operational constructs

### 4.1 Assignment and coverage

- Planned shift list per area per day, with operator + stall + expected location.
- Coverage view: selling points expected to be covered vs actually covered.
- Move log: who moved, where, why (reported reasons only).
- Gap detection: planned coverage with no start by a threshold time.

### 4.2 Exceptions (the real work)

| Queue | Contents | Owner | Target resolution |
| --- | --- | --- | --- |
| Open incidents | By severity and age | Ops | P1 ≤ 30 min ack |
| Unclosed shifts | By ageing and amount at stake | Ops (+Finance at day end) | Same business day |
| Expense review | Flagged/unusual expenses | Finance | ≤ 48 h |
| Payment exceptions | Pending too long, duplicate, amount mismatch | Finance | Same day |
| Settlement mismatches | Provider settlement ≠ expected | Finance | Within settlement cycle |
| Cash variance | Beyond tolerance, with reason or `UNKNOWN` | Finance (+Ops for pattern) | Same day |
| Stock variance | Beyond tolerance, with reason | Ops | Same day |
| Price acknowledgement gaps | Operators not confirmed | Ops | 24 h |
| Stale/unsynced data | Stalls with unsynced records | Ops | Next sync window |

**Design rule:** every queue row carries (a) what happened, (b) what to do, (c) how long it has
been waiting, (d) who owns it. No queue row may require opening three screens to understand.

### 4.3 Communication

- One-to-many: notices, price updates, promotions, safety/urgent notices.
- Targeted: by area, stall, operator group, or a specific shift thread.
- Acknowledgement tracking for urgent messages.
- **No "chat with operator" feature creep**: threads are anchored to operational objects
  (area, stall, shift, incident, location) — not free-floating DMs (`COMMUNICATION.md`).

---

## 5. HQ data requirements

| Need | Data source | Freshness expectation |
| --- | --- | --- |
| Active stalls | Shifts + latest location report | ≤ 5 min (sync), with explicit staleness badges |
| Sales today | Sales + read model | ≤ 5 min |
| Payment mix | Payments | ≤ 5 min |
| Expenses today | Expenses | ≤ 5 min |
| Stock alerts | Stock positions + thresholds | ≤ 15 min |
| Unclosed shifts | Shifts + business calendar | ≤ 5 min |
| Incidents | Incidents | Immediate on sync |
| Variances | Shift closings | At closing |
| Location performance | Aggregates + location baselines | Daily |
| Recognition candidates | Metric snapshots | Monthly periods |

**Freshness honesty is mandatory** (FR-HQ-014): a card that includes records currently queued
offline says so, rather than showing a number that looks complete.

---

## 6. HQ guardrails (things HQ must not be able to do)

| Guardrail | Reason | Enforcement stance |
| --- | --- | --- |
| No deleting sales, payments, expenses, closings | Financial integrity | Append-only; corrections are new records with reasons |
| No editing an operator's submitted count silently | Accountability | Corrections require reason + actor + audit; the operator sees the change |
| No setting a payment to PAID without evidence | Cash integrity | Manual reconciliation requires evidence note + permission + audit |
| No real-time individual tracking | Worker dignity/privacy | Product and technical guardrail (ADR-0007) |
| No punitive automation | Fairness | Metrics never trigger sanctions automatically (FR-PERF-004) |
| No hidden scoring | Explainability | Recognition methodology is published and reproducible (ADR-0029) |
| No exporting personal data without scope + audit | Privacy | Export logged, scoped, minimised, masked where possible |

---

## 7. HQ performance and scale considerations

| Scale point | Concern | Planned response |
| --- | --- | --- |
| 50 stalls / 1 area | Trivially fine with direct queries | — |
| 300 stalls / 8 areas | Dashboard date-range queries begin to matter | Read models (`ARCHITECTURE.md` §7) |
| 2,000 stalls / 40 areas | Aggregations over a day must be precomputed; area drill-down must stay snappy | Daily + hourly read models, cursor pagination, cached card payloads with explicit freshness |
| Multi-city | Regional time zones are all `Asia/Jakarta` today; if that changes, `business_day` becomes region-scoped | ADR-0033 amendment trigger |

**Cost discipline:** HQ views must be usable from a cheap laptop on a bad connection; no
viewport-filling charts, no auto-refreshing full-page re-renders, no map by default.

---

## 8. What HQ does *not* get (anti-requirements)

1. A live "where is everyone" map of individual operators (only selling points/stalls).
2. A leaderboard of operators ranked by revenue alone (`PERFORMANCE.md` §5).
3. A per-second activity feed of taps and screens.
4. Automated messages that pressure operators ("you haven't sold in 20 minutes").
5. Any tool whose main function is to catch someone rather than to fix something.
6. Any ability to invent an explanation for a field expense on the operator's behalf.
