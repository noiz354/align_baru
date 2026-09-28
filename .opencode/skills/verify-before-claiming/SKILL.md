---
name: verify-before-claiming
description: Use before stating any environment fact (a package is installed, a test passes, a route is wired, a service is reachable) — run the check that would falsify it first, and report the observed output rather than the expectation.
---

# Verify before claiming

A claim about the environment is a hypothesis until a command has run. Comments and
docs that state environment facts outlive the run that justified them, so an unverified
claim silently becomes fact for the next reader.

## The failure this prevents

In this repo, two test files still carried the comment that `@axe-core/playwright`
was not installed — while the dependency was present in `package.json` and three
sibling specs were importing it. The comment was written when it was true, never
updated when it stopped being true, and it was the reason a reader did not fix a real
axe gap. A false claim is worse than no claim: it makes a reader look in the wrong
direction.

## Rule

Before writing a sentence that asserts an environment fact, ask what would prove it
false, and run that. Facts that survive only because nobody checked are the ones that
bite.

| Claim | Cheapest check that could falsify it |
|---|---|
| "X is not installed" | `package.json` deps, plus a repo-wide search for an import of it |
| "X is installed" | the same, in both directions — a dep can be present and unused |
| "the test suite passes" | the command, and the pass/skip counts |
| "this route/page works" | boot the app and hit the path, not a unit test of the handler |
| "the wiring is called by X" | grep for the call site |
| "N tests" | count, do not estimate from file count |

## Reporting

Report what the command printed. `SKIPPED 21` is not `PASS`; `2 passed, 1 failed` is
not `tests pass`. When a check is impossible in the current environment, say so and
name what you did instead — a stated gap is usable, an implied pass is not.

## Enforcement

`scripts/check-claims.mjs` greps for falsifiable environment claims and verifies the
package-presence class of them against `package.json` and the source tree. Run it
before committing doc or comment changes. It catches the mechanical class; the
judgment calls above are still yours.
