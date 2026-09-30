# Page 05 — Transactions ground-truth audit

**Date:** 2026-09-30
**Canonical source:** `docs/product/end-to-end-pages/05-transactions.md` (matches the archive entry byte-for-byte).
**Scope:** `/transactions`, scoped list/detail, date/outlet/status filters, and cash transaction creation. This is one vertical slice only; no later page prompt was started.

## Existing behavior before this slice

| Capability | Status | Evidence / notes |
|---|---|---|
| Route `/transactions` | `MISSING` | No page route existed. Existing `/sell` was a separate cart screen. |
| Transaction detail UI | `MISSING` | No detail route existed. |
| Sale creation service | `IMPLEMENTED` | `src/features/sales/index.ts:createSale` resolves server prices, snapshots integer minor-unit totals, records occurred/accepted times, and writes an audit event. |
| Cash-payment service | `IMPLEMENTED` | `src/features/payments/index.ts:createCashPayment` checks amount and cash received, writes payment/audit state, and completes the sale. |
| Read API | `PARTIAL` | `/api/v1/sales` directly scans the store; no date/outlet filters or detail boundary, and no consistent area scope. |
| Data store | `IMPLEMENTED` (development/pilot only) | `src/server/db/memory-store.ts` persists map mutations to `data/db.json` via atomic temp-file rename. No SQL adapter is used by the runtime page path. |
| Authentication | `PARTIAL` | `resolveSession` uses a development fake session outside production; production fails closed. Real login/session integration is not present. |
| Scope authorization | `PARTIAL` | Role permissions and scope helpers exist, but the old sale-list path did not enforce the complete list/detail resource scope. |
| Idempotency | `IMPLEMENTED` / `PARTIAL` | Shared request idempotency exists. Sale and payment also have client IDs. Existing sale lookup was not tenant-safe; the new page endpoint requires an idempotency key and checks shift/record scope. |
| Transaction analytics | `MISSING` | No product analytics abstraction/provider existed. This slice emits privacy-minimal structured events through the existing Pino logger; no analytics warehouse or durable event stream is configured. |
| Browser evidence | `UNKNOWN` | Existing Playwright setup is configured but browser binaries/environment availability have to be established in this session. |

## Current page contract

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Transaction ID/status/total | Sale | `sales` map | `GET /api/v1/transactions` | Org plus self/stall/area filter | `IMPLEMENTED` |
| Business date/time | Sale (`businessDay`, `occurredAt`, `serverAcceptedAt`) | `sales` map | List/detail API | Same as sale | `IMPLEMENTED` |
| Outlet | Shift + stall | `shifts`, `stalls` maps | List/detail API | Only outlets represented by authorized shifts | `IMPLEMENTED` |
| Line/menu/quantity/price snapshot | Sale items + menu name | `saleItems`, `menuItems` maps | `GET /api/v1/transactions/[transactionId]` | Same as sale | `IMPLEMENTED` |
| Payment method/status/amount | Payment | `payments` map | Detail API | Same organization and transaction | `IMPLEMENTED` |
| Date/outlet/status filter | Sale fields | Store read model | `GET /api/v1/transactions` query | Applied server-side after scope | `IMPLEMENTED` |
| Create cash transaction | Sale + cash-payment use cases | Sales, line, payment, stock-movement, audit maps | `POST /api/v1/transactions` | Authenticated role + selected server-owned shift scope | `IMPLEMENTED` |
| QRIS/digital create | Payment-provider boundary | Payments/callback maps | None exposed by this page | N/A | `UNSUPPORTED` (intentionally omitted; no provider success is fabricated) |
| Correction/void | Existing domain methods are incomplete for payment/refund integrity | Existing sale map | None exposed by this page | N/A | `UNSUPPORTED` (not exposed) |

## Financial, privacy, and operational checks

- Money is represented in integer IDR minor units. The server resolves catalog prices; browser totals are informational and never authoritative for the stored sale.
- Cash received must be an integer amount and at least the server-calculated total. Change is computed by the existing money/domain function.
- The page requires `Idempotency-Key`. The current domain creates the sale before creating its cash payment; if the payment fails, an unpaid `DRAFT` sale remains and can be inspected/retried. This two-step underlying lifecycle is not a database transaction.
- Device time is optional and cannot set the business day. The shift supplies the business day; accepted time is server time.
- Analytics payloads contain event name, page, request ID, and coarse status/filter category only; no note, customer data, line content, provider reference, or raw personal data.
- Offline digital payments are not enabled. This page currently submits online-only cash transactions; offline cash recording remains governed by the existing outbox path, not this page form.

## Out-of-scope conflicts / precedence

The project README and generic task backlog describe “Phase 0 / no working product” and say implementation is not started. The worktree-level `AGENTS.md` explicitly makes the checked-in page archive authoritative and supersedes those generic phase/status statements as needed. This work follows that higher-priority instruction while preserving production-auth and payment safety boundaries. No accepted ADR was changed.
