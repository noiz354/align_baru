# SiomayOps Wave3 IMPLEMENTATION

**Narrow fix:** no new provider integration — harden and prove existing signed-callback path (already file-backed) is exactly-once; verify HMAC boundary + dedupe persisted.

## Existing real boundary (verified, not demo)

- `src/server/payments/webhook-verifier.ts` — `verifyProviderCallback({providerId, rawBody, headers})` requires `process.env.PAYMENT_WEBHOOK_SECRET` and `headers["x-signature"]` as 64-hex `sha256(secret, rawBody)`. Uses `createHmac("sha256", secret).update(rawBody).digest()` + `timingSafeEqual` (constant-time). Returns `REJECTED SIGNATURE_INVALID` if secret missing or signature not 64-hex or HMAC mismatch; `MALFORMED`/`REFERENCE_UNKNOWN`/`AMOUNT_MISMATCH` for payload shape. Tested via `POST /api/v1/webhooks/payments/qris` with `x-signature`.

- `src/app/api/v1/webhooks/payments/[provider]/route.ts` — `POST` reads `rawBody=text`, collects `headers`, calls `verifyProviderCallback`; on `REJECTED` returns `400 error.code=REJECTED.reasonCode` (e.g. `SIGNATURE_INVALID`); on `VERIFIED` calls `verifyPaymentViaCallback({provider:callback.providerId, providerReference:callback.providerReferenceId, signatureValid:true, rawPayload:rawBody, amountMinor:callback.amountMinor})` (signatureValid already verified).

- `src/features/payments/index.ts::verifyPaymentViaCallback` — exactly-once: `dedupeKey = provider|providerReference` loop over `memoryStore.paymentCallbacks` (org-scoped) → if found returns `{status:"DUPLICATE", paymentId}` without double-crediting; else validates signatureValid branch (writes `callback_rejected` audit if false), finds `payment` by `providerReference` + org, records `paymentCallbacks` entry `{id, organizationId, paymentId, provider, providerReference, signatureValid, receivedAt, rawPayloadJson, dedupeKey}` (persisted via `memoryStore.paymentCallbacks.set` auto-`persistStore()`), checks `amountMinor` equality → `VALIDATION_FAILED` if mismatch, asserts `assertPaymentTransition(payment.status→PAID, {actorKind:"SYSTEM_PROVIDER_CALLBACK", hasVerifiedProviderEvidence:true})` (guards `PENDING_VERIFICATION→PAID` per `STATE_MACHINE.md`), idempotent if already `PAID`, otherwise sets `payment.status=PAID`, `verifiedAt/verifiedBy`, writes `payment.verified` audit, completes sale.

- `src/features/payments/index.ts::createDigitalPayment` — idempotent via `memoryStore.paymentByClientId` (`clientPaymentId` UUIDv7) → return existing without duplicate; validates sale exists else `NOT_FOUND`, checks no existing `PAID` for sale else `CONFLICT`, amount equals `sale.totalMinor` else `VALIDATION_FAILED`, creates `payment {id:generateId(), organizationId, saleId, method, amountMinor, status: QRIS_STATIC? PENDING_VERIFICATION:PENDING, providerReference:PROV-xxxx, clientPaymentId, createdAt, updatedAt}` (persisted via Map `set` → `persistStore`), writes `payment.recorded` audit.

- `src/server/db/memory-store.ts` — file-backed `data/db.json` (JSON, atomic `writeFileSync(tmp)+renameSync`, `loadStore()` on startup, `wrapMapsForPersist()` wrapping `Map.set/delete/clear` and `auditEvents.push` to auto `persistStore`). Persists `payments`, `paymentCallbacks`, `sales`, `auditEvents` etc. Survives `kill; npm run dev` restart. Seed `ensureSeed()` creates org/shift/menu/stock if missing.

## Env / config

- `PAYMENT_WEBHOOK_SECRET=0123456789abcdef... (64-hex)` set for dev (`PAYMENT_WEBHOOK_SECRET=012345...` 64 chars `sha256` key) — verifier requires 64-hex `x-signature`.
- `FAKE_AUTH_ROLE=OPERATOR` or default `HQ_OPS` via `createAuthPort` (fake provider) — no real Better Auth needed for payment honesty proof; org `00000000-0000-7000-0000-000000000001`.

## Seeded ids

- `shiftId` `00000000-0000-7000-0000-000000000001` `OPEN` (`Alun-alun Bandung` loc)
- `menuItemId` `00000000-0000-7000-0000-000000000101` `Siomay Ayam 15000`
- `menuItemId` `00000000-0000-7000-0000-000000000102` `Siomay Campur 18000`
- `provider` `qris` (path param)

No new migration; reused `PGlite`? No Postgres, `memoryStore` file-backed satisfies Wave3 "narrowest fix + file-backed durable" per GLOBAL RULE (prefer FS dev adapter).

Wave3 scope: existing signed-callback implementation was verified; no SiomayOps source files were changed for this evidence-only slice. Wave3 evidence is committed separately from implementation work.
