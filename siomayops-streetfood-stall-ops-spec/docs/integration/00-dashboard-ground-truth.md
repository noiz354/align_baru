# Dashboard Ground Truth (Historical Discovery)

> This is the pre-implementation discovery snapshot. The current page-specific truth is `docs/integration/01-dashboard-ground-truth.md`; the current architecture, gaps, and runtime evidence are in the adjacent `01-dashboard-*` documents.

## 1. Current State

**Discovery date:** 2026-09-29. **Repository:** `noiz354/align_baru`. **Branch:** `arena/01a0ebc9-align-baru`. **Inspected HEAD:** `bca4e6906cb32de4715a8ae695894299ac1b0013`.

Paths below are relative to `siomayops-streetfood-stall-ops-spec/`, unless explicitly prefixed with `../`. This is an independent project inside a multi-project repository, not an application at the Git root.

**Important baseline discrepancy:** the redesigned dashboard described in the request is **not present in this checkout**. `src/app/page.tsx` is a 60-line client-side **operator home** ("Beranda penjual"), with navigation buttons and an offline banner. It has no KPI cards, outlet table, sales chart, activity feed, search/filter, or modals. `/hq` is a separate, older dashboard with ten rendered card containers, a mixture of API reads, browser calculations, and fabricated values. Do not attribute an absent redesigned UI's constants or behavior to this source tree. Its implementation is UNKNOWN here; its absence at the specified path is directly observable.

**T-HQ-003 is not complete.** `TASKS.md` still declares Phase 0. Conversely, README/architecture/read-API statements that there is no implementation are outdated relative to the code: route handlers, feature functions, a JSON-backed store, and partially connected screens exist. `IMPLEMENTATION_STATUS.md`'s historical completion claims and earlier audits are not completion evidence.

### Inspection boundaries and rules

- Read root and project `AGENTS.md`, project `README.md`, `TASKS.md`, relevant PRD/design/HQ/architecture/security/API/QA sections, `IMPLEMENTATION_STATUS.md`, and existing audit materials under `../MVP_AUDIT/projects/siomayops-streetfood-stall-ops-spec/`, `../MVP_AUDIT/progress/siomayops-streetfood-stall-ops-spec/`, and `../MVP_AUDIT/wave3/siomayops-streetfood-stall-ops-spec/`.
- Specifications are requirements; current source is implementation evidence. No separate SDD was found; `PRD.md`, `ARCHITECTURE.md`, domain documents, and `docs/` contain the specifications.
- Used `rg`, file listings, source reads, and read-only Git inspection. No codegraph tool was available in the exposed tools.
- **No server, tests, build, seed, migrations, or API requests were run.** Importing the store initializes and writes seed data; several tests call its destructive `clear()`. Avoiding those operations preserves the user's data.
- Statements below describe source behavior, **not newly verified runtime results**. No pass/fail test claim is made. Only this discovery document is created; application files, persistence, and `TASKS.md` remain unchanged.

## 2. T-HQ-003 Canonical Requirements

### Canonical task

**Source:** `TASKS.md:917–934`.

**Title:** `T-HQ-003 — Dashboard cards and drill-down`.

The task has no separately labelled acceptance-criteria section. Its goal, behavior, invariants, failure rules, tests, QA, and Definition of Done supply the acceptance conditions:

