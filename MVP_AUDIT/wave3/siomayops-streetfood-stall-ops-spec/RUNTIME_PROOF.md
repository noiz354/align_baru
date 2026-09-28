# SiomayOps Wave3 RUNTIME_PROOF

**Scope:** signed payment callback verification, idempotent sales/stock operations, and durable payment-state restore. Runtime database artifacts are intentionally excluded.

## Observed payment flow

- Cash sale **`70fa7a4c-1b46-476a-9a3f-7f149023759d`** totaled **Rp15.000**; it was paid with Rp5.000 change.
- A QRIS amount-mismatch callback returned `VALIDATION_FAILED`; the payment remained pending.
- A valid signed callback transitioned its matching pending payment to `PAID`; replay returned `DUPLICATE` and did not apply a second payment transition.
- Parallel duplicate callback requests converged to one `PAID` and one `DUPLICATE` result.
- A correctly signed callback for an unknown provider reference returned `NO_MATCH`.
- An invalid HMAC returned `SIGNATURE_INVALID` and did not mark a payment paid.
- After application restart, the previously paid and pending payment states were both preserved.

## Exactly-once checks

- Sale replay tests return the same sale ID for a repeated `clientSaleId`; a duplicate in a sync batch is `DUPLICATE`, with one sale row.
- Stock movement replay tests return the same movement ID for a repeated `clientMovementId`, with one movement row.
- Pending digital payment is excluded from cash totals; callback replay cannot record a second successful payment transition.

## Regression checks

- `npm run typecheck` → pass.
- `npm test` → **108 tests passed**, including payment honesty, webhook verification, sale/idempotency, and stock derivation.

The earlier desktop/mobile images were illustrative generated mockups, not captures of the running application; they have been removed. No actual browser screenshots are claimed.