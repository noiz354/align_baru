---
name: gate-honesty
description: Use when reporting test results, CI status, or completion — before writing a summary. A skipped suite, a downgraded assertion, or a waived check must be visible in the number, not hidden inside it.
---

# A gate that quietly shrinks is a lie

The dangerous outcome is not a red gate. It is a green gate that covers less than the
person reading it believes. A summary that says "tests pass" when 21 suites skipped is
technically defensible and practically deceptive.

## Never collapse a number

`2 passed, 1 failed` is not "tests pass". `21 skipped` is not "21 passed". Report the
parts.

Before writing a summary, pull the actual counts and the skip list. If the tool prints
skips separately, they are not noise — they are the most important number in the run.

## Report the substitution, not the intent

Three ways a gate loses coverage quietly:

| Substitution | How it hides | How to report it |
|---|---|---|
| Suite skipped for a missing service | Exit code 0 | "21 suites skipped — no Postgres; DB paths unverified" |
| Assertion downgraded or quarantined | Still counted as passing | Name the quarantined test and why |
| Command narrowed to make it pass | Looks like the full gate | "ran `--project unit` only; integration not run" |

## Know which of your checks actually execute

A repo can appear to have a gate that never runs. In this repository, `homeops`'s
integration suite skips unless a database is reachable — a deliberate, correct choice
that is still worth stating whenever a claim is made about persistence.

So: before you assert a layer is covered, confirm it is *running*. The cheapest honest
check is a deliberate fault. Break the code, confirm the suite goes red, restore it. A
layer you have never seen fail is not a layer you have evidence about.

## WARN is not OK, and OK is not verified

Keep three states distinct, and never let the third absorb the first two:

- **PASS** — ran, asserted, green.
- **SKIPPED (reason)** — did not run. A reason is mandatory; "no time" is not one.
- **FAIL** — ran and failed. This is the useful outcome. Do not hide it.

When a warning is deliberately non-blocking — a Node version mismatch that
demonstrably boots, for instance — say that it is non-blocking *and give the
evidence*. "Should be fine" is not evidence.

## Summary template

Say four things, in this order:

1. What ran, with counts.
2. What did not run, with the reason for each.
3. What was substituted, and what that does not prove.
4. What you are therefore not claiming.

The fourth is the one people skip and the one that prevents the next agent from
building on a gap they assumed was covered.