- **Requirements:** `FR-HQ-012..013`, `docs/product/HQ-DASHBOARD.md`.
- **Goal:** “The ten cards with exception-first ordering, two-click drill-down, and export.”
- **ADR:** `ADR-0021 (export audit)` as written in the task; see reference discrepancy below.
- **Product Docs:** `docs/product/HQ-DASHBOARD.md`, `DESIGN.md` §4.
- **Modules:** `src/features/hq`, `src/app/hq/*`.
- **Dependency:** `T-HQ-002`.
- **Behavior:** “cards (Active Operators, Active Selling Points, Today's Gross, Net After Expenses, Digital (verified vs unverified), Cash, Stock Alerts, Unclosed Shifts, Operational Alerts, Location Changes).”
- **Invariants:** “digital verified and unverified never merged; every number drills to records; exports audited.”
- **Finance:** “the operational truth surface.” **Security:** “scope + masking.”
- **Privacy:** “operator names only where operationally required; no surveillance tiles.”
- **Offline:** n/a. **Concurrency:** “export while data changes ⇒ snapshot timestamp recorded.”
- **Failures:** “card error states are explicit and non-misleading.”
- **Tests:** “e2e: card rendering, drill-down, export audit, freshness badges.”
- **Manual QA:** `QA-H-01/02/06`.
- **DoD:** “HQ can understand the network in a 30-second glance.”

`PRD.md:371–372` defines the two explicitly cited requirements:

- **FR-HQ-012:** HQ-configured cash tolerance, shift duration, verification age, expense flags, and variance thresholds as **configuration with audit**.
- **FR-HQ-013:** area/region filter on **every HQ view**, so supervisors see only their scope.

### Dependency and related acceptance requirements

`T-HQ-002` (`TASKS.md:898–913`) requires precomputed, idempotently rebuildable per-area/day read models with `computedAt` and `sourceWatermark`; scoped reads; explicit stale/unavailable states; overlapping rebuild safety; integration tests for deterministic rebuilds, freshness, and correctness versus raw facts; seeded 2,000-stall performance; QA-H-01/08. Its dependencies are `T-CLOSE-001`, `T-EXP-001`, `T-STOCK-003`. Existing inline queries are not completion of this dependency.

`docs/product/HQ-DASHBOARD.md` §§2–4 instead enumerates these ten cards:

| Card | Required values | Freshness target | Underlying records |
|---|---|---|---|
| Coverage today | Active shifts, shifts without a location report, idle stalls | ≤60 s | Shifts → operator/stall/location report |
| Sales today | Gross by method; verified and unverified digital separate | ≤60 s | Sales → lines/price snapshots |
| Cash position | Expected, counted, variance, unresolved count | ≤5 min | Closings → shift/cash arithmetic |
| Verification backlog | Pending count, unverified amount, oldest age | ≤60 s | Payments → evidence/provider reference |
| Stock status | Issues, consumption, waste, variance counts/reasons | ≤10 min | Stall stock → movements |
| Incidents | Open by severity, age/SLA, owner | Event-driven | Incident → actions |
| Expense review | Queue size, flagged record counts, median age | ≤5 min | Expense queue |
| Unfinished closings | Count/value by area, causes | ≤5 min | Shift list |
| Location coverage | Used today, dormant for configurable period, restricted with reason | ≤15 min | Location → history |
| Exceptions first | Merged, deduplicated, consequence-ordered decision queue | ≤2 min | Direct record links |

Additional product rules: exceptions before aggregates/charts; stored values, not inline page aggregation; `computedAt`, freshness bands (`current` <5 min, `recent` 5–60 min, `stale` >60 min), visible dimming and manual refresh; every number drillable in scope; server-side area/region filtering; audited `export.created` with generation freshness and no other area's records; operationally necessary names only; no operator live tracking/last-seen/per-person timeline; neutral “Selisih,” not “Hilang”; role-specific landing priorities and auditor read-only reconstruction.

### Referenced routes, APIs, exports, and tests

- Task delivery route: **`/hq` and `/hq/*`**, not `/`. `docs/design/PAGES.md` §3 lists `/hq/verification`, `/hq/expenses`, `/hq/variance`, `/hq/incidents`, `/hq/settlements`, `/hq/menu`, `/hq/pricing`, `/hq/people`, `/hq/locations`, `/hq/audit`, `/hq/config` as planned related surfaces. Their existence is mapped separately in §10.
- `docs/operations/API-READ.md` §5 references `GET /api/v1/hq/{coverage,sales,cash-position,verification-backlog,stock,incidents,expense-review,closings,locations,exceptions}`; each carries `computedAt`, `freshnessBand`, and a `drillDown` descriptor, with `sourceWatermark` where applicable.
- Architecture §8 names `coverage_today`, `sales_today`, `cash_position`, `verification_backlog`, `stock_position_by_stall`, `incident_board`, `expense_review_queue`, `closing_completeness`, `location_usage`, `exceptions`, carrying organization/scope/freshness. These are **planned stored models**, not runtime tables found in this checkout.
- Drill-down read contracts include shift/sale/payment/expense/incident detail and lists, closing list, stock movements/positions, locations, and audit reconstruction. `drillDown()` existing as a function or an endpoint string in JSON is not a functioning two-click UI.
- `GET /api/v1/exports/closings.csv` is the explicit CSV route in API-READ §3, Finance + Owner, one row per closing with verification split. `FR-HQ-010` additionally requires **scheduled and ad-hoc operational CSV exports**, scoped with audit of who exported what. Product HQ-OQ-3 leaves the exact scheduled Finance export set open; it does not cancel the general export requirement. Export snapshot timestamp is required during concurrent changes.
- QA-H-01: ten cards and freshness/stale labels. QA-H-02: every number reaches records in ≤2 clicks. QA-H-06: export permission, audit, masking. End-to-end tests must exercise these behaviors, not only fixture objects.

### Documentation conflicts / unresolved requirements

1. Task's ten-card names differ materially from HQ-DASHBOARD's table (e.g. net after expenses versus expense review; location changes versus location coverage). Preserve both lists; exact consolidated card acceptance is **UNKNOWN pending specification reconciliation**, not permission to pick a convenient subset.
2. `ADR-0021` is actually `docs/adr/ADR-0021-notification-channels.md` (“Notification channels: in-app first”), not an export-audit ADR. Do not invent the missing referenced ADR.
3. `DESIGN.md` §4 concerns operator core flows/tap budgets, despite the task's dashboard reference. The HQ-specific page inventory is `docs/design/PAGES.md` §3.
4. Product role-landing table and canonical permissions vocabulary differ (e.g. Analyst appears in product/code; permissions defines other roles). Code's eight-role union is reported in §8, not treated as full policy compliance.

## 3. T-HQ-003 Requirement Matrix

`IMPLEMENTED` means observed source behavior only; `PARTIAL` means some implementation exists but does not meet the whole requirement; `MISSING` means no working implementation located; `UNKNOWN` means unresolved or unverified. **All boxes deliberately remain unchecked.**

| Checklist | State | Current evidence / limitation |
|---|---|---|
| [ ] R01 — Resolve the exact ten-card contract between TASKS.md and HQ-DASHBOARD.md. | UNKNOWN | The two canonical references disagree; not an implementation decision made here. |
| [ ] R02 — Satisfy T-HQ-002: scoped, stored, rebuildable per-area/day models with computedAt/sourceWatermark. | PARTIAL | `src/features/hq/index.ts` has on-demand Map scans; nine HQ HTTP handlers independently scan Maps. No persisted read models/worker; watermark unpopulated. |
| [ ] R03 — Render all ten required cards using truthful operational values. | PARTIAL | `src/app/hq/page.tsx:143–244` renders ten containers, five with data state and five with fabricated/heuristic values; task-specific net/active-operator metrics absent. Redesigned `/` absent. |
| [ ] R04 — Present exceptions first, merged, deduplicated, consequence-ordered, with actionable record links. | PARTIAL | HQ exceptions route concatenates payments/incidents/flagged expenses, no consequence sort/dedup; page says “Tidak ada eksepsi” and places it late. |
| [ ] R05 — Keep verified and unverified digital amounts separate in values and presentation. | PARTIAL | HQ sales API separates buckets; page shows generic total and unverified backlog, not a verified digital line; faulty total/fallback calculations (§4). |
| [ ] R06 — Drill every number to its contributing records in at most two clicks, preserving scope and filters. | PARTIAL | Metadata descriptors and internal `drillDown()` exist; numbers not clickable; only generic links to mostly static pages. Missing detail/list routes. |
| [ ] R07 — Show accurate freshness on every card, stale dimming/labels, and manual refresh. | PARTIAL | `FreshnessBadge` exists, only five card states use it; timestamps/bands often invented; no refresh affordance/stale propagation. |
| [ ] R08 — Apply area/region filters server-side on every HQ view and underlying read. | MISSING | HQ handlers authorize organization-level targets and query whole organization; no area/region input filtering. |
| [ ] R09 — Enforce authenticated role/object scope and sensitive-field masking throughout cards, drill-downs, and exports. | PARTIAL | RBAC helper/org filters/payment-reference masking exist; sessions fabricated, object-scope gaps remain, pages public; no export route. |
| [ ] R10 — Support audited HQ-configurable thresholds (FR-HQ-012). | PARTIAL | `/api/v1/config/thresholds` returns literals only; no persisted threshold configuration, update or associated configuration audit flow. |
| [ ] R11 — Provide scoped scheduled and ad-hoc operational CSV exports, including the closing CSV contract. | MISSING | No export route, CSV implementation, export UI or scheduled exporter. Privacy helper is only a simulated personal export. |
| [ ] R12 — Audit every export as export.created; record actor/what, snapshot timestamp and freshness; mask and isolate exported data. | MISSING | Audit writer/action type exist, but no operational export path invokes them. |
| [ ] R13 — Keep operator names operationally necessary and omit surveillance tiles/live tracking/per-person timelines. | PARTIAL | No such surveillance tiles present; `/hq` hardcodes “Budi” instead of scoped necessary identity. No complete minimization/role-aware DTO path. |
| [ ] R14 — Use neutral variance wording (Selisih; UNKNOWN without accusation). | IMPLEMENTED | `/hq` cash card says “Selisih”; closing reason choices include UNKNOWN. This narrow wording observation does not validate the displayed cash figures. |
| [ ] R15 — Provide role-appropriate default landing/priorities, including read-only auditor reconstruction. | MISSING | `/` always operator home; `/hq` fixed layout; no role routing or audit page. |
| [ ] R16 — Display explicit non-misleading card failure/degraded states rather than fabricated success or zero. | MISSING | HQ fetches swallow errors into `{}`; fallback values use current time/zeros; no card error rendering. |
| [ ] R17 — Add and execute real E2E tests for rendering, drill-down, export audit and freshness. | MISSING | `tests/e2e/hq-coverage.spec.ts` checks local literals only; no app navigation/request/export assertions. |
| [ ] R18 — Execute QA-H-01/02/06 and verify the 30-second network-understanding DoD. | UNKNOWN | Not executed here; no current full-acceptance evidence established from the inspected artifacts. Historical screenshots are not complete QA proof. |

## 4. Current Dashboard Static Data

### Root `/`: exactly what is present

`src/app/page.tsx:1–60` imports only React hooks, `OfflineBanner`, and `TapTarget`. Both imported components were inspected in full. Neither fetches data, imports backend features, nor persists anything. `src/app/layout.tsx` adds metadata/style only, with no auth/data provider.

| Requested area / KPI | Source at `/` |
|---|---|
| Sales | Not present; no constant/API/computation. |
| Transaction count | Not present. |
| Average transaction | Not present. |
| Expenses | No KPI; only navigation to `/expenses`. |
| Expense ratio | Not present. |
| Active outlet count | Not present. |
| Total outlet count | Not present. |
| Outlet rows | None: neither constants, fixtures, props, API nor server data. |
| Alerts | No alert dataset; a link to `/alerts`. |
| Sales chart | None: no hardcoded/computed/server-backed points. |
| Recent activity | No component, dataset, or read. |
| Search/filter | No controls or handlers. |
| Forms/modals | None. |

**Root static/mock inventory:** `pendingCount` is `useState(0)` with no setter (`:9`), so not actual outbox state; static Indonesian copy, footer version `v0.1`, styling and route links. `isOffline` begins false and is updated from `navigator.onLine`/browser events (`:11–20`), not server or persistence state. `OfflineBanner` derives text from these props; its “penjualan tetap tercatat” copy is not proof of offline durability. All five `TapTarget` actions are navigation to `/shift`, `/sell`, `/stock`, `/expenses`, `/closing`; HQ/alert links are ordinary navigation, **not nonpersisting submit forms**.

### Actual HQ dashboard `/hq`: partial live data and every placeholder

`src/app/hq/page.tsx:14–120` fetches `/api/v1/sales?limit=100`, `/api/v1/hq/sales`, `/api/v1/stock`, `/api/v1/shifts?status=OPEN`, `/api/v1/hq/cash-position` once on mount; optionally `/api/v1/shifts?limit=10`. It does not call `src/features/hq` or most HQ card APIs. Neither day nor area is supplied. Imported `FreshnessBadge`, `MoneyText`, and money helpers format props; they do not fetch facts.

| Surface | Actual source / static or misleading behavior |
|---|---|
| Sales total | HQ payment buckets, falling back to client sum of up to 100 sales. `cash ?? 0 + verified` parses as `cash ?? (0 + verified)`, so an existing cash number bypasses the verified amount. Fallback sums sale totals without verification/status constraint. API itself is all-time, not selected-day. |
| Transaction count | `hqSalesRes.data.totalSales` (all org sale rows, all statuses), else returned sales length. Not a verified daily completed-transaction count. |
| Average transaction, expense total/ratio, active/total outlet KPIs | Not implemented here either. Coverage's shift count is not a distinct outlet/operator count. |
| Coverage | Length of fetched OPEN shifts (default API limit 25); hardcoded missing-location count `0`; idle stalls `1` if zero shifts, otherwise `0`; “Stall ST-001 • Budi • Kas awal Rp 50.000” whenever any shift exists. |
| Cash | Browser sums opening cash and cash payment bucket; fallback sums COMPLETED sale totals regardless of payment method. Ignores expenses. `countedCash` assigned equal to expected; variance hardcoded `0`. Unresolved count alone comes from cash-position API. |
| Verification | Unresolved count from cash-position response, unverified amount from sales response; oldest age fabricated as `0.5` hours when pending, otherwise `0`. Does not consume the existing verification-backlog API. |
| Expense review | Literal `Pending review: 0`, `Flagged: 0`; links to static review page. |
| Incidents | Literal `Terbuka: 0`, `Kritis: 0`; links to static incident page. |
| Closing completeness | Literal submitted `0`, missing `1` if there are any active shifts, else `0` (not actual count). |
| Location usage | Literal `Lokasi aktif: 1 — Alun-alun Bandung`, `Padat: 0`. |
| Exceptions | Literal “Tidak ada eksepsi”; ignores existing exceptions endpoint. |
| Stock | `/api/v1/stock` returns organization-wide per-item quantities; client classifies low as `0 < qty < 10`, empty as `qty <= 0`, displays first four items. Threshold 10 is hardcoded; no per-stall table. |
| Freshness/errors | Frequent `new Date()`/literal `current` or `recent`, including fallbacks after failures; only five cards have badges. Fetch does not check `res.ok`; errors/invalid JSON become `{}`. Loading text exists, honest error states do not. |

No chart or recent-activity feed exists in `/hq`. No dashboard search/filter/export button/modal exists. Generic quick links are navigation, not drill-downs from every number.

### Related static alerts and nonpersisting actions

- `/alerts` (`src/app/alerts/page.tsx`) contains three literal notices: Siomay Ayam price Rp16,000 effective tomorrow; Kulit Pangsit stock 5 at ST-001; one QRIS payment pending. No API/state source.
- `/hq/expenses`: literal EXP-001 / SH-001 / UNVERIFIED_FIELD_EXPENSE / Rp50,000 / REVIEW_REQUIRED; **Review** button has no handler.
- `/hq/incidents`: literal INC-001 broken stove at ST-001/Alun-alun, HIGH; **Acknowledge** and **Resolve** buttons have no handlers.
- `/hq/verification`: server-rendered explanatory text only, no verification action or queue.
- `/shift`: **Mulai Jualan Sekarang** does POST `/api/v1/shifts` with fixed operator/stall/location/opening-cash payload, but that route exports **GET only**. There is no HTTP write implementation for this button in this checkout (a POST would be unsupported). This contradicts a prior audit's POST claim.
- `/expenses`, `/stock`, `/closing`, and `/sell` have actual submit handlers pointing at existing write routes; do **not** label all forms fake. They use seeded/fixed shift context and have other limitations; no success/persistence was runtime-verified in this discovery.

## 5. Existing Backend Capabilities

### Architecture actually implemented

- Next.js **15.4.2**, React **19.1.0**, TypeScript; App Router pages and `src/app/api/v1/**/route.ts`. Zod boundary schemas are present. No `"use server"` actions found.
- `src/domain/*`: pure state/arithmetic helpers for sale snapshots/change, cash closing, expenses, stock, payment states, operators, location reports, pricing and rewards.
- `src/features/*/index.ts`: executable use cases, usually directly importing `memoryStore`; not a uniformly port-isolated architecture. Sales/payments/expenses/stock/shift writes and audit calls exist. Some modules are simulations or isolated process-local Maps.
- `src/server/db/repository.ts`: `ScopedRepository` interface, `filterByScope`, and a small operators/stalls/shifts repository object. Most routes/features bypass it. `withTransaction()` just invokes the callback; no rollback or database transaction.
- HQ HTTP handlers duplicate aggregation instead of using `src/features/hq`. No dedicated aggregate persistence/query engine exists. Naming a helper a “read model” does not make it a stored model.

### HQ handler inventory (all GET, all in `src/app/api/v1/hq/<name>/route.ts`)

All nine use session organization, a role check, and on-request scans. None enforces area/region scope or selected business day; metadata is generated at request time, without source watermark.

| Endpoint suffix | Actual payload/capability | Limits / discrepancy |
|---|---|---|
| `sales` | CASH PAID, noncash PAID, PENDING_VERIFICATION amount buckets; sale count | All-time; sale count includes all statuses; payment amounts not joined/filter-constrained to completed sales/day. |
| `cash-position` | Total variance, unresolved count, closing count | Reads `closing.varianceMinor`, but stored closing field is `cashVarianceMinor`; expected/count not returned. Descriptor points to missing `/api/v1/closings`. |
| `verification-backlog` | Pending count/value, oldest minutes/payment id | `payment:reconcile` permission (default HQ_OPS lacks this); org-wide, not area-scoped. |
| `stock` | Movement quantity totals by kind, count | No variance-by-reason/area breakdown. |
| `incidents` | Counts by category/status, total | No severity/SLA/owner/age board. |
| `expense-review` | Pending/flagged/total counts | Requires `expense:review`; no median age. |
| `closings` | Count/list of OPEN shifts | No area/cause/value model, no actual closing-list endpoint. |
| `locations` | Total, usedToday, dormant, restricted count | `today` unused; usedToday means any historical report; no dormant-day window. |
| `exceptions` | Concatenated pending payments, non-CLOSED incidents, flagged expenses | No dedup/severity order; resolved incidents can remain; no merged missed-closing/long-shift/high-variance queue; GET incident drill-down missing. |
| `coverage` | **No handler** | `getCoverageCard()` exists as a feature function, not an HTTP endpoint. |

`src/features/hq/index.ts` separately implements `getCoverageCard`, `getVerificationBacklogCard`, `getCashPositionCard`, `getSalesCard`, `getExpenseReviewQueueCard`, `getIncidentBoardCard`, `getStockPositionCard`, `getClosingCompletenessCard`, `getLocationUsageCard`, `getExceptionsCard`, and `drillDown`.

- Some helpers accept businessDay and filter facts, unlike their HTTP counterparts. Inputs are organization IDs, not enforced full caller scope.
- `ReadModelEnvelope<T>` includes optional watermark, never populated. Timestamps are generated per call.
- Stock helper returns literal zero counts; incident helper checks a severity field absent from `StoredIncident`; location helper counts statuses, not history windows.
- `drillDown` supports coverage/verification/cash/expenses/stock, slices first 50, ignores `key` and `cursor`, and returns no next cursor. It is not wired to routes/UI. Its coverage set (OPEN only, no day) also differs from coverage helper (day + OPEN/PENDING_SYNC).

### Other operational capabilities

| Area | Located implementation |
|---|---|
| Sale/transaction | `/api/v1/sales` GET/POST, `/sales/[saleId]/complete` POST; `features/sales`: snapshots, create/complete/void/get. No entity named Transaction; Sale is the actual transaction record. |
| Payments | GET `/payments`, POST `/payments/cash`, `/payments/digital`, webhook POST `/webhooks/payments/[provider]`; payment feature/reconciliation helper and HMAC verifier. Not proof of a production QRIS integration. |
| Expenses | GET/POST `/expenses`; submit/review/list helpers and flags/audit. No HTTP expense-review action/detail route. |
| Shifts/closing | GET `/shifts`; POST `/shifts/[shiftId]/closing`, `/location-reports`, `/location-changes`; feature start/suspend/handover/closing functions. No POST `/shifts`. |
| Stock | GET `/stock`, `/stock/movements`, `/stock/positions`; POST `/stock-reports`, `/restock-requests`; inventory movement/count functions. |
| Catalog/locations/operators | GET `/menu/items`, `/menu/prices`, `/locations`, `/operators/me`; POST `/locations`, `/price-acknowledgements`; operator/stall/assignment/menu/location/pricing feature functions. No outlet/stall registry-list API. |
| Incidents | POST `/incidents`; create/transition/list feature functions. No HTTP incident list GET, transition or detail route; HQ incident/exception descriptors pointing at its GET are broken. |
| Sync/loyalty | POST `/sync/batches`, `/loyalty/customers/identify`, `/loyalty/rewards/[rewardInstanceId]/redeem`; in-memory outbox/use cases. Not evidence of browser durable offline operation. |
| Audit/activity | `features/audit`: append, list, reconstruct by shift subject ID. GET `/audit` supports action/actor/subject filtering and appends `audit.queried`. No general Activity entity or dashboard activity feed. Audit array remains mutable; no DB-enforced append-only/transactionality. |
| Alerts/notifications | Persisted `alerts` and `notifications` Maps. In-app channel writes **alerts**, but GET `/notifications` reads **notifications**; dashboard/alerts page reads neither. Other delivery channels are no-ops. |
| Exports/reports | Raw lists/card summaries; no reporting page, CSV route or operational exporter. `features/privacy.exportPersonalRecords` creates an id/expiry and audit entry, but no export file. |
| Background jobs | `server/jobs/queue.ts` stores jobs/schedules in process arrays/Maps and logs; no running worker, scheduled refresh execution, or pg-boss persistence. |
| Evidence | `server/storage/evidence-store.ts` stores metadata in a private Map, returns `fake-presigned` local URLs; those upload/download routes absent. No actual durable evidence blob adapter. |

### What later dashboard consumption can and cannot rely on

This is a contract inventory, **not a proposed implementation**. Existing candidates are sales/payment buckets and raw sales, shifts, expenses, stock, incidents, locations, and audit events. Current contracts do **not** provide a safe complete dashboard DTO: no outlet row model, outlet counts, average ticket/expense ratio KPI contract, sales time series, activity feed, stored freshness/watermark, or enforced area/day model. These must not be assumed to exist because the future UI has labels for them. “Outlet” also needs an explicit mapping to Stall versus SellingLocation; they are distinct entities.

## 6. Persistence

```text
PERSISTENCE TYPE: Process-local Maps/array with synchronous whole-store JSON snapshots.
AUTHORITATIVE STORE: memoryStore for current-process reads; <process.cwd()>/data/db.json
                     is the implemented durable reload source, not PostgreSQL.
WRITE PATH: route/use case -> Map.set/delete/clear or auditEvents.push -> persistStore()
            -> data/db.json.tmp -> renameSync(data/db.json).
READ PATH: module import -> loadStore()/dateReviver -> memoryStore;
           subsequent routes/features read Maps directly, not JSON per request.
RESTART PERSISTENCE: Implemented reload/seed code, conditional on a surviving readable/writable
                     filesystem and successful writes. NOT restart-tested this turn.
```

**Evidence:** `src/server/db/memory-store.ts:429–560, 838–859`; `src/server/db/index.ts`; feature/route imports. Initialization is `loadStore()` → wrap mutations → `ensureSeed()` → persist if not loaded. ISO-like strings are revived to Dates.

**Actual file presence:** no `data/` directory or `data/db.json` exists in this project's current filesystem at inspection; none found at the Git root or `/home/user/data` either. Consequently there is **no current dataset or record count to report**. This does not negate the file-backed adapter: its source is verified, but boot was deliberately avoided. A previous audit's saved file size/records describe that earlier environment only.

**Seed implementation:** `ensureSeed()` (`:563–836`) supplies deterministic IDs for two operators (Budi/Sari), ST-001, an assignment, Alun-alun Bandung, two menu categories, four menu items/prices, four stock items and opening movements of 40, and a fixed-ID OPEN shift with Rp50,000 opening cash, location report and START stock counts when conditions allow. Dates/business day are generated at initialization, not timeless fixtures. Organization/area are ID values, not runtime organization/area Map records. Seed does not imply a current existing file or continuously refreshed “today” shift.

**Durability caveats:** errors in load/write are swallowed; import can seed after failed reads; mutable record-field changes are not individually intercepted; a later persisted mutation can snapshot them. `clear()` writes and replaces the audit array, so the initial push wrapper is not guaranteed to remain attached afterward. No locking, cross-process refresh, transactional rollback, durable job queue, or atomic multi-record unit of work. Atomic file rename is not a database transaction or concurrency guarantee.

**SQL status:** Drizzle `schema.ts` declares 27 PostgreSQL tables; `drizzle.config.ts` points at the schema and `src/server/db/migrations`. `pg`/Drizzle dependencies exist. No runtime `Pool`/Drizzle client initialization or SQL queries/migration files were located in this project. Do not treat schema declarations or deployment plans as a live PostgreSQL adapter.

## 7. Domain Entities

`PERSISTED: JSON` below means the entity has a collection included in load/save code, **not that records were observed on disk**. Key fields are representative, not full schemas. `USED BY DASHBOARD` means current `/hq` data path; **none of these entities is consumed by `/`**. Relationship arrows describe IDs in code, not database-enforced foreign keys in the running adapter.

Source shorthand **MS** = `src/server/db/memory-store.ts` (line references below).

| ENTITY | SOURCE FILE | PERSISTED | KEY FIELDS | RELATIONSHIPS | USED BY DASHBOARD |
|---|---|---|---|---|---|
| Operator | MS:13 | JSON `operators` | id, organizationId, areaId, name, phoneE164, status, active, contract/training | Assignments/shifts/sales/expenses | Only operatorId in shift payload; displayed name is literal |
| Stall | MS:28 | JSON `stalls` | id, org, areaId, code, type, status | Assignments, shifts, stock movements | No registry read; text ST-001 literal |
| OperatorAssignment | MS:38; `domain/operators/status.ts` | JSON `assignments` | id, operatorId, stallId, areaId, type, validFrom/To | Operator ↔ Stall | No |
| SellingLocation / SellingPoint | MS:50; `features/locations/index.ts` | JSON `sellingLocations` | id, org, areaId, name, address, lat/lng, status | Shift start, reports, sales | No; displayed location literal |
| Shift | MS:63 | JSON `shifts` | id, org, operatorId, stallId, businessDay, openingCashMinor, startLocationId, status, clientShiftId | Operator/Stall/Location; sales/expenses/closing | Yes: count/opening cash |
| LocationReport | MS:81; `domain/location/report.ts` | JSON `locationReports` | id, shiftId, stallId, operatorId, sellingLocationId, trigger, arrival/departure | Shift-bounded location history | Not current page; coverage helper only |
| MenuCategory | MS:97 | JSON `menuCategories` | id, org, name, sortOrder | Menu items | No |
| MenuItem | MS:104 | JSON `menuItems` | id, org, categoryId, name, active, portionNote | Sale items, price policy | No direct read; stock items separate |
| PricePolicy | MS:115 | JSON `pricePolicies` | id, menuItemId, scope/scopeId, unitPriceMinor, currency, effective interval, reason | MenuItem, org/area/location | Indirect sale price snapshots |
| PriceAcknowledgement | MS:131 | JSON `priceAcknowledgements` | id, operatorId, priceSetDigest, acknowledgedAt | Operator/price-set digest | No |
| Sale | MS:140; `domain/sale/totals.ts` | JSON `sales` | id, org, shiftId, operatorId, stallId, locationId, businessDay, totalMinor, status, clientSaleId | Shift; SaleItem; Payment | Yes: count/fallback totals |
| SaleItem / SaleLineSnapshot | MS:158; `domain/sale/totals.ts` | JSON `saleItems` | id, saleId, menuItemId, quantity, unitPriceMinor, lineTotalMinor, pricePolicyId | Sale/MenuItem/PricePolicy | Not directly; no detail drill-down |
| Payment | MS:169 | JSON `payments` | id, org, saleId, method, amountMinor, status, providerReference, verifiedAt/By | Sale; callback | Yes: money buckets/backlog count |
| PaymentCallback | MS:185 | JSON `paymentCallbacks` | id, paymentId, provider/reference, signatureValid, rawPayloadJson, dedupeKey | Payment | No |
| Expense | MS:197; `domain/expense/review.ts` | JSON `expenses` | id, shiftId, operatorId, category, amountMinor, paidFrom, reviewStatus, flag/evidence | Shift/operator/location | No: expense cards are literals |
| StockItem | MS:219 | JSON `stockItems` | id, org, code, name, category, unit, active | StockMovement/StockSnapshot | Yes: displayed stock rows |
| StockMovement | MS:229; `domain/inventory/variance.ts` | JSON `stockMovements` | id, stockItemId, stallId/operatorId/shiftId, movementType, quantity, reason, actorId | Item/stall/shift | Yes: stock quantity sum |
| StockSnapshot | MS:244 | JSON `stockSnapshots` | id, shiftId, stockItemId, phase, counted/expected/variance quantity, reason | Shift/stock item | No |
| Closing | MS:256 | JSON `closings` | id, shiftId, opening/cash sales/expenses, expected/count/cashVarianceMinor, digital amounts, status | Shift | API scans, but page ignores returned variance; counted cash fabricated |
| AuditEvent | MS:274; `features/audit/index.ts` | JSON array `auditEvents` | actor/action, entityType/Id, before/after JSON, reason, requestId, occurredAt | Polymorphic record IDs | No activity feed |
| IdempotencyRecord (infrastructure) | MS:291 | JSON `idempotency` | org, route, key, requestHash, responseJson/status, expiry | Route operation/replay | No |
| LoyaltyAccount | MS:303 | JSON `loyaltyAccounts` | id, org, phoneE164, consentGiven/At | RewardInstance | No |
| RewardInstance | MS:312; `domain/loyalty/reward.ts` | JSON `rewardInstances` | accountId, definitionId, period, issue/expiry/redemption dates, redeemedSaleId | LoyaltyAccount/Sale; definition is reference, no stored definition collection | No |
| Incident | MS:324 | JSON `incidents` | id, org, optional shiftId, operatorId, category, description, status, timestamps | Operator/shift | No: incident card literal; severity absent from stored type |
| Alert | MS:336; `server/notifications/channel.ts` | JSON `alerts` | id, type, severity, message, entity ref, acknowledged, createdAt | Polymorphic subject | No: alert page is literal |
| Notification (untyped collection) | MS:375; `/api/v1/notifications/route.ts` | JSON `notifications` | No enforced schema; reader expects organizationId, recipientId/recipientOperatorId | User/operator recipient | No; in-app sender writes alerts instead |
| EvidenceAsset metadata | MS:374; `server/storage/evidence-store.ts:17–40` | JSON slot exists, but actual adapter's private Map is volatile | asset id, organizationId, contentType, createdAt; fake URL/expiry | Expense evidence references | No; blobs not persisted |
| `shiftClosings` legacy/untyped slot | MS:376 | JSON slot | No typed fields/independent active entity established | Duplicates naming of typed `closings` | No direct use located |
| MessageThread | `features/communications/index.ts:6–24` | No; local Map | id, org, topicType/Id, createdAt | Messages/polymorphic topic | No |
| Message | `features/communications/index.ts:14–24` | No; local Map | id, threadId, org, authorId, body, createdAt | MessageThread/author | No |
| DataSubjectRequest | `features/privacy/index.ts:6–17` | No; local Map; separate audit persists | id, org, subject kind/reference, request kind, status, notes | Operator/customer reference | No |
| PerformanceInputSnapshot | `features/performance/index.ts:6–15` | No; local Map | operatorId, periodKey, inputs, normalisers, sampleSize, computedAt | Operator/facts | No |
| Location menu availability | `features/menu/index.ts:16–27` | No; availability Map | location/item key, available, reason; DTO resolved price | SellingLocation/MenuItem | No |
| OutboxRecord | `features/offline/index.ts:16–58` | No durable adapter; in-memory outbox | aggregate, clientId, sequence, payload, recordedAtDevice, syncState, reasonCode | Offline aggregate/record reference | No; root pending count fixed at zero |
| Organization | `server/db/schema.ts:14` | SQL declaration only | id, name, timezone, currency | All org-scoped records | Only organizationId passed through session |
| Region | `server/db/schema.ts:22` | SQL declaration only | id, org, name, code | Areas | No |
| Area | `server/db/schema.ts:33` | SQL declaration only | id, org, regionId, name, code, supervisorOperatorId | Operators/stalls/locations | No area filter consumed |

`DerivedStockPosition`, card envelopes, money, scope and session are value/DTO/context types, not additional persisted business entities. Client-ID Maps are indexes, not entities. There is **no actual Outlet, Transaction, Product, Inventory aggregate, Activity, persisted User or persisted Session model** under those names; use Stall/SellingLocation, Sale, MenuItem, stock records, and AuditEvent where appropriate rather than inventing equivalents.

## 8. Authentication

```text
AUTH MECHANISM: Fake environment-configured AuthPort, not credential authentication.
SESSION SOURCE: createAuthPort().resolveSession() fabricates a SessionContext on each call.
USER MODEL: SessionContext {organizationId, userId, operatorId?, roles, scope,
            deviceId?, sessionIssuedAt}; no persisted login user/session table.
SERVER GUARD: API helpers resolve a session; many routes call authorize().
              Page/layout authentication guards or auth middleware not found.
CLIENT GUARD: None on / or /hq; no login/session provider or role redirect.
```

Evidence: `src/server/auth/port.ts:1–95, 148–180`, `fake-provider.ts`, `src/app/api/v1/_helpers.ts:22–26`, root/HQ pages and root layout.

- Default role is HQ_OPS; organization/user IDs are constants, configurable with `FAKE_ORG_ID`, `FAKE_AUTH_ROLE`, `FAKE_OPERATOR_ID`. OPERATOR receives `self`, everyone else `org`; area/region assignments are not resolved from persisted membership.
- No request/cookie/token is inspected. OTP issuance returns a constant challenge; verification ignores phone challenge/code; revocation methods are no-ops.
- Production guard throws **only** when `NODE_ENV === "production" && ALLOW_FAKE_AUTH === "true"`. With the flag absent/false it still fabricates a session. This is not fail-closed production authentication.
- Code roles: OWNER, HQ_OPS, HQ_FINANCE, AREA_SUPERVISOR, MENU_PRICING_ADMIN, ANALYST, AUDITOR, OPERATOR. Do not substitute the larger spec role list.
- **`/` requires authentication? No. `/hq` requires authentication? No.** API 401 branches exist but the current resolver normally never returns null. These pages cannot be described as protected because they fetch guarded-looking API handlers.

## 9. Authorization / Scope

**Overall classification: UNSAFE for outlet/operator/area isolation; PARTIAL for tenant/organization isolation.** This is a source-supported potential-access finding, not an executed exploit or proof of a breach.

| Scope | Classification | Actual checks |
|---|---|---|
| Tenant | PARTIAL | No separate tenantId; organizationId is tenancy boundary. Many reads filter it, but there is no trustworthy authenticated membership resolution. |
| Organization | PARTIAL | `authorize` compares target organization; most list handlers filter session org. Some ID-based feature lookups/replay paths lack org validation. |
| HQ role | PARTIAL | `ROLE_PERMISSIONS` and many HQ action checks exist; all callers normally receive default HQ_OPS; pages lack guards. |
| Region / area | UNSAFE | `Scope` defines both, but no region authorization logic; supervisor check only rejects if both session area and **target area** are supplied. HQ callers pass `{kind:'org', organizationId}` and return all org rows. |
| Outlet/stall | UNSAFE | No outletId parameter/model. Stall scope exists as a type, not an enforced boundary on stock reads. |
| Operator/self | UNSAFE overall; PARTIAL on individual lists | GET sales/shifts explicitly filter self ownership; GET expenses/payments/stock do not apply equivalent ownership constraints. |

### Arbitrary outletId question, expressed in the actual model

Literal `outletId` is not supported in source; an unknown query parameter does not implement isolation. The equivalent **`stallId`** is accepted by `/api/v1/stock/movements` and `/api/v1/stock/positions`:

1. `OPERATOR` has `stock:view` (`server/auth/port.ts` role map).
2. Both routes authorize an **org** target, not the requested stall/assigned operator.
3. `authorize()` only checks another self operator when target.kind is also `self`; it does not deny this org target for a self-scoped caller.
4. Routes filter organization then client-supplied stallId with **no assignment/self/area membership check**.
5. Therefore an operator-like session can potentially request another stall in the same organization and read its inventory. `/api/v1/stock` returns org-wide inventory even without a stall parameter. Same-organization expense/payment list leakage also does not require knowing an outlet ID.

Cross-organization IDs are excluded by those specific list filters; do not inflate that finding into an assertion that every read leaks across organizations. However, `features/sales.createSale()`'s client-ID replay lookup and `getSaleById`/`getStallById`/`getShiftById` interfaces, as well as expense shift lookup, are not a uniformly scoped repository boundary. Cross-tenant write/detail guarantees are not established.

Additional gaps:

- `repository.filterByScope` checks area/stall/operator only when relevant properties exist and has no region filtering; findById helpers check organization only. Most callers bypass repositories.
- Expenses GET only resolves session and calls `listExpensesForReview(org,status)`; no review permission/self guard.
- Payments GET checks role, masks provider reference for non-Finance/non-Owner, but returns all organization payments. Its masking policy differs from permissions spec (Auditor reference access).
- `authorize` throws but does not emit `authz.denied`; the authorization test manually writes an audit entry, not an automatic-denial test.
- `/api/v1/notifications` compares optional operator recipient/session IDs; absent IDs can compare equal. No guarantee of strict self-only inbox coverage.

## 10. Relevant Routes

Status here is source status, not runtime health. **API auth notation:** `F` = fake session resolver/401 branch; `R(action)` = additional role check, usually org-target only. All pages below lack auth guards. API sources are `src/app/api/v1/<suffix>/route.ts`; page sources `src/app/<route>/page.tsx` (root `src/app/page.tsx`).

| Route | Purpose | Server/client | Data source | Auth | Status |
|---|---|---|---|---|---|
| `/` | Operator home/navigation | Client | Literal text, fixed pending count, browser online status | None | Present; requested redesign absent |
| `/hq` | HQ card dashboard | Client | Five API reads + fallback sixth; browser aggregation/literals | None | Partial, misleading failure/placeholder values |
| `/hq/expenses` | Expense review table | Client | One literal row | None | Static, Review inert |
| `/hq/incidents` | Incident board | Client | One literal incident | None | Static, action buttons inert |
| `/hq/verification` | Verification explanation | Server component | Text only | None | No queue/action |
| `/alerts` | Alerts | Client | Three literal notices | None | Static |
| `/sell` | POS transactions | Client | Menu/items/prices + sales/payment writes; fallback price literals | None; APIs F | Partial connected POS, fixed shift context |
| `/expenses` | Submit expense | Client | Form/category constants → POST expenses | None; API F | Write path exists, fixed shift context |
| `/stock` | Stock count form | Client | GET stock → POST stock-reports | None; API F/R | Read/write paths exist, fixed shift context |
| `/closing` | Submit closing | Client | Local counted cash, fixed expected/shift assumptions → closing POST | None; API F | Partial, not live cash reconciliation |
| `/shift` | Start shift | Client | Fixed context → POST shifts | None | POST handler missing |
| `/locations` | Selling points | Client | GET locations | None; API F/R(location:view) | List read exists |
| `/operator` | Operator profile | Client | GET operators/me | None; API F | Default HQ session has no operator; route returns NOT_FOUND |
| `/outlets`, `/transactions`, `/reports`, `/exports` | Outlet/transaction/report/export pages | — | — | — | Not present; `/sell` is POS, not transaction report |
| `/hq/variance`, `/hq/settlements`, `/hq/menu`, `/hq/pricing`, `/hq/people`, `/hq/locations`, `/hq/audit`, `/hq/config` | Planned HQ surfaces | — | — | — | Specification only; no pages |
| `/api/v1/hq/sales`, `/cash-position`, `/stock`, `/incidents`, `/closings`, `/locations`, `/exceptions` (all under `/api/v1/hq`) | Card summaries | Server GET | Direct org-wide Maps | F + R(hq:view) | Present; partial contracts (§5) |
| `/api/v1/hq/verification-backlog` | Verification summary | Server GET | Payments Map | F + R(payment:reconcile) | Present; not used by dashboard |
| `/api/v1/hq/expense-review` | Review summary | Server GET | Expenses Map | F + R(expense:review) | Present; not used by dashboard |
| `/api/v1/hq/coverage` | Coverage summary | — | Feature helper only | — | No route |
| `/api/v1/sales` | Sales list/create | Server GET/POST | Maps / createSale | F; GET self filter, no action check | Implemented paths; limited list filters/pagination |
| `/api/v1/sales/[saleId]/complete` | Complete sale | Server POST | Sale/payment feature | F | Exists; not a sale detail GET |
| `/api/v1/payments` | Payment list | Server GET | Maps | F + R(payment:view) | Partial scope/masking |
| `/api/v1/payments/cash`, `/api/v1/payments/digital` | Payment writes | Server POST | Payment use cases → Maps/audit | F | Implementations present; not provider readiness proof |
| `/api/v1/expenses` | Expense list/submit | Server GET/POST | Expense features → Maps | F, no GET action/self filter | Partial authorization |
| `/api/v1/shifts` | Shift list | Server GET only | Maps | F + R(shift:view), self filter | No create route despite UI POST |
| `/api/v1/shifts/[shiftId]/closing` | Submit closing | Server POST | Closing feature → Maps | F | No GET closing list/detail |
| `/api/v1/shifts/[shiftId]/location-reports`, `/location-changes` | Shift-bounded location write | Server POST | Location features | F | Present |
| `/api/v1/stock`, `/api/v1/stock/movements`, `/api/v1/stock/positions` | Stock reads | Server GET | Map sums / derivation | F + R(stock:view) | Present, unsafe same-org stall scope |
| `/api/v1/stock-reports`, `/api/v1/restock-requests` | Stock writes/requests | Server POST | Inventory features | F | Present |
| `/api/v1/incidents` | Incident create | Server POST only | Incident feature → Maps | F | No list GET/detail/transition route despite HQ drill-down descriptors |
| `/api/v1/locations` | Location list/create | Server GET/POST | Maps | F + R(location:view/manage) | Cursor paging; no GET area filter; POST accepts areaId without assigned-area enforcement |
| `/api/v1/operators/me` | Self operator | Server GET | Operator Map by session operatorId | F | No operator on default HQ session |
| `/api/v1/menu/items`, `/api/v1/menu/prices` | Catalog/price reads | Server GET | Menu/pricing Maps | F + R(menu:view) | Present |
| `/api/v1/audit` | Audit search | Server GET | Audit array; read adds query audit event | F + R(audit:view) | Not dashboard activity feed |
| `/api/v1/notifications` | Inbox read | Server GET | notifications Map, not alerts Map | F | Partial source/recipient wiring |
| `/api/v1/config/thresholds` | Threshold read | Server GET | Constants | F + R(config:view) | Not persisted/audited configuration |
| `/api/v1/exports/closings.csv`, `/api/v1/closings` | Specified export/closing list | — | — | — | Missing despite descriptor/reference |
| `/api/v1/sales/[saleId]`, `/api/v1/payments/[paymentId]`, `/api/v1/expenses/[expenseId]`, `/api/v1/incidents/[incidentId]`, `/api/v1/shifts/[shiftId]` | Record drill-down GETs | — | — | — | Not present; nested write handlers do not supply detail GETs |
| `/api/v1/outlets`, `/api/v1/activity`, `/api/v1/reports` | Possible future consumer concepts | — | — | — | No routes found |

Other present server POST routes: price acknowledgements, sync batches, loyalty identify/redeem, payment provider webhook. No auth/login endpoint, server-action dashboard data layer, or global auth middleware was found.

## 11. Existing Tests

**CURRENTLY EXECUTED? No, for every file below in this discovery.** “What it proves” means the limited subject the assertions could establish **if run successfully**; test existence is not a pass. Current CI results were not queried.

`vitest.config.ts` selects `tests/**/*.test.ts`/`.tsx`, node environment, excludes E2E. `package.json` provides test/integration/browser/e2e commands. Root `../.github/workflows/project-checks.yml:142–154` configures SiomayOps typecheck + `npm test` + build; this includes unit/integration/browser-named Vitest files, **not Playwright**. Project-local `.github/workflows/ci.yml` is a Phase-0 docs/stubs workflow with test commands commented out (nested workflow is not itself a root GitHub workflow). `playwright.config.ts` defines Android/desktop projects but no webServer startup.

| TEST FILE | WHAT IT PROVES / does not prove | CURRENTLY EXECUTED? |
|---|---|---|
| `tests/e2e/hq-coverage.spec.ts` | Checks two fabricated local objects and arithmetic. Does not visit `/hq`, fetch APIs, render cards, click links, verify freshness UI, or export. | No; Playwright command only, not current root CI job |
| `tests/e2e/cash-sale.spec.ts` | Constant tap counts/cash arithmetic/neutral reason list; does not create a sale or use UI. | No; Playwright |
| `tests/e2e/offline-day.spec.ts` | Local array/constant sync/payment assertions, not network/browser persistence. | No; Playwright |
| `tests/integration/authorization.test.ts` | Direct `authorize` tests for explicit self/area mismatch and role denial. Manually writes denial audit; `expect(true)` for purported compile-time proof. No HTTP IDOR/read-scope or genuine session test; unused otherOrgId is not cross-tenant coverage. | No; selected by Vitest/CI config |
| `tests/integration/audit-append-only.test.ts` | Append/reconstruct feature calls and absence of update/delete methods. Does not prove storage immutability, transaction rollback or write-failure handling. | No; Vitest/CI config |
| `tests/integration/closing-immutability.test.ts` | Creates shift/closing, same-client replay and rejection after transition. Late-sale test is tautological; no actual accepted-closing database constraint or offline persistence proof. | No; Vitest/CI config |
| `tests/integration/idempotency.test.ts` | Calls in-process idempotency helper for replay/hash mismatch/expiry; the test labelled concurrent actually awaits two requests sequentially. No concurrent execution or durable restart/multiprocess proof. | No; Vitest/CI config |
| `tests/integration/sales-replay.test.ts` | Calls createSale/sync against Maps for duplicate handling/day/payment rules; dependency-deferral case is documented-only assertion. Not HTTP/browser/restart test. | No; Vitest/CI config |
| `tests/integration/stock-derivation.test.ts` | Calls movement/position logic for ordering, duplicate IDs, negative position; transfer confirmation assertion is documented-only. | No; Vitest/CI config |
| `tests/integration/payments-honesty.test.ts` | Feature-level digital pending/callback/reconciliation assertions; separate fields in outputs do not prove HQ UI behavior. | No; Vitest/CI config |
| `tests/integration/webhook-verifier.test.ts` | Direct verifier missing-secret/valid HMAC cases; not a live payment provider integration. | No; Vitest/CI config |
| `tests/integration/loyalty-concurrency.test.ts` | In-memory reward redemption/idempotence/audit assertions; not SQL concurrency or dashboard. | No; Vitest/CI config |
| `tests/unit/expense-review.test.ts` | Expense state-machine reason/flag checks plus literal-shape/tautological checks; no submitted expense HTTP/persistence flow. | No; Vitest/CI config |
| `tests/unit/sale-totals.test.ts` | Snapshot total/change/quantity/currency arithmetic helpers. | No; Vitest/CI config |
| `tests/unit/shift-expected-cash.test.ts` | Expected/counted cash arithmetic, digital exclusion, variance wording; tolerance case documented-only. Page does not use this helper for displayed cash. | No; Vitest/CI config |
| `tests/unit/stock-variance.test.ts` | Movement/variance helper, UNCOUNTED/UNKNOWN cases; not stock read authorization. | No; Vitest/CI config |
| `tests/unit/money.test.ts`, `payment-states.test.ts`, `pricing-resolution.test.ts`, `override-policy.test.ts`, `loyalty-redemption.test.ts` | Supporting domain/value logic; no dashboard integration or auth session proof. | No; Vitest/CI config |
| `tests/browser/tap-budget.test.tsx`, `offline-states.test.tsx` | Token/constant/locally constructed state assertions, no mounted pages or real browser journey. | No; node Vitest/CI config |

No dedicated test for the redesigned root, real ten-card rendering, route-level area/stall isolation, reports/CSV/export audit, stored HQ read-model rebuilds, real login/session revocation, or JSON restart durability was found. **Do not run these store-mutating tests against a live project data directory without isolation.**

## 12. Current Actual Data Flow

### Root home

```text
src/app/layout.tsx (metadata/styles; no guard)
    -> src/app/page.tsx (client)
        -> literals + pendingCount=0 + browser online/offline events
        -> OfflineBanner / TapTarget / static links
        -> navigation only; no operational backend read/write
```

### Existing HQ (separate, not migrated)

```text
src/app/hq/page.tsx (public client)
    -> fetch sales, hq/sales, stock, OPEN shifts, hq/cash-position
       (+ optional all-shifts fallback)
    -> /api/v1 route handlers
        -> fake session + inconsistent role/object-scope checks
        -> direct memoryStore scans (not features/hq read models)
    <- JSON data + generated request-time metadata
    -> browser totals/counts + hardcoded values + swallowed-error fallbacks
    -> ten cards (only five with data state / freshness badges)
    -> generic links to static expenses/incidents/verification surfaces

memoryStore module initialization:
    data/db.json if present -> revive/load Maps -> ensureSeed()
writes elsewhere:
    sales/payments/expenses/stock/closing use cases -> Maps + audit
    -> mutation wrappers -> JSON.tmp -> rename JSON
```

`src/features/hq` offers a separate on-demand aggregation path that the current HQ page's HTTP handlers **do not use**. There is no current dashboard → stored read-model job → database pipeline, no chart/activity pipeline, and no root dashboard → forms → persistence pipeline. This is the actual architecture, not the desired one.

## 13. Gaps Blocking End-to-End Integration

1. **Checkout/UI mismatch:** the requested redesigned root is absent. Its exact KPI/row/form data requirements cannot be discovered from a different operator-home implementation. Reconcile the supplied baseline with the source before wiring that UI; do not recreate it during discovery.
2. **Canonical task ambiguities:** two different ten-card lists and a mismatched ADR reference; clarify without treating documentation as implementation.
3. **Identity and scope are unsafe:** fake default HQ identity, unprotected pages, org-target authorization for stall reads, no region/area isolation. Existing endpoints must not be advertised as safe dashboard inputs.
4. **T-HQ-002 dependency incomplete:** inline Maps scans, no persisted scoped/day read models, worker execution, source watermark/rebuild proof, or seeded-scale evidence.
5. **Data contracts/semantics incomplete:** no agreed outlet mapping, no outlet summary/list or ratio/time-series/activity contract; all-time summaries labelled today; cash field mismatch and client-fabricated counted/variance; limited lists cannot support network counts.
6. **UI honesty/integration incomplete:** half the actual HQ cards are placeholders, real available endpoints not consumed, failures replaced with zeros/current timestamps, no manual refresh or complete stale/error states.
7. **Drill-down/export missing:** numbers not linked, absent detail/closing routes, static review/incident actions, no operational CSV/scheduling/audited snapshot export.
8. **Persistence is not production transactionality:** JSON adapter has silent failure/multiprocess/atomic-unit limitations; no current file or fresh restart evidence. Supporting module Maps and evidence are not durably integrated.
9. **Acceptance evidence missing:** E2E files are synthetic; current tests/QA not executed; existing reports overclaim completeness.

**Single smallest next implementation step (not performed):** add one isolated route-level regression test for `GET /api/v1/stock/movements?stallId=<unassigned-stall>` under a self-scoped OPERATOR session, asserting that another stall's records are not returned. Use isolated test persistence, not the project data directory. This establishes a concrete failing security boundary before connecting any new dashboard read. It does not require redesigning `/`, inventing a DTO, or claiming T-HQ-003 completion.
