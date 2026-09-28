# F-022 GATE-DETERMINISM — ACCEPTANCE

Observable completion. Each item is checked, not asserted. The checkbox in
[execution/CHECKLIST.md](../../../execution/CHECKLIST.md) becomes `[x]` only from
recorded evidence here.

## A1 — The suite is shell-independent

- [ ] `npx vitest run` with no `NODE_ENV` set → 605 pass / 0 fail
- [ ] `NODE_ENV=test npx vitest run` → 605 pass / 0 fail
- [ ] `NODE_ENV=production npx vitest run` → **605 pass / 0 fail** (was 601/4)
- [ ] `NODE_ENV=bogus npx vitest run` → 605 pass / 0 fail

## A2 — The specific failure class is gone

- [ ] `NODE_ENV=production npx vitest run tests/integration/media-delivery.test.ts`
      → 23 pass / 0 fail
- [ ] the four previously-failing tests are green **without** their env being fixed
      by hand: "serves bytes with the full header contract", "draft key 404
      anonymous, 200 for the admin cookie", "404s an unknown key and a malformed key
      alike", "HEAD mirrors the GET headers with no body"

## A3 — The production rule is untouched

- [ ] `loadEnv()` still refuses `NODE_ENV=production` with an `http://` origin
      (NFR-SEC-009). Prove it, do not assume it:
      `NODE_ENV=production APP_ORIGIN=http://127.0.0.1:3199 … npm run seed` → refuses
- [ ] `media/[assetKey]/route.ts` is **byte-identical** to `7af4e6a`
- [ ] the diff touches no file under `src/`

## A4 — The pin is where it belongs

- [ ] the value is set in `vitest.config.ts`, not in a test file, not in a
      `beforeAll`, and not in a `setupFiles` hack
- [ ] `tests/e2e` remains excluded from Vitest (Playwright owns it), so the two
      runners do not double-count
- [ ] `npx next build` still succeeds (build must not inherit the pin)

## A5 — Regression evidence

- [ ] a mutation check: remove the pin, re-run A1's third row, and observe 4 failures
      return. A pin that is never seen to fail is not known to work.

## Evidence to record

| Field | Value |
|---|---|
| Commit | |
| Tests before | 601 pass / 4 fail (`NODE_ENV=production`) |
| Tests after | |
| Commands | |
| Notes | |

## Out of scope for acceptance

The number of tests. If a future change legitimately changes the test count, A1's
"605" is re-baselined in [execution/CHECKLIST.md](../../../execution/CHECKLIST.md)
with a reason — not silently updated here.
