# Page 07 — Products & Pricing ground-truth audit

**Date:** 2026-09-30
**Canonical prompt:** `docs/product/end-to-end-pages/07-products-pricing.md`
**Route:** `/products`
**Audit phase:** completed before page-07 implementation; no page-07 code changes had been made at audit time.

## Existing behavior found

| Capability | Status | Evidence / notes |
|---|---|---|
| `/products` UI | `MISSING` | No `src/app/products` route exists. `/sell` is not a catalog administration page and includes a hard-coded price fallback; it is not reused as a product UI. |
| Organization menu-item read | `PARTIAL` | `GET /api/v1/menu/items` requires `menu:view` and filters `menuItems` by session organization, but has no pagination, category join, stable sorting, or page-specific DTO. |
| Current price read | `PARTIAL` | `GET /api/v1/menu/prices` requires `menu:view` but considers only `ORG` policies and selects the greatest `effectiveFrom` without checking whether a policy is effective now or expired. It omits `AREA`/`LOCATION` policy history and resolution provenance. |
| Location-aware resolver | `IMPLEMENTED` (domain/service path) | `resolvePrice` implements LOCATION > AREA > ORG, temporal boundaries, newest effective date, ambiguity, and no-price outcomes. `resolvePriceForSale` supplies organization-scoped policies; sales snapshot the resolved amount and policy ID. Six unit tests cover core resolver behavior. |
| Price policy write | `PARTIAL` | `publishPricePolicy` persists a new policy and writes `price.policy_published`, but there is no authenticated HTTP write boundary, request validation, idempotency, required scope-object validation, approval gate, before/after diff, or safe UI. It appends rather than editing history. |
| Product create/edit | `PARTIAL` | `upsertMenuItem` can create one simple stored menu item and writes an audit event, but no route uses it. It cannot edit; the `kind`/`components` values are not persisted on `StoredMenuItem`; category handling silently picks/creates a default. |
| Active/inactive product state | `PARTIAL` | `StoredMenuItem.active` is persisted and read by menu consumers, but no audited lifecycle service/route/page changes this flag. Safe retirement policy is not implemented. |
| Per-location menu availability | `PARTIAL` | `setItemAvailability` and `getSellableGrid` exist, but availability is held in a process-local map, not durable; no authenticated API route exists. Not surfaced in this page unless persistence is completed. |
| Category configuration | `PARTIAL` | `StoredMenuCategory` exists and seed rows are present; no list/create/edit route or admin UI exists. |
| Price resolution tests | `PARTIAL` | `tests/unit/pricing-resolution.test.ts` covers resolver rules; no price-publish API, authorization, persistence, or UI tests exist. |
| Authorization | `PARTIAL` | `authorize` defines `menu:view`, `menu:manage`, and `price:manage`; `OWNER`, `HQ_OPS`, and `MENU_PRICING_ADMIN` can manage menu; `OWNER`, `HQ_OPS`, `HQ_FINANCE`, and `MENU_PRICING_ADMIN` can manage prices. Existing GET routes check `menu:view`; the write use cases have no session boundary. |
| Audit | `PARTIAL` | Existing service methods emit menu/price audit events, but callers/actor identity are not secured at an HTTP boundary and price audit does not include a before/after policy diff. |
| Product/pricing analytics | `MISSING` | No page-specific products/pricing events were found. Existing structured Pino logger is available. |
| Persistence | `IMPLEMENTED` (pilot adapter only) | `memoryStore.menuItems`, `menuCategories`, and `pricePolicies` are serialized to atomic JSON `data/db.json`; PostgreSQL schema definitions exist but this runtime uses the file-backed map. The store's `ensureSeed()` inserts fixed development catalog and policies without a production/demo guard or `isDemoData` marker. |
| Price approval/versioning/soft deactivation | `MISSING` | Task/PRICING spec calls for future-effective audited policy changes, approval where required, concurrency conflicts, and soft deactivation. Current store has no policy status/version/approval workflow. |
| CSV import, package/components, synonyms, portions | `UNSUPPORTED` in the persisted runtime | The product spec describes these fields, but current stored menu item shape/routes do not persist or manage them. Do not display or imply them. |
| Production authentication | `UNSUPPORTED` | The existing auth adapter is fake development auth and returns no session in production. Runtime/API checks must be described as local fake-session evidence, not production login proof. |

## Baseline field/action contract

| UI field/action | Existing domain source | Existing persistence source | Existing server entrypoint | Baseline scope/status |
|---|---|---|---|---|
| Product name/category/active | `StoredMenuItem` | `menuItems`, `menuCategories` | `GET /api/v1/menu/items` | Org filter only; partial |
| Product create | `upsertMenuItem` | `menuItems` (+ possible default category) | None | No authenticated boundary; partial |
| Product edit | No update use case | None | None | Missing |
| Current organization price | `StoredPricePolicy` / ORG policy lookup | `pricePolicies` | `GET /api/v1/menu/prices` | Temporal selection is incomplete; partial |
| Area/location effective price | `resolvePriceForSale` | `pricePolicies` joined at use-case level | Sale path only | Implemented for sale calculation; no admin read route |
| Change/publish price | `publishPricePolicy` | Append to `pricePolicies` + audit event | None | No authenticated/validated/idempotent write boundary; partial |
| Product active/inactive mutation | Boolean storage only | `menuItems.active` | None | Missing lifecycle safeguards |
| Location availability | `setItemAvailability` | Process-local map | None | Non-durable; unsupported for UI claims |
| CSV/package/synonym/portion editing | No complete storage flow | Not represented by persisted model | None | Unsupported |

## Cross-cutting ground truth

