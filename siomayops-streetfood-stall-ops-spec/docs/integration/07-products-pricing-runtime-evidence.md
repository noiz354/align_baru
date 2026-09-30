# Page 07 — Products & Pricing runtime evidence

**Date:** 2026-09-30 (Asia/Jakarta)
**Runtime:** local Next.js 15.4.2 development server, file-backed pilot store, fake `MENU_PRICING_ADMIN` session.
**Status:** build, automated checks, route smoke tests, and server-render response verified. Browser journey, browser console, and production auth are not verified.

## Checks and results

### Automated checks

Commands run from `siomayops-streetfood-stall-ops-spec/`:

```sh
npm run test -- tests/integration/products-pricing-api.test.ts tests/unit/pricing-resolution.test.ts
npm test
npm run typecheck
npm run lint
npm run build
```

Results:

- Focused product/pricing and resolver checks: **2 files, 13 tests passed**.
- Full Vitest suite: **28 files, 140 tests passed**.
- `tsc --noEmit`: passed.
- ESLint: passed.
- Next production build: passed; `/products`, the catalog/status/price API routes, and `/transactions` were included in the route manifest. Next emitted a non-blocking warning that its ESLint plugin is not detected in the repository ESLint configuration.
- `npm run check:docs` remains blocked by dangling ground-truth references for pages 01–04 and 08–17. Page 07 is not among the reported dangling references.

Product/pricing integration coverage includes authenticated/scoped catalog reads, unauthorized view and write boundaries, foreign-category and foreign-product behavior, idempotent create and price requests, positive amount/scope validation, exact-time policy conflicts, location override resolution, audit summaries, status transitions and deactivation protection, and the independent inactive-product sale rejection. Existing resolver unit tests cover price precedence, temporal eligibility, and ambiguous/no-price outcomes.

### Local server and route smoke checks

The local server was started with:

```sh
FAKE_AUTH_ROLE=MENU_PRICING_ADMIN npm run dev -- --hostname 0.0.0.0
```

Port 3000 was occupied by an unknown process; Next selected port **3002**. Server logs reported ready, then successfully compiled `/products`, `/api/v1/menu/items`, and `/api/v1/menu/prices` without a server error.

Executed requests:

```sh
curl -sS -o /tmp/products-page.html -w 'page_http=%{http_code} bytes=%{size_download}\n' http://127.0.0.1:3002/products
curl -sS -D /tmp/menu-headers -o /tmp/menu.json 'http://127.0.0.1:3002/api/v1/menu/items?limit=2'
curl -sS -o /tmp/prices.json -w 'prices_http=%{http_code}\n' 'http://127.0.0.1:3002/api/v1/menu/prices'
```

Observed: `/products` returned **HTTP 200**, 15,731 bytes; catalog returned **HTTP 200** with two rows for the requested page, real category/location options and `canManageProducts`/`canManagePrices` capability flags; price resolution returned **HTTP 200** and five price rows from the current local store. Logs showed `products_viewed` with a coarse filter key and request ID, not item names, amounts, or IDs.

This is a local smoke check against the fake development identity and current local file-backed data. It does not assert the DOM after client hydration, submit UI forms, or prove any live business catalog correctness.

## Automated behavior evidence

The test suite directly exercises route handlers and the current persistence adapter. It confirms that a different organization’s product is omitted from list results and its direct status mutation is hidden; unauthorized roles cannot create products or prices; same-key replays do not duplicate create/policy writes; location-scoped prices are returned by both catalog and price reads; policy and status actions append audit events; and inactive products are rejected by the sale service.

The product analytics logger emitted only the allowlisted `page`, `eventName`, `requestId`, coarse `action`, `status`, and/or filter type. No raw product name, amount, organization ID, policy ID, free-text reason, or request body was observed in emitted product events.

## Not proven / acceptance remains open

- No Chromium executable or cached Playwright browser was available, so no browser UI journey, responsive visual acceptance, accessibility keyboard journey, or console inspection was performed.
- Production authentication is unsupported by the current adapter; these runtime/API checks used the local fake session.
- Runtime checks cover the JSON-backed pilot adapter only, not PostgreSQL, multi-process persistence, operational deployment, or production durability.
- `/sell` remains a legacy pricing consumer with a hard-coded display fallback and no selected selling location; only the `/transactions` shift-based entry form was adjusted to load location-effective prices.
- No synthetic create/price/status mutation was made against the persistent runtime during this smoke check. Mutation persistence and idempotency were verified in isolated integration tests, not by a stop/restart browser journey.

The user should verify the `/products` UI and an outlet-specific price update in their browser before this page is marked complete. Page 06 browser acceptance also remains outstanding and is not implied by this evidence.
