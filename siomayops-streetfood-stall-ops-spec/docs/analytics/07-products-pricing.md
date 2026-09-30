# Page 07 — Products & Pricing analytics

**Date:** 2026-09-30
**Implementation:** `src/features/menu/analytics.ts` using the existing structured Pino logger. This is not a separate analytics SDK or event warehouse integration.

## Event catalogue

| Event | Trigger | Allowed properties | Downstream use |
|---|---|---|---|
| `products_viewed` | Authorized catalog list request | `page: "products"`, `requestId`, optional coarse `filter` (`search`, `categoryId`, `status`, `sellingLocationId`) | Determine catalog usage and the types of filters operators use; it does not identify a particular product or outlet. |
| `product_created` | Product create mutation succeeds | `page`, `requestId`, `action: "create"`, `status` | Count successful product-create operations and correlate to a server request. |
| `product_price_changed` | Price policy publication succeeds | `page`, `requestId`, `action: "price"`, `status` | Monitor successful price-change operations without exposing the price or target. |
| `product_status_changed` | Product active-state mutation succeeds | `page`, `requestId`, `action: "status"`, `status` | Monitor successful lifecycle changes. |
| `product_change_failed` | Invalid, unauthorized, conflicting, missing, or failed product/price/status mutation | `page`, `requestId`, action (`create`, `price`, or `status`), HTTP status | Diagnose aggregate failure rates by action and response class without copying request content. |

The read event is currently emitted for the catalog-items GET. The price GET does not emit a separate page-view event. Mutation success events are emitted only inside the idempotent operation, so a replay does not repeat the success event; route failures are recorded separately where the handler reaches the failure instrumentation.

## Prohibited properties

The product analytics helper accepts an allowlisted property shape and intentionally excludes:

- Product names, category names, menu-item IDs, policy IDs, and location/organization IDs.
- Price values, currency totals, effective dates, or other commercial terms.
- User-entered `reason`, raw request/response bodies, and validation payloads.
- Session credentials, auth tokens, personal data, media, or other sensitive data.

Stable request IDs are diagnostic correlation values, not business identifiers. This low-cardinality design intentionally means telemetry cannot answer which particular item was changed.

## Observability and retention notes

Events are written as structured server log records with message `product_analytics`; event fields use the `eventName` and `page` keys. Local runtime logs showed the allowlisted fields for catalog reads and mutation successes/failures. No product-specific metrics/tracing SDK is present. Log transport, retention, access control, alert thresholds, and warehouse aggregation are deployment responsibilities and were not verified in this repository runtime.
