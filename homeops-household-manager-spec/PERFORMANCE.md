# PERFORMANCE.md — Budgets & Performance Approach

> 2026-09-26 · Status: **BUDGETED, NOT IMPLEMENTED** · Measurement is a later-slice activity (T-PERF-001/002).
> Philosophy: a household app on a mid-range Android phone over 4G should feel instant. We meet that with **a small number of indexed queries and a thin client**, not with caching infrastructure (ARCHITECTURE.md §3).

## 1. Context & constraints

| Factor | Reality |
| --- | --- |
| Dataset | ≤ 10 members, ≤ 50 rooms, ≤ 60 chore definitions, ≤ 40 open occurrences, ≤ 80 resources, ≤ 40 assets, ≤ 120 open issues per household. |
| Traffic | Boutique: tens of requests per member per day; peaks at 07:00–08:00 and 20:00–22:00 local. |
| Clients | Mid-range Android (4–6× CPU slower than a dev laptop), iPhone, occasional desktop. |
| Network | 4G/5G at home; sometimes poor signal in basements/bin areas. |
| Infrastructure | 1 vCPU / 1 GB RAM container + Postgres (ADR-016). Nothing here justifies sharding, Redis, or CDNs beyond static assets. |
| Anti-goal | Optimising for 10 000 concurrent users. The architecture would be wrong for a household if we did. |

## 2. Budgets (normative)

### 2.1 Server & database

| ID | Budget | Measurement point | Notes |
| --- | --- | --- | --- |
| PB-S1 | `/today` server render p75 ≤ 400 ms, p95 ≤ 1200 ms | Server timing span for the RSC render | Includes all read-model queries (parallel, one round trip each) |
| PB-S2 | Any mutation (Server Action) p75 ≤ 300 ms, p95 ≤ 900 ms | Span `op.<module>.<action>` | Excludes notification delivery (async) |
| PB-S3 | Simple list pages (rooms, chores, resources) p75 ≤ 300 ms | Server span | Keyset paginated, ≤ 50 rows |
| PB-S4 | DB query p95 ≤ 50 ms for indexed hot paths; ≤ 150 ms for dashboard aggregates | `db.query` span | Queries exceeding 150 ms are a defect unless documented |
| PB-S5 | Scheduler tick ≤ 10 s for a household-scale dataset; individual job batches ≤ 3 s | Job span | Batches bounded by `LIMIT` |
| PB-S6 | Notification dispatch: from alert creation to delivery attempt ≤ 60 s (steady state) | Intent `created_at` → attempt `at` | Depends on tick cadence (ADR-013) |
| PB-S7 | Process memory ≤ 512 MB steady state; ≤ 700 MB peak | Container metrics | Node heap sizing documented in OPS |

### 2.2 Client

| ID | Budget | Notes |
| --- | --- | --- |
| PB-C1 | First-load JS for `/today` ≤ 180 kB gzip | Server Components keep most work off the client (ACTION in T-PERF-002) |
| PB-C2 | LCP ≤ 2.5 s on a mid-range Android over throttled 4G (Moto G-class, 1.6 Mbps, 150 ms RTT) | Measured in Lighthouse CI or Playwright traces |
| PB-C3 | INP ≤ 200 ms for one-tap actions | Optimistic UI makes perceived latency ~0 |
| PB-C4 | CLS ≤ 0.1 | Skeleton geometry must match final layout (DESIGN L-1) |
| PB-C5 | Interaction feedback ≤ 100 ms for any tap (visual acknowledgment) | Optimistic state or disabled+spinner |
| PB-C6 | Install/launch from home screen ≤ 1.5 s to interactive shell (cached) | Service worker shell (ADR-014) |
| PB-C7 | No layout shift from notification badges or counts after hydration | Counts render in server HTML |

### 2.3 Scale boundary (when to revisit)

