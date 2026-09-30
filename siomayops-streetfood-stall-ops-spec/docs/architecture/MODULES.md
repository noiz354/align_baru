# Module Map and Dependency Rules

**Document ID:** DOC-ARCH-MODULES
**Status:** Phase 0 specification — folders and shells exist (`src/**`), behaviour does not
**Related:** `ARCHITECTURE.md` §4–§5, ADR-0035, `AGENTS.md`, `CONTRIBUTING.md` §7

---

## 1. Layers (dependency direction is one-way)

```text
src/app        → src/features → src/domain → src/shared
                  src/server  (adapters; reachable only from src/features)
src/domain     → src/shared only (no framework, no I/O, no clock, no database)
```

| Layer | May import | May never import | Why |
| --- | --- | --- | --- |
| `src/app` | `features`, `shared`, `server` (server-side only) | business rules; direct SQL; provider code | Delivery stays thin; logic stays testable |
| `src/features` | `domain`, `shared`, `server` ports | another feature's internals | One public surface per capability |
| `src/domain` | `shared` | `features`, `server`, `app`, any framework, `Date`, `fetch` | Pure rules that are cheap to test and impossible to bypass |
| `src/server` | `shared`, `domain` types | `features`, `app` | Adapters do not orchestrate use cases |
| `src/shared` | nothing internal | everything | Contracts and value types only |

Enforcement: ESLint import restrictions in `eslint.config.mjs` (activated at VS-0, T-FOUND-001) plus
the boundary checks in `tools/check-stubs.mjs` (forbidden imports, plus the ADR-0039 one-shot geolocation allowlist).

## 2. Module inventory

| Module | Responsibility | Key exports | Owner task |
| --- | --- | --- | --- |
| `src/domain/shift` | Shift status machine, expected-cash shape | `ShiftStatus`, `SHIFT_TRANSITIONS`, `prepareShiftClosing` | T-SHIFT-001, T-CLOSE-001 |
| `src/domain/location` | Report validation, move rules | `LocationReport`, `validateLocationReport` | T-LOC-004/005 |
| `src/domain/sale` | Snapshot totals, change arithmetic | `SaleLineSnapshot`, `computeSaleTotalFromSnapshots` | T-SALE-001/002 |
| `src/domain/payment` | Payment states and permitted transitions | `PaymentStatus`, `PAYMENT_TRANSITIONS`, `assertPaymentTransition` | T-PAY-001 |
| `src/domain/expense` | Neutral categories, review states, flag matching | `ExpenseCategoryCode`, `nextReviewState` | T-EXP-001..003 |
| `src/domain/inventory` | Movement kinds, variance reasons, derivation | `deriveStockPosition`, `computeStockVariance` | T-STOCK-001/002 |
| `src/domain/pricing` | Deterministic resolution, override evaluation | `resolvePrice`, `evaluateOverrideRequest` | T-PRICE-002/004 |
| `src/domain/loyalty` | Reward instance rules, earn shape | `redeemReward`, `computeEarn` | T-LOY-002/003 |
| `src/domain/operators` | Operator status, assignment conflicts | `OPERATOR_TRANSITIONS`, `assertAssignmentHasNoConflict` | T-OP-002, T-STALL-002 |
| `src/features/*` (18) | Use-case orchestration, authorization calls, DTO mapping | per-folder `index.ts` | see `TASKS.md` |
| `src/server/auth` | Sessions, roles, the single `authorize()` gate | `AuthPort`, `SessionContext`, `authorize` | T-FOUND-005, T-AUTHZ-001 |
| `src/server/db` | Drizzle schema, migrations, scope-mandatory repositories, idempotency | `ScopedRepository`, `beginIdempotentRequest`, `withTransaction` | T-FOUND-001/003/004 |
| `src/server/payments` | Provider port + verification (no adapters yet) | `PaymentProvider`, `verifyProviderCallback` | T-PAY-001/003 |
| `src/server/jobs` | pg-boss queue names and registry | `JobName`, `createJobQueue` | T-HQ-002 |
| `src/server/notifications` | Channel port (in-app only) | `NotificationChannel` | T-ALERT-001 |
| `src/server/storage` | Presigned evidence storage | `EvidenceStore` | T-EXP-004 |
| `src/server/telemetry` | Logger, metrics, tracing | `createLogger`, `createMetrics`, `withSpan` | T-OBS-001 |
| `src/shared/contracts` | Zod schemas for every API contract | `createSaleRequestSchema`, … | T-FOUND-001 |
| `src/shared/money` | `Money` value object and integer arithmetic | `Money`, `addMoney`, `sumMoney` | T-FOUND-006 |
| `src/shared/time` | Clock port and business-day derivation | `Clock`, `toBusinessDay` | T-FOUND-006 |
| `src/shared/types` | Ids, scope, `Result` | `UuidV7`, `Scope`, `Result` | T-FOUND-001 |
| `src/shared/ui` | Component shells and design tokens | `MoneyText`, `OfflineBanner`, `tokens` | T-FOUND-002 |

## 3. Cross-module rules

1. **A feature may not reach into another feature.** Cross-feature needs are expressed as a port used
   through the orchestrating use case, or through a read model built by a job.
2. **Domain modules know nothing about persistence, HTTP, auth or time.** Time is passed in; ids are
   passed in; nothing is fetched.
3. **Server adapters are constructed at the edge** (`app`/worker entrypoint) and injected into use
   cases; a use case never imports a concrete adapter.
4. **Read models are the only sanctioned cross-domain joins** for reporting (ARCHITECTURE.md §8).
5. **Nothing in `src/` may import a PLANNED or REJECTED dependency** from `docs/research/STACK-2026.md`
   during Phase 0 (checked by `tools/check-stubs.mjs`).
6. **No module may contain a hard-coded menu item, stock category, expense category or reason list**
   (ADR-0025); these arrive from configuration.

## 4. Where future work belongs (decision helper)

| If the change… | It goes in |
| --- | --- |
| Encodes a rule that must always hold (money, states, variance reasons) | `src/domain/*` + a test |
| Orchestrates a user action across aggregates | `src/features/<capability>` |
| Talks to the outside world (db, provider, storage, mail, push) | `src/server/*` |
| Shapes an API request/response | `src/shared/contracts` + the route shell |
| Renders or collects operator input | `src/app/*` + `src/shared/ui` |
| Reports across domains | a read model built by a job (`src/server/jobs` + `src/features/hq`) |

## 5. Module-level Definition of Done

A module is "done" when: its public surface is documented in its `index.ts` header, its invariants have
tests (unit for domain, integration for adapters), its authorization calls are covered by the
permission matrix, its stubs are gone, and `tools/check-stubs.mjs` still passes.