- Monetary values are integer IDR rupiah units; price policy and sale snapshot amounts use `unitPriceMinor`.
- The price resolver preserves provenance and sales store price snapshots; the products page must never rewrite historical sale snapshots.
- Existing policies have `effectiveFrom`/optional `effectiveTo` and scope (`ORG`/`AREA`/`LOCATION`), but the published-policy service currently does not reject non-positive amounts, invalid menu/scope relationships, overlapping ties, or invalid effective windows.
- Existing hard-coded seed names and prices are runtime database seed rows, not safe fallbacks. A page must render fetched records or explicit empty/error states; it must not duplicate the seed constants.
- The global task backlog labels this repository Phase 0, but worktree `AGENTS.md` says the archived end-to-end page prompts are authoritative for this work. This audit follows page 07 and does not update unrelated roadmap/status documents.

## Scope boundary before implementation

Implement only a truthful catalog/pricing page on the capabilities that can be backed by persisted data and the existing resolver/policy service. Do not claim package editing, CSV import, category maintenance, location availability, approval workflow, or production authentication unless that capability is actually completed and tested. Keep the existing storage adapter; no schema migration is presumed without a demonstrated need.

---

## Implementation update and verified evidence (2026-09-30)

The table above is the **pre-implementation baseline**, not the current status. This addendum records changes made after that audit; it does not erase the original ground truth.

### Current classification

| Capability | Current status | Implementation/evidence |
|---|---|---|
| `/products` catalog UI | `IMPLEMENTED` for supported pilot capabilities | `src/app/products/page.tsx` loads the real API, offers search/category/status/location filters, and presents empty/loading/error and mutation feedback states. Browser visual/interaction acceptance remains `UNKNOWN`. |
| Organization-scoped catalog read | `IMPLEMENTED` | `GET /api/v1/menu/items` calls `listCatalogProducts`; filters are bounded and deterministic, category/area/location options are organization-scoped, and price history is limited to 12 newest policies per item. |
| Base and outlet-effective current price | `IMPLEMENTED` for adapter/resolver | Catalog and prices GET call the shared resolver with the selected selling location and expose policy provenance, explicit resolution state, and effective time. |
| Product create | `IMPLEMENTED` for simple sellable product only | `POST /api/v1/menu/items` requires an existing same-organization category, server-derived organization/actor, strict body validation, an idempotency key, and audit. |
| Product edit, package/component and CSV management | `UNSUPPORTED` or `MISSING` | No persisted/modelled end-to-end capability was added; not shown as supported page actions. |
| Active/inactive lifecycle | `IMPLEMENTED` with safety conditions | Idempotent status PATCH and audit; current/future price-policy references block deactivation; the sale service independently rejects inactive products. |
| ORG/AREA/LOCATION price writes | `IMPLEMENTED` for pilot runtime | Strict positive integer IDR/date/reason validation, session-derived organization/actor, same-org target checks, scope authorization, required idempotency, exact-time conflict handling, and before/after audit summaries. Approval/version workflow remains `MISSING`. |
| Category administration | `MISSING` | Existing same-org categories are readable/selectable only; no category mutation path. |
| Location availability | `UNSUPPORTED` | Prior helper is process-local and is not exposed as durable catalog capability. |
| Analytics | `IMPLEMENTED` (structured logging only) | `features/menu/analytics.ts` emits allowlisted product events; schemas and prohibited properties are documented in `docs/analytics/07-products-pricing.md`. |
| Persistence | `PARTIAL` for pilot; `UNSUPPORTED` as production DB | Active runtime remains atomic JSON-backed `memoryStore`; `ensureSeed()` now avoids adding seed data at production startup but does not remove existing seed rows or provide production database guarantees. |
| Authentication | `UNSUPPORTED` for production | Development fake sessions test route RBAC; production adapter intentionally returns no session. |
| Downstream shift transaction price display | `PARTIAL` | `/transactions` now reloads location-effective menu/prices for selected shift `startLocationId`; legacy `/sell` still has hard-coded display fallback and no location selection. |

### Implementation and proof summary

- New page-specific route/model/use-case files: `src/features/menu/catalog.ts`, `src/features/menu/analytics.ts`, `src/app/api/v1/menu/items/[menuItemId]/status/route.ts`, and `src/app/products/page.tsx`; the existing menu/items, menu/prices, pricing and sales paths were extended rather than replaced with competing services.
- Mutations derive tenant and actor from the server session; request bodies do not choose either. Catalog reads and direct product mutations enforce organization ownership.
- Test commands on 2026-09-30: focused API/resolver tests passed (**2 files / 13 tests**); full suite passed (**28 files / 140 tests**); `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- Local Next development runtime smoke checks: `/products` returned HTTP 200; `/api/v1/menu/items?limit=2` and `/api/v1/menu/prices` returned HTTP 200; product analytics emitted only allowlisted coarse fields. Runtime used fake `MENU_PRICING_ADMIN` auth and local file-backed data.
- Full implementation mapping, data/persistence boundaries, RBAC, price semantics, and limitations are in `docs/integration/07-products-pricing-architecture.md`. Command/runtime evidence and explicit not-proven items are in `docs/integration/07-products-pricing-runtime-evidence.md`. Remaining gaps/acceptance steps are in `docs/integration/07-products-pricing-gap-report.md`.

### Evidence limits and completion status

This page is **not marked complete**: there was no browser journey, visual/mobile/accessibility inspection, or browser console review. Production auth, PostgreSQL durability/concurrent writes, approval workflow, and the legacy `/sell` consumer remain unverified or unsupported. Local curl and server-render evidence do not prove browser acceptance. Page 06 browser acceptance also remains outstanding and is not implied here.
