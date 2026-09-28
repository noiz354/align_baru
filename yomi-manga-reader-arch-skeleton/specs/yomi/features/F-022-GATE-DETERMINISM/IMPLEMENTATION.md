# F-022 GATE-DETERMINISM — IMPLEMENTATION

Planned technical change. One file, one concern.

## Change

`vitest.config.ts` — set `NODE_ENV` for the test environment.

The mechanism is Vitest's `env` option (it populates `process.env` for the test
environment). It is preferred over a `setupFiles` script because it is declarative,
visible in the same file as the rest of the harness configuration, and cannot be
bypassed by a test file that forgets to import it.

## Files

| File | Change |
|---|---|
| `vitest.config.ts` | add `env: { NODE_ENV: 'test' }` to the test config |

Nothing under `src/` changes. Nothing in CI changes. No migration.

## Why not the alternatives

| Alternative | Why not |
|---|---|
| Fix `media/[assetKey]/route.ts` to not 500 | **Wrong.** The 500 is the documented §6 answer to a boot failure. Changing it would hide a real refusal and, if done to return 200, would serve nothing. |
| Relax `loadEnv()` to allow `http://` in production | **Wrong.** That is NFR-SEC-009, and the reason a dev server refuses to start on a LAN IP. |
| Tell developers to set `NODE_ENV=test` | Documentation is not enforcement. The mistake recurs. |
| Add the check to CI only | CI is already correct. The defect is local. |

## Risk

**None to production.** The change is confined to the test runner's process
environment. `next build` and `next start` do not read it.

The only way this could be harmful is if a test *should* depend on a non-`test`
`NODE_ENV`. No such test exists — and A3's check that the production rule still
fires confirms the pin does not leak into the application's own env handling.

## Order of work

1. Read `vitest.config.ts`; confirm it currently sets no `NODE_ENV`.
2. Record the failing baseline: `NODE_ENV=production npx vitest run
   tests/integration/media-delivery.test.ts` → 23 pass / **4 fail**.
3. Add the pin.
4. Re-run the same command → 23 pass / 0 fail.
5. Re-run the full suite under `NODE_ENV=production` → 605 pass / 0 fail.
6. A3: prove the production rule still refuses.
7. A5: remove the pin, observe 4 failures return, restore it.
8. Full regression gates.
9. Commit as `F-022-S1`.

## Commit scope

One file. The message states the before/after count, because the count is the
evidence.
