# Page 05 — Transactions architecture

## Request/data flow

```text
/transactions (client page)
  ├─ GET /api/v1/transactions?businessDay&stallId&status
  │    └─ sale:view authorization → scoped transaction read model
  │         └─ file-backed memoryStore (data/db.json)
  ├─ GET /api/v1/transactions/[transactionId]
  │    └─ sale:view authorization → scoped detail read model
  │         └─ sales + shifts/stalls + saleItems/menuItems + payments maps
  └─ POST /api/v1/transactions (required Idempotency-Key)
       └─ session + selected shift scope + sale:create + payment:cash authorization
            ├─ createSale (server price resolution, integer snapshots, audit)
            ├─ createCashPayment (amount check, cash/change, payment, audit)
            ├─ completeSale (stock movements once)
            └─ refreshed GET read model
```

## Read/write boundaries

- `src/features/sales/transactions.ts` is the transaction page read model. It scopes before filters, bounds pagination to 100, sorts deterministically by acceptance timestamp and ID, and joins only persisted sale/shift/stall/menu/payment records.
- `src/app/api/v1/transactions/route.ts` validates query/body boundaries and obtains the session on the server. Client-supplied org/actor/outlet privilege fields are not accepted.
- `src/app/api/v1/transactions/[transactionId]/route.ts` returns `404` for absent or out-of-scope resources, avoiding disclosure from direct URL access.
- `POST` resolves the selected shift from server persistence, checks the actor's role and self/area scope, and calls existing sale/payment use cases. Price, sale total, completion, and stock effects are calculated by those use cases, not React state.
- `/transactions/[transactionId]` reads only through the detail API; no browser code scans local persistence.

## Persistence

```text
AUTHORITATIVE STORE: file-backed memoryStore for this current runtime
READ PATH: maps loaded from data/db.json, scoped transaction read model
WRITE PATH: existing sales/payment features mutate wrapped maps; each map set persists atomically
PRIMARY KEYS: sale.id; saleItem.id; payment.id
RELATIONSHIPS: sale.shiftId → shift; sale.stallId/operatorId snapshots; saleItem.saleId → sale; payment.saleId → sale
INDEX/LOOKUP NEEDS: in-memory iteration (bounded response); no SQL index/query planner applies
RESTART DURABILITY: implemented in the file-backed runtime; to be proven by a server restart
SCHEMA/MIGRATION: none added
```

This is not PostgreSQL persistence or a production-ready database adapter. A payment failure after sale creation may leave a persisted unpaid draft because the current store/use cases do not provide a cross-feature database transaction. The UI reports the failure instead of claiming success.

## Authorization model

- List: `sale:view` role permission, organization match, then server-side self/operator, stall, or area filtering from the persisted shift/stall relationships.
- Detail: organization check, `sale:view`, then the same scope predicate; out-of-scope resource is indistinguishable from missing (`404`).
- Create: `sale:create` and `payment:cash` are both required against the shift-derived scope. Self scope must match the persisted shift operator; area scope must match the persisted stall area. Organization, actor, stall, and operator cannot be overridden in request JSON.
- Existing fake development auth is not suitable for production; the production session boundary fails closed until real authentication is implemented.

## Analytics/observability

`trackTransactionEvent` sends coarse, structured event records through the existing Pino logger. Event types and prohibited fields are defined in `docs/analytics/05-transactions.md`. This is diagnostic event logging, not a configured product analytics pipeline; no competing SDK was introduced.
