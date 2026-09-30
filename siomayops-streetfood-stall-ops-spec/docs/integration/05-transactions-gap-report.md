# Page 05 — Transactions gap report

**Status: NOT DONE until the outstanding evidence below is captured.**

## Implemented in this slice

- `/transactions` list with loading, empty, error, filter and success states.
- Server-side date, outlet and status filtering with bounded, deterministic pagination.
- `/transactions/[transactionId]` detail route and direct-resource scope protection.
- Cash transaction form using persisted open shifts, active menu, and effective prices; server recomputes price and total.
- Reuses existing sale, payment, audit, and stock-completion use cases.
- Scoped read model, route validation, required idempotency key for writes, safe structured analytics events, and integration tests.

## Genuine remaining gaps / constraints

1. **Browser proof:** The real Playwright user journey and browser-console inspection remain outstanding because the browser binary could not be downloaded (`ECONNRESET`). The HTTP runtime list/create/detail, invalid input, role-denied write, persistence inspection, and same-file server-restart proof have been completed and documented.
2. **Remote CI:** The repository's existing CI may not be triggerable from this environment. Run the local-equivalent project checks and distinguish from remote CI.
3. **Real authentication:** The app still uses the guarded fake development session outside production. Production requests fail closed; no live login path is provided here.
4. **Analytics provider:** Events are emitted as structured log records; no durable product analytics provider/warehouse exists. The events can be verified in local tests/logs only.
5. **Database transaction boundary:** Existing sales/payment features use file-backed map persistence, not a transactional SQL unit of work. Sale creation can persist as `DRAFT` before a later payment failure. No schema migration was introduced.
6. **Digital payments:** Not offered in this transaction form. Static/dynamic QRIS provider readiness remains external and must never be represented as paid by this page.
7. **Correction/void:** No correction/void action is exposed because payment reversal/refund and history-integrity flows are not complete for this page.
8. **Outlet choice at create:** The form uses an already-open shift and displays its authorized outlet; location assignment remains governed by the shift/location workflows.
9. **Pagination UI:** API supports bounded offset/limit; current page shows the first 50 matching rows and does not yet provide next-page controls.

## Acceptance status

| Acceptance area | Status |
|---|---|
| Existing behavior / page data contract | `PASS` (documented in ground-truth audit) |
| Scoped API reads and direct detail | `PASS` (integration tests + runtime finance-role denial) |
| Persisted cash create/read loop | `PASS` via HTTP runtime proof, direct file inspection, reload/list/detail, and server restart |
| No fake operational list values | `PASS` for this page |
| Analytics | `PARTIAL` (expected structured log events observed; no analytics backend) |
| Unit/integration tests | `PASS` — 24 files, 122 tests |
| Typecheck/lint/build/CI equivalent | `PASS` locally; remote GitHub CI not triggered |
| Runtime/browser evidence | `PARTIAL` — API runtime proven, Playwright/browser-console blocked by unavailable Chromium |
| Overall | **NOT DONE** |
