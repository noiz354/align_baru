# Page 07 — Products & Pricing gap report

**Date:** 2026-09-30 (Asia/Jakarta)
**Route:** `/products`
**Decision:** core catalog, price-read/write, and active-state pilot behavior is implemented and automated, but end-to-end acceptance remains open pending browser verification and resolution/explicit acceptance of the remaining gaps.

## Delivered and verified

| Capability | Status | Evidence |
|---|---|---|
| Organization-scoped catalog read with filters, pagination, categories, base/effective price and bounded policy history | `IMPLEMENTED` for current adapter | `features/menu/catalog.ts`; API integration tests; local GET smoke check |
| Organization/location price resolution using shared resolver | `IMPLEMENTED` for current adapter | `tests/unit/pricing-resolution.test.ts`; integration test confirms location override |
| Create basic sellable product | `IMPLEMENTED` | Strict contract, required same-organization category, server-derived actor/org, idempotency, audit and API tests |
| Active/inactive status change | `IMPLEMENTED` with guard | Status API/service, audit and tests; deactivation blocked while a current/future price policy refers to the item |
| Price-policy publication for ORG/AREA/LOCATION | `IMPLEMENTED` for current adapter | Strict validation, ownership and authorization checks, required idempotency, collision rejection, before/after audit and API tests |
| Sale-side inactive and tenant checks | `IMPLEMENTED` | Sale service validation and integration test |
| Transaction-entry price refresh by selected shift location | `IMPLEMENTED` in `/transactions` | Client now loads items/prices using shift `startLocationId`; typecheck/build pass (no browser flow test) |
| Coarse products analytics | `IMPLEMENTED` | Allowlisted structured logger and runtime logs; documented in `docs/analytics/07-products-pricing.md` |
| Local CI-equivalent checks | `IMPLEMENTED` | 28 files / 140 tests, typecheck, lint, and Next build passed |

## Remaining gaps and truthful status

| Capability | Status | Impact / action |
|---|---|---|
| Browser UI journey, responsive rendering, keyboard/accessibility review, console/network error inspection | `UNKNOWN` | No browser runtime was available. User/browser acceptance is still required before marking the page complete. |
| Production authentication/session integration | `UNSUPPORTED` | Current auth adapter is fake in development and returns no session in production. Do not treat local role tests as production access evidence. |
| Durable production repository, transactional concurrent writes, multi-process safety | `UNSUPPORTED` | The active runtime uses an atomic JSON file-backed map. No PostgreSQL adapter/migration was added or claimed. |
| Edit product name/category or sort order | `MISSING` | Product editing is not persisted through a supported mutation path. UI intentionally offers simple product creation and status change only. |
| Package/component product setup, portion/synonym metadata | `UNSUPPORTED` | The stored runtime model cannot represent or manage these fields; do not imply support. |
| CSV import | `UNSUPPORTED` | No import contract, validation/report, or persistence path exists. |
| Category create/edit/archive | `MISSING` for administration | Existing same-organization categories are listed and selectable; the page does not manage category records. |
| Durable outlet-specific availability | `UNSUPPORTED` | The old availability helper is an in-process map. Product location selection shows effective pricing, not an availability-management promise. |
| Price approval/version/review workflow | `MISSING` | Validated role-authorized price changes publish directly. There is no approval gate, concurrency/version token, or separate approval UI. |
| Overlapping effective-window review beyond exact-time collision | `PARTIAL` | Same scope/item/effective instant is rejected; the resolver handles temporal precedence/ambiguity, but there is no human overlap-review workflow. |
| Legacy `/sell` price display aligned to location overrides | `PARTIAL` / known cross-page risk | `/sell` still has a hard-coded fallback and lacks location selection; only `/transactions` now requests shift-location prices. Do not use `/sell` as proof of location price display. |
| Restart durability of this page’s mutations in a runtime journey | `UNKNOWN` | JSON adapter mechanics are present, but a separate mutation/restart probe was not performed for this page. Integration tests verify in-process persistence only. |
| Browser proof of idempotency/audit feedback messages | `UNKNOWN` | Route-level integration tests verify stored state and replay; UI browser behavior is not inspected. |

## Acceptance guidance

Before calling the page end-to-end accepted:

1. In a browser, load `/products` as an authorized manager and inspect the empty/data/loading/error states and console.
2. Create a simple product in a valid category; reload and confirm it remains present.
3. Publish a location-effective price, select that location, and confirm the displayed effective price/provenance. Verify `/transactions` uses the chosen open shift’s location before charging.
4. Verify status controls, idempotent confirmation behavior, and the documented deactivation guard.
5. Record browser/network/console evidence and have the user accept the remaining adapter/auth limitations.

Do not represent unsupported category CRUD, product editing, CSV import, packages, availability management, price approvals, or production authentication as completed. Do not mark page 06 browser acceptance complete based on page 07 work.
