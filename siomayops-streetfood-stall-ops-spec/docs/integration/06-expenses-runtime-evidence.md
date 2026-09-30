# Page 06 — Expenses runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Runtime:** local Next.js development server using the repository's seeded file-backed pilot store and fake `OPERATOR` session.
**Status:** API/runtime checks were executed; browser automation and browser-console inspection were not possible in this environment.

## Commands and results

### Development server and page render

Command:

```sh
FAKE_AUTH_ROLE=OPERATOR \
FAKE_ORG_ID=00000000-0000-7000-0000-000000000001 \
FAKE_OPERATOR_ID=00000000-0000-7000-0000-000000000010 \
npm run dev -- --hostname 0.0.0.0
```

Result: Next 15.4.2 became ready at port 3001 (port 3000 was already occupied by an unrelated process). `GET /expenses` returned HTTP 200 and HTML; no browser rendering/interaction was asserted by that request.

### Real persisted read and shift options

```sh
curl -i http://127.0.0.1:3001/api/v1/expenses
curl -i 'http://127.0.0.1:3001/api/v1/shifts?status=OPEN&limit=100'
```

Results: both returned HTTP 200. The expense list was genuinely empty (`total: 0`, `data: []`); the outlet and open shift were from the repository's seeded `ST-001` / active shift. The API reported `canSubmit: true` for the operator session. No expense row was fabricated to fill the empty state.

### Create, read-after-write, invalid input, and detail

A synthetic runtime-only test record was created through `POST /api/v1/expenses` with an open seeded shift, `TRANSPORT`, integer `25000` IDR, `CASH_BOX`, and an idempotency key. Response was HTTP 201 with `SUBMITTED` and `REDUCES_EXPECTED_CASH`; a subsequent list returned the same stored row. `GET /api/v1/expenses/{id}` returned HTTP 200.

An amount of zero was then submitted with a separate idempotency key. The API returned HTTP 400 `VALIDATION_ERROR`; no record was created for that request.

The dev server was stopped and restarted. A new list request still returned the synthetic runtime record (`total: 1`, amount `25000`, status `SUBMITTED`), demonstrating that the JSON file adapter reloads records after restart. The synthetic record and its client-ID/idempotency entries were then removed from the ignored local `data/db.json`, and the server was restarted again. Final list result returned to the legitimate seeded empty state (`total: 0`).

**Important:** this exercise used curl against the authenticated development fake-session boundary, not the browser UI. The synthetic record was only a durability probe and was cleaned up; it must not be treated as real operating data.

### Authorization, scope, service, and analytics evidence

Focused and full automated test results:

```sh
npm run test -- tests/unit/expense-read-model.test.ts tests/integration/expenses-api.test.ts tests/unit/expense-review.test.ts tests/unit/expense-service.test.ts
npm run test
```

Result: all 4 focused expense test files passed (17 tests); the full suite passed (27 files, 133 tests). Covered unauthenticated list access (401), malformed filters and missing idempotency key (400), closed shift and cross-operator write denial (409/403), cross-tenant/client-ID collisions, scoped direct detail hiding, idempotent create and changed-payload collision, persisted audit/status/cash-impact fields, review write/state persistence, reviewer role auditing, self-review denial, review-reason non-disclosure to operators, area/self scope, region fail-closed behavior, and deterministic bounded list behavior.

The dev server structured logs emitted `expenses_viewed`, `expense_created`, `expense_detail_viewed`, and `expense_create_failed` events. Event properties observed were limited to the stable page, request ID, filter/status keys; the logger output did not include the expense description, amount, or evidence.

## Not proven

- No Chromium executable was available (`chromium`, `chromium-browser`, and `google-chrome` were not installed; Playwright browser cache was empty). Therefore the visible UI create/review flow, mobile layout, browser console, and accessibility interaction were not exercised.
- The restart probe proves this local JSON adapter only. It does not prove PostgreSQL, multi-process safety, or production durability.
- Production authentication is not available in this repository; checks used a local fake session.
- A real supported evidence upload/view workflow does not exist and was not tested.

Runtime acceptance remains incomplete until the user/browser environment verifies the end-to-end UI journey and console.