| Signal | Threshold | Consequence |
| --- | --- | --- |
| Households on one instance | > 50 | Re-evaluate connection pooling, scheduler batching, backup windows |
| Open occurrences per household | > 500 | Indicates a modelling problem first; then revisit indexes |
| Activity rows per household | > 100 k | Adjust retention or partition by month |
| Requests per second (sustained) | > 20 | Add a second instance (safe by design: DB locks + idempotency) |
| Dashboard p95 | > 1200 ms for a week | Investigate queries before adding caching |

## 3. Performance design decisions (already fixed)

| Decision | Why it is fast |
| --- | --- |
| Server Components by default | No data-fetching on the client; no waterfalls |
| One declared dashboard read model | Parallel queries with bounded row counts instead of per-card fetching (ARCHITECTURE.md §8) |
| Partial, purpose-built indexes | The three hot query families are covered (DATA_MODEL.md §4) |
| Keyset pagination everywhere | `LIMIT` + `(sort_key, id)` cursor; no `OFFSET` scans |
| Optimistic UI for one-tap actions | Perceived latency ≈ 0; correctness via idempotency |
| No client analytics/third parties | Nothing blocks first paint |
| Cached immutable assets + shell | Repeat visits are near-instant (ADR-014) |
| Images bounded and compressed client-side | Photos are optional and never block a report (DESIGN §12) |
| Scheduler batches | Never long-running transactions; single-flight locks (ADR-013) |

## 4. Explicitly rejected performance measures

| Measure | Why rejected |
| --- | --- |
| Redis/memcached for query caching | Few hundred rows per household; the database is the cache |
| Materialised views for the dashboard | Premature; would add refresh logic and staleness bugs |
| Read replicas | No read pressure at this scale |
| CDN in front of authenticated HTML | Household data must never sit in shared caches (`Cache-Control: no-store`) |
| Client-side data libraries (React Query/SWR) with aggressive caching | Correctness risk for household state (stale chores) |
| Aggressive client-side code splitting beyond route level | Complexity; the budget is met without it |
| Server-side rendering everything (including settings modals) | Unnecessary; settings can load on demand |

## 5. Measurement plan (future slices)

| What | How | When |
| --- | --- | --- |
| Bundle size | Build output check + bundle analyzer; fail CI over budget by >10% | VS-0 (wiring), ongoing |
| Server timings | OTel spans per operation; p50/p75/p95 histograms | VS-15 (instrumentation), sampled earlier in dev |
| DB timings | `db.query` span per repository call; slow-query log at 150 ms | VS-0 |
| Web vitals | Playwright + Lighthouse budget check in CI on `/today` and one list page | VS-4 |
| Scheduler timing | Job duration histogram + timeout metric | VS-9 |
| Notification latency | Intent→attempt duration histogram | VS-10 |
| Cold start | Measure boot-to-ready; keep < 3 s in the container | VS-16 |

## 6. Degradation rules (what breaks first, and how it behaves)

| Condition | Expected behaviour |
| --- | --- |
| Slow DB (p95 > 500 ms) | Pages still render; skeletons stay visible; no timeouts under 5 s; health readiness shows degraded |
| Scheduler behind | Alerts/occurrences are late but converge (idempotent); readiness reports tick age |
| Push provider slow/down | Delivery attempts retry with backoff; in-app truth is unaffected (FR-NOTIF-008) |
| Slow network on device | Shell renders from cache with a staleness banner; actions fail loudly and retryably |
| Low memory container | Bounded batches keep heap stable; Node `--max-old-space-size` set below container limit |
| Large photo upload on 3G | Client compresses; progress shown; failure keeps the issue record intact (the photo is optional) |

## 7. Anti-patterns to avoid in future work

1. Adding `SELECT *` to a hot path "for convenience".
2. Rendering lists without `LIMIT` ("we will never have that many").
3. Fetching inside components (creates waterfalls and defeats the read model).
4. Introducing a client data cache to "speed up" navigation (stale-state risk).
5. Optimistic UI for non-idempotent operations.
6. Adding an index without a query, or a query without an index (DATA_MODEL.md §4).
7. Measuring only on a fast laptop and calling the budget met.
