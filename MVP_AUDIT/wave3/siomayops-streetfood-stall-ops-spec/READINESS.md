# SiomayOps Wave3 READINESS

**Wave2:** `MVP_PARTIAL` — POS and payment flows existed, but server-verified callback behavior was not proven end to end.

**Wave3:** `MVP_PARTIAL` (no promotion)

**Proven boundary:** QRIS payment state is callback-driven: valid signed callback → `PAID`; replay → `DUPLICATE`; parallel duplicate callbacks converge to one `PAID` and one `DUPLICATE`; amount mismatch → `VALIDATION_FAILED` while pending; unknown reference → `NO_MATCH`; invalid HMAC → `SIGNATURE_INVALID`. Restart preserved both a paid and a pending state. A cash sale for Rp15.000 completed with Rp5.000 change. Sale replay and stock movement tests verify one sale/movement for a repeated client id. `npm run typecheck` passed and `npm test` passed 108 tests.

**Why not MVP_READY:** this wave hardens the signed-payment boundary only. It does not claim all offline-queue, stock/revenue reconciliation, closing, audit-export, or provider-adapter boundaries are production complete. Readiness remains `MVP_PARTIAL`.

**Evidence:** `MVP_AUDIT/wave3/siomayops-streetfood-stall-ops-spec/{BASELINE,IMPLEMENTATION,RUNTIME_PROOF,FAILURE_CASES,READINESS.md}`. Runtime DB files and generated illustrative mockups are excluded; no actual screenshots are claimed.