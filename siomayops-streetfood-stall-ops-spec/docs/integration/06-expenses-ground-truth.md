# Page 06 — Expenses ground-truth audit

**Date:** 2026-09-30
**Canonical source:** `docs/product/end-to-end-pages/06-expenses.md` (verified identical to the archived prompt).
**Scope:** `/expenses` scoped list/detail/create and cash-expense reflection. No later page prompt is included.

## Existing behavior before this slice

| Capability | Status | Evidence / notes |
|---|---|---|
| `/expenses` route | `PARTIAL` | `src/app/expenses/page.tsx` is a category/amount/note form, but submits hardcoded shift/category IDs and does not load shifts, saved expenses, or details. Its payload does not match the server route contract. |
| Expense submission API | `PARTIAL` | `POST /api/v1/expenses` validates a different shape than the page, calls the existing feature, but does not authorize `expense:submit`, verify shift tenant/assignment, require `Idempotency-Key`, or scope the client actor. |
| Expense service/persistence | `PARTIAL` | `submitExpense` writes `memoryStore.expenses`, client-ID index, and audit events, and applies neutral category/routing checks; shift ownership/tenant and open-state checks are missing, duplicate lookup is globally keyed, and return DTO is only an ID. |
| Read/list API | `PARTIAL` | `GET /api/v1/expenses` lists the entire organization for any authenticated session, uses review-role-oriented naming without authorization/scope enforcement, and has no stable filters/count/detail/pagination validation. |
| Expense detail | `MISSING` | No `/api/v1/expenses/[expenseId]` or `/expenses/[expenseId]` exists. |
| Review state service | `PARTIAL` | `reviewExpense` and domain transitions exist; no write API/page integration, and service does not enforce organization/reviewer separation. |
| HQ review surface | `PARTIAL` | `/hq/expenses` contains a hardcoded sample row and inert button; `/api/v1/hq/expense-review` returns only aggregate counts. This prompt targets `/expenses`; the static HQ page is not redesigned here. |
| Persistence | `IMPLEMENTED` (development/pilot only) | Wrapped `memoryStore.expenses` map persists to atomic JSON file; process-specific temp persistence is used in tests. This is not PostgreSQL. |
| Audit | `PARTIAL` | Submission and automatic flag events are written by the feature; actor and reason scope require hardening for review. |
| Analytics | `MISSING` | No expense-specific product analytics abstraction/events existed. Existing Pino logger is available. |
| Evidence | `UNSUPPORTED` | Expense fields can hold an evidence key, but no verified upload/attach/download route or durable evidence adapter is wired for this page. The page must not imply a real upload. |
| Authorization | `PARTIAL` | Shared role permissions and `authorize` exist, but current expense endpoints do not apply the complete scope to list, detail, or create. |

## Current page data contract

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope | Status |
|---|---|---|---|---|---|
| Expense ID/status | Stored expense/review state | `expenses` map | List/detail APIs | Org and persisted shift scope | `IMPLEMENTED` after slice |
| Business day/date | Related shift business day + expense `incurredAt` | `expenses`, `shifts` maps | List/detail APIs | Same as expense | `IMPLEMENTED` after slice |
| Outlet | Shift/stall lookup | `shifts`, `stalls` maps | List/detail APIs | Only accessible shifts | `IMPLEMENTED` after slice |
| Category/amount/source | Expense record, integer IDR minor units | `expenses` map | List/detail APIs | Same as expense | `IMPLEMENTED` after slice |
| Description/operator note | Operator-entered, optional | `expenses` map | List/detail APIs | Same as expense | `IMPLEMENTED` after slice; display is optional/blank-safe |
| Evidence | No proven upload lifecycle | `evidenceAssets` map is only a shell | None | N/A | `UNSUPPORTED`, omitted |
| Date/outlet/category/status filter | Persisted expense/related shift fields | Read model | `GET /api/v1/expenses` | Applied after server scope | `IMPLEMENTED` after slice |
| Create expense | Existing `submitExpense` use case | Expense/client-ID/audit maps | `POST /api/v1/expenses` | Session + server-derived open-shift scope | `IMPLEMENTED` after slice |
| Review action | `nextReviewState` and `reviewExpense`; persisted status, reason, reviewer and audit event | `POST /api/v1/expenses/[expenseId]/review` and detail UI | Reviewer role + persisted outlet/area scope; submitter cannot self-review | `IMPLEMENTED` for supported transitions; runtime/browser evidence remains incomplete |

## Safety, finance, and privacy observations

- The domain category set is the implemented neutral list: `UNVERIFIED_FIELD_EXPENSE`, `TRANSPORT`, `CLEANING`, `CONSUMABLE`, `REPAIR_MINOR`, `PARKING`, `OTHER_OPERATIONAL`. The wider `EXPENSES.md` category wishlist is not all configured in this runtime.
- Category and amount are the only required operator inputs; notes/descriptions and evidence must remain optional. `paidFrom` will use a visible default so the cash-impact source is not guessed invisibly.
- Money uses integer IDR minor units. Only `CASH_BOX` expenses reduce expected cash; `PERSONAL` expenses do not. Review state never rewrites the historical cash outflow.
- Client `organizationId`, `operatorId`, or reviewer identity are never trusted. Business day comes from the persisted shift, not the device.
- Client IDs are organization-safe, request writes require an idempotency key, and an audit event records the server-accepted mutation. Free text, note, amounts, and IDs are excluded from analytics payloads.

## Implementation update (2026-09-30)

The list/create and detail pages now use the scoped APIs; a review endpoint and reviewer-only review reason were added. Create and review both require an idempotency key, and API/read-model tests exercise scope, validation, persistence, and supported transitions. `/api/v1/shifts` also applies persisted stall/area/self scope before returning shift choices; region scope fails closed. `docs/integration/06-expenses-architecture.md`, `06-expenses-runtime-evidence.md`, `06-expenses-gap-report.md`, and `docs/analytics/06-expenses.md` hold the implementation map and evidence. Browser UI/E2E and console evidence remain outstanding, so this is not marked done.

## Scope decision

The repository README still contains general Phase-0 language, while worktree `AGENTS.md` makes the page archive authoritative for this worktree and supersedes those generic phase/status statements as required. The implementation remains limited to this one page slice and preserves the existing in-memory/file-backed runtime boundary; no SQL migration or evidence upload service is invented.
