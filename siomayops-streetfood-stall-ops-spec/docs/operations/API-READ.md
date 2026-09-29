# Read API Catalogue

**Document ID:** DOC-OPS-API-READ
**Status:** Phase 0 specification (no handler exists; every read endpoint returns
`501 NOT_IMPLEMENTED` in this phase — no data is served)
**Related:** `API.md` §0 (global rules) and §17, `ARCHITECTURE.md` §8, `HQ.md`,
`docs/product/HQ-DASHBOARD.md`, `docs/security/PERMISSIONS.md`, ADR-0030 (read models), ADR-0034

Write contracts live in `API.md` §1–§16. This document covers the read side, which follows the same
envelope rules: session cookie auth, `authorize(actor, action, scope)`, the single error envelope,
cursor pagination, and audit on export.

---

## 1. Common rules

| Rule | Detail |
| --- | --- |
| Path | `/api/v1/...`, versioned and additive-only within `v1` (ADR-0034) |
| Auth | Session cookie; every read resolves `SessionContext` and scope **before** querying |
| Scope | `org` · `region` · `area` · `stall` · `self` — enforced server-side, never by client filtering |
| Pagination | `?limit=` (default 25, max 200) + `?cursor=`; responses carry `nextCursor`; no offset paging on mutable money data |
| Freshness | Aggregate responses include `computedAt`, `freshnessBand`, and `sourceWatermark` where applicable |
| Money | `{ "amountMinor": 32000, "currency": "IDR" }`; verified and unverified digital amounts are separate fields, never merged |
| Time | ISO-8601 UTC with `Z`; `businessDay` is server-derived (ADR-0033) |
| Errors | The canonical envelope and code set from `API.md` §0 (`STALE_DATA`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, …) |
| Caching | Read responses are `no-store` for operational data; read models are stored server-side, not in the client |
| Rate limits | Per identity; stricter for exports and audit queries (documented per route) |
| Audit | Reads are not individually audited except: audit queries, exports, evidence access, and any read of another person's records by a privileged role |
| Freshness bands | `current` < 5 min · `recent` 5–60 min · `stale` > 60 min; a stale response is labelled, not hidden (OFFLINE.md) |

## 2. Shift and operator reads

| Endpoint | Purpose | Scope | Key fields | Requirements | Task |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/shifts` | List shifts (filter by business day, area, stall, status) | role scope | shiftId, status, operator, stall, businessDay, startedAt, expectedCash | FR-SHIFT-016, FR-HQ-001 | T-HQ-001 |
| `GET /api/v1/shifts/{shiftId}` | One shift with location history and current accountability | self / area / org | status, opening cash, expected cash, location reports, open items | FR-SHIFT-016, FR-LOCATION-007 | T-SHIFT-001 |
| `GET /api/v1/operators/{operatorId}/shifts` | An operator's own history | self (own) or supervisor within area | list of shifts with variance summary | FR-OPERATOR-010 | T-OP-001 |
| `GET /api/v1/shifts/{shiftId}/audit` | Reconstruction of a shift | role scope | ordered audit entries with actor, action, reason | FR-AUDIT-008 | T-FOUND-003 |

## 3. Sales, payments and money reads

| Endpoint | Purpose | Scope | Key fields | Requirements | Task |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/sales` | List sales (business day, stall, operator, method, verification status) | role scope | saleId, total, lines summary, paymentState | FR-HQ-002 | T-HQ-002 |
| `GET /api/v1/sales/{saleId}` | One sale with price snapshots and payment | scope | lines with `unitPriceSnapshot`, total, payment, voids/corrections referencing it | FR-SALE-001/006, FR-PRICE-004 | T-SALE-001 |
| `GET /api/v1/payments` | Payment list by state (especially `PENDING_VERIFICATION`) | Finance/Ops within org | paymentId, method, amount, state, age, shift, provider reference (masked by role) | FR-HQ-004, FR-PAYMENT-010 | T-PAY-004 |
| `GET /api/v1/payments/{paymentId}` | One payment with attempts, evidence and reconciliation history | Finance/Official scope | attempts, verified evidence pointers, reconciliation records | FR-PAYMENT-005/011 | T-PAY-004 |
| `GET /api/v1/closings` | Closing list by business day/area with completeness | role scope | closingId, shift, counted/expected, variance, review state | FR-SETTLE-001/003, FR-CLOSE-* | T-CLOSE-001 |
| `GET /api/v1/exports/closings.csv` | Closing export for finance review | Finance + Owner, audited | one row per closing with verification split | FR-SETTLE-009, FR-HQ-010 | T-HQ-003 |

## 4. Expenses, stock and incidents

