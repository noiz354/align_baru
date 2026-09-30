# Page 05 — Transactions runtime evidence

**Verification date:** 2026-09-30 (UTC)
**Runtime:** Next.js 15.4.2 development server bound to `0.0.0.0:3000`, fake operator session guarded to development, file `data/transactions-proof.json` selected using `SIOMAYOPS_DATA_FILE`. This is local synthetic seed data, not production data.

## Commands and results

1. Dependencies: `corepack pnpm install --frozen-lockfile` — **PASS**, 281 packages installed.
2. Start server as seed operator:

   ```sh
   FAKE_AUTH_ROLE=OPERATOR \
   FAKE_OPERATOR_ID=00000000-0000-7000-0000-000000000010 \
   SIOMAYOPS_DATA_FILE=data/transactions-proof.json \
   corepack pnpm dev --hostname 0.0.0.0 --port 3000
   ```

   Server reported `Ready`; `GET /transactions` returned **200**. `GET /api/v1/shifts?status=OPEN&limit=5` returned open shift `00000000-0000-7000-0000-000000000001`; menu and effective-price APIs returned four persisted seed menu items/prices. The scoped initial transaction list returned **200**, `total=0`, with the authorized outlet option `ST-001`.

3. Runtime write used `POST /api/v1/transactions` with a unique `Idempotency-Key`, open shift above, two Siomay Ayam lines, and `cashReceivedMinor=50000`. Result:

   ```json
   {
     "status": 201,
     "data": {
       "transactionId": "db126ab4-354b-4597-8e05-73bfb9713564",
       "status": "PAID",
       "totalMinor": 30000,
       "changeMinor": 20000,
       "currency": "IDR"
     }
   }
   ```

   `GET /api/v1/transactions` and `GET /api/v1/transactions?businessDay=2026-09-30` both returned **200**, one `COMPLETED` record, 30,000 IDR. `GET /api/v1/transactions/db126ab4-354b-4597-8e05-73bfb9713564` returned **200**, two line units (quantity 2), cash `PAID` payment, and server snapshots. No client-supplied total was accepted.

4. Direct normal store inspection (`data/transactions-proof.json`) after the write showed 1 sale, 1 sale item, 1 payment, 5 stock movements (4 seed restock + 1 sale deduction), and 2 audit events (sale + payment). The sale status persisted as `COMPLETED` with integer total `30000` and business day `2026-09-30`.

5. Restart durability: stopped the server, restarted against the same `SIOMAYOPS_DATA_FILE` under `FAKE_AUTH_ROLE=HQ_FINANCE`, then fetched the transaction detail and list. Detail returned **200**, same transaction ID, status `COMPLETED`, payment amount `30000`; list reported `total=1`.

6. Unauthorized write: under the restarted `HQ_FINANCE` session, a valid `POST /api/v1/transactions` was denied **403 `FORBIDDEN`**; the account has read but not create/cash permissions. The detail remained readable. Under the final operator preview, a runtime POST with `cashReceivedMinor=0` returned **400 `VALIDATION_ERROR`**. API integration tests additionally verify unauthenticated list/detail return **401**, finance write is denied, invalid payload and missing idempotency key return **400** without creating financial records, and identical replay returns one sale/payment.

7. Analytics: runtime server logs contained `transactions_viewed`, `transaction_created` (`status=PAID`), `transaction_detail_viewed` (`status=COMPLETED`), and `transaction_filter_changed` (`filter=businessDay`), all with a request ID and no amount, identity, line, note, provider reference, or PII. API integration tests observed `transaction_create_failed` events on failed auth/validation paths.

8. Test data isolation: a prior runtime restart check exposed that the old default test-store path could be overwritten by `memoryStore.clear()` in Vitest. Added `SIOMAYOPS_DATA_FILE` override and a process-specific temp file default under `NODE_ENV=test`. Repeated full tests did not erase the selected runtime proof data; restart verification above used the same persisted file.

## Local CI-equivalent checks

Exact local command:

```sh
npm run lint && npm run typecheck && npm test && npm run build
```

Result: **PASS** — lint clean; typecheck clean; **24 test files, 122 tests passed**; Next.js production build succeeded and listed `/transactions`, `/transactions/[transactionId]`, `/api/v1/transactions`, and `/api/v1/transactions/[transactionId]`.

Remote GitHub Actions were not triggered from this worktree. The existing SiomayOps workflow step was updated to include `npm run lint` before the existing typecheck/test/build gates.

## Browser and wider repository gate limitations

- `corepack pnpm exec playwright install chromium` — **BLOCKED**; all browser download mirrors failed TLS with `ECONNRESET`.
- `corepack pnpm exec playwright test tests/e2e/transactions.spec.ts --project=operator-android` — **BLOCKED** before test execution because Playwright's `chromium_headless_shell-1155` binary is not installed. A real browser journey and browser-console inspection therefore remain outstanding; no browser success is claimed.
- `node tools/check-stubs.mjs` — repository-wide **PRE-EXISTING POLICY FAILURE**: the legacy checker requires Phase-0 throwing stubs and flags broad existing implemented routes/features; it also flags this canonical page implementation because it contains real handlers. This checker is not in the current SiomayOps CI job; it was not weakened or bypassed.
- `node tools/check-docs.mjs` — repository-wide **PRE-EXISTING FAILURE** for missing ground-truth files for prompts 01–04 and 06–17. It no longer reports a missing Page 05 ground-truth document.
- `node tools/census.mjs` — repository-wide **PRE-EXISTING FAILURE** because `IMPLEMENTATION_STATUS.md` cites `NFR-SEC-021` twice, which is absent from `PRD.md`; task 05 adds no unmapped requirement IDs.
- Unexpected runtime server errors: none observed on the successful list/create/detail/restart requests. The Playwright limitation was environmental and occurred before the browser launched.

## Completion conclusion

The persisted UI/API/read/write/auth/idempotency/analytics-log loop is demonstrated through real runtime requests and restart. **Page status remains `NOT DONE`** because the required real browser flow and browser-console evidence cannot be produced without the Playwright browser binary; analytics also remains log-only rather than a durable product analytics provider.
