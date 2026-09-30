# Page 06 — Expenses architecture

**Updated:** 2026-09-30
**Route:** `/expenses` and `/expenses/[expenseId]`
**Status:** implementation is present; runtime/browser acceptance remains incomplete (see runtime evidence and gap report).

## Runtime boundaries and persistence

| Concern | Implemented source |
|---|---|
| Authoritative runtime store | `memoryStore` in `src/server/db/memory-store.ts`; the current adapter serializes maps to `data/db.json` with atomic temp-file rename. It is a development/pilot file-backed adapter, not PostgreSQL. |
| Expense primary key | Generated server-side expense ID, stored as `StoredExpense.id`. |
| Idempotency/client key | `clientExpenseId` lookup map and the shared organization + route + key idempotency store. Cross-organization collisions and same-organization reuse with changed expense fields are rejected. |
| Relationships | Expense → persisted shift → persisted stall; organization IDs are checked at each boundary. Business day/outlet are derived from these relationships. |
| Read path | `features/expenses/read-model.ts`; deterministic sort, bounded pagination, filter-after-scope, outlet choices derived from accessible shifts. |
| Write path | `features/expenses/index.ts` (`submitExpense`, `reviewExpense`); the service validates amount/category/shift state, derives operator from the stored shift, persists the record, and writes audit events. |
| Restart durability | The file adapter reloads the JSON store on process start. This was exercised in a local development runtime; see `06-expenses-runtime-evidence.md`. |

No database schema migration was required. New optional `reviewReason` and the existing expense map are covered by the existing JSON serialization; older records remain readable because the property is optional.

## Request flow

```text
/expenses list + create client
  → GET /api/v1/expenses (scoped read model, list capability)
  → GET /api/v1/shifts (server-scope-filtered open shift choices)
  → POST /api/v1/expenses (strict contract, session + shift scope, idempotency)
  → submitExpense (domain/service validation, stored-shift actor/location, audit)
  → memoryStore expense + client-ID index + JSON file
  → GET /api/v1/expenses refresh

/expenses/[expenseId]
  → GET /api/v1/expenses/[expenseId] (scoped detail, reviewer capability)
  → optional POST /api/v1/expenses/[expenseId]/review
  → reviewExpense (allowed state transition, submitter separation, audit reason)
  → refreshed detail read
```

## Scope and authorization

- API sessions come from the existing auth port. This repository's session adapter is a development fake and fails closed in production; it is not a production identity integration.
- List/detail/create/review all authorize the corresponding `expense:*` action server-side.
- Read-model scope is the intersection of session organization and the expense's persisted shift/stall. `self` must match both expense operator and shift operator; `stall` and `area` use persisted relationships; `region` returns no records because this store has no region membership.
- A selected shift is checked again server-side before create. `/api/v1/shifts` now filters list results by self/stall/area scope and denies unsupported region scope so the form does not expose unrelated shift choices.
- Review is restricted by `expense:review`, scoped to the persisted stall/area, and the submitter cannot review their own expense. The detail response includes a review reason only when review capability is granted.
- Cross-tenant and out-of-scope direct detail reads return not found, avoiding resource-existence disclosure.

## Contracts and domain rules

- Create contract: UUID shift/client IDs; category from `EXPENSE_CATEGORY_CODES`; positive integer IDR amount; `CASH_BOX` or `PERSONAL`; optional description/operator note/device timestamp; strict object; idempotency header required.
- Review contract: one supported decision (`REVIEWED`, `REJECTED`, `ESCALATED`) plus a required 3–300 character reason. Invalid domain transitions return conflict; the record is not deleted.
- `CASH_BOX` decreases expected cash; `PERSONAL` does not. Review status never reverses the recorded historical cash effect.
- Evidence is explicitly unavailable in this runtime. The UI does not offer attachment, and detail reports the capability as unsupported.
- Analytics is the existing structured Pino logger, not a second analytics SDK. It records coarse event/action/status/filter keys without expense text, amount, employee identity, or evidence.

## Field-to-source mapping

| Visible field/action | Domain/persistence source | Server boundary | Scope/status |
|---|---|---|---|
| List row/status/date/category/amount/source | Stored expense + related shift/stall | `GET /api/v1/expenses` | Scoped; implemented |
| Outlet/date/category/status filters | Read model filters | `GET /api/v1/expenses` | Applied after session scope; implemented |
| Create shift choice | Persisted shift and stall | `GET /api/v1/shifts?status=OPEN` | Server scope; implemented |
| Category/amount/source/note create | Strict expense contract and service | `POST /api/v1/expenses` | Authorized open-shift; implemented |
| Cash effect | Derived from persisted `paidFrom` | Read model/API | No client calculation; implemented |
| Detail/review reason | Expense + shift/stall; reason only reviewer-capable | `GET /api/v1/expenses/[expenseId]` | Scoped; implemented |
| Review decision/reason | Domain transition + stored audit/review metadata | `POST /api/v1/expenses/[expenseId]/review` | Authorized, no self-review; implemented |
| Evidence upload/preview | No verified adapter or lifecycle | None | Unsupported and omitted |

## Known boundaries

- Map/file persistence is single-process pilot storage, not a concurrency-safe production repository or relational database.
- Production authentication is not integrated; production protected endpoints intentionally return unauthenticated while the auth port is fake-only.
- There is no region membership mapping and no evidence upload lifecycle.
- Browser-based UI interaction/console evidence is outstanding; curl/API and local check evidence is not a substitute for the required browser journey.