| Endpoint | Purpose | Scope | Key fields | Requirements | Task |
| --- | --- | --- | --- | --- | --- |
| `GET /api/v1/expenses` | Review queue and history (category, state, age) | Finance/supervisor scope | expenseId, category, amount, paidFrom, reviewState, flags (rule ids only) | FR-EXPENSE-005/006 | T-EXP-002 |
| `GET /api/v1/expenses/{expenseId}` | One expense with audit trail and evidence pointer | reviewer/self | record + review history (no recipient fields exist to show) | FR-EXPENSE-005 | T-EXP-002 |
| `GET /api/v1/stock/movements` | Movement log for a stall or shift | role scope | kind, quantity, reason, actor, occurredAt | FR-STOCK-002 | T-STOCK-001 |
| `GET /api/v1/stock/positions` | Derived positions for a stall | role scope | stockItemId, quantity, derivedAt, uncounted flags | FR-STOCK-003/012 | T-STOCK-002 |
| `GET /api/v1/incidents` | Incident board by severity/age/SLA | role scope | incidentId, category, severity, status, owner, age | FR-INC-007 | T-INC-002 |
| `GET /api/v1/incidents/{incidentId}` | One incident with lifecycle and linked records | role scope | transitions with actor and reason, linked shift/sale/payment | FR-INC-005/010 | T-INC-002 |

## 5. HQ read models (card endpoints)

| Endpoint | Card | Payload | Freshness target | Task |
| --- | --- | --- | --- | --- |
| `GET /api/v1/hq/coverage` | 1 | active shifts, shifts without a location report, idle stalls | ≤60 s | T-HQ-001 |
| `GET /api/v1/hq/sales` | 2 | gross by method, verified vs unverified digital split | ≤60 s | T-HQ-002 |
| `GET /api/v1/hq/cash-position` | 3 | expected, counted, variance, unresolved count | ≤5 min | T-HQ-002 |
| `GET /api/v1/hq/verification-backlog` | 4 | pending count, unverified amount, oldest age | ≤60 s | T-HQ-002 |
| `GET /api/v1/hq/stock` | 5 | issues, consumption, waste, variance by reason | ≤10 min | T-HQ-002 |
| `GET /api/v1/hq/incidents` | 6 | open by severity and SLA status | event-driven | T-ALERT-001 |
| `GET /api/v1/hq/expense-review` | 7 | queue size, flagged record counts, median age | ≤5 min | T-EXP-003 |
| `GET /api/v1/hq/closings` | 8 | unfinished closings by area with cause categories | ≤5 min | T-HQ-002 |
| `GET /api/v1/hq/locations` | 9 | used today, dormant, restricted with reason | ≤15 min | T-LOC-002 |
| `GET /api/v1/hq/exceptions` | 10 | merged decision queue ordered by consequence | ≤2 min | T-HQ-003 |
| `GET /api/v1/hq/dashboard` | 1–10 | the same ten cards for one business day in a single response, scoped by `?date=` and `?outlet=` — the surface the dashboard page renders (`docs/integration/05-hq-dashboard-ui-integration.md`) | ≤60 s | T-HQ-003 (integration) |

Every card response includes `computedAt`, `freshnessBand`, and a `drillDown` descriptor describing
which list endpoint serves the underlying records.

## 6. Config, audit and notification reads

| Endpoint | Purpose | Scope | Requirements | Task |
| --- | --- | --- | --- | --- |
| `GET /api/v1/menu/items` | Catalog (configuration, never hard-coded) | role scope | FR-MENU-001/002 | T-MENU-001 |
| `GET /api/v1/menu/location/{sellingLocationId}` | Grid for a location with resolved prices | operator self | FR-MENU-005, FR-PRICE-010 | T-MENU-002 |
| `GET /api/v1/pricing/policies` | Policy list with effective windows and audit fields | Menu/Pricing + Finance | FR-PRICE-002/012 | T-PRICE-001 |
| `GET /api/v1/notifications` | In-app inbox (severity, subject ref, read/acted state) | self | FR-NOTIF-001 | T-ALERT-001 |
| `GET /api/v1/audit` | Audit search by actor/action/subject/period | Owner, Finance, Auditor (read-only) | FR-AUDIT-004/008 | T-FOUND-003 |
| `GET /api/v1/sync/health` | Per-device sync status for support | Ops + Platform (scoped) | NFR-OBS-007 | T-OFF-001 |
| `GET /api/v1/config/thresholds` | Active thresholds (tolerance, SLAs, flags) | HQ roles | FR-HQ-012 | T-HQ-002 |

## 7. Read-side constraints that are not negotiable

1. **No unscoped read exists.** A read without a resolved scope is a defect (INV-14).
2. **No merged money truth.** Verified and unverified digital amounts are always separate fields.
3. **No hidden freshness.** An aggregate without `computedAt` must not ship.
4. **No evidence without a signed URL.** Evidence access uses short-lived pre-signed URLs and is
   audited; raw storage paths are never exposed.
5. **No personal-data over-fetch.** Phone numbers, customer identifiers and coordinates are masked or
   omitted according to `docs/security/PERMISSIONS.md` §4.
6. **No read that implies judgement.** Variance, expense and recognition reads carry neutral labels;
   no endpoint returns a "suspicion score" of any kind (there is no such thing in this product).
7. **No read model is trusted for money decisions.** Cards are for humans; money decisions are made
   against the underlying records on write paths.
