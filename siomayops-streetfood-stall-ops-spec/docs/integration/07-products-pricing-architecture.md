# Page 07 — Products & Pricing architecture

**Date:** 2026-09-30 (Asia/Jakarta)
**Route:** `/products`
**Status:** Implemented against the existing file-backed pilot adapter; production auth and persistence are not provided by this repository.

## Slice and boundaries

```text
Products & Pricing client page
  → authenticated Next.js route handlers
  → menu catalog/read model and menu/pricing use cases
  → shared in-process memoryStore maps
  → atomic JSON persistence at data/db.json
  → append-only audit events + coarse structured product logs
```

The runtime uses `memoryStore`, not the declared PostgreSQL schema. No new table or migration was needed. `ensureSeed()` now skips demo seeding under `NODE_ENV=production`; this does not remove demo rows already in an existing data file. In development the session provider is fake and environment-selected; in production it returns no session, so the implemented routes fail closed rather than authenticating real users.

## Data contract and field/action map

| UI field/action | Domain source | Persistence source | Server entrypoint | Scope/status |
|---|---|---|---|---|
| Product name, category, active state | `listCatalogProducts` | `menuItems`, `menuCategories` | `GET /api/v1/menu/items` | Session organization; implemented |
| Search, category/status filters, bounded pagination | Catalog read model | Same maps | `GET /api/v1/menu/items?search=&categoryId=&status=&limit=&offset=` | Organization-scoped; implemented |
| Base and selected-location effective price | `resolvePrice` via catalog model | `pricePolicies`, locations/stalls | Items GET and `GET /api/v1/menu/prices?sellingLocationId=` | Effective-time and scope-aware; implemented |
| Policy history and current/future/expired labels | Catalog model | `pricePolicies` | Items GET | Up to newest 12 policies shown per product; implemented |
| Create simple sellable product | `upsertMenuItem` | `menuItems`; audit in `auditEvents` | `POST /api/v1/menu/items` | Session org/actor; same-org existing category required; implemented |
| Change active state | `setMenuItemStatus` | `menuItems`; audit in `auditEvents` | `PATCH /api/v1/menu/items/{id}/status` | Session org/actor; active/future policy reference blocks deactivation; implemented |
| Publish ORG/AREA/LOCATION price | `publishPricePolicy` | `pricePolicies`; audit in `auditEvents` | `POST /api/v1/menu/prices` | Session org/actor and authorized target; append-only; implemented |
| Package/components, product edit, category CRUD, CSV, availability, approvals | No persisted end-to-end capability | Not supported by current runtime model | None | Omitted/unsupported; see gap report |

The page does not accept organization or actor identity from its request body. Both are derived from the resolved session. Product and policy requests use strict Zod contracts; all mutating routes require an `Idempotency-Key` and pass through the existing idempotency helper. Product creation and price publishing return `201`; status changes return `200`. Reusing a key with the same payload replays the result; a same-scope, same-effective-time price collision with a different key returns `409`.

## Authorization and tenant isolation

- All reads require a session and `menu:view`; invalid/missing development auth returns `401`, and a role without catalog view permission returns `403`.
- Product creation and lifecycle changes require `menu:manage`; policy writes require `price:manage` for the validated target scope.
- Organization, actor, and scope are server-derived. Catalog reads filter the organization before exposing products, categories, locations, or policies. Direct status mutation of a foreign-organization product returns `404`.
- Scope IDs are checked against the session organization's organization, area, or selling-location records before price publication. A foreign or unknown target is not written.
- Sales creation independently rejects inactive and foreign-organization menu items; the catalog UI is not the authorization boundary.

These protections are covered using the local fake session in integration tests. They are not evidence of production login/session security because no production authentication adapter exists.

## Price resolution and audit semantics

The existing shared resolver remains authoritative. For the requested selling location it considers LOCATION, then AREA, then ORG policy precedence and policy effective-time windows. It returns an explicit resolved, not-sellable, or ambiguous state rather than silently selecting an ambiguous policy. No floating-point arithmetic was introduced; prices are positive safe integer IDR values.

Publishing validates positive integer IDR, valid effective dates, reason length, owned menu item, owned scope, and exact effective-time collisions within the same item/scope. It appends a policy rather than editing or deleting prior policy rows. The audit record includes the prior same-scope overlapping amount/policy ID where found and the new scope, amount, effective interval, actor, and reason. Exact-time collisions are rejected; there is no approval/version workflow or broader approval gate.

Product status changes write before/after active-state summaries and require a reason. A product cannot be deactivated while a current or future policy (one without an elapsed `effectiveTo`) refers to it. A sale independently checks product active state. Historical sale snapshots are not rewritten by catalog or price changes.

The transaction-entry page now requests menu and resolved price data for the selected open shift's `startLocationId`; changing shift reloads the location-specific prices and clears quantities. This keeps that supported transaction-entry path aligned with location price overrides. The older `/sell` page remains a known legacy gap: it still has a hard-coded display fallback and does not select a selling location; it is not represented as a verified pricing consumer.

## Persistence characteristics and limits

- Authoritative runtime state: `memoryStore` maps loaded from/written to `data/db.json`.
- Primary identifiers: generated IDs on stored menu items and price policies; existing stored category/location IDs are referenced by domain relationships.
- Relationships: menu item → same-organization category; policy → same-organization menu item and ORG/AREA/LOCATION scope; audit event → action subject; shift → start selling location.
- Reads use a deterministic in-memory read model and return bounded product pages and bounded per-product price history. The current map implementation scans policies in memory per product; it is not a SQL query and has no SQL index behavior to claim.
- JSON persistence is suitable only for this pilot process model. This work does not prove multi-process write safety, database transaction isolation, backups, or production durability.

## Key implementation files

- `src/app/products/page.tsx`
- `src/app/api/v1/menu/items/route.ts`
- `src/app/api/v1/menu/items/[menuItemId]/status/route.ts`
- `src/app/api/v1/menu/prices/route.ts`
- `src/features/menu/catalog.ts`
- `src/features/menu/index.ts`
- `src/features/menu/analytics.ts`
- `src/features/pricing/index.ts`
- `src/shared/contracts/pricing.ts`
- `src/features/sales/index.ts`
- `src/app/transactions/page.tsx`
- `src/server/db/memory-store.ts`
- `tests/integration/products-pricing-api.test.ts`
- `tests/unit/pricing-resolution.test.ts`
