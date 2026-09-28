---
name: test-the-shipping-code
description: Use when writing a test, a fixture, or a mock — before committing to one. A test that exercises a different code path, response shape, or filter than production does not cover the defect it appears to.
---

# Test the code that ships

A test and the code it is supposed to protect are allowed to agree on a shape. When
they disagree, a test can be perfectly green while the product is broken — and the
disagreement is invisible, because nobody compares the two.

## The failure this prevents

In this repository, a Playwright fixture served `{ slug, name }` from a hand-rolled
route handler. The real API returned `{ id, name }`. Both the test and the assertion
were written against the fixture, so every catalog E2E passed, for two weeks, while
the product's own facet shape was wrong. The harness and the API had silently forked,
and the green suite was the evidence of the fork.

The fixture was not a small shortcut. It was a second implementation of the thing
under test.

## The test

Ask this before writing an assertion: **does this exercise the production path, or a
parallel path I built for the test?**

Then check it mechanically:

- Does the response the test reads come from the route handler, the repository, or a
  stub I wrote?
- Do the field names in the fixture appear verbatim in the real contract, or did I
  invent a friendlier version?
- If I changed the product's response shape, did I change the fixture in the same
  commit, or is the fixture now asserting a shape I stopped shipping?
- If the test calls the database at all. A unit test that mocks the query does not
  cover the query.

The strongest available signal: a test that fails when you break the product. Turn
the defect back on, watch the test go red, then turn it off. A test you cannot make
fail is not protecting anything.

## Fixtures have a shelf life

A fixture encodes what the product looked like on the day it was written. Every
contract change is a chance for it to become a lie that agrees with the assertions.

- Change the contract and the fixture **in the same commit**. If you cannot, the
  fixture is not tracking the product and you have found a real problem.
- Prefer building the fixture from the contract type over hand-writing literals. A
  fixture that will not compile against a changed type cannot silently drift.
- Where a shape is genuinely awkward for a test to construct, build it through the
  real factory and then narrow it, rather than inventing the object shape.

## Two implementations, one rule

Any rule expressed in two places will diverge — once in a type or a helper, once in a
test, once in a SQL string, once in a comment. See `one-rule-one-definition` for the
general case; for a test specifically: a fixture that re-derives a rule the product
also derives is the test becoming a second source of truth.

## Report what was exercised

When a test layer is partly substituted, say which parts. "268 E2E passing" hides that
some ran against a fixture. Name the substitution and the reason.
