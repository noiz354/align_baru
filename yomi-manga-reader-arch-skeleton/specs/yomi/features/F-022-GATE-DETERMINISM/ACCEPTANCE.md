# F-022 GATE-DETERMINISM — ACCEPTANCE

Observable completion. Each item is checked, not asserted. The checkbox in
[execution/CHECKLIST.md](../../../execution/CHECKLIST.md) becomes `[x]` only from
recorded evidence here.

## A1 — The suite is shell-independent

- [x] `npx vitest run` with no `NODE_ENV` set → 605 pass / 0 fail
- [x] `NODE_ENV=test npx vitest run` → 605 pass / 0 fail
- [x] `NODE_ENV=production npx vitest run` → **605 pass / 0 fail** (was 601/4)
- [x] `NODE_ENV=bogus npx vitest run` → 605 pass / 0 fail

## A2 — The specific failure class is gone

- [x] `NODE_ENV=production npx vitest run tests/integration/media-delivery.test.ts`
      → 23 pass / 0 fail
- [x] the four previously-failing tests are green **without** their env being fixed
      by hand: "serves bytes with the full header contract", "draft key 404
      anonymous, 200 for the admin cookie", "404s an unknown key and a malformed key
      alike", "HEAD mirrors the GET headers with no body"

## A3 — The production rule is untouched

- [x] `loadEnv()` still refuses `NODE_ENV=production` with an `http://` origin
      (NFR-SEC-009). Prove it, do not assume it:
      `NODE_ENV=production APP_ORIGIN=http://127.0.0.1:3199 … npm run seed` → refuses
- [x] `media/[assetKey]/route.ts` is **byte-identical** to `7af4e6a`
- [x] the diff touches no file under `src/`

## A4 — The pin is where it belongs

- [x] the value is set in `vitest.config.ts`, not in a test file, not in a
      `beforeAll`, and not in a `setupFiles` hack
- [x] `tests/e2e` remains excluded from Vitest (Playwright owns it), so the two
      runners do not double-count
- [x] `npx next build` still succeeds (build must not inherit the pin)

## A5 — Regression evidence

- [x] a mutation check: remove the pin, re-run A1's third row, and observe 4 failures
      return. A pin that is never seen to fail is not known to work.

## Evidence to record

| Field | Value |
|---|---|
| Commit | F-022-S1 (this commit) |
| Tests before | `NODE_ENV=production` → **4 failed / 15 passed (19)** in `media-delivery.test.ts`; full suite **601 pass / 4 fail** |
| Tests after | **19 passed (19)** in every shell condition; full suite **605 passed (605)** under `NODE_ENV=production`, `NODE_ENV=test`, and no `NODE_ENV` at all |
| Commands | `NODE_ENV=production npx vitest run tests/integration/media-delivery.test.ts` · `env -u NODE_ENV npx vitest run tests/unit tests/integration` · `NODE_ENV=bogus npx vitest run tests/integration/media-delivery.test.ts` · `npx tsc --noEmit` · `npx eslint .` · `node scripts/check-boundaries.mjs` · `node ../scripts/check-claims.mjs` · `npx next build` |
| Notes | **A5 mutation recorded.** Removing the `env` line brings back exactly 4 failures (`4 failed \| 15 passed`); restoring it returns 19/19. The pin is the cause, not a coincidence. **A3 confirms the production rule is intact**: `NODE_ENV=production` + `http://` still refuses to boot with `APP_ORIGIN: must use https (NFR-SEC-009)` and the S3 endpoint rejected, so the pin scopes to the Vitest process only. The diff is 1 file, +17 lines, nothing under `src/`, and `src/app/media/` is byte-identical. `next build` still compiles, and Vitest still lists 0 e2e files. |

## Out of scope for acceptance

The number of tests. If a future change legitimately changes the test count, A1's
"605" is re-baselined in [execution/CHECKLIST.md](../../../execution/CHECKLIST.md)
with a reason — not silently updated here.
