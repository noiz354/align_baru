# F-022 GATE-DETERMINISM — SPEC

## User problem

Nobody — a reader, an operator, or a maintainer — can trust a test number. The same
suite reports 601 pass or 605 pass depending on an environment variable nobody set
deliberately, and the 4 "failures" that appear are a **correct refusal** by the
application being reported as a production defect.

Concretely: a developer working in a shell where `NODE_ENV=production` is exported
runs `npx vitest run`, sees 4 failures in `media-delivery.test.ts`, and concludes the
media lane is broken. On 2026-09-28 that exact mistake was made here, carried through
a full commit message, and nearly produced a remediation for a defect that does not
exist. The cost was not the 4 failures; it was the plan built on top of them.

## Current implementation

`vitest.config.ts` does not set `NODE_ENV`. Vitest does not set it either. So it is
inherited from the shell.

`loadEnv()` refuses to boot with `NODE_ENV=production` over `http://` — NFR-SEC-009,
correct, and the reason a dev server refuses to start on a LAN IP. When the media
route's env load fails, it raises `INTERNAL_ERROR` (§6 500), which is the documented
behaviour. The suite is reporting the refusal faithfully.

CI is unaffected: `.github/workflows/project-checks.yml:108` sets `NODE_ENV: test`.

## Required behaviour

The test harness is deterministic regardless of the invoking shell. The suite's
result is a property of the code, not of the environment it was launched from.

## Scope

- Pin `NODE_ENV` for the Vitest environment in `vitest.config.ts`.

## Non-goals

- Changing `loadEnv()` or its NFR-SEC-009 rule. **That rule is correct.**
- Changing `media/[assetKey]/route.ts`. **Its §6 500 on boot failure is correct.**
- Making production-mode test runs meaningful. Tests are not production.
- Renaming or restructuring the env schema.

## API changes

None. No route, no contract.

## UI changes

None.

## Persistence / schema changes

None. No migration.

## Authorization

Not applicable.

## Error behaviour

Unchanged. This slice removes a false signal, it does not add a code.

## Edge cases

| Case | Expected |
|---|---|
| `NODE_ENV=test` in the shell | 605 pass / 0 fail |
| `NODE_ENV=production` in the shell | 605 pass / 0 fail — the same |
| `NODE_ENV` unset | 605 pass / 0 fail |
| `NODE_ENV=bogus` in the shell | 605 pass / 0 fail |
| `npx next build` (needs `NODE_ENV=production`) | unaffected — build does not read this |
| `npx next start` over `http://` | **still refused.** The rule is intact. |

That last row is the acceptance test that matters most: pinning `NODE_ENV=test` for
tests must not weaken the production rule. A reviewer should be able to confirm the
two are independent.

## Affected files

- `vitest.config.ts` — 1 file

## Dependencies

None. First slice.

## Acceptance criteria

See [ACCEPTANCE.md](ACCEPTANCE.md).

## Verification

See [ACCEPTANCE.md](ACCEPTANCE.md) and [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Rollback concern

**None.** The change is additive configuration, confined to the test runner. If it
were wrong, reverting restores the previous behaviour exactly. There is no
migration, no contract and no data to unwind.
